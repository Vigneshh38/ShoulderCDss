// Routing self-test on Golden Dataset rows: does each row land in a branch that holds its own wrapper, and does the
// node walk then end in that wrapper?
//
//   python scripts/build_routing_data.py --test-out routing_test.json --test-rows 400     (400 rows per wrapper)
//   python scripts/build_routing_data.py --test-out routing_all.jsonl --test-rows 0       (every row, one per line)
//   node scripts/test_routing.mjs routing_test.json        (or routing_all.jsonl)
//
// Each row only has its own workbook's columns. Every routing question from other workbooks gets its "normal"
// answer (the same fill the app uses for "Load a real case"), so this tests each wrapper's own findings and the
// shared intake fields, not cross-talk between findings that no single workbook records together.
// Routing happens at first presentation, so Phase 1-2 rows are reported apart from recovering Phase 3-4 rows,
// whose special tests have often already returned to normal.
//
// A row that ends in S18 when it is not an S18 row went to "clinician review" (the fallback): a miss, not a wrong
// wrapper. The test fails (exit 1) if any Phase 1-2 row ends in a wrong wrapper other than that fallback.
import fs from 'node:fs';
import readline from 'node:readline';
import { evaluate, fromDatasetRow } from '../src/ShoulderRouter/engine.js';

const file = process.argv[2];
if (!file) { console.error('usage: node scripts/test_routing.mjs <test.json | test.jsonl>'); process.exit(2); }

async function* rowsOf(path) {
  if (!path.endsWith('.jsonl')) { yield* JSON.parse(fs.readFileSync(path, 'utf8')); return; }
  for await (const line of readline.createInterface({ input: fs.createReadStream(path, 'utf8'), crlfDelay: Infinity })) if (line.trim()) yield JSON.parse(line);
}

const by = {};
const tally = () => ({ n: 0, ok: 0 });
for await (const row of rowsOf(file)) {
  const { answers } = fromDatasetRow(row);
  const ev = evaluate(answers);
  const w = row.wrapper;
  const early = /Phase [12]/.test(String(row['Rehabilitation Phase']));
  const b = by[w] ||= { branch: tally(), node: tally(), all: tally(), early: tally(), halt: 0, review: 0, wrong: 0, wrongEarly: 0, where: {}, misses: [] };
  const inBranch = !!ev.branch && ev.candidates.includes(w);
  const ok = ev.wrapper === w;
  b.branch.n++; if (inBranch) b.branch.ok++;
  if (inBranch) { b.node.n++; if (ok) b.node.ok++; }
  for (const t of [b.all, early ? b.early : null].filter(Boolean)) { t.n++; if (ok) t.ok++; }
  if (ev.halt) b.halt++;
  if (!ok) {
    if (ev.wrapper === 'S18') b.review++;
    else { b.wrong++; if (early) b.wrongEarly++; }
    const k = !ev.branch ? `stuck at ${ev.current}` : `${ev.halt ? ev.halt.id + '→' : ''}${ev.branch}→${ev.wrapper || `node ${ev.nodes.at}`}`;
    b.where[k] = (b.where[k] || 0) + 1;
    if (early && b.misses.length < 2) b.misses.push(`${row['Case ID']} ${row.Diagnosis} (${row['Rehabilitation Phase']}) → ${k}`);
  }
}
const pct = t => (t.n ? `${(100 * t.ok / t.n).toFixed(2)}%` : '  -  ').padStart(8);
const sum = { branch: tally(), node: tally(), all: tally(), early: tally(), review: 0, wrong: 0, wrongEarly: 0 };
console.log('wrapper   rows    branch  node walk  wrapper  phase-1/2  halted  review  wrong  missed-to');
for (const [w, b] of Object.entries(by).sort()) {
  for (const k of ['branch', 'node', 'all', 'early']) { sum[k].n += b[k].n; sum[k].ok += b[k].ok; }
  for (const k of ['review', 'wrong', 'wrongEarly']) sum[k] += b[k];
  const miss = Object.entries(b.where).sort((x, y) => y[1] - x[1]).slice(0, 3).map(([k, c]) => `${k}×${c}`).join(' ');
  console.log(`${w}     ${String(b.all.n).padStart(6)}  ${pct(b.branch)}   ${pct(b.node)} ${pct(b.all)}   ${pct(b.early)}  ${String(b.halt).padStart(6)}  ${String(b.review).padStart(6)}  ${String(b.wrong).padStart(5)}  ${miss}`);
  for (const m of b.misses) console.log('           e.g. ' + m);
}
console.log(`\nALL  ${sum.all.n} rows · branch ${pct(sum.branch).trim()} · node walk (in the right branch) ${pct(sum.node).trim()} · wrapper ${pct(sum.all).trim()} · phase 1-2 wrapper ${pct(sum.early).trim()} (${sum.early.n} rows)`);
console.log(`     misses: ${sum.review} to clinician review (S18), ${sum.wrong} to a wrong wrapper (${sum.wrongEarly} of them phase 1-2)`);
if (sum.wrongEarly) { console.log('FAIL: a phase 1-2 row ended in a wrong wrapper'); process.exit(1); }
