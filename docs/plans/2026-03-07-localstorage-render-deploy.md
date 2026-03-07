# localStorage + Render Deployment Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Move all SM-2 progress logic from Flask backend to browser localStorage, replace macOS-only TTS with Web Speech API, and add Render deployment config for both apps.

**Architecture:** Backend becomes a pure vocab-serving API (`GET /api/vocab` returns all cards as JSON). All SRS logic (SM-2, queue building, overview stats) runs in the browser JS using localStorage as the persistence layer. TTS uses `speechSynthesis` (Web Speech API) — no backend call needed.

**Tech Stack:** Python 3 / Flask / openpyxl / gunicorn, vanilla JS, Web Speech API, Render (free tier)

---

## Shared JS snippets (reference for Tasks 1 & 4)

These go into the `<script>` block of each app's `HTML_PAGE`.

### localStorage helpers
```javascript
const STORAGE_KEY = "bahasa_progress"; // or "viet_progress"
function loadProgress() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
}
function saveProgress(p) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}
```

### SM-2 in JS
```javascript
function sm2Update(pd, rating) {
  let interval = pd.interval || 0;
  let ef       = pd.ef       || 2.5;
  let reps     = pd.reps     || 0;
  const grade  = {1:1, 2:3, 3:4, 4:5}[rating];
  if (grade < 3) { reps = 0; interval = 1; }
  else {
    if (reps === 0)      interval = 1;
    else if (reps === 1) interval = 6;
    else                 interval = Math.round(interval * ef);
    reps++;
  }
  ef = ef + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
  ef = Math.max(1.3, Math.min(5.0, ef));
  return {
    ...pd,
    interval,
    ef: Math.round(ef * 100) / 100,
    reps,
    next_review: new Date(Date.now() + interval * 86400000).toISOString(),
    correct: (pd.correct || 0) + (grade >= 3 ? 1 : 0),
    wrong:   (pd.wrong   || 0) + (grade <  3 ? 1 : 0),
  };
}
function isDue(pd) {
  if (!pd || !pd.next_review) return true;
  return new Date(pd.next_review) <= new Date();
}
function cardStage(pd) {
  const intv = pd ? (pd.interval || 0) : 0;
  if (intv === 0)  return "new";
  if (intv < 7)    return "learning";
  if (intv < 21)   return "review";
  return "mature";
}
```

### Web Speech API TTS
```javascript
// Bahasa version
function callPronounce(text, lang) {
  if (!window.speechSynthesis) return;
  const clean = text.split("(")[0].replace(/['"\/]/g, "").trim();
  if (!clean) return;
  const utt = new SpeechSynthesisUtterance(clean);
  utt.lang = lang === "id" ? "id-ID" : "en-US";
  speechSynthesis.cancel();
  speechSynthesis.speak(utt);
}

// Viet version (3 langs)
function callPronounce(text, lang) {
  if (!window.speechSynthesis) return;
  const clean = text.trim();
  if (!clean) return;
  const utt = new SpeechSynthesisUtterance(clean);
  utt.lang = lang === "vi" ? "vi-VN" : lang === "yue" ? "zh-HK" : "en-US";
  speechSynthesis.cancel();
  speechSynthesis.speak(utt);
}
```

---

### Task 1: Refactor `bahasa_anki.py` — backend

**Files:**
- Modify: `indonesian/bahasa_anki.py`

**Step 1: Strip unused imports**

At the top of the file, change:
```python
import json, random, subprocess, threading, os
from datetime import datetime, timedelta
from pathlib import Path
from urllib.parse import quote
from flask import Flask, jsonify, request, send_from_directory
import openpyxl
```
To:
```python
import random
from pathlib import Path
from flask import Flask, jsonify, request
import openpyxl
```

**Step 2: Remove progress/SRS/TTS Python code**

Delete these functions entirely:
- `load_progress()` (lines ~74-78)
- `save_progress()` (lines ~80-82)
- `sm2_update()` (lines ~85-113)
- `is_due()` (lines ~115-119)
- `card_stage()` (lines ~121-126)
- `pronounce()` / `callPronounce()` (lines ~128-143)

Also delete `PROGRESS_JSON = BASE / "anki_progress.json"` from the Paths section.

**Step 3: Replace all API routes with a single `/api/vocab` endpoint**

Delete these routes:
- `api_categories()`
- `api_overview()`
- `api_queue()`
- `api_card()`
- `api_rate()`
- `api_pronounce()`
- `api_stats_categories()`

