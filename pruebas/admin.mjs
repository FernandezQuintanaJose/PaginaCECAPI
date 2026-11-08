// Prueba del editor (admin/) contra una copia simulada de la API de GitHub: conectar, agregar, editar, ordenar,
// ocultar, quitar, validar, publicar en un solo commit, conflictos, llave sin permiso y descartar.
// No toca GitHub de verdad. También revisa que la llave no se guarde en el navegador y la accesibilidad (axe).
import { createRequire } from "node:module";
import { readFile } from "node:fs/promises";
import { servir } from "./servidor.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const AXE = require.resolve("axe-core/axe.min.js");
const PUERTO = 8096;
const URL_ADMIN = `http://localhost:${PUERTO}/PaginaCECAPI/admin/`;
const REPO = "/repos/FernandezQuintanaJose/PaginaCECAPI";
const LLAVE = "github_pat_LLAVE_DE_PRUEBA";
const PIXEL = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

let fallas = 0;
const revisar = (ok, d) => { console.log(`${ok ? "bien " : "FALLA"} ${d}`); if (!ok) fallas++; };

const servidor = await servir(PUERTO);
const navegador = await chromium.launch();

// ---- GitHub simulado
async function crearGitHub() {
  const archivos = new Map();
  for (const n of ["sitio", "servicios", "equipo", "galeria"]) archivos.set(`datos/${n}.v1.json`, Buffer.from(await readFile(new URL(`../datos/${n}.v1.json`, import.meta.url))));
  // Un servicio con foto en el repositorio, para comprobar que se borra la foto al quitarlo.
  const servicios = JSON.parse(archivos.get("datos/servicios.v1.json").toString());
  servicios.servicios.push({ id: "yoga", nombre: "Yoga", descripcion: "", quien: "", horario: "Lunes", requisitos: "", foto: "assets/fotos/viejo.webp", fotoAlt: "Clase de yoga", publicado: true });
  archivos.set("datos/servicios.v1.json", Buffer.from(JSON.stringify(servicios, null, 2) + "\n"));
  archivos.set("assets/fotos/viejo.webp", Buffer.from("RIFF0000WEBPviejo"));
  archivos.set("assets/fotos/LEEME.txt", Buffer.from("no se toca"));

  const g = { archivos, head: "c1", tree: "t1", blobs: new Map(), arboles: [], commits: [], parches: [], llamadas: [], push: true, cabezaAjena: null, fallar: null };
  g.manejar = async (ruta) => {
    const url = new URL(ruta.request().url());
    const metodo = ruta.request().method();
    const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*", "Access-Control-Allow-Methods": "GET,POST,PATCH", "Access-Control-Max-Age": "0" };
    if (metodo === "OPTIONS") return ruta.fulfill({ status: 204, headers: cors });
    g.llamadas.push(`${metodo} ${url.pathname.replace(REPO, "") || "/"}`);
    const responder = (cuerpo, status = 200) => ruta.fulfill({ status, headers: cors, contentType: "application/json", body: JSON.stringify(cuerpo) });
    if (ruta.request().headers().authorization !== `Bearer ${LLAVE}`) return responder({ message: "Bad credentials" }, 401);
    const p = url.pathname.replace(REPO, "");
    if (g.fallar && p === g.fallar) return responder({ message: "boom" }, 500);
    const cuerpo = ruta.request().postDataJSON?.() ?? null;
    if (p === "" && metodo === "GET") return responder({ permissions: { push: g.push } });
    if (p === "/git/ref/heads/main") return responder({ object: { sha: g.cabezaAjena || g.head } });
    if (p.startsWith("/git/commits/") && metodo === "GET") return responder({ sha: g.head, tree: { sha: g.tree } });
    if (p.startsWith("/git/trees/") && metodo === "GET") return responder({ truncated: false, tree: [...g.archivos.keys()].map((path) => ({ path, type: "blob", sha: "s" })) });
    if (p.startsWith("/contents/")) {
      const f = g.archivos.get(decodeURIComponent(p.slice("/contents/".length)));
      return f ? ruta.fulfill({ status: 200, headers: cors, contentType: "text/plain", body: f }) : responder({ message: "Not Found" }, 404);
    }
    if (p === "/git/blobs") { const sha = `b${g.blobs.size + 1}`; g.blobs.set(sha, Buffer.from(cuerpo.content, "base64")); return responder({ sha }, 201); }
    if (p === "/git/trees" && metodo === "POST") { g.arboles.push(cuerpo); return responder({ sha: "t2" }, 201); }
    if (p === "/git/commits" && metodo === "POST") { g.commits.push(cuerpo); return responder({ sha: "c2", tree: { sha: "t2" } }, 201); }
    if (p === "/git/refs/heads/main" && metodo === "PATCH") {
      g.parches.push(cuerpo);
      for (const e of g.arboles.at(-1).tree) { if (e.sha === null) g.archivos.delete(e.path); else g.archivos.set(e.path, g.blobs.get(e.sha)); }
      g.head = cuerpo.sha; g.tree = "t2";
      return responder({ ref: "refs/heads/main" });
    }
    return responder({ message: "no simulado: " + p }, 404);
  };
  return g;
}

