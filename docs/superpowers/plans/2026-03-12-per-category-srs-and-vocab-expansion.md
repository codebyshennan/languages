# Per-Category SRS + Vietnamese Vocab Expansion Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add independent SM-2 SRS schedules per vocabulary category across all language apps, and expand Vietnamese vocabulary from 1,962 to 3,000 B2-level words via the Claude API.

**Architecture:** Feature 1 modifies `static/shared.js` (the shared SRS engine) to scope localStorage keys by category — each category gets its own key, "All" mode merges on read and splits by card's `.cat` on write. Feature 2 is a standalone Python script that generates ~1,038 words in batches via Claude API, deduplicates against existing vocab, and writes a combined 3,000-row Excel file. The two features are independent and can be implemented in any order.

**Tech Stack:** Vanilla JavaScript (shared.js), Flask/Python (app.py), openpyxl, anthropic Python SDK.

**Spec:** `docs/superpowers/specs/2026-03-12-vietnamese-per-category-srs-and-vocab-expansion-design.md`

---

## Chunk 1: Per-Category SRS (shared.js)

### Task 1: Replace Storage section in shared.js

**Files:**
- Modify: `static/shared.js:48-56` (Storage section — `loadProgress` and `saveProgress`)

The existing functions read/write a single key (`cfg.storageKey`). Replace them with category-aware versions plus four new helpers: `getCatKey`, `getCurrentCat`, `getAllCategories`, and `migrateProgress`.

- [ ] **Step 1: Replace the Storage section (lines 48–56)**

Find this exact block in `static/shared.js`:

```js
// ── Storage ────────────────────────────────────────────────────────────────
function loadProgress() {
  try { return JSON.parse(localStorage.getItem(cfg.storageKey) || "{}"); }
  catch (e) { return {}; }
}
function saveProgress(p) {
  try { localStorage.setItem(cfg.storageKey, JSON.stringify(p)); }
  catch (e) { console.warn("Could not save progress:", e); }
}
```

Replace with:

```js
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
```

- [ ] **Step 2: Verify syntax**

```bash
node -e "require('fs').readFileSync('static/shared.js','utf8')" && echo "OK"
```

Expected: `OK` with no errors.

- [ ] **Step 3: Commit**

```bash
git add static/shared.js
git commit -m "feat: add per-category SRS storage with migration support"
```

---

### Task 2: Update computeOverview and computeCatStats

**Files:**
- Modify: `static/shared.js:70-109` (Overview section)

`computeOverview()` must filter `allCards` to the selected category. `computeCatStats()` must always use the full merged view so the Stats modal shows all categories regardless of which one is selected.

- [ ] **Step 1: Replace computeOverview (lines 70–88)**

Find:

```js
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
```

Replace with:

```js
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
```

- [ ] **Step 2: Update computeCatStats to use forceAll (line 97)**

Find:

```js
function computeCatStats() {
  var p = loadProgress();
```

Replace with:

```js
function computeCatStats() {
  var p = loadProgress(true);
```

- [ ] **Step 3: Verify syntax**

```bash
node -e "require('fs').readFileSync('static/shared.js','utf8')" && echo "OK"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add static/shared.js
git commit -m "feat: make computeOverview category-scoped, computeCatStats always full view"
```

---

### Task 3: Update init() — migration + dropdown change listener

**Files:**
- Modify: `static/shared.js:398-416` (Init section)

Migration must run after `allCards` is populated. The category dropdown needs a `change` listener to refresh the overview stats.

- [ ] **Step 1: Replace init() (lines 398–416)**

Find:

```js
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
```

Replace with:

```js
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
    sel.innerHTML = '<option value="All">All categories</option>' +
      cats.map(function(c) { return '<option>' + c + '</option>'; }).join("");
    sel.addEventListener("change", refreshOverview);
  }

  // migrateProgress() must run after allCards is populated (the await above guarantees this)
  migrateProgress();
  cfg.initUI(allCards, setMode);
  refreshOverview();
  showScreen("home");
  setupSwipe();
}
```

- [ ] **Step 2: Verify syntax**

```bash
node -e "require('fs').readFileSync('static/shared.js','utf8')" && echo "OK"
```

Expected: `OK`

- [ ] **Step 3: Commit**

