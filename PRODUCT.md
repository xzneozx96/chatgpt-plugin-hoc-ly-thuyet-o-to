# Lý Thuyết Lái Xe

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Vietnamese-speaking learners preparing for licence B, including beginners and candidates close to their exam. The owner prefers daily sessions of roughly 15–20 minutes, delivered as 2–3 short game-like lessons of 6–10 minutes, with due review adding time as needed. The app is free and shared with Vietnamese learner communities.

## Product Purpose

Make studying for the licence-B theory exam feel like a short daily game inside ChatGPT, inspired by Duolingo and Brilliant. Learners understand driving-theory distinctions, retain them through spaced recall, and see their progress through a structured 600-question course.

## Operating Context

ChatGPT is the learner surface. One interactive lesson card runs the play loop: it scores answers directly through the server, shows the only verdict, and owns progress. ChatGPT coaches only when the learner asks, after repeated mistakes, and at lesson end (PRD section 7). The local prototype is only for design review and development. Users do not visit a separate playground to study. YouTube source segments open externally.

## Capabilities and Constraints

The question bank supplies original wording, images, answers, and applicability. Seven original categories remain intact. “Câu hỏi dễ nhầm lẫn” adds 249 overlapping families. Categories and groups are trackable course units derived from original question records. Coverage and delayed learning are separate. Shared questions count once toward overall coverage and due review.

Complete all due review first by default. Honour an explicit request for another activity without clearing outstanding reviews. Learners choose daily new-question goals of 10, 12, 15, or a custom number. Approved external MCP knowledge supplies explanations and timestamped video links. Source integration, production identity, persistence, and ChatGPT host validation remain implementation gates.

Game layer: server-computed XP, a daily goal ring built from the new-question goal plus due review, and opt-in pseudonymous weekly leagues. No streaks, levels, badges or lives. Learners see three progress numbers: Đã gặp (seen), Đã thuộc (mastered), Cần ôn hôm nay (due today).

Mock tests contain 30 questions, last 20 minutes, require at least 27 correct, and fail on any wrong or unanswered critical question. The owner-supplied test library is pending. Random-bank practice must be labelled honestly.

## Brand Commitments

The name is Lý Thuyết Lái Xe. Vietnamese is the teaching language. On 6 October 2026 the owner judged the deployed direction-B build (navy text, blue actions, Be Vietnam Pro) boring, flat and confusing, because feedback was split between the card and ChatGPT. PRD v1.0 supersedes direction B. Both themes are strictly black and white, like ChatGPT: white with black in light mode, black with white in dark mode. Correct and wrong are carried by icon, shape, motion and words, never colour. Delight comes from motion, typography and celebration moments. The design system is in DESIGN.md. docs/ui-ux-direction-b-contract.md is historical.

## Evidence on Hand

question-bank.json contains 600 original questions. Local images accompany image-dependent questions. docs/question-family-analysis.json contains 249 draft families; 132 need visual review. The PRD defines learning and review policy. Prototype history is illustrative. Approved video segments are not yet available in the prototype.

## Product Principles

- Play in the card, talk in the chat: one verdict per answer, shown instantly by the card.
- Small wins often, never punishment: XP, a filling goal ring and lesson celebrations; no lives or streak loss.
- Teach meaningful distinctions with source-backed explanations and original questions.
- Keep course coverage distinct from independently demonstrated learning.
- Let learners follow course units and resume their work.
- Make the next useful action clear while preserving explicit learner choice.
- Keep course progress, review summaries, and ChatGPT answers consistent.