async function abrir({ gh, bypassCSP = false } = {}) {
  const contexto = await navegador.newContext({ bypassCSP });
  await contexto.route("https://api.github.com/**", gh.manejar);
  await contexto.route("**/assets/fotos/**", (r) => r.fulfill({ contentType: "image/png", body: PIXEL }));
  const pagina = await contexto.newPage();
  pagina.errores = [];
  pagina.on("pageerror", (e) => pagina.errores.push(e.message));
  pagina.on("console", (m) => { if (m.type() === "error" && !m.text().includes("Failed to load resource")) pagina.errores.push(m.text()); });
  await pagina.goto(URL_ADMIN, { waitUntil: "networkidle" });
  return pagina;
}

// waitForFunction evalúa texto y la política de seguridad de la página lo bloquea (con razón): se sondea con evaluate.
async function esperar(p, fn, ms = 6000) {
  const fin = Date.now() + ms;
  while (Date.now() < fin) {
    if (await p.evaluate(fn)) return true;
    await p.waitForTimeout(50);
  }
  return false;
}

async function conectar(p, llave = LLAVE) {
  await p.fill("#llave", llave);
  await p.click("#f-conexion button[type=submit]");
  await esperar(p, () => !document.getElementById("editor").hidden || !document.getElementById("llave-error").hidden);
}

const activo = (p) => p.evaluate(() => { const a = document.activeElement; return a ? (a.dataset.accion ? a.dataset.accion + ":" + a.dataset.indice : a.id) : ""; });
const nombres = (p, ul) => p.locator(`#${ul} .titulo`).allTextContents();
const estado = (p) => p.textContent("#estado-cambios");
const guardar = async (p) => { await p.click("#form-guardar"); await p.waitForTimeout(150); };
// El diálogo avisa su respuesta con el evento "close", que llega después del clic. Sin esperar, la
// revisión siguiente a veces veía la lista de antes (falló 4 de 79 en la revisión del 8 nov).
async function confirmarSi(p, listo) {
  await p.click("#confirmar-si");
  await esperar(p, () => !document.getElementById("dialogo-confirmar").open);
  if (listo) await esperar(p, listo);
  else await p.evaluate(() => new Promise((r) => requestAnimationFrame(() => setTimeout(r, 0))));
}

// ---- 1. Antes de conectar y llaves malas
let gh = await crearGitHub();
let p = await abrir({ gh });
revisar(await p.isHidden("#editor") && await p.isVisible("#f-conexion"), "al entrar solo se ve la pantalla para conectar");
revisar(gh.llamadas.length === 0, "no se llama a GitHub hasta que la persona conecta");
revisar((await p.getAttribute('meta[name="robots"]', "content")).includes("noindex"), "la página no se deja indexar");

