# ChatGPT learning experience design

6 October 2026. Design proposal based on [PRD version 0.11](product-requirements.md). The owner approved the interaction direction on 6 October 2026, then rejected the first visual prototype as confusing because it had too many buttons and navigation choices. This revision simplifies the daily flow. The owner subsequently selected visual direction B on 6 October 2026. The direction-B contract now governs course entry, navigation, progress presentation and shared visuals. Actual ChatGPT host validation remains pending before production implementation.

## Accepted course entry

Direction B opens a course overview with category coverage and a separate Continue today area. Compact top navigation exposes course, review and tests directly. This supersedes the earlier plan-first entry and hidden global navigation described below. Focused teaching still uses one main action, a distinct explanation area and contextual help. The sample returning learner has a 12-question goal; this does not auto-save a preference for a first-time learner.

Category and group summaries derive from one original-question record per question. A question in several groups contributes once to overall coverage. Immediate correctness and delayed mastery remain separate. See [direction contract](ui-ux-direction-b-contract.md).

## Scope and review sequence

Design every learner flow inside ChatGPT. Conversation is the teaching space. Interactive cards handle precise input, original images, progress, and test navigation. YouTube opens externally. The playground is a design and development test surface only.

This proposal maps the full experience and details the daily learning flow. Review that direction first. Then create one representative desktop and mobile visual sequence before expanding all screens. Mockup examples must identify synthetic history and timing values. Original question wording and keys come from the bank. Source titles, quotations, and timestamps must not be fabricated.

Design stages:

1. Agree on the interaction structure and daily flow in this proposal.
2. Compare representative visual directions inside a ChatGPT conversation frame.
3. Detail first visit, category discovery, source help, and recovery states.
4. Detail timed test, debrief, and cross-chat resume.
5. Validate the prototype in the actual ChatGPT host before production implementation.

## Considered interaction approaches

| Approach | Learner experience | Tradeoff |
| --- | --- | --- |
| Compact cards with conversational coaching | A focused card handles the current task. ChatGPT explains, asks useful reasoning questions, and offers the next step between tasks. | Requires careful coordination of active question, card state, and conversation. Recommended. |
| Persistent lesson workbook inside one large card | One card contains a plan, questions, explanation panels, and progress. ChatGPT supports discussion around it. | Can feel organised, but long panels and nested navigation compete with mobile reading and the teaching conversation. |
| Conversation with minimal cards | Most learning happens in messages, with small answer controls and image cards. | Conversational flexibility is strong. Repeated long stems and a 30-question navigator are harder to manage. |

Use compact cards with conversational coaching for normal study. Give mock tests a distinct focused card with a persistent test navigator. Keep the shared typography, question controls, feedback, and source presentation consistent.

## Simplified navigation after prototype feedback

The first visual prototype exposed too many simultaneous routes. Its daily plan had four card actions plus four repeated conversation shortcuts. The revised design uses one primary action per study step. Optional activity changes appear only after opening a context menu or through an explicit conversational request.

The normal path is goal selection, daily plan, independent review, feedback with teaching, related application, recap, and an explicit finish. Feedback presents the supported distinction directly. Opening a separate comparison page is optional and never a prerequisite for understanding a mistake. The phase strip explains position without acting as navigation tabs.

Goal choices are radio selections followed by one Continue action. Choosing Custom reveals a number field and forecast on the same screen. Selecting an answer still requires explicit submission. Optional confidence uses one unchecked "Tôi đang đoán" checkbox; absence of that signal remains unknown confidence.

Remove the repeated global shortcuts and the simulated navigation sidebar. Keep the teaching question and next action above global statistics. Put detailed progress behind "Xem tiến độ". The plan's "Tùy chọn khác" gives access to goal editing, categories, and tests. During questions, "Hỗ trợ hoặc tạm dừng" exposes hints, personal confusion, and pause. Source help stays contextual and returns to the same step. No optional menu should force a switch of activity simply to answer a question about the current task.

