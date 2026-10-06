import { randomUUID } from "node:crypto";
import { createServer, type RequestListener } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { AuthenticatedLearnerWorkspace, LearnerWorkspace, type UserAttemptStore } from "./domain/workspace.js";
import { AttemptStore } from "./persistence/attempts.js";
import { authenticateBearer, createAuthKitVerifier, readAuthKitConfig, type TokenVerifier } from "./auth/authkit.js";
import { createRemoteAttemptStore } from "./persistence/remote-attempts.js";
import { LearningRuntime } from "./domain/learning-runtime.js";
import { createLearningTools, learningError } from "./learning-tools.js";
import { createRemoteLearningStore, SqliteLearningStore, type LearningStore } from "./persistence/learning-store.js";

const UI_URI = "ui://ly-thuyet-lai-xe/quiz-v1.html";
const UI_MIME = "text/html;profile=mcp-app";
const LEARNING_UI_URI = "ui://ly-thuyet-lai-xe/learning-v2.html";
const htmlPath = process.env.VERCEL ? resolve("src/ui/quiz.html") : fileURLToPath(new URL("./ui/quiz.html", import.meta.url));
const previewPath = process.env.VERCEL ? resolve("src/ui/preview.html") : fileURLToPath(new URL("./ui/preview.html", import.meta.url));
const learningHtmlPath = process.env.VERCEL ? resolve("src/ui/learning.html") : fileURLToPath(new URL("./ui/learning.html", import.meta.url));
const learningPreviewPath = process.env.VERCEL ? resolve("src/ui/learning-preview.html") : fileURLToPath(new URL("./ui/learning-preview.html", import.meta.url));
const assetsPath = process.env.VERCEL ? resolve("src/ui/assets") : fileURLToPath(new URL("./ui/assets/", import.meta.url));
const imagesPath = process.env.VERCEL ? resolve("images") : fileURLToPath(new URL("../images/", import.meta.url));
const questionSchema = {
  id: z.string(),
  topic: z.string(),
  question: z.string(),
  options: z.array(z.object({ id: z.enum(["A", "B", "C", "D"]), text: z.string() })),
  imageUrl: z.string().nullable()
};
const answerSchema = {
  questionId: z.string(),
  selectedAnswer: z.enum(["A", "B", "C", "D"]),
  correct: z.boolean(),
  correctAnswer: z.enum(["A", "B", "C", "D"]),
  explanation: z.string(),
  memoryTip: z.string(),
  attemptId: z.string(),
  duplicate: z.boolean(),
  nextReviewAt: z.string().nullable()
};