await conectar(p, "llave-equivocada");
revisar(await p.isVisible("#llave-error") && (await p.textContent("#llave-error")).includes("no es válida") && await p.isHidden("#editor"), "una llave incorrecta da un aviso claro y no abre el editor");
revisar((await p.getAttribute("#llave", "aria-invalid")) === "true", "el campo de la llave se marca como inválido");

gh.push = false;
await conectar(p);
revisar((await p.textContent("#llave-error")).includes("solo puede leer") && await p.isHidden("#editor"), "una llave sin permiso de escritura se rechaza al conectar");
gh.push = true;

// ---- 2. Conectar bien
await conectar(p);
revisar(await p.isVisible("#editor") && await p.isHidden("#conexion"), "con la llave correcta se abre el editor");
revisar((await p.inputValue("#llave")) === "", "la llave se borra del campo");
const almacenes = await p.evaluate(() => ({ local: Object.keys(localStorage), sesion: Object.keys(sessionStorage), cookies: document.cookie }));
revisar(almacenes.local.length === 0 && almacenes.sesion.length === 0 && almacenes.cookies === "", "la llave no se guarda en localStorage, sessionStorage ni cookies");
revisar((await nombres(p, "lista-servicios")).length === 8, "se listan los 8 servicios del repositorio");
revisar((await estado(p)).includes("No hay cambios"), "al inicio no hay cambios por publicar");
revisar(await p.isDisabled("#publicar"), "no se puede publicar sin cambios");
revisar(await p.isDisabled('#lista-servicios button[data-accion="subir"][data-indice="0"]'), "el primero no se puede subir");
revisar(await p.getByRole("button", { name: "Editar Cocina" }).count() === 1, "cada botón dice a qué elemento se refiere (\"Editar Cocina\")");

// ---- 3. Agregar un servicio: validación y alta
await p.click("#agregar-servicios");
revisar(await p.isVisible("#dialogo-form"), "Agregar abre el formulario");
await guardar(p);
revisar(await p.isVisible("#form-errores") && (await p.getAttribute("#campo-nombre", "aria-invalid")) === "true", "guardar sin nombre muestra el error y marca el campo");
revisar(await p.evaluate(() => document.activeElement.id) === "form-errores", "el foco va al resumen de errores");
revisar(await p.isVisible("#dialogo-form"), "el formulario no se cierra con errores");
await p.fill("#campo-nombre", "Taller de lectura");
await p.fill("#campo-horario", "Jueves 4 pm");
await p.fill("#campo-fotoAlt", "");
await guardar(p);
revisar(await p.isHidden("#dialogo-form"), "con el nombre ya guarda y cierra");
revisar((await nombres(p, "lista-servicios")).at(-1) === "Taller de lectura", "el servicio nuevo queda al final");
revisar((await activo(p)) === "editar:8", "el foco queda en el botón Editar del servicio nuevo");
revisar((await estado(p)).includes("Hay cambios"), "aparece que hay cambios sin publicar");

// ---- 4. Editar, ordenar, ocultar
await p.getByRole("button", { name: "Editar Taller de lectura" }).click();
revisar((await p.inputValue("#campo-horario")) === "Jueves 4 pm", "al editar se ven los datos actuales");
await p.fill("#campo-horario", "Viernes 5 pm");
await guardar(p);
revisar((await p.locator("#lista-servicios li").last().textContent()).includes("Viernes 5 pm"), "el cambio de horario se ve en la lista");

await p.getByRole("button", { name: "Subir Taller de lectura" }).click();
revisar((await nombres(p, "lista-servicios")).at(-2) === "Taller de lectura", "Subir mueve el servicio una posición");
revisar((await activo(p)) === "subir:7", "el foco sigue en el botón Subir del mismo servicio");

