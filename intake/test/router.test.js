// Run with: npm test   (Node's built-in test runner, no extra packages)
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, validateSetA, checkRedFlags, walkSetB, clearAfter, serialize, parse, emptyAnswers, SURGERY_KEY } from '../src/IntakeRouter/rules.js';
import { SET_A } from '../src/IntakeRouter/setA.js';
import { RED_FLAGS } from '../src/IntakeRouter/redFlags.js';
import { BRANCHES } from '../src/IntakeRouter/setB.js';
import { WRAPPERS } from '../src/IntakeRouter/wrappers.js';
import { SAMPLE_CASES } from '../demo/sampleCases.js';

const ALL = Object.keys(WRAPPERS);
const adult = () => parse(SAMPLE_CASES[0].record);
const noFlags = () => ({ ...emptyAnswers(), rf: Object.fromEntries(RED_FLAGS.map(r => [r.id, 'No'])) });
// Answers "No" to every branch before `id`, then `ans` (and an optional pick) at `id`.
const upTo = (id, ans = 'Yes', pick) => {
  const a = noFlags();
  for (const b of BRANCHES) {
    if (b.id === id) { if (!b.pickOnly) a.b[id] = ans; if (pick) a.bPick[id] = pick; break; }
    if (!b.pickOnly) a.b[b.id] = 'No';
  }
  return a;
};

test('Set A has the 24 shared fields: 13 core (A-M) + 11 history', () => {
  assert.equal(SET_A.FIELDS.length, 24);
  assert.equal(SET_A.FIELDS.filter(f => f.section === 'core').length, 13);
  assert.equal(SET_A.FIELDS.filter(f => f.section === 'hist').length, 11);
  assert.equal(new Set(SET_A.FIELDS.map(f => f.key)).size, 24);
});

test('both sample rows pass Set A', () => {
  for (const s of SAMPLE_CASES) {
    const r = validateSetA(parse(s.record));
    assert.ok(r.ok, `${s.label}: ${JSON.stringify(r.errors)}`);
  }
});

test('Set A rejects out-of-range and wrong values, never clamps', () => {
  const raw = adult();
  assert.ok(validateSetA({ ...raw, Age: '121' }).errors.Age);
  assert.ok(validateSetA({ ...raw, Age: '4.45' }).errors.Age, 'more than one decimal');
  assert.ok(!validateSetA({ ...raw, Age: '4.4' }).errors.Age, 'children use one decimal');
  assert.ok(validateSetA({ ...raw, Pain_Intensity: '11' }).errors.Pain_Intensity);
  assert.ok(validateSetA({ ...raw, Pain_Intensity: '5.5' }).errors.Pain_Intensity);
  assert.ok(validateSetA({ ...raw, BMI: '9.9' }).errors.BMI);
  assert.ok(validateSetA({ ...raw, BMI: '46' }).warnings.BMI, 'outside 12-45 is a flag, not an error');
  assert.ok(validateSetA({ ...raw, Pain_Location: 'Deep/diffuse shoulder' }).errors.Pain_Location);
  assert.ok(validateSetA({ ...raw, Gender: '' }).errors.Gender);
});

test('Affected Side Is Dominant is derived, not copied from the stored value', () => {
  // The stored S01-C-000004 value is "Yes", but Right side + Left dominant = No.
  assert.equal(serialize(adult())['Affected Side Is Dominant (Y/N)'], 'No');
  const bil = { ...adult(), Laterality: 'Bilateral' };
  assert.ok(validateSetA(bil).errors['Affected Side Is Dominant (Y/N)'], 'must be chosen for Bilateral');
});

