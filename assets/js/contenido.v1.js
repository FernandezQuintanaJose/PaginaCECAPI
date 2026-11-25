// Contenido editable de la página de inicio. Lee datos/sitio.v1.json, servicios.v1.json y equipo.v1.json
// (los mismos que cambia el editor de admin/) y los pinta en las secciones de index.html.
// El HTML de la página queda como respaldo: si un archivo falta o está dañado, esa sección no cambia.
// Todo se inserta como texto o atributo, nunca como HTML.
(function () {
  "use strict";
  var V = window.CecapiValidar;
  if (!V) return;

  function $(id) { return document.getElementById(id); }

  function elemento(etiqueta, texto, clase) {
    var el = document.createElement(etiqueta);
    if (texto) el.textContent = texto;
    if (clase) el.className = clase;
    return el;
  }

  function cargar(nombre) {
    return fetch("datos/" + nombre + ".v1.json", { cache: "no-cache" })
      .then(function (res) { if (!res.ok) throw new Error(); return res.json(); });
  }

  function foto(ruta, alt, clase) {
    var img = document.createElement("img");
    img.src = ruta;
    img.alt = alt;
    img.loading = "lazy";
    if (clase) img.className = clase;
    return img;
  }

  // Muestra una sección que empieza oculta y agrega su enlace al menú, antes del de "antesDe".
  // Lo usa también galeria.v2.js.
  window.CecapiSitio = {
    mostrarSeccion: function (id, textoMenu, antesDe) {
      var seccion = $(id);
      if (!seccion) return;
      seccion.hidden = false;
      var lista = document.querySelector(".navegacion ul");
      if (!lista || lista.querySelector('a[href="./#' + id + '"]')) return;
      var li = document.createElement("li");
      var a = document.createElement("a");
      a.href = "./#" + id;
      a.textContent = textoMenu;
      li.appendChild(a);
      var referencia = antesDe && lista.querySelector('a[href="./#' + antesDe + '"]');
      lista.insertBefore(li, referencia ? referencia.parentNode : null);
    }
  };

  function enlaceTelefono(texto) {
    var digitos = texto.replace(/\D/g, "");
    if (digitos.length === 10) return "tel:+52" + digitos;
    if (digitos.length === 12 && digitos.indexOf("52") === 0) return "tel:+" + digitos;
    return null;
  }

  function pintarContacto(contacto) {
    var filas = [];
    if (contacto.direccion) filas.push(["Dirección", contacto.direccion]);
    if (contacto.telefono) filas.push(["Teléfono", contacto.telefono, enlaceTelefono(contacto.telefono)]);
    if (contacto.horario) filas.push(["Horario", contacto.horario]);
    if (contacto.correo) filas.push(["Correo", contacto.correo, "mailto:" + contacto.correo]);
    if (contacto.comoLlegar) filas.push(["Cómo llegar", contacto.comoLlegar]);
    if (filas.length) {
      var lista = $("contacto-datos");
      lista.textContent = "";
      filas.forEach(function (fila) {
        lista.appendChild(elemento("dt", fila[0]));
        var dd = elemento("dd");
        if (fila[2]) { var a = elemento("a", fila[1]); a.href = fila[2]; dd.appendChild(a); } else dd.textContent = fila[1];
        lista.appendChild(dd);
      });
    }
    var mapa = $("contacto-mapa");
    if (mapa && contacto.direccion) mapa.href = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent(contacto.direccion);
    if (contacto.enlaces.length) {
      var enlaces = $("contacto-enlaces");
      enlaces.textContent = "";
      contacto.enlaces.forEach(function (e) {
        var li = elemento("li");
        var a = elemento("a", e.nombre);
        a.href = e.url;
        li.appendChild(a);
        li.appendChild(document.createTextNode(" (se abre otro sitio)"));
        enlaces.appendChild(li);
      });
      enlaces.hidden = false;
    }
  }

  function pintarSitio(sitio) {
    if (sitio.lema) $("lema").textContent = sitio.lema;

    if (sitio.mision || sitio.vision) {
      var caja = $("quienes-texto");
      caja.textContent = "";
      [["Misión", sitio.mision], ["Visión", sitio.vision]].forEach(function (par) {
        if (!par[1]) return;
        caja.appendChild(elemento("h3", par[0]));
        caja.appendChild(elemento("p", par[1]));
      });
      window.CecapiSitio.mostrarSeccion("quienes", "Quiénes somos", "historia");
    }

    if (sitio.historia.length) {
      var aviso = $("historia-pendiente");
      sitio.historia.forEach(function (texto) { aviso.parentNode.insertBefore(elemento("p", texto), aviso); });
      aviso.hidden = true;
    }

    pintarContacto(sitio.contacto);
    $("contacto-pendiente").hidden = sitio.revisado.contacto;
    $("servicios-pendiente").hidden = sitio.revisado.servicios;
  }

  function pintarServicios(servicios) {
    var lista = document.querySelector("#servicios .lista-servicios");
    lista.textContent = "";
    lista.hidden = servicios.length === 0;
    servicios.forEach(function (s) {
      var li = elemento("li");
      var detalles = [["Quién puede tomarlo", s.quien], ["Días y horario", s.horario], ["Requisitos", s.requisitos]]
        .filter(function (par) { return par[1]; });
      if (!detalles.length && !s.descripcion && !s.foto) { li.textContent = s.nombre; lista.appendChild(li); return; }
      li.className = "detallado";
      li.appendChild(elemento("h3", s.nombre));
      if (s.foto) li.appendChild(foto(s.foto, s.fotoAlt, "foto-servicio"));
      if (s.descripcion) li.appendChild(elemento("p", s.descripcion));
      if (detalles.length) {
        var dl = elemento("dl", null, "datos");
        detalles.forEach(function (par) { dl.appendChild(elemento("dt", par[0])); dl.appendChild(elemento("dd", par[1])); });
        li.appendChild(dl);
      }
      lista.appendChild(li);
    });
  }

  function pintarEquipo(personas) {
    if (!personas.length) return;
    var caja = $("equipo");
    caja.textContent = "";
    caja.appendChild(elemento("h3", "El equipo"));
    var lista = elemento("ul", null, "equipo");
    personas.forEach(function (p) {
      var li = elemento("li");
      if (p.foto) li.appendChild(foto(p.foto, p.fotoAlt));
      li.appendChild(elemento("h4", p.nombre));
      li.appendChild(elemento("p", p.cargo, "cargo"));
      if (p.descripcion) li.appendChild(elemento("p", p.descripcion));
      lista.appendChild(li);
    });
    caja.appendChild(lista);
    caja.hidden = false;
  }

  document.addEventListener("DOMContentLoaded", function () {
    // Cada archivo va por su lado: si uno falla, las demás secciones se actualizan igual.
    cargar("sitio").then(V.normalizarSitio).then(function (s) { if (s) pintarSitio(s); }).catch(function () { /* se queda el texto de la página */ });
    cargar("servicios").then(V.normalizarServicios).then(function (s) { if (s) pintarServicios(s); }).catch(function () { /* idem */ });
    cargar("equipo").then(V.normalizarEquipo).then(function (p) { if (p) pintarEquipo(p); }).catch(function () { /* idem */ });
  });
})();