await p.getByRole("button", { name: "Ocultar Cocina" }).click();
revisar(await p.getByRole("button", { name: "Mostrar Cocina" }).count() === 1 && (await p.locator("#lista-servicios li.oculto").count()) === 1, "Ocultar cambia el botón a Mostrar y marca el servicio");
revisar((await p.locator("#lista-servicios li.oculto .detalle").textContent()).includes("Oculto en el sitio"), "dice que está oculto en el sitio");
await p.getByRole("button", { name: "Mostrar Cocina" }).click();
revisar(await p.locator("#lista-servicios li.oculto").count() === 0, "Mostrar lo vuelve a poner");

// ---- 5. Quitar: confirmación
await p.getByRole("button", { name: "Quitar Yoga" }).click();
revisar(await p.isVisible("#dialogo-confirmar") && (await p.textContent("#confirmar-titulo")).includes("Yoga"), "Quitar pide confirmación con el nombre");
await p.click("#confirmar-no");
revisar((await nombres(p, "lista-servicios")).includes("Yoga"), "cancelar no quita nada");
await p.getByRole("button", { name: "Quitar Yoga" }).click();
await confirmarSi(p, () => ![...document.querySelectorAll("#lista-servicios .titulo")].some((t) => t.textContent === "Yoga"));
revisar(!(await nombres(p, "lista-servicios")).includes("Yoga"), "confirmar sí lo quita");
revisar((await activo(p)) === "agregar-servicios", "después de quitar, el foco vuelve a Agregar");

// ---- 6. Equipo: sin autorización no se agrega
await p.click("#agregar-equipo");
await p.fill("#campo-nombre", "Rosa Pérez");
await p.fill("#campo-cargo", "Coordinadora");
await guardar(p);
const resumenErrores = await p.textContent("#form-errores");
revisar(resumenErrores.includes("autorización") && resumenErrores.includes("Fecha"), "no deja agregar a una persona sin fecha ni autorización firmada");
await p.fill("#campo-consentimientoFecha", "2099-01-01");
await p.check("#campo-consentimiento");
await guardar(p);
revisar((await p.textContent("#form-errores")).includes("futura"), "una fecha de autorización futura se rechaza");
await p.fill("#campo-consentimientoFecha", "2026-11-02");
await guardar(p);
revisar((await nombres(p, "lista-equipo")).join() === "Rosa Pérez", "con fecha y autorización la persona se agrega");
revisar(await p.locator("#lista-equipo button", { hasText: "Ocultar" }).count() === 0, "a las personas no se les ofrece Ocultar (solo Quitar), porque ocultar no borra sus datos");

// ---- 7. Fotos: reducir, quitar datos ocultos y pedir descripción
await p.click("#agregar-galeria");
await guardar(p);
revisar((await p.textContent("#form-errores")).includes("Foto") && (await p.textContent("#form-errores")).includes("Descripción"), "la foto es obligatoria y pide su descripción");
await p.setInputFiles("#campo-archivo", { name: "IMG 001.PNG", mimeType: "image/png", buffer: PIXEL });
await esperar(p, () => document.querySelector("#campo-archivo").closest(".campo").textContent.includes("Foto lista"));
revisar((await p.textContent("#form-campos")).includes("sin datos de ubicación"), "avisa que la foto se prepara sin datos de ubicación");
await p.fill("#campo-alt", "El patio central");
await p.selectOption("#campo-seccion", "instalaciones");
await guardar(p);
revisar((await nombres(p, "lista-galeria")).join() === "El patio central", "la foto se agrega con su descripción");
revisar((await p.locator("#lista-galeria img").getAttribute("src")).startsWith("blob:"), "se ve su miniatura");

