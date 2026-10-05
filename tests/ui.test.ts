import assert from "node:assert/strict";
import { once } from "node:events";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { chromium } from "playwright";
import { startHttpServer } from "../src/server.js";

test("local preview runs the real quiz, search, images, and saved progress", async () => {
  const dir = mkdtempSync(join(tmpdir(), "driving-ui-"));
  const server = startHttpServer(0, { dataPath: join(dir, "study.sqlite") });
  if (!server.listening) await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing preview port");
  const executablePath = process.env.CHROME_PATH ?? (existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined);
  const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${address.port}/preview`);
    const quiz = page.frameLocator("#quiz");
    await quiz.getByRole("heading", { name: /Phần của đường bộ được sử dụng/ }).waitFor();
    await quiz.getByRole("button", { name: /Câu tiếp theo/ }).click();
    await quiz.getByRole("heading", { name: "Làn đường là gì?" }).waitFor();
    await quiz.getByRole("button", { name: /Câu trước/ }).click();
    await quiz.getByRole("heading", { name: /Phần của đường bộ được sử dụng/ }).waitFor();
    await quiz.locator("#previous").hover();
    const hoverColors = await quiz.locator("#previous").evaluate((element) => {
      const style = getComputedStyle(element);
      return { background: style.backgroundColor, color: style.color };
    });
    assert.notEqual(hoverColors.background, hoverColors.color);
    await quiz.locator('input[value="A"]').check();
    await quiz.getByRole("button", { name: "Kiểm tra đáp án" }).click();
    await quiz.getByText("Chưa đúng. Đáp án: B").waitFor();
    assert.match(await quiz.locator("#feedback").innerText(), /phần đường xe chạy/);
    await quiz.getByRole("button", { name: /Câu tiếp theo/ }).click();
    await quiz.getByRole("heading", { name: "Làn đường là gì?" }).waitFor();
    await quiz.locator('input[value="B"]').check();
    await quiz.getByRole("button", { name: "Kiểm tra đáp án" }).click();
    await quiz.getByText("Chính xác!").waitFor();
    await quiz.locator('#practiced:text-is("2")').waitFor();

    await quiz.getByRole("tab", { name: "Tra cứu" }).click();
    await quiz.getByRole("searchbox").fill("q301");
    await quiz.getByRole("button", { name: "Tìm kiếm" }).click();
    await quiz.getByRole("heading", { name: /Biển nào cấm các loại xe cơ giới/ }).waitFor();
    const image = quiz.locator("#sign-image");
    await image.evaluate((element: HTMLImageElement) => new Promise<void>((resolve, reject) => {
      if (element.complete) return element.naturalWidth > 0 ? resolve() : reject(new Error("Image did not render"));
      element.addEventListener("load", () => resolve(), { once: true });
      element.addEventListener("error", () => reject(new Error("Image did not render")), { once: true });
    }));
    assert.equal(await image.isVisible(), true);
    await page.reload();
    await quiz.locator('#practiced:text-is("2")').waitFor();
    assert.equal(await quiz.locator("#accuracy").innerText(), "50%");
  } finally {
    await browser.close();
    await new Promise<void>((resolve) => server.close(() => resolve()));
    rmSync(dir, { recursive: true, force: true });
  }
});
