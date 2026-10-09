import assert from "node:assert/strict";
import { once } from "node:events";
import { existsSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import { chromium } from "playwright";
import { startHttpServer } from "../src/server.js";

test("learning preview drives course, goal, families, lesson, confusion, help, pause and mock through the shared tools", async () => {
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

    // A first visit opens the goal picker: 12 is recommended but not chosen, so "Bắt đầu" waits for a choice.
    await app.getByRole("heading", { name: "Mỗi ngày bạn muốn học bao nhiêu câu mới?" }).waitFor();
    assert.equal(await app.locator('input[name="goal"]:checked').count(), 0, "no goal is preselected");
    assert.equal(await app.getByRole("button", { name: "Bắt đầu" }).isDisabled(), true);
    await app.locator('input[name="goal"][value="12"]').check();
    await app.getByText("Xong lượt đầu 600 câu sau 50 ngày học, còn 10 ngày dự phòng.").waitFor();
    await app.locator('input[name="goal"][value="custom"]').check();
    await app.locator("#custom-goal").fill("20");
    await app.getByText("Xong lượt đầu 600 câu sau 30 ngày học, còn 30 ngày dự phòng.").waitFor();
    await app.getByRole("button", { name: "Bắt đầu" }).click();
    await app.getByRole("heading", { name: "Tiến độ của bạn được lưu" }).waitFor();
    await app.getByText("Bước 2/2").waitFor();
    await action("daily").click();
    await action("lesson-start").click();
    await app.getByRole("heading", { name: /Phần của đường bộ được sử dụng/ }).waitFor();
    await app.locator('input[name="answer"][value="A"]').check();
    await action("answer").click();
    await app.getByRole("heading", { name: "Chưa đúng" }).waitFor();
    await action("why").click();
    await app.getByText("Đáp án đúng: B ·").waitFor();
    await page.reload();
    await app.getByText("Theo nhịp 20 câu/ngày", { exact: false }).waitFor();
    await app.getByRole("button", { name: "Tiếp tục" }).waitFor();
    assert.equal(await action("daily").count(), 0, "an open lesson turns Học tiếp into Tiếp tục");
    await action("resume").click();
    await app.getByRole("heading", { name: "Chưa đúng" }).waitFor();
    await app.getByRole("heading", { name: /Phần của đường bộ được sử dụng/ }).waitFor();
    assert.equal(await action("skip").count(), 0, "feedback stays bound and skip is unavailable until next");

    await action("study-next").click();
    await app.getByRole("heading", { name: "Làn đường là gì?" }).waitFor();
    await app.locator('input[name="answer"]').first().check();
    await action("answer").click();
    await app.locator("#verdict").waitFor();
    await action("why").click();

    assert.equal(await app.getByRole("button", { name: "Tôi còn phân vân" }).count(), 0, "the ambiguous confusion action is removed");
    assert.equal(await app.locator("#verdict").count(), 1, "the verdict stays after flagging confusion");

    await action("help").click();
    await app.locator("#status").getByText(/Host này không gửi được yêu cầu vào ChatGPT/).waitFor();

    await action("pause").click();
    await app.getByRole("heading", { name: "Buổi học đã tạm dừng" }).waitFor();

    server.close();
    await once(server, "close");
    server = startHttpServer(port, { dataPath });
    if (!server.listening) await once(server, "listening");
    await page.reload();
    await app.getByText("Theo nhịp 20 câu/ngày", { exact: false }).waitFor();
    await action("resume").click();
    await app.getByRole("heading", { name: "Làn đường là gì?" }).waitFor();
    await app.locator("#verdict").waitFor();
    await app.getByText("2/21", { exact: true }).waitFor();

    assert.equal(await app.locator("nav:not(.segs)").count(), 0, "no global navigation during a lesson, only the question stepper");
    await page.reload();
    await app.getByRole("button", { name: "Tiếp tục" }).waitFor();
    // The course map shows the seven categories and the confusing-question category, which opens the family picker.
    await app.getByRole("button", { name: "Chọn chủ đề" }).click();
    await app.getByRole("heading", { name: "Khóa học bằng B" }).waitFor();
    assert.equal(await app.locator('[data-action="map-node"]').count(), 8);
    await app.getByRole("button", { name: /^Câu hỏi dễ nhầm lẫn/ }).click();
    await app.getByRole("button", { name: "Chọn nhóm" }).click();
    await app.getByRole("heading", { name: "Câu hỏi dễ nhầm lẫn" }).waitFor();
    await app.locator("#search").fill("145");
    await app.getByRole("button", { name: "Tìm kiếm" }).click();
    await app.locator(".note", { hasText: /^[1-9]\d* kết quả$/ }).waitFor();
    assert.ok(await app.locator(".frow").count() > 0, "family search by original question number finds groups");
    await app.locator(".frow").first().click();
    await app.getByRole("button", { name: "Học nhóm này" }).waitFor();
    await action("map").click();
    await action("course").click();
    await app.getByRole("button", { name: "Đổi mục tiêu" }).click();
    assert.equal(await app.locator('input[name="goal"][value="custom"]').isChecked(), true, "changing the goal starts from the saved one");
    await app.locator('input[name="goal"][value="15"]').check();
    await app.getByRole("button", { name: "Lưu mục tiêu" }).click();
    await app.getByText("Theo nhịp 15 câu/ngày", { exact: false }).waitFor();
    await app.getByRole("button", { name: "Thi thử" }).click();
    await app.getByRole("heading", { name: "Sẵn sàng thi thử?" }).waitFor();
    await action("mock-start").click();
    await app.locator("#timer").filter({ hasText: /^(20:00|19:5\d)$/ }).waitFor();
    const firstQuestion = await app.locator("#content h2").innerText();
    await app.locator('input[name="answer"]').first().check();
    await app.getByText("Đã lưu lựa chọn.").waitFor();
    await app.getByText("Đã trả lời 1/30").waitFor();
    await action("mock-next").click();
    await app.getByText("Câu 2/30", { exact: false }).waitFor();
    await action("mock-prev").click();
    assert.equal(await app.locator("#content h2").innerText(), firstQuestion);
    assert.equal(await app.locator('input[name="answer"]').first().isChecked(), true, "provisional choice survives navigation");
    assert.equal(await app.locator(".verdict").count(), 0, "provisional choice reveals no correctness");

    await action("mock-confirm").click();
    const submit = app.getByRole("alertdialog", { name: "Nộp bài?" });
    await submit.getByText("Câu chưa trả lời được tính là sai, kể cả câu điểm liệt.").waitFor();
    assert.deepEqual((await submit.locator(".ntile b").allInnerTexts()), ["1", "29"], "answered and unanswered counts");
    await action("confirm-no").click();
    await submit.waitFor({ state: "detached" });
    await action("mock-confirm").click();
    await action("confirm-yes").click();
    await app.getByRole("heading", { name: "Kết quả" }).waitFor();
    await app.getByText("CHƯA ĐẠT", { exact: true }).waitFor();
    await app.getByText("Bỏ trống 29", { exact: false }).waitFor();

    await action("mock-entry").click();
    await action("mock-start").click();
    await app.locator("#timer").waitFor();
    await app.locator('input[name="answer"]').first().check();
    await app.getByText("Đã lưu lựa chọn.").waitFor();
    await app.getByRole("button", { name: "Thoát bài thi" }).click();
    const leave = app.getByRole("alertdialog", { name: "Thoát bài thi?" });
    await leave.getByRole("button", { name: "Tiếp tục thi" }).waitFor();
    await action("confirm-yes").click();
    await app.getByRole("heading", { name: "Đã dừng bài thi" }).waitFor();
    assert.deepEqual(dialogs, [], "the card never opens browser dialogs");
  } finally {
    await browser.close();
    server.close();
    rmSync(dir, { recursive: true, force: true });
  }
});
