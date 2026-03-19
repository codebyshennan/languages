# Number Listening Practice Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Listen" mode toggle to all three number practice pages where TTS speaks a number and the user types what they heard.

**Architecture:** Extend `numbers.js` engine with listen-mode countdown durations and a new `initListenUI()` function. Add mode toggle + listen UI elements to each HTML template. TTS via Web Speech API with language-appropriate voices.

**Tech Stack:** Vanilla JS, Web Speech API (`SpeechSynthesis`), HTML/CSS, browser localStorage

---

### File Structure

- **Modify:** `static/numbers.js` — add `LISTEN_COUNTDOWNS`, extend `loadState`/`saveState` for mode suffix, add `initListenUI()` controller
- **Modify:** `templates/viet_numbers.html` — add mode toggle + listen mode DOM elements + CSS
- **Modify:** `templates/bahasa_numbers.html` — same changes as viet
- **Modify:** `templates/spanish_numbers.html` — same changes as spanish
- **Modify:** `tests/test_numbers.html` — add tests for listen mode state keys and countdown values

---

### Task 1: Add listen mode countdown durations and state key support to engine

**Files:**
- Modify: `static/numbers.js:1-110` (public API section)
- Test: `tests/test_numbers.html`

- [ ] **Step 1: Write failing tests for listen mode countdowns and state keys**

Add these tests to `tests/test_numbers.html` before the "Print results" section (before line 127):

```javascript
// Listen mode countdowns
assert('Listen countdown level 1 = 5', E.getCountdown(1, 'listen'), 5);
assert('Listen countdown level 2 = 7', E.getCountdown(2, 'listen'), 7);
assert('Listen countdown level 3 = 10', E.getCountdown(3, 'listen'), 10);
assert('Listen countdown level 4 = 12', E.getCountdown(4, 'listen'), 12);
assert('Listen countdown level 5 = 15', E.getCountdown(5, 'listen'), 15);

// Speak mode countdowns unchanged (backward compat)
assert('Speak countdown level 1 = 3 (default)', E.getCountdown(1), 3);
assert('Speak countdown level 5 = 7 (default)', E.getCountdown(5), 7);

// Listen mode state key
var listenState = E.createState();
E.saveState('test_listen', listenState, 'listen');
var loaded = E.loadState('test_listen', 'listen');
assert('Listen state loads from _listen key', loaded.level, 1);
localStorage.removeItem('numbers_progress_test_listen_listen');

// Speak and listen states are independent
var speakState = E.createState();
speakState.level = 3;
E.saveState('test_indep', speakState);
var listenState2 = E.createState();
listenState2.level = 1;
E.saveState('test_indep', listenState2, 'listen');
assert('Speak state independent', E.loadState('test_indep').level, 3);
assert('Listen state independent', E.loadState('test_indep', 'listen').level, 1);
localStorage.removeItem('numbers_progress_test_indep');
localStorage.removeItem('numbers_progress_test_indep_listen');
```

- [ ] **Step 2: Open `tests/test_numbers.html` in browser, verify new tests fail**

Expected: FAIL on `getCountdown` with 'listen' arg and `saveState`/`loadState` with mode arg.

- [ ] **Step 3: Implement listen countdowns and mode-aware state in `numbers.js`**

In `static/numbers.js`, add `LISTEN_COUNTDOWNS` array after `STREAK_TO_ADVANCE` (line 14):

```javascript
var LISTEN_COUNTDOWNS = [5, 7, 10, 12, 15]; // per level, for listen mode
```

Update `loadState` (line 23) to accept optional mode parameter:

```javascript
function loadState(langKey, mode) {
  try {
    var key = STORAGE_PREFIX + langKey + (mode === 'listen' ? '_listen' : '');
    var raw = localStorage.getItem(key);
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
```

Update `saveState` (line 40) to accept optional mode parameter:

