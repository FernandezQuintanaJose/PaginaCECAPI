// Prueba del collage: con fotos válidas las muestra con su texto alternativo; con rutas
// peligrosas o sin texto alternativo las descarta; sin fotos deja los huecos.
import { createRequire } from "node:module";
import { servir } from "./servidor.mjs";

const require = createRequire(import.meta.url);
const { chromium } = require("playwright");
const PUERTO = 8093;
const URL_SITIO = `http://localhost:${PUERTO}/PaginaCECAPI/`;
const PIXEL = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");

let fallas = 0;
const revisar = (ok, d) => { console.log(`${ok ? "bien " : "FALLA"} ${d}`); if (!ok) fallas++; };

const servidor = await servir(PUERTO);
const navegador = await chromium.launch();

async function abrir(fotos) {
  const pagina = await (await navegador.newContext()).newPage();
  await pagina.route("**/datos/galeria.v1.json", (r) => r.fulfill({ json: { fotos } }));
  await pagina.route("**/assets/fotos/**", (r) => r.fulfill({ contentType: "image/png", body: PIXEL }));
  await pagina.goto(URL_SITIO, { waitUntil: "networkidle" });
  return pagina;
}

let p = await abrir([]);
revisar((await p.locator("#galeria .hueco").count()) === 6, "sin fotos quedan los huecos");
revisar(await p.isVisible("#galeria-aviso"), "sin fotos se ve el aviso de pendiente");
revisar((await p.locator("#galeria [aria-hidden=true]").count()) === 6, "los huecos están ocultos para el lector de pantalla");

p = await abrir([
  { archivo: "assets/fotos/grupo.png", alt: "Grupo de estudiantes en clase de computación", pie: "Clase de computación" },
  { archivo: "assets/fotos/sin-alt.png", alt: "" },
  { archivo: "../secreto.png", alt: "Ruta fuera de la carpeta" },
  { archivo: "https://externo.example/foto.png", alt: "Foto de otro sitio" }
]);
revisar((await p.locator("#galeria figure").count()) === 1, "solo se muestra la foto válida (sin alt y rutas raras se descartan)");
revisar((await p.getAttribute("#galeria img", "alt")) === "Grupo de estudiantes en clase de computación", "la foto lleva su texto alternativo");
revisar((await p.textContent("#galeria figcaption")) === "Clase de computación", "se muestra el pie de foto");
revisar(await p.isHidden("#galeria-aviso"), "con fotos se oculta el aviso");

await navegador.close();
servidor.close();
process.exit(fallas ? 1 : 0);
