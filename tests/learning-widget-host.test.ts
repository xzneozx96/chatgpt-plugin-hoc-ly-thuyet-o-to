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
