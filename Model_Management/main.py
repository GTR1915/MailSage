"""Summarize exactly one email with the local Qwen model.

Example:
    python Model_Management/main.py --subject "Project meeting" --body "The meeting is Monday at 10 AM."
"""

from __future__ import annotations

import argparse
from html.parser import HTMLParser
import json
import sys
from pathlib import Path
from typing import Any, Iterator

from llama_cpp import Llama

try:
    from .model_config import MODEL_PATH
except ImportError:  # Allows both `python main.py` and package imports by the API.
    from model_config import MODEL_PATH


SYSTEM_PROMPT = """You summarize one email at a time. Return only a JSON object.
Do not include markdown, commentary, or reasoning. Do not invent facts.
Use this exact structure:
{
  "summary": "one or two concise sentences",
  "important": ["important fact"],
  "actions": ["action for the recipient"],
  "deadlines": ["explicit date, time, or deadline"]
}
Use empty arrays where no facts apply."""

SUMMARY_RESPONSE_FORMAT = {
    "type": "json_object",
    "schema": {
        "type": "object",
        "properties": {
            "summary": {"type": "string"},
            "important": {"type": "array", "items": {"type": "string"}},
            "actions": {"type": "array", "items": {"type": "string"}},
            "deadlines": {"type": "array", "items": {"type": "string"}},
        },
        "required": ["summary", "important", "actions", "deadlines"],
        "additionalProperties": False,
    },
}


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
    return Llama(model_path=str(MODEL_PATH), n_ctx=4096, n_gpu_layers=-1, verbose=False)


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
) -> dict[str, Any]:
    """Return the final structured summary after consuming the token stream."""
    content = "".join(stream_email_summary(llm, subject, sender, recipient, body))
    if not content:
        raise ValueError("The model returned an empty response.")
    summary = json.loads(content)
    if not isinstance(summary, dict):
        raise ValueError("The model response was not a JSON object.")
    return summary


def stream_email_summary(
    llm: Llama, subject: str, sender: str, recipient: str, body: str
) -> Iterator[str]:
    """Yield local-model text as it is generated without changing the prompt."""
    response = llm.create_chat_completion(
        messages=[
            {"role": "system", "content": SYSTEM_PROMPT},
            {
                "role": "user",
                "content": email_to_message(subject, sender, recipient, body),
            },
        ],
        temperature=0.1,
        max_tokens=350,
        response_format=SUMMARY_RESPONSE_FORMAT,
        stream=True,
    )
    for chunk in response:
        choices = chunk.get("choices", [])
        if not choices:
            continue
        content = choices[0].get("delta", {}).get("content")
        if content:
            yield content


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
        print(json.dumps(summary, indent=2, ensure_ascii=False))
        return 0
    except (FileNotFoundError, ValueError, json.JSONDecodeError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
