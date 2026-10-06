# ChatGPT learning experience design

## 1. Status

6 October 2026. Screen-level design for [PRD version 1.0](product-requirements.md). Visual rules are in [DESIGN.md](../DESIGN.md).

- This version replaces direction B (Đường học) and the compact card-per-step model from the PRD 0.11 design.
- The owner rejected that build as boring, flat and confusing, because each answer received a verdict in the card and another from ChatGPT.
- The [direction-B contract](ui-ux-direction-b-contract.md) and the [first prototype](../design/chatgpt-learning/index.html) are now historical.
- The prototype and `src/ui/learning.html` have not yet been rebuilt to this design.
- Host behaviour in ChatGPT is still unverified (section 8).

Mockup rules from the earlier design still apply:

- Label synthetic history, counts and timings as samples.
- Take question wording, options, images and keys verbatim from the bank.
- Never fabricate source titles, quotations, video links or timestamps.

## 2. Card and ChatGPT handoff

PRD section 7 defines who speaks when. This section defines how the UI carries it out.

**One living card.** `start_study` opens one lesson card. Every later step renders inside that card through direct `tools/call` requests:

- `submit_study_answer`
- `next_study_question`
- `skip_study_question`
- `request_study_help`
- `set_question_confusion`
- `pause_study`

The card never posts an answer as a chat message and never waits for ChatGPT to score.

**Silent context.** After each verdict, the card sends `ui/update-model-context` with these fields:

- `sessionId`
- `questionId`
- step type (review, new, repair, challenge)
- learner choice
- verdict
- whether help was used
- lesson position (for example 5/10)

ChatGPT can then answer a typed question about the current step without asking for the question number. Updating context produces no chat message.

**Messages the card posts.** The card posts a chat message in only three cases. Each message is short, human-readable Vietnamese with a machine-readable tail:

| Trigger | Message shown in chat |
| --- | --- |
| "Hỏi ChatGPT" on the feedback sheet | `Giải thích giúp mình câu 145: mình chọn B, đáp án là A. [q145 · chọn B · sai]` |
| "ChatGPT giải thích kỹ hơn" after a repeated mistake | `Mình vẫn nhầm câu 145, giải thích kỹ hơn nhé. [q145 · lần 2 · sai]` |
| Lesson finished | `Xong bài: 8/10 đúng, +95 XP, 2 câu mới thuộc. [session s_… · tổng kết]` |

Before posting "Hỏi ChatGPT", the card calls `request_study_help`, so assistance is recorded before any explanation (TUT-04).

**Typed input while a card is live.** If the learner types a letter or an option, ChatGPT replies in one line asking them to tap it on the card. It does not submit or judge. The card does not change.

**Stale cards.** Only the newest card for a session is interactive. If the learner scrolls up to an older card, its controls are replaced by "Bài học đang tiếp tục ở thẻ mới nhất". The card checks this on focus with `get_study_session`. Submitted answers are never shown as editable.

**Reload and resume.** On mount, the card fetches its session and renders the current step, including an open feedback sheet. "Học tiếp" in a new chat opens a fresh card at the same step, and the old card goes stale.

## 3. Flow map

| Flow | Entry | Card steps | Ends with |
| --- | --- | --- | --- |
| First visit | "Tôi muốn học bằng B" | Goal picker → sign-in note → first lesson | Finish screen and goal ring started |
| Daily lesson | "Học tiếp" | Home card → intro → reviews → new skill → challenge → finish | "Bài tiếp theo" or "Xong hôm nay" |
| Review-heavy day | "Học tiếp" with more than 10 due | Review-only lessons of 10 until the queue is empty | Ring centre check, then new skill |
| Category or family | "Học biển báo", course map tile, family picker | Intro names the skill → steps from that pool | Finish screen. Due reviews stay due. |
| Ask while playing | Typed question or "Hỏi ChatGPT" | Card unchanged | ChatGPT explains, and the learner taps "Tiếp tục" |
| Confusion | "Tôi còn phân vân" on the feedback sheet, or typed | Flag saved and chip shown on the step | Review within 24 hours. Cleared only on learner confirmation. |
| Video | "Xem video" (only when a verified segment exists) | External YouTube link | The card stays on the same step |
| Progress | "Tiến độ của tôi?" or the home card | Home card with three numbers, ring and league | One "Học tiếp" button |
| League | League row on the home card | League board | Back to the home card |
| Thi thử | "Thi thử" or "Tạo đề ngẫu nhiên" | Profile → timer start → 30 questions → submit | Result screen → "Ôn các câu sai" |
| Resume | "Tiếp tục bài hôm qua" | Same step in a fresh card | Continues the lesson. An expired test shows its result. |

