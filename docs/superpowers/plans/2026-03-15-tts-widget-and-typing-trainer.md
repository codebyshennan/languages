# TTS Widget + Vietnamese Speed Typing Trainer Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a global TTS speak widget (press `/` or tap FAB → type any word → hear it) and a new `/viet/typing` page with Copy and Dictation modes for typing practice with running WPM + accuracy stats.

**Architecture:** The TTS widget is injected into every page via `shared.js`/`shared.css` — no new routes needed. The typing trainer is a standalone page (`viet_typing.html`) with its own inline script that fetches vocab from the existing `/api/vocab/viet` endpoint; it does NOT use `shared.js` (which assumes the Anki SRS engine).

**Tech Stack:** Python/Flask (route), vanilla JS (ES5 + one async/await for fetch), Web Speech API (speechSynthesis), localStorage-free (no persistence for typing scores).

---

## Chunk 1: TTS Speak Widget

### Task 1: TTS Widget — CSS

**Files:**
- Modify: `static/shared.css` (append to end of file)

- [ ] **Step 1: Append TTS widget styles to `static/shared.css`**

Add the following block to the very end of `static/shared.css`:

```css
/* ── TTS Speak Widget ──────────────────────────────────────────────────── */
#tts-overlay {
  display: none;
  position: fixed; inset: 0; z-index: 1000;
  background: rgba(0,0,0,0.55);
  align-items: center; justify-content: center;
}
#tts-overlay.open { display: flex; }
#tts-modal {
  background: #fff; border-radius: 12px;
  padding: 22px 24px; width: 380px; max-width: calc(100vw - 32px);
  box-shadow: 0 8px 32px rgba(0,0,0,0.28);
}
#tts-modal-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 14px;
}
#tts-modal-title { font-weight: 700; font-size: 15px; color: #333; }
#tts-lang-badge {
  font-size: 11px; color: var(--primary); background: var(--lgrey);
  padding: 2px 8px; border-radius: 4px; font-weight: 600;
}
#tts-input {
  width: 100%; padding: 10px 14px; font-size: 16px;
  border: 2px solid var(--primary); border-radius: 8px;
  outline: none; margin-bottom: 8px;
}
#tts-input:focus { box-shadow: 0 0 0 3px rgba(0,0,0,0.08); }
#tts-hint { font-size: 11px; color: #aaa; margin-bottom: 10px; }
#tts-error {
  font-size: 12px; color: var(--red); margin-bottom: 8px; display: none;
}
#tts-chips {
  display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px;
  padding-top: 10px; border-top: 1px solid #eee; min-height: 0;
}
.tts-chip {
  background: var(--lgrey); color: var(--primary);
  border: 1px solid #dce4ec; padding: 3px 10px;
  border-radius: 20px; font-size: 13px; cursor: pointer;
  transition: background 0.15s;
}
.tts-chip:hover { background: #e0e8f0; }
/* Floating speaker FAB — touch devices only */
#tts-fab {
  display: none;
  position: fixed; bottom: calc(16px + env(safe-area-inset-bottom));
  right: 16px; z-index: 200;
  width: 48px; height: 48px; border-radius: 50%;
  background: var(--primary); color: white;
  border: none; font-size: 20px; cursor: pointer;
  box-shadow: 0 4px 14px rgba(0,0,0,0.25);
  align-items: center; justify-content: center;
}
@media (hover: none) {
  #tts-fab { display: flex; }
}
```

- [ ] **Step 2: Verify styles load without breaking existing pages**

Open `http://localhost:5001/viet` in a browser. Confirm the page looks unchanged (no unexpected layout shifts or new elements visible yet). The `#tts-overlay` and `#tts-fab` don't appear until JS injects them.

- [ ] **Step 3: Commit**

```bash
git add static/shared.css
git commit -m "feat: add TTS widget CSS to shared styles"
```

---

### Task 2: TTS Widget — JavaScript

**Files:**
- Modify: `static/shared.js`

The TTS widget code goes **inside** the existing IIFE in `shared.js`. There are two edit locations:

