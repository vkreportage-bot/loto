import assert from "node:assert/strict";
import test from "node:test";
import { generateGrids, backtest, seededRandom, type Method } from "../frontend/forecasts.js";
import type { Draw } from "../frontend/model.js";
const draws:Draw[]=Array.from({length:70},(_,i)=>({id:String(i),date:new Date(Date.UTC(2026,0,i+1)).toISOString().slice(0,10),regime:"modern",numbers:[1,2,3,4,5].map(n=>(n+i)%49+1),bonus:i%10+1,second:null}));
for(const method of ["random","frequency","delay","balanced"] as Method[]) {
 test(`${method}: valid reproducible grids respect included and excluded numbers`,()=>{
  const options={method,count:8,include:[7],exclude:[1,2],seed:42};
  const grids=generateGrids(draws,options);
  assert.deepEqual(grids,generateGrids(draws,options));
  assert.equal(new Set(grids.map(g=>g.numbers.join(',')+'|'+g.chance)).size,8);
  for(const g of grids){assert.equal(new Set(g.numbers).size,5);assert.ok(g.numbers.includes(7));assert.ok(g.numbers.every(n=>n>=1&&n<=49&&n!==1&&n!==2));assert.ok(g.chance>=1&&g.chance<=10);if(method==='balanced')assert.ok([2,3].includes(g.numbers.filter(n=>n%2===0).length));}
 });
}
test("impossible constraints fail explicitly",()=>{
 assert.throws(()=>generateGrids(draws,{method:'random',count:1,seed:1,include:[1],exclude:[1]}),/inclus et exclu/);
 assert.throws(()=>generateGrids(draws,{method:'balanced',count:1,seed:1,include:[2,4,6,8]}),/équilibre/);
 assert.throws(()=>generateGrids(draws,{method:'random',count:11,seed:1,include:[1,2,3,4,5]}),/distinctes/);
});
test("PRNG outputs reproducible values in [0,1)",()=>{const a=seededRandom(12),b=seededRandom(12);for(let i=0;i<100;i++){const n=a();assert.equal(n,b());assert.ok(n>=0&&n<1);}});
test("backtest uses only preceding draws and pairs the same evaluation dates",()=>{
 const result=backtest(draws,'frequency',7);
 assert.equal(result.draws,50);
 assert.equal(result.trials,20);
 assert.ok(result.trace.every(r=>r.trainedThrough<r.date));
 const prefix=backtest(draws.slice(0,50),'frequency',7);
 assert.deepEqual(result.trace.slice(0,30),prefix.trace);
 const changed=draws.map((d,i)=>i===20?{...d,numbers:[40,41,42,43,44]}:d);
 assert.deepEqual(backtest(changed,'frequency',7).trace[0].grid,result.trace[0].grid);
 assert.deepEqual(backtest(draws,'random',7).strategy,backtest(draws,'random',7).baseline);
});
test("backtest rejects too little history and historic draws",()=>{
 assert.throws(()=>backtest(draws.slice(0,20),'delay',1),/21 tirages/);
 assert.throws(()=>backtest([{...draws[0],regime:'historic'},...draws.slice(1)],'random',1),/moderne/);
});
