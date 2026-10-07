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

async function continueStudy(app: FrameLocator) {
  await app.locator('[data-action="study-next"], [data-action="resume"]').first().waitFor({ state: "attached" });
  const next = app.getByRole("button", { name: "Tiếp tục", exact: true }).last();
  await next.click();
}

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
    await continueStudy(app);
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

test("study actions stay in one footer, inline XP accumulates, and immediate retry unlocks the same question", async () => {
  await withPreview(async ({ origin, page, app, tool, open }) => {
    const started = await tool("start_study", { questionIds: ["q001", "q002"], requestId: randomUUID() });
    const sessionId = started.structuredContent.sessionId;
    await page.goto(`${origin}/preview?theme=dark`);
    await app.locator('[data-action="daily"], [data-action="goals"]').first().waitFor();
    await open(started);
    await app.getByRole("button", { name: "Bắt đầu", exact: true }).click();
    assert.equal(await app.locator("[data-lesson-xp]").innerText(), "0");
    assert.equal(await app.locator('[data-action="answer"]').isDisabled(), true);
    assert.equal(await app.locator('[data-action="guess"]').isVisible(), true);
    assert.equal(await app.locator('[data-action="skip"]').isVisible(), true);
    assert.equal(await app.locator(".study-options").count(), 0, "secondary actions are directly visible");
    assert.equal(await app.locator('[data-action="help"]').count(), 0);
    await app.locator(`input[name="answer"][value="${right("q001")}"]`).check();
    await app.locator('[data-action="answer"]').click();
    await app.getByRole("heading", { name: "Chính xác!" }).waitFor();
    assert.equal(await app.locator(".opt.right #verdict").count(), 1, "feedback is inside the selected answer");
    assert.equal(await app.locator(".opt.right .answer-award").innerText(), "+10 XP");
    assert.equal(await app.locator('[data-action="why"]').getAttribute("aria-expanded"), "false");
    assert.equal(await app.locator(".why").count(), 0);
    const why = await app.locator('[data-action="why"]').boundingBox();
    const next = await app.locator('.study-footer [data-action="study-next"]').boundingBox();
    assert.ok(why && next && why.x < next.x && Math.abs(why.y - next.y) < 4, "secondary is left of primary in one row");
    const scored = await tool("get_study_session", { sessionId });
    assert.equal(await app.locator("[data-lesson-xp]").innerText(), String(scored.structuredContent.xp));
    await continueStudy(app);
    await app.locator(`input[name="answer"][value="${wrong("q002")}"]`).check();
    await app.locator('[data-action="answer"]').click();
    await app.getByRole("heading", { name: "Chưa đúng" }).waitFor();
    assert.equal(await app.locator(".opt.wrong .answer-award").innerText(), "-3 XP");
    assert.equal(await app.locator("[data-lesson-xp]").innerText(), "7");
    assert.equal(await app.locator(".opt.wrong .x").count(), 0, "cross has no nested background");
    assert.equal(await app.locator(".panel #verdict").count(), 0, "feedback is not repeated at the bottom");
    assert.equal(await app.locator(".opt.right").count(), 0, "the solution is hidden until help is requested");
    await app.locator('[data-action="study-retry"]').click();
    await app.getByText("Bạn đã sai câu này lúc nãy").waitFor();
    assert.equal(await app.locator("#verdict").count(), 0, "retry clears feedback even though the question ID is unchanged");
    assert.equal(await app.locator('input[name="answer"]').first().isEnabled(), true);
    assert.equal(await app.locator('input[name="answer"]:checked').count(), 0);
    await app.getByRole("button", { name: "Tạm dừng và lưu" }).click();
    await continueStudy(app);
    await app.getByText("Bạn đã sai câu này lúc nãy").waitFor();
    const repair = await tool("get_study_session", { sessionId });
    assert.equal(await app.locator("[data-lesson-xp]").innerText(), String(repair.structuredContent.xp));
    await app.locator(`input[name="answer"][value="${right("q002")}"]`).check();
    await app.locator('[data-action="answer"]').click();
    await app.getByRole("heading", { name: "Đã sửa!" }).waitFor();
    assert.equal(await app.locator('[data-action="study-retry"]').count(), 0);
    const corrected = await tool("get_study_session", { sessionId });
    assert.equal(await app.locator("[data-lesson-xp]").innerText(), String(corrected.structuredContent.xp));
    assert.equal(Number(corrected.structuredContent.xp) - Number(repair.structuredContent.xp), 2, "repair earns only the server's assisted credit");
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await app.locator(".card").evaluate(el => el.scrollWidth <= el.clientWidth), true);
    await app.locator('[data-action="why"]').click();
    await app.locator(".why").waitFor();
    assert.equal(await app.locator('[data-action="help"]').isVisible(), true);
  });
});

