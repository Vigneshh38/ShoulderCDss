// Cell check: does the app write every cell exactly as the Golden Datasets do?
//
//   python scripts/build_routing_data.py --test-out routing_test.json --test-rows 400
//   node scripts/check_cells.mjs routing_test.json
//
// Each row is loaded the way "Try a Golden Dataset case" loads it, then written back with rowFor (the row the app
// writes for that workbook), and every cell is compared with the original Excel cell. Two passes:
//   1. typed:  what the app writes when a clinician enters the same answers (no original cell to fall back on)
//   2. loaded: what the app writes for a loaded case (untouched cells come back from the original text)
import fs from 'node:fs';
import { fromDatasetRow, rowFor } from '../src/ShoulderRouter/engine.js';
import { QUESTIONS, CORE_FIELDS, HISTORY_FIELDS } from '../src/ShoulderRouter/routingSpec.js';

// The columns the app collects for each workbook: the shared ones, Red Flags / Precautions, and its routing questions.
const ASKED = {};
const shared = [...CORE_FIELDS, ...HISTORY_FIELDS].map(f => f.key).concat('Red Flags / Precautions');
for (const q of Object.values(QUESTIONS)) for (const [w, col] of q.cols || []) (ASKED[w] ||= new Set(shared)).add(col);
const notAsked = {};

const file = process.argv[2];
if (!file) { console.error('usage: node scripts/check_cells.mjs <test.json>'); process.exit(2); }
const rows = JSON.parse(fs.readFileSync(file, 'utf8'));
const META = new Set(['wrapper', 'Case ID', 'Diagnosis', 'Rehabilitation Phase']);
// Columns the app decides rather than copies: the dominant side is derived (S01 rule document) and the red-flag
// text comes from the red-flag screen.
const DECIDED = new Set(['Affected Side Is Dominant (Y/N)', 'Red Flags / Precautions']);
const same = (x, y) => String(x) === String(y) || (x !== '' && y !== '' && Number.isFinite(Number(x)) && Number(x) === Number(y));
let failed = false;

for (const pass of ['typed', 'loaded']) {
  const stat = {};
  for (const row of rows) {
    const w = row.wrapper;
    const { answers, assumed, raw } = fromDatasetRow(row);
    const out = rowFor(answers, w, { assumed, raw: pass === 'loaded' ? raw : {} });
    for (const [col, orig] of Object.entries(row)) {
      if (META.has(col) || orig === null || orig === undefined || orig === '') continue;
      if (!(ASKED[w] || new Set(shared)).has(col)) { (notAsked[w] ||= new Set()).add(col); continue; }
      const s = (stat[col] ||= { n: 0, ok: 0, missing: 0, ex: [] });
      s.n++;
      if (col in out && same(out[col], orig)) s.ok++;
      else {
        if (!(col in out)) s.missing++;
        if (s.ex.length < 2) s.ex.push(`${w}: ${JSON.stringify(orig)} → ${col in out ? JSON.stringify(out[col]) : '(not written)'}`);
      }
    }
  }
  let n = 0, ok = 0;
  console.log(`\n=== ${pass} ===`);
  for (const [col, s] of Object.entries(stat).sort()) {
    if (!DECIDED.has(col)) { n += s.n; ok += s.ok; }
    if (s.ok === s.n) continue;
    console.log(`${DECIDED.has(col) ? '(decided) ' : ''}${col}: ${s.ok}/${s.n} identical${s.missing ? `, ${s.missing} not written` : ''}`);
    for (const e of s.ex) console.log(`    e.g. ${e}`);
  }
  console.log(`${pass}: ${ok}/${n} cells identical to the Excel (${(100 * ok / n).toFixed(2)}%)`);
  if (ok !== n) failed = true;
}
const na = Object.entries(notAsked).map(([w, s]) => `${w}: ${[...s].join(', ')}`);
if (na.length) console.log(`\nIn the test rows but not asked by the routing (left for the wrapper's own form):\n  ${na.join('\n  ')}`);
process.exit(failed ? 1 : 0);