```javascript
function saveState(langKey, state, mode) {
  try {
    var key = STORAGE_PREFIX + langKey + (mode === 'listen' ? '_listen' : '');
    localStorage.setItem(key, JSON.stringify(state));
  } catch (e) { /* ignore */ }
}
```

Update `getCountdown` (line 79) to accept optional mode parameter:

```javascript
function getCountdown(level, mode) {
  if (mode === 'listen') {
    return LISTEN_COUNTDOWNS[level - 1] || LISTEN_COUNTDOWNS[0];
  }
  var cfg = LEVELS[level - 1] || LEVELS[0];
  return cfg.countdown;
}
```

Add `LISTEN_COUNTDOWNS` to the public API object (after line 108):

```javascript
LISTEN_COUNTDOWNS: LISTEN_COUNTDOWNS,
```

- [ ] **Step 4: Open `tests/test_numbers.html` in browser, verify all tests pass**

Expected: All existing + new tests PASS.

- [ ] **Step 5: Commit**

```bash
git add static/numbers.js tests/test_numbers.html
git commit -m "feat: add listen mode countdown durations and mode-aware state keys"
```

---

### Task 2: Add `initListenUI()` controller to engine

**Files:**
- Modify: `static/numbers.js:112-364` (UI Controller section)

- [ ] **Step 1: Add `initListenUI()` function**

In `static/numbers.js`, add the following function after the closing `}` of `initUI()` (after line 356) and before the DOMContentLoaded block (line 358):

