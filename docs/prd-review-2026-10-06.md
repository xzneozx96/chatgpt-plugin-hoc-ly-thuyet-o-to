# PRD review

6 October 2026. Reviewed PRD version 0.8 and its companion learning assets.

## Verdict on version 0.8

The confirmed product direction is coherent enough to plan a small ChatGPT prototype. The specification needs clarification before committing to full implementation. Four high-priority findings affect learning status, confusion scheduling, mock-test history, and explanation reliability. Four medium-priority findings affect daily usefulness, family discovery, session recovery, and evaluation. One low-priority finding affects document readability.

This review does not establish that the deployed plugin implements these requirements. It makes no claim about current legal or medical correctness of the bank. No product code, bank keys, or confirmed owner decisions were changed.

## Resolution record for version 0.9

The owner authorised resolution of the four high-priority gaps and revision of the PRD per this review. The updated [PRD](product-requirements.md), [tutor guidance](chatgpt-question-family-guidance.md), and [glossary](../CONTEXT.md) now specify the corrections below. The original findings remain as a historical record of version 0.8. Source links lead to the current documents.

| Finding | Resolution in the specification | Reference |
| --- | --- | --- |
| R01 | One qualifying-attempt contract; first independent encounter, due delayed recall, separate local days and elapsed 24-hour minimum; wrong answers reset qualifying successes | PRD A1 and B4, REV-04 and REV-08 |
| R02 | Bring personal-confusion review forward within 24 hours; unresolved flags recur daily; keep learned status separate; confirmation preserves scheduled lapse review | PRD B4, REV-09 |
| R03 | Provisional choices do not update learning; final answered choices publish results once; unanswered items become study gaps; abandoned choices do not become learning results | PRD B6, EXAM-05 through EXAM-08 |
| R04 | Approved question-level teaching records and retained text for all 600 before broad release; explicit pilot gaps and conflict handling | PRD B3, KB-05 through KB-07 and CON-03 |
| R05 | Three personalised category suggestions, conversational search, focused retrieval, and question deduplication | PRD A3, EXP-09 and CON-02 through CON-06 |
| R06 | Complete comparison lesson contract with approved teaching, a meaningful activity, application, and recap | PRD EXP-10 |
| R07 | Saved per-item queue; reconciliation at start, resume and before a new lesson; separate activity identities and chronological evidence | PRD B4 and DAT-02 |
| R08 | Separate exact recall from transfer and distinguish review, lesson, pause and override outcomes | PRD C1 and C2 |
| R09 | CON-06 restored to its table; clarification tracker distinguishes settled policy from dependencies and validation | PRD B5 and E |

Revision checks found 51 unique requirement IDs, 18 policy acceptance scenarios, consistent requirement-table columns, and valid companion-document links. The source-bank hash and 249-family catalogue remain unchanged. These checks verify saved specification structure and references, not execution of the acceptance scenarios.

These are specification resolutions. Actual MCP access, approved teaching coverage, mock-library delivery, production persistence, and ChatGPT acceptance cases remain release work. No implementation or learner-outcome verification is claimed.

## Review plan and scope

- [x] Route through the how skill. For motivation questions, also route through the why skill. This review concerns specification behaviour, not implementation motivation; the why route was not needed.
- [x] Throughput checkpoint stays one line: throughput checkpoint: n/a, read-only investigation.
- [x] Produce the how-shaped output or a recommendation with a tradeoffs table. The findings below provide evidence, consequences, and proposed acceptance cases.
- [x] Apply the unslop skill to the reply.

Reviewed the PRD, glossary, tutor guidance, family catalogue, reverse index, review notes, and source-bank metadata. Checked saved artifacts directly. A separate comment-scope review found no applicable code comments or suppressions in this documentation-only scope. It changed no files. No application code or live ChatGPT flow was reviewed.

## What is settled and internally consistent

