# Vietnamese Pronunciation Enhancement — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Vietnamese syllable breakdown panel (on-demand in all card modes + auto-expanded PRON mode) and a standalone `/pronunciation` reference page covering tones, vowels, consonants, and clusters with TTS buttons.

**Architecture:** Pure frontend additions — one new `viet_syllable.js` parser/TTS module, one new Flask route + reference page, and targeted changes to `viet.html`. `shared.js` is not modified. All pronunciation logic goes through `LANG_CONFIG` hooks (`getQuestion`, `renderAnswer`, `handleExtraKeys`).

**Tech Stack:** Vanilla JS (ES5 compatible, no build step), Flask `Path.read_text()` pattern, Web Speech API (`speechSynthesis`), existing `shared.css` + viet CSS variables.

**Spec:** `docs/superpowers/specs/2026-03-13-viet-pronunciation-design.md`

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `static/viet_syllable.js` | Create | Syllable parser, tone detection, stripTone, callPronounce |
| `tests/test_viet_syllable.html` | Create | Browser-based test runner for the parser |
| `vietnamese/viet_anki.py` | Modify | Add `/pronunciation` Flask route |
| `templates/viet_pronunciation.html` | Create | Full reference page (tones, vowels, consonants, clusters) |
| `templates/viet.html` | Modify | PRON mode button, updateModeUI, breakdown panel, B key |

---

## Chunk 1: Syllable Parser

### Task 1: `viet_syllable.js`

**Files:**
- Create: `static/viet_syllable.js`

- [ ] **Step 1: Write `static/viet_syllable.js`**

```js
/* viet_syllable.js — Vietnamese syllable parser and TTS helper.
   No dependencies. Works in browser alongside shared.js.
   Exports: window.VietSyllable = { parse, stripTone, callPronounce } */
(function () {
  'use strict';

  // Tone diacritic → [toneName, toneNum]
  // toneNum 1=ngang, 2=huyền, 3=hỏi, 4=ngã, 5=sắc, 6=nặng
  var TONE_MAP = {
    'á':'sắc','ắ':'sắc','ấ':'sắc','é':'sắc','ế':'sắc','í':'sắc',
    'ó':'sắc','ố':'sắc','ớ':'sắc','ú':'sắc','ứ':'sắc','ý':'sắc',
    'à':'huyền','ằ':'huyền','ầ':'huyền','è':'huyền','ề':'huyền','ì':'huyền',
    'ò':'huyền','ồ':'huyền','ờ':'huyền','ù':'huyền','ừ':'huyền','ỳ':'huyền',
    'ả':'hỏi','ẳ':'hỏi','ẩ':'hỏi','ẻ':'hỏi','ể':'hỏi','ỉ':'hỏi',
    'ỏ':'hỏi','ổ':'hỏi','ở':'hỏi','ủ':'hỏi','ử':'hỏi','ỷ':'hỏi',
    'ã':'ngã','ẵ':'ngã','ẫ':'ngã','ẽ':'ngã','ễ':'ngã','ĩ':'ngã',
    'õ':'ngã','ỗ':'ngã','ỡ':'ngã','ũ':'ngã','ữ':'ngã','ỹ':'ngã',
    'ạ':'nặng','ặ':'nặng','ậ':'nặng','ẹ':'nặng','ệ':'nặng','ị':'nặng',
    'ọ':'nặng','ộ':'nặng','ợ':'nặng','ụ':'nặng','ự':'nặng','ỵ':'nặng',
  };

  var TONE_NUM = { ngang:1, huyền:2, hỏi:3, ngã:4, sắc:5, nặng:6 };

  // Tone-marked vowel → base vowel (for display in breakdown)
  var STRIP_MAP = {
    'á':'a','ắ':'ă','ấ':'â','é':'e','ế':'ê','í':'i','ó':'o','ố':'ô','ớ':'ơ','ú':'u','ứ':'ư','ý':'y',
    'à':'a','ằ':'ă','ầ':'â','è':'e','ề':'ê','ì':'i','ò':'o','ồ':'ô','ờ':'ơ','ù':'u','ừ':'ư','ỳ':'y',
    'ả':'a','ẳ':'ă','ẩ':'â','ẻ':'e','ể':'ê','ỉ':'i','ỏ':'o','ổ':'ô','ở':'ơ','ủ':'u','ử':'ư','ỷ':'y',
    'ã':'a','ẵ':'ă','ẫ':'â','ẽ':'e','ễ':'ê','ĩ':'i','õ':'o','ỗ':'ô','ỡ':'ơ','ũ':'u','ữ':'ư','ỹ':'y',
    'ạ':'a','ặ':'ă','ậ':'â','ẹ':'e','ệ':'ê','ị':'i','ọ':'o','ộ':'ô','ợ':'ơ','ụ':'u','ự':'ư','ỵ':'y',
  };

  // Ordered longest-first so we match "ngh" before "ng" before "nh" etc.
  var INITIALS = [
    'ngh','ng','nh','ch','gh','gi','kh','ph','th','tr','qu',
    'b','c','d','đ','g','h','k','l','m','n','p','r','s','t','v','x'
  ];

  // Ordered longest-first: ch/ng/nh before single consonants
  var FINALS = ['ch','ng','nh','c','m','n','p','t'];

  function detectTone(syl) {
    for (var i = 0; i < syl.length; i++) {
      var t = TONE_MAP[syl[i]];
      if (t) return { tone: t, toneNum: TONE_NUM[t] };
    }
    return { tone: 'ngang', toneNum: 1 };
  }

  function stripToneStr(s) {
    var out = '';
    for (var i = 0; i < s.length; i++) {
      out += STRIP_MAP[s[i]] || s[i];
    }
    return out;
  }

  function parseSyllable(raw) {
    var syl = raw.trim();
    if (!syl) return null;

    // Step 1: detect tone (keep diacritics for steps 2-4)
    var toneInfo = detectTone(syl);

    // Step 2: match initial consonant (longest first, against original string)
    var initial = '';
    for (var i = 0; i < INITIALS.length; i++) {
      if (syl.slice(0, INITIALS[i].length) === INITIALS[i]) {
        initial = INITIALS[i];
        break;
      }
    }

    // Edge case: gi stripped leaves nothing (standalone "gì" can't happen due to
    // tone marks on i, but guard defensively anyway)
    var rest = syl.slice(initial.length);
    if (!rest && initial === 'gi') {
      return { raw: raw, tone: toneInfo.tone, toneNum: toneInfo.toneNum, initial: '', nucleus: stripToneStr(syl), final: '' };
    }

    // Step 3: match final consonant (longest first) — nucleus must be non-empty
    var final_ = '';
    for (var j = 0; j < FINALS.length; j++) {
      var f = FINALS[j];
      if (rest.length > f.length && rest.slice(-f.length) === f) {
        final_ = f;
        rest = rest.slice(0, rest.length - f.length);
        break;
      }
    }

    // Steps 4+5: rest is the nucleus (with tone mark); strip for display
    return {
      raw:     raw,
      tone:    toneInfo.tone,
      toneNum: toneInfo.toneNum,
      initial: initial,
      nucleus: stripToneStr(rest),
      final:   final_,
    };
  }

  function parse(word) {
    if (!word) return [];
    return word.trim().split(/\s+/).map(parseSyllable).filter(Boolean);
  }

  // Passes text DIRECTLY to SpeechSynthesisUtterance — no stripping,
  // tone diacritics must be preserved for correct Vietnamese TTS.
  function callPronounce(text, lang) {
    if (!window.speechSynthesis) return;
    var utt = new SpeechSynthesisUtterance(text);
    utt.lang = lang || 'vi-VN';
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utt);
  }

  window.VietSyllable = {
    parse:         parse,
    stripTone:     function (ch) { return STRIP_MAP[ch] || ch; },
    callPronounce: callPronounce,
  };
})();
```

