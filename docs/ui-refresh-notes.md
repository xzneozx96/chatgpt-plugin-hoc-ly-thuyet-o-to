# UI refresh, 7 October 2026

The owner requested playful color and graphics inspired by Brilliant and Duolingo, with purposeful animation based on Emil's design principles and Animate. This replaces the previous monochrome visual rules.

## Throughput checkpoint

- Blocking first steps. Inspect the current embedded widget, product constraints and local browser before edits. Graph indexing was rejected by automatic approval review; discovery remained local.
- Independent workstreams. One implementation owner changed the shared card and host. A separate read-only reviewer inspected integration and the final diff. Original artwork generation ran separately.
- Shared mutable state. Scoring, XP, scheduling, learner persistence and host protocol remain unchanged. External runner output was isolated under /tmp; that runner failed before edits.
- Smallest safe decomposition. Inline semantic CSS preserves the embedded card's self-contained delivery. An additional WebP allowance in the existing asset route serves the artwork with the correct MIME type. No UI framework or animation package was introduced.

## Verification evidence

Desktop browser inspection covered onboarding, selection, correct feedback, course overview and topic map. A 390px mobile viewport confirmed dark-theme rendering without horizontal overflow. Existing tests cover the study, family, mock, host and persistence paths. A new browser case covers the illustration, a 360px card, keyboard-triggered feedback and reduced motion.

Answer radios now cover the full option row. A browser test exposed the old one-pixel input being intercepted by its letter icon during hover. Full-row hit targets retain native radio semantics and keyboard support.

The family-picker test now clicks a measured visible row directly. Tracing showed Playwright's locator click scrolling the inner list before pointerdown, confounding the selection-stability assertion. A direct pointer click preserved the list position. The mock-result assertion is scoped to the opened question, avoiding a random match in a collapsed question.

The design detector's broken-image warning refers to the existing zoom dialog image, whose source is supplied only when opened. Its stripe advisory refers to existing wrong/blank-answer patterns, which communicate state alongside labels and icons.

Screenshots are in `docs/ui-refresh-preview/`. The illustration is `src/ui/assets/learning-journey.webp`, 29KB, and the build copies the asset directory. Signed-in ChatGPT rendering and deployment are not verified by the local browser.

Final validation passed all 131 tests in 56.36 seconds. Typecheck, lint, production build and diff whitespace checks passed. Tested light-theme text, secondary, primary, selection, success, error, amber and violet token pairs all exceed 4.5:1; the lowest measured pair is violet at 5.02:1. Dark secondary and primary token pairs measured 8.22:1 and 8.86:1.

## Compact topic browser follow-up

The owner rejected the space used by the winding path. Brilliant course-catalog references informed a compact topic browser, while preserving our color system and original course order. The topic list measured 1,204px before and 462px after at the same desktop viewport, a 62 percent reduction. Desktop has two columns, mobile one. Selected details sit beneath their topic, and collapse restores focus to the trigger.

References: https://brilliant.org/courses/ and the course screenshots in https://www.smartworld.it/app/brilliant-app-allenamento-mente.html. The latter were published in 2023 and used only as layout inspiration, not evidence of Brilliant's current signed-in UI.

Validation passed all 132 regression tests, typecheck, lint, production build and whitespace checks. The compact-browser case passed again after the final keyboard-focus adjustment, covering both themes at 900px, 390px and 320px widths, inline expansion, collapse focus and horizontal overflow. The layout detector returned no findings. The final dark overview screenshot is `docs/ui-refresh-preview/compact-topics-dark.jpg`.

## Consistent icon family

The shared icon registry now contains 27 Phosphor Duotone SVGs, sourced from https://github.com/phosphor-icons/core/tree/main/assets/duotone. Topic badges use solid semantic colors and 32px icons. Navigation, feedback, search, information and learning actions use the same family. The secondary fill opacity is 0.32 for visibility at small sizes. All SVGs are embedded locally; no runtime CDN or new dependency is required. The MIT notice is preserved in `src/ui/assets/phosphor-LICENSE.txt`.

All 37 learning-card browser regression tests passed. Typecheck, lint and production build passed. Both themes were inspected in the local browser. The dark topic screenshot is `docs/ui-refresh-preview/phosphor-topics-dark.jpg`.

## Signed-in Brilliant walkthrough and screenshot comparison

The actual Scheduling Problem lesson, practice checks, deliberate mistakes, review and completion were exercised. Dashboard, personal progress and course path were also inspected. Five screenshot pairs were compared locally; the Brilliant screenshots are not kept in the repository because they contain account details, and they show dashboard, unanswered question, correct feedback, wrong feedback and course browser.

The first neutral restyle still left the home screen in a vertical stack. Screenshot comparison prompted a second iteration with a progress sidebar and illustrated course card. Questions now use a narrower central column, calmer answer rows and pill actions. Feedback has a compact verdict/action row and retains the approved explanation below it. The compact course browser is an intentional exception to the reference path.

The UI owner edits the shared HTML; review stays read-only. Existing authoritative state and event actions remain unchanged. The final checks include full regression tests, typecheck, lint, build, theme switching, 320px visual questions with zoom, and screenshot comparison. A popover overlap exposed by the regression suite was repaired by positioning the popover outside its number grid.

Verified: 132/132 full regression tests passed. After the final suggestion wording and responsive footer adjustments, all 6 targeted browser tests passed. Typecheck, lint and build also passed. Desktop screenshot pairs were inspected in the comparison page; light mode and 320px layout/zoom were checked live. Screenshots establish visual structure; no pixel-equivalence percentage or identical Brilliant timing is claimed.

## Course path and shared purple theme