- Learners use ChatGPT. The playground is only a development surface.
- Licence B is first. The six chapters and seven built-in categories remain intact.
- The eighth custom category is Câu hỏi dễ nhầm lẫn. Its membership supplements original categories.
- Review comes first by default and may extend duration. Explicit requests for a lesson or mock test override the ordering while pending review stays due.
- One question's result cannot mark its family learned. A wrong submitted answer, including after help, starts question-specific relearning.
- Personal confusion needs the learner's confirmation to clear. A correct answer alone cannot clear it.
- YouTube links open externally at source-derived timestamps. Clicking does not prove watching or learning.
- Mock practice uses 30 questions, 20 minutes, at least 27 correct, and failure on any incorrect critical item. The supplied library remains pending.

## Artifact checks

| Check | Observed result |
| --- | --- |
| Original question IDs and taxonomy | 600 questions. Catalogue member text, categories, images, and critical flags match the bank. |
| Bank version and hash | Catalogue version/hash match the current source bank. |
| Family coverage | 249 families cover 598 distinct questions. q177 and q468 remain explicit singletons. All 600 IDs appear in the reverse index. |
| Eighth-category membership | All 249 families belong to de_nham_lan. Its 598 question memberships match the family union. |
| Relationship types | 149 contrasts, 29 variant groups, and 71 topic links. Topic membership alone does not establish a confusing distinction. |
| Approval status | All 249 families are draft_bank_analysis. 198 are text_supported and 51 are candidate. Neither label means approved teaching. |
| Visual review | 132 families require visual review. The catalogue analysis did not inspect the images. |
| Catalogue size and overlap | 952,808 bytes, with 1,171 member references. The largest family has 29 questions. Some questions belong to six families. |
| Missing bank explanations | 43 questions have no bank explanation. |
| Requirements | 49 unique requirement IDs. 48 are P0 and one is P1. |
| Comment-scope review | No applicable comments or suppressions. No deletions or application-code review. |

These checks establish structural consistency of the saved assets. They do not establish the educational correctness of every mapping or an effective learner experience.

## Findings

### R01. High. Define which attempts qualify for learned status

Evidence is in [PRD A1](product-requirements.md), REV-03 through REV-08, and the proposed interval policy. The learned criterion requires two unassisted correct answers on separate days. Review-stage advancement additionally requires an eligible due attempt. The documents do not explicitly connect those rules or define the counter before a question first becomes learned.

A learner could answer correctly at 23:55 and practise again at 00:05 on the next local day. An implementation could count two days and mark the question learned despite only ten minutes of separation. A correct answer, then a mistake, then another correct answer also has no explicit initial-learning counter rule. Immediate coached retries are excluded, but the other eligibility boundaries remain unclear.

Proposed resolution is one attempt-eligibility contract. Count the first independent encounter and subsequent eligible delayed attempts toward learning. Exclude early practice, replay, explicit guesses, and assisted repair. Count qualifying successes since the latest wrong attempt. Preserve the owner's two-day criterion and use the agreed scheduling interval to establish delayed eligibility. Keep application checks on related questions separate.

Proposed acceptance cases cover midnight, timezone changes, early practice on another date, correct-wrong-correct sequences, help before an attempt, replay, and restoration after a lapse. This is a policy clarification to confirm, not a silent change to the owner's criterion.

### R02. High. A personal confusion flag has no scheduling rule

[REV-09](product-requirements.md) defines setting, persistence, and clearing the flag. REV-02 defines the due queue. No requirement says whether flagging a question changes its next review date or its learned status.

A learned question could be due in 30 days. If the learner selects Tôi còn phân vân today, an implementation could save the flag but omit the question from tomorrow's review. Another implementation could keep inserting it into the current queue until the learner clears it. Both undermine the intended daily repair experience.

Proposed resolution is prompt coaching when requested, plus a next-day review no later than an existing earlier due date. Keep the flag separate from correctness-based learned status. Process it once per scheduled review rather than creating an endless loop. Clearing the flag does not cancel review created by an actual mistake. A later wrong answer still applies the confirmed relearning rule.

