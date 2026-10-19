// Shoulder CDSS routing: everything asked before a wrapper is opened, and the rules that read it.
//
// Sources:
//   - Branch order: Shoulder_CDSS_Workflow_and_Navigation_Guide.docx, Step 2 (first match wins).
//   - Branch membership: the same guide's "presenting picture -> group" table (section 3).
//   - Red flags SH-RF-01..09: section 10 of the 18 Field Rule Logic Documents (ID, description, urgency, wrapper).
//   - Every question is a real Medical Record Library column, with the cell wording of that wrapper's Golden Dataset.
//
// The routing map that should hold the exact branch questions (Shoulder_CDSS_Wrapper_Routing_Map.xlsx) was never
// provided, so every rule below marked `draft: true` is our reconstruction and needs clinical sign-off.
// Pure JS: no React, no DOM, so a server can run the same rules.
import { WRAPPERS, VOCAB } from './routingData.generated.js';
import { NA, has, is, num, SOFT, parseRom3, capsularPattern, girthDiff, ROM_NORM, parseMmt3, parseMri, parseUsSize } from './values.js';

// ---------- the six stops ----------
export const LINES = {
  intake: { name: 'Intake line', c: '--red' },
  safety: { name: 'Safety line', c: '--crimson' },
  route: { name: 'Routing line', c: '--yellow' },
  decide: { name: 'Decision line', c: '--green' },
};
export const STOPS = [
  { id: 'patient', name: 'Patient', line: 'intake', shape: 'circle' },
  { id: 'history', name: 'History', line: 'intake', shape: 'square' },
  { id: 'flags', name: 'Red flags', line: 'safety', shape: 'cross' },
  { id: 'walk', name: 'Branch walk', line: 'route', shape: 'star' },
  { id: 'nodes', name: 'Node walk', line: 'route', shape: 'diamond' },
  { id: 'result', name: 'Wrapper', line: 'decide', shape: 'gem' },
];

// ---------- shared columns (identical header and valid values in all 18 workbooks) ----------
export const COL = {
  dom: 'Dominant Arm (Right/Left/Ambidextrous)',
  affDom: 'Affected Side Is Dominant (Y/N)',
  surgery: 'Previous Shoulder Surgery - Any (Y/N, procedure/date if known)',
  episodes: 'Previous Episode(s) of Same Complaint (Y/N)',
  treatment: 'Previous Treatment Received (physiotherapy/injection/surgery/none)',
  night: 'Night Pain (Y/N)',
  sleep: 'Sleep Disturbance Due to Pain (Y/N)',
  cervical: 'Cervical Spine Screen (Clear/Not Clear - referred-pain differential)',
  redFlags: 'Red Flags / Precautions',
};
const COMORB = ['None', 'Diabetes Mellitus', 'Thyroid Disease', 'Rheumatoid/Inflammatory Arthritis', 'Cardiac Disease', 'Renal Disease', 'Osteoporosis', 'Malignancy (specify)'];
const CERVICAL_NOT_CLEAR = 'Not Clear (refer for cervical spine assessment)';

// Where one workbook words a shared column differently from Layer 1, the row written for that workbook uses its
// wording (checked against the data by scripts/check_cells.mjs). Separators, the "Other (specify)" style, the
// "Not Clear" wording and the red-flag phrasing are measured from each workbook (DIALECT, routingData.generated.js).
export const VALUE_MAP = {
  S13: { Pain_Location: { Diffuse: 'Deep/diffuse shoulder' } }, // S13: 8,785 rows "Deep/diffuse shoulder", never "Diffuse"
};
// Shared columns a workbook fills from one of its own columns: S11's Onset is always its own onset value.
export const SHARED_FROM = { S11: { Onset: 'S11|Onset (insidious; often overhead athlete)' } };

export const CORE_FIELDS = [
  // One decimal: S17 records infants in fractional years (e.g. 0.5, 2.5).
  { key: 'Age', kind: 'dec', min: 0, max: 120, decimals: 1, unit: 'years', reads: ['B9', 'SH-RF-09'] },
  { key: 'Gender', kind: 'seg', options: ['Male', 'Female', 'Other', 'Prefer not to say'] },
  { key: 'BMI', kind: 'dec', min: 10, max: 60, decimals: 1, unit: 'kg/m²' },
  // Layer 1's recommended vocabulary first, then every other term the 18 workbooks write in this column.
  { key: 'Co-morbidities', kind: 'multi', options: COMORB, more: (VOCAB['Co-morbidities'] || []).map(x => x[0]).filter(x => !COMORB.includes(x)), specify: 'Malignancy (specify)', reads: ['SH-RF-05'] },
  { key: 'Medication History', kind: 'text', placeholder: 'Flag anticoagulants/antiplatelets and corticosteroids', suggestions: VOCAB.suggestions?.['Medication History'] },
  { key: 'Occupation', kind: 'text', placeholder: 'Overhead-demand jobs matter for S01, S03, S11, S14', suggestions: VOCAB.suggestions?.Occupation },
  { key: 'Activity Level', kind: 'seg', options: ['Sedentary', 'Light', 'Moderate', 'Vigorous', 'Competitive Athlete'] },
  { key: 'Laterality', kind: 'seg', options: ['Left', 'Right', 'Bilateral'] },
  { key: 'Pain_Location', label: 'Pain location', kind: 'seg', options: ['Anterior', 'Posterior', 'Lateral (deltoid region)', 'Superior (AC/SC)', 'Diffuse', 'Radiating below elbow', 'Other (specify)'], specify: 'Other (specify)', reads: ['B7', 'B8'] },
  { key: 'Pain_Nature', label: 'Pain nature', kind: 'seg', options: ['Sharp', 'Dull ache', 'Burning', 'Throbbing', 'Catching', 'Electric-shock-like', 'Mixed'] },
  { key: 'Pain_Intensity', label: 'Pain intensity (NRS)', kind: 'int', min: 0, max: 10, unit: '/ 10' },
  { key: 'Onset', kind: 'seg', options: ['Acute (<2 weeks)', 'Subacute (2-12 weeks)', 'Chronic (>12 weeks)', 'Insidious', 'Congenital-Developmental'], reads: ['B5', 'B9'] },
];

// Previous surgery: the shared Y/N + free-text cell, asked in parts so the surgery screens can read it.
// Every procedure text that occurs in the 18 Golden Datasets' cells, spelled exactly as there (case included).
//   from   the workbook(s) that write it
//   group  who owns it: 'S12' / 'S12-other' (decision point B3), 'S13' (B2), 'fracture' (B1), a wrapper that keeps
//          its own post-operative fields (S04, S05, S07, S14, S15), or 'none' (an earlier, unrelated operation)
//   s12    the S12 "Procedure Type" value it is, when it is one of S12's six
//   fmt    how that workbook writes the cell (see surgeryCell in engine.js):
//          index    "Yes - Bankart Repair (index procedure for this record)"                                 S12
//          arthro   "Yes - Shoulder Arthroplasty 0.4 years ago (index procedure for this record)"            S13
//          paren    "Yes - Arthroscopic Bankart repair (approx. 2 years ago)"                    S01-S03, S06, S07
//          comma    "Yes - Hook plate fixation, ~6 weeks ago"                                            S04, S05
//          prevside "Yes - Cervical Rib Resection (previous, other side)"                                S14, S15
//          bare     "Yes - Open Reduction Internal Fixation (ORIF)/plating for this fracture"    S08-S11, S16-S18
export const PROCEDURES = [
  { v: 'Arthroscopic RCR', from: 'S12', group: 'S12', s12: 'Arthroscopic RCR', fmt: 'index' },
  { v: 'Open RCR', from: 'S12', group: 'S12', s12: 'Open RCR', fmt: 'index' },
  { v: 'Bankart Repair', from: 'S12', group: 'S12', s12: 'Bankart Repair', fmt: 'index' },
  { v: 'Latarjet', from: 'S12', group: 'S12', s12: 'Latarjet', fmt: 'index' },
  { v: 'SLAP Repair', from: 'S12', group: 'S12', s12: 'SLAP Repair', fmt: 'index' },
  { v: 'Subacromial Decompression', from: 'S12', group: 'S12', s12: 'Subacromial Decompression', fmt: 'index' },
  { v: 'Shoulder Arthroplasty', from: 'S13', group: 'S13', fmt: 'arthro' },
  { v: 'Open Reduction Internal Fixation (ORIF)/arthroplasty for this fracture', from: 'S08', group: 'fracture', fmt: 'bare' },
  { v: 'Open Reduction Internal Fixation (ORIF)/plating for this fracture', from: 'S09, S10', group: 'fracture', fmt: 'bare' },
  { v: 'Arthroscopic subacromial decompression', from: 'S01, S03', group: 'S12', s12: 'Subacromial Decompression', fmt: 'paren' },
  { v: 'Rotator cuff repair', from: 'S01', group: 'S12-other', fmt: 'paren' },
  { v: 'Diagnostic arthroscopy', from: 'S01', group: 'S12-other', fmt: 'paren' },
  { v: 'Arthroscopic Bankart repair', from: 'S02', group: 'S12', s12: 'Bankart Repair', fmt: 'paren' },
  { v: 'Open Latarjet procedure', from: 'S02', group: 'S12', s12: 'Latarjet', fmt: 'paren' },
  { v: 'Arthroscopic SLAP repair', from: 'S02', group: 'S12', s12: 'SLAP Repair', fmt: 'paren' },
  { v: 'Arthroscopic debridement/subacromial decompression', from: 'S06', group: 'S12-other', fmt: 'paren' },
  { v: 'Open reduction/SC joint reconstruction', from: 'S07', group: 'S07', fmt: 'paren' },
  { v: 'Arthroscopic distal clavicle excision (Mumford)', from: 'S04', group: 'S04', fmt: 'comma' },
  { v: 'Open distal clavicle excision (Mumford)', from: 'S04', group: 'S04', fmt: 'comma' },
  { v: 'AC joint reconstruction (CC ligament, tendon graft)', from: 'S04', group: 'S04', fmt: 'comma' },
  { v: 'Suture-button (TightRope-type) CC stabilisation', from: 'S04', group: 'S04', fmt: 'comma' },
  { v: 'Open reduction and CC ligament reconstruction with deltotrapezial fascia repair', from: 'S04', group: 'S04', fmt: 'comma' },
  { v: 'Hook plate fixation', from: 'S04', group: 'S04', fmt: 'comma' },
  { v: 'rotator cuff repair', from: 'S04', group: 'S12-other', fmt: 'comma' },
  { v: 'shoulder stabilisation (Bankart repair)', from: 'S04', group: 'S12', s12: 'Bankart Repair', fmt: 'comma' },
  { v: 'clavicle fracture fixation (plate removed)', from: 'S04', group: 'none', fmt: 'comma' },
  { v: 'arthroscopic subacromial decompression', from: 'S04, S05', group: 'S12', s12: 'Subacromial Decompression', fmt: 'comma' },
  { v: 'arthroscopic capsular release', from: 'S05', group: 'S05', fmt: 'comma' },
  { v: 'manipulation under anaesthesia', from: 'S05', group: 'S05', fmt: 'comma' },
  { v: 'arthroscopic Bankart repair (stabilisation)', from: 'S05', group: 'S12', s12: 'Bankart Repair', fmt: 'comma' },
  { v: 'arthroscopic rotator cuff repair', from: 'S05', group: 'S12', s12: 'Arthroscopic RCR', fmt: 'comma' },
  { v: 'arthroscopic biceps tenodesis', from: 'S05', group: 'S12-other', fmt: 'comma' },
  { v: 'Cervical Rib Resection', from: 'S14', group: 'S14', fmt: 'prevside' },
  { v: 'Thoracic Outlet Decompression', from: 'S15', group: 'S15', fmt: 'prevside' },
  { v: 'prior shoulder/periscapular surgery', from: 'S11', group: 'none', fmt: 'bare' },
  { v: 'Shoulder Surgery (unrelated, previous)', from: 'S16, S18', group: 'none', fmt: 'bare' },
  { v: 'Shoulder Surgery (unrelated/prior procedure, previous)', from: 'S17', group: 'none', fmt: 'bare' },
  // S12's Procedure Type also allows "Other (specify)" (Layer 1); the typed name is written in its place.
  { v: 'Other (specify)', from: 'S12 Layer 1', group: 'S12-other', fmt: 'paren' },
];
export const PROC = Object.fromEntries(PROCEDURES.map(p => [p.v, p]));
// How the "when" part is written in each format, as a typing hint.
export const WHEN_HINT = { index: '', arthro: 'e.g. 0.4 years ago', paren: 'e.g. approx. 3 years ago', comma: 'e.g. ~6 weeks ago', prevside: '', bare: '' };

