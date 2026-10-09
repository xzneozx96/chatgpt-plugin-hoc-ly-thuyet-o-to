# Driving-theory learning

A Vietnamese driving-theory learning product used through ChatGPT. Learners study original bank questions, receive sourced coaching, review mistakes, and take mock tests.

## Language

**Question bank**:
The owner-supplied set of 600 questions that determines original wording, answer options, images, applicability, and answer keys.
_Avoid_: AI-generated curriculum, teaching knowledge base

**Chapter**:
One of the six ordered curriculum sections supplied by the question bank.
_Avoid_: Category

**Category**:
A named learning or practice path. The seven built-in categories come from `examCategory`. The eighth custom category, Câu hỏi dễ nhầm lẫn, contains related-question families and adds membership without replacing the original category.
_Avoid_: Chapter, AI-invented topic

**Critical question**:
A question marked Điểm liệt in the bank. An incorrect critical answer causes a mock test to fail regardless of total score.
_Avoid_: Difficult question

**Lesson**:
A bounded learning activity assembled by ChatGPT within the bank's category paths, using approved teaching resources and the learner's history.
_Avoid_: Mock test, endless question browsing

**Question family**:
A set of original bank questions about a shared concept, with recorded aspects or conditions that differ. Membership supports comparison teaching and does not imply interchangeable answers or personal confusion.
_Avoid_: Duplicate questions, learner misconception

**Learned question**:
An original question the learner answered correctly on the first encounter without help or guessing, or that cleared the review queue (reviews after 1, 3, 7 and 14 days). Any scored wrong answer, and any guessed or assisted answer, queues it again at step 1. Learning one question does not establish learning of related questions.
_Avoid_: Permanently mastered question, viewed question

**Qualifying answer**:
A correct answer with no help and no guess. On the first encounter it makes the question learned. On a due review it advances the question one review step. Before the due date it changes nothing.
_Avoid_: Early practice, assisted answer, provisional test choice

**New learning**:
Study of questions or distinctions the learner has not yet learned. It is distinct from scheduled recall of previously studied material.
_Avoid_: Daily review

**First-pass coverage**:
The number of distinct original questions with at least one completed scored submission. It includes wrong, guessed, and assisted first answers. Review and duplicate family membership add no coverage. It does not establish learned status.
_Avoid_: Questions viewed, mastered questions

**Daily new-question goal**:
The learner-selected number of additional original questions to cover for the first time on a study day. Due review and repair are additional activities with separate progress.
_Avoid_: Total questions answered, compulsory catch-up quota

**Confusing question**:
A question for which the learner expresses uncertainty or difficulty understanding the distinction. Confusion can remain even after a correct answer. The learner explicitly confirms when the distinction is clear.
_Avoid_: Wrong answer

**Repair practice**:
Removed. A wrong answer is not retried in the same lesson. The question is reviewed from the next day.
_Avoid_: Delayed recall, mastery

**Delayed recall**:
A review attempt after a scheduled interval of 1, 3, 7 or 14 days, made before receiving help for that attempt.
_Avoid_: Immediate retry, answer reveal

**Mock test**:
A timed practice assessment of 30 original questions. Passing requires at least 27 correct answers and no incorrect critical answer within the configured 20-minute limit.
_Avoid_: Guaranteed exam readiness, verified official exam

**Provisional test choice**:
A saved answer in an active mock test that the learner may still change. It becomes scored learning evidence only when the test finalises.
_Avoid_: Scored attempt, demonstrated mistake

**Study gap**:
An unanswered assessment item that needs follow-up without evidence of an incorrect submitted answer. It can affect the test score without proving a misconception.
_Avoid_: Wrong submitted answer

**Library test**:
A mock test whose question membership and order come directly from the owner's supplied test library.
_Avoid_: Random test

**Random test**:
A mock test formed by selecting 30 distinct applicable questions from the bank.
_Avoid_: AI-generated questions, official test paper

**Teaching knowledge base**:
The owner-approved external collection of explanations, tips, and video-derived teaching material that supplements the question bank.
_Avoid_: Answer-key authority

**Approved explanation**:
A source-supported explanation reviewed for a specific original question. It preserves the relevant conditions and provides teaching support without requiring a video.
_Avoid_: Unreviewed bank mnemonic, draft family mapping

**Video segment**:
A source video interval identified by actual start and end timestamps and linked to the studied question or concept.
_Avoid_: Model-guessed timestamp
