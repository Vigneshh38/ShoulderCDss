// Intake router rules: Set A validation, the red-flag check, and Set B routing.
// Pure functions with no React or DOM, so the same rules can run on a server.
//
// "raw" form state is a flat map: field key -> value, plus "<key>::<part>" for composite parts
// (e.g. "Previous Shoulder Surgery - Any (Y/N, procedure/date if known)::text").
//
// "answers" holds the red-flag and Set B choices:
//   rf:        { 'SH-RF-01': 'Yes' | 'No', ... }
//   rfPick:    { 'SH-RF-07': 'S08' }      wrapper for a red flag that has more than one
//   rfPrimary: 'S07'                      primary wrapper when red flags point to different wrappers
//   b:         { B1: 'Yes' | 'No', ... }
//   bPick:     { B1: 'S08', B10: 'S01' }  wrapper chosen inside a branch
import { SET_A as S } from './setA.js';
import { RED_FLAGS } from './redFlags.js';
import { BRANCHES } from './setB.js';
import { WRAPPERS, CROSS_REFS } from './wrappers.js';

export const SURGERY_KEY = 'Previous Shoulder Surgery - Any (Y/N, procedure/date if known)';
const DOMINANT_KEY = 'Dominant Arm (Right/Left/Ambidextrous)';
const AFFECTED_KEY = 'Affected Side Is Dominant (Y/N)';
const CERVICAL_KEY = 'Cervical Spine Screen (Clear/Not Clear - referred-pain differential)';
const branchById = Object.fromEntries(BRANCHES.map(b => [b.id, b]));

// ---------- raw state helpers ----------
export const part = (raw, key, p) => raw[p ? key + '::' + p : key];
export const blank = v => v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);
export const emptyAnswers = () => ({ rf: {}, rfPick: {}, rfPrimary: '', b: {}, bPick: {} });

export function derivedDominant(raw) {
  const lat = raw['Laterality'];
  const dom = raw[DOMINANT_KEY];
  if (!lat || !dom) return { value: '', editable: false };
  if (lat === 'Bilateral' || dom === 'Ambidextrous') return { value: raw[AFFECTED_KEY] || '', editable: true };
  return { value: lat === dom ? 'Yes' : 'No', editable: false };
}

// ---------- Set A validation ----------
function checkNumber(f, v, errs) {
  const s = String(v).trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) { errs.push('Must be a number.'); return null; }
  const n = Number(s);
  if (f.type === 'int' && !Number.isInteger(n)) errs.push('Must be a whole number.');
  const dec = (s.split('.')[1] || '').length;
  if (f.decimals !== undefined && dec > f.decimals) errs.push(`At most ${f.decimals} decimal place${f.decimals === 1 ? '' : 's'}.`);
  if (n < f.min || n > f.max) errs.push(`Out of range: valid ${f.min}-${f.max}. Rejected, not clamped.`);
  return n;
}

export function validateSetA(raw, opts = {}) {
  const errors = {}, warnings = {}, info = {};
  const add = (bag, k, m) => (bag[k] = bag[k] || []).push(m);
  const num = k => (blank(raw[k]) ? null : Number(raw[k]));

  for (const f of S.FIELDS) {
    const k = f.key, v = raw[k], errs = [];
    switch (f.type) {
      case 'int': case 'dec':
        if (blank(v)) { if (f.required) errs.push('Required.'); } else checkNumber(f, v, errs);
        break;
      case 'select':
        if (blank(v)) { if (f.required) errs.push('Required.'); }
        else if (!f.options.includes(v)) errs.push('Not a permitted value.');
        else if (f.specify && v === f.specify && blank(part(raw, k, 'spec'))) errs.push('Specify the value.');
        break;
      case 'multi': {
        const vals = v || [];
        const other = f.other && !blank(part(raw, k, 'other'));
        if (f.required && !vals.length && !other) errs.push('Required.');
        if (vals.some(x => !f.options.includes(x))) errs.push('Not a permitted value.');
        if (vals.includes('None') && (vals.length > 1 || other)) errs.push('"None" cannot be combined with other values.');
        if (f.specify && vals.includes(f.specify) && blank(part(raw, k, 'spec'))) errs.push('Specify the value.');
        break;
      }
      case 'bool':
        if (blank(v)) { if (f.required) errs.push('Required.'); } else if (!['Yes', 'No'].includes(v)) errs.push('Must be Yes or No.');
        break;
      case 'ynText':
        if (blank(v)) { if (f.required) errs.push('Required.'); }
        else if (!['Yes', 'No'].includes(v)) errs.push('Must be Yes or No.');
        else if (v === 'Yes' && blank(part(raw, k, 'text'))) add(warnings, k, 'Record the procedure and approximate date if known.');
        break;
      case 'derived': {
        const d = derivedDominant(raw);
        if (d.editable && blank(v)) errs.push('Required for Bilateral / Ambidextrous.');
        else if (d.editable && !['Yes', 'No'].includes(v)) errs.push('Must be Yes or No.');
        break;
      }
      case 'system':
        break;
      default:
        if (f.required && blank(v)) errs.push('Required.');
    }
    errs.forEach(m => add(errors, k, m));
  }

  // Case ID is system-assigned (passed in by the host); only uniqueness is checked, when one is supplied.
  const cid = opts.caseId;
  if (!blank(cid) && (opts.existingCaseIds || []).includes(String(cid).trim())) add(errors, 'Case ID', 'Case ID already exists in the workbook.');

  const bmi = num('BMI');
  if (bmi !== null && bmi >= 10 && bmi <= 60 && (bmi < 12 || bmi > 45)) add(warnings, 'BMI', 'Outside 12-45: please re-confirm.');
  if (num('Age') === 0) add(info, 'Age', 'Age 0 means a newborn / birth-related problem (S17, or S09 for a birth-related collarbone fracture).');

  const med = raw['Medication History'] || '';
  if (/anticoag|antiplatelet|warfarin|apixaban|rivaroxaban|dabigatran|heparin|clopidogrel|aspirin/i.test(med)) add(info, 'Medication History', 'Blood thinner (anticoagulant/antiplatelet) flagged.');
  if (/cortico|steroid|prednis|dexameth|hydrocortis/i.test(med)) add(info, 'Medication History', 'Corticosteroid flagged.');
  if (/overhead|electrician|painter|construction|swim|throw|tennis|volley|warehouse/i.test(raw['Occupation'] || '')) add(info, 'Occupation', 'Overhead-demand occupation flagged.');
  if (raw['Night Pain (Y/N)'] === 'Yes') add(info, 'Night Pain (Y/N)', 'If severe and does not ease, think about red flags for tumour or infection (SH-RF-02, SH-RF-05).');
  if ((raw[CERVICAL_KEY] || '').startsWith('Not Clear')) add(info, CERVICAL_KEY, 'Refer for a neck assessment. The shoulder pathway carries on in parallel.');

  const count = b => Object.values(b).reduce((a, x) => a + x.length, 0);
  return { ok: count(errors) === 0, errors, warnings, info, errorCount: count(errors), warningCount: count(warnings) };
}

