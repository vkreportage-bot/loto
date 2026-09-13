import { execFileSync } from "node:child_process";

function npmRun(script: string, args: string[] = []): void {
  console.log(`\n> npm run ${script}${args.length ? ` -- ${args.join(" ")}` : ""}`);
  execFileSync("npm", ["run", script, ...(args.length ? ["--", ...args] : [])], {
    stdio: "inherit",
    env: process.env
  });
}

function main() {
  npmRun("check");
  npmRun("import", ["--latest"]);
  npmRun("normalize");
}

try {
  main();
} catch (error) {
  console.error(error);
  process.exit(1);
}
