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
// Celular, tablet (vertical y horizontal) y computadoras.
const VISTAS = [["celular", 375, 800], ["tablet", 768, 1024], ["tablet-h", 1024, 768], ["laptop", 1366, 768], ["pantalla", 1920, 1080]];
for (const esquema of ["light", "dark", "alto", "oscuro-manual", "claro-manual", "texto-grande"]) {
  const contexto = await navegador.newContext({ bypassCSP: true, colorScheme: esquema === "dark" || esquema === "claro-manual" ? "dark" : "light", viewport: { width: 375, height: 800 } });
  if (esquema === "texto-grande") await contexto.addInitScript(() => localStorage.setItem("cecapi.escala", "2"));
  if (esquema === "alto") await contexto.addInitScript(() => localStorage.setItem("cecapi.contraste", "alto"));
  if (esquema === "oscuro-manual") await contexto.addInitScript(() => localStorage.setItem("cecapi.tema", "oscuro"));
  if (esquema === "claro-manual") await contexto.addInitScript(() => localStorage.setItem("cecapi.tema", "claro"));
  for (const [vista, ancho, alto] of VISTAS) for (const nombre of PAGINAS) {
    if (esquema !== "light" && esquema !== "texto-grande" && ["tablet-h", "pantalla"].includes(vista)) continue;
    const pagina = await contexto.newPage();
    await pagina.setViewportSize({ width: ancho, height: alto });
    const problemas = [];
    pagina.on("console", (m) => { if (m.type() === "error" && !(nombre === "no-existe" && m.text().includes("404"))) problemas.push(`consola: ${m.text()}`); });
    pagina.on("requestfailed", (p) => problemas.push(`no cargó: ${p.url()}`));
    pagina.on("response", (r) => { if (r.status() >= 400 && !r.url().endsWith("/no-existe")) problemas.push(`${r.status()}: ${r.url()}`); });
    await pagina.goto(BASE + nombre, { waitUntil: "networkidle" });
    await pagina.addScriptTag({ path: AXE });
    const resultado = await pagina.evaluate(() =>
      window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] }));
    for (const v of resultado.violations) problemas.push(`axe ${v.id} (${v.impact}): ${v.help} — ${v.nodes.length} elemento(s)`);
    const desborda = await pagina.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
    if (desborda) problemas.push(`hay desplazamiento horizontal a ${ancho} px`);
    console.log(`${problemas.length ? "FALLA" : "bien "} [${esquema} ${vista}] ${nombre}`);
    problemas.forEach((p) => console.log("   - " + p));
    fallas += problemas.length;
    if (process.env.CAPTURAS) await pagina.screenshot({ path: `capturas/${esquema}-${vista}-${nombre.replace(/\W/g, "_")}.png`, fullPage: true });
    await pagina.close();
  }
  await contexto.close();
}

await navegador.close();
servidor.close();
process.exit(fallas ? 1 : 0);