- [ ] **Step 2: Commit**

```bash
git add static/viet_syllable.js
git commit -m "feat: add Vietnamese syllable parser (viet_syllable.js)"
```

---

### Task 2: Browser Test Runner

**Files:**
- Create: `tests/test_viet_syllable.html`

- [ ] **Step 1: Write `tests/test_viet_syllable.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>viet_syllable.js tests</title>
<style>
  body { font-family: monospace; padding: 20px; background: #f8f8f8; }
  .pass { color: green; } .fail { color: red; font-weight: bold; }
  h2 { margin: 20px 0 8px; font-size: 14px; color: #333; }
  pre { background: white; padding: 8px; border-radius: 4px; font-size: 12px; }
  #summary { font-size: 18px; font-weight: bold; margin: 20px 0; }
</style>
</head>
<body>
<h1>viet_syllable.js — Test Results</h1>
<div id="summary"></div>
<div id="results"></div>
<script src="../static/viet_syllable.js"></script>
<script>
var pass = 0, fail = 0;
var out = document.getElementById('results');

function assert(desc, actual, expected) {
  var actualStr   = JSON.stringify(actual);
  var expectedStr = JSON.stringify(expected);
  var ok = actualStr === expectedStr;
  if (ok) pass++; else fail++;
  out.innerHTML += '<div class="' + (ok ? 'pass' : 'fail') + '">' +
    (ok ? '✓' : '✗') + ' ' + desc +
    (ok ? '' : '<pre>got:      ' + actualStr + '\nexpected: ' + expectedStr + '</pre>') +
    '</div>';
}

var P = window.VietSyllable;

// ── Tone detection ────────────────────────────────────────────────────────
out.innerHTML += '<h2>Tone detection</h2>';
var t;
t = P.parse('ma')[0];  assert('ma → ngang (1)', [t.tone, t.toneNum], ['ngang', 1]);
t = P.parse('má')[0];  assert('má → sắc (5)',   [t.tone, t.toneNum], ['sắc', 5]);
t = P.parse('mà')[0];  assert('mà → huyền (2)', [t.tone, t.toneNum], ['huyền', 2]);
t = P.parse('mả')[0];  assert('mả → hỏi (3)',   [t.tone, t.toneNum], ['hỏi', 3]);
t = P.parse('mã')[0];  assert('mã → ngã (4)',    [t.tone, t.toneNum], ['ngã', 4]);
t = P.parse('mạ')[0];  assert('mạ → nặng (6)',  [t.tone, t.toneNum], ['nặng', 6]);

// ── Initial consonant ─────────────────────────────────────────────────────
out.innerHTML += '<h2>Initial consonant</h2>';
assert('ba  → initial b',   P.parse('ba')[0].initial,  'b');
assert('cha → initial ch',  P.parse('cha')[0].initial, 'ch');
assert('nga → initial ng',  P.parse('nga')[0].initial, 'ng');
assert('ngh → initial ngh', P.parse('nghề')[0].initial,'ngh');
assert('khá → initial kh',  P.parse('khá')[0].initial, 'kh');
assert('già → initial gi',  P.parse('già')[0].initial, 'gi');
assert('ăn  → initial ""',  P.parse('ăn')[0].initial,  '');

// ── Final consonant ───────────────────────────────────────────────────────
out.innerHTML += '<h2>Final consonant</h2>';
assert('mắt → final t',    P.parse('mắt')[0].final,   't');
assert('không → final ng', P.parse('không')[0].final, 'ng');
assert('anh  → final nh',  P.parse('anh')[0].final,   'nh');
assert('học  → final c',   P.parse('học')[0].final,   'c');
assert('cam  → final m',   P.parse('cam')[0].final,   'm');
assert('hợp  → final p',   P.parse('hợp')[0].final,   'p');
assert('cha  → final ""',  P.parse('cha')[0].final,   '');

// ── Nucleus (tone stripped) ───────────────────────────────────────────────
out.innerHTML += '<h2>Nucleus (tone stripped)</h2>';
assert('mắt  nucleus = ă',  P.parse('mắt')[0].nucleus,  'ă');
assert('không nucleus = ô', P.parse('không')[0].nucleus,'ô');
assert('cha   nucleus = a', P.parse('cha')[0].nucleus,  'a');
assert('chào  nucleus = ao',P.parse('chào')[0].nucleus, 'ao');
assert('anh   nucleus = a', P.parse('anh')[0].nucleus,  'a');

// ── Multi-syllable ────────────────────────────────────────────────────────
out.innerHTML += '<h2>Multi-syllable phrases</h2>';
var xin_chao = P.parse('xin chào');
assert('xin chào → 2 syllables', xin_chao.length, 2);
assert('xin chào[0].raw = xin',  xin_chao[0].raw,     'xin');
assert('xin chào[0].initial = x',xin_chao[0].initial, 'x');
assert('xin chào[0].final = n',  xin_chao[0].final,   'n');
assert('xin chào[0].tone = ngang',xin_chao[0].tone,   'ngang');
assert('xin chào[1].raw = chào', xin_chao[1].raw,     'chào');
assert('xin chào[1].initial = ch',xin_chao[1].initial,'ch');
assert('xin chào[1].tone = huyền',xin_chao[1].tone,   'huyền');

// ── cam ơn ────────────────────────────────────────────────────────────────
var cam_on = P.parse('cảm ơn');
assert('cảm ơn → 2 syllables', cam_on.length, 2);
assert('cảm tone = hỏi',  cam_on[0].tone,    'hỏi');
assert('cảm initial = c', cam_on[0].initial, 'c');
assert('cảm final = m',   cam_on[0].final,   'm');
assert('ơn initial = ""', cam_on[1].initial, '');
assert('ơn nucleus = ơ',  cam_on[1].nucleus, 'ơ');
assert('ơn final = n',    cam_on[1].final,   'n');

// ── gi edge case ─────────────────────────────────────────────────────────
out.innerHTML += '<h2>gi edge case</h2>';
// "gì" = g + ì; gi prefix doesn't match because ì ≠ i, so initial = 'g'
t = P.parse('gì')[0];
assert('gì initial = g',       t.initial,  'g');
assert('gì nucleus = i',       t.nucleus,  'i');
assert('gì tone = huyền',      t.tone,     'huyền');
assert('gì toneNum = 2',       t.toneNum,  2);
// "già" (old) = gi + à; gi matches, rest = "à"
t = P.parse('già')[0];
assert('già initial = gi',     t.initial,  'gi');
assert('già nucleus = a',      t.nucleus,  'a');
assert('già tone = huyền',     t.tone,     'huyền');

// ── stripTone ─────────────────────────────────────────────────────────────
out.innerHTML += '<h2>stripTone helper</h2>';
assert('stripTone á = a', P.stripTone('á'), 'a');
assert('stripTone ắ = ă', P.stripTone('ắ'), 'ă');
assert('stripTone ậ = â', P.stripTone('ậ'), 'â');
assert('stripTone z = z (pass-through)', P.stripTone('z'), 'z');

// ── Summary ───────────────────────────────────────────────────────────────
document.getElementById('summary').innerHTML =
  '<span class="' + (fail === 0 ? 'pass' : 'fail') + '">' +
  pass + ' passed, ' + fail + ' failed' +
  '</span>';
</script>
</body>
</html>
```

