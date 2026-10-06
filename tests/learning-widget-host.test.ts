import assert from "node:assert/strict";
import { once } from "node:events";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { chromium } from "playwright";
import { startHttpServer } from "../src/server.js";

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
    await app.getByRole("heading", { name: "Khóa học bằng B" }).waitFor();
    await page.evaluate((params) => {
      const frame = document.querySelector<HTMLIFrameElement>("#widget");
      frame?.contentWindow?.postMessage({ jsonrpc: "2.0", method: "ui/notifications/tool-result", params }, location.origin);
    }, toolResult);
    await app.getByRole("heading", { name: /Phần của đường bộ được sử dụng/ }).waitFor({ timeout: 5000 });
    assert.equal(await app.getByRole("heading", { name: "Khóa học bằng B" }).count(), 0);
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
    await app.getByRole("heading", { name: "Khóa học bằng B" }).waitFor();
    assert.deepEqual(await cardColors(), { background: "rgb(255, 255, 255)", text: "rgb(24, 43, 73)" });
    await page.goto(`${origin}/preview?theme=dark`);
    await app.getByRole("heading", { name: "Khóa học bằng B" }).waitFor();
    assert.deepEqual(await cardColors(), { background: "rgb(26, 33, 49)", text: "rgb(231, 236, 246)" });
    await page.evaluate(() => {
      const frame = document.querySelector<HTMLIFrameElement>("#widget");
      frame?.contentWindow?.postMessage({ jsonrpc: "2.0", method: "ui/notifications/host-context-changed", params: { theme: "light" } }, location.origin);
    });
    await app.locator("html[data-theme='light']").waitFor({ state: "attached" });
    assert.equal((await cardColors()).background, "rgb(255, 255, 255)");
  } finally {
    await browser.close();
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});

test("in ChatGPT the card's answer button sends the choice as a chat message instead of scoring it", async () => {
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
    await app.locator('[data-action="daily"]').click();
    await app.getByRole("heading", { name: /Phần của đường bộ được sử dụng/ }).waitFor();
    await app.locator('input[name="answer"][value="A"]').check();
    await app.getByText("Tôi đoán").click();
    await app.locator('[data-action="answer"]').click();
    await page.locator("#host-message").getByText("Mình chọn A cho câu q001 (đoán).").waitFor();
    await app.getByRole("button", { name: "Đã gửi" }).waitFor();
    assert.equal(await app.getByRole("button", { name: "Đã gửi" }).isDisabled(), true);
    const course = await (await fetch(`${origin}/preview/tool`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name: "get_course", arguments: {} }) })).json();
    assert.equal(course.structuredContent.covered, 0, "ChatGPT scores the answer, not the card");
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
    await page.goto(`${origin}/preview`);
    const app = page.frameLocator("#widget");
    await app.getByRole("heading", { name: "Khóa học bằng B" }).waitFor();
    await app.locator(".brand nav [data-action='mock-entry']").click();
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
    await app.getByText("Đáp án hiển thị là lựa chọn máy chủ đã lưu.").waitFor({ timeout: 5000 });
    await app.locator('[data-action="mock-confirm"]').click();
    await app.getByText("29 câu chưa trả lời. Nộp bài và chấm ngay?").waitFor({ timeout: 2000 });
    await app.locator('[data-action="confirm-yes"]').click();
    await app.getByRole("heading", { name: "Kết quả thi thử" }).waitFor({ timeout: 5000 });
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
    const startMock = async () => {
      await page.goto(`${origin}/preview`);
      await app.getByRole("heading", { name: "Khóa học bằng B" }).waitFor();
      await app.locator(".brand nav [data-action='mock-entry']").click();
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
    await app.getByRole("heading", { name: "Khóa học bằng B" }).waitFor();
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

test("confusion keeps the chosen answer, the card shrinks after long screens, and nothing due says so", async () => {
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
    await page.goto(`${origin}/preview`);
    const app = page.frameLocator("#widget");
    await app.getByRole("heading", { name: "Khóa học bằng B" }).waitFor();
    await app.locator('[data-action="unit"][data-value="van_hoa"]').click();
    await app.locator('input[name="answer"][value="A"]').check();
    await app.getByText("Tôi tự tin").click();
    await app.locator("details.more-actions summary").click();
    await app.getByRole("button", { name: "Tôi còn phân vân" }).click();
    await app.getByRole("button", { name: "Bỏ dấu phân vân" }).waitFor();
    assert.equal(await app.locator('[data-action="answer"]').isDisabled(), false, "answer stays available after the confusion toggle");
    assert.equal(await app.locator('input[name="confidence"][value="confident"]').isChecked(), true, "confidence is kept");

    const frameHeight = () => page.locator("#widget").evaluate((frame: HTMLIFrameElement) => frame.getBoundingClientRect().height);
    await app.locator(".brand nav [data-action='course']").click();
    await app.getByRole("button", { name: "Nhóm dễ nhầm lẫn" }).click();
    await app.locator(".course-row").nth(20).waitFor();
    await page.waitForTimeout(300);
    const tall = await frameHeight();
    await app.locator(".brand nav [data-action='course']").click();
    await app.locator('[data-action="goals"]').click();
    await app.getByRole("heading", { name: "Mục tiêu mỗi ngày" }).waitFor();
    await page.waitForTimeout(300);
    assert.ok(await frameHeight() < tall - 300, `card shrinks after a long screen (${tall} → ${await frameHeight()})`);

    await app.locator('input[name="goal"][value="10"]').check();
    await app.getByRole("button", { name: "Lưu mục tiêu" }).click();
    await app.getByText("10 câu mỗi ngày").waitFor();
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

test("after ChatGPT scores a card-sent answer, the card shows the result and moves on", async () => {
  const dir = mkdtempSync(join(tmpdir(), "driving-widget-followup-"));
  const server = startHttpServer(0, { dataPath: join(dir, "study.sqlite") });
  if (!server.listening) await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing preview port");
  const origin = `http://127.0.0.1:${address.port}`;
  const executablePath = process.env.CHROME_PATH ?? (existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined);
  const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
  const tool = async (name: string, args: object) => (await (await fetch(`${origin}/preview/tool`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, arguments: args }) })).json()).structuredContent;
  try {
    const page = await browser.newPage();
    await page.goto(`${origin}/preview?chat=1`);
    const app = page.frameLocator("#widget");
    await app.locator('[data-action="families"]').first().click();
    await app.locator('[data-action="unit"]').first().click();
    await app.locator('input[name="answer"]').first().waitFor();
    const heading = await app.locator("#content h2").innerText();
    await app.locator('input[name="answer"][value="A"]').check();
    await app.locator('[data-action="answer"]').click();
    await app.getByRole("button", { name: "Đã gửi" }).waitFor();
    const course = await tool("get_course", {}) as { sessions: { id: string; status: string }[] };
    const session = await tool("get_study_session", { sessionId: course.sessions.filter((s) => s.status === "active").at(-1)?.id }) as { sessionId: string; question: { id: string } };
    await tool("submit_study_answer", { sessionId: session.sessionId, questionId: session.question.id, answer: "A", requestId: randomUUID() });
    await app.getByRole("button", { name: "Câu tiếp theo" }).waitFor({ timeout: 8000 });
    await app.getByRole("button", { name: "Câu tiếp theo" }).click();
    await app.locator('[data-action="answer"]', { hasText: "Trả lời" }).waitFor();
    assert.notEqual(await app.locator("#content h2").innerText(), heading, "moved to the next question");
  } finally {
    await browser.close();
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
