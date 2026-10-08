import { cpSync, mkdirSync } from "node:fs";

mkdirSync("dist/src/ui", { recursive: true });
mkdirSync("dist/data", { recursive: true });
cpSync("data/question-bank.json", "dist/data/question-bank.json");
cpSync("data/images", "dist/data/images", { recursive: true });
cpSync("src/ui/quiz.html", "dist/src/ui/quiz.html");
cpSync("src/ui/preview.html", "dist/src/ui/preview.html");
cpSync("src/ui/learning.html", "dist/src/ui/learning.html");
cpSync("src/ui/learning-preview.html", "dist/src/ui/learning-preview.html");
cpSync("src/ui/assets", "dist/src/ui/assets", { recursive: true });
cpSync("src/content", "dist/src/content", { recursive: true });
