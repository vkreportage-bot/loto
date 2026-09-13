import assert from "node:assert/strict";
import test from "node:test";
import { once } from "node:events";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { AddressInfo } from "node:net";
import { createFrontendServer } from "../src/frontend-server.js";
import { readFrontendData } from "../src/frontend-data.js";

test("frontend payload is validated, compact and retains main and second draws", async () => {
  const data=await readFrontendData();
  assert.equal(data.schemaVersion,1);
  assert.ok(data.draws.length>7000);
  assert.ok(data.draws.some(d=>d.second?.length===5));
  assert.ok(data.draws.some(d=>d.regime==='historic'&&d.numbers.length===6));
  assert.ok(!('prizeTiers' in data.draws[0]));
});

test("local frontend serves only intended assets, denies mutations and reports unavailable data", async t => {
  const dir=await mkdtemp(join(tmpdir(),'loto-http-'));
  await writeFile(join(dir,'index.html'),'<h1>Atelier</h1>');
  const server=createFrontendServer(dir,join(dir,'missing.json'));
  t.after(async()=>{server.closeAllConnections();await new Promise<void>(resolve=>server.close(()=>resolve()));await rm(dir,{recursive:true,force:true});});
  server.listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const page=await fetch(base);
  assert.equal(page.status,200);assert.match(await page.text(),/Atelier/);
  assert.equal((await fetch(`${base}/package.json`)).status,404);
  assert.equal((await fetch(base,{method:'POST'})).status,405);
  assert.equal((await fetch(base,{method:'HEAD'})).headers.get('content-type'),'text/html; charset=utf-8');
  assert.equal((await fetch(`${base}/data.json`)).status,503);
});
