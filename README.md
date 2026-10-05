# Lý Thuyết Lái Xe Tutor

A private Vietnamese driving-theory study app with a browser preview and a streamable HTTP MCP server. It offers practice, progress, spaced reviews, and source-backed search. The answer key and scoring stay on the server.

The repository's `question-bank.json` is the 600-question source of truth, version `2026.07.1`. The 318 referenced images are under `images/` from the URL pattern supplied by the project owner. The bank has 43 questions without explanations; those show a clear missing-explanation message. A separate review of image rights and publication terms remains for the public release milestone.

## Run locally

Use Node.js 22 or later.

```bash
npm ci
npm start
```

Open **[the local preview](http://127.0.0.1:8787/preview)** after the server starts. The server also exposes MCP at `http://127.0.0.1:8787/mcp`. Set `PORT` to use another port. Local answer history is saved at `.data/study.sqlite`; set `DATA_PATH` to choose another file. Do not open `src/ui/quiz.html` as a `file://` page, since its buttons require the preview host or ChatGPT MCP Apps bridge.

The preview offers all seven topics, always-visible **Câu trước** and **Câu tiếp theo** buttons that work without answering, direct access to IDs such as `q499` through the Tra cứu tab, due reviews, saved progress, and source-backed search. Wrong answers become due immediately. Correct answers are scheduled after 1, 3, 7, 14, and 30 days as the streak grows. Search uses `question-bank.json` only.

## Test

```bash
npm test
npm run typecheck
npm run lint
```

The integration test starts a temporary loopback server and connects through the official MCP client. The UI test uses Playwright against the real preview, including a WebP image and saved progress after reload. If Chrome is not installed, run `npx playwright install chromium` before `npm test`. Set `CHROME_PATH` when Chrome has a nonstandard path. In restricted environments, allow local sockets and browser startup for the tests.

For manual protocol inspection, run `npx @modelcontextprotocol/inspector@latest` and connect to the local `/mcp` URL using Streamable HTTP. The tools are `get_question`, `submit_answer`, `get_progress`, `get_due_reviews`, and `search_theory`. `get_question` links to `ui://ly-thuyet-lai-xe/quiz-v1.html`. Provide a stable UUID `attemptId` to `submit_answer` if a client may retry the same submission.

## Test in ChatGPT developer mode

ChatGPT needs an HTTPS route to the server. Use Secure MCP Tunnel or a temporary development tunnel. Start the server with `PUBLIC_BASE_URL` set to the tunnel origin. That switches it to a stateless public mode, offering `/play` for web learners and `/mcp` for ChatGPT while withholding local progress and review tools. Register the HTTPS `/mcp` URL in ChatGPT Plugins developer mode, refresh the connection after metadata changes, and start a new chat. Select the connection and ask "Cho mình luyện lý thuyết lái xe." Check that the card appears, submit an answer, and move to the next question.

The local test proves the MCP exchange, but ChatGPT-hosted rendering needs your signed-in developer-mode account. Account-based remote progress needs OAuth before it can be enabled. Nothing is published by this local trial.

See [try-it-yourself.md](docs/try-it-yourself.md) for exact manual cases and [deployment.md](docs/deployment.md) for ChatGPT connection and public hosting steps.
