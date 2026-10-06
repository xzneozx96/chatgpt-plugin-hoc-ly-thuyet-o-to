# Learning product evaluation

Date: 6 October 2026.
Status: evaluation and proposed direction, awaiting product feedback.

## Audience and promise

The user selected first-time car licence candidates and candidates close to their exam. A normal session should take 15–20 minutes and include deeper explanations.

Proposed promise: leave each session able to explain and apply something you previously found confusing, with a clear plan for the next session.

## Scope and evidence

I exercised the deployed `/play` interface through Playwright. I inspected the current widget, tutor skill, question bank, and review algorithm. This is a heuristic product evaluation. It is not a learner usability study, a legal validation of the bank, or an end-to-end authenticated ChatGPT test.

Observed journeys:

- First visit opens q001 directly. No diagnostic, licence selection, exam date, daily objective, or session length appears.
- Choosing A on q001 and checking displays the bank's correct answer B and explanation. Options lock after scoring. Navigation remains available.
- The traffic-sign topic opens q301 and displays its image.
- Searching `q499` opens that question and its intersection image.
- Searching `nhường đường` returns 12 bank excerpts with question references. These excerpts contain explanations and can reveal answers before practice.
- At a 390 × 844 viewport, q499 uses a 318px-wide image. Check and Previous share a row, while Next wraps onto a separate row. At the initial scroll position, Next starts at y=810. The layout requires scrolling to see all controls.
- The image has generic alternative text and no dedicated zoom or annotated reasoning interaction.
- After answering, the public page requests `get_progress`, which returns HTTP 400 because that tool is unavailable there. Scoring still succeeds and the widget suppresses the progress error. A favicon request also returns 404. These are technical polish findings, not evidence that scoring failed.

Evidence files are in `.playwright-mcp/`. The mobile image is `audit-q499-mobile.png`. The current code references are `src/ui/quiz.html`, `src/ui/preview.html`, `src/domain/study.ts`, `src/domain/quiz.ts`, and `skills/driving-theory-tutor/SKILL.md`.

Throughput checkpoint: n/a, read-only investigation.

## What the draft gets right

The bank is accessible through deterministic question retrieval and scoring. Images make sign and intersection questions usable. Topic filters and direct question lookup work in the sampled journeys. The palette is calm, text is readable, answer rows are easy to target, and feedback uses words as well as colour. Source references and explicit missing-explanation handling support trust.

These are useful foundations. Their current arrangement leaves learners responsible for selecting, sequencing, interpreting, and stopping their own study.

## Main product gaps

| Observed mechanism | Learning or experience risk | Proposed improvement |
| --- | --- | --- |
| Open one question, then move through IDs | Learners have no reason to study this question today | Offer a bounded session with one named objective and a reason for its selection |
| Correct or incorrect verdict and the same source explanation | A correct guess and a reasoned answer look identical | Optional confidence choice, selective reasoning prompt, and a later related question |
| Fixed per-question review intervals | Answer memorisation can appear to be lasting understanding | Track assisted practice separately and require delayed unassisted recall for mastery |
| Topic chips are the primary organisation | Broad categories do not identify the learner's specific confusion | Add reviewed concepts, prerequisites, and easily confused pairs |
| Static image | Learners can overlook the visual clue that determines the answer | Zoom first, then reviewed highlights and step-by-step visual prompts |
| Endless practice | There is no completion moment or useful return plan | Finish with a demonstrated gain, unresolved confusion, and next-session plan |
| Accuracy and number practised | Aggregate activity can obscure weak critical material | Show coverage, delayed recall, weak concepts, and critical-question gaps separately |
| Search returns answer-rich excerpts | Searching for help can prematurely spoil practice | Preserve reference search but offer a separate answer-hidden practice journey |

These risks are inferences from the interaction and code. We have not measured abandonment, enjoyment, or learning gains.

## Content audit

The JSON contains 600 questions, 318 image references, and 60 questions flagged critical. There are 557 nonempty explanations and 43 questions without an explanation. None of the explanations exceed 500 characters. Short explanations are useful feedback but do not themselves form a lesson sequence.

| Current category | Questions |
| --- | ---: |
| Quy tắc | 133 |
| Điểm liệt | 60 |
| Văn hóa | 23 |
| Kỹ thuật | 47 |
| Cấu tạo | 37 |
| Biển báo | 185 |
| Sa hình | 115 |

Repeated question wording occurs in the bank, often with different images. Text equality must not be used to merge questions.

