/* Page interactions (2026-10-18, the nav's design sense on the content pages): the goal switcher as a segmented
   control with a sliding green pill, bars and bowls that grow once as they come into view, the "On this page" pill and the reading line on long guides, and glossary previews on every page.
   Everything here is added on top of a page that already works without it: without this script the switchers are the
   plain buttons (or every pane, without phone.js), the bars stand at their final length, guides keep their own list of
   sections, and a glossary link is an ordinary link. Reduced motion gets every final state, with nothing sliding. */
(function (root) {
  "use strict";

  /* ---------- pure helpers (tests/pages.test.mjs) ---------- */

  /* how far through a guide's text the reader is, 0 to 1: from the top of the text reaching the top of the screen to its
     end reaching the bottom of the screen */
  function readProgress(top, height, viewport) {
    var span = height - viewport;
    if (span <= 0) return top <= 0 ? 1 : 0;
    return Math.min(1, Math.max(0, -top / span));
  }
  /* the glossary word a link goes to, or "" for anything else (the glossary's own A to Z page is not a word) */
  function glossarySlug(path) {
    var m = /^\/glossary\/([a-z0-9-]+)\/?$/.exec(String(path || ""));
    return m ? m[1] : "";
  }
  /* where a preview card sits: under the link when it fits, else above it; never past either side of the screen */
  function peekPlace(link, cardW, cardH, vw, vh, gap) {
    gap = gap == null ? 8 : gap;
    var left = Math.min(Math.max(gap + 4, link.left), vw - cardW - gap - 4);
    var below = link.bottom + gap + cardH <= vh - gap || link.top - gap - cardH < gap;
    return { left: Math.max(gap, left), top: below ? link.bottom + gap : link.top - gap - cardH, below: below };
  }
  /* the pill under the chosen button: its left edge and width inside the row */
  function pillBox(btn, track) { return { x: btn.left - track.left, w: btn.width }; }

  var api = { readProgress: readProgress, glossarySlug: glossarySlug, peekPlace: peekPlace, pillBox: pillBox };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }
  root.PoshanPages = api;

  var doc = root.document;
  if (!doc || !doc.querySelector || !root.addEventListener) return;
  var mq = function (q) { return root.matchMedia ? root.matchMedia(q) : { matches: false }; };
  var phone = mq("(max-width:760px)");
  var still = mq("(prefers-reduced-motion: reduce)").matches || root.location.search.indexOf("static") > -1;
  function each(sel, fn, from) { Array.prototype.forEach.call((from || doc).querySelectorAll(sel), fn); }
  function onChange(m, fn) { if (m.addEventListener) m.addEventListener("change", fn); else if (m.addListener) m.addListener(fn); }
  var uid = 0;
  function idFor(el, base) { if (!el.id) el.id = base + "-" + (++uid); return el.id; }

  /* ---------- 7: the goal switcher as a segmented control ----------
     phone.js owns which pane shows (and remembers the goal, and reads ?goal=). Here the row becomes tabs with a green
     pill that slides to the chosen one; arrow keys, Home and End move along it; phone.js calls poshanGoalShown after each
     change. The row only shows on phones, so the tab roles are there only on phones too. */
  var groups = [];
  function groupOf(g) { for (var i = 0; i < groups.length; i++) if (groups[i].g === g) return groups[i]; return null; }
  function setupGroup(g) {
    var buttons = [].slice.call(g.querySelectorAll("button"));
    var scope = g.closest("section") || doc;
    var panes = [].slice.call(scope.querySelectorAll("[data-goal]")).filter(function (p) { return !g.contains(p); });
    if (!buttons.length || !panes.length) return;
    function paneOf(b, i) {
      var v = b.getAttribute("data-pick") || b.getAttribute("data-goal");
      for (var k = 0; k < panes.length; k++) if (panes[k].getAttribute("data-goal") === v) return panes[k];
      return panes[i];
    }
    var pill = doc.createElement("span");
    pill.className = "seg-pill";
    pill.setAttribute("aria-hidden", "true");
    g.insertBefore(pill, g.firstChild);
    g.classList.add("seg");
    var o = { g: g, buttons: buttons, panes: panes, paneOf: paneOf, pill: pill, label: g.getAttribute("aria-label") || "" };
    groups.push(o);
    g.addEventListener("keydown", function (e) {
      var i = buttons.indexOf(doc.activeElement);
      if (i < 0) return;
      var to = { ArrowRight: i + 1, ArrowDown: i + 1, ArrowLeft: i - 1, ArrowUp: i - 1, Home: 0, End: buttons.length - 1 }[e.key];
      if (to == null) return;
      e.preventDefault();
      to = (to + buttons.length) % buttons.length;
      buttons[to].focus();
      buttons[to].click();
    });
  }
  function roles(o, on) {
    var g = o.g;
    if (on) { g.setAttribute("role", "tablist"); }
    else { g.setAttribute("role", "group"); }
    o.buttons.forEach(function (b, i) {
      var p = o.paneOf(b, i), sel = b.classList.contains("on");
      if (on) {
        b.setAttribute("role", "tab");
        b.removeAttribute("aria-pressed");
        b.setAttribute("aria-selected", sel ? "true" : "false");
        b.tabIndex = sel ? 0 : -1;
        if (p) {
          b.setAttribute("aria-controls", idFor(p, "pane"));
          p.setAttribute("role", "tabpanel");
          p.setAttribute("aria-labelledby", idFor(b, "tab"));
        }
      } else {
        b.removeAttribute("role"); b.removeAttribute("aria-selected"); b.removeAttribute("aria-controls"); b.removeAttribute("tabindex");
        b.setAttribute("aria-pressed", sel ? "true" : "false");
        if (p) { p.removeAttribute("role"); p.removeAttribute("aria-labelledby"); }
      }
    });
  }
  function placePill(o) {
    var b = o.buttons.filter(function (x) { return x.classList.contains("on"); })[0];
    if (!b || !o.g.offsetWidth) return;
    var gr = o.g.getBoundingClientRect(), box = pillBox(b.getBoundingClientRect(), { left: gr.left + o.g.clientLeft });  /* inside the row's border */
    o.pill.style.width = box.w + "px";
    o.pill.style.transform = "translateX(" + box.x + "px)";
    if (!o.ready) root.requestAnimationFrame(function () { o.ready = true; o.g.classList.add("seg-ready"); });  // no slide in from 0 at load
  }
  function syncGroup(o) {
    roles(o, phone.matches);
    placePill(o);
  }
  each(".goals", setupGroup);
  groups.forEach(syncGroup);
  root.poshanGoalShown = function (g) {  /* phone.js, after a button is picked */
    var o = groupOf(g);
    if (o) syncGroup(o);
  };
  onChange(phone, function () { groups.forEach(syncGroup); });
  root.addEventListener("resize", function () { groups.forEach(placePill); });
  if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(function () { groups.forEach(placePill); });

  /* ---------- 8: bars and bowls grow once as they come into view ----------
     (the katoris already pour in motion.js). Only here does anything start short, so without the script, under reduced
     motion and in print they stand at their final length. */
  if (!still && "IntersectionObserver" in root) {
    var grow = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        (e.target._grows || e.target).classList.add("pg-in");
        grow.unobserve(e.target);
      });
    }, { rootMargin: "0px 0px -10% 0px", threshold: 0.2 });
    each("main svg.energybar, main .pairs, main .mbar", function (el) {
      var r = el.getBoundingClientRect();
      if (r.height && r.top < root.innerHeight * 0.9 && r.bottom > 0) return;  // already on screen at load: leave it be
      each(".track i", function (i, k) { i.style.setProperty("--k", k); }, el);
      el.classList.add("pg-grow");
      /* a bar drawn by clipping has no area to be seen until it is drawn, so its key, just under it, says when it is in view */
      var watch = el.tagName.toLowerCase() === "svg" && el.nextElementSibling ? el.nextElementSibling : el;
      watch._grows = el;
      grow.observe(watch);
    });
  }

  /* ---------- 12: long guides: "On this page" and the reading line ---------- */
  var isGuide = !!doc.querySelector('meta[name="poshan-page"][content="guide"]');
  var main = doc.getElementById("main");
  function slugText(s) { return String(s).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 60) || "part"; }
  function guideSections() {
    var toc = main.querySelector("nav.toc");
    if (toc) return [].map.call(toc.querySelectorAll("a[href^='#']"), function (a) {
      return { id: decodeURIComponent(a.getAttribute("href").slice(1)), text: a.textContent };
    }).filter(function (s) { return doc.getElementById(s.id); });
    return [].filter.call(main.querySelectorAll("h2"), function (h) {
      return !h.closest(".closing, summary, .sheet, nav") && h.offsetParent !== null;
    }).map(function (h) {
      if (!h.id) { var base = slugText(h.textContent), id = base, n = 2; while (doc.getElementById(id)) id = base + "-" + n++; h.id = id; }
      return { id: h.id, text: h.textContent };
    });
  }
  /* a guide counts as long when its text runs past about three screens */
  if (isGuide && main && main.offsetHeight > root.innerHeight * 2.5) {
    var secs = guideSections();
    var bars = [];
    each("nav.top, .pbar", function (n) {
      var r = doc.createElement("span");
      r.className = "rprog";
      r.setAttribute("aria-hidden", "true");
      r.appendChild(doc.createElement("i"));
      n.appendChild(r);
      bars.push(r.firstChild);
    });
    var otp = null, btn = null, card = null, links = [];
    if (secs.length >= 4) {
      otp = doc.createElement("div");
      otp.className = "otp";
      otp.innerHTML = '<button class="otp-btn" type="button" aria-expanded="false" aria-controls="otp-card"><span class="otp-i" aria-hidden="true"></span>On this page</button>'
        + '<div class="otp-card" id="otp-card" hidden><p class="otp-h" id="otp-h">On this page</p><ol aria-labelledby="otp-h"></ol></div>';
      var ol = otp.querySelector("ol");
      secs.forEach(function (s) {
        var li = doc.createElement("li"), a = doc.createElement("a");
        a.href = "#" + encodeURIComponent(s.id);
        a.textContent = s.text;
        li.appendChild(a); ol.appendChild(li); links.push(a);
      });
      doc.body.appendChild(otp);
      btn = otp.querySelector(".otp-btn"); card = otp.querySelector(".otp-card");
      var setOpen = function (open, back) {
        if (open === !card.hidden) return;
        btn.setAttribute("aria-expanded", open ? "true" : "false");
        if (open) {
          card.hidden = false;
          void card.offsetWidth;
          otp.classList.add("open");
        } else {
          otp.classList.remove("open");
          if (still) card.hidden = true; else setTimeout(function () { if (!otp.classList.contains("open")) card.hidden = true; }, 220);
          if (back) btn.focus();
        }
      };
      btn.addEventListener("click", function () { setOpen(card.hidden, false); });
      card.addEventListener("click", function (e) { if (e.target.closest("a")) setOpen(false, false); });
      doc.addEventListener("click", function (e) { if (!card.hidden && !otp.contains(e.target)) setOpen(false, false); });
      doc.addEventListener("keydown", function (e) { if (e.key === "Escape" && !card.hidden) { e.preventDefault(); setOpen(false, true); } });
      otp.addEventListener("focusout", function (e) { if (e.relatedTarget && !otp.contains(e.relatedTarget)) setOpen(false, false); });
    }
    var foot = doc.querySelector("footer"), busy = false;
    var tick = function () {
      busy = false;
      var r = main.getBoundingClientRect(), vh = root.innerHeight, p = readProgress(r.top, r.height, vh);
      bars.forEach(function (i) { i.style.transform = "scaleX(" + p.toFixed(4) + ")"; });
      doc.documentElement.classList.toggle("reading", r.top < -vh * 0.4 && r.bottom > vh * 0.5);
      if (!otp) return;
      var fr = foot ? foot.getBoundingClientRect().top : Infinity;
      var show = r.top < -vh * 0.6 && fr > vh - 40;
      otp.classList.toggle("on", show);
      if (!show && card && !card.hidden && !otp.contains(doc.activeElement)) { otp.classList.remove("open"); card.hidden = true; btn.setAttribute("aria-expanded", "false"); }
      var cur = -1;
      secs.forEach(function (s, k) { var h = doc.getElementById(s.id); if (h && h.getBoundingClientRect().top < vh * 0.35) cur = k; });
      links.forEach(function (a, k) { if (k === cur) a.setAttribute("aria-current", "true"); else a.removeAttribute("aria-current"); });
    };
    root.addEventListener("scroll", function () { if (!busy) { busy = true; root.requestAnimationFrame(tick); } }, { passive: true });
    root.addEventListener("resize", tick);
    tick();
  }

  /* ---------- 13: glossary previews ----------
     Hover or focus a glossary word's link (a tap, on a touch screen) and a small card gives its one-line meaning and a
     Read more link. The meanings come in one small file (/assets/glossary-gist.json, written by the build), fetched the
     first time a reader goes near such a link. A second tap on the same link, or Read more, goes to the page. */
  var own = glossarySlug(root.location.pathname), gist = null, loading = null;
  function load() {
    if (gist || loading) return loading || Promise.resolve(gist);
    if (!root.fetch) return Promise.reject(new Error("no fetch"));
    var v = ((doc.querySelector("script[src*='/poshan-labs/assets/pages.js']") || {}).src || "").match(/\?v=\w+/);
    loading = root.fetch("/poshan-labs/assets/glossary-gist.json" + (v ? v[0] : ""))
      .then(function (r) { if (!r.ok) throw new Error(String(r.status)); return r.json(); })
      .then(function (d) { gist = d; return d; })["catch"](function (e) { loading = null; throw e; });
    return loading;
  }
  function termLink(el) {
    var a = el && el.closest ? el.closest("a[href]") : null;
    if (!a || a.origin !== root.location.origin || a.closest(".gpeek, nav, footer, .tabs, .crumbs, .pbar, .sheet, .navpanel, .otp")) return null;
    var s = glossarySlug(a.pathname);
    if (!s || s === own || a.hash || a.querySelector(".gmean, img, svg")) return null;
    return main && main.contains(a) ? { a: a, slug: s } : null;
  }
  var peek = null, peekFor = null, hideT = 0, showT = 0, lastTouch = 0;
  function build() {
    peek = doc.createElement("div");
    peek.className = "gpeek";
    peek.id = "gpeek";
    peek.setAttribute("role", "dialog");
    peek.setAttribute("aria-labelledby", "gpeek-t");
    peek.tabIndex = -1;
    peek.hidden = true;
    peek.innerHTML = '<p class="gp-t" id="gpeek-t"></p><p class="gp-m" id="gpeek-m"></p><a class="gp-more" href="/poshan-labs/glossary/">Read more</a>';
    doc.body.appendChild(peek);
    peek.addEventListener("mouseenter", function () { clearTimeout(hideT); });
    peek.addEventListener("mouseleave", function () { hideSoon(); });
    peek.addEventListener("focusout", function (e) { if (!e.relatedTarget || (!peek.contains(e.relatedTarget) && e.relatedTarget !== (peekFor && peekFor.a))) hide(false); });
  }
  function show(t, viaTouch) {
    var g = gist && gist[t.slug];
    if (!g) return false;
    if (!peek) build();
    clearTimeout(hideT);
    if (peekFor && peekFor.a !== t.a) unlink();
    peekFor = t;
    peek.querySelector(".gp-t").textContent = g[0];
    peek.querySelector(".gp-m").textContent = g[1];
    var more = peek.querySelector(".gp-more");
    more.href = t.a.getAttribute("href");
    more.innerHTML = 'Read more<span class="vh"> about ' + g[0].replace(/[&<>"]/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }) + "</span>";
    peek.hidden = false;
    peek.classList.remove("in");
    var vw = doc.documentElement.clientWidth, w = Math.min(320, vw - 24);
    peek.style.width = w + "px";
    var rects = t.a.getClientRects(), lr = rects.length ? rects[0] : t.a.getBoundingClientRect();
    var place = peekPlace(lr, w, peek.offsetHeight, vw, root.innerHeight, 8);
    peek.style.left = (place.left + root.pageXOffset) + "px";
    peek.style.top = (place.top + root.pageYOffset) + "px";
    peek.classList.toggle("above", !place.below);
    void peek.offsetWidth;
    peek.classList.add("in");
    t.a.setAttribute("aria-describedby", "gpeek-m");
    if (viaTouch) { t.a.setAttribute("aria-expanded", "true"); peek.focus({ preventScroll: true }); }
    return true;
  }
  function unlink() {
    if (!peekFor) return;
    peekFor.a.removeAttribute("aria-describedby");
    peekFor.a.removeAttribute("aria-expanded");
  }
  function hide(back) {
    clearTimeout(showT); clearTimeout(hideT);
    if (!peek || peek.hidden) return;
    var a = peekFor && peekFor.a;
    unlink();
    peekFor = null;
    peek.classList.remove("in");
    peek.hidden = true;
    if (back && a) a.focus();
  }
  function hideSoon() { clearTimeout(hideT); hideT = setTimeout(function () { hide(false); }, 260); }

  doc.addEventListener("pointerdown", function (e) { if (e.pointerType === "touch" || e.pointerType === "pen") lastTouch = Date.now(); }, true);
  doc.addEventListener("touchstart", function () { lastTouch = Date.now(); }, { passive: true, capture: true });
  doc.addEventListener("pointerover", function (e) {
    if (e.pointerType !== "mouse") return;
    var t = termLink(e.target);
    if (!t) return;
    load().then(null, function () {});
    clearTimeout(hideT); clearTimeout(showT);
    if (peekFor && peekFor.a === t.a) return;
    showT = setTimeout(function () { load().then(function () { show(t, false); }, function () {}); }, 220);
  });
  doc.addEventListener("pointerout", function (e) {
    if (e.pointerType !== "mouse") return;
    var t = termLink(e.target);
    if (t && !(e.relatedTarget && t.a.contains(e.relatedTarget))) { clearTimeout(showT); hideSoon(); }
  });
  doc.addEventListener("focusin", function (e) {
    var t = termLink(e.target);
    if (!t || Date.now() - lastTouch < 800) return;
    load().then(function () { if (doc.activeElement === t.a) show(t, false); }, function () {});
  });
  doc.addEventListener("focusout", function (e) {
    var t = termLink(e.target);
    if (t && peekFor && peekFor.a === t.a && !(e.relatedTarget && peek && peek.contains(e.relatedTarget))) hide(false);
  });
  doc.addEventListener("click", function (e) {
    if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    var t = termLink(e.target);
    if (!t) {
      if (peek && !peek.hidden && !peek.contains(e.target)) hide(false);
      return;
    }
    if (Date.now() - lastTouch > 800) return;  /* a mouse or a keyboard: the link just goes to the page */
    if (peekFor && peekFor.a === t.a && !peek.hidden) return;  /* second tap: go */
    e.preventDefault();
    load().then(function () { if (!show(t, true)) root.location.href = t.a.href; }, function () { root.location.href = t.a.href; });
  });
  doc.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && peek && !peek.hidden) { e.preventDefault(); hide(true); }
  });
  root.addEventListener("resize", function () { hide(false); });

  /* ---------- 14: a client's whole words fold to three lines under her key line, with Read all ---------- */
  each(".testimonial .q-full", function (p) {
    var q = p.parentNode, foot = q.querySelector(".q-who");
    q.classList.add("folded");
    if (!foot || p.scrollHeight <= p.clientHeight + 2) { q.classList.remove("folded"); return; }
    var b = doc.createElement("button");
    b.type = "button"; b.className = "q-more"; b.textContent = "Read all";
    b.setAttribute("aria-expanded", "false"); b.setAttribute("aria-controls", idFor(p, "qfull"));
    b.addEventListener("click", function () {
      var open = q.classList.toggle("folded") === false;
      b.textContent = open ? "Show less" : "Read all";
      b.setAttribute("aria-expanded", open ? "true" : "false");
    });
    foot.appendChild(b);
  });

  /* ---------- 15: a client's screenshot opens over the page; arrows step through them, Escape or a tap outside closes ---------- */
  var shots = Array.prototype.slice.call(doc.querySelectorAll("a[data-shot]"));
  /* a long wall of messages shows its first SHOTS_SHOWN, with a button for the rest (every one is in the page without the script) */
  var SHOTS_SHOWN = 8, wall = doc.querySelector(".shots");
  if (wall && wall.children.length > SHOTS_SHOWN + 2) {
    wall.classList.add("folded");
    var more = doc.createElement("button");
    more.type = "button"; more.className = "btn ghost shots-more";
    more.textContent = "See all " + wall.children.length + " messages";
    more.setAttribute("aria-expanded", "false"); more.setAttribute("aria-controls", idFor(wall, "shots"));
    more.addEventListener("click", function () {
      wall.classList.remove("folded"); more.hidden = true; more.setAttribute("aria-expanded", "true");
      var next = wall.children[SHOTS_SHOWN] && wall.children[SHOTS_SHOWN].querySelector("a");
      if (next) next.focus();
    });
    wall.parentNode.insertBefore(more, wall.nextSibling);
  }
  if (shots.length) {
    var view = doc.createElement("div"), big = doc.createElement("img"), at = 0, opener = null;
    view.className = "shotview"; view.hidden = true;
    view.setAttribute("role", "dialog"); view.setAttribute("aria-modal", "true"); view.setAttribute("aria-label", "Client's message");
    function btn(cls, label, fn) {
      var b = doc.createElement("button"); b.type = "button"; b.className = cls; b.textContent = label;
      b.addEventListener("click", function (e) { e.stopPropagation(); fn(); }); view.appendChild(b); return b;
    }
    view.appendChild(big);
    var close = btn("sv-x", "Close", function () { shut(); });
    if (shots.length > 1) { btn("sv-prev", "Previous", function () { open(at - 1); }); btn("sv-next", "Next", function () { open(at + 1); }); }
    doc.body.appendChild(view);
    function open(i) {
      at = (i + shots.length) % shots.length;
      var a = shots[at], img = a.querySelector("img");
      big.src = a.href; big.alt = img ? img.alt : "";
      if (view.hidden) { opener = a; view.hidden = false; doc.documentElement.style.overflow = "hidden"; close.focus(); }
    }
    function shut() {
      view.hidden = true; big.removeAttribute("src"); doc.documentElement.style.overflow = "";
      if (opener) opener.focus();
    }
    shots.forEach(function (a, i) {
      a.addEventListener("click", function (e) {
        if (e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault(); open(i);
      });
    });
    view.addEventListener("click", function (e) { if (e.target === view) shut(); });
    doc.addEventListener("keydown", function (e) {
      if (view.hidden) return;
      if (e.key === "Escape") { e.preventDefault(); shut(); }
      else if (e.key === "ArrowRight" && shots.length > 1) open(at + 1);
      else if (e.key === "ArrowLeft" && shots.length > 1) open(at - 1);
      else if (e.key === "Tab") {  /* keep the keyboard inside the open screenshot */
        var bs = view.querySelectorAll("button"), first = bs[0], last = bs[bs.length - 1];
        if (e.shiftKey && doc.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && doc.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    });
  }

  /* ---------- 16: reels (build/reels.py) in their phone frames. The reel most in view plays by itself, muted and looping,
     and only that one: the rest pause, and nothing downloads until a reel is about to be on screen. A tap on the reel, or
     its sound switch, turns the sound on (browsers only let a page start video without sound). Under reduced motion, with
     Save-Data, or where the browser refuses to autoplay (iPhone Low Power Mode), a reel waits for a tap on its large play
     button and then plays with sound and the browser's own controls. Without the script the controls are there from the
     start. ---------- */
  var reels = Array.prototype.slice.call(doc.querySelectorAll("video[data-reel]"));
  var conn = root.navigator && root.navigator.connection || {};
  var tapOnly = still || !!conn.saveData || !("IntersectionObserver" in root);
  function others(v) { reels.forEach(function (o) { if (o !== v && !o.paused) o.pause(); }); }
  function manual(v) {  /* the tap-to-play reel: a large play button, then sound and controls */
    var b = v.parentNode.querySelector(".reel-play"), snd = v.parentNode.querySelector(".reel-sound");
    if (!b) return;
    if (snd) snd.hidden = true;
    v.removeAttribute("controls"); b.hidden = false; v.loop = false;
    if (v._manual) return;
    v._manual = true;
    function start() {
      b.hidden = true; v.setAttribute("controls", ""); v.muted = false;
      var p = v.play();
      if (p && p.catch) p.catch(function () {});
      v.focus();
    }
    b.addEventListener("click", start);
  }
  reels.forEach(function (v) {
    /* a patch over a surname burned into the first seconds of a video comes off once the video is past it */
    var timed = Array.prototype.slice.call(v.parentNode.querySelectorAll(".reel-cover[data-until]"));
    if (timed.length) v.addEventListener("timeupdate", function () {
      timed.forEach(function (c) { c.hidden = v.currentTime > parseFloat(c.getAttribute("data-until")); });
    });
    v.addEventListener("play", function () { others(v); });
    if (tapOnly) { manual(v); return; }
    var snd = v.parentNode.querySelector(".reel-sound"), len = v.parentNode.querySelector(".reel-play");
    v.removeAttribute("controls"); v.muted = true; v.loop = true; v.setAttribute("playsinline", "");
    if (len) len.hidden = true;
    function sound(on) {
      v.muted = !on;
      if (on) { reels.forEach(function (o) { if (o !== v) o.muted = true; }); }
      if (snd) {
        snd.classList.toggle("is-on", on);
        snd.setAttribute("aria-pressed", on ? "true" : "false");
      }
    }
    if (snd) {
      snd.hidden = false;
      snd.addEventListener("click", function (e) { e.stopPropagation(); sound(v.muted); if (v.paused) v.play(); });
    }
    v.addEventListener("click", function () { if (!v._manual) { sound(v.muted); if (v.paused) v.play(); } });
    v.addEventListener("volumechange", function () { if (snd) { snd.classList.toggle("is-on", !v.muted); snd.setAttribute("aria-pressed", v.muted ? "false" : "true"); } });
  });
  if (!tapOnly && reels.length) {
    var seen = new Map(), current = null;
    var near = new IntersectionObserver(function (es) {  /* fetch a reel's first seconds just before it arrives */
      es.forEach(function (e) { if (e.isIntersecting) { e.target.preload = "auto"; near.unobserve(e.target); } });
    }, { rootMargin: "300px 0px" });
    function pick() {
      var best = null, bestR = 0;
      seen.forEach(function (r, v) { if (r > bestR) { best = v; bestR = r; } });
      if (bestR < 0.55) best = null;
      if (best === current) return;
      if (current && !current._manual) current.pause();
      current = best;
      if (!best || best._manual) return;
      var p = best.play();
      if (p && p.catch) p.catch(function () { manual(best); });  /* autoplay refused: the play button instead */
    }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { seen.set(e.target, e.isIntersecting ? e.intersectionRatio : 0); });
      pick();
    }, { threshold: [0, 0.25, 0.55, 0.75, 1] });
    reels.forEach(function (v) { near.observe(v); io.observe(v); });
    doc.addEventListener("visibilitychange", function () { if (doc.hidden && current) current.pause(); else if (current && !current._manual) current.play().catch(function () {}); });
  }
})(typeof window !== "undefined" ? window : this);
