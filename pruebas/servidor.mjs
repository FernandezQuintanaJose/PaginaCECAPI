// Servidor local que imita GitHub Pages: publica el sitio bajo /<prefijo>/ y usa 404.html.
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const PREFIJO = process.env.PREFIJO || "/PaginaCECAPI/";
const PUERTO = Number(process.env.PUERTO || 8080);
const TIPOS = { ".html": "text/html; charset=utf-8", ".css": "text/css", ".js": "text/javascript",
  ".json": "application/json", ".woff2": "font/woff2", ".svg": "image/svg+xml", ".txt": "text/plain; charset=utf-8" };

export function servir(puerto = PUERTO) {
  const servidor = createServer(async (pet, res) => {
    const ruta = decodeURIComponent(new URL(pet.url, "http://x").pathname);
    if (!ruta.startsWith(PREFIJO)) { res.writeHead(302, { Location: PREFIJO }); return res.end(); }
    let archivo = normalize(join(RAIZ, ruta.slice(PREFIJO.length)));
    if (!archivo.startsWith(RAIZ)) { res.writeHead(403); return res.end(); }
    if (archivo.endsWith("/")) archivo += "index.html";
    try {
      const datos = await readFile(archivo);
      res.writeHead(200, { "Content-Type": TIPOS[extname(archivo)] || "application/octet-stream" });
      res.end(datos);
    } catch {
      res.writeHead(404, { "Content-Type": TIPOS[".html"] });
      res.end(await readFile(join(RAIZ, "404.html")));
    }
  });
  return new Promise((ok) => servidor.listen(puerto, () => ok(servidor)));
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  await servir();
  console.log(`Sitio en http://localhost:${PUERTO}${PREFIJO}`);
}
