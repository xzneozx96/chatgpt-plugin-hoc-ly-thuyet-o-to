# Full product design

The learner opens `/preview`, chooses a topic or due review, answers a question, and sees source-backed feedback and saved progress. A ChatGPT client calls the same quiz and search tools through `/mcp`. A temporary remote preview can serve the public question bank without opening the local learner history.

Two designs were considered. One used an append-only attempt log and derived review state. The other used mutable review rows in one transaction and explicit local, preview, and hosted trust profiles. This implementation combines the smaller event-log state model with the explicit trust profiles. At 600 questions, deriving a learner's review queue from attempts is inexpensive, and the log remains the single account of what happened. The process rejects a remote progress mode without authentication.

The runtime owns three boundaries:

1. `quiz.ts` validates the bundled bank, selects questions, scores answers, and searches source text. It never needs learner state.
2. `study.ts` derives progress and review dates from attempts. SQLite stores attempt events with a unique attempt ID so a retry cannot count twice.
3. `server.ts` exposes typed MCP tools and the local browser preview. Both call the same domain functions and store. The public preview profile omits stateful tools.

The fixed interval sequence is 1, 3, 7, 14, and 30 UTC days after successive correct answers. A wrong answer becomes due immediately. The UI shows when the source has no explanation. A later authenticated hosted mode can replace the fixed local learner identity; the current product does not claim multiuser security.
