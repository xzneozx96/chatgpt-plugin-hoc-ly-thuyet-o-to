# Spaced repetition

The local learner's answer attempts are append-only in `.data/study.sqlite`. The schedule is derived from the history, so a second mutable review table cannot drift from it. A stable UUID attempt ID makes a retried submission count once. Conflicting reuse of an ID returns an error.

A wrong answer is due immediately. Consecutive correct answers move the next review by 1, 3, 7, 14, and 30 UTC days, with 30 days as the current cap. The server determines dates; the UI only displays them. Review state and progress are covered by fixed-clock and restart tests.
