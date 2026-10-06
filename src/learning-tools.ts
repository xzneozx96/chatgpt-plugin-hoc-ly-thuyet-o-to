import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createLearner, courseView, listUnits, LearningCommandSchema, type mockView, type studyView } from "./domain/learning.js";
import { LearningRuntime } from "./domain/learning-runtime.js";
import { questionTeaching } from "./domain/teaching.js";

export interface LearningTool {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, z.ZodTypeAny>;
  readOnly: boolean;
  card: boolean;
  run(input: unknown): Promise<object>;
}

const cardCommands = new Set(["start_study", "resume_study", "next_study", "skip_study", "start_mock", "view_mock", "start_lightning"]);

const commands: Record<string, { name: string; title: string; description: string }> = {
  start_study: { name: "start_study", title: "Start a study session", description: "Use whenever the learner wants to study, learn, review or continue. Reopens the open daily session or starts one: all due reviews, then new questions within the daily goal. Explicit category or family requests may override review ordering while retaining due work. unitId accepts a bank category, a confusing-question group, or de_nham_lan for all confusing-question groups. Pass count for a specific number of questions, such as 5. Supply selected original question IDs to assemble a focused source-supported lesson." },
  answer_study: { name: "submit_study_answer", title: "Submit a learning answer", description: "Score the learner's actual choice against the bank, save it once, and return feedback. Bind session and question IDs to the current card. Missing confidence stays unknown. Never submit a guess for the learner." },
  next_study: { name: "next_study_question", title: "Continue the study session", description: "Continue after the current question's feedback. The saved queue determines the next question." },
  skip_study: { name: "skip_study_question", title: "Skip a study question", description: "Skip without scoring or covering the question. A skipped due review remains unresolved." },
  pause_study: { name: "pause_study", title: "Pause a study session", description: "Save a paused session without clearing its remaining reviews or recording answers." },
  resume_study: { name: "resume_study", title: "Resume a study session", description: "Resume a saved session and reconcile reviews now due. An explicit other activity may retain this paused session." },
  record_help: { name: "request_study_help", title: "Request source-backed teaching", description: "Record answer assistance before giving a hint or explanation for the active original question. Use its question ID and session ID. Explain only from the returned bank explanation; external knowledge and verified video timestamps are unavailable until configured." },
  set_confusion: { name: "set_question_confusion", title: "Update unresolved confusion", description: "Set a learner's explicit confusion flag, or clear it only on their confirmation. A correct answer does not clear it. Bring review within 24 hours without resetting learned status." },
  update_profile: { name: "update_profile", title: "Update the study plan", description: "Save the learner's goal, timezone, target date and study weekdays. Offer 10, 12, 15 or their custom number of new unique questions per study day. Reviews count separately." },
  start_mock: { name: "start_mock_test", title: "Start a timed mock test (thi thử)", description: "Start a new timed mock test (thi thử, practice exam): 30 random licence-B questions in 20 minutes. Answers remain provisional. Passing requires 27/30 and no wrong or unanswered critical question. Official library mode is unavailable until supplied. Honour an explicit test request while retaining due reviews. If a test is unfinished, this returns it with resumed=true and its saved choices: tell the learner they are continuing it, and offer a new test (abandon_mock_test, then start_mock_test)." },
  save_mock_choice: { name: "save_mock_choice", title: "Save a provisional test answer", description: "Save or replace a choice in an active test without revealing correctness or updating learning history. The server records its accepted time." },
  finalise_mock: { name: "finalise_mock_test", title: "Submit the mock test", description: "Finalise the test once and publish answered learning results atomically. Before early submission with unanswered items, obtain learner confirmation and pass confirmUnanswered=true. Expiry finalises automatically." },
  abandon_mock: { name: "abandon_mock_test", title: "Leave the mock test", description: "Abandon a running test only after the learner confirms leaving. Provisional answers never become scored learning evidence." },
  view_mock: { name: "get_mock_test", title: "Resume or inspect a mock test", description: "Retrieve an own saved test. The server finalises an expired attempt before returning its result." },
  start_lightning: { name: "start_lightning", title: "Start a lightning round (chớp nhoáng)", description: "Start a 60-second lightning round over up to 30 original questions the learner has already answered. Use only when the learner asks for one or taps it on the card. Every answer is a normal scored attempt: a wrong answer lapses the question and schedules its review, and a correct answer to a question that is not due is early practice. The card shows a counter and no explanations during the round. Answers after 60 seconds are rejected and not saved." }
};

