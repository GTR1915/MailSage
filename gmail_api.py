"""Local HTTP API for cached Gmail fetching and progress reporting."""

from __future__ import annotations

import json
import threading
import uuid
from dataclasses import dataclass, field
from http import HTTPStatus
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
from typing import Any

from gmail_cache import GmailCache, fetch_with_cache
from gmail_fetch import parse_datetime
from Model_Management.main import (
    create_model,
    select_email_body,
    stream_email_summary,
)


PROJECT_ROOT = Path(__file__).resolve().parent
CACHE = GmailCache(PROJECT_ROOT / ".data" / "gmail-cache.sqlite3")


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
MODEL_LOCK = threading.RLock()
MODEL: Any | None = None


def get_model() -> Any:
    """Create the local model once and reuse it for all analysis requests."""
    global MODEL
    with MODEL_LOCK:
        if MODEL is None:
            MODEL = create_model()
        return MODEL


class GmailRequestHandler(BaseHTTPRequestHandler):
    def do_GET(self) -> None:
        if self.path == "/api/health":
            self._send_json(HTTPStatus.OK, {"status": "ok"})
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
        if self.path == "/api/analyze":
            self._analyze()
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

    def _analyze(self) -> None:
        """Stream local model tokens so the browser can reveal summaries early."""
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

            self._start_ndjson_stream()
            # llama.cpp model instances are not safe to use concurrently.
            with MODEL_LOCK:
                model = get_model()
                for email in prepared:
                    self._send_ndjson({"type": "start", "id": email["id"]})
                    content = ""
                    for token in stream_email_summary(
                        model, email["subject"], email["sender"], email["recipient"], email["body"]
                    ):
                        content += token
                        self._send_ndjson({"type": "token", "id": email["id"], "content": token})
                    if not content.strip():
                        raise ValueError("The model returned an empty response.")
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
            message = f"Local AI analysis failed: {error}"
            if getattr(self, "_stream_started", False):
                self._send_ndjson({"type": "error", "error": message})
            else:
                self._send_json(HTTPStatus.INTERNAL_SERVER_ERROR, {"error": message})

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
    server = ThreadingHTTPServer(("127.0.0.1", 8000), GmailRequestHandler)
    print("Gmail API available at http://127.0.0.1:8000")
    server.serve_forever()


if __name__ == "__main__":
    main()
