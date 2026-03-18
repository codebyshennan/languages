# Number Pronunciation Practice — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a timed number pronunciation drill with mic recording, auto-progression, and helper tips for Vietnamese, Indonesian, and Spanish.

**Architecture:** Standalone `numbers.js` engine + per-language HTML templates with `NUMBER_CONFIG`. Engine handles progression, countdown timer, MediaRecorder, playback, and session stats. Each template defines `numberToWords()` and `levelTips[]`.

**Tech Stack:** Vanilla JS, MediaRecorder API, Flask (routes only), localStorage, shared.css

**Spec:** `docs/superpowers/specs/2026-03-18-number-pronunciation-practice-design.md`

---

### Task 1: Add Flask routes for number pages

**Files:**
- Modify: `app.py:157-171` (add routes after existing page routes)
- Test: `tests/test_routes.py`

- [ ] **Step 1: Write failing tests for the 3 new routes**

Add to `tests/test_routes.py`:

```python
def test_viet_numbers_route_exists(client):
    resp = client.get('/viet/numbers')
    assert resp.status_code == 200

def test_bahasa_numbers_route_exists(client):
    resp = client.get('/bahasa/numbers')
    assert resp.status_code == 200

def test_spanish_numbers_route_exists(client):
    resp = client.get('/spanish/numbers')
    assert resp.status_code == 200
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd /Users/wongshennan/Documents/personal/apps/learning-practice/language-vocab-practice && python -m pytest tests/test_routes.py -v`
Expected: 3 FAIL (templates don't exist yet, so we need placeholder templates first)

- [ ] **Step 3: Create minimal placeholder templates**

Create `templates/viet_numbers.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Viet Numbers</title></head>
<body><h1>Viet Numbers</h1></body>
</html>
```

Create `templates/bahasa_numbers.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Bahasa Numbers</title></head>
<body><h1>Bahasa Numbers</h1></body>
</html>
```

Create `templates/spanish_numbers.html`:
```html
<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><title>Spanish Numbers</title></head>
<body><h1>Spanish Numbers</h1></body>
</html>
```

- [ ] **Step 4: Add routes to app.py**

Add after the existing `bahasa_pronunciation` route (after line 171):

```python
@app.route("/viet/numbers")
def viet_numbers():
    return render_template("viet_numbers.html")

@app.route("/bahasa/numbers")
def bahasa_numbers():
    return render_template("bahasa_numbers.html")

@app.route("/spanish/numbers")
def spanish_numbers():
    return render_template("spanish_numbers.html")
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd /Users/wongshennan/Documents/personal/apps/learning-practice/language-vocab-practice && python -m pytest tests/test_routes.py -v`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add app.py tests/test_routes.py templates/viet_numbers.html templates/bahasa_numbers.html templates/spanish_numbers.html
git commit -m "feat: add Flask routes and placeholder templates for number pronunciation practice"
```

---

### Task 2: Build the numbers.js shared engine — progression and number generation

**Files:**
- Create: `static/numbers.js`
- Create: `tests/test_numbers.html` (browser-based test, same pattern as `tests/test_viet_syllable.html`)

- [ ] **Step 1: Create the test file with progression and number generation tests**

Create `tests/test_numbers.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Numbers Engine Tests</title>
</head>
<body>
<pre id="out"></pre>
<script>
  // Stub NUMBER_CONFIG for testing
  window.NUMBER_CONFIG = {
    lang: 'en',
    numberToWords: function(n) { return String(n); },
    levelTips: ['Tip 1', 'Tip 2', 'Tip 3', 'Tip 4', 'Tip 5'],
  };
</script>
<script src="../static/numbers.js"></script>
<script>
  var E = window.NumbersEngine;
  var results = [];
  var passed = 0, failed = 0;

  function assert(label, got, expected) {
    var ok = JSON.stringify(got) === JSON.stringify(expected);
    if (ok) { passed++; } else { failed++; }
    results.push((ok ? 'PASS' : 'FAIL') + '  ' + label +
      (ok ? '' : '  (got: ' + JSON.stringify(got) + ', expected: ' + JSON.stringify(expected) + ')'));
  }

  function assertInRange(label, val, min, max) {
    var ok = val >= min && val <= max;
    if (ok) { passed++; } else { failed++; }
    results.push((ok ? 'PASS' : 'FAIL') + '  ' + label +
      (ok ? '' : '  (got: ' + val + ', expected: ' + min + '-' + max + ')'));
  }

  // LEVELS config
  assert('LEVELS has 5 entries', E.LEVELS.length, 5);
  assert('Level 1 range', [E.LEVELS[0].min, E.LEVELS[0].max], [1, 10]);
  assert('Level 2 range', [E.LEVELS[1].min, E.LEVELS[1].max], [1, 100]);
  assert('Level 3 range', [E.LEVELS[2].min, E.LEVELS[2].max], [1, 1000]);
  assert('Level 4 range', [E.LEVELS[3].min, E.LEVELS[3].max], [1, 10000]);
  assert('Level 5 range', [E.LEVELS[4].min, E.LEVELS[4].max], [1, 1000000]);
  assert('Level 1 countdown 3s', E.LEVELS[0].countdown, 3);
  assert('Level 3 countdown 5s', E.LEVELS[2].countdown, 5);
  assert('Level 5 countdown 7s', E.LEVELS[4].countdown, 7);

  // generateNumber — level 1 should be 1-10
  for (var i = 0; i < 50; i++) {
    var n = E.generateNumber(1);
    if (n < 1 || n > 10) {
      assert('Level 1 number in range 1-10', n, '1-10');
      break;
    }
  }
  if (i === 50) assert('Level 1: 50 numbers all in range 1-10', true, true);

  // generateNumber — level 3, numbers should be 1-1000
  for (var j = 0; j < 50; j++) {
    var m = E.generateNumber(3);
    if (m < 1 || m > 1000) {
      assert('Level 3 number in range 1-1000', m, '1-1000');
      break;
    }
  }
  if (j === 50) assert('Level 3: 50 numbers all in range 1-1000', true, true);

  // generateNumber — level 3 weighting: ~30% should be review (1-100), ~70% new (101-1000)
  var reviewCount = 0;
  var total = 500;
  for (var w = 0; w < total; w++) {
    var wn = E.generateNumber(3);
    if (wn <= 100) reviewCount++;
  }
  var reviewPct = reviewCount / total;
  assertInRange('Level 3 review % (~30%)', reviewPct, 0.15, 0.45);

  // Progression — initial state
  var state = E.createState();
  assert('Initial level', state.level, 1);
  assert('Initial streak', state.streak, 0);
  assert('Initial totalCorrect', state.totalCorrect, 0);
  assert('Initial totalAttempts', state.totalAttempts, 0);
  assert('Initial bestLevel', state.bestLevel, 1);

  // Progression — correct answer
  E.recordResult(state, true);
  assert('After 1 correct: streak=1', state.streak, 1);
  assert('After 1 correct: totalCorrect=1', state.totalCorrect, 1);
  assert('After 1 correct: level still 1', state.level, 1);

  // Progression — 5 correct in a row levels up
  E.recordResult(state, true);
  E.recordResult(state, true);
  E.recordResult(state, true);
  E.recordResult(state, true);
  assert('After 5 correct: level=2', state.level, 2);
  assert('After 5 correct: streak reset to 0', state.streak, 0);
  assert('After 5 correct: bestLevel=2', state.bestLevel, 2);

  // Progression — wrong resets streak, no demotion
  E.recordResult(state, true);
  E.recordResult(state, true);
  assert('Streak at 2', state.streak, 2);
  E.recordResult(state, false);
  assert('Wrong resets streak to 0', state.streak, 0);
  assert('Wrong does not demote level', state.level, 2);

  // Progression — level 5 is max, no level 6
  var maxState = E.createState();
  maxState.level = 5;
  for (var k = 0; k < 5; k++) E.recordResult(maxState, true);
  assert('Cannot exceed level 5', maxState.level, 5);

  // getCountdown
  assert('Countdown level 1 = 3', E.getCountdown(1), 3);
  assert('Countdown level 2 = 3', E.getCountdown(2), 3);
  assert('Countdown level 3 = 5', E.getCountdown(3), 5);
  assert('Countdown level 4 = 5', E.getCountdown(4), 5);
  assert('Countdown level 5 = 7', E.getCountdown(5), 7);

  // getLevelTip
  assert('getLevelTip(1) returns first tip', E.getLevelTip(1), 'Tip 1');
  assert('getLevelTip(5) returns fifth tip', E.getLevelTip(5), 'Tip 5');

  // Print results
  var out = document.getElementById('out');
  out.textContent = results.join('\n') + '\n\n' + passed + ' passed, ' + failed + ' failed';
  if (failed > 0) out.style.color = 'red';
  else out.style.color = 'green';
</script>
</body>
</html>
```

- [ ] **Step 2: Create numbers.js with progression logic and number generation**

Create `static/numbers.js`:

```javascript
/* numbers.js — Standalone engine for number pronunciation practice.
   Expects window.NUMBER_CONFIG to be defined by the language template. */
(function () {
'use strict';

var LEVELS = [
  { level: 1, min: 1, max: 10,      countdown: 3, label: 'Digits (1–10)' },
  { level: 2, min: 1, max: 100,     countdown: 3, label: 'Tens (1–100)' },
  { level: 3, min: 1, max: 1000,    countdown: 5, label: 'Hundreds (1–1,000)' },
  { level: 4, min: 1, max: 10000,   countdown: 5, label: 'Thousands (1–10,000)' },
  { level: 5, min: 1, max: 1000000, countdown: 7, label: 'Large (1–1,000,000)' },
];

var STREAK_TO_ADVANCE = 5;
var STORAGE_PREFIX = 'numbers_progress_';

// ── State ────────────────────────────────────────────────────────────────

function createState() {
  return { level: 1, streak: 0, totalCorrect: 0, totalAttempts: 0, bestLevel: 1 };
}

function loadState(langKey) {
  try {
    var raw = localStorage.getItem(STORAGE_PREFIX + langKey);
    if (raw) {
      var s = JSON.parse(raw);
      return {
        level:        s.level        || 1,
        streak:       s.streak       || 0,
        totalCorrect: s.totalCorrect || 0,
        totalAttempts:s.totalAttempts || 0,
        bestLevel:    s.bestLevel    || 1,
      };
    }
  } catch (e) { /* ignore */ }
  return createState();
}

function saveState(langKey, state) {
  try {
    localStorage.setItem(STORAGE_PREFIX + langKey, JSON.stringify(state));
  } catch (e) { /* ignore */ }
}

// ── Progression ──────────────────────────────────────────────────────────

function recordResult(state, correct) {
  state.totalAttempts++;
  if (correct) {
    state.totalCorrect++;
    state.streak++;
    if (state.streak >= STREAK_TO_ADVANCE && state.level < LEVELS.length) {
      state.level++;
      state.streak = 0;
      if (state.level > state.bestLevel) state.bestLevel = state.level;
    }
  } else {
    state.streak = 0;
  }
}

// ── Number generation ────────────────────────────────────────────────────

function generateNumber(level) {
  var cfg = LEVELS[level - 1] || LEVELS[0];
  if (level <= 1) {
    return Math.floor(Math.random() * (cfg.max - cfg.min + 1)) + cfg.min;
  }
  // 70% from new range, 30% review from lower ranges
  var prevCfg = LEVELS[level - 2];
  if (Math.random() < 0.3) {
    // Review: pick from previous level's full range
    return Math.floor(Math.random() * (prevCfg.max - prevCfg.min + 1)) + prevCfg.min;
  }
  // New range: prevCfg.max+1 to cfg.max
  var newMin = prevCfg.max + 1;
  return Math.floor(Math.random() * (cfg.max - newMin + 1)) + newMin;
}

function getCountdown(level) {
  var cfg = LEVELS[level - 1] || LEVELS[0];
  return cfg.countdown;
}

function getLevelLabel(level) {
  var cfg = LEVELS[level - 1] || LEVELS[0];
  return cfg.label;
}

function getLevelTip(level) {
  var config = window.NUMBER_CONFIG;
  if (config && config.levelTips && config.levelTips[level - 1]) {
    return config.levelTips[level - 1];
  }
  return null;
}

// ── Public API ───────────────────────────────────────────────────────────

window.NumbersEngine = {
  LEVELS: LEVELS,
  STREAK_TO_ADVANCE: STREAK_TO_ADVANCE,
  createState: createState,
  loadState: loadState,
  saveState: saveState,
  recordResult: recordResult,
  generateNumber: generateNumber,
  getCountdown: getCountdown,
  getLevelLabel: getLevelLabel,
  getLevelTip: getLevelTip,
};

})();
```

- [ ] **Step 3: Open test_numbers.html in a browser and verify all tests pass**

Run: `open /Users/wongshennan/Documents/personal/apps/learning-practice/language-vocab-practice/tests/test_numbers.html`
Expected: All tests PASS (green output)

- [ ] **Step 4: Commit**

```bash
git add static/numbers.js tests/test_numbers.html
git commit -m "feat: add numbers.js engine with progression logic and number generation"
```

---

### Task 3: Add numbers.js UI engine — countdown, recording, session flow

**Files:**
- Modify: `static/numbers.js` (append UI controller code)

This task adds the DOM-driving code to `numbers.js`. It expects a specific HTML structure (built in Task 5-7) and handles: countdown animation, MediaRecorder recording/playback, round flow, session stats display, helper tip display.

- [ ] **Step 1: Append UI controller to numbers.js**

Add after the `window.NumbersEngine` assignment, still inside the IIFE:

```javascript
// ── UI Controller ────────────────────────────────────────────────────────
// Only initializes if DOM elements exist (templates loaded)

function initUI() {
  var config = window.NUMBER_CONFIG;
  if (!config) return;

  var langKey = config.langKey; // e.g. 'viet', 'bahasa', 'spanish'
  var state = NumbersEngine.loadState(langKey);

  // Session stats (not persisted — per-session only)
  var session = { attempts: 0, correct: 0 };

  // DOM refs
  var elNumber     = document.getElementById('number-display');
  var elCountdown  = document.getElementById('countdown-bar');
  var elRecordBtn  = document.getElementById('record-btn');
  var elStopBtn    = document.getElementById('stop-btn');
  var elReplayBtn  = document.getElementById('replay-btn');
  var elRecording  = document.getElementById('recording-indicator');
  var elAnswer     = document.getElementById('answer-reveal');
  var elAnswerText = document.getElementById('answer-text');
  var elGotIt      = document.getElementById('btn-got-it');
  var elMissed     = document.getElementById('btn-missed');
  var elSkip       = document.getElementById('btn-skip');
  var elStreak     = document.getElementById('num-streak');
  var elLevel      = document.getElementById('num-level');
  var elProgress   = document.getElementById('num-progress');
  var elLevelBadge = document.getElementById('level-badge');
  var elTipCard    = document.getElementById('tip-card');
  var elTipText    = document.getElementById('tip-text');
  var elTipDismiss = document.getElementById('tip-dismiss');
  var elTipBtn     = document.getElementById('tip-btn');
  var elSessionEnd = document.getElementById('session-end');
  var elMainArea   = document.getElementById('main-area');
  var elStartOver  = document.getElementById('start-overlay');
  var elBtnStart   = document.getElementById('btn-start');
  var elEndAttempts= document.getElementById('end-attempts');
  var elEndCorrect = document.getElementById('end-correct');
  var elEndAccuracy= document.getElementById('end-accuracy');
  var elEndLevel   = document.getElementById('end-level');
  var elBtnRetry   = document.getElementById('btn-retry');
  var elBtnHome    = document.getElementById('btn-home');
  var audioEl      = document.getElementById('playback-audio');

  if (!elNumber) return; // safety: not on a numbers page

  // ── Recording state ──────────────────────────────────────────────────
  var micStream    = null;
  var recorder     = null;
  var chunks       = [];
  var lastBlobUrl  = null;
  var countdownTimer = null;
  var currentNumber = null;
  var lastShownLevel = 0; // track which level tip was last shown

  // ── Mic setup ────────────────────────────────────────────────────────
  function acquireMic() {
    if (micStream && micStream.getTracks().some(function(t) { return t.readyState === 'live'; })) {
      return Promise.resolve(micStream);
    }
    micStream = null;
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return Promise.reject(new Error('No mic support'));
    }
    return navigator.mediaDevices.getUserMedia({ audio: true }).then(function(stream) {
      micStream = stream;
      return stream;
    });
  }

  function getMimeType() {
    if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
    if (MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
    return '';
  }

  // ── UI helpers ───────────────────────────────────────────────────────
  function hideAll() {
    elCountdown.style.width = '0%';
    elRecordBtn.style.display = 'none';
    elStopBtn.style.display = 'none';
    elReplayBtn.style.display = 'none';
    elRecording.style.display = 'none';
    elAnswer.style.display = 'none';
    elGotIt.style.display = 'none';
    elMissed.style.display = 'none';
    elSkip.style.display = 'none';
  }

  function updateProgressStrip() {
    elStreak.textContent = state.streak;
    elLevel.textContent = state.level;
    elProgress.textContent = state.streak + '/' + NumbersEngine.STREAK_TO_ADVANCE + ' to Level ' + (state.level < 5 ? state.level + 1 : 'MAX');
    elLevelBadge.textContent = 'Level ' + state.level + ': ' + NumbersEngine.getLevelLabel(state.level);
  }

  function showTipIfNew() {
    if (state.level !== lastShownLevel) {
      lastShownLevel = state.level;
      var tip = NumbersEngine.getLevelTip(state.level);
      if (tip) {
        elTipText.textContent = tip;
        elTipCard.style.display = 'block';
      }
    }
  }

  function dismissTip() {
    elTipCard.style.display = 'none';
  }

  // ── Round flow ───────────────────────────────────────────────────────
  function startRound() {
    hideAll();
    showTipIfNew();
    updateProgressStrip();

    currentNumber = NumbersEngine.generateNumber(state.level);
    elNumber.textContent = currentNumber.toLocaleString();
    elSkip.style.display = 'inline-block';

    // Start countdown
    var duration = NumbersEngine.getCountdown(state.level);
    elCountdown.style.transition = 'none';
    elCountdown.style.width = '100%';
    // Force reflow
    elCountdown.offsetWidth;
    elCountdown.style.transition = 'width ' + duration + 's linear';
    elCountdown.style.width = '0%';

    countdownTimer = setTimeout(function() {
      onCountdownEnd();
    }, duration * 1000);
  }

  function onCountdownEnd() {
    elSkip.style.display = 'none';
    elRecordBtn.style.display = 'inline-block';
  }

  function startRecording() {
    elRecordBtn.style.display = 'none';
    acquireMic().then(function(stream) {
      var mimeType = getMimeType();
      var options = mimeType ? { mimeType: mimeType } : {};
      recorder = new MediaRecorder(stream, options);
      chunks = [];
      recorder.ondataavailable = function(e) { if (e.data.size > 0) chunks.push(e.data); };
      recorder.onstop = function() { onRecordingDone(); };
      recorder.start();
      elRecording.style.display = 'flex';
      elStopBtn.style.display = 'inline-block';
    }).catch(function() {
      // Mic denied — skip recording, go straight to reveal
      revealAnswer();
    });
  }

  function stopRecording() {
    if (recorder && recorder.state === 'recording') {
      recorder.stop();
    }
    elStopBtn.style.display = 'none';
    elRecording.style.display = 'none';
  }

  function onRecordingDone() {
    if (lastBlobUrl) { URL.revokeObjectURL(lastBlobUrl); lastBlobUrl = null; }
    var blob = new Blob(chunks, { type: chunks[0] ? chunks[0].type : 'audio/webm' });
    lastBlobUrl = URL.createObjectURL(blob);
    audioEl.src = lastBlobUrl;
    audioEl.play();
    // After playback, show reveal + assessment
    audioEl.onended = function() { revealAnswer(); };
    // Fallback if onended doesn't fire
    setTimeout(function() { revealAnswer(); }, 10000);
    elReplayBtn.style.display = 'inline-block';
  }

  var revealShown = false;
  function revealAnswer() {
    if (revealShown) return;
    revealShown = true;
    elAnswerText.textContent = config.numberToWords(currentNumber);
    elAnswer.style.display = 'block';
    elGotIt.style.display = 'inline-block';
    elMissed.style.display = 'inline-block';
  }

  function assess(correct) {
    revealShown = false;
    session.attempts++;
    if (correct) session.correct++;
    NumbersEngine.recordResult(state, correct);
    NumbersEngine.saveState(langKey, state);
    startRound();
  }

  function skip() {
    clearTimeout(countdownTimer);
    revealShown = false;
    session.attempts++;
    NumbersEngine.recordResult(state, false);
    NumbersEngine.saveState(langKey, state);
    startRound();
  }

  function endSession() {
    clearTimeout(countdownTimer);
    if (recorder && recorder.state === 'recording') recorder.stop();
    elMainArea.style.display = 'none';
    elSessionEnd.style.display = 'block';
    elEndAttempts.textContent = session.attempts;
    elEndCorrect.textContent = session.correct;
    elEndAccuracy.textContent = session.attempts > 0
      ? Math.round(100 * session.correct / session.attempts) + '%' : '—';
    elEndLevel.textContent = state.bestLevel;
  }

  function retry() {
    session = { attempts: 0, correct: 0 };
    elSessionEnd.style.display = 'none';
    elMainArea.style.display = 'block';
    startRound();
  }

  // ── Event listeners ──────────────────────────────────────────────────
  elBtnStart.addEventListener('click', function() {
    elStartOver.style.display = 'none';
    elMainArea.style.display = 'block';
    startRound();
  });
  elRecordBtn.addEventListener('click', startRecording);
  elStopBtn.addEventListener('click', stopRecording);
  elReplayBtn.addEventListener('click', function() { audioEl.play(); });
  elGotIt.addEventListener('click', function() { assess(true); });
  elMissed.addEventListener('click', function() { assess(false); });
  elSkip.addEventListener('click', skip);
  elTipDismiss.addEventListener('click', dismissTip);
  elTipBtn.addEventListener('click', function() {
    var tip = NumbersEngine.getLevelTip(state.level);
    if (tip) { elTipText.textContent = tip; elTipCard.style.display = 'block'; }
  });
  elBtnRetry.addEventListener('click', retry);

  document.addEventListener('keydown', function(e) {
    if (e.key === ' ' && elStopBtn.style.display !== 'none') { e.preventDefault(); stopRecording(); }
    if (e.key === 'Escape') endSession();
  });

  // ── Init ─────────────────────────────────────────────────────────────
  updateProgressStrip();
}

// Auto-init when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUI);
} else {
  initUI();
}
```

- [ ] **Step 2: Verify test_numbers.html still passes (engine tests unaffected by UI code)**

Run: `open /Users/wongshennan/Documents/personal/apps/learning-practice/language-vocab-practice/tests/test_numbers.html`
Expected: All tests still PASS (UI code only runs when DOM elements exist)

- [ ] **Step 3: Commit**

```bash
git add static/numbers.js
git commit -m "feat: add UI controller to numbers.js — countdown, recording, session flow"
```

---

### Task 4: Implement Vietnamese numberToWords

**Files:**
- Create: `tests/test_viet_numbers_config.html`
- Modify: `templates/viet_numbers.html` (will be fully built in Task 5, but numberToWords is defined here first for testing)
- Create: `static/viet_numbers_config.js` (extracted for testability)

- [ ] **Step 1: Create test file for Vietnamese numberToWords**

Create `tests/test_viet_numbers_config.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Vietnamese numberToWords Tests</title>
</head>
<body>
<pre id="out"></pre>
<script src="../static/viet_numbers_config.js"></script>
<script>
  var toWords = window.NUMBER_CONFIG.numberToWords;
  var results = [];
  var passed = 0, failed = 0;

  function assert(label, got, expected) {
    var ok = got === expected;
    if (ok) { passed++; } else { failed++; }
    results.push((ok ? 'PASS' : 'FAIL') + '  ' + label +
      (ok ? '' : '\n    got:      "' + got + '"\n    expected: "' + expected + '"'));
  }

  // Basic digits
  assert('1', toWords(1), 'một');
  assert('5', toWords(5), 'năm');
  assert('10', toWords(10), 'mười');

  // Teens
  assert('11', toWords(11), 'mười một');
  assert('14', toWords(14), 'mười bốn');
  assert('15', toWords(15), 'mười lăm');

  // Tens
  assert('20', toWords(20), 'hai mươi');
  assert('21', toWords(21), 'hai mươi mốt');
  assert('24', toWords(24), 'hai mươi tư');
  assert('25', toWords(25), 'hai mươi lăm');
  assert('30', toWords(30), 'ba mươi');
  assert('55', toWords(55), 'năm mươi lăm');
  assert('99', toWords(99), 'chín mươi chín');

  // Hundreds
  assert('100', toWords(100), 'một trăm');
  assert('101', toWords(101), 'một trăm lẻ một');
  assert('105', toWords(105), 'một trăm lẻ năm');
  assert('110', toWords(110), 'một trăm mười');
  assert('111', toWords(111), 'một trăm mười một');
  assert('115', toWords(115), 'một trăm mười lăm');
  assert('121', toWords(121), 'một trăm hai mươi mốt');
  assert('200', toWords(200), 'hai trăm');
  assert('342', toWords(342), 'ba trăm bốn mươi hai');
  assert('500', toWords(500), 'năm trăm');
  assert('999', toWords(999), 'chín trăm chín mươi chín');

  // Thousands
  assert('1000', toWords(1000), 'một nghìn');
  assert('1001', toWords(1001), 'một nghìn lẻ một');
  assert('1010', toWords(1010), 'một nghìn không trăm mười');
  assert('1100', toWords(1100), 'một nghìn một trăm');
  assert('2500', toWords(2500), 'hai nghìn năm trăm');
  assert('10000', toWords(10000), 'mười nghìn');
  assert('12345', toWords(12345), 'mười hai nghìn ba trăm bốn mươi lăm');

  // Thousands gap edge cases
  assert('1005', toWords(1005), 'một nghìn không trăm lẻ năm');
  assert('2003', toWords(2003), 'hai nghìn không trăm lẻ ba');
  assert('1050', toWords(1050), 'một nghìn không trăm năm mươi');
  assert('10001', toWords(10001), 'mười nghìn không trăm lẻ một');

  // Large
  assert('100000', toWords(100000), 'một trăm nghìn');
  assert('1000000', toWords(1000000), 'một triệu');

  var out = document.getElementById('out');
  out.textContent = results.join('\n') + '\n\n' + passed + ' passed, ' + failed + ' failed';
  if (failed > 0) out.style.color = 'red';
  else out.style.color = 'green';
