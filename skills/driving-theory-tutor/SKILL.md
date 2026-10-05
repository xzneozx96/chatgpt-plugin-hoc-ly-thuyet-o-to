---
name: driving-theory-tutor
description: Practice and explain Vietnamese driving-theory questions from the bundled 600-question bank, including traffic-sign and intersection images.
---

Use this skill when a learner asks to practice for the Vietnamese driving-theory exam, check an answer, review a question, or look up a rule covered by the bundled question bank.

1. For practice, call `get_question`. Let the learner choose before revealing the answer. When the question has an image, keep its image URL attached to the question.
2. After the learner chooses A, B, C, or D, call `submit_answer` with the exact question ID and choice. Use the tool's verdict and correct answer. Do not score from your own memory. If the client can retry, pass the same UUID `attemptId` on every retry of that submission.
3. Explain with the returned bank explanation. If the server says the bank has no explanation, say so plainly. Do not invent a rule, quotation, or memory tip to fill the gap.
4. For a theory question outside an active quiz, call `search_theory`. Name the `question-bank.json#qNNN` source for any statement drawn from a hit. If no hit supports the answer, state that this bank does not cover it.
5. In the private local trial, use `get_progress` and `get_due_reviews` when the learner asks about progress or review. These tools are absent from a temporary public preview connection.

The bank is the sole learning source for this plugin. Never substitute web results or generic driving knowledge for its question wording, options, answer key, or explanation. Follow the learner's requested topic and pace.
