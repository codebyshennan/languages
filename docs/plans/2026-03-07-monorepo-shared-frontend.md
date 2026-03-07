# Monorepo Shared Frontend Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Consolidate all 3 language apps into one Flask monorepo with shared CSS and JS, eliminating ~2000 lines of duplicated code.

**Architecture:** Root `app.py` serves all 3 vocab APIs (`/api/vocab/bahasa`, `/api/vocab/viet`, `/api/vocab/spanish`) and 3 HTML routes (`/bahasa`, `/viet`, `/spanish`). `static/shared.css` contains all structural styles with CSS variables for theming. `static/shared.js` contains all SRS/session/overview logic, parameterised by a per-page `window.LANG_CONFIG` object. Each `templates/*.html` is a thin shell (~150 lines) defining its config, theme colours, and language-specific answer-area HTML. Old per-language single-file apps remain untouched.

**Tech Stack:** Python 3 / Flask / openpyxl / gunicorn, vanilla JS ES5+, Web Speech API, no build step

---

## What goes where

### `static/shared.css`
All structural CSS from `bahasa_anki.py` (topbar, progstrip, cards, modals, rating buttons, etc.). CSS variables default to the Bahasa navy theme; each template's `<style>` block overrides `--primary`, `--primary-dk`, `--accent`, `--accent2`.

### `static/shared.js`
All logic identical across apps:
- SM-2: `sm2Update`, `isDue`, `cardStage`
- Storage: `loadProgress`, `saveProgress` (keyed by `cfg.storageKey`)
- TTS: `callPronounce`
- Overview: `computeOverview`, `refreshOverview`, `computeCatStats`
- Session: `startSession`, `nextCard`, `showAnswer`, `rate`, `sessionEnd`, `goHome`
- UI: `showScreen`, `setProg`, `setMode`, `openStats`, `closeStats`
- Keyboard handler

Calls into `window.LANG_CONFIG` for anything language-specific.

### `window.LANG_CONFIG` interface
```js
{
  storageKey: String,         // "bahasa_progress" etc
  vocabUrl: String,           // "/api/vocab/bahasa" etc
  defaultMode: String,        // "id_en" etc

  // Called after vocab loads. Populate extra selects, set initial mode button.
  initUI(allCards, setModeFn): void,

  // Update mode button active states
  updateModeUI(mode): void,

  // Returns {text, dir} for question display
  getQuestion(card, mode): { text: String, dir: String },

  // Returns {text, lang} for auto-TTS on question reveal, or null
  getQuestionTTS(card, mode): { text, lang } | null,

  // Returns {text, lang} for the Pronounce button
  getPronounce(card): { text, lang },

  // Populates #answer-area DOM. Returns {text, lang} for answer TTS or null.
  renderAnswer(card, mode): { text, lang } | null,

  // Extra candidate filtering beyond cat-select (read extra DOM selects)
  filterExtra(card): Boolean,

  // Extra keyboard shortcuts (e.g. 'c' for Cantonese in viet)
  handleExtraKeys(e, curCard): void,
}
```

---

### Task 1: Create `static/shared.css`

**Files:**
- Create: `static/shared.css`

**Step 1: Create the file**

```css
/* shared.css — structural styles for all language apps.
   Each template overrides the CSS variables below for its theme. */

:root {
  --primary:            #1A3C5E;
  --primary-dk:         #162E48;
  --accent:             #2E6DA4;
  --accent2:            #1ABC9C;
  --card-shadow:        rgba(26,60,94,0.12);
  --white:              #FFFFFF;
  --lgrey:              #F0F4F8;
  --dgrey:              #6C7A8A;
  --green:              #27AE60;
  --amber:              #E67E22;
  --red:                #C0392B;
  --blue:               #2E6DA4;
  --teal:               #1ABC9C;
  --card-bg:            #FAFCFF;
  --shadow:             #D0DFF0;
}

* { box-sizing: border-box; margin: 0; padding: 0; }
body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
       background: var(--lgrey); min-height: 100vh; }

/* Top bar */
#topbar {
  background: var(--primary); color: var(--white);
  display: flex; align-items: center; padding: 10px 20px; gap: 12px;
  flex-wrap: wrap;
}
#topbar h1 { font-size: 18px; font-weight: 700; white-space: nowrap; }
.mode-btn {
  background: transparent; border: 2px solid rgba(255,255,255,0.3);
  color: rgba(255,255,255,0.6); border-radius: 6px;
  padding: 5px 12px; cursor: pointer; font-size: 13px; font-weight: 600;
  transition: all 0.2s;
}
.mode-btn.active { background: var(--accent); border-color: var(--accent); color: white; }
#cat-select {
  background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.3);
  color: white; padding: 5px 10px; border-radius: 6px; font-size: 13px; cursor: pointer;
}
#cat-select option { background: var(--primary); }
#part-select {
  background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.3);
  color: white; padding: 5px 10px; border-radius: 6px; font-size: 13px; cursor: pointer;
}
#part-select option { background: var(--primary); }
.spacer { flex: 1; }
#stats-btn {
  background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.3);
  color: white; padding: 5px 14px; border-radius: 6px; cursor: pointer;
  font-size: 13px; transition: all 0.2s;
}
#stats-btn:hover { background: rgba(255,255,255,0.2); }

/* Progress strip */
#progstrip {
  background: var(--primary-dk); padding: 6px 20px;
  display: flex; align-items: center; gap: 12px;
}
#prog-label { color: rgba(255,255,255,0.7); font-size: 12px; }
#prog-bar-wrap {
  flex: 1; max-width: 200px; height: 6px;
  background: rgba(255,255,255,0.15); border-radius: 3px; overflow: hidden;
}
#prog-bar { height: 100%; background: var(--accent2); border-radius: 3px; transition: width 0.4s; width: 0%; }
#streak { color: #FFD700; font-size: 13px; font-weight: 700; }

/* Main */
#main { max-width: 720px; margin: 24px auto; padding: 0 16px; }

/* Welcome */
#welcome { text-align: center; padding: 40px 20px; }
#welcome h2 { color: var(--primary); font-size: 28px; margin-bottom: 12px; }
#welcome p  { color: var(--dgrey); font-size: 15px; line-height: 1.6; }
.stat-grid {
  display: grid; grid-template-columns: repeat(4, 1fr);
  gap: 12px; margin: 24px 0;
}
.stat-box {
  background: white; border-radius: 10px; padding: 16px 12px; text-align: center;
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
}
.stat-box .num { font-size: 26px; font-weight: 700; color: var(--primary); }
.stat-box .lbl { font-size: 11px; color: var(--dgrey); margin-top: 2px; text-transform: uppercase; }
.stat-box.due .num { color: var(--amber); }
.stat-box.new .num { color: var(--blue); }
.stat-box.mat .num { color: var(--green); }

/* Card */
#card-wrap { display: none; }
.card {
  background: var(--card-bg); border-radius: 16px;
  box-shadow: 0 4px 20px var(--card-shadow); overflow: hidden;
}
.card-header {
  background: var(--primary); padding: 10px 20px;
  display: flex; align-items: center; justify-content: space-between;
}
.card-cat { color: rgba(255,255,255,0.7); font-size: 12px; font-weight: 600;
            text-transform: uppercase; letter-spacing: 0.5px; }
.card-badge { font-size: 11px; padding: 3px 10px; border-radius: 12px; font-weight: 600; }
.badge-new      { background: var(--blue);  color: white; }
.badge-learning { background: var(--amber); color: white; }
.badge-review   { background: #8E44AD;      color: white; }
.badge-mature   { background: var(--green); color: white; }
.card-body { padding: 28px 32px 20px; }
.card-direction { color: var(--accent); font-size: 13px; font-weight: 600; margin-bottom: 12px; }
.card-question {
  font-size: 42px; font-weight: 700; color: var(--primary);
  line-height: 1.2; margin-bottom: 8px; word-break: break-word;
}
.card-divider { height: 2px; background: var(--lgrey); border-radius: 1px; margin: 16px 0; }

/* Answer area (base) */
#answer-area { display: none; }
.answer-primary { font-size: 26px; font-weight: 700; color: var(--green); margin-bottom: 6px; }

/* Pronounce buttons */
.pronounce-btn {
  margin-top: 12px; background: #D6EAF8; border: none; color: var(--primary);
  padding: 7px 18px; border-radius: 8px; cursor: pointer; font-size: 13px;
  font-weight: 600; transition: background 0.2s;
}
.pronounce-btn:hover { background: #BDD4EB; }

/* Action area */
#action-area { margin-top: 16px; }
#btn-show {
  width: 100%; background: var(--accent); color: white; border: none;
  padding: 16px; border-radius: 12px; font-size: 16px; font-weight: 700;
  cursor: pointer; transition: background 0.2s; letter-spacing: 0.3px;
}
#btn-show:hover { filter: brightness(0.9); }
#rating-area { display: none; }
.rating-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.rating-btn {
  border: none; color: white; padding: 12px 8px; border-radius: 10px;
  cursor: pointer; font-size: 13px; font-weight: 700; line-height: 1.4;
  transition: filter 0.2s; text-align: center;
}
.rating-btn:hover  { filter: brightness(1.1); }
.rating-btn:active { filter: brightness(0.9); }
.btn-again { background: var(--red); }
.btn-hard  { background: var(--amber); }
.btn-good  { background: var(--green); }
.btn-easy  { background: var(--blue); }
.hint-row  { text-align: center; color: var(--dgrey); font-size: 11px; margin-top: 8px; }

/* Bottom bar */
#bottom-bar { display: flex; gap: 10px; margin-top: 16px; }
#btn-start {
  flex: 1; background: var(--teal); color: white; border: none;
  padding: 13px; border-radius: 10px; font-size: 14px; font-weight: 700;
  cursor: pointer; transition: background 0.2s;
}
#btn-start:hover { background: #16A085; }
#btn-quit {
  background: var(--dgrey); color: white; border: none;
  padding: 13px 20px; border-radius: 10px; font-size: 13px; font-weight: 600;
  cursor: pointer;
}

/* Session end */
#session-end { display: none; text-align: center; padding: 32px 20px; }
#session-end h2 { color: var(--green); font-size: 32px; margin-bottom: 8px; }
#session-end .sub { color: var(--dgrey); font-size: 15px; }
.end-stats { display: flex; justify-content: center; gap: 24px; margin: 20px 0; }
.end-stat .n { font-size: 28px; font-weight: 700; }
.end-stat .l { font-size: 12px; color: var(--dgrey); }

/* Stats modal */
#modal-overlay {
  display: none; position: fixed; inset: 0;
  background: rgba(0,0,0,0.5); z-index: 100;
  align-items: center; justify-content: center;
}
#modal-overlay.open { display: flex; }
.modal {
  background: white; border-radius: 16px; width: 560px; max-width: 95vw;
  max-height: 85vh; overflow: hidden; display: flex; flex-direction: column;
  box-shadow: 0 20px 60px rgba(0,0,0,0.3);
}
.modal-header {
  background: var(--primary); color: white; padding: 16px 20px;
  display: flex; align-items: center; justify-content: space-between;
}
.modal-header h3 { font-size: 16px; }
.modal-close { background: none; border: none; color: white; font-size: 20px;
               cursor: pointer; padding: 0 4px; }
.modal-body { padding: 16px; overflow-y: auto; }
.overview-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
.ov-box { background: var(--lgrey); border-radius: 8px; padding: 12px; text-align: center; }
.ov-box .n { font-size: 22px; font-weight: 700; color: var(--primary); }
.ov-box .l { font-size: 11px; color: var(--dgrey); }
.cat-table { width: 100%; border-collapse: collapse; font-size: 13px; }
.cat-table th { background: var(--primary); color: white; padding: 7px 10px; text-align: left; }
.cat-table td { padding: 6px 10px; border-bottom: 1px solid #EEF2F6; }
.cat-table tr:nth-child(even) td { background: #F8FAFC; }
.pct-bar { height: 6px; background: #E0E8F0; border-radius: 3px; overflow: hidden; margin-top: 3px; }
.pct-fill { height: 100%; background: var(--green); border-radius: 3px; }

/* Keyboard hints */
.kbd { display: inline-block; background: #EEF2F6; border: 1px solid #C8D4E0;
       border-radius: 4px; padding: 1px 6px; font-size: 11px; font-family: monospace;
       color: var(--dgrey); }
```