export const HISTORY_FIELDS = [
  { key: COL.dom, label: 'Dominant arm', kind: 'seg', options: ['Right', 'Left', 'Ambidextrous'] },
  { key: COL.affDom, label: 'Affected side is dominant', kind: 'derived' },
  { key: COL.surgery, label: 'Previous shoulder surgery', kind: 'surgery', reads: ['B1', 'B2', 'B3', 'SH-RF-02'] },
  { key: COL.episodes, label: 'Previous episode(s) of the same complaint', kind: 'yn' },
  { key: COL.treatment, label: 'Previous treatment received', kind: 'multi', options: ['None', 'Physiotherapy', 'Corticosteroid Injection', 'Surgery', 'Medication only'] },
  // Suggestions: the most common texts the 18 workbooks write in these free-text columns.
  { key: 'Aggravating Factors', kind: 'text', suggestions: VOCAB.suggestions?.['Aggravating Factors'] },
  { key: 'Easing Factors', kind: 'text', suggestions: VOCAB.suggestions?.['Easing Factors'] },
  { key: COL.night, label: 'Night pain', kind: 'yn' },
  { key: COL.sleep, label: 'Sleep disturbance due to pain', kind: 'yn' },
  { key: 'Smoking Status', kind: 'seg', options: ['Never', 'Former', 'Current'] },
  { key: COL.cervical, label: 'Cervical spine screen', kind: 'seg', options: ['Clear', CERVICAL_NOT_CLEAR], help: '"Not Clear" is written into Red Flags / Precautions; the shoulder pathway continues in parallel.' },
];

export function derivedDominant(a) {
  const lat = a['Laterality'], dom = a[COL.dom];
  if (!lat || !dom || lat === NA || dom === NA) return { value: '', editable: false };
  if (lat === 'Bilateral' || dom === 'Ambidextrous') return { value: a[COL.affDom] || '', editable: true };
  return { value: lat === dom ? 'Yes' : 'No', editable: false };
}

// What History says about surgery, as the screens need it.
export function surgeryOf(a) {
  const yn = a[COL.surgery];
  if (!has(a, COL.surgery)) return { known: false };
  if (yn === 'No') return { known: true, any: false };
  if (yn === NA) return { known: true, unknown: true };
  const proc = PROC[a[COL.surgery + '::procedure']];
  const side = a[COL.surgery + '::side'] || 'This shoulder';
  const index = a[COL.surgery + '::index'];
  return { known: true, any: true, proc, side, index, thisSide: side !== 'Other side', when: a[COL.surgery + '::when'] };
}