## 4. Screen specs

Sketches show layout and copy, not styling. `[ … ]` is the primary button, `( … )` is a secondary text button, and `▓` is an ink fill. Counts are samples.

### 4.1 Goal picker (first visit)

```text
Mỗi ngày bạn muốn học bao nhiêu câu mới?

○ 10 câu     xong lượt đầu trong 60 ngày
○ 12 câu     50 ngày · còn 10 ngày dự phòng   Đề xuất
○ 15 câu     40 ngày · còn 20 ngày dự phòng
○ Tự chọn    [ __ ] câu → hiện số ngày cần học

Câu ôn tập được tính riêng và luôn làm trước.

[ Bắt đầu ]
```

- The recommendation is pre-highlighted but not pre-selected. "Bắt đầu" is disabled until the learner picks a goal.
- A custom value shows its forecast inline. A goal of 8 shows "75 ngày — quá 60 ngày", and the learner can keep it.
- Conversational equivalents ("Mỗi ngày 10 câu") set the same value.
- Next comes one sentence about sign-in to save progress (DAT-01), then the first lesson starts.

### 4.2 Home card

```text
     ╭───╮      Đã gặp      Đã thuộc     Cần ôn hôm nay
    │ 7/12 │      120         84            6
     ╰───╯      /600        /600
   Mục tiêu hôm nay

Tuần này: 240 XP · Hạng 4 trong nhóm        (Xem bảng)
Theo nhịp 12 câu/ngày: xong lượt đầu ngày 25/11

[ Học tiếp ]
(Chọn chủ đề)   (Thi thử)
```

- The ring has 12 segments, one per new question today. Its centre shows a small check when due reviews are done.
- The three numbers always appear together, with these labels.
- The league line appears only for members. Non-members see one invitation line after their first finished lesson: "Tham gia nhóm thi đua tuần".
- "Học tiếp" starts the review queue when anything is due, otherwise the next new skill.

### 4.3 Lesson intro

```text
▓▓░░░░░░░░                                   ✕

Bài hôm nay
Tốc độ tối đa theo loại đường
6 câu ôn · 4 câu mới · 1 thử thách · ~8 phút

[ Bắt đầu ]
```

- When reviews come first, the intro says "Ôn lại 6 câu trước, sau đó học: …".
- A review-only lesson says "Hôm nay ôn 10/23 câu đến hạn" and shows no new skill.
- ✕ pauses and saves the exact step.

### 4.4 Question step

```text
▓▓▓▓░░░░░░  5/10                             ✕
[Ôn lại]

Câu 145
[Full original stem]
[Original image]                         (Phóng to)

╭ A  [Original option]                          ╮
╭ B  [Original option]                          ╮
╭ C  [Original option]                          ╮

(Tôi đoán)                                  (Bỏ qua)
[ Kiểm tra ]
```

- The step chip is one of: Ôn lại, Mới, Thử lại, Thử thách.
- Tapping an option selects it with a 2 px ink border. "Kiểm tra" submits.
- "Bỏ qua" skips without scoring. A skipped due review stays due.
- "Tôi đoán" is an optional toggle chip. When off, confidence stays unknown (REV-05).
- Options stack vertically. Image questions show the image at full column width. "Phóng to" opens an accessible zoom view (P0).
- The card offers no help before answering. If the learner asks ChatGPT for a hint first, ChatGPT calls `request_study_help` before answering (TUT-04), and the card marks the step as assisted when it next refreshes.

