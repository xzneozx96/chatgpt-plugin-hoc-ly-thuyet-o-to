import assert from "node:assert/strict";
import { once } from "node:events";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { chromium, type FrameLocator, type Page } from "playwright";
import { startHttpServer } from "../src/server.js";
import { safeQuestion } from "../src/domain/course.js";
import { submitAnswer } from "../src/domain/quiz.js";
import { LearningRuntime } from "../src/domain/learning-runtime.js";
import { SqliteLearningStore } from "../src/persistence/learning-store.js";

type WidgetMessage = { method: string; name?: string; arguments?: Record<string, unknown> };
interface Preview { origin: string; dataPath: string; page: Page; app: FrameLocator; tool(name: string, args: object): Promise<{ structuredContent: Record<string, unknown>; isError?: boolean }>; open(result: unknown): Promise<void>; messages(): Promise<() => Promise<WidgetMessage[]>> }

const right = (q: string) => submitAnswer(q, safeQuestion(q).options[0]?.id ?? "A").correctAnswer;
const wrong = (q: string) => safeQuestion(q).options.find(o => o.id !== right(q))?.id ?? "A";

/** Runs a test against a fresh local server and the preview host, which plays ChatGPT's part. */
async function withPreview(run: (preview: Preview) => Promise<void>, setup: (page: Page, origin: string) => Promise<void> = async () => {}) {
  const dir = mkdtempSync(join(tmpdir(), "driving-card-"));
  const dataPath = join(dir, "study.sqlite");
  const server = startHttpServer(0, { dataPath });
  if (!server.listening) await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing preview port");
  const origin = `http://127.0.0.1:${address.port}`;
  const executablePath = process.env.CHROME_PATH ?? (existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined);
  const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    page.on("dialog", () => assert.fail("the card never opens browser dialogs"));
    await setup(page, origin);
    const tool = async (name: string, args: object) => (await fetch(`${origin}/preview/tool`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, arguments: args }) })).json();
    const open = (result: unknown) => page.evaluate((params) => {
      document.querySelector<HTMLIFrameElement>("#widget")?.contentWindow?.postMessage({ jsonrpc: "2.0", method: "ui/notifications/tool-result", params }, location.origin);
    }, result);
    // Records what the widget posts to its host, in order, from the moment this is called.
    const messages = async () => {
      await page.evaluate(() => {
        const log: WidgetMessage[] = [];
        (window as unknown as { widgetMessages: WidgetMessage[] }).widgetMessages = log;
        window.addEventListener("message", (event) => {
          const message = event.data as { jsonrpc?: string; method?: string; params?: { name?: string; arguments?: Record<string, unknown> } } | null;
          if (message?.jsonrpc === "2.0" && message.method) log.push({ method: message.method, name: message.params?.name, arguments: message.params?.arguments });
        });
      });
      return () => page.evaluate(() => (window as unknown as { widgetMessages: WidgetMessage[] }).widgetMessages);
    };
    await run({ origin, dataPath, page, app: page.frameLocator("#widget"), tool, open, messages });
  } finally {
    await browser.close();
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
}

