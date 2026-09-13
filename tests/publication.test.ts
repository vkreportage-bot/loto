import assert from "node:assert/strict";
import test from "node:test";
import { mkdtemp, mkdir, readFile, readdir, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { publishDirectory } from "../src/publication.js";

async function fixture(t: { after(fn: () => Promise<void>): void }) {
  const root = await mkdtemp(join(tmpdir(), "loto-publication-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  const target = join(root, "processed");
  await mkdir(target);
  await writeFile(join(target, "master"), "old");
  return { root, target };
}

test("a preparation failure preserves the complete previous generation", async t => {
  const { root, target } = await fixture(t);
  await assert.rejects(publishDirectory(target, async staging => {
    await writeFile(join(staging, "master"), "partial");
    throw new Error("disk failure");
  }), /disk failure/);
  assert.equal(await readFile(join(target, "master"), "utf8"), "old");
  assert.deepEqual(await readdir(root), ["processed"]);
});

test("the next run restores a generation interrupted between directory renames", async t => {
  const { target } = await fixture(t);
  await rename(target, `${target}.previous`);
  await mkdir(`${target}.next`);
  await writeFile(join(`${target}.next`, "master"), "unpublished");
  await assert.rejects(publishDirectory(target, async () => {
    assert.equal(await readFile(join(target, "master"), "utf8"), "old");
    throw new Error("source invalid");
  }), /source invalid/);
  assert.equal(await readFile(join(target, "master"), "utf8"), "old");
});

test("another publisher cannot modify a generation while it is being prepared", async t => {
  const { target } = await fixture(t);
  await publishDirectory(target, async staging => {
    await assert.rejects(publishDirectory(target, async () => {
      assert.fail("concurrent preparation must never run");
    }), /already running/);
    await writeFile(join(staging, "master"), "new");
  });
  assert.equal(await readFile(join(target, "master"), "utf8"), "new");
});

test("a dead publisher lock is recovered after process termination", async t => {
  const { target } = await fixture(t);
  const loader = fileURLToPath(new URL("../node_modules/tsx/dist/loader.mjs", import.meta.url));
  const moduleUrl = new URL("../src/publication.ts", import.meta.url).href;
  const child = spawnSync(process.execPath, ["--import", loader, "--input-type=module", "-e", `
    import { renameSync } from 'node:fs';
    import { publishDirectory } from ${JSON.stringify(moduleUrl)};
    const target = process.argv[1];
    await publishDirectory(target, async () => {
      renameSync(target, target + '.previous');
      process.exit(17);
    });
  `, target], { encoding: "utf8", timeout: 10000 });
  assert.equal(child.status, 17, child.stderr);
  await publishDirectory(target, async staging => {
    assert.equal(await readFile(join(target, "master"), "utf8"), "old");
    await writeFile(join(staging, "master"), "recovered");
  });
  assert.equal(await readFile(join(target, "master"), "utf8"), "recovered");
});
