import assert from "node:assert/strict";
import { once } from "node:events";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { chromium } from "playwright";
import { startHttpServer } from "../src/server.js";

test("loading is visible through a delayed host call and completion continues locally into progress", async () => {
  const dir = mkdtempSync(join(tmpdir(), "learning-refresh-"));
  const server = startHttpServer(0, { dataPath: join(dir, "study.sqlite") });
  if (!server.listening) await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No port");
  const origin = `http://127.0.0.1:${address.port}`;
  const browser = await chromium.launch({ executablePath: existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
    const send = async (name: string, args: object = {}) => {
      const response = await page.request.post(`${origin}/preview/tool`, { data: { name, arguments: { ...args, requestId: randomUUID(), caller: "card" } } });
      return response.json();
    };
    await send("update_profile", { dailyGoal: 12 });
    const result = await send("start_study", { questionIds: ["q001"] });
    assert.equal(typeof result._meta?.timing?.toolMs, "number", "server timing travels separately from learner data");
    await page.goto(`${origin}/preview?theme=dark`);
    const app = page.frameLocator("#widget");
    await app.getByRole("heading", { name: "Mỗi ngày một bước tiến." }).waitFor();
    assert.equal(await app.locator('.dashboard .brand-mark').count(), 0, 'dashboard omits the redundant brand header');
    assert.equal(await app.locator('.progress-block .stat-graphic').count(), 4, 'all four dashboard metrics have consistent graphics');
    await app.getByRole('region', { name: 'Chuỗi ngày học' }).waitFor();
    const stacked = await app.locator('.dashboard-sidebar').evaluate(el => {
      const goal = el.querySelector('.daily-block')!.getBoundingClientRect();
      const streak = el.querySelector('.streak-block')!.getBoundingClientRect();
      return streak.top >= goal.bottom && Math.abs(streak.left - goal.left) < 1;
    });
    assert.equal(stacked, true, 'daily streak is stacked below today’s goal');
    await page.setViewportSize({ width: 640, height: 1000 });
    assert.equal(await app.locator('.dashboard-sidebar').evaluate(el => {
      const goal = el.querySelector('.daily-block')!.getBoundingClientRect();
      const streak = el.querySelector('.streak-block')!.getBoundingClientRect();
      return streak.top >= goal.bottom && Math.abs(streak.left - goal.left) < 1;
    }), true, 'tablet keeps the streak directly below the goal');
    await page.setViewportSize({ width: 1100, height: 1000 });
    if (process.env.CAPTURE_UI) await page.screenshot({ path: "docs/ui-refresh-preview/dashboard-dark.png", fullPage: true });
    await page.evaluate(result => {
      const frame = document.querySelector<HTMLIFrameElement>("#widget");
      frame?.contentWindow?.postMessage({ jsonrpc: "2.0", method: "ui/notifications/tool-result", params: result }, location.origin);
    }, result);
    await app.locator('[data-action="lesson-start"]').click();
    await app.locator('input[name="answer"]').first().check();
    let release: (() => void) | undefined;
    let waitingFor = "submit_study_answer";
    let gate = new Promise<void>(resolve => { release = resolve; });
    await page.route("**/preview/tool", async route => {
      if (route.request().postDataJSON().name === waitingFor) await gate;
      await route.continue();
    });
    const beforeLoading = await app.locator('#content').evaluate(el => ({ top: (el as HTMLElement).offsetTop, height: (el as HTMLElement).offsetHeight }));
    const answerSize = await app.locator('[data-action="answer"]').evaluate(el => ({ width: (el as HTMLElement).offsetWidth, height: (el as HTMLElement).offsetHeight }));
    await app.locator('[data-action="answer"]').click();
    await app.locator('[data-action="answer"][data-loading]').waitFor();
    assert.equal(await app.locator('#pending-action').count(), 0, "loading never inserts a banner");
    assert.deepEqual(await app.locator('#content').evaluate(el => ({ top: (el as HTMLElement).offsetTop, height: (el as HTMLElement).offsetHeight })), beforeLoading, "loading does not move or resize the question area");
    assert.deepEqual(await app.locator('[data-action="answer"]').evaluate(el => ({ width: (el as HTMLElement).offsetWidth, height: (el as HTMLElement).offsetHeight })), answerSize, "spinner preserves button dimensions");
    assert.equal(await app.locator('[data-action="answer"] .button-spinner').isVisible(), true);
    assert.equal(await app.locator('[data-action="answer"]').isDisabled(), true);
    assert.equal(await app.locator('[data-action="answer"]').getAttribute("data-loading"), "Đang kiểm tra đáp án…");
    if (process.env.CAPTURE_UI) await page.screenshot({ path: "docs/ui-refresh-preview/answer-loading.png", fullPage: true });
    release?.();
    await app.locator('#verdict').waitFor();
    assert.equal(await app.locator('[data-loading]').count(), 0);
    waitingFor = "next_study_question";
    gate = new Promise<void>(resolve => { release = resolve; });
    const beforeNext = await app.locator('#content').evaluate(el => ({ top: (el as HTMLElement).offsetTop, height: (el as HTMLElement).offsetHeight }));
    await app.locator('[data-action="study-next"]').click();
    await app.locator('[data-action="study-next"][data-loading]').waitFor();
    assert.equal(await app.locator('[data-action="study-next"]').isDisabled(), true);
    assert.equal(await app.locator('[data-action="study-next"] .button-spinner').isVisible(), true);
    assert.deepEqual(await app.locator('#content').evaluate(el => ({ top: (el as HTMLElement).offsetTop, height: (el as HTMLElement).offsetHeight })), beforeNext, "next-question loading does not shift the feedback");
    if (process.env.CAPTURE_UI) await page.screenshot({ path: "docs/ui-refresh-preview/next-loading.png", fullPage: true });
    assert.equal(await app.locator('[data-action="study-next"]').getAttribute("data-loading"), "Đang mở câu hỏi…");
    release?.();
    await app.getByRole("heading", { name: "Hoàn thành bài học!" }).waitFor();
    assert.equal(await app.locator('.goal-panel').count(), 0, "details do not crowd the celebration");
    assert.equal(await app.locator(".completion-halo,.completion-spark,.completion-hero .orbit").count(), 0, "completion keeps the original illustration, without an orbit");
    assert.equal(await app.locator('.finish-tiles .stat-tile').count(), 3);
    assert.equal(await app.locator('.lesson-confetti-piece').count(), 30);
    assert.ok(await app.locator('.completion-trophy').evaluate(el => parseFloat(getComputedStyle(el).width) >= 150), 'celebration artwork is prominent');
    if (process.env.CAPTURE_UI) await page.waitForTimeout(850);
    if (process.env.CAPTURE_UI) await page.screenshot({ path: "docs/ui-refresh-preview/completion-dark.png", fullPage: true });
    await page.setViewportSize({ width: 360, height: 844 });
    assert.equal(await app.locator('body').evaluate(el => el.scrollWidth > window.innerWidth), false, 'mobile confetti stays inside the card');
    if (process.env.CAPTURE_UI) await page.screenshot({ path: "docs/ui-refresh-preview/completion-mobile-dark.png", fullPage: true });
    await page.setViewportSize({ width: 1100, height: 1000 });
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(await app.locator('.lesson-confetti').isVisible(), false, 'reduced motion suppresses flying particles');
    assert.equal(await app.locator('.trophy').evaluate(el => getComputedStyle(el).animationName), 'none');
    await page.emulateMedia({ reducedMotion: "no-preference" });
    const calls: string[] = [];
    page.on("request", request => { if (request.url().endsWith("/preview/tool")) calls.push(request.postDataJSON().name); });
    await app.locator('[data-action="finish-continue"]').click();
    await app.getByRole("heading", { name: "Bước tiếp theo" }).waitFor();
    assert.equal(calls.length, 0, "Continue changes presentation without recording another result");
    if (process.env.CAPTURE_UI) { await page.waitForTimeout(350); await page.screenshot({ path: "docs/ui-refresh-preview/completion-details-dark.png", fullPage: true }); }
    await send("join_league", { displayName: "Preview Learner" });
    const completedWithLeague = await send("get_study_session", { sessionId: result.structuredContent.sessionId });
    await page.evaluate(result => document.querySelector<HTMLIFrameElement>("#widget")?.contentWindow?.postMessage({ jsonrpc: "2.0", method: "ui/notifications/tool-result", params: result }, location.origin), completedWithLeague);
    await app.locator('.completion-details .league-art').waitFor();
    await app.locator('.completion-details').getByRole('button', { name: 'Xem bảng', exact: true }).waitFor();
    assert.equal(await app.locator('.completion-details .league-box').count(), 0, 'completion uses the shared trophy ranking card');
    if (process.env.CAPTURE_UI) { await page.waitForTimeout(350); await page.screenshot({ path: "docs/ui-refresh-preview/completion-details-dark.png", fullPage: true }); }
    await app.locator('[data-action="course"]').click();
    await app.locator('.league-card .league-open').waitFor();
    assert.equal(await app.locator('.dashboard-grid').evaluate(el => {
      const course = el.querySelector('.course-feature')!.getBoundingClientRect();
      const sidebar = el.querySelector('.dashboard-sidebar')!.getBoundingClientRect();
      const last = el.querySelector('.streak-block')!.getBoundingClientRect();
      return Math.abs(sidebar.height - course.height) < 1 && Math.abs(last.bottom - course.bottom) < 1;
    }), true, 'desktop sidebar cards fill the height of the course card');
    if (process.env.CAPTURE_UI) await page.screenshot({ path: "docs/ui-refresh-preview/league-card-dark.png", fullPage: true });
    await app.locator('.league-open').click();
    await app.getByRole('heading', { name: 'Nhóm tuần này' }).waitFor();
    await app.locator('[data-action="course"]').click();
    await app.locator('[data-action="map"]').click();
    await app.locator('.current .orbit').first().waitFor();
    const centerDifference = await app.locator('.current .path-node').first().evaluate(el => {
      const ring = el.querySelector(".orbit")!.getBoundingClientRect();
      const platform = el.querySelector(".coin-shape")!.getBoundingClientRect();
      return Math.abs((ring.left + ring.width / 2) - (platform.left + platform.width / 2));
    });
    assert.ok(centerDifference < 1, "the orbit and platform share a horizontal center");
    if (process.env.CAPTURE_UI) await page.screenshot({ path: "docs/ui-refresh-preview/orbit-dark.png", fullPage: true });
    await page.emulateMedia({ reducedMotion: "reduce" });
    assert.equal(await app.locator('.lesson-confetti-piece').count(), 0, 'completion particles do not leak to the course browser');
    const orbit = app.locator('.current .orbit-arc').first();
    assert.equal(await orbit.evaluate(el => getComputedStyle(el).animationName), "none");
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await app.locator('.path-section').count(), 0, 'course path has no redundant heading block');
    assert.equal(await app.locator('body').evaluate(el => el.scrollWidth > window.innerWidth), false, 'course stats fit mobile');
    if (process.env.CAPTURE_UI) await page.screenshot({ path: "docs/ui-refresh-preview/course-mobile-dark.png", fullPage: true });
    await app.locator('[data-action="course"]').click();
    await app.getByRole("heading", { name: "Mỗi ngày một bước tiến." }).waitFor();
    await app.locator('.streak-heading').getByText('1 ngày liên tiếp', { exact: true }).waitFor();
    const overflow = await app.locator('body').evaluate(el => el.scrollWidth > window.innerWidth);
    assert.equal(overflow, false, "the dashboard fits a mobile card");
    if (process.env.CAPTURE_UI) await page.screenshot({ path: "docs/ui-refresh-preview/dashboard-mobile-dark.png", fullPage: true });
    await page.goto(`${origin}/preview?theme=light`);
    await app.getByRole("heading", { name: "Mỗi ngày một bước tiến." }).waitFor();
    if (process.env.CAPTURE_UI) await page.screenshot({ path: "docs/ui-refresh-preview/dashboard-mobile-light.png", fullPage: true });
    await app.locator('.dashboard-top-actions [data-action="lightning"]').click();
    await app.getByRole('heading', { name: 'Trả lời nhanh nhất có thể' }).waitFor();
    await app.locator('[data-action="course"]').click();
    await app.locator('.daily-block [data-action="goals"]').click();
    await app.locator('#goal-form').waitFor();
    await app.locator('[data-action="course"]').click();
    await app.locator('.course-actions [data-action="mock-entry"]').click();
    await app.getByRole('heading', { name: 'Sẵn sàng thi thử?' }).waitFor();
    await app.locator('[data-action="course"]').click();
    await app.locator('.course-actions [data-action="map"]').click();
    await app.locator('.course-stats-grid').waitFor();
    if (process.env.CAPTURE_UI) await page.screenshot({ path: "docs/ui-refresh-preview/course-mobile-light.png", fullPage: true });
  } finally {
    await browser.close();
    server.close();
    await once(server, "close");
    rmSync(dir, { recursive: true, force: true });
  }
});

