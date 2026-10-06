# Direction B learning prototype

The owner selected B, Đường học, on 6 October 2026. The main prototype now opens on the course overview. Historical alternatives remain under `/directions/`.

Run from the project root:

```sh
python3 -m http.server 8790 --bind 127.0.0.1 --directory design/chatgpt-learning
```

Open http://127.0.0.1:8790/.

## Try these paths

1. Continue today. Review the two due questions, inspect bank explanations, then enter the short guided speed comparison.
2. Open a category and start its five-question practice. Return to the course overview to see first-pass coverage update.
3. Open Câu hỏi dễ nhầm lẫn. Search `q145` or `toc do`, select Tốc độ trong khu dân cư và loại đường, inspect its five-question progress and try original questions.
4. Open Ôn tập to see pending mistakes and unresolved confusion. A correct answer does not clear a learner's confusion flag.
5. Change the daily new-question goal to 10, 12, 15 or a custom integer. Reviews are additional.
6. Start Thi thử. Navigate forward/back, retain provisional answers, and inspect the 30-question index. Leaving an active test requires explicit confirmation. Submit to see the configured score result.

## Sample progress

One Map keyed by original question ID supplies all unit summaries. The initial sample covers q144, q145 and q146; q144 has seeded delayed mastery, and q145/q146 are due. Shared group memberships never add duplicate overall coverage. A first submission increases coverage once. Immediate correctness cannot add delayed mastery. Wrong answers remove mastery and remain in review; confusion stays until cleared explicitly.

All progress is temporary and resets on reload. The guided comparison is a short demonstration, not a completed daily quota or adaptive lesson engine. Category practice is five questions; the full configured daily quota is not assembled by a model here. Multi-day scheduling, durable accounts and learning records remain production work.

## Sources and test boundary

All 600 records in questions.json are unchanged copies of the source bank. Images are original local question assets. Family membership is draft and needs content review. Explanations are supplied-bank text; missing explanations are disclosed. No video teacher, quotation or timestamp is fabricated.

Random practice samples 30 unique licence-B-applicable questions from the full bank. Its 20-minute deadline continues during submission/exit confirmation. At least 27 correct and no wrong or unanswered critical question are required. This random composition does not represent official examination distribution. The supplied official test library is pending. Test responses remain distinct from study progress in this prototype.

This artifact simulates the ChatGPT conversation around the widget. Authentication, MCP knowledge retrieval, live ChatGPT coaching, persisted schedules and actual ChatGPT-host rendering are not connected. See docs/ui-ux-direction-b-verification.md and .impeccable/review/ for captured verification evidence.

Fonts are local Be Vietnam Pro files in directions/assets under the included OFL license. The discarded v3 source is archived in .impeccable/archive/v3/.
