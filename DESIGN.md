---
name: "Lý Thuyết Lái Xe · Monochrome Play"
description: "Black-and-white, game-like learning card for ChatGPT. Supersedes direction B (Đường học) per PRD v1.0."
colors:
  background: "#FFFFFF"
  surface: "#FFFFFF"
  ink: "#000000"
  on-ink: "#FFFFFF"
  muted: "#5C5C5C"
  line: "#E5E5E5"
  option-line: "#8A8A8A"
  subtle: "#F4F4F4"
  dark-background: "#000000"
  dark-surface: "#000000"
  dark-ink: "#FFFFFF"
  dark-on-ink: "#000000"
  dark-muted: "#A3A3A3"
  dark-line: "#2E2E2E"
  dark-option-line: "#6B6B6B"
  dark-subtle: "#1A1A1A"
typography:
  hero-number:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "40px"
    fontWeight: 700
    lineHeight: 1.1
    letterSpacing: "-.02em"
  headline:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.35
  question:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "17px"
    fontWeight: 600
    lineHeight: 1.55
  option:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "16px"
    fontWeight: 500
    lineHeight: 1.5
  body:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.6
  label:
    fontFamily: "system-ui, -apple-system, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
    fontSize: "13px"
    fontWeight: 500
    lineHeight: 1.5
rounded:
  progress: "999px"
  option: "12px"
  panel: "12px"
  card: "16px"
  button: "999px"
spacing:
  step-4: "4px"
  step-8: "8px"
  step-12: "12px"
  step-16: "16px"
  step-24: "24px"
  step-32: "32px"
motion:
  verdict: "400ms"
  xp-float: "600ms"
  ring-segment: "300ms"
  press: "100ms"
  easing: "cubic-bezier(.2,.8,.2,1)"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
    rounded: "{rounded.button}"
    padding: "14px 24px"
    width: "100%"
  button-secondary:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.button}"
    padding: "10px 16px"
  answer-option:
    backgroundColor: "{colors.surface}"
    textColor: "{colors.ink}"
    rounded: "{rounded.option}"
    padding: "16px 18px"
  answer-option-correct:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.on-ink}"
  progress-bar:
    backgroundColor: "{colors.subtle}"
    rounded: "{rounded.progress}"
    height: "8px"
  lesson-card:
    backgroundColor: "{colors.surface}"
    rounded: "{rounded.card}"
---

# Design System: Lý Thuyết Lái Xe · Monochrome Play

## Overview

**Creative North Star: "Black, white, alive."**

The card looks as quiet as ChatGPT and feels as lively as Duolingo. Colour is removed entirely. Energy comes from motion, big bold numbers, inversion (black ↔ white) and short celebration moments. Original question images are the only imagery that carries meaning.

This document is the target design for PRD v1.0 (`docs/product-requirements.md`, section 9). It supersedes direction B (Đường học). The prototype in `design/chatgpt-learning/` and the widget in `src/ui/learning.html` still implement direction B until they are rebuilt. Host compatibility, especially the dark surface colour, needs to be checked in real ChatGPT.

**Key characteristics:**

- Pure black and white in both themes. Greys only for secondary text, lines and tracks.
- One living lesson card with a progress bar, one question, large options and one primary button.
- Verdicts are felt through motion, an icon and words.
- Big numbers for XP, goal ring and progress.

## Colors

There are two themes with the same roles. The theme follows the ChatGPT host theme automatically. There is no in-card toggle.

| Role | Light | Dark | Use |
| --- | --- | --- | --- |
| background | `#FFFFFF` | `#000000` | Card ground |
| surface | `#FFFFFF` | `#000000` | Options, panels. In dark mode, match the host surface if ChatGPT's is not pure black. |
| ink | `#000000` | `#FFFFFF` | Text, icons, primary button fill, correct-option fill, ring fill |
| on-ink | `#FFFFFF` | `#000000` | Text on ink fills |
| muted | `#5C5C5C` | `#A3A3A3` | Metadata, captions, secondary actions |
| line | `#E5E5E5` | `#2E2E2E` | Dividers and decorative separators only |
| option-line | `#8A8A8A` | `#6B6B6B` | Borders of answer options, tiles and inputs (≥ 3:1 against the surface, WCAG 1.4.11) |
| subtle | `#F4F4F4` | `#1A1A1A` | Hover, pressed, empty progress track |

**The No-Colour Rule.** No hue appears anywhere in the UI chrome. Feedback, selection and status use fill, outline weight, icons, motion and words. Question images keep their original colours.

## Typography

**Font:** the system UI stack, to match ChatGPT. It must render all Vietnamese diacritics. Be Vietnam Pro is retired.

| Role | Size | Weight | Use |
| --- | --- | --- | --- |
| Hero number | 40 px (32 px under 400 px width) | 700 | XP earned, score, goal count on finish and home screens |
| Headline | 22 px | 700 | Verdict ("Chính xác!", "Chưa đúng"), lesson intro title |
| Question | 17 px | 600 | Question text |
| Option | 16 px | 500 | Answer options |
| Body | 15 px | 400 | Explanation, coach copy |
| Label | 13 px | 500 | Progress labels, metadata, chips |

Numbers use tabular figures. Explanation lines stop at 68ch.

## Layout

