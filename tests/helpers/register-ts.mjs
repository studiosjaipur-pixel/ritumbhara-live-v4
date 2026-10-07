// Test-only module hook: lets Node's built-in TypeScript type stripping load the project's .ts files.
// - relative imports without an extension ("./config") resolve to ".ts" files
// - the "@/..." path alias from tsconfig.json resolves to the repository root
// Usage: node --import ./tests/helpers/register-ts.mjs --test "tests/**/*.test.mjs"
import { register } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import path from "node:path";

const root = pathToFileURL(path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..") + "/").href;

const hook = `
const ROOT = ${JSON.stringify(root)};
export async function resolve(specifier, context, next) {
  if (specifier.startsWith("@/")) specifier = new URL(specifier.slice(2), ROOT).href;
  const local = specifier.startsWith("./") || specifier.startsWith("../") || specifier.startsWith("file:");
  if (local && !/\\.[cm]?[jt]sx?$/.test(specifier)) {
    try { return await next(specifier + ".ts", context); } catch {}
  }
  return next(specifier, context);
}`;
register("data:text/javascript," + encodeURIComponent(hook));