Replace with:
```python
@app.route("/api/vocab")
def api_vocab():
    return jsonify(ALL_CARDS)
```

**Step 4: Keep only the SPA route**
```python
@app.route("/")
def index():
    return HTML_PAGE
```

**Step 5: Update `__main__` block**

Change port from 5001 to 5000 and remove `webbrowser` import:
```python
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
```

---

### Task 2: Refactor `bahasa_anki.py` — frontend JS

**Files:**
- Modify: `indonesian/bahasa_anki.py` (the `HTML_PAGE` string, `<script>` section)

The entire `<script>` block (lines ~588–839) needs to be replaced. Keep all the HTML/CSS unchanged — only the JS changes.

**Step 1: Replace the `<script>` block with this:**

```javascript
<script>
// ── Config ─────────────────────────────────────────────────────────────────
const STORAGE_KEY = "bahasa_progress";
let mode        = "id_en";
let allCards    = [];
let queue       = [];
let qpos        = 0;
let curCard     = null;
let answerShown = false;
let sessCorr    = 0;
let sessWrong   = 0;

// ── localStorage ───────────────────────────────────────────────────────────
function loadProgress() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
}
function saveProgress(p) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(p));
}

// ── SM-2 ───────────────────────────────────────────────────────────────────
function sm2Update(pd, rating) {
  let interval = pd.interval || 0;
  let ef       = pd.ef       || 2.5;
  let reps     = pd.reps     || 0;
  const grade  = {1:1, 2:3, 3:4, 4:5}[rating];
  if (grade < 3) { reps = 0; interval = 1; }
  else {
    if (reps === 0)      interval = 1;
    else if (reps === 1) interval = 6;
    else                 interval = Math.round(interval * ef);
    reps++;
  }
  ef = ef + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
  ef = Math.max(1.3, Math.min(5.0, ef));
  return {
    ...pd,
    interval,
    ef: Math.round(ef * 100) / 100,
    reps,
    next_review: new Date(Date.now() + interval * 86400000).toISOString(),
    correct: (pd.correct || 0) + (grade >= 3 ? 1 : 0),
    wrong:   (pd.wrong   || 0) + (grade <  3 ? 1 : 0),
  };
}
function isDue(pd) {
  if (!pd || !pd.next_review) return true;
  return new Date(pd.next_review) <= new Date();
}
function cardStage(pd) {
  const intv = pd ? (pd.interval || 0) : 0;
  if (intv === 0)  return "new";
  if (intv < 7)    return "learning";
  if (intv < 21)   return "review";
  return "mature";
}

// ── TTS (Web Speech API) ────────────────────────────────────────────────────
function callPronounce(text, lang) {
  if (!window.speechSynthesis) return;
  const clean = text.split("(")[0].replace(/['"\/]/g, "").trim();
  if (!clean) return;
  const utt = new SpeechSynthesisUtterance(clean);
  utt.lang = lang === "id" ? "id-ID" : "en-US";
  speechSynthesis.cancel();
  speechSynthesis.speak(utt);
}

// ── Overview (client-side) ─────────────────────────────────────────────────
function computeOverview() {
  const p = loadProgress();
  let newC = 0, lrn = 0, review = 0, mature = 0, due = 0, cor = 0, wrg = 0;
  for (const c of allCards) {
    const pd = p[String(c.num)] || {};
    const stage = cardStage(pd);
    if (stage === "new")      newC++;
    else if (stage === "learning") lrn++;
    else if (stage === "review")   review++;
    else                           mature++;
    if (isDue(pd)) due++;
    cor += pd.correct || 0;
    wrg += pd.wrong   || 0;
  }
  return { total: allCards.length, new: newC, learning: lrn, review, mature, due,
           correct: cor, wrong: wrg,
           accuracy: (cor + wrg) ? Math.round(100 * cor / (cor + wrg)) : 0 };
}

function refreshOverview() {
  const ov = computeOverview();
  document.getElementById("ov-due").textContent    = ov.due;
  document.getElementById("ov-new").textContent    = ov.new;
  document.getElementById("ov-learn").textContent  = ov.learning + ov.review;
  document.getElementById("ov-mature").textContent = ov.mature;
}

// ── Category stats (client-side) ──────────────────────────────────────────
function computeCatStats() {
  const p = loadProgress();
  const cats = {};
  for (const c of allCards) {
    const pd    = p[String(c.num)] || {};
    const cat   = c.cat;
    const stage = cardStage(pd);
    if (!cats[cat]) cats[cat] = { total:0, new:0, learning:0, review:0, mature:0, due:0 };
    cats[cat].total++;
    cats[cat][stage]++;
    if (isDue(pd)) cats[cat].due++;
  }
  return cats;
}

// ── Init ───────────────────────────────────────────────────────────────────
async function init() {
  allCards = await fetch("/api/vocab").then(r => r.json());
  const cats = [...new Set(allCards.map(c => c.cat))].sort();
  const sel = document.getElementById("cat-select");
  sel.innerHTML = '<option value="All">All categories</option>' +
    cats.map(c => `<option>${c}</option>`).join("");
  refreshOverview();
  showScreen("home");
}

// ── Screen helpers ─────────────────────────────────────────────────────────
function showScreen(name) {
  document.getElementById("welcome").style.display     = name === "home" ? "block" : "none";
  document.getElementById("card-wrap").style.display   = name === "card" ? "block" : "none";
  document.getElementById("session-end").style.display = name === "end"  ? "block" : "none";
}
function goHome() { showScreen("home"); refreshOverview(); setProg(0, "Ready", 0, 0); }

// ── Session ────────────────────────────────────────────────────────────────
function startSession() {
  const cat = document.getElementById("cat-select").value;
  const p   = loadProgress();
  const candidates = allCards.filter(c =>
    (cat === "All" || c.cat === cat) && isDue(p[String(c.num)] || {})
  );
  // shuffle
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  queue     = candidates.map(c => c.num);
  qpos      = 0;
  sessCorr  = 0;
  sessWrong = 0;
  if (queue.length === 0) {
    alert("All caught up! No cards due right now.\nCheck back later or choose a different category.");
    return;
  }
  showScreen("card");
  nextCard();
}

function nextCard() {
  if (qpos >= queue.length) { sessionEnd(); return; }
  const num  = queue[qpos];
  const card = allCards.find(c => c.num === num);
  const p    = loadProgress();
  const pd   = p[String(num)] || {};
  curCard     = { ...card, stage: cardStage(pd), interval: pd.interval || 0,
                  ef: pd.ef || 2.5, reps: pd.reps || 0,
                  correct: pd.correct || 0, wrong: pd.wrong || 0 };
  answerShown = false;

  document.getElementById("card-cat").textContent = card.cat;
  const badgeMap = { new:"badge-new", learning:"badge-learning", review:"badge-review", mature:"badge-mature" };
  const badgeTxt = { new:"New", learning:"Learning", review:"Review", mature:"Mature" };
  const badge = document.getElementById("card-badge");
  badge.className   = "card-badge " + (badgeMap[curCard.stage] || "badge-new");
  badge.textContent = (badgeTxt[curCard.stage] || "New") +
    (curCard.interval > 0 ? `  (${curCard.interval}d)` : "");

  if (mode === "id_en") {
    document.getElementById("card-dir").textContent = "Indonesian  →  English";
    document.getElementById("card-q").textContent   = card.indo;
    callPronounce(card.indo, "id");
  } else {
    document.getElementById("card-dir").textContent = "English  →  Indonesian + Malay";
    document.getElementById("card-q").textContent   = card.english;
  }

  document.getElementById("answer-area").style.display  = "none";
  document.getElementById("btn-show").style.display      = "block";
  document.getElementById("rating-area").style.display   = "none";
  setProg(qpos / queue.length * 100,
    `Card ${qpos+1}/${queue.length}   Correct: ${sessCorr}   Wrong: ${sessWrong}`,
    sessCorr, sessWrong);
}

function showAnswer() {
  if (!curCard || answerShown) return;
  answerShown = true;
  const c = curCard;
  let ansWord, malay;
  if (mode === "id_en") {
    ansWord = c.english;
    malay   = c.malay ? `Malay: ${c.malay}` : "";
  } else {
    ansWord = c.indo;
    malay   = c.malay ? `Malay: ${c.malay}` : "";
  }
  document.getElementById("ans-word").textContent  = ansWord;
  document.getElementById("ans-malay").textContent = malay;
  const ctEl = document.getElementById("ans-contoh");
  const exEl = document.getElementById("ans-eng-ex");
  if (c.contoh && c.contoh !== "None") {
    ctEl.textContent = "  " + c.contoh; ctEl.style.display = "block";
  } else { ctEl.style.display = "none"; }
  if (c.eng_ex && c.eng_ex !== "None") {
    exEl.textContent = "  " + c.eng_ex; exEl.style.display = "block";
  } else { exEl.style.display = "none"; }
  document.getElementById("answer-area").style.display = "block";
  document.getElementById("btn-show").style.display    = "none";
  document.getElementById("rating-area").style.display = "block";
  if (mode === "en_id") callPronounce(c.indo, "id");
}

function rate(rating) {
  if (!answerShown || !curCard) return;
  const p  = loadProgress();
  const pd = p[String(curCard.num)] || {};
  p[String(curCard.num)] = sm2Update(pd, rating);
  saveProgress(p);
  if (rating === 1) {
    const insertAt = Math.min(qpos + 2 + Math.floor(Math.random() * 3), queue.length);
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
  const total = sessCorr + sessWrong;
  const acc   = total ? Math.round(100 * sessCorr / total) : 0;
  document.getElementById("end-cor").textContent = sessCorr;
  document.getElementById("end-wrg").textContent = sessWrong;
  document.getElementById("end-acc").textContent = acc + "%";
  document.getElementById("end-sub").textContent = `${total} cards reviewed. Press Start to go again.`;
  setProg(100, `Done! ${acc}% accuracy`, sessCorr, sessWrong);
  refreshOverview();
}

// ── Pronounce ──────────────────────────────────────────────────────────────
function pronounce() {
  if (!curCard) return;
  callPronounce(curCard.indo, "id");
}

// ── Mode ───────────────────────────────────────────────────────────────────
function setMode(m) {
  mode = m;
  document.getElementById("btn-id-en").classList.toggle("active", m === "id_en");
  document.getElementById("btn-en-id").classList.toggle("active", m === "en_id");
}

// ── Progress bar ───────────────────────────────────────────────────────────
function setProg(pct, label, cor, wrg) {
  document.getElementById("prog-bar").style.width    = pct + "%";
  document.getElementById("prog-label").textContent  = label;
  document.getElementById("streak").textContent      = cor > 0 ? `${cor}` : "";
}

// ── Stats modal ────────────────────────────────────────────────────────────
function openStats() {
  document.getElementById("modal-overlay").classList.add("open");
  const ov   = computeOverview();
  const cats = computeCatStats();
  let html = `
    <div class="overview-grid">
      <div class="ov-box"><div class="n" style="color:var(--orange)">${ov.due}</div><div class="l">Due Today</div></div>
      <div class="ov-box"><div class="n">${ov.total}</div><div class="l">Total Cards</div></div>
      <div class="ov-box"><div class="n" style="color:var(--blue)">${ov.new}</div><div class="l">New</div></div>
      <div class="ov-box"><div class="n" style="color:var(--amber)">${ov.learning + ov.review}</div><div class="l">Learning</div></div>
      <div class="ov-box"><div class="n" style="color:var(--green)">${ov.mature}</div><div class="l">Mature</div></div>
      <div class="ov-box"><div class="n">${ov.accuracy}%</div><div class="l">Accuracy</div></div>
    </div>
    <h4 style="color:var(--navy);margin-bottom:8px;">Progress by Category</h4>
    <table class="cat-table">
      <thead><tr><th>Category</th><th>Total</th><th>Mature</th><th>Due</th></tr></thead>
      <tbody>`;
  for (const [cat, s] of Object.entries(cats).sort()) {
    const pct = s.total ? Math.round(100 * s.mature / s.total) : 0;
    html += `<tr>
      <td>${cat}</td><td>${s.total}</td>
      <td><div>${s.mature} (${pct}%)</div>
          <div class="pct-bar"><div class="pct-fill" style="width:${pct}%"></div></div></td>
      <td style="color:${s.due > 0 ? 'var(--orange)' : 'var(--dgrey)'};font-weight:${s.due>0?700:400}">${s.due || '—'}</td>
    </tr>`;
  }
  html += "</tbody></table>";
  document.getElementById("modal-body").innerHTML = html;
}
function closeStats() {
  document.getElementById("modal-overlay").classList.remove("open");
}

// ── Keyboard shortcuts ─────────────────────────────────────────────────────
document.addEventListener("keydown", e => {
  if (e.target.tagName === "SELECT") return;
  if (e.key === " " || e.key === "Spacebar") { e.preventDefault(); showAnswer(); }
  if (e.key === "1") rate(1);
  if (e.key === "2") rate(2);
  if (e.key === "3") rate(3);
  if (e.key === "4") rate(4);
  if (e.key === "p" || e.key === "P") pronounce();
  if (e.key === "Enter" && document.getElementById("welcome").style.display !== "none") startSession();
  if (e.key === "Escape") closeStats();
});

init();
</script>
```