### 4.5 Feedback sheet

The sheet slides up from the action area. The question stays visible above it, with the options locked.

```text
Correct                                  Wrong
◉✓ Chính xác!            +10 XP          ⊗ Chưa đúng                 +3 XP
Combo 3 câu liên tiếp                    Đáp án đúng: A · 60 km/h
Khu đông dân cư, đường đôi hoặc         Khu đông dân cư, đường đôi hoặc
một chiều từ 2 làn: 60 km/h. (Xem thêm)  một chiều từ 2 làn: 60 km/h.
                                         (Xem thêm)
[ Tiếp tục ]                             [ Tiếp tục ]
(Hỏi ChatGPT) (Tôi còn phân vân) (Video) (Hỏi ChatGPT) (Tôi còn phân vân) (Video)
```

- The reason is approved text in at most two lines. "Xem thêm" expands the full approved explanation in place.
- "Video" appears only when a verified segment exists. It opens YouTube externally, and the card keeps the step.
- If no approved text exists: "Chưa có giải thích được duyệt cho câu này." Then "Hỏi ChatGPT" becomes the visible suggestion.
- A newly Mastered question adds a "Đã thuộc!" line to the sheet.
- Section 5 lists the other verdict variants.

### 4.6 Repair step

The repair step comes after a wrong answer, at least two steps later in the same lesson. It looks like a question step with the "Thử lại" chip and the line "Bạn đã sai câu này lúc nãy". Correct shows "Đã sửa!" and +2 XP. Wrong shows the answer again. If it is wrong a second time, the sheet offers "ChatGPT giải thích kỹ hơn" (section 2). Repair never adds coverage or delayed-recall credit.

### 4.7 Compare the pair (challenge)

```text
[Thử thách] Hai câu dễ nhầm

Câu 145                         Câu 146
[stem, options]                 [stem, options]
(choose)                        (choose)
[ Kiểm tra cả hai ]

→ both verdicts together, then:
Khác nhau ở: loại đường (khu đông dân cư)
Đường đôi hoặc một chiều từ 2 làn: 60 km/h
Đường hai chiều hoặc một chiều 1 làn (trừ cao tốc): 50 km/h
[ Tiếp tục ]
```

- On desktop the two questions sit side by side. On mobile they stack. The learner chooses for both before one "Kiểm tra cả hai".
- Neither verdict appears until both are submitted, so both remain independent, normal scored attempts. A per-question verdict would reveal the other question's condition and make the second answer assisted.
- The difference line is teaching. Any later attempt in this lesson on either question is marked as assisted.
- Only approved families appear here.

### 4.8 Lightning round (challenge)

```text
[Thử thách] Chớp nhoáng · 0:47                ✓ 6

[Stem]
A …   B …   C …
[ Kiểm tra ]            (Enter also confirms)
```

- The intro screen says: "60 giây · câu đã gặp · trả lời sai vẫn được ghi vào lịch ôn".
- Tapping selects and "Kiểm tra" submits, as in every scored step (PRD §3), so a mistap cannot lapse a Mastered question. There is no explanation during the round.
- At the end, a summary lists the wrong items with "Xem lại" links, which open each item's feedback sheet.
- Each answer is scored under B4.

### 4.9 Finish screen

```text
Hoàn thành bài học!

  +95 XP       8/10 đúng       2 câu mới thuộc
  (count up, one after another)

     ╭───╮
    │ 9/12 │  Mục tiêu hôm nay
     ╰───╯

Ngày mai ôn lại: 3 câu

[ Bài tiếp theo ]
(Xong hôm nay)
```

- When the ring closes, it plays its one-time celebration and the primary button changes to "Học thêm" with a tertiary "Xong hôm nay".
- Assisted, guessed and skipped answers are counted in one muted line: "Có hỗ trợ: 1 · Đoán: 1 · Bỏ qua: 0".
- The card then posts the summary message, and ChatGPT adds a 2–3 sentence coach note.

