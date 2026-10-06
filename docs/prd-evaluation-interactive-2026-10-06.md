# PRD v0.11 evaluation: interactive, gamified direction

Date: 6 October 2026. Status: evaluation and proposed outline for PRD v1.0. The outline is awaiting owner approval. No PRD body has been rewritten yet.

## Owner expectation (new input)

- A free, highly interactive mini-app inside ChatGPT for Vietnamese learners.
- Learning should feel fun, helpful and effective. Brilliant and Duolingo are the references.
- Two themes, both pure monochrome. Dark mode is black and white like ChatGPT. Light mode is white and black.
- The deployed v0.11 build feels boring and flat. Feedback is split between the card and ChatGPT, and progress is confusing.

## Verdict

v0.11 does not match this expectation. It is a rigorous learning-policy specification. It is not an experience specification.

| # | Finding | Evidence |
| --- | --- | --- |
| 1 | The PRD specifies rules but not experience. Most of it defines evidence semantics: B4 eligibility, mock finalisation, replay and coverage arithmetic. Nothing specifies feedback moments, motion, celebration, session rhythm, progress visuals or game mechanics. Brilliant and Duolingo are never mentioned. | `product-requirements.md` B4, B6, C4 |
| 2 | The PRD excludes what the owner now wants. Leaderboards, "punitive streaks" and "animated traffic simulations" are out of scope. No section asks for delight, and EXP-06 asks for minimal UI with one primary action per step. | A4 "Out of scope", EXP-06 |
| 3 | The PRD does not say who owns feedback. The card sends the answer as a chat message (`ui/message`). ChatGPT then calls `submit_study_answer` and writes its own verdict, while the card checks the server every 2 s for up to 90 s. Learners get two verdicts at different times, and the card can wait on the model. | `src/ui/learning.html`; commit a7237ad |
| 4 | Progress has too many concepts. Learners see coverage, learned, needing repair, unresolved confusion, due, and next review. Several can overlap. These distinctions are correct for the data model, but on screen they read as a reporting dashboard, not progress a learner can feel. | A1 paragraph 3, EXP-11 |
| 5 | The theme conflicts with recorded decisions. PRODUCT.md and DESIGN.md lock in direction B (navy ink, blue accent). The prototype uses green and rose panels. Both conflict with pure monochrome. | `DESIGN.md` tokens, v3 screenshots |
| 6 | The process is sized for a funded team. It has an editorial owner, a staffed responsibilities matrix, pilot statistics, a 6-week team milestone plan and nine release gates. For a free community app, this delays shipping the fun part. | D1–D3, C1–C3 |
| 7 | Friction is not addressed. Sign-in is required before progress is saved (DAT-01). D3 names activation friction as a risk, but no requirement solves it. | DAT-01, D3 |

What to keep: the bank-as-authority rules, deterministic server scoring, review-first ordering, the "learned = two delayed unassisted recalls" contract, honest mock-test labelling, and the 249 confusing-question families. These are the product's backbone. They stop the game layer from rewarding activity instead of learning. Most of B4 and B6 moves to an appendix nearly unchanged.

## Platform facts checked

- A widget can call MCP tools directly through `tools/call` over the host bridge, with no chat message involved. Source: OpenAI "Add UI to your MCP server". The card can therefore score answers instantly by itself.
- The widget already follows the host's light/dark theme (commit e0dc489).
- That page does not document fullscreen or picture-in-picture requests. Treat "lesson runs fullscreen" as a test to run in ChatGPT before relying on it.

## Proposed v1.0 structure (for approval)

1. **Product brief.** Problem, audience and promise. The promise is restated as "a 10-minute daily driving-theory game that actually makes you remember". Free and community-shared. Success is measured as fun plus retained recall.
2. **Experience principles.** Card-first play, instant feedback, ChatGPT as an on-demand coach, one source of truth for progress, monochrome design, and no punishment.
3. **The core loop.** Tap an answer, then an instant verdict with motion and haptics-equivalent cues, then a one-line "why", then Continue. Combos, a session progress bar and a finish screen.
4. **Session shape.** The daily lesson is 5–8 steps: warm-up review, then new skill, then challenge, then celebration. Review-first ordering stays.
5. **Interaction types (Brilliant-style).** Multiple choice, tap the clue on the sign or diagram, sort or match (for example speed by road type), spot the difference between two confusing questions, and a timed lightning round. Generated or derived activities stay separate from official accuracy (TUT-06).
6. **Gamification system.** XP, a forgiving daily streak with freezes, a daily goal ring, levels per category mapped to the course path, and badges. Optional: weekly community leagues. All are computed from the same server events as B4, so "+XP" never contradicts "not learned yet".
7. **Card and ChatGPT ownership contract.**
   - The card owns the verdict, the next step and progress.
   - ChatGPT speaks only when the learner asks, after a repeated mistake, or at lesson end.
   - Help buttons hand context to ChatGPT explicitly.
   - Scoring goes through direct `tools/call`, never through a chat message.
8. **Progress model as learners see it.** Three numbers: Seen, Mastered and Due today, plus the course map. Coverage, repair and confusion stay as detail views.
9. **Visual design.** Monochrome token set for light and dark. Correct and wrong are carried by icon, shape, motion and copy instead of colour. Typography scale and motion specs, with reduced-motion support.
10. **Mock test as a boss level.** Same exam rules (B6), framed as an unlockable challenge, with a debrief that feeds review.
11. **Onboarding and identity.** Play the first lesson without login, then prompt to save progress.
12. **Scope, milestones and release checks.** Sized for a solo or small free project. The prototype has one gamified lesson, tested in real ChatGPT.
13. **Appendices.** A: learning-evidence contract (current B4 and C4). B: mock-test rules (B6). C: knowledge base and video (B3). D: data and privacy (B7). E: decision log.

Follow-up after approval: supersede direction B in `PRODUCT.md` and `DESIGN.md`, and update the tutor skill so ChatGPT stops duplicating card verdicts.

## Owner decisions on this outline (6 October 2026)

- Theme: strict black and white. Correct and wrong are shown by icon, shape, motion and words.
- Game mechanics: XP, a daily goal ring and weekly leagues. Streaks, levels and badges are not included.
- Feedback: the card gives the only verdict. ChatGPT coaches on request, after repeated mistakes and at lesson end.
- Outline approved without the no-login trial. These decisions are written into `product-requirements.md` v1.0.
