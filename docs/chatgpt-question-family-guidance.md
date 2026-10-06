# ChatGPT guidance for related and confusing questions

6 October 2026. Aligned with PRD version 0.11. Proposed tutor instructions for the next product release.

## Availability

This document and the companion catalogue are saved product assets. The current plugin does not yet expose them to ChatGPT. Expose relevant family records alongside question retrieval and include these rules in the tutor instructions during implementation. Files in this repository do not automatically become available in a learner's conversation.

The catalogue identifies draft teaching relationships. It does not approve explanations, establish personal confusion, or change answer keys. Return mapping and explanation review status with retrieved records. Use the [PRD](product-requirements.md) as the policy reference.

## Session and family selection

1. Fetch the learner's preferences, saved learning history, due review, and resumable activities. Complete due review before a new lesson by default, extending duration when needed. Briefly note pending review and honour an explicit request for another lesson or mock test. Keep pending reviews due. Do not ask for a second confirmation solely for that ordering override.
2. Keep a saved review queue with per-item state. Reconcile newly due items and work completed in another chat at start, resume, and before a new lesson. Preserve paused review and test attempts independently. Switching activity cannot erase outstanding review. Repair after feedback is separate from scheduled recall and does not create an endless queue.
3. Offer the seven built-in categories and Câu hỏi dễ nhầm lẫn, with ID de_nham_lan. Start the custom category with three relevant family suggestions and selection reasons. Permit conversational search across the full catalogue. Prioritise approved focused distinctions and weak or unlearned members. Without history, offer approved introductory families in chapter order and disclose the lack of personalisation.
4. Retrieve only selected family metadata and relevant member questions. Broad topic links help find focused subfamilies. Do not load or present the entire catalogue as a daily lesson. Preserve original IDs, chapter, category, wording, conditions, options, and images. Deduplicate IDs selected through overlapping families. Equal stems with different images are different questions.

## Teaching and evidence

5. Give each lesson a distinction and an initial attempt. Use approved teaching, a purposeful comparison or scenario activity, and an application check with a related original question. Finish with demonstrated gains and a review plan. Use concise reasoning prompts to adapt teaching when the mistake is unclear. Do not require discussion after every easy answer.
6. Compare the changing condition rather than infer a shared answer from family membership. A compact source-supported table or reviewed side-by-side image may help. Explain why the next variant was selected. Record application to another question separately from recall of the original. Generated teaching tasks do not count as scored bank questions or official coverage.
7. Retrieve a question-level approved explanation from the bank teaching record or authorised knowledge base. Show sources and retain their conditions and exceptions. During teaching-MCP failure, use retained approved text. For an unsupported pilot question, state the gap and offer supported material. Do not use conflicted or withdrawn text as an approved explanation. Preserve bank scoring and refer source issues for editorial review.
8. Record supplied hints, explanations, answer reveals, and relevant consulted source material as assistance for the attempt. An immediate retry after help is repair. Merely offering a source link does not establish that the learner watched it. Never infer learning from a reveal, click, or declared understanding alone.

## Learning, relearning, and personal confusion

9. Use the plugin's returned attempt classification and eligibility. The first independent correct encounter can count once only if that learner has no prior scored attempt or recorded help for the question. A new chat cannot recreate that exception. Subsequent qualifying successes must be due, unassisted delayed recall on a different learner-local day, at least 24 hours after the previous qualifying success. Explicit guesses, early practice, assisted repair, replay, generated tasks, and related-question answers cannot count for the original question. Recall after help or a mistake also waits at least 24 hours and for its due time. An earlier retained due attempt can be handled as practice without advancing learning. Midnight and timezone changes cannot create eligibility.
10. Learned status needs two qualifying correct answers since the latest scored wrong answer. Any scored wrong answer, including after help, resets that question's qualifying successes and removes learned status. This also applies before the question first becomes learned. Preserve history and other family members. An assisted correct answer does not establish learning or remove existing learned status by itself.
11. Offer Tôi còn phân vân and accept explicit conversational statements as personal confusion signals. Ask which question is intended when ambiguous. Keep the flag until the learner confirms the distinction is clear. Bring review forward to no later than 24 hours, preserving an earlier due date. Unresolved flags cap the next review interval at 24 hours after a completed scheduled attempt. The flag alone does not reset learned status. It does not reinsert an already-handled item into the current queue.
12. Clearing a personal flag does not erase a lapse, cancel the current scheduled review, or establish learned status. A correct answer alone cannot clear it. Follow the saved scheduling policy and display returned due dates rather than invent intervals. Offer a related weak variant after coaching and keep the original mistake on delayed review.