export function createQuizServer(publicBaseUrl = "http://127.0.0.1:8787", workspace = new LearnerWorkspace(null), progressEnabled = false, authenticatedWorkspace?: AuthenticatedLearnerWorkspace, learningRuntime: LearningRuntime | null = null): McpServer {
  const baseUrl = new URL(publicBaseUrl);
  const server = new McpServer(
    { name: "ly-thuyet-lai-xe-tutor", version: "0.3.0" },
    { instructions: learningRuntime ? `Open get_course first for Vietnamese driving-theory learning, licence B. Explain coverage and learned recall separately. Default sessions handle ALL due reviews before new questions, even if longer than15–20 minutes. Honour explicit lesson/category/family/test requests while retaining outstanding review. Use list_units for bounded discovery; follow original categories and offer3 relevant confusing-group suggestions. Groups are draft discovery relationships, not verified teaching. Assemble purposeful lessons from selected original IDs, saved history and bank evidence: name the distinction, elicit an attempt, show supported conditions/comparison, check a related original question, then recap evidence and review dates. Score only the learner's actual choice through submit_study_answer or submit_answer. Never infer correctness or learned status. Do not reveal answers before an attempt unless requested. Call request_study_help to record assistance before giving hints, explanations or video help. Use bank excerpts and source references only; external knowledge and verified video timestamps are not connected. Report missing explanations explicitly. Let learners choose10,12,15 or custom daily NEW unique questions; reviews are separate. Conversational replies remain useful without a card. Bind every action to its session and question; generated teaching exercises never count as bank answers. Start tests only on learner request. Confirm early submission with unanswered items or abandonment. If historyAvailable=false, disclose unsaved practice and unavailable personalisation. Never claim remembered history, videos watched, source retrieval or full readiness without evidence.` : `Vietnamese driving-theory practice, licence B. This connection saves no learner history. Tell the learner that progress, daily goals, review schedules, study sessions and mock tests are unavailable here, and never claim saved or remembered progress. get_course and list_units show the course structure only. Practise with get_question; score only the learner's actual choice through submit_answer. Do not reveal answers before an attempt unless requested. Use search_theory for explanations from question-bank.json only. Report missing explanations explicitly. External knowledge and verified video timestamps are not connected. Do not invent them.` }
  );

  server.registerResource("quiz", UI_URI, { title: "Driving theory quiz", mimeType: UI_MIME }, async () => ({
    contents: [{
      uri: UI_URI,
      mimeType: UI_MIME,
      text: readFileSync(htmlPath, "utf8"),
      _meta: { ui: { csp: { connectDomains: [], resourceDomains: [baseUrl.origin] } } }
    }]
  }));

  server.registerResource("learning", LEARNING_UI_URI, { title: "Lý Thuyết Lái Xe · Đường học", mimeType: UI_MIME }, async () => ({
    contents: [{ uri: LEARNING_UI_URI, mimeType: UI_MIME, text: readFileSync(learningHtmlPath, "utf8").replaceAll("{{BASE_URL}}", baseUrl.origin),
      _meta: { ui: { csp: { connectDomains: [], resourceDomains: [baseUrl.origin] } } } }]
  }));
  for (const tool of createLearningTools(learningRuntime, learningRuntime ? authenticatedWorkspace ? "authenticated" : "local" : "unavailable")) {
    server.registerTool(tool.name, {
      title: tool.title, description: tool.description, inputSchema: tool.inputSchema,
      annotations: { readOnlyHint: tool.readOnly, destructiveHint: false, openWorldHint: false },
      _meta: { ui: { ...(tool.card ? { resourceUri: LEARNING_UI_URI } : {}), visibility: ["model", "app"] } }
    }, async (input) => {
      try {
        const view = await tool.run(input);
        return { structuredContent: { ...view }, content: [{ type: "text", text: JSON.stringify(view) }] };
      } catch (error) { return learningError(error); }
    });
  }

  server.registerTool(
    "get_question",
    {
      title: "Get driving-theory question",
      description: "Get a Vietnamese driving-theory question by ID, after a known ID, or by topic. Topics: quy_tac, diem_liet, van_hoa, ky_thuat, cau_tao, bien_bao, sa_hinh. Returns 2 to 4 options and an image URL without the answer key.",
      inputSchema: { questionId: z.string().optional(), afterQuestionId: z.string().optional(), beforeQuestionId: z.string().optional(), topic: z.string().optional() },
      outputSchema: questionSchema,
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false },
      _meta: { ui: { resourceUri: UI_URI } }
    },
    async ({ questionId, afterQuestionId, beforeQuestionId, topic }) => {
      try {
        const { imagePath, ...question } = workspace.getQuestion({ questionId, afterQuestionId, beforeQuestionId, topic });
        const imageUrl = imagePath ? new URL(`/images/${imagePath.split("/").at(-1)}`, baseUrl).toString() : null;
        return {
          structuredContent: { ...question, imageUrl },
          content: [{ type: "text", text: `${question.question}\n${question.options.map((o) => `${o.id}. ${o.text}`).join("\n")}${imageUrl ? `\nHình: ${imageUrl}` : ""}` }]
        };
      } catch {
        return { isError: true, content: [{ type: "text", text: "Không tìm thấy câu hỏi hoặc chủ đề." }] };
      }
    }
  );

  server.registerTool(
    "submit_answer",
    {
      title: "Check driving-theory answer",
      description: "Deterministically score an A/B/C/D answer for a question ID and return the correct answer with explanation. Call only after the learner chooses an answer.",
      inputSchema: { questionId: z.string().min(1), selectedAnswer: z.enum(["A", "B", "C", "D"]), attemptId: z.string().uuid().optional() },
      outputSchema: answerSchema,
      annotations: { readOnlyHint: !progressEnabled && !authenticatedWorkspace, openWorldHint: false, destructiveHint: false, idempotentHint: false },
      _meta: { ui: { visibility: ["model", "app"] } }
    },
    async ({ questionId, selectedAnswer, attemptId = randomUUID() }) => {
      try {
        await learningRuntime?.command({ kind: "answer_question", requestId: attemptId, questionId, answer: selectedAnswer });
        const result = await (authenticatedWorkspace ?? workspace).submitAnswer({ questionId, selectedAnswer, attemptId });
        return {
          structuredContent: { ...result },
          content: [{ type: "text", text: `${result.correct ? "Đúng" : "Chưa đúng"}. Đáp án đúng: ${result.correctAnswer}. ${result.explanation}${result.memoryTip ? ` Mẹo nhớ: ${result.memoryTip}` : ""}` }]
        };
      } catch {
        return { isError: true, content: [{ type: "text", text: "Mã câu hỏi hoặc đáp án không hợp lệ." }] };
      }
    }
  );

  server.registerTool("search_theory", {
    title: "Search driving-theory source",
    description: "Search only the authoritative 600-question JSON bank. Returns source question IDs and excerpts. If no results match, say the bank does not cover the query.",
    inputSchema: { query: z.string().trim().min(2).max(200), limit: z.number().int().min(1).max(20).optional() },
    outputSchema: { hits: z.array(z.object({ questionId: z.string(), topic: z.string(), source: z.string(), question: z.string(), excerpt: z.string(), score: z.number() })) },
    annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false }
  }, async ({ query, limit }) => {
    const hits = workspace.searchTheory(query, limit);
    return { structuredContent: { hits }, content: [{ type: "text", text: hits.length ? hits.map((hit) => `${hit.source}: ${hit.question}\n${hit.excerpt}`).join("\n\n") : "Ngân hàng câu hỏi không có nội dung phù hợp." }] };
  });

  if (progressEnabled || authenticatedWorkspace) {
    server.registerTool("get_progress", {
      title: "Get learning progress",
      description: "Show this learner's attempt count, accuracy, practiced questions, and due reviews.",
      inputSchema: {},
      outputSchema: { totalQuestions: z.number(), practicedQuestions: z.number(), unseenQuestions: z.number(), totalAttempts: z.number(), correctAttempts: z.number(), accuracyPercent: z.number(), dueReviews: z.number() },
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false }
    }, async () => {
      const progress = await (authenticatedWorkspace ?? workspace).getProgress();
      return { structuredContent: progress, content: [{ type: "text", text: JSON.stringify(progress) }] };
    });

    server.registerTool("get_due_reviews", {
      title: "Get due review questions",
      description: "List this learner's due review questions without answer keys.",
      inputSchema: { limit: z.number().int().min(1).max(50).optional() },
      outputSchema: { items: z.array(z.object({
        questionId: z.string(), attempts: z.number(), correctStreak: z.number(), mistakeCount: z.number(), dueAt: z.string(), lastAnsweredAt: z.string(),
        question: z.object(questionSchema)
      })) },
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false }
    }, async ({ limit }) => {
      const items = (await (authenticatedWorkspace ?? workspace).getDueReviews(limit)).map(({ question: sourceQuestion, ...state }) => {
        const { imagePath, ...question } = sourceQuestion;
        const imageUrl = imagePath ? new URL(`/images/${imagePath.split("/").at(-1)}`, baseUrl).toString() : null;
        return { ...state, question: { ...question, imageUrl } };
      });
      return { structuredContent: { items }, content: [{ type: "text", text: JSON.stringify(items) }] };
    });
  }
  if (authenticatedWorkspace) {
    server.registerTool("delete_my_progress", {
      title: "Delete my learning progress",
      description: "Permanently delete all of your saved answer attempts and review history. This cannot be undone. Set confirm to true only after the learner explicitly asks to delete their progress.",
      inputSchema: { confirm: z.literal(true) },
      outputSchema: { deletedAttempts: z.number(), deletedLearnerHistory: z.boolean() },
      annotations: { readOnlyHint: false, openWorldHint: false, destructiveHint: true, idempotentHint: true }
    }, async () => {
      const deletedAttempts = await authenticatedWorkspace.deleteProgress();
      const deletedLearnerHistory = await learningRuntime?.delete() ?? false;
      return { structuredContent: { deletedAttempts, deletedLearnerHistory }, content: [{ type: "text", text: `Deleted ${deletedAttempts} saved attempts${deletedLearnerHistory ? " and the saved course history" : ""}.` }] };
    });
  }
  return server;
}

