import type { NumberStat } from "./model.js";
export const nf = new Intl.NumberFormat("fr-FR");
export const count = (n: number) => nf.format(n);
export const decimal = (n: number, places=1) => n.toLocaleString("fr-FR", { maximumFractionDigits: places, minimumFractionDigits: places });
export const percent = (n: number) => `${decimal(n*100)} %`;
export const date = (d: string | null, full=false) => d ? new Date(`${d}T12:00:00`).toLocaleDateString("fr-FR", full ? {day:"numeric",month:"long",year:"numeric"} : {day:"2-digit",month:"2-digit",year:"numeric"}) : "—";
export const escape = (text: unknown) => String(text ?? "").replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]!));
export const ball = (n: number, bonus=false, small=false) => `<span class="ball${bonus?" bonus":""}${small?" small":""}">${String(n).padStart(2,"0")}</span>`;
export function frequencyChart(rows: NumberStat[], n: number, selected: number) {
  const max = Math.max(1,...rows.map(r=>r.count), (rows[0]?.expectedRate ?? 0)*n)*1.12;
  const reference = (rows[0]?.expectedRate ?? 0)*n/max*100;
  return `<div class="frequency-chart"><div class="chart-axis"><span>${Math.ceil(max)}</span><span>${Math.round(max/2)}</span><span>0</span></div><div class="bar-area"><div class="reference-line" style="bottom:${reference}%"><span>Moyenne théorique</span></div><div class="bars">${rows.map(r=>`<button class="bar-column ${r.number===selected?"selected":""}" data-number="${r.number}" aria-label="Numéro ${r.number} : ${r.count} sorties sur ${n} tirages" title="${r.number} · ${r.count} sorties · ${percent(r.rate)}"><span class="bar-fill" style="height:${r.count/max*100}%"></span><span class="bar-label">${r.number}</span></button>`).join("")}</div></div></div>`;
}
export function lineChart(values: number[], expected: number) {
  if(!values.length) return "";
  const w=600,h=130,p=8,lo=Math.min(...values,expected)*.85,hi=Math.max(...values,expected)*1.08;
  const x=(i:number)=>p+i/Math.max(1,values.length-1)*(w-2*p);
  const y=(v:number)=>h-p-(v-lo)/Math.max(1,hi-lo)*(h-2*p);
  const path=values.map((v,i)=>`${i?"L":"M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return `<svg class="line-chart" viewBox="0 0 ${w} ${h}" role="img" aria-label="Évolution de la somme des numéros sur les ${values.length} derniers tirages affichés"><path d="M0 ${y(expected)} H600" stroke="#d2d7d4" stroke-dasharray="4 5"/><path d="${path} L${x(values.length-1)},${h} L${p},${h} Z" fill="#e6efeb"/><path d="${path}" stroke="#527c6c" stroke-width="2" fill="none" stroke-linejoin="round"/><circle cx="${x(values.length-1)}" cy="${y(values.at(-1)!)}" r="4" fill="#527c6c"/></svg>`;
}