export function createLearningTools(runtime: LearningRuntime | null, persistence: "local" | "authenticated" | "unavailable"): LearningTool[] {
  const decorate = (view: object) => ({ ...view, historyAvailable: runtime !== null, persistence, serverNow: Date.now() });
  const tools: LearningTool[] = [{
    name: "get_course", title: "Open the driving-theory course",
    description: "Show the course overview only when the learner asks about the course, their progress or goals. To study with saved history, call start_study; without saved history, practise with get_question. Returns category progress, daily goal, due reviews and saved activities. Distinguish first-pass coverage from qualifying delayed learning. If historyAvailable=false, disclose unavailable history rather than personalise.",
    inputSchema: {}, readOnly: true, card: true,
    async run() { return decorate(runtime ? await runtime.course() : courseView(createLearner(Date.now()), Date.now())); }
  }, {
    name: "list_units", title: "Find a course category or confusing group",
    description: "Browse the seven bank categories and the eighth custom category, Câu hỏi dễ nhầm lẫn. Search all 249 draft groups by title or original question ID. Request a bounded page. Draft family relationships are discovery metadata, not approved teaching.",
    inputSchema: { query: z.string().max(200).optional(), kind: z.enum(["category", "family"]).optional(), offset: z.number().int().min(0).optional(), limit: z.number().int().min(1).max(30).optional() }, readOnly: true, card: false,
    async run(raw) {
      const input = z.object(this.inputSchema).parse(raw);
      const query = typeof input.query === "string" ? input.query : "";
      const view = runtime ? await runtime.units(query) : listUnits(createLearner(Date.now()), query, Date.now());
      const filtered = view.units.filter(unit => !input.kind || unit.kind === input.kind);
      const offset = typeof input.offset === "number" ? input.offset : 0;
      const limit = typeof input.limit === "number" ? input.limit : 20;
      return decorate({ ...view, units: filtered.slice(offset, offset + limit), totalMatches: filtered.length, offset, nextOffset: offset + limit < filtered.length ? offset + limit : null });
    }
  }, {
    name: "get_study_session", title: "Inspect a saved study session",
    description: "Retrieve this learner's session by stable ID without inventing progress or clearing pending review.",
    inputSchema: { sessionId: z.string().uuid() }, readOnly: true, card: false,
    async run(raw) {
      if (!runtime) throw new Error("HISTORY_UNAVAILABLE");
      const { sessionId } = z.object({ sessionId: z.string().uuid() }).parse(raw);
      return decorate(await runtime.session(sessionId));
    }
  }];
  for (const schema of LearningCommandSchema.options) {
    const kind = schema.shape.kind.value;
    if (kind === "answer_question") continue;
    const definition = commands[kind];
    if (!definition) throw new Error(`UNREGISTERED_LEARNING_COMMAND:${kind}`);
    const inputSchema: Record<string, z.ZodTypeAny> = {};
    for (const [name, value] of Object.entries(schema.shape)) if (name !== "kind") inputSchema[name] = value;
    const requestId = z.string().uuid().describe("New UUID for each learner action. Reuse the same UUID and payload only to retry a lost response.");
    inputSchema.requestId = kind === "view_mock" ? requestId.optional() : requestId;
    tools.push({ ...definition, inputSchema, readOnly: false, card: cardCommands.has(kind),
      async run(raw) {
        if (!runtime) throw new Error("HISTORY_UNAVAILABLE");
        const input = z.object(inputSchema).parse(raw);
        const command = LearningCommandSchema.parse({ ...input, kind, requestId: input.requestId ?? randomUUID() });
        const view = await runtime.command(command);
        return decorate(command.kind === "record_help" ? { ...view, teaching: questionTeaching(command.questionId) } : view);
      }
    });
  }
  return runtime ? tools : tools.filter(tool => tool.name === "get_course" || tool.name === "list_units");
}

type ShownQuestion = Pick<NonNullable<ReturnType<typeof studyView>["question"]>, "id" | "question" | "options" | "imagePath">;

function questionBlock(question: ShownQuestion, origin: string) {
  return [
    `${question.id}: ${question.question}`,
    ...(question.imagePath ? [`Hình: ${origin}/images/${question.imagePath.split("/").at(-1)}`] : []),
    ...question.options.map(option => `${option.id}. ${option.text}`)
  ].join("\n");
}