**Step 2: Verify it exists**

```bash
ls -la /Users/wongshennan/Documents/personal/languages/static/shared.css
```

Expected: file ~4KB.

**Step 3: Commit**

```bash
cd /Users/wongshennan/Documents/personal/languages
git add static/shared.css
git commit -m "feat: add shared CSS with CSS-variable theming"
```

---

### Task 2: Create `static/shared.js`

**Files:**
- Create: `static/shared.js`

**Step 1: Create the file**

```javascript
/* shared.js — SRS engine for all language apps.
   Each page must set window.LANG_CONFIG before this script loads. */
(function () {
'use strict';

// ── State ──────────────────────────────────────────────────────────────────
var cfg, allCards = [], queue = [], qpos = 0;
var curCard = null, answerShown = false, sessCorr = 0, sessWrong = 0;
var mode = "";

// ── SM-2 ───────────────────────────────────────────────────────────────────
function sm2Update(pd, rating) {
  var interval = pd.interval || 0;
  var ef       = pd.ef       || 2.5;
  var reps     = pd.reps     || 0;
  var grade    = {1:1, 2:3, 3:4, 4:5}[rating];
  if (grade < 3) { reps = 0; interval = 1; }
  else {
    if      (reps === 0) interval = 1;
    else if (reps === 1) interval = 6;
    else                 interval = Math.round(interval * ef);
    reps++;
  }
  ef = ef + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
  ef = Math.max(1.3, Math.min(5.0, ef));
  var updated = {};
  for (var k in pd) updated[k] = pd[k];
  updated.interval    = interval;
  updated.ef          = Math.round(ef * 100) / 100;
  updated.reps        = reps;
  updated.next_review = new Date(Date.now() + interval * 86400000).toISOString();
  updated.correct     = (pd.correct || 0) + (grade >= 3 ? 1 : 0);
  updated.wrong       = (pd.wrong   || 0) + (grade <  3 ? 1 : 0);
  return updated;
}
function isDue(pd) {
  if (!pd || !pd.next_review) return true;
  return new Date(pd.next_review) <= new Date();
}
function cardStage(pd) {
  var intv = pd ? (pd.interval || 0) : 0;
  if (intv === 0)  return "new";
  if (intv < 7)    return "learning";
  if (intv < 21)   return "review";
  return "mature";
}

// ── Storage ────────────────────────────────────────────────────────────────
function loadProgress() {
  try { return JSON.parse(localStorage.getItem(cfg.storageKey) || "{}"); }
  catch (e) { return {}; }
}
function saveProgress(p) {
  try { localStorage.setItem(cfg.storageKey, JSON.stringify(p)); }
  catch (e) { console.warn("Could not save progress:", e); }
}

// ── TTS ────────────────────────────────────────────────────────────────────
function callPronounce(text, lang) {
  if (!window.speechSynthesis) return;
  var clean = text.split("(")[0].replace(/['"\/]/g, "").trim();
  if (!clean) return;
  var utt = new SpeechSynthesisUtterance(clean);
  utt.lang = lang;
  speechSynthesis.cancel();
  speechSynthesis.speak(utt);
}

// ── Overview ───────────────────────────────────────────────────────────────
function computeOverview() {
  var p = loadProgress();
  var newC = 0, lrn = 0, review = 0, mature = 0, due = 0, cor = 0, wrg = 0;
  for (var i = 0; i < allCards.length; i++) {
    var c = allCards[i];
    var pd = p[String(c.num)] || {};
    var stage = cardStage(pd);
    if      (stage === "new")      newC++;
    else if (stage === "learning") lrn++;
    else if (stage === "review")   review++;
    else                           mature++;
    if (isDue(pd)) due++;
    cor += pd.correct || 0;
    wrg += pd.wrong   || 0;
  }
  return { total: allCards.length, new: newC, learning: lrn, review: review,
           mature: mature, due: due, correct: cor, wrong: wrg,
           accuracy: (cor + wrg) ? Math.round(100 * cor / (cor + wrg)) : 0 };
}
function refreshOverview() {
  var ov = computeOverview();
  document.getElementById("ov-due").textContent    = ov.due;
  document.getElementById("ov-new").textContent    = ov.new;
  document.getElementById("ov-learn").textContent  = ov.learning + ov.review;
  document.getElementById("ov-mature").textContent = ov.mature;
}
function computeCatStats() {
  var p = loadProgress();
  var cats = {};
  for (var i = 0; i < allCards.length; i++) {
    var c = allCards[i];
    var pd = p[String(c.num)] || {};
    var stage = cardStage(pd);
    if (!cats[c.cat]) cats[c.cat] = { total:0, new:0, learning:0, review:0, mature:0, due:0 };
    cats[c.cat].total++;
    cats[c.cat][stage]++;
    if (isDue(pd)) cats[c.cat].due++;
  }
  return cats;
}

// ── Screens ────────────────────────────────────────────────────────────────
function showScreen(name) {
  document.getElementById("welcome").style.display     = name === "home" ? "block" : "none";
  document.getElementById("card-wrap").style.display   = name === "card" ? "block" : "none";
  document.getElementById("session-end").style.display = name === "end"  ? "block" : "none";
}
function setProg(pct, label, cor) {
  document.getElementById("prog-bar").style.width   = pct + "%";
  document.getElementById("prog-label").textContent = label;
  document.getElementById("streak").textContent     = cor > 0 ? String(cor) : "";
}

// ── Mode ───────────────────────────────────────────────────────────────────
function setMode(m) {
  mode = m;
  cfg.updateModeUI(m);
}

// ── Session ────────────────────────────────────────────────────────────────
function startSession() {
  var catSel  = document.getElementById("cat-select");
  var cat     = catSel ? catSel.value : "All";
  var p       = loadProgress();
  var candidates = allCards.filter(function(c) {
    return (cat === "All" || c.cat === cat) &&
           isDue(p[String(c.num)] || {}) &&
           cfg.filterExtra(c);
  });
  // Fisher-Yates shuffle
  for (var i = candidates.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = candidates[i]; candidates[i] = candidates[j]; candidates[j] = tmp;
  }
  queue     = candidates.map(function(c) { return c.num; });
  qpos      = 0; sessCorr = 0; sessWrong = 0;
  if (queue.length === 0) {
    alert("All caught up! No cards due right now.\nCheck back later or choose a different category.");
    return;
  }
  showScreen("card");
  nextCard();
}

function nextCard() {
  if (qpos >= queue.length) { sessionEnd(); return; }
  var num  = queue[qpos];
  var card = allCards.find(function(c) { return c.num === num; });
  var p    = loadProgress();
  var pd   = p[String(num)] || {};
  curCard     = card;
  answerShown = false;

  // Badge
  document.getElementById("card-cat").textContent = card.cat;
  var badgeMap = { new:"badge-new", learning:"badge-learning", review:"badge-review", mature:"badge-mature" };
  var badgeTxt = { new:"New", learning:"Learning", review:"Review", mature:"Mature" };
  var stage    = cardStage(pd);
  var interval = pd.interval || 0;
  var badge    = document.getElementById("card-badge");
  badge.className   = "card-badge " + (badgeMap[stage] || "badge-new");
  badge.textContent = (badgeTxt[stage] || "New") + (interval > 0 ? "  (" + interval + "d)" : "");

  // Question
  var q = cfg.getQuestion(card, mode);
  document.getElementById("card-dir").textContent = q.dir;
  document.getElementById("card-q").textContent   = q.text;

  // Auto-TTS
  var tts = cfg.getQuestionTTS(card, mode);
  if (tts) callPronounce(tts.text, tts.lang);

  // Reset UI state
  document.getElementById("answer-area").style.display  = "none";
  document.getElementById("btn-show").style.display     = "block";
  document.getElementById("rating-area").style.display  = "none";
  setProg(qpos / queue.length * 100,
    "Card " + (qpos+1) + "/" + queue.length + "   Correct: " + sessCorr + "   Wrong: " + sessWrong,
    sessCorr);
}

function showAnswer() {
  if (!curCard || answerShown) return;
  answerShown = true;
  var tts = cfg.renderAnswer(curCard, mode);
  document.getElementById("answer-area").style.display = "block";
  document.getElementById("btn-show").style.display    = "none";
  document.getElementById("rating-area").style.display = "block";
  if (tts) callPronounce(tts.text, tts.lang);
}

function rate(rating) {
  if (!answerShown || !curCard) return;
  var p  = loadProgress();
  var pd = p[String(curCard.num)] || {};
  p[String(curCard.num)] = sm2Update(pd, rating);
  saveProgress(p);
  if (rating === 1) {
    var insertAt = Math.min(qpos + 2 + Math.floor(Math.random() * 3), queue.length);
    queue.splice(insertAt, 0, curCard.num);
    sessWrong++;
  } else if (rating === 2) {
    sessWrong++;
  } else {
    sessCorr++;
  }
  qpos++;
  nextCard();
}

function sessionEnd() {
  showScreen("end");
  var total = sessCorr + sessWrong;
  var acc   = total ? Math.round(100 * sessCorr / total) : 0;
  document.getElementById("end-cor").textContent = sessCorr;
  document.getElementById("end-wrg").textContent = sessWrong;
  document.getElementById("end-acc").textContent = acc + "%";
  document.getElementById("end-sub").textContent = total + " cards reviewed. Press Start to go again.";
  setProg(100, "Done! " + acc + "% accuracy", sessCorr);
  refreshOverview();
}

function goHome() { showScreen("home"); refreshOverview(); setProg(0, "Ready", 0); }

// ── Pronounce ──────────────────────────────────────────────────────────────
function pronounce() {
  if (!curCard) return;
  var tts = cfg.getPronounce(curCard);
  if (tts) callPronounce(tts.text, tts.lang);
}

// ── Stats modal ────────────────────────────────────────────────────────────
function openStats() {
  document.getElementById("modal-overlay").classList.add("open");
  var ov   = computeOverview();
  var cats = computeCatStats();
  var html = '<div class="overview-grid">' +
    '<div class="ov-box"><div class="n" style="color:var(--amber)">' + ov.due + '</div><div class="l">Due Today</div></div>' +
    '<div class="ov-box"><div class="n">' + ov.total + '</div><div class="l">Total</div></div>' +
    '<div class="ov-box"><div class="n" style="color:var(--blue)">' + ov.new + '</div><div class="l">New</div></div>' +
    '<div class="ov-box"><div class="n" style="color:var(--amber)">' + (ov.learning + ov.review) + '</div><div class="l">Learning</div></div>' +
    '<div class="ov-box"><div class="n" style="color:var(--green)">' + ov.mature + '</div><div class="l">Mature</div></div>' +
    '<div class="ov-box"><div class="n">' + ov.accuracy + '%</div><div class="l">Accuracy</div></div>' +
    '</div>' +
    '<h4 style="color:var(--primary);margin-bottom:8px;">Progress by Category</h4>' +
    '<table class="cat-table"><thead><tr><th>Category</th><th>Total</th><th>Mature</th><th>Due</th></tr></thead><tbody>';
  var entries = Object.keys(cats).sort();
  for (var i = 0; i < entries.length; i++) {
    var cat = entries[i];
    var s   = cats[cat];
    var pct = s.total ? Math.round(100 * s.mature / s.total) : 0;
    html += '<tr><td>' + cat + '</td><td>' + s.total + '</td>' +
      '<td><div>' + s.mature + ' (' + pct + '%)</div>' +
      '<div class="pct-bar"><div class="pct-fill" style="width:' + pct + '%"></div></div></td>' +
      '<td style="color:' + (s.due > 0 ? 'var(--amber)' : 'var(--dgrey)') + ';font-weight:' + (s.due > 0 ? 700 : 400) + '">' + (s.due || '\u2014') + '</td></tr>';
  }
  html += '</tbody></table>';
  document.getElementById("modal-body").innerHTML = html;
}
function closeStats() {
  document.getElementById("modal-overlay").classList.remove("open");
}

// ── Keyboard ───────────────────────────────────────────────────────────────
document.addEventListener("keydown", function(e) {
  if (e.target.tagName === "SELECT") return;
  if (e.key === " " || e.key === "Spacebar") { e.preventDefault(); showAnswer(); }
  if (e.key === "1") rate(1);
  if (e.key === "2") rate(2);
  if (e.key === "3") rate(3);
  if (e.key === "4") rate(4);
  if (e.key === "p" || e.key === "P") pronounce();
  if (e.key === "Enter" && document.getElementById("welcome").style.display !== "none") startSession();
  if (e.key === "Escape") closeStats();
  if (cfg && cfg.handleExtraKeys) cfg.handleExtraKeys(e, curCard);
});

// ── Init ───────────────────────────────────────────────────────────────────
async function init() {
  cfg = window.LANG_CONFIG;
  allCards = await fetch(cfg.vocabUrl).then(function(r) { return r.json(); });

  var cats = [];
  var seen = {};
  for (var i = 0; i < allCards.length; i++) {
    if (!seen[allCards[i].cat]) { seen[allCards[i].cat] = true; cats.push(allCards[i].cat); }
  }
  cats.sort();
  var sel = document.getElementById("cat-select");
  sel.innerHTML = '<option value="All">All categories</option>' +
    cats.map(function(c) { return '<option>' + c + '</option>'; }).join("");

  cfg.initUI(allCards, setMode);
  refreshOverview();
  showScreen("home");
}

// ── Expose globals for onclick= handlers ───────────────────────────────────
window.startSession = startSession;
window.showAnswer   = showAnswer;
window.rate         = rate;
window.pronounce    = pronounce;
window.setMode      = setMode;
window.openStats    = openStats;
window.closeStats   = closeStats;
window.goHome       = goHome;

init();
})();
```

