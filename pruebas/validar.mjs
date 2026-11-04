// Pruebas de las reglas del contenido editable (assets/js/validar.v1.js), sin navegador.
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const V = require("../assets/js/validar.v1.js");

let fallas = 0;
const revisar = (ok, d) => { console.log(`${ok ? "bien " : "FALLA"} ${d}`); if (!ok) fallas++; };
const problemas = (entidad, o) => V.validar(entidad, o).map((p) => p.clave);

const servicio = (cambios = {}) => ({ ...V.crear("servicio"), id: "cocina", nombre: "Cocina", ...cambios });
const persona = (cambios = {}) => ({ ...V.crear("persona"), id: "ana", nombre: "Ana", cargo: "Maestra", consentimiento: true, consentimientoFecha: "2026-11-01", ...cambios });
const foto = (cambios = {}) => ({ ...V.crear("foto"), archivo: "assets/fotos/grupo.webp", alt: "Grupo de estudiantes", ...cambios });

// Servicios
revisar(problemas("servicio", servicio()).length === 0, "un servicio solo con nombre es válido");
revisar(problemas("servicio", servicio({ nombre: "" })).includes("nombre"), "el servicio sin nombre se rechaza");
revisar(problemas("servicio", servicio({ nombre: "   " })).includes("nombre"), "el nombre de solo espacios se rechaza");
revisar(problemas("servicio", servicio({ nombre: "x".repeat(61) })).includes("nombre"), "el nombre de 61 caracteres se rechaza");
revisar(problemas("servicio", servicio({ foto: "assets/fotos/a.webp", fotoAlt: "" })).includes("fotoAlt"), "una foto sin descripción se rechaza");
revisar(problemas("servicio", servicio({ foto: "assets/fotos/a.webp", fotoAlt: "Clase de cocina" })).length === 0, "una foto con descripción es válida");
revisar(problemas("servicio", servicio({ foto: "https://externo.example/a.png", fotoAlt: "x" })).includes("foto"), "una foto de otro sitio se rechaza");
revisar(problemas("servicio", servicio({ foto: "assets/fotos/../../secreto.png", fotoAlt: "x" })).includes("foto"), "una foto con .. se rechaza");
revisar(problemas("servicio", servicio({ nombre: "a\u0000b" })).includes("nombre"), "un carácter nulo se rechaza");
revisar(problemas("servicio", servicio({ publicado: "si" })).includes("publicado"), "publicado debe ser sí o no");
revisar(problemas("servicio", null).length === 1 && problemas("servicio", []).length === 1 && problemas("servicio", "x").length === 1, "null, arreglo y texto no son servicios");

// Personas: sin autorización no se publica nada
revisar(problemas("persona", persona()).length === 0, "una persona con autorización es válida");
revisar(problemas("persona", persona({ consentimiento: false })).includes("consentimiento"), "sin autorización firmada se rechaza");
revisar(problemas("persona", persona({ consentimiento: "true" })).includes("consentimiento"), "la autorización como texto no cuenta");
revisar(problemas("persona", persona({ consentimientoFecha: "" })).includes("consentimientoFecha"), "sin fecha de autorización se rechaza");
revisar(problemas("persona", persona({ consentimientoFecha: "2099-01-01" })).includes("consentimientoFecha"), "una fecha futura se rechaza");
revisar(problemas("persona", persona({ consentimientoFecha: "2026-13-45" })).includes("consentimientoFecha"), "una fecha imposible se rechaza");
revisar(problemas("persona", persona({ cargo: "" })).includes("cargo"), "sin cargo se rechaza");

// Fotos
revisar(problemas("foto", foto()).length === 0, "una foto de instalaciones sin personas es válida");
revisar(problemas("foto", foto({ alt: "" })).includes("alt"), "una foto sin descripción se rechaza");
revisar(problemas("foto", foto({ personas: true })).includes("consentimiento"), "una foto con personas y sin autorización se rechaza");
revisar(problemas("foto", foto({ personas: true, consentimiento: true })).length === 0, "una foto con personas y autorización es válida");
revisar(problemas("foto", foto({ seccion: "otra" })).includes("seccion"), "una sección inventada se rechaza");
revisar(problemas("foto", foto({ archivo: "javascript:alert(1)" })).includes("archivo"), "javascript: no es una foto");
revisar(problemas("foto", foto({ archivo: "assets/fotos/x.png?a=//evil" })).includes("archivo"), "una foto con ? se rechaza");

