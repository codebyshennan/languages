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
function migrateProgress() {
  if (localStorage.getItem(cfg.storageKey + '_migrated')) return;
  var legacy = null;
  try { legacy = JSON.parse(localStorage.getItem(cfg.storageKey) || 'null'); } catch (e) {}
  if (!legacy || !Object.keys(legacy).length) {
    localStorage.setItem(cfg.storageKey + '_migrated', '1');
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
  localStorage.setItem(cfg.storageKey + '_migrated', '1');
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

init();
})();
