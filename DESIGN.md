---
name: "Lý Thuyết Lái Xe · Game-like monochrome"
description: "Black-and-white, pressable, game-like learning card for ChatGPT. Owner-selected original style, 6 October 2026. Supersedes direction B and the flat Monochrome Play draft."
colors:
  bg: "#ffffff"
  fg: "#000000"
  mute: "#5d5d5d"
  line: "#e2e2e2"
  soft: "#f4f4f4"
  soft2: "#ebebeb"
  dark-bg: "#000000"
  dark-fg: "#ffffff"
  dark-mute: "#a8a8a8"
  dark-line: "#2b2b2b"
  dark-soft: "#121212"
  dark-soft2: "#1f1f1f"
typography:
  text:
    fontFamily: "'Be Vietnam Pro', system-ui, sans-serif"
    weights: [400, 600, 700, 800]
  mono:
    fontFamily: "'JetBrains Mono', ui-monospace, monospace"
    weights: [700]
  question:
    fontSize: "18px"
    fontWeight: 700
    lineHeight: 1.4
  option:
    fontSize: "15px"
    fontWeight: 600
    lineHeight: 1.35
  headline:
    fontSize: "21-24px"
    fontWeight: 800
  hero-number:
    fontFamily: mono
    fontSize: "26-64px"
    fontWeight: 700
  chip:
    fontSize: "11px"
    fontWeight: 800
    textTransform: uppercase
rounded:
  card: "22px"
  panel: "18px"
  tile: "16px"
  tile-in-panel: "14px"
  small-tile: "12px"
  letter-box: "10px"
  segment: "5px"
  chip: "999px"
spacing:
  card-padding: "14px 16px 16px"
  gap-tight: "6px"
  gap: "10px"
  gap-section: "14px"
motion:
  pop: "scale .4 → 1.15 → 1, 450-500ms, cubic-bezier(.2,.9,.3,1.25)"
  rise: "translateY 14px → 0 + fade, 300ms ease-out"
  shake: "±7px, 420ms"
  bounce: "4-5px up, 400ms"
  spark: "shapes fly outward, 700-900ms"
  xp-float: "26px up + fade, 700ms"
  stamp: "scale 1.6 → 1, -3deg tilt"
  press: "translateY 3px, edge 4px → 1px, 80ms"
  reduced: "150ms fade or none"
components:
  pressable-primary:
    background: "{colors.fg}"
    text: "{colors.bg}"
    border: "2px {colors.fg}"
    edge: "0 4px 0 {colors.mute}"
    rounded: "{rounded.tile}"
    height: "52-54px"
  pressable-idle:
    background: "{colors.bg}"
    border: "2px {colors.line}"
    edge: "0 4px 0 {colors.line}"
  pressable-selected:
    background: "{colors.soft}"
    border: "2px {colors.fg}"
    edge: "0 4px 0 {colors.fg}"
  pressable-disabled:
    background: "{colors.soft2}"
    text: "{colors.mute}"
    edge: none
  letter-box:
    size: "32px"
    rounded: "{rounded.letter-box}"
    font: mono 14px 700
  progress-segment:
    height: "10px"
    rounded: "{rounded.segment}"
---

# Design System: Lý Thuyết Lái Xe · Game-like monochrome

## Overview

**Creative North Star: "A black-and-white game you can press."**

The card is as quiet as ChatGPT in colour and as tactile as Duolingo in feel. There is no hue. Energy comes from pressable tiles with a solid bottom edge, inversion (black ↔ white), diagonal stripes for mistakes, monospace numbers, and short pops, shakes and sparks. Original question images keep their own colours and are the only meaningful imagery.

The owner chose this style on 6 October 2026, over the flat "Monochrome Play" draft. The reference screens are in `ui design/screens/*.dc.html`, and the handoff notes are in `ui design/README.md`. Those files are a visual reference with sample data and fake logic. The widget is `src/ui/learning.html`.

**Key characteristics:**

- Strict black and white in both themes. The theme follows the ChatGPT host, and there is no in-card toggle.
- Pressable tiles and buttons: a 2 px border plus a solid bottom edge that collapses on press.
- One primary action per screen.
- Be Vietnam Pro for words. JetBrains Mono for numbers, timers, answer letters and question numbers.
- Every verdict is shown through shape, icon, motion and words, never colour.

## Colors

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--bg` | `#ffffff` | `#000000` | Card and screen ground |
| `--fg` | `#000000` | `#ffffff` | Text, icons, primary fills, correct-option fill, selected borders |
| `--mute` | `#5d5d5d` | `#a8a8a8` | Secondary text; the bottom edge of filled buttons |
| `--line` | `#e2e2e2` | `#2b2b2b` | Idle borders, the bottom edge of idle tiles, dividers |
| `--soft` | `#f4f4f4` | `#121212` | Inset panels, selected tile fill, chat composer |
| `--soft2` | `#ebebeb` | `#1f1f1f` | Empty progress segments, disabled buttons |

