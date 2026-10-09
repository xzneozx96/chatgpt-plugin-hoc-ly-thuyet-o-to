import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { once } from "node:events";
import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import type { Server } from "node:http";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { getQuestion, questionBankSummary, submitAnswer } from "../src/domain/quiz.js";
import { startHttpServer } from "../src/server.js";
import { courseView, createLearner, executeLearning, type LearnerState } from "../src/domain/learning.js";
import { learningText } from "../src/learning-tools.js";

test("the answer key stays on the server, and scoring is deterministic", () => {
  const first = getQuestion();
  assert.deepEqual(questionBankSummary, { version: "2026.07.1", total: 600, available: 600, missingImages: 0, missingExplanations: 42 });
  assert.equal(first.options.length, 3);
  assert.equal("correctAnswer" in first, false);
  assert.equal(submitAnswer(first.id, "B").correct, true);
  assert.equal(submitAnswer(first.id, "A").correct, false);
  assert.equal(getQuestion(first.id).id, "q002");
  assert.equal(getQuestion("q300").imagePath, "images/q301.webp");
  assert.equal(getQuestion(undefined, "bien_bao").id, "q301");
  assert.equal(getQuestion("q301", "bien_bao").id, "q302");
  assert.throws(() => getQuestion(undefined, "unknown"), /TOPIC_NOT_FOUND/);
  assert.throws(() => submitAnswer(first.id, "D"), /INVALID_ANSWER/);
  assert.throws(() => getQuestion("missing"), /QUESTION_NOT_FOUND/);
  assert.throws(() => submitAnswer("missing", "A"), /QUESTION_NOT_FOUND/);
});

test("all 600 source questions are reachable with unchanged text and answer keys", () => {
  const source = JSON.parse(readFileSync(fileURLToPath(new URL("../data/question-bank.json", import.meta.url)), "utf8")) as {
    questions: Array<{ id: number; text: string; imagePath: string | null; options: Array<{ key: number; text: string }>; correctKey: number }>;
  };
  let previous: string | undefined;
  for (const item of source.questions) {
    const current = getQuestion(previous);
    assert.equal(current.id, `q${String(item.id).padStart(3, "0")}`);
    assert.equal(current.question, item.text);
    assert.equal(current.imagePath, item.imagePath);
    assert.deepEqual(current.options.map((option) => option.text), item.options.map((option) => option.text));
    const selected = current.options.find((option) => option.id === (["A", "B", "C", "D"] as const)[item.correctKey - 1]);
    assert.ok(selected);
    assert.equal(submitAnswer(current.id, selected.id).correct, true);
    previous = current.id;
  }
  assert.equal(getQuestion(previous).id, "q001");
});

let httpServer: Server;
let client: Client;
let transport: StreamableHTTPClientTransport;

before(async () => {
  httpServer = startHttpServer(0, { dataPath: ":memory:" });
  if (!httpServer.listening) await once(httpServer, "listening");
  const address = httpServer.address();
  if (!address || typeof address === "string") throw new Error("Missing test port");
  transport = new StreamableHTTPClientTransport(new URL(`http://127.0.0.1:${address.port}/mcp`));
  client = new Client({ name: "quiz-test-client", version: "0.1.0" });
  await client.connect(transport);
});

after(async () => {
  await client?.close();
  await transport?.close();
  if (httpServer?.listening) await new Promise<void>((resolve) => httpServer.close(() => resolve()));
});