The timed test retains visible Previous and Next controls because revisiting provisional choices is part of assessment. Its 30-question index expands on demand. Submission and exit-for-help are in the test options. The deadline and current position remain visible. Confirmations still offer a clear way to return.

This revision reduces visible routes; it does not remove learner control, review-first ordering, personalised assembly, category access, source provenance, or saved-state requirements. Access to optional actions and discovery of help must be checked with learners in the next usability review.

## Interaction model

| ChatGPT conversation owns | Interactive card owns |
| --- | --- |
| Clarifying learner goals and interpreting requests | Choosing an answer and explicitly submitting it |
| Explaining why this question matters today | Original question text, options, and image enlargement |
| Asking a useful reasoning question | Visible phase, item position, and saved state |
| Explaining a supported distinction and adapting practice | Simple choices for help and personal confusion |
| Summarising learning and discussing the next plan | Test timer, answer navigator, and final submission |

A card action identifies its session, question, and intended action. The assistant responds in that context. Typing an answer or request remains an equivalent path. Do not make the learner repeat a question number merely to ask why an answer was wrong.

Older cards remain readable as history. Submitted learning answers cannot be overwritten. If an old unsubmitted card no longer matches the active task, label it as a previous step and offer a return to the active task. Preserve deliberate resume of a paused activity and revisiting questions within an active test.

## Full flow map

| Flow | Entry | Main steps | Exit or continuation |
| --- | --- | --- | --- |
| First visit | Tôi mới học bằng B | Short goal conversation; choose daily coverage goal and deadline; explain saved-progress connection when needed; offer diagnostic or first lesson | Begin an approved introductory lesson or diagnostic without a long form |
| Daily return | Học tiếp hôm nay | Fetch history; show review count and separate time estimates; review first by default | New lesson after due work, or a requested activity override |
| Daily review | Ôn tập hôm nay | Independent attempt; feedback; optional targeted repair; save schedule | Review summary, next due dates, and an offer to learn something new |
| Guided new lesson | Start recommended lesson | Name distinction; initial attempt; supported comparison; related application; recap | Save qualifying evidence and future review without claiming instant mastery |
| Personal confusion | Tôi còn phân vân | Record flag on the intended question; offer a focused explanation; schedule within 24 hours | Keep flag until explicit learner confirmation; preserve correctness-based state |
| Category discovery | Học biển báo or browse categories | Eight categories; three suggested groups in the custom category; conversational search | Start the chosen lesson; an explicit start can override due review |
| Free question | Tôi hay nhầm hai biển này | Identify source questions; retrieve supported teaching; compare relevant aspects | Related practice or return to the active lesson |
| Source explanation | Explain more or request video | Approved text with source references; offer an actual linked segment when available | Open YouTube externally, then resume the same study step |
| Near-exam study | Tuần sau tôi thi | Show due review, weak distinctions, and critical gaps; propose repair or assessment | Targeted lesson or mock test without a pass-probability claim |
| Library test | Cho tôi làm đề số 3 | Resolve exact library entry; show profile and start confirmation | Timed attempt or an honest unavailable-library state |
| Random test | Tạo đề ngẫu nhiên | Freeze 30 applicable unique questions; show random-bank practice label and profile | Timed attempt after explicit start |
| Test debrief | Submit or timer expires | Numeric score; configured pass rule; final answered mistakes and unanswered gaps | Question-specific repair and next-day review |
| Resume | Tiếp tục bài hôm qua | Retrieve saved review, lesson, or active test; resolve ambiguity only if needed | Resume accepted state; expired test finalises rather than restarts |

## First-visit goal chooser

Ask how the learner wants to pace new questions. Offer radio choices with the arithmetic visible, a Custom choice with an inline number field, and one Continue action. Keep the choice in the ChatGPT conversation. The 60-day plan covers first-pass study of the bank; qualifying delayed recall has its own progress.