**Step 2: Verify the app works locally**

```bash
cd indonesian
python3 bahasa_anki.py
# Open http://localhost:5000
# Check: home screen loads with card counts
# Check: Start Session works, cards show, rating saves to localStorage
# Check: Stats modal shows correct counts
# Check: Pronounce button speaks Indonesian (may need to allow browser speech)
```

**Step 3: Commit**
```bash
git add indonesian/bahasa_anki.py
git commit -m "feat: bahasa - move SM2/progress to localStorage, Web Speech API TTS"
```

---

### Task 3: Add Bahasa deployment files

**Files:**
- Create: `indonesian/requirements.txt`
- Create: `indonesian/render.yaml`

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
    name: bahasa-anki
    runtime: python
    rootDir: indonesian
    buildCommand: pip install -r requirements.txt
    startCommand: gunicorn bahasa_anki:app
    plan: free
    envVars:
      - key: PYTHON_VERSION
        value: 3.11.0
```

**Step 3: Commit**
```bash
git add indonesian/requirements.txt indonesian/render.yaml
git commit -m "chore: add bahasa Render deployment config"
```

---

### Task 4: Refactor `viet_anki.py` — backend

**Files:**
- Modify: `vietnamese/viet_anki.py`

**Step 1: Strip unused imports**

Change:
```python
import json, random, subprocess, threading, tempfile, os
from datetime import datetime, timedelta
from pathlib import Path
from flask import Flask, jsonify, request
import openpyxl
from gtts import gTTS
```
To:
```python
import random
from pathlib import Path
from flask import Flask, jsonify, request
import openpyxl
```

**Step 2: Remove progress/SRS/TTS Python code**

Delete these functions:
- `load_progress()` (lines ~51-55)
- `save_progress()` (lines ~57-59)
- `sm2_update()` (lines ~62-90)
- `is_due()` (lines ~92-96)
- `card_stage()` (lines ~98-103)
- `pronounce()` and the threading TTS block (lines ~106-127)

Also delete `PROGRESS_JSON = BASE / "viet_progress.json"` from Paths section.

**Step 3: Replace all API routes with `/api/vocab`**

Delete: `api_categories()`, `api_overview()`, `api_queue()`, `api_card()`, `api_rate()`, `api_pronounce()`, `api_stats_categories()`

Replace with:
```python
@app.route("/api/vocab")
def api_vocab():
    return jsonify(ALL_CARDS)