test("MCP get, submit, next and UI resource work over HTTP", async () => {
  const tools = await client.listTools();
  assert.deepEqual(tools.tools.map((tool) => tool.name).sort(), ["abandon_mock_test", "finalise_mock_test", "get_course", "get_league", "get_mock_test", "get_progress", "get_question", "get_study_session", "get_today_mistakes", "join_league", "leave_league", "list_units", "next_study_question", "pause_study", "request_study_help", "resume_study", "save_mock_choice", "search_theory", "set_league_hidden", "skip_study_question", "start_lightning", "start_mock_test", "start_study", "submit_answer", "submit_study_answer", "update_profile"]);
  const courseTool = tools.tools.find((tool) => tool.name === "get_course");
  const learningUri = (courseTool?._meta as { ui?: { resourceUri?: string } })?.ui?.resourceUri;
  assert.match(learningUri ?? "", /^ui:\/\/ly-thuyet-lai-xe\/learning-[0-9a-f]{12}\.html$/);
  const cardTools = tools.tools.filter((tool) => (tool._meta as { ui?: { resourceUri?: string } })?.ui?.resourceUri === learningUri).map((tool) => tool.name).sort();
  assert.deepEqual(cardTools, ["get_course", "get_league", "get_mock_test", "get_question", "get_today_mistakes", "join_league", "leave_league", "next_study_question", "resume_study", "set_league_hidden", "skip_study_question", "start_lightning", "start_mock_test", "start_study"], "only entry points open a new card");
  const learningResource = await client.readResource({ uri: learningUri ?? "" });
  const learningHtml = learningResource.contents[0] as { mimeType: string; text: string };
  assert.equal(learningHtml.mimeType, "text/html;profile=mcp-app");
  assert.match(learningHtml.text, /Lý Thuyết Lái Xe/);
  assert.equal(learningHtml.text.includes("{{BASE_URL}}"), false);
  const staleUri = "ui://ly-thuyet-lai-xe/learning-da7844442067.html";
  const stale = (await client.readResource({ uri: staleUri })).contents[0] as { uri: string; text: string };
  assert.deepEqual([stale.uri, stale.text], [staleUri, learningHtml.text], "a card URI from an earlier deploy still opens today's card");
  assert.deepEqual((await client.listResources()).resources.map(r => r.uri), [learningUri], "only the current card URI is listed");
  const getTool = tools.tools.find((tool) => tool.name === "get_question");
  assert.match((getTool?._meta as { ui?: { resourceUri?: string } })?.ui?.resourceUri ?? "", /^ui:\/\/ly-thuyet-lai-xe\/learning-[0-9a-f]{12}\.html$/, "single questions use the Direction B widget");

  const first = await client.callTool({ name: "get_question", arguments: {} });
  const question = first.structuredContent as { id: string; options: unknown[] };
  assert.equal(question.id, "q001");
  assert.equal(question.options.length, 3);
  assert.equal("correctAnswer" in question, false);

  const wrong = await client.callTool({ name: "submit_answer", arguments: { questionId: question.id, selectedAnswer: "A" } });
  const wrongResult = wrong.structuredContent as { correct: boolean; correctAnswer: string; explanation: string };
  assert.equal(wrongResult.correct, false);
  assert.equal(wrongResult.correctAnswer, "B");
  assert.match(wrongResult.explanation, /phần đường xe chạy/);
  const right = await client.callTool({ name: "submit_answer", arguments: { questionId: question.id, selectedAnswer: "B" } });
  assert.equal((right.structuredContent as { correct: boolean }).correct, true);

  const next = await client.callTool({ name: "get_question", arguments: { afterQuestionId: question.id } });
  assert.equal((next.structuredContent as { id: string }).id, "q002");
  const imageQuestion = await client.callTool({ name: "get_question", arguments: { afterQuestionId: "q300" } });
  const imageUrl = (imageQuestion.structuredContent as { imageUrl: string }).imageUrl;
  const image = await fetch(imageUrl);
  assert.equal(image.status, 200);
  assert.equal(image.headers.get("content-type"), "image/webp");
  assert.equal((await image.arrayBuffer()).byteLength > 1000, true);
  const signQuestion = await client.callTool({ name: "get_question", arguments: { topic: "bien_bao" } });
  assert.equal((signQuestion.structuredContent as { id: string }).id, "q301");
  const invalid = await client.callTool({ name: "get_question", arguments: { afterQuestionId: "missing" } });
  assert.equal(invalid.isError, true);

  const progress = await client.callTool({ name: "get_progress", arguments: {} });
  assert.equal((progress.structuredContent as { totalAttempts: number }).totalAttempts, 2);
  assert.equal((progress.structuredContent as { correctAttempts: number }).correctAttempts, 1);
  const search = await client.callTool({ name: "search_theory", arguments: { query: "phần đường xe chạy" } });
  assert.ok((search.structuredContent as { hits: Array<{ questionId: string }> }).hits.some((hit) => hit.questionId === "q001"));

  const resources = await client.listResources();
  assert.equal(resources.resources.some((resource) => resource.uri.includes("quiz-v1")), false, "the legacy quiz card is no longer served over MCP");
});

