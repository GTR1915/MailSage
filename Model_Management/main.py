"""Summarize exactly one email with the local Qwen model.

Example:
    python Model_Management/main.py --subject "Project meeting" --body "The meeting is Monday at 10 AM."
"""

from __future__ import annotations

import argparse
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
        response_format={"type": "json_object"},
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
