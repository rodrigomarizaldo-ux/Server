import path from "node:path";
import { fileURLToPath } from "node:url";
import { rm, mkdir } from "node:fs/promises";
import { execSync } from "node:child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const distDir = path.resolve(__dirname, "dist");

async function main() {
  await rm(distDir, { recursive: true, force: true });
  await mkdir(distDir, { recursive: true });

  execSync("pnpm exec tsc -p tsconfig.json", {
    cwd: __dirname,
    stdio: "inherit",
    env: process.env,
  });

  console.log("Build concluído com sucesso.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});