# Lý Thuyết Lái Xe

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Vietnamese-speaking learners preparing for licence B, including beginners and candidates close to their exam. The owner prefers substantive daily learning sessions of roughly 15–20 minutes for new material, with due review adding time as needed.

## Product Purpose

Help learners understand driving-theory distinctions, retain them through spaced recall, and track progress through a structured 600-question course inside ChatGPT.

## Operating Context

ChatGPT is the learner surface. Interactive widgets support the conversation. The local prototype is only for design review and development. Users do not visit a separate playground to study. YouTube source segments open externally.

## Capabilities and Constraints

The question bank supplies original wording, images, answers, and applicability. Seven original categories remain intact. “Câu hỏi dễ nhầm lẫn” adds 249 overlapping families. Categories and groups are trackable course units derived from original question records. Coverage and delayed learning are separate. Shared questions count once toward overall coverage and due review.

Complete all due review first by default. Honour an explicit request for another activity without clearing outstanding reviews. Learners choose daily new-question goals of 10, 12, 15, or a custom number. Approved external MCP knowledge supplies explanations and timestamped video links. Source integration, production identity, persistence, and ChatGPT host validation remain implementation gates.

Mock tests contain 30 questions, last 20 minutes, require at least 27 correct, and fail on any wrong or unanswered critical question. The owner-supplied test library is pending. Random-bank practice must be labelled honestly.

## Brand Commitments

The name is Lý Thuyết Lái Xe. Vietnamese is the teaching language. The owner rejected the earlier prototype's confusing navigation and generic visual styling and requested a full redesign using Impeccable. On 6 October 2026 the owner selected direction B, Đường học: navy text, blue actions, white ground, Be Vietnam Pro, a course overview with a separate daily-action area, and compact top navigation. The accepted direction is documented in docs/ui-ux-direction-b-contract.md.

## Evidence on Hand

question-bank.json contains 600 original questions. Local images accompany image-dependent questions. docs/question-family-analysis.json contains 249 draft families; 132 need visual review. The PRD defines learning and review policy. Prototype history is illustrative. Approved video segments are not yet available in the prototype.

## Product Principles

- Teach meaningful distinctions with source-backed explanations and original questions.
- Keep course coverage distinct from independently demonstrated learning.
- Let learners follow course units and resume their work.
- Make the next useful action clear while preserving explicit learner choice.
- Keep course progress, review summaries, and ChatGPT answers consistent.
