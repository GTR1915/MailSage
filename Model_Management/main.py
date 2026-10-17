"""Summarize exactly one email with the local Qwen model.

Example:
    python Model_Management/main.py --subject "Project meeting" --body "The meeting is Monday at 10 AM."
"""

from __future__ import annotations

import argparse
from html.parser import HTMLParser
import sys
from pathlib import Path
from typing import Any, Iterator

from llama_cpp import Llama

try:
    from .SYSTEM_PROMPT import *
except ImportError:  # Allows direct script execution outside package imports.
    from SYSTEM_PROMPT import *


try:
    from .model_config import MODEL_PATH
except ImportError:  # Allows both `python main.py` and package imports by the API.
    from model_config import MODEL_PATH




SYSTEM_PROMPT = SYSTEM_PROMPT3

MODEL_CONTEXT_TOKENS = 1024*16
MIN_OUTPUT_TOKENS = 512
MAX_OUTPUT_TOKENS = 1024*3
CHAT_TEMPLATE_TOKEN_RESERVE = 128

class _ReadableEmailHTML(HTMLParser):
    _BLOCK_TAGS = {
        "address", "article", "aside", "blockquote", "br", "dd", "div", "dl",
        "dt", "fieldset", "figcaption", "figure", "footer", "form", "h1", "h2",
        "h3", "h4", "h5", "h6", "header", "hr", "li", "main", "nav", "ol",
        "p", "section", "table", "tr", "ul",
    }
    _HIDDEN_TAGS = {"head", "script", "style", "noscript"}

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._hidden_depth = 0

    def handle_starttag(
        self, tag: str, _attrs: list[tuple[str, str | None]]
    ) -> None:
        del _attrs
        if tag in self._HIDDEN_TAGS:
            self._hidden_depth += 1
        elif not self._hidden_depth and tag in self._BLOCK_TAGS:
            self.parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag in self._HIDDEN_TAGS and self._hidden_depth:
            self._hidden_depth -= 1
        elif not self._hidden_depth and tag in self._BLOCK_TAGS:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if not self._hidden_depth:
            self.parts.append(data)


def select_email_body(
    body_text: Any, body_html: Any, snippet: Any
) -> tuple[str, str]:
    """Choose the full email body, converting HTML to readable text as needed."""
    if isinstance(body_text, str) and body_text.strip():
        return body_text, "body_text"

    if isinstance(body_html, str) and body_html.strip():
        parser = _ReadableEmailHTML()
        parser.feed(body_html)
        parser.close()
        readable_text = "\n".join(
            line.strip()
            for line in "".join(parser.parts).splitlines()
            if line.strip()
        )
        if readable_text:
            return readable_text, "body_html (HTML converted to text)"

    if isinstance(snippet, str) and snippet.strip():
        return snippet, "snippet (full body unavailable)"

    raise ValueError("The selected email has no body_text, readable body_html, or snippet.")


def create_model() -> Llama:
    if not MODEL_PATH.exists():
        raise FileNotFoundError(
            f"Model was not found at {MODEL_PATH}. "
            "Run: python Model_Management/download_model.py"
        )
    return Llama(
        model_path=str(MODEL_PATH),
        n_ctx=MODEL_CONTEXT_TOKENS,
        n_gpu_layers=-1,
        verbose=False,
    )


def output_token_budget(
    llm: Llama, system_prompt: str, user_message: str
) -> tuple[int, int]:
    """Choose a response budget from prompt size without truncating input."""
    prompt_tokens = (
        len(llm.tokenize(system_prompt.encode("utf-8"), add_bos=False))
        + len(llm.tokenize(user_message.encode("utf-8"), add_bos=False))
        + CHAT_TEMPLATE_TOKEN_RESERVE
    )
    available_tokens = llm.n_ctx() - prompt_tokens
    if available_tokens < MIN_OUTPUT_TOKENS:
        raise ValueError(
            f"The full email and prompt need about {prompt_tokens} tokens, leaving "
            f"only {available_tokens} tokens for the response in the "
            f"{llm.n_ctx()}-token context. Increase MODEL_CONTEXT_TOKENS to "
            "analyze this email without truncating it."
        )

    size_based_budget = max(MIN_OUTPUT_TOKENS, prompt_tokens // 2)
    return min(size_based_budget, MAX_OUTPUT_TOKENS, available_tokens), prompt_tokens


def email_to_message(subject: str, sender: str, recipient: str, body: str) -> str:
    return "\n".join(
        [
            "Summarize the email data below.",
            f"From: {sender or 'Unknown'}",
            f"To: {recipient or 'Unknown'}",
            f"Subject: {subject or '(no subject)'}",
            "Body:",
            body,
        ]
    )


def summarize_email(
    llm: Llama, subject: str, sender: str, recipient: str, body: str
) -> str:
    """Return the Markdown summary after consuming the token stream."""
    content = "".join(stream_email_summary(llm, subject, sender, recipient, body))
    if not content.strip():
        raise ValueError("The model returned an empty response.")
    return content


def stream_email_summary(
    llm: Llama, subject: str, sender: str, recipient: str, body: str
) -> Iterator[str]:
    """Yield a summary for one email using the shared local-model routine."""
    user_message = email_to_message(subject, sender, recipient, body)
    yield from stream_local_summary(llm, SYSTEM_PROMPT, user_message)


def stream_local_summary(
    llm: Llama, system_prompt: str, user_message: str
) -> Iterator[str]:
    """Generate a direct local-model answer with Qwen thinking disabled.

    This is intentionally the one local generation path shared by the command
    line summarizer and the website's LLM manager.
    """
    max_tokens, _ = output_token_budget(llm, system_prompt, user_message)
    response = llm.create_chat_completion(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message + "\n/no_think"},
        ],
        temperature=0.1,
        max_tokens=max_tokens,
        # response_format=SUMMARY_RESPONSE_FORMAT,   # Not needed if SYSTEM_PROMPT is Markdown-based
        stream=True,
    )
    finish_reason: str | None = None
    for chunk in response:
        choices = chunk.get("choices", [])
        if not choices:
            continue
        choice = choices[0]
        content = choice.get("delta", {}).get("content")
        if content:
            yield content
        if choice.get("finish_reason"):
            finish_reason = choice["finish_reason"]
    if finish_reason == "length":
        raise ValueError(
            "The model reached its output-token limit before completing the summary."
        )


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Summarize one email locally.")
    parser.add_argument("--body", required=True, help="Body of the email to analyze")
    parser.add_argument("--subject", default="", help="Email subject")
    parser.add_argument("--from", dest="sender", default="", help="Email sender")
    parser.add_argument("--to", dest="recipient", default="", help="Email recipient")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    if not args.body.strip():
        print("Error: --body cannot be empty.", file=sys.stderr)
        return 2

    try:
        summary = summarize_email(
            create_model(), args.subject, args.sender, args.recipient, args.body
        )
        print(summary)
        return 0
    except (FileNotFoundError, ValueError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
