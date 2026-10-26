/* The laptop's top bar (2026-10-18). At the top of the page it is a plain white bar; once you have scrolled past about
   80 px it lifts off into a floating rounded bar in the middle (html.nav-float), and settles back at the top. "Menu" opens
   the panel below it (#navpanel): from the floating bar, the bar widens and the panel grows out of it. Escape, the Close
   button, a click outside or any link inside shuts it; Tab stays inside the bar and the panel while it is open.
   The head script adds nav-js before first paint and takes it off at load unless this file ran, so without it the Menu
   button never shows and the links read inline. */
(function () {
  var root = document.documentElement, nav = document.querySelector("nav.top"), btn = nav && nav.querySelector(".menu"),
    panel = document.getElementById("navpanel");
  if (!nav || !btn || !panel || !window.matchMedia) { root.classList.remove("nav-js"); return; }
  var desk = matchMedia("(min-width:761px)"), label = btn.querySelector(".ml"), isOpen = false, busy = false;

  /* the page you are on (and its section on the home page) */
  [].forEach.call(nav.querySelectorAll("a[href]"), function (a) {
    if (a.hash || a.origin !== location.origin) return;
    var p = a.pathname;
    if (p !== "/" && location.pathname.indexOf(p) === 0) a.setAttribute("aria-current", "page");
  });

  function float() {
    busy = false;
    if (isOpen) return;  /* the bar keeps its shape while the panel is open */
    root.classList.toggle("nav-float", desk.matches && window.pageYOffset > 80);
  }
  window.addEventListener("scroll", function () { if (!busy) { busy = true; requestAnimationFrame(float); } }, { passive: true });
  float();

  var scrim = document.createElement("div");
  scrim.className = "navscrim";
  scrim.setAttribute("aria-hidden", "true");
  document.body.appendChild(scrim);

  function focusables() {
    return [].slice.call(nav.querySelectorAll("a[href], button")).filter(function (el) { return el.offsetWidth || el.offsetHeight; });
  }
  function set(open, back) {
    if (open === isOpen) return;
    isOpen = open;
    root.classList.toggle("nav-open", open);
    btn.setAttribute("aria-expanded", open ? "true" : "false");
    if (label) label.textContent = open ? "Close" : "Menu";
    if (open) {
      var first = panel.querySelector("a[href]");
      setTimeout(function () { if (isOpen && first) first.focus({ preventScroll: true }); }, 60);
    } else {
      if (back) btn.focus({ preventScroll: true });
      float();
    }
  }
  btn.addEventListener("click", function () { set(!isOpen, true); });
  scrim.addEventListener("click", function () { set(false, true); });
  /* any link in the panel shuts it first: one to this page's own section scrolls there; Book then opens the form */
  panel.addEventListener("click", function (e) { if (e.target.closest && e.target.closest("a[href]")) set(false, false); });
  document.addEventListener("keydown", function (e) {
    if (!isOpen) return;
    if (e.key === "Escape") { e.preventDefault(); set(false, true); return; }
    if (e.key !== "Tab") return;
    var f = focusables(), first = f[0], end = f[f.length - 1];
    if (!f.length) return;
    if (e.shiftKey && (document.activeElement === first || !nav.contains(document.activeElement))) { e.preventDefault(); end.focus(); }
    else if (!e.shiftKey && (document.activeElement === end || !nav.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
  });
  function change() { if (!desk.matches) set(false, false); float(); }
  if (desk.addEventListener) desk.addEventListener("change", change); else if (desk.addListener) desk.addListener(change);
  window.addEventListener("pageshow", function (e) { if (e.persisted) set(false, false); });
  window.poshanNav = true;
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
/* Final look (2026-10-26): the phone's slim booking bar (layout.sticky_bar). It slides up once the first screen has gone
   by and steps away again at the page's closing section (.closing, the home page's .close-s, or anything marked
   data-sbar-stop) and the footer, and while a sheet or the booking form is open. Hidden, it is out of the tab order and
   hidden from screen readers; site.css keeps it off laptops. */
(function () {
  var bar = document.querySelector(".sbar");
  if (!bar || !window.matchMedia) return;
  var phone = matchMedia("(max-width:760px)"), on = false, busy = false, links = bar.querySelectorAll("a");
  var stops = document.querySelectorAll("main .closing, main .close-s, [data-sbar-stop], footer");
  function set(v) {
    if (v === on) return;
    on = v;
    bar.classList.toggle("on", v);
    bar.setAttribute("aria-hidden", v ? "false" : "true");
    for (var i = 0; i < links.length; i++) links[i].tabIndex = v ? 0 : -1;
  }
  function check() {
    busy = false;
    var h = window.innerHeight, past = (window.pageYOffset || 0) > h * 0.8, near = false;
    for (var i = 0; i < stops.length; i++) if (stops[i].getBoundingClientRect().top < h * 0.8) { near = true; break; }
    set(phone.matches && past && !near && !document.body.classList.contains("open"));
  }
  function soon() { if (!busy) { busy = true; requestAnimationFrame(check); } }
  window.addEventListener("scroll", soon, { passive: true });
  window.addEventListener("resize", soon);
  if (window.MutationObserver) new MutationObserver(soon).observe(document.body, { attributes: true, attributeFilter: ["class"] });
  check();
})();