test('Co-morbidities accepts free text, but not together with None', () => {
  const k = 'Co-morbidities';
  assert.ok(validateSetA({ ...adult(), [k]: [], [k + '::other']: 'Hypertension' }).ok);
  assert.ok(validateSetA({ ...adult(), [k]: ['None'], [k + '::other']: 'Hypertension' }).errors[k]);
  const p = parse({ ...SAMPLE_CASES[0].record, [k]: 'Diabetes Mellitus; Anxiety/Depression (self-reported, non-diagnostic)' });
  assert.deepEqual(p[k], ['Diabetes Mellitus']);
  assert.equal(p[k + '::other'], 'Anxiety/Depression (self-reported, non-diagnostic)');
});

test('serialize -> parse keeps every Set A value', () => {
  for (const s of SAMPLE_CASES) {
    const once = serialize(parse(s.record), s.record['Case ID']);
    assert.deepEqual(serialize(parse(once), s.record['Case ID']), once);
  }
});

test('flow stops at Set A until it is valid', () => {
  assert.equal(evaluate(parse({}), noFlags()).stage, 'setA');
});

test('red-flag check needs an answer for all 9 flags', () => {
  assert.equal(RED_FLAGS.length, 9);
  assert.deepEqual(RED_FLAGS.map(r => r.id), ['01', '02', '03', '04', '05', '06', '07', '08', '09'].map(n => `SH-RF-${n}`));
  const a = noFlags(); delete a.rf['SH-RF-05'];
  const ev = evaluate(adult(), a);
  assert.equal(ev.stage, 'redflags');
  assert.deepEqual(ev.rf.unanswered, ['SH-RF-05']);
});

test('each red flag routes to its wrapper and skips Set B', () => {
  const expect = { 'SH-RF-01': 'S07', 'SH-RF-02': 'S13', 'SH-RF-03': 'S15', 'SH-RF-04': 'S15', 'SH-RF-05': 'S18', 'SH-RF-06': 'S10', 'SH-RF-08': 'S16', 'SH-RF-09': 'S17' };
  for (const [id, w] of Object.entries(expect)) {
    const a = noFlags(); a.rf[id] = 'Yes';
    a.b.B1 = 'Yes'; a.bPick.B1 = 'S08'; // Set B answers must be ignored
    const ev = evaluate(adult(), a);
    assert.equal(ev.stage, 'done', id);
    assert.equal(ev.route.via, 'redflag');
    assert.equal(ev.route.wrapper, w, id);
  }
});

test('SH-RF-07 (open fracture) needs the bone before it routes', () => {
  const a = noFlags(); a.rf['SH-RF-07'] = 'Yes';
  assert.equal(evaluate(adult(), a).stage, 'redflags');
  for (const w of ['S08', 'S09', 'S10']) {
    a.rfPick['SH-RF-07'] = w;
    assert.equal(evaluate(adult(), a).route.wrapper, w);
  }
  a.rfPick['SH-RF-07'] = 'S01';
  assert.equal(evaluate(adult(), a).stage, 'redflags', 'only S08/S09/S10 are allowed');
});

test('red flags pointing to different wrappers need one primary wrapper', () => {
  const a = noFlags(); a.rf['SH-RF-01'] = 'Yes'; a.rf['SH-RF-05'] = 'Yes';
  const ev = evaluate(adult(), a);
  assert.equal(ev.stage, 'redflags');
  assert.ok(ev.rf.needPrimary);
  a.rfPrimary = 'S18';
  assert.equal(evaluate(adult(), a).route.wrapper, 'S18');
  a.rfPrimary = 'S01';
  assert.equal(evaluate(adult(), a).stage, 'redflags', 'primary must be one of the flagged wrappers');
  // SH-RF-03 and SH-RF-04 both go to S15: no choice needed.
  const b = noFlags(); b.rf['SH-RF-03'] = 'Yes'; b.rf['SH-RF-04'] = 'Yes';
  assert.equal(evaluate(adult(), b).route.wrapper, 'S15');
});

