/* numbers.js — Standalone engine for number pronunciation practice.
   Expects window.NUMBER_CONFIG to be defined by the language template. */
(function () {
'use strict';

var LEVELS = [
  { level: 1, min: 1, max: 10,      countdown: 3, label: 'Digits (1\u201310)' },
  { level: 2, min: 1, max: 100,     countdown: 3, label: 'Tens (1\u2013100)' },
  { level: 3, min: 1, max: 1000,    countdown: 5, label: 'Hundreds (1\u20131,000)' },
  { level: 4, min: 1, max: 10000,   countdown: 5, label: 'Thousands (1\u201310,000)' },
  { level: 5, min: 1, max: 1000000, countdown: 7, label: 'Large (1\u20131,000,000)' },
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
    return Math.floor(Math.random() * (prevCfg.max - prevCfg.min + 1)) + prevCfg.min;
  }
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

// ── UI Controller ────────────────────────────────────────────────────────
// Only initializes if DOM elements exist (templates loaded)

function initUI() {
  var config = window.NUMBER_CONFIG;
  if (!config) return;

  var langKey = config.langKey;
  var state = NumbersEngine.loadState(langKey);
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
  var audioEl      = document.getElementById('playback-audio');

  if (!elNumber) return;

  // ── Recording state ──────────────────────────────────────────────────
  var micStream    = null;
  var recorder     = null;
  var chunks       = [];
  var lastBlobUrl  = null;
  var countdownTimer = null;
  var currentNumber = null;
  var lastShownLevel = 0;

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
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) return 'audio/webm;codecs=opus';
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported('audio/mp4')) return 'audio/mp4';
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

    var duration = NumbersEngine.getCountdown(state.level);
    elCountdown.style.transition = 'none';
    elCountdown.style.width = '100%';
    elCountdown.offsetWidth; // force reflow
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
    audioEl.onended = function() { revealAnswer(); };
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
      ? Math.round(100 * session.correct / session.attempts) + '%' : '\u2014';
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

  updateProgressStrip();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initUI);
} else {
  initUI();
}

})();
