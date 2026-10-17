// Routing self-test on Golden Dataset rows: does each row land in a branch that contains its own wrapper?
//
//   python scripts/build_routing_data.py --test-out routing_test.json --test-rows 400
//   node scripts/test_routing.mjs routing_test.json
//
// Each row only has its own workbook's columns. Every routing question from other workbooks gets its "normal"
// answer (the same fill the app uses for "Load a real case"), so this tests each wrapper's own findings and the
// shared intake fields, not cross-talk between findings that no single workbook records together.
// Routing happens at first presentation, so Phase 1-2 rows are reported apart from recovering Phase 3-4 rows,
// whose special tests have often already returned to normal.
import fs from 'node:fs';
import { evaluate, fromDatasetRow } from '../src/ShoulderRouter/engine.js';
import { SCREEN } from '../src/ShoulderRouter/routingSpec.js';

const file = process.argv[2];
if (!file) { console.error('usage: node scripts/test_routing.mjs <test.json>'); process.exit(2); }
const rows = JSON.parse(fs.readFileSync(file, 'utf8'));

const by = {};
const tally = () => ({ n: 0, ok: 0 });
for (const row of rows) {
  const { answers } = fromDatasetRow(row);
  const ev = evaluate(answers);
  const w = row.wrapper;
  const early = /Phase [12]/.test(String(row['Rehabilitation Phase']));
  const b = by[w] ||= { all: tally(), early: tally(), halt: 0, where: {}, misses: [] };
  const ok = !!ev.branch && (SCREEN[ev.branch].wrappers.includes(w) || (ev.halt && ev.halt.flag.wrappers.includes(w)));
  for (const t of [b.all, early ? b.early : null].filter(Boolean)) { t.n++; if (ok) t.ok++; }
  if (ev.halt) b.halt++;
  if (!ok) {
    const k = !ev.branch ? `stuck at ${ev.current}` : (ev.halt ? ev.halt.id + '→' : '') + ev.branch;
    b.where[k] = (b.where[k] || 0) + 1;
    if (early && b.misses.length < 2) b.misses.push(`${row['Case ID']} ${row.Diagnosis} (${row['Rehabilitation Phase']}) → ${k}: ${(ev.halt?.signals || ev.walk.find(x => x.id === ev.branch)?.signals || []).join('; ')}`);
  }
}
const pct = t => (t.n ? `${(100 * t.ok / t.n).toFixed(1)}%` : '  -  ').padStart(7);
const sum = { all: tally(), early: tally() };
console.log('wrapper  rows  all-rows  phase-1/2  halted  misrouted-to');
for (const [w, b] of Object.entries(by).sort()) {
  for (const k of ['all', 'early']) { sum[k].n += b[k].n; sum[k].ok += b[k].ok; }
  const miss = Object.entries(b.where).sort((x, y) => y[1] - x[1]).map(([k, c]) => `${k}×${c}`).join(' ');
  console.log(`${w}      ${String(b.all.n).padStart(4)}  ${pct(b.all)}  ${pct(b.early)}  ${String(b.halt).padStart(6)}  ${miss}`);
  for (const m of b.misses) console.log('           e.g. ' + m);
}
console.log(`\nALL      ${sum.all.n}  ${pct(sum.all)}  ${pct(sum.early)}   (phase-1/2 = ${sum.early.n} first-presentation rows)`);
