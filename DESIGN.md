---
name: "Lý Thuyết Lái Xe · Đường học"
description: "Accepted direction B for the isolated Vietnamese learning prototype."
colors:
  ink: "#182b49"
  muted: "#57657a"
  accent: "#294fad"
  tint: "#e9eef9"
  paper: "#fff"
  line: "#dee4ee"
  warm: "#edf2fc"
  canvas: "#f2f3f6"
  accent-hover: "#1f3e8c"
  focus: "#577be0"
  hover-line: "#a8b7d4"
  option-hover: "#f7f9fc"
  teaching-ink: "#234789"
  teaching-line: "#cdd8ed"
  success-bg: "#e8f1e9"
  success-ink: "#265632"
  wrong-bg: "#fff0e8"
  wrong-ink: "#854222"
  uncertain-bg: "#fff4d9"
  uncertain-ink: "#785813"
typography:
  display:
    fontFamily: "Be, sans-serif"
    fontSize: "29px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "-.025em"
  headline:
    fontFamily: "Be, sans-serif"
    fontSize: "22px"
    fontWeight: 700
    lineHeight: 1.5
    letterSpacing: "-.02em"
  title:
    fontFamily: "Be, sans-serif"
    fontSize: "17px"
    fontWeight: 700
    lineHeight: 1.65
  body:
    fontFamily: "Be, sans-serif"
    fontSize: "15px"
    fontWeight: 400
    lineHeight: 1.65
  label:
    fontFamily: "Be, sans-serif"
    fontSize: "13px"
    fontWeight: 400
    lineHeight: 1.65
  small:
    fontFamily: "Be, sans-serif"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: 1.6
rounded:
  flat: "0"
  progress: "4px"
  tag: "5px"
  timer: "6px"
  control: "7px"
  option: "8px"
  panel: "12px"
  widget: "16px"
spacing:
  step-8: "8px"
  step-12: "12px"
  step-16: "16px"
  step-20: "20px"
  step-22: "22px"
  step-24: "24px"
  step-26: "26px"
  step-36: "36px"
components:
  button-primary:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.paper}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  button-primary-hover:
    backgroundColor: "{colors.accent-hover}"
    textColor: "{colors.paper}"
  button-secondary:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "10px 16px"
  field:
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "12px 14px"
    width: "100%"
  nav-active:
    backgroundColor: "{colors.tint}"
    textColor: "{colors.accent}"
  tag:
    backgroundColor: "{colors.tint}"
    textColor: "{colors.accent}"
    rounded: "{rounded.tag}"
    padding: "5px 9px"
  learning-card:
    backgroundColor: "{colors.paper}"
    rounded: "{rounded.widget}"
  teaching-panel:
    backgroundColor: "{colors.warm}"
    rounded: "{rounded.panel}"
    padding: "26px"
  answer-option:
    rounded: "{rounded.option}"
    padding: "18px 20px"
  course-row:
    rounded: "{rounded.flat}"
    padding: "20px 8px"
    width: "100%"
---

# Design System: Lý Thuyết Lái Xe · Đường học

## Overview

**Creative North Star: "Đường học"**

Đường học makes learning feel ordered, readable and calm. Navy text, blue actions, white surfaces and Be Vietnam Pro establish a clear Vietnamese course interface. Alignment and quiet tonal areas carry the visual identity; original question illustrations provide the meaningful imagery.

This document captures the owner-selected direction B implemented in `design/chatgpt-learning/`. Its rules govern this isolated prototype and future screens extending that accepted direction. They do not certify production identity, persistence, ChatGPT integration, source approval or host compatibility. The conversation framing and sample-history disclosure belong to the local review shell.

**Key Characteristics:**

- Readable Vietnamese type with a compact hierarchy.
- Aligned course rows and restrained top navigation.
- Quiet blue areas for explanation and next actions.
- Visible control states with minimal motion.

## Colors

The palette is cool, restrained and built around navy reading text and confident blue actions. The frontmatter preserves source colour values; CSS custom properties remain the implementation source. Additional semantic state colours are extracted from repeated feedback and control rules.

### Primary

- **Action Blue** (`accent`): main actions, links, progress fills and selected controls.
- **Deep Action Blue** (`accent-hover`): primary hover state.
- **Quiet Blue** (`tint`): active navigation, tags and selected answers.
- **Teaching Blue** (`warm`): daily continuation, explanation and comparison panels. The source calls this token “warm”; its actual colour is a pale cool blue.
- **Teaching Ink / Teaching Divider**: panel headings and internal comparisons.
- **Focus Blue / Hover Border**: keyboard focus and control hover definition.

### Secondary

- **Success Green**: feedback fill and text for a correct response; it does not declare delayed mastery.
- **Correction Orange**: feedback fill and text for an incorrect response.
- **Uncertainty Amber**: feedback fill and text for guessed or assisted correctness.

### Neutral

- **Reading Navy** (`ink`): body text, headings and key numbers.
- **Slate** (`muted`): metadata, captions and secondary instructions.
- **White Ground** (`paper`): learning widget and standard buttons.
- **Cool Canvas** (`canvas`): local review shell background.
- **Quiet Divider** (`line`): borders, row separators and progress tracks.
- **Answer Hover** (`option-hover`): answer-row pointer state.

**The Action Blue Rule.** Use the solid accent for the main action; use tint for selection and quiet supporting emphasis. Feedback states retain their own semantic colours.

## Typography

**Display Font:** Be Vietnam Pro, implemented with the local CSS family name `Be`, falling back to sans-serif.

**Body Font:** the same family. Local files provide regular, semibold and bold weights; font display is swap. No separate decorative or monospace family is established.

**Character:** legible Vietnamese text with modest heading contrast. Semibold emphasises actions, labels and key numbers; headings use bold. Numeric counts and the timer use tabular figures.

