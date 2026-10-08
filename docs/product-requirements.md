> Visual brief updated on 7 October 2026. The owner requested playful color, graphics and micro-interactions. DESIGN.md supersedes monochrome palette, illustration prohibitions and old motion timings here; learning behavior remains unchanged.

# Lý Thuyết Lái Xe: product requirements

Version 1.0 · 6 October 2026 · Supersedes version 0.11.

Version 0.11 defined trustworthy learning rules, but it did not specify the experience. The deployed build that followed it felt flat. It also confused learners by giving feedback twice: once in the card and once from ChatGPT. Version 1.0 makes the experience the primary requirement: an interactive, game-like lesson inside ChatGPT inspired by Duolingo and Brilliant. Version 0.11's scoring, learning-evidence, mock-test, source and privacy rules remain in force. They are retained unchanged in the appendix, and the game layer is built on them.

Owner decisions for v1.0 (6 October 2026):

- Strict black-and-white themes. Correct and wrong are carried by icon, shape, motion and words, never colour.
- XP, a daily goal ring and weekly leagues. No streaks, levels, badges or lives.
- The card gives every verdict. ChatGPT coaches only on request, after repeated mistakes, and at lesson end.
- Approved outline. Sign-in remains required to save progress.

## 1. Product brief

### Problem

Vietnamese licence-B candidates must study 600 questions, including 60 critical (điểm liệt) questions where one mistake fails the exam. Drilling a question bank is boring. Learners stop before they have covered the bank, and they forget confusing distinctions such as speed by road type, licence ages, and similar signs.

### Audience

| Learner | What they need | Success feels like |
| --- | --- | --- |
| First-time candidate | A small, clear thing to do each day that makes progress | "I did today's goal in 10 minutes and I actually get this now." |
| Candidate near the exam | Find weak areas fast and stop repeating mistakes | "My mock test score went up and I know which questions still trip me." |

Vietnamese is the only interface and teaching language. Licence B only.

### Product promise

A short daily driving-theory game inside ChatGPT that makes you remember. It is free and shared with Vietnamese learner communities.

### Success

| Measure | Definition | Target for the first 100 active learners |
| --- | --- | --- |
| Fun | Learners who complete a second lesson within 48 hours of their first | ≥ 60% |
| Habit | Activated learners who study on ≥ 3 distinct days in their first 7 days | ≥ 50% |
| Lesson completion | Lessons finished ÷ lessons started (pauses excluded) | ≥ 80% |
| Learning | Correct unassisted answers on due reviews of questions answered wrong 7+ days earlier | Report the trend. There is no claimed target until there is a baseline. |

These targets are hypotheses. Never claim exam pass rates.

## 2. Experience principles

1. **Play in the card, talk in the chat.** The card owns answering, verdicts, next steps and progress. ChatGPT is a coach the learner calls on. It never narrates every answer.
2. **Instant feedback.** A verdict appears within one second of a tap, with motion that makes it felt.
3. **Always one obvious next tap.** Every screen has exactly one primary action.
4. **Small wins, often.** XP after every step, a goal ring that fills, and a celebration at the end of every lesson.
5. **Learning is real, not just activity.** Game rewards come from the same server events as the learning rules. A question is "Mastered" only under the appendix B4 contract, however much XP it earned.
6. **Never punish.** No lives, no streak loss, no shaming copy. A break means "Welcome back", never "You failed".
7. **Monochrome and calm.** Pure black and white like ChatGPT. Delight comes from motion and typography, not colour.

## 3. The core loop

Each lesson step follows the same rhythm:

