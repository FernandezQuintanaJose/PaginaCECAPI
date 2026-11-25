// Prueba del contenido editable en la página de inicio: con los datos que trae el repositorio, con datos
// completos, con datos hostiles (HTML, enlaces peligrosos, personas sin autorización) y con archivos rotos.
import { createRequire } from "node:module";
import { servir } from "./servidor.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const PUERTO = 8095;
const URL_SITIO = `http://localhost:${PUERTO}/PaginaCECAPI/`;
const PIXEL = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

let fallas = 0;
const revisar = (ok, d) => { console.log(`${ok ? "bien " : "FALLA"} ${d}`); if (!ok) fallas++; };

const servidor = await servir(PUERTO);
const navegador = await chromium.launch();

// datos: { sitio, servicios, equipo, galeria }. Lo que no se pasa se queda con el archivo real del repositorio.
// Un valor { crudo, estado } simula un archivo dañado o ausente.
async function abrir(datos = {}) {
  const contexto = await navegador.newContext();
  const pagina = await contexto.newPage();
  const errores = [];
  pagina.on("pageerror", (e) => errores.push(e.message));
  for (const nombre of ["sitio", "servicios", "equipo", "galeria"]) {
    if (!(nombre in datos)) continue;
    await pagina.route(`**/datos/${nombre}.v1.json`, (r) => {
      const d = datos[nombre];
      if (d && d.crudo !== undefined) return r.fulfill({ status: d.estado ?? 200, contentType: "application/json", body: d.crudo });
      return r.fulfill({ json: d });
    });
  }
  await pagina.route("**/assets/fotos/**", (r) => r.fulfill({ contentType: "image/png", body: PIXEL }));
  await pagina.goto(URL_SITIO, { waitUntil: "networkidle" });
  pagina.errores = errores;
  return pagina;
}

const sitioBase = (c = {}) => ({
  version: 1, lema: "Lema de prueba", mision: "", vision: "", historia: [],
  contacto: { direccion: "", telefono: "", horario: "", correo: "", comoLlegar: "", enlaces: [] },
  revisado: { servicios: false, contacto: false }, ...c
});
const servicio = (c = {}) => ({ id: "x", nombre: "Servicio", descripcion: "", quien: "", horario: "", requisitos: "", foto: "", fotoAlt: "", publicado: true, ...c });
const persona = (c = {}) => ({ id: "p", nombre: "Ana", cargo: "Maestra", descripcion: "", foto: "", fotoAlt: "", consentimiento: true, consentimientoFecha: "2026-11-01", ...c });
const textos = (p, sel) => p.locator(sel).allTextContents().then((t) => t.map((x) => x.trim()));

// 1. Los archivos que trae el repositorio
let p = await abrir();
revisar((await p.locator(".lista-servicios li").count()) === 15, "con los datos del repositorio salen los 15 servicios");
revisar((await p.getAttribute("#contacto-datos a[href^='tel:']", "href")) === "tel:+526184550146", "el teléfono es un enlace para llamar");
revisar(await p.isVisible("#contacto-pendiente") && await p.isVisible("#servicios-pendiente") && await p.isVisible("#historia-pendiente"), "los avisos de por confirmar siguen visibles mientras no se confirme");
revisar(await p.isHidden("#quienes") && await p.isHidden("#instalaciones") && await p.isHidden("#equipo"), "las secciones sin contenido siguen ocultas");
revisar((await p.getAttribute("#contacto-datos a[href^='mailto:']", "href")) === "mailto:cecapi.ac@gmail.com", "el correo del triptico sale como enlace");
revisar((await p.textContent("#contacto-datos")).includes("De 3 a 7 de la tarde"), "el horario es el del triptico (3 a 7)");
revisar(await p.locator("#braille tbody tr").count() === 26, "el abecedario braille tiene las 26 letras");
revisar((await p.textContent("#braille tbody tr:first-child")).replace(/\s+/g, "") .startsWith("A1") && (await p.textContent("#braille tbody tr:last-child")).replace(/\s+/g, "").startsWith("Z1356"), "A es el punto 1 y Z son los puntos 1 3 5 6");
revisar(await p.isVisible("#familias-pendiente") && await p.locator("#familias li").count() === 7, "la seccion para familias muestra sus 7 senales y el aviso de por confirmar");
revisar(p.errores.length === 0, "sin errores de JavaScript");
await p.context().close();