test("✕ pauses while a lost answer waits for its resend, and the resend keeps its request ID", async () => {
  const submits: string[] = [];
  await withPreview(async ({ origin, page, app, tool, open }) => {
    const started = await tool("start_study", { questionIds: ["q001", "q002"], requestId: randomUUID() });
    await page.goto(`${origin}/preview`);
    await app.locator('[data-action="daily"], [data-action="lesson-start"], [data-action="goals"]').first().waitFor();
    await open(started);
    await app.getByRole("button", { name: "Bắt đầu" }).click();
    await app.locator('input[name="answer"][value="A"]').check();
    await app.locator('[data-action="answer"]').click();
    await app.getByText("Chưa gửi được — thử lại").waitFor();
    await app.getByRole("button", { name: "Tạm dừng và lưu" }).click();
    await app.getByRole("heading", { name: "Buổi học đã tạm dừng" }).waitFor();
    await app.getByRole("button", { name: "Tiếp tục" }).click();
    await app.getByText("Chưa gửi được — thử lại").waitFor();
    assert.equal(await app.locator('input[name="answer"][value="A"]').isChecked(), true, "the choice is kept across the pause");
    await app.getByRole("button", { name: "Thử lại" }).click();
    await app.getByRole("heading", { name: "Chưa đúng" }).waitFor();
    assert.equal(submits.length, 2);
    assert.equal(submits[1], submits[0], "the resend reuses the request ID");
    const course = await tool("get_course", {});
    assert.equal((course.structuredContent.results as { totalAttempts: number }).totalAttempts, 1);
  }, async (page, origin) => {
    await page.route(`${origin}/preview/tool`, async (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}") as { name?: string; arguments?: { requestId?: string } };
      if (body.name !== "submit_study_answer") return route.continue();
      submits.push(body.arguments?.requestId ?? "");
      // The first answer never reaches the server.
      if (submits.length === 1) return route.fulfill({ status: 502, body: "" });
      return route.continue();
    });
  });
});

test("the lesson summary counts as posted only after the host accepts it, and a failed send offers Thử lại", async () => {
  await withPreview(async ({ origin, page, app, tool, open, messages }) => {
    const started = await tool("start_study", { questionIds: ["q001"], requestId: randomUUID() });
    const sessionId = started.structuredContent.sessionId as string;
    await page.goto(`${origin}/preview?chat=1`);
    await app.locator("[data-action]").first().waitFor();
    await open(started);
    await app.getByRole("button", { name: "Bắt đầu" }).click();
    await app.locator(`input[name="answer"][value="${right("q001")}"]`).check();
    await app.locator('[data-action="answer"]').click();
    await app.getByRole("heading", { name: "Chính xác!" }).waitFor();
    await app.getByRole("button", { name: "Tiếp tục" }).click();
    await app.getByRole("heading", { name: "Hoàn thành bài học!" }).waitFor();
    await app.getByText("Chưa gửi được tổng kết vào khung chat").waitFor();
    const sent = await messages();
    await app.locator('[data-action="summary-retry"]').click();
    await page.locator("#host-message").getByText(`Xong bài: 1/1 đúng, +10 XP. [session ${sessionId} · tổng kết]`).waitFor();
    await app.getByText("Chưa gửi được tổng kết vào khung chat").waitFor({ state: "detached" });
    assert.equal((await sent()).filter((m) => m.method === "ui/message").length, 1);

    await page.reload();
    await app.locator("[data-action]").first().waitFor();
    const reopened = await messages();
    await open(await tool("get_study_session", { sessionId }));
    await app.getByRole("heading", { name: "Hoàn thành bài học!" }).waitFor();
    await page.waitForTimeout(300);
    assert.equal((await reopened()).filter((m) => m.method === "ui/message").length, 0, "a summary that was sent is not sent again");
  }, async (page, origin) => {
    // The host refuses the first chat message, as a host that is offline for a moment would.
    await page.route(`${origin}/preview?chat=1`, async (route) => {
      const html = await (await route.fetch()).text();
      await route.fulfill({ contentType: "text/html", body: html.replace("else if(m.method==='ui/message'){", "else if(m.method==='ui/message'){if(!window.refusedOnce){window.refusedOnce=true;throw new Error('Host offline');}") });
    });
  });
});

