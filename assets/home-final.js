/* The home page's motion and small interactions (build/home.py; the "without squares" mock, 2026-10-26). Nothing here is
   needed to read the page: without it, or under reduced motion, every section is in place, top to bottom.
   - the cover: her card grows to the whole screen as you scroll, then the panel with the two buttons (GSAP and
     ScrollTrigger, self-hosted, on this page only)
   - quiet reveals: each heading, photo, card and band fades up once
   - the contents rail on laptops, the client videos (they play muted while in view; a tap turns the sound on), the
     before and after to drag, the wall of quotes as a swipe row on phones, and a WhatsApp message enlarged on a tap */
(function (root) {
  "use strict";
  /* ---------- the arithmetic (tests/home-final.test.mjs) ---------- */
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  /* "01", "02" ... as the rail numbers its sections */
  function railNo(i) { return (i < 9 ? "0" : "") + (i + 1); }
  /* the section being read: the last one whose top has passed `mid` (the first when none has) */
  function activeIndex(tops, mid) {
    var best = 0;
    for (var i = 0; i < tops.length; i++) if (tops[i] <= mid) best = i;
    return best;
  }
  /* the wall's progress bar: its width and its shift (both in %), or null when the row does not scroll */
  function wallBar(left, scrollW, clientW) {
    var max = scrollW - clientW;
    if (max <= 0 || scrollW <= 0) return null;
    var f = clientW / scrollW;
    return { width: f * 100, shift: clamp(left / max, 0, 1) * (1 / f - 1) * 100 };
  }
  /* the clip that shows only the card's place on the stage (both rects relative to the viewport) */
  function insetClip(s, r, radius) {
    return "inset(" + (r.top - s.top) + "px " + (s.right - r.right) + "px " + (s.bottom - r.bottom) + "px " + (r.left - s.left) + "px round " + radius + "px)";
  }
  /* how much bigger the full photo starts, so the card's view of it fills the card */
  function coverScale(r, s) { return Math.max(r.width / s.width, r.height / s.height) * 1.04; }
  /* the previous and next message in the enlarged view wrap around */
  function wrap(i, n) { return n > 0 ? ((i % n) + n) % n : 0; }
  /* how far the cover tucks under a header that stays at the top (fixed or sticky): never more than the space above it */
  function pull(top, header) { return Math.max(0, Math.min(top, header)); }
  var api = { clamp: clamp, railNo: railNo, activeIndex: activeIndex, wallBar: wallBar, insetClip: insetClip, coverScale: coverScale, wrap: wrap, pull: pull };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }
  root.PoshanHomeFinal = api;

  var doc = root.document;
  if (!doc || !doc.querySelector || !root.addEventListener) return;
  var html = doc.documentElement;
  function $(s, r) { return Array.prototype.slice.call((r || doc).querySelectorAll(s)); }
  function $1(s, r) { return (r || doc).querySelector(s); }
  var page = $1(".fh");
  if (!page) return;
  var MOTION = html.classList.contains("fh-motion");
  if (MOTION && (!root.gsap || !root.ScrollTrigger)) {  /* the library did not load: the page as it reads without motion */
    MOTION = false;
    html.classList.remove("fh-motion");
    html.classList.add("fh-static");
  }

  /* ---------- the header's height, so the cover sits under a header that stays at the top ---------- */
  function measure() {
    var hdr = $1("header"), h = 0;
    if (hdr) [hdr].concat($("*", hdr)).forEach(function (e) {
      var p = root.getComputedStyle(e).position;
      if (p !== "fixed" && !(p === "sticky" && e.parentElement.offsetHeight > root.innerHeight * 2)) return;  /* a sticky bar inside a short header scrolls away with it */
      var r = e.getBoundingClientRect();
      if (r.height > 0 && r.top <= 1) h = Math.max(h, r.bottom);
    });
    var top = page.getBoundingClientRect().top + root.scrollY;
    html.style.setProperty("--fh-hdr", h + "px");
    html.style.setProperty("--fh-pull", pull(top, h) + "px");
  }
  if (MOTION) measure();

  /* ---------- the contents rail (laptops) ---------- */
  var secs = $("[data-rail]", page), railOl = $1(".fh-rail ol", page);
  var railA = [], thumb = null, last = -1, flashT;
  if (railOl && secs.length) {
    railOl.innerHTML = secs.map(function (s, i) {
      return '<li><a class="label" href="#' + s.id + '"><span class="label fh-lb">' + s.getAttribute("data-rail") + '</span><i></i><b>' + railNo(i) + "</b></a></li>";
    }).join("") + '<span class="fh-thumb"></span>';
    railA = $("a", railOl);
    thumb = $1(".fh-thumb", railOl);
  }
  function setActive(i) {
    if (!railA.length) return;
    if (i !== last) {
      last = i;
      clearTimeout(flashT);
      railA.forEach(function (a) { a.classList.remove("fh-flash"); });
      railA[i].classList.add("fh-flash");
      flashT = setTimeout(function () { railA[i].classList.remove("fh-flash"); }, 1800);
    }
    railA.forEach(function (a, k) { a.classList.toggle("fh-on", k === i); });
    thumb.style.transform = "translateY(" + (i * 25) + "px)";
  }
  function track() { setActive(activeIndex(secs.map(function (s) { return s.getBoundingClientRect().top; }), root.innerHeight * 0.45)); }
  root.addEventListener("scroll", track, { passive: true });
  root.addEventListener("resize", track);
  track();

  /* ---------- client videos: muted while in view, a tap for sound; the blur over a surname lifts at its second ---------- */
  var vids = $("video.fh-v", page);
  vids.forEach(function (v) {
    var timed = $(".reel-cover[data-until]", v.parentNode);
    if (timed.length) v.addEventListener("timeupdate", function () {
      timed.forEach(function (c) { c.hidden = v.currentTime > parseFloat(c.getAttribute("data-until")); });
    });
  });
  $(".fh-snd", page).forEach(function (b) {
    b.addEventListener("click", function () {
      var v = b.parentNode.querySelector("video");
      v.muted = !v.muted;
      b.textContent = v.muted ? "Sound off" : "Sound on";
      b.setAttribute("aria-pressed", v.muted ? "false" : "true");
      if (v.paused) { var p = v.play(); if (p && p.catch) p.catch(function () {}); }
    });
  });
  if ("IntersectionObserver" in root && MOTION) {
    var vio = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting) { var p = e.target.play(); if (p && p.catch) p.catch(function () {}); }
        else e.target.pause();
      });
    }, { threshold: 0.3 });
    vids.forEach(function (v) { vio.observe(v); });
  }

  /* ---------- before and after: drag (or the arrow keys on the slider) ---------- */
  var bxr = $1(".fh-bxrange", page), bxf = $1(".fh-bxframe", page);
  if (bxr && bxf) {
    var setBx = function () { bxf.style.setProperty("--pos", bxr.value + "%"); };
    bxr.addEventListener("input", setBx);
    setBx();
  }

  /* ---------- the wall of quotes: a swipe row on phones, with arrows and a progress line ---------- */
  var wall = $1(".fh-wall", page), wbar = $1(".fh-wallbar i", page);
  function wallLine() {
    if (!wall || !wbar) return;
    var b = wallBar(wall.scrollLeft, wall.scrollWidth, wall.clientWidth);
    if (!b) return;
    wbar.style.width = b.width + "%";
    wbar.style.transform = "translateX(" + b.shift + "%)";
  }
  if (wall) {
    wall.addEventListener("scroll", wallLine, { passive: true });
    root.addEventListener("resize", wallLine);
    wallLine();
    $(".fh-wn", page).forEach(function (b) {
      b.addEventListener("click", function () {
        var c = $1(".fh-tc", wall), step = c ? c.getBoundingClientRect().width + 14 : 300;
        wall.scrollBy({ left: b.classList.contains("fh-nx") ? step : -step, behavior: MOTION ? "smooth" : "auto" });
      });
    });
  }

  /* ---------- a WhatsApp message, enlarged (without the script the link opens the picture itself) ---------- */
  var lb = $1(".fh-lbox", page), shots = $(".fh-shb", page);
  if (lb && lb.showModal && shots.length) {
    var lbImg = $1("img", lb), lbCap = $1(".fh-lbcap", lb), cur = 0, opener = null;
    var show = function (i) {
      cur = wrap(i, shots.length);
      var a = shots[cur], im = $1("img", a);
      lbImg.src = a.getAttribute("href");
      lbImg.alt = im.alt;
      lbCap.textContent = $(".fh-cap .label", a.parentNode).map(function (s) { return s.textContent; }).join(" · ");
    };
    shots.forEach(function (a, i) {
      a.addEventListener("click", function (e) {
        if (e.metaKey || e.ctrlKey || e.shiftKey) return;
        e.preventDefault();
        opener = a;
        show(i);
        lb.showModal();
      });
    });
    $1(".fh-lbx", lb).addEventListener("click", function () { lb.close(); });
    $1(".fh-lbp", lb).addEventListener("click", function () { show(cur - 1); });
    $1(".fh-lbn", lb).addEventListener("click", function () { show(cur + 1); });
    lb.addEventListener("click", function (e) { if (e.target === lb) lb.close(); });
    lb.addEventListener("keydown", function (e) { if (e.key === "ArrowLeft") show(cur - 1); if (e.key === "ArrowRight") show(cur + 1); });
    lb.addEventListener("close", function () { if (opener) opener.focus(); });
  }

  if (!MOTION) return;

  /* =================== motion: quiet. Short fades and rises, once. =================== */
  var rev = $(".fh-sec .fh-rv, .fh-frame.fh-fx, .fh-kg, .fh-band .fh-bdbox, .fh-wall, .fh-sheet, .fh-camg, .fh-step, .fh-ramt, .fh-rspec, .fh-faql, .fh-leadq .fh-qm, .fh-contents ol, .fh-pn", page)
    .filter(function (el) { return !el.closest(".fh-cover"); });
  rev.forEach(function (el) { el.classList.add("fh-q"); });
  var scenes = $(".fh-scene", page), all = rev.concat(scenes);
  if ("IntersectionObserver" in root) {
    /* shown on entry; anything already scrolled past (a jump to an anchor) shows at once */
    var ro = new IntersectionObserver(function (es) {
      es.forEach(function (e) {
        if (e.isIntersecting || e.boundingClientRect.top < 0) { e.target.classList.add("fh-in"); ro.unobserve(e.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0 });
    all.forEach(function (el) { ro.observe(el); });
    root.addEventListener("scroll", function () {
      if (root.scrollY + root.innerHeight >= html.scrollHeight - 4) all.forEach(function (el) { el.classList.add("fh-in"); });
    }, { passive: true });
  } else all.forEach(function (el) { el.classList.add("fh-in"); });

  /* ---------- the cover: the card grows to the whole screen, calmly ---------- */
  var gsap = root.gsap, ST = root.ScrollTrigger;
  gsap.registerPlugin(ST);
  var cover = $1(".fh-cover", page), stage = $1(".fh-stage", cover), slot = $1(".fh-slot", cover), full = $1(".fh-phfull", cover), fimg = $1("img", full);
  var sw = $1(".fh-slotwrap", cover), blobs = doc.createElement("div");
  function rad() { return root.innerWidth > 900 ? 30 : 24; }
  function clip() { return insetClip(stage.getBoundingClientRect(), slot.getBoundingClientRect(), rad()); }
  function scale() { return coverScale(slot.getBoundingClientRect(), stage.getBoundingClientRect()); }
  function origin() {
    var s = stage.getBoundingClientRect(), r = slot.getBoundingClientRect(), k = scale();
    var ox = r.left - s.left + r.width / 2, oy = r.top - s.top + r.height / 2;
    if (root.innerWidth > 900 || 1 - k < 0.08) return ox + "px " + oy + "px";
    var half = r.height / (2 * k), qy = clamp(s.height * 0.3, half, s.height - half);
    return ox + "px " + ((oy - k * qy) / (1 - k)) + "px";
  }
  blobs.className = "fh-blobs";
  blobs.setAttribute("aria-hidden", "true");
  $(".fh-blob", sw).forEach(function (b) { blobs.appendChild(b); });
  stage.insertBefore(blobs, full);
  function placeBlobs() {
    var s = stage.getBoundingClientRect(), r = sw.getBoundingClientRect();
    gsap.set(blobs, { left: r.left - s.left, top: r.top - s.top, width: r.width, height: r.height });
  }
  placeBlobs();
  ST.addEventListener("refreshInit", function () { measure(); gsap.set(blobs, { clearProps: "left,top,width,height" }); });
  ST.addEventListener("refresh", placeBlobs);
  gsap.set(full, { visibility: "visible", autoAlpha: 0, clipPath: clip() });
  gsap.set(fimg, { transformOrigin: origin(), scale: scale() });
  gsap.set(".fh-panel", { visibility: "visible", autoAlpha: 0 });
  gsap.set(".fh-phcap", { visibility: "visible", opacity: 0 });

  var ctl = gsap.timeline({ scrollTrigger: { trigger: cover, start: "top top", end: "+=130%", pin: true, scrub: 1.2, invalidateOnRefresh: true } });
  ctl.fromTo(".fh-l1", { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -24, duration: 0.18, ease: "power1.in" }, 0)
     .fromTo(".fh-l2", { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: 24, duration: 0.18, ease: "power1.in" }, 0)
     .fromTo(".fh-chip, .fh-cue, .fh-vcap", { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.12 }, 0)
     .fromTo(blobs, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.2 }, 0.04)
     .fromTo(full, { autoAlpha: 0 }, { autoAlpha: 1, duration: 0.1, ease: "none" }, 0.04)
     .fromTo(slot, { autoAlpha: 1 }, { autoAlpha: 0, duration: 0.06, ease: "none" }, 0.12)
     .fromTo(full, { clipPath: clip }, { clipPath: "inset(0px 0px 0px 0px round 0px)", duration: 0.56, ease: "power1.inOut" }, 0.12)
     .fromTo(fimg, { scale: scale, transformOrigin: origin }, { scale: 1, duration: 0.56, ease: "power1.inOut" }, 0.12)
     .fromTo(".fh-panel", { autoAlpha: 0, y: 24 }, { autoAlpha: 1, y: 0, duration: 0.2, ease: "power2.out" }, 0.7)
     .fromTo(".fh-phcap", { opacity: 0 }, { opacity: 1, duration: 0.08 }, 0.78)
     .to({}, { duration: 0.14 });

  /* page load: a soft fade and rise, nothing else */
  gsap.timeline({ delay: 0.1 })
    .from(".fh-cover .fh-folio", { opacity: 0, duration: 1.2, ease: "power1.out" }, 0)
    .from(".fh-l1", { opacity: 0, y: 18, duration: 1.1, ease: "power2.out" }, 0.15)
    .from(slot, { opacity: 0, y: 18, duration: 1.2, ease: "power2.out" }, 0.3)
    .from(blobs, { opacity: 0, duration: 1.4, ease: "power1.out" }, 0.4)
    .from(".fh-l2", { opacity: 0, y: 18, duration: 1.1, ease: "power2.out" }, 0.45)
    .from(".fh-chip", { opacity: 0, y: 10, duration: 0.9, stagger: 0.15, ease: "power2.out" }, 0.9);

  root.addEventListener("load", function () { ST.refresh(); });
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { ST.refresh(); });
})(typeof window !== "undefined" ? window : this);
