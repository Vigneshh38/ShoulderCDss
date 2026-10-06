// Set A: the 24 common fields that every wrapper's Medical Record Library starts with.
//   - Core block, columns A-M (13 fields)
//   - Shared history / screening block (11 fields, added 2026-09-29)
// The type and allowed values of each field are identical in all 18 groups
// (Shoulder_CDSS_Field_Rule_Logic_Library.xlsx, sheet Layer1_Field_Validators).
// `key` is the exact MRL column header, so a serialized record drops straight into any wrapper.
//
// Field types (same as the S01 form):
//   text                     free text (optional `suggestions`)
//   int, dec                 numeric with inclusive [min, max]; out-of-range is rejected, never clamped
//   select                   single value from `options` (`specify` = option that opens a free-text box)
//   multi                    multi-select from `options` (`specify` = option that opens a free-text box,
//                            `other` = extra free-text box for values not in `options`)
//   bool                     Yes / No
//   ynText                   Yes / No, then free text when Yes
//   derived                  computed from other fields
//   system                   supplied by the host app, not rendered as an input

const SECTIONS = [
  { id: 'core', title: 'Core block (columns A-M)' },
  { id: 'hist', title: 'Shared history and screening' },
];

const FIELDS = [
  // Core block A-M
  { key: 'Case ID', section: 'core', type: 'system' },
  // Not limited to whole years: S17 records children's ages to one decimal (e.g. 4.4).
  { key: 'Age', section: 'core', type: 'dec', min: 0, max: 120, decimals: 1, unit: 'years', required: true, help: 'Whole years for adults. Children may use one decimal (e.g. 4.4).' },
  { key: 'Gender', section: 'core', type: 'select', options: ['Male', 'Female', 'Other', 'Prefer not to say'], required: true },
  { key: 'BMI', section: 'core', type: 'dec', min: 10, max: 60, decimals: 1, unit: 'kg/m²', required: true },
  // Free text with a recommended list, so `other` adds a free-text box for anything not on it.
  { key: 'Co-morbidities', section: 'core', type: 'multi', options: ['None', 'Diabetes Mellitus', 'Thyroid Disease', 'Rheumatoid/Inflammatory Arthritis', 'Cardiac Disease', 'Renal Disease', 'Osteoporosis', 'Malignancy (specify)'], specify: 'Malignancy (specify)', other: true },
  { key: 'Medication History', section: 'core', type: 'text', help: 'Always note blood thinners (anticoagulants/antiplatelets) and corticosteroids.' },
  { key: 'Occupation', section: 'core', type: 'text', help: 'Jobs with a lot of overhead work are flagged (relevant to S01, S03, S11, S14).' },
  { key: 'Activity Level', section: 'core', type: 'select', options: ['Sedentary', 'Light', 'Moderate', 'Vigorous', 'Competitive Athlete'], required: true },
  { key: 'Laterality', section: 'core', type: 'select', options: ['Left', 'Right', 'Bilateral'], required: true },
  { key: 'Pain_Location', label: 'Pain Location', section: 'core', type: 'select', options: ['Anterior', 'Posterior', 'Lateral (deltoid region)', 'Superior (AC/SC)', 'Diffuse', 'Radiating below elbow', 'Other (specify)'], specify: 'Other (specify)', required: true },
  { key: 'Pain_Nature', label: 'Pain Nature', section: 'core', type: 'select', options: ['Sharp', 'Dull ache', 'Burning', 'Throbbing', 'Catching', 'Electric-shock-like', 'Mixed'], required: true },
  { key: 'Pain_Intensity', label: 'Pain Intensity (NRS)', section: 'core', type: 'int', min: 0, max: 10, unit: '/10', required: true, help: '0 = no pain, 10 = worst pain imaginable.' },
  { key: 'Onset', section: 'core', type: 'select', options: ['Acute (<2 weeks)', 'Subacute (2-12 weeks)', 'Chronic (>12 weeks)', 'Insidious', 'Congenital-Developmental'], required: true, help: 'Each wrapper adds its own, more detailed onset field later.' },

  // Shared history / screening block
  { key: 'Dominant Arm (Right/Left/Ambidextrous)', label: 'Dominant Arm', section: 'hist', type: 'select', options: ['Right', 'Left', 'Ambidextrous'], required: true },
  { key: 'Affected Side Is Dominant (Y/N)', label: 'Affected Side Is Dominant', section: 'hist', type: 'derived' },
  { key: 'Previous Shoulder Surgery - Any (Y/N, procedure/date if known)', label: 'Previous Shoulder Surgery (any)', section: 'hist', type: 'ynText', placeholder: 'Procedure and approximate date', required: true, help: 'Includes shoulder replacement. Set B Branches 2 and 3 use this answer.' },
  { key: 'Previous Episode(s) of Same Complaint (Y/N)', label: 'Previous Episode(s) of Same Complaint', section: 'hist', type: 'bool', required: true },
  { key: 'Previous Treatment Received (physiotherapy/injection/surgery/none)', label: 'Previous Treatment Received', section: 'hist', type: 'multi', options: ['None', 'Physiotherapy', 'Corticosteroid Injection', 'Surgery', 'Medication only'] },
  { key: 'Aggravating Factors', section: 'hist', type: 'text', suggestions: ['Overhead activity', 'Lying on affected side', 'Lifting', 'Reaching behind back'] },
  { key: 'Easing Factors', section: 'hist', type: 'text', suggestions: ['Rest', 'Sling', 'Position change', 'Ice', 'Heat', 'Medication'] },
  { key: 'Night Pain (Y/N)', label: 'Night Pain', section: 'hist', type: 'bool', required: true },
  { key: 'Sleep Disturbance Due to Pain (Y/N)', label: 'Sleep Disturbance Due to Pain', section: 'hist', type: 'bool', required: true },
  { key: 'Smoking Status', section: 'hist', type: 'select', options: ['Never', 'Former', 'Current'], required: true },
  { key: 'Cervical Spine Screen (Clear/Not Clear - referred-pain differential)', label: 'Cervical Spine (Neck) Screen', section: 'hist', type: 'select', options: ['Clear', 'Not Clear (refer for cervical spine assessment)'], required: true, help: '"Not Clear" does not rule out a shoulder problem, but must be written in Red Flags / Precautions before the Diagnosis is locked.' },
];

export const SET_A = { SECTIONS, FIELDS };