test("a card reopened from an old tool result shows the step the server has now", async () => {
  await withPreview(async ({ origin, page, app, tool, open }) => {
    const started = await tool("start_study", { questionIds: ["q001", "q002"], requestId: randomUUID() });
    const sessionId = started.structuredContent.sessionId as string;
    await tool("submit_study_answer", { sessionId, questionId: "q001", answer: right("q001"), requestId: randomUUID() });
    await tool("next_study_question", { sessionId, requestId: randomUUID() });
    await page.goto(`${origin}/preview`);
    await app.locator("[data-action]").first().waitFor();
    await open(started);
    await app.getByRole("heading", { name: "Làn đường là gì?" }).waitFor();
    assert.equal(await app.getByRole("heading", { name: /Phần của đường bộ được sử dụng/ }).count(), 0, "the stale first question is not shown");
  });
});

test("skipping the last question ends on the finish screen with what is left, and posts no summary", async () => {
  await withPreview(async ({ origin, page, app, tool, open, messages }) => {
    const started = await tool("start_study", { questionIds: ["q001", "q002"], requestId: randomUUID() });
    await page.goto(`${origin}/preview?chat=1`);
    await app.locator("[data-action]").first().waitFor();
    await open(started);
    const sent = await messages();
    await app.getByRole("button", { name: "Bắt đầu" }).click();
    await app.locator(`input[name="answer"][value="${right("q001")}"]`).check();
    await app.locator('[data-action="answer"]').click();
    await app.getByRole("button", { name: "Tiếp tục" }).click();
    await app.getByRole("heading", { name: "Làn đường là gì?" }).waitFor();
    await app.getByRole("button", { name: "Bỏ qua" }).click();
    await app.getByText("Đã bỏ qua · vẫn cần ôn").waitFor();
    await app.getByRole("button", { name: "Tiếp tục" }).click();
    await app.getByText("Còn 1 câu bỏ qua — vẫn cần ôn").waitFor();
    await app.getByText("Bỏ qua: 1", { exact: false }).waitFor();
    assert.equal(await app.getByRole("heading", { name: "Buổi học đã tạm dừng" }).count(), 0);
    await page.waitForTimeout(300);
    assert.equal((await sent()).filter((m) => m.method === "ui/message").length, 0, "nothing is posted while a question is still owed");
    await app.getByRole("button", { name: "Làm câu bỏ qua" }).click();
    await app.getByRole("heading", { name: "Làn đường là gì?" }).waitFor();
  });
});

test("XP, the combo and a repair step come from the server, and a second miss offers ChatGPT's deeper explanation", async () => {
  await withPreview(async ({ origin, page, app, tool, open, messages }) => {
    const ids = ["q001", "q002", "q003", "q004", "q005", "q006"];
    const started = await tool("start_study", { questionIds: ids, requestId: randomUUID() });
    await page.goto(`${origin}/preview?chat=1`);
    await app.locator("[data-action]").first().waitFor();
    await open(started);
    await app.getByRole("button", { name: "Bắt đầu" }).click();
    const answer = async (q: string, choice: string) => {
      await app.locator(`input[name="answer"][value="${choice}"]`).check();
      await app.locator('[data-action="answer"]').click();
      await app.locator("#verdict").waitFor();
    };
    // Waits for the next step to replace the verdict, so a choice is never made on the old question.
    const next = async () => {
      await app.getByRole("button", { name: "Tiếp tục" }).click();
      await app.locator("#verdict").waitFor({ state: "detached" });
    };
    await answer("q001", right("q001"));
    for (const q of ["q002", "q003"]) {
      await next();
      await answer(q, right(q));
    }
    await app.getByText("Combo 3 câu liên tiếp").waitFor();
    await app.locator(".panel .xp").getByText("+10 XP").waitFor();
    await next();
    await app.locator(".combo-pill").getByText("×3").waitFor();
    await answer("q004", wrong("q004"));
    await app.locator(".panel .xp").getByText("+3 XP").waitFor();
    for (const q of ["q005", "q006"]) {
      await next();
      await answer(q, right(q));
    }
    await next();
    await app.getByText("THỬ LẠI", { exact: true }).waitFor();
    await app.getByText("Bạn đã sai câu này lúc nãy").waitFor();
    const sent = await messages();
    await answer("q004", wrong("q004"));
    await app.getByRole("heading", { name: "Chưa đúng" }).waitFor();
    await app.locator(".panel .xp").getByText("+2 XP").waitFor();
    await app.getByRole("button", { name: "ChatGPT có thể giải thích kỹ hơn" }).click();
    await page.locator("#host-message").getByText("Mình vẫn nhầm câu 4, giải thích kỹ hơn nhé. [q004 · lần 2 · sai]").waitFor();
    const order = (await sent()).filter((m) => m.method === "ui/message" || m.name === "request_study_help" || m.name === "submit_study_answer").map((m) => m.name ?? m.method);
    assert.deepEqual(order, ["submit_study_answer", "request_study_help", "ui/message"], "help is recorded before the one chat message");
    assert.ok((await sent()).filter((m) => m.method === "tools/call").every((m) => m.arguments?.caller === "card"), "every card call says it came from the card");
  });
});

