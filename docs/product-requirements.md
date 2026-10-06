# Lý Thuyết Lái Xe: product requirements

Version 0.11 · 6 October 2026 · Draft for product, design, and engineering review.

This document defines the next product, not the capabilities of the current proof of concept. Confirmed direction comes from the product discussion. The owner authorised resolution of the review findings. Sections B3, B4, and B6 specify the resolved teaching, learning, and assessment policies. Pilot targets remain proposals. The external knowledge-base contract remains unverified. The owner confirmed external timestamped YouTube links as the video experience.

## Product brief

### Problem

Vietnamese car-licence candidates need to understand their mistakes and remember the relevant distinctions until their exam, but the current question-by-question experience leaves them to organise study and decide whether they have learned enough.

The audit observed an endless question flow, static feedback, and no lesson objective or diagnostic. The review code treats immediate correct retries as progress. These observations support a product hypothesis, not a measured claim about learners' retention or abandonment.

### Who and what they need

| Learner | Job to be done | Successful experience |
| --- | --- | --- |
| First-time candidate | Understand unfamiliar concepts and build a study habit | Complete a manageable lesson, explain the distinction, and know what to study next |
| Candidate near the exam | Find weak areas and stop repeating mistakes | Prioritise overdue recall, critical questions, and targeted practice without losing overall coverage |

Vietnamese is the primary teaching language. The owner confirmed licence B for the first release. The bank remains the authority for question applicability. Other licence-specific preparation requires separate validation.

### Product promise

Each session helps the learner understand a previously confusing concept, check it independently, and return to it before forgetting.

### Direction and boundaries

Deliver a guided learning coach inside ChatGPT. Conversation handles explanation and learner reasoning. Compact interactive cards handle questions, images, source segments, and session progress. The normal new lesson lasts approximately 15–20 minutes. Complete all due review before starting new learning by default. Honour an explicit request to start a different lesson or mock test after briefly noting outstanding review; keep those items due. The owner accepts extending the total session beyond that duration when review needs more time. Show the estimated review and lesson time separately, with pause and resume available.

The first release includes category-based guided lessons, daily spaced review of mistakes, approved explanations through an external MCP knowledge base, timestamped YouTube segments, saved learner progress, and timed mock tests. Mock tests have a supplied-library mode and a random mode. The playground is a development test harness. No learner journey depends on visiting it.

The question bank controls original wording, options, images, and scoring. The owner-approved knowledge base supplies explanations and tips. ChatGPT adapts those materials without inventing source claims or changing answer keys.

### Why this direction

Guided coaching addresses both understanding and daily study choices. A challenge game alone can reward activity without recall. An exam simulator alone provides too little instruction for beginners. Use challenges and exam practice within the learning coach, with different pacing for the two audiences.

### Success

The primary learning outcome is delayed, unassisted recall. Supporting product outcomes are lesson completion and voluntary return. Proposed pilot thresholds are in Appendix C. None is an existing baseline or a promise of exam success.

### Delivery appetite

Propose a six-week initial delivery window after scope approval and availability of the knowledge-base connection. Use the first two weeks to validate one complete lesson inside ChatGPT. Use the remaining window for persistent review, coverage, and a closed pilot. This is an initial appetite, not an engineering estimate. Replan after the first prototype and integration probes. Broad release depends on the gates below, even if the window expires.

### Decisions needed before build commitment

- Confirm the proposed pilot targets after baseline measurement. Licence B and the learning-policy resolutions are settled.
- Inspect the knowledge-base MCP tools, authorisation, source metadata, and timestamps.
- Verify that source-derived timestamped YouTube links open externally from the actual ChatGPT host and that the study session can resume.
- Assign editorial review responsibility and estimate full-bank teaching coverage.
- Confirm the production identity and persistence approach. The learner experience must not depend on a specific vendor.
- Obtain the supplied mock-test library and its category-composition rules. The owner confirmed that any incorrect critical-question answer causes failure regardless of total score.

## Appendix A. Experience and scope

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