**Step 2: Verify syntax (open browser console — no parse errors)**

```bash
node --check static/shared.js
```

Expected: no output (no syntax errors). Note: `node --check` won't understand `async`/`await` on older node — if it fails, try:
```bash
node -e "require('fs').readFileSync('static/shared.js','utf8')" && echo OK
```

**Step 3: Commit**

```bash
git add static/shared.js
git commit -m "feat: add shared SRS engine JS with LANG_CONFIG interface"
```

---

### Task 3: Create `templates/bahasa.html`

**Files:**
- Create: `templates/bahasa.html`

**Step 1: Create the file**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bahasa Anki — Spaced Repetition</title>
<link rel="stylesheet" href="/static/shared.css">
<style>
  :root {
    --primary:         #1A3C5E;
    --primary-dk:      #162E48;
    --accent:          #2E6DA4;
    --accent2:         #1ABC9C;
    --card-shadow:     rgba(26,60,94,0.12);
    --card-bg:         #FAFCFF;
  }
  /* Bahasa answer styles */
  .ans-malay   { font-size: 16px; color: #2E7A5E; font-weight: 600; margin-bottom: 12px; }
  .ans-example { font-size: 13px; color: #334455; font-style: italic;
                 background: #F0F8F4; border-left: 3px solid var(--green);
                 padding: 8px 12px; border-radius: 0 6px 6px 0; margin-bottom: 8px; }
  .ans-eng-ex  { font-size: 12px; color: var(--dgrey); font-style: italic; padding-left: 4px; }
</style>
</head>
<body>

<div id="topbar">
  <h1>&#x1F0CF; BAHASA ANKI</h1>
  <button class="mode-btn active" id="btn-id-en" onclick="setMode('id_en')">&#x1F1EE;&#x1F1E9; ID &#8594; EN</button>
  <button class="mode-btn"        id="btn-en-id" onclick="setMode('en_id')">&#x1F1EC;&#x1F1E7; EN &#8594; ID</button>
  <label style="color:rgba(255,255,255,0.6);font-size:13px;">Category:</label>
  <select id="cat-select"></select>
  <div class="spacer"></div>
  <button id="stats-btn" onclick="openStats()">&#128202; Stats</button>
</div>

<div id="progstrip">
  <span id="prog-label">Ready</span>
  <div id="prog-bar-wrap"><div id="prog-bar"></div></div>
  <span id="streak"></span>
</div>

<div id="main">
  <div id="welcome">
    <h2>&#x1F1EE;&#x1F1E9; Bahasa Indonesia / Melayu</h2>
    <p>Spaced-repetition flashcards &#8212; 2&thinsp;000 words, SM-2 algorithm</p>
    <div class="stat-grid">
      <div class="stat-box due"><div class="num" id="ov-due">&#8230;</div><div class="lbl">Due Today</div></div>
      <div class="stat-box new"><div class="num" id="ov-new">&#8230;</div><div class="lbl">New</div></div>
      <div class="stat-box">   <div class="num" id="ov-learn">&#8230;</div><div class="lbl">Learning</div></div>
      <div class="stat-box mat"><div class="num" id="ov-mature">&#8230;</div><div class="lbl">Mature</div></div>
    </div>
    <p style="color:var(--dgrey);font-size:13px;">
      <span class="kbd">Space</span> show answer &nbsp;
      <span class="kbd">1</span>&#8211;<span class="kbd">4</span> rate &nbsp;
      <span class="kbd">P</span> pronounce &nbsp;
      <span class="kbd">Enter</span> start
    </p>
  </div>

  <div id="card-wrap">
    <div class="card">
      <div class="card-header">
        <span class="card-cat" id="card-cat">&#8212;</span>
        <span class="card-badge" id="card-badge">New</span>
      </div>
      <div class="card-body">
        <div class="card-direction" id="card-dir">Indonesian &#8594; English</div>
        <div class="card-question"  id="card-q">&#8230;</div>
        <div class="card-divider"></div>
        <div id="answer-area">
          <div class="answer-primary" id="ans-word"></div>
          <div class="ans-malay"      id="ans-malay"></div>
          <div class="ans-example"    id="ans-contoh"  style="display:none"></div>
          <div class="ans-eng-ex"     id="ans-eng-ex"  style="display:none"></div>
        </div>
        <button class="pronounce-btn" id="btn-pronounce" onclick="pronounce()">&#128266; Pronounce</button>
      </div>
    </div>
    <div id="action-area">
      <button id="btn-show" onclick="showAnswer()">&#128065; Show Answer</button>
      <div id="rating-area">
        <div class="rating-row">
          <button class="rating-btn btn-again" onclick="rate(1)">&#128560; Again<br><small>forgot</small></button>
          <button class="rating-btn btn-hard"  onclick="rate(2)">&#128533; Hard<br><small>struggled</small></button>
          <button class="rating-btn btn-good"  onclick="rate(3)">&#128578; Good<br><small>knew it</small></button>
          <button class="rating-btn btn-easy"  onclick="rate(4)">&#128516; Easy<br><small>instant!</small></button>
        </div>
        <div class="hint-row">
          <span class="kbd">1</span> Again &nbsp;
          <span class="kbd">2</span> Hard &nbsp;
          <span class="kbd">3</span> Good &nbsp;
          <span class="kbd">4</span> Easy
        </div>
      </div>
    </div>
  </div>

  <div id="session-end">
    <h2>&#127881; Session Done!</h2>
    <div class="end-stats">
      <div class="end-stat"><div class="n" id="end-cor" style="color:var(--green)">&#8212;</div><div class="l">Correct</div></div>
      <div class="end-stat"><div class="n" id="end-wrg" style="color:var(--red)">&#8212;</div><div class="l">Wrong</div></div>
      <div class="end-stat"><div class="n" id="end-acc" style="color:var(--primary)">&#8212;</div><div class="l">Accuracy</div></div>
    </div>
    <p class="sub" id="end-sub"></p>
  </div>

  <div id="bottom-bar">
    <button id="btn-start" onclick="startSession()">&#9654; Start Session</button>
    <button id="btn-quit"  onclick="goHome()">&#127968; Home</button>
  </div>
</div>

<div id="modal-overlay" onclick="if(event.target===this)closeStats()">
  <div class="modal">
    <div class="modal-header">
      <h3>&#128202; Your Progress</h3>
      <button class="modal-close" onclick="closeStats()">&#10005;</button>
    </div>
    <div class="modal-body" id="modal-body">Loading&#8230;</div>
  </div>
</div>

<script>
window.LANG_CONFIG = {
  storageKey: "bahasa_progress",
  vocabUrl:   "/api/vocab/bahasa",
  defaultMode: "id_en",

  initUI: function(allCards, setModeFn) {
    setModeFn("id_en");
  },

  updateModeUI: function(m) {
    document.getElementById("btn-id-en").classList.toggle("active", m === "id_en");
    document.getElementById("btn-en-id").classList.toggle("active", m === "en_id");
  },

  getQuestion: function(card, mode) {
    if (mode === "id_en") return { text: card.indo,    dir: "Indonesian \u2192 English" };
    return               { text: card.english, dir: "English \u2192 Indonesian" };
  },

  getQuestionTTS: function(card, mode) {
    if (mode === "id_en") return { text: card.indo, lang: "id-ID" };
    return null;
  },

  getPronounce: function(card) {
    return { text: card.indo, lang: "id-ID" };
  },

  renderAnswer: function(card, mode) {
    document.getElementById("ans-word").textContent  = mode === "id_en" ? card.english : card.indo;
    document.getElementById("ans-malay").textContent = card.malay ? "Malay: " + card.malay : "";
    var ctEl = document.getElementById("ans-contoh");
    var exEl = document.getElementById("ans-eng-ex");
    if (card.contoh && card.contoh !== "None") {
      ctEl.textContent = "\u00a0\u00a0" + card.contoh; ctEl.style.display = "block";
    } else { ctEl.style.display = "none"; }
    if (card.eng_ex && card.eng_ex !== "None") {
      exEl.textContent = "\u00a0\u00a0" + card.eng_ex; exEl.style.display = "block";
    } else { exEl.style.display = "none"; }
    if (mode === "en_id") return { text: card.indo, lang: "id-ID" };
    return null;
  },

  filterExtra: function(card) { return true; },
  handleExtraKeys: function(e, curCard) {},
};
</script>
<script src="/static/shared.js"></script>
</body>
</html>
```

**Step 2: Commit**

```bash
git add templates/bahasa.html
git commit -m "feat: add Bahasa template (thin shell over shared.js)"
```

---

### Task 4: Create `templates/viet.html`

**Files:**
- Create: `templates/viet.html`

**Step 1: Create the file**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Viet Anki — Spaced Repetition</title>
<link rel="stylesheet" href="/static/shared.css">
<style>
  :root {
    --primary:         #8B0000;
    --primary-dk:      #6B0000;
    --accent:          #CC2233;
    --accent2:         #F4C430;
    --card-shadow:     rgba(139,0,0,0.12);
    --card-bg:         #FFFDF8;
  }
  #prog-bar { background: var(--accent2); }
  #streak   { color: var(--accent2); }
  /* Viet answer styles */
  .ans-hanzi    { font-size: 28px; color: #8B0000; font-weight: 700; margin-right: 8px; }
  .ans-cantonese{ font-size: 14px; color: #555; font-style: italic; }
  #hanzi-row    { display: none; align-items: baseline; gap: 8px; margin-bottom: 10px; }
  .ans-notes    { font-size: 13px; color: #334455; font-style: italic;
                  background: #FFF8F0; border-left: 3px solid var(--accent2);
                  padding: 8px 12px; border-radius: 0 6px 6px 0; margin-bottom: 8px; }
</style>
</head>
<body>

<div id="topbar">
  <h1>&#x1F1FB;&#x1F1F3; VIET ANKI</h1>
  <button class="mode-btn active" id="btn-vi-en" onclick="setMode('vi_en')">&#x1F1FB;&#x1F1F3; VI &#8594; EN</button>
  <button class="mode-btn"        id="btn-en-vi" onclick="setMode('en_vi')">&#x1F1EC;&#x1F1E7; EN &#8594; VI</button>
  <label style="color:rgba(255,255,255,0.6);font-size:13px;">Category:</label>
  <select id="cat-select"></select>
  <label style="color:rgba(255,255,255,0.6);font-size:13px;">Part:</label>
  <select id="part-select"></select>
  <div class="spacer"></div>
  <button id="stats-btn" onclick="openStats()">&#128202; Stats</button>
</div>

<div id="progstrip">
  <span id="prog-label">Ready</span>
  <div id="prog-bar-wrap"><div id="prog-bar"></div></div>
  <span id="streak"></span>
</div>

<div id="main">
  <div id="welcome">
    <h2>&#x1F1FB;&#x1F1F3; Vietnamese &#8212; Spaced Repetition</h2>
    <p>1&thinsp;962 words &#183; SM-2 algorithm &#183; Cantonese connections</p>
    <div class="stat-grid">
      <div class="stat-box due"><div class="num" id="ov-due">&#8230;</div><div class="lbl">Due Today</div></div>
      <div class="stat-box new"><div class="num" id="ov-new">&#8230;</div><div class="lbl">New</div></div>
      <div class="stat-box">   <div class="num" id="ov-learn">&#8230;</div><div class="lbl">Learning</div></div>
      <div class="stat-box mat"><div class="num" id="ov-mature">&#8230;</div><div class="lbl">Mature</div></div>
    </div>
    <p style="color:var(--dgrey);font-size:13px;">
      <span class="kbd">Space</span> show answer &nbsp;
      <span class="kbd">1</span>&#8211;<span class="kbd">4</span> rate &nbsp;
      <span class="kbd">P</span> Vietnamese &nbsp;
      <span class="kbd">C</span> Cantonese &nbsp;
      <span class="kbd">Enter</span> start
    </p>
  </div>

  <div id="card-wrap">
    <div class="card">
      <div class="card-header">
        <span class="card-cat" id="card-cat">&#8212;</span>
        <span id="card-part" style="color:rgba(255,255,255,0.55);font-size:12px;"></span>
        <span class="card-badge" id="card-badge">New</span>
      </div>
      <div class="card-body">
        <div class="card-direction" id="card-dir">Vietnamese &#8594; English</div>
        <div class="card-question"  id="card-q">&#8230;</div>
        <div class="card-divider"></div>
        <div id="answer-area">
          <div class="answer-primary" id="ans-english"></div>
          <div id="hanzi-row">
            <span class="ans-hanzi"     id="q-hanzi"></span>
            <span class="ans-cantonese" id="q-cantonese"></span>
          </div>
          <div class="ans-notes" id="ans-notes" style="display:none"></div>
        </div>
        <button class="pronounce-btn" id="btn-pronounce"       onclick="pronounce()">&#128266; Vietnamese</button>
        <button class="pronounce-btn" id="btn-pronounce-canto" onclick="pronounceCanto()" style="display:none;margin-left:8px;">&#128266; Cantonese</button>
      </div>
    </div>
    <div id="action-area">
      <button id="btn-show" onclick="showAnswer()">&#128065; Show Answer</button>
      <div id="rating-area">
        <div class="rating-row">
          <button class="rating-btn btn-again" onclick="rate(1)">&#128560; Again<br><small>forgot</small></button>
          <button class="rating-btn btn-hard"  onclick="rate(2)">&#128533; Hard<br><small>struggled</small></button>
          <button class="rating-btn btn-good"  onclick="rate(3)">&#128578; Good<br><small>knew it</small></button>
          <button class="rating-btn btn-easy"  onclick="rate(4)">&#128516; Easy<br><small>instant!</small></button>
        </div>
        <div class="hint-row">
          <span class="kbd">1</span> Again &nbsp;
          <span class="kbd">2</span> Hard &nbsp;
          <span class="kbd">3</span> Good &nbsp;
          <span class="kbd">4</span> Easy
        </div>
      </div>
    </div>
  </div>

  <div id="session-end">
    <h2>&#127881; Session Done!</h2>
    <div class="end-stats">
      <div class="end-stat"><div class="n" id="end-cor" style="color:var(--green)">&#8212;</div><div class="l">Correct</div></div>
      <div class="end-stat"><div class="n" id="end-wrg" style="color:var(--red)">&#8212;</div><div class="l">Wrong</div></div>
      <div class="end-stat"><div class="n" id="end-acc" style="color:var(--primary)">&#8212;</div><div class="l">Accuracy</div></div>
    </div>
    <p class="sub" id="end-sub"></p>
  </div>

  <div id="bottom-bar">
    <button id="btn-start" onclick="startSession()">&#9654; Start Session</button>
    <button id="btn-quit"  onclick="goHome()">&#127968; Home</button>
  </div>
</div>

<div id="modal-overlay" onclick="if(event.target===this)closeStats()">
  <div class="modal">
    <div class="modal-header">
      <h3>&#128202; Your Progress</h3>
      <button class="modal-close" onclick="closeStats()">&#10005;</button>
    </div>
    <div class="modal-body" id="modal-body">Loading&#8230;</div>
  </div>
</div>

<script>
function pronounceCanto() {
  var card = window._vietCurCard;
  if (card && card.hanzi) {
    speechSynthesis && speechSynthesis.cancel();
    var utt = new SpeechSynthesisUtterance(card.hanzi);
    utt.lang = "zh-HK";
    speechSynthesis.speak(utt);
  }
}

window.LANG_CONFIG = {
  storageKey: "viet_progress",
  vocabUrl:   "/api/vocab/viet",
  defaultMode: "vi_en",

  initUI: function(allCards, setModeFn) {
    var parts = [];
    var seen  = {};
    for (var i = 0; i < allCards.length; i++) {
      if (!seen[allCards[i].part]) { seen[allCards[i].part] = true; parts.push(allCards[i].part); }
    }
    parts.sort();
    document.getElementById("part-select").innerHTML =
      '<option value="All">All parts</option>' +
      parts.map(function(p) { return '<option>' + p + '</option>'; }).join("");
    setModeFn("vi_en");
  },

  updateModeUI: function(m) {
    document.getElementById("btn-vi-en").classList.toggle("active", m === "vi_en");
    document.getElementById("btn-en-vi").classList.toggle("active", m === "en_vi");
  },

  getQuestion: function(card, mode) {
    var partEl = document.getElementById("card-part");
    if (partEl) partEl.textContent = " \u00b7 " + card.part;
    if (mode === "vi_en") return { text: card.viet,    dir: "Vietnamese \u2192 English" };
    return               { text: card.english, dir: "English \u2192 Vietnamese" };
  },

  getQuestionTTS: function(card, mode) {
    if (mode === "vi_en") return { text: card.viet, lang: "vi-VN" };
    return null;
  },

  getPronounce: function(card) {
    return { text: card.viet, lang: "vi-VN" };
  },

  renderAnswer: function(card, mode) {
    window._vietCurCard = card;
    document.getElementById("ans-english").textContent = mode === "vi_en" ? card.english : card.viet;

    // Hanzi / Cantonese row
    var hanziRow   = document.getElementById("hanzi-row");
    var cantoBtn   = document.getElementById("btn-pronounce-canto");
    if (card.hanzi) {
      document.getElementById("q-hanzi").textContent     = card.hanzi;
      document.getElementById("q-cantonese").textContent = card.cantonese ? ": " + card.cantonese : "";
      hanziRow.style.display = "flex";
      cantoBtn.style.display = "inline-block";
    } else {
      hanziRow.style.display = "none";
      cantoBtn.style.display = "none";
    }

    var notesEl = document.getElementById("ans-notes");
    if (card.notes && card.notes !== "None") {
      notesEl.textContent = card.notes; notesEl.style.display = "block";
    } else { notesEl.style.display = "none"; }

    if (mode === "en_vi") return { text: card.viet, lang: "vi-VN" };
    return null;
  },

  filterExtra: function(card) {
    var partSel = document.getElementById("part-select");
    if (!partSel) return true;
    var part = partSel.value;
    return part === "All" || card.part === part;
  },

  handleExtraKeys: function(e, curCard) {
    if ((e.key === "c" || e.key === "C") && curCard) pronounceCanto();
  },
};
</script>
<script src="/static/shared.js"></script>
</body>
</html>
```

**Step 2: Commit**

```bash
git add templates/viet.html
git commit -m "feat: add Vietnamese template (thin shell over shared.js)"
```

---

### Task 5: Create `templates/spanish.html`

**Files:**
- Create: `templates/spanish.html`

**Step 1: Create the file**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Spanish Anki — Spaced Repetition</title>
<link rel="stylesheet" href="/static/shared.css">
<style>
  :root {
    --primary:         #C60B1E;
    --primary-dk:      #9A0918;
    --accent:          #C60B1E;
    --accent2:         #FFC400;
    --card-shadow:     rgba(198,11,30,0.10);
    --card-bg:         #FFFDF8;
    --lgrey:           #FDF8F0;
  }
  #prog-bar { background: var(--accent2); }
  #streak   { color: var(--accent2); }
  .mode-btn.active { background: var(--primary-dk); border-color: var(--primary-dk); }
  /* Spanish answer styles */
  .gender-badge {
    display: inline-block; font-size: 12px; font-weight: 700; padding: 2px 10px;
    border-radius: 10px; margin-bottom: 10px;
  }
  .gender-m { background: #D6EAF8; color: #1A5276; }
  .gender-f { background: #FDEDEC; color: #922B21; }
  .ans-notes {
    font-size: 13px; color: #5D4037; background: #FFF8E1;
    border-left: 3px solid var(--accent2); padding: 8px 12px;
    border-radius: 0 6px 6px 0; margin-bottom: 8px;
  }
  .ans-example-es { font-size: 13px; color: #334455; font-style: italic;
                    background: #FDF0F0; border-left: 3px solid var(--primary);
                    padding: 8px 12px; border-radius: 0 6px 6px 0; margin-bottom: 6px; }
  .ans-example-en { font-size: 12px; color: var(--dgrey); font-style: italic; padding-left: 4px; }
</style>
</head>
<body>

<div id="topbar">
  <h1>&#x1F1EA;&#x1F1F8; SPANISH ANKI</h1>
  <button class="mode-btn active" id="btn-es-en" onclick="setMode('es_en')">&#x1F1EA;&#x1F1F8; ES &#8594; EN</button>
  <button class="mode-btn"        id="btn-en-es" onclick="setMode('en_es')">&#x1F1EC;&#x1F1E7; EN &#8594; ES</button>
  <label style="color:rgba(255,255,255,0.6);font-size:13px;">Category:</label>
  <select id="cat-select"></select>
  <div class="spacer"></div>
  <button id="stats-btn" onclick="openStats()">&#128202; Stats</button>
</div>

<div id="progstrip">
  <span id="prog-label">Ready</span>
  <div id="prog-bar-wrap"><div id="prog-bar"></div></div>
  <span id="streak"></span>
</div>

<div id="main">
  <div id="welcome">
    <h2>&#x1F1EA;&#x1F1F8; Spanish &#8212; Spaced Repetition</h2>
    <p>3&thinsp;000 words &#183; SM-2 algorithm &#183; Gender &amp; conjugation notes</p>
    <div class="stat-grid">
      <div class="stat-box due"><div class="num" id="ov-due">&#8230;</div><div class="lbl">Due Today</div></div>
      <div class="stat-box new"><div class="num" id="ov-new">&#8230;</div><div class="lbl">New</div></div>
      <div class="stat-box">   <div class="num" id="ov-learn">&#8230;</div><div class="lbl">Learning</div></div>
      <div class="stat-box mat"><div class="num" id="ov-mature">&#8230;</div><div class="lbl">Mature</div></div>
    </div>
    <p style="color:var(--dgrey);font-size:13px;">
      <span class="kbd">Space</span> show answer &nbsp;
      <span class="kbd">1</span>&#8211;<span class="kbd">4</span> rate &nbsp;
      <span class="kbd">P</span> pronounce &nbsp;
      <span class="kbd">Enter</span> start
    </p>
  </div>

  <div id="card-wrap">
    <div class="card">
      <div class="card-header">
        <span class="card-cat" id="card-cat">&#8212;</span>
        <span class="card-badge" id="card-badge">New</span>
      </div>
      <div class="card-body">
        <div class="card-direction" id="card-dir">Spanish &#8594; English</div>
        <div class="card-question"  id="card-q">&#8230;</div>
        <div class="card-divider"></div>
        <div id="answer-area">
          <div class="answer-primary" id="ans-english"></div>
          <div id="ans-gender-wrap"></div>
          <div class="ans-notes"      id="ans-notes"      style="display:none"></div>
          <div class="ans-example-es" id="ans-example-es" style="display:none"></div>
          <div class="ans-example-en" id="ans-example-en" style="display:none"></div>
        </div>
        <button class="pronounce-btn" onclick="pronounce()">&#128266; Pronounce</button>
      </div>
    </div>
    <div id="action-area">
      <button id="btn-show" onclick="showAnswer()">&#128065; Show Answer</button>
      <div id="rating-area">
        <div class="rating-row">
          <button class="rating-btn btn-again" onclick="rate(1)">&#128560; Again<br><small>forgot</small></button>
          <button class="rating-btn btn-hard"  onclick="rate(2)">&#128533; Hard<br><small>struggled</small></button>
          <button class="rating-btn btn-good"  onclick="rate(3)">&#128578; Good<br><small>knew it</small></button>
          <button class="rating-btn btn-easy"  onclick="rate(4)">&#128516; Easy<br><small>instant!</small></button>
        </div>
        <div class="hint-row">
          <span class="kbd">1</span> Again &nbsp;
          <span class="kbd">2</span> Hard &nbsp;
          <span class="kbd">3</span> Good &nbsp;
          <span class="kbd">4</span> Easy
        </div>
      </div>
    </div>
  </div>

  <div id="session-end">
    <h2>&#127881; Session Done!</h2>
    <div class="end-stats">
      <div class="end-stat"><div class="n" id="end-cor" style="color:var(--green)">&#8212;</div><div class="l">Correct</div></div>
      <div class="end-stat"><div class="n" id="end-wrg" style="color:#C0392B">&#8212;</div><div class="l">Wrong</div></div>
      <div class="end-stat"><div class="n" id="end-acc" style="color:var(--primary)">&#8212;</div><div class="l">Accuracy</div></div>
    </div>
    <p class="sub" id="end-sub"></p>
  </div>

  <div id="bottom-bar">
    <button id="btn-start" onclick="startSession()">&#9654; Start Session</button>
    <button id="btn-quit"  onclick="goHome()">&#127968; Home</button>
  </div>
</div>

<div id="modal-overlay" onclick="if(event.target===this)closeStats()">
  <div class="modal">
    <div class="modal-header">
      <h3>&#128202; Your Progress</h3>
      <button class="modal-close" onclick="closeStats()">&#10005;</button>
    </div>
    <div class="modal-body" id="modal-body">Loading&#8230;</div>
  </div>
</div>

<script>
window.LANG_CONFIG = {
  storageKey: "spanish_progress",
  vocabUrl:   "/api/vocab/spanish",
  defaultMode: "es_en",

  initUI: function(allCards, setModeFn) {
    setModeFn("es_en");
  },

  updateModeUI: function(m) {
    document.getElementById("btn-es-en").classList.toggle("active", m === "es_en");
    document.getElementById("btn-en-es").classList.toggle("active", m === "en_es");
  },

  getQuestion: function(card, mode) {
    if (mode === "es_en") return { text: card.spanish, dir: "Spanish \u2192 English" };
    return               { text: card.english, dir: "English \u2192 Spanish" };
  },

  getQuestionTTS: function(card, mode) {
    if (mode === "es_en") return { text: card.spanish, lang: "es-ES" };
    return null;
  },

  getPronounce: function(card) {
    return { text: card.spanish, lang: "es-ES" };
  },

  renderAnswer: function(card, mode) {
    document.getElementById("ans-english").textContent = mode === "es_en" ? card.english : card.spanish;

    var gWrap = document.getElementById("ans-gender-wrap");
    if      (card.gender === "m") gWrap.innerHTML = '<span class="gender-badge gender-m">masculine</span>';
    else if (card.gender === "f") gWrap.innerHTML = '<span class="gender-badge gender-f">feminine</span>';
    else                          gWrap.innerHTML = "";

    var notesEl = document.getElementById("ans-notes");
    if (card.notes && card.notes !== "None" && card.notes.trim()) {
      notesEl.textContent = card.notes; notesEl.style.display = "block";
    } else { notesEl.style.display = "none"; }

    var esEl = document.getElementById("ans-example-es");
    var enEl = document.getElementById("ans-example-en");
    if (card.example_es && card.example_es !== "None") {
      esEl.textContent = card.example_es; esEl.style.display = "block";
    } else { esEl.style.display = "none"; }
    if (card.example_en && card.example_en !== "None") {
      enEl.textContent = card.example_en; enEl.style.display = "block";
    } else { enEl.style.display = "none"; }

    if (mode === "en_es") return { text: card.spanish, lang: "es-ES" };
    return null;
  },

  filterExtra: function(card) { return true; },
  handleExtraKeys: function(e, curCard) {},
};
</script>
<script src="/static/shared.js"></script>
</body>
</html>
```

**Step 2: Commit**

```bash
git add templates/spanish.html
git commit -m "feat: add Spanish template (thin shell over shared.js)"
```

---

### Task 6: Create `templates/index.html`

**Files:**
- Create: `templates/index.html`

This is a simple landing page that links to all 3 apps.

**Step 1: Create the file**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Language Anki</title>
<link rel="stylesheet" href="/static/shared.css">
<style>
  .lang-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 20px; margin-top: 32px; }
  .lang-card {
    background: white; border-radius: 16px; padding: 32px 24px; text-align: center;
    box-shadow: 0 4px 20px rgba(0,0,0,0.08); text-decoration: none; color: inherit;
    transition: transform 0.15s, box-shadow 0.15s;
  }
  .lang-card:hover { transform: translateY(-4px); box-shadow: 0 8px 30px rgba(0,0,0,0.12); }
  .lang-card .flag  { font-size: 52px; margin-bottom: 12px; }
  .lang-card h2     { font-size: 20px; font-weight: 700; margin-bottom: 6px; }
  .lang-card p      { font-size: 13px; color: var(--dgrey); }
</style>
</head>
<body>
<div id="topbar" style="background:#2C3E50;">
  <h1>&#127760; Language Anki</h1>
</div>
<div id="main" style="text-align:center;padding-top:48px;">
  <h2 style="color:#2C3E50;font-size:28px;margin-bottom:8px;">Choose a language</h2>
  <p style="color:var(--dgrey);">SM-2 spaced repetition &#183; Progress saved in browser</p>
  <div class="lang-grid">
    <a class="lang-card" href="/bahasa">
      <div class="flag">&#x1F1EE;&#x1F1E9;</div>
      <h2>Bahasa Indonesia</h2>
      <p>2&thinsp;000 words &#183; Malay included</p>
    </a>
    <a class="lang-card" href="/viet">
      <div class="flag">&#x1F1FB;&#x1F1F3;</div>
      <h2>Vietnamese</h2>
      <p>1&thinsp;962 words &#183; Cantonese connections</p>
    </a>
    <a class="lang-card" href="/spanish">
      <div class="flag">&#x1F1EA;&#x1F1F8;</div>
      <h2>Spanish</h2>
      <p>3&thinsp;000 words &#183; Gender &amp; conjugation</p>
    </a>
  </div>
</div>
</body>
</html>
```

**Step 2: Commit**

```bash
git add templates/index.html
git commit -m "feat: add landing page for all 3 language apps"
```

---

### Task 7: Create root `app.py`

**Files:**
- Create: `app.py`

**Step 1: Create the file**

```python
#!/usr/bin/env python3
"""
app.py  —  Language Anki monorepo
==================================
Serves all 3 language apps from one Flask instance.
Run:  python3 app.py
"""

from pathlib import Path
from flask import Flask, jsonify, render_template
import openpyxl

BASE = Path(__file__).parent
app  = Flask(__name__)

# ── Vocab loaders ─────────────────────────────────────────────────────────────

def _load_xlsx(src, row_fn):
    wb    = openpyxl.load_workbook(src, read_only=True, data_only=True)
    ws    = wb.active if len(wb.sheetnames) == 1 else wb[wb.sheetnames[0]]
    cards = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        card = row_fn(row)
        if card:
            cards.append(card)
    wb.close()
    return cards


def _load_bahasa():
    src = BASE / "indonesian" / "Bahasa_Indonesia_Melayu_2000_Words_FINAL.xlsx"
    xlsm = BASE / "indonesian" / "Bahasa_Vocab.xlsm"
    src = xlsm if xlsm.exists() else src
    print(f"Loading Bahasa vocab from {src}…")

    wb = openpyxl.load_workbook(src, read_only=True, data_only=True)
    if "SRS_Data" in wb.sheetnames:
        ws = wb["SRS_Data"]
        cards = []
        for row in ws.iter_rows(min_row=2, values_only=True):
            if not row[0]:
                continue
            cards.append({
                "num":     int(row[0]),
                "indo":    str(row[1] or ""),
                "malay":   str(row[2] or ""),
                "english": str(row[3] or ""),
                "cat":     str(row[4] or "General"),
                "contoh":  str(row[5] or ""),
                "eng_ex":  str(row[6] or ""),
            })
    else:
        sheet_name = "Vocab" if "Vocab" in wb.sheetnames else wb.sheetnames[-1]
        ws = wb[sheet_name]
        cards = []
        for row in ws.iter_rows(min_row=2, values_only=True):
            row = (list(row) + [""] * 8)[:8]
            num, cat, eng, indo, malay, contoh_id, _, eng_ex = row
            if not eng:
                continue
            cards.append({
                "num":     int(num) if num else 0,
                "indo":    str(indo    or ""),
                "malay":   str(malay   or ""),
                "english": str(eng     or ""),
                "cat":     str(cat     or "General"),
                "contoh":  str(contoh_id or ""),
                "eng_ex":  str(eng_ex  or ""),
            })
    wb.close()
    print(f"  Loaded {len(cards)} Bahasa cards")
    return cards


def _load_viet():
    src = BASE / "vietnamese" / "viet_vocab_COMPLETE_1962words.xlsx"
    print(f"Loading Viet vocab from {src}…")
    wb = openpyxl.load_workbook(src, read_only=True, data_only=True)
    ws = wb.active
    cards = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        row = (list(row) + [""] * 9)[:9]
        num, cat, part, english, viet, hanzi, cantonese, notes, _ = row
        if not viet:
            continue
        cards.append({
            "num":       int(num) if num else 0,
            "cat":       str(cat       or "General"),
            "part":      str(part      or ""),
            "english":   str(english   or ""),
            "viet":      str(viet      or ""),
            "hanzi":     str(hanzi     or ""),
            "cantonese": str(cantonese or ""),
            "notes":     str(notes     or ""),
        })
    wb.close()
    print(f"  Loaded {len(cards)} Viet cards")
    return cards


def _load_spanish():
    src = BASE / "spanish" / "spanish_vocab_3000words.xlsx"
    if not src.exists():
        print(f"WARNING: {src} not found — Spanish will return empty vocab")
        return []
    print(f"Loading Spanish vocab from {src}…")
    wb = openpyxl.load_workbook(src, read_only=True, data_only=True)
    ws = wb.active
    cards = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        row = (list(row) + [""] * 8)[:8]
        num, cat, english, spanish, gender, notes, example_es, example_en = row
        if not spanish:
            continue
        cards.append({
            "num":        int(num) if num else 0,
            "cat":        str(cat        or "General"),
            "english":    str(english    or ""),
            "spanish":    str(spanish    or ""),
            "gender":     str(gender     or "-"),
            "notes":      str(notes      or ""),
            "example_es": str(example_es or ""),
            "example_en": str(example_en or ""),
        })
    wb.close()
    print(f"  Loaded {len(cards)} Spanish cards")
    return cards


# ── Cache vocab at startup ────────────────────────────────────────────────────
BAHASA_CARDS  = _load_bahasa()
VIET_CARDS    = _load_viet()
SPANISH_CARDS = _load_spanish()

# ── Vocab API routes ──────────────────────────────────────────────────────────
@app.route("/api/vocab/bahasa")
def api_bahasa():
    return jsonify(BAHASA_CARDS)

@app.route("/api/vocab/viet")
def api_viet():
    return jsonify(VIET_CARDS)

@app.route("/api/vocab/spanish")
def api_spanish():
    return jsonify(SPANISH_CARDS)

# ── Page routes ───────────────────────────────────────────────────────────────
@app.route("/")
def home():
    return render_template("index.html")

@app.route("/bahasa")
def bahasa():
    return render_template("bahasa.html")

@app.route("/viet")
def viet():
    return render_template("viet.html")

@app.route("/spanish")
def spanish():
    return render_template("spanish.html")

# ── Run ───────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
```

**Step 2: Commit**

```bash
git add app.py
git commit -m "feat: add root monorepo Flask app serving all 3 language APIs"
```

---

### Task 8: Create root `requirements.txt` and `render.yaml`

**Files:**
- Create: `requirements.txt`
- Create: `render.yaml`

**Step 1: Create `requirements.txt`**

```
flask==3.1.0
openpyxl==3.1.5
gunicorn==23.0.0
```

**Step 2: Create `render.yaml`**

```yaml
services:
  - type: web
    name: language-anki
    runtime: python
    buildCommand: pip install -r requirements.txt
    startCommand: gunicorn app:app
    plan: free
    envVars:
      - key: PYTHON_VERSION
        value: "3.11.0"
```

**Step 3: Commit**

```bash
git add requirements.txt render.yaml
git commit -m "chore: add root requirements.txt and Render deploy config"
```

---

### Task 9: Local verification

**Step 1: Check the viet xlsx column layout**

The `_load_viet` function assumes columns: `num, cat, part, english, viet, hanzi, cantonese, notes, ...`

Verify this matches the actual file:

```python
import openpyxl
wb = openpyxl.load_workbook("vietnamese/viet_vocab_COMPLETE_1962words.xlsx", read_only=True, data_only=True)
ws = wb.active
headers = [cell.value for cell in next(ws.iter_rows(min_row=1, max_row=1))]
print(headers)
sample  = list(ws.iter_rows(min_row=2, max_row=3, values_only=True))
print(sample)
wb.close()
```

If the columns differ, update the unpacking line in `_load_viet` to match. Adjust the `cards.append(...)` dict keys accordingly. The `templates/viet.html` LANG_CONFIG uses `card.viet`, `card.hanzi`, `card.cantonese`, `card.notes`, `card.part` — make sure these match.

**Step 2: Run the app**

```bash
cd /Users/wongshennan/Documents/personal/languages
pip install flask openpyxl gunicorn
python3 app.py
```

Expected output:
```
Loading Bahasa vocab from …/indonesian/Bahasa_Vocab.xlsm…
  Loaded 2000 Bahasa cards
Loading Viet vocab from …/vietnamese/viet_vocab_COMPLETE_1962words.xlsx…
  Loaded 1962 Viet cards
Loading Spanish vocab from …/spanish/spanish_vocab_3000words.xlsx…
  Loaded 3000 Spanish cards   (or WARNING if xlsx not built yet)
 * Running on http://0.0.0.0:5000
```

**Step 3: Smoke test each app**

Open in browser:
- `http://localhost:5000` — landing page shows 3 language cards
- `http://localhost:5000/bahasa` — home screen shows card counts, Start Session works, ratings save to localStorage
- `http://localhost:5000/viet` — same; Part filter appears; Cantonese button appears when hanzi present; `C` key triggers cantonese TTS
- `http://localhost:5000/spanish` — same; gender badge appears; notes row appears; progress bar is gold

**Step 4: Test localStorage isolation**

Open bahasa, rate a card. Open viet in a new tab. Check DevTools → Application → localStorage: there should be separate `bahasa_progress` and `viet_progress` keys.

**Step 5: Commit**

```bash
git add -A
git commit -m "chore: verify monorepo works locally"
```

---

### Task 10: Push and deploy

**Step 1: Push**

```bash
cd /Users/wongshennan/Documents/personal/languages
git push origin main
```

**Step 2: Deploy on Render**

- render.com → New → Web Service → select this repo
- Root Directory: leave blank (uses repo root)
- Build Command: `pip install -r requirements.txt`
- Start Command: `gunicorn app:app`
- Plan: Free
- Click Deploy

**Step 3: Verify**

Once build completes (~2 min), open the Render URL:
- `/` — landing page
- `/bahasa`, `/viet`, `/spanish` — each loads, cards work, TTS works

---

## Notes for future language additions

To add a new language (e.g. French):
1. Add vocab xlsx to `french/` folder
2. Add `_load_french()` + `/api/vocab/french` route in `app.py`
3. Create `templates/french.html` with its `LANG_CONFIG` (~80 lines)
4. Add a card to `templates/index.html`

No changes to `shared.css` or `shared.js` needed.