1. **Prompt.** The card shows the question, its image if any, and options as large tap targets. An optional "Tôi đoán" (I'm guessing) chip records low confidence before submitting.
2. **Tap.** One tap selects. Submission happens on the "Kiểm tra" (Check) tap, so learners can change their choice before submitting.
3. **Verdict (instant).** The card shows the verdict in place from the answer key in the hidden `_meta` of the lesson result, then confirms the answer with the server in the background. XP appears when the server confirms:
   - Correct: a filled check icon, the chosen option inverts (black ↔ white), a short bounce, the text "Chính xác!", and "+10 XP" floating up. From 3 correct in a row, a combo counter appears ("3 câu liên tiếp").
   - Wrong: an outlined ✕ icon, a short horizontal shake, the text "Chưa đúng". The correct option is outlined heavily and labelled "Đáp án đúng".
4. **Why (one line).** The approved explanation in at most two sentences, with "Xem thêm" to expand. For a question in a confusing family, include a one-line contrast ("Câu 145 khác vì đây là đường hai chiều").
5. **Continue.** A full-width "Tiếp tục" button. Secondary actions sit behind a quiet row: "Hỏi ChatGPT", "Tôi còn phân vân", "Xem video".

The progress bar at the top of the card advances after every step. After a wrong answer, the same question returns later in the lesson as a repair step. It is labelled "Thử lại" and counts as repair practice, not recall (REV-03).

| ID | Priority | Requirement | Acceptance criteria |
| --- | --- | --- | --- |
| PLAY-01 | P0 | One living lesson card | A lesson runs in one card that updates in place. The card never asks ChatGPT to open a new card per question. Reloading the chat restores the current step from the server. |
| PLAY-02 | P0 | Instant, self-contained scoring | The card calls `submit_study_answer` directly through the host's `tools/call` bridge. It never posts the answer as a chat message, and it never polls for a verdict that ChatGPT must produce. The verdict and the next question render from the lesson answer keys without waiting for the server. The server scores each answer when it arrives, and its result is the one saved. |
| PLAY-03 | P0 | Felt feedback | Correct and wrong verdicts each have a distinct icon, motion (≤ 400 ms), and words. They are fully understandable without motion and without colour. `prefers-reduced-motion` replaces movement with a fade. A screen reader announces the verdict (live region). |
| PLAY-04 | P0 | One-line why | Every verdict shows approved teaching text (B3 KB-07) in ≤ 2 sentences, with optional expansion. If no approved text exists, say so plainly and offer "Hỏi ChatGPT". |
| PLAY-05 | P0 | Repair inside the lesson | A wrong answer schedules one repair attempt later in the same lesson, after at least 2 other steps. Repair earns reduced XP and never counts as delayed recall. |
| PLAY-06 | P0 | Learning rules unchanged | Scoring, confidence, assistance, confusion and review scheduling follow appendix B2–B4 exactly. The game layer reads their results and never alters them. |
| PLAY-07 | P0 | Resilient on bad networks | If an answer or a move to the next question does not reach the server or gets no reply, the card resends it in the background with the same request ID, so the answer counts once (DAT-02, DAT-03). After three failed sends the card keeps the verdict on screen, says "Chưa gửi được — thử lại", and holds other lesson actions until "Thử lại" gets the queue through. If the server refuses an answer, the card drops the unsent steps and shows the session as the server has it. |

## 4. Session shape

A lesson is 8–12 steps and takes about 6–10 minutes. A normal daily session (goal ring closed) is 2–3 lessons, about 15–20 minutes, which matches the owner's preferred session length. Due review can extend it (REV-02).

| Part | Steps | What happens |
| --- | --- | --- |
| Warm-up | Due reviews first (B4 review-first ordering) | "Ôn lại" label. Items are taken from the saved due queue. A long queue becomes review-only lessons until it is empty, and the remaining count stays visible. |
| New skill | 3–6 new questions from one category or family | A one-screen intro names the skill ("Tốc độ tối đa theo loại đường"), then questions and interactions |
| Challenge | 1–2 harder or contrasting items | A confusing-pair comparison or a lightning round |
| Finish | Celebration screen | XP earned, goal-ring progress, accuracy, newly Mastered questions, what comes back tomorrow, and the "Bài tiếp theo" button |

| ID | Priority | Requirement | Acceptance criteria |
| --- | --- | --- | --- |
| SES-01 | P0 | Review-first, chunked | Due reviews come before new learning by default (REV-02). If more than 10 are due, the lesson contains 10 reviews and no new questions. The next lesson continues the queue, and new learning starts once the queue is empty. The home card shows the remaining due count. Explicit learner requests for another activity are honoured without clearing due work. |
| SES-02 | P0 | Named skill per lesson | Every lesson after the warm-up has one named skill drawn from a category or confusing family, plus a one-screen intro that teaches before testing. |
| SES-03 | P0 | Finish screen | Shows XP earned, goal ring, correct count, newly Mastered count, items scheduled for tomorrow, and one primary "Bài tiếp theo" button. "Xong hôm nay" ends quietly. |
| SES-04 | P0 | Pause anywhere | Closing or leaving keeps the exact step. "Học tiếp" in any chat resumes it (resume rules in B4). |

## 5. Interaction types

Variety is what makes Brilliant and Duolingo feel interactive. Any answer to an original bank question, in any interaction, is a normal scored attempt under appendix B4. It earns coverage, can lapse a Mastered question, and earns normal XP. Derived interactions (INT-04 sort, INT-05 tap the clue) do not answer a bank question. They never count toward official accuracy, coverage or Mastered status (TUT-06, REV-06), and they earn XP for teaching.

| ID | Priority | Interaction | Description | Content source |
| --- | --- | --- | --- | --- |
| INT-01 | P0 | Multiple choice | Original bank question with 2–4 options | Bank |
| INT-02 | P0 | Compare the pair | Two confusing questions side by side, each answered in turn as a scored attempt. Then one line names the difference ("Khác nhau ở: loại đường"). That reveal is teaching help for any later attempt in this lesson. | Approved family comparisons (CON-06) |
| INT-03 | P0 | Lightning round | 60 seconds, as many already-seen questions as possible. Shows a counter but no per-question explanation. Each answer is a scored attempt under B4. A correct answer that is not due is early practice, and a wrong answer lapses the question as usual. The intro screen says this in one line. | Previously answered questions |
| INT-04 | P1 | Sort it | Drag or tap condition cards into buckets, for example speed limits by road type | Approved family comparison dimensions |
| INT-05 | P1 | Tap the clue | Tap the part of a sign or intersection image that decides the answer, then answer the question | Editor-reviewed image regions only. Never AI-guessed, and never used to decide the official answer. |
| INT-06 | P0 | Image zoom | Pinch or tap to enlarge any question image with accessible controls | Bank images |

Every interaction is fully usable by tap, keyboard and screen reader, and at 360 px width.

## 6. Gamification

All game values are computed on the server from saved learning events. Lesson and lightning cards receive answer keys in hidden `_meta` to show verdicts instantly. Until the server confirms an answer, the card shows only the verdict, the correct count and the combo it predicts from that key. XP, mastery and learned status appear only from the server's confirmation. Mock tests never receive keys.

### 6.1 XP

| Event | XP |
| --- | ---: |
| First-time answer, correct | 10 |
| First-time answer, wrong | -3 |
| Due review, correct | 10 |
| Due review, wrong | -3 |
| Qualifying delayed recall that newly makes a question Mastered (B4) | +15 bonus |
| Repair attempt | 2 correct, -3 wrong |
| Derived interaction (INT-04, INT-05) | 2 per step |
| Lightning round | 1 per correct, max 15 reward XP per round; -3 per wrong |
| Lesson finished | 10 |
| Mock test finalised | 20, plus 30 more for a pass |

Rules:

- Every wrong study answer deducts 3 XP, including guessed, assisted, practice and repair attempts. Signed totals may be negative.
- A replayed submission earns nothing (DAT-02).
- Correct assisted answers earn 3 XP; wrong assisted answers deduct 3 XP. Penalties never refund capped reward budgets.
- Abandoned mock tests earn nothing.
- Practice on questions that are not due is capped at 50 XP per day, so grinding known questions cannot dominate leagues.

### 6.2 Daily goal ring

The ring is the learner's daily new-question goal (10, 12, 15 or custom; appendix A2a). It fills by first-pass coverage: one segment per new question answered today. A small check in the centre lights when today's due reviews are done. Both must be complete for the ring to close with a celebration. On review-only days, the ring shows "Hôm nay: ôn tập" and closes when reviews are done. The ring never carries over a deficit to the next day.

### 6.3 Weekly leagues

| ID | Priority | Requirement | Acceptance criteria |
| --- | --- | --- | --- |
| LEA-01 | P0 | Opt-in and pseudonymous | Learners join after first finishing a lesson and choosing a display name. The display name is checked against a profanity list, and it is not taken from their ChatGPT or account identity. They can leave or hide at any time. Non-members see no league UI except one invitation. |
| LEA-02 | P0 | Weekly cohorts | Members are grouped into cohorts of up to 30 by join time. Ranking is weekly XP, Monday 00:00 to Sunday 23:59 Vietnam time (UTC+7). The board shows rank, display name and weekly XP only. |
| LEA-03 | P0 | No punishment | There is no demotion, no losing streak, and no copy that shames a low rank. The end-of-week card celebrates the learner's own XP and the top 3. |
| LEA-04 | P0 | Fair play | XP comes only from server-recorded events under 6.1. The server rejects any score from the client. Daily XP above 500 is flagged for review rather than ranked automatically. |
| LEA-05 | P0 | Privacy | League data never shows answers, accuracy, weak areas or exam dates. Deleting study data (DAT-05) also removes league history. |
| LEA-06 | P1 | Tiers | Promotion-only tiers (for example Đồng → Bạc → Vàng) once there are enough active learners. |

## 7. Card and ChatGPT ownership contract

This section fixes the confusion in the v0.11 build.

| Moment | Card does | ChatGPT does |
| --- | --- | --- |
| Learner says "Học tiếp" / "Ôn tập" | — | Calls `start_study` once. Its reply is one short sentence ("Bắt đầu nhé!"). |
| Lesson running | Shows questions, scores through `tools/call`, shows verdicts, XP and next steps. Keeps ChatGPT informed silently with `ui/update-model-context` (active question, choice, verdict). | Stays silent. Never repeats or contradicts the card's verdict. |
| Learner taps "Hỏi ChatGPT" | Calls `request_study_help` (recording assistance, TUT-04), then posts one chat message containing the question ID, choice and verdict | Explains from approved material (TUT-03). Card stays on the same step. |
| Learner types a question mid-lesson | Unchanged | Answers using the model context. Never opens a second lesson card. |
| Learner types an answer ("B") while a card is live | Unchanged | Does not submit or judge it. Replies in one line asking them to tap their choice on the card. Typed answering stays available in text-only use (TUT-05). |
| A question is wrong again on its repair step, or 3 answers are wrong in one lesson | Shows "ChatGPT có thể giải thích kỹ hơn" with a button | Coaches only if the learner taps it |
| Lesson finished | Shows the finish screen, then posts one message with the lesson summary | Writes a 2–3 sentence coach note: one strength, one thing to watch, and tomorrow's review. No new verdicts. |
| Learner taps "Nhờ ChatGPT nhắc tôi" | Posts one message asking for a daily reminder at the chosen time. Saves nothing. | Creates a daily ChatGPT scheduled task that opens the course, calls `get_course` and reports the due reviews. Says so plainly if scheduled tasks are unavailable on the learner's plan, and never claims a reminder exists without the task. |
| Text-only use (card fails) | — | Falls back to the v0.11 conversational flow (TUT-05) |

| ID | Priority | Requirement | Acceptance criteria |
| --- | --- | --- | --- |
| OWN-01 | P0 | Single verdict source | In every tested flow, each answer has exactly one verdict, shown by the card. ChatGPT messages never contain a correct/wrong judgement the card has not already shown. The test suite includes a learner typing an answer while a card is live. |
| OWN-02 | P0 | Tool descriptions and tutor skill enforce silence | Tool descriptions and `skills/driving-theory-tutor/SKILL.md` instruct ChatGPT to stay silent during card play and to coach only in the moments above. Verified with a scripted conversation suite in real ChatGPT. |
| OWN-03 | P0 | Single progress source | Progress numbers in the card, in `get_progress`, and in ChatGPT's answers to "Tiến độ của tôi?" come from the same server summary and match. |

## 8. Progress as learners see it

Learners see four numbers on the home card, and the same words wherever a number appears:

| Label | Meaning | Rule |
| --- | --- | --- |
| **Đã gặp** (Seen) | Questions answered at least once | First-pass coverage (A2a) |
| **Đã thuộc** (Mastered) | Questions recalled correctly, unassisted, on two separate days since the last mistake | Learned status (B4) |
| **Cần ôn hôm nay** (Due today) | Reviews due now | Due queue (B4) |
| **Sai hôm nay** (Wrong today) | Questions answered wrong today, in the learner's timezone, each counted once however often it was missed | The latest wrong answer per question today, listed read-only by `get_today_mistakes`. The questions return through their scheduled review (B4) |

The home card shows the goal ring, these four numbers (Đã gặp and Đã thuộc out of 600), weekly XP and league rank (if joined), and one primary "Học tiếp" button. Tapping Sai hôm nay opens a read-only list of today's wrong questions with the learner's choice, the correct answer and the bank explanation. Opening it records no attempt and no help, and nothing on it can be answered; the questions come back in their scheduled review. A course map shows the seven categories and "Câu hỏi dễ nhầm lẫn" as tiles. Each tile has a Seen / Mastered bar and a lock-free "Bắt đầu". The detailed views (needs repair, flagged confusion, next review date, family detail) are one tap deeper, and they follow appendix A1.

| ID | Priority | Requirement | Acceptance criteria |
| --- | --- | --- | --- |
| PRG-01 | P0 | Progress labels | The home card and ChatGPT's progress answers use exactly these four labels and definitions. The finish screen and course map use the first three. Overlapping detail counts are never shown as if they add up. |
| PRG-02 | P0 | Mastery moments | When a question becomes Mastered, the card shows a short "Đã thuộc!" moment on that step and lists it on the finish screen. A later wrong answer quietly moves it back with the copy "Cần ôn lại". |
| PRG-03 | P0 | Honest forecast | The home card shows the 60-day plan forecast from A2a in one line ("Theo nhịp 12 câu/ngày: xong lượt đầu ngày 25/11"). Missed days re-forecast without blame. |

## 9. Visual design

This section supersedes direction B (navy and blue). The owner chose the original game-like monochrome style on 6 October 2026. `DESIGN.md` holds the full design system, and `src/ui/learning.html` implements it.

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| `--bg` | `#ffffff` | `#000000` | Card ground |
| `--fg` | `#000000` | `#ffffff` | Text, icons, primary fills, correct-option fill |
| `--mute` | `#5d5d5d` | `#a8a8a8` | Secondary text, bottom edge of filled buttons |
| `--line` | `#e2e2e2` | `#2b2b2b` | Idle borders and edges, dividers |
| `--soft` | `#f4f4f4` | `#121212` | Inset panels, selected tile fill |
| `--soft2` | `#ebebeb` | `#1f1f1f` | Empty progress, disabled buttons |

- The theme follows the ChatGPT host automatically, with no in-card toggle. Before release, check `--bg` against ChatGPT's actual light and dark backgrounds, and match the host if they differ.
- Tiles and buttons are pressable. Each has a 2 px border plus a solid bottom edge that collapses 3 px on press.
- Correct inverts the option and pops a check. Wrong strikes the chosen option with diagonal stripes and an ✕, shakes it, and inverts the correct option with "Đáp án đúng". Feedback never relies on colour.
- Every state indicator has at least 3:1 contrast. Idle tiles may use the light `--line` border because their text identifies them.
- Typography: Nunito for text and JetBrains Mono for numbers, both bundled with the widget. Question 18 px / 600, options 15 px / 500, headlines, buttons and chips 700, body 400. Numbers stay mono 700.
- Shapes: card 22 px radius, tiles and buttons 16 px, chips are pills. Minimum tap target is 44 px, and primary buttons are 52–54 px high.
- Motion: pop, rise, shake, bounce, sparks, XP float, count-up and stamp, per `DESIGN.md`. All motion respects `prefers-reduced-motion`.
- No emoji, mascots or decorative illustrations in the chrome.

Contrast meets WCAG 2.2 AA in both themes. Keyboard focus is a visible 3 px `--fg` outline with a 2 px offset.

## 10. Mock test: "Thi thử"

The mock test is the boss level. It follows appendix B6 exactly: 30 questions, 20 minutes, at least 27/30, and any wrong or unanswered critical question fails. During the test there are no XP floats, verdicts or coaching. It uses a question navigator, a timer, and Previous/Next. After finalisation, the result screen counts the score up, shows "Đạt" or "Chưa đạt" with the exact reason, lists wrong items grouped by category, and offers "Ôn các câu sai" as the primary action. Random tests are always labelled "Đề ngẫu nhiên từ ngân hàng 600 câu".

| ID | Priority | Requirement | Acceptance criteria |
| --- | --- | --- | --- |
| MOCK-01 | P0 | Exam integrity | All B6 rules (EXAM-01 to EXAM-08) pass. Saving a choice goes through `tools/call` from the card without chat messages. |
| MOCK-02 | P0 | Result as a moment | The result screen has a count-up score, the pass/fail reason, XP earned, and one primary "Ôn các câu sai" action that starts a lesson from the wrong items. |

## 11. Onboarding and identity

1. The learner opens the app in ChatGPT ("Học lái xe bằng B").
2. One card: "Mỗi ngày bạn muốn học bao nhiêu câu mới?" with 10, 12 (Đề xuất), 15 or Tự chọn, plus a one-line 60-day forecast and "Bắt đầu".
3. Sign-in to save progress (DAT-01), explained in one sentence.
4. The first lesson starts immediately in Điểm liệt or Quy tắc giao thông. There is no diagnostic in v1.0.

Exam date and study days are optional, and the learner sets them later by saying so in chat. The friction of sign-in is a known risk. Measure the drop-off between steps 2 and 4.

## 12. Scope, milestones and release checks

### In scope

PLAY, SES, INT P0, XP, goal ring, leagues P0, OWN, PRG, the monochrome visual system, Thi thử, and everything in the appendix that these depend on.

### Out of scope for v1.0

Streaks, levels, badges, lives or hearts, sound, push notifications, voice, animated traffic simulations, generated official questions, standalone website, other licence classes, embedded video player (video opens YouTube externally per B3).

### Milestones

| Milestone | Exit evidence |
| --- | --- |
| M1. Living card | One lesson in real ChatGPT. The card scores through `tools/call`, each answer has one verdict (OWN-01), the monochrome themes are in place, and motion works. Fullscreen and inline display are both tested, and the better one is chosen. |
| M2. Game layer | XP, goal ring, finish screen, three-number progress, compare-the-pair, and lightning round |
| M3. Community | Leagues, mock-test result moment, and 5–8 learner playtests in ChatGPT with fun and confusion notes |
| Release | Release checks below pass. Share with Vietnamese learner communities. |

### Release checks

1. Every P0 in this document, including the appendix, passes in the real ChatGPT connection, in both themes, on mobile and desktop.
2. Scripted conversation suite: 0 cases where ChatGPT gives a verdict, contradicts the card, or opens a duplicate card.
3. All appendix policy scenarios (C4) and mock-test cases pass with a controlled clock.
4. XP, ring and league values match the event log for two test accounts across replays, concurrent chats and timezone changes. Deleting a learner's data removes their league entry.
5. Content and scoring match the 600-question bank. Before the public community launch, all 600 questions have approved retained teaching text (KB-07). An earlier invite-only beta may show missing text honestly (KB-05), and it must be labelled as a beta.

## 13. Risks

| Risk | Mitigation |
| --- | --- |
| The host does not support direct `tools/call` reliably on all ChatGPT clients | Test in M1 on web, iOS and Android. Fall back to the conversational flow (TUT-05) rather than the old message-plus-polling flow. |
| ChatGPT still narrates verdicts despite instructions | Return minimal model-visible text from card tool calls. Test with the scripted suite. Iterate tool descriptions. |
| Leagues reward grinding over learning | XP rules in 6.1, the cap on practice that is not due, and the 500 XP flag |
| A display name exposes identity, or abuse | Pseudonyms, profanity filter, hide/leave, and no learning data on boards |
| Monochrome reads as dull | Motion, typography scale and celebration moments carry the delight. Validate in M3 playtests. |
| Missing teaching text for some questions | Honest gap message (KB-05). Start lessons with the best-covered categories. |

## Appendix: retained rules from version 0.11

The sections below are carried over unchanged from version 0.11. They keep their original section numbers and requirement IDs, because code, tests and other documents refer to them. Where they mention ChatGPT cards, sections 3–11 above now define the card behaviour. Where they mention the 15–20 minute session, section 4 delivers it as 2–3 short lessons. Their scoring, evidence and scheduling rules are unchanged.

### A1. The category-based learning path

ChatGPT must use the question bank's taxonomy as the learning path. The bank contains six chapters, ordered by their `order` field, and seven `examCategory` values. Chapters organise the curriculum. The product presents those seven built-in categories alongside the owner-confirmed eighth custom category, "Câu hỏi dễ nhầm lẫn". Categories determine question pools and named practice paths. The custom category adds a comparison-learning path while preserving each question's original `examCategory` and chapter.

| Category ID | Learner-facing path | Questions |
| --- | --- | ---: |
| `quy_tac` | Quy tắc giao thông | 133 |
| `diem_liet` | Điểm liệt | 60 |
| `van_hoa` | Văn hóa giao thông | 23 |
| `ky_thuat` | Kỹ thuật lái xe | 47 |
| `cau_tao` | Cấu tạo và sửa chữa | 37 |
| `bien_bao` | Biển báo | 185 |
| `sa_hinh` | Sa hình | 115 |
| `de_nham_lan` · custom | Câu hỏi dễ nhầm lẫn | 598 shared questions in 249 overlapping families |

The custom category contains all 249 catalogued families as groups beneath it. Learners can select a named subcategory (question family) inside the custom category, search by Vietnamese name with or without accents or by original question number, inspect its member count and comparison scope, then begin a lesson restricted to that selected family. Returning to discovery retains the selection. The selection does not reveal answer keys; comparison teaching can expose conditions and therefore subsequent checks must honour assistance rules. Membership is additional, so its question count overlaps the seven original pools. It does not add new questions to the 600-question bank, alter scoring, or change mock-test category composition. The two singleton questions remain in their original categories.

Each category and confusing-question family is a structured course unit with a learner-specific progress summary. Derive the summary from saved original-question records, including answers submitted through other categories or finalised tests. For each unit show total unique members, first-pass coverage, learned through qualifying delayed recall, questions needing repair, unresolved confusion, due reviews, and the next scheduled review. Wrong, confusing, and due counts may overlap and must not be added as mutually exclusive buckets. Keep not started, in progress, first pass complete, and currently learned distinct. A five-question speed family can have coverage 3/5 and learned 1/5. Answering all five completes its first pass; it does not certify all five as learned. A later wrong answer can reduce learned progress without removing coverage.

Expose the same saved summaries in an in-ChatGPT course dashboard and review view, and through MCP so ChatGPT can answer requests such as “Tiến độ nhóm tốc độ của tôi?” or “Nhóm nào cần ôn hôm nay?”. Show categories and their groups as expandable units, allow resume within a selected unit, and link due review to the relevant questions. Preserve original bank categories; custom-family membership is an additional view. A shared question updates every containing unit but contributes once to course-wide coverage and once to the due queue. Dashboard display and conversational answers must use the same learner records and definitions. The current design prototype only shows temporary sequence position; it does not implement this saved unit tracker.

For beginners, follow the bank's chapter order by default and offer category-sized lessons within it. Treat Điểm liệt as an explicit priority practice path without inventing a seventh chapter. Learners can choose a category, resume it, or request mixed review. Near-exam plans can prioritise weak categories and critical questions while preserving full-bank coverage.

Reviewed concepts and confusing pairs may divide a category into manageable lessons. They are supporting teaching metadata. The owner-confirmed custom category exposes these families as a comparison-learning path alongside the seven built-in paths. Every lesson identifies its source category and original question IDs. Cross-category practice names the categories it combines and explains why.

The owner confirmed dynamic lesson assembly. ChatGPT assembles lessons from approved resources and the learner's saved history. It must avoid repeatedly presenting already-learned questions as new material, while preserving scheduled review of mistakes and confusing questions. Manual approval of every assembled lesson is not required; source approval and teaching constraints still apply.

Separate selection for new learning from selection for recall. Correctly learned material can return when its review is due, when a related concept needs an application check, or when the learner requests it. State the reason for such a repeat. A question being displayed or its explanation being read is not evidence that it was learned. A question counts as learned after two qualifying unassisted correct answers on separate learner-local days since its latest wrong answer. The first independent encounter can count once only when there is no prior scored attempt or recorded help for that question. Further qualifying answers must be due delayed recall and at least 24 hours after the preceding qualifying success. Changing the timezone or crossing midnight cannot create eligibility. Section B4 defines the contract. Reveals, hints, correct guesses, and immediate repair retries cannot establish this status. A different question in the same family cannot substitute for either answer. Learned questions still return for scheduled recall. Any later submitted wrong answer, including after a hint or explanation, removes that question's learned status and starts targeted repair and spaced relearning. Restoring learned status requires two new qualifying unassisted correct answers on separate days after the mistake under the same eligibility contract. Preserve historical attempts and other family members' status. Personal confusion is a separate learner signal, retained until the learner confirms the distinction is clear. Correct answers do not automatically clear that signal, and clearing it does not establish learned status. The flag brings review forward to no later than 24 hours after it is set and keeps unresolved confusion on daily review, without resetting correctness-based learned status by itself.

The question-family catalogue (`app/src/content/question-families.json`) records source-grounded families and comparison dimensions across the bank. The full-bank textual pass records 249 overlapping families covering 598 questions and two explicit singletons, accounting for all 600 IDs. 132 families require visual review. All mappings remain draft analysis. Families appear beneath "Câu hỏi dễ nhầm lẫn" and also support lessons in the original categories. They must preserve original question IDs, conditions, and images. They can overlap. A comparison of licence permissions must not conflate licence issuance age with permission to drive a specific vehicle. Image-dependent distinctions require visual review before approval. Catalogue coverage and teaching approval are separate. The [ChatGPT family guidance](chatgpt-question-family-guidance.md) records the proposed tutor instructions and the integration handoff. These saved documents are not yet exposed by the running plugin.

### A2a. Learner-selected daily goal and 60-day plan

The owner requested a selectable daily goal with several plans for covering the 600-question bank within 60 calendar days. Offer the following starting choices and a custom goal. Recommend 12 new questions per study day because its arithmetic leaves room for missed sessions or extra consolidation. These are planning options, not experimentally established optimal daily quotas.

| Plan | New unique questions per study day | Study days to cover 600 | Days remaining within 60 calendar days |
| --- | ---: | ---: | ---: |
| Steady | 10 | 60 | 0 |
| Recommended starting plan | 12 | 50 | 10 |
| Faster coverage | 15 | 40 | 20 |
| Custom | Learner-selected positive whole number | Round 600 divided by the goal up to a whole day | Show the actual forecast, including a later finish if needed |

These calculations assume the full bank is initially uncovered and each study day completes its new-question goal. The remaining days are calendar capacity, not promised days without review. For an existing learner, calculate from remaining unique questions. Use the chosen start date, target date, and available new-learning days to forecast calendar completion. Do not assume that every calendar day is available if the learner specifies otherwise. A custom goal of eight requires 75 study days for an untouched bank; show that it cannot cover 600 within 60 days and offer a later deadline or a higher goal without changing it automatically.

A question earns first-pass coverage once, at its first completed scored submission in learning or a finalised answered mock-test item. Correct, wrong, guessed, and assisted submissions all count as first-pass engagement. They retain their distinct learning evidence. A display, explanation read, skipped item, unanswered test item, abandoned or provisional test choice, generated exercise, repeated attempt, or second family membership adds no coverage. Attribute finalised test coverage to the original accepted-choice local day. Replayed finalisation adds no credit. Previously covered but unlearned questions remain eligible for repair and review without becoming new coverage again.

The daily new-question goal measures additional first-pass coverage. Review, repair, and understanding checks have separate progress. Due review continues throughout the plan and runs first by default. Buffer days also support consolidation and assessment. Covering all 600 is not a claim that all are learned by day 60. Later first encounters still need qualifying delayed recall under B4. Show bank coverage and learned-question count separately. A scored wrong answer can remove learned status without reversing historical first-pass coverage.

Onboarding offers a compact goal chooser in ChatGPT and an equivalent conversational path. The learner may change the daily goal or deadline at any time. Recommend the next category-based lesson from remaining coverage and approved teaching resources. Break the goal into focused lessons if needed. Keep deeper explanations and all due review; do not compress these to promise that 12 or 15 questions always fit 15–20 minutes. Estimate review and new-learning time separately using observed pace when available, otherwise label time as provisional.

After missed days, pauses, or review-only days, show remaining coverage and the revised forecast. Calculate the required pace from remaining unique questions and available new-learning days before the target date. Offer keeping the goal with a later finish, changing the goal, or changing the study calendar. Never silently increase the chosen goal, cancel review, or imply failure for taking a break. A partially completed day saves its actual coverage and pending activity. Optional extra questions cannot become a compulsory next-day quota. If pilot content approval supports only a subset, disclose that the full-bank plan is not yet available rather than forecasting unsupported teaching.

### B2. ChatGPT teaching behaviour

| ID | Priority | Requirement | Acceptance criteria |
| --- | --- | --- | --- |
| TUT-01 | P0 | Score through the bank | ChatGPT submits the actual question ID and learner choice for deterministic scoring. It does not score from memory. Original questions remain distinct from generated teaching prompts. |
| TUT-02 | P0 | Diagnose cautiously | On an unclear mistake, ask a concise reasoning question or offer a choice of explanations. Do not assign a persistent misconception based solely on one wrong option. The learner can correct the interpretation. |
| TUT-03 | P0 | Teach from retrieved evidence | Factual explanation and tips are supported by bank material or approved knowledge-base excerpts. Show source references. Simplifications preserve conditions and exceptions present in the source. |
| TUT-04 | P0 | Preserve recall before help | Do not reveal an answer before the learner attempts it unless they explicitly request explanation. Hints avoid giving away the answer where possible. Record any revealed explanation or video assistance for that attempt. |
| TUT-05 | P0 | Connect card actions to conversation | Help actions identify the question, learner choice, and requested help to ChatGPT. A stale card cannot teach or score against a different active question. Text-only use remains possible when cards fail. |
| TUT-06 | P0 | Check application | After substantial coaching, offer a related original question or a source-supported explanation task. Keep generated tasks separate from official accuracy and bank coverage. |

### B3. Knowledge base and source video

The recommended integration is a backend MCP client to the owner-authorised teaching knowledge base. This gives learners one plugin connection. Protocol details are an engineering design decision after the external tool contract is inspected.

| ID | Priority | Requirement | Acceptance criteria |
| --- | --- | --- | --- |
| KB-01 | P0 | Retrieve relevant authorised teaching | Retrieval accepts question identity and source text, concept, and optional learner confusion. Results preserve authorisation boundaries. Broad semantic similarity alone is insufficient evidence of a direct question-to-clip link. |
| KB-02 | P0 | Preserve provenance | Each used excerpt has a stable source reference, original video identifier where applicable, title, channel or author, and actual transcript or teaching text. Timestamps come from source metadata, never model guesses. |
| KB-03 | P0 | Support verified mappings | Store or retrieve reviewed question-to-concept and question-to-segment relationships with their version and review status. Unreviewed matches must not appear as verified question explanations. |
| KB-04 | P0 | Open the relevant segment externally | Show the actual source title, source-derived timestamp range, relevance, and a timestamped YouTube link. Clicking opens YouTube externally at the supplied start time. Preserve the active question and study session for conversational resume. Explain the intended end time without claiming external playback stops automatically. Never infer viewing completion from a click. |
| KB-05 | P0 | Handle missing or conflicting evidence | Use a question-level approved explanation when relevant external evidence is missing. During the limited pilot, report an explanation gap if no approved support exists. If sources conflict with the key or source wording, preserve bank scoring, disclose the issue, and refer it to editorial review. Do not use flagged text as a verified explanation until resolved. Never fabricate a clip, silently alter a key, or generalise a mnemonic beyond its supported conditions. |
| KB-06 | P0 | Continue during source failure | Teaching-MCP timeout, authorisation failure, or a removed video does not block bank answering and saved review. Use retained approved text and offer retry where useful. If a pilot question lacks approved fallback, report that teaching support is unavailable and offer another supported question. Do not claim unavailable material was retrieved. Broad release requires the fallback coverage in KB-07. |
| KB-07 | P0 | Retain approved text support for every question | Each question has a teaching record with question ID, bank version, explanation, source references, approval status, review date, and known conflicts. Publish only approved teaching. Before broad release, all 600 questions have approved text available through the plugin during teaching-MCP outages. Storage respects source authorisation; use an approved authored summary when source text cannot be retained. A revoked or conflicted record cannot remain an approved fallback. Video links supplement text and never replace it. |

External timestamped YouTube links are the owner-confirmed release behaviour. An embedded player is outside this scope. Video timestamps must come from approved source metadata.

### B4. Daily spaced repetition

Daily review of wrong answers is P0. Review also includes previously correct answers that are due. Correct guesses and assisted answers must not be treated as durable learning. The policies below resolve review findings R01 through R03; the interval sequence remains subject to pilot evaluation.

| ID | Priority | Requirement | Acceptance criteria |
| --- | --- | --- | --- |
| REV-01 | P0 | Save review state reliably | Persist learner-scoped attempts, assistance, optional confidence, and due dates. The same learner sees their queue across chats and restarts. Other learners cannot access it. |
| REV-02 | P0 | Complete due review before new learning | Prioritise overdue mistakes and critical-question gaps within the due queue. Complete all scheduled review attempts before starting the new lesson by default, extending total session duration as needed. Honour explicit learner requests for a different lesson or mock test; briefly note pending reviews and retain their due dates. An override does not count as completion, a wrong answer, or abandonment of those reviews. Show the queue and estimated duration. On pause, persist the remaining queue and resume it first by default; honour an explicit request for a different activity. An incorrect attempt receives repair and a future due date; it does not require endless correct retries to complete today's queue. |
| REV-03 | P0 | Separate repair from retention | An immediate retry after feedback is repair practice. It can show immediate understanding but cannot advance the delayed-review stage or claim mastery. |
| REV-04 | P0 | Schedule deterministically | The server owns attempt classification, eligibility, timestamps, qualifying-success count, and interval changes under the contract below. Repeating a question early, changing timezone, or replaying a submission cannot advance learned status or the schedule. Intervals use elapsed 24-hour days, not the next local midnight. Scheduling policy is versioned and testable with a controlled clock. |
| REV-05 | P0 | Treat uncertainty explicitly | Optional confidence distinguishes an independent correct answer from a guess. Missing confidence is not silently labelled confident. Confidence alone does not establish correctness or mastery. |
| REV-06 | P0 | Support concept transfer | Use reviewed related questions to check whether the distinction transfers. Track this separately from exact-question recall. New or generated tasks do not overwrite the bank's official attempt history. |
| REV-07 | P0 | Use learner-local daily boundaries | Store timestamps consistently and show dates in the learner's timezone. Define daily sessions using that timezone. Timezone changes do not create duplicate attempts or reviews. |
| REV-08 | P0 | Relearn an individual question after a lapse | Any later submitted wrong answer on a learned question, including after a hint or explanation, removes its learned status and starts targeted repair plus spaced review. Reset the qualifying-success count on every scored wrong answer, including before a question first becomes learned. Restore learned status only after two new qualifying unassisted correct answers on separate days after the lapse. In a mock test, saved choices become scored attempts only at finalisation. Preserve prior history. Do not reset other family members or their schedules. |
| REV-09 | P0 | Let learners flag unresolved confusion | Offer "Tôi còn phân vân" on learning and review cards and recognise explicit conversational statements. Link the flag to the active question and save it across chats. Ask for clarification when its target is ambiguous. Keep it until the learner confirms the distinction is clear. Do not infer resolution from a correct answer, clip click, or answer reveal. Verify learning independently. Catalogue membership alone cannot set a personal flag. Setting a flag schedules review no later than 24 hours later, preserving an earlier due date. While unresolved, a completed review schedules another review no later than 24 hours later. Keep this flag separate from learned status. Clearing it does not delete a scheduled review or erase a lapse. Do not reinsert an already-handled question into the current queue solely because its flag persists. |

#### Qualifying learning attempts

Learning and relearning use the same question-level contract:

1. Count an original question's first correct independent encounter once. This exception applies only when that learner has no prior scored attempt or recorded help for the question. A new chat does not create another first encounter. If prior help or an attempt exists, use due delayed recall instead. Missing confidence remains unknown and does not imply a guess. An explicitly guessed answer cannot qualify.
2. After prior help, a wrong answer, or the first qualifying success, further successes count only as scheduled, due, unassisted delayed recall. An attempt must occur at least 24 hours after the previous qualifying success and on a different learner-local day. Recall after help or a mistake must also wait at least 24 hours from that exposure or wrong attempt, as well as its scheduled delay. The timestamps, not a new local date alone, establish eligibility.
3. An early practice answer, assisted answer, immediate repair, related-question answer, generated exercise, skip, answer reveal, or request replay cannot increase the qualifying-success count. A scored wrong answer resets that count even when the question was not yet learned. An assisted or guessed correct answer does not increase the count or remove an existing learned status by itself.
4. Mark learned at two qualifying successes since the latest scored wrong answer. A later scored wrong answer removes learned status and begins the same process again. Preserve the full history and other family members' status.
5. A mock-test answer is evaluated using its original accepted-choice timestamp and assistance state when the test finalises. Finalisation latency cannot turn an early answer into delayed recall. Never use replay time as a new answer time. Apply late-arriving results in evidence-time order so an older result does not erase later qualifying evidence.

#### Review intervals and confusion

The initial interval sequence is 1, 3, 7, 14, and 30 elapsed days. One day means 24 hours. Evaluate its review burden and learning effect during the pilot.

- A first qualifying independent correct encounter starts the first interval. A wrong scored answer resets the interval stage and schedules delayed review 24 hours later, with optional repair in the current session.
- A due qualifying independent correct recall advances one stage. An assisted or explicitly guessed correct response does not advance the stage and schedules review 24 hours later.
- An early correct practice response does not extend the due date. An early wrong scored response resets qualifying successes and learned status and brings review forward to the earlier of the existing due date and 24 hours later.
- If a retained earlier due date precedes the minimum delayed-eligibility time after help or a mistake, handle that due attempt as practice without a qualifying success or stage advancement. Schedule the next recall at the minimum eligibility time. Ordinary practice before the due date does not extend its existing schedule.
- Setting a personal confusion flag offers coaching when requested and brings its review forward to the earlier of the existing due date and 24 hours later. With no existing date, create a date 24 hours later. The flag alone does not reset learned status or qualifying successes.
- After a scheduled review, unresolved confusion caps the next interval at 24 hours. Eligible recall can still establish learned status, while the personal flag stays visible until the learner confirms the distinction is clear. Ask about that distinction after relevant coaching without automatically clearing it.
- Clearing the flag keeps the currently scheduled review. Future eligible answers use the normal interval policy. Do not cancel a wrong-answer review or restore learned status merely because the learner says the explanation is clear.
- Skips and video viewing alone do not advance the interval stage. A skipped overdue item stays due. Retain assistance information when relevant content was supplied or consulted for an attempt. Offering a video link alone is not proof it was watched.
- No question is permanently mastered at the longest interval. Show demonstrated recall and dates rather than guaranteed retention.

#### Review-session boundaries and recovery

At start, save the due question IDs and per-item state for that review session. The queue does not expand after every card action. Handle each scheduled item once; repair after a mistake is a separate activity. A skip remains unresolved.

At resume and before entering a new lesson, reconcile the pending queue with items now due. Add newly due items once and explain any changed count. Review them first by default; honour an explicit activity override. A paused review and a mock test retain separate resumable identities. An override does not erase the review session.

Concurrent chats share saved attempts. If a question was already handled elsewhere, reconcile its pending entry without creating a second attempt or discarding either chat's distinct evidence. A save failure is not successful queue completion. Finishing a session cannot clear unattempted due items.

The separation of repair from delayed recall is fixed. Interval changes require policy versioning and evaluation; they cannot silently change learned-status eligibility or owner-confirmed activity ordering.

### B5. Content and exam preparation

| ID | Priority | Requirement | Acceptance criteria |
| --- | --- | --- | --- |
| CON-01 | P0 | Preserve the full bank | All 600 IDs, original wording, options, keys, applicability, and source images remain accessible. No question is dropped because its wording resembles another question. |
| CON-02 | P0 | Follow the bank's learning path | Chapter order and original `examCategory` define the built-in curriculum and practice paths. Present "Câu hỏi dễ nhầm lẫn" as the eighth selectable custom category alongside the seven built-in categories, with the 249 families available beneath it. Start with three personalised suggestions and conversational search. Rank approved focused distinctions using due review, learner gaps, and unlearned variants; a beginner without history receives approved introductory suggestions in chapter order. Show progress and allow conversational selection of a category or family. Preserve each question's original bank taxonomy and count shared questions once in overall coverage. |
| CON-03 | P0 | Resolve teaching coverage honestly | Track bank explanations, approved knowledge-base coverage, and unresolved gaps. The audit found 43 absent bank explanations. Resolve these and known explanation conflicts through question-level approved text records before claiming complete sole-resource teaching. The raw bank explanation is not automatically approved when its record is flagged for review. |
| CON-04 | P0 | Support approaching-exam priorities | Learners can change the exam date and request targeted or mixed practice. Show weak concepts and critical gaps with supporting attempts. Do not guarantee passing or inflate urgency. |
| CON-05 | P0 | Offer supplied and random mock tests | Meet the mock-test requirements below. Use the owner's supplied 30-question, 27/30, 20-minute practice profile. Do not claim verified official equivalence until the library and licence-specific rules are validated. |
| CON-06 | P0 | Teach distinctions using bank-derived question families | Maintain versioned family membership, comparison dimensions, evidence, and review status. Find related families across all 600 questions. Each question is mapped or explicitly recorded as a singleton or unresolved candidate. Never force unrelated items together to claim coverage. All catalogued families belong to the custom category `de_nham_lan`, labelled "Câu hỏi dễ nhầm lẫn". Approved families support comparisons and targeted practice using individual learning history. Broad topic links lead to focused subfamilies; draft mappings are discoverable but cannot be presented as approved teaching. Retrieve a small relevant subset and deduplicate question IDs across selected families. An answer on one member does not certify another member. Image-dependent mappings require visual review. The catalogue must be retrievable by ChatGPT through the plugin before claiming this behaviour is implemented. |

### B6. Timed mock tests

The user supplied this practice-test profile: 30 questions, at least 27 correct answers, no incorrect critical-question answers, and a 20-minute limit. Any incorrect Điểm liệt answer causes failure regardless of total score. Unanswered questions count as incorrect, including critical questions. This is the owner-confirmed product configuration, not a legal statement verified by this PRD.

| ID | Priority | Requirement | Acceptance criteria |
| --- | --- | --- | --- |
| EXAM-01 | P0 | Use the supplied test library directly | Import stable test IDs and exact question membership and order. Validate 30 distinct questions, existing bank IDs, and applicability. Report invalid records rather than silently replacing questions. Library mode remains visibly unavailable until the owner supplies valid data. |
| EXAM-02 | P0 | Generate random practice from the bank | ChatGPT requests selection through the plugin. Select 30 unique questions applicable to the chosen licence, using bank wording, images, and keys. Freeze membership and order for the attempt. Store the sampled IDs so resume does not generate a different test. |
| EXAM-03 | P0 | Be honest about composition | Adopt library composition rules when supplied and approved. Until then, label random tests as random bank practice with unvalidated official category distribution. Never invent quotas or claim a randomly sampled set is an official exam. |
| EXAM-04 | P0 | Enforce a 20-minute attempt | Start the server-owned deadline after explicit start. Show remaining time in the card. Chat delays, refresh, navigation, and new chats do not reset or pause it. No answers are accepted after the deadline. An expired attempt finalises on the next interaction if the host cannot run in the background. |
| EXAM-05 | P0 | Support real test interaction | Show question position, answered count, and a navigator for all 30 questions. Learners can revisit and change answers before submission or expiry. Persist choices as provisional test state without revealing correctness or changing learned status, review dates, or qualifying successes. Edits replace provisional choices; they are not separate scored attempts. Confirm early submission with the unanswered count. |
| EXAM-06 | P0 | Keep exam conditions distinct from learning | Withhold hints, explanations, video coaching, and correct-answer feedback during the attempt. A request for help offers an explicit exit into learning mode. On acceptance, mark the test abandoned before supplying help. Initial-release tests do not produce an assisted completed pass result. Retain abandoned provisional history for diagnostics, but do not resume it as an independent test or publish its choices as scored learning attempts. Later learning submissions follow the normal assistance rules. |
| EXAM-07 | P0 | Score deterministically | Score all 30 items against bank keys. Unanswered items count as incorrect. Pass requires at least 27/30 and no incorrect critical question. A score of 29/30 with one wrong Điểm liệt answer fails. Show the numeric score and explicit failure reason under a versioned profile. Submission replay does not create another result. |
| EXAM-08 | P0 | Turn results into useful review | After finalisation, show incorrect and unanswered questions grouped by bank category, with explanations and relevant videos available. Publish one scored learning result per answered item after submission or expiry, using the final saved choice and original accepted-choice timestamp. Final wrong answers trigger question-specific relearning and next-day review. Final correct answers qualify only under B4. Unanswered items enter a next-day study-gap review, preserving an earlier due date; they do not fabricate a wrong submitted answer, reset learned status, or diagnose a misconception. Finalisation replay cannot duplicate events or change schedules. Mock history stays distinct from lesson history. |

Mock-test performance is evidence about that attempt. It is not a guaranteed exam outcome. A correct exam answer can count as independent recall only if it meets the same review-eligibility rules as other attempts. Reviewing the answer after submission cannot improve the recorded score.

A test score and learning evidence have different purposes. Unanswered critical items still fail the test under its scoring profile. For learning, unanswered items are gaps without evidence of an incorrect submitted choice. Provisional choices and abandoned tests never contribute successes, lapses, or review-stage transitions. A debrief that supplies the answer makes any immediate follow-up a repair check. The next independent recall must satisfy its scheduled delay.

### B7. Persistence, privacy, and recovery

| ID | Priority | Requirement | Acceptance criteria |
| --- | --- | --- | --- |
| DAT-01 | P0 | Identify the learner for saved study | Clearly explain the connection or sign-in needed to save progress. Do not ask learners for database credentials or the owner's MCP secret. If identity is unavailable, do not claim progress is saved. |
| DAT-02 | P0 | Record once and resume safely | Submission retries have stable attempt identity. Replayed requests count once. Concurrent chats retain both attempts without overwriting learner history. Paused review sessions and test attempts can be resumed independently. Reconcile pending queues against saved attempts and newly due items at start, resume, and before a new lesson. Finishing or switching activity cannot clear unattempted review. Apply learning evidence in its original answer-time order rather than request arrival order. |
| DAT-03 | P0 | Make save failures recoverable | Distinguish a scoring result from a successful save. Provide retry without duplicate scoring events. Retain recoverable in-session state and communicate what remains unsaved. |
| DAT-04 | P0 | Minimise external data sharing | Send the teaching MCP the question and necessary confusion context. Do not forward the whole ChatGPT conversation or learner identity by default. Credentials remain server-side. |
| DAT-05 | P0 | Give control of study records | The learner can inspect progress and request deletion of their own saved study data, with a clear confirmation and retention explanation. Product analytics follow a documented consent and retention policy. |

The product needs persistent identity and storage. It does not require WorkOS or Neon as a product-level decision. Existing integration work may be reused after deployment validation.

### C4. Required policy acceptance scenarios

| Case | Expected outcome |
| --- | --- |
| First independent correct at 23:55, early practice at 00:05 | Only the first can count. A new date without the elapsed delay does not establish learned status. |
| Earlier due date falls within 24 hours after help or a mistake | Handle the due attempt without learning advancement and schedule the next recall at the eligibility time. |
| Correct, then a scored mistake, then one eligible correct | One qualifying success since the mistake. The old success cannot restore learned status. |
| Two due independent correct answers on different days after a lapse | Restore that question only. Preserve other family members and history. |
| New chat immediately after help on an unattempted question | No fresh initial-encounter exception. Wait for scheduled delayed recall. |
| Replayed answer or timezone change | No added success, lapse, or queue completion. Elapsed eligibility remains unchanged. |
| Question due in 30 days is flagged confusing | Bring review forward to no later than 24 hours; preserve learned status until a scored mistake. |
| Correct review while personal confusion persists | Keep the flag and cap the next due interval at 24 hours. No endless retry loop. |
| Learner clears confusion after a wrong attempt | Keep the lapse review and qualifying-success requirement. Confirmation is not correctness evidence. |
| Wrong provisional test choice changed to correct before submission | Apply only the final answered result once; no lapse from the earlier choice. |
| Correct provisional choice changed to wrong | Finalisation creates one wrong learning result and question-specific relearning. |
| Unanswered critical item on expiry | Test fails. Record a study gap and bring review forward without inventing a wrong submitted learning answer. |
| Test abandoned for help | No completed independent test result or learning update from provisional choices. Subsequent practice is classified separately. |
| Finalisation replay or finalisation after a long delay | No duplicate evidence. Use the original accepted-choice time for eligibility and ordering. |
| Missing bank explanation and teaching-MCP outage | Use retained approved text. For an unsupported pilot question, state the gap and offer supported material. |
| Conflicted or withdrawn explanation | Preserve bank scoring, disclose the issue, and withhold the disputed verified-teaching claim pending review. |
| Pause review, start mock test, resume in another chat | Keep both activity identities, outstanding review, and the running test deadline. Reconcile newly due items at resume. |
| Speed question belongs to several families | Present its planned attempt once; membership overlap cannot create extra progress. |
| New-question goal is 12 for an untouched full bank | Forecast 50 completed study days and 10 calendar days of capacity within 60; due reviews remain additional throughout. |
| Six reviews and four first submissions completed today | Show review progress 6 and new-question progress 4/12. Wrong or assisted first submissions count once toward coverage, with their learning status shown separately. |
| A covered question is repeated, repaired, or scored wrong | Add no new coverage credit. Apply question-specific learned-state changes independently. |
| Learner selects eight new questions per day | Show 75 required study days and an incompatible 60-day target. Offer alternatives and retain eight until the learner changes it. |
| Learner misses a day or stops after due review | Preserve saved progress, recalculate the forecast from the remaining study calendar, and do not automatically raise the next day's goal. |
| Question 600 receives its first correct answer on day 60 | Show full first-pass coverage while retaining its pending qualifying delayed recall. Do not claim all 600 are learned. |

### E. Decision log (version 0.11 clarification interview)

The grill-with-docs review records owner decisions as they are resolved. Recommendations in unanswered questions remain proposals.

| Branch | Settled policy | Remaining work |
| --- | --- | --- |
| Audience and ordering | Beginners and near-exam candidates; B first; review-first with extended duration; explicit requests override ordering without clearing due work | Validate the actual ChatGPT flows |
| Daily coverage goal | Learner chooses 10, 12, 15, or a custom goal; 12 is the proposed starting recommendation; coverage and delayed learning remain distinct | Implement EXP-11 and validate forecasts and review burden |
| Learning evidence | Two qualifying independent correct answers on separate days since the latest wrong result; first qualifying encounter plus eligible delayed recall; at least 24 hours between successes | Implement and verify B4 with a controlled clock |
| Confusion | Explicit card or conversational flag; bring review forward within 24 hours and repeat daily until learner confirmation; keep correctness-based status separate | Verify due dates, flag persistence, and learner confirmation |
| Question families | Eighth category with all saved families available for discovery; three personalised suggestions; approved focused comparisons and per-question progress | Editorial and visual review; demonstrate EXP-10 |
| Sources | Authorised teaching MCP supplements approved retained text; external timestamped YouTube links; honest pilot gaps | Inspect the MCP contract and storage rights; resolve teaching coverage |
| Mock assessment | Library and random modes; 30 questions, 20 minutes, at least 27 correct, no wrong critical answer; finalised answered results update learning once; unanswered items are study gaps | Obtain library and composition rules; verify finalisation and recovery |
| Evaluation | Separate exact recall, transfer, review completion, lesson completion, pauses, and overrides | Confirm proposed pilot thresholds after baseline measurement |

The owner requested a bank-wide catalogue of related questions and confusing distinctions, including age, licence permissions, and speed variants. Catalogue membership indicates a teaching relationship, not personal confusion. Q6 confirmed all due review first with extended duration. Q7 confirmed question-specific relearning after an independent mistake. Q10 extends this to any submitted wrong answer, including assisted attempts. Viewing an answer without submitting a choice is not itself a wrong attempt. Q8 confirmed the card action plus conversation for personal confusion, with learner-confirmed resolution. Q9 confirmed that explicit requests may bypass review-first ordering. Briefly note outstanding review, honour the requested lesson or mock test, and retain pending review unchanged. Q6 through Q10 are settled. The owner then authorised resolving all four high-priority review gaps and revising the PRD. Version 0.9 encodes those resolutions and the supporting discovery, lesson, recovery, measurement, and editorial corrections. Remaining work includes integration investigation, editorial review, pilot criteria, and implementation validation. Policy resolution is not evidence that a release gate has passed. Technical feasibility and available source metadata are investigation tasks, not preferences for the owner to guess.