// 2. Contenido completo
p = await abrir({
  sitio: sitioBase({
    lema: "Un lema nuevo.", mision: "Nuestra misión.", vision: "Nuestra visión.", historia: ["Primer párrafo.", "Segundo párrafo."],
    contacto: { direccion: "Calle Uno 12, Durango", telefono: "(618) 455 0146", horario: "L a V", correo: "hola@cecapi.example", comoLlegar: "Frente al parque",
      enlaces: [{ nombre: "Facebook", url: "https://facebook.com/cecapi" }] },
    revisado: { servicios: true, contacto: true }
  })
});
revisar((await p.textContent("#lema")) === "Un lema nuevo.", "se cambia la frase de presentación");
revisar(await p.isVisible("#quienes") && (await textos(p, "#quienes-texto h3")).join() === "Misión,Visión", "aparece Quiénes somos con misión y visión");
revisar(await p.locator('.navegacion a[href="./#quienes"]').count() === 1, "Quiénes somos se agrega al menú");
revisar((await textos(p, "#historia p:not(.pendiente)")).join("|") === "Primer párrafo.|Segundo párrafo.", "la historia reemplaza al aviso de pendiente");
revisar(await p.isHidden("#historia-pendiente"), "el aviso de la historia se esconde");
revisar(await p.isHidden("#contacto-pendiente") && await p.isHidden("#servicios-pendiente"), "al confirmar los datos desaparecen los avisos");
revisar((await p.getAttribute("#contacto-datos a[href^='mailto:']", "href")) === "mailto:hola@cecapi.example", "el correo es un enlace");
revisar((await p.getAttribute("#contacto-datos a[href^='tel:']", "href")) === "tel:+526184550146", "un teléfono con paréntesis y espacios sigue siendo enlace para llamar");
revisar((await p.getAttribute("#contacto-mapa", "href")).includes(encodeURIComponent("Calle Uno 12, Durango")), "el enlace al mapa usa la dirección nueva");
revisar((await p.textContent("#contacto-enlaces")).includes("Facebook") && (await p.getAttribute("#contacto-enlaces a", "href")) === "https://facebook.com/cecapi", "se muestran los enlaces de redes");
revisar(p.errores.length === 0, "sin errores de JavaScript");
await p.context().close();

// 3. Servicios
p = await abrir({
  servicios: { version: 1, servicios: [
    servicio({ id: "a", nombre: "Cocina", descripcion: "Se aprende a cocinar.", horario: "Martes 3 pm", requisitos: "Ninguno", foto: "assets/fotos/cocina.webp", fotoAlt: "Clase de cocina" }),
    servicio({ id: "b", nombre: "Computación" }),
    servicio({ id: "c", nombre: "Oculto", publicado: false }),
    servicio({ id: "d", nombre: "" }),
    servicio({ id: "e", nombre: "<img src=x onerror=window.__x=1>" }),
    null, 5
  ] }
});
revisar((await textos(p, ".lista-servicios > li")).length === 3, "se muestran los válidos y publicados (3) y se descartan los demás");
revisar((await p.textContent(".lista-servicios li.detallado h3")) === "Cocina" && (await p.textContent(".lista-servicios li.detallado dl")).includes("Martes 3 pm"), "un servicio con detalles se muestra como tarjeta con su horario");
revisar((await p.getAttribute(".lista-servicios img", "alt")) === "Clase de cocina", "la foto del servicio lleva su descripción");
revisar(!(await p.evaluate(() => window.__x)) && await p.locator(".lista-servicios li img[src='x']").count() === 0, "el HTML escrito en un nombre no se ejecuta");
revisar(!(await p.textContent(".lista-servicios")).includes("Oculto"), "un servicio oculto no aparece");
await p.context().close();

