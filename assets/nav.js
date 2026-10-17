(function () {
  var b = document.querySelector(".menu"), l = document.getElementById("navlinks");
  if (b && l) b.addEventListener("click", function () {
    var open = l.classList.toggle("open");
    b.setAttribute("aria-expanded", open ? "true" : "false");
  });
})();
/* U48: WhatsApp links open in a new tab on a computer (the build marks them so), but on a phone they hand over to the app,
   where a new tab would only leave an empty page behind. Links the calculators write later are covered too. */
document.addEventListener("click", function (e) {
  var a = e.target.closest ? e.target.closest('a[href^="https://wa.me/"]') : null;
  if (!a) return;
  if (window.matchMedia && matchMedia("(max-width:760px)").matches) a.removeAttribute("target");
  else { a.target = "_blank"; a.rel = "noopener"; }
}, true);
if (location.search.indexOf("phonecheck") > -1) window.addEventListener("load", function () {
  document.documentElement.setAttribute("data-sw", document.documentElement.scrollWidth);
  document.documentElement.setAttribute("data-vw", window.innerWidth);
});
