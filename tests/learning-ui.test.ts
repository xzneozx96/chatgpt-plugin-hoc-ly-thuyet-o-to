import assert from "node:assert/strict";
import { once } from "node:events";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { chromium } from "playwright";
import { startHttpServer } from "../src/server.js";

test("learning preview drives course, goal, families, study, confusion, help, pause and mock through the shared tools", async () => {
  const dir = mkdtempSync(join(tmpdir(), "driving-learning-ui-"));
  const dataPath = join(dir, "study.sqlite");
  let server = startHttpServer(0, { dataPath });
  if (!server.listening) await once(server, "listening");
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing preview port");
  const port = address.port;
  const executablePath = process.env.CHROME_PATH ?? (existsSync("/usr/bin/google-chrome") ? "/usr/bin/google-chrome" : undefined);
  const browser = await chromium.launch({ executablePath, headless: true, args: ["--no-sandbox"] });
  try {
    const page = await browser.newPage();
    const dialogs: string[] = [];
    page.on("dialog", (dialog) => { dialogs.push(dialog.message()); void dialog.accept(); });
    await page.goto(`http://127.0.0.1:${port}/preview`);
    const app = page.frameLocator("#widget");
    const action = (name: string) => app.locator(`[data-action="${name}"]`).first();

    await app.getByRole("heading", { name: "Khóa học bằng B" }).waitFor();
    assert.equal(await app.locator(".course-row").count(), 8);
    await app.getByText("Câu hỏi dễ nhầm lẫn").waitFor();
    await app.getByText("12 câu mỗi ngày").waitFor();

    await action("goals").click();
    await app.locator('input[name="goal"][value="custom"]').check();
    await app.locator("#custom-goal").fill("20");
    await app.getByRole("button", { name: "Lưu mục tiêu" }).click();
    await app.getByText("20 câu mỗi ngày").waitFor();

    await action("families").click();
    await app.getByRole("heading", { name: "Nhóm dễ nhầm lẫn" }).waitFor();
    await app.locator("#search").fill("145");
    await app.getByRole("button", { name: "Tìm kiếm" }).click();
    await app.locator(".note", { hasText: /^[1-9]\d* kết quả$/ }).waitFor();
    assert.ok(await app.locator(".course-row").count() > 0, "family search by original question number finds groups");
    await action("course").click();

    await action("daily").click();
    await app.getByRole("heading", { name: /Phần của đường bộ được sử dụng/ }).waitFor();
    await app.locator('input[name="answer"][value="A"]').check();
    await action("answer").click();
    await app.getByText("Cần xem lại").waitFor();
    await app.getByText("Đáp án gốc: B").waitFor();
    await page.reload();
    await action("inspect-session").click();
    await app.getByText("Cần xem lại").waitFor();
    await app.getByRole("heading", { name: /Phần của đường bộ được sử dụng/ }).waitFor();
    assert.equal(await action("skip").isDisabled(), true, "feedback stays bound and skip is unavailable until next");

    await action("study-next").click();
    await app.getByRole("heading", { name: "Làn đường là gì?" }).waitFor();

    await app.locator("details.more-actions summary").click();
    await app.getByRole("button", { name: "Tôi còn phân vân" }).click();
    await app.getByRole("heading", { name: "Làn đường là gì?" }).waitFor();
    await app.getByRole("button", { name: "Bỏ dấu phân vân" }).waitFor();
    await app.locator("details.more-actions summary").click();

    await action("help").click();
    await app.locator("#status").getByText(/Host này không gửi được yêu cầu vào ChatGPT/).waitFor();
    await app.getByText(/Kho kiến thức và video bổ sung chưa kết nối/).waitFor();

    await app.locator("details.more-actions summary").click();
    await action("pause").click();
    await app.getByRole("heading", { name: "Buổi học đã tạm dừng" }).waitFor();

    server.close();
    await once(server, "close");
    server = startHttpServer(port, { dataPath });
    if (!server.listening) await once(server, "listening");
    await page.reload();
    await app.getByText("20 câu mỗi ngày").waitFor();
    await action("resume").click();
    await app.getByRole("heading", { name: "Làn đường là gì?" }).waitFor();
    await app.getByText("1/20 câu đã xử lý", { exact: false }).waitFor();

    await app.locator(".brand nav [data-action='mock-entry']").click();
    await action("mock-start").click();
    await app.getByRole("heading", { name: "Thi thử ngẫu nhiên" }).waitFor();
    await app.locator("#timer").filter({ hasText: /^(20:00|19:5\d)$/ }).waitFor();
    const firstQuestion = await app.locator("#content h2").innerText();
    await app.locator('input[name="answer"]').first().check();
    await app.getByText("Đáp án hiển thị là lựa chọn máy chủ đã lưu.").waitFor();
    await action("mock-next").click();
    await app.getByText("Câu 2/30", { exact: false }).waitFor();
    await action("mock-prev").click();
    assert.equal(await app.locator("#content h2").innerText(), firstQuestion);
    assert.equal(await app.locator('input[name="answer"]').first().isChecked(), true, "provisional choice survives navigation");
    assert.equal(await app.locator(".verdict").count(), 0, "provisional choice reveals no correctness");

    await action("mock-confirm").click();
    await app.getByText("29 câu chưa trả lời. Nộp bài và chấm ngay?").waitFor();
    await action("confirm-yes").click();
    await app.getByRole("heading", { name: "Kết quả thi thử" }).waitFor();
    await app.getByText(/\/30 · Chưa đạt/).waitFor();
    await app.getByText("29 câu bỏ trống", { exact: false }).waitFor();

    await action("mock-entry").click();
    await action("mock-start").click();
    await app.getByRole("heading", { name: "Thi thử ngẫu nhiên" }).waitFor();
    await app.locator('input[name="answer"]').first().check();
    await app.getByText("Đáp án hiển thị là lựa chọn máy chủ đã lưu.").waitFor();
    await app.locator("details.more-actions summary").click();
    await action("mock-leave").click();
    await action("confirm-yes").click();
    await app.getByRole("heading", { name: "Đã dừng bài thi" }).waitFor();
    assert.deepEqual(dialogs, [], "the card never opens browser dialogs");
  } finally {
    await browser.close();
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