test("direct actions remain reachable on mobile and negative XP survives feedback and completion in both themes", async () => {
  await withPreview(async ({ origin, page, app, tool, open }) => {
    for (const [index, theme] of ["dark", "light"].entries()) {
      const questionId = index ? "q002" : "q001";
      const started = await tool("start_study", { questionIds: [questionId], requestId: randomUUID() });
      await page.setViewportSize({ width: 1000, height: 900 });
      await page.emulateMedia({ reducedMotion: "reduce" });
      await page.goto(`${origin}/preview?theme=${theme}&chat=1`);
      await app.locator("[data-action]").first().waitFor();
      await open(started);
      await app.getByRole("button", { name: "Bắt đầu", exact: true }).click();
      const body = await app.locator(".study-body").boundingBox();
      const rail = await app.locator(".study-secondary").boundingBox();
      assert.ok(body && rail && rail.x >= body.x && rail.x + rail.width <= body.x + body.width + 1, "secondary actions stay inside the question area");
      const stem = await app.locator(".stem").boundingBox();
      assert.ok(stem && rail && rail.y + rail.height <= stem.y, "compact actions sit above the question");
      await page.setViewportSize({ width: 320, height: 844 });
      const options = await app.locator(".opts").boundingBox();
      const mobileRail = await app.locator(".study-secondary").boundingBox();
      assert.ok(options && mobileRail && mobileRail.y + mobileRail.height <= options.y, "mobile actions remain in the question header");
      await app.locator(`input[name="answer"][value="${wrong(questionId)}"]`).check();
      await app.locator('[data-action="answer"]').click();
      await app.getByRole("heading", { name: "Chưa đúng" }).waitFor();
      assert.equal(await app.locator("[data-lesson-xp]").innerText(), "-3");
      assert.equal(await app.locator(".answer-award").innerText(), "-3 XP");
      assert.equal(await app.locator(".answer-award").evaluate(el => getComputedStyle(el).animationName), "none");
      assert.equal(await app.locator(".opts").evaluate(el => el.ownerDocument.activeElement?.id), "verdict", "inline verdict stays focusable after grading");
      assert.equal(await app.locator(".card").evaluate(el => el.scrollWidth <= el.clientWidth), true);
      for (const name of ["Xem đáp án", "Thử lại", "Tiếp tục"]) assert.equal(await app.getByRole("button", { name, exact: true }).isVisible(), true, `${name} is reachable after a miss on mobile`);
      assert.equal(await app.locator('[data-action="confusion"]').count(), 0, "the confusion toggle was removed");
      assert.equal(await app.locator('[data-action="help"]').count(), 0, "ChatGPT help waits inside the explanation");
      await app.getByRole("button", { name: "Xem đáp án", exact: true }).click();
      assert.equal(await app.locator('[data-action="help"]').isVisible(), true);
      await continueStudy(app);
      await app.getByRole("heading", { name: "Hoàn thành bài học!" }).waitFor();
      await app.locator(".finish-tiles .stat-tile").first().getByText("-3", { exact: true }).waitFor();
      await page.locator("#host-message").getByText("Xong bài: 0/1 đúng, -3 XP.", { exact: false }).waitFor();
      assert.equal(await app.getByText("+-3", { exact: false }).count(), 0);
    }
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
    await continueStudy(app);
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
    await continueStudy(app);
    await app.getByRole("heading", { name: "Làn đường là gì?" }).waitFor();
    await app.getByRole("button", { name: "Bỏ qua" }).click();
    await app.getByText("Đã bỏ qua · vẫn cần ôn").waitFor();
    await continueStudy(app);
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
      await continueStudy(app);
      await app.locator("#verdict").waitFor({ state: "detached" });
    };
    await answer("q001", right("q001"));
    for (const q of ["q002", "q003"]) {
      await next();
      await answer(q, right(q));
    }
    assert.equal(await app.locator("[data-lesson-xp]").innerText(), String((await tool("get_study_session", { sessionId: started.structuredContent.sessionId })).structuredContent.xp));
    assert.equal(await app.locator("[data-lesson-xp]").innerText(), String((await tool("get_study_session", { sessionId: started.structuredContent.sessionId })).structuredContent.xp));
    await next();
    await app.locator(".combo-pill").getByText("×3").waitFor();
    await answer("q004", wrong("q004"));
    assert.equal(await app.locator("[data-lesson-xp]").innerText(), String((await tool("get_study_session", { sessionId: started.structuredContent.sessionId })).structuredContent.xp));
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
    assert.equal(await app.locator("[data-lesson-xp]").innerText(), String((await tool("get_study_session", { sessionId: started.structuredContent.sessionId })).structuredContent.xp));
    await app.getByRole("button", { name: "Xem đáp án" }).click();
    await app.getByRole("button", { name: "ChatGPT có thể giải thích kỹ hơn" }).click();
    await page.locator("#host-message").getByText("Mình vẫn nhầm câu 4, giải thích kỹ hơn nhé. [q004 · lần 2 · sai]").waitFor();
    const order = (await sent()).filter((m) => m.method === "ui/message" || m.name === "request_study_help" || m.name === "submit_study_answer").map((m) => m.name ?? m.method);
    assert.deepEqual(order, ["submit_study_answer", "request_study_help", "ui/message"], "help is recorded before the one chat message");
    assert.ok((await sent()).filter((m) => m.method === "tools/call").every((m) => m.arguments?.caller === "card"), "every card call says it came from the card");
  });
});

test("a compare-the-pair step submits both answers, shows both verdicts and the approved family's aspects without a draft tag, then continues once", async () => {
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
    assert.equal(await app.locator(".diff .draft-tag").count(), 0, "approved families carry no draft tag");
    await app.locator(".vchip").getByText("Chính xác!").waitFor();
    await app.locator(".vchip").getByText("Chưa đúng").waitFor();
    assert.equal(await app.locator(".diff .axes li").count() > 0, true, "the family's aspects are named");
    assert.doesNotMatch(await app.locator(".diff").innerText(), /NHÁP|duyệt/i, "the difference panel says nothing about drafts");
    const pairText = ((await tool("get_study_session", { sessionId })) as unknown as { content: { text: string }[] }).content[0]?.text ?? "";
    assert.match(pairText, /Khía cạnh so sánh/);
    assert.doesNotMatch(pairText, /nháp|draft/i, "ChatGPT is not told the family is a draft");
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
    // The next question is already showing, so the flash names the question it judged.
    await app.locator(".flash").getByText(`Câu ${Number(first.slice(1))}: chưa đúng -3 XP — sẽ quay lại trong lịch ôn`).waitFor();
    const before = fetches.filter((name) => name === "get_study_session").length;
    await app.getByRole("heading", { name: "Hết giờ!" }).waitFor({ timeout: 15000 });
    await page.waitForTimeout(600);
    assert.equal(fetches.filter((name) => name === "get_study_session").length - before, 1, "one fetch when the countdown ends");
    await app.getByRole("button", { name: /Câu \d+ Xem lại/ }).click();
    await app.getByText(`Đáp án đúng: ${right(first)} ·`, { exact: false }).waitFor();
    await app.getByText(`Bạn chọn: ${wrong(first)} ·`, { exact: false }).waitFor();
  });
});