await p.click("#agregar-galeria");
await p.setInputFiles("#campo-archivo", { name: "persona.png", mimeType: "image/png", buffer: Buffer.concat([PIXEL, Buffer.from([0])]) });
await esperar(p, () => document.querySelector("#campo-archivo").closest(".campo").textContent.includes("Foto lista") || document.querySelector("#campo-archivo").closest(".campo").textContent.includes("No se pudo"));
await p.fill("#campo-alt", "Dos estudiantes");
await p.check("#campo-personas");
await guardar(p);
revisar((await p.textContent("#form-errores")).includes("firmaron"), "una foto donde aparecen personas exige marcar su autorización");
await p.click("#form-cancelar");
revisar((await nombres(p, "lista-galeria")).length === 1, "cancelar no agrega nada");

await p.click("#agregar-galeria");
await p.setInputFiles("#campo-archivo", { name: "x.txt", mimeType: "text/plain", buffer: Buffer.from("no soy foto") });
await p.waitForTimeout(200);
revisar((await p.textContent("#form-campos")).includes("no es una imagen"), "un archivo que no es imagen se rechaza");
await p.click("#form-cancelar");

// ---- 8. Textos del sitio
await p.click("#editar-sitio");
await p.fill("#campo-contacto-telefono", "abc");
await guardar(p);
revisar((await p.textContent("#form-errores")).includes("Teléfono"), "un teléfono con letras se rechaza");
await p.fill("#campo-contacto-telefono", "618 455 0146");
await p.fill("#campo-mision", "Nuestra misión.");
await p.fill("#campo-historia", "Primer párrafo.\n\nSegundo párrafo.");
await p.fill("#campo-contacto-enlaces", "Facebook | https://facebook.com/cecapi\nMalo | javascript:alert(1)");
await guardar(p);
revisar((await p.textContent("#form-errores")).includes("enlace"), "un enlace que no es https se rechaza");
await p.fill("#campo-contacto-enlaces", "Facebook | https://facebook.com/cecapi");
await p.check("#campo-revisado-contacto");
await guardar(p);
revisar(await p.isHidden("#dialogo-form") && (await p.textContent("#resumen-sitio")).includes("2 párrafos"), "los textos del sitio se guardan");

// ---- 9. XSS en lo que se escribe
await p.click("#agregar-servicios");
await p.fill("#campo-nombre", "<img src=x onerror=window.__a=1>");
await guardar(p);
revisar(!(await p.evaluate(() => window.__a)) && (await nombres(p, "lista-servicios")).at(-1).startsWith("<img"), "el HTML escrito en un nombre se muestra como texto y no se ejecuta");
await p.getByRole("button", { name: /^Quitar <img/ }).click();
await confirmarSi(p, () => ![...document.querySelectorAll("#lista-servicios .titulo")].some((t) => t.textContent.startsWith("<img")));