Proposed acceptance cases start with a learned question due in 30 days, a flag set during conversation, a correct flagged answer, and explicit resolution. Verify both saved flags and due dates. Confirm this scheduling policy before implementation.

### R03. High. Specify when mock-test choices become learning evidence

[REV-08](product-requirements.md) applies relearning to any submitted wrong answer. EXAM-05 allows answer changes before submission or expiry. EXAM-08 updates review after finalisation. The PRD does not explicitly state that saved test choices are provisional rather than scored learning attempts.

If a learner selects a wrong choice and corrects it before final submission, processing both selections as learning attempts would wrongly revoke learned status. Unanswered test items also count as incorrect for the test score while the PRD correctly describes them as study gaps. Their effect on an already-learned question is unspecified.

Proposed resolution is to keep provisional choices outside learned-state transitions. On finalisation, publish one result per answered item and apply learning updates once. Final wrong answers trigger the owner's question-specific relearning rule. Final correct answers count only when recall eligibility is met. Unanswered items enter a study-gap queue without fabricating a wrong submitted answer or automatically assigning a misconception. Explicitly define the learning effect of an abandoned or assisted test.

Proposed acceptance cases cover wrong-then-correct edits, correct-then-wrong edits, unanswered critical items, expiry, abandonment, and repeated finalisation. Correctness must remain concealed during the active test.

### R04. High. Make approved teaching availability explicit

[KB-05](product-requirements.md) offers an available bank explanation when retrieval fails. KB-06 requires supported text during source failure. CON-03 records 43 missing explanations. The review notes also flag source inconsistencies, including q217's stem/options mismatch and q045's broad explanation versus q109's exception question. The existing broad-release gate requires approved support for every question, but an explanation route could depend entirely on the unavailable external MCP.

Proposed resolution is a question-level approved teaching record with source, version, review status, and known conflicts. For broad release, retain an approved text route for each question that remains available during teaching-MCP outages. During the limited pilot, clearly report an explanation gap when no approved support is available. Do not turn a flagged mnemonic into a universal rule. Preserve scoring against the supplied bank and record content issues for owner review rather than changing keys.

Proposed acceptance cases cover a missing bank explanation during MCP outage, a flagged source conflict, removed video, unsupported tip request, and a visually unreviewed mapping. A valid response may honestly report that teaching support is unavailable during the pilot. It must not fabricate an explanation.

### R05. Medium. Design discovery within the custom category

[CON-02](product-requirements.md) exposes 249 families. The category includes 598 of 600 questions. Tutor guidance retrieves relevant memberships, but neither the PRD nor catalogue defines a small entry menu, ranking, family hierarchy, or retrieval budget. The catalogue contains broad topic links as well as precise contrasts.

Proposed resolution is a concise entry experience with a few personalised family suggestions and conversational search across the complete catalogue. Keep all saved families available for discovery. Prioritise approved, useful distinctions and weak members. Use broad cross-category links to find focused subfamilies rather than present a 29-question group as a daily lesson. Retrieve only the selected teaching metadata and relevant member questions. Do not send the entire approximately 953 KB catalogue to every conversation.

Proposed acceptance cases open the category for a beginner and a returning learner. Both receive a small, explained starting choice. A speed lesson does not repeat q149 because it belongs to several overlapping families. Draft mappings remain visibly separate from approved teaching.

### R06. Medium. The core learning activity can still become a next-question loop

[EXP-04](product-requirements.md) offers teaching controls, EXP-05 requires one visual activity in the prototype, and TUT-06 offers a related question. These criteria can be satisfied by a conventional quiz with longer feedback. They do not require the comparison learning that makes the new direction useful.

Proposed resolution is one complete lesson acceptance contract. It names a distinction, elicits an initial attempt, teaches from approved evidence, includes a purposeful comparison or scenario activity, checks application, and ends with a supported recap and review plan. ChatGPT uses the learner's reasoning when useful and adapts the next question accordingly. Do not require a reasoning dialogue after every easy answer. Confidence and personal confusion remain optional learner signals.