test("the home card draws the goal ring and the four numbers from the course view, and the course map starts a category", async () => {
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
    const course = (await tool("get_course", {})).structuredContent as { covered: number; learned: number; onTheWay: number; dueCount: number; newToday: number; dailyGoal: number };
    await page.goto(`${origin}/preview`);
    await app.getByRole("button", { name: "Học tiếp" }).waitFor();
    assert.equal(await app.locator(".ring-num").innerText(), `${course.newToday}/${course.dailyGoal}`);
    assert.equal(await app.locator(".ring .seg").count(), course.dailyGoal, "one segment per new question in today's goal");
    assert.equal(await app.locator(".ring .seg.on").count(), course.newToday);
    const tiles = await app.locator(".nums .ntile").allInnerTexts();
    assert.ok(course.onTheWay > 0, "the lesson's first-time right answers wait for their review");
    assert.deepEqual(tiles.map((t) => t.replace(/\s+/g, " ").trim()), [`${course.covered} /600 Đã gặp`, `${course.learned} /600 Đã thuộc +${course.onTheWay} đang chờ ôn lại`, `${course.dueCount} câu Cần ôn hôm nay`, "1 câu Sai hôm nay Xem lại"], "q002's miss is today's one mistake");
    const weekXp = ((await tool("get_course", {})).structuredContent as { leagueSummary: { weekXp: number } }).leagueSummary.weekXp;
    await app.getByRole("button", { name: `Tham gia nhóm thi đua tuần Tuần này bạn có ${weekXp} XP` }).waitFor();
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
    await entry.getByText(`Bạn chọn: ${wrong(b.id)} ·`, { exact: false }).waitFor();
    await app.getByText("Các câu sai và câu bỏ trống đã vào lịch ôn ngày mai.").waitFor();
    const sent = await messages();
    await app.getByRole("button", { name: "Ôn các câu sai" }).click();
    await app.getByRole("button", { name: "Bắt đầu" }).waitFor();
    const call = (await sent()).find((m) => m.name === "start_study");
    assert.deepEqual([...(call?.arguments?.questionIds as string[])].sort(), [...missed].sort(), "exactly the wrong and blank questions");
    // The learner did not pick these questions, so the intro says they are the test's misses.
    await app.getByRole("heading", { name: "Ôn các câu sai" }).waitFor();
    await app.getByText(`${missed.length} câu sai hoặc bỏ trống trong bài thi thử.`, { exact: false }).waitFor();
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
    // A screen the host opens next does not keep that lesson's notice.
    await open(await tool("get_question", { questionId: "q301" }));
    await app.getByRole("heading", { name: "Luyện câu gốc" }).waitFor();
    assert.equal(await app.locator("#status").innerText(), "", "the old notice is gone");
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

test("answer feedback starts its brief celebration only after Kiểm tra", async () => {
  await withPreview(async ({ origin, page, app, tool, open }) => {
    const started = await tool("start_study", { questionIds: ["q001", "q002"], requestId: randomUUID() });
    await page.goto(`${origin}/preview`);
    await app.locator("[data-action]").first().waitFor();
    await open(started);
    await app.getByRole("button", { name: "Bắt đầu" }).click();
    const frame = page.frames().find((f) => f.url().includes("/ui/learning.html"));
    assert.ok(frame);
    await frame.evaluate(() => {
      const log: string[] = [];
      (window as unknown as { started: string[] }).started = log;
      document.addEventListener("animationstart", (event) => log.push((event as AnimationEvent).animationName), true);
    });
    // The answer renders twice in one task; both renders must keep the animation classes, or nothing ever paints.
    const startsAll = (names: string[]) => frame.waitForFunction((wanted) => wanted.every((name) => (window as unknown as { started: string[] }).started.includes(name)), names, { timeout: 5000 });
    await app.locator(`input[name="answer"][value="${right("q001")}"]`).check();
    await app.locator('[data-action="answer"]').click();
    await startsAll(["pop", "confetti"]);
    await continueStudy(app);
    await app.locator("#verdict").waitFor({ state: "detached" });
    await app.locator(`input[name="answer"][value="${wrong("q002")}"]`).check();
    await app.locator('[data-action="answer"]').click();
    await app.getByRole("heading", { name: "Chưa đúng" }).waitFor();
    assert.equal(await app.locator(".opt.wrong .key").evaluate((el) => getComputedStyle(el).animationName), "none");
  });
});

test("a lesson started from a confusing-question group or a category names it in the intro", async () => {
  await withPreview(async ({ origin, page, app, tool, open }) => {
    const family = ((await tool("list_units", { kind: "family", query: "toc do", limit: 1 })).structuredContent.units as { id: string; title: string }[])[0];
    assert.ok(family);
    const grouped = await tool("start_study", { unitId: family.id, override: true, requestId: randomUUID() });
    await page.goto(`${origin}/preview`);
    await app.locator("[data-action]").first().waitFor();
    await open(grouped);
    await app.getByRole("heading", { name: family.title }).waitFor();
    await app.getByText(`${grouped.structuredContent.total} câu trong nhóm dễ nhầm này.`, { exact: false }).waitFor();
    const category = await tool("start_study", { unitId: "bien_bao", override: true, requestId: randomUUID() });
    await open(category);
    await app.getByRole("heading", { name: "Biển báo" }).waitFor();
    await app.getByText(`${category.structuredContent.total} câu trong chủ đề này.`, { exact: false }).waitFor();
  });
});

test("tapping a suggested group selects that suggestion and offers Học nhóm này right below it", async () => {
  await withPreview(async ({ origin, page, app, tool, messages }) => {
    await tool("start_study", { requestId: randomUUID() });
    await page.goto(`${origin}/preview`);
    await app.getByRole("button", { name: "Chọn chủ đề" }).click();
    await app.getByRole("button", { name: /^Câu hỏi dễ nhầm lẫn/ }).click();
    await app.getByRole("button", { name: "Chọn nhóm" }).click();
    const first = app.locator(".sugg").first();
    const id = await first.locator("input").getAttribute("value");
    assert.ok(id && await app.locator(`.frow input[value="${id}"]`).count() === 1, "the suggestion is also on the list's first page");
    await first.click();
    assert.equal(await app.locator(".sugg:has(input:checked)").count(), 1, "the tapped suggestion is the selection");
    assert.equal(await app.locator(".frow:has(input:checked)").count(), 0, "its copy in the list is not");
    // The card grows with its content in an inline host, so the action must sit next to the choice, not after the list.
    const gap = await app.locator(".sugg:has(input:checked)").evaluate((label) => label.nextElementSibling!.querySelector("[data-action='unit']")!.getBoundingClientRect().top - label.getBoundingClientRect().bottom);
    assert.ok(gap >= 0 && gap < 40, `Học nhóm này sits right below the choice (${gap}px)`);
    const sent = await messages();
    await app.getByRole("button", { name: "Học nhóm này" }).click();
    await app.getByRole("button", { name: "Bắt đầu" }).waitFor();
    assert.equal((await sent()).find((m) => m.name === "start_study")?.arguments?.unitId, id);
  });
});

/** Opens the confusing-question family picker from the home card. */
async function openFamilies(app: FrameLocator) {
  await app.getByRole("button", { name: "Chọn chủ đề" }).click();
  await app.getByRole("button", { name: /^Câu hỏi dễ nhầm lẫn/ }).click();
  await app.getByRole("button", { name: "Chọn nhóm" }).click();
  await app.locator(".frow").first().waitFor();
}

test("typing in the family search keeps the same field focused, with its text and caret, while results arrive", async () => {
  await withPreview(async ({ origin, page, app, tool }) => {
    await tool("start_study", { requestId: randomUUID() });
    await page.goto(`${origin}/preview`);
    await openFamilies(app);
    const field = app.locator("#search");
    await field.click();
    await field.evaluate((el) => { (window as unknown as { searchField: Element }).searchField = el; });
    const state = () => field.evaluate((el: HTMLInputElement) => ({ same: (window as unknown as { searchField: Element }).searchField === el, focused: document.activeElement === el, value: el.value, caret: el.selectionStart }));
    const counted = async (query: string) => ((await tool("list_units", { kind: "family", query, limit: 300 })).structuredContent.totalMatches as number);
    // Each pause is longer than the 350 ms debounce, so every prefix is searched while the learner keeps typing.
    for (const [index, key] of [..."tocdo"].entries()) {
      await page.keyboard.type(key);
      await page.waitForTimeout(600);
      assert.deepEqual(await state(), { same: true, focused: true, value: "tocdo".slice(0, index + 1), caret: index + 1 });
    }
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.press("ArrowLeft");
    await page.keyboard.type(" ");
    await app.locator("#fam-count").getByText(`${await counted("toc do")} kết quả`, { exact: true }).waitFor();
    assert.deepEqual(await state(), { same: true, focused: true, value: "toc do", caret: 4 }, "the caret stays where the learner put it");
    assert.equal(await app.locator(".frow").count(), await counted("toc do"), "the list shows the new results");
  });
});

test("a slow answer to an earlier search never replaces the results for what the learner typed last", async () => {
  await withPreview(async ({ origin, page, app, tool }) => {
    await tool("start_study", { requestId: randomUUID() });
    await page.goto(`${origin}/preview`);
    await openFamilies(app);
    const counted = async (query: string) => ((await tool("list_units", { kind: "family", query, limit: 300 })).structuredContent.totalMatches as number);
    const [slow, last] = [await counted("bien"), await counted("bien bao")];
    assert.notEqual(slow, last);
    await app.locator("#search").click();
    await page.keyboard.type("bien");
    await page.waitForTimeout(450);
    await page.keyboard.type(" bao");
    await app.locator("#fam-count").getByText(`${last} kết quả`, { exact: true }).waitFor();
    await page.waitForTimeout(1200);
    assert.equal(await app.locator("#fam-count").innerText(), `${last} kết quả`, "the late answer for “bien” is dropped");
    assert.equal(await app.locator(".frow").count(), last);
  }, async (page, origin) => {
    await page.route(`${origin}/preview/tool`, async (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}") as { name?: string; arguments?: { query?: string } };
      if (body.name === "list_units" && body.arguments?.query === "bien") await new Promise((resolve) => setTimeout(resolve, 900));
      return route.continue();
    });
  });
});

test("a family search that failed runs again when the learner retypes the same text", async () => {
  let failed = false;
  await withPreview(async ({ origin, page, app, tool }) => {
    await tool("start_study", { requestId: randomUUID() });
    await page.goto(`${origin}/preview`);
    await openFamilies(app);
    const matches = (await tool("list_units", { kind: "family", query: "bien", limit: 300 })).structuredContent.totalMatches as number;
    await app.locator("#search").click();
    await page.keyboard.type("bien");
    await app.locator("#status.error").waitFor();
    assert.equal(failed, true);
    await page.keyboard.press("Backspace");
    await page.keyboard.type("n");
    await app.locator("#fam-count").getByText(`${matches} kết quả`, { exact: true }).waitFor({ timeout: 5000 });
  }, async (page, origin) => {
    await page.route(`${origin}/preview/tool`, async (route) => {
      const body = JSON.parse(route.request().postData() ?? "{}") as { name?: string; arguments?: { query?: string } };
      if (body.name === "list_units" && body.arguments?.query === "bien" && !failed) { failed = true; return route.fulfill({ status: 502, body: "" }); }
      return route.continue();
    });
  });
});

test("the family picker lists every matching group in one list that scrolls inside the card, about seven rows tall, with Học nhóm này right below it", async () => {
  await withPreview(async ({ origin, page, app, tool }) => {
    await tool("start_study", { requestId: randomUUID() });
    await page.setViewportSize({ width: 390, height: 1400 });
    await page.goto(`${origin}/preview`);
    await openFamilies(app);
    const total = (await tool("list_units", { kind: "family", limit: 300 })).structuredContent.totalMatches as number;
    assert.ok(total > 7);
    assert.equal(await app.locator(".frow").count(), total, "every group is loaded at once");
    assert.equal(await app.getByRole("button", { name: /Trang (trước|tiếp)/ }).count(), 0, "there are no pages");
    const box = app.locator(".fam-scroll");
    // Rows wholly inside the box, and whether the box scrolls.
    const measure = () => box.evaluate((el) => {
      const b = el.getBoundingClientRect();
      const inside = [...el.querySelectorAll(".frow")].filter((row) => { const r = row.getBoundingClientRect(); return r.top >= b.top && r.bottom <= b.bottom; });
      const checked = el.querySelector(".frow:has(input:checked)")?.getBoundingClientRect();
      return { visible: inside.length, scrolls: el.scrollHeight > el.clientHeight + 50, scrollTop: el.scrollTop, checkedInside: checked ? checked.top >= b.top && checked.bottom <= b.bottom : null };
    });
    assert.deepEqual(await measure(), { visible: 7, scrolls: true, scrollTop: 0, checkedInside: null });
    const cta = app.getByRole("button", { name: "Học nhóm này" });
    assert.equal(await cta.isDisabled(), true, "Học nhóm này waits for a choice");
    const gap = await cta.evaluate((button) => { const list = document.querySelector(".fam-scroll")!; return list.contains(button) ? -1 : button.getBoundingClientRect().top - list.getBoundingClientRect().bottom; });
    assert.ok(gap >= 0 && gap < 32, `Học nhóm này sits right below the list, outside it (${gap}px)`);

    await box.hover();
    await page.mouse.wheel(0, 500);
    await page.waitForFunction(() => (document.querySelector<HTMLIFrameElement>("#widget")?.contentDocument?.querySelector(".fam-scroll")?.scrollTop ?? 0) > 0);
    const scrolled = (await measure()).scrollTop;
    const visibleRow = await app.locator(".frow").nth(9).boundingBox();
    assert.ok(visibleRow && visibleRow.y >= 0 && visibleRow.y + visibleRow.height <= 1400, "the chosen row is visible before the click");
    await page.mouse.click(visibleRow.x + visibleRow.width / 2, visibleRow.y + visibleRow.height / 2);
    const picked = await measure();
    assert.equal(picked.scrollTop, scrolled, "choosing a row keeps the list where it was");
    assert.equal(picked.checkedInside, true);
    assert.equal(await cta.isEnabled(), true);

    for (let i = 0; i < 12; i++) await page.keyboard.press("ArrowDown");
    assert.equal((await measure()).checkedInside, true, "the row chosen with the keyboard scrolls into view");
    assert.equal(await app.locator(".frow:has(input:checked) input").evaluate((input) => input === document.activeElement), true);
  });
});

test("a confusing-question group with images carries an image marker in the list", async () => {
  await withPreview(async ({ origin, page, app, tool }) => {
    await tool("start_study", { requestId: randomUUID() });
    await page.goto(`${origin}/preview`);
    await app.getByRole("button", { name: "Chọn chủ đề" }).click();
    await app.getByRole("button", { name: /^Câu hỏi dễ nhầm lẫn/ }).click();
    await app.getByRole("button", { name: "Chọn nhóm" }).click();
    const marked = async (query: string) => {
      await app.locator("#search").fill(query);
      await app.getByRole("button", { name: "Tìm kiếm" }).click();
      // The full list already contains every group, so wait for the search to narrow it, not for the row.
      const narrowed = async () => await app.locator(".frow").count() === 1 && await app.locator(`.frow input[value="${query}"]`).count() === 1;
      for (let i = 0; i < 200 && !await narrowed(); i++) await page.waitForTimeout(50);
      assert.equal(await app.locator(`.frow input[value="${query}"]`).count(), 1, `the search narrows the list to ${query}`);
      return app.locator(".frow").getByText("có hình").count();
    };
    assert.equal(await marked("rules-officer-gestures"), 1, "a group of image questions is marked");
    assert.equal(await marked("rules-road-components"), 0, "a text-only group is not");
    assert.equal(await app.locator(".frow").filter({ hasText: /ĐÃ DUYỆT|BẢN NHÁP/ }).count(), 0, "family rows carry no status badge");
    assert.equal(await app.getByRole("button", { name: "Giải thích: Bản nháp" }).count(), 0);
  });
});

test("a question without bank text says so and offers Hỏi ChatGPT inside the verdict", async () => {
  await withPreview(async ({ origin, page, app, tool, open }) => {
    const started = await tool("start_study", { questionIds: ["q010"], requestId: randomUUID() });
    const sessionId = started.structuredContent.sessionId as string;
    const scored = await tool("submit_study_answer", { sessionId, questionId: "q010", answer: right("q010"), requestId: randomUUID() });
    assert.equal((scored.structuredContent.currentFeedback as { teachingStatus: string }).teachingStatus, "teaching_gap");
    await page.goto(`${origin}/preview`);
    await app.locator("[data-action]").first().waitFor();
    await open(await tool("get_study_session", { sessionId }));
    await app.getByRole("button", { name: "Vì sao?" }).click();
    await app.locator(".panel").getByText("Chưa có giải thích được duyệt cho câu này.").waitFor();
    assert.equal(await app.locator('.why-wrap [data-action="help"]').count(), 1, "Hỏi ChatGPT is inside the explanation block");
    assert.equal(await app.getByRole("button", { name: "Hỏi ChatGPT về câu này" }).count(), 1, "and it is offered once");
    assert.equal(await app.getByText("Ngân hàng câu hỏi chưa có", { exact: false }).count(), 0, "no fallback sentence stands in for an explanation");
  });
});

test("after lowering the goal below today's new questions, the home ring stays full and names the extra ones", async () => {
  await withPreview(async ({ origin, page, app, tool }) => {
    const started = await tool("start_study", { questionIds: ["q001", "q002", "q003", "q004", "q005"], requestId: randomUUID() });
    const sessionId = started.structuredContent.sessionId as string;
    let current = started.structuredContent.question as { id: string } | null;
    while (current) {
      await tool("submit_study_answer", { sessionId, questionId: current.id, answer: right(current.id), requestId: randomUUID() });
      current = (await tool("next_study_question", { sessionId, requestId: randomUUID() })).structuredContent.question as { id: string } | null;
    }
    await tool("update_profile", { dailyGoal: 3, requestId: randomUUID() });
    await page.goto(`${origin}/preview`);
    await app.getByRole("button", { name: "Học tiếp" }).waitFor();
    assert.equal(await app.locator(".ring-num").innerText(), "3/3");
    assert.equal(await app.locator(".ring .seg.on").count(), 3);
    await app.getByText("3/3 câu mới · thêm 2", { exact: false }).waitFor();
  });
});

/** Answers each question right in one lesson, through the server, and returns the course view afterwards. */
async function learnFirstTime(tool: Preview["tool"], ids: string[]) {
  const started = await tool("start_study", { questionIds: ids, requestId: randomUUID() });
  const sessionId = started.structuredContent.sessionId as string;
  let current = started.structuredContent.question as { id: string } | null;
  while (current) {
    await tool("submit_study_answer", { sessionId, questionId: current.id, answer: right(current.id), requestId: randomUUID() });
    current = (await tool("next_study_question", { sessionId, requestId: randomUUID() })).structuredContent.question as { id: string } | null;
  }
  return { sessionId, course: (await tool("get_course", {})).structuredContent as { covered: number; learned: number; onTheWay: number; nextLearnAt: number | null } };
}

test("the Đã thuộc tile keeps its number and names the questions waiting for their review, on home and the course map", async () => {
  await withPreview(async ({ origin, page, app, tool }) => {
    const { course } = await learnFirstTime(tool, ["q001", "q002", "q003"]);
    assert.deepEqual([course.learned, course.onTheWay], [0, 3]);
    await page.goto(`${origin}/preview`);
    await app.getByRole("button", { name: "Học tiếp" }).waitFor();
    const learned = app.locator(".nums .ntile.mid");
    assert.equal(await learned.locator("b").innerText(), "0", "the main number is never added to");
    assert.equal((await learned.locator(".nwait").innerText()).trim(), `+${course.onTheWay} đang chờ ôn lại`);
    assert.equal(await app.locator(".nums .nwait").count(), 1, "only the Đã thuộc tile has the line");
    await app.getByRole("button", { name: "Chọn chủ đề" }).click();
    await app.locator(".course-summary .course-pending").getByText(`+${course.onTheWay}`).waitFor();
    assert.equal(await app.locator('.course-summary [data-metric="learned"] b').innerText(), String(course.learned));
    assert.equal(await app.locator('.coverage-track').getAttribute('aria-valuenow'), String(course.covered));
  });
});

test("an ⓘ opens one explanation at a time: the keyboard moves focus in and Esc back, a second ⓘ replaces the first, and a tap outside closes it", async () => {
  await withPreview(async ({ origin, page, app, tool }) => {
    const { course } = await learnFirstTime(tool, ["q001", "q002", "q003"]);
    await page.goto(`${origin}/preview`);
    await app.getByRole("button", { name: "Học tiếp" }).waitFor();
    const pop = app.getByRole("dialog");
    const learned = app.getByRole("button", { name: "Giải thích: Đã thuộc", exact: true });
    const covered = app.getByRole("button", { name: "Giải thích: Đã gặp", exact: true });
    const focused = (target: typeof learned) => target.evaluate((el) => el === document.activeElement);
    await learned.press("Enter");
    await pop.getByRole("heading", { name: "Đã thuộc" }).waitFor();
    assert.equal(await learned.getAttribute("aria-expanded"), "true");
    assert.equal(await focused(pop.getByRole("heading")), true, "a keyboard open moves focus to the popover's title");
    await pop.getByText(`${course.onTheWay} câu đã đúng 1 lần`, { exact: false }).waitFor();
    await page.keyboard.press("Escape");
    await pop.waitFor({ state: "hidden" });
    assert.equal(await focused(learned), true, "Esc returns focus to the button");
    assert.equal(await learned.getAttribute("aria-expanded"), "false");

    await covered.click();
    await pop.getByRole("heading", { name: "Đã gặp" }).waitFor();
    await learned.click();
    await pop.getByRole("heading", { name: "Đã thuộc" }).waitFor();
    assert.equal(await covered.getAttribute("aria-expanded"), "false", "the second ⓘ closes the first");
    assert.equal(await app.getByRole("dialog").count(), 1, "one popover at a time");
    await learned.click();
    await pop.waitFor({ state: "hidden" });
    await covered.click();
    await pop.waitFor();
    await app.locator(".lx-title").click();
    await pop.waitFor({ state: "hidden" });
    assert.equal(await covered.getAttribute("aria-expanded"), "false", "a tap outside closes it");
  });
});

/** Answers each question in its own one-question lesson, right or wrong as given, in order. */
async function answerEach(tool: Preview["tool"], answers: [string, "right" | "wrong"][]) {
  for (const [questionId, how] of answers) {
    const sessionId = (await tool("start_study", { questionIds: [questionId], requestId: randomUUID() })).structuredContent.sessionId as string;
    await tool("submit_study_answer", { sessionId, questionId, answer: how === "right" ? right(questionId) : wrong(questionId), requestId: randomUUID() });
  }
}

test("the home card's fourth tile counts today's mistakes and opens a read-only review of each one, newest first", async () => {
  await withPreview(async ({ origin, page, app, tool, messages }) => {
    // q301 has an image and q010 has no bank explanation.
    await answerEach(tool, [["q001", "wrong"], ["q002", "right"], ["q301", "wrong"], ["q010", "wrong"]]);
    const before = (await tool("get_course", {})).structuredContent as { wrongToday: number; results: { totalAttempts: number } };
    assert.equal(before.wrongToday, 3);
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto(`${origin}/preview`);
    await app.getByRole("button", { name: "Học tiếp" }).waitFor();
    const tiles = app.locator(".nums .ntile");
    assert.equal(await tiles.count(), 4);
    assert.equal((await tiles.nth(3).innerText()).replace(/\s+/g, " ").trim(), "3 câu Sai hôm nay Xem lại");
    const tops = () => tiles.evaluateAll((els) => els.map((el) => Math.round(el.getBoundingClientRect().top)));
    const [a, b, c, d] = await tops();
    assert.ok(a! < b! && b! < c! && c! < d!, "Đã gặp leads, the other three stack beneath it");
    const open = app.getByRole("button", { name: "Sai hôm nay: 3 câu, xem lại" });
    assert.equal(await open.locator(".info-btn").count(), 0, "the ⓘ is not inside the tile's button");
    await app.getByRole("button", { name: "Giải thích: Sai hôm nay", exact: true }).click();
    const pop = app.getByRole("dialog");
    await pop.getByRole("heading", { name: "Sai hôm nay" }).waitFor();
    await pop.getByText("không cần làm lại ngay", { exact: false }).waitFor();
    await page.keyboard.press("Escape");

    const sent = await messages();
    await open.click();
    await app.getByRole("heading", { name: "Câu sai hôm nay" }).waitFor();
    assert.deepEqual((await sent()).filter((m) => m.method === "tools/call").map((m) => m.name), ["get_today_mistakes"]);
    await app.locator(".sub-head").getByText("3 câu", { exact: true }).waitFor();
    const items = app.locator(".mk-item");
    assert.deepEqual(await items.locator(".qchip").allInnerTexts(), ["CÂU 10", "CÂU 301", "CÂU 1"], "newest first");
    const option = (q: string, key: string) => (safeQuestion(q).options.find((o) => o.id === key)?.text ?? "");
    for (const [i, q] of ["q010", "q301", "q001"].entries()) {
      const item = items.nth(i);
      await item.getByText(`Bạn chọn: ${wrong(q)} · ${option(q, wrong(q))}`, { exact: true }).waitFor();
      await item.getByText(`Đáp án đúng: ${right(q)} · ${option(q, right(q))}`, { exact: true }).waitFor();
    }
    await items.nth(0).getByText("Ngân hàng chưa có giải thích cho câu này.", { exact: true }).waitFor();
    assert.equal(await items.nth(1).locator("img.question-image").count(), 1, "the image question shows its image");
    await items.nth(1).getByRole("button", { name: "Phóng to hình câu hỏi" }).click();
    await app.locator("#zoom[open]").waitFor();
    await app.getByRole("button", { name: "Đóng" }).click();
    assert.equal(await app.locator('#content input, #content [data-action="answer"]').count(), 0, "nothing here can be answered");
    await app.getByText("Các câu này sẽ quay lại trong lượt ôn của bạn.").waitFor();
    await app.getByRole("button", { name: "Về trang chính" }).click();
    await app.getByRole("button", { name: "Học tiếp" }).waitFor();
    const after = (await tool("get_course", {})).structuredContent as { results: { totalAttempts: number } };
    assert.equal(after.results.totalAttempts, before.results.totalAttempts, "reviewing records nothing");

    await page.setViewportSize({ width: 900, height: 900 });
    const [w, x, y, z] = await tops();
    assert.ok(w! < x! && x! < y! && y! < z!, "the same stacked order in the desktop progress sidebar");
  });
});

test("with no mistakes today the tile is disabled and says so, and a mistakes card opened by ChatGPT shows an empty state", async () => {
  await withPreview(async ({ origin, page, app, tool, open }) => {
    await answerEach(tool, [["q001", "right"]]);
    await page.goto(`${origin}/preview`);
    await app.getByRole("button", { name: "Học tiếp" }).waitFor();
    const tile = app.locator(".nums .ntile").nth(3);
    assert.equal((await tile.innerText()).replace(/\s+/g, " ").trim(), "0 câu Sai hôm nay Chưa có câu sai hôm nay");
    assert.equal(await tile.getByRole("button", { name: "Sai hôm nay: chưa có câu sai hôm nay" }).isDisabled(), true);
    await open(await tool("get_today_mistakes", {}));
    await app.getByRole("heading", { name: "Câu sai hôm nay" }).waitFor();
    await app.locator(".dashed").getByText("Chưa có câu sai hôm nay").waitFor();
    assert.equal(await app.locator(".mk-item").count(), 0);
    await app.getByRole("button", { name: "Về trang chính" }).click();
    await app.getByRole("button", { name: "Học tiếp" }).waitFor();
  });
});

test("Nhắc tôi học mỗi ngày asks ChatGPT for a daily reminder in one chat message, at 20:00 or the learner's own time, from home and the finish screen", async () => {
  await withPreview(async ({ origin, page, app, tool, open, messages }) => {
    const { sessionId } = await learnFirstTime(tool, ["q001"]);
    await page.goto(`${origin}/preview?chat=1`);
    await app.getByRole("button", { name: "Học tiếp" }).waitFor();
    const toggle = app.getByRole("button", { name: "Nhắc tôi học mỗi ngày", exact: true });
    await app.getByRole("button", { name: "Giải thích: Nhắc tôi học mỗi ngày", exact: true }).click();
    await app.getByRole("dialog").getByText("Đã lên lịch", { exact: false }).waitFor();
    await page.keyboard.press("Escape");
    await toggle.click();
    assert.equal(await toggle.getAttribute("aria-expanded"), "true");
    assert.deepEqual(await app.locator('input[name="remind"]').evaluateAll((inputs) => inputs.map((i) => `${(i as HTMLInputElement).value}${(i as HTMLInputElement).checked ? "*" : ""}`)), ["07:00", "12:00", "20:00*"], "20:00 is chosen to start with");
    const sent = await messages();
    await app.getByRole("button", { name: "Nhờ ChatGPT nhắc tôi" }).click();
    await page.locator("#host-message").getByText("Hãy tạo lời nhắc hằng ngày lúc 20:00 để mình học lý thuyết lái xe. [nhắc học · 20:00 hằng ngày]").waitFor();
    await app.getByText("Đã gửi yêu cầu. Xác nhận trong khung chat nhé.").waitFor();
    assert.deepEqual((await sent()).filter((m) => m.method === "ui/message" || m.method === "tools/call").map((m) => m.method), ["ui/message"], "one chat message and nothing stored on the server");

    await toggle.click();
    const custom = app.getByRole("textbox", { name: "Giờ khác (HH:MM)" });
    await custom.fill("25:00");
    assert.equal(await app.locator('input[name="remind"]:checked').count(), 0, "typing a time replaces the chips' choice");
    await app.getByRole("button", { name: "Nhờ ChatGPT nhắc tôi" }).click();
    await app.getByText("Nhập giờ dạng HH:MM, ví dụ 21:30.").waitFor();
    assert.equal((await sent()).filter((m) => m.method === "ui/message").length, 1, "an impossible time sends nothing");
    await custom.fill("2130");
    await app.getByRole("button", { name: "Nhờ ChatGPT nhắc tôi" }).click();
    await page.locator("#host-message").getByText("Hãy tạo lời nhắc hằng ngày lúc 21:30 để mình học lý thuyết lái xe. [nhắc học · 21:30 hằng ngày]").waitFor();

    await open(await tool("get_study_session", { sessionId }));
    await app.getByRole("heading", { name: "Hoàn thành bài học!" }).waitFor();
    await app.getByRole("button", { name: "Nhắc tôi học mỗi ngày", exact: true }).waitFor();
  });
});

test("a reminder request the host refuses shows no sent state and can be sent again", async () => {
  await withPreview(async ({ origin, page, app, tool }) => {
    await learnFirstTime(tool, ["q001"]);
    await page.goto(`${origin}/preview?chat=1`);
    await app.getByRole("button", { name: "Học tiếp" }).waitFor();
    await app.getByRole("button", { name: "Nhắc tôi học mỗi ngày", exact: true }).click();
    const send = app.getByRole("button", { name: "Nhờ ChatGPT nhắc tôi" });
    await send.click();
    await app.getByText("Chưa gửi được vào khung chat. Thử lại nhé.").waitFor();
    assert.equal(await app.getByText("Đã gửi yêu cầu.", { exact: false }).count(), 0);
    await send.click();
    await page.locator("#host-message").getByText("[nhắc học · 20:00 hằng ngày]", { exact: false }).waitFor();
    await app.getByText("Đã gửi yêu cầu. Xác nhận trong khung chat nhé.").waitFor();
  }, async (page, origin) => {
    await page.route(`${origin}/preview?chat=1`, async (route) => {
      const html = await (await route.fetch()).text();
      await route.fulfill({ contentType: "text/html", body: html.replace("else if(m.method==='ui/message'){", "else if(m.method==='ui/message'){if(!window.refusedOnce){window.refusedOnce=true;throw new Error('Host offline');}") });
    });
  });
});

test("a host that cannot post chat messages says so instead of a sent reminder", async () => {
  await withPreview(async ({ origin, page, app, tool, messages }) => {
    await learnFirstTime(tool, ["q001"]);
    await page.goto(`${origin}/preview`);
    await app.getByRole("button", { name: "Học tiếp" }).waitFor();
    await app.getByRole("button", { name: "Nhắc tôi học mỗi ngày", exact: true }).click();
    const sent = await messages();
    await app.getByRole("button", { name: "Nhờ ChatGPT nhắc tôi" }).click();
    await app.locator("#status").getByText(/Host này không gửi được yêu cầu vào ChatGPT/).waitFor();
    assert.equal(await app.getByText("Đã gửi yêu cầu.", { exact: false }).count(), 0);
    assert.equal((await sent()).filter((m) => m.method === "ui/message").length, 0);
  });
});

test("a popover fits inside the card at 360 px and narrower, with no sideways scroll", async () => {
  await withPreview(async ({ origin, page, app, tool }) => {
    await learnFirstTime(tool, ["q001", "q002", "q003"]);
    // The preview pads the card 10 px a side: a 380 px window gives a 360 px card.
    for (const width of [380, 360]) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(`${origin}/preview`);
      await app.getByRole("button", { name: "Học tiếp" }).waitFor();
      for (const label of ["Đã gặp", "Cần ôn hôm nay", "Sai hôm nay"]) {
        await app.getByRole("button", { name: `Giải thích: ${label}`, exact: true }).click();
        await app.getByRole("dialog").getByRole("heading", { name: label }).waitFor();
        const fit = await app.locator("main").evaluate((main) => {
          const card = main.getBoundingClientRect(), pop = document.querySelector("#info-pop")!.getBoundingClientRect();
          return { card: card.width, inside: pop.left >= card.left && pop.right <= card.right && pop.top >= card.top && pop.bottom <= card.bottom, scroll: document.documentElement.scrollWidth - document.documentElement.clientWidth };
        });
        assert.deepEqual([fit.inside, fit.scroll], [true, 0], `${label} popover inside a ${fit.card} px card`);
      }
    }
  });
});

