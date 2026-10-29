// Collage de fotos. Lee datos/galeria.v1.json y reemplaza los huecos por las fotos.
// Cada foto necesita texto alternativo (alt): quien no ve la imagen escucha ese texto.
// Todo se inserta como texto o atributo, nunca como HTML.
(function () {
  "use strict";

  function valida(foto) {
    return foto && typeof foto.archivo === "string" && /^assets\/fotos\/[\w.\-\/]+$/.test(foto.archivo) &&
      foto.archivo.indexOf("..") === -1 && typeof foto.alt === "string" && foto.alt.trim() !== "";
  }

  document.addEventListener("DOMContentLoaded", function () {
    var galeria = document.getElementById("galeria");
    if (!galeria) return;
    fetch("datos/galeria.v1.json", { cache: "no-cache" })
      .then(function (res) { if (!res.ok) throw new Error(); return res.json(); })
      .then(function (datos) {
        var fotos = (datos.fotos || []).filter(valida);
        if (!fotos.length) return;
        galeria.textContent = "";
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
          galeria.appendChild(figura);
        });
        var aviso = document.getElementById("galeria-aviso");
        if (aviso) aviso.hidden = true;
      })
      .catch(function () { /* sin datos: se quedan los huecos */ });
  });
})();
