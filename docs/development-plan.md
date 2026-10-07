# Development plan

## Current state and platform decision

As of 2026-10-05, the private local product has a real browser preview, all 600 questions and 318 images, SQLite attempt history, deterministic due reviews, bank-only source search, and a tutor skill. A stateless public `/play` page and `/mcp` endpoint can be served through HTTPS. The temporary ngrok endpoint passed remote MCP and image checks. ChatGPT account rendering is still for the signed-in user to test. See `docs/full-product-run.md` and `docs/deployment.md` for the current implementation and handoff.

The repository contains a 600-question JSON bank, a Python study tracker, and a traffic-sign search proof of concept. It had no Node package or MCP server. The user designated the JSON as the source of truth for learner questions. It contains questions with two, three, or four options. The user supplied a URL pattern for the 318 referenced images, which are now bundled with the Phase 1 package. Forty-three questions have no explanation in the source.

Current OpenAI Plugins package skills and MCP connections. A ChatGPT UI comes from an MCP Apps resource, linked to a tool through `_meta.ui.resourceUri`. A root `plugin.json` is the portable package format; `.codex-plugin/plugin.json` remains a compatibility format. This differs from the legacy ChatGPT plugin manifest and Custom GPT action model assumed by older tutorials. Package and submit only after the server and UI work. A local `/mcp` URL cannot be connected directly from ChatGPT; developer-mode testing needs a public HTTPS tunnel or Secure MCP Tunnel. Public submission needs stable public HTTPS.

Sources checked on 2026-10-05:

- [Plugin architecture](https://developers.openai.com/plugins/concepts/plugins)
- [Build an MCP server](https://developers.openai.com/plugins/build/mcp-server)
- [MCP server and UI quickstart](https://developers.openai.com/plugins/build/app-quickstart)
- [Add UI to your MCP server](https://developers.openai.com/plugins/build/chatgpt-ui)
- [Plugin reference](https://developers.openai.com/plugins/reference)
- [Build skills](https://developers.openai.com/plugins/build/skills)
- [Package your plugin](https://developers.openai.com/plugins/build/plugins)
- [Connect and test](https://developers.openai.com/plugins/deploy/connect-chatgpt)

## Architecture

The TypeScript process loads the root question bank and owns its answer key. The MCP layer validates inputs and returns structured data. `get_question` returns one question without its key and links to the quiz UI resource. The UI asks the same server to run `submit_answer`, which returns the deterministic verdict, correct answer, and the source explanation when present. The UI calls `get_question` with the current ID to advance through the bank. Both tools also return enough text for a client without UI. No question or answer state persists in Phase 1.

The UI uses the standard MCP Apps `ui/initialize`, `ui/notifications/tool-result`, and `tools/call` bridge. It has no direct database or answer-key access. The server uses stateless streamable HTTP at `/mcp`. A later repository can replace the bundled bank without changing the tool contracts.

## Milestones

1. **Phase 1, local vertical slice.** Implement the TypeScript MCP server, two tools, the 600-question bank and referenced images, inline quiz UI, local tests, type checking, and setup instructions. Verify the MCP tool round trip and UI interaction locally. ChatGPT-hosted verification requires a reachable tunnel and a developer-mode connection.
2. **Phase 2, private learner state.** Implemented with an append-only SQLite attempt log, `get_due_reviews`, `get_progress`, deterministic intervals, and retry tests.
3. **Phase 3, sourced retrieval.** Implemented as bank-only lexical search with question ID references. Evaluate retrieval quality before adding more source material.
4. **Phase 4, tutor skill.** Implemented under `skills/driving-theory-tutor/SKILL.md`; combined ChatGPT plugin activation remains unverified.
5. **Phase 5, authenticated remote use.** The server verifies WorkOS tokens, stores learner-scoped attempts in Neon, and exposes progress, due reviews, and deletion. The live provider and database setup and a real ChatGPT login remain unverified.
6. **Phase 6, public package.** Portable manifest and Docker build path are present. Stable hosting, image rights, listing metadata, account-side review, and human approval remain before submission or publication.

## Risks and unknowns

- The user designated the bank as the source of truth. Rights to redistribute the downloaded images and public publication terms still need review.
- ChatGPT may render or cache UI resources differently from the local mock host. Verify with the live Vercel connection in developer mode.
- The anonymous public demo cannot associate attempts with a learner. Answer results there are ephemeral.
- WorkOS and Neon must be configured before live learner progress works. A privacy policy and public listing metadata remain open.
- Plugin directory access and approval depend on the publisher account and OpenAI review.

## Phase 1 acceptance

`get_question` advertises an MCP Apps resource and returns the source options without the answer. A user can choose an option, submit it once, see the server's verdict and explanation when the source has one, and move to the next question. Tests cover correct and wrong answers, invalid IDs, images, and progression. Type checking passes and the HTTP MCP server starts.

## Phase 1 verification status

The local MCP client test passes over HTTP. A headless browser test checks answer selection, deterministic feedback, next-question flow, and image rendering. The permanent Vercel endpoint serves `q301` and its image. Authenticated MCP tests cover token checks, two-learner isolation, and history after a handler restart. ChatGPT developer-mode rendering and a real WorkOS login remain unverified.
