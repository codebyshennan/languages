# Vietnamese Pronunciation Enhancement — Design Spec

**Date:** 2026-03-13
**Status:** Approved

---

## Overview

Enhance the Vietnamese spaced-repetition app with two complementary pronunciation features:

1. A **standalone `/pronunciation` reference page** — full guide to Vietnamese tones, vowels, consonant initials/finals, and vowel clusters with TTS buttons on every example.
2. **Card integration** — an on-demand syllable breakdown panel in all existing modes, plus a new dedicated **Pronunciation mode** that auto-expands the breakdown and makes each syllable tappable.

All changes are frontend-only. No backend schema changes required beyond one new Flask route.

---

## Architecture

### New files
- `templates/viet_pronunciation.html` — standalone reference page
- `static/viet_syllable.js` — shared Vietnamese syllable parser (no dependencies); also exports a `callPronounce(text, lang)` helper that guards `window.speechSynthesis` and passes `text` **directly** to `SpeechSynthesisUtterance` without any character stripping — tone diacritics must be preserved for correct Vietnamese TTS. (Unlike `shared.js`'s version which strips `'`, `"`, `/`.)

### Modified files
- `vietnamese/viet_anki.py` — add `/pronunciation` route using the same `Path.read_text()` pattern as the existing `/` route (not `render_template`); define `PRON_TEMPLATE = BASE.parent / "templates" / "viet_pronunciation.html"` and return `PRON_TEMPLATE.read_text()`
- `templates/viet.html` — add Pronunciation mode button, extend `updateModeUI` to handle `pron` mode, add Break Down button, breakdown panel, link to reference page, extend `handleExtraKeys` to wire `B` key
- `static/shared.js` — no changes

### Data flow
```
vocab card (viet string)
    → viet_syllable.js: parseSyllables(text)
    → [ { raw, tone, toneName, initial, nucleus, final }, ... ]
    → rendered as breakdown table rows in the card UI
    → each row has a 🔉 button calling callPronounce(syllable.raw, 'vi-VN')
```

---

## Syllable Parser (`viet_syllable.js`)

Vietnamese vocabulary words are mostly monosyllabic; phrases can be 2–3 syllables separated by spaces.

### Algorithm (per syllable)
1. **Tone detection** — scan the raw syllable for tone diacritics; record tone name and number, but do **not** strip yet (stripping happens last, for display only):
   - No mark → ngang (flat, mid level)
   - `á/ắ/ấ/ế/í/ó/ố/ớ/ú/ứ/ý` → sắc (rising)
   - `à/ằ/ầ/ề/ì/ò/ồ/ờ/ù/ừ/ỳ` → huyền (falling)
   - `ả/ẳ/ẩ/ể/ỉ/ỏ/ổ/ở/ủ/ử/ỷ` → hỏi (dipping)
   - `ã/ẵ/ẫ/ễ/ĩ/õ/ỗ/ỡ/ũ/ữ/ỹ` → ngã (creaky rising)
   - `ạ/ặ/ậ/ệ/ị/ọ/ộ/ợ/ụ/ự/ỵ` → nặng (heavy falling)
2. **Initial consonant** — match longest prefix from ordered list against the **original diacritic-bearing** string: `ngh, ng, nh, ch, gh, gi, kh, ph, th, tr, qu, b, c, d, đ, g, h, k, l, m, n, p, r, s, t, v, x` (empty string if none). Edge case: if `gi` is stripped as the initial and nothing remains (e.g. the standalone word "gì"), treat the entire token as the nucleus with empty initial and final.
3. **Final consonant** — match suffix from: `ch, ng, nh, c, m, n, p, t` (empty string if none)
4. **Vowel nucleus** — everything between initial and final (still bears the tone diacritic at this point)
5. **Strip tone from nucleus** — replace tone-marked vowel characters with their base equivalents for display in the breakdown table. The `raw` field retains the original string.

### Output shape
```js
{
  raw:      "chào",   // original syllable with diacritics
  tone:     "huyền",
  toneNum:  2,        // 1–6 for colour-coding
  initial:  "ch",
  nucleus:  "a",      // stripped of tone mark for display
  final:    "o",      // 'o' acts as final glide here
}
```

### Exported API
```js
window.VietSyllable = {
  parse(word)       // → array of syllable objects
  stripTone(char)   // → base vowel character
}
```

---

## Reference Page (`/pronunciation`)

Route: `GET /pronunciation` → serves `templates/viet_pronunciation.html`

Loads `/static/shared.css` (same path as `viet.html`). Does **not** load `shared.js` (which would crash without `window.LANG_CONFIG`). Instead loads only `viet_syllable.js` which exports its own `callPronounce` helper with a `window.speechSynthesis` guard. Navigation link back to `/`.

### Sections

#### 1. The 6 Tones
Table with columns: Mark | Name | Pitch description | Example word | 🔉

| # | Mark | Name | Pitch | Example |
|---|------|------|-------|---------|
| 1 | (none) | ngang | mid level, steady | ma |
| 2 | ` | huyền | low falling, breathy | mà |
| 3 | ? | hỏi | mid dipping then rising | mả |
| 4 | ~ | ngã | mid rising, creaky/glottal | mã |
| 5 | ´ | sắc | high rising | má |
| 6 | . | nặng | low falling, heavy/cut short | mạ |

Each row has a 🔉 button that speaks the example word with `vi-VN`.

#### 2. Simple Vowels
Grid: Vowel | Name | Approx. English | Example | 🔉

Covers: a, ă, â, e, ê, i, y, o, ô, ơ, u, ư

`i` and `y` are listed as separate rows (each with their own TTS button) to avoid the slash notation which would be corrupted by `shared.js`'s `callPronounce` stripping. Do not use `i/y` as a combined entry.

#### 3. Vowel Clusters
Grid of common clusters with example words and 🔉:
`ai, ao, au, ay, eo, ia/iê, oa, oe, oi, ôi, ơi, ua/uô, ưa/ươ, uê, uy, oai, oay, uôi, ươi, ươu`

#### 4. Initial Consonants
Table: Spelling | Approx. sound | Notes | Example | 🔉

Highlights tricky ones: `đ` (retroflex D), `gi` (sounds like Y in south, Z in north), `x` vs `s`, `d` vs `gi`, `r` regional variation.

#### 5. Final Consonants
Table: Spelling | Notes | Example | 🔉

Key point: `-c, -ch, -p, -t` are unreleased stops (no puff of air). `-ng, -nh` nasalise the vowel before them.

---

## Card Integration

### Break Down button
- Rendered in `viet.html` card body
- **VI→EN mode**: visible before and after answer reveal (the Vietnamese word is already the question, so no spoiler risk)
- **EN→VI mode**: visible only after answer reveal (before reveal, the breakdown would expose the Vietnamese answer)
- **PRON mode**: always visible, auto-expanded (see Pronunciation Mode below)
- Label: `🔉 Break Down` — keyboard shortcut `B` (wired via `cfg.handleExtraKeys` in `viet.html`, not in `shared.js`)
- Since `answerShown` is private to `shared.js`'s IIFE and not passed to `handleExtraKeys`, the `B` key handler must check the DOM to decide whether to act. Specifically: if the `#btn-breakdown` button has `display: none` (i.e. we are in EN→VI mode before answer reveal), the handler must no-op. This avoids needing a shadow variable or changes to `shared.js`.
- Expands/collapses a `#breakdown-panel` div below the answer area
- Panel renders one row per syllable:

```
┌──────────┬─────────┬────────┬───────┬──────────┬────┐
│ Syllable │ Initial │ Vowel  │ Final │ Tone     │    │
│ xin      │ x       │ i      │ n     │ ngang    │ 🔉 │
│ chào     │ ch      │ a      │ o     │ huyền    │ 🔉 │
└──────────┴─────────┴────────┴───────┴──────────┴────┘
```

- Tone name cell is colour-coded (6 distinct colours matching the reference page)
- Each 🔉 button speaks only that syllable

### Pronunciation Mode
- New mode button: `🔉 PRON` added to the topbar alongside VI→EN / EN→VI
- `updateModeUI` must be extended to toggle the `pron` button active state (alongside existing `vi_en`/`en_vi` handling)
- `LANG_CONFIG.getQuestion` returns the Vietnamese word as the question in PRON mode
- `LANG_CONFIG.getQuestionTTS` returns `null` in PRON mode (no auto-play; user drives pronunciation)
- `LANG_CONFIG.renderAnswer` in PRON mode: auto-expands the breakdown panel and returns `null` (no auto-TTS on answer reveal; user taps syllable rows to hear them)
- Breakdown panel is auto-shown (not collapsed) when in PRON mode
- Each syllable row is styled as a large tappable button (mobile-friendly) that speaks that syllable
- Rating buttons still work normally (1–4) to maintain SRS progress
- A small "📖 Full Guide" link in the breakdown panel navigates to `/pronunciation`

### Keyboard shortcuts added
| Key | Action |
|-----|--------|
| `B` | Toggle breakdown panel |
| (existing `P`) | Speak full word |
| (existing `C`) | Speak Cantonese |

---

## Tone Colour Scheme
Consistent across reference page and breakdown panel:

| Tone | Colour |
|------|--------|
| ngang | #777 (neutral grey) |
| huyền | #1a6fbf (blue, falling) |
| hỏi | #2a9d4e (green, dip-rise) |
| ngã | #8b4fbf (purple, creaky) |
| sắc | #cc2233 (red, rising) |
| nặng | #7a3000 (dark brown, heavy) |

---

## Non-goals
- No backend NLP or external pronunciation API
- No IPA keyboard input
- No audio recording/microphone features
- No changes to other language apps (bahasa, spanish)
