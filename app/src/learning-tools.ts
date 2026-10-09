import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createLearner, courseView, listUnits, LearningCommandSchema, type LessonMeta, type mockView, type studyView, type todayMistakes } from "./domain/learning.js";
import { LearningRuntime } from "./domain/learning-runtime.js";
import { questionTeaching } from "./domain/teaching.js";
import type { leagueView } from "./domain/league.js";

export interface LearningTool {
  name: string;
  title: string;
  description: string;
  inputSchema: Record<string, z.ZodTypeAny>;
  readOnly: boolean;
  card: boolean;
  run(input: unknown): Promise<object>;
}

const cardCommands = new Set(["start_study", "resume_study", "next_study", "skip_study", "start_mock", "view_mock", "start_lightning", "join_league", "leave_league", "set_league_hidden"]);
const leagueCommands = new Set(["join_league", "leave_league", "set_league_hidden"]);

const commands: Record<string, { name: string; title: string; description: string }> = {
  start_study: { name: "start_study", title: "Start a study session", description: "Use whenever the learner wants to study, learn, review or continue. With no arguments it reopens the latest open session, or starts the daily one: due reviews first, then the next never-answered questions in bank order up to the daily goal. Once reviews are done and the goal is met, pass count alone (10, 12 or 15) for that many more never-answered questions. With unitId (a bank category, a confusing-question group, or de_nham_lan) and count it studies never-answered questions of that topic; if fewer remain it takes all of them. Add practice=true to study already-answered questions of a finished topic; practice adds no new coverage. While reviews are due, unitId and count fail with REVIEWS_DUE: run reviewOnly=true first. Supply selected original question IDs to assemble a focused source-supported lesson." },
  answer_study: { name: "submit_study_answer", title: "Submit a learning answer", description: "Score the learner's actual choice against the bank, save it once, and return feedback. Bind session and question IDs to the current card. Missing confidence stays unknown. Never submit a guess for the learner. The study card calls this itself and shows the only verdict: while a card is live, never call it for a typed answer and never restate, confirm or contradict its verdict; ask the learner in one line to tap their choice on the card. Call it yourself only in text-only use (no card), then show the verdict and call next_study_question." },
  next_study: { name: "next_study_question", title: "Continue or revisit a study question", description: "Continue after the current question's feedback. The saved queue determines the next question. The study card calls this itself from its Tiếp tục button, so never call it while a card is live. Header progress buttons may pass questionId and repair=true for an already answered lesson item; this revisits saved feedback without scoring it again. In text-only use (no card), call it after showing the verdict." },
  skip_study: { name: "skip_study_question", title: "Skip a study question", description: "Skip without scoring or covering the question. A skipped due review remains unresolved." },
  pause_study: { name: "pause_study", title: "Pause a study session", description: "Save a paused session without clearing its remaining reviews or recording answers." },
  resume_study: { name: "resume_study", title: "Resume a study session", description: "Resume a saved session and reconcile reviews now due. An explicit other activity may retain this paused session." },
  record_help: { name: "request_study_help", title: "Request source-backed teaching", description: "Record answer assistance before giving a hint or explanation for the active original question. Use its question ID and session ID. Explain only from the returned bank explanation; external knowledge and verified video timestamps are unavailable until configured." },
  update_profile: { name: "update_profile", title: "Update the study plan", description: "Save the learner's goal, timezone, target date and study weekdays. Offer 10, 12, 15 or their custom number of new unique questions per study day. Reviews count separately." },
  start_mock: { name: "start_mock_test", title: "Start a timed mock test (thi thử)", description: "Start a new timed mock test (thi thử, practice exam): 30 random licence-B questions in 20 minutes. Answers remain provisional. Passing requires 27/30 and no wrong or unanswered critical question. Official library mode is unavailable until supplied. Honour an explicit test request while retaining due reviews. If a test is unfinished, this returns it with resumed=true and its saved choices: tell the learner they are continuing it, and offer a new test (abandon_mock_test, then start_mock_test)." },
  save_mock_choice: { name: "save_mock_choice", title: "Save a provisional test answer", description: "Save or replace a choice in an active test without revealing correctness or updating learning history. The server records its accepted time." },
  finalise_mock: { name: "finalise_mock_test", title: "Submit the mock test", description: "Finalise the test once and publish answered learning results atomically. Before early submission with unanswered items, obtain learner confirmation and pass confirmUnanswered=true. Expiry finalises automatically." },
  abandon_mock: { name: "abandon_mock_test", title: "Leave the mock test", description: "Abandon a running test only after the learner confirms leaving. Provisional answers never become scored learning evidence." },
  view_mock: { name: "get_mock_test", title: "Resume or inspect a mock test", description: "Retrieve an own saved test. The server finalises an expired attempt before returning its result." },
  start_lightning: { name: "start_lightning", title: "Start a lightning round (chớp nhoáng)", description: "Start a 60-second lightning round over up to 30 original questions the learner has already answered. Use only when the learner asks for one or taps it on the card. Every answer is a normal scored attempt: a wrong answer lapses the question and schedules its review, and a correct answer to a question that is not due is early practice. The card shows a counter and no explanations during the round. Answers after 60 seconds are rejected and not saved." },
  join_league: { name: "join_league", title: "Join the weekly league", description: "Join the opt-in weekly league, or change the display name, only when the learner asks, using the display name they chose: 3–20 letters, digits, spaces, dots, underscores or hyphens. Never use their account or ChatGPT name. Requires one finished lesson. Boards show only display name, rank and weekly XP; answers, accuracy, weak areas and exam dates are never shared. Returns the league board." },
  leave_league: { name: "leave_league", title: "Leave the weekly league", description: "Leave the weekly league when the learner asks. Their display name leaves every board at once; study history is unaffected. Returns the league view." },
  set_league_hidden: { name: "set_league_hidden", title: "Hide from the league board", description: "Hide the learner from other members' league boards (hidden=true) or show them again (hidden=false), when the learner asks. They still see their own rank. Returns the league board." }
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
    description: "Browse the seven bank categories and the eighth custom category, Câu hỏi dễ nhầm lẫn. Search the approved confusing-question groups by title or original question ID. Request a bounded page. Each group names the conditions that tell its questions apart; teach from the bank explanations of its questions.",
    inputSchema: { query: z.string().max(200).optional(), kind: z.enum(["category", "family"]).optional(), offset: z.number().int().min(0).optional(), limit: z.number().int().min(1).max(300).optional() }, readOnly: true, card: false,
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
    name: "get_today_mistakes", title: "Review today's wrong answers",
    description: "List the questions the learner answered wrong today (learner timezone), each once with the choice they made, the bank's correct answer and the bank explanation, newest first. Read-only: records no help and no attempt, so redoing these questions is left to their scheduled review. Use when the learner asks which questions they got wrong today.",
    inputSchema: {}, readOnly: true, card: true,
    async run() {
      if (!runtime) throw new Error("HISTORY_UNAVAILABLE");
      return decorate(await runtime.mistakes());
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
    if (kind === "answer_question" || kind === "set_confusion") continue;
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
        if (leagueCommands.has(command.kind)) return decorate(await runtime.league());
        return decorate(command.kind === "record_help" ? { ...view, teaching: questionTeaching(command.questionId) } : view);
      }
    });
  }
  tools.push({
    name: "get_league", title: "Show the weekly league",
    description: "Show the learner's weekly league board when they ask about the league or their rank: rank, display name and weekly XP for their cohort of up to 30 members, Monday to Sunday Vietnam time. Leagues are opt-in and pseudonymous and never share learning data. If joined=false and canJoin=true, the learner may be invited once to join with a display name they choose.",
    inputSchema: {}, readOnly: true, card: true,
    async run() {
      if (!runtime) throw new Error("HISTORY_UNAVAILABLE");
      return decorate(await runtime.league());
    }
  });
  // The study card marks its own calls, so their text tells ChatGPT the card is showing the result (see cardText).
  for (const tool of tools) tool.inputSchema = { ...tool.inputSchema, caller: callerSchema };
  return runtime ? tools : tools.filter(tool => tool.name === "get_course" || tool.name === "list_units");
}