The next content layer should link every question to reviewed concepts and source-supported distinctions. It should also record explanation availability, image regions where relevant, related questions, and critical status. Cover all 600 questions over the full course, even if the first prototype uses a narrow subset. Preserve original wording, options, answer keys, and images.

The 43 explanation gaps need editorial resolution. Until then, show the supported answer and the gap honestly. Do not let ChatGPT improvise a legal justification. Any approved teaching material belongs in a separate versioned layer with question references and reviewer provenance.

## Three possible directions

| Direction | Strength | Main tradeoff |
| --- | --- | --- |
| Guided study coach | Diagnoses confusion and teaches through a daily plan | Requires a reviewed learning sequence and careful tutor behaviour |
| Daily challenge game | Creates variety and an easy reason to open the app | Points and streaks can reward activity without understanding |
| Exam preparation companion | Makes weak areas and exam practice immediately useful near a deadline | Timed testing alone is a poor introduction for beginners |

Recommendation: use the guided study coach as the core. Add an exam preparation path and small learning challenges within it. The two audiences share the bank and tutor, but need different pacing. Beginners need instruction and prerequisites. Exam candidates need more mixed unassisted recall and targeted repair.

## Proposed 15–20 minute session

1. **Recall, about 3 minutes.** Start with two or three questions from prior study, without revealing the explanation. Ask for confidence when it helps identify guessing. On the first visit, use a short diagnostic instead.
2. **Learn one distinction, about 5 minutes.** Name today's objective in learner language. Teach a confusing pair or small concept using exact bank questions and source-supported explanations. Show the relevant image at a useful size.
3. **Apply, about 6 minutes.** Mix a few original questions. On a mistake or uncertain answer, offer a hint or ask one short reasoning question. Do not force a conversation after every easy answer.
4. **Check independently, about 3 minutes.** Use a different bank question about the same reviewed concept. A copied answer or immediate retry does not count as retained mastery.
5. **Finish, about 1 minute.** Summarise what the learner demonstrated, what remains uncertain, and why the next session will revisit it. Allow a clear stop or optional extra practice.

The counts and timing are prototype assumptions. Measure actual duration and fatigue before locking them into the product.

When learners miss days, offer a manageable catch-up session. Do not make an overdue queue feel like punishment. Near the exam, emphasise weak concepts and critical material while retaining breadth. Exact mock-exam format must be verified for the selected licence before presenting a simulation as official.

## How ChatGPT should participate

The tools should own retrieval, official scoring, question identity, session state, and review scheduling. ChatGPT should select a teaching move using the returned evidence and the learner's response.

Useful teaching moves include:

- Ask what clue the learner used, rather than infer their misconception from one wrong option.
- Rephrase an existing explanation when the learner requests simpler language.
- Explain why the chosen option conflicts with the source, where the source supports that distinction.
- Give progressively more specific hints without revealing the answer immediately.
- Compare related original bank questions and ask what changed.
- Ask the learner to explain a source-supported distinction in their own words.
- Adjust depth and pace when the learner asks for a shorter explanation, another example, or harder practice.
- Summarise a pattern only after multiple responses support it. Let the learner correct that interpretation.

Example based on q001, proposed rather than an observed transcript:

> Learner chooses A and says they are unsure.
>
> Tutor: "Bạn đang tính cả lề đường vào phần dành cho xe đi lại phải không?"
>
> Learner: "Đúng."
>
> Tutor explains the distinction using q001's explanation, then asks: "Theo giải thích này, đáp án A đã thêm phần nào?"
>
> Later the session checks that distinction again without showing the explanation.

For q499, a reviewed visual activity could ask the learner to identify the signal governing each vehicle before answering the exact original question. Use a zoomable original image. Any highlights need verified positions and must remain removable. An AI-generated intersection must not replace the source image in scored official practice.

The current widget calls tools but has no `ui/message` teaching action. Add explicit actions such as `Gợi ý`, `Vì sao đáp án của tôi sai?`, and `Cho tôi câu tương tự`. These actions should share the question ID, selected answer, confidence, and requested help with ChatGPT. The host supports follow-up messages through the MCP Apps bridge. Updating UI state alone must not be assumed to start a tutor response.

Keep the conversation in ChatGPT and the visual question in the card. Avoid making learners maintain two separate chat boxes. Capability fallback and actual ChatGPT integration testing are required before claiming this interaction works.

## Make the experience enjoyable

Use variety that exercises understanding. Compare similar signs, find the clue in an intersection image, predict before revealing options, and explain a distinction to the tutor. Introduce each interaction only when its source material supports it.

