# Contenido editable del sitio

Cómo se cambian los textos, servicios, equipo y fotos de la página de inicio sin tocar código, y por qué está hecho así.

## En una frase

El contenido vive en archivos JSON dentro de este repositorio (`datos/`). El editor de `admin/` cambia esos archivos y las fotos con un solo commit, usando el permiso de escritura que GitHub ya controla. **No hay servidor propio, ni base de datos, ni tablas nuevas.**

## Por qué no hay base de datos

| Opción | Problema |
|---|---|
| Tablas en la base de Neon del servidor | Es la misma base de la app y del asistente (otros equipos). Un cambio de tablas ahí exige migraciones y pone en riesgo lo que ya funciona. |
| Leer el contenido desde el servidor de Render | El plan gratuito tarda cerca de un minuto en despertar. El sitio público no puede depender de eso, y menos para quien usa lector de pantalla. |
| Una cuenta de administrador propia | Las cuentas del servidor todavía no existen. Habría que construirlas antes, y la clave de la app no sirve: va dentro del APK y se puede extraer. |
| **Archivos JSON en el repositorio + editor** | El sitio sigue siendo estático y rápido, funciona sin servidor, y quien puede cambiar el sitio es quien tiene permiso en GitHub. Se escoge esta. |

El día que CECAPI necesite algo que un archivo no resuelve (por ejemplo, que el público envíe formularios), se evalúa aparte.

## Qué se guarda y por qué

Cada cosa existe porque una persona de CECAPI la va a cambiar de verdad. Lo que no tiene un caso de uso claro, no se creó.

| Archivo | Qué es | Operaciones | Casos de uso que lo justifican |
|---|---|---|---|
| `datos/sitio.v1.json` | Textos únicos: frase de presentación, misión, visión, historia, contacto y enlaces | **Solo editar** (no se agregan ni se quitan) | "Cambió el horario." "Escribimos nuestra historia por primera vez." "Corregimos el código postal." "Abrimos un Facebook." |
| `datos/servicios.v1.json` | Lista de servicios | Agregar, ver, editar, **ocultar**, quitar, ordenar | "Abrimos un taller nuevo." "El de ciclismo cambia de día." "Yoga se suspende en vacaciones y vuelve después" (se oculta, no se pierde el texto). "Ya no damos piñatas" (se quita). |
| `datos/equipo.v1.json` | Personas del equipo que aceptaron aparecer | Agregar, editar, **quitar**, ordenar | "Llegó una maestra nueva." "Cambió de cargo." "Pidió retirar su foto" (se quita; no hay Ocultar porque ocultar no borra sus datos del archivo). |
| `datos/galeria.v1.json` | Fotos de "Nuestra gente" y de "Instalaciones" | Agregar, editar su descripción, quitar, ordenar | "Tenemos fotos del evento." "La primera foto es la que se ve grande." "Esta foto no debe estar." |

Lo que **no** se creó, a propósito:

- **Noticias, testimonios, donativos:** CECAPI aún no dijo que los quiere (ver `SOLICITUD_A_CECAPI.md`, partes A5 y A7). Cuando lo pida, es un archivo y una sección más; no cambia nada de lo anterior.
- **Tabla de usuarios o de permisos:** el permiso es el de GitHub.
- **Tabla de fotos separada para servicios y equipo:** cada servicio y cada persona tiene a lo sumo una foto, y va dentro de su propio registro. Una tabla aparte solo habría traído problemas al borrar.
- **Bandera "publicado" en personas y fotos:** ocultar no borra los datos del archivo, que es público. Para ellas solo existe Quitar. En servicios sí hay Ocultar porque su información no es personal.

## Reglas que el editor y el sitio aplican igual

Están en `assets/js/validar.v1.js`; las prueba `npm run validar`.

- Toda foto lleva descripción (lo que escucha quien no ve la imagen).
- No se publica una persona sin "tengo su autorización firmada" y la fecha en que la firmó.
- Una foto donde se reconoce a personas no se muestra sin esa autorización marcada.
- Los enlaces deben empezar con `https://`. Un correo no puede traer `?` ni `=` (para que no se cuelen destinatarios).
- Los límites de largo (nombre 60, historia 12 párrafos, etc.) están en `CAMPOS`.
- El sitio **no confía** en los archivos: lo que no cumple las reglas se descarta, y si un archivo está roto la sección se queda con el texto fijo de `index.html`.

## Cómo se usa

1. Entrar a `https://<el sitio>/admin/`.
2. Pegar la llave de GitHub (token). Se pide cada vez y no se guarda: ni en el navegador ni en el sitio.
3. Agregar, editar, ordenar, ocultar o quitar. Los cambios solo viven en la pantalla hasta publicar.
4. En "Revisar y publicar" se ve un resumen de qué se agregó, cambió y quitó. "Publicar cambios" lo manda como un solo commit.
5. GitHub tarda unos minutos en actualizar el sitio.

### Quién puede editar

Quien tenga permiso de escritura en `PaginaCECAPI`. Lo recomendable: invitar como colaboradora a la persona de CECAPI que se encargue (cuenta propia de GitHub), y que cree **su propia llave** con estos datos:

- Fine-grained token, solo el repositorio `PaginaCECAPI`.
- Permiso **Contents: Read and write** y ningún otro.
- Con fecha de vencimiento corta.

No compartir una sola llave entre varias personas: el historial dejaría de decir quién cambió qué.

### Las fotos

Al elegir una foto, el navegador la reduce (máximo 1600 píxeles de lado, unos 300 KB) y la convierte a WebP. Ese paso **borra los datos ocultos de la foto**, como la ubicación donde se tomó. El nombre del archivo lleva una huella de su contenido, así que una foto repetida no se sube dos veces.

## Límites y cosas a saber

- **Quitar a una persona o foto no la borra del historial de GitHub.** Los archivos viejos siguen en commits anteriores. Si alguien retira su autorización, hay que pedir a quien mantiene el repositorio que reescriba el historial. Es una limitación de usar un repositorio y no una base de datos.
- **Dos personas editando a la vez:** la segunda en publicar recibe un aviso ("Alguien más publicó cambios…") y no se pisa nada. Cierra la sesión, vuelve a entrar y repite el cambio.
- **Sin JavaScript** la página muestra el texto fijo de `index.html`, no el de los archivos. Si cambia algo importante (contacto, servicios), conviene actualizar también `index.html` en la próxima revisión.
- **Los archivos son públicos.** No escribir ahí nada que no se pueda ver en el sitio.
- **Dominio propio:** si el sitio cambia de dueño o de nombre de repositorio, hay que actualizar `REPO` al inicio de `assets/js/admin.v1.js`, y `<base href>` de `404.html`.
- **El nombre de los menús de GitHub** para crear la llave puede cambiar; los pasos de `admin/index.html` son de noviembre de 2026.
- La API de GitHub la simulan las pruebas. **Falta probar una publicación real** con una llave de verdad (ver `ENTREGA.md`).

## Cómo se prueba

```
npm run validar     # reglas del contenido, sin navegador
npm run contenido   # la página de inicio con datos normales, hostiles y archivos rotos
npm run admin       # el editor completo contra una GitHub simulada (incluye axe)
npm run probar      # todo junto
```