```javascript
function initListenUI() {
  var config = window.NUMBER_CONFIG;
  if (!config) return;

  var langKey = config.langKey;
  var state = NumbersEngine.loadState(langKey, 'listen');
  var session = { attempts: 0, correct: 0 };

  // DOM refs — shared
  var elCountdown  = document.getElementById('countdown-bar');
  var elAnswer     = document.getElementById('answer-reveal');
  var elAnswerText = document.getElementById('answer-text');
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

  // DOM refs — listen mode specific
  var elSpeakerIcon  = document.getElementById('listen-speaker');
  var elListenReplay = document.getElementById('listen-replay');
  var elListenInput  = document.getElementById('listen-input');
  var elListenSubmit = document.getElementById('listen-submit');
  var elListenResult = document.getElementById('listen-result');
  var elNumberDisplay= document.getElementById('number-display');

  if (!elSpeakerIcon) return;

  // Hide speak-mode elements
  var speakEls = ['record-btn', 'stop-btn', 'replay-btn', 'recording-indicator', 'playback-audio', 'btn-got-it', 'btn-missed', 'btn-skip'];
  speakEls.forEach(function(id) {
    var el = document.getElementById(id);
    if (el) el.style.display = 'none';
  });
  if (elNumberDisplay) elNumberDisplay.style.display = 'none';

  var countdownTimer = null;
  var currentNumber = null;
  var lastShownLevel = 0;
  var roundActive = false;

  // TTS setup
  var ttsVoice = null;
  var voices = speechSynthesis.getVoices();
  function pickVoice() {
    voices = speechSynthesis.getVoices();
    var lang = config.lang; // e.g. 'vi-VN'
    var langShort = lang.split('-')[0]; // e.g. 'vi'
    for (var i = 0; i < voices.length; i++) {
      if (voices[i].lang === lang) { ttsVoice = voices[i]; return; }
    }
    for (var j = 0; j < voices.length; j++) {
      if (voices[j].lang.indexOf(langShort) === 0) { ttsVoice = voices[j]; return; }
    }
  }
  pickVoice();
  if (speechSynthesis.onvoiceschanged !== undefined) {
    speechSynthesis.onvoiceschanged = pickVoice;
  }

  function speak(text, onEnd) {
    speechSynthesis.cancel();
    var utter = new SpeechSynthesisUtterance(text);
    if (ttsVoice) utter.voice = ttsVoice;
    utter.lang = config.lang;
    utter.rate = 1.0;
    if (onEnd) utter.onend = onEnd;
    utter.onerror = function() { if (onEnd) onEnd(); };
    speechSynthesis.speak(utter);
  }

  // UI helpers
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

  function dismissTip() { elTipCard.style.display = 'none'; }

  function hideListenControls() {
    elCountdown.style.width = '0%';
    elListenReplay.style.display = 'none';
    elListenInput.style.display = 'none';
    elListenSubmit.style.display = 'none';
    elListenResult.style.display = 'none';
    elAnswer.style.display = 'none';
    elSpeakerIcon.style.display = 'none';
  }

  // Round flow
  function startRound() {
    hideListenControls();
    showTipIfNew();
    updateProgressStrip();
    roundActive = true;

    currentNumber = NumbersEngine.generateNumber(state.level);
    var words = config.numberToWords(currentNumber);

    // Show speaker icon
    elSpeakerIcon.style.display = 'block';
    elListenInput.value = '';

    // Speak the number, then start countdown
    speak(words, function() {
      if (!roundActive) return;
      // Show input controls
      elListenInput.style.display = 'inline-block';
      elListenSubmit.style.display = 'inline-block';
      elListenReplay.style.display = 'inline-block';
      elListenInput.focus();

      // Start countdown
      var duration = NumbersEngine.getCountdown(state.level, 'listen');
      elCountdown.style.transition = 'none';
      elCountdown.style.width = '100%';
      elCountdown.offsetWidth; // force reflow
      elCountdown.style.transition = 'width ' + duration + 's linear';
      elCountdown.style.width = '0%';

      countdownTimer = setTimeout(function() {
        if (roundActive) submitAnswer();
      }, duration * 1000);
    });
  }

  function submitAnswer() {
    if (!roundActive) return;
    roundActive = false;
    clearTimeout(countdownTimer);
    elCountdown.style.transition = 'none';
    elCountdown.style.width = '0%';

    var raw = elListenInput.value.replace(/[,\s]/g, '');
    var userAnswer = parseInt(raw, 10);
    var correct = (!isNaN(userAnswer) && userAnswer === currentNumber);

    session.attempts++;
    if (correct) session.correct++;
    NumbersEngine.recordResult(state, correct);
    NumbersEngine.saveState(langKey, state, 'listen');

    // Show result
    elListenInput.style.display = 'none';
    elListenSubmit.style.display = 'none';
    elListenReplay.style.display = 'none';

    elListenResult.textContent = correct ? 'Correct!' : 'Incorrect — ' + currentNumber.toLocaleString();
    elListenResult.className = 'listen-result ' + (correct ? 'listen-correct' : 'listen-incorrect');
    elListenResult.style.display = 'block';

    // Show answer word form
    elAnswerText.textContent = config.numberToWords(currentNumber);
    elAnswer.style.display = 'block';

    // Next round after delay
    var delay = correct ? 1500 : 3000;
    setTimeout(function() { startRound(); }, delay);
  }

  function endSession() {
    roundActive = false;
    clearTimeout(countdownTimer);
    speechSynthesis.cancel();
    elMainArea.style.display = 'none';
    elSessionEnd.style.display = 'block';
    elEndAttempts.textContent = session.attempts;
    elEndCorrect.textContent = session.correct;
    elEndAccuracy.textContent = session.attempts > 0
      ? Math.round(100 * session.correct / session.attempts) + '%' : '\u2014';
    elEndLevel.textContent = state.bestLevel;
  }

  function retry() {
    session = { attempts: 0, correct: 0 };
    elSessionEnd.style.display = 'none';
    elMainArea.style.display = 'block';
    startRound();
  }

  // Event listeners
  elBtnStart.addEventListener('click', function() {
    elStartOver.style.display = 'none';
    elMainArea.style.display = 'block';
    startRound();
  });

  elListenSubmit.addEventListener('click', function() { submitAnswer(); });
  elListenInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') { e.preventDefault(); submitAnswer(); }
  });
  elListenReplay.addEventListener('click', function() {
    if (currentNumber !== null) {
      speak(config.numberToWords(currentNumber));
    }
  });

  elTipDismiss.addEventListener('click', dismissTip);
  elTipBtn.addEventListener('click', function() {
    var tip = NumbersEngine.getLevelTip(state.level);
    if (tip) { elTipText.textContent = tip; elTipCard.style.display = 'block'; }
  });
  elBtnRetry.addEventListener('click', retry);

  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') endSession();
  });

  updateProgressStrip();
}
```