p = await abrir({ servicios: { version: 1, servicios: [servicio({ publicado: false })] } });
revisar(await p.isHidden(".lista-servicios"), "si todos los servicios están ocultos, la lista no se ve (no regresa la vieja)");
await p.context().close();

// 4. Equipo y autorizaciones
p = await abrir({ equipo: { version: 1, personas: [persona(), persona({ id: "q", nombre: "Sin permiso", consentimiento: false }), persona({ id: "r", nombre: "Con foto", foto: "assets/fotos/r.webp", fotoAlt: "Retrato de Rosa" })] } });
revisar(await p.isVisible("#equipo") && (await textos(p, "#equipo h4")).join() === "Ana,Con foto", "se muestran las personas con autorización y no la que no la tiene");
revisar((await p.getAttribute("#equipo img", "alt")) === "Retrato de Rosa", "el retrato lleva su descripción");
await p.context().close();

// 5. Fotos: sección de instalaciones y autorización de quienes aparecen
p = await abrir({ galeria: { fotos: [
  { archivo: "assets/fotos/g1.png", alt: "Grupo", seccion: "gente" },
  { archivo: "assets/fotos/g2.png", alt: "Sin permiso", personas: true, consentimiento: false },
  { archivo: "assets/fotos/g3.png", alt: "Con permiso", personas: true, consentimiento: true },
  { archivo: "assets/fotos/i1.png", alt: "El patio", seccion: "instalaciones", pie: "Patio central" }
] } });
revisar((await p.locator("#galeria img").count()) === 2, "Nuestra gente muestra la foto normal y la que tiene autorización (2), no la que no la tiene");
revisar(await p.isVisible("#instalaciones") && (await p.locator("#instalaciones-galeria img").count()) === 1, "aparece Instalaciones con su foto");
revisar(await p.locator('.navegacion a[href="./#instalaciones"]').count() === 1, "Instalaciones se agrega al menú");
revisar(await p.isHidden("#galeria-aviso"), "con fotos desaparece el aviso de fotos pendientes");
await p.context().close();

// 6. Datos hostiles
p = await abrir({ sitio: sitioBase({
  lema: "<script>window.__y=1</script>Lema", historia: ["<img src=x onerror=window.__y=2>"],
  contacto: { telefono: "javascript:alert(1)", correo: "a@b.co?cc=otro@x.com", enlaces: [{ nombre: "Malo", url: "javascript:alert(1)" }], direccion: "Calle <b>1</b>" }
}) });
revisar(!(await p.evaluate(() => window.__y)), "el HTML y los scripts en los textos no se ejecutan");
revisar((await p.textContent("#lema")).includes("<script>"), "el HTML se muestra como texto");
revisar(await p.locator("#contacto-datos a[href^='javascript']").count() === 0 && await p.locator("#contacto-enlaces a").count() === 0, "un enlace javascript: se descarta");
revisar(await p.locator("#contacto-datos a[href^='mailto']").count() === 0, "un correo con parámetros se descarta");
await p.context().close();

// 7. Archivos dañados: se queda el texto fijo de la página
p = await abrir({ sitio: { crudo: "{no es json" }, servicios: { crudo: "", estado: 404 }, equipo: { crudo: "<html>", estado: 200 }, galeria: { crudo: "null" } });
revisar((await p.locator(".lista-servicios li").count()) === 15 && await p.isVisible("#historia-pendiente") && await p.isHidden("#equipo"), "con archivos dañados o ausentes la página sigue como estaba");
revisar(p.errores.length === 0, "y sin errores de JavaScript");
await p.context().close();

p = await abrir({ sitio: { version: 2, lema: "Otra versión" }, servicios: { version: 3, servicios: [servicio()] } });
revisar((await p.textContent("#lema")).startsWith("Asociación civil") && (await p.locator(".lista-servicios li").count()) === 15, "un archivo de otra versión se ignora");
await p.context().close();

await navegador.close();
servidor.close();
process.exit(fallas ? 1 : 0);
