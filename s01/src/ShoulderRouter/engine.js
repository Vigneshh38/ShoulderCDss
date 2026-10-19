// Routing engine: runs the red-flag screen and the branch walk over a flat answers map, and turns the answers
// into a record keyed by exact Medical Record Library columns. Pure JS (no React), so a server can reuse it.
import { BUILT, RED_FLAGS_DOC, DIALECT } from './routingData.generated.js';
import {
  FLAGS, SCREENS, SCREEN, FLAG_BRANCH, QUESTIONS, CORE_FIELDS, HISTORY_FIELDS, COL, PROCEDURES, surgeryOf, derivedDominant,
  IMAGING, FULL_ROM, KEYS, VALUE_MAP, SHARED_FROM, NODE, NODE_START, EXIT, answerNode,
} from './routingSpec.js';
import { NA, has, parseRom3, formatRom3, parseFever, formatFever, parseGirth, formatGirth, parseReflex, formatReflex, parseWeek } from './values.js';

export const ENGINE_VERSION = 'shoulder-routing-0.2 (draft)';
const optValue = o => (typeof o === 'object' ? o.v : o);

// ---------- node walk ----------
// The clinician's answer at a node, and the reason when it differs from the engine's, live in the answers map under
// these keys (not Excel columns), so they are saved and restored with every other answer.
export const nodeKey = id => `node|${id}`;
export const nodeReasonKey = id => `node|${id}::reason`;

// Walk `branch` node by node down to one wrapper. `candidates` are the wrappers this case can still go to: the
// branch's, or a red flag's. One candidate, or a branch without nodes, needs no walk.
export function walkNodes(a, branch, candidates) {
  if (!branch) return { state: 'none', steps: [], wrapper: null };
  const start = NODE_START[branch];
  if (candidates.length === 1 || !start) return { state: 'done', single: true, steps: [], wrapper: candidates[0] || null };
  const steps = [];
  for (let id = start, guard = 0; id && guard < 50; guard++) {
    const node = NODE[id];
    const auto = answerNode(node, a);
    const opts = [...node.options, EXIT];
    const chosen = opts.find(o => o.v === a[nodeKey(id)]) || null;
    const pick = chosen || auto.option;
    steps.push({
      id, node, auto, chosen: chosen?.v || null, pick: pick || null, by: chosen ? 'clinician' : pick ? 'engine' : null,
      // The clinician went against the engine (or answered where the engine could not): a reason is required.
      differs: !!chosen && (!auto.option || chosen.v !== auto.option.v), reason: String(a[nodeReasonKey(id)] || ''),
    });
    if (!pick) return { state: 'open', at: id, steps, wrapper: null };
    if (pick.to) {
      const outside = !pick.exit && !candidates.includes(pick.to);
      return { state: outside ? 'open' : 'done', at: outside ? id : null, steps, wrapper: outside ? null : pick.to, exit: !!pick.exit, outside };
    }
    id = pick.next;
  }
  return { state: 'open', steps, wrapper: null };
}

// ---------- evaluation ----------
export function evaluate(a) {
  const flags = FLAGS.map(f => {
    const ap = f.applies ? f.applies(a) : { yes: true };
    if (ap.na) return { id: f.id, flag: f, state: 'na', note: ap.na };
    if (ap.open) return { id: f.id, flag: f, state: 'open', note: ap.open, missing: [] };
    return { id: f.id, flag: f, ...f.evaluate(a) };
  });
  const fired = flags.filter(x => x.state === 'fires');
  const openFlags = flags.filter(x => x.state === 'open');
  // Emergencies outrank urgent flags; among equals the lower rule number wins.
  const halt = fired.length ? [...fired].sort((x, y) => (y.flag.emergency - x.flag.emergency) || x.id.localeCompare(y.id))[0] : null;

  const walk = [];
  let current = null, suggested = null;
  for (const s of SCREENS) {
    if (suggested || current) { walk.push({ id: s.id, screen: s, state: 'unreached' }); continue; }
    const r = s.evaluate(a);
    walk.push({ id: s.id, screen: s, ...r });
    if (r.state === 'fires') suggested = s.id;
    else if (r.state === 'open') current = s.id;
  }
  const branch = halt ? FLAG_BRANCH[halt.id] : suggested;
  const step = suggested ? walk.find(w => w.id === suggested) : null;
  let candidates = branch ? SCREEN[branch].wrappers : [];
  if (halt) candidates = halt.flag.wrappers;
  const hints = halt ? halt.flag.wrappers.map(w => ({ w, why: `Red flag ${halt.id}` })) : step?.hints || null;
  const nodes = walkNodes(a, branch, candidates);
  return { flags, fired, openFlags, flagsDone: openFlags.length === 0, halt, walk, current, suggested, branch, candidates, hints, nodes, wrapper: nodes.wrapper, routedBy: halt ? 'red flag' : suggested ? 'branch walk' : null };
}