function courseText(course: ReturnType<typeof courseView> & { historyAvailable?: boolean }) {
  const lines = [
    ...(course.historyAvailable === false ? ["Lịch sử học chưa khả dụng trên kết nối này; không có tiến độ nào được lưu."] : []),
    ...(course.nothingToStudy ? ["Không có buổi học mới: chưa có câu đến hạn ôn và đã đạt mục tiêu câu mới hôm nay. Gợi ý luyện theo chủ đề (start_study với unitId và count) hoặc thi thử."] : []),
    `Khóa học bằng B: đã thử ${course.covered}/${course.total} câu, đã nhớ ${course.learned}, đến hạn ôn ${course.dueCount}.`,
    `Mục tiêu ${course.dailyGoal} câu mới mỗi ngày; hôm nay đã học ${course.newToday} câu mới.`,
    `Kết quả: ${course.results.correctAttempts}/${course.results.totalAttempts} lượt đúng (${course.results.accuracyPercent}%).`,
    ...course.units.map(unit => `- ${unit.title} (${unit.id}): ${unit.covered}/${unit.questionCount} đã thử, ${unit.learned} đã nhớ`),
    `- ${course.customCategory.title} (${course.customCategory.id}): ${course.customCategory.covered}/${course.customCategory.total} đã thử, ${course.customCategory.familyCount} nhóm nháp`
  ];
  const open = course.sessions.filter(session => session.status !== "complete");
  if (open.length) lines.push(`Buổi học đang mở: ${open.map(session => `${session.id} (${session.status})`).join(", ")}.`);
  const running = course.mocks.filter(mock => mock.status === "active");
  if (running.length) lines.push(`Bài thi thử chưa nộp: ${running.map(mock => mock.id).join(", ")}.`);
  return lines.join("\n");
}

function mockText(mock: ReturnType<typeof mockView>, origin: string) {
  if (mock.status === "abandoned") return `Bài thi thử ${mock.attemptId} đã dừng; các lựa chọn không được chấm và không tính vào lịch sử học.`;
  if ("score" in mock) {
    const wrong = mock.results.filter(result => "correct" in result && !result.correct).map(result => result.questionId);
    const blank = mock.results.filter(result => "unanswered" in result).map(result => result.questionId);
    return [
      `Kết quả thi thử ${mock.attemptId}: ${mock.score}/30 · ${mock.passed ? "Đạt" : "Chưa đạt"} (cần 27/30 và không sai câu điểm liệt).`,
      `Sai: ${wrong.join(", ") || "không có"}. Bỏ trống: ${blank.join(", ") || "không có"}. Câu điểm liệt sai hoặc bỏ trống: ${mock.criticalFailures.join(", ") || "không có"}.`
    ].join("\n");
  }
  const seconds = Math.ceil(mock.remainingMs / 1000);
  return [
    `Bài thi thử ${mock.attemptId}${mock.resumed ? " (đang làm tiếp bài chưa nộp)" : ""} · còn ${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, "0")} · đã chọn ${mock.answeredCount}/30.`,
    "Do not reveal correctness before submission. If the learner sees the card, do not repeat the questions; otherwise show one question at a time exactly as written:",
    ...mock.questions.map((question, index) => `Câu ${index + 1}/30 · ${questionBlock(question, origin)}${mock.choices[question.id] ? `\nĐã chọn: ${mock.choices[question.id]?.answer}` : ""}`)
  ].join("\n\n");
}

function helpText(teaching: ReturnType<typeof questionTeaching>) {
  return [`Đã ghi nhận yêu cầu hỗ trợ cho ${teaching.questionId}; câu trả lời sau đó không được tính là tự nhớ.`, teaching.explanation ? `Giải thích từ ngân hàng: ${teaching.explanation}` : teaching.message].join("\n");
}

export function learningText(view: object, origin: string) {
  const kind = "kind" in view ? view.kind : null;
  const teaching = "teaching" in view ? view.teaching as ReturnType<typeof questionTeaching> : null;
  if (kind === "course") return courseText(view as ReturnType<typeof courseView>);
  if (kind === "help" && teaching) return helpText(teaching);
  if (kind === "mock") return mockText(view as ReturnType<typeof mockView>, origin);
  if (kind !== "study") return JSON.stringify(view);
  const study = view as ReturnType<typeof studyView>;
  const lines = [`Buổi học ${study.sessionId} · ${study.completed}/${study.total} câu đã xử lý · ${study.status}`, `Kết quả buổi này: ${study.sessionResults.correct}/${study.sessionResults.answered} đúng${study.sessionResults.wrong ? ` · sai: ${study.sessionResults.items.filter(item => !item.correct).map(item => item.questionId).join(", ")}` : ""}`];
  if (teaching) lines.push(helpText(teaching));
  if (study.currentFeedback) {
    const feedback = study.currentFeedback;
    lines.push(`Kết quả ${feedback.questionId}: ${feedback.correct ? "Đúng" : "Sai"}. Đáp án gốc: ${feedback.correctAnswer}.`, `Giải thích từ ngân hàng: ${feedback.explanation}`, "Call next_study_question for the next original question. Do not write a question yourself.");
  } else if (study.question) {
    lines.push("Original bank question. Show it to the learner exactly as written, with every option and the image link:", questionBlock(study.question, origin));
  } else lines.push(`Hoàn thành buổi học: ${study.sessionResults.correct}/${study.sessionResults.answered} câu đúng.`);
  return lines.join("\n");
}

