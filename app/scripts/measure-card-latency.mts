// Measures click → verdict and click → next question in the preview with ?delay=<ms> standing in for ChatGPT's tool latency.
// Usage: node --import tsx scripts/measure-card-latency.mts [delayMs]
import { once } from "node:events";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { randomUUID } from "node:crypto";
import { chromium } from "playwright";
import { startHttpServer } from "../src/server.js";

const delay = Number(process.argv[2] ?? 3000);
const dir = mkdtempSync(join(tmpdir(), "lesson-latency-"));
const server = startHttpServer(0, { dataPath: join(dir, "study.sqlite") });
if (!server.listening) await once(server, "listening");
const address = server.address();
if (!address || typeof address === "string") throw new Error("No port");
const origin = `http://127.0.0.1:${address.port}`;
const browser = await chromium.launch({ executablePath: existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined, args: ["--no-sandbox"] });
try {
  const tool = async (name: string, args: object) => (await fetch(`${origin}/preview/tool`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ name, arguments: args }) })).json();
  const started = await tool("start_study", { questionIds: ["q001", "q002", "q003"], requestId: randomUUID() });
  const page = await browser.newPage();
  await page.goto(`${origin}/preview?delay=${delay}`);
  const app = page.frameLocator("#widget");
  await app.locator("[data-action]").first().waitFor({ timeout: 30000 });
  await page.evaluate(params => document.querySelector<HTMLIFrameElement>("#widget")?.contentWindow?.postMessage({ jsonrpc: "2.0", method: "ui/notifications/tool-result", params }, location.origin), started);
  await app.locator('[data-action="lesson-start"]').click({ timeout: 30000 });
  const frame = page.frames().find(f => f.url().includes("/ui/learning.html"));
  if (!frame) throw new Error("No card frame");
  // Timed inside the card, from the click to the DOM change, so Playwright's polling interval is not part of the number.
  const timed = (action: string, selector: string, text: string) => frame.evaluate(`new Promise(done => {
    const t = performance.now(), observer = new MutationObserver(() => check());
    function check() { const el = document.querySelector(${JSON.stringify(selector)}); if (el && el.textContent.includes(${JSON.stringify(text)})) { observer.disconnect(); done(Math.round(performance.now() - t)); } }
    observer.observe(document.body, { subtree: true, childList: true, characterData: true });
    document.querySelector('[data-action="${action}"]').click(); check();
  })`) as Promise<number>;
  const rows: string[] = [];
  for (const [index, next] of ["q002", "q003"].entries()) {
    const stem = await tool("get_question", { questionId: next }).then(r => r.structuredContent.question as string);
    await app.locator('input[name="answer"]').first().check();
    const verdict = await timed("answer", "#verdict", "");
    const question = await timed("study-next", "h2.stem", stem);
    rows.push(`question ${index + 1}: click→verdict ${verdict} ms, click→next question ${question} ms`);
  }
  await app.locator("[data-action]").first().waitFor();
  const deadline = Date.now() + 4 * delay + 5000;
  let recorded = 0;
  while (Date.now() < deadline && recorded < 2) { recorded = (await tool("get_study_session", { sessionId: started.structuredContent.sessionId })).structuredContent.sessionResults.answered; if (recorded < 2) await new Promise(r => setTimeout(r, 250)); }
  rows.push(`server recorded ${recorded} answers`);
  console.log(`delay=${delay}\n${rows.join("\n")}`);
} finally {
  await browser.close();
  server.close();
  rmSync(dir, { recursive: true, force: true });
}
