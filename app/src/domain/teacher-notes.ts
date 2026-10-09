import { readFileSync } from "node:fs";
import { z } from "zod";
import { appFile } from "../paths.js";

const bookMapSchema = z.object({
  docId: z.string(),
  questionPages: z.record(z.string(), z.number().int().positive()),
  videos: z.record(z.string(), z.object({ title: z.string(), youtubeId: z.string() }))
});
const bookMap = bookMapSchema.parse(JSON.parse(readFileSync(appFile("src/content/aegis-book-map.json"), "utf8")));

export interface TeacherQuote {
  text: string;
  timestamp: string;
  url: string;
}

export interface VideoSegment {
  videoCode: string;
  videoTitle: string;
  start: string;
  end: string;
  url: string;
}

export interface TeacherNote {
  questionId: string;
  bookQuestion: number;
  bookPage: number;
  quotes: TeacherQuote[];
  summary: string | null;
  relatedTip: string | null;
  segments: VideoSegment[];
  sourceNote: string | null;
}

export type FetchPages = (docId: string, pages: string) => Promise<{ page: number; text: string }[]>;

const PAGE_FOOTER = /\n*Sách học lý thuyết lái xe ô tô\s*\n+\s*\d+\s*$/;
const TIME = String.raw`(?:\d+:)?\d{1,2}:\d{2}`;

const toSeconds = (timestamp: string) => timestamp.split(":").map(Number).reduce((total, part) => total * 60 + part, 0);

function youtubeUrl(videoCode: string, timestamp: string): string | null {
  const video = bookMap.videos[videoCode];
  return video ? `https://www.youtube.com/watch?v=${video.youtubeId}&t=${toSeconds(timestamp)}s` : null;
}

function line(section: string, label: string): string | null {
  return new RegExp(`^${label}: (.+)$`, "m").exec(section)?.[1]?.trim() ?? null;
}

export function parseTeacherNote(questionNumber: number, pages: { page: number; text: string }[]): TeacherNote | null {
  const text = pages.map((page) => page.text.replace(PAGE_FOOTER, "")).join("\n\n");
  const heading = new RegExp(`^## Câu ${questionNumber}(?:\\s|$)`, "m").exec(text);
  if (!heading) return null;
  const rest = text.slice(heading.index + heading[0].length);
  const next = /^## Câu \d+(?:\s|$)/m.exec(rest);
  const section = next ? rest.slice(0, next.index) : rest;

  const quotes = [...section.matchAll(new RegExp(String.raw`“([^”]+)”\s*—\s*\[(V\d+)\s+(${TIME})\]`, "g"))].flatMap((match): TeacherQuote[] => {
    const url = youtubeUrl(match[2]!, match[3]!);
    return url ? [{ text: match[1]!.trim(), timestamp: `${match[2]} ${match[3]}`, url }] : [];
  });
  const segments = (line(section, "Nguồn") ?? "").split(";").flatMap((part): VideoSegment[] => {
    const match = new RegExp(String.raw`^\s*(V\d+)\s+(${TIME})–(${TIME})`).exec(part);
    const video = match && bookMap.videos[match[1]!];
    const url = match && youtubeUrl(match[1]!, match[2]!);
    return match && video && url ? [{ videoCode: match[1]!, videoTitle: video.title, start: match[2]!, end: match[3]!, url }] : [];
  });

  return {
    questionId: `q${String(questionNumber).padStart(3, "0")}`,
    bookQuestion: questionNumber,
    bookPage: bookMap.questionPages[String(questionNumber)] ?? pages[0]?.page ?? 0,
    quotes,
    summary: line(section, "Tóm tắt"),
    relatedTip: line(section, "Mẹo liên quan"),
    segments,
    sourceNote: line(section, "Ghi chú nguồn")
  };
}

export class TeacherNotes {
  private readonly cache = new Map<number, TeacherNote | null>();

  constructor(private readonly fetchPages: FetchPages) {}

  async forQuestion(questionNumber: number): Promise<TeacherNote | null> {
    if (this.cache.has(questionNumber)) return this.cache.get(questionNumber) ?? null;
    const first = bookMap.questionPages[String(questionNumber)];
    if (!first) throw new Error("QUESTION_NOT_FOUND");
    const last = bookMap.questionPages[String(questionNumber + 1)] ?? first;
    const note = parseTeacherNote(questionNumber, await this.fetchPages(bookMap.docId, first === last ? String(first) : `${first}-${last}`));
    this.cache.set(questionNumber, note);
    return note;
  }
}

export function aegisFetchPages(url: string, token: string, timeoutMs = 15_000): FetchPages {
  return async (docId, pages) => {
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json, text/event-stream" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "get_page_content", arguments: { doc_id: docId, pages } } }),
      signal: AbortSignal.timeout(timeoutMs)
    });
    if (!response.ok) throw new Error(`TEACHING_SOURCE_HTTP_${response.status}`);
    const body = z.object({ result: z.object({ isError: z.boolean().optional(), content: z.array(z.object({ text: z.string() })).min(1) }) }).parse(await response.json());
    if (body.result.isError) throw new Error("TEACHING_SOURCE_ERROR");
    const raw = body.result.content[0]!.text;
    const payload = z.object({ content: z.array(z.object({ page: z.number(), text: z.string() })) }).parse(JSON.parse(raw.slice(raw.indexOf("{"), raw.lastIndexOf("}") + 1)));
    return payload.content;
  };
}

export function teacherNotesFromEnv(env: NodeJS.ProcessEnv = process.env): TeacherNotes | null {
  const token = env.AEGIS_MCP_TOKEN;
  if (!token) return null;
  return new TeacherNotes(aegisFetchPages(env.AEGIS_MCP_URL ?? "https://aegis-api.minastik.com/mcp-apps/", token));
}
