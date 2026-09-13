import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { readFrontendData } from "./frontend-data.js";

const assets: Record<string, string> = {
  "/": "index.html", "/index.html": "index.html", "/styles.css": "styles.css",
  "/app.js": "app.js", "/model.js": "model.js", "/analytics.js": "analytics.js",
  "/charts.js": "charts.js", "/views.js": "views.js", "/favicon.svg": "favicon.svg", "/forecasts.js": "forecasts.js", "/forecasts-view.js": "forecasts-view.js"
};
for(const [family, weights] of [["dm-sans",[400,500,600,700]], ["manrope",[400,500,600,700,800]]] as const) {
  for(const weight of weights) assets[`/fonts/${family}-${weight}.ttf`] = `fonts/${family}-${weight}.ttf`;
}
export function createFrontendServer(directory = "dist/app", dataPath = "data/processed/loto-master.json") {
  return createServer(async (request, response) => {
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.setHeader("Cache-Control", "no-store");
    if(request.method !== "GET" && request.method !== "HEAD") {
      response.writeHead(405, { Allow: "GET, HEAD" }).end(); return;
    }
    const path = new URL(request.url ?? "/", "http://localhost").pathname;
    try {
      if(path === "/data.json") {
        const data = await readFrontendData(dataPath);
        response.writeHead(200, { "Content-Type": "application/json; charset=utf-8" });
        response.end(request.method === "HEAD" ? undefined : JSON.stringify(data)); return;
      }
      const file = assets[path];
      if(!file) { response.writeHead(404).end("Not found"); return; }
      const body = await readFile(join(directory, file));
      const extension = file.split(".").at(-1)!;
      const mime = { html: "text/html", css: "text/css", js: "text/javascript", svg: "image/svg+xml", ttf: "font/ttf" }[extension];
      response.writeHead(200, { "Content-Type": `${mime}; charset=utf-8` });
      response.end(request.method === "HEAD" ? undefined : body);
    } catch(error) {
      console.error(error);
      response.writeHead(503, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "Les données locales ne sont pas disponibles ou leur validation a échoué." }));
    }
  });
}
