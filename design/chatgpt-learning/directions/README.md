# Working design comparison

Open http://127.0.0.1:8790/directions/ with the existing design preview server.

Three provisional directions share bank data and an ephemeral question-state map:

- A / Nhịp học: warm study desk, sidebar, daily task above course index.
- B / Đường học: blue course index with a separate daily-action column. Recommended for clear course navigation.
- C / Ôn & nhớ: course index beside a five-question unit summary.

Try the design switcher, a category, the confusing-groups search, a group lesson, and Ôn tập. Answers show explanations copied from the bank. Progress is shared across overlapping groups. Reload resets the sample history.

This is a throwaway visual comparison, not the production ChatGPT integration. No account persistence, scheduling engine, external knowledge retrieval, or live ChatGPT conversation is connected here. Mock test is only an entry-screen preview. New question selection is sequential for this demonstration. Mastery is seeded and can be revoked on an incorrect response; this prototype does not simulate advancement across multiple days.

## Verification, 2026-10-06

- JavaScript syntax check passed.
- Browser inspected A, B and C desktop layouts.
- Answered q145 correctly in the two-question review queue; source explanation appeared and the group due count changed from 2 to 1, coverage stayed 3/5 and mastery stayed 1/5.
- Inspected phone layout; browser viewport screenshots were intermittently unavailable or incorrectly scaled. DOM measurement at 390px showed document width 375px (no horizontal overflow). Full mobile visual acceptance remains pending.
- Fixed missing space in daily heading, moved C's daily action above course rows on narrow screens, reduced thick top border flagged by detector.
- Font: Be Vietnam Pro, bundled under OFL; license in assets/OFL.txt.