// ---------- red flags ----------
export function checkRedFlags(answers) {
  const unanswered = RED_FLAGS.filter(r => !['Yes', 'No'].includes(answers.rf[r.id])).map(r => r.id);
  const positive = RED_FLAGS.filter(r => answers.rf[r.id] === 'Yes');
  const needPick = positive.filter(r => r.wrappers.length > 1 && !r.wrappers.includes(answers.rfPick[r.id])).map(r => r.id);
  const wrappers = [...new Set(positive.flatMap(r => (r.wrappers.length > 1 ? (r.wrappers.includes(answers.rfPick[r.id]) ? [answers.rfPick[r.id]] : []) : r.wrappers)))];
  const needPrimary = !needPick.length && wrappers.length > 1 && !wrappers.includes(answers.rfPrimary);
  const done = !unanswered.length && !needPick.length && !needPrimary;
  const wrapper = !done || !positive.length ? '' : wrappers.length === 1 ? wrappers[0] : answers.rfPrimary;
  return { unanswered, positive: positive.map(r => r.id), needPick, wrappers, needPrimary, done, wrapper };
}

// ---------- Set B ----------
// Walks the branches in order. Stops at the first Yes, at a missing answer, or at a conflict with Set A.
export function walkSetB(raw, answers) {
  const steps = [];
  const surgery = raw[SURGERY_KEY];
  for (const br of BRANCHES) {
    if (br.fallback) return { steps, current: '', conflict: '', wrapper: 'S18', branch: 'B11' };
    const ans = br.pickOnly ? 'Yes' : answers.b[br.id];
    if (!br.pickOnly && !['Yes', 'No'].includes(ans)) return { steps, current: br.id, conflict: '', wrapper: '', branch: '' };
    if (ans === 'Yes' && br.needsSurgery && surgery === 'No')
      return { steps, current: br.id, conflict: 'Set A says "Previous Shoulder Surgery: No". Fix Set A or answer No here.', wrapper: '', branch: '' };
    if (ans === 'No') { steps.push({ branch: br.id, answer: 'No' }); continue; }
    if (br.pick) {
      const pick = answers.bPick[br.id];
      const opt = br.pick.options.find(o => o.wrapper === pick);
      if (!opt) return { steps, current: br.id, conflict: '', wrapper: '', branch: '', needPick: true };
      steps.push({ branch: br.id, answer: br.pickOnly ? opt.label : 'Yes', pick: opt.label });
      if (pick === 'S18') return { steps, current: '', conflict: '', wrapper: 'S18', branch: 'B11' };
      return { steps, current: '', conflict: '', wrapper: pick, branch: br.id };
    }
    steps.push({ branch: br.id, answer: 'Yes' });
    return { steps, current: '', conflict: '', wrapper: br.wrappers[0], branch: br.id };
  }
  return { steps, current: '', conflict: '', wrapper: '', branch: '' };
}

