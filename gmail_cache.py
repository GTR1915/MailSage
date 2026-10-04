"""SQLite-backed interval cache for fetched Gmail messages."""

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Any, Callable, Iterator

from gmail_fetch import fetch_messages, get_gmail_service


@dataclass(frozen=True)
class FetchResult:
    messages: list[dict[str, Any]]
    cached_count: int
    fetched_count: int


ProgressCallback = Callable[[int, int, str], None]


class GmailCache:
    def __init__(self, database_path: Path) -> None:
        self.database_path = database_path
        self.database_path.parent.mkdir(parents=True, exist_ok=True)
        with self._connect() as connection:
            connection.executescript(
                """
                CREATE TABLE IF NOT EXISTS messages (
                    id TEXT PRIMARY KEY,
                    received_at TEXT NOT NULL,
                    payload TEXT NOT NULL,
                    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                );
                CREATE INDEX IF NOT EXISTS messages_received_at ON messages(received_at);
                CREATE TABLE IF NOT EXISTS coverage (
                    start_at TEXT NOT NULL,
                    end_at TEXT NOT NULL,
                    PRIMARY KEY (start_at, end_at)
                );
                """
            )

    def get_missing_intervals(
        self, start: datetime, end: datetime
    ) -> list[tuple[datetime, datetime]]:
        start_value, end_value = _timestamp(start), _timestamp(end)
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT start_at, end_at FROM coverage
                WHERE end_at > ? AND start_at < ?
                ORDER BY start_at
                """,
                (start_value, end_value),
            ).fetchall()

        missing: list[tuple[datetime, datetime]] = []
        cursor = start
        for row_start, row_end in rows:
            covered_start = max(_parse_timestamp(row_start), start)
            covered_end = min(_parse_timestamp(row_end), end)
            if covered_start > cursor:
                missing.append((cursor, covered_start))
            cursor = max(cursor, covered_end)
        if cursor < end:
            missing.append((cursor, end))
        return missing

    def read_messages(self, start: datetime, end: datetime) -> list[dict[str, Any]]:
        with self._connect() as connection:
            rows = connection.execute(
                """
                SELECT payload FROM messages
                WHERE received_at >= ? AND received_at < ?
                ORDER BY received_at DESC
                """,
                (_timestamp(start), _timestamp(end)),
            ).fetchall()
        return [json.loads(row[0]) for row in rows]

    def mark_read(self, message_ids: list[str]) -> None:
        if not message_ids:
            return

        placeholders = ",".join("?" for _ in message_ids)
        with self._connect() as connection:
            rows = connection.execute(
                f"SELECT id, payload FROM messages WHERE id IN ({placeholders})",
                message_ids,
            ).fetchall()
            for message_id, payload in rows:
                message = json.loads(payload)
                labels = message.get("label_ids", [])
                message["label_ids"] = [
                    label for label in labels if label != "UNREAD"
                ]
                connection.execute(
                    """
                    UPDATE messages
                    SET payload = ?, updated_at = CURRENT_TIMESTAMP
                    WHERE id = ?
                    """,
                    (json.dumps(message, ensure_ascii=False), message_id),
                )

    def store_interval(
        self, start: datetime, end: datetime, messages: list[dict[str, Any]]
    ) -> None:
        start_value, end_value = _timestamp(start), _timestamp(end)
        with self._connect() as connection:
            connection.executemany(
                """
                INSERT INTO messages (id, received_at, payload)
                VALUES (?, ?, ?)
                ON CONFLICT(id) DO UPDATE SET
                    received_at = excluded.received_at,
                    payload = excluded.payload,
                    updated_at = CURRENT_TIMESTAMP
                """,
                [
                    (message["id"], message["received_at"], json.dumps(message))
                    for message in messages
                ],
            )
            overlapping = connection.execute(
                """
                SELECT start_at, end_at FROM coverage
                WHERE end_at >= ? AND start_at <= ?
                """,
                (start_value, end_value),
            ).fetchall()
            merged_start = min([start_value, *(row[0] for row in overlapping)])
            merged_end = max([end_value, *(row[1] for row in overlapping)])
            connection.execute(
                "DELETE FROM coverage WHERE end_at >= ? AND start_at <= ?",
                (start_value, end_value),
            )
            connection.execute(
                "INSERT INTO coverage (start_at, end_at) VALUES (?, ?)",
                (merged_start, merged_end),
            )

    @contextmanager
    def _connect(self) -> Iterator[sqlite3.Connection]:
        connection = sqlite3.connect(self.database_path)
        connection.execute("PRAGMA journal_mode = WAL")
        try:
            yield connection
            connection.commit()
        except Exception:
            connection.rollback()
            raise
        finally:
            connection.close()


def fetch_with_cache(
    cache: GmailCache,
    start: datetime,
    end: datetime,
    credentials_path: Path,
    token_path: Path,
    include_spam_trash: bool,
    force_refresh: bool,
    progress: ProgressCallback | None = None,
) -> FetchResult:
    intervals = [(start, end)] if force_refresh else cache.get_missing_intervals(start, end)
    if not intervals:
        messages = cache.read_messages(start, end)
        if progress:
            progress(len(messages), len(messages), "Loaded from local cache")
        return FetchResult(messages, len(messages), 0)

    service = get_gmail_service(credentials_path, token_path)
    fetched_count = 0
    for interval_start, interval_end in intervals:
        interval_messages = list(
            fetch_messages(
                service,
                interval_start,
                interval_end,
                include_spam_trash,
                include_body=True,
                progress=lambda completed, total: progress(
                    fetched_count + completed,
                    fetched_count + total,
                    "Fetching from Gmail",
                )
                if progress
                else None,
            )
        )
        cache.store_interval(interval_start, interval_end, interval_messages)
        fetched_count += len(interval_messages)

    messages = cache.read_messages(start, end)
    if progress:
        progress(fetched_count, max(fetched_count, 1), "Preparing local inbox")
    return FetchResult(messages, len(messages) - fetched_count, fetched_count)


def _timestamp(value: datetime) -> str:
    return value.isoformat()


def _parse_timestamp(value: str) -> datetime:
    return datetime.fromisoformat(value)
