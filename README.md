# Lý Thuyết Lái Xe Tutor

A private Vietnamese driving-theory study app with a browser preview and a streamable HTTP MCP server. It offers practice, progress, spaced reviews, and source-backed search. Scoring stays on the server. Lesson and lightning cards receive answer keys in hidden `_meta` so they can show a verdict at once. Mock tests never receive keys.

The repository's `app/data/question-bank.json` is the 600-question source of truth, version `2026.07.1`. The 318 referenced images are under `app/data/images/` from the URL pattern supplied by the project owner. The bank has 42 questions without explanations; those show a clear missing-explanation message. A separate review of image rights and publication terms remains for the public release milestone.

## Run locally

## Layout

```
app/       runtime application: src, api, tests, scripts, migrations, public, package.json, vercel.json, Dockerfile
app/data/  question-bank.json and images/ (loaded by the app and copied into dist/)
content/   source material, not shipped: book/, question-bank.txt
docs/      product and deployment docs
plugin/    plugin.json, mcp.json, driving-theory-tutor skill
```

Run every npm, Docker and Vercel command from `app/`. Set the Vercel project's Root Directory to `app`.

Use Node.js 22 or later.

```bash
cd app
npm ci
npm start
```

Open **[the local preview](http://127.0.0.1:8787/preview)** after the server starts. The server also exposes MCP at `http://127.0.0.1:8787/mcp`. Set `PORT` to use another port. Local answer history is saved at `app/.data/study.sqlite`; set `DATA_PATH` to choose another file. Do not open `app/src/ui/quiz.html` as a `file://` page, since its buttons require the preview host or ChatGPT MCP Apps bridge.

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

The public endpoint is `https://chatgpt-plugin-hoc-ly-thuyet-o-to.vercel.app/mcp`. Without login configuration, it offers question practice and search but does not save ChatGPT answers. Follow [Enable saved reviews in ChatGPT](docs/chatgpt-progress-setup.md) to attach WorkOS AuthKit and Neon. Once configured, ChatGPT signs the learner in through OAuth and the server saves answers, progress, and due reviews under that account. The standalone `/play` page remains an anonymous demo.

Refresh the MCP connection after its tool list changes. Start a new chat, select the connection, and ask "Cho mình luyện lý thuyết lái xe." After signing in, answer a question, ask for your progress, and check it again in another chat. ChatGPT-hosted rendering and the provider login must be checked in a signed-in ChatGPT account before calling that path verified. The plugin has not been published in a directory.

The public quiz is live at [chatgpt-plugin-hoc-ly-thuyet-o-to.vercel.app/play](https://chatgpt-plugin-hoc-ly-thuyet-o-to.vercel.app/play). See [try-it-yourself.md](docs/try-it-yourself.md) for manual cases and [deployment.md](docs/deployment.md) for deployment details.