- [ ] **Step 2: Replace auto-boot with explicit `bootUI()` function**

Replace the DOMContentLoaded block at the bottom of `static/numbers.js` (lines 358-362) with:

```javascript
function bootUI() {
  var mode = document.body.getAttribute('data-numbers-mode');
  if (mode === 'listen') {
    initListenUI();
  } else {
    initUI();
  }
}

// Expose bootUI so templates can call it after setting mode attribute
window.NumbersEngine.bootUI = bootUI;

// Auto-boot for backward compat (speak mode default if no inline script calls bootUI)
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    // Only auto-boot if bootUI hasn't already been called by inline script
    if (!window._numbersBooted) bootUI();
  });
} else {
  // Same guard for sync script loading
  setTimeout(function() { if (!window._numbersBooted) bootUI(); }, 0);
}
```

Also, add `window._numbersBooted = true;` as the first line inside `bootUI()`:

```javascript
function bootUI() {
  window._numbersBooted = true;
  var mode = document.body.getAttribute('data-numbers-mode');
  // ...
}
```

**Why:** The inline mode toggle script in the templates must set `data-numbers-mode` on `<body>` BEFORE `numbers.js` boots. This is solved by having a small inline script before `numbers.js` that sets the attribute (see Task 3 Step 5).

- [ ] **Step 3: Verify existing speak mode still works by opening any numbers page in browser**

Expected: Page loads and works exactly as before (auto-boot fires in speak mode since no inline script sets the attribute beforehand).

- [ ] **Step 4: Commit**

```bash
git add static/numbers.js
git commit -m "feat: add initListenUI controller for listen mode number practice"
```

---

### Task 3: Add mode toggle and listen mode UI to Vietnamese template

**Files:**
- Modify: `templates/viet_numbers.html`

- [ ] **Step 1: Add listen mode CSS**

In `templates/viet_numbers.html`, add these styles inside the `<style>` block (before the closing `</style>` tag, after `audio { display: none; }`):

```css
  #mode-toggle { display: flex; justify-content: center; gap: 0; margin: 12px auto 0; max-width: 240px; }
  .mode-btn-toggle { flex: 1; padding: 8px 0; font-size: 14px; font-weight: 700; border: 2px solid var(--primary); cursor: pointer; background: #fff; color: var(--primary); transition: background 0.2s, color 0.2s; }
  .mode-btn-toggle:first-child { border-radius: 6px 0 0 6px; }
  .mode-btn-toggle:last-child { border-radius: 0 6px 6px 0; }
  .mode-btn-toggle.active { background: var(--primary); color: #fff; }
  #listen-speaker { display: none; font-size: 64px; color: var(--primary); margin: 32px 0 16px; }
  #listen-input { display: none; font-size: 28px; font-weight: 700; width: 160px; padding: 10px 16px; border: 2px solid #ccc; border-radius: 8px; text-align: center; outline: none; }
  #listen-input:focus { border-color: var(--primary); }
  #listen-submit { display: none; background: var(--primary); color: #fff; }
  #listen-submit:hover { background: var(--primary-dk); }
  #listen-replay { display: none; background: #fff; color: var(--primary); border: 2px solid var(--primary); padding: 8px 20px; font-size: 13px; }
  .listen-result { font-size: 20px; font-weight: 700; margin: 12px 0; }
  .listen-correct { color: #27AE60; }
  .listen-incorrect { color: #C0392B; }
```

- [ ] **Step 2: Add mode toggle HTML**