```bash
git add static/shared.js
git commit -m "feat: run migration on init, refresh overview on category change"
```

---

### Task 4: Smoke test Feature 1 in the browser

- [ ] **Step 1: Start the server**

```bash
cd /Users/wongshennan/Documents/personal/languages
python3 app.py
```

- [ ] **Step 2: New-user test**

Open `http://localhost:5000/viet`. Open DevTools console (F12). Run:

```js
localStorage.clear(); location.reload();
```

Expected: App loads, no console errors, all stat boxes show numbers > 0.

- [ ] **Step 3: Category isolation test**

1. Select any specific category (e.g. "Animals") in the dropdown.
2. Observe: overview stats change to show only that category's card counts.
3. Start a session, rate 2–3 cards.
4. In DevTools console, run:
   ```js
   Object.keys(localStorage).filter(k => k.startsWith('viet'))
   ```
   Expected: keys like `["viet_progress_Animals", "viet_progress_migrated"]` — **not** a bare `"viet_progress"` key.
5. Switch to "Food" (or another category) in the dropdown.
6. Expected: overview updates immediately; new session shows Food's cards only.

- [ ] **Step 4: All mode aggregation test**

1. Note the Due count when "All categories" is selected.
2. Note the Due count for each individual category.
3. Verify: sum of individual Due counts ≥ All mode Due count (equal if no card is due in multiple category stores — impossible, but good sanity check).

- [ ] **Step 5: Stats modal full-view test**

1. Select a specific category.
2. Click "📊 Stats".
3. Verify: the category breakdown table shows **all** categories, not just the selected one.

- [ ] **Step 6: Migration test — basic**

```js
// Seed legacy data, remove flag, reload
localStorage.setItem('viet_progress', JSON.stringify({
  "1": {"interval":5,"ef":2.5,"reps":2,"next_review":"2020-01-01T00:00:00","correct":3,"wrong":0}
}));
localStorage.removeItem('viet_progress_migrated');
location.reload();
```

After reload, in console:
```js
Object.keys(localStorage).filter(k => k.startsWith('viet'))
```

Expected:
- `viet_progress_migrated` = `"1"` ✓
- `viet_progress` key is **gone** ✓
- Card #1's category key (e.g. `viet_progress_<SomeCat>`) exists and contains `interval: 5, ef: 2.5` ✓

- [ ] **Step 7: Migration test — idempotency (flag already set)**

```js
// Flag is already set (from step 6). Re-seed legacy key manually.
localStorage.setItem('viet_progress', JSON.stringify({
  "1": {"interval":99,"ef":1.0,"reps":9,"next_review":"2020-01-01T00:00:00","correct":0,"wrong":9}
}));
location.reload();
```

