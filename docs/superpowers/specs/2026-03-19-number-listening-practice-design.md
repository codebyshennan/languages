# Number Listening Practice Mode

## Overview

Add a "Listen" mode toggle to each existing number practice page (Vietnamese, Indonesian, Spanish). The app speaks a random number via Web Speech API TTS, a countdown timer starts after playback, and the user types the number they heard. Progression is tracked separately from the existing "Speak" mode.

## User Flow

1. User opens a number practice page (e.g., `/viet/numbers`)
2. Mode toggle at top shows "Speak" (default) and "Listen" tabs
3. User switches to "Listen" mode
4. Start overlay shown with listen-specific instructions
5. On start: random number generated per level, spoken via `SpeechSynthesisUtterance` with the appropriate language voice
6. Countdown timer begins after TTS `onend` event fires
7. User types number in input field, presses Enter or clicks Submit
8. If timer expires before submission, treated as incorrect
9. Result shown: correct/incorrect with the number and word form revealed
10. Streak/level progression updates using separate localStorage key
11. Next number auto-plays after a delay (~1.5s if correct, ~3s if incorrect to allow reading the answer)

## UI Changes

### Mode Toggle

- Two buttons/tabs at the top of the practice area: "Speak" and "Listen"
- Defaults to "Speak" (preserves current behavior exactly)
- Switching modes updates the UI layout and loads the appropriate progression state
- Mode preference persisted in localStorage (`numbers_mode_{langKey}`) so it remembers on return

### Listen Mode Layout

- Large speaker/sound icon in place of the number display area
- "Replay" button to re-hear the current number (available during countdown, does NOT reset timer, unlimited replays)
- Numeric input field with Submit button (Enter key also submits)
- Countdown bar starts after TTS utterance finishes
- Result feedback: green for correct, red for incorrect (shows correct number + word form)
- No recording controls (mic button, stop, replay recording) — those are Speak-mode only

### Shared Elements (unchanged)

- Level badge and progress strip (streak, level, progress to next)
- Tip card (dismissible, per-level tips)
- Session stats tracking (attempts, correct, accuracy)
- Session end screen (stats + retry/home)
- Start overlay (with mode-appropriate instructions)

## Technical Design

### TTS

- Uses `window.speechSynthesis` and `SpeechSynthesisUtterance`
- Language codes: `vi-VN` (Vietnamese), `id-ID` (Indonesian), `es-ES` (Spanish)
- Utterance text sourced from existing `numberToWords()` functions in each language config
- Voice selection: pick best available voice matching the language, fallback to default
- Replay button calls the same utterance again
- Default speech rate: `1.0` (normal speed)
- First TTS call must be chained to the "Start" button click to satisfy mobile browser user-gesture requirements (iOS Safari)

### TTS Unavailability

- On page load, check `window.speechSynthesis` exists and that at least one voice is available for the target language
- If TTS is unavailable or no matching language voice exists: hide/disable the "Listen" tab and show no toggle (page behaves exactly as current Speak-only mode)
- Voice check uses `speechSynthesis.onvoiceschanged` event since voices load asynchronously in some browsers

### State Management

- New localStorage key pattern: `numbers_progress_{langKey}_listen`
  - e.g., `numbers_progress_viet_listen`, `numbers_progress_bahasa_listen`, `numbers_progress_spanish_listen`
- Same state shape as existing: `{ level, streak, totalCorrect, totalAttempts, bestLevel }`
- Completely independent from Speak mode progression

### Engine Changes (`numbers.js`)

The current engine exposes a `window.NumbersEngine` object with utility functions and an `initUI()` function. Changes:

- Add `initListenUI()` function alongside existing `initUI()` for listen mode setup
- Add a `mode` parameter to state creation/loading functions to determine the localStorage key (append `_listen` suffix for listen mode)
- Core logic shared: level system, number generation, weighted distribution, streak advancement
- The HTML templates call either `initUI()` or `initListenUI()` based on the active mode toggle
- Existing Space key binding in `initUI()` must be guarded to only fire in Speak mode (or only bound by `initUI`, not `initListenUI`)

### Answer Checking

- Input: `<input type="text" inputmode="numeric" pattern="[0-9]*">` for clean numeric keyboard on mobile without `type="number"` quirks (no `e`, `+`, `-`, spinner arrows)
- Comparison: parse input as integer, compare against generated number
- Non-numeric input and empty input treated as incorrect
- Automatic check — no self-assessment buttons in listen mode

### Timer

- Same countdown bar visual as Speak mode
- Starts when TTS `onend` event fires (not when utterance begins)
- Listen mode durations are longer than Speak mode to account for typing time:
  - Level 1 (1-10): 5 seconds
  - Level 2 (1-100): 7 seconds
  - Level 3 (1-1000): 10 seconds
  - Level 4 (1-10000): 12 seconds
  - Level 5 (1-1000000): 15 seconds
- Timer expiry without submission = incorrect answer

### Keyboard Shortcuts

- **Enter**: Submit answer (listen mode)
- **Escape**: End session (same as current)
- **Space**: Bound only in Speak mode via `initUI()`; `initListenUI()` does not bind Space, avoiding conflicts

## Scope

### In Scope

- Mode toggle UI on all three language pages
- TTS playback with language-appropriate voices
- TTS availability check with graceful degradation (hide Listen tab if unsupported)
- Numeric input and automatic answer checking
- Separate progression tracking per mode
- Replay button for re-hearing the number (during countdown, no timer reset, unlimited)
- Timer after TTS playback completes (longer durations than Speak mode)
- Mode preference persistence in localStorage
- All three languages: Vietnamese, Indonesian, Spanish

### Out of Scope

- Speech-to-text / automatic speech recognition
- Custom TTS voices or audio files
- New levels or number ranges
- Changes to Speak mode behavior
- Backend changes (all client-side)
- Accessibility for screen reader users (TTS and screen reader would conflict; Listen mode is inherently audio-dependent)
- TTS rate/pitch configuration per level
