# Design: Per-Category SRS Schedules + Vietnamese Vocab Expansion to 3,000 Words

**Date**: 2026-03-12
**Status**: Approved

---

## Overview

Two features:
1. **Per-category SRS schedules** — each vocabulary category maintains its own independent SM-2 schedule in localStorage. "All categories" mode aggregates across all category stores.
2. **Vietnamese vocab expansion** — generate ~1,038 new B2-level Vietnamese words (1963–3000) via the Claude API and write a new combined 3,000-row Excel file.

---

## Feature 1: Per-Category SRS Schedules

### Storage Model

Each category gets its own localStorage key, e.g. `viet_progress_Animals`, `viet_progress_Food`.

Value format unchanged: `{ "cardNum": { interval, ef, reps, next_review, correct, wrong } }`.

Cards with a missing/empty `.cat` field fall back to `viet_progress_General`. Any `cardNum` found in progress stores but not in `allCards` (stale entries) is also written to `viet_progress_General` with a `console.warn` — never silently dropped.

### Functions to add/change in `shared.js`

**`getCatKey(cat)`** — returns `cfg.storageKey + '_' + (cat || 'General')`.

**`getCurrentCat()`** — reads `#cat-select` value; returns `"All"` if element is missing.

**`getAllCategories()`** — derives unique category names from `allCards`. If `allCards` is empty, logs `console.warn` and returns `[]` so callers degrade gracefully rather than silently returning wrong data.

**`loadProgress(forceAll)`** — updated:
- If `forceAll` is true, or `getCurrentCat()` is `"All"`: reads all per-category stores, merges into one flat object.
- Otherwise: reads from `getCatKey(getCurrentCat())`.

**`saveProgress(p)`** — updated:
- If cat = "All": for each key in `p`, look up the card's `.cat` in `allCards`. If not found, fall back to `"General"` with `console.warn`. Group by category, read each existing store, merge, write back.
- If cat = specific: write `p` directly to `getCatKey(cat)`.

**`computeOverview()`** — filters `allCards` to selected category before computing stats. "All" uses full `allCards`.

**`computeCatStats()`** — calls `loadProgress(true)` (forceAll = true) so the Stats modal always shows a complete per-category breakdown regardless of the currently selected category.

**Category dropdown `change` event** — calls `refreshOverview()`.

**`part-select`** — no change. The part filter (Vietnamese-specific) further narrows which cards appear in a session but does not affect storage; `saveProgress()` always writes the full category store.

### Migration (runs once on init, after `allCards` is populated)

Sequencing in `init()`: fetch vocab → populate `allCards` → `migrateProgress()` → `refreshOverview()`.

`migrateProgress()` steps:
1. If `localStorage.getItem(cfg.storageKey + '_migrated')` exists → return immediately.
2. Read legacy key `cfg.storageKey`. If absent or empty → write flag → return.
3. For each entry in legacy data: look up `.cat` in `allCards`; fall back to `"General"` if not found. Merge entry into the appropriate per-category key (merge, not overwrite, to be idempotent).
4. Write `cfg.storageKey + '_migrated' = "1"` after all per-category writes complete, before deleting legacy key.
5. Delete legacy key.

Crash safety: crash during step 3 leaves no flag and legacy key intact — safe, reruns on next load (idempotent merge). Crash between steps 4 and 5 leaves the flag set and legacy key orphaned — harmless.

### localStorage quota

On `setItem` failure, preserve existing `console.warn`. No UI-level quota handling (out of scope).

---

## Feature 2: Vietnamese Vocab Expansion to 3,000 Words

### Script: `vietnamese/generate_vocab.py`

Uses `anthropic` Python SDK. Generates rows 1963–3000 in batches of 100 and combines them with the original 1,962 rows into a single output file.

**Output file**: `vietnamese/viet_vocab_COMPLETE_3000words.xlsx`
- Contains all original 1,962 rows (copied from the source file) plus all newly generated rows.
- Active sheet named exactly `"📚 All Words (Combined)"`.
- Original file is not modified.

**`app.py` change**: update `_load_viet()` to try `viet_vocab_COMPLETE_3000words.xlsx` first; fall back to `viet_vocab_COMPLETE_1962words.xlsx` with a `print` warning if the 3000-word file does not exist. This ensures the server starts safely before the generation script has been run.