// ---- 10. Revisar y publicar
const resumen = await p.locator("#resumen li").allTextContents();
revisar(resumen.some((l) => l.includes("Servicios") && l.includes("Taller de lectura") && l.includes("Yoga")), "el resumen dice qué servicios se agregaron y cuáles se quitaron");
revisar(resumen.some((l) => l.includes("Textos del sitio")) && resumen.some((l) => l.includes("Rosa Pérez")) && resumen.some((l) => l.includes("fotos que ya no se usan") || l.includes("foto que ya no se usa")), "el resumen incluye textos, equipo y la foto que se va a borrar");
await p.fill("#mensaje", "Actualización de prueba");
await p.click("#publicar");
await esperar(p, () => document.getElementById("resultado").textContent.length > 20 && !document.getElementById("resultado").textContent.includes("Publicando"));
revisar((await p.textContent("#resultado")).startsWith("Listo"), "publicar termina con un aviso de éxito");
revisar(gh.commits.length === 1 && gh.parches.length === 1, "se hizo UN solo commit y UNA sola actualización de la rama");
const entradas = gh.arboles[0].tree;
const rutas = entradas.map((e) => e.path).sort();
revisar(rutas.includes("datos/servicios.v1.json") && rutas.includes("datos/sitio.v1.json") && rutas.includes("datos/equipo.v1.json") && rutas.includes("datos/galeria.v1.json"), "el commit lleva los 4 archivos de datos que cambiaron");
const nueva = entradas.find((e) => /^assets\/fotos\/img-001-[0-9a-f]{10}\.(webp|jpg)$/.test(e.path));
revisar(!!nueva && gh.blobs.get(nueva.sha).subarray(8, 12).toString() === "WEBP", "la foto nueva se sube como WebP con un nombre limpio");
revisar(entradas.some((e) => e.path === "assets/fotos/viejo.webp" && e.sha === null), "la foto del servicio que se quitó se borra");
revisar(!entradas.some((e) => e.path === "assets/fotos/LEEME.txt"), "no se toca nada más del repositorio");
revisar(gh.commits[0].parents.join() === "c1" && gh.commits[0].message.includes("Actualización de prueba") && gh.parches[0].force === false, "el commit cuelga del anterior, lleva la nota y no fuerza la rama");
const servFinal = JSON.parse(gh.archivos.get("datos/servicios.v1.json").toString()).servicios;
revisar(servFinal.some((s) => s.nombre === "Taller de lectura") && !servFinal.some((s) => s.nombre === "Yoga") && servFinal.length === 8, "el archivo de servicios publicado tiene los cambios");
const equipoFinal = JSON.parse(gh.archivos.get("datos/equipo.v1.json").toString()).personas;
revisar(equipoFinal.length === 1 && equipoFinal[0].consentimiento === true && equipoFinal[0].consentimientoFecha === "2026-11-02", "la persona se publica con su autorización y la fecha");
const galeriaFinal = JSON.parse(gh.archivos.get("datos/galeria.v1.json").toString()).fotos;
revisar(galeriaFinal.length === 1 && galeriaFinal[0].seccion === "instalaciones" && galeriaFinal[0].archivo === nueva.path, "el archivo de fotos queda apuntando a la foto subida");
revisar((await estado(p)).includes("No hay cambios") && await p.isDisabled("#publicar"), "después de publicar ya no hay cambios pendientes");
revisar(!JSON.stringify([...gh.blobs.values()].map((b) => b.toString())).includes(LLAVE) && !JSON.stringify(gh.commits).includes(LLAVE), "la llave no viaja en ningún contenido publicado");
revisar(p.errores.length === 0, "sin errores de JavaScript ni de la política de seguridad");

// ---- 11. Un segundo cambio cuelga del commit nuevo
await p.getByRole("button", { name: "Ocultar Cocina" }).click();
await p.click("#publicar");
await esperar(p, () => document.getElementById("resultado").textContent.startsWith("Listo") && document.getElementById("publicar").disabled);
revisar(gh.commits.length === 2 && gh.commits[1].parents.join() === "c2", "el segundo cambio se apoya en el commit que acabamos de publicar");
revisar(gh.arboles[1].tree.length === 1 && gh.arboles[1].tree[0].path === "datos/servicios.v1.json", "la segunda publicación solo lleva el archivo que cambió (no vuelve a subir las fotos)");
await p.context().close();

// ---- 12. Conflicto: alguien más publicó mientras se editaba
gh = await crearGitHub();
p = await abrir({ gh });
await conectar(p);
await p.getByRole("button", { name: "Ocultar Cocina" }).click();
gh.cabezaAjena = "c9";
await p.click("#publicar");
await esperar(p, () => document.getElementById("resultado").textContent.length > 5 && document.getElementById("resultado").textContent !== "Publicando…");
revisar((await p.textContent("#resultado")).includes("Alguien más publicó") && gh.commits.length === 0, "si la rama cambió, avisa y no publica nada");
revisar((await estado(p)).includes("Hay cambios"), "los cambios del editor se conservan para no perder el trabajo");

