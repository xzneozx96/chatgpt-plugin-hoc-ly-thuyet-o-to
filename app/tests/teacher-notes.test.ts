import assert from "node:assert/strict";
import { test } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { TeacherNotes, parseTeacherNote } from "../src/domain/teacher-notes.js";

const page48 = `## Câu 18

Đề: Theo chức năng phục vụ thì đường bộ được phân loại như thế nào?

## Câu 19 – ĐIỂM LIỆT

ĐIỂM LIỆT: trả lời sai câu này là không đạt bài thi.

Đề: Hành vi nào dưới đây bị nghiêm cấm?

## Đáp án (ngân hàng câu hỏi): ý 2

## Thầy Tâm nói:

“Cho nên số một mà bảo đi xe đạp trên các tuyến đường quốc lộ mà bảo bị cấm là sai.” — [V1 26:10]

Sách học lý thuyết lái xe ô tô

48`;
const page49 = `“Thì cái trường hợp đấy là bị cấm.” — [V1 26:25]

Tóm tắt: Rải vật sắc nhọn là bị cấm nên chọn ý số hai.

Mẹo liên quan: T2.20 – Một ý sai thì đáp án gộp chứa ý đó cũng sai

Nguồn: V1 25:23–27:03 (video theo số câu); V10 1:38–3:24 (video 60 câu điểm liệt)

Ghi chú nguồn: đoạn video có thể lệch; cần đối chiếu khi xem.

## Câu 20 – ĐIỂM LIỆT

“Câu khác.” — [V1 27:49]

Sách học lý thuyết lái xe ô tô

49`;

test("parses quotes, summary, tip and timestamped links for one question across a page break", () => {
  const note = parseTeacherNote(19, [{ page: 48, text: page48 }, { page: 49, text: page49 }]);
  assert.ok(note);
  assert.equal(note.questionId, "q019");
  assert.deepEqual(note.quotes.map((quote) => [quote.timestamp, quote.url]), [
    ["V1 26:10", "https://www.youtube.com/watch?v=33Yt_JQWzYk&t=1570s"],
    ["V1 26:25", "https://www.youtube.com/watch?v=33Yt_JQWzYk&t=1585s"]
  ]);
  assert.equal(note.summary, "Rải vật sắc nhọn là bị cấm nên chọn ý số hai.");
  assert.equal(note.relatedTip, "T2.20 – Một ý sai thì đáp án gộp chứa ý đó cũng sai");
  assert.deepEqual(note.segments.map((segment) => [segment.videoCode, segment.start, segment.end, segment.url]), [
    ["V1", "25:23", "27:03", "https://www.youtube.com/watch?v=33Yt_JQWzYk&t=1523s"],
    ["V10", "1:38", "3:24", "https://www.youtube.com/watch?v=Uv_j-wkRFHE&t=98s"]
  ]);
  assert.equal(note.sourceNote, "đoạn video có thể lệch; cần đối chiếu khi xem.");
});

test("returns null when the question is not on the fetched pages", () => {
  assert.equal(parseTeacherNote(5, [{ page: 48, text: page48 }]), null);
});

test("fetches only the pages a question spans and caches the result", async () => {
  const requests: string[] = [];
  const notes = new TeacherNotes(async (_doc, pages) => { requests.push(pages); return [{ page: 48, text: page48 }, { page: 49, text: page49 }]; });
  assert.equal((await notes.forQuestion(19))?.quotes.length, 2);
  await notes.forQuestion(19);
  assert.deepEqual(requests, ["48-49"]);
});

test("find_teacher_explanation is registered only when a teaching source is configured", async () => {
  const { createQuizServer } = await import("../src/server.js");
  const names = async () => {
    const server = createQuizServer();
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    const client = new Client({ name: "test", version: "1" });
    await Promise.all([server.connect(serverTransport), client.connect(clientTransport)]);
    return (await client.listTools()).tools.map((tool) => tool.name);
  };
  assert.ok(!(await names()).includes("find_teacher_explanation"));
  process.env.AEGIS_MCP_TOKEN = "test-token";
  try {
    assert.ok((await names()).includes("find_teacher_explanation"));
  } finally {
    delete process.env.AEGIS_MCP_TOKEN;
  }
});
