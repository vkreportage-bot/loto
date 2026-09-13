import { defaults, type Draw, type Filters, type NumberStat, type PairStat } from "./model.js";

export function restoreFilters(value: unknown): Filters {
  const input = value && typeof value === "object" ? value as Partial<Filters> : {};
  const regime = input.regime === "historic" ? "historic" : "modern";
  const date = (v: unknown): string => {
    if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return "";
    const parsed = new Date(`${v}T12:00:00Z`);
    return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0,10) === v ? v : "";
  };
  return { regime, kind: regime === "modern" && input.kind === "second" ? "second" : "main",
    window: ["50","100","500","all","custom"].includes(input.window ?? "") ? input.window! : defaults.window,
    from: date(input.from), to: date(input.to) };
}

export function filterDraws(draws: Draw[], filters: Filters): Draw[] {
  let result = draws.filter(d => d.regime === filters.regime && (filters.kind === "main" || d.second !== null));
  if (filters.kind === "second") result = result.map(d => ({ ...d, numbers: d.second!, bonus: 0 }));
  result = [...result].sort((a,b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  if (filters.window === "custom") {
    return result.filter(d => (!filters.from || d.date >= filters.from) && (!filters.to || d.date <= filters.to));
  }
  return filters.window === "all" ? result : result.slice(-Number(filters.window));
}

export function analyzeNumbers(draws: Draw[], range = 49, drawn = 5, bonus = false): NumberStat[] {
  const rows: NumberStat[] = Array.from({ length: range }, (_, i) => ({
    number: i+1, count: 0, rate: 0, expectedRate: drawn/range, delta: 0,
    delay: draws.length, censored: true, lastDate: null
  }));
  draws.forEach((draw,index) => {
    for (const n of bonus ? [draw.bonus] : draw.numbers) {
      const row = rows[n-1];
      if (!row) continue;
      row.count++; row.delay=draws.length-1-index; row.lastDate=draw.date; row.censored=false;
    }
  });
  for (const row of rows) {
    row.rate=draws.length ? row.count/draws.length : 0;
    row.delta=draws.length ? row.rate-row.expectedRate : 0;
  }
  return rows;
}

export function analyzePairs(draws: Draw[]): PairStat[] {
  const counts = new Uint32Array(2500);
  for (const draw of draws) {
    const numbers = [...draw.numbers].sort((a,b)=>a-b);
    for(let i=0;i<numbers.length;i++) for(let j=i+1;j<numbers.length;j++) counts[numbers[i]*50+numbers[j]]++;
  }
  const rows: PairStat[]=[];
  for(let a=1;a<49;a++) for(let b=a+1;b<=49;b++) {
    const count=counts[a*50+b];
    rows.push({a,b,count,rate:draws.length ? count/draws.length : 0});
  }
  return rows.sort((a,b)=>b.count-a.count || a.a-b.a || a.b-b.b);
}

export function summarize(draws: Draw[]) {
  const sums = draws.map(d=>d.numbers.reduce((a,b)=>a+b,0));
  let even=0, total=0, repeats=0;
  const parity = Array.from({ length: (draws[0]?.numbers.length ?? 5)+1 }, () => 0);
  draws.forEach((d,i)=>{
    const count = d.numbers.filter(n=>n%2===0).length;
    parity[count]++; even+=count; total+=d.numbers.length;
    if(i) repeats+=d.numbers.filter(n=>draws[i-1].numbers.includes(n)).length;
  });
  return { sums, parity, averageSum: sums.length ? sums.reduce((a,b)=>a+b,0)/sums.length : 0,
    evenRate: total ? even/total : 0, averageRepeat: draws.length>1 ? repeats/(draws.length-1) : 0 };
}

export function parseQuery(query: string): number[] {
  if (!query.trim()) return [];
  const tokens=query.trim().split(/[\s,;]+/);
  if(tokens.some(n=>!/^\d{1,2}$/.test(n) || Number(n)<1 || Number(n)>49)) throw new Error("Saisissez des numéros de 1 à 49, séparés par un espace ou une virgule.");
  return [...new Set(tokens.map(Number))];
}
export function historyRows(draws: Draw[], numbers: number[]): Draw[] {
  return draws.filter(d=>numbers.every(n=>d.numbers.includes(n))).slice().reverse();
}
export function csvExport(headers: string[], rows: unknown[][]): string {
  const cell = (v: unknown) => {
    let text=String(v ?? "");
    if (/^[=+@\-]/.test(text)) text="'"+text;
    return /[;"\r\n]/.test(text) ? `"${text.replaceAll('"','""')}"` : text;
  };
  return "\uFEFF"+[headers,...rows].map(row=>row.map(cell).join(";")).join("\r\n")+"\r\n";
}
