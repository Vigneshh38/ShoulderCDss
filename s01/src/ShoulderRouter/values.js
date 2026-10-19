// Value helpers shared by the routing spec and the engine. No React, no DOM.
//
// An answer is one of three things, never two:
//   undefined / ''   blank: nobody asked yet
//   NA               the clinician looked and could not answer ("Not assessed"); never read as "No"
//   a value          a finding, in the exact cell wording of the Golden Dataset
export const NA = '__na__';

export const has = (a, k) => a[k] !== undefined && a[k] !== null && a[k] !== '';
export const is = (a, k, ...vals) => vals.includes(a[k]);
export const num = (a, k) => {
  if (!has(a, k) || a[k] === NA) return null;
  const n = Number(a[k]);
  return Number.isFinite(n) ? n : null;
};
// Answers that were given but are not a finding: they let a screen pass, and are listed as assumptions.
export const SOFT = new Set([NA, 'Not Performed', 'Not Yet Performed', 'Equivocal']);

// ---------- composite cells (formats taken from the Golden Datasets) ----------

// S05 "ER 80 / ABD 165 / IR 65"
export function parseRom3(s) {
  const m = /ER\s*([\d.]+)\s*\/\s*ABD\s*([\d.]+)\s*\/\s*IR\s*([\d.]+)/i.exec(String(s || ''));
  return m ? { er: Number(m[1]), abd: Number(m[2]), ir: Number(m[3]) } : null;
}
export const formatRom3 = r => `ER ${r.er} / ABD ${r.abd} / IR ${r.ir}`;

// Reference full passive range used to express restriction as a percentage (draft, for clinician sign-off).
export const ROM_NORM = { er: 90, abd: 180, ir: 70 };
// Capsular pattern (S05 field header: "ER > Abduction > IR"): every direction restricted, external rotation
// restricted the most. Thresholds are a draft, calibrated against the S05 Golden Dataset, not taken from a document.
export const CAPSULAR = { minEr: 0.25, minAbd: 0.08, minIr: 0.05 };
export function capsularPattern(r) {
  if (!r) return null;
  const loss = {
    er: Math.max(0, 1 - r.er / ROM_NORM.er),
    abd: Math.max(0, 1 - r.abd / ROM_NORM.abd),
    ir: Math.max(0, 1 - r.ir / ROM_NORM.ir),
  };
  const global = loss.er >= CAPSULAR.minEr && loss.abd >= CAPSULAR.minAbd && loss.ir >= CAPSULAR.minIr;
  const erMost = loss.er >= loss.abd && loss.er >= loss.ir;
  return { loss, global, erMost, capsular: global && erMost };
}

// S13 "No" | "Yes (Temp 39.0 C)"
export function parseFever(s) {
  const t = String(s || '');
  if (/^no/i.test(t)) return { yn: 'No' };
  const m = /yes(?:\s*\(temp\s*([\d.]+)\s*c\))?/i.exec(t);
  return m ? { yn: 'Yes', temp: m[1] ? Number(m[1]) : null } : null;
}
export const formatFever = f => (f.yn === 'Yes' ? (f.temp != null && f.temp !== '' ? `Yes (Temp ${Number(f.temp).toFixed(1)} C)` : 'Yes') : 'No');

// S15 "Affected 28.3 cm vs Unaffected 28.3 cm (diff 0.0 cm)"
export function parseGirth(s) {
  const m = /Affected\s*([\d.]+)\s*cm\s*vs\s*Unaffected\s*([\d.]+)/i.exec(String(s || ''));
  return m ? { aff: Number(m[1]), un: Number(m[2]) } : null;
}
export const girthDiff = g => (g && Number.isFinite(g.aff) && Number.isFinite(g.un) ? Math.round((g.aff - g.un) * 10) / 10 : null);
export const formatGirth = g => `Affected ${Number(g.aff).toFixed(1)} cm vs Unaffected ${Number(g.un).toFixed(1)} cm (diff ${girthDiff(g).toFixed(1)} cm)`;

// S16 "Biceps 2+ (normal), Triceps 2+ (normal)". The options are the grades this column holds in the S16 workbook
// ("2+ (normal)" and "0"-"3 (diminished)": the workbook labels every non-normal grade "diminished"), plus the two
// Layer 1 grades it never uses ("3+ (brisk)", "4+ (clonus)"). A grade starting with "0" is an absent reflex.
export const REFLEX = ['2+ (normal)', '0 (diminished)', '1 (diminished)', '2 (diminished)', '3 (diminished)', '3+ (brisk)', '4+ (clonus)'];
export function parseReflex(s) {
  const m = /Biceps\s+(.+?),\s*Triceps\s+(.+)$/.exec(String(s || '').trim());
  return m ? { biceps: m[1].trim(), triceps: m[2].trim() } : null;
}
export const formatReflex = r => `Biceps ${r.biceps}, Triceps ${r.triceps}`;

// S01 "ER:4/IR:4/Abd:4" (MRC 0-5)
export function parseMmt3(s) {
  const m = /^ER:([0-5])\/IR:([0-5])\/Abd:([0-5])$/.exec(String(s || '').trim());
  return m ? { er: Number(m[1]), ir: Number(m[2]), abd: Number(m[3]) } : null;
}
export const formatMmt3 = m => `ER:${m.er}/IR:${m.ir}/Abd:${m.abd}`;

// S01 "Tear: Partial-thickness; Goutallier: Grade 1"
export function parseMri(s) {
  const m = /^Tear: (.+); Goutallier: (Grade [0-4])$/.exec(String(s || '').trim());
  return m ? { tear: m[1], grade: m[2] } : null;
}

// S01 "12 mm"
export function parseUsSize(s) {
  const m = /^(\d+(?:\.\d+)?) mm$/.exec(String(s || '').trim());
  return m ? Number(m[1]) : null;
}

// S12 "Week 1.0 (Phase 1)"
export const parseWeek = s => {
  const m = /Week\s*([\d.]+)/i.exec(String(s || ''));
  return m ? Number(m[1]) : null;
};
