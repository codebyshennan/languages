#!/usr/bin/env python3
"""
spanish_anki.py  —  Spanish Spaced-Repetition Web App
======================================================
Run:  python3 spanish_anki.py
Then open:  http://localhost:5000
"""

from pathlib import Path
from flask import Flask, jsonify
import openpyxl

# ── Paths ──────────────────────────────────────────────────────────────────────
BASE = Path(__file__).parent
SRC  = BASE / "spanish_vocab_3000words.xlsx"

app = Flask(__name__)

# ── Load vocab ─────────────────────────────────────────────────────────────────
def load_vocab():
    print(f"Loading vocab from {SRC}…")
    wb = openpyxl.load_workbook(SRC, read_only=True, data_only=True)
    ws = wb.active
    cards = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row[0]:
            continue
        num, cat, english, spanish, gender, notes, example_es, example_en, spanish_mx = (list(row) + [""] * 9)[:9]
        if not spanish:
            continue
        cards.append({
            "num":        int(num) if num else 0,
            "cat":        str(cat     or "General"),
            "english":    str(english or ""),
            "spanish":    str(spanish or ""),
            "gender":     str(gender  or "-"),
            "notes":      str(notes   or ""),
            "example_es": str(example_es or ""),
            "example_en": str(example_en or ""),
            "spanish_mx": str(spanish_mx or ""),
        })
    wb.close()
    print(f"  Loaded {len(cards)} cards")
    return cards

ALL_CARDS = load_vocab()

# ── API ────────────────────────────────────────────────────────────────────────
@app.route("/api/vocab")
def api_vocab():
    return jsonify(ALL_CARDS)

@app.route("/")
def index():
    return HTML_PAGE

