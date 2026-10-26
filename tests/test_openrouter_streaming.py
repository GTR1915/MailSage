"""Regression tests for OpenRouter's streamed email-summary path."""

from __future__ import annotations

import json
import threading
import time
import unittest
from http.client import HTTPConnection
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from unittest.mock import patch

import gmail_api
from llm_manager import LLMManager


class _SseResponse:
    def __init__(self, lines: list[bytes]) -> None:
        self._lines = lines

    def __enter__(self) -> "_SseResponse":
        return self

    def __exit__(self, *_: object) -> None:
        return None

    def __iter__(self):
        return iter(self._lines)


class LLMManagerStreamingTests(unittest.TestCase):
    def test_openrouter_stream_yields_only_text_deltas(self) -> None:
        response = _SseResponse(
            [
                b'data: {"choices":[{"delta":{"role":"assistant"}}]}\n',
                b'\n',
                b'data: {"choices":[{"delta":{"content":"Hello"}}]}\n',
                b'data: {"choices":[],"usage":{"total_tokens":7}}\n',
                b'data: {"choices":[{"delta":{"content":" world"}}]}\n',
                b'data: [DONE]\n',
            ]
        )
        manager = LLMManager.from_profile(
            {
                "provider": "openrouter",
                "model": "deepseek/deepseek-v4-flash-0731",
                "api_key": "test-key",
            }
        )

        with patch("llm_manager.urlopen", return_value=response) as mocked_urlopen:
            chunks = list(manager.stream_chat("Summarize this email.", system="Be concise."))

        self.assertEqual(chunks, ["Hello", " world"])
        request = mocked_urlopen.call_args.args[0]
        payload = json.loads(request.data.decode("utf-8"))
        self.assertEqual(request.full_url, "https://openrouter.ai/api/v1/chat/completions")
        self.assertTrue(payload["stream"])
        self.assertEqual(payload["model"], "deepseek/deepseek-v4-flash-0731")
        self.assertEqual(payload["messages"][0]["role"], "system")
        self.assertEqual(payload["messages"][1]["content"], "Summarize this email.")


class _FakeOpenRouterHandler(BaseHTTPRequestHandler):
    def do_POST(self) -> None:
        payload = json.loads(self.rfile.read(int(self.headers["Content-Length"])))
        if not payload.get("stream"):
            self.send_error(400, "The request was not streamed")
            return
        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream")
        self.end_headers()
        self.wfile.write(b'data: {"choices":[{"delta":{"content":"First"}}]}\n\n')
        self.wfile.flush()
        time.sleep(0.15)
        self.wfile.write(b'data: {"choices":[{"delta":{"content":" second"}}]}\n\n')
        self.wfile.write(b'data: [DONE]\n\n')
        self.wfile.flush()

    def log_message(self, _format: str, *_args: object) -> None:
        return


class GmailApiStreamingTests(unittest.TestCase):
    def setUp(self) -> None:
        self.provider = ThreadingHTTPServer(("127.0.0.1", 0), _FakeOpenRouterHandler)
        self.provider_thread = threading.Thread(target=self.provider.serve_forever, daemon=True)
        self.provider_thread.start()
        self.api = ThreadingHTTPServer(("127.0.0.1", 0), gmail_api.GmailRequestHandler)
        self.api_thread = threading.Thread(target=self.api.serve_forever, daemon=True)
        self.api_thread.start()

    def tearDown(self) -> None:
        self.api.shutdown()
        self.api.server_close()
        self.provider.shutdown()
        self.provider.server_close()

    def test_analyze_forwards_openrouter_deltas_before_completion(self) -> None:
        profile = {
            "provider": "openrouter",
            "model": "deepseek/deepseek-v4-flash-0731",
            "api_key": "test-key",
            "base_url": f"http://127.0.0.1:{self.provider.server_port}/chat/completions",
            "temperature": 0.1,
            "max_tokens": 3072,
        }
        body = json.dumps(
            {
                "emails": [
                    {
                        "id": "message-1",
                        "subject": "Status update",
                        "sender": "sender@example.com",
                        "recipient": "reader@example.com",
                        "body_text": "Please review the update.",
                    }
                ]
            }
        ).encode("utf-8")
        connection = HTTPConnection("127.0.0.1", self.api.server_port, timeout=3)
        with patch("gmail_api.load_llm_profile", return_value=profile):
            connection.request(
                "POST",
                "/api/analyze",
                body=body,
                headers={"Content-Type": "application/json", "Content-Length": str(len(body))},
            )
            response = connection.getresponse()
            self.assertEqual(response.status, 200)
            first_line = response.readline().decode("utf-8")
            second_line = response.readline().decode("utf-8")
            remainder = response.read().decode("utf-8")
        connection.close()

        self.assertEqual(json.loads(first_line)["type"], "start")
        first_token = json.loads(second_line)
        self.assertEqual(first_token, {"type": "token", "id": "message-1", "content": "First"})
        events = [json.loads(line) for line in remainder.splitlines()]
        self.assertIn(
            {"type": "token", "id": "message-1", "content": " second"},
            events,
        )
        self.assertIn(
            {"type": "analysis", "analysis": {"id": "message-1", "markdown": "First second"}},
            events,
        )
        self.assertEqual(events[-1], {"type": "complete"})


if __name__ == "__main__":
    unittest.main()