### Hierarchy

- **Display:** page titles; desktop role in frontmatter, reduced to (25px) below the mobile breakpoint.
- **Headline:** question and section headings; reduced to (20px) on narrow screens. Course-list headings use (20px) and the daily panel uses (21px) on desktop.
- **Title:** teaching-area headings.
- **Body:** reading and controls; paragraphs generally stop at (72ch), coach text at (75ch).
- **Label:** secondary controls and metadata; the prototype also uses (14px) course labels and answer summaries.
- **Small:** captions and progress notes. Bold and strong text generally use (600), independent of the surrounding role.

**The Reading Rule.** Preserve Vietnamese text and generous line height. Keep instructional paragraphs within the observed reading widths rather than stretching across a wide widget.

## Layout

The review workspace has a maximum width of (1120px) with horizontal padding of (20px). The learning widget contains a compact brand and top-navigation band, then content padding of (36px). The course entry uses a flexible course column and a daily-action column of (280px), separated by (38px). These values describe the accepted entry surface, not a mandatory composition for every learning step.

The single observed width breakpoint is `max-width:700px`. It changes the workspace padding to (10px), content padding to (24px 22px), and brand padding to (22px). The course and daily area stack, with today's action first. Comparison panels become one column; answer options and row spacing tighten. The question navigator changes from ten columns to six. Action groups wrap. The shared spacing frontmatter lists recurring values rather than every incidental margin.

Focused learning steps keep one visible main action; supporting controls sit behind a native disclosure. Course, review and test entry points remain available in the top navigation. Paragraphs, question illustrations and metadata retain their own reading constraints inside the container.

## Elevation & Depth

The prototype uses no box shadows. White surfaces, thin dividers, selected tints and blue teaching areas create depth through contrast and grouping. The widget has a thin border and a narrow accent edge at the top of its brand band. Focus outlines communicate interaction rather than elevation.

**The Flat Surface Rule.** Use borders, alignment and tonal fills to separate content. Do not add shadows to the accepted prototype vocabulary.

## Shapes

Controls have gently curved corners; fields and buttons share the control radius. Answer rows use the option radius. Teaching and feedback areas use the panel radius, while the outer widget uses the larger widget radius. Tags are compact rectangles, not pills. Course rows remain square and use horizontal separators. Progress tracks are narrow rounded strips; their geometry is functional, not decorative.

## Components

### Buttons

Solid blue main buttons use semibold text and the frontmatter padding. Standard secondary buttons are white with a thin divider border. Hover deepens primary blue or tints secondary controls and strengthens their border. Controls and disclosure summaries have a minimum height of (44px); disabled buttons use opacity (.5) and a not-allowed cursor. Keyboard focus uses an outline of (3px) with an offset of (3px). The only explicit animation is a background transition of (.15s ease), disabled for reduced motion. No scale or lift effects are established.

### Inputs / Fields

Search and custom-number fields use thin divider borders, control corners and the extracted field padding. Input text is navy; placeholders are slate; caret and native selection controls use action blue. Focus shares the visible blue outline. The composer field is a local-shell variant inside its bordered panel. No reusable error-field or disabled-field appearance has been established.

### Navigation

Three compact text controls lead to course, review and test activities. The active item receives quiet blue fill and blue text. Other items remain transparent. Keep these distinct from a solid main action. Mobile navigation stays within the brand band. Prototype screen-state logic is implementation evidence, not a specification of every future subroute.

### Chips

Quiet blue tags have blue text, small type and compact padding. They label a recommendation or unresolved status. No interactive chip selection pattern is established.

### Cards / Containers

The white learning widget has a thin divider border and clipped corners. Teaching, comparison and continuation panels use the pale teaching fill, panel corners and (26px) padding, reduced to (21px) for teaching/comparison panels on mobile. The daily-action panel uses (22px) mobile padding. Keep panels purposeful; use rows for course units.

### Course Rows and Progress

Course rows are full-width buttons with aligned chapter, label, first-pass progress, count and inline chevron. The progress track is (4px) high and at most (240px) wide. Tabular counts label their meaning; they never collapse “Đã thử” and “Đã nhớ” into one score. Pointer hover uses the standard button tint and keyboard focus remains visible.

### Answer Options and Feedback

Native radio inputs sit within bordered answer rows. Hover adds a faint neutral fill; checked rows use tint and the accent border. Radios are (18px) square. Feedback uses coloured fill plus an explicit textual verdict, so meaning does not depend on colour. Explanations and provenance appear in a separate teaching area. Wrong, uncertain and correct appearances do not replace progress semantics.

## Do's and Don'ts

### Do:

- **Do** use the same navy, blue and neutral roles across study, review and test screens.
- **Do** preserve aligned counts and distinguish first-pass coverage from delayed learning.
- **Do** keep the main action visible and give support actions a clear disclosure.
- **Do** preserve original question images and their readable proportions.
- **Do** retain keyboard focus visibility, target size and reduced-motion behavior.
- **Do** label sample progress and unavailable sources honestly.

### Don't:

- **Don't** replace the course structure with a wall of decorative cards.
- **Don't** imitate maps, desks, tickets or physical paper materials.
- **Don't** use mascots, botanical imagery, strobing or decorative barcode grids.
- **Don't** imply mastered learning through a single correct answer or hide unresolved confusion.
- **Don't** treat the local conversation shell as verified ChatGPT host UI.

Source scope: `PRODUCT.md`, `docs/ui-ux-direction-b-contract.md`, `docs/ui-ux-redesign-directions.md`, and the current `design/chatgpt-learning/style.css`, `index.html` and `app.js`. Historical comparison directions do not override the accepted B implementation. One-off shell colours and incidental declarations are not promoted to reusable tokens.