test("a compare-the-pair step submits both answers, shows both verdicts and the draft family's aspects, then continues once", async () => {
  await withPreview(async ({ origin, page, app, tool, open, messages }) => {
    let view = (await tool("start_study", { requestId: randomUUID() })).structuredContent as { sessionId: string; question: { id: string } | null; pair: { questions: { id: string }[] } | null };
    const sessionId = view.sessionId;
    for (let i = 0; i < 20 && !view.pair && view.question; i++) {
      await tool("submit_study_answer", { sessionId, questionId: view.question.id, answer: right(view.question.id), requestId: randomUUID() });
      view = (await tool("next_study_question", { sessionId, requestId: randomUUID() })).structuredContent as typeof view;
    }
    assert.ok(view.pair, "the daily lesson ends with a pair");
    const [a, b] = view.pair.questions.map((q) => q.id);
    assert.ok(a && b);
    await page.goto(`${origin}/preview`);
    await app.locator("[data-action]").first().waitFor();
    await open(await tool("get_study_session", { sessionId }));
    await app.getByRole("heading", { name: "Hai câu dễ nhầm" }).waitFor();
    const check = app.getByRole("button", { name: "Kiểm tra cả hai" });
    assert.equal(await check.isDisabled(), true, "both questions need a choice first");
    const sent = await messages();
    await app.locator(`input[name="pair-${b}"][value="${wrong(b)}"]`).check();
    assert.equal(await check.isDisabled(), true);
    await app.locator(`input[name="pair-${a}"][value="${right(a)}"]`).check();
    await check.click();
    await app.getByText("BẢN NHÁP · chưa duyệt").waitFor();
    await app.locator(".vchip").getByText("Chính xác!").waitFor();
    await app.locator(".vchip").getByText("Chưa đúng").waitFor();
    assert.equal(await app.locator(".diff .axes li").count() > 0, true, "the family's aspects are named");
    const calls = () => sent().then((log) => log.filter((m) => m.method === "tools/call" && m.name !== "get_study_session").map((m) => [m.name, m.arguments?.questionId ?? null]));
    assert.deepEqual(await calls(), [["submit_study_answer", a], ["submit_study_answer", b]], "two answers, no next yet");
    await app.locator(".diff").getByRole("button", { name: "Tiếp tục" }).click();
    await app.locator(".diff").waitFor({ state: "detached" });
    assert.deepEqual((await calls()).map(([name]) => name), ["submit_study_answer", "submit_study_answer", "next_study_question"]);
  });
});

/** Starts a lightning round for the preview's learner as if it had begun `ago` ms earlier, after answering q001 to q003. */
async function lightningStartedAgo(dataPath: string, ago: number) {
  const store = new SqliteLearningStore(dataPath);
  const runtime = new LearningRuntime(store, "local-development", () => Date.now() - ago);
  for (const q of ["q001", "q002", "q003"]) await runtime.command({ kind: "answer_question", requestId: randomUUID(), questionId: q, answer: right(q) });
  const round = await runtime.command({ kind: "start_lightning", requestId: randomUUID() });
  store.close();
  assert.ok(round.kind === "study");
  return round.sessionId;
}

