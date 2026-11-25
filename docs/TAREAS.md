# Tareas del equipo — Sitio CECAPI

Semana del 4 al 11 nov 2026. Cada tarea dice qué hacer, dónde y cuándo está terminada. Si algo no se puede verificar, se marca **SIN VERIFICAR**: no se inventa.

## Cómo empezar (15 min)

```
git clone https://github.com/FernandezQuintanaJose/PaginaCECAPI.git
cd PaginaCECAPI
git checkout main                           # el trabajo ya está en main
npm install
npx playwright install chromium
npm run probar                              # debe terminar sin FALLA
npm run servir                              # http://localhost:8080/PaginaCECAPI/
```

Reglas de trabajo:
- Una rama por tarea: `tarea/<nombre-corto>`. Pull request a `main`. No se sube directo a `main`.
- Antes de cada pull request: `npm run probar` sin fallas.
- Si cambias un `.css` o `.js`, súbele la versión al nombre (`sitio.v5.css` → `sitio.v6.css`) y actualiza los enlaces en **todas** las páginas. Si no, el navegador usa la copia vieja.
- No agregar tablas, servidores ni dependencias sin hablarlo: el diseño y sus razones están en [CONTENIDO.md](CONTENIDO.md).
- No subir llaves, claves ni fotos sin permiso por escrito.

## Prioridad 1 — Sin esto no se puede entregar

| # | Tarea | Dónde | Hecho cuando |
|---|---|---|---|
| P1 | **Probar la publicación real del editor** en una copia del repositorio (no en el de CECAPI): crear una llave fine-grained solo con *Contents: Read and write*, cambiar `REPO` en `assets/js/admin.v1.js`, agregar, editar, ocultar y quitar un servicio, subir una foto, publicar. | `admin/`, `assets/js/admin.v1.js` | Los cambios aparecen en el sitio, el commit trae un solo autor y las fotos suben reducidas. Anotar en `docs/CONTENIDO.md` qué pasó y qué falló. Si falla algo, abrir un issue con captura. |
| P2 | **Activar Pages** (Settings, Pages, rama `main`, carpeta raíz). El código ya está en `main`. | GitHub | El sitio abre en la URL de Pages y `npm run revisar` pasa contra ella. |
| P3 | **Contenido de CECAPI**: pasar lo que respondan a `datos/*.json` mediante el editor (no a mano). Ver [SOLICITUD_A_CECAPI.md](SOLICITUD_A_CECAPI.md). | `datos/` | Ningún recuadro `pendiente` visible que CECAPI ya haya confirmado. **No escribir lo que no confirmaron.** |
| P4 | **Aviso de privacidad y términos**: llenar los datos entre corchetes y dar a revisión legal. | `politicas.html` | Sin corchetes. La revisión legal queda por escrito. |

## Prioridad 2 — Que se vea y se use bien

| # | Tarea | Dónde | Hecho cuando |
|---|---|---|---|
| D1 | **Revisión visual con la gente de CECAPI**: tamaños de letra, contraste, espacios, versión celular y versión grande. Proponer cambios sin romper el contraste 4.5:1. | `assets/css/sitio.v5.css`, `contenido.v1.css` | Capturas antes y después. `npm run revisar` sigue pasando (incluye axe WCAG 2.2 AA). |
| D2 | **Fotos reales** del plantel y del personal, con texto alternativo y permiso firmado. Reducir con el editor, no a mano. | `admin/` | Cada foto con descripción y autorización registrada. Sin fotos de menores sin permiso del tutor. |
| D3 | **Probar con lector de pantalla**: NVDA y Narrator en Windows, TalkBack en Android. Recorrer inicio, servicios, equipo, galería, contacto y `admin/`. Anotar qué se escucha mal. | Todo el sitio | Lista de hallazgos en `docs/LECTORES.md` (crearlo) con navegador, versión y qué se escuchó. Las pruebas automáticas **no** sustituyen esto. |
| D4 | **Sin JavaScript**: decidir si el texto fijo de `index.html` se mantiene al día con `datos/`. | `index.html` | Decisión escrita en `docs/CONTENIDO.md`. |
| D5 | **Dominio propio** (si CECAPI lo compra): `<base href>` de `404.html` a `/`, actualizar `REPO` y CSP. | `404.html`, `admin.v1.js` | Todas las páginas cargan CSS y JS en el dominio nuevo. |

## Prioridad 3 — Si sobra tiempo

- Noticias o avisos, testimonios, donativos: **solo si CECAPI los pide** (ver partes A5 y A7 de la solicitud). Cada uno sería un archivo JSON más, como los demás.
- Probar la página en Safari de iPhone, Firefox y Edge. **SIN VERIFICAR** hoy: las pruebas automáticas usan Chromium.
- Pasar la solicitud a CECAPI a Word o PDF para imprimirla.

## Conectar con los demás equipos

- **Asistente web** (PaginaAsistenteCECAPI) y **Windows** (WindowsCECAPI): el sitio solo enlaza. La página de descargas la mantiene el equipo del asistente (`datos/descargas.v1.json`).
- **Servidor** (EstadiasAppMobil, `backend/`): este sitio no lo usa. Hallazgos abiertos del servidor en `docs/estado/2026-11-04-revision-qa-y-entrega.md` de ese repositorio.

## Entregable final

Sitio publicado, `npm run probar` sin fallas, `docs/ENTREGA.md` al día, lista de lo que quedó pendiente y por qué.
