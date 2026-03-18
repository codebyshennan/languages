# Number Pronunciation Practice — Design Spec

## Overview

A timed number pronunciation drill for all three languages (Vietnamese, Indonesian, Spanish). A number appears on screen, the user has 3 seconds to read it, then records themselves saying it, plays back the recording, and self-assesses. Difficulty auto-progresses through levels, with language-specific helper tips at each new level explaining how numbers are constructed.

## Architecture

A new standalone engine (`numbers.js`) inspired by the same structural approach as the existing SRS system — shared JS engine + per-language template with config object — but with its own interface contract (`NUMBER_CONFIG` rather than `LANG_CONFIG`). This is a separate engine from `shared.js`; it does not reuse or extend the SRS logic.

### New Files

| File | Purpose |
|------|---------|
| `static/numbers.js` | Standalone engine: progression, timer, MediaRecorder, playback, session stats, UI |
| `templates/viet_numbers.html` | Vietnamese number config + helper tips |
| `templates/bahasa_numbers.html` | Indonesian number config + helper tips |
| `templates/spanish_numbers.html` | Spanish number config + helper tips |

### Routes (app.py)

```python
@app.route("/viet/numbers")
@app.route("/bahasa/numbers")
@app.route("/spanish/numbers")
```

No backend data needed — numbers are generated client-side.

## Progression System

### Levels

| Level | Range | Focus | Countdown |
|-------|-------|-------|-----------|
| 1 | 1–10 | Basic digits | 3s |
| 2 | 1–100 | Teens and tens | 3s |
| 3 | 1–1,000 | Hundreds | 5s |
| 4 | 1–10,000 | Thousands | 5s |
| 5 | 1–1,000,000 | Large numbers | 7s |

Level 6 (contextual: prices, phone numbers, dates) is deferred to a future iteration due to the complexity of per-language format specifications.

### Advancement

- 5 consecutive correct self-assessments → unlock next level
- Wrong answer resets streak to 0 but does not demote to a lower level
- Number generation weighted: 70% from current level's new range, 30% review from lower ranges
- A "Skip" button is available — counts as "missed" for progression (resets streak)

### Helper Tips

- When entering a new level, a dismissable card appears with language-specific construction rules
- A "?" button remains accessible during the level to re-show the tip
- Tips are defined per-language in the `NUMBER_CONFIG.levelTips[]` array

**Example tips:**

Vietnamese Level 2 (teens and tens):
> "10 = mười. Teens: mười một, mười hai... From 20 onward, tens use mươi: hai mươi, ba mươi. Special: 1 in units → mốt (21 = hai mươi mốt), 4 in units → tư (24 = hai mươi tư), 5 in units → lăm (25 = hai mươi lăm)."

Vietnamese Level 3 (hundreds):
> "Hundreds use `[digit] trăm`. 300 = ba trăm. Compound: 342 = ba trăm bốn mươi hai. Zero gap: 101 = một trăm lẻ một (Southern) / một trăm linh một (Northern). This app uses Southern convention (lẻ)."

Indonesian Level 3 (hundreds):
> "Hundreds use `[digit] ratus`. 300 = tiga ratus. Exception: 100 = seratus (not satu ratus). 342 = tiga ratus empat puluh dua."

Spanish Level 3 (hundreds):
> "100 = cien (standalone) or ciento (before another number). 200-900 have unique forms: doscientos, trescientos... 342 = trescientos cuarenta y dos."

## Core Flow

### Per Round

1. **Display** — Number appears large and centered
2. **Countdown** — Timer with visible progress bar (animated shrink). Duration varies by level (see table above)
3. **Record** — Timer expires → user taps "Record" button to start (avoids browser auto-start restrictions). Visual pulsing indicator shows active recording
4. **Stop** — User taps stop button (or presses Space) to end recording
5. **Playback** — Recording plays back automatically
6. **Reveal** — Written form of the number in the target language is shown (from `numberToWords()`)
7. **Self-assess** — User taps **Got it** or **Missed it** (or **Skip** before recording)
8. **Next** — Feeds into progression tracking, next round begins

### Session

- Continuous rounds until user quits (tap X or press Escape)
- Session end screen shows: rounds attempted, correct count, accuracy %, highest level reached
- Matches existing session end visual pattern

