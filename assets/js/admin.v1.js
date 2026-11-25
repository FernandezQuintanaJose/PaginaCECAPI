// Editor del contenido del sitio (admin/). Cambia los archivos datos/*.json y las fotos de assets/fotos/
// con el mismo permiso que ya controla el repositorio: una llave de GitHub con escritura solo en este sitio.
// No hay servidor ni base de datos propios. Publicar es UN commit con todos los cambios, hecho con la API de GitHub.
//
// La llave vive solo en una variable: no se escribe en localStorage, sessionStorage ni cookies.
// Todo lo que se muestra se inserta con textContent, nunca como HTML.
(function () {
  "use strict";
  const V = window.CecapiValidar;

  const REPO = { dueno: "FernandezQuintanaJose", nombre: "PaginaCECAPI", rama: "main" };
  const API = "https://api.github.com";
  const ARCHIVOS = { sitio: "datos/sitio.v1.json", servicios: "datos/servicios.v1.json", equipo: "datos/equipo.v1.json", galeria: "datos/galeria.v1.json" };
  const LADOS = [1600, 1200, 900]; // la foto se reduce hasta que quepa
  const PESO_MAXIMO = 300 * 1024;
  const PESO_ORIGINAL_MAXIMO = 30 * 1024 * 1024;

  // Qué se puede hacer con cada colección. Los textos del sitio son únicos: solo se editan.
  const LISTAS = {
    servicios: {
      entidad: "servicio", ul: "lista-servicios", singular: "servicio", agregar: "Agregar un servicio",
      items: () => e.datos.servicios.servicios, clave: (s) => s.id, nombre: (s) => s.nombre,
      detalle: (s) => [s.publicado === false ? "Oculto en el sitio" : "", s.horario].filter(Boolean).join(". "),
      foto: (s) => s.foto, ocultable: true
    },
    equipo: {
      entidad: "persona", ul: "lista-equipo", singular: "persona", agregar: "Agregar una persona",
      items: () => e.datos.equipo.personas, clave: (p) => p.id, nombre: (p) => p.nombre,
      detalle: (p) => p.cargo, foto: (p) => p.foto
    },
    galeria: {
      entidad: "foto", ul: "lista-galeria", singular: "foto", agregar: "Agregar una foto",
      items: () => e.datos.galeria.fotos, clave: (f) => f.archivo, nombre: (f) => f.alt,
      detalle: (f) => (f.seccion === "instalaciones" ? "Instalaciones" : "Nuestra gente") + (f.personas ? ". Aparecen personas" : ""),
      foto: (f) => f.archivo
    }
  };

  let token = null;
  let e = null; // estado de la sesión: se llena al conectar

  class ErrorAdmin extends Error {}

  const $ = (id) => document.getElementById(id);

  function el(etiqueta, texto, clase) {
    const nodo = document.createElement(etiqueta);
    if (texto) nodo.textContent = texto;
    if (clase) nodo.className = clase;
    return nodo;
  }

  function anunciar(texto) {
    const region = $("anuncio");
    region.textContent = "";
    // Vaciar y volver a llenar hace que el lector anuncie aunque el texto se repita.
    setTimeout(() => { region.textContent = texto; }, 60);
  }

  const clonar = (x) => JSON.parse(JSON.stringify(x));

  // ------------------------------------------------------------------ GitHub
  function mensajeHttp(estado, metodo, ruta) {
    if (estado === 401) return "La llave no es válida o ya venció. Genera otra.";
    if (estado === 403) return "La llave no tiene permiso para hacer esto, o GitHub pidió esperar un momento. Revisa los permisos o intenta más tarde.";
    if (estado === 404) return "No se encontró el sitio. Revisa que la llave tenga acceso a PaginaCECAPI con permiso de Contenido (Contents).";
    if (estado === 409 || (estado === 422 && metodo === "PATCH" && ruta.indexOf("/git/refs/") === 0))
      return "Alguien más publicó cambios mientras editabas. Cierra la sesión, vuelve a entrar y repite tus cambios.";
    return "GitHub respondió con un error (código " + estado + "). Intenta de nuevo en un momento.";
  }

  async function api(metodo, ruta, cuerpo, aceptar) {
    const crudo = !!aceptar && aceptar.indexOf("raw") !== -1;
    let res;
    try {
      res = await fetch(API + "/repos/" + REPO.dueno + "/" + REPO.nombre + ruta, {
        method: metodo,
        cache: "no-store",
        credentials: "omit",
        headers: Object.assign({
          Accept: aceptar || "application/vnd.github+json",
          Authorization: "Bearer " + token,
          "X-GitHub-Api-Version": "2022-11-28"
        }, cuerpo ? { "Content-Type": "application/json" } : {}),
        body: cuerpo ? JSON.stringify(cuerpo) : undefined
      });
    } catch (_) {
      throw new ErrorAdmin("No se pudo conectar con GitHub. Revisa tu conexión a internet e intenta de nuevo.");
    }
    if (!res.ok) {
      const error = new ErrorAdmin(mensajeHttp(res.status, metodo, ruta));
      error.estado = res.status;
      throw error;
    }
    return crudo ? res.text() : res.json();
  }

  function valorInicial(clave, objeto) {
    const o = objeto && typeof objeto === "object" && !Array.isArray(objeto) ? objeto : {};
    if (clave === "sitio") {
      const base = V.crear("sitio");
      return Object.assign(base, o, {
        contacto: Object.assign(base.contacto, o.contacto || {}),
        revisado: Object.assign(base.revisado, o.revisado || {})
      });
    }
    if (clave === "servicios") return { version: 1, servicios: Array.isArray(o.servicios) ? o.servicios : [] };
    if (clave === "equipo") return { version: 1, personas: Array.isArray(o.personas) ? o.personas : [] };
    return { fotos: Array.isArray(o.fotos) ? o.fotos : [] };
  }

  async function conectar(llave) {
    token = llave.trim();
    if (!token) throw new ErrorAdmin("Pega la llave de GitHub.");
    const repo = await api("GET", "");
    if (!repo.permissions || !repo.permissions.push)
      throw new ErrorAdmin("Esta llave solo puede leer el sitio. Necesita permiso de escritura en Contenido (Contents).");
    const ref = await api("GET", "/git/ref/heads/" + REPO.rama);
    const commit = await api("GET", "/git/commits/" + ref.object.sha);
    const arbol = await api("GET", "/git/trees/" + commit.tree.sha + "?recursive=1");
    if (arbol.truncated) throw new ErrorAdmin("El repositorio es demasiado grande para este editor. Avisa a quien mantiene el sitio.");

    const datos = {};
    for (const clave of Object.keys(ARCHIVOS)) {
      let objeto = null;
      try {
        const texto = await api("GET", "/contents/" + ARCHIVOS[clave] + "?ref=" + REPO.rama, null, "application/vnd.github.raw+json");
        try { objeto = JSON.parse(texto); } catch (_) {
          throw new ErrorAdmin("El archivo " + ARCHIVOS[clave] + " está dañado y no se puede abrir. Avisa a quien mantiene el sitio.");
        }
      } catch (error) {
        if (error.estado !== 404) throw error; // si el archivo todavía no existe, se empieza vacío
      }
      datos[clave] = valorInicial(clave, objeto);
    }
    e = {
      headSha: ref.object.sha, treeSha: commit.tree.sha,
      existentes: new Set(arbol.tree.filter((x) => x.type === "blob").map((x) => x.path)),
      datos, originales: clonar(datos), nuevas: new Map()
    };
  }

  // ------------------------------------------------------------------ Cambios
  const rutasDeFotos = (datos) => new Set([
    ...datos.servicios.servicios.map((s) => s.foto),
    ...datos.equipo.personas.map((p) => p.foto),
    ...datos.galeria.fotos.map((f) => f.archivo)
  ].filter((r) => typeof r === "string" && r));

  function comparar(titulo, antes, ahora, clave, nombre, lineas) {
    const mapa = (lista) => new Map(lista.map((x) => [clave(x), x]));
    const a = mapa(antes), b = mapa(ahora);
    const nuevos = ahora.filter((x) => !a.has(clave(x))).map(nombre);
    const quitados = antes.filter((x) => !b.has(clave(x))).map(nombre);
    const cambiados = ahora.filter((x) => a.has(clave(x)) && JSON.stringify(a.get(clave(x))) !== JSON.stringify(x)).map(nombre);
    const orden = !nuevos.length && !quitados.length && !cambiados.length &&
      JSON.stringify(antes.map(clave)) !== JSON.stringify(ahora.map(clave));
    const partes = [];
    if (nuevos.length) partes.push(nuevos.length + (nuevos.length === 1 ? " nuevo" : " nuevos") + " (" + nuevos.join(", ") + ")");
    if (cambiados.length) partes.push(cambiados.length + (cambiados.length === 1 ? " modificado" : " modificados") + " (" + cambiados.join(", ") + ")");
    if (quitados.length) partes.push(quitados.length + (quitados.length === 1 ? " quitado" : " quitados") + " (" + quitados.join(", ") + ")");
    if (orden) partes.push("orden cambiado");
    if (partes.length) lineas.push(titulo + ": " + partes.join("; ") + ".");
  }

  function calcularCambios() {
    const lineas = [];
    const archivos = [];
    const o = e.originales, d = e.datos;
    for (const clave of Object.keys(ARCHIVOS)) {
      if (JSON.stringify(o[clave]) !== JSON.stringify(d[clave])) archivos.push({ ruta: ARCHIVOS[clave], texto: JSON.stringify(d[clave], null, 2) + "\n" });
    }
    if (JSON.stringify(o.sitio) !== JSON.stringify(d.sitio)) lineas.push("Textos del sitio: modificados.");
    comparar("Servicios", o.servicios.servicios, d.servicios.servicios, (x) => x.id, (x) => x.nombre, lineas);
    comparar("Equipo", o.equipo.personas, d.equipo.personas, (x) => x.id, (x) => x.nombre, lineas);
    comparar("Fotos", o.galeria.fotos, d.galeria.fotos, (x) => x.archivo, (x) => x.alt, lineas);

    const antes = rutasDeFotos(o), ahora = rutasDeFotos(d);
    // El nombre lleva la huella del contenido: si ya está en el repositorio, es la misma foto y no se vuelve a subir.
    const subir = [...ahora].filter((r) => e.nuevas.has(r) && !e.existentes.has(r));
    const eliminar = [...antes].filter((r) => !ahora.has(r) && e.existentes.has(r));
    return { hay: archivos.length > 0 || subir.length > 0 || eliminar.length > 0, archivos, subir, eliminar, lineas };
  }

  // ------------------------------------------------------------------ Pantalla
  function rutaVista(ruta) {
    const nueva = e.nuevas.get(ruta);
    return nueva ? nueva.url : "../" + ruta;
  }

  function pintarLista(nombre) {
    const lista = LISTAS[nombre];
    const items = lista.items();
    const ul = $(lista.ul);
    ul.textContent = "";
    if (!items.length) {
      const vacio = el("li", "Todavía no hay " + (nombre === "servicios" ? "servicios" : nombre === "equipo" ? "personas" : "fotos") + ".");
      vacio.className = "vacio";
      ul.appendChild(vacio);
      return;
    }
    items.forEach((item, i) => {
      const li = el("li");
      if (lista.ocultable && item.publicado === false) li.className = "oculto";
      const ruta = lista.foto(item);
      if (ruta) { const img = el("img"); img.src = rutaVista(ruta); img.alt = ""; li.appendChild(img); } else li.appendChild(el("span", null, "sin-miniatura"));
      const texto = el("div", null, "texto");
      texto.appendChild(el("span", lista.nombre(item), "titulo"));
      const detalle = lista.detalle(item);
      if (detalle) texto.appendChild(el("span", detalle, "detalle"));
      li.appendChild(texto);

      const botones = el("div", null, "botones");
      const boton = (accion, visible, deshabilitado) => {
        const b = el("button", visible);
        b.type = "button";
        b.dataset.lista = nombre;
        b.dataset.accion = accion;
        b.dataset.indice = String(i);
        // El nombre del elemento va oculto para que "Editar" no suene igual en toda la lista.
        b.appendChild(el("span", " " + lista.nombre(item), "solo-lector"));
        if (deshabilitado) b.disabled = true;
        botones.appendChild(b);
      };
      boton("editar", "Editar");
      boton("subir", "Subir", i === 0);
      boton("bajar", "Bajar", i === items.length - 1);
      if (lista.ocultable) boton("ocultar", item.publicado === false ? "Mostrar" : "Ocultar");
      boton("quitar", "Quitar");
      li.appendChild(botones);
      ul.appendChild(li);
    });
  }

  function pintarSitio() {
    const s = e.datos.sitio;
    const partes = ["Frase de presentación: \"" + s.lema + "\""];
    if (s.mision || s.vision) partes.push("Misión y visión: " + [s.mision && "misión", s.vision && "visión"].filter(Boolean).join(" y ") + ".");
    partes.push("Historia: " + (s.historia.length ? s.historia.length + (s.historia.length === 1 ? " párrafo." : " párrafos.") : "sin texto todavía."));
    $("resumen-sitio").textContent = partes.join(" ");
  }

  function pintarResumen() {
    const c = calcularCambios();
    const total = c.lineas.length || (c.hay ? 1 : 0);
    $("estado-cambios").textContent = c.hay ? "Hay cambios sin publicar (" + total + (total === 1 ? " apartado)." : " apartados).") : "No hay cambios sin publicar.";
    $("sin-cambios").hidden = c.hay;
    const ul = $("resumen");
    ul.textContent = "";
    c.lineas.forEach((l) => ul.appendChild(el("li", l)));
    if (c.eliminar.length) ul.appendChild(el("li", "Se borrarán " + c.eliminar.length + (c.eliminar.length === 1 ? " foto que ya no se usa." : " fotos que ya no se usan.")));
    if (c.subir.length) ul.appendChild(el("li", "Se subirán " + c.subir.length + (c.subir.length === 1 ? " foto nueva." : " fotos nuevas.")));
    $("publicar").disabled = !c.hay;
    $("descartar").disabled = !c.hay;
    return c;
  }

  function pintar() {
    pintarSitio();
    Object.keys(LISTAS).forEach(pintarLista);
    pintarResumen();
  }

  function enfocar(nombre, indice, accion) {
    const sel = '#' + LISTAS[nombre].ul + ' button[data-accion="' + accion + '"][data-indice="' + indice + '"]';
    const boton = document.querySelector(sel);
    if (boton && !boton.disabled) boton.focus();
    else (document.querySelector('#' + LISTAS[nombre].ul + ' button[data-indice="' + indice + '"]:not(:disabled)') || $("agregar-" + nombre)).focus();
  }

  // ------------------------------------------------------------------ Confirmar
  function confirmar(titulo, texto, si) {
    return new Promise((resolver) => {
      const d = $("dialogo-confirmar");
      $("confirmar-titulo").textContent = titulo;
      $("confirmar-texto").textContent = texto;
      $("confirmar-si").textContent = si;
      $("confirmar-si").onclick = () => d.close("si");
      $("confirmar-no").onclick = () => d.close("no");
      d.onclose = () => resolver(d.returnValue === "si");
      d.returnValue = "no";
      d.showModal();
    });
  }

  // ------------------------------------------------------------------ Fotos
  async function procesarFoto(archivo) {
    if (!/^image\//.test(archivo.type)) throw new ErrorAdmin("Ese archivo no es una imagen.");
    if (archivo.size > PESO_ORIGINAL_MAXIMO) throw new ErrorAdmin("La foto pesa más de 30 MB. Elige una más ligera.");
    let mapa;
    try { mapa = await createImageBitmap(archivo, { imageOrientation: "from-image" }); } catch (_) {
      throw new ErrorAdmin("No se pudo abrir la foto. Prueba con otra en JPG o PNG.");
    }
    let mejor = null;
    for (const lado of LADOS) {
      const escala = Math.min(1, lado / Math.max(mapa.width, mapa.height));
      const ancho = Math.max(1, Math.round(mapa.width * escala)), alto = Math.max(1, Math.round(mapa.height * escala));
      const lienzo = document.createElement("canvas");
      lienzo.width = ancho;
      lienzo.height = alto;
      lienzo.getContext("2d").drawImage(mapa, 0, 0, ancho, alto);
      // Pasar por el lienzo borra los datos ocultos de la foto, como la ubicación donde se tomó.
      for (let calidad = 0.85; calidad > 0.4; calidad -= 0.1) {
        let tipo = "image/webp";
        let blob = await new Promise((r) => lienzo.toBlob(r, tipo, calidad));
        if (!blob || blob.type !== "image/webp") { tipo = "image/jpeg"; blob = await new Promise((r) => lienzo.toBlob(r, tipo, calidad)); }
        if (!blob) throw new ErrorAdmin("No se pudo preparar la foto.");
        mejor = { blob, tipo, ancho, alto };
        if (blob.size <= PESO_MAXIMO) break;
      }
      if (mejor.blob.size <= PESO_MAXIMO) break;
    }
    mapa.close();
    const bytes = new Uint8Array(await mejor.blob.arrayBuffer());
    const huella = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", bytes))).slice(0, 5).map((b) => b.toString(16).padStart(2, "0")).join("");
    const base = V.identificador(archivo.name.replace(/\.[^.]+$/, ""), []);
    const ruta = "assets/fotos/" + base + "-" + huella + (mejor.tipo === "image/webp" ? ".webp" : ".jpg");
    const previa = e.nuevas.get(ruta);
    if (previa) URL.revokeObjectURL(previa.url);
    e.nuevas.set(ruta, { bytes, url: URL.createObjectURL(mejor.blob), ancho: mejor.ancho, alto: mejor.alto });
    return { ruta, ancho: mejor.ancho, alto: mejor.alto, kb: Math.max(1, Math.round(mejor.blob.size / 1024)) };
  }

  // ------------------------------------------------------------------ Formularios
  function construirCampo(campo, valor, form) {
    const id = "campo-" + campo.clave.replace(/\./g, "-");
    const caja = el("div", null, "campo" + (campo.tipo === "check" ? " casilla" : ""));
    const ayuda = campo.ayuda ? el("p", campo.ayuda, "ayuda") : null;
    const error = el("p", null, "error");
    error.id = id + "-error";
    error.hidden = true;
    if (ayuda) ayuda.id = id + "-ayuda";
    const describe = [ayuda && ayuda.id, error.id].filter(Boolean).join(" ");
    const registro = { campo, error, control: null, leer: null };
    let control;
    let quitar = null;

    if (campo.tipo === "imagen") {
      registro.ruta = valor || "";
      const rotulo = el("p", campo.etiqueta + (campo.requerido ? " (obligatoria)" : ""), "rotulo-campo");
      rotulo.id = id + "-rotulo";
      const actual = el("p", registro.ruta ? "Foto actual: " + registro.ruta.replace("assets/fotos/", "") : "Todavía no hay foto.", "ayuda");
      control = el("input");
      control.type = "file";
      control.id = id;
      control.accept = "image/*";
      control.setAttribute("aria-labelledby", rotulo.id);
      const estado = el("p", null, "ayuda");
      estado.setAttribute("role", "status");
      control.addEventListener("change", () => {
        const archivo = control.files[0];
        if (!archivo) return;
        estado.textContent = "Preparando la foto…";
        registro.pendiente = procesarFoto(archivo).then((r) => {
          registro.ruta = r.ruta;
          estado.textContent = "Foto lista: " + r.ancho + " por " + r.alto + " píxeles, " + r.kb + " KB. Se guarda sin datos de ubicación.";
          if (quitar) quitar.checked = false;
        }, (err) => {
          control.value = "";
          estado.textContent = err instanceof ErrorAdmin ? err.message : "No se pudo preparar la foto.";
        });
      });
      caja.append(rotulo, actual, control, estado);
      if (!campo.requerido && registro.ruta) {
        const p = el("p", null, "campo casilla");
        const etiqueta = el("label");
        quitar = el("input");
        quitar.type = "checkbox";
        etiqueta.append(quitar, document.createTextNode(" Quitar la foto actual"));
        p.appendChild(etiqueta);
        caja.appendChild(p);
      }
      registro.quitar = quitar;
      registro.control = control;
      registro.leer = () => (quitar && quitar.checked ? "" : registro.ruta);
    } else if (campo.tipo === "check") {
      const etiqueta = el("label");
      etiqueta.htmlFor = id;
      control = el("input");
      control.type = "checkbox";
      control.id = id;
      control.checked = valor === true;
      etiqueta.append(control, document.createTextNode(" " + campo.etiqueta));
      caja.appendChild(etiqueta);
      registro.leer = () => control.checked;
    } else {
      const etiqueta = el("label", campo.etiqueta + (campo.requerido ? " (obligatorio)" : ""));
      etiqueta.htmlFor = id;
      caja.appendChild(etiqueta);
      if (campo.tipo === "area" || campo.tipo === "parrafos" || campo.tipo === "enlaces") {
        control = el("textarea");
        control.rows = campo.tipo === "parrafos" ? 8 : 4;
        control.value = campo.tipo === "parrafos" ? (valor || []).join("\n\n")
          : campo.tipo === "enlaces" ? (valor || []).map((x) => x.nombre + " | " + x.url).join("\n") : valor || "";
      } else if (campo.tipo === "select") {
        control = el("select");
        campo.opciones.forEach((o) => { const op = el("option", o[1]); op.value = o[0]; control.appendChild(op); });
        control.value = valor || campo.opciones[0][0];
      } else {
        control = el("input");
        control.type = campo.tipo === "fecha" ? "date" : campo.tipo === "telefono" ? "tel" : "text";
        control.value = valor || "";
        if (campo.tipo === "fecha") control.max = new Date().toISOString().slice(0, 10);
      }
      control.id = id;
      if (campo.max && campo.tipo !== "parrafos" && campo.tipo !== "enlaces") control.maxLength = campo.max;
      control.autocomplete = "off";
      caja.appendChild(control);
      registro.leer = () => {
        const v = control.value;
        if (campo.tipo === "parrafos") return v.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean);
        if (campo.tipo === "enlaces") {
          return v.split("\n").map((l) => l.trim()).filter(Boolean).map((l) => {
            const corte = l.indexOf("|");
            return { nombre: (corte === -1 ? l : l.slice(0, corte)).trim(), url: corte === -1 ? "" : l.slice(corte + 1).trim() };
          });
        }
        return campo.tipo === "select" || campo.tipo === "fecha" ? v : v.trim();
      };
    }
    control.setAttribute("aria-describedby", describe);
    registro.control = control;
    if (ayuda) caja.appendChild(ayuda);
    caja.appendChild(error);
    form.cajas.appendChild(caja);
    return registro;
  }

  function marcarErrores(registros, problemas) {
    registros.forEach((r) => { r.error.hidden = true; r.error.textContent = ""; r.control.removeAttribute("aria-invalid"); });
    problemas.forEach((p) => {
      const r = registros.find((x) => x.campo.clave === p.clave);
      if (!r) return;
      r.error.textContent = p.mensaje;
      r.error.hidden = false;
      r.control.setAttribute("aria-invalid", "true");
    });
    const resumen = $("form-errores");
    resumen.textContent = "";
    resumen.hidden = problemas.length === 0;
    if (problemas.length) {
      resumen.appendChild(el("p", "Revisa lo siguiente antes de guardar:"));
      const ul = el("ul");
      problemas.forEach((p) => ul.appendChild(el("li", p.mensaje)));
      resumen.appendChild(ul);
      resumen.focus();
    }
  }

  // clave: "sitio" o el nombre de una colección. indice: null para agregar uno nuevo.
  function abrirFormulario(clave, indice) {
    const esSitio = clave === "sitio";
    const lista = esSitio ? null : LISTAS[clave];
    const entidad = esSitio ? "sitio" : lista.entidad;
    const nuevo = !esSitio && indice === null;
    const base = esSitio ? clonar(e.datos.sitio) : nuevo ? V.crear(entidad) : clonar(lista.items()[indice]);
    $("dialogo-titulo").textContent = esSitio ? "Editar los textos del sitio"
      : nuevo ? lista.agregar : "Editar " + lista.singular + ": " + lista.nombre(base);
    const form = { cajas: $("form-campos") };
    form.cajas.textContent = "";
    $("form-errores").hidden = true;
    const registros = V.CAMPOS[entidad].map((campo) => construirCampo(campo, V.leer(base, campo.clave), form));

    $("form-elemento").onsubmit = async (ev) => {
      ev.preventDefault();
      $("form-guardar").disabled = true;
      await Promise.all(registros.map((r) => r.pendiente));
      const resultado = clonar(base);
      registros.forEach((r) => V.escribir(resultado, r.campo.clave, r.leer()));
      const problemas = V.validar(entidad, resultado);
      if (!esSitio) {
        const clavesOtras = lista.items().filter((_, i) => i !== indice).map(lista.clave);
        if (entidad === "foto" && clavesOtras.indexOf(resultado.archivo) !== -1) problemas.push({ clave: "archivo", mensaje: "Esa foto ya está en la lista." });
        if (nuevo && entidad !== "foto") resultado.id = V.identificador(resultado.nombre || lista.singular, lista.items().map(lista.clave));
      }
      $("form-guardar").disabled = false;
      marcarErrores(registros, problemas);
      if (problemas.length) return;

      $("dialogo-form").close();
      let enfoque;
      if (esSitio) { e.datos.sitio = resultado; enfoque = () => $("editar-sitio").focus(); anunciar("Textos del sitio guardados. Falta publicar."); }
      else {
        const items = lista.items();
        if (nuevo) items.push(resultado); else items[indice] = resultado;
        const donde = nuevo ? items.length - 1 : indice;
        enfoque = () => enfocar(clave, donde, "editar");
        anunciar(lista.singular[0].toUpperCase() + lista.singular.slice(1) + " guardado: " + lista.nombre(resultado) + ". Falta publicar.");
      }
      pintar();
      enfoque();
    };
    $("dialogo-form").showModal();
  }

  async function accionLista(nombre, accion, indice) {
    const lista = LISTAS[nombre];
    const items = lista.items();
    const item = items[indice];
    if (accion === "editar") return abrirFormulario(nombre, indice);
    if (accion === "subir" || accion === "bajar") {
      const destino = indice + (accion === "subir" ? -1 : 1);
      if (destino < 0 || destino >= items.length) return;
      [items[indice], items[destino]] = [items[destino], items[indice]];
      pintar();
      enfocar(nombre, destino, accion);
      return anunciar(lista.nombre(item) + " ahora está en la posición " + (destino + 1) + " de " + items.length + ".");
    }
    if (accion === "ocultar") {
      item.publicado = item.publicado === false;
      pintar();
      enfocar(nombre, indice, "ocultar");
      return anunciar(lista.nombre(item) + (item.publicado ? " se mostrará en el sitio." : " quedará oculto en el sitio.") + " Falta publicar.");
    }
    if (accion === "quitar") {
      const aviso = nombre === "servicios"
        ? "Se quitará del sitio. Si solo quieres dejar de mostrarlo por un tiempo, mejor usa Ocultar."
        : "Se quitará del sitio y se borrará su foto, si no se usa en otro lugar. Seguirá en el historial técnico del sitio; si alguien retira su autorización, avisa a quien mantiene el sitio para borrarla también de ahí.";
      if (!(await confirmar("¿Quitar " + lista.singular + " \"" + lista.nombre(item) + "\"?", aviso, "Sí, quitar"))) return enfocar(nombre, indice, "quitar");
      items.splice(indice, 1);
      pintar();
      $("agregar-" + nombre).focus();
      anunciar(lista.nombre(item) + " se quitó. Falta publicar.");
    }
  }

  // ------------------------------------------------------------------ Publicar
  const aBase64 = (bytes) => {
    let texto = "";
    for (let i = 0; i < bytes.length; i += 0x8000) texto += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
    return btoa(texto);
  };

  async function publicar() {
    const resultado = $("resultado");
    const problemas = V.validarTodo(e.datos);
    const ul = $("problemas");
    ul.textContent = "";
    ul.hidden = problemas.length === 0;
    if (problemas.length) {
      problemas.forEach((p) => ul.appendChild(el("li", p.donde + ": " + p.mensaje)));
      resultado.textContent = "No se puede publicar: corrige lo marcado arriba.";
      return;
    }
    const c = calcularCambios();
    if (!c.hay) return;
    $("publicar").disabled = true;
    $("descartar").disabled = true;
    resultado.textContent = "Publicando…";
    try {
      const actual = await api("GET", "/git/ref/heads/" + REPO.rama);
      if (actual.object.sha !== e.headSha) throw new ErrorAdmin(mensajeHttp(409, "PATCH", "/git/refs/"));
      const entradas = [];
      const blob = async (base64) => (await api("POST", "/git/blobs", { content: base64, encoding: "base64" })).sha;
      for (const a of c.archivos) entradas.push({ path: a.ruta, mode: "100644", type: "blob", sha: await blob(aBase64(new TextEncoder().encode(a.texto))) });
      for (const ruta of c.subir) entradas.push({ path: ruta, mode: "100644", type: "blob", sha: await blob(aBase64(e.nuevas.get(ruta).bytes)) });
      for (const ruta of c.eliminar) entradas.push({ path: ruta, mode: "100644", type: "blob", sha: null });
      const arbol = await api("POST", "/git/trees", { base_tree: e.treeSha, tree: entradas });
      const nota = $("mensaje").value.trim();
      const mensaje = "Contenido del sitio: " + (nota || (c.lineas[0] || "cambios desde el editor").replace(/\.$/, "")).slice(0, 100);
      const commit = await api("POST", "/git/commits", { message: mensaje, tree: arbol.sha, parents: [e.headSha] });
      await api("PATCH", "/git/refs/heads/" + REPO.rama, { sha: commit.sha, force: false });

      e.headSha = commit.sha;
      e.treeSha = arbol.sha;
      c.subir.forEach((r) => e.existentes.add(r));
      c.eliminar.forEach((r) => e.existentes.delete(r));
      e.originales = clonar(e.datos);
      $("mensaje").value = "";
      resultado.textContent = "Listo. Los cambios se publicaron; GitHub tarda unos minutos en actualizar el sitio.";
      anunciar(resultado.textContent);
    } catch (error) {
      resultado.textContent = error instanceof ErrorAdmin ? error.message : "No se pudo publicar. Intenta de nuevo.";
      anunciar(resultado.textContent);
    }
    pintar();
  }

  function liberarFotos() {
    if (e) e.nuevas.forEach((f) => URL.revokeObjectURL(f.url));
  }

  async function cerrarSesion() {
    if (e && calcularCambios().hay && !(await confirmar("¿Cerrar la sesión?", "Hay cambios sin publicar y se perderán.", "Sí, cerrar la sesión"))) return;
    liberarFotos();
    token = null;
    e = null;
    $("editor").hidden = true;
    $("conexion").hidden = false;
    $("llave").value = "";
    $("resultado").textContent = "";
    $("llave").focus();
    anunciar("Sesión cerrada.");
  }

  // ------------------------------------------------------------------ Arranque
  document.addEventListener("DOMContentLoaded", () => {
    if (!V) return;
    $("f-conexion").addEventListener("submit", async (ev) => {
      ev.preventDefault();
      const error = $("llave-error");
      const boton = ev.target.querySelector("button");
      error.hidden = true;
      $("llave").removeAttribute("aria-invalid");
      boton.disabled = true;
      boton.textContent = "Conectando…";
      try {
        await conectar($("llave").value);
        $("llave").value = ""; // la llave ya solo queda en memoria
        $("conexion").hidden = true;
        $("editor").hidden = false;
        pintar();
        $("estado-cambios").focus();
        anunciar("Conectado. Ya puedes editar.");
      } catch (err) {
        token = null;
        error.textContent = err instanceof ErrorAdmin ? err.message : "No se pudo conectar. Intenta de nuevo.";
        error.hidden = false;
        $("llave").setAttribute("aria-invalid", "true");
        $("llave").focus();
      }
      boton.disabled = false;
      boton.textContent = "Conectar";
    });

    $("editar-sitio").addEventListener("click", () => abrirFormulario("sitio", null));
    Object.keys(LISTAS).forEach((nombre) => {
      $("agregar-" + nombre).addEventListener("click", () => abrirFormulario(nombre, null));
      $(LISTAS[nombre].ul).addEventListener("click", (ev) => {
        const b = ev.target.closest("button[data-accion]");
        if (b) accionLista(b.dataset.lista, b.dataset.accion, Number(b.dataset.indice));
      });
    });
    $("form-cancelar").addEventListener("click", () => $("dialogo-form").close());
    $("publicar").addEventListener("click", publicar);
    $("descartar").addEventListener("click", async () => {
      if (!(await confirmar("¿Descartar todos los cambios?", "Se pierde todo lo que cambiaste desde que entraste o desde la última vez que publicaste.", "Sí, descartar"))) return;
      liberarFotos();
      e.datos = clonar(e.originales);
      e.nuevas = new Map();
      $("problemas").hidden = true;
      pintar();
      $("estado-cambios").focus();
      anunciar("Se descartaron los cambios.");
    });
    $("cerrar-sesion").addEventListener("click", cerrarSesion);
    $("estado-cambios").tabIndex = -1;
    window.addEventListener("beforeunload", (ev) => {
      if (e && calcularCambios().hay) { ev.preventDefault(); ev.returnValue = ""; }
    });
  });
})();
