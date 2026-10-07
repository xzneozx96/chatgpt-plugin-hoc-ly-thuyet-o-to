// Captures our app in the states compared against Brilliant, at a fixed viewport and seed.
// node --import tsx docs/ui-refresh-preview/capture-states.ts <state> <out.jpg> [width=958] [height=1164] [theme=dark]
// SETTLE=<ms> sets the wait before the screenshot, to catch an animation mid-flight.
// state: dashboard | map | question | correct | wrong | finish | league
import { randomUUID } from "node:crypto";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { once } from "node:events";
import { chromium } from "playwright";
import { LearningRuntime } from "../../src/domain/learning-runtime.js";
import { createLearningTools } from "../../src/learning-tools.js";
import { safeQuestion } from "../../src/domain/course.js";
import { submitAnswer } from "../../src/domain/quiz.js";
import { SqliteLearningStore } from "../../src/persistence/learning-store.js";
import { startHttpServer } from "../../src/server.js";

const [state, out, w = "958", h = "1164", theme = "dark"] = process.argv.slice(2);
const right = (q: string) => submitAnswer(q, safeQuestion(q).options[0]?.id ?? "A").correctAnswer;
const wrong = (q: string) => safeQuestion(q).options.find(o => o.id !== right(q))!.id;
const dir = mkdtempSync(join(tmpdir(), "capture-"));
const dataPath = join(dir, "study.sqlite");
const store = new SqliteLearningStore(dataPath);
const learners: [string, string, number][] = [["user-a", "Lan.B", 12], ["user-b", "minh_hoc", 9], ["user-c", "Tuấn K", 7], ["local-development", "Bạn học", 5], ["user-d", "hoa.lai", 3], ["user-e", "Quang", 1]];
for (const [id, name, n] of learners) {
  const tools = createLearningTools(new LearningRuntime(store, id), "local");
  const tool = (t: string) => tools.find(x => x.name === t)!;
  const ids = Array.from({ length: n }, (_, i) => `q${String(i + 1).padStart(3, "0")}`);
  const s = await tool("start_study").run({ requestId: randomUUID(), questionIds: ids }) as { sessionId: string };
  for (const q of ids) {
    await tool("submit_study_answer").run({ requestId: randomUUID(), sessionId: s.sessionId, questionId: q, answer: right(q) });
    await tool("next_study_question").run({ requestId: randomUUID(), sessionId: s.sessionId });
  }
  await tool("join_league").run({ requestId: randomUUID(), displayName: name });
}
store.close();

const server = startHttpServer(0, { dataPath });
if (!server.listening) await once(server, "listening");
const origin = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
type View = { sessionId: string; status?: string; question?: { id: string } };
const call = async (name: string, args: object) => (await (await fetch(`${origin}/preview/tool`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, arguments: { requestId: randomUUID(), ...args } }) })).json()) as { structuredContent: View };
const browser = await chromium.launch({ executablePath: "/usr/bin/google-chrome", headless: true, args: ["--no-sandbox"] });
try {
  const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
  const open = (result: unknown) => page.evaluate((params) => {
    document.querySelector<HTMLIFrameElement>("#widget")?.contentWindow?.postMessage({ jsonrpc: "2.0", method: "ui/notifications/tool-result", params }, location.origin);
  }, result);
  await page.goto(`${origin}/preview?theme=${theme}`);
  const app = page.frameLocator("#widget");
  await app.locator('[data-action="daily"]').first().waitFor();
  if (state === "map") await app.locator('[data-action="map"]').click();
  if (state === "league") await app.locator('.dashboard [data-action="league"]').click();
  if (["question", "correct", "wrong"].includes(state)) {
    // q301 has a diagram and three options, the closest match to Brilliant's illustrated multiple choice.
    await open(await call("start_study", { questionIds: ["q301", "q302", "q303"] }));
    await app.locator('[data-action="lesson-start"]').click();
    await app.locator('input[name="answer"]').first().waitFor();
    if (state !== "question") {
      await app.locator(`input[name="answer"][value="${state === "correct" ? right("q301") : wrong("q301")}"]`).check();
      await app.locator('[data-action="answer"]').click();
      await app.locator('[data-action="study-next"], [data-action="study-retry"]').first().waitFor();
    }
  }
  if (state === "finish") {
    // Three questions, one missed first time: Brilliant's reference finished 2/3.
    let view = (await call("start_study", { questionIds: ["q006", "q007", "q008"] })).structuredContent;
    const missed = new Set<string>();
    for (let i = 0; i < 12 && view.status !== "complete" && view.question; i++) {
      const q = view.question.id, miss = q === "q008" && !missed.has(q);
      missed.add(q);
      await call("submit_study_answer", { sessionId: view.sessionId, questionId: q, answer: miss ? wrong(q) : right(q) });
      view = (await call("next_study_question", { sessionId: view.sessionId })).structuredContent;
    }
    await open({ structuredContent: view });
  }
  await page.waitForTimeout(Number(process.env.SETTLE ?? 900));
  await page.screenshot({ path: out, type: "jpeg", quality: 85, fullPage: Number(w) < 500 });
  const frame = page.frames().find(f => f.url().includes("/ui/learning.html"))!;
  console.log(JSON.stringify(await frame.evaluate(`({ screen: document.querySelector(".content")?.dataset.screen, docW: document.documentElement.scrollWidth, vw: innerWidth, docH: document.documentElement.scrollHeight })`)));
} finally {
  await browser.close();
  server.close();
  rmSync(dir, { recursive: true, force: true });
}