// The final route with the clinician's branch choice applied: the branch, its candidate wrappers and the node walk.
export function routeOf(a, ev = evaluate(a), override = null) {
  if (!override?.branch) return { branch: ev.branch, candidates: ev.candidates, nodes: ev.nodes };
  const candidates = SCREEN[override.branch].wrappers;
  return { branch: override.branch, candidates, nodes: walkNodes(a, override.branch, candidates) };
}

// Fill blank questions with their "normal" answer (the "No signs" / "All normal" buttons).
export function fillNormal(a, keys) {
  const next = { ...a };
  for (const k of keys) {
    const q = QUESTIONS[k];
    if (!q || q.kind === 'derivedFrom' || has(next, k) || q.normal === undefined) continue;
    if (q.when && !q.when(next)) continue;
    next[k] = q.normal;
  }
  return next;
}

// ---------- serialization: answers -> exact MRL cells ----------
const part = (k, p) => `${k}::${p}`;
// Multi-value cells: "Previous Treatment Received" is only ever joined with " + " in the datasets (S04, S05);
// Co-morbidities mostly with ", " (S01, S14, S16-S18; S04 and S05 also use "; ").
const JOIN = { [COL.treatment]: ' + ' };

// The surgery cell, written the way the procedure's own workbook writes it (PROCEDURES in routingSpec.js).
function surgeryCell(a) {
  const s = surgeryOf(a);
  if (!s.known || s.unknown) return undefined;
  if (!s.any) return 'No';
  if (!s.proc) return 'Yes';
  const p = s.proc, when = String(s.when || '').trim(), other = !s.thisSide;
  const name = p.v === 'Other (specify)' ? String(a[part(COL.surgery, 'spec')] || '').trim() || p.v : p.v;
  const contra = other ? ', contralateral side' : '';
  const index = s.index === 'Yes' && s.thisSide;
  // S12 records the operation a visit is for under its own Procedure Type name.
  if (index && (p.group === 'S12' || p.group === 'S12-other')) return `Yes - ${p.s12 || name} (index procedure for this record)`;
  switch (p.fmt) {
    case 'arthro': return `Yes - ${name}${contra}${when ? ` ${when}` : ''}${index ? ' (index procedure for this record)' : ''}`;
    case 'comma': return `Yes - ${name}${contra}${when ? `, ${when}` : ''}`;
    case 'prevside': return `Yes - ${name} (previous, ${other ? 'other side' : 'same side'})`;
    case 'bare': return `Yes - ${name}${contra}`;
    default: return `Yes - ${name}${contra}${when ? ` (${when})` : ''}`; // "paren", and an S12 name that is not this visit's
  }
}

