# Full product design

The learner opens `/preview` for a private local trial or connects the authenticated `/mcp` server in ChatGPT. Both paths use the same question bank and review schedule. The public `/play` page serves the bank without opening learner history.

Two designs were considered. One used an append-only attempt log and derived review state. The other used mutable review rows in one transaction and explicit local, preview, and hosted trust profiles. This implementation combines the smaller event-log state model with the explicit trust profiles. At 600 questions, deriving a learner's review queue from attempts is inexpensive, and the log remains the single account of what happened. The process rejects a remote progress mode without authentication.

The runtime owns three boundaries:

1. `quiz.ts` validates the bundled bank, selects questions, scores answers, and searches source text. It never needs learner state.
2. `study.ts` derives progress and review dates from attempts. SQLite stores local attempts, while Neon stores public attempts under an opaque learner key. A repeated attempt ID counts once per learner.
3. `server.ts` exposes typed MCP tools and the local browser preview. The authenticated MCP verifies a WorkOS token before accessing learner state. The `/play` profile omits stateful tools.

The fixed interval sequence is 1, 3, 7, 14, and 30 UTC days after successive correct answers. A wrong answer becomes due immediately. The UI shows when the source has no explanation. Live multiuser behavior still needs a configured WorkOS and Neon deployment and a ChatGPT account test.