1. **After** the existing `callPronounce` function (line ~147) — add TTS widget helpers + setup function.
2. **Inside** the existing `keydown` listener (line ~482) — add INPUT/TEXTAREA guard and `/` key handler.
3. **After** `init()` call at bottom (line ~532) — call `setupTTSWidget()`.

- [ ] **Step 1: Add TTS widget code after `callPronounce` in `shared.js`**

After the closing brace of `callPronounce` (the block ending around line 147), insert:

```javascript
// ── TTS Widget ─────────────────────────────────────────────────────────────
var _ttsRecent = [];     // last 5 spoken words (in-memory only)
var _ttsOpen   = false;

function _ttsDetectLang() {
  var p = window.location.pathname;
  if (p.indexOf('/viet')   !== -1) return 'vi-VN';
  if (p.indexOf('/bahasa') !== -1) return 'id-ID';
  if (p.indexOf('/spanish')!== -1) return 'es-ES';
  return 'en-US';
}

function _ttsRenderChips() {
  var el = document.getElementById('tts-chips');
  if (!el) return;
  el.innerHTML = _ttsRecent.map(function(w) {
    return '<span class="tts-chip" data-word="' + w.replace(/"/g,'&quot;') + '">' + w + '</span>';
  }).join('');
  el.querySelectorAll('.tts-chip').forEach(function(chip) {
    chip.addEventListener('click', function() {
      var word = chip.getAttribute('data-word');
      document.getElementById('tts-input').value = word;
      _ttsSpeak(word);
    });
  });
}

function _ttsSpeak(text) {
  if (!text || !text.trim()) return;
  var clean = text.trim();
  callPronounce(clean, _ttsDetectLang());
  _ttsRecent = _ttsRecent.filter(function(w) { return w !== clean; });
  _ttsRecent.unshift(clean);
  if (_ttsRecent.length > 5) _ttsRecent.pop();
  _ttsRenderChips();
}

function openTTSModal() {
  var overlay = document.getElementById('tts-overlay');
  if (!overlay) return;
  var errEl = document.getElementById('tts-error');
  if (errEl) errEl.style.display = window.speechSynthesis ? 'none' : 'block';
  var badge = document.getElementById('tts-lang-badge');
  if (badge) badge.textContent = _ttsDetectLang();
  _ttsRenderChips();
  overlay.classList.add('open');
  var inp = document.getElementById('tts-input');
  if (inp) { inp.value = ''; inp.focus(); }
  _ttsOpen = true;
}

function closeTTSModal() {
  var overlay = document.getElementById('tts-overlay');
  if (overlay) overlay.classList.remove('open');
  _ttsOpen = false;
}

function setupTTSWidget() {
  // Inject modal HTML
  var overlay = document.createElement('div');
  overlay.id = 'tts-overlay';
  overlay.innerHTML =
    '<div id="tts-modal">' +
      '<div id="tts-modal-header">' +
        '<span id="tts-modal-title">🔊 Speak</span>' +
        '<span id="tts-lang-badge"></span>' +
      '</div>' +
      '<input id="tts-input" type="text" placeholder="Type a word…" autocomplete="off" />' +
      '<div id="tts-hint">Enter to speak · Esc to close</div>' +
      '<div id="tts-error">Speech not supported in this browser</div>' +
      '<div id="tts-chips"></div>' +
    '</div>';
  overlay.addEventListener('click', function(e) {
    if (e.target === overlay) closeTTSModal();
  });
  document.body.appendChild(overlay);

  // Input listeners
  document.getElementById('tts-input').addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { _ttsSpeak(this.value); }
    if (e.key === 'Escape') { e.stopPropagation(); closeTTSModal(); }
  });

  // Inject FAB (shown via CSS only on touch devices)
  var fab = document.createElement('button');
  fab.id = 'tts-fab';
  fab.setAttribute('aria-label', 'Speak a word');
  fab.innerHTML = '🔊';
  fab.addEventListener('click', openTTSModal);
  document.body.appendChild(fab);
}

window.openTTSModal  = openTTSModal;
window.closeTTSModal = closeTTSModal;
```

- [ ] **Step 2: Extend the existing `keydown` listener in `shared.js`**