### 4.10 Course map and family picker

```text
Khóa học bằng B

╭ Điểm liệt          ╮  ╭ Quy tắc giao thông ╮
│ ▓▓▓▓░░  gặp 40/60   │  │ ▓▓░░░░  gặp 51/133  │
│ ▓▓░░░░  thuộc 22    │  │ ▓░░░░░  thuộc 18    │
╰ [ Học ]             ╯  ╰ [ Học ]             ╯
… 7 categories + Câu hỏi dễ nhầm lẫn
```

- Tiles are never locked. "Học" starts a lesson from that pool. If reviews are due, the intro notes "Còn 6 câu ôn đến hạn", and they stay due.
- "Câu hỏi dễ nhầm lẫn" opens the family picker. It shows three personalised suggestions with reasons, then a search field that accepts unaccented Vietnamese or a question number. Rows show title, member count, an image marker and draft/approved status. One selection and "Học nhóm này".
- Detail views (needs repair, flagged confusion, next review date) are one tap deeper on each tile and follow PRD appendix A1.

### 4.11 League board

```text
Nhóm tuần này · còn 3 ngày

 1  Lan.B          410 XP
 2  minh_lai_xe    388 XP
 3  Tuấn           300 XP
▓4  Bạn (Hà)       240 XP▓
 …
(Ẩn tôi khỏi bảng)
```

- The board shows rank, display name and weekly XP only. The learner's own row is inverted.
- At the end of the week, a card celebrates the learner's XP and the top 3, with no demotion copy.
- Joining asks for a display name, which is checked against a profanity list. Leaving or hiding is always one tap away.

### 4.12 Thi thử and result

The test keeps the B6 rules and the earlier test interaction:

- Before the start, show origin (supplied test or "Đề ngẫu nhiên từ ngân hàng 600 câu"), 30 câu, 20 phút, ≥ 27 đúng, and the critical-question rule. "Bắt đầu tính giờ" starts the server deadline.
- During the test, the card shows a timer chip, "Câu X/30", the answered count, and a navigator grid that can be expanded (6 columns on mobile, 10 on desktop). Cells show current, answered and unanswered without correctness. "Câu trước" and "Lưu và tiếp theo" move between questions.
- There is no XP, verdict motion, help or confusion action during the test. A help request offers to leave the test, with confirmation.
- "Nộp bài" opens an in-card confirmation with the unanswered count.

```text
Kết quả

   28/30            (count up)
   Chưa đạt
   Sai 1 câu điểm liệt (câu 23)

+20 XP

Câu sai theo nhóm:  Điểm liệt 1 · Biển báo 1

[ Ôn các câu sai ]
(Xem lại bài thi)
```

A pass shows "Đạt" with a one-time celebration and +50 XP in total. An expired test shows its result on the next interaction.

## 5. Answer states in black and white

| State | Option treatment | Icon | Words | XP |
| --- | --- | --- | --- | ---: |
| Selected, not submitted | 2 px ink border, letter badge filled | — | — | — |
| Correct | Ink fill, on-ink text | Filled circle ✓, draws in | "Chính xác!" | 10 |
| Wrong (chosen option) | 2 px ink border; letter box filled with diagonal stripes, carrying an ✕ in a small circle | Outlined ✕, shake | "Chưa đúng"; the option is tagged "Bạn chọn" | 3 |
| Correct option after a wrong answer | Inverted: ink fill, on-ink text, ✓ in the letter box | — | "Đáp án đúng" | — |
| Correct after help | Ink fill | Outlined circle ✓, no bounce | "Đúng (có hỗ trợ)" | 3 |
| Correct but guessed ("Tôi đoán" on) | Ink fill | Filled ✓ | "Đúng — lần sau thử không đoán nhé" | 10 |
| Repair correct | Ink fill | Filled ✓ | "Đã sửa!" | 2 |
| Newly Mastered | As correct | Filled ✓ | Extra line "Đã thuộc!" with a pop | +15 bonus |
| Request not delivered | Selection kept, options locked | Small ⟳ in a dashed row | No verdict, because the server has not scored anything. Dashed row "Chưa gửi được — thử lại" with "Thử lại", which resends with the same request ID | none |
| Skipped | Options reset | — | "Đã bỏ qua · vẫn cần ôn" | 0 |