| Card | Visible explanation |
| --- | --- |
| 10 câu mới/ngày | 60 ngày học để đi hết 600 câu. Không có ngày dự phòng trong kế hoạch 60 ngày. |
| 12 câu mới/ngày · Đề xuất | 50 ngày học để đi hết 600 câu. Còn 10 ngày trong kế hoạch 60 ngày để linh hoạt hoặc củng cố. |
| 15 câu mới/ngày | 40 ngày học để đi hết 600 câu. Còn 20 ngày trong kế hoạch 60 ngày; khối lượng học mới mỗi ngày cao hơn. |
| Tự đặt mục tiêu | Enter a positive whole number, then show required study days and the calendar forecast. |

Supporting copy: "Câu ôn tập đến hạn được tính riêng và ưu tiên trước bài mới. Học hết lượt đầu chưa có nghĩa là đã nhớ vững cả 600 câu."

Do not save the proposed 12-question choice as the learner's preference without their selection. Accept equivalent messages such as "Mỗi ngày 10 câu mới" or "Tôi muốn học xong trong 60 ngày". For a deadline-only request, propose the choices and let the learner select a goal. Offer a custom study calendar when relevant; avoid a compulsory setup form. A goal of eight shows 75 required study days for an untouched bank and a later projected finish.

Show time estimates separately from question quotas. Explain that reviews and deeper teaching may extend the session. The recommended count provides calendar flexibility; its suitability and daily workload need learner testing.

## Goal changes and missed days

The daily plan offers "Đổi mục tiêu". ChatGPT also accepts "Giảm còn 10 câu mới/ngày" or a changed exam date. Save the chosen change and show its effect on remaining coverage and the finish forecast. Do not restart coverage or discard the review schedule.

If the current pace no longer fits the deadline, explain the arithmetic briefly and offer keeping the pace with a later finish or adjusting the goal or study days. Do not automatically add yesterday's unfinished quota to today. A review-only session is a valid saved activity; show that its new-question goal remains unfinished. Count new-question progress once per original ID, even across families or chats. First-pass wrong or assisted answers receive coverage credit with their distinct learning status visible. Provisional or abandoned test choices receive no credit.

## Representative daily learning sequence

The following counts and durations illustrate layout. They are synthetic examples, not measured estimates or learner results.

### S01. Daily plan

ChatGPT gives a short welcome back and explains the recommendation. The card shows the plan rather than a permanent statistics dashboard.

```text
Hôm nay

Mục tiêu câu mới hôm nay        0/12 câu
Đã học lượt đầu                 120/600 câu
Đã nhớ qua kiểm tra cách ngày   84/600 câu

Ôn tập đến hạn                 6 câu · khoảng 8 phút
Sau đó học                    Phân biệt điều kiện tốc độ
Bài mới                       Khoảng 15–20 phút

Hôm nay có thể cần thêm thời gian để ôn hết câu đến hạn.

[ Bắt đầu ôn tập ]
Tùy chọn khác ▸ đổi mục tiêu, chọn chủ đề, thi thử
Xem tiến độ ▸ số câu mới, lượt học đầu, kiểm tra cách ngày
```

The synthetic 120-question coverage and 84 learned-question counts illustrate separate measures. Show the selected goal and explain the learned measure on request. A first completed submission counts toward coverage even when wrong or assisted; a review cannot add coverage again. Completing a focused lesson may cover only part of the daily goal. Offer another focused lesson if the learner wishes to continue.

The primary action begins due review. Category browsing does not itself change due dates. An explicit lesson start or test request changes activity and leaves pending review due. Do not add another confirmation solely for that override. A mock test still has its own start confirmation.

If there is no due review, replace the primary action with the recommended new lesson. If preferences are unknown, ask only what changes the next useful step. If progress could not be loaded, say the plan is not yet personalised and offer retry or an honest unsaved activity where supported.

### S02. Independent question

Keep one active question visible. Preserve the full original stem and options. Avoid a wall of summary metrics above it.

```text
Ôn tập · Câu 2/6
Đến hạn hôm nay

[Full original bank stem]
[Original image when present]             [ Phóng to ]

○ A  [Original option]
○ B  [Original option]
○ C  [Original option]

[ Trả lời ]
☐ Tôi đang đoán
Hỗ trợ hoặc tạm dừng ▸ phân vân, gợi ý, tạm dừng
```

