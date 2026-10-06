// S01 field rules: Layer 1 validation, cross-field checks, and conversion between form state
// and Medical Record Library cells. Pure functions with no React or DOM, so the same rules can run on a server.
//
// "raw" form state is a flat map: field key -> value, plus "<key>::<part>" for composite parts
// (e.g. "Muscle Strength (MMT) - ER/IR/Abduction::ER").
import { SCHEMA as S } from './schema.js';
import { PROTOCOLS as P } from './protocols.js';

const byKey = Object.fromEntries(S.FIELDS.map(f => [f.key, f]));
const PHASE_N = p => (p ? Number(String(p).replace(/\D/g, '')) : NaN);

// ---------- raw state helpers ----------
// Raw state is a flat map: field key -> value, plus "<key>::<part>" for composite parts.
export const part = (raw, key, p) => raw[p ? key + '::' + p : key];
export const blank = v => v === undefined || v === null || (typeof v === 'string' && v.trim() === '') || (Array.isArray(v) && v.length === 0);

export function derivedDominant(raw) {
  const lat = raw['Laterality'];
  const dom = raw['Dominant Arm (Right/Left/Ambidextrous)'];
  if (!lat || !dom) return { value: '', editable: false };
  if (lat === 'Bilateral' || dom === 'Ambidextrous') return { value: raw['Affected Side Is Dominant (Y/N)'] || '', editable: true };
  return { value: lat === dom ? 'Yes' : 'No', editable: false };
}

// ---------- validation ----------
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

