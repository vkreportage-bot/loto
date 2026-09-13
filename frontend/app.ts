import { backtest, generateGrids, methods, type Method } from "./forecasts.js";
import { initialForecast } from "./forecasts-view.js";
import { analyzeNumbers, analyzePairs, csvExport, filterDraws, historyRows, parseQuery, restoreFilters } from "./analytics.js";
import { defaults, type Dataset, type View } from "./model.js";
import { shell, type UIState } from "./views.js";
import { escape } from "./charts.js";

const app = document.querySelector<HTMLDivElement>("#app")!;
const storageKey = "loto-atelier.filters.v1";
let stored: unknown;
try { stored=JSON.parse(localStorage.getItem(storageKey) ?? "null"); } catch { stored=null; }
const state: UIState = { filters: restoreFilters(stored), view:"overview", selected:23, sort:"count", pairNumber:0, page:0, query:"", queryNumbers:[], queryError:"", expanded:"", forecast:initialForecast() };
let dataset: Dataset | null = null;
let loading = false;
let toastTimer: ReturnType<typeof setTimeout>;
function toast(text:string) {
 const element=document.querySelector<HTMLDivElement>("#toast")!;
 clearTimeout(toastTimer); element.textContent=text; element.classList.add("visible");
 toastTimer=setTimeout(()=>element.classList.remove("visible"),3500);
}
function currentView():View { const value=location.hash.slice(1); return ["overview","numbers","pairs","history","forecasts"].includes(value)?value as View:"overview"; }
function render() {
 if(!dataset) return;
 const focus=document.activeElement as HTMLElement|null;
 const id=focus?.id, number=focus?.dataset.number;
 state.view=currentView();
 app.innerHTML=shell(dataset,state,filterDraws(dataset.draws,state.filters));
 document.title=`${{overview:"Vue d’ensemble",numbers:"Numéros",pairs:"Paires",history:"Historique",forecasts:"Pronostics"}[state.view]} — LOTO / Atelier`;
 if(id) document.getElementById(id)?.focus({preventScroll:true});
 else if(number) app.querySelector<HTMLElement>(`[data-number="${number}"]`)?.focus({preventScroll:true});
}
function save() {
 try { localStorage.setItem(storageKey,JSON.stringify(state.filters)); } catch { /* Private browsing may disallow storage. Analysis still works. */ }
}
async function load(refresh=false) {
 if(loading) return;
 loading=true;
 const refreshButton=app.querySelector<HTMLButtonElement>('[data-action="refresh"]');
 if(refreshButton) { refreshButton.disabled=true; refreshButton.textContent="Chargement…"; }
 try {
  const response=await fetch("./data.json", { cache:"no-store", signal: AbortSignal.timeout(15000) });
  if(!response.ok) throw new Error("Le fichier de données est indisponible.");
  const value: Dataset=await response.json();
  if(value.schemaVersion!==1 || !Array.isArray(value.draws) || !value.draws.length || value.draws.some(d=>!/^\d{4}-\d{2}-\d{2}$/.test(d.date) || !["modern","historic"].includes(d.regime) || !Array.isArray(d.numbers) || d.numbers.some(n=>!Number.isInteger(n)||n<1||n>49))) throw new Error("Le format des données est invalide.");
  dataset=value; clearForecast(); render(); if(refresh) toast("Données locales rechargées.");
 } catch(error) {
  if(dataset) { render(); toast("Impossible de recharger. Les données précédentes restent affichées."); }
  else app.innerHTML=`<div class="loading"><img src="./favicon.svg" width="48" height="48" alt=""><h1>L’atelier attend ses données.</h1><p>${escape(error instanceof Error?error.message:"Erreur de chargement.")}</p><p>Vérifiez que l’application a été construite et que la base locale est valide.</p><button class="button primary" data-action="retry">Réessayer</button></div>`;
 } finally { loading=false; }
}
function exportData() {
 if(!dataset) return;
 const draws=filterDraws(dataset.draws,state.filters);
 if(!draws.length) { toast("Aucun tirage à exporter dans cette période."); return; }
 let text:string;
 if(state.view==="forecasts") {
  const series=state.forecast.generated;
  if(!series) {toast("Générez d’abord une série de grilles à exporter.");return;}
  text=csvExport(["grille","numeros","chance","methode","graine","donnees_jusqu_au"],series.grids.map((g,i)=>[i+1,g.numbers.join(" "),g.chance,methods[series.method],series.seed,series.through]));
 } else if(state.view==="numbers") {
  text=csvExport(["numero","sorties","tirages","frequence","reference","ecart","retard","retard_minimum","derniere_date"],analyzeNumbers(draws,49,draws[0].numbers.length).map(r=>[r.number,r.count,draws.length,r.rate,r.expectedRate,r.delta,r.delay,r.censored,r.lastDate]));
 } else if(state.view==="pairs") {
  text=csvExport(["numero_1","numero_2","rencontres","tirages","frequence"],analyzePairs(draws).filter(p=>!state.pairNumber||p.a===state.pairNumber||p.b===state.pairNumber).map(p=>[p.a,p.b,p.count,draws.length,p.rate]));
 } else {
  if(state.view==="history" && state.queryError) { toast("Corrigez les numéros de recherche avant l’export."); return; }
  const rows=state.view==="history"?historyRows(draws,state.queryNumbers):[...draws].reverse();
  text=csvExport(["date","identifiant","regime","tirage","numeros","bonus","somme"],rows.map(d=>[d.date,d.id,d.regime,state.filters.kind,d.numbers.join(" "),state.filters.kind==="main"?d.bonus:"",d.numbers.reduce((a,b)=>a+b,0)]));
 }
 const url=URL.createObjectURL(new Blob([text],{type:"text/csv;charset=utf-8"}));
 const link=document.createElement("a"); link.href=url; link.download=`loto-${state.view}-${state.filters.regime}-${state.filters.kind}-${draws[0].date}-${draws.at(-1)!.date}.csv`;
 document.body.append(link); link.click(); link.remove(); setTimeout(()=>URL.revokeObjectURL(url),1000); toast("Export CSV préparé.");
}
app.addEventListener("click",event=>{
 const target=(event.target as Element).closest<HTMLElement>("button, [data-action]");
 if(!target || target.hasAttribute("disabled")) return;
 if(target.dataset.number) { state.selected=Number(target.dataset.number); render(); return; }
 if(target.dataset.page) { state.page=Math.max(0,Number(target.dataset.page)); render(); document.querySelector(".history-heading")?.scrollIntoView({block:"start",behavior:"smooth"}); return; }
 if(target.dataset.draw) { state.expanded=state.expanded===target.dataset.draw?"":target.dataset.draw; render(); return; }
 switch(target.dataset.action) {
  case "forecast-modern": state.filters={...state.filters,regime:"modern",kind:"main"};clearForecast();save();render();break;
  case "forecast-seed": state.forecast.seed=crypto.getRandomValues(new Uint32Array(1))[0];render();break;
  case "forecast-test": void runBacktest();break;
  case "reset": state.filters={...defaults}; state.page=0;state.query="";state.queryNumbers=[];state.queryError=""; save();clearForecast();render();break;
  case "refresh": void load(true);break;
  case "retry": void load();break;
  case "export": exportData();break;
  case "method": document.querySelector<HTMLDialogElement>("#method-dialog")?.showModal();break;
  case "close-method": document.querySelector<HTMLDialogElement>("#method-dialog")?.close();break;
 }
});
app.addEventListener("change",event=>{
 const target=event.target as HTMLSelectElement | HTMLInputElement;
 if(["regime","kind","window","from","to"].includes(target.id)) {
  state.filters=restoreFilters({...state.filters,[target.id]:target.value});state.page=0;state.expanded="";clearForecast();save();render();
 } else if(target.id==="number-sort") { state.sort=target.value;render(); }
 else if(target.id==="pair-number") { state.pairNumber=Number(target.value);render(); }
});
app.addEventListener("submit",event=>{
 if((event.target as HTMLElement).id==="forecast-form") {
  event.preventDefault();
  if(!dataset)return;
  try {
   const f=state.forecast,draws=filterDraws(dataset.draws,state.filters);
   const grids=generateGrids(draws,{method:f.method,count:f.quantity,seed:f.seed,include:parseQuery(f.include),exclude:parseQuery(f.exclude)});
   f.generated={grids,method:f.method,seed:f.seed,through:draws.at(-1)!.date};f.error="";
  } catch(error) {state.forecast.error=(error as Error).message;}
  render();return;
 }
 if((event.target as HTMLElement).id!=="history-search") return;
 event.preventDefault(); state.query=app.querySelector<HTMLInputElement>("#history-query")!.value;
 try { state.queryNumbers=parseQuery(state.query);state.queryError=""; } catch(error) {state.queryError=(error as Error).message;}
 state.page=0;render();
});
function clearForecast() {state.forecast.generated=null;state.forecast.result=null;state.forecast.error="";}
app.addEventListener("input",event=>{
 const input=event.target as HTMLInputElement;
 const fields:Record<string,"method"|"quantity"|"seed"|"include"|"exclude">={"forecast-method":"method","forecast-quantity":"quantity","forecast-seed":"seed","forecast-include":"include","forecast-exclude":"exclude"};
 const field=fields[input.id];if(!field)return;
 if(field==="method") {state.forecast.method=input.value as Method;render();}
 else if(field==="quantity"||field==="seed")state.forecast[field]=Number(input.value);
 else state.forecast[field]=input.value;
});
async function runBacktest() {
 if(!dataset||state.forecast.busy)return;
 const source=filterDraws(dataset.draws,state.filters),method=state.forecast.method,seed=state.forecast.seed;
 const filters=JSON.stringify(state.filters),data=dataset;
 state.forecast.busy=true;state.forecast.error="";render();
 await new Promise(resolve=>setTimeout(resolve,40));
 try {
  if(filters!==JSON.stringify(state.filters)||data!==dataset)return;
  state.forecast.result=backtest(source,method,seed);
 } catch(error) {state.forecast.error=(error as Error).message;}
 finally {state.forecast.busy=false;render();}
}
window.addEventListener("hashchange",()=>{state.page=0;state.expanded="";render();window.scrollTo({top:0});});
void load();