test("a lightning round sends answers whatever the card's clock says, and shows the server's summary once time is up", async () => {
  await withPreview(async ({ origin, dataPath, page, app, tool, open, messages }) => {
    // The round began 58 seconds ago, but the card is told it has 30 seconds left, as a slow clock would.
    const sessionId = await lightningStartedAgo(dataPath, 58000);
    await page.goto(`${origin}/preview`);
    await app.locator("[data-action]").first().waitFor();
    const opened = await tool("get_study_session", { sessionId });
    await page.route(`${origin}/preview/tool`, async (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}") as { name?: string };
      const response = await route.fetch();
      const json = await response.json();
      if (body.name === "get_study_session" && json.structuredContent?.remainingMs > 0) json.structuredContent.remainingMs = 30000;
      await route.fulfill({ response, json });
    });
    await open(opened);
    await app.getByText("CHỚP NHOÁNG").waitFor();
    await app.locator('[data-action="lt-check"]').waitFor();
    const sent = await messages();
    await page.waitForTimeout(2500);
    assert.equal(await app.getByRole("heading", { name: "Hết giờ!" }).count(), 0, "the card's own clock still shows time left");
    await app.locator('input[name="answer"]').first().check();
    await page.keyboard.press("Enter");
    await app.getByRole("heading", { name: "Hết giờ!" }).waitFor();
    const answers = (await sent()).filter((m) => m.name === "submit_study_answer");
    assert.equal(answers.length, 1, "the late answer was sent, not blocked in the card");
    await app.locator("#status").getByText("Hết 60 giây — câu cuối không được tính.").waitFor();
    const course = await tool("get_course", {});
    assert.equal((course.structuredContent.results as { totalAttempts: number }).totalAttempts, 3, "the server saved nothing for the late answer");
  });
});

test("when the lightning countdown reaches zero the card fetches the round once and lists its mistakes", async () => {
  await withPreview(async ({ origin, dataPath, page, app, tool, open }) => {
    const sessionId = await lightningStartedAgo(dataPath, 52000);
    const fetches: string[] = [];
    await page.route(`${origin}/preview/tool`, async (route) => {
      fetches.push((JSON.parse(route.request().postData() ?? "{}") as { name?: string }).name ?? "");
      await route.continue();
    });
    await page.goto(`${origin}/preview`);
    await app.locator("[data-action]").first().waitFor();
    const opened = await tool("get_study_session", { sessionId });
    const first = (opened.structuredContent.question as { id: string }).id;
    await open(opened);
    await app.locator("h2.stem").waitFor();
    await app.locator(`input[name="answer"][value="${wrong(first)}"]`).check();
    await app.locator('[data-action="lt-check"]').click();
    await app.locator(".flash").getByText("Chưa đúng — sẽ quay lại trong lịch ôn").waitFor();
    const before = fetches.filter((name) => name === "get_study_session").length;
    await app.getByRole("heading", { name: "Hết giờ!" }).waitFor({ timeout: 15000 });
    await page.waitForTimeout(600);
    assert.equal(fetches.filter((name) => name === "get_study_session").length - before, 1, "one fetch when the countdown ends");
    await app.getByRole("button", { name: /Câu \d+ Xem lại/ }).click();
    await app.getByText(`Đáp án đúng: ${right(first)} ·`, { exact: false }).waitFor();
    await app.getByText(`Bạn chọn: ${wrong(first)} ·`, { exact: false }).waitFor();
  });
});