**The No-Hue Rule.** No hue appears in the UI chrome. Question images keep their original colours.

**Contrast.** Text, icons and every state indicator meet WCAG 2.2 AA in both themes:

- Text and icons are `--fg` or `--mute` on `--bg`, which is at least 4.5:1.
- Selected, correct and wrong states change to a `--fg` border or fill, which is at least 3:1 against both the background and the idle state.

Idle tiles use the light `--line` border on purpose. The tile's own text and letter box identify it as a control, and WCAG 1.4.11 does not require a high-contrast boundary for a control its text already identifies. Never make `--line` the only signal of a state.

**Host surface.** Check `--bg` against ChatGPT's real light and dark backgrounds. If they differ, match the host so the card does not look like a box on a box (ui-ux-design §8.5).

## Typography

- **Text:** Be Vietnam Pro, weights 400, 600, 700 and 800. Full Vietnamese diacritics.
- **Numbers:** JetBrains Mono 700 for counts, XP, timers, answer letters and "Câu 145".
- Both fonts are bundled in `src/ui/assets`. Each mixes latin and vietnamese subsets, so every `@font-face` must declare its `unicode-range`. The widget's resource policy forbids external font hosts.

| Role | Size / weight | Use |
| --- | --- | --- |
| Question | 18 px / 700, line height 1.4 | Question stem |
| Option | 15 px / 600 | Answer text |
| Headline | 21–24 px / 800 | Screen titles, verdict ("Chính xác!" 19 px / 800 in the feedback panel) |
| Hero number | 26–64 px mono / 700 | Ring centre, finish counts, test score |
| Body | 14–15 px / 400–600 | Explanations, coach copy |
| Chip | 11 px / 800, uppercase | Step chips (ÔN LẠI, MỚI), status tags |
| Small | 12–13 px / 600–700 | Metadata, secondary text buttons |

## Layout

- The card fills the host width up to a 640 px content column. It has a 1 px `--line` border, a 22 px radius, and `14px 16px 16px` padding. Sections inside are separated by 14 px.
- Lesson card order, top to bottom: a pause ✕ with the segmented progress bar and a mono "5/10", the chips row, the question, an optional image, options, then the action area.
- The action area holds the "Tôi đoán" chip, "Bỏ qua" and the full-width "Kiểm tra". After a verdict, the feedback panel replaces it, and a three-tile helper row follows ("Hỏi ChatGPT", "Tôi còn phân vân", "Video").
- Options stack vertically at every width in lessons.
- Minimum tap target is 44 px. Primary buttons are 52–54 px high.

## Elevation & Depth

Depth is tactile, not ambient. Pressable elements carry a solid bottom edge (`box-shadow: 0 4px 0 <edge>`, or 3 px for small tiles). There are no blurred shadows inside the card. The edge colour follows the pressable state table below. On press the element moves down 3 px and the edge shrinks to 1 px.

## Shapes

- Card 22 px. Feedback panel 18 px. Tiles and primary buttons 16 px, or 14 px inside a panel. Small helper tiles 12 px. Letter box 32 × 32 px with a 10 px radius. Chips are full pills.
- Progress is a row of 10 px-high segments, one per step, separated by 3 px gaps:
  - done is filled with `--fg`
  - wrong has diagonal stripes and a `--fg` border
  - current is outlined with `--fg`
  - skipped has a dashed border
  - upcoming is `--soft2`
- Icons are 2–3.4 px stroke SVG. A check means correct and an ✕ means wrong. A bolt marks a combo.

## Motion

| Name | Animation | Used for |
| --- | --- | --- |
| pop | scale .4 → 1.15 → 1, ~500 ms | Check in the letter box, chips appearing, the "Đã thuộc!" chip, the verdict icon |
| rise | 14 px up + fade, 300 ms | Feedback panel, chat bubbles, new sections |
| shake | ±7 px, 420 ms | Wrong chosen option, the wrong icon |
| bounce | 5 px up, 400 ms | Correct option after an independent correct answer |
| spark | four small shapes fly outward, 700 ms | Correct verdict icon |
| xp-float | 26 px up + fade, 700 ms | "+XP" pill, only when the server returns XP |
| count-up | numbers tick up in sequence | Finish and Result screens |
| stamp | scale 1.6 → 1 with −3° tilt | ĐẠT / CHƯA ĐẠT on Result |
| press | 3 px down, edge 4 → 1 px, 80 ms | Every pressable element |

Under `prefers-reduced-motion`, pop, rise, shake and bounce become a 150 ms fade. Sparks and XP floats are hidden. Nothing loops, strobes or plays sound.

## Components

### Pressable states

| State | Fill | Text | Border | Edge |
| --- | --- | --- | --- | --- |
| Primary | `--fg` | `--bg` | 2 px `--fg` | `--mute` |
| Idle tile | `--bg` | `--fg` | 2 px `--line` | `--line` |
| Selected tile | `--soft` | `--fg` | 2 px `--fg` | `--fg`, and the letter box filled with `--fg` |
| Disabled | `--soft2` | `--mute` | 2 px `--soft2` | none |