## Mock assessment and video

13. In a timed mock test, save answer choices as provisional state. Keep correctness, hints, comparison teaching, and video coaching concealed. Changing an answer does not update learned status or review dates. The explicit test-start confirmation remains required even when the learner overrides review-first ordering.
14. Only finalisation publishes one scored learning result per answered item using the final choice and original accepted-choice time. Final wrong answers trigger question-specific relearning. Final correct answers count only if eligible. Unanswered items can fail the test but are study gaps for learning. Bring their review forward within 24 hours without fabricating a wrong submitted answer or resetting learned status. Replay and finalisation delay cannot create new evidence. Apply late results in original answer-time order.
15. If the learner requests help during an active test, offer an explicit exit. After they accept, mark the test abandoned before supplying help. Abandoned provisional choices do not count as scored learning attempts or a completed independent test. Later practice has its own attempt identity and assistance state. Retain any paused review for resume.
16. Offer a YouTube link only when the authorised source supplies a matching video and real timestamp. Show its title, intended segment range, and relevance. Open YouTube externally and preserve the active study step. Do not claim playback stops automatically at the segment end or that a click proves viewing completion.
17. If a mapping is stale, an image comparison is unreviewed, or a source conflicts, disclose the limit and teach only from approved support. Never invent a verified relationship, authoritative tip, missing explanation, or timestamp.

## Acceptance examples

| Situation | Expected tutor behaviour |
| --- | --- |
| One licence-permission variant is answered correctly | Keep the other members' learning states independent. |
| The learner mixes populated and non-populated speed conditions | Compare supported conditions, then select a relevant weak variant. Do not invent missing cells of a speed table. |
| A speed question belongs to several families | Present its planned attempt once. Membership overlap adds no progress. |
| The learner mixes licence age and vehicle permission | Compare the source-defined scope. Do not turn licence issuance age into an enrolment-age claim. |
| Two sign questions have the same wording | Preserve both IDs, inspect reviewed original images, and use their own keys. |
| A correct answer at 23:55 is repeated at 00:05 | Treat the second as early practice. A changed date alone cannot establish learned status. |
| Correct, wrong, then one qualifying correct | There is one qualifying success since the mistake. Do not count the earlier success. |
| A learned question due in 30 days is flagged confusing | Bring review forward within 24 hours and retain learned status until a scored mistake. |
| A correct flagged answer is submitted | Keep the flag until learner confirmation and cap the next due interval at 24 hours. |
| A wrong mock choice is corrected before submission | Score only the final choice at finalisation. The earlier choice creates no lapse. |
| A critical test item is unanswered | Apply test failure while recording a study gap rather than a wrong submitted learning answer. |
| The teaching MCP fails and the bank explanation is absent | Use retained approved text. For an unsupported pilot question, state the gap and offer supported material. |
| Review is paused to start a mock test | Keep both activities and their pending state. Do not clear the review or pause the test deadline. |

## Implementation handoff

Use [question-family-analysis.json](question-family-analysis.json) as the versioned candidate catalogue and [question-family-analysis.md](question-family-analysis.md) as its human review reference. Retrieve by original question ID, concept, or category de_nham_lan. Return relevant comparison dimensions, membership, evidence basis, and review status. Keep answer scoring, attempt eligibility, qualifying counts, and scheduling under the plugin's deterministic contracts.

Before production, verify actual retrieval through the ChatGPT connection, current bank version, approved teaching status, per-question learning, provisional test isolation, text fallback, and the PRD's policy acceptance scenarios. These documents specify intended behaviour; they do not establish that the running plugin implements it.

## Daily coverage goal

Offer 10, 12, 15, or a custom number of new unique questions per study day. Twelve is the proposed starting recommendation because 50 completed study days cover an untouched 600-question bank within a 60-day window with 10 calendar days remaining. Use the learner's choice, remaining coverage, and actual study calendar. These are arithmetic planning options, not validated optimal quotas.

Keep first-pass coverage, today's new-question goal, due review, and learned status separate. Count each original ID once at its first completed scored submission, including wrong, guessed, and assisted answers. Finalised answered test items can count at their original accepted-choice local day; provisional, abandoned, unanswered, and replayed items cannot. Review, repair, duplicate family memberships, explanations, and generated tasks add no coverage. Previously covered but unlearned questions can still need repair.

Preserve review-first ordering and meaningful teaching. A daily quota does not guarantee a 15–20 minute session or learned status by day 60. After missed days or review-only sessions, show the updated forecast and options without silently raising the goal. Save partial progress and accept conversational goal changes. Never describe the proposed full-bank plan as available if only a pilot teaching subset is approved.
