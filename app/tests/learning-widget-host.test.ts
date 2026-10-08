import assert from "node:assert/strict";
import { once } from "node:events";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { chromium, type Page } from "playwright";
import { startHttpServer } from "../src/server.js";

type WidgetMessage = { method: string; name?: string; arguments?: Record<string, unknown> };

// Records what the widget posts to its host, in order, so tests can check chat messages and tool calls.
async function recordWidgetMessages(page: Page) {
  await page.evaluate(() => {
    const log: WidgetMessage[] = [];
    (window as unknown as { widgetMessages: WidgetMessage[] }).widgetMessages = log;
    window.addEventListener("message", (event) => {
      const message = event.data as { jsonrpc?: string; method?: string; params?: { name?: string; arguments?: Record<string, unknown> } } | null;
      if (message?.jsonrpc === "2.0" && message.method) log.push({ method: message.method, name: message.params?.name, arguments: message.params?.arguments });
    });
  });
  return () => page.evaluate(() => (window as unknown as { widgetMessages: WidgetMessage[] }).widgetMessages);
}

test("a widget opened by a tool call shows that tool's result, not the course overview", async () => {
  const dir = mkdtempSync(join(tmpdir(), "driving-widget-host-"));
  const server = startHttpServer(0, { dataPath: join(dir, "study.sqlite") });
  if (!server.listening) await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing preview port");
  const origin = `http://127.0.0.1:${address.port}`;
  const executablePath = process.env.CHROME_PATH ?? (existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined);
  const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
  try {
    const toolResult = await (await fetch(`${origin}/preview/tool`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "start_study", arguments: { requestId: randomUUID() } })
    })).json();
    const page = await browser.newPage();
    await page.goto(`${origin}/preview`);
    const app = page.frameLocator("#widget");
    await app.getByRole("button", { name: "Học tiếp" }).waitFor();
    await page.evaluate((params) => {
      const frame = document.querySelector<HTMLIFrameElement>("#widget");
      frame?.contentWindow?.postMessage({ jsonrpc: "2.0", method: "ui/notifications/tool-result", params }, location.origin);
    }, toolResult);
    await app.getByRole("button", { name: "Bắt đầu" }).waitFor({ timeout: 5000 });
    assert.equal(await app.getByRole("button", { name: "Học tiếp" }).count(), 0);
    await app.getByRole("button", { name: "Bắt đầu" }).click();
    await app.getByRole("heading", { name: /Phần của đường bộ được sử dụng/ }).waitFor({ timeout: 5000 });
  } finally {
    await browser.close();
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the widget follows the host theme at start and when the host changes it", async () => {
  const dir = mkdtempSync(join(tmpdir(), "driving-widget-theme-"));
  const server = startHttpServer(0, { dataPath: join(dir, "study.sqlite") });
  if (!server.listening) await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing preview port");
  const origin = `http://127.0.0.1:${address.port}`;
  const executablePath = process.env.CHROME_PATH ?? (existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined);
  const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    const app = page.frameLocator("#widget");
    const cardColors = () => app.locator(".card").evaluate((card) => ({ background: getComputedStyle(card).backgroundColor, text: getComputedStyle(card).color }));
    await page.goto(`${origin}/preview`);
    await app.locator("#goal-form").waitFor();
    assert.deepEqual(await cardColors(), { background: "rgb(252, 250, 255)", text: "rgb(48, 42, 59)" });
    await page.goto(`${origin}/preview?theme=dark`);
    await app.locator("#goal-form").waitFor();
    assert.deepEqual(await cardColors(), { background: "rgb(21, 21, 21)", text: "rgb(243, 243, 243)" });
    await page.evaluate(() => {
      const frame = document.querySelector<HTMLIFrameElement>("#widget");
      frame?.contentWindow?.postMessage({ jsonrpc: "2.0", method: "ui/notifications/host-context-changed", params: { theme: "light" } }, location.origin);
    });
    await app.locator("html[data-theme='light']").waitFor({ state: "attached" });
    assert.equal((await cardColors()).background, "rgb(252, 250, 255)");
  } finally {
    await browser.close();
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("in ChatGPT the card's answer button scores the choice through tools/call and posts no chat message", async () => {
  const dir = mkdtempSync(join(tmpdir(), "driving-widget-chat-"));
  const server = startHttpServer(0, { dataPath: join(dir, "study.sqlite") });
  if (!server.listening) await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing preview port");
  const origin = `http://127.0.0.1:${address.port}`;
  const executablePath = process.env.CHROME_PATH ?? (existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined);
  const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.goto(`${origin}/preview?chat=1`);
    const app = page.frameLocator("#widget");
    await app.locator('input[name="goal"][value="12"]').check();
    await app.getByRole("button", { name: "Bắt đầu" }).click();
    await app.getByRole("button", { name: "Học bài đầu" }).click();
    await app.getByRole("button", { name: "Bắt đầu" }).click();
    await app.getByRole("heading", { name: /Phần của đường bộ được sử dụng/ }).waitFor();
    const messages = await recordWidgetMessages(page);
    await app.locator('input[name="answer"][value="A"]').check();
    await app.getByRole("button", { name: "Tôi đoán", exact: true }).click();
    await app.locator('[data-action="answer"]').click();
    await app.getByRole("heading", { name: "Chưa đúng" }).waitFor();
    const sent = await messages();
    assert.deepEqual(sent.filter((m) => m.name === "submit_study_answer").map((m) => [m.method, m.arguments?.answer, m.arguments?.confidence]), [["tools/call", "A", "guess"]]);
    assert.equal(sent.filter((m) => m.method === "ui/message").length, 0, "the card never posts an answer into the chat");
    const course = await (await fetch(`${origin}/preview/tool`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "get_course", arguments: {} }) })).json();
    assert.equal(course.structuredContent.results.totalAttempts, 1, "the card scored the answer once");
  } finally {
    await browser.close();
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("in a sandboxed host with slow saves the mock keeps moving, keeps the list open, and submits", async () => {
  const dir = mkdtempSync(join(tmpdir(), "driving-widget-mock-"));
  const server = startHttpServer(0, { dataPath: join(dir, "study.sqlite") });
  if (!server.listening) await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing preview port");
  const origin = `http://127.0.0.1:${address.port}`;
  const executablePath = process.env.CHROME_PATH ?? (existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined);
  const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    const dialogs: string[] = [];
    page.on("dialog", (dialog) => { dialogs.push(dialog.message()); void dialog.dismiss(); });
    await page.route(`${origin}/preview`, async (route) => {
      const html = await (await route.fetch()).text();
      await route.fulfill({ contentType: "text/html", body: html.replace('<iframe id="widget"', '<iframe id="widget" sandbox="allow-scripts allow-same-origin"') });
    });
    await page.route(`${origin}/preview/tool`, async (route) => {
      if (route.request().postData()?.includes("save_mock_choice")) await new Promise((resolve) => setTimeout(resolve, 1500));
      await route.continue();
    });
    await fetch(`${origin}/preview/tool`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "start_study", arguments: { requestId: randomUUID() } }) });
    await page.goto(`${origin}/preview`);
    const app = page.frameLocator("#widget");
    await app.getByRole("button", { name: "Thi thử" }).click();
    await app.locator('[data-action="mock-start"]').click();
    await app.getByText("Câu 1/30", { exact: false }).waitFor();
    const started = Date.now();
    await app.locator('input[name="answer"]').first().check();
    await app.locator('[data-action="mock-next"]').click();
    await app.getByText("Câu 2/30", { exact: false }).waitFor();
    assert.ok(Date.now() - started < 800, `moved on in ${Date.now() - started} ms without waiting for the save`);
    await app.locator("details.test-index summary").click();
    await app.locator('[data-action="mock-next"]').click();
    await app.getByText("Câu 3/30", { exact: false }).waitFor({ timeout: 500 });
    assert.equal(await app.locator("details.test-index").evaluate((element: HTMLDetailsElement) => element.open), true, "question list stays open");
    await app.locator('[data-action="mock-nav"][data-value="0"]').click();
    assert.equal(await app.locator('input[name="answer"]').first().isChecked(), true, "choice kept while saving");
    await app.getByText("Đã lưu lựa chọn.").waitFor({ timeout: 5000 });
    await app.locator('[data-action="mock-confirm"]').first().click();
    await app.getByRole("alertdialog", { name: "Nộp bài?" }).waitFor({ timeout: 2000 });
    await app.locator('[data-action="confirm-yes"]').click();
    await app.getByRole("heading", { name: "Kết quả" }).waitFor({ timeout: 5000 });
    assert.deepEqual(dialogs, [], "no browser dialogs; sandboxed hosts block them");
  } finally {
    await browser.close();
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("asking for a mock while one is unfinished says so and can start a fresh test", async () => {
  const dir = mkdtempSync(join(tmpdir(), "driving-widget-resume-"));
  const server = startHttpServer(0, { dataPath: join(dir, "study.sqlite") });
  if (!server.listening) await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing preview port");
  const origin = `http://127.0.0.1:${address.port}`;
  const executablePath = process.env.CHROME_PATH ?? (existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined);
  const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    const app = page.frameLocator("#widget");
    await fetch(`${origin}/preview/tool`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "start_study", arguments: { requestId: randomUUID() } }) });
    const startMock = async () => {
      await page.goto(`${origin}/preview`);
      await app.getByRole("button", { name: "Thi thử" }).click();
      await app.locator('[data-action="mock-start"]').click();
      await app.locator("#timer").waitFor();
    };
    await startMock();
    assert.equal(await app.locator(".resume-note").count(), 0, "a new test has no resume note");
    await startMock();
    await app.getByText(/Bạn đang làm tiếp bài thi bắt đầu lúc/).waitFor();
    await app.locator('[data-action="mock-restart"]').click();
    await app.locator('[data-action="confirm-yes"]').click();
    await app.locator(".resume-note").waitFor({ state: "detached" });
    const course = await (await fetch(`${origin}/preview/tool`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "get_course", arguments: {} }) })).json();
    assert.deepEqual(course.structuredContent.mocks.map((mock: { status: string }) => mock.status), ["abandoned", "active"]);
  } finally {
    await browser.close();
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a card opened by get_question shows the practice screen with the question and image", async () => {
  const dir = mkdtempSync(join(tmpdir(), "driving-widget-question-"));
  const server = startHttpServer(0, { dataPath: join(dir, "study.sqlite") });
  if (!server.listening) await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing preview port");
  const origin = `http://127.0.0.1:${address.port}`;
  const executablePath = process.env.CHROME_PATH ?? (existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined);
  const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
  try {
    const toolResult = await (await fetch(`${origin}/preview/tool`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "get_question", arguments: { questionId: "q373" } }) })).json();
    const page = await browser.newPage();
    await page.goto(`${origin}/preview`);
    const app = page.frameLocator("#widget");
    await app.locator("#goal-form").waitFor();
    await page.evaluate((params) => {
      document.querySelector<HTMLIFrameElement>("#widget")?.contentWindow?.postMessage({ jsonrpc: "2.0", method: "ui/notifications/tool-result", params }, location.origin);
    }, toolResult);
    await app.getByRole("heading", { name: "Luyện câu gốc" }).waitFor();
    await app.getByRole("heading", { name: /Biển nào báo hiệu nguy hiểm giao nhau với đường sắt/ }).waitFor();
    await app.getByText("Câu trả lời được lưu vào lịch sử học.").waitFor();
    assert.equal(await app.locator(".question-image").count(), 1);
  } finally {
    await browser.close();
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("opening the explanation keeps the chosen answer and verdict, the card shrinks after long screens, and nothing due says so", async () => {
  const dir = mkdtempSync(join(tmpdir(), "driving-widget-polish-"));
  const server = startHttpServer(0, { dataPath: join(dir, "study.sqlite") });
  if (!server.listening) await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing preview port");
  const origin = `http://127.0.0.1:${address.port}`;
  const executablePath = process.env.CHROME_PATH ?? (existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined);
  const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await fetch(`${origin}/preview/tool`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "start_study", arguments: { requestId: randomUUID() } }) });
    await page.goto(`${origin}/preview`);
    const app = page.frameLocator("#widget");
    await app.getByRole("button", { name: "Chọn chủ đề" }).click();
    await app.getByRole("button", { name: /^Văn hóa giao thông/ }).click();
    await app.locator('[data-action="unit"][data-value="van_hoa"]').click();
    await app.getByRole("button", { name: "Bắt đầu" }).click();
    await app.locator('input[name="answer"][value="A"]').check();
    await app.locator('[data-action="answer"]').click();
    const verdict = await app.locator("#verdict").innerText();
    await app.locator('[data-action="why"]').click();
    assert.equal(await app.getByRole("button", { name: "Tôi còn phân vân" }).count(), 0);
    assert.equal(await app.locator("#verdict").innerText(), verdict, "the verdict stays after opening the explanation");
    assert.equal(await app.locator('input[name="answer"][value="A"]').isChecked(), true, "the chosen answer is kept");

    const frameHeight = () => page.locator("#widget").evaluate((frame: HTMLIFrameElement) => frame.getBoundingClientRect().height);
    await app.getByRole("button", { name: "Tạm dừng và lưu" }).click();
    await app.getByRole("button", { name: "Về trang chính" }).click();
    await app.getByRole("button", { name: "Chọn chủ đề" }).click();
    await app.getByRole("button", { name: /^Câu hỏi dễ nhầm lẫn/ }).click();
    await app.getByRole("button", { name: "Chọn nhóm" }).click();
    await app.locator(".frow").nth(9).waitFor();
    await page.waitForTimeout(300);
    const tall = await frameHeight();
    await app.locator('[data-action="map"]').click();
    await app.locator('[data-action="course"]').first().click();
    await app.locator('[data-action="goals"]').click();
    await app.getByRole("heading", { name: "Mỗi ngày bạn muốn học bao nhiêu câu mới?" }).waitFor();
    await page.waitForTimeout(300);
    const compact = await frameHeight();
    const contentHeight = await app.locator(".card").evaluate((card) => Math.ceil(card.getBoundingClientRect().height));
    assert.ok(compact < tall - 100, `card shrinks after a long screen (${tall} → ${compact})`);
    assert.ok(Math.abs(compact - contentHeight) <= 2, "host height follows the rendered card including its illustration");

    await app.locator('input[name="goal"][value="10"]').check();
    await app.getByRole("button", { name: "Lưu mục tiêu" }).click();
    await app.getByText("Theo nhịp 10 câu/ngày", { exact: false }).waitFor();
    for (let i = 0; i < 40; i++) {
      const view = await (await fetch(`${origin}/preview/tool`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "start_study", arguments: { requestId: randomUUID() } }) })).json();
      const study = view.structuredContent as { sessionId: string; question: { id: string } | null };
      if (!study.question) break;
      await fetch(`${origin}/preview/tool`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "submit_study_answer", arguments: { sessionId: study.sessionId, questionId: study.question.id, answer: "A", requestId: randomUUID() } }) });
      await fetch(`${origin}/preview/tool`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "next_study_question", arguments: { sessionId: study.sessionId, requestId: randomUUID() } }) });
    }
    await page.reload();
    await app.locator('[data-action="daily"]').click();
    await app.getByText(/Hôm nay không còn câu đến hạn ôn và bạn đã đạt mục tiêu câu mới/).waitFor();
  } finally {
    await browser.close();
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a lost answer response shows no verdict, and Thử lại resends the same request without a second attempt", async () => {
  const dir = mkdtempSync(join(tmpdir(), "driving-widget-retry-"));
  const server = startHttpServer(0, { dataPath: join(dir, "study.sqlite") });
  if (!server.listening) await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing preview port");
  const origin = `http://127.0.0.1:${address.port}`;
  const executablePath = process.env.CHROME_PATH ?? (existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined);
  const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    const submits: string[] = [];
    await page.route(`${origin}/preview/tool`, async (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}") as { name?: string; arguments?: { requestId?: string } };
      if (body.name !== "submit_study_answer") return route.continue();
      submits.push(body.arguments?.requestId ?? "");
      const response = await route.fetch();
      // The server saves the first answer, but its response never reaches the card.
      if (submits.length === 1) return route.fulfill({ status: 502, body: "" });
      return route.fulfill({ response });
    });
    await fetch(`${origin}/preview/tool`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "start_study", arguments: { requestId: randomUUID() } }) });
    await page.goto(`${origin}/preview`);
    const app = page.frameLocator("#widget");
    await app.locator('[data-action="daily"]').click();
    await app.getByRole("button", { name: "Bắt đầu" }).click();
    await app.locator('input[name="answer"][value="A"]').check();
    await app.locator('[data-action="answer"]').click();
    await app.getByText("Chưa gửi được — thử lại").waitFor();
    assert.equal(await app.locator("#verdict").count(), 0, "no verdict before the server's result arrives");
    assert.equal(await app.locator('input[name="answer"][value="A"]').isChecked(), true, "the choice is kept");
    assert.equal(await app.getByRole("button", { name: "Thử lại" }).count(), 1, "one retry control");
    assert.equal(await app.locator("#status").innerText(), "", "the row says it once; the host's error text is not shown as well");
    await app.getByRole("button", { name: "Thử lại" }).click();
    await app.getByRole("heading", { name: "Chưa đúng" }).waitFor();
    assert.equal(submits.length, 2);
    assert.equal(submits[1], submits[0], "the retry reuses the request ID");
    const course = await (await fetch(`${origin}/preview/tool`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "get_course", arguments: {} }) })).json();
    assert.equal(course.structuredContent.results.totalAttempts, 1, "the retry does not save a second attempt");
  } finally {
    await browser.close();
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("Hỏi ChatGPT records help on the server before posting exactly one chat message", async () => {
  const dir = mkdtempSync(join(tmpdir(), "driving-widget-help-"));
  const server = startHttpServer(0, { dataPath: join(dir, "study.sqlite") });
  if (!server.listening) await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing preview port");
  const origin = `http://127.0.0.1:${address.port}`;
  const executablePath = process.env.CHROME_PATH ?? (existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined);
  const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await fetch(`${origin}/preview/tool`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "start_study", arguments: { requestId: randomUUID() } }) });
    await page.goto(`${origin}/preview?chat=1`);
    const app = page.frameLocator("#widget");
    await app.locator('[data-action="daily"]').click();
    await app.getByRole("button", { name: "Bắt đầu" }).click();
    await app.locator('input[name="answer"][value="A"]').check();
    await app.locator('[data-action="answer"]').click();
    await app.getByRole("heading", { name: "Chưa đúng" }).waitFor();
    const messages = await recordWidgetMessages(page);
    await app.locator('[data-action="why"]').click();
    await app.getByRole("button", { name: "Hỏi ChatGPT về câu này" }).click();
    await page.locator("#host-message").getByText("Giải thích giúp mình câu 1: mình chọn A, đáp án là B. [q001 · chọn A · sai]").waitFor();
    const sent = (await messages()).filter((m) => m.method === "ui/message" || m.name === "request_study_help").map((m) => m.name ?? m.method);
    assert.deepEqual(sent, ["request_study_help", "ui/message"], "help is recorded before the one chat message");
    await app.getByRole("heading", { name: "Chưa đúng" }).waitFor();
  } finally {
    await browser.close();
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the finish screen posts the lesson summary once, and reopening the finished lesson does not post it again", async () => {
  const dir = mkdtempSync(join(tmpdir(), "driving-widget-finish-"));
  const server = startHttpServer(0, { dataPath: join(dir, "study.sqlite") });
  if (!server.listening) await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing preview port");
  const origin = `http://127.0.0.1:${address.port}`;
  const executablePath = process.env.CHROME_PATH ?? (existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined);
  const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
  const tool = async (name: string, args: object) => (await fetch(`${origin}/preview/tool`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, arguments: args }) })).json();
  const open = (page: Page, params: unknown) => page.evaluate((result) => {
    document.querySelector<HTMLIFrameElement>("#widget")?.contentWindow?.postMessage({ jsonrpc: "2.0", method: "ui/notifications/tool-result", params: result }, location.origin);
  }, params);
  try {
    const started = await tool("start_study", { questionIds: ["q001"], requestId: randomUUID() });
    const page = await browser.newPage();
    await page.goto(`${origin}/preview?chat=1`);
    const app = page.frameLocator("#widget");
    await app.getByRole("button", { name: "Học tiếp" }).waitFor();
    await open(page, started);
    await app.getByRole("button", { name: "Bắt đầu" }).click();
    await app.locator('input[name="answer"][value="B"]').check();
    await app.locator('[data-action="answer"]').click();
    await app.getByRole("heading", { name: "Chính xác!" }).waitFor();
    const messages = await recordWidgetMessages(page);
    await app.getByRole("button", { name: "Tiếp tục" }).click();
    await app.getByRole("heading", { name: "Hoàn thành bài học!" }).waitFor();
    const sessionId = started.structuredContent.sessionId as string;
    await page.locator("#host-message").getByText(`Xong bài: 1/1 đúng, +10 XP. [session ${sessionId} · tổng kết]`).waitFor();
    assert.equal((await messages()).filter((m) => m.method === "ui/message").length, 1);

    await page.reload();
    const app2 = page.frameLocator("#widget");
    await app2.getByRole("button", { name: "Học tiếp" }).waitFor();
    const reopened = await recordWidgetMessages(page);
    await open(page, await tool("get_study_session", { sessionId }));
    await app2.getByRole("heading", { name: "Hoàn thành bài học!" }).waitFor();
    await page.waitForTimeout(300);
    assert.equal((await reopened()).filter((m) => m.method === "ui/message").length, 0, "the summary is not posted twice");
  } finally {
    await browser.close();
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
