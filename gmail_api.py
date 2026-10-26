"""Local HTTP API for cached Gmail fetching and progress reporting."""

from __future__ import annotations

import json
import os
import threading
import uuid
from dataclasses import dataclass, field
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any
from urllib.error import HTTPError, URLError
from urllib.request import Request as UrlRequest, urlopen

from google.oauth2.credentials import Credentials
from google.auth.exceptions import RefreshError, TransportError
from googleapiclient.discovery import build
from googleapiclient.errors import HttpError

from gmail_cache import GmailCache, fetch_with_cache
from gmail_fetch import SCOPES, get_gmail_service, parse_datetime
from llm_manager import LLMError, LLMManager
from Model_Management.main import (
    SYSTEM_PROMPT,
    email_to_message,
    MODEL_CONTEXT_TOKENS,
    select_email_body,
    stream_email_summary,
)
from Model_Management.model_config import MODEL_PATH


PROJECT_ROOT = Path(__file__).resolve().parent
API_PORT = int(os.environ.get("GMAIL_ANALYZER_API_PORT", "8001"))
CACHE = GmailCache(PROJECT_ROOT / ".data" / "gmail-cache.sqlite3")
LLM_SETTINGS_PATH = PROJECT_ROOT / ".secrets" / "llm-settings.json"
PROFILE_PHOTO_PATH = PROJECT_ROOT / ".data" / "gmail-profile-photo"
PROFILE_PHOTO_METADATA_PATH = PROJECT_ROOT / ".data" / "gmail-profile-photo.json"

DEFAULT_LLM_PROFILE: dict[str, Any] = {
    "provider": "local",
    "model": "local-qwen",
    "local_model_path": str(MODEL_PATH),
    "local_options": {"n_ctx": MODEL_CONTEXT_TOKENS, "n_gpu_layers": -1, "verbose": False},
    "temperature": 0.1,
    "max_tokens": 3072,
}
SUMMARY_TEMPERATURE = 0.1
SUMMARY_MAX_TOKENS = 3072


@dataclass
class FetchJob:
    status: str = "fetching"
    completed: int = 0
    total: int = 0
    phase: str = "Checking local cache"
    messages: list[dict[str, Any]] | None = None
    cached_count: int = 0
    fetched_count: int = 0
    error: str | None = None
    lock: threading.Lock = field(default_factory=threading.Lock, repr=False)

    def snapshot(self) -> dict[str, Any]:
        with self.lock:
            return {
                "status": self.status,
                "completed": self.completed,
                "total": self.total,
                "phase": self.phase,
                "messages": self.messages,
                "cached_count": self.cached_count,
                "fetched_count": self.fetched_count,
                "error": self.error,
            }


JOBS: dict[str, FetchJob] = {}
JOBS_LOCK = threading.Lock()
LLM_SETTINGS_LOCK = threading.RLock()


def load_llm_profile() -> dict[str, Any]:
    """Load the selected LLM profile, falling back to the existing local model."""
    with LLM_SETTINGS_LOCK:
        if not LLM_SETTINGS_PATH.exists():
            return DEFAULT_LLM_PROFILE.copy()
        try:
            profile = json.loads(LLM_SETTINGS_PATH.read_text(encoding="utf-8"))
        except json.JSONDecodeError as error:
            raise ValueError("Saved LLM settings are invalid JSON.") from error
    if not isinstance(profile, dict):
        raise ValueError("Saved LLM settings must be a JSON object.")
    # API profiles should summarize with the same sampling and output budget as
    # the established local Qwen flow.  Older saved profiles are normalized in
    # memory too, so selecting OpenRouter does not require re-saving settings.
    normalized = dict(profile)
    if normalized.get("provider") != "local":
        normalized.setdefault("temperature", SUMMARY_TEMPERATURE)
        normalized.setdefault("max_tokens", SUMMARY_MAX_TOKENS)
    return normalized


def public_llm_profile(profile: dict[str, Any]) -> dict[str, Any]:
    """Return settings the browser may see, deliberately omitting credentials."""
    public = {key: value for key, value in profile.items() if key != "api_key"}
    public["api_key_configured"] = bool(profile.get("api_key") or profile.get("api_key_env"))
    return public