test("study tools tell ChatGPT to show the original bank question verbatim, with its image", async () => {
  const text = (result: Awaited<ReturnType<typeof client.callTool>>) => (result.content as { type: string; text: string }[])[0]?.text ?? "";
  const started = await client.callTool({ name: "start_study", arguments: { unitId: "bien_bao", requestId: randomUUID() } });
  const session = started.structuredContent as { sessionId: string; question: { id: string; question: string; imagePath: string | null; options: { id: string; text: string }[] } };
  const shown = text(started);
  assert.match(shown, /Show it to the learner exactly as written/);
  assert.ok(shown.includes(`${session.question.id}: ${session.question.question}`), "question text is copied verbatim");
  for (const option of session.question.options) assert.ok(shown.includes(`${option.id}. ${option.text}`), `option ${option.id} is copied verbatim`);
  assert.ok(session.question.imagePath, "a signs question has an image");
  assert.match(shown, new RegExp(`Hình: http://127\\.0\\.0\\.1:\\d+/images/${session.question.id}\\.webp`));
  const answered = await client.callTool({ name: "submit_study_answer", arguments: { sessionId: session.sessionId, questionId: session.question.id, answer: "A", requestId: randomUUID() } });
  assert.match(text(answered), /Do not write a question yourself/);
  assert.doesNotMatch(text(answered), /"queue"/);
});

test("the course text gives ChatGPT the card's four labels, with the questions waiting for Đã thuộc and when they can count", () => {
  const at = Date.parse("2026-10-05T16:55:00Z"); // 23:55 in Vietnam
  const one = (state: LearnerState, questionId: string, answer: string, now: number) => {
    const started = executeLearning(state, { kind: "start_study", requestId: randomUUID(), questionIds: [questionId] }, now);
    const sessionId = started.state.sessions.at(-1)?.id ?? "";
    return executeLearning(started.state, { kind: "answer_study", requestId: randomUUID(), sessionId, questionId, answer: answer as "A" }, now).state;
  };
  const key = (questionId: string) => submitAnswer(questionId, "A").correctAnswer;
  let state = one(createLearner(at), "q001", key("q001"), at);
  state = one(state, "q002", key("q002") === "A" ? "B" : "A", at + 60000);
  const view = courseView(state, at + 120000);
  const course = learningText({ ...view, historyAvailable: true, serverNow: at + 120000 }, "http://127.0.0.1");
  assert.equal(view.dueCount, 0);
  assert.match(course, new RegExp(`^Khóa học bằng B: Đã gặp 2/600 · Đã thuộc 1/600 · Cần ôn hôm nay 0 · Sai hôm nay 1\\.$`, "m"));
  assert.match(course, /^Đang trong lịch ôn: 1 câu cần ôn \(sau 1, 3, 7, 14 ngày\) mới tính vào Đã thuộc; sớm nhất ôn lại lúc 23:56 ngày 6\/10\.$/m, "the next time comes in the learner's timezone");
  assert.doesNotMatch(course, /đã nhớ|đã thử/, "the old unlabelled counts are gone");
  const due = learningText({ ...courseView(state, at + 2 * 86400000), historyAvailable: true, serverNow: at + 2 * 86400000 }, "http://127.0.0.1");
  assert.match(due, /^Đang trong lịch ôn: 1 câu cần ôn \(sau 1, 3, 7, 14 ngày\) mới tính vào Đã thuộc; có câu đã đến hạn, ôn ngay để thuộc\.$/m);
});