Selecting an option does not automatically score it. Submit is disabled until a choice exists. Confidence is optional and shown only when useful, as an optional Tôi đang đoán checkbox. A request for help before submission visibly marks the attempt as assisted. A confusion flag can be set before or after answering and does not itself imply a wrong answer.

The learner can answer by typing A, B, or the option text. If the selection is ambiguous, clarify before scoring. Any answer-letter display must retain an exact mapping to the original option key.

### S03. Feedback and diagnosis

After deterministic scoring, the card marks the submitted choice and the bank's correct option with text and icons. It shows a brief verdict and save status. ChatGPT handles the teaching conversation immediately below.

```text
Chưa đúng
Lựa chọn của bạn: B
Đáp án trong ngân hàng: A

Đã lưu kết quả · Câu này sẽ được ôn lại theo lịch mới

[Supported explanation or comparison appears here]
[ Ôn câu tiếp theo ]
Tùy chọn khác ▸ phân vân, nguồn giải thích
```

The displayed letters illustrate feedback format, not a specific question result. Actual verdict and due date come from the plugin.

For a mistake, the assistant names the likely distinction only when supported and asks a short reasoning question when needed. An easy independent correct answer receives concise feedback. A correct guess gets encouragement to check the distinction without being counted as durable learning. After an assisted correct answer, use a neutral state such as Đúng sau hỗ trợ.

If saving fails, show Đã chấm câu trả lời · Chưa lưu tiến độ and a retry action. Scoring success cannot masquerade as successful persistence.

### S04. Comparison teaching

The feedback step introduces the shared topic and changing condition directly, with a compact supported comparison in the card or adjacent conversation. A separate expanded comparison remains optional. The comparison shows approved explanations and relevant original images or conditions. Keep a small set of variants, rather than all members of a broad family.

Use q145 and q146 as candidate layout examples because they ask related speed conditions. The final mockup must preserve their original wording and use approved teaching support. The family analysis is not itself an approved explanation.

After teaching, show a deliberate application prompt, such as Bây giờ thử câu có điều kiện khác. The new card names the aspect being checked. An immediate related application demonstrates understanding; it cannot certify delayed recall of the earlier question.

If the learner's reasoning points to a different confusion, adapt the explanation. If the learner asks for a shorter explanation, reduce the detail. Do not demand a written justification after every answer.

### S05. Source and video help

Show approved source provenance without putting integration details into the learning interface. An actual matched video segment has its source title, intended time range, and a single clear external action, Mở YouTube tại đoạn này.

Keep the active study step saved. When the learner returns with Tiếp tục, resume it and offer an application check. Do not claim to detect completed viewing. The intended segment end is a reading cue, not a guarantee that external playback stops there.

If no real matched segment exists, explain that there is no linked clip for this question and continue with approved text. A visual mockup must not manufacture a teacher, quotation, video link, or timestamp to fill this state.

### S06. Completion and next step

The summary distinguishes finishing review from completing a new lesson. It names what was demonstrated and what still needs delayed evidence.

```text
Đã hoàn thành ôn tập

[Evidence-backed gain or remaining distinction]
[Independent, assisted, uncertain, and skipped results]
[Saved next review dates]
[Câu mới hôm nay: actual unique first-pass submissions / chosen goal]

[ Bắt đầu bài mới ]
Tùy chọn khác ▸ kết thúc hôm nay
```

For a new lesson, show a concise recap and a useful next review plan. Use Đã hiểu bước đầu for immediate application when appropriate. Show Đã học only when the saved qualifying criterion is met. Do not use a celebration to imply that one coached response established mastery.

If confusion remains, keep its flag visible and ask whether the distinction is clearer after relevant coaching. Learner confirmation can clear the flag, but does not replace independent evidence or cancel scheduled lapse review.

## Mock-test interaction

Keep testing visually and behaviourally distinct from coached practice.