### Answer options and verdicts

| State | Treatment |
| --- | --- |
| Correct | The option inverts (`--fg` fill, `--bg` text). A check pops into the letter box, and the option bounces. The feedback panel is inverted, with a 4-spark burst on the icon. |
| Wrong (chosen) | `--fg` border. The letter box is filled with diagonal stripes and carries an ✕ in a small circle. A "Bạn chọn" tag is added, and the option shakes. The panel has a striped top edge and an outlined, shaking ✕. |
| Correct option after a wrong answer | Inverted, labelled "Đáp án đúng" |
| Other options after a verdict | 40% opacity, locked |
| Correct after help | Bordered (not inverted) panel, outlined check, no sparks, "Đúng (có hỗ trợ)" |
| Guessed correct | As correct; headline "Đúng — lần sau thử không đoán nhé" |
| Newly Mastered | The "Đã thuộc!" chip pops in. Shown only when the server reports it. |
| Combo ≥ 3 | Bolt with "Combo N câu liên tiếp". An in-lesson display of consecutive correct answers in this session, not a streak. |
| Request not delivered | A dashed row "Chưa gửi được — thử lại" with "Thử lại". No verdict is shown, because the server has not scored anything (PRD PLAY-07). |
| Skipped | Dashed panel "Đã bỏ qua · vẫn cần ôn" with "Tiếp tục" |

Every verdict goes to an `aria-live` region. Options are native radio inputs inside styled labels, so arrow keys and screen readers work without extra code.

### Chips

- Step chip: filled `--fg` pill, 11 px / 800 uppercase (ÔN LẠI, MỚI, THỬ LẠI, THỬ THÁCH).
- Question number chip: outlined with a 1.5 px `--line` border, mono ("Câu 145").
- "Đang phân vân": dashed `--fg` border, pops in.

### Goal ring

A ring of segments, one per new question in today's goal. Filled segments fade in one by one. The centre shows the mono count ("7/12"), and a small check appears once today's due reviews are done.

### Progress numbers

The three labels Đã gặp, Đã thuộc and Cần ôn hôm nay always appear together in this order, as mono hero numbers with labels underneath. Overlapping detail counts are never shown as if they add up.

When the server reports questions with one qualifying answer (`onTheWay`), the Đã thuộc tile adds a small `--mute` line under its label, "+13 đang chờ ôn lại", with the number in mono. The main number never includes them.

### Info popover

A learner who wonders why a number or rule is what it is taps the ⓘ beside it.

- The ⓘ is a 20 px circle-i icon with a 2 px stroke and a 32 px target. It sits after the label it explains, or in the top-right corner of a progress tile. It is never inside an answer option or on a primary button, and never inside a `<label>` or another button.
- One popover serves every ⓘ, and only one is open at a time. It is a `--bg` panel with a 2 px `--fg` border, a 16 px radius and a solid 4 px `--fg` bottom edge. It has a bold 14 px title, 14 px body text and a small pointer at its button.
- It opens below its button, above when only that fits, and otherwise below with the card grown to hold it. It never leaves the card. It is at most 320 px wide and spans the card on narrow screens.
- It opens with `rise` and closes on a second tap, Esc, a tap outside or a new screen. A keyboard open moves focus to its title; Esc and Tab return focus to the button.
- The copy is short Vietnamese that matches the server's rules. Live values, such as the next review time, come from the server's view.

### Mock test

Fullscreen if the host allows. The test has:

- a mono timer chip, "Câu X/30" and the answered count
- an expandable navigator of 6 columns on mobile and 10 on desktop, whose cells show current, answered and unanswered without correctness
- "Câu trước" and "Lưu và tiếp theo"

There is no verdict motion, XP or help during the test. The Result screen has a count-up score, a stamped "ĐẠT" or "CHƯA ĐẠT", a 30-tick score bar, the reason in words, and wrong items grouped by category.

## Do's and Don'ts

### Do:

- **Do** keep exactly one primary action per screen.
- **Do** let the card show every verdict instantly, from the server's result. ChatGPT never repeats it.
- **Do** use the same three progress labels in the card and in ChatGPT.
- **Do** show XP, combos, mastery and league data only when the server provides them.
- **Do** preserve original question images and their proportions, with zoom.
- **Do** keep native form semantics (radio inputs, buttons) behind the pressable styling.

### Don't:

- **Don't** use any hue: no green for correct, no red for wrong, no blue for actions.
- **Don't** compute XP, verdicts or mastery in the card.
- **Don't** show a verdict for an answer the server has not scored.
- **Don't** add lives, streak-loss warnings or shaming copy.
- **Don't** use emoji, mascots or decorative illustrations in the chrome.
- **Don't** use blurred drop shadows or looping animation.
- **Don't** open a new card per question.

Source scope: `ui design/README.md`, `ui design/screens/*.dc.html`, `docs/product-requirements.md` v1.0 and `docs/ui-ux-design.md`. Direction-B documents are historical.