**`viet.html` change**: update all occurrences of `1962` / `1&thinsp;962` in the file to `3000` / `3&thinsp;000`.

**Deduplication**:
- Normalise: lowercase + strip + collapse internal whitespace to single space.
- Dedup set built from existing `viet` values using this normalisation.
- Generated words normalised the same way before lookup.
- Dedup on `viet` field only; English synonyms are acceptable.
- Tonal marks and diacritics preserved (not stripped).

**Word schema**:
```
num | part | viet | english | hanzi | cantonese | cat | notes
```
- `num`: 1963–3000 sequential
- `part`: noun / verb / adjective / adverb / phrase / conjunction / preposition
- `viet`: Vietnamese word/phrase with correct tones and diacritics
- `english`: English translation
- `hanzi`: Chinese characters if Sino-Vietnamese cognate (empty string otherwise)
- `cantonese`: Cantonese romanisation if hanzi present (empty string otherwise)
- `cat`: one of the category names from the original spreadsheet
- `notes`: usage/grammatical note or mnemonic (empty string if none)

**B2 target domains**: abstract concepts, formal/academic verbs, professional vocabulary (medical, legal, business, tech), complex emotions, connectives and discourse markers, idiomatic phrases.

**`generate_progress.json` format**:
```json
{
  "accepted": [ { "num": 1963, "part": "...", "viet": "...", ... }, ... ],
  "next_num": 2063
}
```
- `accepted`: list of fully validated word objects generated so far.
- `next_num`: the next `num` value to generate (i.e., where to resume).

**Generation process**:
1. Load original Excel; build normalised dedup set; extract category names.
2. Load `generate_progress.json` if present; restore `accepted` list and `next_num`.
3. While `next_num <= 3000`:
   a. Request a batch of `min(100, 3001 - next_num)` words from the Claude API as a JSON array.
   b. Parse JSON; validate all required fields non-empty.
   c. Normalise and dedup each word. Track `parse_failures` and `dup_failures` separately.
   d. If batch is short due to **parse failures**: retry (up to 3 times), requesting only the missing count.
   e. If batch is short due to **duplicates only** (no parse failures): log a warning and accept the shortfall without retrying — retrying would produce more duplicates.
   f. Append accepted words; update dedup set; advance `next_num`.
   g. Save `generate_progress.json`.
4. On API rate-limit (429): read `Retry-After` header if present, else wait 10 s. Retry up to 3 times. If still failing, save progress and exit with a clear error message.
5. On network error: wait 10 s, retry up to 3 times. Same save-and-exit on exhaustion.
6. Write the combined 3,000-row file: original 1,962 rows + accepted generated rows, in sheet `"📚 All Words (Combined)"`.
7. Delete `generate_progress.json` on success.
8. Print summary: total generated, duplicates discarded, parse failures, rows per category.

---

## Out of Scope

- Bahasa or Spanish vocabulary changes
- Server-side progress storage
- localStorage quota error UI
- Per-part SRS storage

---

## Testing

**Feature 1 — SRS per category:**
- New user (no legacy key): app initialises cleanly; all categories show all cards as new.
- Migration: card intervals and EF values preserved in per-category keys; legacy key removed.
- No double-counting: a card that appears in a specific category store must not also appear in any other category store.
- Isolation: rate 3 Animals cards → switch to Food → overview shows unaffected counts; session shows only Food due cards.
- All mode: Due count in "All" equals the sum of Due counts across individual categories.
- Round-trip: rate card in "All" → saved to correct category store → switch to that category → interval/ef/next_review identical → rate again → switch back to "All" → updated values visible.
- Stats modal: open while a specific category is selected; all categories appear in breakdown table.

**Feature 2 — Vocab expansion:**
- Combined output file has exactly 3,000 data rows.
- No duplicate `viet` values (after normalisation) across all 3,000 rows.
- All rows have non-empty `num`, `part`, `viet`, `english`, `cat`.
- `num` is sequential 1–3,000 with no gaps or duplicates in the combined output file.
- All `cat` values match the original 1,962-word category set.
- `viet.html` shows `3 000 words`, no remaining `1962` occurrences.
- App server starts without error before and after `app.py` fallback change (test both: file present and file absent).