// Answers recorded after `branchId` are cleared whenever an earlier answer changes,
// so a stale "Yes" further down can never decide the route.
export function clearAfter(answers, branchId) {
  const i = BRANCHES.findIndex(b => b.id === branchId);
  const keep = new Set(BRANCHES.slice(0, i + 1).map(b => b.id));
  const filter = o => Object.fromEntries(Object.entries(o).filter(([k]) => keep.has(k)));
  return { ...answers, b: filter(answers.b), bPick: filter(answers.bPick) };
}

// ---------- whole flow ----------
// stage: 'setA' -> 'redflags' -> 'setB' -> 'done'
export function evaluate(raw, answers, opts = {}) {
  const setA = validateSetA(raw, opts);
  const rf = checkRedFlags(answers);
  const out = { setA, rf, setB: null, stage: 'setA', route: null };
  if (!setA.ok) return out;
  if (!rf.done) return { ...out, stage: 'redflags' };
  if (rf.positive.length) {
    return { ...out, stage: 'done', route: makeRoute({ via: 'redflag', wrapper: rf.wrapper, branch: '', flags: rf.positive, steps: [] }) };
  }
  const setB = walkSetB(raw, answers);
  if (!setB.wrapper) return { ...out, setB, stage: 'setB' };
  return { ...out, setB, stage: 'done', route: makeRoute({ via: 'setB', wrapper: setB.wrapper, branch: setB.branch, flags: [], steps: setB.steps }) };
}

function makeRoute({ via, wrapper, branch, flags, steps }) {
  const w = WRAPPERS[wrapper];
  return {
    via, wrapper, wrapperName: w.name, halt: w.halt || '',
    branch, branchTitle: branch ? branchById[branch].title : '',
    redFlags: flags,
    path: steps.map(s => ({ ...s, title: branchById[s.branch].title })),
    alsoCheck: CROSS_REFS[wrapper] || [],
  };
}

// ---------- serialize / parse (MRL cell format, matching the Golden Datasets) ----------
export function serialize(raw, caseId = '') {
  const out = {};
  for (const f of S.FIELDS) {
    const k = f.key, v = raw[k];
    let cell = '';
    switch (f.type) {
      case 'int': case 'dec': cell = blank(v) ? '' : Number(v); break;
      case 'select': cell = v || ''; if (f.specify && v === f.specify && !blank(part(raw, k, 'spec'))) cell = `${v}: ${part(raw, k, 'spec').trim()}`; break;
      case 'multi': {
        const items = (v || []).map(x => (x === f.specify && !blank(part(raw, k, 'spec')) ? `${x.replace(' (specify)', '')} (${part(raw, k, 'spec').trim()})` : x));
        if (f.other && !blank(part(raw, k, 'other'))) items.push(part(raw, k, 'other').trim());
        cell = items.join(', ');
        break;
      }
      case 'ynText': cell = v === 'Yes' ? (blank(part(raw, k, 'text')) ? 'Yes' : `Yes - ${part(raw, k, 'text').trim()}`) : v || ''; break;
      case 'derived': cell = derivedDominant(raw).value; break;
      case 'system': cell = k === 'Case ID' ? caseId || '' : ''; break;
      default: cell = blank(v) ? '' : String(v).trim();
    }
    out[k] = cell;
  }
  return out;
}

function splitList(text) {
  const out = [];
  let depth = 0, cur = '';
  for (const ch of String(text)) {
    if (ch === '(') depth++;
    if (ch === ')') depth = Math.max(0, depth - 1);
    if ((ch === ',' || ch === ';') && depth === 0) { if (cur.trim()) out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export function parse(record) {
  const raw = {};
  for (const f of S.FIELDS) {
    const k = f.key, c = record[k] === undefined || record[k] === null ? '' : String(record[k]);
    let m;
    switch (f.type) {
      case 'select':
        if (f.specify && c.startsWith(f.specify + ':')) { raw[k] = f.specify; raw[k + '::spec'] = c.slice(f.specify.length + 1).trim(); }
        else raw[k] = c;
        break;
      case 'multi': {
        // Items are split on commas/semicolons outside brackets, e.g. "Anxiety (self-reported, non-diagnostic)" stays whole.
        const vals = [], rest = [];
        for (const x of splitList(c)) {
          if (f.specify && x.startsWith(f.specify.replace(' (specify)', ''))) { vals.push(f.specify); raw[k + '::spec'] = x.replace(/^[^(]*\(?|\)$/g, '').trim(); }
          else if (f.options.includes(x)) vals.push(x);
          else rest.push(x);
        }
        raw[k] = vals;
        if (f.other) raw[k + '::other'] = rest.join(', ');
        else vals.push(...rest); // kept so validation reports it as not permitted
        break;
      }
      case 'ynText': raw[k] = c.startsWith('Yes') ? 'Yes' : c; if ((m = c.match(/^Yes - (.*)$/))) raw[k + '::text'] = m[1]; break;
      case 'derived': case 'system': break;
      default: raw[k] = c;
    }
  }
  // A stored "Affected Side Is Dominant" is kept only where it can't be derived (Bilateral / Ambidextrous).
  const stored = record[AFFECTED_KEY];
  if (derivedDominant(raw).editable && (stored === 'Yes' || stored === 'No')) raw[AFFECTED_KEY] = stored;
  return raw;
}
