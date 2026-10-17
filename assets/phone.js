/* Phone edition: bottom sheets and the goal switcher (design/build_mobile_v3.py). Nothing is removed from the page:
   on wider screens it leaves everything alone. On phones the head script sets js-sheets before first paint so sheet
   content never flashes inline; if this file fails to load or stops early, js-sheets comes off again and every sheet
   reads inline. */
(function () {
  var phone = window.matchMedia && matchMedia("(max-width:760px)");
  if (!phone) return;
  var root = document.documentElement;
  root.classList.add("js-sheets");
  var last = null;
  if (document.querySelector(".sheet")) {  /* the dimmed page behind an open sheet; tapping it closes the sheet */
    var scrim = document.createElement("div");
    scrim.className = "scrim";
    scrim.setAttribute("aria-hidden", "true");
    scrim.addEventListener("click", shut);
    document.body.appendChild(scrim);
  }

  /* U20, T23: an open sheet is a step in the history, so Android's Back button closes it instead of leaving the page;
     Tab stays inside it; closing it any other way takes that step back off. */
  function shut(fromHistory) {
    if (!document.body.classList.contains("open")) return;
    document.body.classList.remove("open");
    document.querySelectorAll(".sheet.open").forEach(function (s) {
      s.classList.remove("open");
      s.removeAttribute("role");
      s.removeAttribute("aria-modal");
      s.removeAttribute("aria-label");
    });
    if (last) { last.focus(); last = null; }
    try { if (!fromHistory && history.state && history.state.poshanSheet) history.back(); } catch (e) {}
  }
  function open(id, trigger) {
    var s = document.getElementById(id);
    if (!s || !s.classList.contains("sheet")) return false;
    last = trigger;
    s.setAttribute("role", "dialog");  /* only while it floats; without the script it is ordinary page text */
    s.setAttribute("aria-modal", "true");
    var h = s.querySelector("h3, h2");
    if (h) s.setAttribute("aria-label", h.textContent);
    s.classList.add("open");
    document.body.classList.add("open");
    try { if (!(history.state && history.state.poshanSheet)) history.pushState({ poshanSheet: id }, ""); } catch (e) {}
    var x = s.querySelector(".x");
    if (x) x.focus();
    return true;
  }
  window.addEventListener("popstate", function () { shut(true); });
  /* book.js opens the booking form through these, on phones and computers alike: one history step, Back, Escape and Tab */
  window.poshanSheet = { open: open, shut: function () { shut(); } };
  function focusables(s) {
    return [].slice.call(s.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])'))
      .filter(function (el) { return el.offsetParent !== null || el === document.activeElement; });
  }

  /* a link inside an open sheet: one on this page closes the sheet and then scrolls (How I work on the home page); one to
     another page replaces the sheet's history step, so Back from there returns to this page, not to the open sheet */
  document.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest(".sheet.open a[href]") : null;
    if (!a || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || a.target) return;
    if (a.origin !== location.origin) return;
    if (a.pathname === location.pathname && a.hash) {
      var to = document.getElementById(decodeURIComponent(a.hash.slice(1)));
      if (!to) return;
      e.preventDefault();
      var done = false, go = function () { if (!done) { done = true; to.scrollIntoView(); } };
      if (history.state && history.state.poshanSheet) {  // after Back has taken the sheet's step off (it may restore the scroll)
        window.addEventListener("popstate", function f() { window.removeEventListener("popstate", f); setTimeout(go, 0); });
        setTimeout(go, 400);
      } else setTimeout(go, 0);
      shut();
      return;
    }
    if (history.state && history.state.poshanSheet) { e.preventDefault(); location.replace(a.href); }
  });
  window.addEventListener("pageshow", function (e) { if (e.persisted) shut(true); });

  document.addEventListener("click", function (e) {
    var t = e.target.closest ? e.target.closest("[data-sheet], .sheet .x") : null;
    if (!t || !phone.matches) return;
    if (t.classList.contains("x")) { e.preventDefault(); shut(); return; }
    if (open(t.getAttribute("data-sheet"), t)) e.preventDefault();
  });
  document.addEventListener("keydown", function (e) {
    if (!document.body.classList.contains("open")) return;
    if (e.key === "Escape") { shut(); return; }
    if (e.key !== "Tab") return;
    var s = document.querySelector(".sheet.open"), f = s ? focusables(s) : [];
    if (!f.length) return;
    var first = f[0], end = f[f.length - 1];
    if (e.shiftKey && (document.activeElement === first || !s.contains(document.activeElement))) { e.preventDefault(); end.focus(); }
    else if (!e.shiftKey && (document.activeElement === end || !s.contains(document.activeElement))) { e.preventDefault(); first.focus(); }
  });

  /* T22: tables that phones lay out as blocks (cards, or the lab tables' source under the number) keep their table
     meaning for screen readers, which drop it once CSS changes the display */
  document.querySelectorAll("table.stack, table.labtable").forEach(function (t) {
    t.setAttribute("role", "table");
    t.querySelectorAll("thead, tbody").forEach(function (g) { g.setAttribute("role", "rowgroup"); });
    t.querySelectorAll("tr").forEach(function (r) { r.setAttribute("role", "row"); });
    t.querySelectorAll("th").forEach(function (h) { h.setAttribute("role", "columnheader"); });
    t.querySelectorAll("td").forEach(function (d) { d.setAttribute("role", "cell"); });
  });

  /* U4: a sideways row of chips (diet, calories) shows the one you are on, even when it starts off the right edge */
  document.querySelectorAll(".switch, .goals").forEach(function (row) {
    var on = row.querySelector(".on");
    if (on && row.scrollWidth > row.clientWidth) row.scrollLeft = Math.max(0, on.offsetLeft - row.clientWidth / 2 + on.offsetWidth / 2);
  });

  /* goals: buttons inside .goals pick one [data-goal] pane in the same section, by data-goal value or else by order */
  var groups = [];
  document.querySelectorAll(".goals").forEach(function (g) {
    var scope = g.closest("section") || document;
    var buttons = [].slice.call(g.querySelectorAll("button"));
    var panes = [].slice.call(scope.querySelectorAll("[data-goal]")).filter(function (p) { return !g.contains(p); });
    if (!buttons.length || !panes.length) return;
    function pane(b, i) {
      var v = b.getAttribute("data-pick") || b.getAttribute("data-goal");
      if (v) for (var k = 0; k < panes.length; k++) if (panes[k].getAttribute("data-goal") === v) return panes[k];
      return panes[i];
    }
    function show(b) {
      buttons.forEach(function (x) { x.classList.toggle("on", x === b); x.setAttribute("aria-pressed", x === b ? "true" : "false"); });
      var p = pane(b, buttons.indexOf(b));
      panes.forEach(function (q) { q.hidden = phone.matches && q !== p; });
    }
    /* U19: a food page opens on the goal the reader picked last (or the one in ?goal=), not always on PCOS */
    function byGoal(v) { return v ? buttons.filter(function (b) { return b.getAttribute("data-pick") === v; })[0] : null; }
    var wanted = null;
    try { wanted = byGoal(new URLSearchParams(location.search).get("goal")) || byGoal(localStorage.getItem("poshan-goal")); } catch (e) {}
    if (wanted) buttons.forEach(function (x) { x.classList.toggle("on", x === wanted); });
    buttons.forEach(function (b) { b.addEventListener("click", function () {
      show(b);
      /* the pinned day row: a new day starts just under the row, not part-way down where the last one was being read */
      if (g.classList.contains("daypick") && phone.matches) {
        var p = pane(b, buttons.indexOf(b)), top = p ? p.getBoundingClientRect().top : 0, under = g.getBoundingClientRect().bottom;
        if (p && top < under) window.scrollBy(0, top - under - 8);
      }
      try { if (b.getAttribute("data-pick")) localStorage.setItem("poshan-goal", b.getAttribute("data-pick")); } catch (e) {}
    }); });
    var group = function () { show(buttons.filter(function (b) { return b.classList.contains("on"); })[0] || buttons[0]); };
    groups.push(group);
    group();
  });
  var redo = function () {
    if (!phone.matches) shut();
    groups.forEach(function (f) { f(); });
  };
  if (phone.addEventListener) phone.addEventListener("change", redo); else if (phone.addListener) phone.addListener(redo);
  window.poshanPhone = true;  /* the head script adds js-sheets on phones before paint, and takes it off at load unless this ran */
})();
/* The pinned bar steps up out of the way while you read down the page, and comes back as soon as you scroll up
   (design D3). Phones only; it never hides near the top, while a sheet is open, or while something in it has focus. */
