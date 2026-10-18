/* The booking form (build/booking.py). Every "Book a free call" link goes to /book/, which works without this script; with
   it, the same form opens over the page the reader is on, so nobody loses their place. On a phone it is the site's bottom
   sheet (phone.js: Back, Escape and Tab stay with it); on a computer the same sheet sits in the middle of the screen.

   Where a request goes is set once, in build/copy_deck.py (BOOKING_ENDPOINT), and arrives here as the form's
   data-endpoint:
   - empty: the details are written into a WhatsApp message to Puja, which opens ready to send;
   - set (a Formspree-style address): the form is posted there, and if that fails the same WhatsApp message is offered. */
(function (root) {
  "use strict";
  var WA = "918882696344";
  var HELP = { "weight-loss": "Weight loss", pcos: "PCOS or PCOD", diabetes: "Diabetes or prediabetes", thyroid: "Thyroid",
    menopause: "Menopause", pregnancy: "Pregnancy or after a baby", other: "Something else" };
  var TIME = { morning: "Morning", afternoon: "Afternoon", evening: "Evening" };
  /* words in a page's address that say what it is about: the first one in the address wins, except that weight loss, the
     broadest, gives way to anything more particular (/weight-loss/postpartum-diet/ is about after a baby) */
  var PATH_HELP = [[/(^|[\/-])(pcos|pcod)([\/-]|$)/, "pcos"], [/(^|[\/-])(pre)?diabe(tes|tic)([\/-]|$)|(^|[\/-])hba1c([\/-]|$)|fasting-blood-sugar/, "diabetes"],
    [/(^|[\/-])(thyroid|tsh|hypothyroidism|hashimotos?)([\/-]|$)/, "thyroid"], [/(^|[\/-])(peri)?menopause([\/-]|$)/, "menopause"],
    [/(^|[\/-])(pregnancy|pregnant|postpartum)([\/-]|$)/, "pregnancy"], [/(^|[\/-])weight-loss([\/-]|$)/, "weight-loss"]];

  function helpFor(path) {
    var best = null, at = Infinity;
    PATH_HELP.forEach(function (r) {
      var m = r[0].exec(String(path || ""));
      var where = m ? (r[1] === "weight-loss" ? 1e6 + m.index : m.index) : Infinity;
      if (where < at) { at = where; best = r[1]; }
    });
    return best || "";
  }
  function clean(s) { return String(s == null ? "" : s).replace(/\s+/g, " ").trim(); }
  /* a phone or WhatsApp number: spaces, dashes, dots and brackets are fine; 8 to 15 digits, an optional + in front */
  function phoneOk(s) {
    var p = clean(s).replace(/[\s().-]/g, "");
    return /^\+?\d{8,15}$/.test(p);
  }
  function check(f) {
    var errs = {};
    if (!clean(f.name)) errs.name = "Please write your name.";
    if (!clean(f.phone)) errs.phone = "Please write a phone or WhatsApp number.";
    else if (!phoneOk(f.phone)) errs.phone = "That number doesn't look right. Use 8 to 15 digits, with your country code if you're outside India, like +44.";
    return errs;
  }
  /* The WhatsApp message: every field that has something in it, one to a line. */
  function message(f) {
    var lines = ["Hi Puja, I'd like to book a free call."];
    function add(label, v) { v = clean(v); if (v) lines.push(label + ": " + v); }
    add("Name", f.name);
    add("Phone", f.phone);
    add("Help with", HELP[f.help] || f.help);
    add("Best time", TIME[f.time] || f.time);
    add("City", f.city);
    add("Note", f.note);
    add("From page", f.page);
    return lines.join("\n");
  }
  function waUrl(f) { return "https://wa.me/" + WA + "?text=" + encodeURIComponent(message(f)); }
  /* where a request goes: the form's endpoint when it is a web address, else WhatsApp */
  function mode(endpoint) { return /^https:\/\/\S+$/.test(clean(endpoint)) ? "post" : "whatsapp"; }

  /* the note a page fills in for the reader: what the button asks for, then a calculator's answer; both are already
     sentences in the reader's words ("Please send me this chart: ...", "My BMI came out at 26.6, ...") */
  function noteLine(ask, answer) { return [clean(ask), clean(answer)].filter(Boolean).join(" "); }

  /* The form in three steps (build/booking.py STEPS): 1 what it is about, 2 name and number, 3 time, city and note.
     Only step 2 can stop the reader: Next checks the name and number before step 3 opens, and sending from step 3 goes
     back to step 2 if they are not right. */
  var STEPS = 3;
  function stepErrors(step, f) {
    if (step !== 2) return {};
    return check(f);
  }
  /* where Back (dir -1) or Next (dir 1) leads from a step: { step, errs } (errs set when Next is held up) */
  function move(step, dir, f) {
    var errs = dir > 0 ? stepErrors(step, f) : {};
    if (Object.keys(errs).length) return { step: step, errs: errs };
    return { step: Math.max(1, Math.min(STEPS, step + dir)), errs: {} };
  }
  /* on send: the first step with something to fix, or 0 when the form can go */
  function firstBad(f) {
    for (var s = 1; s <= STEPS; s++) if (Object.keys(stepErrors(s, f)).length) return s;
    return 0;
  }
  /* what a screen reader hears when a step is held up: every message, in order */
  function announce(errs) {
    return ["name", "phone"].filter(function (k) { return errs[k]; }).map(function (k) { return errs[k]; }).join(" ");
  }

  var api = { helpFor: helpFor, noteLine: noteLine, phoneOk: phoneOk, check: check, message: message, waUrl: waUrl, mode: mode, HELP: HELP, TIME: TIME,
    STEPS: STEPS, stepErrors: stepErrors, move: move, firstBad: firstBad, announce: announce };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }
  root.PoshanBook = api;

  /* ---------- page binder ---------- */
  var doc = root.document;
  if (!doc || !doc.querySelector || !root.addEventListener) return;
  var phone = root.matchMedia ? root.matchMedia("(max-width:760px)") : { matches: false };

  function values(form) {
    var v = {};
    ["name", "phone", "help", "time", "city", "note", "page"].forEach(function (k) {
      var el = form.elements[k];
      v[k] = el ? el.value : "";
    });
    return v;
  }
  function errNode(el) { return doc.getElementById(el.id + "-err"); }
  function showErrors(form, errs) {
    var first = null;
    ["name", "phone"].forEach(function (k) {
      var el = form.elements[k], msg = errNode(el);
      if (errs[k]) {
        el.setAttribute("aria-invalid", "true");
        if (msg) { msg.textContent = errs[k]; msg.hidden = false; }
        if (!first) first = el;
      } else {
        el.removeAttribute("aria-invalid");
        if (msg) { msg.textContent = ""; msg.hidden = true; }
      }
    });
    var said = form.querySelector(".bk-live");
    if (said) said.textContent = first ? announce(errs) : "";
    if (first) first.focus();
    return !first;
  }
  /* after a first try, a field's message updates as it is fixed */
  function live(form) {
    ["name", "phone"].forEach(function (k) {
      var el = form.elements[k];
      el.addEventListener("input", function () {
        if (!el.hasAttribute("aria-invalid")) return;
        var e = check(values(form))[k], msg = errNode(el);
        if (!e) { el.removeAttribute("aria-invalid"); if (msg) { msg.textContent = ""; msg.hidden = true; } }
      });
    });
  }
  function openWa(url) {
    if (phone.matches) { root.location.href = url; return true; }  /* a phone hands over to the app; a new tab would stay behind empty */
    var w = root.open(url, "_blank");
    if (w) { try { w.opener = null; } catch (e) {} }
    return !!w;
  }
  /* a green tick that draws itself (site.css; drawn at once under reduced motion) above the thank-you words */
  var TICK = '<svg class="bk-tick" viewBox="0 0 52 52" aria-hidden="true" focusable="false"><circle cx="26" cy="26" r="23"/><path d="M15.5 27.5l7 7 14-15"/></svg>';
  function done(form, html) {
    var box = form.parentNode.querySelector(".book-done");
    form.hidden = true;
    box.innerHTML = TICK + html;
    box.hidden = false;
    box.focus();
  }
  function esc(s) { return clean(s).replace(/[&<>"']/g, function (c) { return "&#" + c.charCodeAt(0) + ";"; }); }
  var CALL = '<p class="small">Prefer to call? <a href="tel:+918882696344">+91 88826 96344</a></p>';
  function waDone(form, f, opened, why) {
    var url = waUrl(f);
    done(form, (why ? '<h3>' + why + '</h3>' : '<h3>Almost there: press send in WhatsApp</h3>')
      + '<p>' + (opened ? "WhatsApp has opened with your details written in a message to Puja. It reaches her once you press send there."
        : "Your details are written in a message to Puja, ready to send on WhatsApp.") + '</p>'
      + '<p><a class="btn" href="' + esc(url) + '" target="_blank" rel="noopener">' + (opened ? "Open WhatsApp again" : "Send it on WhatsApp") + '</a></p>' + CALL);
  }
  function sent(form, f) {
    done(form, '<h3>Thank you, ' + esc(f.name.split(" ")[0] || f.name) + '</h3><p>Your request has been sent to Puja. She will call you back on '
      + esc(f.phone) + ', on a phone call or WhatsApp. The first call is free.</p>' + CALL);
  }
  function submit(form, e) {
    e.preventDefault();
    var f = values(form);
    if (form._step && form._step() < STEPS) { form._go(1); return; }  /* Enter in an early step is Next */
    var bad = firstBad(f);
    if (bad && form._step) form._go(bad - form._step(), true);
    if (!showErrors(form, check(f))) return;
    var endpoint = form.getAttribute("data-endpoint") || "";
    if (mode(endpoint) === "whatsapp" || !root.fetch || !root.FormData) {
      var opened = openWa(waUrl(f));
      waDone(form, f, opened);
      return;
    }
    var btn = form.querySelector('button[type="submit"]'), label = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Sending";
    var data = new FormData(form);
    data.append("_subject", "Free call request from " + clean(f.name));
    root.fetch(endpoint, { method: "POST", body: data, headers: { Accept: "application/json" } })
      .then(function (r) { if (!r.ok) throw new Error(String(r.status)); sent(form, f); })
      .catch(function () {
        var opened = openWa(waUrl(f));
        waDone(form, f, opened, "The form didn't go through, so here it is on WhatsApp");
      })
      .then(function () { btn.disabled = false; btn.textContent = label; });
  }
  function bind(form) {
    if (form.getAttribute("data-bound")) return;
    form.setAttribute("data-bound", "1");
    form.noValidate = true;  /* our messages, tied to each field, instead of the browser's bubbles */
    live(form);
    steps(form);
    [].forEach.call(form.querySelectorAll('input[name="help"]'), function (r) {
      r.addEventListener("change", function () { form.removeAttribute("data-help-auto"); });  /* the reader's own pick stays */
    });
    form.addEventListener("submit", function (e) { submit(form, e); });
  }
  /* One step at a time: the progress dots, Back and Next, and the step's heading takes focus as it opens, so a screen
     reader says where the reader is. Without this script the three steps read one under the other. */
  var still = root.matchMedia && root.matchMedia("(prefers-reduced-motion: reduce)").matches;
  function steps(form) {
    var parts = [].slice.call(form.querySelectorAll(".bk-step"));
    if (parts.length !== STEPS) return;
    var prog = form.querySelector(".bk-prog"), back = form.querySelector(".bk-back"), next = form.querySelector(".bk-next"),
      send = form.querySelector(".bk-send"), n = form.querySelector(".bk-n"), dots = form.querySelectorAll(".bk-dots i"), at = 1;
    form.classList.add("bk-on");
    prog.hidden = false;
    function show(to, dir, focus) {
      at = to;
      parts.forEach(function (p, i) {
        var on = i + 1 === to;
        p.hidden = !on;
        p.classList.remove("bk-fwd", "bk-bwd");
        if (on && dir && !still) { void p.offsetWidth; p.classList.add(dir > 0 ? "bk-fwd" : "bk-bwd"); }
      });
      [].forEach.call(dots, function (d, i) { d.className = i + 1 < to ? "done" : i + 1 === to ? "now" : ""; });
      n.textContent = to;
      back.hidden = to === 1;
      next.hidden = to === STEPS;
      send.hidden = to !== STEPS;
      if (focus) {
        var h = parts[to - 1].querySelector(".bk-h");
        h.focus({ preventScroll: true });
        var r = h.getBoundingClientRect();
        if (r.top < 0 || r.bottom > root.innerHeight) h.scrollIntoView({ block: "nearest" });
      }
    }
    form._step = function () { return at; };
    /* by steps (Next and Back); skip true jumps there without checking (sending goes back to what needs fixing) */
    form._go = function (dir, skip) {
      if (skip) { show(at + dir, dir, false); return; }
      var r = move(at, dir, values(form));
      if (r.step === at) { showErrors(form, r.errs); return; }
      if (dir > 0 && at === 2) showErrors(form, {});
      show(r.step, dir, true);
    };
    form._reset = function () { show(1, 0, false); };
    form._head = function () { var h = parts[at - 1].querySelector(".bk-h"); h.focus({ preventScroll: true }); };
    /* Enter in a box (not the note) is Next until the last step, whether or not the browser counts the hidden send button */
    form.addEventListener("keydown", function (e) {
      var t = e.target;
      if (e.key !== "Enter" || at === STEPS || !t || t.tagName !== "INPUT" || e.isComposing) return;
      e.preventDefault();
      form._go(1);
    });
    next.addEventListener("click", function () { form._go(1); });
    back.addEventListener("click", function () { form._go(-1); });
    show(1, 0, false);
  }
  /* what the page knows: where the reader came from, its topic (or the goal a card's button names), a calculator's answer
     when one is showing, and what the button itself asks for (a diet chart's "Get this chart": "Please send me this chart: ...") */
  var autoNote = "";
  function context(form, from, pick, ask) {
    form.elements.page.value = from;
    var help = form.elements.help, want = pick || helpFor(from);
    if (want && (!help.value || form.getAttribute("data-help-auto"))) { help.value = want; form.setAttribute("data-help-auto", "1"); }
    var note = form.elements.note, ans = clean(root.poshanAnswer);
    var line = noteLine(ask, ans);
    if (note.value === autoNote) { note.value = line; autoNote = line; }
  }
  function sheet() {
    var s = doc.getElementById("book");
    if (s) return s;
    var tpl = doc.getElementById("book-tpl");
    if (!tpl || !tpl.content) return null;
    doc.body.appendChild(doc.importNode(tpl.content, true));
    s = doc.getElementById("book");
    if (s) s.classList.add("sheet");  /* now one of phone.js's sheets: Back, Escape, Tab, the dimmed page */
    var form = s && s.querySelector("form");
    if (form) bind(form);
    return s;
  }
  function reset(s) {  /* a sheet opened again after a request starts fresh, keeping what was typed only until it is sent */
    var form = s.querySelector("form"), box = s.querySelector(".book-done");
    if (form.hidden) { form.reset(); form.hidden = false; box.hidden = true; box.innerHTML = ""; autoNote = ""; form.removeAttribute("data-help-auto"); }
    if (form._reset) form._reset();  /* every opening starts at the first step; what was typed stays until it is sent */
  }
  function isBook(a) {
    return a && a.origin === root.location.origin && a.pathname === "/book/" && !a.hash;
  }

  /* the page's own form: /book/ */
  var own = doc.getElementById("bookform");
  if (own) {
    bind(own);
    var ref = "";
    try { var r = new URL(doc.referrer); if (r.origin === root.location.origin && r.pathname !== "/book/") ref = r.pathname; } catch (e) {}
    context(own, ref || "/book/");
  }

  doc.addEventListener("click", function (e) {
    var a = e.target.closest ? e.target.closest("a[href]") : null;
    if (!isBook(a) || e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    if (own) {  /* already on /book/: go to the form */
      e.preventDefault();
      own.scrollIntoView({ block: "start" });
      if (!own.hidden && own._head) own._head();
      return;
    }
    var api2 = root.poshanSheet, s = api2 && sheet();
    if (!s) return;  /* no sheet script: /book/ opens as a page, which works the same */
    e.preventDefault();
    /* a Book button inside the More sheet: that sheet steps aside and the form takes over its history step, so one Back
       still closes everything */
    [].forEach.call(doc.querySelectorAll(".sheet.open"), function (o) { o.classList.remove("open"); });
    reset(s);
    context(s.querySelector("form"), root.location.pathname, a.getAttribute("data-help"), a.getAttribute("data-book-note"));  /* a goal card names its goal; a chart asks for itself */
    api2.open("book", a);
    if (!phone.matches) { var f0 = s.querySelector("form"); if (f0._head) f0._head(); }  /* the first step's question; a phone keeps focus on Close */
  });
  /* phone.js closes a sheet from its Close button on phones only (the menu sheet is a phone thing); this one closes it
     on computers too */
  doc.addEventListener("click", function (e) {
    var x = e.target.closest ? e.target.closest("#book .x") : null;
    if (!x || phone.matches || !root.poshanSheet) return;
    e.preventDefault();
    root.poshanSheet.shut();
  });
})(typeof window !== "undefined" ? window : this);