// A shared cell. With a workbook id `w`, it is worded the way that workbook writes the column (DIALECT, VALUE_MAP,
// SHARED_FROM); without one, in the Layer 1 wording.
export function sharedCell(f, a, w = null) {
  const d = (w && DIALECT[w]) || {};
  const from = w && SHARED_FROM[w]?.[f.key];
  if (from && has(a, from) && a[from] !== NA) return a[from];
  const v = a[f.key];
  if (f.kind === 'derived') return derivedDominant(a).value || undefined;
  if (f.kind === 'surgery') return surgeryCell(a);
  if (!has(a, f.key) || v === NA) return undefined;
  const spec = a[part(f.key, 'spec')];
  if (f.kind === 'multi') return v.map(x => (x === f.specify && spec ? `${x}: ${spec}` : x)).join(d.sep?.[f.key] || JOIN[f.key] || ', ');
  if (f.specify && v === f.specify && spec) return `${v}${d.specifySep?.[f.key] || ': '}${spec}`;
  if (f.kind === 'int' || f.kind === 'dec') return Number(v);
  if (f.key === COL.cervical && v.startsWith('Not Clear') && d.notClear) return d.notClear;
  return (w && VALUE_MAP[w]?.[f.key]?.[v]) || v;
}

export function questionCell(q, a) {
  const v = a[q.key];
  if (q.kind === 'derivedFrom') {
    // S12 "Procedure Type": the S12 name of the operation this visit is for.
    const s = surgeryOf(a);
    if (!s.any || !s.proc || !s.thisSide || s.index !== 'Yes') return undefined;
    return s.proc.group === 'S12' ? s.proc.s12 : s.proc.group === 'S12-other' ? 'Other (specify)' : undefined;
  }
  if (!has(a, q.key) || v === NA || v === FULL_ROM) return undefined;
  switch (q.kind) {
    case 'rom3': return typeof v === 'object' ? formatRom3(v) : v;
    case 'girth': return typeof v === 'object' ? formatGirth(v) : v;
    case 'reflex': return typeof v === 'object' && v.biceps && v.triceps ? formatReflex(v) : undefined;
    case 'week': {
      const n = Number(v), phase = a[part(q.key, 'phase')];
      return Number.isFinite(n) && n >= 0 && n <= 52 && phase ? `Week ${n.toFixed(1)} (${phase})` : undefined;
    }
    case 'int': case 'dec': return Number(v);
    default: {
      const desc = String(a[part(q.key, 'desc')] || '').trim();
      return q.describe && v === 'Present' && desc ? `Present - ${desc}` : v;
    }
  }
}

// What a loaded cell looked like when it was read: if the answers behind it are unchanged, the original text is
// written back as it was, so a loaded dataset case keeps every cell exactly as in the Excel.
const sharedSig = (f, a) => JSON.stringify([a[f.key], a[part(f.key, 'spec')], ...(f.kind === 'surgery' ? ['procedure', 'side', 'when', 'index', 'spec'].map(n => a[part(f.key, n)]) : [])]);
const questionSig = (q, a) => JSON.stringify([a[q.key], a[part(q.key, 'desc')], a[part(q.key, 'phase')]]);

// Red Flags / Precautions: the dataset wording of every fired flag, plus the cervical note the S01 rules require
// ("Not Clear" must be documented here); otherwise the datasets' "None identified".
// With a workbook id, the cervical note and the "none" text are that workbook's own wording. S13 and S15 never write a
// plain "None identified" (only "None identified - cleared for standard post-... rehabilitation", a clearance their own
// halt pathway decides), so with no flag their cell is left for the S13/S15 form.
const CERVICAL_TEXT = 'Cervical spine screen not clear - referred for cervical spine assessment, shoulder pathway continues in parallel';
function redFlagsCell(a, ev, w = null) {
  const d = (w && DIALECT[w]) || {};
  const parts = ev.fired.map(f => f.flag.record(a));
  if (String(a[COL.cervical] || '').startsWith('Not Clear')) parts.push(d.cervicalText || CERVICAL_TEXT);
  if (parts.length) return parts.join('; ');
  if (!w) return 'None identified';
  return d.noneText === 'None identified' ? d.noneText : undefined;
}
// A loaded case keeps its own Red Flags text while the routing finds the same flags as when it was loaded.
const redFlagsSig = (a, ev) => JSON.stringify([ev.fired.map(f => f.id).sort(), a[COL.cervical]]);