None of these states uses colour. Each verdict is announced through an `aria-live` region.

## 6. Shared behaviours

| Element | Rule |
| --- | --- |
| Primary action | Exactly one per screen, with task-specific wording ("Kiểm tra", "Tiếp tục", "Bài tiếp theo"). It sits in the sticky bottom area. |
| Secondary actions | Text buttons in one quiet row, only on the feedback sheet, home card and finish screen. No menus or global navigation during a lesson. |
| Progress | The top bar shows lesson position. Coverage, Mastered and Due appear only on the home card, finish screen and course map, with the same three labels. |
| Theme | Follows the host. Black and white only, with tokens from DESIGN.md. |
| Motion | Per the DESIGN.md motion table. Reduced motion uses fades. Nothing loops or plays sound. |
| Focus | New step: focus moves to the question heading. Verdict: focus moves to the verdict heading. Visible 2 px focus ring. |
| Images | Original image with "Phóng to", aspect ratio preserved. Reviewed highlights (P1) are separate from the scored original. |
| Mobile | 360 px minimum width, 48 px targets, one scroll region, primary button always reachable. |
| Copy | Encouraging and never shaming. Avoid "thất bại" and "bạn đã mất". After a break: "Chào mừng bạn quay lại". |
| Text fallback | If the card fails, ChatGPT runs the lesson in conversation per the tutor skill. |

## 7. Recovery states

| State | What the learner sees | What stays preserved |
| --- | --- | --- |
| Not signed in | "Đăng nhập để lưu tiến độ" with the connection path. Nothing is claimed as saved. | Current step if supported, marked unsaved |
| Progress load failure | "Chưa tải được tiến độ" with "Thử lại". The home card shows no numbers rather than zeros. | Saved state is never overwritten by empty data |
| Answer save failure | Verdict with ⟳ "Chưa lưu được — thử lại". "Tiếp tục" waits until saved or until the learner chooses "Lưu sau", which keeps the retry queued. | Stable attempt ID, no duplicate XP |
| `tools/call` unavailable on this client | "Thẻ không phản hồi — tiếp tục trong khung chat" | ChatGPT continues in text mode from the same session |
| Missing approved explanation | "Chưa có giải thích được duyệt cho câu này" with "Hỏi ChatGPT" | Bank verdict and saved review |
| Teaching MCP unavailable | Retained approved text with an optional retry | Lesson continues without invented sources |
| No or removed video | The "Video" button is hidden. If a link fails: "Video không còn khả dụng". | Active step |
| Draft family | Picker row marked "Bản nháp". Questions are playable, with no approved comparison line. | Original content |
| Stale card | "Bài học đang tiếp tục ở thẻ mới nhất" | Historic answers |
| Library not supplied | "Chưa có bộ đề gốc" with "Tạo đề ngẫu nhiên" | No substituted test |
| Test expired while away | The result screen on return | Original deadline and final choices, finalised once |

## 8. Checks to run in real ChatGPT

These must pass before the design is final (PRD milestone M1):

1. **Direct scoring.** `tools/call` from the card works on ChatGPT web, iOS and Android. Measure verdict latency, with a target under 1 s at p95.
2. **Inline versus fullscreen.** Compare a 10-step lesson inline and in fullscreen, if the host allows requesting it. Choose based on scroll behaviour, keyboard overlap on mobile, and how the chat composer interacts with the card.
3. **Silent context.** `ui/update-model-context` lets ChatGPT answer "Sao câu này sai?" without the learner restating the question, and adds no chat message.
4. **Silence.** With the updated server instructions and tool descriptions, ChatGPT gives zero verdicts during card play across the scripted suite (PRD OWN-01).
5. **Dark surface.** Compare the card's `#000000` with ChatGPT's actual dark background. Match the host if they differ.
6. **Stale card.** Older cards go stale correctly after "Học tiếp" in the same chat and in a new chat.
7. **Animation cost.** Motion stays smooth on a mid-range Android phone inside the host frame.