export function validate(raw, opts = {}) {
  const errors = {}, warnings = {}, info = {};
  const add = (bag, k, m) => (bag[k] = bag[k] || []).push(m);
  const num = k => (blank(raw[k]) ? null : Number(raw[k]));
  const isS18 = raw['Diagnosis'] === S.S18;

  for (const f of S.FIELDS) {
    const k = f.key, v = raw[k], errs = [];
    switch (f.type) {
      case 'int': case 'dec': case 'weeks':
        if (blank(v)) { if (f.required) errs.push('Required.'); } else checkNumber(f, v, errs);
        break;
      case 'select':
        if (blank(v)) { if (f.required && !(isS18 && k === 'Treatment Plan Mapping (Protocol ID)')) errs.push('Required.'); }
        else if (!f.options.includes(v)) errs.push('Not a permitted value.');
        else if (f.specify && v === f.specify && blank(part(raw, k, 'spec'))) errs.push('Specify the value.');
        break;
      case 'multi': {
        const vals = v || [];
        if (f.required && !vals.length) errs.push('Required.');
        if (vals.includes('None') && vals.length > 1) errs.push('"None" cannot be combined with other values.');
        if (f.specify && vals.includes(f.specify) && blank(part(raw, k, 'spec'))) errs.push('Specify the value.');
        break;
      }
      case 'bool':
        if (blank(v)) { if (f.required) errs.push('Required.'); } else if (!['Yes', 'No'].includes(v)) errs.push('Must be Yes or No.');
        break;
      case 'ynText':
        if (blank(v)) { if (f.required) errs.push('Required.'); }
        else if (v === 'Yes' && blank(part(raw, k, 'text'))) add(warnings, k, 'Record the procedure and approximate date if known.');
        break;
      case 'ynDate':
        if (blank(v)) { if (f.required) errs.push('Required.'); }
        else if (v === 'Yes' && blank(part(raw, k, 'date'))) add(warnings, k, 'Record the approximate date.');
        break;
      case 'mmt':
        for (const p of ['ER', 'IR', 'Abd']) {
          const pv = part(raw, k, p);
          if (blank(pv)) { if (f.required) errs.push(`${p} required.`); continue; }
          const e = []; checkNumber({ type: 'int', min: 0, max: 5 }, pv, e);
          e.forEach(m => errs.push(`${p}: ${m}`));
        }
        break;
      case 'mri': {
        const t = part(raw, k, 'tear'), g = part(raw, k, 'gout');
        if (f.required && (blank(t) || blank(g))) errs.push('Both tear grade and Goutallier grade are required.');
        break;
      }
      case 'usSize':
        if (part(raw, k, 'na')) break;
        if (blank(v)) { if (f.required) errs.push('Required.'); } else checkNumber(f, v, errs);
        break;
      case 'derived': {
        const d = derivedDominant(raw);
        if (d.editable && blank(v)) errs.push('Required for Bilateral / Ambidextrous.');
        break;
      }
      case 'protocol': {
        if (isS18) break;
        if (blank(v)) { if (f.required) errs.push('Required.'); break; }
        const p = P.find(x => x.id === v);
        if (!p) { errs.push('No such Protocol ID in the Protocol sheet.'); break; }
        if (raw['Diagnosis'] && p.dx !== raw['Diagnosis']) errs.push(`Protocol is for "${p.dx}", not the entered Diagnosis.`);
        if (raw['Rehabilitation Phase'] && p.phase !== raw['Rehabilitation Phase']) errs.push(`Protocol is for ${p.phase}, not ${raw['Rehabilitation Phase']}.`);
        break;
      }
      default:
        if (f.required && blank(v)) errs.push('Required.');
    }
    errs.forEach(m => add(errors, k, m));
  }

  // ---- cross-field rules ----
  // Case ID is system-assigned (passed in by the host); only uniqueness is checked, when one is supplied.
  const cid = opts.caseId;
  if (!blank(cid) && (opts.existingCaseIds || []).includes(String(cid).trim())) add(errors, 'Case ID', 'Case ID already exists in the workbook.');

  const bmi = num('BMI');
  if (bmi !== null && bmi >= 10 && bmi <= 60 && (bmi < 12 || bmi > 45)) add(warnings, 'BMI', 'Outside 12-45: please re-confirm.');

  const cond = S.CONDITIONS.find(c => c.name === raw['Diagnosis']);
  const age = num('Age');
  if (cond && age !== null && (age < cond.age[0] || age > cond.age[1]))
    add(warnings, 'Age', `Outside the typical age band for ${cond.name} (${cond.age[0]}-${cond.age[1]} yrs).`);
  if (isS18) add(info, 'Diagnosis', 'Case will be routed to S18 workflow review. No S01 protocol applies.');

  const cerv = raw['Cervical Spine Screen (Clear/Not Clear - referred-pain differential)'];
  const rf = raw['Red Flags / Precautions'] || '';
  if (cerv && cerv.startsWith('Not Clear') && !/cervical/i.test(rf))
    add(errors, 'Red Flags / Precautions', 'Cervical screen is Not Clear: document the cervical referral here before Diagnosis is locked.');

  const onset = raw['Onset'], wk = num('Time Since Onset');
  if (onset && wk !== null) {
    const bad = (onset.startsWith('Acute') && wk >= 2) || (onset.startsWith('Subacute') && (wk < 2 || wk > 12)) || (onset.startsWith('Chronic') && wk <= 12);
    if (bad) add(warnings, 'Time Since Onset', `${wk} weeks is inconsistent with Onset "${onset}".`);
  }

  // imaging concordance
  const tear = part(raw, byKey['MRI_Rotator Cuff Tear Grade (partial/full-thickness) / Goutallier Fatty Infiltration Grade'].key, 'tear');
  const usKey = 'Ultrasound_Tendon Tear Size';
  if (tear) {
    const usNA = part(raw, usKey, 'na');
    if (tear === 'None' && !usNA && !blank(raw[usKey])) add(warnings, usKey, 'MRI shows no tear but a tear size is entered.');
    if (tear !== 'None' && usNA) add(warnings, usKey, 'MRI shows a tear but ultrasound is marked not applicable.');
    const dx = raw['Diagnosis'] || '';
    const mriKey = 'MRI_Rotator Cuff Tear Grade (partial/full-thickness) / Goutallier Fatty Infiltration Grade';
    if (dx === 'Partial-thickness rotator cuff tear' && tear !== 'Partial-thickness') add(warnings, mriKey, 'Diagnosis expects an MRI partial-thickness tear.');
    if (/^Full-thickness|arthropathy|Subscapularis tear/.test(dx) && !tear.startsWith('Full-thickness')) add(warnings, mriKey, 'Diagnosis expects an MRI full-thickness tear.');
    if (/tendinopathy|subluxation/.test(dx) && tear !== 'None') add(warnings, mriKey, 'Diagnosis is non-tear but MRI shows a tear.');
  }
  const ahd = num('Acromiohumeral Distance (Ultrasound/X-Ray, mm)');
  if (ahd !== null && ahd < 7) add(info, 'Acromiohumeral Distance (Ultrasound/X-Ray, mm)', '<7 mm suggests rotator cuff tear / tear arthropathy.');

  const med = raw['Medication History'] || '';
  if (/anticoag|antiplatelet|warfarin|apixaban|rivaroxaban|dabigatran|heparin|clopidogrel|aspirin/i.test(med)) add(info, 'Medication History', 'Anticoagulant/antiplatelet flagged.');
  if (/cortico|steroid|prednis|dexameth|hydrocortis/i.test(med)) add(info, 'Medication History', 'Corticosteroid flagged.');
  if (/overhead|electrician|painter|construction|swim|throw|tennis|volley|warehouse/i.test(raw['Occupation'] || '')) add(info, 'Occupation', 'Overhead-demand occupation flagged.');
  if (raw['Night Pain (Y/N)'] === 'Yes') add(info, 'Night Pain (Y/N)', 'Hallmark of cuff pathology; if severe and unremitting, screen for oncological/infective red flags.');

  // follow-up: regression is flagged, not blocked, unless a note explains it
  const note = (raw['Progress / Follow-up Tracking'] || '') + (raw['Notes'] || '');
  const reg = (k, m) => { if (!note.trim()) add(warnings, k, m + ' Add a note in Progress / Notes or confirm.'); };
  const abd0 = num('Shoulder Abduction ROM (active/passive)'), abd1 = num('Follow_Up_Shoulder Abduction ROM');
  if (abd0 !== null && abd1 !== null && abd1 < abd0) reg('Follow_Up_Shoulder Abduction ROM', `Regressed from ${abd0} to ${abd1} deg.`);
  const ases0 = num('ASES Score'), ases1 = num('Follow_Up_ASES');
  if (ases0 !== null && ases1 !== null && ases1 < ases0) reg('Follow_Up_ASES', `Regressed from ${ases0} to ${ases1}.`);
  const mAbd = part(raw, 'Muscle Strength (MMT) - ER/IR/Abduction', 'Abd'), st1 = num('Follow_Up_Empty Can/Full Can Strength');
  if (!blank(mAbd) && st1 !== null && st1 < Number(mAbd)) reg('Follow_Up_Empty Can/Full Can Strength', `Below baseline abduction MMT (${mAbd}).`);
  const arc0 = S.ARC.indexOf(raw['Painful Arc (60-120 deg)']), arc1 = S.ARC.indexOf(raw['Follow_Up_Painful Arc']);
  if (arc0 === 0 && arc1 > 0) reg('Follow_Up_Painful Arc', 'Painful arc absent at baseline but present now.');

  // Phases may not be skipped unless a clinical reason is documented in Notes.
  if (opts.previousPhase && raw['Rehabilitation Phase'] && PHASE_N(raw['Rehabilitation Phase']) - PHASE_N(opts.previousPhase) > 1)
    add(blank(raw['Notes']) ? errors : warnings, 'Rehabilitation Phase', `Skips from ${opts.previousPhase}. ${blank(raw['Notes']) ? 'Document the clinical reason in Notes to override.' : 'Override reason taken from Notes.'}`);

  const count = b => Object.values(b).reduce((a, x) => a + x.length, 0);
  return { ok: count(errors) === 0, errors, warnings, info, errorCount: count(errors), warningCount: count(warnings) };
}

