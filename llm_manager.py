"""Standalone, configurable LLM manager.

Copy this file and the generated ``llm-profiles.json`` anywhere you need them.
It supports local GGUF models, OpenAI, Gemini, OpenRouter, OpenRouter free
models, and any provider with an OpenAI-compatible Chat Completions endpoint.

Quick start:
    py llm_manager.py --init
    # Edit llm-profiles.json: select a profile/model and set its API-key env var.
    $env:OPENROUTER_API_KEY = "..."
    py llm_manager.py --profile openrouter --prompt "Explain this email briefly."

As a library:
    from llm_manager import LLMManager
    llm = LLMManager.from_file("llm-profiles.json", "openrouter")
    answer = llm.chat("Summarize this.", system="Be concise.")
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen


DEFAULT_CONFIG_PATH = Path(__file__).with_name("llm-profiles.json")
OPENAI_URL = "https://api.openai.com/v1/chat/completions"
OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions"


class LLMError(RuntimeError):
    """Raised when a provider cannot generate a response."""


@dataclass(frozen=True)
class Profile:
    """The settings for exactly one LLM provider/model combination."""

    provider: str
    model: str
    api_key: str | None = None
    api_key_env: str | None = None
    base_url: str | None = None
    local_model_path: str | None = None
    temperature: float = 0.2
    max_tokens: int = 1024
    timeout_seconds: int = 90
    extra_headers: dict[str, str] = field(default_factory=dict)
    local_options: dict[str, Any] = field(default_factory=dict)

    @property
    def resolved_api_key(self) -> str | None:
        return self.api_key or (os.getenv(self.api_key_env) if self.api_key_env else None)


class LLMManager:
    """Provider-independent text generation with a small, stable ``chat`` API."""

    def __init__(self, profile: Profile) -> None:
        self.profile = profile

    @classmethod
    def from_file(cls, config_path: str | Path, profile_name: str) -> "LLMManager":
        config_path = Path(config_path)
        try:
            config = json.loads(config_path.read_text(encoding="utf-8"))
            profiles = config["profiles"]
            raw_profile = profiles[profile_name]
        except FileNotFoundError as error:
            raise LLMError(f"Configuration file not found: {config_path}") from error
        except (json.JSONDecodeError, KeyError, TypeError) as error:
            raise LLMError(
                "Invalid configuration. It must contain a 'profiles' object and the selected profile."
            ) from error
        if not isinstance(raw_profile, dict):
            raise LLMError(f"Profile '{profile_name}' must be a JSON object.")
        return cls.from_profile(raw_profile, profile_name)

    @classmethod
    def from_profile(cls, profile: dict[str, Any], profile_name: str = "selected") -> "LLMManager":
        """Create a manager from one in-memory profile dictionary.

        This is useful when a host application stores its selected provider in a
        database or settings UI instead of in a profiles JSON file.
        """
        return cls(_profile_from_dict(profile, profile_name))

    def chat(self, prompt: str, *, system: str | None = None) -> str:
        """Return one complete assistant response for the given prompt."""
        if not prompt.strip():
            raise ValueError("prompt cannot be empty")
        provider = self.profile.provider.lower()
        if provider == "local":
            return self._local_chat(prompt, system)
        if provider == "gemini":
            return self._gemini_chat(prompt, system)
        if provider in {"openai", "openrouter", "openrouter/free", "openai_compatible"}:
            return self._openai_compatible_chat(prompt, system)
        raise LLMError(
            f"Unsupported provider '{self.profile.provider}'. Use local, openai, gemini, "
            "openrouter, openrouter/free, or openai_compatible."
        )

    def _openai_compatible_chat(self, prompt: str, system: str | None) -> str:
        provider = self.profile.provider.lower()
        if provider == "openai":
            url = self.profile.base_url or OPENAI_URL
        elif provider in {"openrouter", "openrouter/free"}:
            url = self.profile.base_url or OPENROUTER_URL
        else:
            if not self.profile.base_url:
                raise LLMError("openai_compatible requires 'base_url' in its profile.")
            url = self.profile.base_url
        if provider == "openrouter/free" and not self.profile.model.endswith(":free"):
            raise LLMError("openrouter/free requires a model ID ending in ':free'.")

        key = self._require_api_key()
        messages: list[dict[str, str]] = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})
        response = _post_json(
            url,
            {
                "model": self.profile.model,
                "messages": messages,
                "temperature": self.profile.temperature,
                "max_tokens": self.profile.max_tokens,
            },
            {
                "Authorization": f"Bearer {key}",
                **self.profile.extra_headers,
            },
            self.profile.timeout_seconds,
        )
        try:
            content = response["choices"][0]["message"]["content"]
        except (KeyError, IndexError, TypeError) as error:
            raise LLMError(f"Unexpected response from {provider}: {response!r}") from error
        if not isinstance(content, str) or not content:
            raise LLMError(f"{provider} returned an empty response.")
        return content

    def _gemini_chat(self, prompt: str, system: str | None) -> str:
        key = self._require_api_key()
        url = self.profile.base_url or (
            "https://generativelanguage.googleapis.com/v1beta/models/"
            f"{self.profile.model}:generateContent?key={key}"
        )
        payload: dict[str, Any] = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
            "generationConfig": {
                "temperature": self.profile.temperature,
                "maxOutputTokens": self.profile.max_tokens,
            },
        }
        if system:
            payload["systemInstruction"] = {"parts": [{"text": system}]}
        response = _post_json(url, payload, self.profile.extra_headers, self.profile.timeout_seconds)
        try:
            parts = response["candidates"][0]["content"]["parts"]
            content = "".join(part["text"] for part in parts if "text" in part)
        except (KeyError, IndexError, TypeError) as error:
            raise LLMError(f"Unexpected response from Gemini: {response!r}") from error
        if not content:
            raise LLMError("Gemini returned no text (the prompt may have been blocked).")
        return content

    def _local_chat(self, prompt: str, system: str | None) -> str:
        if not self.profile.local_model_path:
            raise LLMError("local requires 'local_model_path' pointing to a GGUF file.")
        model_path = Path(self.profile.local_model_path).expanduser()
        if not model_path.is_file():
            raise LLMError(f"Local GGUF model not found: {model_path}")
        try:
            from llama_cpp import Llama
        except ImportError as error:
            raise LLMError("Local mode requires: pip install llama-cpp-python") from error
        try:
            llm = Llama(model_path=str(model_path), **self.profile.local_options)
            messages = ([{"role": "system", "content": system}] if system else []) + [
                {"role": "user", "content": prompt}
            ]
            response = llm.create_chat_completion(
                messages=messages,
                temperature=self.profile.temperature,
                max_tokens=self.profile.max_tokens,
            )
            content = response["choices"][0]["message"]["content"]
        except Exception as error:
            raise LLMError(f"Local model failed: {error}") from error
        if not isinstance(content, str) or not content:
            raise LLMError("Local model returned an empty response.")
        return content

    def _require_api_key(self) -> str:
        key = self.profile.resolved_api_key
        if not key:
            source = self.profile.api_key_env or "api_key"
            raise LLMError(f"No API key configured. Set {source} or add api_key to the profile.")
        return key


def _profile_from_dict(raw: dict[str, Any], profile_name: str) -> Profile:
    provider = raw.get("provider")
    model = raw.get("model")
    if not isinstance(provider, str) or not provider:
        raise LLMError(f"Profile '{profile_name}' needs a non-empty 'provider'.")
    if not isinstance(model, str) or not model:
        raise LLMError(f"Profile '{profile_name}' needs a non-empty 'model'.")
    allowed = {
        "api_key", "api_key_env", "base_url", "local_model_path", "temperature",
        "max_tokens", "timeout_seconds", "extra_headers", "local_options",
    }
    values = {key: value for key, value in raw.items() if key in allowed}
    return Profile(provider=provider, model=model, **values)


def _post_json(url: str, payload: dict[str, Any], headers: dict[str, str], timeout: int) -> dict[str, Any]:
    request = Request(
        url,
        data=json.dumps(payload).encode("utf-8"),
        headers={"Content-Type": "application/json", **headers},
        method="POST",
    )
    try:
        with urlopen(request, timeout=timeout) as response:
            data = json.loads(response.read().decode("utf-8"))
    except HTTPError as error:
        detail = error.read().decode("utf-8", "replace")[:1_000]
        raise LLMError(f"Provider returned HTTP {error.code}: {detail}") from error
    except (URLError, TimeoutError) as error:
        raise LLMError(f"Could not reach the provider: {error}") from error
    except json.JSONDecodeError as error:
        raise LLMError("Provider returned invalid JSON.") from error
    if not isinstance(data, dict):
        raise LLMError("Provider returned an unexpected JSON response.")
    return data


EXAMPLE_CONFIG = {
    "profiles": {
        "local": {
            "provider": "local",
            "model": "your-local-model-name",
            "local_model_path": "C:/models/your-model.gguf",
            "local_options": {"n_ctx": 8192, "n_gpu_layers": -1},
        },
        "openai": {"provider": "openai", "model": "gpt-5-mini", "api_key_env": "OPENAI_API_KEY"},
        "gemini": {"provider": "gemini", "model": "gemini-2.5-flash", "api_key_env": "GEMINI_API_KEY"},
        "openrouter": {"provider": "openrouter", "model": "openai/gpt-5-mini", "api_key_env": "OPENROUTER_API_KEY"},
        "openrouter_free": {"provider": "openrouter/free", "model": "meta-llama/llama-3.3-70b-instruct:free", "api_key_env": "OPENROUTER_API_KEY"},
        "other_api": {
            "provider": "openai_compatible",
            "model": "model-id-from-provider",
            "base_url": "https://provider.example/v1/chat/completions",
            "api_key_env": "OTHER_LLM_API_KEY",
        },
    }
}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--config", type=Path, default=DEFAULT_CONFIG_PATH, help="Profile JSON file")
    parser.add_argument("--profile", help="Profile name from the configuration")
    parser.add_argument("--prompt", help="User prompt")
    parser.add_argument("--system", help="Optional system prompt")
    parser.add_argument("--init", action="store_true", help="Create an example configuration file")
    args = parser.parse_args()

    if args.init:
        if args.config.exists():
            print(f"Refusing to overwrite existing configuration: {args.config}", file=sys.stderr)
            return 2
        args.config.write_text(json.dumps(EXAMPLE_CONFIG, indent=2) + "\n", encoding="utf-8")
        print(f"Created {args.config}. Edit a profile, then set its API-key environment variable.")
        return 0
    if not args.profile or args.prompt is None:
        parser.error("--profile and --prompt are required unless using --init")
    try:
        print(LLMManager.from_file(args.config, args.profile).chat(args.prompt, system=args.system))
        return 0
    except (LLMError, ValueError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
