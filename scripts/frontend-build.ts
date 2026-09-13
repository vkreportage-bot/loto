import { execFileSync } from "node:child_process";
import { mkdir, copyFile, writeFile, cp } from "node:fs/promises";
import { createRequire } from "node:module";
import { readFrontendData } from "../src/frontend-data.js";

const require = createRequire(import.meta.url);
execFileSync(process.execPath, [require.resolve("typescript/bin/tsc"), "-p", "frontend/tsconfig.json"], { stdio: "inherit" });
await mkdir("dist/app", { recursive: true });
for(const file of ["index.html", "styles.css", "favicon.svg"]) await copyFile(`frontend/${file}`, `dist/app/${file}`);
await cp("frontend/fonts", "dist/app/fonts", { recursive: true });
const data = await readFrontendData();
await writeFile("dist/app/data.json", JSON.stringify(data));
console.log(`Frontend construit dans dist/app (${data.draws.length} tirages).`);