The [question-family catalogue](question-family-analysis.md) records source-grounded families and comparison dimensions across the bank. The full-bank textual pass records 249 overlapping families covering 598 questions and two explicit singletons, accounting for all 600 IDs. 132 families require visual review. All mappings remain draft analysis. Families appear beneath "Câu hỏi dễ nhầm lẫn" and also support lessons in the original categories. They must preserve original question IDs, conditions, and images. They can overlap. A comparison of licence permissions must not conflate licence issuance age with permission to drive a specific vehicle. Image-dependent distinctions require visual review before approval. Catalogue coverage and teaching approval are separate. The [ChatGPT family guidance](chatgpt-question-family-guidance.md) records the proposed tutor instructions and the integration handoff. These saved documents are not yet exposed by the running plugin.

### A2. The daily lesson

The owner confirmed review-first ordering. Complete the due queue before starting a new lesson by default, even when this extends the total session. If the learner explicitly requests another lesson or a mock test, briefly mention outstanding reviews and start the requested activity. Do not require a second confirmation solely for the review override. Keep pending reviews due and retain their schedules. The learner may pause and resume; remaining due review must not silently disappear to fit a time cap. Completing review means handling its scheduled attempts and recording the resulting schedule, not answering every item correctly through repeated retries. Mistakes receive repair and delayed review rather than an endless same-session loop.

The following timing is a design hypothesis for a small queue, not a fixed quota:

| Step | Approximate time | Learner activity |
| --- | ---: | --- |
| Recall | Variable; approximately 3 minutes for a small queue | Complete all due review attempts before new learning; receive coaching after each attempt as needed |
| Understand | 5 minutes | Investigate one distinction using approved explanation and optional video |
| Apply | 6 minutes | Answer original questions, compare examples, or identify an image clue |
| Check independently | 3 minutes | Apply the concept to a different bank question without help |
| Finish | 1 minute | Review demonstrated gains, unresolved gaps, and the next review plan |

Adapt to the learner's pace. Do not require a reasoning conversation after every easy answer. A learner can ask for less detail, more explanation, a hint, or a related question. Show progress through the review queue and explain when the combined review and new lesson will exceed the original estimate. The learner can stop or pause at any point. An incomplete due queue resumes before new learning by default. An explicit learner request may override that order without clearing the queue.

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

### A3. ChatGPT user flows

All example dialogue below describes intended behaviour. It is not a transcript of an implemented feature.

| Flow | Learner entry | Interaction in ChatGPT | Completion |
| --- | --- | --- | --- |
| First visit | "Tôi mới học bằng B, mỗi ngày có 20 phút." | Confirm licence, experience, optional exam date, and time. Offer 10, 12, 15, or a custom daily new-question goal and explain the 60-day forecast. Offer a short diagnostic or immediate lesson. Render question cards and explain the proposed focus. | Save preferences and a limited initial assessment. Do not label a short diagnostic as comprehensive readiness. |
| Daily study | "Học tiếp hôm nay." | Fetch saved state and show due-review count, estimated review time, daily new-question goal, remaining coverage, and the proposed new lesson. Complete due review first, then move to new learning by default. Honour an explicit request to change activity and retain outstanding reviews. Explain any extension beyond 15–20 minutes. Alternate cards and conversation. | Summarise independent performance, help used, remaining gaps, and next review. |
| Daily review | "Ôn tập hôm nay." | Fetch due questions. Give recall attempts first. Coach mistakes, offer relevant clips, and check understanding later in the session. | Save results and future due dates. Complete the due queue even when the duration extends, or save remaining items for explicit pause and resume. Offer new learning after review is complete. |
| Explain a mistake | "Tại sao tôi chọn C lại sai?" | Confirm the active question and choice. Retrieve its verdict and supported teaching material. Ask one reasoning question when needed. Explain the distinction with provenance. | Offer another original question or return to the lesson. |
| Watch explanation | "Cho tôi xem đoạn thầy giải thích câu này." | Retrieve an actual matching source segment. Show title, source, timestamp range, relevance, and a timestamped YouTube link. The learner clicks to open YouTube externally. | Retain the study step while the learner watches externally. On their next message, offer an application check. Do not claim to detect whether they watched. Viewing alone does not establish learning. |
| Ask freely | "Tôi hay nhầm hai biển này." | Retrieve applicable questions and explanations. Compare original images and supported distinctions. Offer a clue-finding or explanation activity. | Link the concept back into the lesson or review plan. |
| Category lesson | "Hôm nay học biển báo." | Select the `bien_bao` pool, show its learning progress, and build a manageable lesson using original bank questions and approved teaching material. | Save progress against that category and offer its next lesson or due review. |
| Confusing-question lesson | "Học câu hỏi dễ nhầm lẫn." | Open the eighth category, "Câu hỏi dễ nhầm lẫn". Offer three personalised family suggestions with selection reasons, such as age, licence scope, speed conditions, or similar signs. Allow conversational search across the complete catalogue. Use approved focused distinctions for teaching; distinguish draft mappings from approved lesson content. Use saved history to propose a focused comparison lesson. Preserve each member's original category and review status. | Save question-level results and offer relevant due review. Do not mark the entire family learned from one answer. |
| Near-exam preparation | "Tuần sau tôi thi, giúp tôi tập trung." | Adjust the plan toward mixed recall, weak categories, and critical questions. Offer a mock test or a focused repair lesson. | Debrief errors and create targeted repair lessons. Avoid unvalidated pass probabilities. |
| Supplied mock test | "Cho tôi làm đề số 3." | Retrieve that exact test from the owner's supplied library. Confirm the 30-question, 20-minute profile, then start a timed question card with an answer navigator. | Submit early or finalise at the deadline. Show score, pass/fail under the configured rule, and repair options. |
| Random mock test | "Tạo một đề ngẫu nhiên." | ChatGPT requests a random test from the bank. Freeze 30 distinct applicable questions, show the test profile, and start only after confirmation. | Score against bank keys, identify the attempt as random, and send mistakes into spaced review. |
| Resume in another chat | "Tiếp tục bài hôm qua." | Retrieve the latest saved session for the same learner. If multiple sessions exist, identify the intended one. | Resume without replaying scored submissions or silently discarding study state. |

