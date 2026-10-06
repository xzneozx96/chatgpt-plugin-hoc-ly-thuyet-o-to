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

test("the answer key stays on the server, and scoring is deterministic", () => {
  const first = getQuestion();
  assert.deepEqual(questionBankSummary, { version: "2026.07.1", total: 600, available: 600, missingImages: 0, missingExplanations: 43 });
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
  const source = JSON.parse(readFileSync(fileURLToPath(new URL("../question-bank.json", import.meta.url)), "utf8")) as {
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
  assert.deepEqual(tools.tools.map((tool) => tool.name).sort(), ["abandon_mock_test", "finalise_mock_test", "get_course", "get_due_reviews", "get_mock_test", "get_progress", "get_question", "get_study_session", "list_units", "next_study_question", "pause_study", "request_study_help", "resume_study", "save_mock_choice", "search_theory", "set_question_confusion", "skip_study_question", "start_mock_test", "start_study", "submit_answer", "submit_study_answer", "update_profile"]);
  const courseTool = tools.tools.find((tool) => tool.name === "get_course");
  const learningUri = (courseTool?._meta as { ui?: { resourceUri?: string } })?.ui?.resourceUri;
  assert.equal(learningUri, "ui://ly-thuyet-lai-xe/learning-v2.html");
  const cardTools = tools.tools.filter((tool) => (tool._meta as { ui?: { resourceUri?: string } })?.ui?.resourceUri === learningUri).map((tool) => tool.name).sort();
  assert.deepEqual(cardTools, ["get_course", "get_mock_test", "next_study_question", "resume_study", "skip_study_question", "start_mock_test", "start_study"], "only entry points open a new card");
  const learningResource = await client.readResource({ uri: learningUri });
  const learningHtml = learningResource.contents[0] as { mimeType: string; text: string };
  assert.equal(learningHtml.mimeType, "text/html;profile=mcp-app");
  assert.match(learningHtml.text, /Lý Thuyết Lái Xe/);
  assert.equal(learningHtml.text.includes("{{BASE_URL}}"), false);
  const getTool = tools.tools.find((tool) => tool.name === "get_question");
  assert.equal((getTool?._meta as { ui?: { resourceUri?: string } })?.ui?.resourceUri, "ui://ly-thuyet-lai-xe/quiz-v1.html");

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
  const due = await client.callTool({ name: "get_due_reviews", arguments: {} });
  assert.ok(Array.isArray((due.structuredContent as { items: unknown[] }).items));
  const search = await client.callTool({ name: "search_theory", arguments: { query: "phần đường xe chạy" } });
  assert.ok((search.structuredContent as { hits: Array<{ questionId: string }> }).hits.some((hit) => hit.questionId === "q001"));

  const resource = await client.readResource({ uri: "ui://ly-thuyet-lai-xe/quiz-v1.html" });
  assert.equal(resource.contents[0]?.mimeType, "text/html;profile=mcp-app");
  assert.ok(resource.contents[0] && "text" in resource.contents[0]);
  assert.match(resource.contents[0].text, /Kiểm tra đáp án/);
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