test("the home card draws the goal ring and the three numbers from the course view, and the course map starts a category", async () => {
  await withPreview(async ({ origin, page, app, tool, messages }) => {
    const started = await tool("start_study", { questionIds: ["q001", "q002", "q003", "q004", "q005"], requestId: randomUUID() });
    const sessionId = started.structuredContent.sessionId as string;
    // Plays the whole lesson, missing q002 once, so it finishes and the league invitation appears.
    let current = started.structuredContent.question as { id: string } | null, missed = false;
    while (current) {
      const miss: boolean = current.id === "q002" && !missed;
      missed ||= miss;
      await tool("submit_study_answer", { sessionId, questionId: current.id, answer: miss ? wrong(current.id) : right(current.id), requestId: randomUUID() });
      current = (await tool("next_study_question", { sessionId, requestId: randomUUID() })).structuredContent.question as { id: string } | null;
    }
    const course = (await tool("get_course", {})).structuredContent as { covered: number; learned: number; dueCount: number; newToday: number; dailyGoal: number };
    await page.goto(`${origin}/preview`);
    await app.getByRole("button", { name: "Học tiếp" }).waitFor();
    assert.equal(await app.locator(".ring-num").innerText(), `${course.newToday}/${course.dailyGoal}`);
    assert.equal(await app.locator(".ring .seg").count(), course.dailyGoal, "one segment per new question in today's goal");
    assert.equal(await app.locator(".ring .seg.on").count(), course.newToday);
    const tiles = await app.locator(".nums .ntile").allInnerTexts();
    assert.deepEqual(tiles.map((t) => t.replace(/\s+/g, " ").trim()), [`${course.covered}/600 Đã gặp`, `${course.learned}/600 Đã thuộc`, `${course.dueCount} câu Cần ôn hôm nay`]);
    await app.getByRole("button", { name: /Tham gia nhóm thi đua tuần/ }).waitFor();
    assert.equal(await app.locator(".row-btn").count(), 0, "a learner outside the league sees only the invitation");
    await app.getByText("Theo nhịp 12 câu/ngày: xong lượt đầu ngày", { exact: false }).waitFor();

    await app.getByRole("button", { name: "Chọn chủ đề" }).click();
    await app.getByRole("button", { name: /^Biển báo, đã gặp 0 trên 185/ }).click();
    await app.getByRole("heading", { name: "Biển báo" }).waitFor();
    const sent = await messages();
    await app.locator(".sheet").getByRole("button", { name: "Học", exact: true }).click();
    await app.getByRole("button", { name: "Bắt đầu" }).waitFor();
    const call = (await sent()).find((m) => m.name === "start_study");
    assert.deepEqual([call?.arguments?.unitId, call?.arguments?.override], ["bien_bao", true]);
  });
});