</script>
</body>
</html>
```

- [ ] **Step 2: Create viet_numbers_config.js with numberToWords and levelTips**

Create `static/viet_numbers_config.js`:

```javascript
/* Vietnamese NUMBER_CONFIG — numberToWords + levelTips
   Southern convention: lẻ for gaps, mốt/tư/lăm in compound positions */
(function () {
'use strict';

var ones = ['', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

function readTwoDigits(n, inCompound) {
  // n is 0-99
  if (n === 0) return '';
  if (n < 10) {
    // Single digit in compound position (after trăm lẻ)
    return ones[n];
  }
  if (n === 10) return 'mười';
  if (n < 20) {
    // Teens: mười + unit
    var u = n % 10;
    if (u === 5) return 'mười lăm';
    return 'mười ' + ones[u];
  }
  // 20-99
  var tens = Math.floor(n / 10);
  var unit = n % 10;
  var result = ones[tens] + ' mươi';
  if (unit === 0) return result;
  if (unit === 1) return result + ' mốt';
  if (unit === 4) return result + ' tư';
  if (unit === 5) return result + ' lăm';
  return result + ' ' + ones[unit];
}

function readThreeDigits(n) {
  // n is 0-999
  if (n === 0) return '';
  if (n < 10) return ones[n];
  if (n < 100) return readTwoDigits(n, false);
  var h = Math.floor(n / 100);
  var remainder = n % 100;
  var result = ones[h] + ' trăm';
  if (remainder === 0) return result;
  if (remainder < 10) return result + ' lẻ ' + ones[remainder];
  return result + ' ' + readTwoDigits(remainder, true);
}

function numberToWords(n) {
  if (n === 0) return 'không';
  if (n < 0) return 'âm ' + numberToWords(-n);

  var parts = [];

  // Millions
  var millions = Math.floor(n / 1000000);
  if (millions > 0) {
    parts.push(readThreeDigits(millions) + ' triệu');
    n = n % 1000000;
  }

  // Thousands
  var thousands = Math.floor(n / 1000);
  if (thousands > 0) {
    parts.push(readThreeDigits(thousands) + ' nghìn');
    n = n % 1000;
    // If remainder has no hundreds digit (1-99), insert "không trăm"
    if (n > 0 && n < 100) {
      parts.push('không trăm');
    }
  }

  // Hundreds / tens / ones
  if (n > 0) {
    if (n < 100 && parts.length > 0 && parts[parts.length - 1] === 'không trăm') {
      // After "không trăm", render the tens/units
      if (n < 10) {
        parts.push('lẻ ' + ones[n]);
      } else {
        parts.push(readTwoDigits(n, true));
      }
    } else {
      parts.push(readThreeDigits(n));
    }
  }

  return parts.join(' ');
}

window.NUMBER_CONFIG = {
  lang: 'vi-VN',
  langKey: 'viet',
  numberToWords: numberToWords,
  levelTips: [
    'Digits 1–10: một, hai, ba, bốn, năm, sáu, bảy, tám, chín, mười.',
    '10 = mười. Teens: mười một, mười hai… From 20 onward, tens use mươi: hai mươi, ba mươi. Special units after mươi: 1→mốt (hai mươi mốt), 4→tư (hai mươi tư), 5→lăm (hai mươi lăm).',
    'Hundreds: [digit] trăm. 300 = ba trăm. Compound: 342 = ba trăm bốn mươi hai. Zero gap: 101 = một trăm lẻ một (Southern convention).',
    'Thousands: [digit] nghìn. 1,000 = một nghìn. 2,500 = hai nghìn năm trăm. When hundreds digit is 0: một nghìn không trăm mười = 1,010.',
    'Large numbers: trăm nghìn (hundred thousands), triệu (millions). 100,000 = một trăm nghìn. 1,000,000 = một triệu.',
  ],
};

})();
```

- [ ] **Step 3: Open test in browser and verify**

Run: `open /Users/wongshennan/Documents/personal/apps/learning-practice/language-vocab-practice/tests/test_viet_numbers_config.html`
Expected: All PASS. If any fail, fix `numberToWords` edge cases and re-test.

- [ ] **Step 4: Commit**

```bash
git add static/viet_numbers_config.js tests/test_viet_numbers_config.html
git commit -m "feat: implement Vietnamese numberToWords with Southern convention"
```

---

### Task 5: Build Vietnamese numbers template

**Files:**
- Modify: `templates/viet_numbers.html` (replace placeholder with full template)

- [ ] **Step 1: Write the full template**

Replace `templates/viet_numbers.html` with the complete page. It follows the structure of `viet_typing.html`: topbar, main area, start overlay, session end screen. It includes `shared.css`, `viet_numbers_config.js`, and `numbers.js`.

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Viet Numbers — Pronunciation Practice</title>
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
  #main-area { display: none; max-width: 480px; margin: 0 auto; padding: 24px 16px; text-align: center; }
  #number-display { font-size: 56px; font-weight: 700; color: var(--primary); margin: 32px 0 16px; min-height: 70px; }
  /* Countdown */
  #countdown-wrap { width: 100%; height: 6px; background: #E0E0E0; border-radius: 3px; margin-bottom: 24px; overflow: hidden; }
  #countdown-bar { height: 100%; background: var(--accent); border-radius: 3px; width: 0%; }
  /* Recording */
  #recording-indicator {
    display: none; align-items: center; justify-content: center; gap: 8px;
    font-size: 14px; color: #C0392B; margin-bottom: 16px;
  }
  #recording-indicator .dot {
    width: 12px; height: 12px; border-radius: 50%; background: #C0392B;
    animation: pulse 1s infinite;
  }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
  /* Answer */
  #answer-reveal {
    display: none; background: #FFF8F0; border: 1px solid #F0E0C0;
    border-radius: 8px; padding: 16px; margin: 16px 0;
  }
  #answer-reveal .label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  #answer-text { font-size: 22px; font-weight: 600; color: var(--primary); }
  /* Buttons */
  .action-btn {
    border: none; border-radius: 8px; padding: 12px 28px; font-size: 16px;
    font-weight: 700; cursor: pointer; margin: 6px;
  }
  #record-btn { display: none; background: var(--primary); color: #fff; }
  #record-btn:hover { background: var(--primary-dk); }
  #stop-btn { display: none; background: #C0392B; color: #fff; }
  #replay-btn { display: none; background: #fff; color: var(--primary); border: 2px solid var(--primary); padding: 8px 20px; font-size: 13px; margin-top: 8px; }
  #btn-got-it { display: none; background: #27AE60; color: #fff; }
  #btn-missed { display: none; background: #C0392B; color: #fff; }
  #btn-skip { display: none; background: #E0E0E0; color: #555; font-size: 13px; padding: 8px 20px; }
  /* Tip card */
  #tip-card {
    display: none; background: #FFFDE7; border: 1px solid #FFF176; border-radius: 8px;
    padding: 14px 16px; margin-bottom: 20px; text-align: left; position: relative;
  }
  #tip-card .tip-title { font-size: 12px; font-weight: 700; color: #F9A825; text-transform: uppercase; margin-bottom: 6px; }
  #tip-text { font-size: 14px; color: #333; line-height: 1.5; }
  #tip-dismiss { position: absolute; top: 8px; right: 10px; background: none; border: none; font-size: 16px; color: #999; cursor: pointer; }
  /* Progress strip */
  #num-strip { background: var(--primary-dk); padding: 6px 20px; display: flex; align-items: center; gap: 14px; color: rgba(255,255,255,0.7); font-size: 12px; }
  #num-strip .val { color: #FFD700; font-weight: 700; }
  /* Session end */
  #session-end { display: none; max-width: 400px; margin: 60px auto; padding: 32px; background: #fff; border-radius: 12px; text-align: center; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
  #session-end h2 { color: var(--primary); margin-bottom: 20px; }
  .end-stat { margin: 8px 0; font-size: 16px; color: #444; }
  .end-stat .val { font-weight: 700; color: var(--primary); }
  /* Start overlay */
  #start-overlay {
    position: fixed; inset: 0; background: rgba(0,0,0,0.5);
    display: flex; align-items: center; justify-content: center; z-index: 100;
  }
  #start-card { background: #fff; border-radius: 12px; padding: 32px 28px; text-align: center; max-width: 360px; width: 90%; }
  #start-card h2 { color: var(--primary); margin-bottom: 10px; }
  #start-card p { color: #666; font-size: 14px; margin-bottom: 20px; line-height: 1.5; }
  #btn-start { background: var(--primary); color: #fff; border: none; padding: 12px 36px; border-radius: 8px; font-size: 16px; font-weight: 700; cursor: pointer; }
  #btn-start:hover { background: var(--primary-dk); }
  audio { display: none; }
</style>
</head>
<body>

<div id="topbar">
  <h1>VIET NUMBERS</h1>
  <div class="spacer"></div>
  <button id="tip-btn" style="background:transparent;border:2px solid rgba(255,255,255,0.3);color:rgba(255,255,255,0.6);border-radius:6px;padding:5px 10px;cursor:pointer;font-size:13px;font-weight:600;">? Tip</button>
  <span id="level-badge" style="color:rgba(255,255,255,0.7);font-size:13px;"></span>
  <a href="/viet" class="mode-btn" style="text-decoration:none"><i class="fa-solid fa-arrow-left"></i> Back</a>
</div>

<div id="num-strip">
  <span>Streak: <span class="val" id="num-streak">0</span></span>
  <span>Level: <span class="val" id="num-level">1</span></span>
  <span id="num-progress">0/5 to Level 2</span>
</div>

<div id="main-area">
  <div id="tip-card">
    <div class="tip-title"><i class="fa-solid fa-lightbulb"></i> Tip</div>
    <div id="tip-text"></div>
    <button id="tip-dismiss">&times;</button>
  </div>

  <div id="number-display"></div>
  <div id="countdown-wrap"><div id="countdown-bar"></div></div>

  <button class="action-btn" id="record-btn"><i class="fa-solid fa-microphone"></i> Record</button>
  <button class="action-btn" id="stop-btn"><i class="fa-solid fa-stop"></i> Stop</button>
  <div id="recording-indicator" aria-live="polite"><div class="dot"></div> Recording…</div>

  <button class="action-btn" id="replay-btn"><i class="fa-solid fa-play"></i> Replay</button>
  <audio id="playback-audio"></audio>

  <div id="answer-reveal">
    <div class="label">Answer</div>
    <div id="answer-text"></div>
  </div>

  <div>
    <button class="action-btn" id="btn-got-it"><i class="fa-solid fa-check"></i> Got it</button>
    <button class="action-btn" id="btn-missed"><i class="fa-solid fa-xmark"></i> Missed it</button>
  </div>
  <button class="action-btn" id="btn-skip">Skip</button>
</div>

<div id="session-end">
  <h2>Session Complete</h2>
  <div class="end-stat">Rounds: <span class="val" id="end-attempts">0</span></div>
  <div class="end-stat">Correct: <span class="val" id="end-correct">0</span></div>
  <div class="end-stat">Accuracy: <span class="val" id="end-accuracy">—</span></div>
  <div class="end-stat">Best Level: <span class="val" id="end-level">1</span></div>
  <br>
  <button class="action-btn" id="btn-retry" style="background:var(--primary);color:#fff;">Try Again</button>
  <a href="/viet" class="action-btn" id="btn-home" style="background:#E0E0E0;color:#555;text-decoration:none;display:inline-block;">Home</a>
</div>

<div id="start-overlay">
  <div id="start-card">
    <h2>Viet Numbers</h2>
    <p>A number will appear. You have a few seconds to read it, then record yourself saying it. Play back and self-assess.</p>
    <button id="btn-start">Start</button>
  </div>
</div>

<script src="/static/viet_numbers_config.js"></script>
<script src="/static/numbers.js"></script>
</body>
</html>
```

- [ ] **Step 2: Run the Flask app and manually verify the page loads**

Run: `cd /Users/wongshennan/Documents/personal/apps/learning-practice/language-vocab-practice && python app.py`
Open: `http://localhost:5001/viet/numbers`
Expected: Start overlay appears, clicking Start shows a number with countdown, record/assess flow works.

- [ ] **Step 3: Run route tests to confirm nothing broke**

Run: `cd /Users/wongshennan/Documents/personal/apps/learning-practice/language-vocab-practice && python -m pytest tests/test_routes.py -v`
Expected: All PASS

- [ ] **Step 4: Commit**

```bash
git add templates/viet_numbers.html
git commit -m "feat: build Vietnamese numbers pronunciation practice page"
```

---

### Task 6: Implement Indonesian numberToWords + template

**Files:**
- Create: `static/bahasa_numbers_config.js`
- Create: `tests/test_bahasa_numbers_config.html`
- Modify: `templates/bahasa_numbers.html` (replace placeholder)

- [ ] **Step 1: Create test file for Indonesian numberToWords**

Create `tests/test_bahasa_numbers_config.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Indonesian numberToWords Tests</title>
</head>
<body>
<pre id="out"></pre>
<script src="../static/bahasa_numbers_config.js"></script>
<script>
  var toWords = window.NUMBER_CONFIG.numberToWords;
  var results = [];
  var passed = 0, failed = 0;

  function assert(label, got, expected) {
    var ok = got === expected;
    if (ok) { passed++; } else { failed++; }
    results.push((ok ? 'PASS' : 'FAIL') + '  ' + label +
      (ok ? '' : '\n    got:      "' + got + '"\n    expected: "' + expected + '"'));
  }

  assert('0', toWords(0), 'nol');
  assert('1', toWords(1), 'satu');
  assert('5', toWords(5), 'lima');
  assert('10', toWords(10), 'sepuluh');
  assert('11', toWords(11), 'sebelas');
  assert('12', toWords(12), 'dua belas');
  assert('19', toWords(19), 'sembilan belas');
  assert('20', toWords(20), 'dua puluh');
  assert('21', toWords(21), 'dua puluh satu');
  assert('99', toWords(99), 'sembilan puluh sembilan');
  assert('100', toWords(100), 'seratus');
  assert('101', toWords(101), 'seratus satu');
  assert('111', toWords(111), 'seratus sebelas');
  assert('200', toWords(200), 'dua ratus');
  assert('342', toWords(342), 'tiga ratus empat puluh dua');
  assert('999', toWords(999), 'sembilan ratus sembilan puluh sembilan');
  assert('1000', toWords(1000), 'seribu');
  assert('1001', toWords(1001), 'seribu satu');
  assert('1100', toWords(1100), 'seribu seratus');
  assert('2500', toWords(2500), 'dua ribu lima ratus');
  assert('10000', toWords(10000), 'sepuluh ribu');
  assert('12345', toWords(12345), 'dua belas ribu tiga ratus empat puluh lima');
  assert('100000', toWords(100000), 'seratus ribu');
  assert('1000000', toWords(1000000), 'satu juta');

  var out = document.getElementById('out');
  out.textContent = results.join('\n') + '\n\n' + passed + ' passed, ' + failed + ' failed';
  if (failed > 0) out.style.color = 'red';
  else out.style.color = 'green';
</script>
</body>
</html>
```

- [ ] **Step 2: Create bahasa_numbers_config.js**

Create `static/bahasa_numbers_config.js`:

```javascript
/* Indonesian NUMBER_CONFIG — numberToWords + levelTips */
(function () {
'use strict';

var ones = ['nol', 'satu', 'dua', 'tiga', 'empat', 'lima', 'enam', 'tujuh', 'delapan', 'sembilan'];

function numberToWords(n) {
  if (n === 0) return 'nol';
  if (n < 0) return 'minus ' + numberToWords(-n);
  if (n >= 1000000) {
    var m = Math.floor(n / 1000000);
    var rest = n % 1000000;
    return numberToWords(m) + ' juta' + (rest > 0 ? ' ' + numberToWords(rest) : '');
  }
  if (n >= 1000) {
    var k = Math.floor(n / 1000);
    var rest = n % 1000;
    var prefix = (k === 1) ? 'seribu' : numberToWords(k) + ' ribu';
    return prefix + (rest > 0 ? ' ' + numberToWords(rest) : '');
  }
  if (n >= 100) {
    var h = Math.floor(n / 100);
    var rest = n % 100;
    var prefix = (h === 1) ? 'seratus' : ones[h] + ' ratus';
    return prefix + (rest > 0 ? ' ' + numberToWords(rest) : '');
  }
  if (n >= 20) {
    var t = Math.floor(n / 10);
    var u = n % 10;
    return ones[t] + ' puluh' + (u > 0 ? ' ' + ones[u] : '');
  }
  if (n >= 12) {
    return ones[n - 10] + ' belas';
  }
  if (n === 11) return 'sebelas';
  if (n === 10) return 'sepuluh';
  return ones[n];
}

window.NUMBER_CONFIG = {
  lang: 'id-ID',
  langKey: 'bahasa',
  numberToWords: numberToWords,
  levelTips: [
    'Digits 1–10: satu, dua, tiga, empat, lima, enam, tujuh, delapan, sembilan, sepuluh.',
    '11 = sebelas (special). 12–19: [digit] belas (dua belas, tiga belas…). Tens: [digit] puluh (dua puluh, tiga puluh…).',
    'Hundreds: [digit] ratus. Exception: 100 = seratus (not satu ratus). 342 = tiga ratus empat puluh dua.',
    'Thousands: [digit] ribu. Exception: 1,000 = seribu (not satu ribu). 2,500 = dua ribu lima ratus.',
    'Large numbers: ratus ribu (hundred thousands), juta (millions). 100,000 = seratus ribu. 1,000,000 = satu juta.',
  ],
};

})();
```

- [ ] **Step 3: Run tests in browser**

Run: `open /Users/wongshennan/Documents/personal/apps/learning-practice/language-vocab-practice/tests/test_bahasa_numbers_config.html`
Expected: All PASS

- [ ] **Step 4: Build the bahasa_numbers.html template**

Replace `templates/bahasa_numbers.html` — same structure as `viet_numbers.html` but with:
- Title: "Bahasa Numbers"
- CSS vars: `--primary: #1A3C5E; --primary-dk: #162E48; --accent: #2E6DA4; --accent2: #1ABC9C;`
- Topbar: "BAHASA NUMBERS", back link to `/bahasa`
- Scripts: `bahasa_numbers_config.js` + `numbers.js`
- Home link points to `/bahasa`

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Bahasa Numbers — Pronunciation Practice</title>
<link rel="stylesheet" href="/static/shared.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
<style>
  :root {
    --primary:    #1A3C5E;
    --primary-dk: #162E48;
    --accent:     #2E6DA4;
    --accent2:    #1ABC9C;
    --lgrey:      #F0F4F8;
    --dgrey:      #6C7A8A;
  }
  #main-area { display: none; max-width: 480px; margin: 0 auto; padding: 24px 16px; text-align: center; }
  #number-display { font-size: 56px; font-weight: 700; color: var(--primary); margin: 32px 0 16px; min-height: 70px; }
  #countdown-wrap { width: 100%; height: 6px; background: #E0E0E0; border-radius: 3px; margin-bottom: 24px; overflow: hidden; }
  #countdown-bar { height: 100%; background: var(--accent); border-radius: 3px; width: 0%; }
  #recording-indicator { display: none; align-items: center; justify-content: center; gap: 8px; font-size: 14px; color: #C0392B; margin-bottom: 16px; }
  #recording-indicator .dot { width: 12px; height: 12px; border-radius: 50%; background: #C0392B; animation: pulse 1s infinite; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
  #answer-reveal { display: none; background: #F0F8F4; border: 1px solid #C0E0D0; border-radius: 8px; padding: 16px; margin: 16px 0; }
  #answer-reveal .label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  #answer-text { font-size: 22px; font-weight: 600; color: var(--primary); }
  .action-btn { border: none; border-radius: 8px; padding: 12px 28px; font-size: 16px; font-weight: 700; cursor: pointer; margin: 6px; }
  #record-btn { display: none; background: var(--primary); color: #fff; }
  #record-btn:hover { background: var(--primary-dk); }
  #stop-btn { display: none; background: #C0392B; color: #fff; }
  #replay-btn { display: none; background: #fff; color: var(--primary); border: 2px solid var(--primary); padding: 8px 20px; font-size: 13px; margin-top: 8px; }
  #btn-got-it { display: none; background: #27AE60; color: #fff; }
  #btn-missed { display: none; background: #C0392B; color: #fff; }
  #btn-skip { display: none; background: #E0E0E0; color: #555; font-size: 13px; padding: 8px 20px; }
  #tip-card { display: none; background: #E8F5E9; border: 1px solid #A5D6A7; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px; text-align: left; position: relative; }
  #tip-card .tip-title { font-size: 12px; font-weight: 700; color: #2E7D32; text-transform: uppercase; margin-bottom: 6px; }
  #tip-text { font-size: 14px; color: #333; line-height: 1.5; }
  #tip-dismiss { position: absolute; top: 8px; right: 10px; background: none; border: none; font-size: 16px; color: #999; cursor: pointer; }
  #num-strip { background: var(--primary-dk); padding: 6px 20px; display: flex; align-items: center; gap: 14px; color: rgba(255,255,255,0.7); font-size: 12px; }
  #num-strip .val { color: var(--accent2); font-weight: 700; }
  #session-end { display: none; max-width: 400px; margin: 60px auto; padding: 32px; background: #fff; border-radius: 12px; text-align: center; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
  #session-end h2 { color: var(--primary); margin-bottom: 20px; }
  .end-stat { margin: 8px 0; font-size: 16px; color: #444; }
  .end-stat .val { font-weight: 700; color: var(--primary); }
  #start-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
  #start-card { background: #fff; border-radius: 12px; padding: 32px 28px; text-align: center; max-width: 360px; width: 90%; }
  #start-card h2 { color: var(--primary); margin-bottom: 10px; }
  #start-card p { color: #666; font-size: 14px; margin-bottom: 20px; line-height: 1.5; }
  #btn-start { background: var(--primary); color: #fff; border: none; padding: 12px 36px; border-radius: 8px; font-size: 16px; font-weight: 700; cursor: pointer; }
  #btn-start:hover { background: var(--primary-dk); }
  audio { display: none; }
</style>
</head>
<body>
<div id="topbar">
  <h1><i class="fa-solid fa-language"></i> BAHASA NUMBERS</h1>
  <div class="spacer"></div>
  <button id="tip-btn" style="background:transparent;border:2px solid rgba(255,255,255,0.3);color:rgba(255,255,255,0.6);border-radius:6px;padding:5px 10px;cursor:pointer;font-size:13px;font-weight:600;">? Tip</button>
  <span id="level-badge" style="color:rgba(255,255,255,0.7);font-size:13px;"></span>
  <a href="/bahasa" class="mode-btn" style="text-decoration:none"><i class="fa-solid fa-arrow-left"></i> Back</a>
</div>
<div id="num-strip">
  <span>Streak: <span class="val" id="num-streak">0</span></span>
  <span>Level: <span class="val" id="num-level">1</span></span>
  <span id="num-progress">0/5 to Level 2</span>
</div>
<div id="main-area">
  <div id="tip-card"><div class="tip-title"><i class="fa-solid fa-lightbulb"></i> Tip</div><div id="tip-text"></div><button id="tip-dismiss">&times;</button></div>
  <div id="number-display"></div>
  <div id="countdown-wrap"><div id="countdown-bar"></div></div>
  <button class="action-btn" id="record-btn"><i class="fa-solid fa-microphone"></i> Record</button>
  <button class="action-btn" id="stop-btn"><i class="fa-solid fa-stop"></i> Stop</button>
  <div id="recording-indicator" aria-live="polite"><div class="dot"></div> Recording…</div>
  <button class="action-btn" id="replay-btn"><i class="fa-solid fa-play"></i> Replay</button>
  <audio id="playback-audio"></audio>
  <div id="answer-reveal"><div class="label">Answer</div><div id="answer-text"></div></div>
  <div><button class="action-btn" id="btn-got-it"><i class="fa-solid fa-check"></i> Got it</button><button class="action-btn" id="btn-missed"><i class="fa-solid fa-xmark"></i> Missed it</button></div>
  <button class="action-btn" id="btn-skip">Skip</button>
</div>
<div id="session-end">
  <h2>Session Complete</h2>
  <div class="end-stat">Rounds: <span class="val" id="end-attempts">0</span></div>
  <div class="end-stat">Correct: <span class="val" id="end-correct">0</span></div>
  <div class="end-stat">Accuracy: <span class="val" id="end-accuracy">—</span></div>
  <div class="end-stat">Best Level: <span class="val" id="end-level">1</span></div>
  <br>
  <button class="action-btn" id="btn-retry" style="background:var(--primary);color:#fff;">Try Again</button>
  <a href="/bahasa" class="action-btn" id="btn-home" style="background:#E0E0E0;color:#555;text-decoration:none;display:inline-block;">Home</a>
</div>
<div id="start-overlay">
  <div id="start-card">
    <h2>Bahasa Numbers</h2>
    <p>A number will appear. You have a few seconds to read it, then record yourself saying it. Play back and self-assess.</p>
    <button id="btn-start">Start</button>
  </div>
</div>
<script src="/static/bahasa_numbers_config.js"></script>
<script src="/static/numbers.js"></script>
</body>
</html>
```

- [ ] **Step 5: Verify manually and run route tests**

Run: `cd /Users/wongshennan/Documents/personal/apps/learning-practice/language-vocab-practice && python -m pytest tests/test_routes.py -v`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add static/bahasa_numbers_config.js tests/test_bahasa_numbers_config.html templates/bahasa_numbers.html
git commit -m "feat: add Indonesian number pronunciation practice with numberToWords"
```

---

### Task 7: Implement Spanish numberToWords + template

**Files:**
- Create: `static/spanish_numbers_config.js`
- Create: `tests/test_spanish_numbers_config.html`
- Modify: `templates/spanish_numbers.html` (replace placeholder)

- [ ] **Step 1: Create test file for Spanish numberToWords**

Create `tests/test_spanish_numbers_config.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Spanish numberToWords Tests</title>
</head>
<body>
<pre id="out"></pre>
<script src="../static/spanish_numbers_config.js"></script>
<script>
  var toWords = window.NUMBER_CONFIG.numberToWords;
  var results = [];
  var passed = 0, failed = 0;

  function assert(label, got, expected) {
    var ok = got === expected;
    if (ok) { passed++; } else { failed++; }
    results.push((ok ? 'PASS' : 'FAIL') + '  ' + label +
      (ok ? '' : '\n    got:      "' + got + '"\n    expected: "' + expected + '"'));
  }

  assert('0', toWords(0), 'cero');
  assert('1', toWords(1), 'uno');
  assert('10', toWords(10), 'diez');
  assert('11', toWords(11), 'once');
  assert('15', toWords(15), 'quince');
  assert('16', toWords(16), 'dieciséis');
  assert('19', toWords(19), 'diecinueve');
  assert('20', toWords(20), 'veinte');
  assert('21', toWords(21), 'veintiuno');
  assert('22', toWords(22), 'veintidós');
  assert('23', toWords(23), 'veintitrés');
  assert('29', toWords(29), 'veintinueve');
  assert('30', toWords(30), 'treinta');
  assert('31', toWords(31), 'treinta y uno');
  assert('42', toWords(42), 'cuarenta y dos');
  assert('55', toWords(55), 'cincuenta y cinco');
  assert('99', toWords(99), 'noventa y nueve');
  assert('100', toWords(100), 'cien');
  assert('101', toWords(101), 'ciento uno');
  assert('200', toWords(200), 'doscientos');
  assert('300', toWords(300), 'trescientos');
  assert('342', toWords(342), 'trescientos cuarenta y dos');
  assert('500', toWords(500), 'quinientos');
  assert('700', toWords(700), 'setecientos');
  assert('900', toWords(900), 'novecientos');
  assert('999', toWords(999), 'novecientos noventa y nueve');
  assert('1000', toWords(1000), 'mil');
  assert('1001', toWords(1001), 'mil uno');
  assert('1100', toWords(1100), 'mil cien');
  assert('2000', toWords(2000), 'dos mil');
  assert('2500', toWords(2500), 'dos mil quinientos');
  assert('10000', toWords(10000), 'diez mil');
  assert('12345', toWords(12345), 'doce mil trescientos cuarenta y cinco');
  assert('100000', toWords(100000), 'cien mil');
  assert('999999', toWords(999999), 'novecientos noventa y nueve mil novecientos noventa y nueve');
  assert('1000000', toWords(1000000), 'un millón');

  var out = document.getElementById('out');
  out.textContent = results.join('\n') + '\n\n' + passed + ' passed, ' + failed + ' failed';
  if (failed > 0) out.style.color = 'red';
  else out.style.color = 'green';
</script>
</body>
</html>
```

- [ ] **Step 2: Create spanish_numbers_config.js**

Create `static/spanish_numbers_config.js`:

```javascript
/* Spanish NUMBER_CONFIG — numberToWords + levelTips (gender-neutral) */
(function () {
'use strict';

var ones = ['', 'uno', 'dos', 'tres', 'cuatro', 'cinco', 'seis', 'siete', 'ocho', 'nueve'];
var teens = ['diez', 'once', 'doce', 'trece', 'catorce', 'quince', 'dieciséis', 'diecisiete', 'dieciocho', 'diecinueve'];
var twenties = ['veinte', 'veintiuno', 'veintidós', 'veintitrés', 'veinticuatro', 'veinticinco', 'veintiséis', 'veintisiete', 'veintiocho', 'veintinueve'];
var tens = ['', '', '', 'treinta', 'cuarenta', 'cincuenta', 'sesenta', 'setenta', 'ochenta', 'noventa'];
var hundreds = ['', 'ciento', 'doscientos', 'trescientos', 'cuatrocientos', 'quinientos', 'seiscientos', 'setecientos', 'ochocientos', 'novecientos'];

function numberToWords(n) {
  if (n === 0) return 'cero';
  if (n < 0) return 'menos ' + numberToWords(-n);

  if (n >= 1000000) {
    var m = Math.floor(n / 1000000);
    var rest = n % 1000000;
    var prefix = (m === 1) ? 'un millón' : numberToWords(m) + ' millones';
    return prefix + (rest > 0 ? ' ' + numberToWords(rest) : '');
  }

  if (n >= 1000) {
    var k = Math.floor(n / 1000);
    var rest = n % 1000;
    var prefix = (k === 1) ? 'mil' : numberToWords(k) + ' mil';
    return prefix + (rest > 0 ? ' ' + numberToWords(rest) : '');
  }

  if (n >= 100) {
    var h = Math.floor(n / 100);
    var rest = n % 100;
    if (h === 1 && rest === 0) return 'cien';
    return hundreds[h] + (rest > 0 ? ' ' + numberToWords(rest) : '');
  }

  if (n >= 30) {
    var t = Math.floor(n / 10);
    var u = n % 10;
    return tens[t] + (u > 0 ? ' y ' + ones[u] : '');
  }

  if (n >= 20) return twenties[n - 20];
  if (n >= 10) return teens[n - 10];
  return ones[n];
}

window.NUMBER_CONFIG = {
  lang: 'es-ES',
  langKey: 'spanish',
  numberToWords: numberToWords,
  levelTips: [
    'Digits 1–10: uno, dos, tres, cuatro, cinco, seis, siete, ocho, nueve, diez.',
    '11–15 are unique: once, doce, trece, catorce, quince. 16–19: dieciséis, diecisiete… 20 = veinte. 21–29 are one word: veintiuno, veintidós… 30+: treinta y uno, cuarenta y dos…',
    '100 = cien (standalone) or ciento (before more). 200–900 have special forms: doscientos, trescientos, cuatrocientos, quinientos, seiscientos, setecientos, ochocientos, novecientos.',
    '1,000 = mil (not un mil). 2,000 = dos mil. Compound: 2,500 = dos mil quinientos.',
    'Large: cien mil = 100,000. Un millón = 1,000,000. Plural: dos millones. Note: millón takes "de" before nouns (un millón de pesos).',
  ],
};

})();
```

- [ ] **Step 3: Run tests in browser**

Run: `open /Users/wongshennan/Documents/personal/apps/learning-practice/language-vocab-practice/tests/test_spanish_numbers_config.html`
Expected: All PASS

- [ ] **Step 4: Build the spanish_numbers.html template**

Replace `templates/spanish_numbers.html` — same structure as Vietnamese but with:
- Title: "Spanish Numbers"
- CSS vars: `--primary: #C60B1E; --primary-dk: #9A0918; --accent: #C60B1E; --accent2: #FFC400;`
- Topbar: "SPANISH NUMBERS", back link to `/spanish`
- Scripts: `spanish_numbers_config.js` + `numbers.js`
- Tip card styled with warm yellow: `background: #FFF8E1; border: 1px solid #FFE082;`

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Spanish Numbers — Pronunciation Practice</title>
<link rel="stylesheet" href="/static/shared.css">
<link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
<style>
  :root {
    --primary:    #C60B1E;
    --primary-dk: #9A0918;
    --accent:     #C60B1E;
    --accent2:    #FFC400;
    --lgrey:      #FDF8F0;
    --dgrey:      #6C7A8A;
  }
  #main-area { display: none; max-width: 480px; margin: 0 auto; padding: 24px 16px; text-align: center; }
  #number-display { font-size: 56px; font-weight: 700; color: var(--primary); margin: 32px 0 16px; min-height: 70px; }
  #countdown-wrap { width: 100%; height: 6px; background: #E0E0E0; border-radius: 3px; margin-bottom: 24px; overflow: hidden; }
  #countdown-bar { height: 100%; background: var(--accent2); border-radius: 3px; width: 0%; }
  #recording-indicator { display: none; align-items: center; justify-content: center; gap: 8px; font-size: 14px; color: #C0392B; margin-bottom: 16px; }
  #recording-indicator .dot { width: 12px; height: 12px; border-radius: 50%; background: #C0392B; animation: pulse 1s infinite; }
  @keyframes pulse { 0%,100% { opacity: 1; } 50% { opacity: 0.3; } }
  #answer-reveal { display: none; background: #FFF8E1; border: 1px solid #FFE082; border-radius: 8px; padding: 16px; margin: 16px 0; }
  #answer-reveal .label { font-size: 11px; color: #888; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 4px; }
  #answer-text { font-size: 22px; font-weight: 600; color: var(--primary); }
  .action-btn { border: none; border-radius: 8px; padding: 12px 28px; font-size: 16px; font-weight: 700; cursor: pointer; margin: 6px; }
  #record-btn { display: none; background: var(--primary); color: #fff; }
  #record-btn:hover { background: var(--primary-dk); }
  #stop-btn { display: none; background: #C0392B; color: #fff; }
  #replay-btn { display: none; background: #fff; color: var(--primary); border: 2px solid var(--primary); padding: 8px 20px; font-size: 13px; margin-top: 8px; }
  #btn-got-it { display: none; background: #27AE60; color: #fff; }
  #btn-missed { display: none; background: #C0392B; color: #fff; }
  #btn-skip { display: none; background: #E0E0E0; color: #555; font-size: 13px; padding: 8px 20px; }
  #tip-card { display: none; background: #FFF8E1; border: 1px solid #FFE082; border-radius: 8px; padding: 14px 16px; margin-bottom: 20px; text-align: left; position: relative; }
  #tip-card .tip-title { font-size: 12px; font-weight: 700; color: #F9A825; text-transform: uppercase; margin-bottom: 6px; }
  #tip-text { font-size: 14px; color: #333; line-height: 1.5; }
  #tip-dismiss { position: absolute; top: 8px; right: 10px; background: none; border: none; font-size: 16px; color: #999; cursor: pointer; }
  #num-strip { background: var(--primary-dk); padding: 6px 20px; display: flex; align-items: center; gap: 14px; color: rgba(255,255,255,0.7); font-size: 12px; }
  #num-strip .val { color: var(--accent2); font-weight: 700; }
  #session-end { display: none; max-width: 400px; margin: 60px auto; padding: 32px; background: #fff; border-radius: 12px; text-align: center; box-shadow: 0 2px 12px rgba(0,0,0,0.08); }
  #session-end h2 { color: var(--primary); margin-bottom: 20px; }
  .end-stat { margin: 8px 0; font-size: 16px; color: #444; }
  .end-stat .val { font-weight: 700; color: var(--primary); }
  #start-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.5); display: flex; align-items: center; justify-content: center; z-index: 100; }
  #start-card { background: #fff; border-radius: 12px; padding: 32px 28px; text-align: center; max-width: 360px; width: 90%; }
  #start-card h2 { color: var(--primary); margin-bottom: 10px; }
  #start-card p { color: #666; font-size: 14px; margin-bottom: 20px; line-height: 1.5; }
  #btn-start { background: var(--primary); color: #fff; border: none; padding: 12px 36px; border-radius: 8px; font-size: 16px; font-weight: 700; cursor: pointer; }
  #btn-start:hover { background: var(--primary-dk); }
  audio { display: none; }
</style>
</head>
<body>
<div id="topbar">
  <h1><i class="fa-solid fa-language"></i> SPANISH NUMBERS</h1>
  <div class="spacer"></div>
  <button id="tip-btn" style="background:transparent;border:2px solid rgba(255,255,255,0.3);color:rgba(255,255,255,0.6);border-radius:6px;padding:5px 10px;cursor:pointer;font-size:13px;font-weight:600;">? Tip</button>
  <span id="level-badge" style="color:rgba(255,255,255,0.7);font-size:13px;"></span>
  <a href="/spanish" class="mode-btn" style="text-decoration:none"><i class="fa-solid fa-arrow-left"></i> Back</a>
</div>
<div id="num-strip">
  <span>Streak: <span class="val" id="num-streak">0</span></span>
  <span>Level: <span class="val" id="num-level">1</span></span>
  <span id="num-progress">0/5 to Level 2</span>
</div>
<div id="main-area">
  <div id="tip-card"><div class="tip-title"><i class="fa-solid fa-lightbulb"></i> Tip</div><div id="tip-text"></div><button id="tip-dismiss">&times;</button></div>
  <div id="number-display"></div>
  <div id="countdown-wrap"><div id="countdown-bar"></div></div>
  <button class="action-btn" id="record-btn"><i class="fa-solid fa-microphone"></i> Record</button>
  <button class="action-btn" id="stop-btn"><i class="fa-solid fa-stop"></i> Stop</button>
  <div id="recording-indicator" aria-live="polite"><div class="dot"></div> Recording…</div>
  <button class="action-btn" id="replay-btn"><i class="fa-solid fa-play"></i> Replay</button>
  <audio id="playback-audio"></audio>
  <div id="answer-reveal"><div class="label">Answer</div><div id="answer-text"></div></div>
  <div><button class="action-btn" id="btn-got-it"><i class="fa-solid fa-check"></i> Got it</button><button class="action-btn" id="btn-missed"><i class="fa-solid fa-xmark"></i> Missed it</button></div>
  <button class="action-btn" id="btn-skip">Skip</button>
</div>
<div id="session-end">
  <h2>Session Complete</h2>
  <div class="end-stat">Rounds: <span class="val" id="end-attempts">0</span></div>
  <div class="end-stat">Correct: <span class="val" id="end-correct">0</span></div>
  <div class="end-stat">Accuracy: <span class="val" id="end-accuracy">—</span></div>
  <div class="end-stat">Best Level: <span class="val" id="end-level">1</span></div>
  <br>
  <button class="action-btn" id="btn-retry" style="background:var(--primary);color:#fff;">Try Again</button>
  <a href="/spanish" class="action-btn" id="btn-home" style="background:#E0E0E0;color:#555;text-decoration:none;display:inline-block;">Home</a>
</div>
<div id="start-overlay">
  <div id="start-card">
    <h2>Spanish Numbers</h2>
    <p>A number will appear. You have a few seconds to read it, then record yourself saying it. Play back and self-assess.</p>
    <button id="btn-start">Start</button>
  </div>
</div>
<script src="/static/spanish_numbers_config.js"></script>
<script src="/static/numbers.js"></script>
</body>
</html>
```

- [ ] **Step 5: Verify manually and run route tests**

Run: `cd /Users/wongshennan/Documents/personal/apps/learning-practice/language-vocab-practice && python -m pytest tests/test_routes.py -v`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add static/spanish_numbers_config.js tests/test_spanish_numbers_config.html templates/spanish_numbers.html
git commit -m "feat: add Spanish number pronunciation practice with numberToWords"
```

---

### Task 8: Add navigation links from language pages

**Files:**
- Modify: `templates/viet.html:57-58` (add Numbers link after Typing link)
- Modify: `templates/bahasa.html:37-38` (add Numbers link after Guide link)
- Modify: `templates/spanish.html:51-52` (add Numbers link after Guide link)

- [ ] **Step 1: Add Numbers link to Vietnamese nav menu**

In `templates/viet.html`, after the Typing link (line 58), add:

```html
    <a href="/viet/numbers" class="mode-btn" style="text-decoration:none"><i class="fa-solid fa-hashtag"></i> Numbers</a>
```

- [ ] **Step 2: Add Numbers link to Indonesian nav menu**

In `templates/bahasa.html`, after the Guide link (line 37), add:

```html
    <a href="/bahasa/numbers" class="mode-btn" style="text-decoration:none"><i class="fa-solid fa-hashtag"></i> Numbers</a>
```

- [ ] **Step 3: Add Numbers link to Spanish nav menu**

In `templates/spanish.html`, after the Guide link (line 51), add:

```html
    <a href="/spanish/numbers" class="mode-btn" style="text-decoration:none"><i class="fa-solid fa-hashtag"></i> Numbers</a>
```

- [ ] **Step 4: Run route tests**

Run: `cd /Users/wongshennan/Documents/personal/apps/learning-practice/language-vocab-practice && python -m pytest tests/test_routes.py -v`
Expected: All PASS

- [ ] **Step 5: Commit**

```bash
git add templates/viet.html templates/bahasa.html templates/spanish.html
git commit -m "feat: add Numbers nav links to all three language pages"
```