- Before starting, show library or random origin, 30 questions, 20 minutes, at least 27 correct, and the critical-question failure rule. The frozen profile is practice configuration. Do not claim validated official composition for a random set.
- Use an explicit Bắt đầu tính giờ action. The timer begins after accepted start, not when the test preview appears.
- Keep remaining time, Câu X/30, answered count, and the question navigator visible within the test card. Navigator cells distinguish current, answered, and unanswered without revealing correctness.
- In the test, use Lưu và tiếp theo and Câu trước. Editing a choice updates provisional state only. Save acknowledgement is visible.
- Nộp bài opens an in-card confirmation with the unanswered count and actions Quay lại làm tiếp and Nộp bài. Completion or expiry finalises once.
- A help request offers the consequence clearly. To receive coaching, the learner exits the independent test. Do not silently supply a hint or erase the running attempt.
- At expiry, reject further choices and show the final result on the next interaction. Refresh or a new chat cannot restart the timer.
- Debrief answered mistakes separately from unanswered gaps. A high numeric score with a wrong critical item must show the explicit failure reason under the selected profile.

A test card can be denser than a lesson card. Its navigator and action row must remain usable on mobile. No lesson-style source help, correctness colours, or confusion action appears in the active independent test.

## Shared UI behaviours

| Element | Design requirement |
| --- | --- |
| Primary action | One clear next action per study state. Use task-specific wording rather than generic Next. |
| Secondary controls | Help and pause remain visible without competing equally with the main action. |
| Navigation | Independent question navigation is contextual. Review advances through scheduled items; tests allow explicit revisiting. Preserve access to previous learning content without resubmitting its score. |
| Hover and focus | Text stays readable in normal, hovered, active, disabled, and focused states. Verify contrast for every shared button style. |
| Feedback | Use labels and icons alongside colour. Distinguish wrong, correct independent, assisted correct, uncertain, and unsaved. |
| Progress | Show phase and session position. Keep question-level learned status, personal confusion, and due review distinct. |
| Sources | Show readable provenance on demand. Do not expose MCP endpoints, vendor names, or retrieval diagnostics in ordinary learning copy. |
| Images | Original image with a clearly labelled enlargement action. Preserve aspect ratio and label the source question. Reviewed teaching highlights are separate from scored originals. |
| Mobile | Stack comparison columns, keep answer rows easy to tap, and place the primary action predictably. Avoid multiple independent scroll regions. |
| Theme | Match the host's light and dark presentation. Use restrained colour for state, with readable text on every background. |
| Text fallback | Learners can answer, ask for help, pause, choose categories, and resume through conversation when cards are unavailable. |

## Recovery states

| State | What the learner sees | What stays preserved |
| --- | --- | --- |
| Saved identity unavailable | Explain whether progress can be saved and offer the actual connection path | Current question and clearly marked unsaved activity where supported |
| Progress load failure | Chưa tải được tiến độ; retry and an honest limited plan | Saved state is not overwritten by empty data |
| Answer save failure | Scored verdict plus Chưa lưu tiến độ and retry | Stable attempt identity and recoverable answer |
| Missing approved explanation in pilot | Honest teaching gap and a supported alternative | Original question, bank verdict, and saved review |
| Teaching MCP unavailable | Approved retained text and an optional retry | Review and lesson continue without fabricated sources |
| No or removed video segment | Text explanation and an honest unavailable-video message | Active lesson and question |
| Draft or unreviewed image family | Distinguish raw question access from unavailable approved comparison teaching | Original image and bank content |
| Previous card is stale | Previous-step label and return to current activity | Historic answers and deliberately paused activities |
| Library not supplied | Clear unavailable-library state and random-practice option | No invented library test or silently substituted membership |
| Test expires while the learner is away | Finalised score and debrief on return | Original deadline, final accepted choices, and one finalisation |

## Visual direction proposed for the first mockup

Use a restrained learning notebook within ChatGPT. Keep compact cards, generous reading space, a strong question hierarchy, and clear task-specific buttons. Match host light and dark modes. Use green for supported success, amber for unresolved uncertainty, and red for incorrect feedback. Never communicate a state through colour alone.