### A4. Scope by stage

| Stage | Required outcome | Content boundary |
| --- | --- | --- |
| Functional prototype | One complete ChatGPT lesson with coaching, sourced video, independent check, and a return review | Approximately 10–15 carefully reviewed questions. Explicitly limited content. |
| Closed pilot | Both audience paths, saved progress, daily review, external knowledge retrieval, and random mock tests work together. Validate library mode once its dataset is supplied. | All 600 questions retrievable. Guided teaching limited to an explicitly listed reviewed subset. |
| Initial broad release | All P0 requirements and launch gates pass in ChatGPT | All 600 questions accounted for in the learning map. Every question has an approved text explanation retained by the plugin and available during teaching-MCP outages. Unresolved teaching gaps block broad release as a sole learning resource. |

P0 denotes a release requirement. P1 denotes a subsequent improvement or a feature dependent on separately validated content. P1 must not delay the central learning loop.

Out of scope for the initial release: a learner-facing standalone website, learner configuration of infrastructure credentials, leaderboards, punitive streaks, push notifications, voice tutoring, generated official questions, animated traffic simulations, and a claim to provide live driving or legal advice. Daily review is learner-initiated in ChatGPT. Automatic reminders are a separate future opt-in feature.

## Appendix B. Requirements and acceptance criteria

### B1. Core experience