Find the existing keydown listener (around line 482):
```javascript
document.addEventListener("keydown", function(e) {
  if (e.target.tagName === "SELECT") return;
```

Replace that opening guard with:
```javascript
document.addEventListener("keydown", function(e) {
  if (e.target.tagName === "SELECT") return;
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
```

Then, just before the closing `});` of that same listener, add:
```javascript
  if (e.key === "/" && !_ttsOpen) { e.preventDefault(); openTTSModal(); }
  if (e.key === "Escape" && _ttsOpen) { closeTTSModal(); }
```

- [ ] **Step 3: Call `setupTTSWidget()` at the bottom of the IIFE**

Find the line `init();` at the very bottom of the IIFE (line ~532). Add `setupTTSWidget();` on the line before it:
```javascript
setupTTSWidget();
init();
```

- [ ] **Step 4: Manual verification**

Start the server: `python3 app.py`

Open `http://localhost:5001/viet` in a browser:
1. Press `/` → TTS modal opens, input is focused, language badge shows `vi-VN`
2. Type `xin chào` → press Enter → hear it spoken
3. Type a second word → press Enter → hear it; first word appears as a chip
4. Click the chip → input fills with that word and it plays again
5. Press Escape → modal closes
6. Focus a text input (e.g. search in browser URL bar — actually test by clicking the category dropdown then pressing `/`) → modal should NOT open while SELECT is focused

On mobile / Chrome DevTools mobile emulation:
7. FAB (🔊) button visible bottom-right → tap it → modal opens

- [ ] **Step 5: Commit**

```bash
git add static/shared.js
git commit -m "feat: add TTS speak widget (/ shortcut + mobile FAB)"
```

---

## Chunk 2: Vietnamese Speed Typing Trainer

### Task 3: Flask Route

**Files:**
- Modify: `app.py`, `requirements.txt`
- Create: `tests/test_routes.py`

- [ ] **Step 1: Add pytest to requirements and verify it runs**

Add `pytest==8.3.5` to `requirements.txt` (after the existing entries), then install and confirm pytest works:

```bash
pip3 install pytest==8.3.5
python3 -m pytest --version
```

Expected: `pytest 8.x.x`

- [ ] **Step 2: Write the failing route test**

Create `tests/test_routes.py`:

```python
import sys, os
sys.path.insert(0, os.path.dirname(os.path.dirname(__file__)))
import app as flask_app
import pytest

@pytest.fixture
def client():
    flask_app.app.config['TESTING'] = True
    with flask_app.app.test_client() as c:
        yield c

def test_viet_typing_route_exists(client):
    resp = client.get('/viet/typing')
    assert resp.status_code == 200

def test_viet_typing_returns_html(client):
    resp = client.get('/viet/typing')
    assert b'<!DOCTYPE html>' in resp.data or b'<html' in resp.data
```

- [ ] **Step 3: Run test to confirm it fails**

```bash
cd /Users/wongshennan/Documents/personal/languages
python3 -m pytest tests/test_routes.py -v
```

Expected output: `FAILED tests/test_routes.py::test_viet_typing_route_exists` — 404 or route not found error

- [ ] **Step 4: Add the route to `app.py`**

After the existing `/viet/pronunciation` route (~line 159), add:

```python
@app.route("/viet/typing")
def viet_typing():
    return render_template("viet_typing.html")
```

- [ ] **Step 5: Create an empty placeholder template so the route can render**

Create `templates/viet_typing.html` with just:
```html
<!DOCTYPE html><html><body>placeholder</body></html>
```

- [ ] **Step 6: Run tests to confirm they pass**

```bash
python3 -m pytest tests/test_routes.py -v
```

Expected: both tests `PASSED`

- [ ] **Step 7: Commit**

```bash
git add app.py requirements.txt tests/test_routes.py templates/viet_typing.html
git commit -m "feat: add /viet/typing route with test"
```

---

### Task 4: Typing Trainer Page

**Files:**
- Modify: `templates/viet_typing.html` (replace placeholder with full page)

- [ ] **Step 1: Replace placeholder with full typing trainer template**