const errorMessages: Record<string, string> = {
  HISTORY_UNAVAILABLE: "Lịch sử học tập chưa được bật cho kết nối này. Bạn vẫn có thể luyện câu hỏi không lưu. Cần kết nối tài khoản để ôn và tiếp tục qua nhiều cuộc trò chuyện.",
  LIBRARY_UNAVAILABLE: "Bộ đề chính thức chưa được cung cấp. Bạn có thể chọn đề ngẫu nhiên.",
  LEARNING_SAVE_CONFLICT: "Chưa lưu được vì có thay đổi đồng thời. Hãy thử lại với cùng mã yêu cầu.",
  UNIT_NOT_FOUND: "Không tìm thấy chủ đề hoặc nhóm này. Dùng list_units để lấy đúng mã chủ đề.",
  QUESTION_NOT_FOUND: "Không có câu hỏi này trong bộ 600 câu.",
  SESSION_NOT_FOUND: "Không tìm thấy buổi học này. Mở buổi học hôm nay bằng start_study.",
  SESSION_NOT_ACTIVE: "Buổi học đang tạm dừng hoặc đã xong. Tiếp tục bằng resume_study hoặc bắt đầu buổi mới.",
  QUESTION_BINDING_MISMATCH: "Câu này không phải câu đang mở trong buổi học. Hãy trả lời câu hiện tại.",
  QUESTION_NOT_PENDING: "Câu này đã được trả lời trong buổi học. Chuyển sang câu tiếp theo bằng next_study_question.",
  ANSWER_OR_SKIP_FIRST: "Hãy trả lời hoặc bỏ qua câu hiện tại trước khi sang câu tiếp theo.",
  INVALID_ANSWER: "Đáp án không hợp lệ cho câu này. Chọn một chữ cái có trong các lựa chọn.",
  REQUEST_CONFLICT: "Mã yêu cầu này đã dùng cho một thao tác khác. Hãy gửi lại với requestId mới.",
  MOCK_IN_PROGRESS: "Câu này đang nằm trong bài thi thử chưa nộp. Hãy nộp hoặc dừng bài thi trước.",
  MOCK_NOT_FOUND: "Không tìm thấy bài thi thử này.",
  MOCK_NOT_ACTIVE: "Bài thi thử này đã kết thúc nên không thể lưu thêm lựa chọn.",
  MOCK_ABANDONED: "Bài thi thử này đã dừng nên không thể nộp. Hãy bắt đầu bài mới.",
  CONFIRM_UNANSWERED: "Còn câu chưa trả lời. Hỏi người học xác nhận, rồi nộp lại với confirmUnanswered=true.",
  LIGHTNING_EXPIRED: "Đã hết 60 giây của lượt chớp nhoáng nên câu trả lời này không được ghi. Xem kết quả lượt hoặc bắt đầu lượt mới.",
  LIGHTNING_NEEDS_HISTORY: "Chưa có câu nào đã trả lời để chơi chớp nhoáng. Hãy học vài câu trước bằng start_study."
};

export function learningError(error: unknown) {
  const reason = error instanceof z.ZodError
    ? `Dữ liệu gửi lên không hợp lệ: ${error.issues.map(issue => issue.path.join(".") || "input").join(", ")}.`
    : error instanceof RangeError && /time zone/i.test(error.message)
      ? "Múi giờ không hợp lệ. Dùng tên múi giờ IANA, ví dụ Asia/Ho_Chi_Minh."
      : errorMessages[error instanceof Error ? error.message : ""] ?? `Chưa xử lý được yêu cầu học tập (${error instanceof Error ? error.message : "lỗi không xác định"}). Không có thay đổi nào được lưu.`;
  return { isError: true, content: [{ type: "text" as const, text: reason }] };
}