After reload, in console check card #1's category key. Expected:
- The value is **still** `interval: 5` (from step 6), NOT `interval: 99` — migration was skipped because `_migrated` flag was present. The legacy key also remains (we didn't touch it — `viet_progress` with interval:99 should still be there but ignored).

- [ ] **Step 8: Migration test — unknown card routed to General**

```js
// Seed with a cardNum that doesn't exist in the vocab (e.g. 999999)
localStorage.setItem('viet_progress', JSON.stringify({
  "999999": {"interval":3,"ef":2.1,"reps":1,"next_review":"2020-01-01T00:00:00","correct":1,"wrong":0}
}));
localStorage.removeItem('viet_progress_migrated');
location.reload();
```

Expected in console:
- A `console.warn` message mentioning card `999999` → General ✓
- `viet_progress_General` key exists and contains card `999999`'s data ✓

---

## Chunk 2: Vocab Generation + Integration

### Task 5: Create generate_vocab.py

**Files:**
- Create: `vietnamese/generate_vocab.py`
- Modify: `vietnamese/requirements.txt`

- [ ] **Step 1: Add anthropic to requirements**

```bash
cd /Users/wongshennan/Documents/personal/languages
grep -q "anthropic" vietnamese/requirements.txt || echo "anthropic" >> vietnamese/requirements.txt
pip install anthropic openpyxl
```

- [ ] **Step 2: Create the generation script**

Create `vietnamese/generate_vocab.py` with this exact content:

```python
#!/usr/bin/env python3
"""
generate_vocab.py — Generate ~1,038 B2-level Vietnamese words via Claude API.

Combines with the existing 1,962 words to produce viet_vocab_COMPLETE_3000words.xlsx.

Usage:
    ANTHROPIC_API_KEY=<key> python3 generate_vocab.py

Resumable: saves progress to generate_progress.json after each batch.
Re-running after interruption continues from where it left off.
"""

import json
import os
import re
import time
from collections import Counter
from pathlib import Path

import anthropic
import openpyxl

BASE          = Path(__file__).parent
SOURCE_FILE   = BASE / "viet_vocab_COMPLETE_1962words.xlsx"
OUTPUT_FILE   = BASE / "viet_vocab_COMPLETE_3000words.xlsx"
PROGRESS_FILE = BASE / "generate_progress.json"
SHEET_NAME    = "📚 All Words (Combined)"
TARGET_TOTAL  = 3000
BATCH_SIZE    = 100
MAX_RETRIES   = 3


def normalise(s: str) -> str:
    """Lowercase, strip, collapse internal whitespace. Preserves Vietnamese diacritics."""
    return re.sub(r'\s+', ' ', str(s or "").lower().strip())


def load_existing():
    """Return (rows_list, dedup_set, sorted_cats_list) from the source Excel."""
    wb = openpyxl.load_workbook(SOURCE_FILE, read_only=True, data_only=True)
    ws = wb[SHEET_NAME]
    rows, dedup, cats = [], set(), set()
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row[0]:
            continue
        num, part, viet, english, hanzi, cantonese, cat, notes = (list(row) + [""] * 8)[:8]
        rows.append({
            "num":       int(num),
            "part":      str(part      or ""),
            "viet":      str(viet      or ""),
            "english":   str(english   or ""),
            "hanzi":     str(hanzi     or ""),
            "cantonese": str(cantonese or ""),
            "cat":       str(cat       or "General"),
            "notes":     str(notes     or ""),
        })
        dedup.add(normalise(viet))
        cats.add(str(cat or "General"))
    wb.close()
    return rows, dedup, sorted(cats)


def load_progress() -> dict:
    if PROGRESS_FILE.exists():
        with open(PROGRESS_FILE, encoding="utf-8") as f:
            return json.load(f)
    return {"accepted": [], "next_num": 1963}


def save_progress(progress: dict):
    with open(PROGRESS_FILE, "w", encoding="utf-8") as f:
        json.dump(progress, f, ensure_ascii=False, indent=2)


def validate_word(w: dict, cats_set: set):
    for field in ("part", "viet", "english", "cat"):
        if not str(w.get(field, "")).strip():
            return False, f"missing '{field}'"
    if w["cat"] not in cats_set:
        return False, f"unknown cat {w['cat']!r}"
    return True, None


def call_api(client, count: int, next_num: int, cats: list, dedup_sample: set) -> list:
    sample = list(dedup_sample)[:60]
    prompt = (
        f"Generate exactly {count} Vietnamese vocabulary words at B2 level (upper-intermediate).\n\n"
        "Return ONLY a JSON array. Each element must have these exact keys:\n"
        f'- "num": integer, starting from {next_num}, sequential\n'
        '- "part": one of: noun, verb, adjective, adverb, phrase, conjunction, preposition\n'
        '- "viet": Vietnamese word or phrase with all correct tones and diacritics\n'
        '- "english": English translation\n'
        '- "hanzi": Chinese characters if the word has a Sino-Vietnamese origin (empty string if not applicable)\n'
        '- "cantonese": Cantonese romanisation matching the hanzi (empty string if hanzi is empty)\n'
        f'- "cat": one of these categories: {", ".join(cats)}\n'
        '- "notes": brief usage note, grammatical note, or mnemonic (empty string if none)\n\n'
        "Requirements:\n"
        "- B2 level vocabulary: abstract concepts (tự do, trách nhiệm), formal/academic verbs,\n"
        "  professional vocabulary (medical, legal, business, technology), complex emotions,\n"
        "  connectives and discourse markers, idiomatic phrases\n"
        "- Vietnamese must include all tonal marks — never omit diacritics\n"
        f"- Do NOT repeat any of these existing words: {', '.join(sample)}\n"
        "- Spread words across all provided categories roughly evenly\n"
        "- Return valid JSON only. No markdown code fences, no commentary outside the array."
    )
    response = client.messages.create(
        model="claude-opus-4-6",
        max_tokens=8192,
        messages=[{"role": "user", "content": prompt}],
    )
    text = response.content[0].text.strip()
    text = re.sub(r'^```(?:json)?\s*', '', text)
    text = re.sub(r'\s*```$', '', text)
    return json.loads(text)


def generate_batch(client, target_count: int, next_num: int,
                   cats: list, cats_set: set, dedup: set) -> list:
    """Request words, validate, dedup. Retry for parse failures; accept shortfall for pure dups.
    API/network errors (RateLimitError, APIConnectionError) are NOT caught here — they propagate
    to main() which handles save+exit logic."""
    accepted = []
    remaining = target_count
    parse_retries = 0

    while remaining > 0 and parse_retries <= MAX_RETRIES:
        try:
            words = call_api(client, remaining, next_num + len(accepted), cats, dedup)
        except (json.JSONDecodeError, ValueError) as e:
            # Only catch parse/decode errors here; let API errors bubble up
            parse_retries += 1
            print(f"  ⚠ Parse error (retry {parse_retries}/{MAX_RETRIES}): {e}")
            time.sleep(2)
            continue

        dup_count = parse_fail_count = 0
        for w in words:
            w["num"] = next_num + len(accepted)
            valid, reason = validate_word(w, cats_set)
            if not valid:
                parse_fail_count += 1
                continue
            norm = normalise(w["viet"])
            if norm in dedup:
                dup_count += 1
                continue
            dedup.add(norm)
            accepted.append(w)
            remaining -= 1
            if remaining == 0:
                break

        if remaining > 0:
            if parse_fail_count > 0 and parse_retries < MAX_RETRIES:
                parse_retries += 1
                print(f"  {parse_fail_count} validation failures → retry {parse_retries}/{MAX_RETRIES}")
            elif dup_count > 0 and parse_fail_count == 0:
                print(f"  ⚠ {dup_count} duplicates, no parse failures → accepting shortfall of {remaining}")
                break
            else:
                break

    return accepted


def _get_retry_after(e: anthropic.RateLimitError, default: int = 10) -> int:
    """Extract Retry-After seconds from a RateLimitError response header."""
    try:
        return int(e.response.headers.get("retry-after", default))
    except Exception:
        return default


def main():
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise SystemExit("Error: ANTHROPIC_API_KEY environment variable not set.")

    client = anthropic.Anthropic(api_key=api_key)

    print("Loading existing vocab…")
    existing_rows, dedup, cats = load_existing()
    cats_set = set(cats)
    print(f"  {len(existing_rows)} words, {len(cats)} categories: {cats}")

    progress = load_progress()
    accepted = progress["accepted"]
    next_num = progress["next_num"]
    for w in accepted:
        dedup.add(normalise(w["viet"]))
    print(f"  Resuming from word {next_num} ({len(accepted)} already generated)")

    while next_num <= TARGET_TOTAL:
        batch_size = min(BATCH_SIZE, TARGET_TOTAL - next_num + 1)
        print(f"\nBatch {next_num}–{next_num + batch_size - 1}…")

        for attempt in range(MAX_RETRIES + 1):
            try:
                batch = generate_batch(client, batch_size, next_num, cats, cats_set, dedup)
                break
            except anthropic.RateLimitError as e:
                wait = _get_retry_after(e)
                if attempt >= MAX_RETRIES:
                    save_progress({"accepted": accepted, "next_num": next_num})
                    raise SystemExit(f"Rate limit exhausted. Progress saved to {PROGRESS_FILE}.")
                print(f"  Rate limit — waiting {wait}s (attempt {attempt + 1}/{MAX_RETRIES})…")
                time.sleep(wait)
            except Exception as e:
                if attempt >= MAX_RETRIES:
                    save_progress({"accepted": accepted, "next_num": next_num})
                    raise SystemExit(f"Network error: {e}. Progress saved to {PROGRESS_FILE}.")
                print(f"  Error: {e} — retrying in 10s…")
                time.sleep(10)

        accepted.extend(batch)
        next_num += len(batch)
        save_progress({"accepted": accepted, "next_num": next_num})
        print(f"  ✓ {len(batch)} accepted (total: {len(accepted)})")

    # Write combined output
    print(f"\nWriting {OUTPUT_FILE}…")
    wb_out = openpyxl.Workbook()
    ws_out = wb_out.active
    ws_out.title = SHEET_NAME
    ws_out.append(["num", "part", "viet", "english", "hanzi", "cantonese", "cat", "notes"])
    for r in existing_rows + accepted:
        ws_out.append([r["num"], r["part"], r["viet"], r["english"],
                       r["hanzi"], r["cantonese"], r["cat"], r["notes"]])
    wb_out.save(OUTPUT_FILE)

    # Summary
    cat_counts   = Counter(w["cat"] for w in accepted)
    total_rows   = len(existing_rows) + len(accepted)
    shortfall    = TARGET_TOTAL - total_rows
    print(f"\n{'=' * 50}")
    print(f"Total rows written : {total_rows}")
    print(f"New words generated: {len(accepted)}")
    if shortfall:
        print(f"Shortfall (dups)   : {shortfall}")
    print(f"By category        : {dict(cat_counts)}")
    print(f"Output             : {OUTPUT_FILE}")

    PROGRESS_FILE.unlink(missing_ok=True)
    print("✓ Done")


if __name__ == "__main__":
    main()
```

- [ ] **Step 3: Verify syntax**

```bash
python3 -c "import ast; ast.parse(open('vietnamese/generate_vocab.py').read()); print('OK')"
```

Expected: `OK`

- [ ] **Step 4: Commit**

```bash
git add vietnamese/generate_vocab.py vietnamese/requirements.txt
git commit -m "feat: add Vietnamese B2 vocab generation script"
```

---

### Task 6: Run the generation script

- [ ] **Step 1: Ensure API key is set**

```bash
echo $ANTHROPIC_API_KEY
```

If empty: `export ANTHROPIC_API_KEY=<your-key>`

- [ ] **Step 2: Run the script**

```bash
cd /Users/wongshennan/Documents/personal/languages/vietnamese
python3 generate_vocab.py
```

Expected output (approximate — takes ~5–10 minutes for 11 batches):

```
Loading existing vocab…
  1962 words, N categories: [...]
  Resuming from word 1963 (0 already generated)

Batch 1963–2062…
  ✓ 100 accepted (total: 100)
Batch 2063–2162…
  ✓ 100 accepted (total: 200)
...
==================================================
Total rows written : 3000
New words generated: 1038
By category        : {...}
Output             : .../viet_vocab_COMPLETE_3000words.xlsx
✓ Done
```

If interrupted at any point, re-run the same command — it resumes from `generate_progress.json`.

- [ ] **Step 3: Validate the output**

```bash
cd /Users/wongshennan/Documents/personal/languages
python3 - <<'EOF'
import openpyxl, re

wb = openpyxl.load_workbook("vietnamese/viet_vocab_COMPLETE_3000words.xlsx", read_only=True, data_only=True)
ws = wb["📚 All Words (Combined)"]
rows = [r for r in ws.iter_rows(min_row=2, values_only=True) if r[0]]

assert len(rows) == 3000, f"Expected 3000 rows, got {len(rows)}"

def norm(s): return re.sub(r'\s+', ' ', str(s or "").lower().strip())
viets = [norm(r[2]) for r in rows]
assert len(viets) == len(set(viets)), "Duplicate viet values found"

nums = [int(r[0]) for r in rows]
assert nums == list(range(1, 3001)), f"nums not sequential 1-3000"

for i, r in enumerate(rows):
    for fi, fn in [(0,"num"),(1,"part"),(2,"viet"),(3,"english"),(6,"cat")]:
        assert str(r[fi] or "").strip(), f"Row {i+2} missing {fn}"

wb.close()
print("✓ All validation checks passed")
EOF
```

Expected: `✓ All validation checks passed`

- [ ] **Step 4: Commit the generated file**

```bash
git add vietnamese/viet_vocab_COMPLETE_3000words.xlsx
git commit -m "data: Vietnamese vocab expanded to 3000 words (B2 level)"
```

---

### Task 7: Update app.py and viet.html

**Files:**
- Modify: `app.py:63-65` (`_load_viet` filename)
- Modify: `templates/viet.html:51` (word count string)

- [ ] **Step 1: Update app.py _load_viet() with fallback**

Find in `app.py` (lines ~63–87):

```python
def _load_viet():
    src = BASE / "vietnamese" / "viet_vocab_COMPLETE_1962words.xlsx"
    print(f"Loading Viet vocab from {src}…")
    wb = openpyxl.load_workbook(src, read_only=True, data_only=True)
    ws = wb["📚 All Words (Combined)"]
    cards = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row[0]:
            continue
        num, part, viet, english, hanzi, cantonese, cat, notes = (list(row) + [""] * 8)[:8]
        if not viet:
            continue
        cards.append({
            "num":       int(num),
            "part":      str(part      or ""),
            "viet":      str(viet      or ""),
            "english":   str(english   or ""),
            "hanzi":     str(hanzi     or ""),
            "cantonese": str(cantonese or ""),
            "cat":       str(cat       or "General"),
            "notes":     str(notes     or ""),
        })
    wb.close()
    print(f"  Loaded {len(cards)} Viet cards")
    return cards
```

Replace with (one-line change at the top, rest identical):

```python
def _load_viet():
    src = BASE / "vietnamese" / "viet_vocab_COMPLETE_3000words.xlsx"
    if not src.exists():
        src = BASE / "vietnamese" / "viet_vocab_COMPLETE_1962words.xlsx"
        print("WARNING: 3000-word file not found, falling back to 1962-word file")
    print(f"Loading Viet vocab from {src}…")
    wb = openpyxl.load_workbook(src, read_only=True, data_only=True)
    ws = wb["📚 All Words (Combined)"]
    cards = []
    for row in ws.iter_rows(min_row=2, values_only=True):
        if not row[0]:
            continue
        num, part, viet, english, hanzi, cantonese, cat, notes = (list(row) + [""] * 8)[:8]
        if not viet:
            continue
        cards.append({
            "num":       int(num),
            "part":      str(part      or ""),
            "viet":      str(viet      or ""),
            "english":   str(english   or ""),
            "hanzi":     str(hanzi     or ""),
            "cantonese": str(cantonese or ""),
            "cat":       str(cat       or "General"),
            "notes":     str(notes     or ""),
        })
    wb.close()
    print(f"  Loaded {len(cards)} Viet cards")
    return cards
```

- [ ] **Step 2: Verify no other occurrences of the old filename**

```bash
grep -n "1962words" app.py
```

Expected: no output (all references replaced).

- [ ] **Step 3: Update word count string in viet.html**

Find in `templates/viet.html` (line 51):

```html
    <p>1&thinsp;962 words &#183; SM-2 algorithm &#183; Cantonese connections</p>
```

Replace with:

```html
    <p>3&thinsp;000 words &#183; SM-2 algorithm &#183; Cantonese connections</p>
```

Then verify no other occurrences remain:

```bash
grep -n "1962\|1.thinsp.962" templates/viet.html
```

Expected: no output.

- [ ] **Step 4: Verify server starts cleanly**

```bash
python3 app.py &
sleep 3
curl -s http://localhost:5000/api/vocab/viet | python3 -c "import json,sys; d=json.load(sys.stdin); print(len(d),'cards')"
kill %1
```

Expected: `3000 cards`

- [ ] **Step 5: Verify viet.html no longer mentions 1962**

```bash
grep "1962" templates/viet.html
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add app.py templates/viet.html
git commit -m "feat: update Vietnamese app to serve 3000-word vocab"
```

---

### Task 8: Final integration smoke test

- [ ] **Step 1: Start the server**

```bash
python3 app.py
```

- [ ] **Step 2: Open http://localhost:5000/viet**

Verify:
- Page title area shows `3 000 words` (not `1 962`)
- Overview stats load without errors

- [ ] **Step 3: Confirm new categories (if any were added) appear in the dropdown**

If the generated words introduced no new categories, the dropdown is unchanged. If they did, the new categories should appear and behave correctly (select one → overview updates → session starts with only those cards).

- [ ] **Step 4: Confirm Bahasa and Spanish still work**

Open `http://localhost:5000/bahasa` and `http://localhost:5000/spanish`. Verify both load and function correctly — the `shared.js` changes should work transparently for both since they also have `.cat` fields and `#cat-select`.