Overwrite `templates/viet_typing.html` with:

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Viet Typing — Speed Practice</title>
<link rel="stylesheet" href="/static/shared.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
<style>
  :root {
    --primary:    #8B0000;
    --primary-dk: #6B0000;
    --accent:     #CC2233;
    --accent2:    #F4C430;
    --lgrey:      #F0F4F8;
    --dgrey:      #6C7A8A;
  }
  /* Stats bar */
  #stats-bar {
    display: flex; background: #fff;
    border-bottom: 1px solid #E0E0E0;
  }
  .stat-cell {
    flex: 1; text-align: center; padding: 10px 4px;
    border-right: 1px solid #E0E0E0;
  }
  .stat-cell:last-child { border-right: none; }
  .stat-num { font-size: 22px; font-weight: 700; color: var(--primary); }
  .stat-num.good { color: #27AE60; }
  .stat-num.bad  { color: #C0392B; }
  .stat-lbl { font-size: 10px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; }
  /* Card area */
  #card-area { max-width: 480px; margin: 28px auto; padding: 0 16px; }
  #mode-label { text-align:center; font-size:11px; color:#aaa; text-transform:uppercase; letter-spacing:1px; margin-bottom:12px; }
  #word-display { text-align:center; font-size:42px; font-weight:700; color:var(--primary); margin-bottom:6px; min-height:52px; }
  #hint-display { text-align:center; font-size:14px; color:#888; margin-bottom:22px; min-height:20px; }
  /* Dictation speaker */
  #dictation-btn {
    display: none; flex-direction: column; align-items: center;
    gap: 10px; margin: 0 auto 22px; cursor: pointer; width: fit-content;
  }
  .speaker-circle {
    width: 72px; height: 72px; border-radius: 50%;
    background: var(--primary); color: #fff;
    display: flex; align-items: center; justify-content: center;
    font-size: 28px; box-shadow: 0 4px 16px rgba(139,0,0,0.3);
    transition: transform 0.1s;
  }
  .speaker-circle:active { transform: scale(0.95); }
  #replay-hint { font-size: 11px; color: #aaa; }
  /* Input */
  #typing-input {
    width: 100%; padding: 12px 16px; font-size: 20px;
    border: 2px solid var(--primary); border-radius: 8px;
    text-align: center; outline: none; background: #fff;
    margin-bottom: 8px;
  }
  #typing-input:focus { box-shadow: 0 0 0 3px rgba(139,0,0,0.12); }
  #typing-input:disabled { opacity: 0.5; }
  #submit-hint { text-align:center; font-size:11px; color:#aaa; margin-bottom:14px; }
  /* Reveal (wrong answer) */
  #reveal-area {
    display: none; text-align: center; padding: 12px;
    background: #FFF0F0; border-radius: 8px; margin-bottom: 14px;
  }
  #reveal-area .reveal-label { font-size: 12px; color: #888; margin-bottom: 4px; }
  #reveal-word { font-size: 24px; font-weight: 700; color: var(--primary); }
  /* Recent chips */
  #recent-chips { display:flex; gap:6px; flex-wrap:wrap; justify-content:center; margin-top:8px; }
  .chip { padding: 3px 12px; border-radius: 20px; font-size: 13px; }
  .chip.correct { background: #E8F5E9; color: #2E7D32; }
  .chip.wrong   { background: #FDECEA; color: #C0392B; }
  /* Start overlay */
  #start-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.5);
    display: flex; align-items: center; justify-content: center; z-index: 100;
  }
  #start-card {
    background: #fff; border-radius: 12px; padding: 32px 28px;
    text-align: center; max-width: 340px; width: 90%;
  }
  #start-card h2 { color: var(--primary); margin-bottom: 10px; font-size: 22px; }
  #start-card p  { color: #666; font-size: 14px; margin-bottom: 22px; line-height: 1.5; }
  #btn-start-typing {
    background: var(--primary); color: #fff; border: none;
    padding: 12px 36px; border-radius: 8px; font-size: 16px;
    font-weight: 700; cursor: pointer;
  }
  #btn-start-typing:hover { background: var(--primary-dk); }
</style>
</head>
<body>