(function () {
  var phone = window.matchMedia && matchMedia("(max-width:760px)");
  var bar = document.querySelector(".pbar");
  if (!phone || !bar || !window.requestAnimationFrame) return;
  var root = document.documentElement, lastY = window.pageYOffset, busy = false;
  function update() {
    busy = false;
    var y = window.pageYOffset, d = y - lastY;
    if (Math.abs(d) < 8) return;
    var hide = phone.matches && d > 0 && y > bar.offsetHeight * 2 && !document.body.classList.contains("open") && !bar.contains(document.activeElement);
    root.classList.toggle("bar-off", hide);
    lastY = y;
  }
  window.addEventListener("scroll", function () { if (!busy) { busy = true; requestAnimationFrame(update); } }, { passive: true });
  bar.addEventListener("focusin", function () { root.classList.remove("bar-off"); });
})();
/* Folds and long lists (r2 phone lane). A <details class="fold"> is built open; phones close it, computers keep it open,
   and a link to something inside one opens it. Long link lists show their first few on a phone, with a button for the
   rest; phone.css hides the rest only while html has js-sheets, so without this script every link shows. */
(function () {
  var phone = window.matchMedia && matchMedia("(max-width:760px)");
  if (!phone) return;
  var folds = [].slice.call(document.querySelectorAll("details.fold"));
  function openHash() {
    try {
      var t = location.hash && document.getElementById(decodeURIComponent(location.hash.slice(1)));
      var d = t && t.closest ? t.closest("details.fold") : null;
      if (d) d.open = true;
    } catch (e) {}
  }
  function setFolds() {
    folds.forEach(function (d) { d.open = !phone.matches; d.classList.add("r"); });
    openHash();
  }
  setFolds();
  window.addEventListener("hashchange", openHash);
  if (phone.addEventListener) phone.addEventListener("change", setFolds); else if (phone.addListener) phone.addListener(setFolds);

  /* [list selector, item selector, more than this many gets the button] (phone.css: the 9th link, the 7th list item) */
  /* [data-phone-show="N"]: any block whose first N children show (the home page's before-and-after photos) */
  [[".inline-links", ":scope > a", 8], ["ul.clip", ":scope > li", 6], ["[data-phone-show]", ":scope > *", 0]].forEach(function (rule) {
    document.querySelectorAll(rule[0]).forEach(function (list) {
      var n = list.querySelectorAll(rule[1]).length;
      if (n <= (rule[2] || +list.getAttribute("data-phone-show"))) return;
      var b = document.createElement("button");
      b.type = "button";
      b.className = "more-btn";
      b.textContent = "Show all " + n;
      b.setAttribute("aria-expanded", "false");
      b.addEventListener("click", function () {
        list.classList.add("all");
        b.hidden = true;
        b.setAttribute("aria-expanded", "true");
      });
      if (list.tagName === "UL" || rule[2] === 0) list.parentNode.insertBefore(b, list.nextSibling); else list.appendChild(b);
    });
  });
})();
/* Results page: a long quote shows five lines and a "Read it all" button (phone.css clamps only while js-sheets is on) */
(function () {
  var phone = window.matchMedia && matchMedia("(max-width:760px)");
  if (!phone || !phone.matches) return;
  document.querySelectorAll("#storyquotes .testimonial").forEach(function (q) {
    var p = q.querySelector("p");
    if (!p || p.scrollHeight <= p.clientHeight + 2) return;
    var b = document.createElement("button");
    b.type = "button";
    b.className = "readall";
    b.textContent = "Read it all";
    b.setAttribute("aria-expanded", "false");
    b.addEventListener("click", function () { q.classList.add("open"); b.hidden = true; b.setAttribute("aria-expanded", "true"); });
    p.parentNode.insertBefore(b, p.nextSibling);
  });
})();
/* Sideways rows on a phone (the certificates on /about/, the foods hub's ways in): "2 of 7" with Previous and Next under
   the row, as under the home page's quotes, so a card cut off at the edge reads as "more this way", not as a broken page */
