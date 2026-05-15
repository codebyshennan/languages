/* shared.js — SRS engine for all language apps.
   Each page must set window.LANG_CONFIG before this script loads. */
(function () {
'use strict';

// ── State ──────────────────────────────────────────────────────────────────
var cfg, allCards = [], queue = [], qpos = 0;
var curCard = null, answerShown = false, sessCorr = 0, sessWrong = 0;
var mode = "";
var DEFAULT_STUDY_SETTINGS = { maxCards: 30, newCards: 10 };

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
function getCatKey(cat) {
  return cfg.storageKey + '_' + (cat || 'General');
}
function getCurrentCat() {
  var sel = document.getElementById('cat-select');
  return sel ? sel.value : 'All';
}
function getAllCategories() {
  if (!allCards.length) { console.warn('getAllCategories: allCards not yet populated'); return []; }
  var seen = {}, cats = [];
  for (var i = 0; i < allCards.length; i++) {
    var c = allCards[i].cat || 'General';
    if (!seen[c]) { seen[c] = true; cats.push(c); }
  }
  return cats;
}
function clearChildren(el) {
  while (el.firstChild) el.removeChild(el.firstChild);
}
function appendOption(select, value, label) {
  var option = document.createElement('option');
  option.value = value;
  option.textContent = label;
  select.appendChild(option);
}
function appendCell(row, text) {
  var cell = document.createElement('td');
  cell.textContent = text;
  row.appendChild(cell);
  return cell;
}
function getStudySettingsKey() {
  return cfg.storageKey + '__study_settings';
}
function parseLimitValue(value) {
  if (value === 'all') return null;
  var parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}
function loadStudySettings() {
  var settings = {};
  try { settings = JSON.parse(localStorage.getItem(getStudySettingsKey()) || '{}') || {}; } catch (e) {}
  return {
    maxCards: settings.maxCards === null ? null : (Number.isFinite(settings.maxCards) ? settings.maxCards : DEFAULT_STUDY_SETTINGS.maxCards),
    newCards: settings.newCards === null ? null : (Number.isFinite(settings.newCards) ? settings.newCards : DEFAULT_STUDY_SETTINGS.newCards),
  };
}
function saveStudySettings(settings) {
  try { localStorage.setItem(getStudySettingsKey(), JSON.stringify(settings)); } catch (e) {}
}
function setSelectValue(select, value) {
  select.value = value === null ? 'all' : String(value);
}
function addLimitOptions(select, values) {
  for (var i = 0; i < values.length; i++) {
    var v = values[i];
    appendOption(select, v === null ? 'all' : String(v), v === null ? 'All' : String(v));
  }
}
function setupStudyControls() {
  var welcome = document.getElementById('welcome');
  if (!welcome || document.getElementById('study-controls')) return;

  var settings = loadStudySettings();
  var controls = document.createElement('div');
  controls.id = 'study-controls';
  controls.className = 'study-controls';

  function addControl(labelText, id, values, currentValue) {
    var field = document.createElement('label');
    field.className = 'study-control';
    var label = document.createElement('span');
    label.textContent = labelText;
    var select = document.createElement('select');
    select.id = id;
    addLimitOptions(select, values);
    setSelectValue(select, currentValue);
    field.appendChild(label);
    field.appendChild(select);
    controls.appendChild(field);
    return select;
  }

  var maxSelect = addControl('Session', 'study-max-cards', [10, 20, 30, 50, null], settings.maxCards);
  var newSelect = addControl('New cards', 'study-new-cards', [0, 5, 10, 20, null], settings.newCards);

  function persist() {
    saveStudySettings({
      maxCards: parseLimitValue(maxSelect.value),
      newCards: parseLimitValue(newSelect.value),
    });
  }

  maxSelect.addEventListener('change', persist);
  newSelect.addEventListener('change', persist);

  var statGrid = welcome.querySelector('.stat-grid');
  if (statGrid && statGrid.nextSibling) {
    welcome.insertBefore(controls, statGrid.nextSibling);
  } else {
    welcome.appendChild(controls);
  }
}
function loadProgress(forceAll) {
  try {
    var cat = forceAll ? 'All' : getCurrentCat();
    if (cat === 'All') {
      var merged = {};
      var cats = getAllCategories();
      for (var i = 0; i < cats.length; i++) {
        var store = JSON.parse(localStorage.getItem(getCatKey(cats[i])) || '{}');
        for (var k in store) merged[k] = store[k];
      }
      return merged;
    }
    return JSON.parse(localStorage.getItem(getCatKey(cat)) || '{}');
  } catch (e) { return {}; }
}
function saveProgress(p) {
  try {
    var cat = getCurrentCat();
    if (cat === 'All') {
      var numToCat = {};
      for (var i = 0; i < allCards.length; i++) {
        numToCat[String(allCards[i].num)] = allCards[i].cat || 'General';
      }
      var catData = {};
      for (var num in p) {
        var c = numToCat[num];
        if (c === undefined) { console.warn('saveProgress: unknown card', num, '→ General'); c = 'General'; }
        if (!catData[c]) catData[c] = {};
        catData[c][num] = p[num];
      }
      for (var c in catData) {
        var key = getCatKey(c);
        var existing = {};
        try { existing = JSON.parse(localStorage.getItem(key) || '{}'); } catch (e2) {}
        for (var k in catData[c]) existing[k] = catData[c][k];
        localStorage.setItem(key, JSON.stringify(existing));
      }
    } else {
      localStorage.setItem(getCatKey(cat), JSON.stringify(p));
    }
  } catch (e) { console.warn('Could not save progress:', e); }
}
function getProgressSnapshot() {
  var cats = getAllCategories();
  var categories = {};
  for (var i = 0; i < cats.length; i++) {
    var key = getCatKey(cats[i]);
    try { categories[cats[i]] = JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) { categories[cats[i]] = {}; }
  }
  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    storageKey: cfg.storageKey,
    title: document.title,
    categories: categories,
    studySettings: loadStudySettings(),
  };
}
function exportProgress() {
  var snapshot = getProgressSnapshot();
  var blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
  var url = URL.createObjectURL(blob);
  var link = document.createElement('a');
  link.href = url;
  link.download = cfg.storageKey + '-progress.json';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
function importProgress(file) {
  if (!file) return;
  var reader = new FileReader();
  reader.onload = function() {
    try {
      var snapshot = JSON.parse(String(reader.result || '{}'));
      if (!snapshot.categories || typeof snapshot.categories !== 'object') {
        throw new Error('Missing categories');
      }
      var cats = Object.keys(snapshot.categories);
      for (var i = 0; i < cats.length; i++) {
        var cat = cats[i];
        var data = snapshot.categories[cat];
        if (data && typeof data === 'object') {
          localStorage.setItem(getCatKey(cat), JSON.stringify(data));
        }
      }
      if (snapshot.studySettings && typeof snapshot.studySettings === 'object') {
        saveStudySettings({
          maxCards: snapshot.studySettings.maxCards === null ? null : parseLimitValue(String(snapshot.studySettings.maxCards)),
          newCards: snapshot.studySettings.newCards === null ? null : parseLimitValue(String(snapshot.studySettings.newCards)),
        });
      }
      refreshOverview();
      openStats();
    } catch (e) {
      alert('Could not import progress. Choose a progress JSON file exported from this app.');
    }
  };
  reader.readAsText(file);
}
function resetProgress() {
  if (!confirm('Reset progress for this language? This cannot be undone unless you export a backup first.')) return;
  var cats = getAllCategories();
  for (var i = 0; i < cats.length; i++) {
    localStorage.removeItem(getCatKey(cats[i]));
  }
  localStorage.removeItem(cfg.storageKey);
  localStorage.removeItem(cfg.storageKey + '__migrated');
  refreshOverview();
  openStats();
}
function migrateProgress() {
  if (localStorage.getItem(cfg.storageKey + '__migrated')) return;
  var legacy = null;
  try { legacy = JSON.parse(localStorage.getItem(cfg.storageKey) || 'null'); } catch (e) {}
  if (!legacy || !Object.keys(legacy).length) {
    localStorage.setItem(cfg.storageKey + '__migrated', '1');
    return;
  }
  var numToCat = {};
  for (var i = 0; i < allCards.length; i++) {
    numToCat[String(allCards[i].num)] = allCards[i].cat || 'General';
  }
  var catData = {};
  for (var num in legacy) {
    var c = numToCat[num];
    if (c === undefined) { console.warn('migrateProgress: unknown card', num, '→ General'); c = 'General'; }
    if (!catData[c]) catData[c] = {};
    catData[c][num] = legacy[num];
  }
  for (var c in catData) {
    var key = getCatKey(c);
    var existing = {};
    try { existing = JSON.parse(localStorage.getItem(key) || '{}'); } catch (e) {}
    for (var k in catData[c]) existing[k] = catData[c][k];
    try { localStorage.setItem(key, JSON.stringify(existing)); } catch (e) { console.warn('Migration write failed for', c, e); }
  }
  // Write flag AFTER all per-category writes, BEFORE deleting legacy key
  localStorage.setItem(cfg.storageKey + '__migrated', '1');
  localStorage.removeItem(cfg.storageKey);
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
  el.innerHTML = '';
  _ttsRecent.forEach(function(w) {
    var chip = document.createElement('span');
    chip.className = 'tts-chip';
    chip.textContent = w;
    chip.addEventListener('click', function() {
      document.getElementById('tts-input').value = w;
      _ttsSpeak(w);
    });
    el.appendChild(chip);
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
      '<input id="tts-input" type="text" placeholder="Type a word\u2026" autocomplete="off" />' +
      '<div id="tts-hint">Enter to speak \u00b7 Esc to close</div>' +
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
  fab.innerHTML = '\uD83D\uDD0A';
  fab.addEventListener('click', openTTSModal);
  document.body.appendChild(fab);
}

window.openTTSModal  = openTTSModal;
window.closeTTSModal = closeTTSModal;

// ── Overview ───────────────────────────────────────────────────────────────
function computeOverview() {
  var p = loadProgress();
  var cat = getCurrentCat();
  var cards = (cat === 'All') ? allCards : allCards.filter(function(c) { return c.cat === cat; });
  var newC = 0, lrn = 0, review = 0, mature = 0, due = 0, cor = 0, wrg = 0;
  for (var i = 0; i < cards.length; i++) {
    var c = cards[i];
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
  return { total: cards.length, new: newC, learning: lrn, review: review,
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
  var p = loadProgress(true);
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
  var btnStart = document.getElementById("btn-start");
  if (btnStart) btnStart.style.display = name === "card" ? "none" : "block";
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
  var settings = loadStudySettings();
  var candidates = allCards.filter(function(c) {
    return (cat === "All" || c.cat === cat) &&
           isDue(p[String(c.num)] || {}) &&
           cfg.filterExtra(c);
  });

  var reviewCards = [];
  var newCards = [];
  for (var i = 0; i < candidates.length; i++) {
    var pd = p[String(candidates[i].num)] || {};
    if (cardStage(pd) === 'new') newCards.push(candidates[i]);
    else reviewCards.push(candidates[i]);
  }

  shuffleCards(reviewCards);
  shuffleCards(newCards);
  if (settings.newCards !== null) newCards = newCards.slice(0, settings.newCards);

  candidates = reviewCards.concat(newCards);
  if (settings.maxCards !== null) candidates = candidates.slice(0, settings.maxCards);

  if (candidates.length > 1) {
    var reviewCount = reviewCards.length;
    var limitedReviews = candidates.slice(0, Math.min(reviewCount, candidates.length));
    var limitedNew = candidates.slice(limitedReviews.length);
    shuffleCards(limitedReviews);
    shuffleCards(limitedNew);
    candidates = limitedReviews.concat(limitedNew);
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

function shuffleCards(cards) {
  for (var i = cards.length - 1; i > 0; i--) {
    var j = Math.floor(Math.random() * (i + 1));
    var tmp = cards[i]; cards[i] = cards[j]; cards[j] = tmp;
  }
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

// ── Nav toggle ──────────────────────────────────────────────────────────────
function toggleNav() {
  var menu = document.getElementById("nav-menu");
  if (menu) menu.classList.toggle("open");
}
document.addEventListener("click", function(e) {
  var menu   = document.getElementById("nav-menu");
  var toggle = document.getElementById("nav-toggle");
  if (!menu || !menu.classList.contains("open")) return;
  if (!menu.contains(e.target) && e.target !== toggle && !toggle.contains(e.target)) {
    menu.classList.remove("open");
  }
});

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
  var body = document.getElementById("modal-body");
  clearChildren(body);

  function addOverviewBox(parent, value, label, color) {
    var box = document.createElement('div');
    box.className = 'ov-box';
    var n = document.createElement('div');
    n.className = 'n';
    if (color) n.style.color = color;
    n.textContent = value;
    var l = document.createElement('div');
    l.className = 'l';
    l.textContent = label;
    box.appendChild(n);
    box.appendChild(l);
    parent.appendChild(box);
  }

  var overviewGrid = document.createElement('div');
  overviewGrid.className = 'overview-grid';
  addOverviewBox(overviewGrid, ov.due, 'Due Today', 'var(--amber)');
  addOverviewBox(overviewGrid, ov.total, 'Total');
  addOverviewBox(overviewGrid, ov.new, 'New', 'var(--blue)');
  addOverviewBox(overviewGrid, ov.learning + ov.review, 'Learning', 'var(--amber)');
  addOverviewBox(overviewGrid, ov.mature, 'Mature', 'var(--green)');
  addOverviewBox(overviewGrid, ov.accuracy + '%', 'Accuracy');
  body.appendChild(overviewGrid);

  var heading = document.createElement('h4');
  heading.style.color = 'var(--primary)';
  heading.style.marginBottom = '8px';
  heading.textContent = 'Progress by Category';
  body.appendChild(heading);

  var table = document.createElement('table');
  table.className = 'cat-table';
  var thead = document.createElement('thead');
  var headRow = document.createElement('tr');
  ['Category', 'Total', 'Mature', 'Due'].forEach(function(label) {
    var th = document.createElement('th');
    th.textContent = label;
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);
  var tbody = document.createElement('tbody');
  var entries = Object.keys(cats).sort();
  for (var i = 0; i < entries.length; i++) {
    var cat = entries[i];
    var s   = cats[cat];
    var pct = s.total ? Math.round(100 * s.mature / s.total) : 0;
    var row = document.createElement('tr');
    appendCell(row, cat);
    appendCell(row, String(s.total));
    var matureCell = document.createElement('td');
    var matureText = document.createElement('div');
    matureText.textContent = s.mature + ' (' + pct + '%)';
    var pctBar = document.createElement('div');
    pctBar.className = 'pct-bar';
    var pctFill = document.createElement('div');
    pctFill.className = 'pct-fill';
    pctFill.style.width = pct + '%';
    pctBar.appendChild(pctFill);
    matureCell.appendChild(matureText);
    matureCell.appendChild(pctBar);
    row.appendChild(matureCell);
    var dueCell = appendCell(row, s.due ? String(s.due) : '\u2014');
    dueCell.style.color = s.due > 0 ? 'var(--amber)' : 'var(--dgrey)';
    dueCell.style.fontWeight = s.due > 0 ? '700' : '400';
    tbody.appendChild(row);
  }
  table.appendChild(tbody);
  body.appendChild(table);

  var tools = document.createElement('div');
  tools.className = 'progress-tools';
  var exportBtn = document.createElement('button');
  exportBtn.type = 'button';
  exportBtn.className = 'progress-tool-btn';
  exportBtn.textContent = 'Export backup';
  exportBtn.addEventListener('click', exportProgress);
  var importLabel = document.createElement('label');
  importLabel.className = 'progress-tool-btn';
  importLabel.textContent = 'Import backup';
  var importInput = document.createElement('input');
  importInput.type = 'file';
  importInput.accept = 'application/json,.json';
  importInput.addEventListener('change', function() {
    importProgress(importInput.files && importInput.files[0]);
    importInput.value = '';
  });
  importLabel.appendChild(importInput);
  var resetBtn = document.createElement('button');
  resetBtn.type = 'button';
  resetBtn.className = 'progress-tool-btn danger';
  resetBtn.textContent = 'Reset progress';
  resetBtn.addEventListener('click', resetProgress);
  tools.appendChild(exportBtn);
  tools.appendChild(importLabel);
  tools.appendChild(resetBtn);
  body.appendChild(tools);
}
function closeStats() {
  document.getElementById("modal-overlay").classList.remove("open");
}

// ── Swipe ──────────────────────────────────────────────────────────────────
function setupSwipe() {
  var cardEl = document.querySelector('.card');
  if (!cardEl) return;

  // Inject swipe labels
  function makeLabel(id, text) {
    var el = document.createElement('div');
    el.id = id; el.className = 'swipe-label'; el.textContent = text;
    cardEl.appendChild(el); return el;
  }
  var labels = {
    good:  makeLabel('swipe-good',  'GOOD'),
    again: makeLabel('swipe-again', 'AGAIN'),
    easy:  makeLabel('swipe-easy',  'EASY'),
    hard:  makeLabel('swipe-hard',  'HARD'),
  };

  function clearLabels() {
    for (var k in labels) labels[k].style.opacity = 0;
  }

  var startX = 0, startY = 0, axis = null, dragging = false;
  var THRESHOLD = 90, AXIS_LOCK = 10;

  cardEl.addEventListener('touchstart', function(e) {
    startX = e.touches[0].clientX;
    startY = e.touches[0].clientY;
    axis = null; dragging = true;
    cardEl.style.transition = 'none';
  }, { passive: true });

  cardEl.addEventListener('touchmove', function(e) {
    if (!dragging) return;
    e.preventDefault();
    var dx = e.touches[0].clientX - startX;
    var dy = e.touches[0].clientY - startY;

    // Lock axis once clear direction is established
    if (!axis && (Math.abs(dx) > AXIS_LOCK || Math.abs(dy) > AXIS_LOCK)) {
      axis = Math.abs(dx) >= Math.abs(dy) ? 'h' : 'v';
    }
    if (!axis) return;

    var pct;
    if (axis === 'h') {
      var rotate = dx * 0.08;
      cardEl.style.transform = 'translateX(' + dx + 'px) rotate(' + rotate + 'deg)';
      pct = Math.min(Math.abs(dx) / THRESHOLD, 1);
      clearLabels();
      if (dx > 0) labels.good.style.opacity  = pct;
      else        labels.again.style.opacity = pct;
    } else {
      cardEl.style.transform = 'translateY(' + dy + 'px)';
      pct = Math.min(Math.abs(dy) / THRESHOLD, 1);
      clearLabels();
      if (dy < 0) labels.easy.style.opacity = pct;
      else        labels.hard.style.opacity = pct;
    }
  }, { passive: false });

  cardEl.addEventListener('touchend', function(e) {
    if (!dragging) return;
    dragging = false;
    var dx = e.changedTouches[0].clientX - startX;
    var dy = e.changedTouches[0].clientY - startY;
    clearLabels();

    if (!axis) return;

    var delta    = axis === 'h' ? dx : dy;
    var reached  = Math.abs(delta) >= THRESHOLD;

    if (!reached) {
      cardEl.style.transition = 'transform 0.25s ease';
      cardEl.style.transform = '';
      return;
    }

    if (!answerShown) {
      // Any committed swipe reveals the answer
      cardEl.style.transition = 'transform 0.25s ease';
      cardEl.style.transform = '';
      showAnswer();
      return;
    }

    // Map direction to rating
    var rating;
    if      (axis === 'h' && dx > 0) rating = 3; // right → Good
    else if (axis === 'h' && dx < 0) rating = 1; // left  → Again
    else if (axis === 'v' && dy < 0) rating = 4; // up    → Easy
    else                             rating = 2; // down  → Hard

    // Fly off then rate
    var flyX = axis === 'h' ? (dx > 0 ? 1 : -1) * window.innerWidth * 1.2 : 0;
    var flyY = axis === 'v' ? (dy < 0 ? -1 : 1) * window.innerHeight       : 0;
    var rot  = axis === 'h' ? (dx > 0 ? 20 : -20) : 0;
    cardEl.style.transition = 'transform 0.25s ease, opacity 0.2s';
    cardEl.style.transform  = 'translateX(' + flyX + 'px) translateY(' + flyY + 'px) rotate(' + rot + 'deg)';
    cardEl.style.opacity    = '0';
    setTimeout(function() {
      cardEl.style.transition = 'none';
      cardEl.style.transform  = '';
      cardEl.style.opacity    = '';
      rate(rating);
    }, 250);
  });
}

// ── Keyboard ───────────────────────────────────────────────────────────────
document.addEventListener("keydown", function(e) {
  if (e.target.tagName === "SELECT") return;
  if (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA") return;
  if (e.key === " " || e.key === "Spacebar") { e.preventDefault(); showAnswer(); }
  if (e.key === "1") rate(1);
  if (e.key === "2") rate(2);
  if (e.key === "3") rate(3);
  if (e.key === "4") rate(4);
  if (e.key === "p" || e.key === "P") pronounce();
  if (e.key === "Enter" && document.getElementById("welcome").style.display !== "none") startSession();
  if (e.key === "Escape") closeStats();
  if (cfg && cfg.handleExtraKeys) cfg.handleExtraKeys(e, curCard);
  if (e.key === "/" && !_ttsOpen) { e.preventDefault(); openTTSModal(); }
  if (e.key === "Escape" && _ttsOpen) { closeTTSModal(); }
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
  if (sel) {
    clearChildren(sel);
    appendOption(sel, 'All', 'All categories');
    cats.forEach(function(c) { appendOption(sel, c, c); });
    sel.addEventListener("change", refreshOverview);
  }

  // migrateProgress() must run after allCards is populated (the await above guarantees this)
  migrateProgress();
  cfg.initUI(allCards, setMode);
  setupStudyControls();
  refreshOverview();
  showScreen("home");
  setupSwipe();
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
window.toggleNav    = toggleNav;
window.exportProgress = exportProgress;
window.importProgress = importProgress;
window.resetProgress  = resetProgress;

setupTTSWidget();
init();
})();
