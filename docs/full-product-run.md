# Full product run

## Exit condition

A learner can open a local preview and complete questions from all 600 source entries, including their images. Attempts and a due review schedule survive a server restart. Search returns traceable passages from `question-bank.json` only. The MCP tools expose the same behavior, and a tutor skill and portable plugin files are ready for a private ChatGPT connection. Automated and browser checks pass. A ChatGPT hosted check requires a signed-in account and a temporary public HTTPS connection.

## Units and gates

1. Capture the existing four-test baseline and inspect source, UI, and MCP contracts. Done on 2026-10-05; all four pass with local loopback permission.
2. Choose one durable state boundary and a local trial identity. Verify repeat submissions, due dates, restart persistence, and progress totals.
3. Add bank-only theory search. Verify citations and numeric queries against known questions.
4. Complete the learner UI and a local preview. Verify wrong/right feedback, image loading, reviews, search, and restart in a real browser.
5. Package the tutor skill and plugin manifest from current OpenAI guidance. Validate schemas and MCP discovery.
6. Run the hands-on cases in `docs/try-it-yourself.md`; confirm the public HTTPS MCP connection and ChatGPT rendering when the account is signed in.

## Decisions

The question bank remains the sole learning source. A local trial profile is adequate for private preview. Remote learner history needs authentication before public use. No publishing or permanent deployment is part of this run.
