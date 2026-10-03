# Gmail Analyzer

`gmail_fetch.py` exports every Gmail message received in a precise time window to JSON Lines. The start is inclusive and the end is exclusive.

## Setup

1. Create a Google Cloud project, enable the Gmail API, configure an OAuth **Desktop app** client, and download its JSON file as `credentials.json` in this directory.
2. Install the dependencies:

   ```powershell
   py -m pip install -r requirements.txt
   ```

3. Fetch an interval. The first run opens a browser for Gmail read-only consent and stores the renewable token in `.secrets/gmail-token.json`.

   ```powershell
   py gmail_fetch.py --start 2026-10-01T09:00:00+05:30 --end 2026-10-01T18:00:00+05:30 --output emails.jsonl
   ```

Use `--include-body` to add decoded plain-text bodies and `--include-spam-trash` to search every Gmail system label. The output remains one complete email object per line, which is friendly to streaming tools and downstream analysis.

## Local email summaries

Download the local model once, then analyze one email at a time:

```powershell
python Model_Management/download_model.py
python Model_Management/main.py --subject "Project meeting" --from "rahul@example.com" --to "piyush@example.com" --body "The meeting has moved to Monday at 10 AM. Please prepare the current architecture."
```

`main.py` uses `llama_cpp.Llama.create_chat_completion()` with a system/user chat prompt and JSON-mode output. It prints one structured result with a concise summary, important facts, recipient actions, and explicit deadlines.

To inspect the model's raw streamed text for a particular one-based line in `emails.jsonl`, run:

```powershell
python Model_Management/model_prompt_check.py 1
python Model_Management/model_prompt_check.py 1 --system-prompt "Extract every date and action item."
python Model_Management/model_prompt_check.py 1 --system-prompt-file prompts/my-prompt.txt
```

The checker uses the default system prompt from `main.py` unless you override it. Both the checker and website prefer `body_text`, otherwise convert the complete `body_html` to readable text (ignoring head, script, style, and noscript content), and fall back to the Gmail `snippet` only when neither full body is available. The website sends the full text and HTML alternatives to its local backend, which selects the body before analysis. The model uses JSON-mode streaming with a schema requiring summary, important, actions, and deadlines fields; this avoids an empty object response. Before generation, the checker prints the exact system prompt and formatted user input, then prints the model's JSON response as it streams. Use `--input` to select a different JSONL file.

`main.py` asks the model not to include reasoning in its response, but it does not explicitly disable the model's internal thinking mode. The checker uses that same prompt by default; a custom system prompt can change what the model is asked to output.

Do not commit `credentials.json` or `.secrets/gmail-token.json`; they authorize access to the mailbox.

## GUI

The Figma-based interface lives in `figma/`. Start the local Gmail bridge in one terminal, then start the Vite app in another:

```powershell
py gmail_api.py
cd figma
corepack pnpm dev
```

Choose an inclusive start time and exclusive end time in the interface, then select **Fetch emails**. The first fetch opens Google OAuth if the local token does not exist. Fetched records are displayed in the interface and overwritten into `emails.jsonl` for downstream use.

Fetched intervals are stored in `.data/gmail-cache.sqlite3`. A later fetch reuses any complete portion of that time range from the local cache and contacts Gmail only for missing intervals. Use **Fetch again** to bypass the cache, refresh the selected interval from Gmail, and update the local copy. The progress bar reports each completed Gmail message while a network fetch is active.

The interface also includes a **Your AI copilot** panel. Click an email's sparkle icon, or select emails and use **Analyze with AI**, to summarize only those selected messages using the Qwen model in `Models/`. The local bridge keeps the model loaded after the first request; no email content is sent to a remote AI service. HTML email bodies are sanitized before rendering in the message reader, with plain text used as a fallback.