test("the ⓘ beside Tôi đoán, THỬ LẠI, the combo, XP, the goal, the mock rule and the league each open their own explanation", async () => {
  await withPreview(async ({ origin, page, app, tool, open }) => {
    const started = await tool("start_study", { questionIds: ["q001", "q002", "q003", "q004"], requestId: randomUUID() });
    await page.goto(`${origin}/preview`);
    await app.locator("[data-action]").first().waitFor();
    await open(started);
    const explains = async (label: string, title: string) => {
      await app.getByRole("button", { name: `Giải thích: ${label}`, exact: true }).click();
      await app.getByRole("dialog").getByRole("heading", { name: title, exact: true }).waitFor();
      await page.keyboard.press("Escape");
      await app.getByRole("dialog").waitFor({ state: "hidden" });
    };
    const answer = async (choice: string) => {
      await app.locator(`input[name="answer"][value="${choice}"]`).check();
      await app.locator('[data-action="answer"]').click();
      await app.locator("#verdict").waitFor();
    };
    const next = async () => {
      await continueStudy(app);
      await app.locator("#verdict").waitFor({ state: "detached" });
    };
    await app.getByRole("button", { name: "Bắt đầu" }).click();
    await explains("Tôi đoán", "Tôi đoán");
    await answer(wrong("q001"));
    for (const q of ["q002", "q003"]) {
      await next();
      await answer(right(q));
    }
    await next();
    await app.getByText("THỬ LẠI", { exact: true }).waitFor();
    await explains("Thử lại", "Thử lại");
    await answer(right("q001"));
    assert.equal(await app.locator("[data-lesson-xp]").innerText(), String((await tool("get_study_session", { sessionId: started.structuredContent.sessionId })).structuredContent.xp));
    await app.getByRole("button", { name: "Vì sao?" }).click();
    await explains("Combo", "Combo");
    await next();
    await answer(right("q004"));
    await next();
    await app.getByRole("heading", { name: "Hoàn thành bài học!" }).waitFor();
    await explains("XP", "XP");
    await explains("Mục tiêu hôm nay", "Mục tiêu hôm nay");

    await app.getByRole("button", { name: "Xong hôm nay" }).click();
    await app.getByRole("button", { name: "Thi thử" }).click();
    await explains("Luật thi thử", "Luật thi thử");
    await app.getByRole("button", { name: "Về trang chính" }).click();
    await app.getByRole("button", { name: /^Tham gia nhóm thi đua tuần/ }).click();
    await explains("Nhóm thi đua tuần", "Nhóm thi đua tuần");
  });
});

