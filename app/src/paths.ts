import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const deployedRoots = [process.cwd(), resolve(process.cwd(), "app"), appRoot];

export const appFile = (relativePath: string): string => {
  if (!process.env.VERCEL) return resolve(appRoot, relativePath);
  return deployedRoots.map((root) => resolve(root, relativePath)).find(existsSync) ?? resolve(relativePath);
};
