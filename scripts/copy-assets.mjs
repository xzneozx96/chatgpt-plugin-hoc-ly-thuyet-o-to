import { cpSync, mkdirSync } from "node:fs";

mkdirSync("dist/src/ui", { recursive: true });
cpSync("question-bank.json", "dist/question-bank.json");
cpSync("images", "dist/images", { recursive: true });
cpSync("src/ui/quiz.html", "dist/src/ui/quiz.html");
cpSync("src/ui/preview.html", "dist/src/ui/preview.html");