// ---------- wrapper-specific questions (key = "<wrapper>|<exact MRL column>") ----------
const TEST = ['Positive', 'Negative', 'Equivocal', 'Not Performed'];
const PA = ['Present', 'Absent'];
// S01 MRI cell parts, as in the S01 form (S01IntakeForm/schema.js) and the 36,000 S01 rows.
export const MRI_TEAR = ['None', 'Partial-thickness', 'Full-thickness (small <1cm)', 'Full-thickness (medium 1-3cm)', 'Full-thickness (large 3-5cm)', 'Full-thickness (massive >5cm)'];
export const GOUTALLIER = ['Grade 0', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4'];
export const mriCell = (tear, grade) => `Tear: ${tear}; Goutallier: ${grade}`;
const reEscape = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
export const US_NO_TEAR = 'Not applicable (no structural tear on imaging)';
const Q = {};
function q(w, col, def) {
  const key = `${w}|${col}`;
  // Layer 1 writes these as "Present / Absent (describe if Present)": a description goes in as "Present - <description>".
  Q[key] = { key, w, col, cols: [[w, col], ...(def.also || [])], describe: def.options === PA, ...def };
  return key;
}
// Fracture screen helper: which imaging field applies. Not a column; it decides which classification is asked.
export const IMAGING = 'ui|imaging';
const IMG = { humerus: 'Proximal humerus fracture', clavicle: 'Clavicle fracture', scapula: 'Scapula / glenoid fracture', none: 'No fracture on imaging', notYet: 'Not imaged yet' };
Q[IMAGING] = { key: IMAGING, ui: true, label: 'Imaging', ask: 'What does X-ray or CT show?', kind: 'seg', options: Object.values(IMG), normal: IMG.notYet, help: 'Not a column: it picks which classification field below is filled (Neer for S08, Allman for S09, Ideberg for S10).' };
// Capsular screen helper for "full passive range": nothing is written to the S05 ROM cell.
export const FULL_ROM = 'full';

const K = {
  // red flags
  retro: q('S07', 'Neurovascular Status (retrosternal compromise screen - critical for posterior dislocation)', { label: 'Retrosternal compromise screen', ask: 'After an injury at the breastbone end of the collarbone: any sign of airway or great-vessel compromise (breathlessness, difficulty swallowing, reduced pulse)?', kind: 'seg', options: ['Clear', 'Not Clear - Airway/Great Vessel Compromise Suspected'], normal: 'Clear', naLabel: 'No SC injury' }),
  fever: q('S13', 'Fever/Systemic Illness', { label: 'Fever / systemic illness', ask: 'Fever or feeling systemically unwell?', kind: 'fever', normal: 'No' }),
  wound: q('S13', 'Wound Discharge/Erythema', { label: 'Wound discharge / erythema', ask: 'Discharge, redness or warmth at the wound?', kind: 'seg', options: PA, normal: 'Absent' }),
  aspirate: q('S13', 'Joint Aspirate_Appearance', { label: 'Joint aspirate appearance', ask: 'If the joint was aspirated, what did the fluid look like?', kind: 'seg', options: ['Clear', 'Straw-coloured', 'Turbid', 'Purulent', 'Haemorrhagic'], normal: NA, naLabel: 'Not aspirated', optional: true }),
  venous: q('S15', 'Venous Distension/Swelling (effort thrombosis screen)', { label: 'Venous distension / swelling', ask: 'Swollen arm with distended veins, often after hard repetitive arm work (effort thrombosis)?', kind: 'seg', options: PA, normal: 'Absent' }),
  girth: q('S15', 'Limb Girth Comparison (cm, bilateral)', { label: 'Limb girth comparison', ask: 'Arm girth, both sides (cm). A difference over 2 cm is significant.', kind: 'girth', normal: NA, naLabel: 'Not measured', optional: true }),
  pulse: q('S15', 'Radial Pulse Comparison (bilateral)', { label: 'Radial pulse comparison', ask: 'Radial pulse compared with the other arm?', kind: 'seg', options: ['Symmetric', 'Reduced on affected side', 'Absent on affected side'], normal: 'Symmetric' }),
  colour: q('S15', 'Limb Colour/Temperature Asymmetry', { label: 'Limb colour / temperature', ask: 'Colour or temperature difference between the arms?', kind: 'seg', options: ['Symmetric', 'Asymmetric - Pale/Cold', 'Asymmetric - Cyanosed/Cold', 'Asymmetric - Erythematous/Warm'], normal: 'Symmetric' }),
  tumour: q('S18', 'MRI/Biopsy_Suspected Tumour Findings', { label: 'Suspected tumour findings', ask: 'Imaging or biopsy suspicious of a tumour?', kind: 'seg', options: ['No suspicious finding', 'Suspicious finding - biopsy pending', 'Biopsy-confirmed (specify) - primary/metastatic lesion, histology on file', 'Not Yet Performed'], normal: 'Not Yet Performed' }),
  mass: q('S18', 'Crepitus/Mass Palpation', { label: 'Mass palpation', ask: 'A palpable mass (or crepitus) around the shoulder girdle?', kind: 'seg', options: PA, normal: 'Absent' }),
  mech10: q('S10', 'Mechanism/Onset (high-energy trauma for fracture / repetitive for scapulothoracic disorders)', { label: 'Mechanism (scapula)', ask: 'High-energy injury (road accident, fall from height)?', kind: 'seg', options: ['High-energy trauma for fracture', 'Repetitive for scapulothoracic disorders', 'Other (specify)'], normal: NA, naLabel: 'No injury' }),
  nv10: q('S10', 'Neurovascular Status', { label: 'Neurovascular status (scapula)', ask: 'Neurovascular status of the arm after that injury?', kind: 'seg', options: ['Intact', 'Impaired - Motor', 'Impaired - Sensory', 'Impaired - Vascular', 'Impaired - Combined (specify)'], normal: NA, naLabel: 'No injury' }),
  skin8: q('S08', 'Skin Integrity (open vs closed)', { label: 'Skin integrity', ask: 'If there may be a fracture: is the skin broken over it (open fracture)?', kind: 'seg', options: ['Closed', 'Open'], normal: NA, naLabel: 'No fracture suspected' }),
  tent9: q('S09', 'Skin Tenting/Open Fracture Screen', { label: 'Skin tenting / open fracture (clavicle)', ask: 'Over a collarbone injury: is the skin tented or broken?', kind: 'seg', options: ['Clear', 'Not Clear', 'Abnormal Finding (specify) - open fracture'], normal: NA, naLabel: 'No collarbone injury' }),
  nv8: q('S08', 'Neurovascular Status (axillary nerve/axillary artery)', { label: 'Neurovascular status (axillary)', ask: 'After an injury: axillary nerve (deltoid, badge-area sensation) and axillary artery intact?', kind: 'seg', options: ['Intact', 'Impaired - Nerve (axillary)', 'Impaired - Vascular (axillary artery)', 'Impaired - Combined'], normal: NA, naLabel: 'No injury' }),
  mech16: q('S16', 'Mechanism/Onset (traumatic traction injury / iatrogenic / compressive)', { label: 'Nerve-injury mechanism', ask: 'Did a traction injury happen (arm or neck forcibly stretched, e.g. motorbike fall)?', kind: 'seg', options: ['Traumatic traction injury', 'Iatrogenic', 'Compressive', 'Other (specify) - idiopathic/post-viral brachial neuritis'], normal: NA, naLabel: 'No nerve-injury mechanism' }),
  derm16: q('S16', 'Sensory Mapping (dermatomal)', { label: 'Dermatomal sensory mapping', ask: 'Sensation in the arm dermatomes?', kind: 'seg', options: ['Normal', 'Reduced', 'Absent'], normal: 'Normal' }),
  reflex16: q('S16', 'Reflexes (biceps/triceps)', { label: 'Biceps / triceps reflexes', ask: 'Biceps and triceps reflexes?', kind: 'reflex', normal: NA, naLabel: 'Not tested', optional: true }),

  // B1 fracture / dislocation
  deform8: q('S08', 'Gross Deformity', { label: 'Gross deformity', ask: 'After an injury: visible deformity at the shoulder or upper arm?', kind: 'seg', options: PA, normal: 'Absent', naLabel: 'No injury' }),
  deform9: q('S09', 'Deformity/Shortening', { label: 'Deformity / shortening (clavicle)', ask: 'Deformity, bump or shortening along the collarbone?', kind: 'seg', options: PA, normal: 'Absent', naLabel: 'No injury' }),
  neer8: q('S08', 'X-Ray_Neer Classification', { label: 'X-ray: Neer classification', ask: 'Neer parts on X-ray', kind: 'seg', options: ['1-part', '2-part', '3-part', '4-part'], when: a => a[IMAGING] === IMG.humerus, optional: true }),
  allman: q('S09', 'X-Ray_Allman Classification', { label: 'X-ray: Allman classification', ask: 'Allman group on X-ray', kind: 'seg', options: ['Group I (Midshaft)', 'Group II (Lateral)', 'Group III (Medial)'], when: a => a[IMAGING] === IMG.clavicle, optional: true }),
  ideberg: q('S10', 'CT_Scapular Fracture Pattern (Ideberg Classification for glenoid)', { label: 'CT: Ideberg classification', ask: 'Ideberg type on CT (glenoid fractures only)', kind: 'seg', options: ['Type I', 'Type II', 'Type III', 'Type IV', 'Type V', 'Type VI', 'Not applicable (non-glenoid-fracture diagnosis)'], when: a => a[IMAGING] === IMG.scapula, optional: true }),

  // B2 / B3 surgery
  arthro: q('S13', 'Type of Arthroplasty (Anatomic/Reverse/Hemiarthroplasty)', { label: 'Type of arthroplasty', ask: 'Which kind of joint replacement?', kind: 'seg', options: ['Anatomic', 'Reverse', 'Hemiarthroplasty', 'Other (specify)'], when: a => surgeryOf(a).proc?.group === 'S13', optional: true }),
  proc12: q('S12', 'Procedure Type (Arthroscopic RCR/Open RCR/Bankart Repair/Latarjet/SLAP Repair/Subacromial Decompression)', { label: 'Procedure type', kind: 'derivedFrom', from: 'surgery' }),
  // The S12 cell is "Week 23.5 (Phase 4)", and its phase is always the case's Rehabilitation Phase (all 23,000 rows),
  // so the phase is asked with the weeks. Range 0-520 so a later operation can be told apart from S12's 0-52 weeks;
  // the cell is written only inside 0-52, with a phase.
  week12: q('S12', 'Post-Operative Week/Phase', { label: 'Post-operative week and phase', ask: 'Weeks since that surgery, and the rehab phase (S12 covers weeks 0-52)', kind: 'week', min: 0, max: 520, decimals: 1, unit: 'weeks', phases: ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4'], normal: NA, naLabel: 'Not known', optional: true }),

  // B4 vascular
  onset15: q('S15', 'Onset (acute arm swelling/discolouration - effort thrombosis - vs chronic intermittent claudication-type)', { label: 'Vascular symptom onset', ask: 'Arm symptoms of a vascular kind?', kind: 'seg', options: [{ v: 'Acute arm swelling', l: 'Acute arm swelling' }, { v: 'Discolouration - effort thrombosis - vs chronic intermittent claudication-type', l: 'Discolouration (effort thrombosis)' }, { v: 'Chronic intermittent claudication-type', l: 'Claudication-type: arm aches or tires with use, eases with rest' }], normal: NA, naLabel: 'None of these' }),

  // B5 capsular pattern
  rom5: q('S05', 'Passive ROM Restriction (capsular pattern: ER > Abduction > IR)', { label: 'Passive ROM restriction', ask: 'Passive range, therapist moving the arm (degrees)', kind: 'rom3', normal: FULL_ROM }),
  kl6: q('S06', 'X-Ray_Kellgren-Lawrence Grade (Glenohumeral)', { label: 'X-ray: Kellgren-Lawrence grade', ask: 'Glenohumeral arthritis on X-ray?', kind: 'seg', options: ['Grade 0', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4'], normal: NA, naLabel: 'Not imaged' }),
  endfeel5: q('S05', 'End-Feel (capsular)', { label: 'End-feel', ask: 'End-feel at the limit of passive range', kind: 'seg', options: ['Normal (firm capsular)', 'Empty (pain-limited)', 'Hard (bony block)', 'Boggy (effusion)', 'Springy Block (mechanical block)'], normal: NA, optional: true }),

  // B6 instability
  episodes2: q('S02', 'Number of Prior Dislocation Episodes', { label: 'Prior dislocation episodes', ask: 'How many times has the shoulder dislocated or slipped out before?', kind: 'int', min: 0, max: 20, normal: '0' }),
  appr2: q('S02', 'Apprehension Test', { label: 'Apprehension test', ask: 'Apprehension test', kind: 'seg', options: TEST, normal: 'Negative' }),
  reloc2: q('S02', 'Relocation Test', { label: 'Relocation test', ask: 'Relocation test', kind: 'seg', options: TEST, normal: 'Negative' }),
  sulcus2: q('S02', 'Sulcus Sign', { label: 'Sulcus sign', ask: 'Sulcus sign (inferior laxity)', kind: 'seg', options: TEST, normal: 'Negative' }),
  obrien2: q('S02', "O'Brien's Active Compression Test (SLAP)", { label: "O'Brien's test (SLAP)", ask: "O'Brien's test: positive means deep pain inside the joint (SLAP). Pain on top of the shoulder is AC: record Negative here.", kind: 'seg', options: TEST, normal: 'Negative' }),

  // B7 AC / SC
  ac4: q('S04', 'AC Joint Tenderness/Step Deformity', { label: 'AC joint tenderness / step', ask: 'Tenderness or a step at the AC joint (top of the shoulder)?', kind: 'seg', options: PA, normal: 'Absent' }),
  sc7: q('S07', 'SC Joint Tenderness/Swelling/Deformity', { label: 'SC joint tenderness / swelling', ask: 'Tenderness, swelling or deformity at the SC joint (breastbone end)?', kind: 'seg', options: PA, normal: 'Absent' }),
  cba4: q('S04', 'Cross-Body Adduction Test', { label: 'Cross-body adduction test', ask: 'Cross-body adduction test', kind: 'seg', options: TEST, normal: 'Not Performed', optional: true }),

  // B8 neurological
  c8t1: q('S14', 'Sensory Distribution (ulnar nerve/C8-T1)', { label: 'Sensory distribution (C8-T1)', ask: 'Sensation along the ulnar border of the forearm and hand (C8-T1)?', kind: 'seg', options: ['Normal', 'Reduced', 'Absent'], normal: 'Normal' }),
  roos14: q('S14', 'Roos Test (EAST)', { label: 'Roos test (EAST)', ask: 'Roos test: arms up, open-close hands for 3 minutes', kind: 'seg', options: TEST, normal: 'Negative' }),
  adson14: q('S14', "Adson's Test", { label: "Adson's test", ask: "Adson's test", kind: 'seg', options: TEST, normal: 'Negative' }),
  wright14: q('S14', "Wright's Test (Hyperabduction)", { label: "Wright's test (hyperabduction)", ask: "Wright's hyperabduction test", kind: 'seg', options: TEST, normal: 'Not Performed', optional: true }),
  costo14: q('S14', 'Costoclavicular Maneuver', { label: 'Costoclavicular manoeuvre', ask: 'Costoclavicular manoeuvre', kind: 'seg', options: TEST, normal: 'Not Performed', optional: true }),
  ultt14: q('S14', 'Upper Limb Tension Test (ULTT)', { label: 'Upper limb tension test (ULTT)', ask: 'Upper limb tension test', kind: 'seg', options: TEST, normal: 'Not Performed', optional: true }),
  axil16: q('S16', 'Axillary Nerve_Deltoid Strength/Sensation (regimental badge area)', { label: 'Axillary nerve: deltoid', ask: 'Deltoid', kind: 'int', min: 0, max: 5, unit: 'MRC', group: 'nerves', normal: '5', optional: true }),
  supra16: q('S16', 'Suprascapular Nerve_Infraspinatus/Supraspinatus Strength', { label: 'Suprascapular nerve: infra/supraspinatus', ask: 'Infra/supraspinatus', kind: 'int', min: 0, max: 5, unit: 'MRC', group: 'nerves', normal: '5', optional: true }),
  lt16: q('S16', 'Long Thoracic Nerve_Serratus Anterior Strength/Winging', { label: 'Long thoracic nerve: serratus anterior', ask: 'Serratus anterior', kind: 'int', min: 0, max: 5, unit: 'MRC', group: 'nerves', normal: '5', optional: true }),
  sa16: q('S16', 'Spinal Accessory Nerve_Trapezius Strength', { label: 'Spinal accessory nerve: trapezius', ask: 'Trapezius', kind: 'int', min: 0, max: 5, unit: 'MRC', group: 'nerves', normal: '5', optional: true }),
  emg16: q('S16', 'EMG/Nerve Conduction Study_Findings', { label: 'EMG / nerve conduction', ask: 'EMG / nerve conduction result, if done', kind: 'seg', options: ['Normal', 'Abnormal - Demyelinating', 'Abnormal - Axonal', 'Abnormal - Mixed', 'Not Yet Performed'], normal: 'Not Yet Performed', optional: true }),
  notch16: q('S16', 'MRI_Nerve Compression Site (suprascapular/spinoglenoid notch)', { label: 'MRI: nerve compression site', ask: 'MRI shows a compressed suprascapular nerve?', kind: 'seg', options: ['Suprascapular', 'Spinoglenoid notch', 'Other (specify) - not applicable, no nerve compression site imaged for this diagnosis'].map(v => (v.startsWith('Other') ? { v, l: 'No compression / not applicable' } : v)), normal: NA, naLabel: 'No MRI', optional: true }),

  // B9 paediatric / congenital
  onset17: q('S17', 'Onset (birth-related / developmental)', { label: 'Onset (paediatric)', ask: 'For a child: how did it start?', kind: 'seg', options: ['Birth-related', 'Developmental', { v: 'Other (specify) - acquired autoimmune/inflammatory onset, not birth-related or developmental-structural', l: 'Acquired inflammatory (e.g. JIA)' }], normal: NA, naLabel: 'Ordinary adult-type problem' }),
  birth17: q('S17', 'Birth History (shoulder dystocia/traction injury)', { label: 'Birth history', ask: 'Birth history', kind: 'seg', options: ['Shoulder dystocia', 'Traction injury', 'Other (specify) - difficult vaginal delivery, mechanism not further specified', 'Other (specify) - not applicable, no birth dystocia/traction history for this diagnosis'], normal: NA, optional: true }),

  // B10 default mechanical / arthritic / scapular
  arc: q('S01', 'Painful Arc (60-120 deg)', { label: 'Painful arc', ask: 'Painful arc during abduction?', kind: 'seg', options: ['Absent', 'Present 0-60 deg', 'Present 60-120 deg', 'Present 120-180 deg'], normal: 'Absent', also: [['S03', 'Painful Arc']] }),
  emptycan: q('S01', 'Empty Can (Jobe) Test', { label: 'Empty Can (Jobe) test', ask: 'Empty Can (Jobe) test: weak or painful?', kind: 'seg', options: TEST, normal: 'Negative' }),
  fullcan: q('S01', 'Full Can Test', { label: 'Full Can test', ask: 'Full Can test', kind: 'seg', options: TEST, normal: 'Not Performed', optional: true }),
  liftoff: q('S01', 'Lift-Off Test (subscapularis)', { label: 'Lift-Off test (subscapularis)', ask: 'Lift-Off test (subscapularis)', kind: 'seg', options: TEST, normal: 'Not Performed', optional: true }),
  speeds: q('S01', "Speed's Test (biceps)", { label: "Speed's test (biceps)", ask: "Speed's test (biceps)", kind: 'seg', options: TEST, normal: 'Not Performed', optional: true }),
  hawkins: q('S01', 'Hawkins-Kennedy Impingement Test', { label: 'Hawkins-Kennedy test', ask: 'Hawkins-Kennedy impingement test', kind: 'seg', options: TEST, normal: 'Negative', also: [['S03', 'Hawkins-Kennedy Test']] }),
  neer: q('S01', 'Neer Impingement Test', { label: 'Neer impingement test', ask: 'Neer impingement test', kind: 'seg', options: TEST, normal: 'Not Performed', optional: true, also: [['S03', 'Neer Test']] }),
  sat3: q('S03', 'Subacromial Tenderness (Palpation)', { label: 'Subacromial tenderness', ask: 'Tender under the front/side edge of the acromion?', kind: 'seg', options: PA, normal: 'Absent', optional: true }),
  crepitus6: q('S06', 'Crepitus', { label: 'Crepitus', ask: 'Grinding (crepitus) in the glenohumeral joint?', kind: 'seg', options: PA, normal: 'Absent' }),
  // S11 writes this same value into the shared Onset column (all 19,999 rows), so an S11 row needs it.
  onset11: q('S11', 'Onset (insidious; often overhead athlete)', { label: 'Onset (scapular)', ask: 'For a scapular problem: how did it start?', kind: 'seg', options: ['Insidious - overhead athlete', 'Insidious - non-athlete', 'Acute-on-chronic'], optional: true, help: 'S11 writes this value in its shared Onset column too.' }),
  dysk11: q('S11', 'Scapular Dyskinesis Test Grade', { label: 'Scapular dyskinesis', ask: 'Watching the shoulder blade during arm raising and lowering: is its movement abnormal?', kind: 'seg', options: ['Normal', 'Dyskinesis Present (Subtle)', 'Dyskinesis Present (Obvious)'], normal: 'Normal' }),
  wing10: q('S10', 'Scapular Winging', { label: 'Scapular winging', ask: 'Scapular winging?', kind: 'seg', options: PA, normal: 'Absent' }),
  snap10: q('S10', 'Scapulothoracic Crepitus/Snapping', { label: 'Scapulothoracic crepitus / snapping', ask: 'Snapping or grinding under the shoulder blade on arm elevation?', kind: 'seg', options: PA, normal: 'Absent' }),

  // Node walk, B10: the cuff findings that separate S01 from S03 (DDX S01-002/003/004/005: weakness, lag and
  // drop-arm signs, a tear on imaging, Belly Press, Yergason's). S01 writes every one of these in all 36,000 rows.
  lag01: q('S01', 'External Rotation Lag Sign', { label: 'External rotation lag sign', ask: 'Placed in full external rotation, does the arm drift back?', kind: 'seg', options: TEST, normal: 'Negative' }),
  drop01: q('S01', 'Drop Arm Test', { label: 'Drop arm test', ask: 'From 90° abduction, can the arm be lowered slowly, or does it drop?', kind: 'seg', options: TEST, normal: 'Negative' }),
  belly01: q('S01', 'Belly Press Test', { label: 'Belly press test (subscapularis)', ask: 'Belly press test (subscapularis)', kind: 'seg', options: TEST, normal: 'Not Performed', optional: true }),
  yerg01: q('S01', "Yergason's Test (biceps)", { label: "Yergason's test (biceps)", ask: "Yergason's test (biceps)", kind: 'seg', options: TEST, normal: 'Not Performed', optional: true }),
  // "ER:4/IR:4/Abd:4" in every S01 row.
  mmt01: q('S01', 'Muscle Strength (MMT) - ER/IR/Abduction', { label: 'Muscle strength (MMT)', ask: 'Strength of external rotation, internal rotation and abduction (MRC 0-5)', kind: 'mmt3', pattern: '^ER:[0-5]/IR:[0-5]/Abd:[0-5]$', normal: 'ER:5/IR:5/Abd:5' }),
  // "Tear: Partial-thickness; Goutallier: Grade 1": the S01 form's MRI field (schema.js MRI_TEAR, GOUTALLIER).
  mri01: q('S01', 'MRI_Rotator Cuff Tear Grade (partial/full-thickness) / Goutallier Fatty Infiltration Grade', { label: 'MRI: rotator cuff tear', ask: 'MRI: is the rotator cuff torn, and how much fat is in the muscle (Goutallier)?', kind: 'mri', tears: MRI_TEAR, grades: GOUTALLIER, pattern: `^Tear: (${MRI_TEAR.map(reEscape).join('|')}); Goutallier: (${GOUTALLIER.map(reEscape).join('|')})$`, normal: NA, naLabel: 'No MRI' }),
  // "12 mm", or the "not applicable" text when imaging shows no structural tear (S01: always with an MRI "Tear: None").
  us01: q('S01', 'Ultrasound_Tendon Tear Size', { label: 'Ultrasound: tendon tear size', ask: 'Ultrasound: size of the cuff tendon tear', kind: 'usSize', min: 1, max: 100, decimals: 1, unit: 'mm', noTear: US_NO_TEAR, pattern: '^(\\d+(\\.\\d)? mm|Not applicable \\(no structural tear on imaging\\))$', normal: NA, naLabel: 'No ultrasound', optional: true }),

  // Node walk, B7: the tests that tell an AC joint from an SC joint when both are tender.
  obrienAc4: q('S04', "O'Brien's Test (AC-specific)", { label: "O'Brien's test (AC)", ask: "O'Brien's test with the pain on top of the shoulder (AC joint)", kind: 'seg', options: TEST, normal: 'Not Performed', optional: true }),
  comp4: q('S04', 'AC Joint Compression Test', { label: 'AC joint compression test', ask: 'AC joint compression (shear) test', kind: 'seg', options: TEST, normal: 'Not Performed', optional: true }),
  piano4: q('S04', 'Piano Key Sign', { label: 'Piano key sign', ask: 'Piano key sign: the distal clavicle springs back after pressing down', kind: 'seg', options: TEST, normal: 'Not Performed', optional: true }),
  serial7: q('S07', 'Serial Compression Test', { label: 'Serial compression test (SC)', ask: 'Serial compression test of the SC joint', kind: 'seg', options: ['Positive', 'Negative', 'Equivocal'], normal: NA, naLabel: 'Not performed', optional: true }),
  // Imaging and injection findings of the two joints. Rockwood Type I has a normal X-ray, so it is not a finding here.
  rock4: q('S04', 'X-Ray_Rockwood Classification (Type I-VI)', { label: 'X-ray: Rockwood type (AC)', ask: 'X-ray of the AC joint: Rockwood type?', kind: 'seg', options: ['Type I', 'Type II', 'Type III', 'Type IV', 'Type V', 'Type VI', 'Not applicable (non-traumatic)'], normal: NA, naLabel: 'Not X-rayed', optional: true }),
  inj4: q('S04', 'Response to Diagnostic AC Joint Injection (Y/N)', { label: 'Diagnostic AC joint injection', ask: 'Did a diagnostic AC joint injection relieve the pain?', kind: 'seg', options: ['Yes', 'No'], normal: NA, naLabel: 'Not injected', optional: true }),
  seren7: q('S07', 'X-Ray_Serendipity View Findings', { label: 'X-ray: serendipity view (SC)', ask: 'Serendipity view X-ray of the SC joint', kind: 'seg', options: ['Normal alignment', 'Anterior displacement', 'Posterior displacement'], normal: NA, naLabel: 'Not X-rayed', optional: true }),

  // Each wrapper's own defining findings, read by its decision point (DDX rules; draft, for clinical sign-off).
  // B6: posterior instability and laxity tests, and the labral / Hill-Sachs findings on MRI (DDX S02).
  jerk2: q('S02', 'Jerk Test (posterior instability)', { label: 'Jerk test (posterior)', ask: 'Jerk test (posterior instability)', kind: 'seg', options: TEST, normal: 'Not Performed', optional: true }),
  kim2: q('S02', 'Kim Test (posterior labral)', { label: 'Kim test (posterior labrum)', ask: 'Kim test (posterior labral)', kind: 'seg', options: TEST, normal: 'Not Performed', optional: true }),
  shift2: q('S02', 'Load and Shift Test', { label: 'Load and shift test', ask: 'Load and shift test (humeral head translation)', kind: 'seg', options: TEST, normal: 'Not Performed', optional: true }),
  drawer2: q('S02', 'Anterior/Posterior Drawer Test (GH joint)', { label: 'Anterior / posterior drawer (GH)', ask: 'Anterior / posterior drawer test of the glenohumeral joint', kind: 'seg', options: TEST, normal: 'Not Performed', optional: true }),
  labrum2: q('S02', 'MRI Arthrogram_Labral Tear Location/Type (Bankart / SLAP I-IV / reverse Bankart)', { label: 'MR arthrogram: labral tear', ask: 'MR arthrogram: is the labrum torn?', kind: 'seg', options: ['None', 'Bankart', 'Reverse Bankart', 'SLAP Type I', 'SLAP Type II', 'SLAP Type III', 'SLAP Type IV'], normal: NA, naLabel: 'No MR arthrogram', optional: true }),
  hs2: q('S02', 'MRI_Hill-Sachs Lesion Present (Y/N)', { label: 'MRI: Hill-Sachs lesion', ask: 'MRI: a Hill-Sachs lesion (humeral head impaction from a dislocation)?', kind: 'seg', options: ['Yes', 'No'], normal: NA, naLabel: 'No MRI', optional: true }),
  // B8: a structural cause at the thoracic outlet (DDX S14-003 cervical rib; the compression site on MRI/CT).
  site14: q('S14', 'MRI/CT_Brachial Plexus Compression Site', { label: 'MRI/CT: plexus compression site', ask: 'MRI/CT: where is the brachial plexus compressed?', kind: 'seg', options: ['None identified', 'Scalene triangle', 'Costoclavicular space', 'Subpectoral (retropectoralis minor) space'], normal: NA, naLabel: 'No MRI/CT', optional: true }),
  rib14: q('S14', 'Cervical Rib Palpation', { label: 'Cervical rib palpation', ask: 'A cervical rib felt in the supraclavicular fossa?', kind: 'seg', options: PA, normal: 'Absent', optional: true }),
  ribx14: q('S14', 'X-Ray_Cervical Rib Present', { label: 'X-ray: cervical rib', ask: 'X-ray: a cervical rib?', kind: 'seg', options: ['Yes', 'No'], normal: NA, naLabel: 'Not X-rayed', optional: true }),
  // B9: os acromiale is a developmental anomaly (S17), found at any age.
  osx17: q('S17', 'X-Ray_Os Acromiale Present', { label: 'X-ray: os acromiale', ask: 'X-ray: an unfused acromial ossification centre (os acromiale)?', kind: 'seg', options: ['Yes', 'No'], normal: NA, naLabel: 'Not X-rayed', optional: true }),
  ospal17: q('S17', 'Os Acromiale Palpation', { label: 'Os acromiale palpation', ask: 'Tender over an unfused acromial ossification centre?', kind: 'seg', options: ['Absent', { v: 'Present - tender at the unfused acromial ossification centre', l: 'Present: tender at the unfused centre' }], normal: 'Absent', optional: true }),
  // B10: inflammatory arthritis (DDX S06-003) and subacromial bursitis (DDX S03-002).
  sym6: q('S06', 'Symmetric Joint Involvement (inflammatory screen)', { label: 'Symmetric joint involvement', ask: 'Are other joints involved symmetrically (inflammatory screen)?', kind: 'seg', options: ['Yes', 'No'], normal: 'No' }),
  extra6: q('S06', 'Extra-Articular Manifestations (if inflammatory - nodules/eye/skin/lung)', { label: 'Extra-articular features', ask: 'Rheumatoid nodules, or eye, skin or lung involvement?', kind: 'seg', options: ['None', 'Rheumatoid Nodules', 'Eye Involvement (e.g. scleritis)', 'Skin Involvement', 'Lung Involvement'], normal: 'None', optional: true }),
  bursa3: q('S03', 'Ultrasound_Subacromial Bursal Thickening/Effusion', { label: 'Ultrasound: subacromial bursa', ask: 'Ultrasound: is the subacromial bursa thickened or holding fluid?', kind: 'seg', options: ['None', 'Mild', 'Moderate', 'Severe'], normal: NA, naLabel: 'No ultrasound', optional: true }),
  inj3: q('S03', 'Response to Diagnostic Subacromial Injection (Y/N)', { label: 'Diagnostic subacromial injection', ask: 'Did a diagnostic subacromial injection relieve the pain?', kind: 'seg', options: ['Yes', 'No'], normal: NA, naLabel: 'Not injected', optional: true }),
};
export const QUESTIONS = Q;
export const KEYS = K;

// ---------- small rule helpers ----------
const lab = k => Q[k]?.label || k;
const said = (a, k) => `${lab(k)}: ${display(k, a[k])}`;
export function display(k, v) {
  if (v === NA) return Q[k]?.naLabel || 'Not assessed';
  const o = (Q[k]?.options || []).find(x => (typeof x === 'object' ? x.v : x) === v);
  return o && typeof o === 'object' ? o.l : String(v ?? '');
}
// An answer that lets a rule pass without being a finding. "No injury"-style answers (a custom naLabel) mean
// "not applicable", and "Not Yet Performed" imaging is normal at intake, so neither is listed as an assumption.
const assumption = (a, k) => (a[k] === NA ? !Q[k]?.naLabel : a[k] !== 'Not Yet Performed' && SOFT.has(a[k]));
// Decide a rule: any signal -> fires; otherwise every needed answer given -> clear; otherwise open.
function decide(a, { signals = [], needs = [] }) {
  const hits = signals.filter(Boolean);
  if (hits.length) return { state: 'fires', signals: hits };
  const missing = needs.filter(k => !has(a, k) && !(Q[k]?.when && !Q[k].when(a)));
  if (missing.length) return { state: 'open', missing };
  return { state: 'clear', assumed: needs.filter(k => assumption(a, k)).map(k => said(a, k)) };
}
const positive = (a, k) => a[k] === 'Positive';
const present = (a, k) => typeof a[k] === 'string' && a[k].startsWith('Present');

// ---------- red flags (screened before any branching: Workflow Guide, Step 1) ----------
const flagText = (w, start, fallback) => (WRAPPERS[w]?.redFlagTexts || []).map(x => x[0]).find(t => t.startsWith(start)) || fallback;

export const FLAGS = [
  {
    id: 'SH-RF-01', wrapper: 'S07', emergency: true, draft: false,
    trigger: 'S07 Field Rule Logic Document: a "Not Clear" result on this field is red flag SH-RF-01.',
    questions: [K.retro],
    evaluate: a => decide(a, { signals: [is(a, K.retro, 'Not Clear - Airway/Great Vessel Compromise Suspected') && said(a, K.retro)], needs: [K.retro] }),
    record: () => flagText('S07', 'Not Clear - Airway', 'Posterior sternoclavicular dislocation with retrosternal compromise - emergency referral'),
  },
  {
    id: 'SH-RF-02', wrapper: 'S13', emergency: false, draft: true,
    trigger: 'Draft: a shoulder replacement (from History) with fever, wound signs or a turbid/purulent aspirate.',
    questions: [K.fever, K.wound, K.aspirate],
    applies: a => {
      const s = surgeryOf(a);
      if (!s.known) return { open: 'Answer "Previous shoulder surgery" in History first.' };
      if (s.any === false) return { na: 'No previous shoulder surgery.' };
      if (s.any && !s.proc) return { open: 'Pick the procedure under "Previous shoulder surgery" in History.' };
      if (s.any && (s.proc.group !== 'S13' || !s.thisSide)) return { na: 'No joint replacement in this shoulder.' };
      return { yes: true };
    },
    evaluate: a => decide(a, {
      signals: [is(a, K.fever, 'Yes') || String(a[K.fever] || '').startsWith('Yes') ? said(a, K.fever) : null, present(a, K.wound) && said(a, K.wound), is(a, K.aspirate, 'Turbid', 'Purulent') && said(a, K.aspirate)],
      needs: [K.fever, K.wound],
    }),
    record: () => flagText('S13', 'Active periprosthetic joint infection', 'Suspected periprosthetic joint infection - urgent same-day referral'),
  },
  {
    id: 'SH-RF-03', wrapper: 'S15', emergency: true, draft: true,
    trigger: 'Draft: venous distension/swelling, an arm girth more than 2 cm bigger (the S15 document calls >2 cm clinically significant), or a cyanosed, cold arm.',
    questions: [K.venous, K.girth, K.colour],
    evaluate: a => {
      const d = typeof a[K.girth] === 'object' ? girthDiff(a[K.girth]) : null;
      return decide(a, { signals: [present(a, K.venous) && said(a, K.venous), d != null && d > 2 && `Limb girth difference ${d} cm (> 2 cm)`, is(a, K.colour, 'Asymmetric - Cyanosed/Cold') && said(a, K.colour)], needs: [K.venous, K.colour] });
    },
    record: () => flagText('S15', 'Suspected venous thoracic outlet syndrome', 'Suspected venous thoracic outlet syndrome (effort thrombosis) - emergency vascular referral'),
  },
  {
    id: 'SH-RF-04', wrapper: 'S15', emergency: true, draft: true,
    trigger: 'Draft: radial pulse absent on the affected side, or the arm pale and cold (a cyanosed arm is venous: SH-RF-03).',
    questions: [K.pulse, K.colour],
    evaluate: a => decide(a, { signals: [is(a, K.pulse, 'Absent on affected side') && said(a, K.pulse), is(a, K.colour, 'Asymmetric - Pale/Cold') && said(a, K.colour)], needs: [K.pulse, K.colour] }),
    record: () => flagText('S15', 'Suspected arterial thoracic outlet syndrome', 'Suspected arterial thoracic outlet syndrome / limb ischaemia - emergency vascular referral'),
  },
  {
    id: 'SH-RF-05', wrapper: 'S18', emergency: false, draft: true,
    // S18's mass column also records crepitus ("palpable mass / audible-palpable crepitus"), so a "Present" alone
    // cannot mean a mass: with night pain it fired on Milwaukee shoulder and synovial chondromatosis in the data.
    trigger: 'Draft: imaging or biopsy suspicious or confirmed, or a palpable mass in a patient with a history of malignancy.',
    questions: [K.tumour, K.mass],
    reads: ['Co-morbidities'],
    evaluate: a => {
      const malig = Array.isArray(a['Co-morbidities']) && a['Co-morbidities'].includes('Malignancy (specify)');
      return decide(a, {
        signals: [
          (String(a[K.tumour] || '').startsWith('Suspicious') || String(a[K.tumour] || '').startsWith('Biopsy-confirmed')) && said(a, K.tumour),
          present(a, K.mass) && malig && 'Palpable mass with a history of malignancy',
        ],
        needs: [K.tumour, K.mass],
      });
    },
    record: () => flagText('S18', 'Suspected neoplastic process', 'Suspected neoplastic process - urgent oncology referral, halt-and-refer'),
  },
  {
    id: 'SH-RF-06', wrapper: 'S10', emergency: true, draft: true,
    trigger: 'Draft: a high-energy injury with vascular or combined neurovascular impairment of the arm.',
    questions: [K.mech10, K.nv10],
    evaluate: a => decide(a, { signals: [is(a, K.mech10, 'High-energy trauma for fracture') && is(a, K.nv10, 'Impaired - Vascular', 'Impaired - Combined (specify)') && `High-energy injury with ${display(K.nv10, a[K.nv10]).toLowerCase()}`], needs: [K.mech10, K.nv10] }),
    record: () => flagText('S10', 'Suspected scapulothoracic dissociation', 'Scapulothoracic dissociation - limb-threatening emergency'),
  },
  {
    id: 'SH-RF-07', wrappers: ['S08', 'S09', 'S10'], emergency: true, draft: true,
    trigger: 'Draft: an open fracture (skin broken or tented over it), or impaired nerve or artery after an injury.',
    questions: [K.skin8, K.tent9, K.nv8],
    evaluate: a => decide(a, {
      signals: [is(a, K.skin8, 'Open') && said(a, K.skin8), is(a, K.tent9, 'Not Clear', 'Abnormal Finding (specify) - open fracture') && said(a, K.tent9), String(a[K.nv8] || '').startsWith('Impaired') && said(a, K.nv8)],
      needs: [K.skin8, K.tent9, K.nv8],
    }),
    record: a => (is(a, K.skin8, 'Open') || is(a, K.tent9, 'Not Clear', 'Abnormal Finding (specify) - open fracture')
      ? flagText('S08', 'Open fracture', 'Open fracture - urgent orthopaedic/surgical pathway')
      : flagText('S08', 'Neurovascular compromise', 'Neurovascular compromise - urgent surgical review')),
  },
  {
    id: 'SH-RF-08', wrapper: 'S16', emergency: false, draft: true,
    // A single nerve (e.g. axillary palsy after a dislocation) also loses its patch of skin, so absent sensation
    // only counts as a plexus/root picture when two or more named nerves are weak.
    trigger: 'Draft: a traction injury with an absent reflex, or with absent dermatomal sensation and two or more weak named nerves (MRC 3 or less).',
    questions: [K.mech16, K.derm16, K.reflex16],
    reads: [K.axil16, K.supra16, K.lt16, K.sa16],
    evaluate: a => {
      const r = a[K.reflex16];
      const absentReflex = r && typeof r === 'object' && (String(r.biceps).startsWith('0') || String(r.triceps).startsWith('0'));
      const weak = [K.axil16, K.supra16, K.lt16, K.sa16].filter(k => num(a, k) != null && num(a, k) <= 3).length;
      const sensory = String(a[K.derm16] || '').startsWith('Absent') && weak >= 2;
      return decide(a, { signals: [is(a, K.mech16, 'Traumatic traction injury') && (absentReflex || sensory) && `Traction injury with ${absentReflex ? 'an absent reflex' : `absent dermatomal sensation and ${weak} weak nerves`}`], needs: [K.mech16, K.derm16] });
    },
    record: () => 'Traumatic brachial plexus injury with suspected root avulsion (SH-RF-08) - urgent referral',
  },
  {
    id: 'SH-RF-09', wrapper: 'S17', emergency: false, draft: true,
    trigger: 'Draft: asked for patients under 18. No column records it, so a "Yes" is written into Red Flags / Precautions (all 18 workbooks).',
    questions: ['ui|safeguarding'],
    applies: a => {
      const age = num(a, 'Age');
      if (!has(a, 'Age')) return { open: 'Enter the age on the Patient stop first.' };
      if (age != null && age >= 18) return { na: 'Adult patient (18 or over).' };
      return { yes: true };
    },
    evaluate: a => decide(a, { signals: [is(a, 'ui|safeguarding', 'Yes') && 'Safeguarding concern recorded'], needs: ['ui|safeguarding'] }),
    record: () => 'Safeguarding concern in paediatric presentation (SH-RF-09) - urgent safeguarding referral per local procedures',
  },
];
Q['ui|safeguarding'] = { key: 'ui|safeguarding', ui: true, col: COL.redFlags, w: '*', label: 'Safeguarding concern', ask: 'Is there a safeguarding concern: an injury the history does not explain, or one that does not fit the child\'s age or development?', kind: 'seg', options: ['Yes', 'No'], normal: 'No' };
for (const f of FLAGS) f.wrappers = f.wrappers || [f.wrapper];

// Thoracic outlet signs (S14): C8-T1 sensory change, a positive positional test, a compression site on MRI/CT, a
// cervical rib. Read by decision point B8 and node B8.2.
function tosSigns(a) {
  return [is(a, K.c8t1, 'Reduced', 'Absent') && said(a, K.c8t1), ...[K.roos14, K.adson14, K.wright14, K.costo14, K.ultt14].map(k => positive(a, k) && said(a, k)),
    is(a, K.site14, 'Scalene triangle', 'Costoclavicular space', 'Subpectoral (retropectoralis minor) space') && said(a, K.site14),
    present(a, K.rib14) && said(a, K.rib14), is(a, K.ribx14, 'Yes') && said(a, K.ribx14)].filter(Boolean);
}
// AC joint (S04) and SC joint (S07) findings other than tenderness: the joint's own tests, imaging and injection.
const acSigns = a => [...[K.comp4, K.obrienAc4, K.piano4].map(k => positive(a, k) && said(a, k)), is(a, K.rock4, 'Type II', 'Type III', 'Type IV', 'Type V', 'Type VI') && said(a, K.rock4), is(a, K.inj4, 'Yes') && said(a, K.inj4)].filter(Boolean);
const scSigns = a => [positive(a, K.serial7) && said(a, K.serial7), is(a, K.seren7, 'Anterior displacement', 'Posterior displacement') && said(a, K.seren7)].filter(Boolean);
// Inflammatory arthritis picture (S06, DDX S06-003): symmetric joint involvement or extra-articular features.
const inflammatory = a => [is(a, K.sym6, 'Yes') && said(a, K.sym6), has(a, K.extra6) && ![NA, 'None'].includes(a[K.extra6]) && said(a, K.extra6)].filter(Boolean);
// Subacromial bursitis (S03, DDX S03-002): bursal thickening or fluid on ultrasound, relief from a diagnostic injection.
const bursal = a => [is(a, K.bursa3, 'Mild', 'Moderate', 'Severe') && said(a, K.bursa3), is(a, K.inj3, 'Yes') && said(a, K.inj3)].filter(Boolean);

// ---------- the 11 branch decision points (Workflow Guide, Step 2; first match wins) ----------
const IMG_W = { [IMG.humerus]: 'S08', [IMG.clavicle]: 'S09', [IMG.scapula]: 'S10' };
const fractureSeen = a => [IMG.humerus, IMG.clavicle, IMG.scapula].includes(a[IMAGING]);

export const SCREENS = [
  {
    id: 'B1', n: 1, name: 'Fracture / dislocation', short: 'Fracture', shape: 'triangle', wrappers: ['S08', 'S09', 'S10'],
    doc: 'fracture/dislocation screen', ask: 'Did an injury leave a deformity, or does imaging show a fracture?',
    questions: [K.deform8, K.deform9, IMAGING, K.neer8, K.allman, K.ideberg],
    evaluate: a => {
      const s = surgeryOf(a);
      const deform = present(a, K.deform8) || present(a, K.deform9);
      // Cross-reference: a fracture around an existing replacement is S13's "Periprosthetic humeral fracture".
      if (a[IMAGING] === IMG.humerus && s.any && s.proc?.group === 'S13' && s.thisSide) {
        return { state: 'clear', assumed: [], note: 'Fracture next to a shoulder replacement: S13 "Periprosthetic humeral fracture" owns it, so this screen steps aside for B2.' };
      }
      const r = decide(a, {
        signals: [
          fractureSeen(a) && `Imaging: ${a[IMAGING]}`,
          deform && a[IMAGING] === IMG.notYet && `${present(a, K.deform8) ? said(a, K.deform8) : said(a, K.deform9)}, not imaged yet: treat as a fracture until X-ray says otherwise`,
          is(a, K.mech10, 'High-energy trauma for fracture') && 'High-energy injury recorded at the red-flag screen (S10 mechanism)',
        ],
        needs: [K.deform8, K.deform9, IMAGING],
      });
      if (r.state === 'fires') r.hints = fractureSeen(a) ? [{ w: IMG_W[a[IMAGING]], why: a[IMAGING] }] : null;
      if (r.state === 'clear' && deform && a[IMAGING] === IMG.none) r.note = 'Deformity with no fracture on imaging: a dislocation is looked for at the instability screen (B6).';
      return r;
    },
  },
  {
    id: 'B2', n: 2, name: 'Prior joint replacement', short: 'Arthroplasty', shape: 'diamond', wrappers: ['S13'], halt: true,
    doc: 'prior arthroplasty screen', ask: 'Does this shoulder have a joint replacement?',
    questions: [K.arthro], fromHistory: true,
    evaluate: a => {
      const s = surgeryOf(a);
      if (!s.known) return { state: 'open', missing: [COL.surgery], note: 'Answer "Previous shoulder surgery" in History.' };
      if (s.any && !s.proc) return { state: 'open', missing: [COL.surgery + '::procedure'], note: 'Pick the procedure in History.' };
      if (s.unknown) return { state: 'clear', assumed: ['Previous shoulder surgery: Not assessed'] };
      if (s.any && s.proc.group === 'S13' && s.thisSide) return { state: 'fires', signals: [`History: ${s.proc.l || s.proc.v}`] };
      return { state: 'clear', assumed: [], note: s.any ? `${s.proc.l || s.proc.v} is not a joint replacement${s.thisSide ? '' : ' (and it was the other shoulder)'}.` : 'No previous shoulder surgery.' };
    },
  },
  {
    id: 'B3', n: 3, name: 'Prior other surgery', short: 'Post-op', shape: 'square', wrappers: ['S12'],
    doc: 'prior non-arthroplasty surgery screen', ask: 'Is the patient here because of a recent operation on this shoulder?',
    questions: [K.proc12, K.week12], fromHistory: true,
    evaluate: a => {
      const s = surgeryOf(a);
      if (!s.known) return { state: 'open', missing: [COL.surgery], note: 'Answer "Previous shoulder surgery" in History.' };
      if (s.unknown) return { state: 'clear', assumed: ['Previous shoulder surgery: Not assessed'] };
      if (!s.any) return { state: 'clear', assumed: [], note: 'No previous shoulder surgery.' };
      if (!s.proc) return { state: 'open', missing: [COL.surgery + '::procedure'], note: 'Pick the procedure in History.' };
      if (!s.thisSide) return { state: 'clear', assumed: [], note: 'The surgery was on the other shoulder.' };
      const g = s.proc.group;
      if (g === 'none') return { state: 'clear', assumed: [], note: `"${s.proc.v}" is an earlier, unrelated operation: recorded only.` };
      if (g !== 'S12' && g !== 'S12-other') {
        const owner = g === 'fracture' ? 'the fracture screen (B1)' : g === 'S13' ? 'B2' : `${g} (its own post-operative fields)`;
        return { state: 'clear', assumed: [], note: `"${s.proc.v}" is handled by ${owner}, not S12.` };
      }
      if (!has(a, COL.surgery + '::index')) return { state: 'open', missing: [COL.surgery + '::index'], note: 'Say in History whether this surgery is the reason for the visit.' };
      if (s.index !== 'Yes') return { state: 'clear', assumed: [], note: 'Earlier surgery, not the reason for this visit (S12 records carry "index procedure for this record").' };
      const wk = num(a, K.week12);
      if (wk != null && wk > 52) return { state: 'clear', assumed: [], note: `Week ${wk} is past S12's 0-52 week range.` };
      return { state: 'fires', signals: [`History: ${s.proc.l || s.proc.v}, the reason for this visit${wk != null ? `, week ${wk}` : ''}`] };
    },
  },
  {
    id: 'B4', n: 4, name: 'Vascular', short: 'Vascular', shape: 'cross', wrappers: ['S15'], halt: true,
    doc: 'vascular screen', ask: 'Any sign that the arm\'s circulation is affected?',
    questions: [K.pulse, K.colour, K.venous, K.onset15],
    evaluate: a => decide(a, {
      signals: [is(a, K.pulse, 'Reduced on affected side', 'Absent on affected side') && said(a, K.pulse), has(a, K.colour) && a[K.colour] !== 'Symmetric' && a[K.colour] !== NA && said(a, K.colour), present(a, K.venous) && said(a, K.venous), has(a, K.onset15) && a[K.onset15] !== NA && said(a, K.onset15)],
      needs: [K.pulse, K.colour, K.venous, K.onset15],
    }),
  },
  {
    id: 'B5', n: 5, name: 'Frozen shoulder', short: 'Capsular', shape: 'pentagon', wrappers: ['S05'],
    doc: 'capsular-pattern screen', ask: 'Is passive movement restricted in every direction, external rotation most (capsular pattern)?',
    questions: [K.rom5, K.kl6, K.endfeel5], draft: true,
    evaluate: a => {
      const v = a[K.rom5];
      if (!has(a, K.rom5)) return { state: 'open', missing: [K.rom5] };
      if (v === FULL_ROM) return { state: 'clear', assumed: [], note: 'Full passive range.' };
      if (v === NA) return { state: 'clear', assumed: ['Passive ROM: Not assessed'] };
      const p = capsularPattern(typeof v === 'object' ? v : parseRom3(v));
      if (!p) return { state: 'open', missing: [K.rom5] };
      if (!p.capsular) return { state: 'clear', assumed: [], note: `Not a capsular pattern (ER −${Math.round(p.loss.er * 100)}%, ABD −${Math.round(p.loss.abd * 100)}%, IR −${Math.round(p.loss.ir * 100)}%).` };
      if (!has(a, K.kl6)) return { state: 'open', missing: [K.kl6], note: 'Capsular pattern found. Check the X-ray: arthritis also stiffens every direction.' };
      if (is(a, K.kl6, 'Grade 2', 'Grade 3', 'Grade 4')) return { state: 'clear', assumed: [], note: `Capsular-looking stiffness, but ${a[K.kl6]} arthritis on X-ray: left for the arthritic group (S06) in B10.` };
      if (is(a, 'Onset', 'Acute (<2 weeks)', 'Congenital-Developmental')) return { state: 'clear', assumed: [], note: `Onset "${a.Onset}" does not fit the slow, staged course of adhesive capsulitis.` };
      return { state: 'fires', signals: [`Capsular pattern: ER −${Math.round(p.loss.er * 100)}%, ABD −${Math.round(p.loss.abd * 100)}%, IR −${Math.round(p.loss.ir * 100)}% (vs ${ROM_NORM.er}/${ROM_NORM.abd}/${ROM_NORM.ir}°)`, a[K.kl6] === NA ? 'X-ray not done (adhesive capsulitis needs no imaging abnormality)' : `X-ray ${a[K.kl6]}`] };
    },
  },
  {
    id: 'B6', n: 6, name: 'Instability', short: 'Instability', shape: 'wedge', wrappers: ['S02'],
    doc: 'instability screen', ask: 'Does the shoulder slip out, feel loose, or test positive for instability or SLAP?',
    questions: [K.episodes2, K.appr2, K.reloc2, K.sulcus2, K.obrien2, K.jerk2, K.kim2, K.shift2, K.drawer2, K.labrum2, K.hs2],
    evaluate: a => decide(a, {
      signals: [num(a, K.episodes2) >= 1 && `${num(a, K.episodes2)} prior dislocation episode${num(a, K.episodes2) > 1 ? 's' : ''}`, ...[K.appr2, K.reloc2, K.sulcus2, K.obrien2, K.jerk2, K.kim2, K.shift2, K.drawer2].map(k => positive(a, k) && said(a, k)),
        has(a, K.labrum2) && ![NA, 'None'].includes(a[K.labrum2]) && said(a, K.labrum2), is(a, K.hs2, 'Yes') && said(a, K.hs2)],
      needs: [K.episodes2, K.appr2, K.reloc2, K.sulcus2, K.obrien2],
    }),
  },
  {
    id: 'B7', n: 7, name: 'AC / SC joint', short: 'AC/SC', shape: 'gem', wrappers: ['S04', 'S07'],
    doc: 'AC/SC-joint screen', ask: 'Is the AC joint (top of the shoulder) or the SC joint (breastbone end) tender or deformed?',
    questions: [K.ac4, K.sc7, K.cba4, K.comp4, K.obrienAc4, K.piano4, K.rock4, K.inj4, K.serial7, K.seren7],
    evaluate: a => {
      // Besides tenderness: a positive joint-specific test, an injury on X-ray, or relief from a diagnostic injection.
      // Cross-body adduction alone does not count: S03 records it for impingement too.
      const ac = acSigns(a), sc = scSigns(a);
      const r = decide(a, { signals: [present(a, K.ac4) && said(a, K.ac4), present(a, K.sc7) && said(a, K.sc7), ...ac, ...sc], needs: [K.ac4, K.sc7] });
      if (r.state === 'fires') r.hints = [(present(a, K.ac4) || ac.length > 0) && { w: 'S04', why: 'AC joint finding' }, (present(a, K.sc7) || sc.length > 0) && { w: 'S07', why: 'SC joint finding' }].filter(Boolean);
      return r;
    },
  },
  {
    id: 'B8', n: 8, name: 'Neurological', short: 'Neuro', shape: 'star', wrappers: ['S14', 'S16'], draft: true,
    doc: 'neurological screen', ask: 'Numbness, tingling or a positional TOS test, or one nerve\'s muscles weak?',
    questions: [K.c8t1, K.roos14, K.adson14, K.wright14, K.costo14, K.ultt14, K.site14, K.rib14, K.ribx14, K.derm16, K.axil16, K.lt16, K.sa16, K.supra16, K.emg16, K.notch16],
    evaluate: a => {
      const weak = k => num(a, k) != null && num(a, k) <= 3;
      const emgAbn = String(a[K.emg16] || '').startsWith('Abnormal');
      const notch = is(a, K.notch16, 'Suprascapular', 'Spinoglenoid notch');
      const tos = [...tosSigns(a)];
      const nerve = [String(a[K.derm16] || '').match(/^(Reduced|Absent)/) && said(a, K.derm16), weak(K.axil16) && `${lab(K.axil16)} ${num(a, K.axil16)}/5`, weak(K.lt16) && `${lab(K.lt16)} ${num(a, K.lt16)}/5`, weak(K.sa16) && `${lab(K.sa16)} ${num(a, K.sa16)}/5`,
        // Cuff tears weaken infra/supraspinatus too, so this nerve only counts with abnormal EMG or a compression site on MRI.
        weak(K.supra16) && (emgAbn || notch) && `${lab(K.supra16)} ${num(a, K.supra16)}/5 with ${emgAbn ? 'abnormal EMG' : `MRI compression at the ${a[K.notch16].toLowerCase()}`}`];
      const r = decide(a, { signals: [...tos, ...nerve], needs: [K.c8t1, K.roos14, K.adson14, K.derm16] });
      if (r.state === 'fires') r.hints = [tos.some(Boolean) && { w: 'S14', why: 'C8-T1 / positional TOS signs' }, nerve.some(Boolean) && { w: 'S16', why: 'Named-nerve or dermatomal deficit' }].filter(Boolean);
      return r;
    },
  },
  {
    id: 'B9', n: 9, name: 'Paediatric / congenital', short: 'Paediatric', shape: 'circle', wrappers: ['S17'],
    doc: 'paediatric/congenital screen', ask: 'Is this birth-related, congenital or a childhood condition?',
    questions: [K.onset17, K.birth17, K.osx17, K.ospal17],
    evaluate: a => {
      if (a.Onset === 'Congenital-Developmental') return { state: 'fires', signals: ['Onset: Congenital-Developmental (Patient stop)'] };
      // Os acromiale (DDX S17-004, 15-30 years) is a developmental anomaly that becomes painful in adults.
      const os = listed([is(a, K.osx17, 'Yes') && said(a, K.osx17), String(a[K.ospal17] || '').startsWith('Present') && said(a, K.ospal17)]);
      if (os.length) return { state: 'fires', signals: os };
      if (!has(a, 'Age')) return { state: 'open', missing: ['Age'], note: 'Enter the age on the Patient stop.' };
      const age = num(a, 'Age');
      if (age != null && age >= 18) return { state: 'clear', assumed: [], note: `Adult (${age}) and the onset is not congenital.` };
      const r = decide(a, { signals: [has(a, K.onset17) && a[K.onset17] !== NA && said(a, K.onset17), is(a, K.birth17, 'Shoulder dystocia', 'Traction injury') && said(a, K.birth17)], needs: [K.onset17] });
      return r;
    },
  },
  {
    id: 'B10', n: 10, name: 'Mechanical / arthritic / scapular', short: 'Default', shape: 'square', wrappers: ['S01', 'S03', 'S06', 'S11', 'S10'],
    doc: 'default mechanical/arthritic/scapular groups', ask: 'Pain with movement, a positive cuff or impingement test, grinding, or a scapular problem?',
    questions: [K.arc, K.emptycan, K.fullcan, K.liftoff, K.speeds, K.lag01, K.drop01, K.belly01, K.yerg01, K.mri01, K.us01, K.hawkins, K.neer, K.sat3, K.bursa3, K.inj3, K.crepitus6, K.kl6, K.sym6, K.extra6, K.dysk11, K.onset11, K.wing10, K.snap10],
    evaluate: a => {
      const arc = has(a, K.arc) && String(a[K.arc]).startsWith('Present');
      const kl = is(a, K.kl6, 'Grade 2', 'Grade 3', 'Grade 4');
      const dysk = String(a[K.dysk11] || '').startsWith('Dyskinesis Present');
      const cuff = [K.emptycan, K.fullcan, K.liftoff, K.speeds, K.lag01, K.drop01, K.belly01, K.yerg01].filter(k => positive(a, k));
      const mri = parseMri(a[K.mri01]), us = parseUsSize(a[K.us01]);
      const tear = listed([mri && mri.tear !== 'None' && `MRI: ${mri.tear} tear`, us != null && `Ultrasound: ${us} mm tear`]);
      const imp = arc || positive(a, K.hawkins) || positive(a, K.neer) || present(a, K.sat3) || bursal(a).length > 0;
      const infl = inflammatory(a);
      const hints = [
        (cuff.length || tear.length) && { w: 'S01', why: cuff.length ? `${cuff.map(lab).join(', ')} positive: rotator cuff / biceps` : tear.join('; ') },
        imp && !cuff.length && !tear.length && { w: 'S03', why: 'Painful arc / impingement or bursal signs with the cuff tests not positive' },
        (present(a, K.crepitus6) || kl || infl.length) && { w: 'S06', why: kl ? `X-ray ${a[K.kl6]}` : infl.length ? infl.join('; ') : 'Crepitus' },
        (dysk || present(a, K.wing10)) && { w: 'S11', why: dysk ? a[K.dysk11] : 'Scapular winging (no fracture)' },
        present(a, K.snap10) && { w: 'S10', why: 'Scapulothoracic snapping (the non-fracture part of S10)' },
      ].filter(Boolean);
      const r = decide(a, {
        signals: [arc && said(a, K.arc), ...cuff.map(k => said(a, k)), ...tear, ...[K.hawkins, K.neer].map(k => positive(a, k) && said(a, k)), present(a, K.sat3) && said(a, K.sat3), ...bursal(a), present(a, K.crepitus6) && said(a, K.crepitus6), kl && `X-ray ${a[K.kl6]}`, ...infl, dysk && said(a, K.dysk11), present(a, K.wing10) && said(a, K.wing10), present(a, K.snap10) && said(a, K.snap10)],
        needs: [K.arc, K.emptycan, K.lag01, K.drop01, K.mri01, K.hawkins, K.crepitus6, K.sym6, K.dysk11, K.wing10, K.snap10],
      });
      if (r.state === 'fires') r.hints = hints;
      return r;
    },
  },
  {
    id: 'B11', n: 11, name: 'Rare / uncertain (fallback)', short: 'Fallback', shape: 'circle', wrappers: ['S18'],
    doc: 'S18 fallback', ask: 'Nothing above fits.',
    questions: [],
    evaluate: () => ({ state: 'fires', signals: ['No earlier decision point matched'] }),
  },
];
export const SCREEN = Object.fromEntries(SCREENS.map(s => [s.id, s]));

// ---------- the node walk: inside a branch, down to one wrapper ----------
// A branch that holds more than one wrapper (B1, B7, B8, B10, and red flag SH-RF-07's three fracture wrappers) is
// walked node by node, the way the Knee CDSS walks its branches (kneeCdssV2 stage 03b): each node asks one question,
// and each answer either ends at a wrapper or leads to the next node. A case goes into exactly one primary wrapper
// (Workflow Guide, section 3). Node questions use only findings available before the wrapper is opened.
//   test(a)    the engine's reading of the answers: a reason (string) when the option fits, else false
//   next / to  the next node, or the wrapper where the walk ends
//   needs      questions that must be answered before the engine may say that nothing fits
//   choice     several options may fit at once; then the clinician picks (no engine answer)
//   hold(a)    a reason the engine must not answer this node, and the clinician picks
// When no option fits, the engine's answer is the honest exit the Knee CDSS gives every node (ruling 9): "None of
// these fit - clinician review", ending in S18, the guide's "none of the above fit clearly" group.
// The node order inside B10 and the MRC threshold are ours (draft, for clinical sign-off), built on the DDX rules.
export const EXIT = { v: 'exit', l: 'None of these fit - clinician review', to: 'S18', exit: true };
const weakDirs = a => { const m = parseMmt3(a[K.mmt01]); return m ? [['ER', m.er], ['IR', m.ir], ['Abd', m.abd]].filter(([, g]) => g <= 4) : []; };
const reflexDown = a => { const r = a[K.reflex16]; return r && typeof r === 'object' ? ['biceps', 'triceps'].filter(s => /diminished/.test(String(r[s]))) : []; };
const listed = xs => xs.filter(Boolean);

export const NODES = [
  // B1: the fracture wrappers. Imaging decides; before the X-ray, the site of the deformity does.
  {
    id: 'B1.1', branch: 'B1', name: 'Fracture site', ask: 'Which bone does the X-ray or CT show broken?',
    questions: [IMAGING], needs: [IMAGING],
    options: [
      { v: 'humerus', l: 'Proximal humerus', to: 'S08', test: a => a[IMAGING] === IMG.humerus && 'Imaging: proximal humerus fracture' },
      { v: 'clavicle', l: 'Clavicle', to: 'S09', test: a => a[IMAGING] === IMG.clavicle && 'Imaging: clavicle fracture' },
      { v: 'scapula', l: 'Scapula or glenoid', to: 'S10', test: a => a[IMAGING] === IMG.scapula && 'Imaging: scapula / glenoid fracture' },
      { v: 'notYet', l: 'Not imaged yet', next: 'B1.2', test: a => (a[IMAGING] === IMG.notYet || a[IMAGING] === NA) && 'Not imaged yet' },
      { v: 'none', l: 'No fracture on imaging', next: 'B1.3', test: a => a[IMAGING] === IMG.none && 'No fracture on imaging' },
    ],
  },
  {
    id: 'B1.2', branch: 'B1', name: 'Site of the deformity', ask: 'Not imaged yet: where is the injury? (An X-ray confirms it.)',
    questions: [K.deform8, K.deform9, K.mech10], needs: [K.deform8, K.deform9, K.mech10], choice: true,
    options: [
      { v: 'humerus', l: 'Upper arm / shoulder', to: 'S08', test: a => present(a, K.deform8) && said(a, K.deform8) },
      { v: 'clavicle', l: 'Collarbone', to: 'S09', test: a => present(a, K.deform9) && said(a, K.deform9) },
      { v: 'scapula', l: 'Shoulder blade, after a high-energy injury', to: 'S10', test: a => is(a, K.mech10, 'High-energy trauma for fracture') && said(a, K.mech10) },
    ],
  },
  {
    id: 'B1.3', branch: 'B1', name: 'High-energy, no fracture', ask: 'No fracture on imaging. Was it a high-energy injury to the shoulder girdle (scapulothoracic injury)?',
    questions: [K.mech10, K.nv10], needs: [K.mech10],
    options: [{ v: 'yes', l: 'Yes: high-energy injury', to: 'S10', test: a => is(a, K.mech10, 'High-energy trauma for fracture') && said(a, K.mech10) }],
  },

  // B7: AC joint (S04) or SC joint (S07): the tender joint decides; if both are tender, their own tests do.
  {
    id: 'B7.1', branch: 'B7', name: 'Which joint', ask: 'Which joint is tender, swollen or deformed?',
    questions: [K.ac4, K.sc7], needs: [K.ac4, K.sc7],
    options: [
      { v: 'both', l: 'Both joints', next: 'B7.2', test: a => present(a, K.ac4) && present(a, K.sc7) && 'Both the AC and the SC joint are tender' },
      { v: 'ac', l: 'AC joint (top of the shoulder)', to: 'S04', test: a => present(a, K.ac4) && said(a, K.ac4) },
      { v: 'sc', l: 'SC joint (breastbone end)', to: 'S07', test: a => present(a, K.sc7) && said(a, K.sc7) },
      { v: 'neither', l: 'Neither is tender', next: 'B7.2', otherwise: true },
    ],
  },
  {
    id: 'B7.2', branch: 'B7', name: 'AC or SC tests', ask: 'Both joints are tender, or neither is. Which joint do the tests, X-ray or injection point to?',
    questions: [K.cba4, K.comp4, K.obrienAc4, K.piano4, K.rock4, K.inj4, K.serial7, K.seren7], needs: [K.cba4, K.comp4, K.serial7], choice: true,
    options: [
      // With a tender AC joint ruled out as the only finding, cross-body adduction counts here as an AC test.
      { v: 'ac', l: 'AC joint', to: 'S04', test: a => { const s = [positive(a, K.cba4) && said(a, K.cba4), ...acSigns(a)].filter(Boolean); return s.length > 0 && s.join('; '); } },
      { v: 'sc', l: 'SC joint', to: 'S07', test: a => { const s = scSigns(a); return s.length > 0 && s.join('; '); } },
    ],
  },

  // B8: a named shoulder nerve (S16), the thoracic outlet (S14), or a plexus / root pattern (S16).
  {
    id: 'B8.1', branch: 'B8', name: 'Named shoulder nerve', ask: 'Is a named shoulder nerve weak (MRC 3 or less)?',
    questions: [K.axil16, K.lt16, K.sa16, K.supra16, K.emg16, K.notch16], needs: [K.axil16, K.lt16, K.sa16, K.supra16],
    options: [
      {
        v: 'yes', l: 'Yes', to: 'S16',
        test: a => {
          const weak = k => num(a, k) != null && num(a, k) <= 3;
          // Cuff tears weaken infra/supraspinatus too, so that nerve counts only with abnormal EMG or a notch on MRI (as at B8).
          const supra = weak(K.supra16) && (String(a[K.emg16] || '').startsWith('Abnormal') || is(a, K.notch16, 'Suprascapular', 'Spinoglenoid notch'));
          const hits = listed([weak(K.axil16) && K.axil16, weak(K.lt16) && K.lt16, weak(K.sa16) && K.sa16, supra && K.supra16]);
          return hits.length > 0 && hits.map(k => `${lab(k)} ${num(a, k)}/5`).join('; ');
        },
      },
      { v: 'no', l: 'No', next: 'B8.2', otherwise: true },
    ],
  },
  {
    id: 'B8.2', branch: 'B8', name: 'Thoracic outlet signs', ask: 'Positional thoracic outlet signs, ulnar-border (C8-T1) sensory change, a cervical rib, or a compression site on MRI/CT?',
    questions: [K.c8t1, K.roos14, K.adson14, K.wright14, K.costo14, K.ultt14, K.site14, K.rib14, K.ribx14], needs: [K.c8t1, K.roos14, K.adson14],
    options: [
      { v: 'yes', l: 'Yes', to: 'S14', test: a => { const s = tosSigns(a); return s.length > 0 && s.join('; '); } },
      { v: 'no', l: 'No', next: 'B8.3', otherwise: true },
    ],
  },
  {
    id: 'B8.3', branch: 'B8', name: 'Plexus or root pattern', ask: 'Dermatomal sensory loss, a diminished reflex, or an abnormal EMG?',
    questions: [K.derm16, K.reflex16, K.emg16], needs: [K.derm16],
    options: [{ v: 'yes', l: 'Yes', to: 'S16', test: a => { const s = listed([is(a, K.derm16, 'Reduced', 'Absent') && said(a, K.derm16), reflexDown(a).length > 0 && `Reflex diminished: ${reflexDown(a).join(', ')}`, String(a[K.emg16] || '').startsWith('Abnormal') && said(a, K.emg16)]); return s.length > 0 && s.join('; '); } }],
  },

  // B10: structural findings first (arthritis, then a cuff tear), then the scapula, then the provocation tests.
  {
    id: 'B10.1', branch: 'B10', name: 'Arthritis on X-ray', ask: 'Does the X-ray show glenohumeral arthritis (Kellgren-Lawrence grade 2 or higher)?',
    questions: [K.kl6], needs: [K.kl6],
    options: [
      { v: 'yes', l: 'Yes: grade 2-4', to: 'S06', test: a => is(a, K.kl6, 'Grade 2', 'Grade 3', 'Grade 4') && `X-ray Kellgren-Lawrence ${a[K.kl6]}` },
      { v: 'no', l: 'No, or not X-rayed', next: 'B10.2', otherwise: true },
    ],
  },
  {
    id: 'B10.2', branch: 'B10', name: 'Inflammatory arthritis', ask: 'Other joints involved symmetrically, or extra-articular features (nodules, eye, skin, lung)?',
    questions: [K.sym6, K.extra6], needs: [K.sym6],
    options: [
      { v: 'yes', l: 'Yes', to: 'S06', test: a => { const s = inflammatory(a); return s.length > 0 && s.join('; '); } },
      { v: 'no', l: 'No', next: 'B10.3', otherwise: true },
    ],
  },
  {
    id: 'B10.3', branch: 'B10', name: 'Cuff tear on imaging', ask: 'Does MRI or ultrasound show a rotator cuff tear?',
    questions: [K.mri01, K.us01], needs: [K.mri01],
    options: [
      { v: 'yes', l: 'Yes', to: 'S01', test: a => { const m = parseMri(a[K.mri01]); const us = parseUsSize(a[K.us01]); const s = listed([m && m.tear !== 'None' && `MRI: ${m.tear} tear`, us != null && `Ultrasound: ${us} mm tear`]); return s.length > 0 && s.join('; '); } },
      { v: 'no', l: 'No tear, or not imaged', next: 'B10.4', otherwise: true },
    ],
  },
  {
    id: 'B10.4', branch: 'B10', name: 'Lag or drop-arm sign', ask: 'An external rotation lag sign or a positive drop arm test?',
    questions: [K.lag01, K.drop01], needs: [K.lag01, K.drop01],
    options: [
      { v: 'yes', l: 'Yes', to: 'S01', test: a => { const s = [K.lag01, K.drop01].filter(k => positive(a, k)); return s.length > 0 && s.map(k => said(a, k)).join('; '); } },
      { v: 'no', l: 'No', next: 'B10.5', otherwise: true },
    ],
  },
  {
    id: 'B10.5', branch: 'B10', name: 'Joint grinding', ask: 'Grinding in the glenohumeral joint (crepitus)?',
    questions: [K.crepitus6], needs: [K.crepitus6],
    options: [
      { v: 'yes', l: 'Yes', to: 'S06', test: a => present(a, K.crepitus6) && said(a, K.crepitus6) },
      { v: 'no', l: 'No', next: 'B10.6', otherwise: true },
    ],
  },
  {
    id: 'B10.6', branch: 'B10', name: 'Snapping scapula', ask: 'Snapping or grinding under the shoulder blade on arm elevation?',
    questions: [K.snap10], needs: [K.snap10],
    options: [
      { v: 'yes', l: 'Yes', to: 'S10', test: a => present(a, K.snap10) && said(a, K.snap10) },
      { v: 'no', l: 'No', next: 'B10.7', otherwise: true },
    ],
  },
  {
    id: 'B10.7', branch: 'B10', name: 'Scapular dyskinesis', ask: 'Watching the shoulder blade during arm raising and lowering: is its movement abnormal?',
    questions: [K.dysk11], needs: [K.dysk11],
    options: [
      { v: 'yes', l: 'Yes', to: 'S11', test: a => String(a[K.dysk11] || '').startsWith('Dyskinesis Present') && said(a, K.dysk11) },
      { v: 'no', l: 'No', next: 'B10.8', otherwise: true },
    ],
  },
  {
    id: 'B10.8', branch: 'B10', name: 'Winging, normal rhythm', ask: 'Winging while the shoulder blade otherwise moves normally (lifted off the chest wall, e.g. by a bursa)?',
    questions: [K.wing10, K.dysk11], needs: [K.wing10],
    hold: a => present(a, K.wing10) && a[K.dysk11] === NA && 'Winging with the scapular rhythm not assessed: true winging (S11) or a bursa lifting the blade (S10)? Assess the rhythm, or choose.',
    options: [
      { v: 'yes', l: 'Yes', to: 'S10', test: a => present(a, K.wing10) && a[K.dysk11] === 'Normal' && `${said(a, K.wing10)}, scapular rhythm normal` },
      { v: 'no', l: 'No', next: 'B10.9', otherwise: true },
    ],
  },
  {
    id: 'B10.9', branch: 'B10', name: 'Cuff or biceps test', ask: 'A cuff or biceps test positive, or true weakness (MRC 4 or less)?',
    questions: [K.emptycan, K.fullcan, K.liftoff, K.belly01, K.speeds, K.yerg01, K.mmt01], needs: [K.emptycan, K.mmt01],
    options: [
      { v: 'yes', l: 'Yes', to: 'S01', test: a => { const w = weakDirs(a); const s = listed([...[K.emptycan, K.fullcan, K.liftoff, K.belly01, K.speeds, K.yerg01].map(k => positive(a, k) && said(a, k)), w.length > 0 && `Weakness: ${w.map(([d, g]) => `${d} ${g}/5`).join(', ')}`]); return s.length > 0 && s.join('; '); } },
      { v: 'no', l: 'No', next: 'B10.10', otherwise: true },
    ],
  },
  {
    id: 'B10.10', branch: 'B10', name: 'Impingement or bursitis', ask: 'Painful arc, a positive Hawkins-Kennedy or Neer test, tenderness under the acromion, or a thickened bursa on ultrasound / relief from a subacromial injection?',
    questions: [K.arc, K.hawkins, K.neer, K.sat3, K.bursa3, K.inj3], needs: [K.arc, K.hawkins],
    options: [{ v: 'yes', l: 'Yes', to: 'S03', test: a => { const s = listed([String(a[K.arc] || '').startsWith('Present') && said(a, K.arc), ...[K.hawkins, K.neer].map(k => positive(a, k) && said(a, k)), present(a, K.sat3) && said(a, K.sat3), ...bursal(a)]); return s.length > 0 && s.join('; '); } }],
  },
];
export const NODE = Object.fromEntries(NODES.map(n => [n.id, n]));
export const NODE_START = { B1: 'B1.1', B7: 'B7.1', B8: 'B8.1', B10: 'B10.1' };

// The engine's answer at one node. A yes/no node answers "yes" on the first sign, like a decision point. A node with
// several possible answers waits until every needed question is answered, so a later answer cannot change it.
export function answerNode(node, a) {
  const held = node.hold && node.hold(a);
  if (held) return { option: null, hold: true, note: held };
  const missing = node.needs.filter(k => !has(a, k) && !(Q[k]?.when && !Q[k].when(a)));
  const tests = node.options.filter(o => !o.otherwise);
  const fired = tests.map(o => ({ o, s: o.test(a) })).filter(x => x.s);
  if (tests.length === 1 && fired.length) return { option: fired[0].o, signals: [fired[0].s] };
  if (missing.length) return { option: null, missing };
  if (node.choice && fired.length > 1) return { option: null, conflict: fired.map(x => x.o.v), note: `More than one answer fits (${fired.map(x => x.s).join(' / ')}). Choose one.` };
  if (fired.length) return { option: fired[0].o, signals: [fired[0].s] };
  return { option: node.options.find(o => o.otherwise) || EXIT, signals: [], assumed: node.needs.filter(k => assumption(a, k)).map(k => said(a, k)) };
}
// Which branch a red flag lands in (the flag's wrapper sits in exactly one branch, except S10: its emergencies are fractures).
export const FLAG_BRANCH = { 'SH-RF-01': 'B7', 'SH-RF-02': 'B2', 'SH-RF-03': 'B4', 'SH-RF-04': 'B4', 'SH-RF-05': 'B11', 'SH-RF-06': 'B1', 'SH-RF-07': 'B1', 'SH-RF-08': 'B8', 'SH-RF-09': 'B9' };
export const BRANCH_COLORS = Object.fromEntries(SCREENS.map(s => [s.id, `--b${s.n}`]));