In `templates/viet_numbers.html`, add mode toggle after `<div id="num-strip">...</div>` (after line 87, before `<div id="main-area">`):

```html
<div id="mode-toggle">
  <button class="mode-btn-toggle active" data-mode="speak"><i class="fa-solid fa-microphone"></i> Speak</button>
  <button class="mode-btn-toggle" data-mode="listen"><i class="fa-solid fa-headphones"></i> Listen</button>
</div>
```

- [ ] **Step 3: Add listen mode DOM elements inside main-area**

In `templates/viet_numbers.html`, add these elements inside `#main-area` after the `#countdown-wrap` div (after line 96, before `record-btn`):

```html
  <div id="listen-speaker"><i class="fa-solid fa-volume-high"></i></div>
  <input type="text" id="listen-input" inputmode="numeric" pattern="[0-9]*" placeholder="?" autocomplete="off">
  <button class="action-btn" id="listen-submit"><i class="fa-solid fa-check"></i> Submit</button>
  <button class="action-btn" id="listen-replay"><i class="fa-solid fa-play"></i> Replay</button>
  <div id="listen-result" class="listen-result" style="display:none;"></div>
```

- [ ] **Step 4: Update start overlay text for listen mode**

Replace the start overlay `<p>` tag content (line 127):

```html
    <p id="start-instructions">A number will appear. You have a few seconds to read it, then record yourself saying it. Play back and self-assess.</p>
```

- [ ] **Step 5: Add mode toggle scripts (two parts — before and after numbers.js)**

In `templates/viet_numbers.html`, replace the two `<script>` tags at the bottom (lines 132-133) with:

**Part 1: Mode detection BEFORE numbers.js loads** (sets `data-numbers-mode` so `bootUI()` picks the right mode):

```html
<script src="/static/viet_numbers_config.js"></script>
<script>
// Must run BEFORE numbers.js — sets mode attribute for bootUI()
(function() {
  var MODE_KEY = 'numbers_mode_' + (window.NUMBER_CONFIG ? window.NUMBER_CONFIG.langKey : '');
  var mode = localStorage.getItem(MODE_KEY) || 'speak';
  document.body.setAttribute('data-numbers-mode', mode);
})();
</script>
<script src="/static/numbers.js"></script>
```

**Part 2: Mode toggle UI logic AFTER numbers.js loads:**

```html
<script>
(function() {
  var MODE_KEY = 'numbers_mode_' + (window.NUMBER_CONFIG ? window.NUMBER_CONFIG.langKey : '');
  var currentMode = document.body.getAttribute('data-numbers-mode') || 'speak';
  var toggleBtns = document.querySelectorAll('.mode-btn-toggle');
  var startInstructions = document.getElementById('start-instructions');

  // Highlight active toggle button
  toggleBtns.forEach(function(btn) {
    btn.classList.toggle('active', btn.getAttribute('data-mode') === currentMode);
  });

  // Update start instructions
  if (startInstructions) {
    startInstructions.textContent = currentMode === 'listen'
      ? 'You will hear a number spoken aloud. Type the number you hear and submit before time runs out.'
      : 'A number will appear. You have a few seconds to read it, then record yourself saying it. Play back and self-assess.';
  }

  // Check TTS availability
  function checkTTS(cb) {
    if (!window.speechSynthesis) { cb(false); return; }
    var voices = speechSynthesis.getVoices();
    if (voices.length > 0) { cb(hasLangVoice(voices)); return; }
    speechSynthesis.onvoiceschanged = function() {
      cb(hasLangVoice(speechSynthesis.getVoices()));
    };
    setTimeout(function() { cb(hasLangVoice(speechSynthesis.getVoices())); }, 1000);
  }

  function hasLangVoice(voices) {
    var lang = window.NUMBER_CONFIG.lang;
    var langShort = lang.split('-')[0];
    for (var i = 0; i < voices.length; i++) {
      if (voices[i].lang === lang || voices[i].lang.indexOf(langShort) === 0) return true;
    }
    return false;
  }

  checkTTS(function(available) {
    if (!available) {
      var toggle = document.getElementById('mode-toggle');
      if (toggle) toggle.style.display = 'none';
      // If we're stuck in listen mode without TTS, reload as speak
      if (currentMode === 'listen') {
        localStorage.setItem(MODE_KEY, 'speak');
        location.reload();
      }
    } else {
      toggleBtns.forEach(function(btn) {
        btn.addEventListener('click', function() {
          var newMode = btn.getAttribute('data-mode');
          if (newMode !== currentMode) {
            localStorage.setItem(MODE_KEY, newMode);
            location.reload();
          }
        });
      });
    }
  });
})();
</script>
```

