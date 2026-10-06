# Direction B verification

The accepted visual direction is applied to the full isolated prototype. Verification covers representative user actions, not production readiness.

## Required checks

- Returning course overview opens first, daily action is visible, and course counts are derived from original memberships.
- Goals support 10, 12, 15 and a valid custom integer without requiring a new onboarding on every navigation.
- Original category opens a unit and original questions can be answered.
- Confusing groups can be searched by title or question ID, selected and studied; progress derives from the same question records.
- Wrong answer produces bank answer and a distinct explanation area. One immediate correct cannot advance delayed mastery.
- Guided review/application path and recap remain navigable.
- Mock test supports previous/next, answer retention, timer, submission and critical-question failure. No ordinary navigation silently abandons a live attempt.
- Desktop and narrow viewport captures show legible content and a clear primary action; keyboard focus remains visible.

## Scope limits

The sample question history is in memory. Multi-day scheduling, account storage, authenticated MCP retrieval, YouTube segments and actual ChatGPT host rendering are not verified by this prototype review. Draft family mappings still require content review. Random-bank practice does not establish official test composition.

## Results

Runtime inspection completed for the integrated prototype at desktop and 390px phone widths.

- Initial overview displayed 3/600 first-pass coverage, 1/600 seeded delayed mastery and two due questions.
- Continue today opened q145 then q146. Correct submissions showed the original bank explanations. Returning to overview showed zero due; coverage and delayed mastery stayed 3 and 1.
- Searching q145 returned four overlapping groups. The five-question urban-speed group showed 3/5 covered, 1/5 learned and zero due, matching the overview records.
- First submission of q181 through Văn hóa giao thông changed total coverage to 4/600, category coverage to 1/23, and confusing-category coverage to 4/598. Mastery stayed 1/600.
- The random test opened at 20:00 on source q354, navigated to q392 and retained q354's provisional answer on return. Course navigation opened an exit confirmation rather than silently discarding the test. Timer continued.
- Goal selection of 10 returned to the overview with 10 new questions/day.
- Phone DOM measurement showed width390 and document width375, with no horizontal overflow. At document scroll0, Continue today occupied y700–747 within the phone viewport. A valid native screenshot captured the reflow.
- JavaScript syntax check passed. Detector flagged undersized review-bar text; it was raised to12px. A stale mock-preview due warning was corrected to derive from the shared Map.

Screenshots in .impeccable/review/ capture desktop overview, phone overview, explanation, group and active test. Despite their .png names, the native API encoded these as JPEG. Test expiration and all 30-question scoring outcomes were inspected in source, not driven in this UI pass. No production-readiness claim follows from these checks.

Independent Impeccable visual review returned **ship** for owner review, with no material fixes required. The explanation capture was replaced after the first review identified a stale pre-submit image. The completed review is recorded in `ui-ux-direction-b-visual-review.md`.