test('Set B order follows the Workflow guide, Section 2 Step 2', () => {
  assert.deepEqual(BRANCHES.map(b => b.wrappers.join('/')), [
    'S08/S09/S10', 'S13', 'S12', 'S15', 'S05', 'S02', 'S04/S07', 'S14/S16', 'S17', 'S01/S03/S06/S11/S10', 'S18',
  ]);
});

test('every wrapper S01-S18 can be reached through Set B', () => {
  const surgeryRaw = { ...adult(), [SURGERY_KEY]: 'Yes', [SURGERY_KEY + '::text']: 'Arthroscopic rotator cuff repair 2025' };
  const reached = new Set();
  for (const br of BRANCHES) {
    if (br.fallback) continue;
    const raw = br.needsSurgery ? surgeryRaw : adult();
    const picks = br.pick ? br.pick.options.map(o => o.wrapper) : [null];
    for (const p of picks) {
      const ev = evaluate(raw, upTo(br.id, 'Yes', p || undefined));
      assert.equal(ev.stage, 'done', `${br.id} ${p}`);
      const want = p || br.wrappers[0];
      assert.equal(ev.route.wrapper, want, `${br.id} ${p}`);
      assert.equal(ev.route.branch, want === 'S18' ? 'B11' : br.id);
      reached.add(ev.route.wrapper);
    }
  }
  assert.deepEqual([...reached].sort(), ALL);
});

test('a branch with several wrappers waits for the pick', () => {
  for (const id of ['B1', 'B7', 'B8', 'B10']) {
    const ev = evaluate(adult(), upTo(id, 'Yes'));
    assert.equal(ev.stage, 'setB', id);
    assert.equal(ev.setB.current, id);
    assert.ok(ev.setB.needPick, id);
  }
});

test('the first Yes wins; later answers are ignored', () => {
  const a = upTo('B1', 'Yes', 'S09');
  a.b.B4 = 'Yes';
  const ev = evaluate(adult(), a);
  assert.equal(ev.route.wrapper, 'S09');
  assert.deepEqual(ev.route.path.map(p => p.branch), ['B1']);
});

test('Set B asks one branch at a time', () => {
  const a = noFlags(); a.b.B1 = 'No';
  assert.equal(walkSetB(adult(), a).current, 'B2');
});

test('Branches 2 and 3 cannot be Yes when Set A says no previous surgery', () => {
  for (const id of ['B2', 'B3']) {
    const ev = evaluate(adult(), upTo(id, 'Yes'));
    assert.equal(ev.stage, 'setB', id);
    assert.match(ev.setB.conflict, /Previous Shoulder Surgery/);
  }
});

test('changing an earlier answer clears the answers after it', () => {
  const a = upTo('B4', 'Yes');
  const cleared = clearAfter(a, 'B2');
  assert.deepEqual(Object.keys(cleared.b), ['B1', 'B2']);
});

test('pick options only use wrappers listed on their branch (or the S18 fallback)', () => {
  for (const br of BRANCHES) {
    for (const w of br.wrappers) assert.ok(WRAPPERS[w], `${br.id}: ${w}`);
    if (br.pick) for (const o of br.pick.options) assert.ok(br.wrappers.includes(o.wrapper) || o.wrapper === 'S18', `${br.id}: ${o.wrapper}`);
  }
  for (const r of RED_FLAGS) for (const w of r.wrappers) assert.ok(WRAPPERS[w], `${r.id}: ${w}`);
});

test('halt groups carry their warning in the result', () => {
  const s15 = evaluate(adult(), upTo('B4', 'Yes')).route;
  assert.equal(s15.wrapper, 'S15');
  assert.match(s15.halt, /Halt group/);
  const s05 = evaluate(adult(), upTo('B5', 'Yes')).route;
  assert.equal(s05.halt, '');
});

test('all red flags answered No: the check is done and nothing is flagged', () => {
  const a = noFlags();
  assert.ok(checkRedFlags(a).done);
  assert.equal(checkRedFlags(a).positive.length, 0);
});
