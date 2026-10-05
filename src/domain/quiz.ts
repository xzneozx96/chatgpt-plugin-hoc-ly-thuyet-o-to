import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";

export type AnswerId = "A" | "B" | "C" | "D";
const ANSWER_IDS: readonly AnswerId[] = ["A", "B", "C", "D"];
const questionSchema = z.object({
  id: z.number().int().positive(),
  text: z.string().min(1),
  imagePath: z.string().regex(/^images\/q\d+\.webp$/).nullable(),
  options: z.array(z.object({ key: z.number().int().min(1).max(4), text: z.string().min(1) })).min(2).max(4),
  correctKey: z.number().int().min(1).max(4),
  examCategory: z.string().min(1),
  explanation: z.string().min(1).nullable()
});
const bankSchema = z.object({ version: z.string(), questions: z.array(questionSchema).length(600) });
const sourcePath = process.env.VERCEL ? resolve("question-bank.json") : fileURLToPath(new URL("../../question-bank.json", import.meta.url));
const bank = bankSchema.parse(JSON.parse(readFileSync(sourcePath, "utf8")));

for (const question of bank.questions) {
  if (new Set(question.options.map((option) => option.key)).size !== question.options.length ||
      !question.options.some((option) => option.key === question.correctKey)) {
    throw new Error(`Invalid answer key in source question ${question.id}`);
  }
}
if (new Set(bank.questions.map((question) => question.id)).size !== bank.questions.length) {
  throw new Error("Duplicate question ID in source bank");
}

const imageFile = (imagePath: string) => process.env.VERCEL ? resolve(imagePath) : fileURLToPath(new URL(`../../${imagePath}`, import.meta.url));
const availableQuestions = bank.questions.filter((question) => !question.imagePath || existsSync(imageFile(question.imagePath)));

export interface PublicQuestion {
  id: string;
  topic: string;
  question: string;
  options: ReadonlyArray<{ id: AnswerId; text: string }>;
  imagePath: string | null;
}

function publicQuestion(question: (typeof bank.questions)[number]): PublicQuestion {
  return {
    id: `q${String(question.id).padStart(3, "0")}`,
    topic: question.examCategory,
    question: question.text,
    options: question.options.map((option) => ({ id: ANSWER_IDS[option.key - 1]!, text: option.text })),
    imagePath: question.imagePath
  };
}

export function getQuestion(afterQuestionId?: string, topic?: string): PublicQuestion {
  const pool = topic ? availableQuestions.filter((question) => question.examCategory === topic) : availableQuestions;
  if (pool.length === 0) throw new Error("TOPIC_NOT_FOUND");
  const index = afterQuestionId === undefined ? -1 : pool.findIndex((q) => publicQuestion(q).id === afterQuestionId);
  if (afterQuestionId !== undefined && index < 0) throw new Error("QUESTION_NOT_FOUND");
  const question = pool[(index + 1) % pool.length];
  if (!question) throw new Error("QUESTION_BANK_EMPTY");
  return publicQuestion(question);
}

export function getPreviousQuestion(beforeQuestionId: string, topic?: string): PublicQuestion {
  const pool = topic ? availableQuestions.filter((question) => question.examCategory === topic) : availableQuestions;
  if (pool.length === 0) throw new Error("TOPIC_NOT_FOUND");
  const index = pool.findIndex((question) => publicQuestion(question).id === beforeQuestionId);
  if (index < 0) throw new Error("QUESTION_NOT_FOUND");
  return publicQuestion(pool[(index - 1 + pool.length) % pool.length]!);
}

export function getQuestionById(questionId: string): PublicQuestion {
  const question = availableQuestions.find((item) => `q${String(item.id).padStart(3, "0")}` === questionId);
  if (!question) throw new Error("QUESTION_NOT_FOUND");
  return publicQuestion(question);
}

export interface AnswerResult {
  questionId: string;
  selectedAnswer: AnswerId;
  correct: boolean;
  correctAnswer: AnswerId;
  explanation: string;
  memoryTip: string;
}

export function submitAnswer(questionId: string, selectedAnswer: AnswerId): AnswerResult {
  const question = availableQuestions.find((q) => publicQuestion(q).id === questionId);
  if (!question) throw new Error("QUESTION_NOT_FOUND");
  const selectedKey = ANSWER_IDS.indexOf(selectedAnswer) + 1;
  if (!question.options.some((option) => option.key === selectedKey)) throw new Error("INVALID_ANSWER");
  return {
    questionId,
    selectedAnswer,
    correct: selectedKey === question.correctKey,
    correctAnswer: ANSWER_IDS[question.correctKey - 1]!,
    explanation: question.explanation ?? "Ngân hàng câu hỏi chưa có phần giải thích cho câu này.",
    memoryTip: ""
  };
}

export interface TheoryHit {
  questionId: string;
  topic: string;
  source: string;
  question: string;
  excerpt: string;
  score: number;
}

const normalize = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/đ/g, "d");

export function searchTheory(query: string, limit = 5): TheoryHit[] {
  const normalizedQuery = normalize(query).trim();
  const terms = [...new Set(normalizedQuery.match(/[a-z0-9]+/g) ?? [])].filter((term) => term.length > 1);
  if (terms.length === 0) return [];
  return availableQuestions.flatMap((item) => {
    const question = normalize(item.text);
    const explanation = normalize(item.explanation ?? "");
    const options = normalize(item.options.map((option) => option.text).join(" "));
    const matches = terms.filter((term) => question.includes(term) || explanation.includes(term) || options.includes(term));
    if (matches.length === 0) return [];
    const score = matches.reduce((total, term) => total + (question.includes(term) ? 3 : 0) + (explanation.includes(term) ? 2 : 0) + (options.includes(term) ? 1 : 0), 0)
      + (question.includes(normalizedQuery) ? 25 : 0) + (explanation.includes(normalizedQuery) ? 20 : 0);
    return [{
      questionId: `q${String(item.id).padStart(3, "0")}`,
      topic: item.examCategory,
      source: `question-bank.json#q${String(item.id).padStart(3, "0")}`,
      question: item.text,
      excerpt: item.explanation ?? item.text,
      score
    }];
  }).sort((a, b) => b.score - a.score || a.questionId.localeCompare(b.questionId)).slice(0, Math.max(1, Math.min(limit, 20)));
}

export const questionBankSummary = {
  version: bank.version,
  total: bank.questions.length,
  available: availableQuestions.length,
  missingImages: bank.questions.length - availableQuestions.length,
  missingExplanations: bank.questions.filter((question) => question.explanation === null).length
} as const;
