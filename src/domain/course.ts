import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { z } from "zod";
import { getQuestionById } from "./quiz.js";
const metadataSchema = z.object({
    version: z.string(),
    questions: z.array(z.object({
        id: z.number(),
        chapterId: z.number(),
        examCategory: z.string(),
        isCritical: z.boolean(),
        applicableLicenses: z.array(z.string()),
        explanation: z.string().nullable()
    }))
});
const bank = metadataSchema.parse(JSON.parse(readFileSync(process.env.VERCEL ? resolve("question-bank.json") : fileURLToPath(new URL("../../question-bank.json", import.meta.url)), "utf8")));
export const familySchema = z.object({
    id: z.string(),
    title: z.string(),
    questionIds: z.array(z.string()),
    comparisonAxes: z.array(z.string()),
    requiresVisualReview: z.boolean(),
    status: z.literal("draft_bank_analysis")
});
export const families = z.array(familySchema).parse(JSON.parse(readFileSync(process.env.VERCEL ? resolve("src/content/question-families.json") : fileURLToPath(new URL("../content/question-families.json", import.meta.url)), "utf8")));
export const bankVersion = bank.version;
export const bankQuestions = bank.questions.map(q => ({
    ...q,
    questionId: `q${String(q.id).padStart(3, "0")}`
}));
export const categories = [...new Set(bankQuestions.map(q => q.examCategory))];
export function safeQuestion(id: string) {
    const metadata = bankQuestions.find(q => q.questionId === id);
    if (!metadata)
        throw new Error("QUESTION_NOT_FOUND");
    return {
        ...getQuestionById(id),
        critical: metadata.isCritical,
        chapterId: metadata.chapterId,
        applicableLicenses: metadata.applicableLicenses,
        sourceId: `question-bank.json#${id}`,
        bankVersion
    };
}
export const CONFUSING_CATEGORY_ID = "de_nham_lan";
export function unitQuestions(unitId?: string) {
    if (!unitId)
        return bankQuestions.filter(q => q.applicableLicenses.includes("B")).map(q => q.questionId);
    if (unitId === CONFUSING_CATEGORY_ID)
        return [...new Set(families.flatMap(f => f.questionIds))];
    const family = families.find(f => f.id === unitId);
    if (family)
        return [...new Set(family.questionIds)];
    if (categories.includes(unitId))
        return bankQuestions.filter(q => q.examCategory === unitId && q.applicableLicenses.includes("B")).map(q => q.questionId);
    throw new Error("UNIT_NOT_FOUND");
}
export const categoryTitles: Record<string, string> = {
    quy_tac: "Quy \u0111\u1ECBnh chung v\u00E0 quy t\u1EAFc giao th\u00F4ng",
    diem_liet: "C\u00E2u h\u1ECFi \u0111i\u1EC3m li\u1EC7t",
    van_hoa: "V\u0103n h\u00F3a giao th\u00F4ng v\u00E0 \u0111\u1EA1o \u0111\u1EE9c ng\u01B0\u1EDDi l\u00E1i xe",
    ky_thuat: "K\u1EF9 thu\u1EADt l\u00E1i xe",
    cau_tao: "C\u1EA5u t\u1EA1o v\u00E0 s\u1EEDa ch\u1EEFa",
    bien_bao: "B\u00E1o hi\u1EC7u \u0111\u01B0\u1EDDng b\u1ED9",
    sa_hinh: "Sa h\u00ECnh v\u00E0 x\u1EED l\u00FD t\u00ECnh hu\u1ED1ng"
};