// One Medical Record Library row for workbook `w`: every column the routing collected that this workbook has, worded
// the way this workbook writes it. Cells of a loaded case from the same workbook, still unchanged, are copied verbatim.
// `assumed`: answers filled in rather than found (left out). `raw`: original cells from fromDatasetRow.
export function rowFor(a, w, { assumed = [], raw = {}, ev = evaluate(a) } = {}) {
  const skip = new Set(assumed), row = {};
  const orig = (k, col) => { const r = raw[k]; return r && r.w === w && (!col || r.col === col) ? r : null; };
  for (const f of [...CORE_FIELDS, ...HISTORY_FIELDS]) {
    const r = orig(f.key);
    const c = r && f.kind !== 'derived' && r.sig === sharedSig(f, a) ? r.cell : sharedCell(f, a, w);
    if (c !== undefined && c !== '') row[f.key] = c;
  }
  const rf = orig(COL.redFlags);
  const rfCell = rf && rf.sig === redFlagsSig(a, ev) ? rf.cell : redFlagsCell(a, ev, w);
  if (rfCell !== undefined) row[COL.redFlags] = rfCell;
  for (const q of Object.values(QUESTIONS)) {
    if (q.ui || skip.has(q.key) || !q.cols) continue;
    for (const [cw, col] of q.cols) {
      if (cw !== w) continue;
      const r = orig(q.key, col);
      const c = r && r.sig === questionSig(q, a) ? r.cell : questionCell(q, a);
      if (c !== undefined) row[col] = c;
    }
  }
  return row;
}

// The record: `core` and `wrapperFields` hold the answers in Layer 1 wording, keyed by exact column; `rows` holds the
// row of the one wrapper the node walk ends in, as that workbook writes it (see rowFor); `routing` is the trace.
export function buildRecord(a, { caseId = '', override = null, assumed = [], raw = {} } = {}) {
  const ev = evaluate(a);
  const route = routeOf(a, ev, override);
  const nw = route.nodes;
  const skip = new Set(assumed);
  const core = {}, notAssessed = [];
  for (const f of [...CORE_FIELDS, ...HISTORY_FIELDS]) {
    const c = sharedCell(f, a);
    if (c !== undefined && c !== '') core[f.key] = c;
    else if (a[f.key] === NA) notAssessed.push(f.key);
  }
  core[COL.redFlags] = redFlagsCell(a, ev);
  const wrapperFields = {};
  for (const q of Object.values(QUESTIONS)) {
    if (skip.has(q.key)) continue;
    if (q.ui) { if (a[q.key] === NA) notAssessed.push(q.label); continue; }
    const c = questionCell(q, a);
    if (c === undefined) { if (a[q.key] === NA && !q.naLabel) notAssessed.push(`${q.w} · ${q.col}`); continue; }
    for (const [w, col] of q.cols) (wrapperFields[w] ||= {})[col] = c;
  }
  const finalBranch = route.branch;
  const name = id => (id ? `${id} · ${SCREEN[id].name}` : null);
  return {
    caseId: caseId || null,
    core,
    wrapperFields,
    rows: nw.wrapper ? { [nw.wrapper]: rowFor(a, nw.wrapper, { assumed, raw, ev }) } : {},
    routing: {
      engine: ENGINE_VERSION,
      dataBuiltOn: BUILT.on,
      at: new Date().toISOString(),
      redFlags: ev.flags.map(f => ({ id: f.id, state: f.state, wrappers: f.flag.wrappers, signals: f.signals || [], draftRule: f.flag.draft })),
      halt: ev.halt ? { id: ev.halt.id, ...RED_FLAGS_DOC[ev.halt.id], signals: ev.halt.signals } : null,
      walk: ev.walk.map(w => ({ id: w.id, name: w.screen.name, state: w.state, signals: w.signals || [], assumed: w.assumed || [], note: w.note || undefined })),
      suggested: name(ev.branch),
      final: name(finalBranch),
      finalWrappers: finalBranch ? route.candidates : [],
      wrapper: nw.wrapper,
      nodeWalk: nw.single ? [] : nw.steps.map(s => ({
        node: s.id,
        question: s.node.ask,
        answer: s.pick ? s.pick.l : null,
        leadsTo: s.pick ? s.pick.to || s.pick.next : null,
        by: s.by,
        engineAnswer: s.auto.option ? s.auto.option.l : null,
        signals: s.auto.signals || [],
        assumed: s.auto.assumed || [],
        reason: s.differs ? s.reason : undefined,
      })),
      nodeWalkState: nw.state,
      override: override?.branch ? { from: ev.branch, to: override.branch, reason: override.reason } : null,
      notAssessed,
      assumedFromDataset: assumed.map(k => (QUESTIONS[k] ? (QUESTIONS[k].ui ? QUESTIONS[k].label : `${QUESTIONS[k].w} · ${QUESTIONS[k].col}`) : k)),
    },
  };
}