Celebrate a demonstrated improvement with specific evidence, such as answering a previously missed concept correctly after several days. A modest weekly practice goal can help organise study. Avoid equating a streak, speed, or accumulated points with exam readiness.

Depth should be available without forcing long explanations. Keep easy questions fast. Let learners choose to investigate a mistake. Finish sessions with a sense of completion rather than an endless Next action.

## Interface priorities

- Lead with today's objective, estimated time, and a Start or Continue action.
- Put the session step and progress near the question. Keep the question card focused on the current task.
- Keep navigation together on small screens and ensure the primary action remains reachable without obscuring answers.
- Add accessible image enlargement before more ambitious image interactions.
- Offer brief feedback first, with source details and deeper coaching available on demand.
- Use ordinary learner-facing source labels. Keep `question-bank.json` in expandable provenance details rather than instructional copy.
- Preserve reference browsing and free practice as secondary choices.
- Give hinted, skipped, guessed, and independent answers distinct study meanings. Do not overload a single accuracy percentage.
- Keep official practice and generated teaching prompts visually distinguishable.

## Review and mastery changes

`reviewStates` currently advances the correct streak on every correct attempt. Its intervals are 1, 3, 7, 14, and 30 days. Wrong answers become due immediately. The algorithm does not account for early revisits, hints, confidence, or reasoning.

For a useful learning product, separate practice assistance from delayed recall. An immediate repair question can check whether the explanation was understood, but should not establish long-term mastery. Review both individual questions and reviewed concepts. Use confidence to detect uncertain knowledge, while keeping correctness and later recall as stronger evidence. Track critical-question gaps explicitly.

Research supports retrieval practice and delayed checks. It does not validate our particular interval sequence, concept mapping, or proposed timing. Roediger and Karpicke found better delayed retention after testing than restudy. Karpicke and Blunt found benefits for conceptual learning in their science-text experiments. These results justify testing a retrieval-centred approach here, not promising equivalent outcomes for Vietnamese driving theory.

## Smallest useful next prototype

Build one complete lesson around a confusing concept with adequate source explanations. Include exact questions, one visual or comparison activity, selective tutor coaching, an independent exit check, and a session summary. Start with roughly 10–15 carefully selected bank questions. This is a prototype scope, not a reduction of the full curriculum.

Test both a beginner path and a near-exam path using that lesson. Expand the pattern only after observing learners. Prioritise the session, coaching, image readability, and mastery evidence before leaderboards, decorative badges, push reminders, voice, or large animated simulations.

Persistent progress remains necessary for a real multi-day experience. Provider setup can stay outside the immediate product discussion, but it cannot be replaced by a claim that ChatGPT will reliably remember study state forever.

## Evaluation plan

Recruit a small exploratory group with learners from both selected audiences. Five to eight participants can expose usability issues, but cannot establish efficacy statistically.

Observe whether learners can begin without guidance, complete a lesson, identify a visual clue, request help, and explain the distinction afterwards. Compare the current flow with the prototype on matched content. Counterbalance order and content so familiarity does not favour the second version.

Check unassisted recall after several days and performance on related questions that were not taught directly. Record hint use, confident wrong answers, time spent, tutor factual errors, and whether learners return voluntarily. Ask what they learned and what felt tiring. Keep actual return behaviour separate from stated intention.

For tutor evaluation, include wrong reasoning, correct guesses, incomplete explanations, missing source explanations, ambiguous images, off-bank requests, and interrupted sessions. Verify scoring and wording stay faithful to the bank. Check that hints do not leak answers too early and explanations do not invent rules.

Agree on success criteria before implementation. Session completion and return rate are useful product measures. Delayed unassisted recall and fewer repeated conceptual errors are learning measures. No pass probability or readiness percentage should appear without a justified assessment model.

## Sources

- [Roediger and Karpicke, Test-Enhanced Learning, 2006](https://www.psychologicalscience.org/journals/psychological-science/j.1467-9280.2006.01693.x/).
- [Karpicke and Blunt, Retrieval practice produces more learning than elaborative studying with concept mapping, 2011](https://pubmed.ncbi.nlm.nih.gov/21252317/).
- [OpenAI, Add UI to your MCP server](https://developers.openai.com/plugins/build/chatgpt-ui), checked on 6 October 2026. Documents `ui/message`, focused inline cards, and tools that remain useful without a UI.

Experience First shaped the recommendation to prioritise a complete learning session before rewards and additional browsing controls.