// ---------- serialize / parse (MRL cell format, matching the Golden Dataset) ----------
export function serialize(raw, caseId = '') {
  const out = {};
  for (const f of S.FIELDS) {
    const k = f.key, v = raw[k];
    let cell = '';
    switch (f.type) {
      case 'int': case 'dec': cell = blank(v) ? '' : Number(v); break;
      case 'weeks': cell = blank(v) ? '' : `${Number(v)} weeks`; break;
      case 'select': cell = v || ''; if (f.specify && v === f.specify && !blank(part(raw, k, 'spec'))) cell = `${v}: ${part(raw, k, 'spec').trim()}`; break;
      case 'multi': cell = (v || []).map(x => (x === f.specify && !blank(part(raw, k, 'spec')) ? `${x.replace(' (specify)', '')} (${part(raw, k, 'spec').trim()})` : x)).join(', '); break;
      case 'ynText': cell = v === 'Yes' ? (blank(part(raw, k, 'text')) ? 'Yes' : `Yes - ${part(raw, k, 'text').trim()}`) : v || ''; break;
      case 'ynDate': cell = v === 'Yes' ? (blank(part(raw, k, 'date')) ? 'Yes' : `Yes - ${part(raw, k, 'date')}`) : v || ''; break;
      case 'mmt': cell = ['ER', 'IR', 'Abd'].some(p => blank(part(raw, k, p))) ? '' : `ER:${part(raw, k, 'ER')}/IR:${part(raw, k, 'IR')}/Abd:${part(raw, k, 'Abd')}`; break;
      case 'mri': cell = blank(part(raw, k, 'tear')) || blank(part(raw, k, 'gout')) ? '' : `Tear: ${part(raw, k, 'tear')}; Goutallier: ${part(raw, k, 'gout')}`; break;
      case 'usSize': cell = part(raw, k, 'na') ? S.US_NA : blank(v) ? '' : `${Number(v)} mm`; break;
      case 'derived': cell = derivedDominant(raw).value; break;
      case 'system': cell = k === 'Case ID' ? caseId || '' : ''; break;
      default: cell = blank(v) ? '' : String(v).trim();
    }
    out[k] = cell;
  }
  return out;
}

