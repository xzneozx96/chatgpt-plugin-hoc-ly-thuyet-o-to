import { createServer, type RequestListener } from "node:http";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { z } from "zod";
import { LearnerWorkspace } from "./domain/workspace.js";
import { AttemptStore } from "./persistence/attempts.js";

const UI_URI = "ui://ly-thuyet-lai-xe/quiz-v1.html";
const UI_MIME = "text/html;profile=mcp-app";
const htmlPath = process.env.VERCEL ? resolve("src/ui/quiz.html") : fileURLToPath(new URL("./ui/quiz.html", import.meta.url));
const previewPath = process.env.VERCEL ? resolve("src/ui/preview.html") : fileURLToPath(new URL("./ui/preview.html", import.meta.url));
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

export function createQuizServer(publicBaseUrl = "http://127.0.0.1:8787", workspace = new LearnerWorkspace(null), progressEnabled = false): McpServer {
  const baseUrl = new URL(publicBaseUrl);
  const server = new McpServer(
    { name: "ly-thuyet-lai-xe-tutor", version: "0.2.0" },
    { instructions: "For Vietnamese driving-theory practice, call get_question. Score only after the learner selects an answer through submit_answer. Use search_theory for source-backed explanations from question-bank.json only. Do not invent missing explanations. Progress tools are available in the private local trial." }
  );

  server.registerResource("quiz", UI_URI, { title: "Driving theory quiz", mimeType: UI_MIME }, async () => ({
    contents: [{
      uri: UI_URI,
      mimeType: UI_MIME,
      text: readFileSync(htmlPath, "utf8"),
      _meta: { ui: { csp: { connectDomains: [], resourceDomains: [baseUrl.origin] } } }
    }]
  }));

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
      annotations: { readOnlyHint: !progressEnabled, openWorldHint: false, destructiveHint: false, idempotentHint: false },
      _meta: { ui: { visibility: ["model", "app"] } }
    },
    async ({ questionId, selectedAnswer, attemptId }) => {
      try {
        const result = workspace.submitAnswer({ questionId, selectedAnswer, attemptId });
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

  if (progressEnabled) {
    server.registerTool("get_progress", {
      title: "Get learning progress",
      description: "Show the private local learner's attempt count, accuracy, practiced questions, and due reviews.",
      inputSchema: {},
      outputSchema: { totalQuestions: z.number(), practicedQuestions: z.number(), unseenQuestions: z.number(), totalAttempts: z.number(), correctAttempts: z.number(), accuracyPercent: z.number(), dueReviews: z.number() },
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false }
    }, async () => {
      const progress = workspace.getProgress();
      return { structuredContent: progress, content: [{ type: "text", text: JSON.stringify(progress) }] };
    });

    server.registerTool("get_due_reviews", {
      title: "Get due review questions",
      description: "List the private local learner's due review questions without answer keys.",
      inputSchema: { limit: z.number().int().min(1).max(50).optional() },
      outputSchema: { items: z.array(z.object({
        questionId: z.string(), attempts: z.number(), correctStreak: z.number(), mistakeCount: z.number(), dueAt: z.string(), lastAnsweredAt: z.string(),
        question: z.object(questionSchema)
      })) },
      annotations: { readOnlyHint: true, openWorldHint: false, destructiveHint: false }
    }, async ({ limit }) => {
      const items = workspace.getDueReviews(limit).map(({ question: sourceQuestion, ...state }) => {
        const { imagePath, ...question } = sourceQuestion;
        const imageUrl = imagePath ? new URL(`/images/${imagePath.split("/").at(-1)}`, baseUrl).toString() : null;
        return { ...state, question: { ...question, imageUrl } };
      });
      return { structuredContent: { items }, content: [{ type: "text", text: JSON.stringify(items) }] };
    });
  }
  return server;
}

export function createHttpHandler(options: { dataPath?: string; publicBaseUrl?: string; publicMode?: boolean } = {}) {
  const configuredBase = options.publicBaseUrl ?? process.env.PUBLIC_BASE_URL;
  const progressEnabled = !options.publicMode && (!configuredBase || new URL(configuredBase).hostname === "127.0.0.1");
  const store = progressEnabled ? new AttemptStore(options.dataPath ?? process.env.DATA_PATH ?? fileURLToPath(new URL("../.data/study.sqlite", import.meta.url))) : null;
  const workspace = new LearnerWorkspace(store);
  const handler: RequestListener = async (req, res) => {
    if (!req.url) return void res.writeHead(400).end("Missing URL");
    const path = new URL(req.url, `http://${req.headers.host ?? "localhost"}`).pathname;
    const publicBaseUrl = configuredBase ?? `${options.publicMode ? "https" : "http"}://${req.headers.host ?? "localhost"}`;
    if (path === "/" && req.method === "GET") return void res.writeHead(200).end("Lý Thuyết Lái Xe Tutor MCP server");
    if (req.method === "GET" && /^\/images\/q\d+\.webp$/.test(path)) {
      try {
        const image = readFileSync(`${imagesPath}/${path.split("/").at(-1)}`);
        return void res.writeHead(200, { "Content-Type": "image/webp", "Access-Control-Allow-Origin": "*" }).end(image);
      } catch {
        return void res.writeHead(404).end("Image not found");
      }
    }
    if (progressEnabled && path === "/preview" && req.method === "GET") {
      return void res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }).end(readFileSync(previewPath));
    }
    if (!progressEnabled && path === "/play" && req.method === "GET") {
      return void res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }).end(readFileSync(previewPath));
    }
    if (path === "/ui/quiz.html" && req.method === "GET") {
      return void res.writeHead(200, { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store" }).end(readFileSync(htmlPath));
    }
    if (((progressEnabled && path === "/preview/tool") || (!progressEnabled && path === "/play/tool")) && req.method === "POST") {
      try {
        let body = "";
        for await (const chunk of req) {
          body += String(chunk);
          if (body.length > 8192) throw new Error("REQUEST_TOO_LARGE");
        }
        const request = z.object({ name: z.string(), arguments: z.record(z.unknown()).default({}) }).parse(JSON.parse(body));
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
        "Access-Control-Allow-Headers": "content-type, mcp-session-id",
        "Access-Control-Expose-Headers": "Mcp-Session-Id"
      }).end();
    }
    if (path !== "/mcp" || !["POST", "GET", "DELETE"].includes(req.method ?? "")) return void res.writeHead(404).end("Not Found");
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Expose-Headers", "Mcp-Session-Id");
    const server = createQuizServer(publicBaseUrl, workspace, progressEnabled);
    const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined, enableJsonResponse: true });
    res.on("close", () => { void transport.close(); void server.close(); });
    try {
      await server.connect(transport);
      await transport.handleRequest(req, res);
    } catch (error) {
      console.error("MCP request failed", error);
      if (!res.headersSent) res.writeHead(500).end("Internal server error");
    }
  };
  return { handler, close: () => store?.close(), progressEnabled };
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