```

Keep only the SPA route:
```python
@app.route("/")
def index():
    return HTML_PAGE
```

**Step 4: Update `__main__`**
```python
if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
```

---

### Task 5: Refactor `viet_anki.py` — frontend JS

**Files:**
- Modify: `vietnamese/viet_anki.py` (the `HTML_PAGE` string, `<script>` section)

Replace the entire `<script>` block (lines ~534-765) with:

```javascript
<script>
const STORAGE_KEY = "viet_progress";
let mode        = "vi_en";
let allCards    = [];
let queue       = [];
let qpos        = 0;
let curCard     = null;
let answerShown = false;
let sessCorr    = 0;
let sessWrong   = 0;

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
}
function saveProgress(p) { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); }

function sm2Update(pd, rating) {
  let interval = pd.interval || 0;
  let ef       = pd.ef       || 2.5;
  let reps     = pd.reps     || 0;
  const grade  = {1:1, 2:3, 3:4, 4:5}[rating];
  if (grade < 3) { reps = 0; interval = 1; }
  else {
    if (reps === 0)      interval = 1;
    else if (reps === 1) interval = 6;
    else                 interval = Math.round(interval * ef);
    reps++;
  }
  ef = ef + (0.1 - (5 - grade) * (0.08 + (5 - grade) * 0.02));
  ef = Math.max(1.3, Math.min(5.0, ef));
  return {
    ...pd, interval, ef: Math.round(ef * 100) / 100, reps,
    next_review: new Date(Date.now() + interval * 86400000).toISOString(),
    correct: (pd.correct || 0) + (grade >= 3 ? 1 : 0),
    wrong:   (pd.wrong   || 0) + (grade <  3 ? 1 : 0),
  };
}
function isDue(pd) {
  if (!pd || !pd.next_review) return true;
  return new Date(pd.next_review) <= new Date();
}
function cardStage(pd) {
  const intv = pd ? (pd.interval || 0) : 0;
  if (intv === 0)  return "new";
  if (intv < 7)    return "learning";
  if (intv < 21)   return "review";
  return "mature";
}

