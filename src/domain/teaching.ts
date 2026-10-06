import { getQuestionById, questionBankSummary, submitAnswer } from "./quiz.js";

export function questionTeaching(questionId: string) {
  const question = getQuestionById(questionId);
  const first = question.options[0];
  if (!first) throw new Error("QUESTION_NOT_FOUND");
  const scored = submitAnswer(questionId, first.id);
  const missing = scored.explanation === "Ngân hàng câu hỏi chưa có phần giải thích cho câu này.";
  return {
    questionId,
    bankVersion: questionBankSummary.version,
    status: missing ? "unavailable" : "bank_supplied",
    explanation: missing ? null : scored.explanation,
    source: `question-bank.json#${questionId}`,
    externalKnowledgeBase: "not_configured",
    videos: [],
    message: missing
      ? "Nguồn chưa có giải thích cho câu này. Kho kiến thức bổ sung chưa được kết nối."
      : "Giải thích từ ngân hàng do chủ ứng dụng cung cấp. Kho kiến thức và video bổ sung chưa được kết nối."
  };
}