- [ ] **Step 2: Open test in browser and verify all green**

Open `tests/test_viet_syllable.html` in a browser (open the file directly — no server needed for the parser tests).

Expected: all tests pass (green). If any fail, fix `viet_syllable.js` and refresh.

- [ ] **Step 3: Commit**

```bash
git add tests/test_viet_syllable.html
git commit -m "test: add browser test suite for viet_syllable parser"
```

---

## Chunk 2: Flask Route + Reference Page

### Task 3: Add `/pronunciation` route

**Files:**
- Modify: `vietnamese/viet_anki.py`

- [ ] **Step 1: Add `PRON_TEMPLATE` path and `/pronunciation` route**

In `viet_anki.py`, after line 17 (`TEMPLATE = BASE.parent / "templates" / "viet.html"`), add:

```python
PRON_TEMPLATE = BASE.parent / "templates" / "viet_pronunciation.html"
```

Then after the `/api/vocab/viet` route, add:

```python
@app.route("/pronunciation")
def pronunciation():
    return PRON_TEMPLATE.read_text()
```

- [ ] **Step 2: Verify route**

Start the server: `python3 vietnamese/viet_anki.py`

Open `http://localhost:5000/pronunciation` — expect a 200 response (will show blank page until Task 4, or a 500 if `viet_pronunciation.html` doesn't exist yet — that's fine, create that file next).

- [ ] **Step 3: Commit**

```bash
git add vietnamese/viet_anki.py
git commit -m "feat: add /pronunciation Flask route"
```

---

### Task 4: Reference Page

**Files:**
- Create: `templates/viet_pronunciation.html`

