---
name: "Lý Thuyết Lái Xe · Colorful learning"
description: "Playful driving-theory card inspired by Brilliant and Duolingo. Owner requested color, graphics and purposeful micro-interactions on 7 October 2026."
---

# Colorful learning

The learning card is a focused, friendly place to study. Vietnamese Nunito text and JetBrains Mono numbers retain the existing typography. Rounded controls, short press feedback and a compact original driving illustration add personality without interrupting questions.

## Palette

| Role | Light | Dark |
| --- | --- | --- |
| Canvas | `#fcfaff` | `#151515` |
| Text | `#302a3b` | `#f3f3f3` |
| Secondary text | `#696174` | `#b7b7b7` |
| Primary action | `#8650dd` | `#8650dd` |
| Action text | `#ffffff` | `#ffffff` |
| Selection ink | `#7440c4` | `#caa4ff` |
| Progress and graphics | `#8650dd` | `#a065ff` |
| Information | `#176d96` | `#a2dcf5` |
| Correct | `#226c42` | `#b4e793` |
| Mistake | `#a53c32` | `#ffb5a4` |
| XP and review | `#80511b` | `#f5d082` |
| Secondary activity | `#7653a3` | `#d6b9f6` |

Semantic colors are defined together in the embedded stylesheet. Purple is the shared brand accent across onboarding, dashboard, course path, lesson controls, answer selection, mock tests and ranking. Action fill, readable accent text and bright decorative purple are separate tokens; white on the action fill has 4.99:1 contrast. The dark canvas remains neutral charcoal. Green identifies correct answers and mastery, coral mistakes, and gold XP and due reviews. Feedback keeps words and icons as well as color. The course browser follows Brilliant's winding raised coins, floating current marker, quiet future nodes and bottom action dock. Its path has a 400px internal scroll region with preserved scroll position; every topic remains selectable. A compact coverage bar and two supporting metrics replace the course stats grid.

## Graphics

`src/ui/assets/learning-journey.webp` is an original generated illustration of a friendly car, greenery and a directional sign. It appears only on goal selection and the course overview. It is decorative and has an empty alternative description. It is not an exam diagram. Original question images retain their proportions, content and zoom interaction. Phosphor Duotone icons share a 256px viewBox and consistent secondary-layer opacity. The bundled MIT notice is in `src/ui/assets/phosphor-LICENSE.txt`.

## Motion

Press feedback lasts 140ms. Correctness and the signed XP change appear inside the selected answer row with a 220ms settle and a brief confined confetti burst on success. Accumulated lesson XP stays at the header's right edge before and after answers. Wrong answers show -3 XP with a plain cross on the coral key. The unanswered question has one bottom Check. Correct feedback puts Why on the left and Continue on the right; wrong feedback puts explanation on the left and amber Try again on the right. Guess, Skip and feedback helpers are directly visible as compact buttons in the top-right corner of the question area, wrapping within its header on mobile. No dropdown or duplicate bottom verdict remains. Explanation and the correct-answer reveal open on demand. Animations do not block input; reduced motion removes celebratory movement.

Pointer hover is gated to fine pointers. Keyboard-initiated actions suppress animation and movement. Reduced motion disables animations and transitions, while retaining clear static feedback. Count-ups finish within about 250ms and are skipped for keyboard and reduced motion.

## Integration

The shared `learning.html` serves both the ChatGPT widget and the local preview. Backend lesson, course, award and mock data remain authoritative. Immediate retry preserves the original evidence and survives resume, with assisted credit without mastery. Every wrong study answer deducts 3 XP, including assisted, guessed, repair, practice and lightning answers. Negative deltas do not refund reward caps. XP is derived from saved evidence, so existing totals also reflect this rule; no answer history is rewritten. Mock final scoring and review intervals remain. Individual radios are disabled after grading, leaving the inline verdict focusable. The asset route permits flat WebP filenames and returns their image MIME type; existing path restrictions remain.

The family picker keeps its compact spacing and internal scroll region. Onboarding and course screens have more breathing room. Layouts adapt to narrow cards. Light and dark palettes follow the host theme.

## References

[Duolingo imagery](https://design.duolingo.com/identity/imagery) informs playful geometric illustration and rounded forms. [Brilliant courses](https://brilliant.org/courses/) informs the focus on learning content and clear activity hierarchy. Neither brand's assets or mascots are copied.

## Signed-in Brilliant comparison

The home screen uses a progress sidebar beside a larger illustrated course card above 700px. Narrow cards stack the course action before progress. Questions use a centered 560px column, outlined answer rows and pill actions. Feedback preserves the prompt and choices, places the verdict beside Continue on desktop and stacks them on mobile, then shows the approved explanation. Info popovers sit outside their number grid so they do not cover other info buttons.

Brilliant reference screenshots contain account details, so they are not kept in the repository; our matched captures are in `docs/ui-refresh-preview/`, made with `docs/ui-refresh-preview/capture-states.ts`. The latest course screenshot follows the owner's subsequent request to adopt Brilliant's winding path. Earlier pairs predate the app-wide purple palette; current purple captures are saved separately in `docs/ui-refresh-preview/purple-*`. Reference screenshots demonstrate structural similarity, not pixel identity or identical motion curves. Course-marker entry lasts 240ms, coin hover and press last 140ms, and keyboard or reduced motion suppress movement.
