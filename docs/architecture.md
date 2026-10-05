# Architecture

The TypeScript process validates the 600-question JSON bank and serves its 318 local WebP assets. `quiz.ts` owns question selection, deterministic answer scoring, and bank-only lexical search. `study.ts` derives review schedules and progress from attempts. `AttemptStore` appends attempts to SQLite and rejects conflicting retries. `LearnerWorkspace` joins the read-only bank to the local history.

`server.ts` exposes MCP tools at `/mcp`. The same workspace powers the local `/preview/tool` bridge, which hosts the exact MCP Apps UI at `/preview`. The UI has no answer key. The server binds to `127.0.0.1`.

With no public base URL, the private local trial enables persistent progress. Setting `PUBLIC_BASE_URL` to a remote HTTPS origin switches to stateless preview mode and omits local progress tools and routes. A hosted multiuser product would require OAuth-derived identities, a server-side store, and a separate deployment gate.
