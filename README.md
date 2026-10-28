# Sitio institucional de CECAPI

Sitio informativo del Centro de Capacitación para Invidentes A. C. (Durango). Está pensado para personas ciegas y con baja visión, y enlaza al asistente de voz y a las descargas de las apps.

La ficha del proyecto está en `docs/FICHA.md` y las reglas comunes del ecosistema en `docs/FICHA_GLOBAL.md`.

## Qué hay

| Archivo | Qué es |
|---|---|
| `index.html` | Inicio: quiénes somos, servicios, contacto, enlace al asistente |
| `aviso-privacidad.html` | Aviso de privacidad del sitio (borrador) |
| `terminos.html` | Términos de uso (borrador) |
| `404.html` | Página de error. Usa `<base href="/PaginaCECAPI/">`: si se cambia a un dominio propio, cambiar a `<base href="/">` |
| `assets/css/sitio.v3.css` | Estilos. Colores en variables de `:root`, con tema oscuro y contraste alto |
| `assets/js/preferencias.v3.js` | Tema (automático, claro u oscuro), tamaño de texto y contraste alto (se guardan solo en el navegador) |
| `assets/js/lectura.v1.js` | Botón "Escuchar esta página" con la voz del navegador |
| `assets/fuentes/` | Atkinson Hyperlegible, licencia SIL OFL 1.1 (`LICENCIA-OFL.txt`) |
| `pruebas/` | Servidor local y revisión automática |

No hay PHP, ni compilación, ni dependencias en el navegador. La fuente está en el propio sitio para no mandar la IP de las visitas a otro servidor.

## Lo que falta (depende de CECAPI)

Los textos marcados con recuadro amarillo (clase `pendiente`) son datos que CECAPI debe dar o confirmar:

- Descripción oficial (quiénes son) y lista de servicios.
- Dirección, teléfono y horario: tomados de Google Maps el 24 oct 2026, sin confirmar.
- Responsable de los datos en el aviso de privacidad.
- Revisión del aviso y los términos por un asesor legal.
- Dominio y paleta definitiva. Los enlaces al asistente apuntan a `fernandezquintanajose.github.io/PaginaAsistenteCECAPI/` hasta que haya dominio.

## Probar en local

Requiere Node 18 o más reciente.

```
npm install
npx playwright install chromium   # solo la primera vez
npm run servir     # abre http://localhost:8080/PaginaCECAPI/
npm run revisar    # consola, recursos rotos, axe (WCAG 2.2 AA) y ancho de 375 px, en claro, oscuro y contraste alto
```

Con `CAPTURAS=1 npm run revisar` guarda capturas en `capturas/` (ignorada por git).

La revisión automática no sustituye la prueba con lector de pantalla. Antes de publicar, recorrer el sitio con NVDA y Narrator en Windows y con TalkBack en Android: encabezados, enlace "Saltar al contenido", botones de ajustes y enlaces.

## Publicar

En GitHub: Settings, Pages, "Deploy from a branch", rama `main`, carpeta `/ (root)`.

### Caché

GitHub Pages no deja configurar encabezados de caché. Por eso los CSS y JS llevan versión en el nombre (`.v3`). Cuando cambien, se copian a `.v4` y se actualizan los enlaces en todas las páginas, para que nadie vea una versión vieja.

### Seguridad

Cada página trae una política de seguridad de contenido (CSP) en `<meta>`: solo se cargan archivos del propio sitio, sin scripts en línea. Si se agrega algo externo, hay que añadirlo a esa política. Antes de publicar, pasar la auditoría OWASP Top 10:2025 (configuración y enlaces).

## Reglas para quien mantenga el sitio

- Sin emojis (los lectores de pantalla los leen en voz alta).
- Toda imagen lleva texto alternativo; las decorativas, `aria-hidden="true"`.
- Un solo `h1` por página y encabezados en orden.
- Todo se debe poder usar con teclado y el foco debe verse.
- Nada de datos personales en el sitio ni en registros.
- No confirmar un dato de CECAPI que no haya confirmado CECAPI.