test("text replies are readable summaries and errors are plain Vietnamese", async () => {
  const text = (result: Awaited<ReturnType<typeof client.callTool>>) => (result.content as { type: string; text: string }[])[0]?.text ?? "";
  const course = text(await client.callTool({ name: "get_course", arguments: {} }));
  assert.match(course, /^Khóa học bằng B: Đã gặp \d+\/600 · Đã thuộc \d+\/600 · Cần ôn hôm nay \d+ · Sai hôm nay \d+\./m);
  assert.match(course, /Câu hỏi dễ nhầm lẫn \(de_nham_lan\)/);
  assert.doesNotMatch(course, /nháp|draft/i, "confusing-question groups are approved, not drafts");
  assert.ok(course.length < 2000, `course summary stays short (${course.length} chars)`);
  assert.match(text(await client.callTool({ name: "get_question", arguments: { questionId: "q001" } })), /^q001: Phần của đường bộ/m);
  const lesson = await client.callTool({ name: "start_study", arguments: { questionIds: ["q002"], requestId: randomUUID() } });
  const lessonView = lesson.structuredContent as { sessionId: string };
  const help = text(await client.callTool({ name: "request_study_help", arguments: { questionId: "q002", sessionId: lessonView.sessionId, requestId: randomUUID() } }));
  assert.match(help, /Đã ghi nhận yêu cầu hỗ trợ cho q002/);
  const mismatch = await client.callTool({ name: "submit_study_answer", arguments: { sessionId: lessonView.sessionId, questionId: "q003", answer: "A", requestId: randomUUID() } });
  assert.equal(mismatch.isError, true);
  assert.equal(text(mismatch), "Câu này không phải câu đang mở trong buổi học. Hãy trả lời câu hiện tại.");
  await client.callTool({ name: "submit_study_answer", arguments: { sessionId: lessonView.sessionId, questionId: "q002", answer: "A", requestId: randomUUID() } });
  const done = text(await client.callTool({ name: "next_study_question", arguments: { sessionId: lessonView.sessionId, requestId: randomUUID() } }));
  assert.match(done, /Hoàn thành buổi học: \d\/1 câu đúng\./);
});

test("a running mock is summarised in text and its questions cannot be looked up or scored elsewhere", async () => {
  const text = (result: Awaited<ReturnType<typeof client.callTool>>) => (result.content as { type: string; text: string }[])[0]?.text ?? "";
  const started = await client.callTool({ name: "start_mock_test", arguments: { mode: "random", requestId: randomUUID() } });
  const mock = started.structuredContent as { attemptId: string; questions: { id: string; question: string; critical: boolean | null }[] };
  const first = mock.questions[0];
  assert.ok(first);
  assert.match(text(started), /^Bài thi thử .* · đã chọn 0\/30\./);
  assert.ok(text(started).includes(`Câu 1/30 · ${first.id}: ${first.question}`));
  assert.ok(mock.questions.every((question) => question.critical === null), "critical questions are not flagged during the test");
  const search = await client.callTool({ name: "search_theory", arguments: { query: first.question.slice(0, 40) } });
  assert.equal((search.structuredContent as { hits: { questionId: string }[] }).hits.some((hit) => hit.questionId === first.id), false);
  const scored = await client.callTool({ name: "submit_answer", arguments: { questionId: first.id, selectedAnswer: "A" } });
  assert.equal(text(scored), "Câu này đang nằm trong bài thi thử chưa nộp. Hãy nộp hoặc dừng bài thi trước.");
  const finished = await client.callTool({ name: "finalise_mock_test", arguments: { attemptId: mock.attemptId, confirmUnanswered: true, requestId: randomUUID() } });
  assert.match(text(finished), /^Kết quả thi thử .*: 0\/30 · Chưa đạt/);
  assert.equal((finished.structuredContent as { remainingMs: number }).remainingMs, 0);
});

test("the server tells ChatGPT to turn a study-reminder request into a daily scheduled task that reports due reviews", () => {
  const instructions = client.getInstructions() ?? "";
  const rule = instructions.split(/(?<=\.)\s/).filter((sentence) => /reminder|scheduled task/i.test(sentence)).join(" ");
  assert.match(rule, /Hãy tạo lời nhắc hằng ngày lúc/, "the card's reminder message is named");
  assert.match(rule, /daily ChatGPT scheduled task/);
  assert.match(rule, /get_course/);
  assert.match(rule, /Học tiếp/);
  assert.match(rule, /unavailable on their plan/);
  assert.match(rule, /Never say a reminder exists/);
});

