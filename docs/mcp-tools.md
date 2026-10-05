# MCP tools

`get_question({ questionId?, afterQuestionId?, beforeQuestionId?, topic? })` returns one original bank question without its answer. `questionId` opens a specific ID; `afterQuestionId` advances; `beforeQuestionId` goes back; `topic` chooses one of seven exam categories. Image questions include an `imageUrl`. This tool displays the MCP Apps quiz UI.

`submit_answer({ questionId, selectedAnswer, attemptId? })` scores A, B, C, or D against the bank. It returns the correct answer, source explanation or an explicit missing-explanation message, plus `nextReviewAt` in the private local trial. Clients should use a stable UUID `attemptId` for retries. Reusing an ID for a different answer is rejected.

`search_theory({ query, limit? })` searches only `question-bank.json` and returns question ID, topic, source reference, question text, and a source excerpt. An empty `hits` array means the bank has no match.

`get_progress({})` and `get_due_reviews({ limit? })` are available only in the private local trial. They are withheld when `PUBLIC_BASE_URL` points to a public hostname. The latter returns due questions without answer keys.
