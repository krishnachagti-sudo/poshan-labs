/* Poshan Labs motion: scroll reveals, lazy video (phones too, one at a time), the sideways day, swipe strips, count-ups.
   Everything is skipped when the visitor has asked for reduced motion. */
(function () {
  "use strict";
  var reduce = (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) || location.search.indexOf("static") > -1;
  var doc = document.documentElement;
  doc.classList.add("js");

  function each(sel, fn, root) { Array.prototype.forEach.call((root || document).querySelectorAll(sel), fn); }

  /* ---------- only things that mean something animate ---------- */
  var REVEAL = ["main .verdicts .row", "main .katoris", "main svg.thali"];
  function tag() {
    each(REVEAL.join(","), function (el) {
      var sibs = el.parentNode ? Array.prototype.indexOf.call(el.parentNode.children, el) : 0;
      el.style.setProperty("--i", Math.min(sibs, 8));
      el.classList.add("rv");
    });
  }

  var io = "IntersectionObserver" in window ? new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (!e.isIntersecting) return;
      e.target.classList.add("in");
      if (e.target.dataset.count) countUp(e.target);
      io.unobserve(e.target);
    });
  }, { rootMargin: "0px 0px -8% 0px", threshold: 0.12 }) : null;

  /* ---------- count-ups ---------- */
  function countUp(el) {
    var to = parseFloat(el.dataset.count), start = null, dur = 1100, fmt = el.dataset.fmt || "";
    function step(t) {
      if (!start) start = t;
      var p = Math.min(1, (t - start) / dur), e = 1 - Math.pow(1 - p, 3);
      el.textContent = Math.round(to * e).toLocaleString("en-IN") + fmt;
      if (p < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  /* ---------- lazy video: the still frame as it nears the screen, the film once it is on screen, on phones and computers.
     Reduced motion and Save-Data get the still frame only. On a phone only the film most in view plays and downloads:
     one that leaves the screen half-fetched is dropped back to its still frame, so its download stops too. ---------- */
  var conn = navigator.connection || {};
  var stillOnly = reduce || conn.saveData;  // reduced motion and Save-Data start on the still frame; a play button is still there
  var small = window.matchMedia && matchMedia("(max-width:760px)");
  var PAUSE = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><rect x="3" y="2" width="3.5" height="12"/><rect x="9.5" y="2" width="3.5" height="12"/></svg>';
  var PLAY = '<svg viewBox="0 0 16 16" aria-hidden="true" focusable="false"><path d="M4 2l10 6-10 6z"/></svg>';
  function poster(v) { if (v.dataset.poster && !v.poster) v.poster = v.dataset.poster; }
  function play(v) {  // a device that blocks autoplay (iPhone Low Power Mode, browser settings) gets the play button instead
    var p = v.play();
    if (p && p.catch) p.catch(function () {
      v.dataset.held = "1"; v.dataset.autoheld = "1"; if (v._showToggle) v._showToggle();
      armUnlock();
    });
  }
  /* Autoplay refused (Low Power Mode, browser settings): the first click, tap or key anywhere counts as permission,
     so the films that were refused start then, unless the reader paused one themselves. */
  var unlockArmed = false;
  function armUnlock() {
    if (unlockArmed) return;
    unlockArmed = true;
    function go() {
      ["pointerdown", "keydown"].forEach(function (n) { document.removeEventListener(n, go, true); });
      Array.prototype.forEach.call(document.querySelectorAll("video[data-autoheld]"), function (v) {
        delete v.dataset.autoheld; delete v.dataset.held;
        var r = v.getBoundingClientRect();
        if (r.bottom > 0 && r.top < window.innerHeight) { var q = v.play(); if (q && q.catch) q.catch(function () {}); }
        if (v._showToggle) v._showToggle();
      });
    }
    ["pointerdown", "keydown"].forEach(function (n) { document.addEventListener(n, go, true); });
  }
  function fetchFilm(v) {
    if (v.dataset.loaded) return;
    poster(v);
    each("source[data-src]", function (s) { s.src = s.dataset.src; }, v);
    v.load(); v.dataset.loaded = "1";
  }
  function whole(v) {  // the whole film is already here, so keeping it costs nothing
    var b = v.buffered;
    return b && b.length && v.duration && b.end(b.length - 1) >= v.duration - 0.5;
  }
  function rest(v) {
    if (!v.paused) v.pause();
    if (v.dataset.loaded && !whole(v)) {  // stop the download: back to the still frame until it is on screen again
      each("source[data-src]", function (s) { s.removeAttribute("src"); }, v);
      v.load(); delete v.dataset.loaded;
    }
  }
  function toggle(v, resume) {
    var b = document.createElement("button");
    b.type = "button"; b.className = "vid-toggle";
    function show() { var off = !!v.dataset.held; b.innerHTML = off ? PLAY : PAUSE; b.setAttribute("aria-label", off ? "Play the background video" : "Pause the background video"); }
    b.addEventListener("click", function () {
      if (v.dataset.held) { delete v.dataset.held; resume(v); } else { v.dataset.held = "1"; v.pause(); }
      show();
    });
    v._showToggle = show;
    show();
    v.parentNode.appendChild(b);
  }
  function videos() {
    var vids = Array.prototype.slice.call(document.querySelectorAll("video[data-lazy]"));
    if (!("IntersectionObserver" in window)) { vids.forEach(poster); return; }
    var phone = small && small.matches;
    var near = new IntersectionObserver(function (entries) {  // posters: a screen or so ahead, not at first paint
      entries.forEach(function (e) { if (e.isIntersecting) { poster(e.target); near.unobserve(e.target); } });
    }, { rootMargin: phone ? "1000px 0px" : "600px 0px" });
    vids.forEach(function (v) { near.observe(v); });
    if (stillOnly) {  // reduced motion and Save-Data: the poster is all they download unless they press play
      vids.forEach(function (v) { v.dataset.held = "1"; toggle(v, function (x) { fetchFilm(x); play(x); }); });
      return;
    }
    if (phone) { phoneVideos(vids); return; }
    var vio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var v = e.target;
        if (e.isIntersecting) {
          fetchFilm(v);
          if (!v.dataset.held) play(v);
        } else if (!v.paused) { v.pause(); }
      });
    }, { threshold: 0.25 });
    vids.forEach(function (v) { toggle(v, play); vio.observe(v); });
  }
  function phoneVideos(vids) {
    var cur = null, wait = 0;
    function go(v) { fetchFilm(v); play(v); }
    function pick() {
      var best = null;
      vids.forEach(function (v) { if ((v._seen || 0) >= 0.5 && (!best || v._seen > best._seen)) best = v; });
      if (best !== cur) { if (cur) rest(cur); cur = best; }
      clearTimeout(wait);  // a film starts once the reader stops on it, not while a flick scrolls past
      if (cur && !cur.dataset.held) wait = setTimeout(function () { if (cur && !cur.dataset.held) go(cur); }, cur.dataset.loaded ? 0 : 350);
    }
    var pio = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {  // how much of the film, or of the screen, it fills: a tall band can't be 30% in view
        var r = e.isIntersecting ? e.intersectionRatio : 0;
        e.target._seen = Math.max(r, e.isIntersecting && e.rootBounds ? e.intersectionRect.height / e.rootBounds.height : 0);
      });
      pick();
    }, { threshold: [0, 0.15, 0.3, 0.5, 0.75, 1] });
    vids.forEach(function (v) { toggle(v, function (x) { if (x === cur) go(x); }); pio.observe(v); });
    document.addEventListener("visibilitychange", function () { if (document.hidden && cur) cur.pause(); else pick(); });
  }

  /* ---------- parallax on video bands ---------- */
  var bands = [];
  function parallax() {
    bands.forEach(function (b) {
      var r = b.getBoundingClientRect(), vh = window.innerHeight;
      if (r.bottom < 0 || r.top > vh) return;
      var p = (r.top + r.height / 2 - vh / 2) / vh;
      b.querySelector("video").style.transform = "translateY(" + (p * -6) + "%)";
    });
  }

  /* ---------- the sideways day ---------- */
  var hs = [];
  function setupH() {
    each(".hscroll", function (h) {
      var track = h.querySelector(".track"), bar = h.querySelector(".progress i");
      hs.push({ h: h, track: track, bar: bar });
    });
    sizeH();
  }
  function sizeH() {
    hs.forEach(function (o) {
      if (window.innerWidth <= 860) { o.h.style.height = ""; return; }
      var extra = o.track.scrollWidth - window.innerWidth;
      o.extra = Math.max(0, extra);
      o.h.style.height = (window.innerHeight + o.extra) + "px";
    });
    scrollH();
  }
  function scrollH() {
    hs.forEach(function (o) {
      if (window.innerWidth <= 860) return;
      var r = o.h.getBoundingClientRect(), total = o.h.offsetHeight - window.innerHeight;
      var p = Math.min(1, Math.max(0, -r.top / (total || 1)));
      o.track.style.transform = "translateX(" + (-p * o.extra) + "px)";
      if (o.bar) o.bar.style.width = (p * 100) + "%";
      each("svg.thali", function (s) {
        var sr = s.getBoundingClientRect();
        if (sr.left < window.innerWidth * 0.85) s.classList.add("in");
      }, o.h);
    });
  }

  /* ---------- swipe strips: drag with a mouse, arrows to step ---------- */
  function strips() {
    each(".strip", function (s) {
      var down = false, x0 = 0, l0 = 0;
      s.addEventListener("mousedown", function (e) { down = true; x0 = e.pageX; l0 = s.scrollLeft; s.classList.add("drag"); });
      window.addEventListener("mouseup", function () { down = false; s.classList.remove("drag"); });
      s.addEventListener("mousemove", function (e) { if (down) { e.preventDefault(); s.scrollLeft = l0 - (e.pageX - x0); } });
      var nav = s.previousElementSibling && s.previousElementSibling.classList.contains("strip-nav") ? s.previousElementSibling : null;
      if (nav) {
        var gap = function () { return parseFloat(getComputedStyle(s).columnGap) || 22; };
        var w = function () { return s.firstElementChild ? s.firstElementChild.getBoundingClientRect().width + gap() : 360; };
        var step = function (d) { s.scrollBy({ left: d * w(), behavior: reduce ? "auto" : "smooth" }); };
        var prev = nav.querySelector("[data-dir=prev]"), next = nav.querySelector("[data-dir=next]");
        prev.addEventListener("click", function () { step(-1); });
        next.addEventListener("click", function () { step(1); });
        /* "3 of 10" between the buttons (phone.css shows it; a computer sees several cards at once), and each end says so */
        var n = s.children.length, count = document.createElement("span");
        count.className = "strip-count"; count.setAttribute("aria-live", "polite");
        nav.insertBefore(count, next);
        var where = function () {
          var i = Math.min(n, Math.round(s.scrollLeft / w()) + 1), end = s.scrollLeft + s.clientWidth >= s.scrollWidth - 4;
          if (end) i = n;
          count.textContent = i + " of " + n;
          prev.classList.toggle("at-end", s.scrollLeft <= 4);
          next.classList.toggle("at-end", end);
        };
        s.addEventListener("scroll", function () { requestAnimationFrame(where); }, { passive: true });
        where();
      }
    });
  }

  function start() {
    if (reduce) { doc.classList.remove("js"); videos(); strips(); return; }
    tag();
    if (io) each(".rv, [data-count]", function (el) { io.observe(el); });
    else each(".rv", function (el) { el.classList.add("in"); });
    videos();
    bands = Array.prototype.slice.call(document.querySelectorAll(".vid-band"));
    setupH();
    strips();
    var ticking = false;
    window.addEventListener("scroll", function () {
      if (ticking) return; ticking = true;
      requestAnimationFrame(function () { parallax(); scrollH(); ticking = false; });
    }, { passive: true });
    window.addEventListener("resize", sizeH);
    parallax();
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
})();
