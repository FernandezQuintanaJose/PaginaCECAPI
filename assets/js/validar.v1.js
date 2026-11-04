// Reglas del contenido editable del sitio. Las usan dos lados con las mismas reglas:
// el sitio público (descarta lo que no cumple y deja el texto fijo de la página) y el editor
// de admin/ (le dice a la persona qué corregir antes de publicar).
// Sin dependencias ni acceso a la página: también se puede cargar en Node para las pruebas.
(function (raiz, fabrica) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = fabrica();
  else raiz.CecapiValidar = fabrica();
})(this, function () {
  "use strict";

  var RUTA_FOTO = /^assets\/fotos\/[\w.\-\/]+$/;
  var TELEFONO = /^[0-9+()\s.\-]{7,30}$/;
  // Sin ? & # = , ; para que el enlace mailto: no pueda agregar destinatarios ni texto.
  var CORREO = /^[^\s@?&#=,;]+@[^\s@?&#=,;]+\.[^\s@?&#=,;]+$/;
  var FECHA = /^\d{4}-\d{2}-\d{2}$/;

  // Cada campo dice cómo se pide y cómo se valida. El editor arma sus formularios con esta lista,
  // así que agregar un campo aquí lo agrega al formulario, a la validación y al sitio a la vez.
  var CAMPOS = {
    servicio: [
      { clave: "nombre", etiqueta: "Nombre del servicio", tipo: "texto", max: 60, requerido: true },
      { clave: "descripcion", etiqueta: "En qué consiste", tipo: "area", max: 600 },
      { clave: "quien", etiqueta: "Quién puede tomarlo", tipo: "texto", max: 200, ayuda: "Por ejemplo, edades o nivel de visión." },
      { clave: "horario", etiqueta: "Días y horario", tipo: "texto", max: 200 },
      { clave: "requisitos", etiqueta: "Requisitos para inscribirse", tipo: "texto", max: 300 },
      { clave: "foto", etiqueta: "Foto del servicio (opcional)", tipo: "imagen" },
      { clave: "fotoAlt", etiqueta: "Descripción de la foto", tipo: "texto", max: 200, requeridoSi: "foto",
        ayuda: "Lo que escucha quien no ve la foto. Obligatoria si hay foto." },
      { clave: "publicado", etiqueta: "Mostrar este servicio en el sitio", tipo: "check" }
    ],
    persona: [
      { clave: "nombre", etiqueta: "Nombre como quiere que se publique", tipo: "texto", max: 80, requerido: true },
      { clave: "cargo", etiqueta: "Cargo o función", tipo: "texto", max: 80, requerido: true },
      { clave: "descripcion", etiqueta: "Una o dos frases sobre su trabajo", tipo: "area", max: 300 },
      { clave: "foto", etiqueta: "Foto (opcional)", tipo: "imagen" },
      { clave: "fotoAlt", etiqueta: "Descripción de la foto", tipo: "texto", max: 200, requeridoSi: "foto",
        ayuda: "Lo que escucha quien no ve la foto. Obligatoria si hay foto." },
      { clave: "consentimientoFecha", etiqueta: "Fecha en que firmó su autorización", tipo: "fecha", requerido: true },
      { clave: "consentimiento", etiqueta: "Tengo la autorización firmada de esta persona", tipo: "check", debeSerTrue: true,
        ayuda: "Sin la autorización firmada no se puede publicar su nombre ni su foto." }
    ],
    foto: [
      { clave: "archivo", etiqueta: "Foto", tipo: "imagen", requerido: true },
      { clave: "alt", etiqueta: "Descripción de la foto", tipo: "texto", max: 200, requerido: true,
        ayuda: "Lo que escucha quien no ve la foto. Sin decir \"foto de\"." },
      { clave: "pie", etiqueta: "Pie de foto (opcional)", tipo: "texto", max: 120 },
      { clave: "seccion", etiqueta: "Dónde se muestra", tipo: "select", opciones: [["gente", "Nuestra gente"], ["instalaciones", "Instalaciones"]] },
      { clave: "personas", etiqueta: "En la foto se reconoce a alguna persona", tipo: "check" },
      { clave: "consentimiento", etiqueta: "Todas las personas que se reconocen firmaron su autorización", tipo: "check", requeridoSiVerdadero: "personas",
        ayuda: "Si es menor de edad, firma su madre, padre o tutor." }
    ],
    sitio: [
      { clave: "lema", etiqueta: "Frase de presentación", tipo: "area", max: 300, requerido: true },
      { clave: "mision", etiqueta: "Misión", tipo: "area", max: 800 },
      { clave: "vision", etiqueta: "Visión", tipo: "area", max: 800 },
      { clave: "historia", etiqueta: "Historia", tipo: "parrafos", ayuda: "Separa los párrafos con una línea en blanco." },
      { clave: "contacto.direccion", etiqueta: "Dirección", tipo: "texto", max: 200 },
      { clave: "contacto.telefono", etiqueta: "Teléfono", tipo: "telefono", max: 30 },
      { clave: "contacto.horario", etiqueta: "Horario de atención", tipo: "texto", max: 200 },
      { clave: "contacto.correo", etiqueta: "Correo electrónico", tipo: "correo", max: 120 },
      { clave: "contacto.comoLlegar", etiqueta: "Cómo llegar", tipo: "area", max: 400 },
      { clave: "contacto.enlaces", etiqueta: "Redes y otros enlaces", tipo: "enlaces", ayuda: "Uno por línea: Nombre | https://dirección. Hasta 5." },
      { clave: "revisado.servicios", etiqueta: "CECAPI ya confirmó la información de los servicios", tipo: "check",
        ayuda: "Al marcarla desaparece el aviso de \"por confirmar\" en la página." },
      { clave: "revisado.contacto", etiqueta: "CECAPI ya confirmó los datos de contacto", tipo: "check",
        ayuda: "Al marcarla desaparece el aviso de \"por confirmar\" en la página." }
    ]
  };

  function leer(objeto, ruta) {
    return ruta.split(".").reduce(function (o, k) { return o && typeof o === "object" ? o[k] : undefined; }, objeto);
  }

  function escribir(objeto, ruta, valor) {
    var partes = ruta.split(".");
    var o = objeto;
    for (var i = 0; i < partes.length - 1; i++) {
      if (!o[partes[i]] || typeof o[partes[i]] !== "object") o[partes[i]] = {};
      o = o[partes[i]];
    }
    o[partes[partes.length - 1]] = valor;
  }

  function vacio(v) {
    return v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0);
  }

  function urlSegura(texto) {
    try {
      var u = new URL(texto);
      return u.protocol === "https:" && u.username === "" && u.password === "";
    } catch (e) { return false; }
  }

  // Devuelve el mensaje del problema o null si el valor sirve.
  function validarCampo(campo, valor, objeto) {
    var nombre = "\"" + campo.etiqueta + "\"";
    var obligatorio = campo.requerido ||
      (campo.requeridoSi && !vacio(leer(objeto, campo.requeridoSi))) ||
      (campo.requeridoSiVerdadero && leer(objeto, campo.requeridoSiVerdadero) === true);
    if (campo.tipo === "check") {
      if (valor !== undefined && typeof valor !== "boolean") return nombre + " debe ser sí o no.";
      if ((campo.debeSerTrue || obligatorio) && valor !== true) return "Marca " + nombre + ".";
      return null;
    }
    if (vacio(valor)) return obligatorio ? nombre + " es obligatorio." : null;
    var limite = function () { return nombre + " puede tener hasta " + campo.max + " caracteres."; };
    switch (campo.tipo) {
      case "texto": case "area": case "telefono": case "correo":
        if (typeof valor !== "string") return nombre + " debe ser texto.";
        if (obligatorio && valor.trim() === "") return nombre + " es obligatorio.";
        if (valor.length > campo.max) return limite();
        if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/.test(valor)) return nombre + " tiene caracteres no permitidos.";
        if (campo.tipo === "telefono" && !TELEFONO.test(valor)) return nombre + " solo puede tener números, espacios, guiones, paréntesis y +.";
        if (campo.tipo === "correo" && !CORREO.test(valor)) return nombre + " no parece un correo válido.";
        return null;
      case "imagen":
        if (typeof valor !== "string" || !RUTA_FOTO.test(valor) || valor.indexOf("..") !== -1) return nombre + " no es una ruta de foto válida.";
        return null;
      case "fecha": {
        if (typeof valor !== "string" || !FECHA.test(valor) || isNaN(new Date(valor + "T00:00:00Z").getTime())) return nombre + " debe ser una fecha válida.";
        if (valor > new Date().toISOString().slice(0, 10)) return nombre + " no puede ser una fecha futura.";
        return null;
      }
      case "select":
        return campo.opciones.some(function (o) { return o[0] === valor; }) ? null : nombre + " tiene un valor no permitido.";
      case "parrafos":
        if (!Array.isArray(valor) || valor.length > 12 || valor.some(function (p) { return typeof p !== "string" || p.trim() === "" || p.length > 1500; }))
          return nombre + " admite hasta 12 párrafos de 1500 caracteres.";
        return null;
      case "enlaces":
        if (!Array.isArray(valor) || valor.length > 5) return nombre + " admite hasta 5 enlaces.";
        for (var i = 0; i < valor.length; i++) {
          var e = valor[i];
          if (!e || typeof e.nombre !== "string" || e.nombre.trim() === "" || e.nombre.length > 40 || typeof e.url !== "string" || !urlSegura(e.url) || e.url.length > 300)
            return nombre + ": cada enlace lleva un nombre corto y una dirección que empiece con https://.";
        }
        return null;
    }
    return null;
  }

  // Lista de problemas de un elemento: [{ clave, mensaje }].
  function validar(entidad, objeto) {
    if (!objeto || typeof objeto !== "object" || Array.isArray(objeto)) return [{ clave: "", mensaje: "El elemento no es válido." }];
    var problemas = [];
    CAMPOS[entidad].forEach(function (campo) {
      var mensaje = validarCampo(campo, leer(objeto, campo.clave), objeto);
      if (mensaje) problemas.push({ clave: campo.clave, mensaje: mensaje });
    });
    return problemas;
  }

  function crear(entidad) {
    switch (entidad) {
      case "servicio": return { id: "", nombre: "", descripcion: "", quien: "", horario: "", requisitos: "", foto: "", fotoAlt: "", publicado: true };
      case "persona": return { id: "", nombre: "", cargo: "", descripcion: "", foto: "", fotoAlt: "", consentimiento: false, consentimientoFecha: "" };
      case "foto": return { archivo: "", alt: "", pie: "", seccion: "gente", personas: false, consentimiento: false };
      default: return {
        version: 1, lema: "", mision: "", vision: "", historia: [],
        contacto: { direccion: "", telefono: "", horario: "", correo: "", comoLlegar: "", enlaces: [] },
        revisado: { servicios: false, contacto: false }
      };
    }
  }

  // Del sitio público: se queda con los campos válidos y el resto lo deja vacío.
  function normalizarSitio(datos) {
    if (!datos || typeof datos !== "object" || datos.version !== 1) return null;
    var limpio = crear("sitio");
    CAMPOS.sitio.forEach(function (campo) {
      var valor = leer(datos, campo.clave);
      if (!vacio(valor) && validarCampo(campo, valor, datos) === null) escribir(limpio, campo.clave, valor);
    });
    return limpio;
  }

  function normalizarColeccion(datos, clave, entidad, filtro) {
    if (!datos || datos.version !== 1 && entidad !== "foto" || !Array.isArray(datos[clave])) return null;
    return datos[clave].filter(function (e) { return validar(entidad, e).length === 0 && (!filtro || filtro(e)); });
  }

  function normalizarServicios(datos) {
    return normalizarColeccion(datos, "servicios", "servicio", function (s) { return s.publicado !== false; });
  }

  function normalizarEquipo(datos) {
    return normalizarColeccion(datos, "personas", "persona");
  }

  // El archivo de fotos ya existía sin "version": se sigue aceptando así.
  function normalizarFotos(datos) {
    return normalizarColeccion(datos, "fotos", "foto");
  }

  function identificador(texto, usados) {
    var base = String(texto).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase()
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 40) || "elemento";
    var id = base, n = 2;
    while (usados.indexOf(id) !== -1) id = base + "-" + n++;
    return id;
  }

  // Antes de publicar: todo el contenido junto, con repetidos incluidos.
  function validarTodo(datos) {
    var problemas = [];
    var agregar = function (donde, lista) { lista.forEach(function (p) { problemas.push({ donde: donde, mensaje: p.mensaje }); }); };
    agregar("Textos del sitio", validar("sitio", datos.sitio));
    var repetido = function (donde, valores) {
      valores.forEach(function (v, i) { if (valores.indexOf(v) !== i) problemas.push({ donde: donde, mensaje: "\"" + v + "\" está repetido." }); });
    };
    datos.servicios.servicios.forEach(function (s, i) { agregar("Servicio " + (i + 1), validar("servicio", s)); });
    datos.equipo.personas.forEach(function (p, i) { agregar("Equipo, persona " + (i + 1), validar("persona", p)); });
    datos.galeria.fotos.forEach(function (f, i) { agregar("Foto " + (i + 1), validar("foto", f)); });
    repetido("Servicios", datos.servicios.servicios.map(function (s) { return s.id; }));
    repetido("Equipo", datos.equipo.personas.map(function (p) { return p.id; }));
    repetido("Fotos", datos.galeria.fotos.map(function (f) { return f.archivo; }));
    return problemas;
  }

  return {
    CAMPOS: CAMPOS, RUTA_FOTO: RUTA_FOTO, leer: leer, escribir: escribir, vacio: vacio, urlSegura: urlSegura,
    validarCampo: validarCampo, validar: validar, validarTodo: validarTodo, crear: crear, identificador: identificador,
    normalizarSitio: normalizarSitio, normalizarServicios: normalizarServicios, normalizarEquipo: normalizarEquipo, normalizarFotos: normalizarFotos
  };
});
