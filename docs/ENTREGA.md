# Entrega del sitio CECAPI (4 nov 2026)

Revisión completa, hallazgos de todo el ecosistema y orden sugerido para la semana: [docs/estado/2026-11-04-revision-qa-y-entrega.md](https://github.com/FernandezQuintanaJose/EstadiasAppMobil/blob/docs/revision-qa-4nov/docs/estado/2026-11-04-revision-qa-y-entrega.md) en EstadiasAppMobil (rama `docs/revision-qa-4nov`).

## Estado
- `npm run revisar` (88 comprobaciones) y `npm run galeria` (7) pasan.
- Se corrigió el servidor de pruebas local en Windows (la raíz daba 404).
- No hay secretos en el repositorio ni en su historial (búsqueda de claves y cadenas de conexión).

## Para entregar
1. Fusionar `qa/correcciones` a `main`.
2. Pedir a CECAPI y reemplazar los textos con recuadro `pendiente`: historia, qué incluye cada servicio, horarios y requisitos. No escribir lo que CECAPI no haya confirmado.
3. Contacto: confirmar código postal (34226 o 34234) y el segundo teléfono 618 455 4155.
4. Fotos: texto alternativo y permiso por escrito de quienes aparecen (ver README, "Agregar fotos al collage").
5. Aviso de privacidad y términos: revisión legal.
6. Probar con NVDA, Narrator y TalkBack (las pruebas automáticas no lo sustituyen).
7. Publicar: Settings, Pages, rama `main`, carpeta raíz. Con dominio propio, cambiar `<base href>` de `404.html` a `/`.
8. Si cambias un `.css` o `.js`, súbele la versión al nombre y actualiza los enlaces de todas las páginas (caché).

## Aviso
`npm run servir` sirve también `.git/` y `node_modules/`: úsalo solo en tu computadora.
