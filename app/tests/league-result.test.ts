import assert from "node:assert/strict";
import { once } from "node:events";
import { existsSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { test } from "node:test";
import { chromium } from "playwright";
import { startHttpServer } from "../src/server.js";

test("a member's mock test result shows their league rank, a non-member's does not", async () => {
  const server = startHttpServer(0, { dataPath: join(mkdtempSync(join(tmpdir(), "league-result-")), "study.sqlite") });
  if (!server.listening) await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("No port");
  const origin = `http://127.0.0.1:${address.port}`;
  const browser = await chromium.launch({ executablePath: existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage({ viewport: { width: 1100, height: 1000 } });
    const send = async (name: string, args: object = {}) => (await page.request.post(`${origin}/preview/tool`, { data: { name, arguments: { ...args, requestId: randomUUID(), caller: "card" } } })).json();
    const show = (result: unknown) => page.evaluate(r => document.querySelector<HTMLIFrameElement>("#widget")?.contentWindow?.postMessage({ jsonrpc: "2.0", method: "ui/notifications/tool-result", params: r }, location.origin), result);
    const finishMock = async () => {
      const mock = await send("start_mock_test", { mode: "random" });
      return send("finalise_mock_test", { attemptId: mock.structuredContent.attemptId, confirmUnanswered: true });
    };
    const started = await send("start_study", { questionIds: ["q001"] });
    await page.goto(`${origin}/preview`);
    const app = page.frameLocator("#widget");
    await app.getByRole("heading", { name: "Mỗi ngày một bước tiến." }).waitFor();
    await send("submit_study_answer", { sessionId: started.structuredContent.sessionId, questionId: "q001", answer: "A" });
    await send("next_study_question", { sessionId: started.structuredContent.sessionId });

    await show(await finishMock());
    await app.locator(".stamp").waitFor();
    assert.equal(await app.locator(".league-card").count(), 0, "a learner outside the league sees no rank");

    await send("join_league", { displayName: "Preview Learner" });
    await show(await finishMock());
    await app.locator(".stamp").waitFor();
    await app.locator(".league-card").waitFor();
    assert.match(await app.locator(".league-card").innerText(), /Hạng 1/);
  } finally {
    await browser.close();
    server.close();
  }
});
