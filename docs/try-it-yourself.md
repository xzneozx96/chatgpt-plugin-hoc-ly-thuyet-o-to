# Try the driving theory tutor

The local preview is already running at [http://127.0.0.1:8787/preview](http://127.0.0.1:8787/preview). If it stops, run `npm start` in this project directory and reopen that URL. The source of truth is `question-bank.json` version `2026.07.1`. Use the **Tra cứu** tab to jump directly to a question ID, such as `q499`.

| Case | What to do | Expected result |
| --- | --- | --- |
| First question | Start a general practice session. Choose **A** for q001. | The first prompt asks about the part of a road used by vehicles. It marks A wrong, shows **B**, and explains “phần đường xe chạy.” |
| Navigate without answering | On q001, click **Câu tiếp theo →**, then **← Câu trước**. | q002 opens, then q001 returns. Neither step changes progress or reveals an answer. |
| Correct answer | Move to q002 and choose **B**. | It marks B correct. The next-question control is usable. |
| Traffic sign image | Start the traffic signs topic. | q301 appears with a rendered WebP image and four choices. Choosing **A** is correct. |
| Diagram with two choices | Open q499, or ask for the question about which vehicles may proceed according to the lights. | The image renders and there are exactly two choices. **A** is correct. |
| Intersection diagram | Open q520. | The image renders and **D** is the source answer. The explanation mentions yielding to vehicles from the right. |
| Missing source explanation | Open q010 and submit an answer. | The product states that the bank has no explanation for this question. It does not invent one. |
| Grounded search | Search for “phần đường xe chạy” and “đèn xanh xe con xe khách”. | Results contain question IDs and source excerpts. A result can be opened as a question. Unsupported facts are not fabricated. |
| Learning progress | Submit one wrong answer and one correct answer, then view progress. Reload the browser or restart the server. | The totals remain. After those two answers the preview shows two practiced questions and 50% accuracy. |
| Review queue | Answer q001 incorrectly, then open **Ôn tập**. | q001 is due immediately. Answering it correctly schedules the next review for the following day. |
| Source coverage | Browse each of the seven topics through the end. | Every source question is reachable with its original text and option count. There are 600 questions in total and 318 local images. |

When trying the ChatGPT connection, start a **new chat** after enabling the plugin. Suggested prompts:

1. `Cho tôi luyện câu hỏi đầu tiên trong bộ 600 câu. Đừng tiết lộ đáp án trước khi tôi chọn.`
2. `Tôi chọn A cho câu q001. Kiểm tra và giải thích dựa trên ngân hàng câu hỏi.`
3. `Cho tôi một câu về biển báo, kèm hình.`
4. `Tìm trong ngân hàng câu hỏi nội dung về phần đường xe chạy, và nêu rõ mã câu.`
5. `Cho tôi câu q499 và hình minh họa. Đừng tiết lộ đáp án trước.`

In ChatGPT, check that it calls the plugin tools for scoring and source lookup. Its free-form prose can vary; the question text, options, answer keys, and citations should match the source. The temporary public connection omits private progress and review tools; those are available in the local preview until account login is implemented.