The learner should see the question, its purpose today, and the next meaningful action before seeing global statistics. The representative visual sequence should include the plan, independent question, incorrect feedback, a focused comparison, an application check, and completion. Show a mobile variant of the question and comparison.

These visual choices are a proposal. Host-specific card sizing, conversation handoff, enlargement, theme integration, and state rehydration must be verified during prototype development.

## Design acceptance and open review

This proposal follows the PRD's confirmed ordering, explicit overrides, qualifying evidence, personal confusion, external video, and mock-test policy. It introduces no new learner-facing website or infrastructure setup.

Before expanding all screens, review whether the compact-card sequence and conversational teaching feel useful. Then review an actual representative visual direction. The brainstorming skill requires an approved design before implementation. The visual prototype is a review artifact; it does not establish that integrations or learning outcomes are complete.


## Historical first prototype and revised visual direction

The owner approved this proposal on 6 October 2026, including learner-selected daily goals. The isolated [clickable prototype](../design/chatgpt-learning/index.html) and [review guide](../design/chatgpt-learning/README.md) show the first representative visual direction. It simulates the ChatGPT frame for design review; it is not a separate learner website or an integrated plugin release.

Browser observations covered the custom eight-question forecast, explicit answer submission, incorrect feedback, source fallback, stacked mobile comparison, light and dark question layouts, assisted application, pause/resume, explicit confusion clearing, and a recap with review 1/1 separate from new coverage 1/12. The mock-test navigator retained a selected answer on return; submission confirmed 29 unanswered items, and debrief separated those gaps from answered mistakes. Keyboard navigation displayed a solid focus outline. The selected 32 question records matched the original bank without changes.

The application question is marked assisted because the comparison already exposed its answer. Sample history, timing, and progress remain visibly labelled. The prototype has no production identity, scheduling, source retrieval, or durable saving. Hover rules retain contrasting text colours in CSS; pointer-hover rendering and assistive-technology validation remain unverified. Source videos, full category teaching, image enlargement, cross-chat resume, and host-specific ChatGPT behaviour require the next integrated prototype.


### Revision 2 observation

The revised prototype completed goal selection, review, inline teaching, assisted application, recap, and an explicit finish in browser review. Custom goal entry stayed on the same screen. Help and pause remained reachable through the collapsed menu, and pause/resume retained the application step. Tests remained accessible through plan options, with a collapsed navigator and visible Previous and Next. Original questions and temporary-progress disclosures remain intact. This is interaction verification by the builder, not evidence that learner confusion has been resolved.

The owner requested a distinct visual box for explanations and things to remember. Use a soft theme-aware background, rounded outline, accent edge, and clear heading. Key values stand out within the box. This changes presentation without adding navigation or changing teaching conditions.

### Selecting a confusing-question subcategory

Opening “Câu hỏi dễ nhầm lẫn” leads to a searchable list of the 249 saved families. Each row has a radio choice, title, original-question count, and image indicator. Search accepts unaccented Vietnamese or a question number. One Continue action opens the selected group overview with comparison scope and an expandable member list. The prototype can then show that family’s original questions and supplied bank explanations in sequence. It retains selection when returning to discovery. These trials are temporary and do not certify mastery, generate personalised lessons, or update review schedules. Comparisons shown before answering make this assisted practice. Draft and visual-review status remain visible.

### Revision 3 visual consistency

Applied Impeccable 4.5.0 polish guidance in Operate mode to the isolated prototype. Retain the single activity, green action/selection colour, explicit answers, and boxed teaching. Use one sans family with a fixed scale, readable secondary text, row-based discovery and goal choices, consistent button and input shapes, and one activity surface. Context appears below the heading rather than as an uppercase kicker. Explanation boxes use a solid tinted background with strong key values. Shared theme tokens own state colours. A new step scrolls its introduction into view and focuses its heading; selecting an answer preserves its local focus. This is visual refinement of the design artifact, not a production integration or validated learning outcome.
