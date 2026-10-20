/* The home page's one interaction (build/core.py home()): nothing here is needed to read the page. Without this script
   the client's before and after photos sit side by side, as in the photo she sent.
   - Before and after: a divider between the two photos to drag (mouse, touch) or move with the arrow keys (the divider
     is a role=slider). It widens one photo and narrows the other: left of it is before, right of it after. */
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
  var api = { clamp: clamp, posFromX: posFromX, keyPos: keyPos, valueText: valueText };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }
  root.PoshanHome = api;

  var doc = root.document;
  if (!doc || !doc.querySelector || !root.addEventListener) return;
  function each(sel, fn) { [].forEach.call(doc.querySelectorAll(sel), fn); }

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

})(typeof window !== "undefined" ? window : this);