- The card fills the available host width. Its content column is at most 640 px wide, with 20 px padding (16 px under 400 px).
- Card structure, top to bottom: a close/pause icon and progress bar row, the step label ("Ôn lại", "Mới", "Thử lại"), question and image, options, then a sticky bottom action area.
- The bottom action area holds one full-width primary button. After a verdict it expands upward into the feedback sheet: icon, verdict, a one-line reason, "Xem thêm", the primary "Tiếp tục" button, and one quiet row of secondary actions.
- Options stack vertically at every width. Image questions show the image above the options at full column width.
- Home card: goal ring at the left or top, the three progress numbers, weekly XP and league rank, and one "Học tiếp" button. Course map: a two-column grid of category tiles (one column under 400 px).

## Elevation & Depth

Flat. No shadows. Depth comes from inversion (a black fill on white), 1 px lines and the feedback sheet sliding up over the action area.

## Shapes

- Options and panels have a 12 px radius, and the card has a 16 px radius.
- Buttons and progress bars are fully rounded.
- Minimum tap target is 48 px.
- Icons have a 2 px stroke, are 24 px in the card and 40 px in verdicts. Correct is a filled circle with a check, and wrong is an outlined circle with a ✕.

## Motion

Motion carries the feeling that colour used to. Every animation has a reduced-motion alternative: a 150 ms opacity fade.

| Moment | Animation | Duration |
| --- | --- | --- |
| Option press | Scale to .98 | 100 ms |
| Correct verdict | Option inverts to ink; check icon draws in; card does a 4 px vertical bounce | 400 ms |
| Wrong verdict | Selected option shakes ±6 px horizontally three times; correct option gets a 2 px ink outline | 400 ms |
| XP float | "+10 XP" rises 24 px and fades out | 600 ms |
| Combo | From 3 correct in a row, the counter scales from .8 to 1 | 250 ms |
| Progress bar | Width eases to the new step | 300 ms |
| Goal ring | Each new segment fills clockwise | 300 ms per segment |
| Finish screen | XP, correct count and Mastered count count up one after another | 800 ms total |
| Mastered | "Đã thuộc!" label pops in (scale .9 → 1) on the step | 250 ms |

Easing is `cubic-bezier(.2,.8,.2,1)`. Nothing loops, flashes or plays sound.

## Components

### Buttons

- **Primary:** an ink pill with on-ink text, full width in the action area, 600 weight. It is disabled until an option is selected ("Kiểm tra"). Exactly one per screen.
- **Secondary:** transparent text buttons in muted ink, used in the quiet row ("Hỏi ChatGPT", "Tôi còn phân vân", "Xem video").
- Focus is a visible 2 px ink ring with a 2 px offset.

### Answer options

- Default: a 1 px option-line border, surface fill, and a letter badge (A–D) in a 24 px outlined circle.
- Selected: a 2 px ink border, with the letter badge filled in ink.
- Correct (after verdict): ink fill, on-ink text, and a check icon at the end.
- Wrong selected (after verdict): a dashed 2 px ink border and an ✕ icon at the end.
- Correct but not chosen (after a wrong verdict): a 2 px ink border with the label "Đáp án đúng".
- Options lock after the verdict.

### Feedback sheet

An icon, the headline verdict, a reason of at most two lines (approved text), "Xem thêm" to expand, the primary "Tiếp tục" button, and the quiet secondary row. A screen reader announces the verdict through a live region.

### Progress bar and step labels

An 8 px rounded track in the subtle colour with an ink fill. The step label sits above the question as a small outlined chip: "Ôn lại", "Mới", "Thử lại" or "Thử thách".

### Goal ring

A 96 px ring (64 px on the home card in compact layouts). Segments fill in ink. The centre shows "7/12" and a small check once due reviews are done. A closed ring triggers a one-time scale-and-check celebration.

### Progress numbers

The three labels Đã gặp, Đã thuộc and Cần ôn hôm nay always appear together, in this order, as hero numbers with labels. Overlapping detail counts are never shown as if they add up.

### League row

Rank, display name and weekly XP. The learner's own row is inverted (ink fill). There are no avatars, colours or accuracy figures.

### Mock test

A timer chip, a question navigator grid (6 columns on mobile, 10 on desktop), and Previous/Next buttons. No verdict motion or XP during the test. The result screen counts the score up, then shows "Đạt" or "Chưa đạt" with the reason in words.

## Do's and Don'ts

### Do:

- **Do** keep exactly one primary action per screen.
- **Do** let the card show every verdict instantly. ChatGPT never repeats it.
- **Do** use the three progress labels consistently in the card and in ChatGPT.
- **Do** celebrate finished lessons, closed rings and newly Mastered questions.
- **Do** preserve original question images and their proportions, with zoom.
- **Do** meet WCAG 2.2 AA contrast, 48 px targets and visible focus in both themes.

### Don't:

- **Don't** use any hue: no green for correct, no red for wrong, no blue for actions.
- **Don't** add lives, streak-loss warnings or shaming copy.
- **Don't** use emoji, mascots or decorative illustrations in the chrome.
- **Don't** add shadows, gradients or looping animation.
- **Don't** imply a question is learned from a single correct answer.
- **Don't** open a new card per question.

Source scope: `docs/product-requirements.md` v1.0 sections 2–10 and `PRODUCT.md`. Direction-B documents (`docs/ui-ux-direction-b-*.md`) are historical.
