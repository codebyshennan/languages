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
Allow the user to hear any word pronounced on demand without leaving the current page. Useful when encountering an unfamiliar word mid-session.

### Trigger
- **Desktop**: Press `/` anywhere on a language page
- **Mobile**: Tap a floating 🔊 FAB button (fixed bottom-right, small, unobtrusive)

### Modal Behaviour
- Overlay dims the page background
- Text input is auto-focused on open
- Language auto-detected from URL:
  - `/viet*` → `vi-VN`
  - `/bahasa*` → `id-ID`
  - `/spanish*` → `es-ES`
- Press **Enter** → speaks the typed text via Web Speech API (`speechSynthesis`)
- Last 5 spoken words stored in memory and shown as clickable chips — clicking re-speaks
- Press **ESC** or click the backdrop to close

### Implementation
- All logic added to `static/shared.js`
- Styles added to `static/shared.css`
- No new routes, templates, or files required
- Mobile FAB only rendered on touch devices (CSS `@media (hover: none)`)

---

## Feature 2: Vietnamese Speed Typing Trainer

### Purpose
Build Vietnamese typing muscle memory and speed through an infinite word-by-word drill with two modes.

### Route & Template
- New route: `GET /viet/typing` in `app.py`
- New template: `templates/viet_typing.html`
- Nav link added to existing `/viet` page topbar

### Modes

**Copy Mode**
- Vietnamese word displayed large, English hint shown below it
- User types the Vietnamese word into the input field
- Press **Enter** to submit

**Dictation Mode**
- Word is spoken automatically via Web Speech API when it loads (`vi-VN`)
- Word is hidden — user types what they hear
- Press **R** to replay the audio
- Press **Enter** to submit

### Scoring (running, updates after each word)
- **WPM**: `(total characters typed ÷ 5) ÷ minutes elapsed` (standard 5-chars-per-word formula)
- **Accuracy**: `correct submissions ÷ total submissions × 100%`
- **Words**: total submitted
- **Errors**: total wrong submissions
- Stats displayed in a 4-column bar at the top of the page

### Submit Behaviour
- **Correct** (case-insensitive, diacritic-exact match):
  - Green chip added to recent history strip
  - Next word loads immediately (Dictation: auto-plays audio)
- **Wrong**:
  - Red chip added to recent history strip
  - Correct Vietnamese word revealed in the input area
  - Correct word spoken aloud (`vi-VN`)
  - Brief 1-second pause, then next word loads

### Word Source
- Fetched from `/api/vocab/viet` (existing 3000-word endpoint)
- Shuffled with Fisher-Yates on session start
- Filtered by category dropdown (same `cat-select` pattern as Anki page)
- Loops back to start when all words exhausted

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
- IME/composition mode — users are expected to type with a Vietnamese keyboard layout or input method already configured