For the pilot, demonstrate a speed-condition comparison and a reviewed sign or scenario comparison. Verify that choosing different mistaken reasoning produces an appropriate supported teaching response. Measure enjoyment and fatigue alongside completion. Avoid adding streaks or game controls before this loop is useful.

### R07. Medium. Define review-session scope and competing activity recovery

[REV-02](product-requirements.md) preserves pending review. DAT-02 supports concurrent chats. The resume flow chooses a saved session. The documents do not define which due items belong to the active review session or how a paused review coexists with a requested mock test.

An open-ended query for every item currently due could keep expanding across a local-day boundary. A single latest-session field could replace a paused review when a mock test starts. A broad finish event could accidentally clear review that was never attempted.

Proposed resolution is an explicit review-session queue with stable item membership and per-item completion. Reconcile newly due work at clear boundaries, such as start and resume. Keep paused review and test attempts independently resumable. Overrides change activity rather than clear outstanding review. Preserve the owner's review-first default and ability to override it.

Proposed acceptance cases include pausing review, starting a test, returning in another chat, crossing midnight, and concurrent submissions. No history or pending review disappears. Confirm how newly due items are added on resume before freezing the session policy.

### R08. Medium. Separate delayed recall from transfer in the evaluation

[Appendix C](product-requirements.md) labels the main measure delayed recall but proposes held-out related questions. Those test application to a variant. Exact-question recall and transfer are already distinct elsewhere in the PRD. Session completion also lacks a unit when an extended review and a new lesson occur in one visit or across a pause.

Proposed resolution is separate reporting of delayed exact-question recall and delayed transfer to related bank questions. Predefine exposure, assistance, and matching conditions. Define review-session completion, lesson completion, pause, and overall visit separately. An explicit activity override is not automatically an abandonment. Include review duration and new-learning starvation as diagnostic measures under the owner's review-first policy.

The 10-point, 75%, and 50% thresholds remain proposals. A 5–8-person usability pilot cannot establish learning efficacy. The current PRD already states that limitation; keep it.

### R09. Low. Repair the requirement table and stale tracker text

[CON-06](product-requirements.md) is separated from its Markdown table by a blank line. It therefore does not belong to the preceding rendered table. Appendix E's audience row also states review-first without the explicit-override qualification and lists tolerance for long review as unresolved, although Q6 accepts longer sessions.

Proposed resolution is to join CON-06 to the requirement table and consolidate the interview tracker into confirmed policies, open preferences, investigation tasks, and release dependencies. Keep the actual requirements as the policy reference. These are editorial corrections, not new product decisions.

## Required dependencies, separate from findings

The PRD already names these dependencies. Their presence is honest scope management rather than a hidden defect.

- Inspect the authorised teaching MCP schema, access scope, and real timestamped result. Do not ask the owner to guess integration capabilities.
- Supply and validate the fixed mock-test library and composition rules. Keep library mode unavailable until then.
- Assign editorial ownership and review the visual families and flagged explanation issues.
- Demonstrate identity, saved progress, isolation, and resume inside ChatGPT. Existing integration code is not deployment proof.
- Confirm pilot success criteria after baseline measurement and review the complete PRD before committing to broad delivery.

## Recommended next step

Resolve R01 through R04 before implementing the learning-state and exam contracts. Add the focused category-discovery and lesson acceptance cases from R05 and R06. Clarify session recovery and measurement before the pilot. Then build one complete ChatGPT lesson using a small approved family and demonstrate its next-day review.

This sequence preserves all confirmed features. It lets the owner evaluate the learning experience before committing to full-bank teaching and mock-test expansion. The full initial release still requires all P0 requirements and the supplied-library gate.

## Principles applied

Experience First shaped the recommendation to begin with a focused, purposeful comparison lesson and personalised family discovery. Prove It Works shaped the direct bank, metadata, reverse-index, category-membership, and requirement-ID checks. Neither check is presented as runtime proof of the plugin.