# ── SPA ────────────────────────────────────────────────────────────────────────
HTML_PAGE = r"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Spanish Anki — Spaced Repetition</title>
<style>
  :root {
    --red:    #C60B1E;
    --dkred:  #9A0918;
    --gold:   #FFC400;
    --dkgold: #E6AE00;
    --white:  #FFFFFF;
    --lgrey:  #FDF8F0;
    --dgrey:  #6C7A8A;
    --green:  #27AE60;
    --amber:  #E67E22;
    --blue:   #2980B9;
    --teal:   #1ABC9C;
    --card:   #FFFDF8;
    --shadow: #F5E8C0;
  }
  * { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
         background: var(--lgrey); min-height: 100vh; }

  #topbar {
    background: var(--red); color: var(--white);
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
  .mode-btn.active { background: var(--dkred); border-color: var(--dkred); color: white; }
  #cat-select {
    background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.3);
    color: white; padding: 5px 10px; border-radius: 6px; font-size: 13px; cursor: pointer;
  }
  #cat-select option { background: var(--red); }
  .spacer { flex: 1; }
  #stats-btn {
    background: rgba(255,255,255,0.1); border: 1px solid rgba(255,255,255,0.3);
    color: white; padding: 5px 14px; border-radius: 6px; cursor: pointer; font-size: 13px;
  }
  #stats-btn:hover { background: rgba(255,255,255,0.2); }

  #progstrip {
    background: var(--dkred); padding: 6px 20px;
    display: flex; align-items: center; gap: 12px;
  }
  #prog-label { color: rgba(255,255,255,0.7); font-size: 12px; }
  #prog-bar-wrap {
    flex: 1; max-width: 200px; height: 6px;
    background: rgba(255,255,255,0.15); border-radius: 3px; overflow: hidden;
  }
  #prog-bar { height: 100%; background: var(--gold); border-radius: 3px; transition: width 0.4s; width: 0%; }
  #streak { color: var(--gold); font-size: 13px; font-weight: 700; }

  #main { max-width: 720px; margin: 24px auto; padding: 0 16px; }

  #welcome { text-align: center; padding: 40px 20px; }
  #welcome h2 { color: var(--red); font-size: 28px; margin-bottom: 12px; }
  #welcome p  { color: var(--dgrey); font-size: 15px; line-height: 1.6; }
  .stat-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin: 24px 0; }
  .stat-box { background: white; border-radius: 10px; padding: 16px 12px; text-align: center;
              box-shadow: 0 2px 8px rgba(0,0,0,0.06); }
  .stat-box .num { font-size: 26px; font-weight: 700; color: var(--red); }
  .stat-box .lbl { font-size: 11px; color: var(--dgrey); margin-top: 2px; text-transform: uppercase; }
  .stat-box.due .num { color: var(--amber); }
  .stat-box.mat .num { color: var(--green); }

  #card-wrap { display: none; }
  .card { background: var(--card); border-radius: 16px;
          box-shadow: 0 4px 20px rgba(198,11,30,0.10); overflow: hidden; }
  .card-header {
    background: var(--red); padding: 10px 20px;
    display: flex; align-items: center; justify-content: space-between;
  }
  .card-cat { color: rgba(255,255,255,0.75); font-size: 12px; font-weight: 600;
              text-transform: uppercase; letter-spacing: 0.5px; }
  .card-badge { font-size: 11px; padding: 3px 10px; border-radius: 12px; font-weight: 600; }
  .badge-new      { background: var(--blue);  color: white; }
  .badge-learning { background: var(--amber); color: white; }
  .badge-review   { background: #8E44AD;       color: white; }
  .badge-mature   { background: var(--green);  color: white; }
  .card-body { padding: 28px 32px 20px; }
  .card-direction { color: var(--red); font-size: 13px; font-weight: 600; margin-bottom: 12px; }
  .card-question {
    font-size: 42px; font-weight: 700; color: #1A0000;
    line-height: 1.2; margin-bottom: 4px; word-break: break-word;
  }
  .card-divider { height: 2px; background: var(--shadow); border-radius: 1px; margin: 16px 0; }

  #answer-area { display: none; }
  .answer-english { font-size: 26px; font-weight: 700; color: var(--green); margin-bottom: 6px; }
  .gender-badge {
    display: inline-block; font-size: 12px; font-weight: 700; padding: 2px 10px;
    border-radius: 10px; margin-bottom: 10px;
  }
  .gender-m { background: #D6EAF8; color: #1A5276; }
  .gender-f { background: #FDEDEC; color: #922B21; }
  .notes-row {
    font-size: 13px; color: #5D4037; background: #FFF8E1;
    border-left: 3px solid var(--gold); padding: 8px 12px;
    border-radius: 0 6px 6px 0; margin-bottom: 8px;
  }
  .example-es { font-size: 13px; color: #334455; font-style: italic;
                background: #FDF0F0; border-left: 3px solid var(--red);
                padding: 8px 12px; border-radius: 0 6px 6px 0; margin-bottom: 6px; }
  .example-en { font-size: 12px; color: var(--dgrey); font-style: italic; padding-left: 4px; }

  .pronounce-btn {
    margin-top: 12px; background: #FDEBD0; border: none; color: var(--dkred);
    padding: 7px 18px; border-radius: 8px; cursor: pointer; font-size: 13px;
    font-weight: 600; transition: background 0.2s;
  }
  .pronounce-btn:hover { background: #FAD7A0; }

  #action-area { margin-top: 16px; }
  #btn-show {
    width: 100%; background: var(--red); color: white; border: none;
    padding: 16px; border-radius: 12px; font-size: 16px; font-weight: 700;
    cursor: pointer; transition: background 0.2s;
  }
  #btn-show:hover { background: var(--dkred); }
  #rating-area { display: none; }
  .rating-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
  .rating-btn {
    border: none; color: white; padding: 12px 8px; border-radius: 10px;
    cursor: pointer; font-size: 13px; font-weight: 700; line-height: 1.4;
    transition: filter 0.2s; text-align: center;
  }
  .rating-btn:hover  { filter: brightness(1.1); }
  .rating-btn:active { filter: brightness(0.9); }
  .btn-again { background: #C0392B; }
  .btn-hard  { background: var(--amber); }
  .btn-good  { background: var(--green); }
  .btn-easy  { background: var(--blue); }
  .hint-row { text-align: center; color: var(--dgrey); font-size: 11px; margin-top: 8px; }

  #bottom-bar { display: flex; gap: 10px; margin-top: 16px; }
  #btn-start {
    flex: 1; background: var(--teal); color: white; border: none;
    padding: 13px; border-radius: 10px; font-size: 14px; font-weight: 700; cursor: pointer;
  }
  #btn-start:hover { background: #16A085; }
  #btn-quit { background: var(--dgrey); color: white; border: none;
              padding: 13px 20px; border-radius: 10px; font-size: 13px; font-weight: 600; cursor: pointer; }

  #session-end { display: none; text-align: center; padding: 32px 20px; }
  #session-end h2 { color: var(--green); font-size: 32px; margin-bottom: 8px; }
  .end-stats { display: flex; justify-content: center; gap: 24px; margin: 20px 0; }
  .end-stat .n { font-size: 28px; font-weight: 700; }
  .end-stat .l { font-size: 12px; color: var(--dgrey); }

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
  .modal-header { background: var(--red); color: white; padding: 16px 20px;
                  display: flex; align-items: center; justify-content: space-between; }
  .modal-header h3 { font-size: 16px; }
  .modal-close { background: none; border: none; color: white; font-size: 20px; cursor: pointer; }
  .modal-body { padding: 16px; overflow-y: auto; }
  .overview-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin-bottom: 16px; }
  .ov-box { background: var(--lgrey); border-radius: 8px; padding: 12px; text-align: center; }
  .ov-box .n { font-size: 22px; font-weight: 700; color: var(--red); }
  .ov-box .l { font-size: 11px; color: var(--dgrey); }
  .cat-table { width: 100%; border-collapse: collapse; font-size: 13px; }
  .cat-table th { background: var(--red); color: white; padding: 7px 10px; text-align: left; }
  .cat-table td { padding: 6px 10px; border-bottom: 1px solid #EEF2F6; }
  .cat-table tr:nth-child(even) td { background: #FDF8F8; }
  .pct-bar { height: 6px; background: #E0D8D8; border-radius: 3px; overflow: hidden; margin-top: 3px; }
  .pct-fill { height: 100%; background: var(--green); border-radius: 3px; }
  .kbd { display: inline-block; background: #EEF2F6; border: 1px solid #C8D4E0;
         border-radius: 4px; padding: 1px 6px; font-size: 11px; font-family: monospace; color: var(--dgrey); }
</style>
</head>
<body>

<div id="topbar">
  <h1>&#127466;&#127480; SPANISH ANKI</h1>
  <button class="mode-btn active" id="btn-es-en" onclick="setMode('es_en')">&#127466;&#127480; ES &#8594; EN</button>
  <button class="mode-btn"        id="btn-en-es" onclick="setMode('en_es')">&#127468;&#127463; EN &#8594; ES</button>
  <div style="width:1px;background:rgba(255,255,255,0.2);height:20px;margin:0 4px;"></div>
  <button class="mode-btn active" id="btn-dialect-es" onclick="setDialect('es')">&#127466;&#127480; España</button>
  <button class="mode-btn"        id="btn-dialect-mx" onclick="setDialect('mx')">&#127474;&#127485; México</button>
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
    <h2>&#127466;&#127480; Spanish &#8212; Spaced Repetition</h2>
    <p>3 000 words &#183; SM-2 algorithm &#183; Gender &amp; conjugation notes</p>
    <div class="stat-grid">
      <div class="stat-box due"><div class="num" id="ov-due">&#8230;</div><div class="lbl">Due Today</div></div>
      <div class="stat-box">   <div class="num" id="ov-new">&#8230;</div><div class="lbl">New</div></div>
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
          <div class="answer-english" id="ans-english"></div>
          <div id="ans-gender-wrap"></div>
          <div class="notes-row" id="ans-notes" style="display:none"></div>
          <div class="example-es"  id="ans-example-es" style="display:none"></div>
          <div class="example-en"  id="ans-example-en" style="display:none"></div>
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
      <div class="end-stat"><div class="n" id="end-wrg" style="color:#C0392B">&#8212;</div><div class="l">Wrong</div></div>
      <div class="end-stat"><div class="n" id="end-acc" style="color:var(--red)">&#8212;</div><div class="l">Accuracy</div></div>
    </div>
    <p style="color:var(--dgrey)" id="end-sub"></p>
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
const STORAGE_KEY = "spanish_progress";
let mode        = "es_en";
let allCards    = [];
let queue       = [];
let qpos        = 0;
let curCard     = null;
let answerShown = false;
let sessCorr    = 0;
let sessWrong   = 0;
let dialect = "es";

function loadProgress() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
  catch { return {}; }
}
function saveProgress(p) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(p)); }
  catch(e) { console.warn("Could not save progress:", e); }
}

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
  const clean = text.split("(")[0].replace(/['"\/]/g, "").trim();
  if (!clean) return;
  const utt = new SpeechSynthesisUtterance(clean);
  utt.lang = lang === "es" ? (dialect === "mx" ? "es-MX" : "es-ES") : "en-US";
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
    const stage = cardStage(pd);
    if (!cats[c.cat]) cats[c.cat] = { total:0, new:0, learning:0, review:0, mature:0, due:0 };
    cats[c.cat].total++;
    cats[c.cat][stage]++;
    if (isDue(pd)) cats[c.cat].due++;
  }
  return cats;
}