| ID | Priority | Requirement | Acceptance criteria |
| --- | --- | --- | --- |
| EXP-01 | P0 | Operate entirely through ChatGPT | First lesson, answer submission, explanation, review, summary, and resume can be completed inside ChatGPT. No playground URL is required. An external source video may open through an explicit action. |
| EXP-02 | P0 | Personalise without lengthy onboarding | Licence, experience, optional exam date, study duration, timezone, daily new-question goal, and target date can be set or changed conversationally. Diagnostic is optional. Unknown values remain unknown. |
| EXP-03 | P0 | Make review-first sessions clear and resumable | Before starting, show the review count, estimated review time, new-lesson objective and duration, and selection reason. Complete due review before new learning by default. Honour an explicit request for another lesson or mock test after briefly noting outstanding review, without requiring another confirmation for that override. Keep pending reviews due. The total duration can exceed 15–20 minutes. Show progress, pause, and finish. Do not truncate the due queue to meet a time cap. Skipping is distinct from an incorrect answer and leaves a due item unresolved. |
| EXP-04 | P0 | Give control over teaching depth | Support hint, simpler explanation, deeper explanation, source video, and related practice requests. Use brief initial feedback with the supported explanation or focused comparison immediately available in that step. Deeper sources remain optional. Do not require free-text reasoning for every question. |
| EXP-05 | P0 | Support useful visual learning | Original images can be enlarged with accessible controls. At least one reviewed visual comparison or clue activity is included in the prototype. Do not alter images used for official scoring. |
| EXP-06 | P0 | Preserve trust and accessibility | Answers work by click and text. Keyboard operation, visible focus, named controls, non-colour feedback, and mobile layouts are tested. Normal study has one primary action per step and no repeated global shortcut rows. Optional activity changes and help use context-specific disclosure or conversation. Supported teaching appears directly after feedback without a mandatory extra navigation step. Phase indicators are noninteractive. Goal selection uses choices plus one Continue action, with custom entry inline. Timed tests retain visible Previous and Next and an expandable question index. Navigation never obscures the answer or silently changes activity. |
| EXP-07 | P0 | Finish with evidence | Summary distinguishes independent answers, assisted answers, uncertain answers, and skipped items. It states remaining gaps and the next review plan. It does not convert activity counts into a readiness score. |
| EXP-08 | P1 | Add richer image guidance | Reviewed highlights and image-region interactions can guide visual reasoning. Generic AI-detected highlights must not determine the official answer. |
| EXP-09 | P0 | Assemble lessons using saved learning history | ChatGPT selects original bank questions within the category path using approved teaching resources, previous independent and assisted attempts, due review state, and known confusion. New learning excludes questions meeting the agreed learned criterion unless the learner explicitly requests them. Repeats for due recall or related application are identified as such. Deduplicate selected IDs across overlapping families. Retrieve selected metadata and relevant questions rather than the complete catalogue. When history is unavailable, disclose the limitation rather than pretend to personalise. |
| EXP-10 | P0 | Complete a purposeful comparison lesson | Name a distinction, elicit an initial attempt, teach with approved evidence, include a comparison or scenario activity, check application with a related original question, and finish with demonstrated gains and the next review plan. When reasoning is unclear, use a concise learner explanation to adapt the teaching. Do not require discussion after every easy answer. The pilot demonstrates a speed-condition lesson and a reviewed sign or scenario lesson. Question navigation and answer reveals alone do not satisfy this requirement. |
| EXP-11 | P0 | Let learners choose and revise a daily coverage goal | Offer 10, 12, 15, and a custom number of new unique questions per study day. Show 60, 50, and 40 study days for an untouched 600-question bank, with 0, 10, and 20 calendar days remaining in a 60-day window. Respect the study calendar and saved history. Display coverage, daily new-question progress, due review, and learned status separately. Deduplicate original IDs, preserve review-first and pause behaviour, and recalculate forecasts without silently raising the goal. Do not guarantee mastery or fixed session duration. See A2a. |

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

## Appendix C. Outcomes and evaluation

### C1. Three primary pilot measures

Targets below are proposed decision thresholds. Confirm them after baseline measurement and before judging the prototype. Do not infer statistical efficacy from a small usability pilot.

| Measure | Definition | Proposed target |
| --- | --- | --- |
| Delayed exact-question recall | Correct unassisted answers on previously studied original questions 7 days after instruction. Predefine intervening exposure and assistance; report them rather than silently pool different review histories. | At least a 10 percentage-point improvement over the draft flow on matched material in a follow-up study designed for a meaningful comparison. |
| Study completion | Report completed review sessions and completed new lessons separately, each divided by starts of that activity. A resumed activity keeps its original identity. A visit may contain both activities. Explicit pauses and overrides are reported separately from abandonment. | At least 75% completion for each activity in the closed pilot. |
| Voluntary return | Activated learners who complete study on at least 3 distinct local days in their first 7 days, divided by activated learners eligible for the full observation window. Activation means one completed lesson or review. | At least 50% in the closed pilot, excluding researcher-directed visits. |

Delayed transfer to held-out related bank questions is a separate diagnostic outcome. Specify the comparison dimension and ensure its answer was not previously supplied. It is not exact-question recall. Match content and exposure before comparing either outcome with the draft flow.

