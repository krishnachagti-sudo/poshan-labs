/* The home page's three interactions (build/core.py home()), in the nav's design sense: nothing here is needed to read
   the page. Without this script the photos sit side by side, the steps have no line, and every goal card shows all.
   - Before and after: each client's two photos in one frame, with a divider to drag (mouse, touch) or move with the
     arrow keys (the divider is a role=slider). Left of it is before, right of it after.
   - The steps' line: a green line through the three steps that fills as the reader scrolls through them and ends at
     the Book button; across on a laptop, down on a phone. Under reduced motion it is drawn full.
   - Goal cards on a phone: folded to photo and name; a tap opens her words, a Book button and Read more. */
(function (root) {
  "use strict";
  /* ---------- the arithmetic (tests/home.test.mjs) ---------- */
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }
  /* the divider's place, 0 to 100, from a pointer at x over a frame from left, width wide */
  function posFromX(x, left, width) { return width > 0 ? clamp(Math.round((x - left) / width * 1000) / 10, 0, 100) : 50; }
  /* the divider after a key: arrows 5 at a time, Page Up and Down 20, Home and End the ends; null for any other key */
  function keyPos(key, pos) {
    var d = { ArrowLeft: -5, ArrowDown: -5, ArrowRight: 5, ArrowUp: 5, PageDown: -20, PageUp: 20 }[key];
    if (d !== undefined) return clamp(pos + d, 0, 100);
    if (key === "Home") return 0;
    if (key === "End") return 100;
    return null;
  }
  function valueText(pos) {
    var b = Math.round(pos);
    return b + "% before, " + (100 - b) + "% after";
  }
  /* how much of the line is drawn: 0 until the reading point reaches its start, 1 once it reaches its end */
  function progress(at, start, end) { return end > start ? clamp((at - start) / (end - start), 0, 1) : 1; }

  var api = { clamp: clamp, posFromX: posFromX, keyPos: keyPos, valueText: valueText, progress: progress };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }
  root.PoshanHome = api;

  var doc = root.document;
  if (!doc || !doc.querySelector || !root.addEventListener) return;
  var still = root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches;
  var phone = root.matchMedia ? root.matchMedia("(max-width:760px)") : { matches: false };
  function each(sel, fn) { [].forEach.call(doc.querySelectorAll(sel), fn); }
  function onMedia(fn) { if (phone.addEventListener) phone.addEventListener("change", fn); else if (phone.addListener) phone.addListener(fn); }

  /* ---------- before and after ---------- */
  function slider(frame) {
    var who = frame.getAttribute("data-who") || "the client";
    var handle = doc.createElement("div");
    handle.className = "ba-handle";
    handle.setAttribute("role", "slider");
    handle.tabIndex = 0;
    handle.setAttribute("aria-label", "Before and after photos of " + who + ": move to compare");
    handle.setAttribute("aria-orientation", "horizontal");
    handle.setAttribute("aria-valuemin", "0");
    handle.setAttribute("aria-valuemax", "100");
    handle.innerHTML = '<span class="ba-knob" aria-hidden="true"><svg viewBox="0 0 24 24" focusable="false"><path d="M9 6l-6 6 6 6M15 6l6 6-6 6"/></svg></span>';
    frame.appendChild(handle);
    frame.classList.add("on");
    var pos = 50;
    function set(p) {
      pos = p;
      frame.style.setProperty("--pos", p + "%");
      handle.setAttribute("aria-valuenow", String(Math.round(p)));
      handle.setAttribute("aria-valuetext", valueText(p));
      frame.classList.toggle("b-gone", p < 16);
      frame.classList.toggle("a-gone", p > 84);
    }
    set(50);
    handle.addEventListener("keydown", function (e) {
      var p = keyPos(e.key, pos);
      if (p === null) return;
      e.preventDefault();
      set(p);
    });
    /* a mouse drags from wherever it presses; a finger drags only once it moves sideways, so the page still scrolls
       under a finger that moves up or down, and a tap moves the divider to where it landed */
    var id = null, x0 = 0, y0 = 0, dragging = false;
    function x2pos(x) { var r = frame.getBoundingClientRect(); return posFromX(x, r.left, r.width); }
    frame.addEventListener("pointerdown", function (e) {
      if (e.button) return;
      id = e.pointerId; x0 = e.clientX; y0 = e.clientY;
      dragging = e.pointerType === "mouse";
      if (dragging) { e.preventDefault(); frame.setPointerCapture(id); frame.classList.add("drag"); set(x2pos(e.clientX)); handle.focus({ preventScroll: true }); }
    });
    frame.addEventListener("pointermove", function (e) {
      if (e.pointerId !== id) return;
      if (!dragging) {
        var dx = Math.abs(e.clientX - x0), dy = Math.abs(e.clientY - y0);
        if (dx > 6 && dx > dy) { dragging = true; frame.setPointerCapture(id); frame.classList.add("drag"); }
        else if (dy > 8) { id = null; return; }
        else return;
      }
      set(x2pos(e.clientX));
    });
    function end(e) {
      if (e.pointerId !== id) return;
      if (!dragging && e.type === "pointerup") set(x2pos(e.clientX));  /* a tap */
      id = null; dragging = false;
      frame.classList.remove("drag");
    }
    frame.addEventListener("pointerup", end);
    frame.addEventListener("pointercancel", end);
    frame.addEventListener("dragstart", function (e) { e.preventDefault(); });  /* the photos are not to be dragged away */
  }
  each(".ba-frame", slider);

  /* ---------- the steps' line ---------- */
  var how = doc.querySelector(".howline");
  if (how) {
    var track = doc.createElement("span"), fill = doc.createElement("i");
    track.className = "hl-track";
    track.setAttribute("aria-hidden", "true");
    track.appendChild(fill);
    how.insertBefore(track, how.firstChild);
    how.classList.add("hl-on");
    var geo = null, ticking = false;
    function nodes() {  /* the number circles in view on this screen: the laptop's steps or the phone's rows */
      var dots = [].slice.call(how.querySelectorAll(phone.matches ? ".accs .num" : "ol.how3 > li"));
      return dots.filter(function (d) { return d.offsetParent !== null; });
    }
    function measure() {
      var dots = nodes(), btn = how.querySelector(".ctas .btn");
      if (!dots.length || !btn) { track.hidden = true; geo = null; return; }
      track.hidden = false;
      var box = how.getBoundingClientRect(), b = btn.getBoundingClientRect(), down = phone.matches;
      var centre = function (d) {
        var r = d.getBoundingClientRect();
        /* the laptop's number is the li's ::before: a 38 px circle at its top left */
        return down ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : { x: r.left + 19, y: r.top + 19 };
      };
      var a = centre(dots[0]), cs = dots.map(centre);
      if (down) {
        geo = { down: true, x: a.x - box.left, y0: a.y - box.top, y1: b.top - box.top, stops: cs.map(function (c) { return c.y - box.top; }) };
        track.style.cssText = "left:" + (geo.x - 1.5) + "px;top:" + geo.y0 + "px;width:3px;height:" + (geo.y1 - geo.y0) + "px";
      } else {
        geo = { down: false, y: a.y - box.top, x0: a.x - box.left, x1: b.left - box.left, stops: cs.map(function (c) { return c.x - box.left; }) };
        track.style.cssText = "top:" + (geo.y - 1.5) + "px;left:" + geo.x0 + "px;height:3px;width:" + (geo.x1 - geo.x0) + "px";
      }
      draw();
    }
    function draw() {
      ticking = false;
      if (!geo) return;
      var p;
      if (still) p = 1;
      else {
        var box = how.getBoundingClientRect(), vh = root.innerHeight;
        /* down: the tip follows a reading point 60% down the screen; across: the line fills while the steps cross the
           lower part of the screen, done by the time they are a third of the way up */
        p = geo.down ? progress(vh * 0.6, box.top + geo.y0, box.top + geo.y1)
          : progress(vh * 0.92 - box.top, 0, box.height + vh * 0.25);
      }
      fill.style.transform = (geo.down ? "scaleY(" : "scaleX(") + p + ")";
      var len = geo.down ? geo.y1 - geo.y0 : geo.x1 - geo.x0, from = geo.down ? geo.y0 : geo.x0;
      nodes().forEach(function (d, i) { d.classList.toggle("hl-hit", (geo.stops[i] - from) <= p * len + 2); });
      how.classList.toggle("hl-done", p >= 1);
    }
    function soon() { if (!ticking) { ticking = true; root.requestAnimationFrame(draw); } }
    root.addEventListener("scroll", soon, { passive: true });
    root.addEventListener("resize", measure);
    onMedia(measure);
    how.addEventListener("toggle", function () { measure(); }, true);  /* a phone row opening moves the rows under it */
    if (root.ResizeObserver) new root.ResizeObserver(measure).observe(how);
    measure();
    if (doc.fonts && doc.fonts.ready) doc.fonts.ready.then(measure);
  }

  /* ---------- goal cards on a phone ---------- */
  var cards = [].slice.call(doc.querySelectorAll(".helpcard"));
  if (cards.length) {
    var wrap = cards[0].parentNode;
    cards.forEach(function (card) {
      var link = card.querySelector(".hc-link"), more = card.querySelector(".hc-more");
      if (!link || !more) return;
      var btn = doc.createElement("button");
      btn.type = "button";
      btn.className = "hc-tog";
      btn.setAttribute("aria-expanded", "false");
      btn.setAttribute("aria-controls", more.id);
      card._parts = { link: link, btn: btn, more: more };
      card.addEventListener("click", function (e) {  /* the photo opens it too; the links inside do their own thing */
        if (!phone.matches || more.contains(e.target) || btn.contains(e.target)) return;
        btn.click();
      });
      btn.addEventListener("click", function () {
        var open = !card.classList.contains("open");
        card.classList.toggle("open", open);
        btn.setAttribute("aria-expanded", open ? "true" : "false");
      });
    });
    /* phone: the name is a button that opens the card; laptop: the name is the card's link again */
    var mode = function () {
      cards.forEach(function (card) {
        var p = card._parts;
        if (!p) return;
        var from = phone.matches ? p.link : p.btn, to = phone.matches ? p.btn : p.link;
        if (from.parentNode) {
          while (from.firstChild) to.appendChild(from.firstChild);
          from.parentNode.replaceChild(to, from);
        }
        if (!phone.matches) { card.classList.remove("open"); p.btn.setAttribute("aria-expanded", "false"); }
      });
      wrap.classList.toggle("hc-on", phone.matches);
    };
    onMedia(mode);
    mode();
  }
})(typeof window !== "undefined" ? window : this);