<div id="topbar">
  <h1>VIET TYPING</h1>
  <div class="spacer"></div>
  <button id="nav-toggle" onclick="toggleNav()" aria-label="Menu"><i class="fa-solid fa-bars"></i></button>
  <div id="nav-menu">
    <button class="mode-btn active" id="btn-copy"     onclick="setMode('copy')"><i class="fa-solid fa-eye"></i> Copy</button>
    <button class="mode-btn"        id="btn-dictation" onclick="setMode('dictation')"><i class="fa-solid fa-headphones"></i> Dictation</button>
    <label>Category:</label>
    <select id="cat-select"></select>
    <a href="/viet" class="mode-btn" style="text-decoration:none"><i class="fa-solid fa-arrow-left"></i> Back</a>
  </div>
</div>

<div id="stats-bar">
  <div class="stat-cell">
    <div class="stat-num" id="stat-wpm">0</div>
    <div class="stat-lbl">WPM</div>
  </div>
  <div class="stat-cell">
    <div class="stat-num good" id="stat-acc">—</div>
    <div class="stat-lbl">Accuracy</div>
  </div>
  <div class="stat-cell">
    <div class="stat-num" id="stat-words">0</div>
    <div class="stat-lbl">Words</div>
  </div>
  <div class="stat-cell">
    <div class="stat-num bad" id="stat-errors">0</div>
    <div class="stat-lbl">Errors</div>
  </div>
</div>

<div id="card-area">
  <div id="mode-label"></div>
  <div id="word-display"></div>
  <div id="hint-display"></div>
  <div id="dictation-btn" onclick="replayAudio()">
    <div class="speaker-circle"><i class="fa-solid fa-volume-high"></i></div>
    <div id="replay-hint">Press R to replay</div>
  </div>
  <input id="typing-input" type="text" placeholder="Type here…" autocomplete="off" spellcheck="false" />
  <div id="submit-hint">Press Enter to submit</div>
  <div id="reveal-area">
    <div class="reveal-label">Correct answer:</div>
    <div id="reveal-word"></div>
  </div>
  <div id="recent-chips"></div>
</div>

<div id="start-overlay">
  <div id="start-card">
    <h2>Viet Typing</h2>
    <p id="start-desc">Choose a mode above, then press Start.<br><br>
      <strong>Copy:</strong> see the Vietnamese word, type it.<br>
      <strong>Dictation:</strong> hear the word, type it blind.
    </p>
    <button id="btn-start-typing" onclick="startSession()">Start</button>
  </div>
</div>