// ---------- loading a Golden Dataset row ----------
// Read a surgery cell back into its parts: the reverse of surgeryCell, matching the exact procedure texts.
const BY_LENGTH = PROCEDURES.filter(p => p.v !== 'Other (specify)').sort((x, y) => y.v.length - x.v.length);
function setSurgery(a, rawCell) {
  const s = String(rawCell).trim(), k = n => part(COL.surgery, n);
  if (/^no$/i.test(s)) { a[COL.surgery] = 'No'; return; }
  a[COL.surgery] = 'Yes';
  const INDEX = /\s*\(index procedure for this record\)\s*$/i;
  let body = s.replace(/^Yes\s*-\s*/i, '');
  a[k('index')] = INDEX.test(body) || /for this fracture$/i.test(body) ? 'Yes' : 'No';
  body = body.replace(INDEX, '');
  const p = BY_LENGTH.find(x => body.startsWith(x.v));
  let rest = p ? body.slice(p.v.length) : '', side = 'This shoulder', when = '';
  if (rest.startsWith(', contralateral side')) { side = 'Other side'; rest = rest.slice(', contralateral side'.length); }
  if (/^ \(previous, other side\)$/.test(rest)) { side = 'Other side'; rest = ''; }
  if (/^ \(previous, same side\)$/.test(rest)) rest = '';
  if (p) {
    if (p.fmt === 'comma') when = rest.replace(/^,\s*/, '');
    else if (p.fmt === 'arthro') when = rest.trim();
    else { const m = /^\s*\((.*)\)$/.exec(rest); when = m ? m[1] : rest.trim(); }
  }
  a[k('procedure')] = p ? p.v : 'Other (specify)';
  if (!p) a[k('spec')] = body;
  a[k('side')] = side;
  if (when) a[k('when')] = when;
}

// Multi-value cells: "; " where a workbook uses it, " + " for treatments, otherwise ", " before a capital letter
// (so "Malignancy (specify): colorectal cancer, in remission" stays one item).
const splitMulti = s => String(s).split(/\s*;\s*|\s*\+\s*|,\s*(?=[A-Z])/).map(x => x.trim()).filter(Boolean);

// An exact option, else the cell as it is (shown as "from the dataset"). No prefix guessing: a value that is not
// one of the options is kept verbatim rather than turned into a near match.
function matchOption(q, raw) {
  const s = String(raw).trim();
  return (q.options || []).map(optValue).find(o => o === s) || s;
}

function parseQuestionCell(q, raw) {
  switch (q.kind) {
    case 'int': case 'dec': return q.key === KEYS.week12 ? parseWeek(raw) : Number(raw);
    case 'rom3': return parseRom3(raw);
    case 'girth': return parseGirth(raw);
    case 'reflex': return parseReflex(raw);
    case 'fever': { const f = parseFever(raw); return f ? formatFever(f) : String(raw); }
    default: return matchOption(q, raw);
  }
}

