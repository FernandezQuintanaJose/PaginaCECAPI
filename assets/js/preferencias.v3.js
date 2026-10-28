// Tamaño de texto y contraste. Se carga en <head> para aplicar la preferencia antes de pintar.
// La preferencia se guarda solo en este navegador; si el almacenamiento falla, la página sigue igual.
(function () {
  "use strict";
  var ESCALAS = [1, 1.25, 1.5, 1.75, 2];
  var raiz = document.documentElement;

  function leer(clave) {
    try { return window.localStorage.getItem(clave); } catch (e) { return null; }
  }
  function guardar(clave, valor) {
    try { window.localStorage.setItem(clave, valor); } catch (e) { /* sin almacenamiento */ }
  }

  var indice = ESCALAS.indexOf(Number(leer("cecapi.escala")));
  if (indice < 0) indice = 0;
  raiz.style.setProperty("--escala", ESCALAS[indice]);
  var tema = leer("cecapi.tema");
  if (tema === "claro" || tema === "oscuro") raiz.setAttribute("data-tema", tema);
  if (leer("cecapi.contraste") === "alto") raiz.setAttribute("data-contraste", "alto");

  function anunciar(texto) {
    var aviso = document.getElementById("aviso-ajustes");
    if (aviso) aviso.textContent = texto;
  }

  function cambiarEscala(paso) {
    var nuevo = Math.min(ESCALAS.length - 1, Math.max(0, indice + paso));
    if (nuevo === indice) {
      anunciar(paso > 0 ? "El texto ya está en su tamaño más grande." : "El texto ya está en su tamaño normal.");
      return;
    }
    indice = nuevo;
    raiz.style.setProperty("--escala", ESCALAS[indice]);
    guardar("cecapi.escala", String(ESCALAS[indice]));
    anunciar("Tamaño de texto: " + Math.round(ESCALAS[indice] * 100) + " por ciento.");
  }

  document.addEventListener("DOMContentLoaded", function () {
    var menos = document.getElementById("texto-menos");
    var mas = document.getElementById("texto-mas");
    var contraste = document.getElementById("contraste");
    var NOMBRES = { auto: "automático", claro: "claro", oscuro: "oscuro" };
    function marcarTema() {
      var actual = raiz.getAttribute("data-tema") || "auto";
      Array.prototype.forEach.call(document.querySelectorAll("[data-tema-boton]"), function (b) {
        b.setAttribute("aria-pressed", String(b.getAttribute("data-tema-boton") === actual));
      });
    }
    Array.prototype.forEach.call(document.querySelectorAll("[data-tema-boton]"), function (b) {
      b.addEventListener("click", function () {
        var valor = b.getAttribute("data-tema-boton");
        if (valor === "auto") { raiz.removeAttribute("data-tema"); guardar("cecapi.tema", "auto"); }
        else { raiz.setAttribute("data-tema", valor); guardar("cecapi.tema", valor); }
        marcarTema();
        anunciar("Tema " + NOMBRES[valor] + ".");
      });
    });
    marcarTema();
    var menu = document.querySelector(".menu-ajustes");
    if (menu) {
      // Escape cierra el menú y devuelve el foco al botón que lo abre.
      menu.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && menu.open) {
          menu.open = false;
          menu.querySelector("summary").focus();
        }
      });
    }
    if (menos) menos.addEventListener("click", function () { cambiarEscala(-1); });
    if (mas) mas.addEventListener("click", function () { cambiarEscala(1); });
    if (contraste) {
      contraste.setAttribute("aria-pressed", String(raiz.getAttribute("data-contraste") === "alto"));
      contraste.addEventListener("click", function () {
        var activo = raiz.getAttribute("data-contraste") !== "alto";
        if (activo) raiz.setAttribute("data-contraste", "alto");
        else raiz.removeAttribute("data-contraste");
        contraste.setAttribute("aria-pressed", String(activo));
        guardar("cecapi.contraste", activo ? "alto" : "normal");
        anunciar(activo ? "Contraste alto activado." : "Contraste alto desactivado.");
      });
    }
  });
})();