test("joining the league shows the server's name errors in the card's words, then the board, hiding and an in-card leave", async () => {
  await withPreview(async ({ origin, page, app, tool }) => {
    const started = await tool("start_study", { questionIds: ["q001"], requestId: randomUUID() });
    const sessionId = started.structuredContent.sessionId as string;
    await tool("submit_study_answer", { sessionId, questionId: "q001", answer: right("q001"), requestId: randomUUID() });
    await tool("next_study_question", { sessionId, requestId: randomUUID() });
    await page.goto(`${origin}/preview`);
    await app.getByRole("button", { name: /Tham gia nhóm thi đua tuần/ }).click();
    await app.getByRole("heading", { name: "Thi đua XP mỗi tuần" }).waitFor();
    const name = app.getByLabel("Tên hiển thị");
    await name.fill("ab");
    await app.getByRole("button", { name: "Tham gia nhóm" }).click();
    await app.getByRole("alert").getByText("Tên cần 3–20 ký tự: chữ, số, khoảng trắng hoặc . _ -").waitFor();
    assert.equal(await name.inputValue(), "ab", "the typed name stays for correcting");
    await name.fill("vcl abc");
    await app.getByRole("button", { name: "Tham gia nhóm" }).click();
    await app.getByRole("alert").getByText("Tên này không phù hợp. Chọn tên khác nhé.").waitFor();
    assert.equal(await app.getByText(/join_league|LEAGUE_/).count(), 0, "no tool names or codes reach the learner");
    await name.fill("lan.hoc.lai");
    await app.getByRole("button", { name: "Tham gia nhóm" }).click();
    await app.getByRole("heading", { name: "Nhóm tuần này" }).waitFor();
    await app.locator(".brow.me").getByText("Bạn (lan.hoc.lai)").waitFor();
    await app.getByText(/^còn \d ngày$/).waitFor();
    await app.getByRole("button", { name: "Ẩn tôi khỏi bảng" }).click();
    await app.getByText("Bạn đang ẩn: người khác không thấy bạn trên bảng.").waitFor();
    await app.getByRole("button", { name: "Hiện tôi trên bảng" }).click();
    await app.getByRole("button", { name: "Ẩn tôi khỏi bảng" }).waitFor();
    await app.getByRole("button", { name: "Rời nhóm" }).click();
    await app.getByRole("alertdialog", { name: "Rời nhóm?" }).waitFor();
    await app.getByRole("button", { name: "Ở lại nhóm" }).click();
    await app.getByRole("alertdialog").waitFor({ state: "detached" });
    await app.getByRole("button", { name: "Rời nhóm" }).click();
    await app.getByRole("alertdialog").getByRole("button", { name: "Rời nhóm" }).click();
    await app.getByRole("heading", { name: "Thi đua XP mỗi tuần" }).waitFor();
    const league = await tool("get_league", {});
    assert.equal(league.structuredContent.joined, false);
  });
});

test("the mock result groups wrong and blank questions by category, and Ôn các câu sai studies exactly those", async () => {
  await withPreview(async ({ origin, page, app, tool, open, messages }) => {
    const started = await tool("start_mock_test", { mode: "random", requestId: randomUUID() });
    const mock = started.structuredContent as { attemptId: string; questions: { id: string; topic: string }[] };
    const [a, b, c] = mock.questions;
    assert.ok(a && b && c);
    for (const [q, answer] of [[a.id, right(a.id)], [b.id, wrong(b.id)], [c.id, wrong(c.id)]]) await tool("save_mock_choice", { attemptId: mock.attemptId, questionId: q, answer, requestId: randomUUID() });
    const finished = await tool("finalise_mock_test", { attemptId: mock.attemptId, confirmUnanswered: true, requestId: randomUUID() });
    const missed = mock.questions.map((q) => q.id).filter((id) => id !== a.id);
    await page.goto(`${origin}/preview`);
    await app.locator("[data-action]").first().waitFor();
    await open(finished);
    await app.getByRole("heading", { name: "Kết quả" }).waitFor();
    await app.getByText("CHƯA ĐẠT", { exact: true }).waitFor();
    assert.equal(await app.locator(".ticks i.wrong").count(), 2);
    assert.equal(await app.locator(".ticks i.blank").count(), 27);
    assert.equal(await app.locator("details.acc").count(), missed.length, "one entry per wrong or blank question");
    const topics = await app.locator("details.acc .acc-text b").allInnerTexts();
    assert.ok(topics.every((t, i) => i === 0 || t === topics[i - 1] || !topics.slice(0, i).includes(t)), "entries of one bank category sit together");
    assert.ok(new Set(topics).size > 1, "a random test spans several categories");
    const entry = app.locator(`details.acc:has-text("Câu ${Number(b.id.slice(1))} · sai")`).first();
    if (!(await entry.evaluate((element: HTMLDetailsElement) => element.open))) await entry.locator("summary").click();
    await app.getByText(`Bạn chọn: ${wrong(b.id)} ·`, { exact: false }).first().waitFor();
    await app.getByText("Các câu sai và câu bỏ trống đã vào lịch ôn ngày mai.").waitFor();
    const sent = await messages();
    await app.getByRole("button", { name: "Ôn các câu sai" }).click();
    await app.getByRole("button", { name: "Bắt đầu" }).waitFor();
    const call = (await sent()).find((m) => m.name === "start_study");
    assert.deepEqual([...(call?.arguments?.questionIds as string[])].sort(), [...missed].sort(), "exactly the wrong and blank questions");
    await app.getByText(`${missed.length} câu bạn chọn.`, { exact: false }).waitFor();
  });
});