const IMG_OF = { S08: 'Proximal humerus fracture', S09: 'Clavicle fracture', S10: 'Scapula / glenoid fracture' };

// Turn one Golden Dataset row into answers. Columns the row's own workbook does not have are filled with each
// question's "normal" answer and returned in `assumed`, so the clinician can see which values are not from the data.
export function fromDatasetRow(row) {
  const w = row.wrapper;
  const a = {}, raw = {};
  for (const f of [...CORE_FIELDS, ...HISTORY_FIELDS]) {
    const cell = row[f.key];
    if (cell === undefined || cell === null || cell === '') continue;
    if (f.kind === 'surgery') setSurgery(a, cell);
    else if (f.kind === 'derived') a[f.key] = String(cell);
    else if (f.kind === 'int' || f.kind === 'dec') a[f.key] = String(cell);
    else if (f.kind === 'multi') {
      // One "specify" text per field: a second specified item (e.g. two malignancies, S05) is kept as written.
      a[f.key] = splitMulti(cell).map(x => {
        if (f.specify && x.startsWith(f.specify) && !has(a, part(f.key, 'spec'))) { a[part(f.key, 'spec')] = x.slice(f.specify.length).replace(/^[:\s]+/, ''); return f.specify; }
        return x;
      });
    } else {
      let v = String(cell);
      // S04 and S05 write "Not Clear"; the rules read the documented value.
      if (f.key === COL.cervical && v === 'Not Clear') v = 'Not Clear (refer for cervical spine assessment)';
      if (f.specify && v.startsWith(f.specify) && v !== f.specify) { a[part(f.key, 'spec')] = v.slice(f.specify.length).replace(/^[:\s-]+/, ''); v = f.specify; }
      a[f.key] = v;
    }
    if (f.kind !== 'derived') raw[f.key] = { w, cell, sig: sharedSig(f, a) };
  }
  for (const q of Object.values(QUESTIONS)) {
    if (q.ui || q.kind === 'derivedFrom' || !q.cols) continue;
    const hit = q.cols.find(([cw, col]) => cw === w && row[col] !== undefined && row[col] !== null && row[col] !== '');
    if (!hit) continue;
    const cell = row[hit[1]];
    const wk = q.kind === 'week' && /^Week\s*([\d.]+)\s*\((Phase \d)\)$/.exec(String(cell));
    if (wk) { a[q.key] = wk[1]; a[part(q.key, 'phase')] = wk[2]; }
    else if (q.describe && /^Present - /.test(String(cell))) { a[q.key] = 'Present'; a[part(q.key, 'desc')] = String(cell).slice('Present - '.length); }
    else {
      const v = parseQuestionCell(q, cell);
      if (v === null || v === undefined || (typeof v === 'number' && Number.isNaN(v))) continue;
      a[q.key] = typeof v === 'number' ? String(v) : v;
    }
    raw[q.key] = { w, col: hit[1], cell, sig: questionSig(q, a) };
  }
  const assumed = [];
  if (IMG_OF[w]) {
    // S08 and S09 store their X-ray classification. S10 stores Ideberg for glenoid fractures only, so a scapular
    // body or neck fracture is read from the Diagnosis and marked as assumed.
    if (w !== 'S10') a[IMAGING] = IMG_OF[w];
    else {
      a[IMAGING] = /fracture|dissociation/i.test(String(row.Diagnosis || '')) ? IMG_OF.S10 : 'No fracture on imaging';
      assumed.push(IMAGING);
    }
  }
  for (const q of Object.values(QUESTIONS)) {
    if (q.kind === 'derivedFrom' || has(a, q.key) || q.normal === undefined) continue;
    if (q.when && !q.when(a)) continue;
    a[q.key] = q.normal;
    assumed.push(q.key);
  }
  const rf = row[COL.redFlags];
  if (rf !== undefined && rf !== null && rf !== '') raw[COL.redFlags] = { w, cell: rf, sig: redFlagsSig(a, evaluate(a)) };
  return { answers: a, assumed, raw };
}

export { NA, FULL_ROM };