export function parse(record) {
  const raw = {};
  for (const f of S.FIELDS) {
    const k = f.key, c = record[k] === undefined || record[k] === null ? '' : String(record[k]);
    let m;
    switch (f.type) {
      case 'weeks': raw[k] = c.replace(/\s*weeks?/, ''); break;
      case 'select':
        if (f.specify && c.startsWith(f.specify + ':')) { raw[k] = f.specify; raw[k + '::spec'] = c.slice(f.specify.length + 1).trim(); }
        else raw[k] = c;
        break;
      case 'multi': raw[k] = c ? c.split(/,\s*/).map(x => (x.startsWith('Malignancy') ? (raw[k + '::spec'] = x.replace(/^Malignancy\s*\(?|\)$/g, ''), 'Malignancy (specify)') : x)) : []; break;
      case 'ynText': raw[k] = c.startsWith('Yes') ? 'Yes' : c; if ((m = c.match(/^Yes - (.*)$/))) raw[k + '::text'] = m[1]; break;
      case 'ynDate': raw[k] = c.startsWith('Yes') ? 'Yes' : c; if ((m = c.match(/^Yes - (.*)$/))) raw[k + '::date'] = m[1]; break;
      case 'mmt': if ((m = c.match(/ER:(\d)\/IR:(\d)\/Abd:(\d)/))) { raw[k + '::ER'] = m[1]; raw[k + '::IR'] = m[2]; raw[k + '::Abd'] = m[3]; } break;
      case 'mri': if ((m = c.match(/Tear: (.*); Goutallier: (Grade \d)/))) { raw[k + '::tear'] = m[1]; raw[k + '::gout'] = m[2]; } break;
      case 'usSize': if (c.startsWith('Not applicable')) raw[k + '::na'] = true; else raw[k] = c.replace(/\s*mm/, ''); break;
      case 'system': break;
      default: raw[k] = c;
    }
  }
  return raw;
}