test("with nothing newly mastered, the finish screen counts first-time correct answers and says which day to review them; a mastered answer keeps câu mới thuộc", async () => {
  await withPreview(async ({ origin, dataPath, page, app, tool, open }) => {
    const { sessionId } = await learnFirstTime(tool, ["q001", "q002", "q003"]);
    await page.goto(`${origin}/preview`);
    await app.locator("[data-action]").first().waitFor();
    await open(await tool("get_study_session", { sessionId }));
    await app.getByRole("heading", { name: "Hoàn thành bài học!" }).waitFor();
    const third = app.locator(".tiles .stat-tile").nth(2);
    await third.getByText("câu đúng lần đầu").waitFor();
    assert.equal(await third.locator("[data-count]").getAttribute("data-count"), "3");
    assert.equal(await app.getByText("câu mới thuộc").count(), 0);
    // Answered just now, so they count again from 24 hours later: tomorrow.
    await app.getByText("Ngày mai ôn lại để thuộc", { exact: true }).waitFor();
    await app.getByRole("button", { name: "Giải thích: Đã thuộc", exact: true }).click();
    await app.getByRole("dialog").getByText("3 câu đã đúng 1 lần", { exact: false }).waitFor();

    // q010 answered right a day ago, so today's right answer masters it.
    const store = new SqliteLearningStore(dataPath);
    await new LearningRuntime(store, "local-development", () => Date.now() - 24 * 3600000 - 1000).command({ kind: "answer_question", requestId: randomUUID(), questionId: "q010", answer: right("q010") });
    store.close();
    const mastered = await learnFirstTime(tool, ["q010"]);
    await open(await tool("get_study_session", { sessionId: mastered.sessionId }));
    await app.getByText("câu mới thuộc").waitFor();
    assert.equal(await app.locator(".tiles .stat-tile").nth(2).locator("[data-count]").getAttribute("data-count"), "1");
    assert.equal(await app.locator("#content").getByText("ôn lại để thuộc").count(), 0, "the first-step line is only for lessons with nothing mastered");
  });
});