async function init() {
  allCards = await fetch("/api/vocab").then(r => r.json());
  const cats = [...new Set(allCards.map(c => c.cat))].sort();
  document.getElementById("cat-select").innerHTML =
    '<option value="All">All categories</option>' + cats.map(c => `<option>${c}</option>`).join("");
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
  const cat = document.getElementById("cat-select").value;
  const p   = loadProgress();
  const candidates = allCards.filter(c =>
    (cat === "All" || c.cat === cat) && isDue(p[String(c.num)] || {})
  );
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  queue = candidates.map(c => c.num);
  qpos = 0; sessCorr = 0; sessWrong = 0;
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
  curCard     = { ...card, stage: cardStage(pd), interval: pd.interval || 0 };
  answerShown = false;

  document.getElementById("card-cat").textContent = card.cat;
  const badgeMap = { new:"badge-new", learning:"badge-learning", review:"badge-review", mature:"badge-mature" };
  const badgeTxt = { new:"New", learning:"Learning", review:"Review", mature:"Mature" };
  const badge = document.getElementById("card-badge");
  badge.className   = "card-badge " + (badgeMap[curCard.stage] || "badge-new");
  badge.textContent = (badgeTxt[curCard.stage] || "New") +
    (curCard.interval > 0 ? `  (${curCard.interval}d)` : "");

  if (mode === "es_en") {
    document.getElementById("card-dir").textContent = "Spanish  \u2192  English";
    document.getElementById("card-q").textContent   = spanishWord(card);
    callPronounce(spanishWord(card), "es");
  } else {
    document.getElementById("card-dir").textContent = "English  \u2192  Spanish";
    document.getElementById("card-q").textContent   = card.english;
  }

  document.getElementById("answer-area").style.display = "none";
  document.getElementById("btn-show").style.display    = "block";
  document.getElementById("rating-area").style.display = "none";
  setProg(qpos / queue.length * 100,
    `Card ${qpos+1}/${queue.length}   Correct: ${sessCorr}   Wrong: ${sessWrong}`,
    sessCorr, sessWrong);
}