The owner's latest direction supersedes the compact-grid exception above. The course browser now follows the signed-in course-path reference: winding raised elliptical coins, floating current marker, quiet future topics, and a bottom topic action dock. Coverage, mastery and review counts share one compact summary instead of separate large tiles. The path scrolls internally, retains position across selections, and keeps all topics accessible without inventing locks. Its info popovers use the entire summary as their positioning boundary.

The owner liked the course purple and requested it app-wide. Shared purple tokens now drive primary actions, dashboard goal/progress, lesson emblems, selected answers, mock controls and the learner's ranking highlight. Light surfaces have a subtle lavender tint; dark backgrounds stay charcoal. Correct answers remain green, errors coral, and XP/review gold. White on #8650dd has 4.99:1 contrast; brighter dark-mode purple is reserved for graphics and progress.

Current browser evidence is in purple-dashboard-dark.jpg, purple-dashboard-light.jpg, purple-ranking-dark.jpg, purple-feedback-dark.jpg and purple-course-mobile-light.jpg under docs/ui-refresh-preview. The course comparison capture is after-map-dark-958.jpg; despite its historical filename, the current screenshot is 855×1121 at browser zoom 105%, explicitly recorded in the comparison. Other comparison pairs remain historical and do not represent the final purple palette.

Final verification: 132/132 tests passed in 61.80 seconds; typecheck, lint, build and git diff --check passed. The course regression covers light/dark at 900/390/320px, all topics reachable, no horizontal overflow, retained lower-topic scroll position and keyboard collapse focus. A read-only visual review found no actionable contrast/state regressions. The design detector flags the hidden zoom image whose src is assigned when opened and semantic wrong-answer stripe patterns; neither is a new decorative defect.

## Study flow from the owner's four screenshots

The unanswered question now has one bottom Check. Guess and Skip sit in Options. Correct feedback has Why on the left and Continue on the right; incorrect feedback has explanation on the left and amber Try again on the right. Extra help and the correct-answer reveal open with the explanation. Wrong original feedback retains optional Continue in Options. Purple remains the primary brand color, with semantic green/coral/gold.

Close, compact progress and authoritative accumulated lesson XP form the header. XP remains visible before and after each answer. Short press/verdict/check/confetti motion respects reduced motion; screenshot comparison does not claim identical Brilliant timing.

The backend retry transition preserves the original mistake, reuses one repair or creates one for a final-question mistake, and forces assisted credit without mastery. The same question's UI selection resets correctly. A live reload exposed that reconciliation could skip an unfinished immediate correction; reopening now preserves that active repair unless blocked by a mock test. Server CAS and request receipts retain idempotency.

Evidence: study-flow-initial-dark.jpg, study-flow-correct-dark.jpg, study-flow-wrong-dark.jpg, study-flow-retry-mobile-dark.jpg and study-flow-mobile-light.jpg in docs/ui-refresh-preview. docs/study-flow-comparison.html pairs those with the owner's original supplied screenshots. Local preview data was isolated in /tmp/study-flow-verification.sqlite; the user's real study session was not used for verification.

Final checks: 135/135 tests passed in 62.91 seconds, including HTTP tool metadata, immediate/final-question retry, original evidence preservation, request replay, assisted credit, pause/resume and mobile overflow. Typecheck, lint, production build and diff whitespace checks passed. A read-only domain/UI review caught missing retry card metadata; it was fixed and covered by the protocol test.

## Direct actions and signed answer-row XP

The owner rejected the Options dropdown. Available secondary actions now occupy a right-hand rail on desktop and wrap below the answers on mobile. The main Check/Why/Continue/Try again controls retain their footer positions. Feedback, mastery and the signed XP delta are in the selected answer row; the duplicate bottom verdict and card-wide success glow are removed. The coral key contains a plain cross, with no nested black circle. Correct answers briefly animate confined confetti near the XP chip. Individual radios are disabled after grading so the inline verdict remains focusable.

The prior game policy awarded effort XP for mistakes. The owner's new policy deducts 3 XP for every wrong study answer, including assisted/guessed, first/review/practice, repair and lightning attempts. The wrong-first award guard precedes reward-cap accounting, preventing penalties from refunding either cap. Correct rewards and mastery bonuses remain; mock per-question scoring and final bonuses remain. XP is derived from events, so existing saved totals also reflect the new policy without rewriting answer history. Negative totals are permitted.

Signed formatting also covers pair feedback, lightning feedback/completion, lesson completion, help text and posted summaries. Negative XP never displays a doubled plus/minus prefix.

Evidence: direct-actions-initial-dark.jpg, direct-actions-wrong-dark.jpg, direct-actions-correct-dark.jpg, direct-actions-mobile-dark.jpg and direct-actions-mobile-light.jpg under docs/ui-refresh-preview. Live isolated preview demonstrated header 7 → 4 on a wrong answer and 4 → 6 on a corrected repair. Regular correct feedback demonstrated +10 in the answer row and header 16.

137/137 full tests passed in 65.09 seconds. New regressions cover negative signed session/today/week totals, replaying a penalty once, wrong practice/lightning after caps, wrong repairs, visible desktop actions, mobile wrapping at 320px, focusable inline verdict, reduced motion, and negative completion summaries in both themes. Final CSS cleanup is checked by the targeted UI regressions.

## Compact actions inside the question area

The owner's correction supersedes the separate right-hand rail above. The question returns to one centered 640px column. Secondary actions sit at the top-right inside the question metadata row, using compact 32px desktop buttons. On mobile they wrap within that header, with 44px targets for coarse pointers. Main footer actions and inline signed feedback retain their behavior. The regression now asserts that actions fit inside the question width and sit above the stem/options at desktop and 320px widths.