const callerSchema = z.literal("card").optional().describe("Set only by the study card for its own calls. Never set it yourself.");

/** True when the study card made this call; its result is already on screen. */
export function calledByCard(input: unknown) {
  return typeof input === "object" && input !== null && "caller" in input && input.caller === "card";
}

/** A learning tool's MCP result. Lesson answer keys and award hints ride in _meta, which reaches the card but never the model. */
export function learningResult(result: object, origin: string, input: unknown, toolMs: number) {
  const { lessonMeta, ...view } = result as { lessonMeta?: LessonMeta };
  return {
    _meta: { timing: { toolMs }, ...lessonMeta },
    structuredContent: { ...view },
    content: [{ type: "text" as const, text: learningText(view, origin, calledByCard(input)) }]
  };
}

type ShownQuestion = Pick<NonNullable<ReturnType<typeof studyView>["question"]>, "id" | "question" | "options" | "imagePath">;

function questionBlock(question: ShownQuestion, origin: string) {
  return [
    `${question.id}: ${question.question}`,
    ...(question.imagePath ? [`Hình: ${origin}/images/${question.imagePath.split("/").at(-1)}`] : []),
    ...question.options.map(option => `${option.id}. ${option.text}`)
  ].join("\n");
}

// The learner's local clock time and date, for "23:55 ngày 6/10".
function localTime(at: number, timeZone: string) {
  const format = (options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("vi-VN", { ...options, timeZone }).format(at);
  return `${format({ hour: "2-digit", minute: "2-digit", hourCycle: "h23" })} ngày ${format({ day: "numeric", month: "numeric" })}`;
}

// The same labels as the card: Đã gặp, Đã thuộc (never including the questions waiting for their review), Cần ôn hôm nay, Sai hôm nay.
function courseText(course: ReturnType<typeof courseView> & { historyAvailable?: boolean; serverNow?: number }) {
  const now = course.serverNow ?? Date.now();
  const nextLearn = course.nextLearnAt === null ? "ôn lại khi đến hạn để thuộc" : course.nextLearnAt <= now ? "có câu đã đến hạn, ôn ngay để thuộc" : `sớm nhất ôn lại lúc ${localTime(course.nextLearnAt, course.profile.timezone)}`;
  const lines = [
    ...(course.historyAvailable === false ? ["Lịch sử học chưa khả dụng trên kết nối này; không có tiến độ nào được lưu."] : []),
    ...(course.nothingToStudy ? ["Không có buổi học mới: chưa có câu đến hạn ôn và đã đạt mục tiêu câu mới hôm nay. Gợi ý học thêm (start_study với count 10, 12 hoặc 15, hoặc unitId và count) hoặc thi thử."] : []),
    `Khóa học bằng B: Đã gặp ${course.covered}/${course.total} · Đã thuộc ${course.learned}/${course.total} · Cần ôn hôm nay ${course.dueCount} · Sai hôm nay ${course.wrongToday}.`,
    ...(course.onTheWay > 0 ? [`Đang trong lịch ôn: ${course.onTheWay} câu cần ôn (sau 1, 3, 7, 14 ngày) mới tính vào Đã thuộc; ${nextLearn}.`] : []),
    `Mục tiêu ${course.dailyGoal} câu mới mỗi ngày; hôm nay đã học ${course.newToday} câu mới.`,
    `Kết quả: ${course.results.correctAttempts}/${course.results.totalAttempts} lượt đúng (${course.results.accuracyPercent}%).`,
    ...course.units.map(unit => `- ${unit.title} (${unit.id}): Đã gặp ${unit.covered}/${unit.questionCount}, Đã thuộc ${unit.learned}`),
    `- ${course.customCategory.title} (${course.customCategory.id}): Đã gặp ${course.customCategory.covered}/${course.customCategory.total}, Đã thuộc ${course.customCategory.learned}, ${course.customCategory.familyCount} nhóm`
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

function leagueText(league: ReturnType<typeof leagueView>) {
  if (!league.joined) return league.canJoin ? "Người học chưa tham gia nhóm thi đua tuần. Có thể mời tham gia một lần bằng tên hiển thị do họ tự chọn (join_league)." : "Người học chưa tham gia nhóm thi đua tuần; cần hoàn thành một bài học trước khi tham gia.";
  return [
    `Nhóm thi đua tuần · còn ${league.daysLeft} ngày · ${league.displayName}${league.hidden ? " (đang ẩn với người khác)" : ""}`,
    ...league.rows.map(row => `${row.rank ?? "–"}. ${row.displayName}${row.you ? " (bạn)" : ""}: ${row.weekXp} XP`)
  ].join("\n");
}

// A compare-the-pair step reports both verdicts together, after both answers, as the card does.
function pairLines(study: ReturnType<typeof studyView>, pair: NonNullable<ReturnType<typeof studyView>["pair"]>, origin: string) {
  const verdicts = pair.feedback.flatMap(feedback => feedback ? [feedback] : []);
  if (verdicts.length === pair.questions.length) return [
    ...verdicts.flatMap(feedback => [`Kết quả ${feedback.questionId}: ${feedback.correct ? "Đúng" : "Sai"}. Đáp án gốc: ${feedback.correctAnswer}.`, `Giải thích từ ngân hàng: ${feedback.explanation}`]),
    `Hai câu dễ nhầm thuộc nhóm "${pair.title}". Khía cạnh so sánh của nhóm: ${pair.axes.join("; ")}.`,
    "Call next_study_question for the next original question. Do not write a question yourself."
  ];
  const answered = new Set(study.queue.filter(item => item.group === pair.group && item.status === "answered").map(item => item.questionId));
  return [
    "Compare-the-pair step: two original questions from one confusing-question family. The learner answers both before either result is shown. Submit each answer with submit_study_answer; do not judge an answer or call next_study_question until both are submitted.",
    ...pair.questions.map(question => answered.has(question.id)
      ? `${question.id}: đã trả lời; kết quả hiện cùng câu còn lại.`
      : `Original bank question. Show it to the learner exactly as written, with every option and the image link:\n${questionBlock(question, origin)}`)
  ];
}

const CARD_SILENT = "The card shows this to the learner and handles the next step itself. Stay silent: do not repeat, judge or continue it, and call no tool unless the learner asks in chat.";

// A call the card made needs no instructions to show anything; the full text below is for text-only use.
function cardText(view: object) {
  const kind = "kind" in view ? view.kind : null;
  const teaching = "teaching" in view ? view.teaching as ReturnType<typeof questionTeaching> : null;
  if (kind === "study") {
    const study = view as ReturnType<typeof studyView>;
    const lines = [`Thẻ học đang hiển thị ${study.mode === "lightning" ? "lượt chớp nhoáng" : "buổi học"} ${study.sessionId} · ${study.completed}/${study.total} câu đã xử lý · ${study.status}${study.question ? ` · câu đang mở ${study.question.id}` : ""}.`, CARD_SILENT];
    if (teaching) lines.push(helpText(teaching), "The card posts the learner's request next; answer that message only, from this bank explanation.");
    return lines.join("\n");
  }
  if (kind === "help" && teaching) return [helpText(teaching), "The card posts the learner's request next; answer that message only."].join("\n");
  if (kind === "mock") {
    const mock = view as ReturnType<typeof mockView>;
    if (mock.status === "abandoned") return `Thẻ đang hiển thị bài thi thử ${mock.attemptId} đã dừng. ${CARD_SILENT}`;
    if ("score" in mock) return `Thẻ đang hiển thị kết quả thi thử ${mock.attemptId}: ${mock.score}/30 · ${mock.passed ? "Đạt" : "Chưa đạt"}. ${CARD_SILENT}`;
    return `Thẻ thi thử đang hiển thị bài ${mock.attemptId} · đã chọn ${mock.answeredCount}/30. Never reveal correctness before submission. ${CARD_SILENT}`;
  }
  if (kind === "mistakes") return `Thẻ đang hiển thị ${(view as { items: unknown[] }).items.length} câu sai hôm nay để xem lại. ${CARD_SILENT}`;
  const screen = kind === "league" ? "nhóm thi đua tuần" : kind === "units" ? "danh sách chủ đề và nhóm" : "trang chính của khóa học";
  return `Thẻ đang hiển thị ${screen}. ${CARD_SILENT}`;
}

function mistakesText({ items }: { items: ReturnType<typeof todayMistakes> }) {
  if (!items.length) return "Hôm nay chưa có câu sai.";
  return [`Câu sai hôm nay (${items.length}), chỉ để xem lại; câu sẽ quay lại theo lịch ôn:`, ...items.map(item => `${item.question.id}: bạn chọn ${item.chosen}, đáp án gốc ${item.correctAnswer}. ${item.explanation ? `Giải thích từ ngân hàng: ${item.explanation}` : "Ngân hàng chưa có giải thích cho câu này."}`)].join("\n");
}

export function learningText(view: object, origin: string, card = false) {
  if (card) return cardText(view);
  const kind = "kind" in view ? view.kind : null;
  const teaching = "teaching" in view ? view.teaching as ReturnType<typeof questionTeaching> : null;
  if (kind === "course") return courseText(view as ReturnType<typeof courseView>);
  if (kind === "help" && teaching) return helpText(teaching);
  if (kind === "mock") return mockText(view as ReturnType<typeof mockView>, origin);
  if (kind === "league") return leagueText(view as ReturnType<typeof leagueView>);
  if (kind === "mistakes") return mistakesText(view as { items: ReturnType<typeof todayMistakes> });
  if (kind !== "study") return JSON.stringify(view);
  const study = view as ReturnType<typeof studyView>;
  const lines = [`Buổi học ${study.sessionId} · ${study.completed}/${study.total} câu đã xử lý · ${study.status}`, `Kết quả buổi này: ${study.sessionResults.correct}/${study.sessionResults.answered} đúng${study.sessionResults.wrong ? ` · sai: ${study.sessionResults.items.filter(item => !item.correct).map(item => item.questionId).join(", ")}` : ""}`];
  if (teaching) lines.push(helpText(teaching));
  if (study.pair) lines.push(...pairLines(study, study.pair, origin));
  else if (study.currentFeedback) {
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
  REVIEWS_DUE: "Còn câu đến hạn ôn. Hãy ôn xong rồi mới học câu mới hoặc chọn chủ đề.",
  ANSWER_OR_SKIP_FIRST: "Hãy trả lời hoặc bỏ qua câu hiện tại trước khi sang câu tiếp theo.",
  QUESTION_NOT_IN_SESSION: "Câu này không nằm trong buổi học hiện tại.",
  PAIR_INCOMPLETE: "Hãy hoàn thành cả hai câu trong thử thách so sánh trước khi xem lại câu này.",
  QUESTION_NAVIGATION_NOT_AVAILABLE: "Có thể xem lại câu bằng thanh tiến độ trong bài học thường; lượt chớp nhoáng cần đi theo thứ tự.",
  INVALID_ANSWER: "Đáp án không hợp lệ cho câu này. Chọn một chữ cái có trong các lựa chọn.",
  REQUEST_CONFLICT: "Mã yêu cầu này đã dùng cho một thao tác khác. Hãy gửi lại với requestId mới.",
  MOCK_IN_PROGRESS: "Câu này đang nằm trong bài thi thử chưa nộp. Hãy nộp hoặc dừng bài thi trước.",
  MOCK_NOT_FOUND: "Không tìm thấy bài thi thử này.",
  MOCK_NOT_ACTIVE: "Bài thi thử này đã kết thúc nên không thể lưu thêm lựa chọn.",
  MOCK_ABANDONED: "Bài thi thử này đã dừng nên không thể nộp. Hãy bắt đầu bài mới.",
  CONFIRM_UNANSWERED: "Còn câu chưa trả lời. Hỏi người học xác nhận, rồi nộp lại với confirmUnanswered=true.",
  LIGHTNING_EXPIRED: "Đã hết 60 giây của lượt chớp nhoáng nên câu trả lời này không được ghi. Xem kết quả lượt hoặc bắt đầu lượt mới.",
  LIGHTNING_NEEDS_HISTORY: "Chưa có câu nào đã trả lời để chơi chớp nhoáng. Hãy học vài câu trước bằng start_study.",
  LEAGUE_NEEDS_LESSON: "Hãy hoàn thành ít nhất một bài học trước khi tham gia nhóm thi đua tuần.",
  LEAGUE_NAME_INVALID: "Tên hiển thị cần 3–20 ký tự, gồm chữ cái, chữ số, khoảng trắng hoặc . _ -",
  LEAGUE_NAME_REJECTED: "Tên hiển thị này không phù hợp. Hãy chọn một tên khác.",
  LEAGUE_NOT_JOINED: "Bạn chưa tham gia nhóm thi đua tuần."
};

export function learningError(error: unknown, withCode = true) {
  const code = error instanceof z.ZodError ? "INVALID_INPUT" : error instanceof Error && error.message in errorMessages ? error.message : "UNKNOWN";
  const reason = error instanceof z.ZodError
    ? `Dữ liệu gửi lên không hợp lệ: ${error.issues.map(issue => issue.path.join(".") || "input").join(", ")}.`
    : error instanceof RangeError && /time zone/i.test(error.message)
      ? "Múi giờ không hợp lệ. Dùng tên múi giờ IANA, ví dụ Asia/Ho_Chi_Minh."
      : errorMessages[error instanceof Error ? error.message : ""] ?? `Chưa xử lý được yêu cầu học tập (${error instanceof Error ? error.message : "lỗi không xác định"}). Không có thay đổi nào được lưu.`;
  // The code lets the card word its own message; the text is for ChatGPT and may name tools.
  const content = [{ type: "text" as const, text: reason }];
  return withCode ? { isError: true, structuredContent: { kind: "error", code }, content } : { isError: true, content };
}
