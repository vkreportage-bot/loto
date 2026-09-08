import assert from "node:assert/strict";
import test from "node:test";
import { normalizeDate, normalizeFdjRow, parseFdjCsv } from "../src/fdj.js";

test("normalizeDate converts French FDJ dates", () => {
  assert.equal(normalizeDate("19/05/1976"), "1976-05-19");
  assert.equal(normalizeDate("19-05-1976"), "1976-05-19");
  assert.equal(normalizeDate("2026-09-07"), "2026-09-07");
  assert.equal(normalizeDate("2026/09/07"), "2026-09-07");
  assert.equal(normalizeDate("20081004"), "2008-10-04");
  assert.equal(normalizeDate("04052008"), "2008-05-04");
});

test("parses and normalizes a modern draw", () => {
  const csv = [
    "annee_numero_de_tirage;jour_de_tirage;date_de_tirage;boule_1;boule_2;boule_3;boule_4;boule_5;numero_chance;rapport_du_rang1;devise;",
    "2026107;LUNDI;07/09/2026;2;13;18;21;36;3;4000000;eur;"
  ].join("\n");
  const row = parseFdjCsv(csv)[0];
  const draw = normalizeFdjRow(row, "test", "modern.csv");

  assert.equal(draw.ruleSet, "modern-5-plus-chance");
  assert.deepEqual(draw.numbers, [2, 13, 18, 21, 36]);
  assert.equal(draw.chanceNumber, 3);
  assert.equal(draw.date, "2026-09-07");
});

test("parses and normalizes a historic draw", () => {
  const csv = [
    "annee_numero_de_tirage;jour_de_tirage;date_de_tirage;boule_1;boule_2;boule_3;boule_4;boule_5;boule_6;boule_complementaire;",
    "1976001;MERCREDI;19/05/1976;1;2;3;4;5;6;7;"
  ].join("\n");
  const row = parseFdjCsv(csv)[0];
  const draw = normalizeFdjRow(row, "test", "historic.csv");

  assert.equal(draw.ruleSet, "historic-6-plus-complementary");
  assert.deepEqual(draw.numbers, [1, 2, 3, 4, 5, 6]);
  assert.equal(draw.complementaryNumber, 7);
  assert.equal(draw.chanceNumber, null);
});