## NUMBER_CONFIG Object

Each language template defines:

```javascript
window.NUMBER_CONFIG = {
  lang: 'vi-VN',                    // BCP-47 tag (reserved for future TTS)
  numberToWords: function(n) {},     // int → spoken string
  levelTips: [                       // index 0 = level 1
    "Digits 1-10: một, hai, ba...",
    "Teens & tens: mười một, hai mươi...",
    // ...
  ],
}
```

### numberToWords(n)

Each language implements its own number-to-words conversion:

**Vietnamese (Southern convention):**
- Basic: một, hai, ba, bốn, năm, sáu, bảy, tám, chín, mười
- Tens (20+): use mươi (not mười). hai mươi, ba mươi...
- Units after mươi: 1→mốt, 4→tư, 5→lăm (special forms)
- Zero gap in hundreds: lẻ (e.g., 101 = một trăm lẻ một)
- Scale: trăm (100), nghìn (1,000), triệu (1,000,000)

**Indonesian:**
- se- prefix for 1×scale: seratus (100), seribu (1,000)
- Scale: puluh (10), ratus (100), ribu (1,000), juta (1,000,000)
- No special compound forms — straightforward composition

**Spanish:**
- 1-15 have unique names (uno through quince)
- 16-19: dieciséis, diecisiete...
- 21-29: veintiuno, veintidós... (single word)
- 30+: treinta y uno, cuarenta y dos... (with "y")
- 100: cien (standalone), ciento (compound)
- 200-900: doscientos, trescientos, cuatrocientos, quinientos, seiscientos, setecientos, ochocientos, novecientos
- mil (1,000), millón (1,000,000)

## UI Layout

Reuses existing patterns from `shared.css`:

### Topbar
- Language title + home link
- Level indicator badge (e.g., "Level 3: Hundreds")
- "?" button for helper tip

### Main Area
- **Number display** — large centered number (font-size ~48px, `var(--primary)` color)
- **Countdown bar** — full-width bar that shrinks over countdown duration, `var(--accent)` color
- **Record button** — appears after countdown, tap to start recording
- **Recording indicator** — pulsing red dot + "Recording..." text (with `aria-live="polite"` for accessibility)
- **Playback controls** — replay button (appears after recording stops)
- **Answer reveal** — written form appears below number after self-assess prompt
- **Assessment buttons** — "Got it" (green) / "Missed it" (red) / "Skip" (grey)

### Progress Strip
- Current streak (consecutive correct)
- Current level
- Progress toward next level (e.g., "3/5 to Level 4")

### Session End
- Rounds attempted, correct, accuracy %, highest level reached
- "Try Again" / "Home" buttons

## Recording (MediaRecorder API)

- Acquire mic stream once at session start via `navigator.mediaDevices.getUserMedia({ audio: true })`
- Hold stream open for the session duration (avoids re-requesting per round)
- If stream drops (e.g., background tab), re-request on next record attempt
- Codec negotiation: check `MediaRecorder.isTypeSupported('audio/webm;codecs=opus')`, fall back to `audio/mp4` or browser default
- Create object URL for playback via `<audio>` element
- Revoke previous blob URLs to prevent memory leaks
- If mic permission denied, show message and fall back to self-assess-only mode (no recording, just countdown → reveal → assess)

## localStorage Schema

Key: `numbers_progress_{lang}` (e.g., `numbers_progress_viet`)

```json
{
  "level": 3,
  "streak": 2,
  "totalCorrect": 47,
  "totalAttempts": 55,
  "bestLevel": 3
}
```

## Theme Integration

Each language template sets its own CSS variables (matching existing pages):
- Vietnamese: `--primary: #8B0000` (dark red)
- Indonesian: `--primary: #CC0000` (red)
- Spanish: `--primary: #C62828` (red)

## Navigation

Add a "Numbers" link to each language's topbar nav menu (consistent with how pronunciation/typing pages are accessed from within each language page).

## Out of Scope

- Automated speech-to-text grading
- TTS playback of correct answer
- Spaced repetition for numbers (simple streak-based progression only)
- Backend changes beyond adding routes
- Level 6 contextual numbers (prices, phones, dates) — deferred to future iteration
