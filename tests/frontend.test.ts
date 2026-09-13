import assert from "node:assert/strict";
import test from "node:test";
import { filterDraws, analyzeNumbers, analyzePairs, summarize, parseQuery, historyRows, csvExport, restoreFilters } from "../frontend/analytics.js";
import { defaults, type Draw } from "../frontend/model.js";
const draws: Draw[] = [
  { id: "a", date: "2026-01-01", regime: "modern", numbers: [1,2,3,4,5], bonus: 1, second: null },
  { id: "b", date: "2026-01-03", regime: "historic", numbers: [1,2,3,4,5,6], bonus: 7, second: null },
  { id: "c", date: "2026-01-05", regime: "modern", numbers: [1,2,6,7,8], bonus: 2, second: [10,11,12,13,14] },
];
test("filters separate regimes and second draws before applying the window", () => {
  assert.deepEqual(filterDraws(draws, defaults).map(d=>d.id), ["a","c"]);
  const second = filterDraws(draws, {...defaults, kind:"second"});
  assert.deepEqual(second.map(d=>d.numbers), [[10,11,12,13,14]]);
  assert.deepEqual(draws[2].numbers, [1,2,6,7,8]);
  assert.equal(filterDraws(draws, {...defaults,window:"custom",from:"2026-01-02",to:"2026-01-04"}).length,0);
});
test("frequencies include absent numbers, rates and right-censored sample delays", () => {
  const rows=analyzeNumbers(filterDraws(draws,defaults),49,5);
  assert.equal(rows.length,49);
  assert.equal(rows[0].count,2);
  assert.equal(rows[0].rate,1);
  assert.equal(rows[2].delay,1);
  assert.equal(rows[2].lastDate,"2026-01-01");
  assert.equal(rows[48].delay,2);
  assert.equal(rows[48].censored,true);
  assert.equal(rows[48].expectedRate,5/49);
  assert.equal(analyzeNumbers([],49,5)[0].rate,0);
});
test("pairs count once per draw and retain zero counts", () => {
  const pairs=analyzePairs(filterDraws(draws,defaults));
  assert.equal(pairs.length,1176);
  assert.deepEqual(pairs[0],{a:1,b:2,count:2,rate:1});
  assert.equal(pairs.find(p=>p.a===48&&p.b===49)?.count,0);
});
test("summary computes sums and parity from the same sample", () => {
  const result=summarize(filterDraws(draws,defaults));
  assert.equal(result.averageSum,19.5);
  assert.equal(result.evenRate,0.5);
  assert.equal(result.averageRepeat,2);
});
test("history query is strict and matches all numbers", () => {
  assert.deepEqual(parseQuery("1, 2 49"),[1,2,49]);
  assert.throws(()=>parseQuery("1abc"));
  assert.throws(()=>parseQuery("50"));
  assert.deepEqual(historyRows(draws,[1,6]).map(d=>d.id),["c","b"]);
});
test("CSV encodes fields and exports all matching rows", () => {
  assert.equal(csvExport(["a","b"],[["x;y",'x"y']]),'\uFEFFa;b\r\n"x;y";"x""y"\r\n');
});
test("invalid saved preferences cannot break the app or mix historic and second draws", () => {
  assert.deepEqual(restoreFilters({regime:"invalid",window:"oops"}),defaults);
  assert.equal(restoreFilters({...defaults,regime:"historic",kind:"second"}).kind,"main");
  assert.equal(restoreFilters({...defaults,from:"garbage"}).from,"");
});
