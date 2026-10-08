# Learning experience refresh

The purple learning card now separates the course feature, daily goal and progress instead of packing progress into the dashboard sidebar. Desktop progress has four columns; mobile has two. The original road-and-checkmark vector in `src/ui/assets/learning-logo.svg` replaces LX. It is embedded in the card so the mark needs no extra request.

A finished lesson has two presentation states keyed by its session ID. Celebration shows an original illustrated trophy with a 30-piece confetti celebration, XP, accuracy and newly mastered or first-correct questions. Continue opens the goal, rank, review timing and next actions. This transition makes no server call and cannot grant another reward. Closing/reopening the card starts on celebration again.

The course orbit keeps a fixed ellipse centered on the platform. A darker arc travels around it through `stroke-dashoffset`, avoiding the wobble caused by rotating a flattened ellipse. This follows the observed live Brilliant course and supplied reference image. DOM inspection of Brilliant's keyframes timed out, so the implementation uses original SVG and CSS rather than copied source. Marker, orbit and celebration movement stop with reduced motion; decorative movement also stops during keyboard interaction.

## Loading and latency

The missing loading feedback was a confirmed UI bug. `call()` previously disabled controls and announced only to screen readers. It now shows a shared visible status and a loading label inside Check and Continue while preserving backend grading, saved results and stable request IDs for retries.

The exact cause of the multi-second production ChatGPT delay remains unverified. Local measurements rule out multi-second grading in the tested workloads, but do not measure production Neon, authentication, cold starts or the host bridge.

Run `node --import tsx scripts/measure-learning-latency.mts`. The benchmark uses an isolated in-memory store and never changes learner history. One run gave:

| Prior attempts | Submit | Advance |
| --- | --- | --- |
| 0 | 5.86 ms | 7.59 ms |
| 100 | 14.80 ms | 17.67 ms |
| 500 | 64.59 ms | 58.04 ms |

Every successful learning-tool response includes `_meta.timing.toolMs`. The card records a `learning-tool` Performance measure with the tool name, total round-trip duration and server duration. In the card's browser context, inspect:

```js
performance.getEntriesByName('learning-tool').map(entry => ({
  tool: entry.detail.name,
  roundTripMs: Math.round(entry.duration),
  serverMs: entry.detail.toolMs,
}))
```

A large server duration requires profiling the deployed runtime/store. A small server duration with a large round trip requires tracing authentication, transport and the ChatGPT host. The difference is not proof that ChatGPT alone caused the delay. No direct widget-to-database path or optimistic scoring was added.

## Verification

`tests/learning-refresh.test.ts` holds answer and navigation responses until released, checks visible loading and disabled actions, verifies the two-view transition makes no tool call, checks orbit centering and reduced motion, and checks mobile overflow. `CAPTURE_UI=1 node --import tsx --test tests/learning-refresh.test.ts` refreshes screenshots in `docs/ui-refresh-preview/`.

The existing tests retain scoring, retry, help, reminder, league and mock contracts. Their completion and progress-layout assertions now follow the new presentation. Production ChatGPT performance still needs a fresh trace after this change is deployed.

Final local validation passed all 142 tests, typecheck, lint, build and `git diff --check`. Screenshot inspection covered desktop dark, mobile light/dark, the orbit, pending answers, celebration and next steps. No production deployment or ChatGPT-host latency trace was performed.

The dashboard now stacks a daily study streak below the goal. One saved answer counts as a study day, including assisted answers and mistakes. Days are deduplicated in the learner timezone. A streak last active yesterday stays available until the end of today; a missed calendar day resets the count. The last seven calendar days appear beneath it. This is derived from history without a state migration, XP penalty or client-owned progress.

Dashboard progress uses four consistent Phosphor graphics on colored tiles, inline count/denominator pairs and a single quiet surface style. Completion artwork has a 900 ms trophy entrance, a 2.6 second finite confetti burst and finite sparkle animations. Flying particles are suppressed for keyboard and reduced-motion users. The motion does not delay Continue or add scoring calls.
