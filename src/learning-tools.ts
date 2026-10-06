import { randomUUID } from "node:crypto";
import { z } from "zod";
import { createLearner, courseView, listUnits, LearningCommandSchema } from "./domain/learning.js";
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

const cardCommands = new Set(["start_study", "resume_study", "start_mock", "view_mock"]);

const commands: Record<string, { name: string; title: string; description: string }> = {
  start_study: { name: "start_study", title: "Start a study session", description: "Start all due reviews then new questions within the daily goal. Explicit category or family requests may override review ordering while retaining due work. Supply selected original question IDs to assemble a focused source-supported lesson; duplicates and learned new items are filtered by the server." },
  answer_study: { name: "submit_study_answer", title: "Submit a learning answer", description: "Score the learner's actual choice against the bank, save it once, and return feedback. Bind session and question IDs to the current card. Missing confidence stays unknown. Never submit a guess for the learner." },
  next_study: { name: "next_study_question", title: "Continue the study session", description: "Continue after the current question's feedback. The saved queue determines the next question." },
  skip_study: { name: "skip_study_question", title: "Skip a study question", description: "Skip without scoring or covering the question. A skipped due review remains unresolved." },
  pause_study: { name: "pause_study", title: "Pause a study session", description: "Save a paused session without clearing its remaining reviews or recording answers." },
  resume_study: { name: "resume_study", title: "Resume a study session", description: "Resume a saved session and reconcile reviews now due. An explicit other activity may retain this paused session." },
  record_help: { name: "request_study_help", title: "Request source-backed teaching", description: "Record answer assistance before supplying an explanation or contextual ChatGPT coaching. Use the active original question ID and session ID. Bank excerpts are the available evidence; external knowledge and verified video timestamps are unavailable until configured." },
  set_confusion: { name: "set_question_confusion", title: "Update unresolved confusion", description: "Set a learner's explicit confusion flag, or clear it only on their confirmation. A correct answer does not clear it. Bring review within24 hours without resetting learned status." },
  update_profile: { name: "update_profile", title: "Update the study plan", description: "Save the learner's goal, timezone, target date and study weekdays. Offer10,12,15 or their custom number of new unique questions per study day. Reviews count separately." },
  start_mock: { name: "start_mock_test", title: "Start a timed mock test", description: "Start a30-question20-minute random licence-B practice test. Answers remain provisional. Passing requires27/30 and no wrong or unanswered critical question. Official library mode is unavailable until supplied. Honour an explicit test request while retaining due reviews." },
  save_mock_choice: { name: "save_mock_choice", title: "Save a provisional test answer", description: "Save or replace a choice in an active test without revealing correctness or updating learning history. The server records its accepted time." },
  finalise_mock: { name: "finalise_mock_test", title: "Submit the mock test", description: "Finalise the test once and publish answered learning results atomically. Before early submission with unanswered items, obtain learner confirmation and pass confirmUnanswered=true. Expiry finalises automatically." },
  abandon_mock: { name: "abandon_mock_test", title: "Leave the mock test", description: "Abandon a running test only after the learner confirms leaving. Provisional answers never become scored learning evidence." },
  view_mock: { name: "get_mock_test", title: "Resume or inspect a mock test", description: "Retrieve an own saved test. The server finalises an expired attempt before returning its result." }
};

export function createLearningTools(runtime: LearningRuntime | null, persistence: "local" | "authenticated" | "unavailable"): LearningTool[] {
  const decorate = (view: object) => ({ ...view, historyAvailable: runtime !== null, persistence, serverNow: Date.now() });
  const tools: LearningTool[] = [{
    name: "get_course", title: "Open the driving-theory course",
    description: "Open the course overview, category progress, daily goal, due reviews and saved activities. Distinguish first-pass coverage from qualifying delayed learning. If historyAvailable=false, disclose unavailable history rather than personalise.",
    inputSchema: {}, readOnly: true, card: true,
    async run() { return decorate(runtime ? await runtime.course() : courseView(createLearner(Date.now()), Date.now())); }
  }, {
    name: "list_units", title: "Find a course category or confusing group",
    description: "Browse the seven bank categories and the eighth custom category, Câu hỏi dễ nhầm lẫn. Search all249 draft groups by title or original question ID. Request a bounded page. Draft family relationships are discovery metadata, not approved teaching.",
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

export function learningError(error: unknown) {
  const reason = error instanceof Error ? error.message : "LEARNING_REQUEST_FAILED";
  const messages: Record<string, string> = {
    HISTORY_UNAVAILABLE: "Lịch sử học tập chưa được bật cho kết nối này. Bạn vẫn có thể luyện câu hỏi không lưu. Cần kết nối tài khoản và kho lưu trữ để ôn và tiếp tục qua nhiều cuộc trò chuyện.",
    LIBRARY_UNAVAILABLE: "Bộ đề chính thức chưa được cung cấp. Bạn có thể chọn đề ngẫu nhiên.",
    LEARNING_SAVE_CONFLICT: "Chưa lưu được vì có thay đổi đồng thời. Hãy thử lại với cùng mã yêu cầu."
  };
  return { isError: true, content: [{ type: "text" as const, text: messages[reason] ?? `Chưa xử lý được yêu cầu học tập (${reason}). Không ghi nhận hoàn thành nếu chưa lưu thành công.` }] };
}
