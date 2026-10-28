// Lectura en voz alta con la voz del navegador (speechSynthesis), en español.
// Es para personas con baja visión que no usan lector de pantalla; quien usa NVDA,
// JAWS o Narrator ya escucha la página con su propio lector.
// Expone window.CecapiVoz para que otras partes (políticas del asistente) la reutilicen.
(function () {
  "use strict";
  var sintesis = window.speechSynthesis;

  function vozEspanol() {
    if (!sintesis) return null;
    var voces = sintesis.getVoices();
    var preferidas = ["es-MX", "es-US", "es-419", "es-ES"];
    for (var i = 0; i < preferidas.length; i++) {
      for (var j = 0; j < voces.length; j++) {
        if (voces[j].lang && voces[j].lang.replace("_", "-") === preferidas[i]) return voces[j];
      }
    }
    for (var k = 0; k < voces.length; k++) {
      if (voces[k].lang && voces[k].lang.indexOf("es") === 0) return voces[k];
    }
    return null;
  }

  var Voz = {
    disponible: !!sintesis,
    decir: function (texto, alTerminar) {
      if (!sintesis) { if (alTerminar) alTerminar(false); return; }
      sintesis.cancel();
      var frase = new SpeechSynthesisUtterance(texto);
      frase.lang = "es-MX";
      var voz = vozEspanol();
      if (voz) frase.voice = voz;
      frase.onend = function () { if (alTerminar) alTerminar(true); };
      frase.onerror = function () { if (alTerminar) alTerminar(false); };
      sintesis.speak(frase);
    },
    callar: function () { if (sintesis) sintesis.cancel(); }
  };
  window.CecapiVoz = Voz;

  // --- Botones "Escuchar esta página" ---
  document.addEventListener("DOMContentLoaded", function () {
    var escuchar = document.getElementById("escuchar");
    var controles = document.getElementById("controles-lectura");
    var principal = document.getElementById("contenido");
    if (!escuchar || !principal) return;

    if (!Voz.disponible) {
      escuchar.disabled = true;
      escuchar.textContent = "Lectura en voz alta no disponible en este navegador";
      return;
    }

    var bloques = [];
    var actual = -1;
    var leyendo = false;

    function marcar(i) {
      bloques.forEach(function (b) { b.classList.remove("leyendo"); });
      if (bloques[i]) {
        bloques[i].classList.add("leyendo");
        bloques[i].scrollIntoView({ block: "center" });
      }
    }

    function leer(i) {
      if (i >= bloques.length) { detener(); return; }
      actual = i;
      marcar(i);
      Voz.decir(bloques[i].innerText, function (completo) {
        if (completo && leyendo) leer(actual + 1);
      });
    }

    function detener() {
      leyendo = false;
      Voz.callar();
      marcar(-1);
      actual = -1;
      escuchar.setAttribute("aria-pressed", "false");
      escuchar.textContent = "Escuchar esta página";
      if (controles) controles.hidden = true;
    }

    escuchar.addEventListener("click", function () {
      if (leyendo) { detener(); return; }
      bloques = Array.prototype.slice.call(
        principal.querySelectorAll("h1, h2, h3, p, li, dt, dd, caption, th, td")
      ).filter(function (b) { return b.offsetParent !== null && b.innerText.trim() && !b.closest("[data-sin-lectura]"); });
      leyendo = true;
      escuchar.setAttribute("aria-pressed", "true");
      escuchar.textContent = "Detener lectura";
      if (controles) controles.hidden = false;
      leer(0);
    });

    var repetir = document.getElementById("lectura-repetir");
    var siguiente = document.getElementById("lectura-siguiente");
    if (repetir) repetir.addEventListener("click", function () { if (leyendo) leer(Math.max(actual, 0)); });
    if (siguiente) siguiente.addEventListener("click", function () { if (leyendo) leer(actual + 1); });
    window.addEventListener("pagehide", detener);
  });
})();