- [ ] **Step 6: Test in browser**

1. Open `/viet/numbers` — should show mode toggle with "Speak" active, behaves as before
2. Click "Listen" — page reloads in listen mode
3. Click Start — should hear TTS speak a Vietnamese number
4. Type the number, press Enter — should show correct/incorrect
5. Verify timer, replay, session end all work

- [ ] **Step 7: Commit**

```bash
git add templates/viet_numbers.html
git commit -m "feat: add listen mode toggle and UI to Vietnamese numbers page"
```

---

### Task 4: Add mode toggle and listen mode UI to Indonesian template

**Files:**
- Modify: `templates/bahasa_numbers.html`

- [ ] **Step 1: Apply the same changes as Task 3 to `bahasa_numbers.html`**

The changes are identical in structure to the Vietnamese template. Apply:

1. **CSS** (same as Task 3 Step 1) — add listen mode styles before `</style>`.

2. **Mode toggle HTML** (same as Task 3 Step 2) — add after `num-strip` div, before `main-area`.

3. **Listen DOM elements** (same as Task 3 Step 3) — add inside `main-area` after `countdown-wrap`.

4. **Start instructions** — add `id="start-instructions"` to the `<p>` tag in start-card (line 94).

5. **Mode toggle script** (same as Task 3 Step 5) — replace `<script>` tags with config script + `numbers.js` + inline mode toggle script. Use `bahasa_numbers_config.js` instead of `viet_numbers_config.js`.

- [ ] **Step 2: Test in browser at `/bahasa/numbers`**

Same verification as Task 3 Step 6 but with Indonesian TTS.

- [ ] **Step 3: Commit**

```bash
git add templates/bahasa_numbers.html
git commit -m "feat: add listen mode toggle and UI to Indonesian numbers page"
```

---

### Task 5: Add mode toggle and listen mode UI to Spanish template

**Files:**
- Modify: `templates/spanish_numbers.html`

- [ ] **Step 1: Apply the same changes as Task 3 to `spanish_numbers.html`**

Same structure as Tasks 3 & 4. Use `spanish_numbers_config.js`.

- [ ] **Step 2: Test in browser at `/spanish/numbers`**

Same verification as Task 3 Step 6 but with Spanish TTS.

- [ ] **Step 3: Commit**

```bash
git add templates/spanish_numbers.html
git commit -m "feat: add listen mode toggle and UI to Spanish numbers page"
```

---

### Task 6: Final integration testing

- [ ] **Step 1: Test all three languages in listen mode**

For each language (`/viet/numbers`, `/bahasa/numbers`, `/spanish/numbers`):
1. Switch to Listen mode
2. Complete at least 5 rounds to verify level-up works
3. Verify replay button works during countdown
4. Verify timer expiry counts as incorrect
5. Verify session end screen shows correct stats
6. Navigate away and back — mode preference should persist
7. Switch back to Speak mode — verify it still works correctly

- [ ] **Step 2: Run engine tests**

Open `tests/test_numbers.html` in browser. All tests (existing + new listen mode tests) should pass.

- [ ] **Step 3: Test TTS unavailability**

Open a numbers page in a browser/context where TTS is unavailable or has no matching voice. The Listen tab should be hidden.

- [ ] **Step 4: Commit any final fixes if needed**
