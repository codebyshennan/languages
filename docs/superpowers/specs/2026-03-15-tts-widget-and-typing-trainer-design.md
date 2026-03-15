# Design Spec: TTS Speak Widget + Vietnamese Speed Typing Trainer
**Date:** 2026-03-15
**Status:** Approved

---

## Overview

Two new features for the language learning app:

1. **TTS Speak Widget** — a modal triggered by `/` (desktop) or a floating button (mobile) that lets the user type any word and hear it spoken aloud, available on all language pages.
2. **Vietnamese Speed Typing Trainer** — a new page (`/viet/typing`) with Copy and Dictation modes for practising typing Vietnamese vocabulary, tracking running WPM and accuracy.

---

## Feature 1: TTS Speak Widget

### Purpose
Allow the user to hear any word pronounced on demand without leaving the current page.

### Trigger
- **Desktop**: Press `/` — guarded so it does not fire if a text input or select is already focused (`document.activeElement` check)
- **Mobile**: Tap a floating 🔊 FAB button (fixed bottom-right, 24px from edges, z-index above all other elements, respects iOS safe-area via `env(safe-area-inset-bottom)`)

### Modal Behaviour
- Overlay dims the page background
- Text input is auto-focused on open
- Language auto-detected from URL:
  - `/viet*` → `vi-VN`
  - `/bahasa*` → `id-ID`
  - `/spanish*` → `es-ES`
  - Any unmatched URL → `en-US` (silent fallback, no error shown)
- Press **Enter** (with non-empty input) → speaks via `speechSynthesis` using the existing `callPronounce(text, lang)` helper already in `shared.js`
- Empty input on Enter → ignored (no submission, no error)
- Last 5 spoken words stored **in memory only** (cleared on page navigation — no persistence needed)
- Chips: clicking a chip **re-speaks the word and populates the input field**
- If `window.speechSynthesis` is unavailable → modal shows a small inline message: "Speech not supported in this browser"
- Press **ESC** or click the backdrop to close

### Voice Selection
Uses the existing `callPronounce` helper which calls `speechSynthesis.speak()` with the locale set on the utterance. No custom voice picker — browser chooses the best available voice for the locale, consistent with how TTS already works elsewhere in the app.

### Implementation
- All logic added to `static/shared.js`
- Styles added to `static/shared.css`
- No new routes, templates, or files required
- FAB only rendered when `('ontouchstart' in window)` — i.e. touch devices only

---

## Feature 2: Vietnamese Speed Typing Trainer

### Purpose
Build Vietnamese typing muscle memory and speed through an infinite word-by-word drill with two modes.

### Route & Template
- New route: `GET /viet/typing` in `app.py`
- New template: `templates/viet_typing.html`
- Nav link added to `templates/viet.html` topbar only (not shared across language pages)

### Vocab Source
- Fetched from `/api/vocab/viet` on page load (existing endpoint, returns array of card objects with fields: `num`, `viet`, `english`, `cat`, `part`, `hanzi`, `cantonese`, `notes`)
- Shuffled with Fisher-Yates on session start; loops back to start when all words exhausted
- Category filter derived dynamically from the vocab response (same pattern as Anki page)

### Modes

**Copy Mode**
- Vietnamese word displayed large, English hint shown below it
- User types the Vietnamese word into the input field
- `R` key does nothing in Copy mode (only registered in Dictation mode)
- Press **Enter** to submit (empty input → ignored)

**Dictation Mode**
- Word is spoken automatically via `callPronounce(card.viet, 'vi-VN')` when it loads
- Word text is hidden — user types what they hear
- Press **R** to replay audio
- Press **Enter** to submit (empty input → ignored)

**Mode switching mid-session**: stats reset to zero, word list reshuffled, new session begins.

### Scoring (running, updates after each word)
- **WPM**: `(total characters typed ÷ 5) ÷ minutes elapsed` — timer starts on **first keystroke**
- **Accuracy**: `correct submissions ÷ total submissions × 100%`
- **Words**: total submitted
- **Errors**: total wrong submissions
- Stats displayed in a 4-column bar at the top of the page; no separate end-of-session summary screen (infinite drill)
- Scores are **not persisted** — session only

### Submit Behaviour
- **Correct** (exact match after trimming whitespace; diacritics must match exactly; case-insensitive):
  - Green chip added to recent history strip (last 5 words shown)
  - Next word loads immediately; Dictation mode auto-plays audio
- **Wrong**:
  - Red chip added to recent history strip
  - Correct Vietnamese word revealed below the input
  - Correct word spoken aloud via `callPronounce`
  - Next word loads after TTS utterance ends (`utterance.onend`) — no arbitrary fixed delay

### Design
- Matches existing Vietnamese theme: `#8B0000` primary, `#FFFDF8` card background
- Mode toggle in topbar (Copy / Dictation)
- Category filter dropdown in topbar
- Back link to `/viet`
- Mobile-responsive (single column, large input, tap-friendly)

---

## Files Changed

| File | Change |
|------|--------|
| `static/shared.js` | Add TTS modal logic + FAB rendering |
| `static/shared.css` | Add TTS modal styles + FAB styles |
| `app.py` | Add `/viet/typing` route |
| `templates/viet_typing.html` | New typing trainer template |
| `templates/viet.html` | Add "Typing" nav link |

---

## Out of Scope
- Typing trainers for Bahasa or Spanish (can be added later following same pattern)
- Leaderboards or persistent typing scores
- Custom voice selection UI
- IME/composition mode — users are expected to have a Vietnamese keyboard layout or input method already configured