export function createHttpHandler(options: {
  dataPath?: string;
  publicBaseUrl?: string;
  publicMode?: boolean;
  authConfig?: ReturnType<typeof readAuthKitConfig>;
  verifier?: TokenVerifier;
  remoteStore?: UserAttemptStore;
  learningStore?: LearningStore;
} = {}) {
  let authConfig: ReturnType<typeof readAuthKitConfig>;
  let authConfigurationError = false;
  try { authConfig = options.authConfig === undefined ? readAuthKitConfig() : options.authConfig; }
  catch (error) {
    authConfig = null; authConfigurationError = true;
    console.error(`Authentication configuration rejected: ${error instanceof Error ? error.message : "unknown error"}`);
  }
  const configuredBase = authConfig?.publicBaseUrl ?? options.publicBaseUrl ?? process.env.PUBLIC_BASE_URL;
  const progressEnabled = !options.publicMode && (!configuredBase || new URL(configuredBase).hostname === "127.0.0.1");
  const store = progressEnabled ? new AttemptStore(options.dataPath ?? process.env.DATA_PATH ?? fileURLToPath(new URL("../.data/study.sqlite", import.meta.url))) : null;
  const workspace = new LearnerWorkspace(store);
  const localLearningStore = progressEnabled && !options.learningStore ? new SqliteLearningStore(options.dataPath ?? process.env.DATA_PATH ?? fileURLToPath(new URL("../.data/study.sqlite", import.meta.url))) : null;
  const learningStore = options.learningStore ?? localLearningStore ?? (authConfig ? createRemoteLearningStore(authConfig.databaseUrl) : null);
  const localLearningRuntime = progressEnabled && learningStore ? new LearningRuntime(learningStore, "local-development") : null;
  const verifier = authConfig ? options.verifier ?? createAuthKitVerifier(authConfig) : null;
  let remoteStore: UserAttemptStore | null = null;
  if (authConfig && verifier) remoteStore = options.remoteStore ?? createRemoteAttemptStore(authConfig.databaseUrl);
  const handler: RequestListener = async (req, res) => {
    if (!req.url) return void res.writeHead(400).end("Missing URL");
    const path = new URL(req.url, `http://${req.headers.host ?? "localhost"}`).pathname;
    const requestHost = req.headers.host ?? "localhost";
    const localHost = ["localhost", "127.0.0.1"].includes(new URL(`http://${requestHost}`).hostname);
    const publicBaseUrl = configuredBase ?? `${options.publicMode && !localHost ? "https" : "http"}://${requestHost}`;
    if (path === "/" && req.method === "GET") return void res.writeHead(200).end("Lý Thuyết Lái Xe Tutor MCP server");
    if (path === "/.well-known/oauth-protected-resource/mcp" && req.method === "GET") {
      if (!authConfig || authConfigurationError) return void res.writeHead(404).end("Not Found");
      return void res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "public, max-age=300" }).end(JSON.stringify({
        resource: `${authConfig.publicBaseUrl}/mcp`,
        authorization_servers: [authConfig.issuer],
        bearer_methods_supported: ["header"],
        scopes_supported: ["openid"]
      }));
    }
    if (req.method === "GET" && /^\/images\/q\d+\.webp$/.test(path)) {
      try {
        const image = readFileSync(`${imagesPath}/${path.split("/").at(-1)}`);
        return void res.writeHead(200, { "Content-Type": "image/webp", "Access-Control-Allow-Origin": "*" }).end(image);
      } catch {
        return void res.writeHead(404).end("Image not found");
      }
    }
    if (path.startsWith("/ui/assets/") && req.method === "GET") {
      const file = path.slice("/ui/assets/".length);
      if (!/^[A-Za-z0-9_-]+\.(ttf|woff2|txt)$/.test(file)) return void res.writeHead(404).end("Not Found");
      try { return void res.writeHead(200, { "Content-Type": file.endsWith(".woff2") ? "font/woff2" : file.endsWith(".ttf") ? "font/ttf" : "text/plain", "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=86400" }).end(readFileSync(resolve(assetsPath, file))); }
      catch { return void res.writeHead(404).end("Not Found"); }
    }
    if (path === "/ui/learning.html" && req.method === "GET") {
      return void res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }).end(readFileSync(learningHtmlPath, "utf8").replaceAll("{{BASE_URL}}", publicBaseUrl));
    }
    if (progressEnabled && path === "/preview" && req.method === "GET") {
      const legacy = new URL(req.url, publicBaseUrl).searchParams.has("legacy");
      return void res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }).end(readFileSync(legacy ? previewPath : learningPreviewPath));
    }
    if (!progressEnabled && path === "/play" && req.method === "GET") {
      const legacy = new URL(req.url, publicBaseUrl).searchParams.has("legacy");
      return void res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }).end(readFileSync(legacy ? previewPath : learningPreviewPath));
    }
    if (path === "/ui/quiz.html" && req.method === "GET") {
      return void res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }).end(readFileSync(htmlPath));
    }
    if (((progressEnabled && path === "/preview/tool") || (!progressEnabled && path === "/play/tool")) && req.method === "POST") {
      try {
        const parsedBody = (req as typeof req & { body?: unknown }).body;
        let body = "";
        for await (const chunk of req) {
          body += String(chunk);
          if (body.length > 8192) throw new Error("REQUEST_TOO_LARGE");
        }
        const request = z.object({ name: z.string(), arguments: z.record(z.unknown()).default({}) }).parse(parsedBody ?? JSON.parse(body));
        const learningTool = createLearningTools(localLearningRuntime, localLearningRuntime ? "local" : "unavailable").find(tool => tool.name === request.name);
        if (learningTool) {
          try {
            const view = await learningTool.run(request.arguments);
            return void res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify({ structuredContent: view, content: [{ type: "text", text: JSON.stringify(view) }] }));
          } catch (error) { return void res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify(learningError(error))); }
        }
        const baseUrl = new URL(publicBaseUrl);
        let result: object;
        if (request.name === "get_question") {
          const input = z.object({ questionId: z.string().optional(), afterQuestionId: z.string().optional(), beforeQuestionId: z.string().optional(), topic: z.string().optional() }).parse(request.arguments);
          const { imagePath, ...question } = workspace.getQuestion(input);
          result = { ...question, imageUrl: imagePath ? new URL(`/images/${imagePath.split("/").at(-1)}`, baseUrl).toString() : null };
        } else if (request.name === "submit_answer") {
          const input = z.object({ questionId: z.string(), selectedAnswer: z.enum(["A", "B", "C", "D"]), attemptId: z.string().uuid().optional() }).parse(request.arguments);
          result = workspace.submitAnswer(input);
        } else if (progressEnabled && request.name === "get_progress") result = workspace.getProgress();
        else if (progressEnabled && request.name === "get_due_reviews") {
          const input = z.object({ limit: z.number().int().min(1).max(50).optional() }).parse(request.arguments);
          result = { items: workspace.getDueReviews(input.limit).map(({ question: sourceQuestion, ...state }) => {
            const { imagePath, ...question } = sourceQuestion;
            return { ...state, question: { ...question, imageUrl: imagePath ? new URL(`/images/${imagePath.split("/").at(-1)}`, baseUrl).toString() : null } };
          }) };
        } else if (request.name === "search_theory") {
          const input = z.object({ query: z.string().trim().min(2).max(200), limit: z.number().int().min(1).max(20).optional() }).parse(request.arguments);
          result = { hits: workspace.searchTheory(input.query, input.limit) };
        } else throw new Error("UNKNOWN_TOOL");
        return void res.writeHead(200, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" }).end(JSON.stringify({ structuredContent: result }));
      } catch {
        return void res.writeHead(400, { "Content-Type": "application/json; charset=utf-8" }).end(JSON.stringify({ isError: true, content: [{ type: "text", text: "Không thể xử lý yêu cầu." }] }));
      }
    }
    if (path === "/mcp" && req.method === "OPTIONS") {
      return void res.writeHead(204, {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, GET, DELETE, OPTIONS",
        "Access-Control-Allow-Headers": "authorization, content-type, mcp-session-id",
        "Access-Control-Expose-Headers": "Mcp-Session-Id"
      }).end();
    }
    if (path !== "/mcp" || !["POST", "GET", "DELETE"].includes(req.method ?? "")) return void res.writeHead(404).end("Not Found");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
    if (authConfigurationError) return void res.writeHead(503, { "Cache-Control": "no-store" }).end("Authentication configuration incomplete");
    let authenticatedWorkspace: AuthenticatedLearnerWorkspace | undefined;
    let learningRuntime = localLearningRuntime;
    if (authConfig && verifier && remoteStore) {
      try {
        const userId = await authenticateBearer(req.headers.authorization, verifier);
        authenticatedWorkspace = new AuthenticatedLearnerWorkspace(userId, remoteStore);
        learningRuntime = learningStore ? new LearningRuntime(learningStore, userId) : null;
      } catch {
        return void res.writeHead(401, {
          "WWW-Authenticate": `Bearer resource_metadata="${authConfig.publicBaseUrl}/.well-known/oauth-protected-resource/mcp"`,
          "Cache-Control": "no-store"
        }).end("Unauthorized");
      }
    }
    const server = createQuizServer(publicBaseUrl, workspace, progressEnabled, authenticatedWorkspace, learningRuntime);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => { void transport.close(); void server.close(); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res, (req as typeof req & { body?: unknown }).body);
    } catch (error) {
      console.error("MCP request failed", error);
      if (!res.headersSent) res.writeHead(500).end("Internal server error");
    }
  };
  return { handler, close: () => { store?.close(); localLearningStore?.close(); }, progressEnabled };
}

export function startHttpServer(port = Number(process.env.PORT ?? 8787), options: { dataPath?: string; publicBaseUrl?: string } = {}) {
  const app = createHttpHandler(options);
  const httpServer = createServer(app.handler);
  httpServer.on("close", app.close);
  const host = process.env.HOST ?? (app.progressEnabled ? "127.0.0.1" : "0.0.0.0");
  httpServer.listen(port, host, () => {
    const address = httpServer.address();
    const actualPort = typeof address === "object" && address ? address.port : port;
    console.log(`MCP server listening on http://${host}:${actualPort}/mcp`);
    if (app.progressEnabled) console.log(`Local preview at http://127.0.0.1:${actualPort}/preview`);
  });
  return httpServer;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) startHttpServer();