Open owner decisions:

- Whether mock-test options keep the 2×2 layout from commit `fe9f315` for short text-only options, or stack like lesson options.
- Whether the lightning round should answer on one tap. That is faster, but a mistap would be a scored wrong answer and could remove Đã thuộc. Adopting it means amending PRD INT-03.

## 9. History

The sections below are the prototype record for PRD 0.11 and direction B, kept unchanged. The earlier screen specs (S01–S06, the compact-card interaction model, and the colour proposal) are in this file's git history before PRD v1.0.

### Historical first prototype and revised visual direction

The owner approved this proposal on 6 October 2026, including learner-selected daily goals. The isolated [clickable prototype](../design/chatgpt-learning/index.html) and [review guide](../design/chatgpt-learning/README.md) show the first representative visual direction. It simulates the ChatGPT frame for design review; it is not a separate learner website or an integrated plugin release.

Browser observations covered the custom eight-question forecast, explicit answer submission, incorrect feedback, source fallback, stacked mobile comparison, light and dark question layouts, assisted application, pause/resume, explicit confusion clearing, and a recap with review 1/1 separate from new coverage 1/12. The mock-test navigator retained a selected answer on return; submission confirmed 29 unanswered items, and debrief separated those gaps from answered mistakes. Keyboard navigation displayed a solid focus outline. The selected 32 question records matched the original bank without changes.

The application question is marked assisted because the comparison already exposed its answer. Sample history, timing, and progress remain visibly labelled. The prototype has no production identity, scheduling, source retrieval, or durable saving. Hover rules retain contrasting text colours in CSS; pointer-hover rendering and assistive-technology validation remain unverified. Source videos, full category teaching, image enlargement, cross-chat resume, and host-specific ChatGPT behaviour require the next integrated prototype.


#### Revision 2 observation

The revised prototype completed goal selection, review, inline teaching, assisted application, recap, and an explicit finish in browser review. Custom goal entry stayed on the same screen. Help and pause remained reachable through the collapsed menu, and pause/resume retained the application step. Tests remained accessible through plan options, with a collapsed navigator and visible Previous and Next. Original questions and temporary-progress disclosures remain intact. This is interaction verification by the builder, not evidence that learner confusion has been resolved.

The owner requested a distinct visual box for explanations and things to remember. Use a soft theme-aware background, rounded outline, accent edge, and clear heading. Key values stand out within the box. This changes presentation without adding navigation or changing teaching conditions.

#### Selecting a confusing-question subcategory

Opening “Câu hỏi dễ nhầm lẫn” leads to a searchable list of the 249 saved families. Each row has a radio choice, title, original-question count, and image indicator. Search accepts unaccented Vietnamese or a question number. One Continue action opens the selected group overview with comparison scope and an expandable member list. The prototype can then show that family’s original questions and supplied bank explanations in sequence. It retains selection when returning to discovery. These trials are temporary and do not certify mastery, generate personalised lessons, or update review schedules. Comparisons shown before answering make this assisted practice. Draft and visual-review status remain visible.

#### Revision 3 visual consistency

Applied Impeccable 4.5.0 polish guidance in Operate mode to the isolated prototype. Retain the single activity, green action/selection colour, explicit answers, and boxed teaching. Use one sans family with a fixed scale, readable secondary text, row-based discovery and goal choices, consistent button and input shapes, and one activity surface. Context appears below the heading rather than as an uppercase kicker. Explanation boxes use a solid tinted background with strong key values. Shared theme tokens own state colours. A new step scrolls its introduction into view and focuses its heading; selecting an answer preserves its local focus. This is visual refinement of the design artifact, not a production integration or validated learning outcome.
