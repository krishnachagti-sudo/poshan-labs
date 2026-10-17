/* Poshan Labs calculators. Pure maths first (exported for node tests), then the page binder. */
(function (root) {
  "use strict";

  /* name is a box ("weight": "Enter your weight.", "Enter a weight between 25 and 250 kg.") or, for a count,
     [what is counted, how to ask] (["minutes of exercise", "how many minutes you exercise a day"]: "Enter between 0 and 600 minutes of exercise."). */
  /* A tape measurement names its box: "Enter your waist measurement.", "Enter a waist measurement of 40 to 200 cm." */
  function tape(v, part, min, max) {
    var n = typeof v === "string" ? (v.trim() === "" ? NaN : Number(v)) : v;
    if (typeof n !== "number" || !isFinite(n)) throw new RangeError("Enter your " + part + " measurement.");
    if (n < min || n > max) throw new RangeError("Enter a " + part + " measurement of " + min + " to " + max + " cm.");
    return n;
  }
  function num(v, name, min, max, unit) {
    var n = typeof v === "string" ? (v.trim() === "" ? NaN : Number(v)) : v, count = typeof name !== "string";
    if (typeof n !== "number" || !isFinite(n)) throw new RangeError(count ? "Enter " + name[1] + "." : "Enter your " + name + ".");
    if (n < min || n > max) throw new RangeError(count ? "Enter between " + min + " and " + max + " " + name[0] + "." :
      "Enter " + (/^([aeiou]|HbA1c)/i.test(name) ? "an " : "a ") + name + " between " + min + " and " + max + (unit ? (unit === "%" ? "" : " ") + unit : "") + ".");
    return n;
  }
  /* A number worked out from the boxes (BMR, maintenance, BMI) that is out of any sensible range: the boxes are odd together. */
  function inner(x, min, max, say) {
    if (typeof x !== "number" || !isFinite(x) || x < min || x > max) throw new RangeError(say || "Those numbers don't add up together. Check your age, height and weight.");
    return x;
  }
  function sexOf(s) {
    if (s !== "female" && s !== "male") throw new RangeError("Choose female or male.");
    return s;
  }
  function r1(x) { return Math.round(x * 10) / 10; }

  var H = [100, 230, "cm"], W = [25, 250, "kg"];

  /* BMI is banded on the number the page prints (one decimal), so 24.99 reads 25.0 and Obese, and 22.96 reads 23.0 and Over. */
  function bmiBand(v) { var x = r1(v); return x < 18.5 ? "under" : x < 23 ? "healthy" : x < 25 ? "over" : "obese"; }
  function bmi(heightCm, weightKg) {
    var h = num(heightCm, "height", H[0], H[1], "cm") / 100, w = num(weightKg, "weight", W[0], W[1], "kg");
    var v = inner(w / (h * h), 12, 60, "Check your height and weight: together they give a BMI of " + r1(w / (h * h)) + ", which is not possible for an adult.");
    return { value: v, band: bmiBand(v) };
  }
  /* The calorie tools are for adults (18 and over); a younger age gets its own sentence, not a range. */
  var UNDER_18 = "This calculator is for adults. If you are under 18, please talk to your doctor with a parent.";
  function bmr(sex, age, heightCm, weightKg) {
    sexOf(sex);
    var n = typeof age === "string" ? (age.trim() === "" ? NaN : Number(age)) : age;
    if (isFinite(n) && n >= 10 && n < 18) throw new RangeError(UNDER_18);
    var a = num(age, "age", 18, 100, "years"), h = num(heightCm, "height", H[0], H[1], "cm"), w = num(weightKg, "weight", W[0], W[1], "kg");
    return 10 * w + 6.25 * h - 5 * a + (sex === "male" ? 5 : -161);
  }
  var ACTIVITY = { sedentary: 1.2, light: 1.375, moderate: 1.55, active: 1.725 };
  function tdee(bmrValue, activity) {
    if (!ACTIVITY[activity]) throw new RangeError("Choose how active you are.");
    return inner(bmrValue, 500, 5000) * ACTIVITY[activity];
  }
  function lossTarget(tdeeValue, sex) {
    var t = inner(tdeeValue, 500, 9000), floor = sexOf(sex) === "male" ? 1500 : 1200;
    return { gentle: Math.max(floor, t - 300), steady: Math.max(floor, t - 500), floor: floor };
  }
  /* ICMR-NIN (2020): 0.83 g per kg for a healthy adult. Above PROTEIN_CAP_KG the weight counted stops rising: at a very
     high weight much of it is not muscle, and grams per kg of total weight would ask for far more than anyone needs. */
  var PROTEIN = { general: 0.83, active: 1.2, "weight-loss": 1.0 }, PROTEIN_CAP_KG = 120;
  function proteinNeed(weightKg, goal) {
    if (!PROTEIN[goal]) throw new RangeError("Choose a goal.");
    return Math.round(Math.min(num(weightKg, "weight", W[0], W[1], "kg"), PROTEIN_CAP_KG) * PROTEIN[goal]);
  }
  function healthyRange(heightCm) {
    var h = num(heightCm, "height", H[0], H[1], "cm") / 100;
    return { minKg: r1(18.5 * h * h), maxKg: r1(22.9 * h * h) };
  }
  function waistHeight(waistCm, heightCm) {
    var ratio = tape(waistCm, "waist", 40, 200) / num(heightCm, "height", H[0], H[1], "cm");
    return { ratio: ratio, flag: ratio >= 0.5 };
  }
  function waistHip(waistCm, hipCm, sex) {
    var ratio = tape(waistCm, "waist", 40, 200) / tape(hipCm, "hip", 50, 220);
    ratio = Math.round(ratio * 100) / 100;
    return { ratio: ratio, flag: ratio >= (sexOf(sex) === "male" ? 0.9 : 0.85) };
  }
  function bodyFatNavy(sex, heightCm, neckCm, waistCm, hipCm) {
    sexOf(sex);
    var h = num(heightCm, "height", H[0], H[1], "cm"), n = tape(neckCm, "neck", 20, 70), w = tape(waistCm, "waist", 40, 200);
    var v;
    if (sex === "male") {
      if (w - n <= 0) throw new RangeError("Your waist should measure more than your neck.");
      v = 495 / (1.0324 - 0.19077 * Math.log10(w - n) + 0.15456 * Math.log10(h)) - 450;
    } else {
      var hip = tape(hipCm, "hip", 50, 220);
      v = 495 / (1.29579 - 0.35004 * Math.log10(w + hip - n) + 0.221 * Math.log10(h)) - 450;
    }
    if (!isFinite(v) || v < 2 || v > 70) throw new RangeError("Those measurements don't add up. Check them and try again.");
    return r1(v);
  }
  /* An empty minutes box counts as no exercise. Exercise counts up to WATER_MAX_MIN minutes a day: past that the rule of
     thumb stops meaning much, and long sessions need water spread through them, not one big daily number. */
  var WATER_MAX_MIN = 180, WATER_HIGH_L = 5;
  function water(weightKg, activityMinutes) {
    var w = num(weightKg, "weight", W[0], W[1], "kg");
    var m = blank(activityMinutes) ? 0 : num(activityMinutes, ["minutes of exercise", "how many minutes you exercise a day"], 0, 600);
    return r1(0.035 * w + 0.35 * (Math.min(m, WATER_MAX_MIN) / 30));
  }
  function hba1cToEag(a1c) {
    var a = num(a1c, "HbA1c", 4, 18, "%"), mgdl = Math.round((28.7 * a - 46.7) * 1e6) / 1e6;  // 28.7 * 6 - 46.7 is 125.49999999999999 in floats; the ADA chart says 126
    return { mgdl: mgdl, mmol: mgdl / 18 };
  }
  /* ADA: below 5.7% normal, 5.7% to 6.4% prediabetes, 6.5% or more diabetes. Banded on the number as typed (one decimal). */
  function a1cBand(a1c) { var a = r1(Number(a1c)); return a < 5.7 ? "normal" : a < 6.5 ? "prediabetes" : "diabetes"; }
  /* Body fat by the American Council on Exercise chart: [upper end of each band] for women and men. */
  var ACE = { female: [21, 25, 32], male: [14, 18, 25] };
  function fatBand(pct, sex) { var c = ACE[sexOf(sex)]; return pct < c[0] ? "athletic" : pct < c[1] ? "fit" : pct < c[2] ? "average" : "high"; }
  /* HOMA-IR (Matthews et al., 1985): fasting glucose (mg/dL) x fasting insulin (uIU/mL) / 405. mmol/L is converted at 18 mg/dL per mmol/L. */
  var GLUCOSE = { mgdl: [40, 500, "mg/dL"], mmol: [2.2, 27.8, "mmol/L"] };
  function homaIR(o) {
    o = o || {};
    if (!GLUCOSE[o.unit]) throw new RangeError("Choose mg/dL or mmol/L for your glucose.");
    var g = GLUCOSE[o.unit], glucose = num(o.glucose, "fasting glucose", g[0], g[1], g[2]);
    var insulin = num(o.insulin, "fasting insulin", 0.5, 300, "\u00b5IU/mL");
    return (o.unit === "mmol" ? glucose * 18 : glucose) * insulin / 405;
  }
  /* There is no single agreed cut-off: 2.5 is the NHANES (US survey) cut-off, and lower ones, from about 1.4, are reported for metabolic problems in Asian populations. */
  function homaBand(v) { return v < 1.4 ? "low" : v < 2.5 ? "mid" : "high"; }
  function pregnancyGain(prePregBmi) {
    var b = r1(inner(prePregBmi, 12, 60, "Check your height and weight before pregnancy: together they give a BMI of " + r1(prePregBmi) + ", outside the 12 to 60 this chart covers."));
    if (b < 18.5) return { minKg: 12.5, maxKg: 18 };
    if (b < 25) return { minKg: 11.5, maxKg: 16 };
    if (b < 30) return { minKg: 7, maxKg: 11.5 };
    return { minKg: 5, maxKg: 9 };
  }
  var TSP_G = 5;
  /* A home dish counts in its own unit (katori, roti); a raw food in grams, or teaspoons for oil and ghee. */
  function thali(items, foods) {
    if (!items || !items.length) throw new RangeError("Add at least one food.");
    var t = { kcal: 0, protein: 0, carb: 0, fibre: 0, fat: 0 };
    items.forEach(function (it) {
      var f = foods[it.code], factor;
      if (!f) throw new RangeError("Pick a food from the list.");
      if (f.per === "unit") factor = num(it.amount, [f.plural || "servings", "how many " + (f.plural || "servings")], 0.25, 20);
      else {
        var g = it.grams != null ? it.grams : it.unit === "tsp" ? num(it.amount, ["teaspoons", "how many teaspoons"], 0.25, 40) * TSP_G : it.amount;
        factor = num(g, ["g", "how many grams"], 1, 1000) / 100;
      }
      Object.keys(t).forEach(function (k) { t[k] += (f[k] || 0) * factor; });
    });
    Object.keys(t).forEach(function (k) { t[k] = r1(t[k]); });
    return t;
  }
  function blank(v) { return v == null || (typeof v === "string" && v.trim() === ""); }
  function cmToFtIn(cm) {  // whole inches first, so 152 cm is 5 ft 0 in, never 4 ft 12 in
    var all = Math.round(Number(cm) / 2.54);
    return { ft: Math.floor(all / 12), "in": all % 12 };
  }
  function ftInToCm(ft, inch) {
    var f = num(ft, "height", 3, 7, "feet"), i = blank(inch) ? 0 : num(inch, ["inches", "the inches"], 0, 11.9);
    return (f * 12 + i) * 2.54;
  }
  /* Feet and inches are checked in feet and inches, so a wrong height never comes back as a range in cm. */
  var FT_RANGE = "Enter a height between 3 ft 4 in and 7 ft 6 in.";
  function ftInHeight(ft, inch) {
    var cm = ftInToCm(ft, inch);
    if (cm < H[0] || cm > H[1]) throw new RangeError(FT_RANGE);
    return cm;
  }
  /* Tape measurements in inches: checked against the same span as cm (rounded inwards to whole inches), then turned into cm. */
  var TAPE = { waist: ["waist", 40, 200], hip: ["hip", 50, 220], neck: ["neck", 20, 70] };
  function inchTape(v, part) {
    var t = TAPE[part], lo = Math.ceil(t[1] / 2.54), hi = Math.floor(t[2] / 2.54);
    var n = typeof v === "string" ? (v.trim() === "" ? NaN : Number(v)) : v;
    if (typeof n !== "number" || !isFinite(n)) throw new RangeError("Enter your " + t[0] + " measurement.");
    if (n < lo || n > hi) throw new RangeError("Enter a " + t[0] + " measurement of " + lo + " to " + hi + " inches.");
    return n * 2.54;
  }

  /* Worked example shown before anyone types, so the form never looks filled in when it isn't. */
  var EXAMPLE = { height: 160, ft: 5, "in": 3, weight: 58, age: 40, waist: 78, hip: 98, neck: 32, minutes: 30, a1c: 6.5, glucose: 85, glucose_mmol: 4.7, insulin: 5 };
  function tapeSay(word, cm, tunit) { return word + " " + (tunit === "in" ? r1(cm / 2.54) + " in" : cm + " cm"); }
  var SAY = { weight: function (e) { return e.weight + " kg"; }, age: function (e) { return e.age + " years old"; },
    waist: function (e, t) { return tapeSay("waist", e.waist, t); }, hip: function (e, t) { return tapeSay("hips", e.hip, t); },
    neck: function (e, t) { return tapeSay("neck", e.neck, t); }, minutes: function (e) { return e.minutes + " minutes of exercise"; },
    a1c: function (e) { return "HbA1c " + e.a1c + "%"; },
    insulin: function (e) { return "fasting insulin " + e.insulin + " \u00b5IU/mL"; } };
  /* A tool whose example must make sense on its own: the weight loss calculator shows someone overweight (BMI 26.6). */
  var EXAMPLE_FOR = { loss: { weight: 68 } };
  function exampleFor(kind) {
    var e = {}, k, own = EXAMPLE_FOR[kind] || {};
    for (k in EXAMPLE) e[k] = EXAMPLE[k];
    for (k in own) e[k] = own[k];
    return e;
  }
  function exampleValue(name, unit, kind, tunit) {
    var e = exampleFor(kind);
    if (name === "glucose" && unit === "mmol") return e.glucose_mmol;
    return TAPE[name] && tunit === "in" ? r1(e[name] / 2.54) : e[name];
  }
  function exampleNote(fields, hunit, unit, kind, tunit) {
    var E = exampleFor(kind);
    var parts = fields.map(function (f) {
      if (f === "glucose") return "fasting glucose " + exampleValue("glucose", unit, kind) + (unit === "mmol" ? " mmol/L" : " mg/dL");
      if (f === "height") return hunit === "ftin" ? E.ft + " ft " + E["in"] + " in tall" : E.height + " cm tall";
      return SAY[f] ? SAY[f](E, tunit) : null;
    }).filter(Boolean);
    return "Showing an example: " + parts.join(", ") + ". Put in yours to see your own answer.";
  }
  /* What the answer box asks for once someone has started typing: the first box still empty, by its name. */
  var ASK = { ft: "your height", height: "your height", weight: "your weight", age: "your age", waist: "your waist measurement",
    hip: "your hip measurement", neck: "your neck measurement", minutes: "your minutes of exercise", a1c: "your HbA1c",
    glucose: "your fasting glucose", insulin: "your fasting insulin" };
  function prompt(name) { return '<p class="prompt">Now enter ' + (ASK[name] || "the next box") + ".</p>"; }

  /* Band scales: where a number falls between the cut-offs the tool already uses. */
  var SCALES = {
    bmi: function () { return { min: 15, max: 35, digits: 1, bands: [["under", "Under", 18.5, "#9cb7c9"], ["healthy", "Healthy", 23, "#a6c98a"], ["over", "Over", 25, "#E59A57"], ["obese", "Obese", 35, "#e0533e"]] }; },
    whtr: function () { return { min: 0.35, max: 0.75, digits: 2, bands: [["ok", "Under half", 0.5, "#a6c98a"], ["flag", "Over half", 0.75, "#e0533e"]] }; },
    homa: function () { return { min: 0, max: 4, digits: 2, bands: [["low", "Under 1.4", 1.4, "#a6c98a"], ["mid", "1.4 to 2.5", 2.5, "#d8d3a0"], ["high", "2.5 and over", 4, "#e0533e"]] }; },
    whr: function (sex) { var cut = sexOf(sex) === "male" ? 0.9 : 0.85;
      return { min: 0.65, max: 1.1, digits: 2, bands: [["ok", "Below the cut-off", cut, "#a6c98a"], ["flag", "Above it", 1.1, "#e0533e"]] }; },
    /* ACE body fat chart: each scale is 30 points wide, so the narrow "Fit" band always has room for its name */
    bodyfat: function (sex) { var c = ACE[sexOf(sex)], lo = sex === "male" ? 5 : 12;
      return { min: lo, max: lo + 30, digits: 1, bands: [["athletic", "Athletic", c[0], "#9cb7c9"], ["fit", "Fit", c[1], "#a6c98a"], ["average", "Average", c[2], "#E59A57"], ["high", "Obese", lo + 30, "#e0533e"]] }; },
  };
  function scale(kind, value, sex) {
    var s = SCALES[kind](sex), span = s.max - s.min, from = s.min;
    var pos = function (v) { return Math.min(1, Math.max(0, (v - s.min) / span)); };
    return { kind: kind, digits: s.digits, at: pos(value), cuts: s.bands.slice(0, -1).map(function (b) { return { v: b[2], at: pos(b[2]) }; }),
      bands: s.bands.map(function (b) { var band = { key: b[0], label: b[1], color: b[3], from: pos(from), to: pos(b[2]) }; from = b[2]; return band; }) };
  }
  function wob(seed, k) { return Math.sin(seed * 12.9898 + k * 1.7) * 0.6 + Math.sin(seed * 4.1 + k * 3.3) * 0.4; }
  function wobLine(x1, y1, x2, y2, seed) {
    var n = Math.max(2, Math.round(Math.abs(x2 - x1 + y2 - y1) / 40)), d = "";
    for (var i = 0; i <= n; i++) {
      var x = x1 + (x2 - x1) * i / n, y = y1 + (y2 - y1) * i / n, j = i === 0 || i === n ? 0 : 1.6;
      d += (i ? " L" : "M") + (x + (y1 === y2 ? 0 : wob(seed, i) * j)).toFixed(1) + " " + (y + (y1 === y2 ? wob(seed, i) * j : 0)).toFixed(1);
    }
    return d;
  }
  function wobBox(x, y, w, h, seed) {
    return wobLine(x, y, x + w, y, seed) + " " + wobLine(x + w, y, x + w, y + h, seed + 1).replace("M", "L") + " " +
      wobLine(x + w, y + h, x, y + h, seed + 2).replace("M", "L") + " " + wobLine(x, y + h, x, y, seed + 3).replace("M", "L") + "Z";
  }
  function scaleSvg(s, text) {
    /* drawn at 440 x 156: 20 px of air each side, the "you" label on top, the band in the middle, the cut-off numbers
       under it and the band names on a row of their own below those. The first band name starts at the left edge and the
       last ends at the right edge, so no name is clipped; the ones between are centred on their band. */
    var VW = 440, VH = 156, X = 20, W = 400, Y = 58, H = 30, INK = "#1F2A1B", LAB = "#2C431C", out = "";
    var font = ' font-family="Hind, sans-serif" font-weight="500" fill="' + LAB + '"', last = s.bands.length - 1;
    s.bands.forEach(function (b, i) {
      var x = X + W * b.from, w = W * (b.to - b.from);
      var anchor = i === 0 ? "start" : i === last ? "end" : "middle", tx = i === 0 ? x + 2 : i === last ? x + w - 2 : x + w / 2;
      out += '<path class="sb" d="' + wobBox(x + 2, Y + 3, w - 2, H - 4, i + 3) + '" fill="' + b.color + '" opacity=".72"/>';
      out += '<text x="' + tx.toFixed(0) + '" y="' + (Y + H + 50) + '" text-anchor="' + anchor + '" font-size="' + (w < 60 ? 17 : 20) + '"' + font + ">" + b.label + "</text>";
    });
    s.cuts.forEach(function (c, i) {
      var x = X + W * c.at;
      out += '<path d="' + wobLine(x, Y - 4, x, Y + H + 4, i + 9) + '" stroke="' + INK + '" stroke-width="1.6" fill="none"/>';
      out += '<text x="' + x.toFixed(0) + '" y="' + (Y + H + 20) + '" text-anchor="middle" font-size="16" fill="' + INK + '" font-family="Hind, sans-serif">' + c.v + "</text>";
    });
    out += '<path class="so" pathLength="1" d="' + wobBox(X, Y, W, H, 1) + '" stroke="' + INK + '" stroke-width="2.2" fill="none" stroke-linejoin="round"/>';
    var label = "you, " + text, half = label.length * 22 * 0.26 + 2;  /* Hind runs about half an em a letter */
    var mx = X + W * s.at, lx = Math.min(VW - half, Math.max(half, mx));
    out += '<g class="sm" style="--mx:' + ((mx - X) / W).toFixed(3) + '"><path pathLength="1" d="M' + lx.toFixed(0) + " 33 Q" + ((lx + mx) / 2 + 8).toFixed(0) + " 42 " + mx.toFixed(0) + " " + (Y - 3) + '" stroke="' + LAB + '" stroke-width="2.4" fill="none" stroke-linecap="round"/>' +
      '<path pathLength="1" d="M' + (mx - 6).toFixed(0) + " " + (Y - 11) + " L" + mx.toFixed(0) + " " + (Y - 2) + " L" + (mx + 6).toFixed(0) + " " + (Y - 11) + '" stroke="' + LAB + '" stroke-width="2.4" fill="none" stroke-linecap="round" stroke-linejoin="round"/>' +
      '<text x="' + lx.toFixed(0) + '" y="26" text-anchor="middle" font-size="22"' + font.replace('"500"', '"600"') + '>' + label + "</text></g>";
    return '<svg class="scale" viewBox="0 0 ' + VW + " " + VH + '" role="img" aria-label="Scale from ' + s.bands.map(function (b) { return b.label; }).join(" to ") +
      ", with your result, " + text + ', marked">' + out + "</svg>";
  }

  /* At BMI 23 or more with no lower target: the arithmetic of moving more (the calculator's own activity factors), or the free call. */
  var MORE = [["light", "light activity (walks, housework)"], ["moderate", "moderate activity (exercise 3 to 5 days)"], ["active", "very active (exercise most days)"]];
  function moveMore(v, floor) {
    var from = ["sedentary", "light", "moderate", "active"].indexOf(v.activity), b = bmr(v.sex, v.age, v.height, v.weight);
    for (var i = Math.max(0, from); i < MORE.length; i++) {
      var t = tdee(b, MORE[i][0]);
      if (t - 300 > floor) return "If you moved enough to count as " + MORE[i][1] + ", you would use about " + f0(t) + " kcal a day, and a gentle target would be " + f0(t - 300) + " kcal.";
    }
    return "On a free call, Puja looks at it with your reports and your routine.";
  }
  var BAND = { under: "Below the healthy range", healthy: "In the healthy range for Indians", over: "Overweight, by the Asian cut-off", obese: "Obese, by the Asian cut-off" };
  function f0(x) { return Math.round(x).toLocaleString("en-IN"); }
  var FAT_SAY = { athletic: "the athletic range", fit: "the fitness range", average: "the average range", high: "the obese range" };
  var FAT_SPAN = { female: { athletic: "under 21%", fit: "21 to 24%", average: "25 to 31%", high: "32% or more" },
    male: { athletic: "under 14%", fit: "14 to 17%", average: "18 to 24%", high: "25% or more" } };
  var A1C_SAY = { normal: "the normal range (below 5.7%)", prediabetes: "the prediabetes range (5.7% to 6.4%)", diabetes: "the diabetes range (6.5% or more)" };
  function lossParts(v) {
    var t = tdee(bmr(v.sex, v.age, v.height, v.weight), v.activity);
    return { t: t, l: lossTarget(t, v.sex), b: r1(bmi(v.height, v.weight).value) };
  }
  var RENDER = {
    bmi: function (v) { var r = bmi(v.height, v.weight); return '<p class="big">' + r1(r.value) + "</p><p>" + BAND[r.band] + ".</p>" + scaleSvg(scale("bmi", r.value), String(r1(r.value))); },
    calories: function (v) { var b = bmr(v.sex, v.age, v.height, v.weight), t = tdee(b, v.activity);
      return '<p class="big">' + f0(t) + " kcal a day</p><p>That keeps your weight where it is. Your body burns about " + f0(b) + " kcal a day at complete rest.</p>"; },
    loss: function (v) { var p = lossParts(v), t = p.t, l = p.l, b = p.b;
      if (b < 18.5) return '<p class="big">' + f0(t) + " kcal a day</p><p>That is about what your body uses now. Your BMI is " + b +
        ", below the healthy range for Indians (18.5 to 22.9), so this calculator gives no weight loss target.</p>";
      if (l.steady === l.gentle) {
        return '<p class="big">' + f0(t) + " kcal a day</p><p>That is about what your body uses now. " +
          (t < l.floor ? "It is already under " + f0(l.floor) + " kcal, the lowest this calculator goes without a doctor involved"
            : "Eating 300 or 500 kcal less would take you to " + f0(l.floor) + " kcal or below, and this calculator doesn't go below " + f0(l.floor) + " kcal without a doctor involved") +
          ", so there is no lower target to give you here. Your BMI is " + b +
          (b < 23 ? ", in the healthy range for Indians, so you may not need to lose weight at all.</p>" : ".</p><p>" + moveMore(v, l.floor) + "</p>");
      }
      /* In the healthy range the headline is maintenance, not a deficit (U16); the targets follow for anyone who still wants them. */
      if (b < 23) return '<p class="big">' + f0(t) + " kcal a day</p><p>That keeps your weight where it is. Your BMI is " + b +
        ", in the healthy range for Indians (18.5 to 22.9), so you may not need to lose weight at all.</p><p>If you still want to lose a little, a gentler start is " +
        f0(l.gentle) + " kcal a day and a steady pace is " + f0(l.steady) + " kcal. This calculator doesn't go below " + f0(l.floor) + " kcal without a doctor involved.</p>";
      return '<p class="big">' + f0(l.steady) + " kcal a day</p><p>A steady pace. A gentler start is " + f0(l.gentle) + " kcal. Your maintenance is about " + f0(t) + " kcal. This calculator doesn't go below " + f0(l.floor) + " kcal without a doctor involved.</p>"; },
    protein: function (v) { var w = num(v.weight, "weight", W[0], W[1], "kg");
      return '<p class="big">' + proteinNeed(v.weight, v.goal) + " g a day</p><p>Spread it across your meals: dal, paneer, curd, eggs, chicken or fish, and chana.</p>" +
        (w > PROTEIN_CAP_KG ? "<p>Above " + PROTEIN_CAP_KG + " kg this counts " + PROTEIN_CAP_KG + " kg, because at a high weight much of it is not muscle. Your own number is best worked out with your reports.</p>" : ""); },
    range: function (v) { var r = healthyRange(v.height); return '<p class="big">' + r.minKg + " to " + r.maxKg + " kg</p><p>That's a BMI of 18.5 to 22.9, the healthy range for Indians.</p>"; },
    whtr: function (v) { var r = waistHeight(v.waist, v.height), x = Math.round(r.ratio * 100) / 100;
      return '<p class="big">' + x + "</p><p>" + (x >= 0.5 ? "Your waist is half your height or more. That usually means extra fat around the middle, which is worth working on." : "Your waist is less than half your height. That's the range to stay in.") + "</p>" + scaleSvg(scale("whtr", r.ratio), String(x)); },
    whr: function (v) { var r = waistHip(v.waist, v.hip, v.sex), cut = v.sex === "male" ? "0.90 for men" : "0.85 for women";
      return '<p class="big">' + r.ratio + "</p><p>" + (r.flag ? "At or above the WHO cut-off (" + cut + "), which points to fat stored around the middle." : "Below the WHO cut-off (" + cut + ").") + "</p>" + scaleSvg(scale("whr", r.ratio, v.sex), String(r.ratio)); },
    bodyfat: function (v) { var x = bodyFatNavy(v.sex, v.height, v.neck, v.waist, v.hip), b = fatBand(x, v.sex);
      return '<p class="big">' + x + "%</p><p>On the American Council on Exercise chart that is in " + FAT_SAY[b] + " for " + (v.sex === "male" ? "men" : "women") +
        " (" + FAT_SPAN[v.sex][b] + "). It is an estimate from tape measurements; a DEXA scan is more exact.</p>" + scaleSvg(scale("bodyfat", x, v.sex), x + "%"); },
    water: function (v) { var x = water(v.weight, v.minutes), m = blank(v.minutes) ? 0 : Number(v.minutes);
      return '<p class="big">About ' + x + " litres a day</p><p>Including water from tea, milk, dal and fruit. More in a hot Indian summer.</p>" +
        (m > WATER_MAX_MIN ? "<p>Exercise counts up to " + WATER_MAX_MIN + " minutes a day here. On longer days, drink through the exercise rather than aiming for one bigger number.</p>" : "") +
        (x > WATER_HIGH_L ? "<p>That is more than " + WATER_HIGH_L + " litres, a lot for one day. Spread it through the day, and if you have heart or kidney problems, ask your doctor how much is right for you.</p>" : ""); },
    hba1c: function (v) { var r = hba1cToEag(v.a1c), a = r1(Number(v.a1c));
      return '<p class="big">' + f0(r.mgdl) + " mg/dL</p><p>Your average blood sugar over about three months (" + r1(r.mmol) + " mmol/L).</p><p>An HbA1c of " + a + "% is in " + A1C_SAY[a1cBand(a)] + ". Your doctor's reading of your reports comes first.</p>"; },
    homa: function (v) {
      var r = homaIR({ glucose: v.glucose, insulin: v.insulin, unit: v.unit }), x = Math.round(r * 100) / 100, b = homaBand(r);
      var say = { low: "That is under 1.4, below the cut-offs reported in studies.",
        mid: "That is between 1.4 and 2.5, the span of cut-offs reported for Asian populations. Read it with your doctor, alongside your other results.",
        high: "That is 2.5 or more, the cut-off used in large US surveys (NHANES). It can mean your body is making extra insulin to keep your sugar steady, so read it with your doctor, alongside your other results." };
      return '<p class="big">' + x + "</p><p>" + say[b] + " There is no single agreed cut-off, and this does not diagnose anything. It assumes your body makes its own insulin, so it does not apply if you inject insulin.</p>" + scaleSvg(scale("homa", r), String(x));
    },
    pregnancy: function (v) { var b = bmi(v.height, v.weight).value, r = pregnancyGain(b);
      return '<p class="big">' + r.minKg + " to " + r.maxKg + " kg</p><p>Total gain over the pregnancy for a single baby, based on your BMI before pregnancy (" + r1(b) + "). " +
        "These ranges use the standard WHO BMI groups, not the lower Asian cut-offs, because that is how the Institute of Medicine set them.</p>" +
        "<p>If you are under 18, or expecting twins, your doctor will give you a different range. Your doctor's advice comes first.</p>"; },
  };
  /* One line for a WhatsApp message and for screen readers, only for a real answer: what the calculator gave. */
  var SAY_BAND = { under: "below the healthy range", healthy: "in the healthy range for Indians", over: "overweight by the Asian cut-off", obese: "obese by the Asian cut-off" };
  var SUMMARY = {
    bmi: function (v) { var r = bmi(v.height, v.weight); return "My BMI came out at " + r1(r.value) + ", " + SAY_BAND[r.band] + "."; },
    calories: function (v) { return "The calculator gave me about " + f0(tdee(bmr(v.sex, v.age, v.height, v.weight), v.activity)) + " kcal a day to keep my weight where it is."; },
    loss: function (v) { var p = lossParts(v);
      if (p.b < 18.5 || p.l.steady === p.l.gentle) return "The calculator gave me no lower calorie target; it says I use about " + f0(p.t) + " kcal a day and my BMI is " + p.b + ".";
      if (p.b < 23) return "The calculator says I use about " + f0(p.t) + " kcal a day and my BMI is " + p.b + ", in the healthy range.";
      return "The calculator gave me a target of about " + f0(p.l.steady) + " kcal a day."; },
    protein: function (v) { return "The calculator gave me about " + proteinNeed(v.weight, v.goal) + " g of protein a day."; },
    range: function (v) { var r = healthyRange(v.height); return "My healthy weight range came out at " + r.minKg + " to " + r.maxKg + " kg."; },
    whtr: function (v) { return "My waist-to-height ratio came out at " + Math.round(waistHeight(v.waist, v.height).ratio * 100) / 100 + "."; },
    whr: function (v) { return "My waist-to-hip ratio came out at " + waistHip(v.waist, v.hip, v.sex).ratio + "."; },
    bodyfat: function (v) { return "My body fat came out at about " + bodyFatNavy(v.sex, v.height, v.neck, v.waist, v.hip) + "%."; },
    water: function (v) { return "The calculator gave me about " + water(v.weight, v.minutes) + " litres of water a day."; },
    hba1c: function (v) { return "My HbA1c is " + r1(Number(v.a1c)) + "%, about " + f0(hba1cToEag(v.a1c).mgdl) + " mg/dL average blood sugar."; },
    homa: function (v) { return "My HOMA-IR came out at " + Math.round(homaIR({ glucose: v.glucose, insulin: v.insulin, unit: v.unit }) * 100) / 100 + "."; },
    pregnancy: function (v) { var r = pregnancyGain(bmi(v.height, v.weight).value); return "The calculator gave me a healthy gain of " + r.minKg + " to " + r.maxKg + " kg."; },
  };
  function summary(kind, v) {
    try { return SUMMARY[kind] ? SUMMARY[kind](prep(v)) : ""; } catch (e) { if (!(e instanceof RangeError)) throw e; return ""; }
  }
  function prep(v) {
    if (v.hunit === "ftin") v.height = ftInHeight(v.ft, v["in"]);
    if (v.tunit === "in") for (var k in TAPE) if (k in v && !blank(v[k]) && !v._cm) v[k] = inchTape(v[k], k);
    v._cm = true;  /* converted once: prep may run twice on the same values (summary after answer) */
    return v;
  }

  /* What a form shows: the answer, or, when a box is wrong, no stale answer and the reason. */
  var WAITING = '<p class="small">Your answer will show here when the boxes are filled in correctly.</p>';
  /* The next step under an answer. next is the form's data-next: {"default": [href, words]} or, where the answer decides,
     named options that PICK chooses from. A diet chart is "near this target" only within 150 kcal of it. */
  var LEVELS = [1200, 1500, 1800];
  function nearest(kcal) { return LEVELS.reduce(function (a, b) { return Math.abs(b - kcal) < Math.abs(a - kcal) ? b : a; }); }
  var PICK = {
    loss: function (v, n) {
      var p = lossParts(v), l = p.l, near = nearest(l.steady), b = p.b;
      if (l.steady === l.gentle || b < 18.5) return [n.low, n.call];
      if (b < 23) return [n.low];  // a target exists, but the healthy weight range is the more useful next look
      return Math.abs(near - l.steady) <= 150 ? [[n.near[0].replace("{kcal}", near), n.near[1]]] : [n.far];
    },
    /* "low" is under the ACE obesity line (32% women, 25% men): the healthy weight range is the useful next look. */
    bodyfat: function (v, n) { return [bodyFatNavy(v.sex, v.height, v.neck, v.waist, v.hip) < (v.sex === "male" ? 25 : 32) ? n.low : n["default"]]; },
    /* BMI 23 or more: a calorie target for weight loss; under it, the healthy weight range. */
    bmi: function (v, n) { var b = bmi(v.height, v.weight).band; return [b === "over" || b === "obese" ? n.over : n["default"]]; },
    /* Waist half the height or more: the two programs that work on fat around the middle. */
    whtr: function (v, n) { return Math.round(waistHeight(v.waist, v.height).ratio * 100) / 100 >= 0.5 ? [n.flag, n.menopause] : [n["default"]]; },
    /* HOMA-IR from 1.4: the PCOS and diabetes programs; under it, what insulin resistance means. */
    homa: function (v, n) { return homaBand(homaIR({ glucose: v.glucose, insulin: v.insulin, unit: v.unit })) === "low" ? [n["default"]] : [n.pcos, n.diabetes]; },
    /* By the HbA1c band: the normal range page, the diabetes program for prediabetes, the diabetes charts from 6.5%. */
    hba1c: function (v, n) { return [{ normal: n.normal, prediabetes: n.pre, diabetes: n["default"] }[a1cBand(v.a1c)]]; },
  };
  function attr(x) { return String(x).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;"); }
  function nextLinks(kind, v, next) {
    if (!next) return "";
    return (PICK[kind] ? PICK[kind](v, next) : [next["default"]]).filter(function (x) { return x && x[0]; })
      .map(function (x) { return '<p class="next"><a href="' + attr(x[0]) + '">' + attr(x[1]) + "</a></p>"; }).join("");
  }
  var THALI_START = [["d:roti", 2], ["d:moong-dal", 1], ["d:mixed-veg-sabzi", 1]];  /* tools.py draws the same three rows */
  /* A wa.me link with the answer added to its message: the base link keeps its own text, the line goes after it. */
  function waHref(base, line) { return line ? base + encodeURIComponent(" " + line) : base; }
  function answer(kind, v, next) {
    try {
      v = prep(v);
      return { html: RENDER[kind](v) + nextLinks(kind, v, next), error: "" };
    } catch (e) {
      if (!(e instanceof RangeError)) throw e;
      return { html: WAITING, error: e.message };
    }
  }

  var api = { bmi: bmi, bmr: bmr, tdee: tdee, lossTarget: lossTarget, proteinNeed: proteinNeed, healthyRange: healthyRange,
    waistHeight: waistHeight, waistHip: waistHip, bodyFatNavy: bodyFatNavy, water: water, hba1cToEag: hba1cToEag,
    pregnancyGain: pregnancyGain, homaIR: homaIR, homaBand: homaBand, thali: thali, ftInToCm: ftInToCm, cmToFtIn: cmToFtIn, exampleNote: exampleNote, exampleFor: exampleFor, scale: scale, scaleSvg: scaleSvg, EXAMPLE: EXAMPLE,
    answer: answer, WAITING: WAITING, nextLinks: nextLinks, bmiBand: bmiBand, a1cBand: a1cBand, fatBand: fatBand, summary: summary, prompt: prompt,
    exampleValue: exampleValue, waHref: waHref, THALI_START: THALI_START, UNDER_18: UNDER_18, FT_RANGE: FT_RANGE };
  if (typeof module !== "undefined" && module.exports) { module.exports = api; return; }
  root.PoshanTools = api;

  /* ---------- page binder ---------- */
  var BAD_NUMBER = "Use a dot for decimals, like 6.1.";
  function values(form) {
    var v = {};
    Array.prototype.forEach.call(form.elements, function (el) {
      if (el.name && !(el.type === "radio" && !el.checked)) v[el.name] = el.value;
    });
    return v;
  }
  function nextOf(form) {
    try { return JSON.parse(form.getAttribute("data-next") || "null"); } catch (e) { return null; }
  }
  /* U12: a real answer rides along in every WhatsApp message on the page; the example, a prompt or a wrong box takes it off. */
  function carry(line) {
    root.poshanAnswer = line || "";  /* book.js puts it in the booking form's note */
    Array.prototype.forEach.call(document.querySelectorAll('a[href^="https://wa.me/"]'), function (a) {
      if (!a.hasAttribute("data-wa-base")) a.setAttribute("data-wa-base", a.getAttribute("href"));
      a.setAttribute("href", waHref(a.getAttribute("data-wa-base"), line));
    });
  }
  /* T21: screen readers hear the answer once typing pauses, not on every key. */
  function announcer(form) {
    var live = form.querySelector(".live"), timer = null;
    return function (text) {
      if (!live) return;
      clearTimeout(timer);
      timer = setTimeout(function () { live.textContent = text; }, 900);
    };
  }
  function spoken(out) {  // the big number and the sentence under it
    var big = out.querySelector(".big"), p = big && big.nextElementSibling;
    return big ? big.textContent + (p && p.tagName === "P" ? ". " + p.textContent : "") : "";
  }

  /* The answer lands when someone presses "Show my answer" (never on each keystroke, never with reduced motion), in the
     site's ink: the number counts up, the scale's outline draws itself, its bands wash in, and the "you" arrow and note
     are drawn on by hand. */
  function countUp(el, ms) {
    var m = el.textContent.match(/^(\D*?)([\d,]+(?:\.\d+)?)(.*)$/);
    if (!m) return;
    var pre = m[1], end = Number(m[2].replace(/,/g, "")), post = m[3], dec = (m[2].split(".")[1] || "").length, t0 = null, hasComma = m[2].indexOf(",") > -1;
    function fmt(x) { var s = x.toFixed(dec); return hasComma ? Number(s).toLocaleString("en-IN", { minimumFractionDigits: dec, maximumFractionDigits: dec }) : s; }
    function step(ts) {
      if (!t0) t0 = ts;
      var k = Math.min(1, (ts - t0) / ms), e = 1 - Math.pow(1 - k, 3);
      el.textContent = pre + fmt(end * e) + post;
      if (k < 1) requestAnimationFrame(step); else el.textContent = pre + m[2] + post;
    }
    requestAnimationFrame(step);
  }
  function reveal(out) {
    if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    out.classList.remove("rv");
    void out.offsetWidth;  // restart if it is already running
    out.classList.add("rv");
    var big = out.querySelector(".big");
    if (big) countUp(big, 800);
    clearTimeout(out._animT);
    out._animT = setTimeout(function () { out.classList.remove("rv"); }, 2400);
  }

  function bind(form) {
    var out = form.querySelector(".result"), err = form.querySelector(".err"), kind = form.getAttribute("data-tool");
    var fields = (form.getAttribute("data-fields") || "").split(" "), next = nextOf(form), shown = false, say = announcer(form);
    var OPTIONAL = { "in": 1, minutes: 1 };  // inches may stay empty (5 ft is 5 ft 0 in), and so may exercise minutes (none)
    function boxes() {  // the number boxes in use: the hidden height unit doesn't count
      return Array.prototype.filter.call(form.querySelectorAll("input[type=number]"), function (el) { return !el.closest("[hidden]"); });
    }
    function bad() { return boxes().filter(function (el) { return el.validity && el.validity.badInput; })[0]; }  // "6,1" reads as empty
    function filledOnly(useExample) {
      var v = values(form);
      boxes().forEach(function (el) { if (blank(el.value) && useExample && !OPTIONAL[el.name]) v[el.name] = exampleValue(el.name, v.unit, kind, v.tunit); });
      return v;
    }
    function complete() { return boxes().every(function (el) { return OPTIONAL[el.name] || !blank(el.value); }); }
    function started() { return boxes().some(function (el) { return !blank(el.value) || (el.validity && el.validity.badInput); }); }
    var block = form.querySelector(".row2"), real = false;  // real: a worked-out answer (not the example, not the waiting line) is showing
    function example(atLoad) {
      var v = values(form);
      boxes().forEach(function (el) { v[el.name] = exampleValue(el.name, v.unit, kind, v.tunit); });
      function put() {
        out.innerHTML = '<p class="example">' + exampleNote(fields, v.hunit, v.unit, kind, v.tunit) + "</p>" + RENDER[kind](prep(v));
        out.classList.add("is-example");
        out.classList.remove("is-prompt");
        real = false;
      }
      if (atLoad) put(); else keepStill(put);
      carry("");
    }
    /* U8: once anything is typed the example goes, so a half-filled form never shows someone else's answer as if it were theirs. */
    function ask() {
      var first = boxes().filter(function (el) { return !OPTIONAL[el.name] && blank(el.value); })[0];
      keepStill(function () {
        out.innerHTML = prompt(first ? first.name : "");
        out.classList.remove("is-example");
        out.classList.add("is-prompt");
        real = false;
      });
      carry("");
    }
    /* The answer sits above the boxes. Whenever it changes height the boxes must not move under the reader's finger or
       pointer, whichever box they are in or moving to: a shorter answer keeps the old height as a minimum, a taller one
       scrolls the page by the difference. */
    function keepStill(update) {
      var before = block.getBoundingClientRect().top, h = out.getBoundingClientRect().height;  // fractional: offsetHeight rounds
      out.style.minHeight = "";
      update();
      var nh = out.getBoundingClientRect().height;
      // shorter: keep the old height exactly; taller: grow by whole pixels, so the scroll below moves the boxes back exactly
      if (nh < h) out.style.minHeight = h + "px";
      else if (nh > h) out.style.minHeight = (h + Math.ceil(nh - h - 0.001)) + "px";
      var moved = block.getBoundingClientRect().top - before;
      if (moved) window.scrollBy({ top: moved, behavior: "instant" });
    }
    /* While someone is typing and no complaint is on screen, a wrong box keeps the last answer, so nothing jumps under their
       fingers; once the reason is shown (they left the box or pressed Enter) the old answer goes with it. */
    function show(r, showErrors) {
      if (r.error && !showErrors) return;
      keepStill(function () {
        out.innerHTML = r.html;
        out.classList.remove("is-example");
        out.classList.remove("is-prompt");
        err.textContent = r.error;
        real = !r.error;
      });
      var line = real ? summary(kind, values(form)) : "";
      carry(line);
      say(real ? spoken(out) : r.error);
    }
    /* Phones: when the reader leaves the form (or presses Go) with their first answer above the screen, it scrolls into
       view, once. Moving from box to box inside the form never scrolls. */
    function bringIntoView() {
      if (shown || !real) return;
      shown = true;
      if (!window.matchMedia || !window.matchMedia("(max-width:760px)").matches) return;
      var bar = document.querySelector(".pbar"), limit = bar && getComputedStyle(bar).position === "sticky" ? bar.getBoundingClientRect().bottom : 0;
      if (out.getBoundingClientRect().top < limit) out.scrollIntoView({ block: "start", behavior: "instant" });
    }
    function run(showErrors) {
      if (bad()) { show({ html: WAITING, error: BAD_NUMBER }, showErrors); return; }
      if (!complete()) {
        if (real && !showErrors) return;  // a box backspaced to empty mid-typing keeps the last answer, no flash of the example
        var probe = answer(kind, filledOnly(true));  // only to check the boxes already filled in
        if (probe.error) {  // mid-typing ("1" on the way to 160) no complaint yet, but the example still gives way
          if (showErrors) show(probe, true); else if (out.classList.contains("is-example") && started()) ask();
          return;
        }
        err.textContent = "";
        if (!started()) { if (!out.classList.contains("is-example")) example(); }
        else ask();
        return;
      }
      show(answer(kind, values(form), next), showErrors);
    }
    var units = form.querySelector(".hunit");
    if (units) units.addEventListener("change", function () {
      var ftin = form.querySelector("input[name=hunit]:checked").value === "ftin", cm = form.querySelector("[name=height]");
      var ft = form.querySelector("[name=ft]"), inch = form.querySelector("[name=in]");
      try {
        if (ftin && !blank(cm.value) && isFinite(Number(cm.value))) { var fi = cmToFtIn(cm.value); ft.value = fi.ft; inch.value = fi["in"]; }
        if (!ftin && !blank(ft.value)) cm.value = r1(ftInToCm(ft.value, inch.value));
      } catch (e) { if (!(e instanceof RangeError)) throw e; }
      form.querySelector(".ftin").hidden = !ftin;
      form.querySelector(".cm").hidden = ftin;
      if (out.classList.contains("is-example")) example(); else run(false);
    });
    var tunits = form.querySelector(".tunit");
    if (tunits) tunits.addEventListener("change", function () {  // cm <-> inches for the tape boxes: carry typed values across
      var inches = form.querySelector("input[name=tunit]:checked").value === "in";
      Object.keys(TAPE).forEach(function (k) {
        var box = form.querySelector("[name=" + k + "]");
        if (!box) return;
        if (!blank(box.value) && isFinite(Number(box.value))) box.value = inches ? r1(Number(box.value) / 2.54) : r1(Number(box.value) * 2.54);
        box.min = inches ? Math.ceil(TAPE[k][1] / 2.54) : TAPE[k][1];
        box.max = inches ? Math.floor(TAPE[k][2] / 2.54) : TAPE[k][2];
      });
      Array.prototype.forEach.call(form.querySelectorAll(".tu"), function (u) { u.textContent = inches ? "inches" : "cm"; });
      if (out.classList.contains("is-example")) example(); else run(false);
    });
    var gunits = form.querySelector(".gunit");
    if (gunits) gunits.addEventListener("change", function () {  // mg/dL <-> mmol/L: carry a typed value across, then re-check
      var mmol = form.querySelector("input[name=unit]:checked").value === "mmol", box = form.querySelector("[name=glucose]");
      var g = GLUCOSE[mmol ? "mmol" : "mgdl"];
      if (!blank(box.value) && isFinite(Number(box.value))) box.value = mmol ? r1(Number(box.value) / 18) : Math.round(Number(box.value) * 18);
      box.min = g[0]; box.max = g[1]; box.step = mmol ? "0.1" : "1";
      if (out.classList.contains("is-example")) example(); else run(false);
    });
    /* U27: Chrome quietly drops a comma from a number box ("6,1" becomes 61) and other browsers empty it, so stop the comma
       and say how to write a decimal. */
    form.addEventListener("beforeinput", function (e) {
      if (e.target.type === "number" && e.data && e.data.indexOf(",") > -1) { e.preventDefault(); err.textContent = BAD_NUMBER; }
    });
    // Live answers while typing, but a complaint only once someone leaves a box or presses Enter (or the Show button).
    form.addEventListener("input", function (e) { if (e.target.type !== "radio") run(err.textContent !== ""); });
    form.addEventListener("focusout", function (e) {
      run(true);
      if (!(e.relatedTarget && form.contains(e.relatedTarget))) bringIntoView();
    });
    form.addEventListener("submit", function (e) {
      e.preventDefault();
      if (bad()) show({ html: WAITING, error: BAD_NUMBER }, true); else show(answer(kind, values(form), next), true);
      if (real) reveal(out);
      bringIntoView();
    });
    example(true);
  }

  /* The thali: one row per food. Every control has its own label, every Remove button names its food, and focus never
     falls back to the top of the page after a row goes. The build draws the three starting rows and their total, so the
     page does not move when the food list arrives and the script rebuilds them (T6). */
  function bindThali(form) {
    var list = form.querySelector(".thali-items"), out = form.querySelector(".result"), err = form.querySelector(".err"), foods = null;
    var next = nextOf(form), add = form.querySelector(".add"), say = announcer(form), n = 0;
    function failed() {
      err.textContent = "The food list did not load. Check your connection and reload the page.";
      add.disabled = true;
    }
    fetch("/poshan-labs/assets/thali-foods.json" + (((document.querySelector("script[src*='/poshan-labs/assets/tools.js']") || {}).src || "").match(/\?v=\w+/) || [""])[0]).then(function (r) { if (!r.ok) throw new Error(r.status); return r.json(); }).then(function (data) {
      foods = {};
      var dishes = "", everyday = "", rest = "";
      data.forEach(function (f) {
        foods[f.code] = f;
        var o = '<option value="' + attr(f.code) + '">' + attr(f.display) + "</option>";
        if (f.per === "unit") dishes += o; else if (f.everyday) everyday += o; else rest += o;
      });
      var opts = '<optgroup label="Home dishes, by the katori or piece">' + dishes + '</optgroup><optgroup label="Everyday raw foods, by weight">' + everyday +
        '</optgroup><optgroup label="Less common raw foods, by weight">' + rest + "</optgroup>";
      function units(row) {
        var f = foods[row.querySelector("select.food").value], u = row.querySelector(".unit");
        u.innerHTML = f.per === "unit" ? '<option value="unit">' + attr(f.plural) + "</option>"
          : '<option value="g">grams</option>' + (f.oil ? '<option value="tsp">teaspoons (5 g)</option>' : "");
        row.querySelector(".remove").setAttribute("aria-label", "Remove " + f.display);
        u.setAttribute("aria-label", "Unit for " + f.display);
      }
      function addRow(code, amount) {
        var row = document.createElement("div"), i = ++n;
        row.className = "thali-row";
        row.innerHTML = '<div><label for="thali-food-' + i + '">Food</label><select id="thali-food-' + i + '" class="food">' + opts + '</select></div>' +
          '<div class="amt"><label for="thali-amt-' + i + '">How much</label><span><input id="thali-amt-' + i + '" type="number" inputmode="decimal" min="0.25" step="any">' +
          '<select class="unit"></select></span></div><button type="button" class="linkbtn remove">Remove</button>';
        list.appendChild(row);
        row.querySelector("select.food").value = code && foods[code] ? code : data[0].code;
        reset(row, amount);
        return row;
      }
      function reset(row, amount) {
        var f = foods[row.querySelector("select.food").value];
        units(row);
        row.querySelector("input").value = amount != null ? amount : f.per === "unit" ? 1 : f.oil ? 1 : 100;
        if (f.oil) row.querySelector(".unit").value = "tsp";
      }
      function run(showErrors) {
        var items = Array.prototype.map.call(list.querySelectorAll(".thali-row"), function (r) {
          return { code: r.querySelector("select.food").value, amount: r.querySelector("input").value, unit: r.querySelector(".unit").value };
        });
        try {
          var t = thali(items, foods);
          out.innerHTML = '<p class="big">' + f0(t.kcal) + ' kcal</p><p>' + t.protein + " g protein, " + t.carb + " g carbohydrate, " + t.fibre + " g fibre, " + t.fat + " g fat.</p>" + nextLinks("thali", null, next);
          err.textContent = "";
          carry("My thali came to about " + f0(t.kcal) + " kcal, with " + t.protein + " g of protein.");
          say(f0(t.kcal) + " kcal, " + t.protein + " g protein.");
        } catch (e) {
          if (!(e instanceof RangeError)) throw e;
          if (showErrors || !items.length) { out.innerHTML = WAITING; err.textContent = e.message; carry(""); say(e.message); }  // mid-typing the last total stays, as in bind
        }
      }
      add.addEventListener("click", function () { addRow("d:moong-dal", 1).querySelector("select").focus(); run(false); });
      list.addEventListener("click", function (e) {
        var b = e.target.closest(".remove");
        if (!b) return;
        var row = b.closest(".thali-row"), to = row.nextElementSibling || row.previousElementSibling;
        row.remove();
        (to ? to.querySelector(".remove") : add).focus();  // focus stays where the row was
        run(true);
      });
      list.addEventListener("change", function (e) { if (e.target.classList.contains("food")) reset(e.target.closest(".thali-row")); run(true); });
      list.addEventListener("input", function () { run(err.textContent !== ""); });
      list.addEventListener("focusout", function () { run(true); });
      form.addEventListener("submit", function (e) { e.preventDefault(); run(true); });
      list.innerHTML = "";  // the build's starting rows, replaced in the same frame by live ones of the same size
      THALI_START.forEach(function (r) { addRow(r[0], r[1]); });
      run(false);
    })["catch"](failed);
  }

  document.addEventListener("DOMContentLoaded", function () {
    Array.prototype.forEach.call(document.querySelectorAll("form[data-tool]"), function (f) {
      if (f.getAttribute("data-tool") === "thali") bindThali(f); else bind(f);
    });
  });
  if (location.search.indexOf("foldcheck") > -1) window.addEventListener("load", function () {  // tests/test_tool_pages.py
    setTimeout(function () {
      var big = document.querySelector(".result .big"), d = document.documentElement;
      d.setAttribute("data-big-bottom", big ? Math.round(big.getBoundingClientRect().bottom + window.scrollY) : -1);
      d.setAttribute("data-vh", window.innerHeight);
      var box = Array.prototype.filter.call(document.querySelectorAll("form.tool input, form.tool select"), function (el) { return el.type !== "radio" && el.offsetParent !== null; })[0];
      d.setAttribute("data-box-bottom", box ? Math.round(box.getBoundingClientRect().bottom + window.scrollY) : -1);
    }, 300);
  });
})(typeof window !== "undefined" ? window : this);
