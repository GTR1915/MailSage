"""Stream a raw model response for one email in the exported JSONL file.

Examples:
    python Model_Management/model_prompt_check.py 1
    python Model_Management/model_prompt_check.py 3 --system-prompt "Classify this email."
    python Model_Management/model_prompt_check.py 3 --system-prompt-file prompts/classifier.txt
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path
from typing import Any, Iterator

from llama_cpp import Llama

try:
    from .main import (
        SUMMARY_RESPONSE_FORMAT,
        SYSTEM_PROMPT,
        create_model,
        email_to_message,
        select_email_body,
    )
    from .model_config import PROJECT_ROOT
except ImportError:  # Allows both `python model_prompt_check.py` and package imports.
    from main import (
        SUMMARY_RESPONSE_FORMAT,
        SYSTEM_PROMPT,
        create_model,
        email_to_message,
        select_email_body,
    )
    from model_config import PROJECT_ROOT


def _email_body(email: dict[str, Any]) -> tuple[str, str]:
    return select_email_body(
        email.get("body_text"), email.get("body_html"), email.get("snippet")
    )


def _website_sender(email: dict[str, Any]) -> str:
    """Match the sender value the website sends to /api/analyze."""
    sender = email.get("from")
    if not isinstance(sender, str) or not sender:
        return ""
    address = re.search(r"<([^>]+)>", sender)
    return address.group(1) if address else sender


def load_email(path: Path, line_number: int) -> dict[str, Any]:
    """Load a one-based line from JSONL and require it to contain an email object."""
    if line_number < 1:
        raise ValueError("Line number must be 1 or greater.")

    with path.open(encoding="utf-8") as input_file:
        for current_line, raw_line in enumerate(input_file, start=1):
            if current_line == line_number:
                try:
                    record = json.loads(raw_line)
                except json.JSONDecodeError as error:
                    raise ValueError(
                        f"Line {line_number} in {path} is not valid JSON: {error.msg}"
                    ) from error
                if not isinstance(record, dict):
                    raise ValueError(f"Line {line_number} in {path} is not a JSON object.")
                return record

    raise ValueError(f"Line {line_number} does not exist in {path}.")


def _system_prompt(args: argparse.Namespace) -> str:
    if args.system_prompt_file:
        prompt = args.system_prompt_file.read_text(encoding="utf-8")
    else:
        prompt = args.system_prompt
    if not prompt.strip():
        raise ValueError("The system prompt cannot be empty.")
    return prompt


def stream_raw_response(
    llm: Llama, system_prompt: str, user_message: str
) -> Iterator[str]:
    """Yield generated text using the website's JSON-mode streaming settings."""
    response = llm.create_chat_completion(
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        temperature=0.1,
        max_tokens=350,
        response_format=SUMMARY_RESPONSE_FORMAT,
        stream=True,
    )
    for chunk in response:
        choices = chunk.get("choices", [])
        if choices:
            content = choices[0].get("delta", {}).get("content")
            if content:
                yield content


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Stream the raw local-model response for one emails.jsonl line."
    )
    parser.add_argument(
        "line_number",
        type=int,
        help="One-based line number in the JSONL file",
    )
    parser.add_argument(
        "--input",
        type=Path,
        default=PROJECT_ROOT / "emails.jsonl",
        help="JSONL input file (default: emails.jsonl in the project root)",
    )
    prompts = parser.add_mutually_exclusive_group()
    prompts.add_argument(
        "--system-prompt",
        default=SYSTEM_PROMPT,
        help="Use this system prompt instead of the one from main.py",
    )
    prompts.add_argument(
        "--system-prompt-file",
        type=Path,
        help="Read the system prompt from a UTF-8 text file",
    )
    return parser


def main() -> int:
    args = build_parser().parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    try:
        email = load_email(args.input, args.line_number)
        prompt = _system_prompt(args)
        subject_value = email.get("subject")
        subject = (
            subject_value
            if isinstance(subject_value, str) and subject_value
            else "(No subject)"
        )
        sender = _website_sender(email)
        body, body_source = _email_body(email)
        user_message = email_to_message(
            subject,
            sender,
            "",
            body,
        )
        print(
            f"Email line {args.line_number}"
            f" | Subject: {subject}"
            f" | Body source: {body_source} ({len(body)} characters)"
        )
        print("\nSystem prompt:")
        print(prompt)
        print("\nUser input:")
        print(user_message)
        print("Raw model output:")
        sys.stdout.flush()
        for text in stream_raw_response(create_model(), prompt, user_message):
            print(text, end="", flush=True)
        print()
        return 0
    except (OSError, ValueError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())