"""Mark one or more Gmail messages as read on the Gmail server.

Examples:
    py mark_gmail_read.py 18f123abc456def0
    py mark_gmail_read.py --id 18f123abc456def0 --id 18f987abc654def0

The message ID is Gmail's API message ID (the ``id`` field in emails.jsonl),
not an email subject, sender, RFC Message-ID header, or thread ID.
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import InstalledAppFlow
from googleapiclient.discovery import Resource, build


SCOPES = ["https://www.googleapis.com/auth/gmail.modify"]
SCRIPT_DIR = Path(__file__).resolve().parent


def get_gmail_service(credentials_path: Path, token_path: Path) -> Resource:
    """Authenticate and return a Gmail client with permission to modify labels."""
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
                f"OAuth client configuration was not found: {credentials_path}"
            )
        flow = InstalledAppFlow.from_client_secrets_file(str(credentials_path), SCOPES)
        credentials = flow.run_local_server(port=0, prompt="consent")

    token_path.parent.mkdir(parents=True, exist_ok=True)
    token_path.write_text(credentials.to_json(), encoding="utf-8")
    return build("gmail", "v1", credentials=credentials, cache_discovery=False)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "message_ids",
        metavar="MESSAGE_ID",
        nargs="*",
        help="Gmail API message ID to mark read",
    )
    parser.add_argument(
        "--id",
        dest="option_ids",
        action="append",
        default=[],
        metavar="MESSAGE_ID",
        help="Gmail API message ID to mark read; may be supplied more than once",
    )
    parser.add_argument(
        "--credentials",
        type=Path,
        default=SCRIPT_DIR / "credentials.json",
        help="OAuth client JSON (default: credentials.json)",
    )
    parser.add_argument(
        "--token",
        type=Path,
        default=SCRIPT_DIR / ".secrets" / "gmail-token.json",
        help="OAuth token cache (default: .secrets/gmail-token.json)",
    )
    return parser


def main() -> int:
    args = build_parser().parse_args()
    message_ids = list(dict.fromkeys(args.message_ids + args.option_ids))
    if not message_ids:
        print("Error: provide at least one Gmail API message ID.", file=sys.stderr)
        return 2
    if any(not message_id.strip() for message_id in message_ids):
        print("Error: message IDs cannot be empty.", file=sys.stderr)
        return 2

    try:
        service = get_gmail_service(args.credentials, args.token)
        (
            service.users()
            .messages()
            .batchModify(
                userId="me",
                body={"ids": message_ids, "removeLabelIds": ["UNREAD"]},
            )
            .execute()
        )
    except Exception as error:
        print(f"Error: Gmail could not mark the message(s) as read: {error}", file=sys.stderr)
        return 1

    noun = "message" if len(message_ids) == 1 else "messages"
    print(f"Marked {len(message_ids)} {noun} as read on Gmail.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