// Sitio
const sitio = (cambios = {}) => ({ ...V.crear("sitio"), lema: "Lema", ...cambios });
revisar(problemas("sitio", sitio()).length === 0, "el sitio con solo el lema es válido");
revisar(problemas("sitio", sitio({ lema: "" })).includes("lema"), "sin lema se rechaza");
revisar(problemas("sitio", sitio({ historia: ["a", ""] })).includes("historia"), "un párrafo vacío en la historia se rechaza");
revisar(problemas("sitio", sitio({ historia: Array(13).fill("a") })).includes("historia"), "más de 12 párrafos se rechaza");
revisar(problemas("sitio", sitio({ contacto: { telefono: "abc" } })).includes("contacto.telefono"), "un teléfono con letras se rechaza");
revisar(problemas("sitio", sitio({ contacto: { telefono: "618 455 0146" } })).length === 0, "un teléfono normal es válido");
revisar(problemas("sitio", sitio({ contacto: { correo: "no-es-correo" } })).includes("contacto.correo"), "un correo sin arroba se rechaza");
revisar(problemas("sitio", sitio({ contacto: { correo: "a@b.co?cc=otro@x.com" } })).includes("contacto.correo"), "un correo con ? o = se rechaza (no se cuelan destinatarios en mailto:)");
revisar(problemas("sitio", sitio({ contacto: { enlaces: [{ nombre: "Facebook", url: "http://fb.com/x" }] } })).includes("contacto.enlaces"), "un enlace sin https se rechaza");
revisar(problemas("sitio", sitio({ contacto: { enlaces: [{ nombre: "X", url: "javascript:alert(1)" }] } })).includes("contacto.enlaces"), "un enlace javascript: se rechaza");
revisar(problemas("sitio", sitio({ contacto: { enlaces: [{ nombre: "X", url: "https://usuario:clave@sitio.example/" }] } })).includes("contacto.enlaces"), "un enlace con usuario y clave se rechaza");
revisar(problemas("sitio", sitio({ contacto: { enlaces: Array(6).fill({ nombre: "X", url: "https://a.example/" }) } })).includes("contacto.enlaces"), "más de 5 enlaces se rechaza");
revisar(problemas("sitio", sitio({ contacto: { enlaces: [{ nombre: "Facebook", url: "https://facebook.com/cecapi" }] } })).length === 0, "un enlace https es válido");

// Normalizar lo que llega al sitio público: se queda con lo válido y no se cae con basura
revisar(V.normalizarSitio(null) === null && V.normalizarSitio([]) === null && V.normalizarSitio({ version: 2 }) === null, "un archivo de sitio sin versión 1 se ignora");
const n = V.normalizarSitio({ version: 1, lema: "Hola", mision: 5, historia: ["Uno", ""], contacto: { telefono: "x", horario: "L-V" } });
revisar(n.lema === "Hola" && n.mision === "" && n.historia.length === 0 && n.contacto.telefono === "" && n.contacto.horario === "L-V", "los campos malos se descartan y los buenos se quedan");
revisar(V.normalizarServicios({ version: 1, servicios: [servicio(), servicio({ nombre: "" }), servicio({ id: "b", nombre: "B", publicado: false }), null, 5] }).length === 1, "solo se muestran los servicios válidos y publicados");
revisar(V.normalizarServicios({ version: 1, servicios: "x" }) === null && V.normalizarServicios(null) === null, "una lista rota de servicios se ignora");
revisar(V.normalizarEquipo({ version: 1, personas: [persona(), persona({ consentimiento: false })] }).length === 1, "una persona sin autorización no se muestra");
revisar(V.normalizarFotos({ fotos: [foto(), foto({ personas: true }), foto({ archivo: "../x.png" })] }).length === 1, "una foto con personas sin autorización no se muestra");
revisar(V.normalizarFotos({ fotos: [{ archivo: "assets/fotos/g.png", alt: "Grupo" }] }).length === 1, "el formato anterior de fotos (sin sección) se sigue aceptando");

// Identificadores
revisar(V.identificador("Educación física", []) === "educacion-fisica", "el identificador quita acentos y espacios");
revisar(V.identificador("Cocina", ["cocina"]) === "cocina-2" && V.identificador("Cocina", ["cocina", "cocina-2"]) === "cocina-3", "los identificadores no se repiten");
revisar(V.identificador("¡¡¡", []) === "elemento", "un nombre sin letras recibe un identificador");

// Validar todo junto
const todo = { sitio: sitio(), servicios: { servicios: [servicio(), servicio()] }, equipo: { personas: [] }, galeria: { fotos: [foto(), foto()] } };
const t = V.validarTodo(todo);
revisar(t.length === 2 && t.some((p) => p.donde === "Servicios") && t.some((p) => p.donde === "Fotos"), "se detectan servicios y fotos repetidos");

process.exit(fallas ? 1 : 0);