def save_llm_profile(profile: dict[str, Any]) -> dict[str, Any]:
    """Validate and persist one profile locally; retain a hidden existing key when blank."""
    provider = profile.get("provider")
    allowed_providers = {"local", "openai", "gemini", "openrouter", "openrouter/free", "openai_compatible"}
    if provider not in allowed_providers:
        raise ValueError("Choose a supported LLM provider.")
    for field_name in ("model",):
        value = profile.get(field_name)
        if not isinstance(value, str) or not value.strip():
            raise ValueError(f"'{field_name}' is required.")
    if provider == "local":
        path = profile.get("local_model_path")
        if not isinstance(path, str) or not path.strip():
            raise ValueError("A local model path is required.")
    elif provider == "openai_compatible":
        url = profile.get("base_url")
        if not isinstance(url, str) or not url.startswith(("https://", "http://")):
            raise ValueError("Other API requires an http(s) Chat Completions URL.")

    try:
        existing = load_llm_profile()
    except ValueError:
        existing = {}
    api_key = profile.get("api_key")
    if api_key is not None and not isinstance(api_key, str):
        raise ValueError("API key must be text.")
    cleaned = {
        key: value
        for key, value in profile.items()
        if key in {"provider", "model", "api_key", "base_url", "local_model_path", "temperature", "max_tokens", "timeout_seconds", "local_options"}
        and value is not None
    }
    if provider != "local" and not str(api_key or "").strip():
        old_key = existing.get("api_key")
        if existing.get("provider") == provider and isinstance(old_key, str) and old_key:
            cleaned["api_key"] = old_key
        else:
            raise ValueError("Enter an API key before saving this provider.")
    if provider == "local":
        cleaned.pop("api_key", None)
        cleaned.setdefault("local_options", DEFAULT_LLM_PROFILE["local_options"])
    else:
        cleaned.setdefault("temperature", SUMMARY_TEMPERATURE)
        cleaned.setdefault("max_tokens", SUMMARY_MAX_TOKENS)
    LLMManager.from_profile(cleaned)  # Validate the profile shape before persisting it.
    with LLM_SETTINGS_LOCK:
        LLM_SETTINGS_PATH.parent.mkdir(parents=True, exist_ok=True)
        LLM_SETTINGS_PATH.write_text(json.dumps(cleaned, indent=2) + "\n", encoding="utf-8")
    return public_llm_profile(cleaned)


class GmailRequestHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path == "/api/health":
            self._send_json(HTTPStatus.OK, {"status": "ok"})
            return

        if self.path == "/api/llm-settings":
            try:
                self._send_json(HTTPStatus.OK, public_llm_profile(load_llm_profile()))
            except ValueError as error:
                self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": str(error)})
            return

        if self.path == "/api/gmail/status":
            self._gmail_status()
            return

        if self.path == "/api/gmail/profile-photo":
            self._send_profile_photo()
            return

        if self.path.startswith("/api/fetch/"):
            job_id = self.path.rsplit("/", maxsplit=1)[-1]
            with JOBS_LOCK:
                job = JOBS.get(job_id)
            if not job:
                self._send_json(HTTPStatus.NOT_FOUND, {"error": "Fetch job not found."})
                return
            self._send_json(HTTPStatus.OK, job.snapshot())
            return

        self.send_error(HTTPStatus.NOT_FOUND)

    def do_POST(self) -> None:
        if self.path == "/api/gmail/logout":
            self._logout_gmail()
            return

        if self.path == "/api/gmail/connect":
            self._connect_gmail()
            return

        if self.path == "/api/llm-settings":
            self._save_llm_settings()
            return

        if self.path == "/api/analyze":
            self._analyze()
            return

        if self.path == "/api/mark-read":
            self._mark_read()
            return

        if self.path != "/api/fetch":
            self.send_error(HTTPStatus.NOT_FOUND)
            return

        try:
            payload = self._read_json()
            start = parse_datetime(self._required_string(payload, "start"))
            end = parse_datetime(self._required_string(payload, "end"))
            if end <= start:
                raise ValueError("'end' must be later than 'start'.")

            job = FetchJob()
            job_id = uuid.uuid4().hex
            with JOBS_LOCK:
                JOBS[job_id] = job
            threading.Thread(
                target=self._run_fetch,
                args=(job, start, end, bool(payload.get("include_spam_trash", False)), bool(payload.get("force_refresh", False))),
                daemon=True,
            ).start()
            self._send_json(HTTPStatus.ACCEPTED, {"job_id": job_id})
        except (ValueError, json.JSONDecodeError) as error:
            self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})

    def _save_llm_settings(self) -> None:
        try:
            profile = save_llm_profile(self._read_json())
            self._send_json(HTTPStatus.OK, profile)
        except (ValueError, json.JSONDecodeError, LLMError) as error:
            self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})

    @staticmethod
    def _gmail_paths() -> tuple[Path, Path]:
        return (
            PROJECT_ROOT / "credentials.json",
            PROJECT_ROOT / ".secrets" / "gmail-token.json",
        )

    def _gmail_status(self) -> None:
        """A saved token is the persistent indicator of a signed-in mailbox."""
        _, token_path = self._gmail_paths()
        if not token_path.exists():
            self._send_json(HTTPStatus.OK, {"connected": False})
            return

        try:
            credentials = Credentials.from_authorized_user_file(str(token_path))
            if credentials.valid and credentials.has_scopes(SCOPES):
                self._send_json(
                    HTTPStatus.OK,
                    {"connected": True, **self._google_identity(credentials)},
                )
                return
        except (OSError, ValueError, HttpError, RefreshError, TransportError):
            # Connect Gmail and Fetch will refresh the token or request consent.
            pass

        self._send_json(HTTPStatus.OK, {"connected": True})

    def _connect_gmail(self) -> None:
        """Use the same authorization and token-refresh path as Gmail fetching."""
        credentials_path, token_path = self._gmail_paths()
        try:
            get_gmail_service(credentials_path, token_path)
            credentials = Credentials.from_authorized_user_file(str(token_path))
            identity = self._google_identity(credentials)
            self._send_json(HTTPStatus.OK, {"connected": True, **identity})
        except (
            FileNotFoundError,
            OSError,
            ValueError,
            HttpError,
            RefreshError,
            TransportError,
            TimeoutError,
        ) as error:
            self._send_json(HTTPStatus.BAD_REQUEST, {"error": f"Could not connect Gmail: {error}"})

    @staticmethod
    def _google_identity(credentials: Credentials) -> dict[str, str | None]:
        """Return the signed-in user's public Google profile fields."""
        profile = (
            build("oauth2", "v2", credentials=credentials, cache_discovery=False)
            .userinfo()
            .get()
            .execute()
        )
        picture = profile.get("picture")
        return {
            "email": profile.get("email"),
            "first_name": profile.get("given_name"),
            "last_name": profile.get("family_name"),
            # Do not expose Google's photo URL to the browser: it can throttle
            # repeated client-side image requests with HTTP 429.
            "picture": GmailRequestHandler._cache_profile_photo(picture),
        }

    @staticmethod
    def _cache_profile_photo(picture_url: Any) -> str | None:
        if not isinstance(picture_url, str) or not picture_url.startswith("https://"):
            return None
        try:
            if PROFILE_PHOTO_PATH.exists() and PROFILE_PHOTO_METADATA_PATH.exists():
                metadata = json.loads(PROFILE_PHOTO_METADATA_PATH.read_text(encoding="utf-8"))
                if metadata.get("source_url") == picture_url:
                    return "/api/gmail/profile-photo"

            request = UrlRequest(picture_url, headers={"User-Agent": "Gmail Analyzer/1.0"})
            with urlopen(request, timeout=10) as response:
                content_type = response.headers.get_content_type()
                image = response.read(2_000_001)
            if not content_type.startswith("image/") or len(image) > 2_000_000:
                return None
            PROFILE_PHOTO_PATH.parent.mkdir(parents=True, exist_ok=True)
            PROFILE_PHOTO_PATH.write_bytes(image)
            PROFILE_PHOTO_METADATA_PATH.write_text(
                json.dumps({"source_url": picture_url, "content_type": content_type}),
                encoding="utf-8",
            )
            return "/api/gmail/profile-photo"
        except (HTTPError, URLError, OSError, ValueError, json.JSONDecodeError):
            return None

    def _send_profile_photo(self) -> None:
        if not PROFILE_PHOTO_PATH.exists() or not PROFILE_PHOTO_METADATA_PATH.exists():
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        try:
            metadata = json.loads(PROFILE_PHOTO_METADATA_PATH.read_text(encoding="utf-8"))
            content_type = metadata.get("content_type")
            if not isinstance(content_type, str) or not content_type.startswith("image/"):
                raise ValueError("Invalid cached profile photo metadata.")
            image = PROFILE_PHOTO_PATH.read_bytes()
        except (OSError, ValueError, json.JSONDecodeError):
            self.send_error(HTTPStatus.NOT_FOUND)
            return
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", content_type)
        self.send_header("Content-Length", str(len(image)))
        self.send_header("Cache-Control", "private, max-age=3600")
        self.end_headers()
        self.wfile.write(image)

    def _logout_gmail(self) -> None:
        """Remove the local Gmail authorization and all locally cached mailbox data."""
        _, token_path = self._gmail_paths()
        gmail_data_paths = (
            token_path,
            PROJECT_ROOT / "emails.jsonl",
            PROFILE_PHOTO_PATH,
            PROFILE_PHOTO_METADATA_PATH,
        )
        removed: list[str] = []
        try:
            # Keep the empty database schema in place. Deleting the SQLite file
            # while this server is running leaves the existing cache object
            # connected to a new database with no tables.
            CACHE.clear()
            removed.append(CACHE.database_path.name)
            for path in gmail_data_paths:
                if path.exists():
                    path.unlink()
                    removed.append(path.name)
        except OSError as error:
            self._send_json(
                HTTPStatus.INTERNAL_SERVER_ERROR,
                {"error": f"Could not remove local Gmail data: {error}"},
            )
            return
        self._send_json(HTTPStatus.OK, {"logged_out": True, "removed": removed})

    def _analyze(self) -> None:
        """Analyze selected messages through the LLM manager and stream each result."""
        try:
            payload = self._read_json(max_bytes=5_000_000)
            emails = payload.get("emails")
            if not isinstance(emails, list) or not emails:
                raise ValueError("Select at least one email to analyze.")
            if len(emails) > 20:
                raise ValueError("Analyze no more than 20 emails at a time.")

            prepared: list[dict[str, str]] = []
            for email in emails:
                if not isinstance(email, dict):
                    raise ValueError("Each email must be an object.")
                for body_field in ("body_text", "body_html", "snippet", "body"):
                    value = email.get(body_field)
                    if value is not None and not isinstance(value, str):
                        raise ValueError(f"Email field '{body_field}' must be text.")
                try:
                    body, _ = select_email_body(
                        email.get("body_text"),
                        email.get("body_html"),
                        email.get("snippet"),
                    )
                except ValueError:
                    legacy_body = email.get("body")
                    if not isinstance(legacy_body, str) or not legacy_body.strip():
                        raise
                    body = legacy_body
                prepared.append({
                    "id": str(email.get("id", "")),
                    "subject": str(email.get("subject", "")),
                    "sender": str(email.get("sender", "")),
                    "recipient": str(email.get("recipient", "")),
                    "body": body,
                })

            manager = LLMManager.from_profile(load_llm_profile())
            self._start_ndjson_stream()
            for email in prepared:
                self._send_ndjson({"type": "start", "id": email["id"]})
                chunks: list[str] = []
                if manager.profile.provider.lower() == "local":
                    # Preserve the original local summary architecture exactly:
                    # main.py owns the prompt, /no_think control, token budget,
                    # and llama-cpp streaming loop. Forward every chunk instead
                    # of joining it before the browser receives it.
                    llm = manager.create_local_model()
                    response_chunks = stream_email_summary(
                        llm,
                        email["subject"],
                        email["sender"],
                        email["recipient"],
                        email["body"],
                    )
                else:
                    # OpenRouter and other OpenAI-compatible providers emit
                    # Server-Sent Events.  Forward each provider delta directly
                    # to the browser, just as the local llama-cpp path does.
                    response_chunks = manager.stream_chat(
                        email_to_message(
                            email["subject"],
                            email["sender"],
                            email["recipient"],
                            email["body"],
                        ),
                        system=SYSTEM_PROMPT,
                    )
                for chunk in response_chunks:
                    chunks.append(chunk)
                    self._send_ndjson({"type": "token", "id": email["id"], "content": chunk})
                content = "".join(chunks)
                self._send_ndjson({
                    "type": "analysis",
                    "analysis": {"id": email["id"], "markdown": content},
                })
            self._send_ndjson({"type": "complete"})
        except (FileNotFoundError, ValueError, json.JSONDecodeError) as error:
            if getattr(self, "_stream_started", False):
                self._send_ndjson({"type": "error", "error": str(error)})
            else:
                self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
        except Exception as error:
            message = f"AI analysis failed: {error}"
            if getattr(self, "_stream_started", False):
                self._send_ndjson({"type": "error", "error": message})
            else:
                self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": message})

    def _mark_read(self) -> None:
        try:
            payload = self._read_json()
            message_ids = payload.get("ids")
            if (
                not isinstance(message_ids, list)
                or not message_ids
                or len(message_ids) > 20
                or any(not isinstance(message_id, str) or not message_id for message_id in message_ids)
            ):
                raise ValueError("Provide between 1 and 20 Gmail message IDs.")

            unique_ids = list(dict.fromkeys(message_ids))
            CACHE.mark_read(unique_ids)
        except (ValueError, json.JSONDecodeError) as error:
            self._send_json(HTTPStatus.BAD_REQUEST, {"error": str(error)})
            return
        except Exception as error:
            self._send_json(
                HTTPStatus.INTERNAL_SERVER_ERROR,
                {"error": f"Could not update the local read status: {error}"},
            )
            return

        try:
            service = get_gmail_service(
                PROJECT_ROOT / "credentials.json",
                PROJECT_ROOT / ".secrets" / "gmail-token.json",
            )
            (
                service.users()
                .messages()
                .batchModify(
                    userId="me",
                    body={"ids": unique_ids, "removeLabelIds": ["UNREAD"]},
                )
                .execute()
            )
            self._send_json(HTTPStatus.OK, {"marked_read": unique_ids})
        except Exception as error:
            self._send_json(
                HTTPStatus.BAD_GATEWAY,
                {
                    "error": (
                        "The email was marked read in the local database, but Gmail "
                        f"could not be updated: {error}"
                    )
                },
            )

    @staticmethod
    def _run_fetch(
        job: FetchJob,
        start: Any,
        end: Any,
        include_spam_trash: bool,
        force_refresh: bool,
    ) -> None:
        def update_progress(completed: int, total: int, phase: str) -> None:
            with job.lock:
                job.completed = completed
                job.total = total
                job.phase = phase

        try:
            result = fetch_with_cache(
                CACHE,
                start,
                end,
                PROJECT_ROOT / "credentials.json",
                PROJECT_ROOT / ".secrets" / "gmail-token.json",
                include_spam_trash,
                force_refresh,
                update_progress,
            )
            GmailRequestHandler._write_export(result.messages)
            with job.lock:
                job.status = "completed"
                job.messages = result.messages
                job.cached_count = result.cached_count
                job.fetched_count = result.fetched_count
                job.completed = len(result.messages)
                job.total = len(result.messages)
                job.phase = "Complete"
        except Exception as error:
            with job.lock:
                job.status = "failed"
                job.error = str(error)
                job.phase = "Fetch failed"

    def _read_json(self, max_bytes: int = 100_000) -> dict[str, Any]:
        content_length = int(self.headers.get("Content-Length", "0"))
        if content_length <= 0 or content_length > max_bytes:
            raise ValueError(
                f"Request body must be a JSON object smaller than {max_bytes // 1_000_000 or max_bytes // 1_000} "
                f"{'MB' if max_bytes >= 1_000_000 else 'KB'}."
            )
        payload = json.loads(self.rfile.read(content_length))
        if not isinstance(payload, dict):
            raise ValueError("Request body must be a JSON object.")
        return payload

    @staticmethod
    def _required_string(payload: dict[str, Any], key: str) -> str:
        value = payload.get(key)
        if not isinstance(value, str) or not value:
            raise ValueError(f"'{key}' is required.")
        return value

    @staticmethod
    def _write_export(messages: list[dict[str, Any]]) -> None:
        with (PROJECT_ROOT / "emails.jsonl").open("w", encoding="utf-8") as output_file:
            for message in messages:
                output_file.write(json.dumps(message, ensure_ascii=False) + "\n")

    def _send_json(self, status: HTTPStatus, payload: dict[str, Any]) -> None:
        response = json.dumps(payload, ensure_ascii=False).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(response)))
        self.end_headers()
        self.wfile.write(response)

    def _start_ndjson_stream(self) -> None:
        self._stream_started = True
        self.send_response(HTTPStatus.OK)
        self.send_header("Content-Type", "application/x-ndjson; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("Connection", "close")
        self.end_headers()

    def _send_ndjson(self, payload: dict[str, Any]) -> None:
        self.wfile.write((json.dumps(payload, ensure_ascii=False) + "\n").encode("utf-8"))
        self.wfile.flush()

    def log_message(self, format: str, *args: object) -> None:
        return


def main() -> None:
    server = ThreadingHTTPServer(("127.0.0.1", API_PORT), GmailRequestHandler)
    print(f"Gmail API available at http://127.0.0.1:{API_PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
