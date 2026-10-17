"""Fetch Gmail messages whose received time falls inside an exact interval."""

from __future__ import annotations

import argparse
import base64
import json
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Callable, Iterator

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import Resource, build


SCOPES = ["https://www.googleapis.com/auth/gmail.modify"]


def parse_datetime(value: str) -> datetime:
    """Parse an ISO-8601 time and normalize it to UTC."""
    normalized_value = value.replace("Z", "+00:00")
    parsed_value = datetime.fromisoformat(normalized_value)
    if parsed_value.tzinfo is None:
        raise argparse.ArgumentTypeError(
            "Datetime must include a timezone, for example 2026-10-01T09:00:00+05:30"
        )
    return parsed_value.astimezone(timezone.utc)


def get_gmail_service(credentials_path: Path, token_path: Path) -> Resource:
    credentials: Credentials | None = None
    if token_path.exists():
        credentials = Credentials.from_authorized_user_file(str(token_path), SCOPES)

    if credentials and not credentials.has_scopes(SCOPES):
        credentials = None

    if credentials and credentials.expired and credentials.refresh_token:
        credentials.refresh(Request())
    elif not credentials or not credentials.valid:
        if not credentials_path.exists():
            raise FileNotFoundError(
                f"OAuth client configuration was not found: {credentials_path}. "
                "Download it from Google Cloud and pass it with --credentials."
            )
        flow = InstalledAppFlow.from_client_secrets_file(str(credentials_path), SCOPES)
        credentials = flow.run_local_server(port=0, prompt="consent")

    token_path.parent.mkdir(parents=True, exist_ok=True)
    token_path.write_text(credentials.to_json(), encoding="utf-8")
    return build("gmail", "v1", credentials=credentials, cache_discovery=False)


def iter_message_ids(
    service: Resource,
    query: str,
    include_spam_trash: bool,
    on_total: Callable[[int], None] | None = None,
) -> Iterator[str]:
    page_token: str | None = None
    yielded = 0
    total = 0
    while True:
        response = (
            service.users()
            .messages()
            .list(
                userId="me",
                q=query,
                includeSpamTrash=include_spam_trash,
                maxResults=500,
                pageToken=page_token,
            )
            .execute()
        )
        total = max(total, int(response.get("resultSizeEstimate", 0)))
        if on_total:
            on_total(total)
        for message in response.get("messages", []):
            yielded += 1
            yield message["id"]
        page_token = response.get("nextPageToken")
        if not page_token:
            return


def decode_body(payload: dict[str, Any]) -> str | None:
    body = payload.get("body", {})
    encoded_data = body.get("data")
    if encoded_data:
        return base64.urlsafe_b64decode(encoded_data + "===").decode("utf-8", "replace")

    return None


def extract_bodies(payload: dict[str, Any]) -> tuple[str | None, str | None]:
    """Return the preferred plain-text and HTML alternatives from a MIME tree."""
    plain_text: str | None = None
    html: str | None = None
    mime_type = payload.get("mimeType")
    decoded_body = decode_body(payload)
    if mime_type == "text/plain":
        plain_text = decoded_body
    elif mime_type == "text/html":
        html = decoded_body

    for part in payload.get("parts", []):
        part_plain_text, part_html = extract_bodies(part)
        plain_text = plain_text or part_plain_text
        html = html or part_html
    return plain_text, html


def normalize_message(message: dict[str, Any], include_body: bool) -> dict[str, Any]:
    payload = message.get("payload", {})
    headers = {
        header["name"].lower(): header["value"]
        for header in payload.get("headers", [])
        if "name" in header and "value" in header
    }
    received_at = datetime.fromtimestamp(
        int(message["internalDate"]) / 1000, tz=timezone.utc
    )
    result = {
        "id": message["id"],
        "thread_id": message.get("threadId"),
        "received_at": received_at.isoformat(),
        "from": headers.get("from"),
        "to": headers.get("to"),
        "subject": headers.get("subject"),
        "snippet": message.get("snippet"),
        "label_ids": message.get("labelIds", []),
    }
    if include_body:
        body_text, body_html = extract_bodies(payload)
        result["body_text"] = body_text
        result["body_html"] = body_html
    return result


def fetch_messages(
    service: Resource,
    start: datetime,
    end: datetime,
    include_spam_trash: bool,
    include_body: bool,
    progress: Callable[[int, int], None] | None = None,
) -> Iterator[dict[str, Any]]:
    if end <= start:
        raise ValueError("--end must be later than --start")

    # Unix-second queries avoid Gmail's date-only timezone semantics. The local check
    # keeps the interval exact: [start, end), even if Gmail search returns a boundary item.
    query = f"after:{int(start.timestamp())} before:{int(end.timestamp())}"
    total = 0
    completed = 0

    def update_total(value: int) -> None:
        nonlocal total
        total = max(total, value)

    for message_id in iter_message_ids(service, query, include_spam_trash, update_total):
        message = (
            service.users()
            .messages()
            .get(userId="me", id=message_id, format="full")
            .execute()
        )
        completed += 1
        if progress:
            progress(completed, total)
        received_at = datetime.fromtimestamp(
            int(message["internalDate"]) / 1000, tz=timezone.utc
        )
        if start <= received_at < end:
            yield normalize_message(message, include_body)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--start", required=True, type=parse_datetime, help="Inclusive ISO-8601 start time")
    parser.add_argument("--end", required=True, type=parse_datetime, help="Exclusive ISO-8601 end time")
    parser.add_argument("--output", type=Path, default=Path("emails.jsonl"), help="JSONL destination")
    parser.add_argument("--credentials", type=Path, default=Path("credentials.json"), help="OAuth client JSON")
    parser.add_argument("--token", type=Path, default=Path(".secrets/gmail-token.json"), help="OAuth token cache")
    parser.add_argument("--include-body", action="store_true", help="Include decoded text/plain email bodies")
    parser.add_argument("--include-spam-trash", action="store_true", help="Search Spam and Trash too")
    return parser


def main() -> int:
    args = build_parser().parse_args()
    try:
        service = get_gmail_service(args.credentials, args.token)
        count = 0
        with args.output.open("w", encoding="utf-8") as output_file:
            for email in fetch_messages(
                service, args.start, args.end, args.include_spam_trash, args.include_body
            ):
                output_file.write(json.dumps(email, ensure_ascii=False) + "\n")
                count += 1
        print(f"Fetched {count} messages to {args.output}")
        return 0
    except (FileNotFoundError, ValueError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())


# py .\gmail_fetch.py --start "2026-10-04T00:00:00+05:30" --end "2026-10-06T00:00:00+05:30" --output .\test-emails.jsonl