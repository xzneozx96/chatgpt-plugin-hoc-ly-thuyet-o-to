# ChatGPT learning prototype plan

**Goal:** Review the approved daily learning flow at desktop and mobile sizes inside a simulated ChatGPT conversation.

**Architecture:** An isolated static design artifact uses explicit screen states and original question records. Sample progress remains in browser memory. Production MCP, identity, source approval, and scheduling are outside this prototype.

**Files:** `design/chatgpt-learning/index.html` contains the conversation frame; `style.css` owns responsive and theme styles; `app.js` owns interaction states; `questions.json` contains unmodified bank records selected for the design; `README.md` records limits and a replay path.

- [x] Confirm approved flow and inspect original q145 and q146.
- [x] Build goal selection, plan, review attempt, feedback, comparison, application, source fallback, and recap states.
- [x] Include category discovery, pause/resume, and a separate random-test interaction using bank questions.
- [x] Serve the isolated folder and exercise desktop, mobile, dark theme, button styles, and keyboard focus in a browser.
- [x] Save representative screenshots and document observed limits. Open the prototype for owner review.

The prototype decides whether card density, conversation handoff, and distinct coverage/review progress are understandable. It does not validate retention, source retrieval, production saving, or the real ChatGPT host.