test("a request for the supplied test library shows Chưa có bộ đề gốc and offers a random test", async () => {
  await withPreview(async ({ origin, page, app, tool, open }) => {
    await tool("start_study", { requestId: randomUUID() });
    const refused = await tool("start_mock_test", { mode: "library", requestId: randomUUID() });
    assert.equal(refused.isError, true);
    await page.goto(`${origin}/preview`);
    await app.getByRole("button", { name: "Học tiếp" }).waitFor();
    await open(refused);
    await app.getByRole("heading", { name: "Chưa có bộ đề gốc" }).waitFor();
    await app.getByRole("button", { name: "Tạo đề ngẫu nhiên" }).click();
    await app.getByRole("heading", { name: "Sẵn sàng thi thử?" }).waitFor();
    await app.getByRole("button", { name: "Bắt đầu tính giờ" }).waitFor();
  });
});

test("a card left open while another chat continues the lesson shows the server's step when it regains focus", async () => {
  await withPreview(async ({ origin, page, app, tool, open }) => {
    const started = await tool("start_study", { questionIds: ["q001", "q002"], requestId: randomUUID() });
    const sessionId = started.structuredContent.sessionId as string;
    await page.goto(`${origin}/preview`);
    await app.locator("[data-action]").first().waitFor();
    await open(started);
    await app.getByRole("button", { name: "Bắt đầu" }).click();
    await app.locator('input[name="answer"][value="A"]').check();
    // Another chat answers q001 and moves on.
    await tool("submit_study_answer", { sessionId, questionId: "q001", answer: right("q001"), requestId: randomUUID() });
    await tool("next_study_question", { sessionId, requestId: randomUUID() });
    await page.locator("#widget").evaluate((frame: HTMLIFrameElement) => frame.contentWindow?.dispatchEvent(new Event("focus")));
    await app.getByRole("heading", { name: "Làn đường là gì?" }).waitFor();
    await app.getByText("Bài học đã tiếp tục ở nơi khác — thẻ đã cập nhật.").waitFor();
    assert.equal(await app.locator('input[name="answer"]:checked').count(), 0, "no stale choice stays editable");
  });
});

test("a failed progress load offers Thử lại and shows no numbers, and a host without server tools sends the learner to the chat", async () => {
  let refused = false;
  await withPreview(async ({ origin, page, app, tool }) => {
    await tool("start_study", { requestId: randomUUID() });
    await page.goto(`${origin}/preview`);
    await app.getByText("Chưa tải được tiến độ").waitFor();
    assert.equal(await app.locator(".nums").count(), 0, "no zeros stand in for unknown progress");
    await app.getByRole("button", { name: "Thử lại" }).click();
    await app.getByRole("button", { name: "Học tiếp" }).waitFor();

    await page.route(`${origin}/preview`, async (route) => {
      const html = await (await route.fetch()).text();
      await route.fulfill({ contentType: "text/html", body: html.replace("hostCapabilities:{serverTools:{},", "hostCapabilities:{") });
    });
    await page.goto(`${origin}/preview`);
    await app.getByText("Thẻ không phản hồi — tiếp tục trong khung chat").waitFor();
    assert.equal(await app.locator("#content button").count(), 0, "nothing in the card pretends to work");
  }, async (page, origin) => {
    await page.route(`${origin}/preview/tool`, async (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}") as { name?: string };
      if (body.name === "get_course" && !refused) {
        refused = true;
        return route.fulfill({ status: 502, body: "" });
      }
      return route.continue();
    });
  });
});
