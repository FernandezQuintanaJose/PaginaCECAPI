// Collages de fotos. Lee datos/galeria.v1.json y reemplaza los huecos por las fotos.
// "Nuestra gente" usa las fotos de la sección "gente"; "Instalaciones" aparece solo si hay fotos de esa sección.
// Cada foto necesita texto alternativo (alt): quien no ve la imagen escucha ese texto. Una foto donde
// se reconoce a personas solo se muestra si tiene marcada su autorización (reglas en validar.v1.js).
// Todo se inserta como texto o atributo, nunca como HTML.
(function () {
  "use strict";
  var V = window.CecapiValidar;

  function pintar(contenedor, fotos) {
    contenedor.textContent = "";
    fotos.forEach(function (foto) {
      var figura = document.createElement("figure");
      var img = document.createElement("img");
      img.src = foto.archivo;
      img.alt = foto.alt;
      img.loading = "lazy";
      figura.appendChild(img);
      if (foto.pie) {
        var pie = document.createElement("figcaption");
        pie.textContent = foto.pie;
        figura.appendChild(pie);
      }
      contenedor.appendChild(figura);
    });
  }

  document.addEventListener("DOMContentLoaded", function () {
    var galeria = document.getElementById("galeria");
    if (!galeria || !V) return;
    fetch("datos/galeria.v1.json", { cache: "no-cache" })
      .then(function (res) { if (!res.ok) throw new Error(); return res.json(); })
      .then(function (datos) {
        var fotos = V.normalizarFotos(datos) || [];
        var gente = fotos.filter(function (f) { return f.seccion !== "instalaciones"; });
        var instalaciones = fotos.filter(function (f) { return f.seccion === "instalaciones"; });
        if (gente.length) {
          pintar(galeria, gente);
          var aviso = document.getElementById("galeria-aviso");
          if (aviso) aviso.hidden = true;
        }
        if (instalaciones.length) {
          pintar(document.getElementById("instalaciones-galeria"), instalaciones);
          if (window.CecapiSitio) window.CecapiSitio.mostrarSeccion("instalaciones", "Instalaciones", "contacto");
          else document.getElementById("instalaciones").hidden = false;
        }
      })
      .catch(function () { /* sin datos: se quedan los huecos */ });
  });
})();