test("the card uses Nunito with prominent question headings, Vietnamese faces at every weight, and JetBrains Mono numbers", async () => {
  await withPreview(async ({ origin, page, app, tool, open }) => {
    const started = await tool("start_study", { questionIds: ["q001"], requestId: randomUUID() });
    await page.goto(`${origin}/preview`);
    await app.locator("[data-action]").first().waitFor();
    await open(started);
    await app.getByRole("button", { name: "Bắt đầu" }).click();
    await app.locator(".stem").waitFor();
    const roles = { body: "body", stem: ".stem", option: ".opt .txt", button: '[data-action="answer"]', chip: ".chip.step", number: ".chip.num.mono", pos: ".lesson-xp" };
    const styles = await app.locator("main").evaluate((main, selectors) => Object.fromEntries(Object.entries(selectors).map(([role, selector]) => {
      const style = getComputedStyle(document.querySelector(selector) ?? main);
      return [role, `${style.fontFamily.split(",")[0]?.replace(/["']/g, "")} ${style.fontWeight}`];
    })), roles);
    assert.deepEqual(styles, { body: "Nunito 400", stem: "Nunito 700", option: "Nunito 500", button: "Nunito 700", chip: "Nunito 700", number: "JetBrains Mono 700", pos: "JetBrains Mono 700" });
    const heavy = await app.locator("main").evaluate((main) => [...main.querySelectorAll("*")].filter((el) => Number(getComputedStyle(el).fontWeight) > 700).map((el) => el.className || el.tagName));
    assert.deepEqual(heavy, [], "nothing is heavier than 700");
    const faces = await app.locator("main").evaluate(async () => {
      for (const weight of [400, 500, 600, 700]) await document.fonts.load(`${weight} 16px Nunito`, "Đường Ệ ỗ ư ơ ă");
      return [...document.fonts].filter((f) => f.family.replace(/["']/g, "") === "Nunito" && f.status === "loaded").map((f) => `${f.weight} ${f.unicodeRange.includes("U+1EA0") ? "vietnamese" : "latin"}`).sort();
    });
    assert.deepEqual(faces, ["400 latin", "400 vietnamese", "500 latin", "500 vietnamese", "600 latin", "600 vietnamese", "700 latin", "700 vietnamese"]);
    const font = await fetch(`${origin}/ui/assets/nunito-vietnamese-600-normal.woff2`);
    assert.deepEqual([font.status, font.headers.get("content-type")], [200, "font/woff2"]);
    assert.equal((await fetch(`${origin}/ui/assets/BeVietnamPro-Regular.ttf`)).status, 404, "the old text font is no longer shipped");
  });
});

test("the colorful card loads its artwork and keeps feedback still for keyboard and reduced motion", async () => {
  await withPreview(async ({ origin, page, app, tool, open }) => {
    await page.setViewportSize({ width: 360, height: 900 });
    await page.goto(`${origin}/preview`);
    await app.locator(".journey-art").waitFor();
    const art = await fetch(`${origin}/ui/assets/learning-journey.webp`);
    assert.equal(art.status, 200);
    assert.equal(art.headers.get("content-type"), "image/webp");
    assert.equal(await app.locator(".journey-art").evaluate((img) => (img as HTMLImageElement).naturalWidth > 0), true);
    assert.equal(await app.locator(".card").evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    const started = await tool("start_study", { questionIds: ["q001"], requestId: randomUUID() });
    await open(started);
    await app.getByRole("button", { name: "Bắt đầu" }).click();
    await app.locator(`input[name="answer"][value="${right("q001")}"]`).check();
    await app.locator('[data-action="answer"]').press("Enter");
    await app.locator("#verdict").waitFor();
    assert.equal(await app.locator(".panel").evaluate((el) => getComputedStyle(el).animationName), "none");
    await page.emulateMedia({ reducedMotion: "reduce" });
    await continueStudy(app);
    await app.locator(".finish-title").waitFor();
    assert.equal(await app.locator(".trophy").evaluate((el) => getComputedStyle(el).animationName), "none");
    assert.equal(await app.locator(".btn").first().evaluate((el) => getComputedStyle(el).transitionDuration), "0s");
  });
});

test("the course path keeps every topic reachable across themes and widths and returns keyboard focus", async () => {
  await withPreview(async ({ origin, page, app, tool }) => {
    await tool("start_study", { requestId: randomUUID() });
    for (const theme of ["light", "dark"]) {
      for (const width of [900, 390, 320]) {
        await page.setViewportSize({ width, height: 1000 });
        await page.goto(`${origin}/preview?theme=${theme}`);
        await app.getByRole("button", { name: "Chọn chủ đề", exact: true }).click();
        const layout = await app.locator(".path").evaluate((list) => ({
          height: list.getBoundingClientRect().height,
          topics: list.querySelectorAll('[data-action="map-node"]').length,
          scrollable: list.scrollHeight > list.clientHeight,
          overflow: document.documentElement.scrollWidth > innerWidth,
        }));
        assert.equal(layout.topics, 8);
        assert.equal(layout.scrollable, true, "all eight topics can be reached in the path viewport");
        assert.equal(layout.overflow, false);
        assert.ok(layout.height <= 400, `path leaves room for its action dock at ${width}px in ${theme}: ${layout.height}px`);
        assert.equal(await app.locator('.path [data-action="map-node"]:disabled').count(), 0, "visual future states do not invent locked topics");
        const topic = app.getByRole("button", { name: /^Biển báo, đã gặp/ });
        await topic.scrollIntoViewIfNeeded();
        const pathTop = await app.locator('.path').evaluate(el => el.scrollTop);
        assert.ok(pathTop > 0, "lower topics are inside the scrolling path");
        await topic.press("Enter");
        await app.getByRole("heading", { name: "Biển báo", exact: true }).waitFor();
        assert.equal(await topic.getAttribute("aria-expanded"), "true");
        assert.equal(await app.locator(".path-dock#topic-details").count(), 1);
        assert.equal(await app.locator('.path-dock#topic-details').isVisible(), true);
        assert.equal(await app.locator('.path').evaluate(el => el.scrollTop), pathTop, "opening details preserves the path position");
        await app.getByRole("button", { name: "Thu gọn", exact: true }).press("Enter");
        await app.locator("#topic-details").waitFor({ state: "detached" });
        assert.equal(await topic.evaluate((button) => button === document.activeElement), true);
        await topic.press("Enter");
        await app.locator("#topic-details").waitFor();
        await topic.press("Enter");
        await app.locator("#topic-details").waitFor({ state: "detached" });
        assert.equal(await topic.evaluate((button) => button === document.activeElement), true, "collapsing from the trigger keeps keyboard position");
      }
    }
  });
});