// ---- 12b. GitHub falla a la mitad: no queda nada a medias y no se pierde el trabajo
gh.cabezaAjena = null;
gh.fallar = "/git/blobs";
await p.click("#publicar");
await esperar(p, () => document.getElementById("resultado").textContent.length > 5 && document.getElementById("resultado").textContent !== "Publicando…");
revisar((await p.textContent("#resultado")).includes("código 500") && gh.parches.length === 0 && gh.commits.length === 0, "si GitHub falla antes del commit, avisa y la rama no cambia");
revisar(!(await p.isDisabled("#publicar")) && (await estado(p)).includes("Hay cambios"), "se puede reintentar y los cambios siguen ahí");
gh.fallar = null;
await p.click("#publicar");
await esperar(p, () => document.getElementById("resultado").textContent.startsWith("Listo"));
revisar(gh.commits.length === 1 && gh.parches.length === 1, "al reintentar se publica una sola vez");

// ---- 13. Descartar y cerrar sesión
await p.getByRole("button", { name: "Ocultar Computación" }).click();
await p.click("#descartar");
await confirmarSi(p, () => document.getElementById("estado-cambios").textContent.includes("No hay cambios"));
revisar((await estado(p)).includes("No hay cambios") && (await p.locator("#lista-servicios li.oculto").count()) === 1 && await p.getByRole("button", { name: "Mostrar Cocina" }).count() === 1, "Descartar regresa todo a lo último que se publicó");
await p.getByRole("button", { name: "Ocultar Computación" }).click();
await p.click("#cerrar-sesion");
revisar(await p.isVisible("#dialogo-confirmar") && (await p.textContent("#confirmar-texto")).includes("se perderán"), "cerrar sesión con cambios pide confirmación");
await confirmarSi(p, () => !document.getElementById("conexion").hidden);
revisar(await p.isVisible("#conexion") && await p.isHidden("#editor") && (await p.inputValue("#llave")) === "", "cerrar sesión regresa a la pantalla de conectar");
await p.context().close();

// ---- 14. Archivos dañados en el repositorio
gh = await crearGitHub();
gh.archivos.set("datos/servicios.v1.json", Buffer.from("{no es json"));
p = await abrir({ gh });
await conectar(p);
revisar((await p.textContent("#llave-error")).includes("dañado") && await p.isHidden("#editor"), "un archivo dañado se avisa y no se sobrescribe");
await p.context().close();

gh = await crearGitHub();
gh.archivos.delete("datos/equipo.v1.json");
p = await abrir({ gh });
await conectar(p);
revisar(await p.isVisible("#editor") && (await nombres(p, "lista-equipo")).length === 0, "un archivo que todavía no existe se empieza vacío");
await p.context().close();

// ---- 15. Accesibilidad con el editor abierto y con el formulario abierto
gh = await crearGitHub();
p = await abrir({ gh, bypassCSP: true });
await conectar(p);
await p.addScriptTag({ path: AXE });
const axe = () => p.evaluate(() => window.axe.run(document, { runOnly: ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"] }));
let r = await axe();
revisar(r.violations.length === 0, "axe: el editor abierto no tiene violaciones" + (r.violations.length ? " -> " + r.violations.map((v) => `${v.id} (${v.nodes.length})`).join(", ") : ""));
await p.click("#editar-sitio");
r = await axe();
revisar(r.violations.length === 0, "axe: el formulario de los textos del sitio no tiene violaciones" + (r.violations.length ? " -> " + r.violations.map((v) => `${v.id} (${v.nodes.length})`).join(", ") : ""));
await p.click("#form-cancelar");
await p.click("#agregar-equipo");
r = await axe();
revisar(r.violations.length === 0, "axe: el formulario de una persona no tiene violaciones" + (r.violations.length ? " -> " + r.violations.map((v) => `${v.id} (${v.nodes.length})`).join(", ") : ""));
await p.keyboard.press("Escape");
revisar(await p.isHidden("#dialogo-form"), "Escape cierra el formulario");
await p.context().close();

await navegador.close();
servidor.close();
process.exit(fallas ? 1 : 0);
