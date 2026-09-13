import "./frontend-build.js";
import { createFrontendServer } from "../src/frontend-server.js";
const port = Number(process.env.PORT ?? 4173);
if(!Number.isInteger(port) || port < 1 || port > 65535) throw new Error("PORT doit être un entier de 1 à 65535.");
const server = createFrontendServer();
server.on("error", error => { console.error(error.message); process.exitCode = 1; });
server.listen(port, "127.0.0.1", () => console.log(`LOTO / Atelier → http://127.0.0.1:${port}`));