test("the card's own calls get short text that keeps ChatGPT silent, a replay ignores the marker, and errors carry a code", async () => {
  const text = (result: Awaited<ReturnType<typeof client.callTool>>) => (result.content as { type: string; text: string }[])[0]?.text ?? "";
  const started = await client.callTool({ name: "start_study", arguments: { questionIds: ["q010"], requestId: randomUUID(), caller: "card" } });
  const session = started.structuredContent as { sessionId: string; question: { id: string; question: string } };
  assert.match(text(started), /Stay silent/);
  assert.equal(text(started).includes(session.question.question), false, "the card shows the question, so the text does not");
  assert.doesNotMatch(text(started), /Show it to the learner/);
  const args = { sessionId: session.sessionId, questionId: session.question.id, answer: "A", requestId: randomUUID() };
  const answered = await client.callTool({ name: "submit_study_answer", arguments: { ...args, caller: "card" } });
  assert.match(text(answered), /Stay silent/);
  assert.doesNotMatch(text(answered), /next_study_question|Kết quả q010/, "no instruction to continue and no restated verdict");
  const replay = await client.callTool({ name: "submit_study_answer", arguments: args });
  assert.notEqual(replay.isError, true, "the marker is not part of the request, so the replay matches");
  assert.match(text(replay), /Kết quả q010: (Đúng|Sai)\. Đáp án gốc/, "without the marker ChatGPT gets the full text-only reply");
  const results = (replay.structuredContent as { sessionResults: { answered: number } }).sessionResults;
  assert.equal(results.answered, 1, "the replay saved nothing new");
  const mismatch = await client.callTool({ name: "submit_study_answer", arguments: { ...args, questionId: "q011", requestId: randomUUID(), caller: "card" } });
  assert.equal(mismatch.isError, true);
  assert.deepEqual(mismatch.structuredContent, { kind: "error", code: "QUESTION_BINDING_MISMATCH" });
});

test("lesson results carry every queued answer key in hidden _meta, never in the content the model reads; mock tests carry none", async () => {
  const keysOf = (result: { _meta?: unknown }) => (result._meta as { lessonKeys?: Record<string, { correctAnswer: string; question: { id: string }; teachingStatus: string }> } | undefined)?.lessonKeys;
  const started = await client.callTool({ name: "start_study", arguments: { questionIds: ["q001", "q003"], requestId: randomUUID(), caller: "card" } });
  const keys = keysOf(started);
  assert.deepEqual(Object.fromEntries(Object.entries(keys ?? {}).map(([id, key]) => [id, [key.question.id, key.correctAnswer, key.teachingStatus]])), { q001: ["q001", "B", "bank_text_unreviewed"], q003: ["q003", "A", "bank_text_unreviewed"] });
  assert.equal(JSON.stringify(started.structuredContent).includes("correctAnswer"), false, "an unanswered lesson's view has no key");
  assert.equal(JSON.stringify(started.content).includes("correctAnswer"), false);
  const meta = started._meta as { lessonKeys?: Record<string, { award?: { wrong: number } }>; xpBudget?: { lightningLeft: number | null } };
  assert.deepEqual([meta.lessonKeys?.q001?.award?.wrong, meta.xpBudget?.lightningLeft], [-3, null], "award hints and the XP budget ride with the keys");
  assert.equal(/award|xpBudget|lessonMeta/.test(JSON.stringify([started.structuredContent, started.content])), false, "the model never sees award hints");
  const sessionId = (started.structuredContent as { sessionId: string }).sessionId;
  const address = httpServer.address();
  assert.ok(address && typeof address === "object");
  const preview = await (await fetch(`http://127.0.0.1:${address.port}/preview/tool`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: "get_study_session", arguments: { sessionId } }) })).json() as { _meta?: unknown; structuredContent: object };
  assert.equal(keysOf(preview)?.q003?.correctAnswer, "A", "the preview bridge attaches the same keys");
  assert.equal(JSON.stringify(preview.structuredContent).includes("correctAnswer"), false);
  const mock = await client.callTool({ name: "start_mock_test", arguments: { mode: "random", requestId: randomUUID() } });
  assert.equal(keysOf(mock), undefined, "a mock test gets no answer keys");
  await client.callTool({ name: "abandon_mock_test", arguments: { attemptId: (mock.structuredContent as { attemptId: string }).attemptId, requestId: randomUUID() } });
});
