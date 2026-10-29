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
| `assets/css/sitio.v4.css` | Estilos. Colores en variables de `:root`, con tema oscuro y contraste alto |
| `assets/js/preferencias.v4.js` | Tema (automático, claro u oscuro), tamaño de texto y contraste alto (se guardan solo en el navegador) |
| `assets/js/lectura.v2.js` | Botón "Escuchar esta página" con la voz del navegador |
| `assets/fuentes/` | Atkinson Hyperlegible, licencia SIL OFL 1.1 (`LICENCIA-OFL.txt`) |
| `assets/js/galeria.v1.js` | Collage de fotos: lee `datos/galeria.v1.json` |
| `datos/galeria.v1.json` | Lista de fotos (vacía por ahora) |
| `assets/fotos/` | Aquí van las fotos |
| `pruebas/` | Servidor local y pruebas |

No hay PHP, ni compilación, ni dependencias en el navegador. La fuente está en el propio sitio para no mandar la IP de las visitas a otro servidor.

## Lo que falta (depende de CECAPI)

Los textos con recuadro de color (clase `pendiente`) son datos que CECAPI debe dar o confirmar:

- **Historia:** año y motivo de la fundación, quiénes la fundaron, dónde empezó, cómo ha crecido y a cuántas personas ha atendido. No se escribió nada porque no se encontró información verificable (la página de Facebook no se pudo leer desde la sesión de trabajo).
- **Servicios:** la lista (cocina, encuadernación, educación física, computación, elaboración de piñatas, aprendizaje de ciclismo, orientación y movilidad) y el dato de que son gratuitos y de una institución sin fines de lucro los dio José el 29 oct 2026. Falta confirmar con CECAPI qué incluye cada uno, horarios, requisitos y si hay más.
- **Fotos del collage:** las entrega CECAPI. Cada foto necesita texto alternativo y el consentimiento por escrito de las personas que aparecen (una discapacidad puede revelar datos de salud, que son sensibles).
- **Contacto:** dirección, teléfono y horario salen de Google Maps (24 oct 2026). El directorio de Banxico lista el mismo domicilio con código postal 34234 (aquí es 34226) y un segundo teléfono, 618 455 4155. Confirmar cuál es correcto.
- Responsable de los datos en el aviso de privacidad y revisión por un asesor legal.
- Dominio. Los enlaces al asistente apuntan a `fernandezquintanajose.github.io/PaginaAsistenteCECAPI/` hasta entonces.

## Agregar fotos al collage

1. Guardar la foto en `assets/fotos/` (JPG o WebP, de preferencia de menos de 300 KB).
2. Agregarla en `datos/galeria.v1.json`:

```json
{
  "fotos": [
    { "archivo": "assets/fotos/grupo-computacion.jpg",
      "alt": "Seis estudiantes frente a computadoras, con su maestro al lado.",
      "pie": "Clase de computación" }
  ]
}
```

`alt` es obligatorio: es lo que escucha quien no ve la imagen. Describe qué hay en la foto, sin "imagen de". `pie` es opcional. La foto más grande del collage es la primera de la lista. Las rutas deben empezar con `assets/fotos/`. Cuando hay al menos una foto válida, los huecos desaparecen.

## Probar en local

Requiere Node 18 o más reciente.

```
npm install
npx playwright install chromium   # solo la primera vez
npm run servir     # abre http://localhost:8080/PaginaCECAPI/
npm run galeria    # el collage con fotos de prueba
npm run revisar    # consola, recursos rotos, axe (WCAG 2.2 AA) y 5 tamaños de pantalla y texto al 200 %, en claro, oscuro y contraste alto
```

Con `CAPTURAS=1 npm run revisar` guarda capturas en `capturas/` (ignorada por git).

La revisión automática no sustituye la prueba con lector de pantalla. Antes de publicar, recorrer el sitio con NVDA y Narrator en Windows y con TalkBack en Android: encabezados, enlace "Saltar al contenido", botones de ajustes y enlaces.

## Publicar

En GitHub: Settings, Pages, "Deploy from a branch", rama `main`, carpeta `/ (root)`.

### Caché

GitHub Pages no deja configurar encabezados de caché. Por eso los CSS y JS llevan versión en el nombre (`.v4`). Cuando cambien, se copian a `.v5` y se actualizan los enlaces en todas las páginas, para que nadie vea una versión vieja.

### Seguridad

Cada página trae una política de seguridad de contenido (CSP) en `<meta>`: solo se cargan archivos del propio sitio, sin scripts en línea. Si se agrega algo externo, hay que añadirlo a esa política. Antes de publicar, pasar la auditoría OWASP Top 10:2025 (configuración y enlaces).

## Reglas para quien mantenga el sitio

- Sin emojis (los lectores de pantalla los leen en voz alta).
- Toda imagen lleva texto alternativo; las decorativas, `aria-hidden="true"`.
- Un solo `h1` por página y encabezados en orden.
- Todo se debe poder usar con teclado y el foco debe verse.
- Nada de datos personales en el sitio ni en registros.
- No confirmar un dato de CECAPI que no haya confirmado CECAPI.