test("lesson overview presents only planned activities and fits light, dark and mobile views", async () => {
  const dir = mkdtempSync(join(tmpdir(), "lesson-overview-"));
  const server = startHttpServer(0, { dataPath: join(dir, "study.sqlite") });
  if (!server.listening) await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No port");
  const browser = await chromium.launch({ executablePath: existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined, args: ["--no-sandbox"] });
  try {
    const origin = `http://127.0.0.1:${address.port}`;
    const page = await browser.newPage({ viewport: { width: 1000, height: 850 } });
    await page.request.post(`${origin}/preview/tool`, { data: { name: "update_profile", arguments: { dailyGoal: 12, requestId: randomUUID(), caller: "card" } } });
    const response = await page.request.post(`${origin}/preview/tool`, { data: { name: "start_study", arguments: { requestId: randomUUID(), caller: "card" } } });
    const result = await response.json();
    for (const theme of ["light", "dark"]) {
      await page.goto(`${origin}/preview?theme=${theme}`);
      const app = page.frameLocator("#widget");
      await app.getByRole("heading", { name: "Mỗi ngày một bước tiến." }).waitFor();
      await page.evaluate(result => document.querySelector<HTMLIFrameElement>("#widget")?.contentWindow?.postMessage({ jsonrpc: "2.0", method: "ui/notifications/tool-result", params: result }, location.origin), result);
      await app.getByRole("region", { name: "Trong bài học này" }).waitFor();
      await app.locator('.plan-step.new .plan-count').getByText(String(result.structuredContent.steps.new), { exact: true }).waitFor();
      assert.equal(await app.locator('.plan-step.review,.plan-step.practice').count(), 0, "absent activities stay hidden");
      if (process.env.CAPTURE_UI) await page.screenshot({ path: `docs/ui-refresh-preview/lesson-overview-${theme}.png`, fullPage: true });
      await page.setViewportSize({ width: 360, height: 844 });
      assert.equal(await app.locator('body').evaluate(el => el.scrollWidth > window.innerWidth), false, "lesson overview fits a small mobile viewport");
      if (process.env.CAPTURE_UI) await page.screenshot({ path: `docs/ui-refresh-preview/lesson-overview-mobile-${theme}.png`, fullPage: true });
      await page.setViewportSize({ width: 1000, height: 850 });
    }
    await page.frameLocator("#widget").getByRole("button", { name: "Bắt đầu", exact: true }).click();
    await page.frameLocator("#widget").locator('input[name="answer"]').first().waitFor();
  } finally {
    await browser.close();
    server.close();
    await once(server, "close");
    rmSync(dir, { recursive: true, force: true });
  }
});