These are learning and engagement hypotheses. Exam pass rate may be collected later as a self-reported outcome, but is not a validated launch claim.

### C2. Research and instrumentation

Begin with 5–8 participants split across the two audiences to find usability and teaching problems. Observe actual use inside ChatGPT. Compare matched content with the draft flow and counterbalance order. Record fatigue and enjoyment alongside behaviour. Plan a larger controlled evaluation for learning claims rather than invent a sample size without variance or effect estimates.

Minimum events are session start, pause, resume, completion, answer, help request, source retrieval, video action, scheduled-review outcome, confusion flag changes, provisional test saves, test finalisation, activity overrides, daily-goal changes, first-pass coverage, and forecast revisions. Record learner-scoped IDs, question and content versions, assistance state, and timestamps. A video click means intent to watch; it is not evidence of completed viewing or learning. Prefer aggregate analytics to retaining free-text conversations.

Guardrails include unsupported teaching claims, answer-key mismatches, false source citations, data-isolation failures, and duplicate submissions. Report coverage, hint use, repeated conceptual mistakes, confident wrong answers, latency, retrieval failures, actual review duration, and sessions with no new learning because review used the available time as diagnostics rather than additional headline success metrics.

### C3. Release gates

1. All P0 acceptance criteria pass in the actual ChatGPT connection. Playground success alone is insufficient.
2. Original content and scoring match the versioned bank across all 600 questions. Relevant images load and remain readable when enlarged.
3. A predefined tutor suite covers incorrect reasoning, correct guesses, missing explanations, conflicting sources, absent clips, off-bank requests, and interrupted sessions. There are no unresolved critical factual or provenance errors in that suite. Report its size and limitations.
4. Two learner accounts demonstrate isolation, saved recall across new chats, restart recovery, and deletion. Submission replay and concurrent-chat cases pass.
5. Controlled-clock cases verify the B4 contract, including 23:55 versus 00:05, an early attempt on another date, timezone changes, correct-wrong-correct sequences, guessed or assisted answers, and question-specific relearning. A long due queue completes before new learning by default, extends the estimated duration, and resumes correctly after pause. Explicit requests can start another lesson or mock test; outstanding reviews retain their due dates and do not produce synthetic completion or answer events. Personal confusion flags survive correct answers and clear only on learner confirmation. A newly flagged question due in 30 days returns within 24 hours; unresolved flags do not create an endless current-session loop. Clearing a flag preserves scheduled lapse review.
6. Video links use real source metadata, open YouTube externally at the intended timestamp, and preserve the active study step for resume. Missing or removed videos have a supported text route.
7. The closed pilot meets usability criteria or has an explicit product decision documenting remaining issues. Do not market proven learning efficacy before the follow-up evaluation supports it.
8. All editorial coverage gaps are visible during the pilot and resolved before broad release. Before broad release, every question has approved retained text available during teaching-MCP outage. Unresolved explanation conflicts and withdrawn approvals cannot masquerade as valid fallback. Validate gap reporting on unsupported pilot questions.
9. Mock-test cases verify 30-question uniqueness, supplied test fidelity, 27/30 boundaries, unanswered items, deadline expiry, answer changes, resume, submission replay, the approved critical-question rule, provisional-choice isolation, wrong-then-correct edits, unanswered gaps, abandoned tests, and finalisation replay. Delayed finalisation cannot create delayed recall from an early choice. Validate random composition honestly and record the practice profile used.

10. Category discovery offers three relevant starting suggestions and conversational search, preserves original taxonomy, and never repeats a question solely because it belongs to overlapping families. Pilot lessons satisfy EXP-10 with approved comparisons, appropriate adaptation, and application checks.

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

## Appendix D. Delivery, ownership, and risks

### D1. Proposed milestones

| Milestone | Proposed window after kickoff | Exit evidence |
| --- | --- | --- |
| Align and probe | Week 1 | Review PRD, assign editorial owner, inspect external MCP, verify ChatGPT messages, external timestamp links, resume, and approved-text fallback rights |
| Complete one lesson | Week 2 | Run one focused comparison lesson inside ChatGPT with approved text, source coaching, an application check, and next-day review; conduct exploratory learner sessions |
| Make daily return real | Weeks 3–4 | Persistent identity, separate activity resume, qualifying attempts, confusion scheduling, spaced review, failure recovery, and both audience paths demonstrated |
| Closed pilot and coverage audit | Weeks 5–6 | Validate random mock tests and supplied tests when available, measure completion and return, start delayed-recall assessment, audit full-bank map and unresolved gaps |
| Broad release | Gate-based | All P0 and editorial gates met; revised estimate after prototype findings |

