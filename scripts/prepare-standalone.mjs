// Complete Next's standalone output without bundling local environment files.
import { cp, mkdir, readdir, unlink } from "node:fs/promises";
import { existsSync } from "node:fs";

const output = ".next/standalone";
await mkdir(`${output}/.next`, { recursive: true });
await cp(".next/static", `${output}/.next/static`, { recursive: true });
await mkdir(`${output}/scripts`, { recursive: true });
await cp("scripts/extract-lab-pdf.mjs", `${output}/scripts/extract-lab-pdf.mjs`);
if (existsSync("public")) await cp("public", `${output}/public`, { recursive: true });
for (const file of await readdir(output)) {
  if (file === ".env" || file.startsWith(".env.")) await unlink(`${output}/${file}`);
}
console.log("Standalone package prepared. Supply runtime secrets through the host environment.");