function showAnswer() {
  if (!curCard || answerShown) return;
  answerShown = true;
  const c = curCard;

  document.getElementById("ans-english").textContent =
    mode === "es_en" ? c.english : spanishWord(c);

  const gWrap = document.getElementById("ans-gender-wrap");
  if (c.gender === "m") {
    gWrap.innerHTML = '<span class="gender-badge gender-m">masculine</span>';
  } else if (c.gender === "f") {
    gWrap.innerHTML = '<span class="gender-badge gender-f">feminine</span>';
  } else {
    gWrap.innerHTML = "";
  }

  const notesEl = document.getElementById("ans-notes");
  if (c.notes && c.notes !== "None" && c.notes.trim()) {
    notesEl.textContent = c.notes; notesEl.style.display = "block";
  } else { notesEl.style.display = "none"; }

  const esEl = document.getElementById("ans-example-es");
  const enEl = document.getElementById("ans-example-en");
  if (c.example_es && c.example_es !== "None") {
    esEl.textContent = c.example_es; esEl.style.display = "block";
  } else { esEl.style.display = "none"; }
  if (c.example_en && c.example_en !== "None") {
    enEl.textContent = c.example_en; enEl.style.display = "block";
  } else { enEl.style.display = "none"; }

  document.getElementById("answer-area").style.display = "block";
  document.getElementById("btn-show").style.display    = "none";
  document.getElementById("rating-area").style.display = "block";

  if (mode === "en_es") callPronounce(spanishWord(c), "es");
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

function pronounce() {
  if (!curCard) return;
  callPronounce(spanishWord(curCard), "es");
}

function setMode(m) {
  mode = m;
  document.getElementById("btn-es-en").classList.toggle("active", m === "es_en");
  document.getElementById("btn-en-es").classList.toggle("active", m === "en_es");
}
function setDialect(d) {
  dialect = d;
  document.getElementById("btn-dialect-es").classList.toggle("active", d === "es");
  document.getElementById("btn-dialect-mx").classList.toggle("active", d === "mx");
}
function spanishWord(card) {
  return (dialect === "mx" && card.spanish_mx) ? card.spanish_mx : card.spanish;
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
    <h4 style="color:var(--red);margin-bottom:8px;">Progress by Category</h4>
    <table class="cat-table">
      <thead><tr><th>Category</th><th>Total</th><th>Mature</th><th>Due</th></tr></thead>
      <tbody>`;
  for (const [cat, s] of Object.entries(cats).sort()) {
    const pct = s.total ? Math.round(100 * s.mature / s.total) : 0;
    html += `<tr>
      <td>${cat}</td><td>${s.total}</td>
      <td><div>${s.mature} (${pct}%)</div>
          <div class="pct-bar"><div class="pct-fill" style="width:${pct}%"></div></div></td>
      <td style="color:${s.due > 0 ? 'var(--amber)' : 'var(--dgrey)'};font-weight:${s.due>0?700:400}">${s.due||'\u2014'}</td>
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
  if (e.key === "p" || e.key === "P") pronounce();
  if (e.key === "Enter" && document.getElementById("welcome").style.display !== "none") startSession();
  if (e.key === "Escape") closeStats();
});

init();
</script>
</body>
</html>
"""

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000, debug=False)
