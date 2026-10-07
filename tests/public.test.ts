import assert from "node:assert/strict";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { test } from "node:test";
import { chromium } from "playwright";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";
import { startHttpServer } from "../src/server.js";

test("public preview omits private progress and serves remote image URLs", async () => {
  const server = startHttpServer(0, { publicBaseUrl: "https://trial.example" });
  if (!server.listening) await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test port");
  const origin = `http://127.0.0.1:${address.port}`;
  const transport = new StreamableHTTPClientTransport(new URL(`${origin}/mcp`));
  const client = new Client({ name: "public-mode-test", version: "1.0" });
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  try {
    await client.connect(transport);
    assert.deepEqual((await client.listTools()).tools.map((tool) => tool.name).sort(), ["get_course", "get_question", "list_units", "search_theory", "submit_answer"]);
    assert.equal((await fetch(`${origin}/preview`)).status, 404);
    assert.equal((await fetch(`${origin}/preview/tool`, { method: "POST" })).status, 404);
    assert.equal((await fetch(`${origin}/play`)).status, 200);
    const result = await client.callTool({ name: "get_question", arguments: { questionId: "q301" } });
    assert.equal((result.structuredContent as { imageUrl: string }).imageUrl, "https://trial.example/images/q301.webp");
    const bridgeResponse = await fetch(`${origin}/play/tool`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name: "get_question", arguments: { questionId: "q301" } })
    });
    assert.equal((await bridgeResponse.json()).structuredContent.imageUrl, "https://trial.example/images/q301.webp");
    const executablePath = process.env.CHROME_PATH ?? (existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined);
    browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage();
    await page.route("https://trial.example/images/q301.webp", async (route) => {
      const image = await fetch(`${origin}/images/q301.webp`);
      await route.fulfill({ status: image.status, contentType: "image/webp", body: Buffer.from(await image.arrayBuffer()) });
    });
    await page.goto(`${origin}/play`);
    const widget = page.frameLocator("#widget");
    await widget.getByRole("heading", { name: "Đăng nhập để lưu tiến độ" }).waitFor();
    assert.equal(await widget.locator('[data-action="daily"]').count(), 0, "nothing offers saved study without history");
    assert.equal(await widget.locator(".nums").count(), 0, "no progress numbers are claimed");
    await widget.getByRole("button", { name: "Chọn chủ đề để luyện" }).click();
    await widget.getByRole("button", { name: /^Biển báo/ }).click();
    await widget.getByRole("button", { name: "Luyện câu gốc" }).click();
    await widget.getByRole("heading", { name: /Biển nào cấm các loại xe cơ giới/ }).waitFor();
    const course = await client.callTool({ name: "get_course", arguments: {} });
    assert.equal((course.structuredContent as { historyAvailable: boolean }).historyAvailable, false);
    await page.goto(`${origin}/play?legacy=1`);
    const quiz = page.frameLocator("#quiz");
    await quiz.getByRole("heading", { name: /Phần của đường bộ được sử dụng/ }).waitFor();
    assert.equal(await quiz.locator(".stats").isVisible(), false);
    assert.equal(await quiz.locator("#review-tab").isVisible(), false);
    await quiz.getByRole("button", { name: /Câu tiếp theo/ }).click();
    await quiz.getByRole("heading", { name: "Làn đường là gì?" }).waitFor();
    await quiz.getByRole("button", { name: "Biển báo" }).click();
    await quiz.getByRole("heading", { name: /Biển nào cấm các loại xe cơ giới/ }).waitFor();
    const imageWidth = await quiz.locator("#sign-image").evaluate(async (image: HTMLImageElement) => {
      await image.decode();
      return image.naturalWidth;
    });
    assert.ok(imageWidth > 0);
  } finally {
    await browser?.close();
    await client.close();
    await transport.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  }
});