<script>
(function () {
'use strict';

// ── State ─────────────────────────────────────────────────────────────────
var allCards       = [];
var queue          = [];
var qpos           = 0;
var curCard        = null;
var mode           = 'copy';      // 'copy' | 'dictation'
var timerStart     = null;        // set on first input event
var totalChars     = 0;           // chars entered in correct + wrong answers
var correctCount   = 0;
var totalSubmitted = 0;
var errorCount     = 0;
var recentHistory  = [];          // [{word, correct}] last 5
var awaitingNext   = false;       // locked while wrong-answer TTS plays

// ── TTS ───────────────────────────────────────────────────────────────────
function speak(text, onEnd) {
  if (!window.speechSynthesis) { if (onEnd) setTimeout(onEnd, 100); return; }
  speechSynthesis.cancel();
  var clean = text.split('(')[0].replace(/['"\/]/g, '').trim();
  var utt = new SpeechSynthesisUtterance(clean);
  utt.lang = 'vi-VN';
  if (onEnd) {
    var called = false;
    function done() { if (!called) { called = true; onEnd(); } }
    utt.onend  = done;
    utt.onerror = done;
    // Fallback: 3s baseline + 80ms per character
    setTimeout(done, 3000 + clean.length * 80);
  }
  speechSynthesis.speak(utt);
}

function replayAudio() {
  if (curCard && mode === 'dictation' && !awaitingNext) speak(curCard.viet);
}

// ── Stats ─────────────────────────────────────────────────────────────────
function updateStats() {
  var wpm = 0;
  if (timerStart && totalChars > 0) {
    var mins = (Date.now() - timerStart) / 60000;
    if (mins > 0) wpm = Math.round((totalChars / 5) / mins);
  }
  var acc = totalSubmitted > 0 ? Math.round(100 * correctCount / totalSubmitted) : null;
  document.getElementById('stat-wpm').textContent   = wpm;
  document.getElementById('stat-acc').textContent   = acc !== null ? acc + '%' : '—';
  document.getElementById('stat-words').textContent = totalSubmitted;
  document.getElementById('stat-errors').textContent = errorCount;
}

// ── Recent chips ──────────────────────────────────────────────────────────
function addChip(word, correct) {
  recentHistory.unshift({ word: word, correct: correct });
  if (recentHistory.length > 5) recentHistory.pop();
  var el = document.getElementById('recent-chips');
  el.innerHTML = recentHistory.map(function(h) {
    return '<span class="chip ' + (h.correct ? 'correct' : 'wrong') + '">' +
           (h.correct ? '✓' : '✗') + ' ' + h.word + '</span>';
  }).join('');
}

// ── Queue ─────────────────────────────────────────────────────────────────
function buildQueue() {
  var cat  = document.getElementById('cat-select').value;
  var src  = (cat === 'All') ? allCards : allCards.filter(function(c) { return c.cat === cat; });
  var arr  = src.slice();
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
  }
  return arr;
}

function loadNextWord() {
  awaitingNext = false;
  document.getElementById('reveal-area').style.display  = 'none';
  document.getElementById('typing-input').value         = '';
  document.getElementById('typing-input').disabled      = false;
  document.getElementById('typing-input').focus();

  if (qpos >= queue.length) { queue = buildQueue(); qpos = 0; }
  curCard = queue[qpos++];

  if (mode === 'copy') {
    document.getElementById('mode-label').textContent    = 'Type this word';
    document.getElementById('word-display').textContent  = curCard.viet;
    document.getElementById('hint-display').textContent  = curCard.english;
    document.getElementById('dictation-btn').style.display = 'none';
  } else {
    document.getElementById('mode-label').textContent    = 'Listen and type';
    document.getElementById('word-display').textContent  = '';
    document.getElementById('hint-display').textContent  = '';
    document.getElementById('dictation-btn').style.display = 'flex';
    speak(curCard.viet);
  }
}

// ── Submit ────────────────────────────────────────────────────────────────
function submitAnswer() {
  // Empty-input guard first — ignore Enter on blank input in all states
  var typed = document.getElementById('typing-input').value.trim();
  if (!typed) return;
  // Re-entry guard — locked while wrong-answer TTS plays
  if (awaitingNext || !curCard) return;

  totalSubmitted++;
  totalChars += typed.length;
  var correct = (typed.toLowerCase() === curCard.viet.toLowerCase());

  if (correct) {
    correctCount++;
    addChip(curCard.viet, true);
    updateStats();
    loadNextWord();
  } else {
    errorCount++;
    addChip(curCard.viet, false);
    updateStats();
    document.getElementById('reveal-word').textContent       = curCard.viet;
    document.getElementById('reveal-area').style.display     = 'block';
    document.getElementById('typing-input').disabled         = true;
    awaitingNext = true;
    speak(curCard.viet, function() { loadNextWord(); });
  }
}

// ── Mode ──────────────────────────────────────────────────────────────────
function setMode(m) {
  mode = m;
  document.getElementById('btn-copy').classList.toggle('active',      m === 'copy');
  document.getElementById('btn-dictation').classList.toggle('active', m === 'dictation');
  resetSession();
  loadNextWord();
}

function resetSession() {
  timerStart = null; totalChars = 0; correctCount = 0;
  totalSubmitted = 0; errorCount = 0; recentHistory = [];
  document.getElementById('recent-chips').innerHTML = '';
  queue = buildQueue(); qpos = 0;
  updateStats();
}

// ── Category ──────────────────────────────────────────────────────────────
function initCatSelect() {
  var seen = {}, cats = [];
  for (var i = 0; i < allCards.length; i++) {
    var c = allCards[i].cat || 'General';
    if (!seen[c]) { seen[c] = true; cats.push(c); }
  }
  cats.sort();
  var sel = document.getElementById('cat-select');
  sel.innerHTML = '<option value="All">All categories</option>' +
    cats.map(function(c) { return '<option>' + c + '</option>'; }).join('');
  sel.addEventListener('change', function() { resetSession(); loadNextWord(); });
}

// ── Session start ─────────────────────────────────────────────────────────
function startSession() {
  document.getElementById('start-overlay').style.display = 'none';
  loadNextWord();
}

// ── Nav toggle (reuse shared pattern) ─────────────────────────────────────
function toggleNav() {
  var menu = document.getElementById('nav-menu');
  if (menu) menu.classList.toggle('open');
}
document.addEventListener('click', function(e) {
  var menu   = document.getElementById('nav-menu');
  var toggle = document.getElementById('nav-toggle');
  if (!menu || !menu.classList.contains('open')) return;
  if (!menu.contains(e.target) && e.target !== toggle && !toggle.contains(e.target)) {
    menu.classList.remove('open');
  }
});

// ── Keyboard ──────────────────────────────────────────────────────────────
document.getElementById('typing-input').addEventListener('input', function() {
  // Start WPM timer on first character typed
  if (!timerStart) timerStart = Date.now();
});

document.addEventListener('keydown', function(e) {
  if (e.key === 'Enter' && !awaitingNext) { submitAnswer(); }
  if ((e.key === 'r' || e.key === 'R') && mode === 'dictation' && !awaitingNext) { replayAudio(); }
});

// ── Init ──────────────────────────────────────────────────────────────────
async function init() {
  var res  = await fetch('/api/vocab/viet');
  allCards = await res.json();
  initCatSelect();
  queue = buildQueue();
}

window.setMode      = setMode;
window.startSession = startSession;
window.replayAudio  = replayAudio;
window.toggleNav    = toggleNav;

init();
})();
</script>
</body>
</html>
```

- [ ] **Step 2: Verify the page loads**

Start server: `python3 app.py`

Open `http://localhost:5001/viet/typing`:
1. Page loads — start overlay is visible with "Start" button
2. Click "Start" → overlay dismisses, first word appears (Copy mode)
3. Type the word exactly → press Enter → green chip appears, new word loads
4. Type something wrong → press Enter → red chip, correct word revealed, spoken, then next word auto-loads

Test Dictation mode:
5. Click "Dictation" in topbar → stats reset, speaker icon appears instead of word text
6. Word is spoken automatically on load
7. Press R → word plays again
8. Type the word → press Enter → correct/wrong flow works

Test category filter:
9. Select a specific category → session resets, words filtered

Test mobile (DevTools emulation):
10. Topbar collapses to hamburger → tap to open nav → mode/category accessible

- [ ] **Step 3: Commit**

```bash
git add templates/viet_typing.html
git commit -m "feat: implement Vietnamese speed typing trainer page"
```

---

### Task 5: Add Typing Nav Link to Viet Page

**Files:**
- Modify: `templates/viet.html`

- [ ] **Step 1: Add nav link in `templates/viet.html`**

Find the existing pronunciation guide link in `viet.html` (~line 57). It sits before `<div class="nav-sep"></div>`:
```html
<a href="/viet/pronunciation" class="mode-btn" style="text-decoration:none"><i class="fa-solid fa-book-open"></i> Guide</a>
<div class="nav-sep"></div>
```

Replace that block with (Typing link inserted between Guide and the separator):
```html
<a href="/viet/pronunciation" class="mode-btn" style="text-decoration:none"><i class="fa-solid fa-book-open"></i> Guide</a>
<a href="/viet/typing" class="mode-btn" style="text-decoration:none"><i class="fa-solid fa-keyboard"></i> Typing</a>
<div class="nav-sep"></div>
```

- [ ] **Step 2: Verify link appears and navigates correctly**

Open `http://localhost:5001/viet`:
1. Open nav menu (hamburger on mobile, always visible on desktop)
2. "Typing" link is visible
3. Click it → navigates to `http://localhost:5001/viet/typing`
4. Back link on typing page returns to `/viet`

- [ ] **Step 3: Commit**

```bash
git add templates/viet.html
git commit -m "feat: add Typing nav link to Vietnamese Anki page"
```