(function () {
  var phone = window.matchMedia && matchMedia("(max-width:760px)");
  if (!phone || !phone.matches) return;
  var still = matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.querySelectorAll(".quals, .foodguides").forEach(function (row) {
    var n = row.children.length;
    if (n < 2 || row.scrollWidth <= row.clientWidth + 4) return;
    var nav = document.createElement("div"), count = document.createElement("span");
    nav.className = "strip-nav row-nav";
    count.className = "strip-count";
    count.setAttribute("aria-live", "polite");
    function step() { var c = row.children[0], g = parseFloat(getComputedStyle(row).columnGap) || 12; return c.getBoundingClientRect().width + g; }
    function btn(label, d) {
      var b = document.createElement("button");
      b.type = "button"; b.textContent = label; b.setAttribute("data-dir", d < 0 ? "prev" : "next");
      b.addEventListener("click", function () { row.scrollBy({ left: d * step(), behavior: still ? "auto" : "smooth" }); });
      return b;
    }
    var prev = btn("Previous", -1), next = btn("Next", 1);
    nav.appendChild(prev); nav.appendChild(count); nav.appendChild(next);
    row.parentNode.insertBefore(nav, row.nextSibling);
    function where() {
      var end = row.scrollLeft + row.clientWidth >= row.scrollWidth - 4;
      count.textContent = (end ? n : Math.min(n, Math.round(row.scrollLeft / step()) + 1)) + " of " + n;
      prev.classList.toggle("at-end", row.scrollLeft <= 4);
      next.classList.toggle("at-end", end);
    }
    row.addEventListener("scroll", function () { requestAnimationFrame(where); }, { passive: true });
    where();
  });
})();
