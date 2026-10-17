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

  var api = { helpFor: helpFor, phoneOk: phoneOk, check: check, message: message, waUrl: waUrl, mode: mode, HELP: HELP, TIME: TIME };
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
  function done(form, html) {
    var box = form.parentNode.querySelector(".book-done");
    form.hidden = true;
    box.innerHTML = html;
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
    form.addEventListener("submit", function (e) { submit(form, e); });
  }
  /* what the page knows: where the reader came from, its topic, and a calculator's answer when one is showing */
  var autoNote = "";
  function context(form, from) {
    form.elements.page.value = from;
    var help = form.elements.help, want = helpFor(from);
    if (want && (!help.value || help.getAttribute("data-auto"))) { help.value = want; help.setAttribute("data-auto", "1"); }
    var note = form.elements.note, ans = clean(root.poshanAnswer);
    var line = ans;  /* already a sentence in the reader's words: "My BMI came out at 26.6, ..." */
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
    if (form) {
      bind(form);
      form.elements.help.addEventListener("change", function () { form.elements.help.removeAttribute("data-auto"); });
    }
    return s;
  }
  function reset(s) {  /* a sheet opened again after a request starts fresh, keeping what was typed only until it is sent */
    var form = s.querySelector("form"), box = s.querySelector(".book-done");
    if (form.hidden) { form.reset(); form.hidden = false; box.hidden = true; box.innerHTML = ""; autoNote = ""; }
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
      if (!own.hidden) own.elements.name.focus();
      return;
    }
    var api2 = root.poshanSheet, s = api2 && sheet();
    if (!s) return;  /* no sheet script: /book/ opens as a page, which works the same */
    e.preventDefault();
    /* a Book button inside the More sheet: that sheet steps aside and the form takes over its history step, so one Back
       still closes everything */
    [].forEach.call(doc.querySelectorAll(".sheet.open"), function (o) { o.classList.remove("open"); });
    reset(s);
    context(s.querySelector("form"), root.location.pathname);
    api2.open("book", a);
    if (!phone.matches) { var n = s.querySelector('input[name="name"]'); if (n) n.focus(); }  /* a phone keeps the keyboard down until a field is tapped */
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