This window assumes engineering, design, editorial review, and MCP access are available. Content work and receipt of the mock-test library may determine the broad-release date. Mock tests are now part of initial-release scope and require re-estimation. Richer annotations retain separate scope and estimates.

### D2. Responsibilities

- Product owner approves problem, boundaries, target metrics, and release tradeoffs.
- Design owns interaction choices and usability, including ChatGPT cards and mobile behaviour.
- Engineering owns integrations, deterministic scoring and scheduling, persistence, recovery, and host validation.
- Editorial reviewer owns source approval, concept mappings, tips, timestamps, and conflict resolution.

These are responsibilities to assign, not claims that a staffed team already exists. Design and engineering review the PRD before implementation commitment.

### D3. Risks and decisions

| Risk or open decision | Consequence | Next evidence or decision |
| --- | --- | --- |
| Unknown external MCP contract and access scope | Retrieval or timestamp links may be unavailable | Obtain endpoint, non-secret tool schema, and a real timestamped sample result |
| Missing timestamp metadata or removed videos | A useful external clip cannot be opened | Validate source metadata and timestamp links. Keep an approved text explanation available. |
| Incomplete or outdated teaching material | Unsupported explanations undermine trust | Assign source review, effective-date checks, conflict handling, and coverage inventory |
| Unsupported learner interpretation | ChatGPT may teach the wrong misconception | Evaluate reasoning prompts and let learners correct diagnoses |
| Unvalidated interval sequence | Review may be too frequent or too sparse | Measure delayed recall and review burden; keep scheduling policy versioned |
| Friction from connection or sign-in | Learners may not reach the first lesson | Observe activation in ChatGPT; preserve an honest unsaved trial where feasible |
| Broad scope before learning validation | Delivery expands without proving usefulness | Ship one complete lesson prototype before full curriculum expansion |
| Pending mock library | Supplied tests and category composition cannot yet be validated | Obtain the library and validate composition. Apply the confirmed critical-question failure rule. Describe the owner's practice profile without claiming verified official equivalence. |

### D4. Current baseline and source notes

The current implementation is a draft. It has bank retrieval, scoring, topic browsing, text search, images, and a basic interval schedule. Authentication and persistence code exists, but deployed multi-user ChatGPT behaviour has not been established by this PRD. The proposed coaching, external teaching MCP, video workflow, and revised recall semantics are requirements, not completed features.

The current draft does not provide a complete timed mock-test flow. Version 0.2 adds it as a requirement and makes the existing bank categories the lesson path. The supplied-library dataset is still pending.

The [product evaluation](product-evaluation-2026-10-06.md) records observed interface behaviour and the content audit. Earlier architecture and setup documents describe the draft and do not override this product scope. The [version 0.8 review](prd-review-2026-10-06.md) is a historical finding record; its resolution table maps the corrections in version 0.9. No implementation changes are included with this PRD.

Prepared using the installed [RefoundAI writing-prds skill](https://github.com/RefoundAI/lenny-skills/tree/main/skills/writing-prds), especially its problem-first brief, explicit success criteria, bounded scope, and acceptance review checklist.

Technical feasibility references:

- [OpenAI: Add UI to your MCP server](https://developers.openai.com/plugins/build/chatgpt-ui). Describes conversation messages and model-visible UI integration. Actual host behaviour remains a release test.
- [OpenAI: Plugin guidelines](https://developers.openai.com/plugins/app-guidelines). Embedding must respect platform permissions and restrictions.
- [YouTube: Player parameters](https://developers.google.com/youtube/player_parameters). Start and end parameters support segment playback; seeking can begin slightly before the requested time.

The retrieval-practice evidence cited in the product evaluation motivates the learning hypothesis. It does not validate this product's schedule, pilot targets, or exam outcomes.

## Appendix E. Clarification interview

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
