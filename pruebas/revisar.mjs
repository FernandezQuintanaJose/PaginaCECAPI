// Revisión automática: errores de consola, recursos que no cargan y reglas de accesibilidad (axe, WCAG 2.2 AA).
// No sustituye la prueba con NVDA, JAWS, Narrator y TalkBack.
import { createRequire } from "node:module";

import { servir } from "./servidor.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const AXE = require.resolve("axe-core/axe.min.js");
const PUERTO = 8091;
const BASE = `http://localhost:${PUERTO}${process.env.PREFIJO || "/PaginaCECAPI/"}`;
const PAGINAS = (process.env.PAGINAS || "index.html,aviso-privacidad.html,terminos.html,no-existe").split(",");

const servidor = await servir(PUERTO);
const navegador = await chromium.launch();
let fallas = 0;

// bypassCSP solo deja inyectar axe; la página real conserva su política.
for (const esquema of ["light", "dark", "alto"]) {
  const contexto = await navegador.newContext({ bypassCSP: true, colorScheme: esquema === "alto" ? "light" : esquema, viewport: { width: 375, height: 800 } });
  if (esquema === "alto") await contexto.addInitScript(() => localStorage.setItem("cecapi.contraste", "alto"));
  for (const nombre of PAGINAS) {
    const pagina = await contexto.newPage();
    const problemas = [];
    pagina.on("console", (m) => { if (m.type() === "error" && !(nombre === "no-existe" && m.text().includes("404"))) problemas.push(`consola: ${m.text()}`); });
    pagina.on("requestfailed", (p) => problemas.push(`no cargó: ${p.url()}`));
    pagina.on("response", (r) => { if (r.status() >= 400 && !r.url().endsWith("/no-existe")) problemas.push(`${r.status()}: ${r.url()}`); });
    await pagina.goto(BASE + nombre, { waitUntil: "networkidle" });
    await pagina.addScriptTag({ path: AXE });
    const resultado = await pagina.evaluate(() =>
      window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] }));
    for (const v of resultado.violations) problemas.push(`axe ${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} elemento(s)`);
    const ancho = await pagina.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (ancho) problemas.push("hay desplazamiento horizontal a 375 px");
    console.log(`${problemas.length ? "FALLA" : "bien "} [${esquema}] ${nombre}`);
    problemas.forEach((p) => console.log("   - " + p));
    fallas += problemas.length;
    if (process.env.CAPTURAS) await pagina.screenshot({ path: `capturas/${esquema}-${nombre.replace(/\W/g, "_")}.png`, fullPage: true });
    await pagina.close();
  }
  await contexto.close();
}

await navegador.close();
servidor.close();
process.exit(fallas ? 1 : 0);