- [ ] **Step 1: Write `templates/viet_pronunciation.html`**

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Vietnamese Pronunciation Guide</title>
<link rel="stylesheet" href="/static/shared.css">
<style>
  :root {
    --primary:     #8B0000;
    --primary-dk:  #6B0000;
    --accent:      #CC2233;
    --accent2:     #F4C430;
    --card-shadow: rgba(139,0,0,0.12);
    --card-bg:     #FFFDF8;
  }
  /* Tone colours */
  .t-ngang { color: #777;    }
  .t-huyen { color: #1a6fbf; }
  .t-hoi   { color: #2a9d4e; }
  .t-nga   { color: #8b4fbf; }
  .t-sac   { color: #cc2233; }
  .t-nang  { color: #7a3000; }

  #main { max-width: 860px; margin: 24px auto; padding: 0 16px 60px; }

  .section { background: white; border-radius: 12px; box-shadow: 0 2px 10px var(--card-shadow);
             padding: 24px 28px; margin-bottom: 24px; }
  .section h2 { color: var(--primary); font-size: 20px; margin-bottom: 6px; }
  .section .subtitle { color: var(--dgrey); font-size: 13px; margin-bottom: 18px; }

  /* Reference tables */
  .ref-table { width: 100%; border-collapse: collapse; font-size: 14px; }
  .ref-table th { background: var(--primary); color: white; padding: 8px 12px; text-align: left;
                  font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; }
  .ref-table td { padding: 9px 12px; border-bottom: 1px solid #F0EEE8; vertical-align: middle; }
  .ref-table tbody tr:hover { background: #FFF8F0; }
  .ref-table .eg { font-weight: 700; font-size: 16px; color: var(--primary); }
  .ref-table .mark { font-size: 18px; font-weight: 700; text-align: center; }
  .ref-table .name { font-weight: 700; }

  /* Vowel grid (2-col layout on wide) */
  .vowel-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0; }
  .vowel-grid .ref-table { margin: 0; }
  @media (max-width: 600px) { .vowel-grid { grid-template-columns: 1fr; } }

  .tts-btn {
    background: #D6EAF8; border: none; color: var(--primary);
    padding: 5px 10px; border-radius: 6px; cursor: pointer; font-size: 13px;
    font-weight: 600; transition: background 0.2s; white-space: nowrap;
  }
  .tts-btn:hover { background: #BDD4EB; }

  .tone-name { font-weight: 700; font-size: 15px; }
  .tone-pitch { font-size: 13px; color: #555; font-style: italic; }

  .back-link { display: inline-block; margin-bottom: 16px; color: var(--accent);
               font-size: 14px; font-weight: 600; text-decoration: none; }
  .back-link:hover { text-decoration: underline; }

  .note { background: #FFF8F0; border-left: 3px solid var(--accent2);
          padding: 10px 14px; border-radius: 0 6px 6px 0;
          font-size: 13px; color: #334; margin-top: 14px; }
</style>
</head>
<body>

<div id="topbar">
  <h1>&#x1F1FB;&#x1F1F3; Pronunciation Guide</h1>
  <div class="spacer"></div>
  <a href="/" style="color:rgba(255,255,255,0.8);font-size:13px;text-decoration:none;">&#8592; Back to Anki</a>
</div>

<div id="main">

  <!-- ── Section 1: The 6 Tones ─────────────────────────────────────── -->
  <div class="section">
    <h2>1. The 6 Tones</h2>
    <p class="subtitle">Vietnamese is a tonal language — the same syllable spoken with different pitch means a completely different word. All 6 tones use "ma" as the example.</p>
    <table class="ref-table">
      <thead><tr><th>#</th><th>Mark</th><th>Name</th><th>Pitch</th><th>Example</th><th></th></tr></thead>
      <tbody>
        <tr>
          <td>1</td>
          <td class="mark t-ngang">—</td>
          <td class="name t-ngang">ngang</td>
          <td class="tone-pitch">Mid level, steady</td>
          <td class="eg t-ngang">ma <span style="font-weight:400;font-size:13px">(ghost)</span></td>
          <td><button class="tts-btn" onclick="VietSyllable.callPronounce('ma','vi-VN')">&#128266; Play</button></td>
        </tr>
        <tr>
          <td>2</td>
          <td class="mark t-huyen">&#768;</td>
          <td class="name t-huyen">huyền</td>
          <td class="tone-pitch">Low falling, breathy</td>
          <td class="eg t-huyen">mà <span style="font-weight:400;font-size:13px">(but)</span></td>
          <td><button class="tts-btn" onclick="VietSyllable.callPronounce('mà','vi-VN')">&#128266; Play</button></td>
        </tr>
        <tr>
          <td>3</td>
          <td class="mark t-hoi">&#777;</td>
          <td class="name t-hoi">hỏi</td>
          <td class="tone-pitch">Mid dipping then rising</td>
          <td class="eg t-hoi">mả <span style="font-weight:400;font-size:13px">(tomb)</span></td>
          <td><button class="tts-btn" onclick="VietSyllable.callPronounce('mả','vi-VN')">&#128266; Play</button></td>
        </tr>
        <tr>
          <td>4</td>
          <td class="mark t-nga">&#771;</td>
          <td class="name t-nga">ngã</td>
          <td class="tone-pitch">Mid rising, creaky / glottal</td>
          <td class="eg t-nga">mã <span style="font-weight:400;font-size:13px">(horse/code)</span></td>
          <td><button class="tts-btn" onclick="VietSyllable.callPronounce('mã','vi-VN')">&#128266; Play</button></td>
        </tr>
        <tr>
          <td>5</td>
          <td class="mark t-sac">&#769;</td>
          <td class="name t-sac">sắc</td>
          <td class="tone-pitch">High rising</td>
          <td class="eg t-sac">má <span style="font-weight:400;font-size:13px">(mother/cheek)</span></td>
          <td><button class="tts-btn" onclick="VietSyllable.callPronounce('má','vi-VN')">&#128266; Play</button></td>
        </tr>
        <tr>
          <td>6</td>
          <td class="mark t-nang">&#803;</td>
          <td class="name t-nang">nặng</td>
          <td class="tone-pitch">Low falling, heavy / cut short</td>
          <td class="eg t-nang">mạ <span style="font-weight:400;font-size:13px">(rice seedling)</span></td>
          <td><button class="tts-btn" onclick="VietSyllable.callPronounce('mạ','vi-VN')">&#128266; Play</button></td>
        </tr>
      </tbody>
    </table>
    <div class="note">&#128161; Tip: The tone mark sits on the main vowel of the syllable. In "không", the mark is on "ô". In "cảm", it's on "ả".</div>
  </div>

  <!-- ── Section 2: Simple Vowels ──────────────────────────────────── -->
  <div class="section">
    <h2>2. Simple Vowels</h2>
    <p class="subtitle">Vietnamese has 12 pure vowels. The three "modified" ones (ă, â, ơ, ư) have no direct English equivalent — listen carefully.</p>
    <table class="ref-table">
      <thead><tr><th>Vowel</th><th>Think of it as…</th><th>Example</th><th></th></tr></thead>
      <tbody>
        <tr><td class="eg">a</td><td>"ah" as in <em>father</em></td><td class="eg">ba <span style="font-weight:400;font-size:13px">(three / dad)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('ba','vi-VN')">&#128266;</button></td></tr>
        <tr><td class="eg">ă</td><td>Short "a", clipped — like <em>cat</em> but briefer</td><td class="eg">ăn <span style="font-weight:400;font-size:13px">(eat)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('ăn','vi-VN')">&#128266;</button></td></tr>
        <tr><td class="eg">â</td><td>"uh" as in <em>but</em> — central, unstressed</td><td class="eg">ân <span style="font-weight:400;font-size:13px">(grace)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('ân','vi-VN')">&#128266;</button></td></tr>
        <tr><td class="eg">e</td><td>"eh" as in <em>bed</em></td><td class="eg">em <span style="font-weight:400;font-size:13px">(younger sibling)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('em','vi-VN')">&#128266;</button></td></tr>
        <tr><td class="eg">ê</td><td>"ay" as in <em>hey</em> (tense, no glide)</td><td class="eg">bê <span style="font-weight:400;font-size:13px">(calf)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('bê','vi-VN')">&#128266;</button></td></tr>
        <tr><td class="eg">i</td><td>"ee" as in <em>bee</em></td><td class="eg">tim <span style="font-weight:400;font-size:13px">(heart)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('tim','vi-VN')">&#128266;</button></td></tr>
        <tr><td class="eg">y</td><td>"ee" — same sound as i, used after consonant clusters</td><td class="eg">ý <span style="font-weight:400;font-size:13px">(meaning / wish)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('ý','vi-VN')">&#128266;</button></td></tr>
        <tr><td class="eg">o</td><td>"aw" as in <em>saw</em></td><td class="eg">bò <span style="font-weight:400;font-size:13px">(cow)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('bò','vi-VN')">&#128266;</button></td></tr>
        <tr><td class="eg">ô</td><td>"oh" as in <em>go</em> (tense, no glide)</td><td class="eg">tôi <span style="font-weight:400;font-size:13px">(I / me)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('tôi','vi-VN')">&#128266;</button></td></tr>
        <tr><td class="eg">ơ</td><td>"uh" as in <em>bird</em> — back of mouth, unrounded</td><td class="eg">ơi <span style="font-weight:400;font-size:13px">(hey!)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('ơi','vi-VN')">&#128266;</button></td></tr>
        <tr><td class="eg">u</td><td>"oo" as in <em>moon</em></td><td class="eg">mua <span style="font-weight:400;font-size:13px">(buy)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('mua','vi-VN')">&#128266;</button></td></tr>
        <tr><td class="eg">ư</td><td>Unrounded "oo" — say "oo" but spread your lips flat</td><td class="eg">tư <span style="font-weight:400;font-size:13px">(four)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('tư','vi-VN')">&#128266;</button></td></tr>
      </tbody>
    </table>
  </div>

  <!-- ── Section 3: Vowel Clusters ─────────────────────────────────── -->
  <div class="section">
    <h2>3. Vowel Clusters</h2>
    <p class="subtitle">These common combinations are pronounced as smooth glides. The tone mark sits on the main (most prominent) vowel.</p>
    <table class="ref-table">
      <thead><tr><th>Cluster</th><th>Example</th><th></th><th>Cluster</th><th>Example</th><th></th></tr></thead>
      <tbody>
        <tr>
          <td class="eg">ai</td><td>tai <span style="font-weight:400;font-size:12px">(ear)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('tai','vi-VN')">&#128266;</button></td>
          <td class="eg">ôi</td><td>tôi <span style="font-weight:400;font-size:12px">(I/me)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('tôi','vi-VN')">&#128266;</button></td>
        </tr>
        <tr>
          <td class="eg">ao</td><td>cao <span style="font-weight:400;font-size:12px">(tall)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('cao','vi-VN')">&#128266;</button></td>
          <td class="eg">ơi</td><td>ơi <span style="font-weight:400;font-size:12px">(hey!)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('ơi','vi-VN')">&#128266;</button></td>
        </tr>
        <tr>
          <td class="eg">au</td><td>màu <span style="font-weight:400;font-size:12px">(colour)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('màu','vi-VN')">&#128266;</button></td>
          <td class="eg">ua</td><td>mua <span style="font-weight:400;font-size:12px">(buy)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('mua','vi-VN')">&#128266;</button></td>
        </tr>
        <tr>
          <td class="eg">ay</td><td>tay <span style="font-weight:400;font-size:12px">(hand / arm)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('tay','vi-VN')">&#128266;</button></td>
          <td class="eg">uô</td><td>cuốc <span style="font-weight:400;font-size:12px">(hoe)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('cuốc','vi-VN')">&#128266;</button></td>
        </tr>
        <tr>
          <td class="eg">eo</td><td>kẻo <span style="font-weight:400;font-size:12px">(lest)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('kẻo','vi-VN')">&#128266;</button></td>
          <td class="eg">ưa</td><td>mưa <span style="font-weight:400;font-size:12px">(rain)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('mưa','vi-VN')">&#128266;</button></td>
        </tr>
        <tr>
          <td class="eg">ia</td><td>chia <span style="font-weight:400;font-size:12px">(share)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('chia','vi-VN')">&#128266;</button></td>
          <td class="eg">ươ</td><td>được <span style="font-weight:400;font-size:12px">(can / allowed)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('được','vi-VN')">&#128266;</button></td>
        </tr>
        <tr>
          <td class="eg">iê</td><td>tiên <span style="font-weight:400;font-size:12px">(fairy)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('tiên','vi-VN')">&#128266;</button></td>
          <td class="eg">uê</td><td>tuệ <span style="font-weight:400;font-size:12px">(wisdom)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('tuệ','vi-VN')">&#128266;</button></td>
        </tr>
        <tr>
          <td class="eg">oa</td><td>hoa <span style="font-weight:400;font-size:12px">(flower)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('hoa','vi-VN')">&#128266;</button></td>
          <td class="eg">uy</td><td>tuy <span style="font-weight:400;font-size:12px">(although)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('tuy','vi-VN')">&#128266;</button></td>
        </tr>
        <tr>
          <td class="eg">oe</td><td>khoe <span style="font-weight:400;font-size:12px">(show off)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('khoe','vi-VN')">&#128266;</button></td>
          <td class="eg">oai</td><td>ngoài <span style="font-weight:400;font-size:12px">(outside)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('ngoài','vi-VN')">&#128266;</button></td>
        </tr>
        <tr>
          <td class="eg">oi</td><td>nói <span style="font-weight:400;font-size:12px">(say)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('nói','vi-VN')">&#128266;</button></td>
          <td class="eg">uôi</td><td>muối <span style="font-weight:400;font-size:12px">(salt)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('muối','vi-VN')">&#128266;</button></td>
        </tr>
        <tr>
          <td class="eg">ươi</td><td>người <span style="font-weight:400;font-size:12px">(person)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('người','vi-VN')">&#128266;</button></td>
          <td class="eg">ươu</td><td>rượu <span style="font-weight:400;font-size:12px">(alcohol)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('rượu','vi-VN')">&#128266;</button></td>
        </tr>
      </tbody>
    </table>
  </div>

  <!-- ── Section 4: Initial Consonants ─────────────────────────────── -->
  <div class="section">
    <h2>4. Initial Consonants</h2>
    <p class="subtitle">Vietnamese has some consonants with no English equivalent, and several spellings that share a sound. Regional differences (North vs South) are noted.</p>
    <table class="ref-table">
      <thead><tr><th>Spelling</th><th>Sounds like…</th><th>Notes</th><th>Example</th><th></th></tr></thead>
      <tbody>
        <tr><td class="eg">b</td><td>b</td><td>Like English "b"</td><td class="eg">ba</td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('ba','vi-VN')">&#128266;</button></td></tr>
        <tr><td class="eg">c / k</td><td>k</td><td>"k" sound — c before a/o/u, k before e/ê/i</td><td class="eg">ca</td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('ca','vi-VN')">&#128266;</button></td></tr>
        <tr><td class="eg">ch</td><td>ch</td><td>Like "ch" in <em>chair</em></td><td class="eg">cha</td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('cha','vi-VN')">&#128266;</button></td></tr>
        <tr><td class="eg" style="color:#cc2233">d</td><td>z (N) / y (S)</td><td>"z" in Hanoi, "y" in Saigon — same sound as <strong>gi</strong></td><td class="eg">da</td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('da','vi-VN')">&#128266;</button></td></tr>
        <tr><td class="eg" style="color:#cc2233">đ</td><td>d</td><td>Hard retroflex "d" — firmer than English "d"</td><td class="eg">đi</td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('đi','vi-VN')">&#128266;</button></td></tr>
        <tr><td class="eg">g / gh</td><td>g</td><td>Like "g" in <em>go</em> — gh used before e/ê/i</td><td class="eg">ga</td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('ga','vi-VN')">&#128266;</button></td></tr>
        <tr><td class="eg" style="color:#cc2233">gi</td><td>z (N) / y (S)</td><td>Same sound as d — one of the most confusing for beginners</td><td class="eg">gia</td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('gia','vi-VN')">&#128266;</button></td></tr>
        <tr><td class="eg">h</td><td>h</td><td>Like English "h"</td><td class="eg">hai</td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('hai','vi-VN')">&#128266;</button></td></tr>
        <tr><td class="eg">kh</td><td>kh</td><td>Like "ch" in Scottish <em>loch</em> — guttural</td><td class="eg">khi</td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('khi','vi-VN')">&#128266;</button></td></tr>
        <tr><td class="eg">l</td><td>l</td><td>Like English "l"</td><td class="eg">lá</td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('lá','vi-VN')">&#128266;</button></td></tr>
        <tr><td class="eg">m</td><td>m</td><td>Like English "m"</td><td class="eg">mà</td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('mà','vi-VN')">&#128266;</button></td></tr>
        <tr><td class="eg">n</td><td>n</td><td>Like English "n"</td><td class="eg">na</td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('na','vi-VN')">&#128266;</button></td></tr>
        <tr><td class="eg">ng / ngh</td><td>ng</td><td>Like "ng" in <em>sing</em> — ngh used before e/ê/i</td><td class="eg">nga</td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('nga','vi-VN')">&#128266;</button></td></tr>
        <tr><td class="eg">nh</td><td>ny</td><td>Like "ny" in <em>canyon</em> — or Spanish ñ</td><td class="eg">nhà</td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('nhà','vi-VN')">&#128266;</button></td></tr>
        <tr><td class="eg">ph</td><td>f</td><td>Like English "f" — not "ph" as in English</td><td class="eg">phở</td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('phở','vi-VN')">&#128266;</button></td></tr>
        <tr><td class="eg">qu</td><td>kw</td><td>Always followed by vowel; the "u" is part of the initial cluster</td><td class="eg">quả</td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('quả','vi-VN')">&#128266;</button></td></tr>
        <tr><td class="eg" style="color:#cc2233">r</td><td>r (S) / z (N)</td><td>Rolled "r" in south; "z" in north</td><td class="eg">ra</td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('ra','vi-VN')">&#128266;</button></td></tr>
        <tr><td class="eg" style="color:#cc2233">s</td><td>s (S) / sh (N)</td><td>"s" in south, "sh" in north</td><td class="eg">sa</td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('sa','vi-VN')">&#128266;</button></td></tr>
        <tr><td class="eg">t</td><td>t</td><td>Like English "t"</td><td class="eg">ta</td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('ta','vi-VN')">&#128266;</button></td></tr>
        <tr><td class="eg">th</td><td>th (aspirated)</td><td>Aspirated "t" — "t" with a strong puff of air. NOT like English "th".</td><td class="eg">tha</td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('tha','vi-VN')">&#128266;</button></td></tr>
        <tr><td class="eg" style="color:#cc2233">tr</td><td>tr (S) / ch (N)</td><td>"tr" in south, "ch" in north</td><td class="eg">tra</td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('tra','vi-VN')">&#128266;</button></td></tr>
        <tr><td class="eg" style="color:#cc2233">v</td><td>v (N) / y (S)</td><td>"v" in north, "y" in south</td><td class="eg">vào</td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('vào','vi-VN')">&#128266;</button></td></tr>
        <tr><td class="eg">x</td><td>s</td><td>Always "s" sound — not like English "x"</td><td class="eg">xa</td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('xa','vi-VN')">&#128266;</button></td></tr>
      </tbody>
    </table>
    <div class="note">&#128161; Red entries have <strong>regional differences</strong> between Northern (Hanoi) and Southern (Saigon) Vietnamese. Both are standard; pick one and be consistent.</div>
  </div>

  <!-- ── Section 5: Final Consonants ───────────────────────────────── -->
  <div class="section">
    <h2>5. Final Consonants</h2>
    <p class="subtitle">Vietnamese final consonants are <strong>unreleased stops</strong> — you form the position but don't let air out. This is very different from English.</p>
    <table class="ref-table">
      <thead><tr><th>Spelling</th><th>Notes</th><th>Example</th><th></th></tr></thead>
      <tbody>
        <tr><td class="eg">-c</td><td>Unreleased "k" — press tongue to back of mouth, no air escapes</td><td class="eg">học <span style="font-weight:400;font-size:13px">(study)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('học','vi-VN')">&#128266;</button></td></tr>
        <tr><td class="eg">-ch</td><td>Unreleased palatalised stop; slightly nasalises the vowel before it</td><td class="eg">ách <span style="font-weight:400;font-size:13px">(hiccup)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('ách','vi-VN')">&#128266;</button></td></tr>
        <tr><td class="eg">-m</td><td>Like English "m" — lips close</td><td class="eg">cam <span style="font-weight:400;font-size:13px">(orange)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('cam','vi-VN')">&#128266;</button></td></tr>
        <tr><td class="eg">-n</td><td>Like English "n" — tongue on ridge behind teeth</td><td class="eg">ăn <span style="font-weight:400;font-size:13px">(eat)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('ăn','vi-VN')">&#128266;</button></td></tr>
        <tr><td class="eg">-ng</td><td>Nasalises the vowel; like "ng" in <em>sing</em> — tongue to soft palate</td><td class="eg">không <span style="font-weight:400;font-size:13px">(not / no)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('không','vi-VN')">&#128266;</button></td></tr>
        <tr><td class="eg">-nh</td><td>Nasalises vowel with a palatal quality — tongue near hard palate</td><td class="eg">anh <span style="font-weight:400;font-size:13px">(older brother)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('anh','vi-VN')">&#128266;</button></td></tr>
        <tr><td class="eg">-p</td><td>Unreleased "p" — lips close firmly, no puff of air</td><td class="eg">hợp <span style="font-weight:400;font-size:13px">(suitable)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('hợp','vi-VN')">&#128266;</button></td></tr>
        <tr><td class="eg">-t</td><td>Unreleased "t" — tongue on roof of mouth, no puff of air</td><td class="eg">mắt <span style="font-weight:400;font-size:13px">(eye)</span></td><td><button class="tts-btn" onclick="VietSyllable.callPronounce('mắt','vi-VN')">&#128266;</button></td></tr>
      </tbody>
    </table>
    <div class="note">&#128161; Unreleased stops (-c, -ch, -p, -t) are the biggest challenge for English speakers. Practise by humming the vowel and silently forming the final position without any burst of air.</div>
  </div>

</div>

<script src="/static/viet_syllable.js"></script>
</body>
</html>
```

- [ ] **Step 2: Verify reference page**

Restart server if needed: `python3 vietnamese/viet_anki.py`

Open `http://localhost:5000/pronunciation` and verify:
- All 5 sections render
- 🔉 buttons work for at least 2–3 examples
- Back link navigates to `/`

- [ ] **Step 3: Commit**

```bash
git add templates/viet_pronunciation.html
git commit -m "feat: add Vietnamese pronunciation reference page"
```

---

## Chunk 3: Card Integration

### Task 5: Update `viet.html`

**Files:**
- Modify: `templates/viet.html`

This task touches five areas of the file. Apply them in order.

---

#### 5a: Load `viet_syllable.js` and add CSS

- [ ] **Step 1: Add script tag before `shared.js`**

In `viet.html`, change:
```html
<script src="/static/shared.js"></script>
```
to:
```html
<script src="/static/viet_syllable.js"></script>
<script src="/static/shared.js"></script>
```

- [ ] **Step 2: Add breakdown CSS to the `<style>` block**

Append inside the existing `<style>` tag (after the last rule, before `</style>`):

```css
  /* Breakdown panel */
  #btn-breakdown {
    margin-top: 10px; margin-left: 8px;
  }
  #breakdown-panel {
    display: none; margin-top: 14px;
  }
  .breakdown-table {
    width: 100%; border-collapse: collapse; font-size: 13px;
  }
  .breakdown-table th {
    background: var(--primary); color: white; padding: 6px 10px;
    text-align: left; font-size: 11px; text-transform: uppercase; letter-spacing: 0.4px;
  }
  .breakdown-table td {
    padding: 8px 10px; border-bottom: 1px solid #F0EEE8; vertical-align: middle;
  }
  .breakdown-table tbody tr:hover { background: #FFF8F0; }
  .breakdown-table .pron-row { cursor: pointer; }
  .breakdown-table .pron-row:hover { background: #FFE8D0; }
  .breakdown-table .pron-row td { padding: 12px 10px; }
  .breakdown-guide-link {
    display: block; text-align: right; margin-top: 8px;
    font-size: 12px; color: var(--accent); text-decoration: none;
  }
  .breakdown-guide-link:hover { text-decoration: underline; }
  /* Tone colours (matches reference page) */
  .tone-ngang { color: #777;    font-weight: 700; }
  .tone-huyen { color: #1a6fbf; font-weight: 700; }
  .tone-hoi   { color: #2a9d4e; font-weight: 700; }
  .tone-nga   { color: #8b4fbf; font-weight: 700; }
  .tone-sac   { color: #cc2233; font-weight: 700; }
  .tone-nang  { color: #7a3000; font-weight: 700; }
```

---

#### 5b: Add PRON mode button to topbar

- [ ] **Step 1: Add `btn-pron` button in `#topbar`**

Find this line in the topbar:
```html
  <button class="mode-btn"        id="btn-en-vi" onclick="setMode('en_vi')">&#x1F1EC;&#x1F1E7; EN &#8594; VI</button>
```

Add a PRON button immediately after it:
```html
  <button class="mode-btn"        id="btn-pron"  onclick="setMode('pron')">&#128266; PRON</button>
```

---

#### 5c: Add Break Down button and panel to card body

- [ ] **Step 1: Add `#btn-breakdown` and `#breakdown-panel` to card body**

Find this block in the card body:
```html
        <button class="pronounce-btn" id="btn-pronounce"       onclick="pronounce()">&#128266; Vietnamese</button>
        <button class="pronounce-btn" id="btn-pronounce-canto" onclick="pronounceCanto()" style="display:none;margin-left:8px;">&#128266; Cantonese</button>
```

Add two elements after those buttons:
```html
        <button class="pronounce-btn" id="btn-breakdown" onclick="toggleBreakdown()" style="display:none;">&#128200; Break Down</button>
        <div id="breakdown-panel"></div>
```

---

#### 5d: Replace the entire `<script>` block

The `<script>` block in `viet.html` currently spans from `<script>` to `</script>` (lines 135–221 approx). Replace the entire block with the following. This adds PRON mode logic to all LANG_CONFIG hooks, the `updateModeUI` extension, the `renderBreakdown` helper, and the `handleExtraKeys` B key.

- [ ] **Step 1: Replace `<script>…</script>` block**

```html
<script>
/* ── Cantonese TTS ─────────────────────────────────────────────────────── */
function pronounceCanto() {
  var card = window._vietCurCard;
  if (card && card.hanzi) {
    speechSynthesis && speechSynthesis.cancel();
    var utt = new SpeechSynthesisUtterance(card.hanzi);
    utt.lang = "zh-HK";
    speechSynthesis.speak(utt);
  }
}

/* ── Tone CSS class lookup ─────────────────────────────────────────────── */
var TONE_CLASS = {
  ngang: 'tone-ngang', huyền: 'tone-huyen', hỏi: 'tone-hoi',
  ngã:   'tone-nga',   sắc:   'tone-sac',   nặng: 'tone-nang',
};

/* ── Breakdown panel renderer ─────────────────────────────────────────── */
function renderBreakdown(vietText, isPron) {
  var panel = document.getElementById('breakdown-panel');
  if (!panel) return;
  var syllables = window.VietSyllable ? window.VietSyllable.parse(vietText) : [];
  if (!syllables.length) { panel.innerHTML = ''; return; }

  var rows = syllables.map(function (s) {
    var tc = TONE_CLASS[s.tone] || 'tone-ngang';
    var pronAttr = isPron
      ? ' class="pron-row" onclick="window.VietSyllable.callPronounce(this.dataset.raw,\'vi-VN\')" data-raw="' + s.raw.replace(/"/g, '&quot;') + '"'
      : '';
    return '<tr' + pronAttr + '>' +
      '<td><strong>' + s.raw + '</strong></td>' +
      '<td>' + (s.initial || '<span style="color:#bbb">—</span>') + '</td>' +
      '<td>' + (s.nucleus || '<span style="color:#bbb">—</span>') + '</td>' +
      '<td>' + (s.final   || '<span style="color:#bbb">—</span>') + '</td>' +
      '<td class="' + tc + '">' + s.tone + '</td>' +
      '<td><button class="pronounce-btn" style="padding:4px 10px;margin-top:0" ' +
          'onclick="event.stopPropagation();window.VietSyllable.callPronounce(\'' + s.raw.replace(/'/g, "\\'") + '\',\'vi-VN\')">&#128266;</button></td>' +
      '</tr>';
  }).join('');

  panel.innerHTML =
    '<table class="breakdown-table">' +
    '<thead><tr><th>Syllable</th><th>Initial</th><th>Vowel</th><th>Final</th><th>Tone</th><th></th></tr></thead>' +
    '<tbody>' + rows + '</tbody>' +
    '</table>' +
    '<a class="breakdown-guide-link" href="/pronunciation">&#128214; Full Pronunciation Guide</a>';
}

function toggleBreakdown() {
  var panel = document.getElementById('breakdown-panel');
  var btn   = document.getElementById('btn-breakdown');
  if (!panel || !btn) return;
  var open  = panel.style.display === 'block';
  panel.style.display = open ? 'none' : 'block';
  btn.textContent     = open ? '\u{1F4C8} Break Down' : '\u{1F4C9} Hide';
}

/* ── LANG_CONFIG ─────────────────────────────────────────────────────────── */
window.LANG_CONFIG = {
  storageKey:  "viet_progress",
  vocabUrl:    "/api/vocab/viet",
  defaultMode: "vi_en",

  initUI: function (allCards, setModeFn) {
    var parts = [], seen = {};
    for (var i = 0; i < allCards.length; i++) {
      if (!seen[allCards[i].part]) { seen[allCards[i].part] = true; parts.push(allCards[i].part); }
    }
    parts.sort();
    document.getElementById("part-select").innerHTML =
      '<option value="All">All parts</option>' +
      parts.map(function (p) { return '<option>' + p + '</option>'; }).join("");
    setModeFn("vi_en");
  },

  updateModeUI: function (m) {
    document.getElementById("btn-vi-en").classList.toggle("active", m === "vi_en");
    document.getElementById("btn-en-vi").classList.toggle("active", m === "en_vi");
    document.getElementById("btn-pron").classList.toggle("active",  m === "pron");
  },

  getQuestion: function (card, mode) {
    var partEl = document.getElementById("card-part");
    if (partEl) partEl.textContent = " \u00b7 " + card.part;

    // Show/hide breakdown button and collapse panel on each new card
    var btn   = document.getElementById('btn-breakdown');
    var panel = document.getElementById('breakdown-panel');
    if (btn) {
      btn.textContent = '\u{1F4C8} Break Down';
      // en_vi: hide until answer revealed. vi_en + pron: always show.
      btn.style.display = (mode === 'en_vi') ? 'none' : 'inline-block';
    }
    if (panel) panel.style.display = 'none';

    if (mode === 'vi_en') return { text: card.viet,    dir: "Vietnamese \u2192 English" };
    if (mode === 'pron')  return { text: card.viet,    dir: "Pronunciation Practice \u2014 tap to hear each syllable" };
    return                       { text: card.english, dir: "English \u2192 Vietnamese" };
  },

  getQuestionTTS: function (card, mode) {
    if (mode === 'vi_en') return { text: card.viet, lang: "vi-VN" };
    // pron: user drives TTS; en_vi: English question, no auto-TTS
    return null;
  },

  getPronounce: function (card) {
    return { text: card.viet, lang: "vi-VN" };
  },

  renderAnswer: function (card, mode) {
    window._vietCurCard = card;

    // Reveal break-down button in en_vi mode (was hidden before answer)
    var btn = document.getElementById('btn-breakdown');
    if (btn && mode === 'en_vi') btn.style.display = 'inline-block';

    // Hanzi / Cantonese row
    var hanziRow = document.getElementById("hanzi-row");
    var cantoBtn = document.getElementById("btn-pronounce-canto");
    if (card.hanzi) {
      document.getElementById("q-hanzi").textContent     = card.hanzi;
      document.getElementById("q-cantonese").textContent = card.cantonese ? ": " + card.cantonese : "";
      hanziRow.style.display = "flex";
      cantoBtn.style.display = "inline-block";
    } else {
      hanziRow.style.display = "none";
      cantoBtn.style.display = "none";
    }

    // Notes
    var notesEl = document.getElementById("ans-notes");
    if (card.notes && card.notes !== "None") {
      notesEl.textContent = card.notes; notesEl.style.display = "block";
    } else { notesEl.style.display = "none"; }

    // Answer text
    document.getElementById("ans-english").textContent =
      (mode === 'vi_en' || mode === 'pron') ? card.english : card.viet;

    // PRON mode: auto-expand breakdown, no auto-TTS
    if (mode === 'pron') {
      var panel = document.getElementById('breakdown-panel');
      renderBreakdown(card.viet, true);
      if (panel) panel.style.display = 'block';
      if (btn)   btn.textContent = '\u{1F4C9} Hide';
      return null; // suppress auto-TTS
    }

    // en_vi: speak the Vietnamese answer
    if (mode === 'en_vi') return { text: card.viet, lang: "vi-VN" };
    // vi_en: no auto-TTS on answer reveal
    return null;
  },

  filterExtra: function (card) {
    var partSel = document.getElementById("part-select");
    if (!partSel) return true;
    var part = partSel.value;
    return part === "All" || card.part === part;
  },

  handleExtraKeys: function (e, curCard) {
    // C → Cantonese TTS
    if ((e.key === "c" || e.key === "C") && curCard) { pronounceCanto(); return; }

    // B → toggle breakdown panel
    // Guard: if btn-breakdown is hidden (en_vi before answer reveal), no-op
    if (e.key === "b" || e.key === "B") {
      var btn = document.getElementById('btn-breakdown');
      if (!btn || btn.style.display === 'none') return;
      if (curCard) renderBreakdown(curCard.viet, document.getElementById('btn-pron').classList.contains('active'));
      toggleBreakdown();
    }
  },
};
</script>
```

- [ ] **Step 2: Verify in browser**

Start server: `python3 vietnamese/viet_anki.py`

Open `http://localhost:5000` and check:

1. **VI→EN mode:** Start a session. Card shows Vietnamese word. `🔈 Break Down` button is visible. Click it — breakdown table appears with syllable rows. Press `B` — panel toggles. Press `P` — TTS speaks full word.
2. **EN→VI mode:** Card shows English word. `Break Down` button is hidden. Press Space to reveal answer. `Break Down` button appears. Click it — breakdown for the Vietnamese answer appears.
3. **PRON mode:** Click `🔉 PRON` in topbar. Start session. Card shows Vietnamese word (no auto-TTS). Press Space to reveal. Breakdown panel auto-expands. Tap a syllable row — speaks just that syllable. Rate the card (1–4) — SRS progresses normally.
4. **Full Guide link:** Click `📖 Full Pronunciation Guide` link in breakdown panel — navigates to `/pronunciation`.
5. **Mobile swipe:** On mobile (or device emulation), swipe cards in PRON mode — swipe gestures still work.

- [ ] **Step 3: Commit**

```bash
git add templates/viet.html
git commit -m "feat: add pronunciation breakdown panel and PRON mode to viet.html"
```

---

## Final Verification

- [ ] **Full smoke test**

1. Open `http://localhost:5000` — welcome screen shows 4 stat boxes ✓
2. Open `http://localhost:5000/pronunciation` — all 5 sections render, TTS works ✓
3. Open `tests/test_viet_syllable.html` — all tests green ✓
4. VI→EN session: breakdown panel works, B key works ✓
5. EN→VI session: button hidden before answer, appears after reveal ✓
6. PRON session: auto-expand, syllable taps, SRS rating works ✓
7. Other language apps unaffected: open Spanish/Bahasa — no JS errors ✓

- [ ] **Final commit**

```bash
git add -A
git commit -m "feat: Vietnamese pronunciation guide and breakdown panel complete"
```