function callPronounce(text, lang) {
  if (!window.speechSynthesis) return;
  const clean = text.trim();
  if (!clean) return;
  const utt  = new SpeechSynthesisUtterance(clean);
  utt.lang   = lang === "vi" ? "vi-VN" : lang === "yue" ? "zh-HK" : "en-US";
  speechSynthesis.cancel();
  speechSynthesis.speak(utt);
}

function computeOverview() {
  const p = loadProgress();
  let newC = 0, lrn = 0, review = 0, mature = 0, due = 0, cor = 0, wrg = 0;
  for (const c of allCards) {
    const pd = p[String(c.num)] || {};
    const stage = cardStage(pd);
    if (stage === "new")           newC++;
    else if (stage === "learning") lrn++;
    else if (stage === "review")   review++;
    else                           mature++;
    if (isDue(pd)) due++;
    cor += pd.correct || 0;
    wrg += pd.wrong   || 0;
  }
  return { total: allCards.length, new: newC, learning: lrn, review, mature, due,
           correct: cor, wrong: wrg,
           accuracy: (cor + wrg) ? Math.round(100 * cor / (cor + wrg)) : 0 };
}
function refreshOverview() {
  const ov = computeOverview();
  document.getElementById("ov-due").textContent    = ov.due;
  document.getElementById("ov-new").textContent    = ov.new;
  document.getElementById("ov-learn").textContent  = ov.learning + ov.review;
  document.getElementById("ov-mature").textContent = ov.mature;
}
function computeCatStats() {
  const p = loadProgress();
  const cats = {};
  for (const c of allCards) {
    const pd = p[String(c.num)] || {};
    const cat = c.cat;
    const stage = cardStage(pd);
    if (!cats[cat]) cats[cat] = { total:0, new:0, learning:0, review:0, mature:0, due:0 };
    cats[cat].total++;
    cats[cat][stage]++;
    if (isDue(pd)) cats[cat].due++;
  }
  return cats;
}

async function init() {
  allCards = await fetch("/api/vocab").then(r => r.json());
  const cats  = [...new Set(allCards.map(c => c.cat))].sort();
  const parts = [...new Set(allCards.map(c => c.part))].sort();
  document.getElementById("cat-select").innerHTML =
    '<option value="All">All categories</option>' + cats.map(c => `<option>${c}</option>`).join("");
  document.getElementById("part-select").innerHTML =
    '<option value="All">All parts</option>' + parts.map(p => `<option>${p}</option>`).join("");
  refreshOverview();
  showScreen("home");
}

function showScreen(name) {
  document.getElementById("welcome").style.display     = name === "home" ? "block" : "none";
  document.getElementById("card-wrap").style.display   = name === "card" ? "block" : "none";
  document.getElementById("session-end").style.display = name === "end"  ? "block" : "none";
}
function goHome() { showScreen("home"); refreshOverview(); setProg(0, "Ready", 0, 0); }

function startSession() {
  const cat  = document.getElementById("cat-select").value;
  const part = document.getElementById("part-select").value;
  const p    = loadProgress();
  const candidates = allCards.filter(c =>
    (cat  === "All" || c.cat  === cat) &&
    (part === "All" || c.part === part) &&
    isDue(p[String(c.num)] || {})
  );
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  queue     = candidates.map(c => c.num);
  qpos      = 0; sessCorr = 0; sessWrong = 0;
  if (queue.length === 0) {
    alert("All caught up! No cards due right now.\nTry a different category or part.");
    return;
  }
  showScreen("card");
  nextCard();
}

function nextCard() {
  if (qpos >= queue.length) { sessionEnd(); return; }
  const num  = queue[qpos];
  const card = allCards.find(c => c.num === num);
  const p    = loadProgress();
  const pd   = p[String(num)] || {};
  curCard     = { ...card, stage: cardStage(pd), interval: pd.interval || 0 };
  answerShown = false;

  document.getElementById("card-cat").textContent  = card.cat;
  document.getElementById("card-part").textContent = " · " + card.part;
  const badgeMap = { new:"badge-new", learning:"badge-learning", review:"badge-review", mature:"badge-mature" };
  const badgeTxt = { new:"New", learning:"Learning", review:"Review", mature:"Mature" };
  const badge = document.getElementById("card-badge");
  badge.className   = "card-badge " + (badgeMap[curCard.stage] || "badge-new");
  badge.textContent = (badgeTxt[curCard.stage] || "New") +
    (curCard.interval > 0 ? `  (${curCard.interval}d)` : "");

  if (mode === "vi_en") {
    document.getElementById("card-dir").textContent = "Vietnamese  →  English";
    document.getElementById("card-q").textContent   = card.viet;
    callPronounce(card.viet, "vi");
  } else {
    document.getElementById("card-dir").textContent = "English  →  Vietnamese";
    document.getElementById("card-q").textContent   = card.english;
  }

  document.getElementById("q-hanzi").textContent     = card.hanzi || "";
  document.getElementById("q-cantonese").textContent = card.cantonese ? `: ${card.cantonese}` : "";
  document.getElementById("hanzi-row").style.display           = "none";
  document.getElementById("btn-pronounce-canto").style.display = "none";
  document.getElementById("answer-area").style.display         = "none";
  document.getElementById("btn-show").style.display            = "block";
  document.getElementById("rating-area").style.display         = "none";
  setProg(qpos / queue.length * 100,
    `Card ${qpos+1}/${queue.length}   Correct: ${sessCorr}   Wrong: ${sessWrong}`,
    sessCorr, sessWrong);
}

function showAnswer() {
  if (!curCard || answerShown) return;
  answerShown = true;
  const c = curCard;
  document.getElementById("ans-english").textContent = mode === "vi_en" ? c.english : c.viet;
  if (c.hanzi) {
    document.getElementById("hanzi-row").style.display           = "flex";
    document.getElementById("btn-pronounce-canto").style.display = "block";
  }
  const notesEl = document.getElementById("ans-notes");
  if (c.notes && c.notes !== "None") {
    notesEl.textContent = " " + c.notes; notesEl.style.display = "block";
  } else { notesEl.style.display = "none"; }
  document.getElementById("answer-area").style.display = "block";
  document.getElementById("btn-show").style.display    = "none";
  document.getElementById("rating-area").style.display = "block";
  if (mode === "en_vi") callPronounce(c.viet, "vi");
}

function rate(rating) {
  if (!answerShown || !curCard) return;
  const p  = loadProgress();
  const pd = p[String(curCard.num)] || {};
  p[String(curCard.num)] = sm2Update(pd, rating);
  saveProgress(p);
  if (rating === 1) {
    queue.splice(Math.min(qpos + 2 + Math.floor(Math.random() * 3), queue.length), 0, curCard.num);
    sessWrong++;
  } else if (rating === 2) { sessWrong++;
  } else { sessCorr++; }
  qpos++;
  nextCard();
}

function sessionEnd() {
  showScreen("end");
  const total = sessCorr + sessWrong;
  const acc   = total ? Math.round(100 * sessCorr / total) : 0;
  document.getElementById("end-cor").textContent = sessCorr;
  document.getElementById("end-wrg").textContent = sessWrong;
  document.getElementById("end-acc").textContent = acc + "%";
  document.getElementById("end-sub").textContent = `${total} cards reviewed. Press Start to go again.`;
  setProg(100, `Done! ${acc}% accuracy`, sessCorr, sessWrong);
  refreshOverview();
}

function pronounceViet()  { if (curCard) callPronounce(curCard.viet,  "vi");  }
function pronounceCanto() { if (curCard && curCard.hanzi) callPronounce(curCard.hanzi, "yue"); }

function setMode(m) {
  mode = m;
  document.getElementById("btn-vi-en").classList.toggle("active", m === "vi_en");
  document.getElementById("btn-en-vi").classList.toggle("active", m === "en_vi");
}
function setProg(pct, label, cor, wrg) {
  document.getElementById("prog-bar").style.width   = pct + "%";
  document.getElementById("prog-label").textContent = label;
  document.getElementById("streak").textContent     = cor > 0 ? `${cor}` : "";
}

function openStats() {
  document.getElementById("modal-overlay").classList.add("open");
  const ov   = computeOverview();
  const cats = computeCatStats();
  let html = `
    <div class="overview-grid">
      <div class="ov-box"><div class="n" style="color:var(--amber)">${ov.due}</div><div class="l">Due Today</div></div>
      <div class="ov-box"><div class="n">${ov.total}</div><div class="l">Total</div></div>
      <div class="ov-box"><div class="n" style="color:var(--blue)">${ov.new}</div><div class="l">New</div></div>
      <div class="ov-box"><div class="n" style="color:var(--amber)">${ov.learning + ov.review}</div><div class="l">Learning</div></div>
      <div class="ov-box"><div class="n" style="color:var(--green)">${ov.mature}</div><div class="l">Mature</div></div>
      <div class="ov-box"><div class="n">${ov.accuracy}%</div><div class="l">Accuracy</div></div>
    </div>
    <h4 style="color:var(--dkred);margin-bottom:8px;">Progress by Category</h4>
    <table class="cat-table">
      <thead><tr><th>Category</th><th>Total</th><th>Mature</th><th>Due</th></tr></thead>
      <tbody>`;
  for (const [cat, s] of Object.entries(cats).sort()) {
    const pct = s.total ? Math.round(100 * s.mature / s.total) : 0;
    html += `<tr>
      <td>${cat}</td><td>${s.total}</td>
      <td><div>${s.mature} (${pct}%)</div>
          <div class="pct-bar"><div class="pct-fill" style="width:${pct}%"></div></div></td>
      <td style="color:${s.due > 0 ? 'var(--amber)' : 'var(--dgrey)'};font-weight:${s.due>0?700:400}">${s.due||'—'}</td>
    </tr>`;
  }
  html += "</tbody></table>";
  document.getElementById("modal-body").innerHTML = html;
}
function closeStats() { document.getElementById("modal-overlay").classList.remove("open"); }

document.addEventListener("keydown", e => {
  if (e.target.tagName === "SELECT") return;
  if (e.key === " " || e.key === "Spacebar") { e.preventDefault(); showAnswer(); }
  if (e.key === "1") rate(1);
  if (e.key === "2") rate(2);
  if (e.key === "3") rate(3);
  if (e.key === "4") rate(4);
  if (e.key === "p" || e.key === "P") pronounceViet();
  if (e.key === "c" || e.key === "C") pronounceCanto();
  if (e.key === "Enter" && document.getElementById("welcome").style.display !== "none") startSession();
  if (e.key === "Escape") closeStats();
});

init();
</script>
```

**Step 2: Verify locally**
```bash
cd vietnamese
python3 viet_anki.py
# Open http://localhost:5000
# Check: cards load, progress saves to localStorage, TTS speaks Vietnamese
```

**Step 3: Commit**
```bash
git add vietnamese/viet_anki.py
git commit -m "feat: viet - move SM2/progress to localStorage, Web Speech API TTS"
```

---

### Task 6: Add Vietnamese deployment files

**Files:**
- Create: `vietnamese/requirements.txt`
- Create: `vietnamese/render.yaml`

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
    name: viet-anki
    runtime: python
    rootDir: vietnamese
    buildCommand: pip install -r requirements.txt
    startCommand: gunicorn viet_anki:app
    plan: free
    envVars:
      - key: PYTHON_VERSION
        value: 3.11.0
```

**Step 3: Commit**
```bash
git add vietnamese/requirements.txt vietnamese/render.yaml
git commit -m "chore: add vietnamese Render deployment config"
```

---

### Task 7: Initialize git repo and push

**Step 1: Initialize repo (from project root)**
```bash
cd /Users/wongshennan/Documents/personal/languages
git init
```

**Step 2: Create `.gitignore`**
```
__pycache__/
*.pyc
.DS_Store
*.xlsm
anki_progress.json
viet_progress.json
```

Note: The `.xlsx` files ARE committed (they're the vocab data). The `.xlsm` and progress JSON files are excluded.

**Step 3: Initial commit**
```bash
git add .
git commit -m "chore: initial commit - bahasa and viet anki apps"
```

**Step 4: Push to GitHub**

Create a new private repo on GitHub (via browser), then:
```bash
git remote add origin git@github.com:YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

---

### Task 8: Deploy on Render

**Step 1: Connect repo**
- Go to render.com → New → Web Service
- Connect your GitHub account and select the private repo

**Step 2: Deploy Bahasa app**
- Root Directory: `indonesian`
- Build Command: `pip install -r requirements.txt`
- Start Command: `gunicorn bahasa_anki:app`
- Plan: Free

**Step 3: Deploy Viet app**
- New → Web Service → same repo
- Root Directory: `vietnamese`
- Build Command: `pip install -r requirements.txt`
- Start Command: `gunicorn viet_anki:app`
- Plan: Free

**Step 4: Verify both deployments**
- Wait for builds to complete (~2-3 min each)
- Open each Render URL, check home screen loads, start a session, rate a card
- Check that on page refresh, progress is still there (localStorage persists)
