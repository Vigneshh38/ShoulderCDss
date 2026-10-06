// S01 - Rotator Cuff and Biceps Tendon Pathology
// Field schema for the Medical Record Library intake, taken from S01_Field_Rule_Logic_Document.docx.
// `key` is the exact MRL column header so a serialized record drops straight into the workbook.
//
// Field types:
//   text, textarea           free text
//   int, dec                 numeric with inclusive [min, max]; out-of-range is rejected, never clamped
//   select                   single value from `options` (`specify` = option that opens a free-text box)
//   multi                    multi-select checkboxes from `options` (`other` = adds free-text box)
//   bool                     Yes / No
//   ynText, ynDate           Yes / No, then free text or a date when Yes
//   weeks                    numeric weeks, serialized as "<n> weeks"
//   mmt                      ER / IR / Abd, each 0-5, serialized as "ER:x/IR:y/Abd:z"
//   mri                      tear grade + Goutallier grade, serialized as "Tear: X; Goutallier: Grade N"
//   usSize                   mm, or "not applicable" when there is no structural tear
//   derived                  computed from other fields (see s01_form.js)
//   protocol                 foreign key into PROTOCOLS (protocols.js)
//   system                   supplied by the host app, not rendered as an input
const TEST = ['Positive', 'Negative', 'Equivocal', 'Not Performed'];
const ARC = ['Absent', 'Present 0-60 deg', 'Present 60-120 deg', 'Present 120-180 deg'];
const PHASES = ['Phase 1', 'Phase 2', 'Phase 3', 'Phase 4'];

// Section 6 - Diagnosis Logic (Condition Master List). Age band is cross-checked, not blocked.
const CONDITIONS = [
  { name: 'Supraspinatus tendinopathy', age: [35, 60], ddx: 'Painful arc without night-only mechanical locking; positive Empty Can, normal passive ROM' },
  { name: 'Partial-thickness rotator cuff tear', age: [40, 65], ddx: 'Weakness with preserved passive ROM; MRI partial-thickness signal, no full discontinuity' },
  { name: 'Full-thickness rotator cuff tear (single or multi-tendon)', age: [50, 75], ddx: 'Positive Drop Arm/Lag signs; MRI full-thickness discontinuity, retraction' },
  { name: 'Subscapularis tear', age: [45, 70], ddx: 'Positive Lift-Off and Belly Press with increased passive ER' },
  { name: 'Long head of biceps tendinopathy', age: [30, 55], ddx: "Anterior groove tenderness, positive Speed's/Yergason's, normal cuff strength" },
  { name: 'Biceps tendon subluxation/dislocation', age: [30, 55], ddx: 'Palpable/audible snap over bicipital groove on rotation' },
  { name: 'Rotator cuff tear arthropathy (early, pre-arthritic)', age: [65, 85], ddx: 'Longstanding massive cuff tear with pseudoparalysis, preserved joint space on X-ray' },
];
const S18 = 'Other/Unclassified (route to S18 workflow review)';

const SECTIONS = [
  { id: 'demo', title: 'Demographics' },
  { id: 'hist', title: 'History' },
  { id: 'exam', title: 'Examination' },
  { id: 'tests', title: 'Special Tests' },
  { id: 'imaging', title: 'Imaging' },
  { id: 'dx', title: 'Diagnosis & Outcome Scores' },
  { id: 'plan', title: 'Rehabilitation Plan' },
  { id: 'fu', title: 'Follow-up' },
];

const FIELDS = [
  // Demographics
  // System-generated or clinic-assigned, never entered by the patient. Passed in via the `caseId` prop.
  { key: 'Case ID', section: 'demo', type: 'system' },
  { key: 'Age', section: 'demo', type: 'int', min: 0, max: 120, unit: 'years', required: true },
  { key: 'Gender', section: 'demo', type: 'select', options: ['Male', 'Female', 'Other', 'Prefer not to say'], required: true },
  { key: 'BMI', section: 'demo', type: 'dec', min: 10, max: 60, decimals: 1, unit: 'kg/m²', required: true },
  { key: 'Co-morbidities', section: 'demo', type: 'multi', options: ['None', 'Diabetes Mellitus', 'Thyroid Disease', 'Rheumatoid/Inflammatory Arthritis', 'Cardiac Disease', 'Renal Disease', 'Osteoporosis', 'Malignancy (specify)'], specify: 'Malignancy (specify)' },
  { key: 'Medication History', section: 'demo', type: 'text', help: 'Flag anticoagulants/antiplatelets and corticosteroids explicitly.' },
  { key: 'Occupation', section: 'demo', type: 'text', help: 'Overhead-demand occupations are flagged for S01.' },
  { key: 'Activity Level', section: 'demo', type: 'select', options: ['Sedentary', 'Light', 'Moderate', 'Vigorous', 'Competitive Athlete'], required: true },

  // History
  { key: 'Laterality', section: 'hist', type: 'select', options: ['Left', 'Right', 'Bilateral'], required: true },
  { key: 'Dominant Arm (Right/Left/Ambidextrous)', label: 'Dominant Arm', section: 'hist', type: 'select', options: ['Right', 'Left', 'Ambidextrous'], required: true },
  { key: 'Affected Side Is Dominant (Y/N)', label: 'Affected Side Is Dominant', section: 'hist', type: 'derived', help: 'Derived from Laterality and Dominant Arm. Editable only for Bilateral or Ambidextrous.' },
  { key: 'Pain_Location', label: 'Pain Location', section: 'hist', type: 'select', options: ['Anterior', 'Posterior', 'Lateral (deltoid region)', 'Superior (AC/SC)', 'Diffuse', 'Radiating below elbow', 'Other (specify)'], specify: 'Other (specify)', required: true },
  { key: 'Pain_Nature', label: 'Pain Nature', section: 'hist', type: 'select', options: ['Sharp', 'Dull ache', 'Burning', 'Throbbing', 'Catching', 'Electric-shock-like', 'Mixed'], required: true },
  { key: 'Pain_Intensity', label: 'Pain Intensity (NRS)', section: 'hist', type: 'int', min: 0, max: 10, unit: '/10', required: true },
  { key: 'Onset', section: 'hist', type: 'select', options: ['Acute (<2 weeks)', 'Subacute (2-12 weeks)', 'Chronic (>12 weeks)', 'Insidious', 'Congenital-Developmental'], required: true },
  { key: 'Mechanism/Onset (acute traumatic fall on outstretched arm / repetitive-overhead insidious)', label: 'Mechanism of Onset', section: 'hist', type: 'select', options: ['Acute traumatic fall on outstretched arm', 'Repetitive-overhead insidious', 'Other (specify)'], specify: 'Other (specify)', required: true },
  { key: 'Time Since Onset', section: 'hist', type: 'weeks', min: 0, max: 260, decimals: 1, unit: 'weeks', required: true },
  { key: 'Previous Shoulder Surgery - Any (Y/N, procedure/date if known)', label: 'Previous Shoulder Surgery', section: 'hist', type: 'ynText', placeholder: 'Procedure and approximate date', required: true },
  { key: 'Previous Episode(s) of Same Complaint (Y/N)', label: 'Previous Episode(s) of Same Complaint', section: 'hist', type: 'bool', required: true },
  { key: 'Previous Treatment Received (physiotherapy/injection/surgery/none)', label: 'Previous Treatment Received', section: 'hist', type: 'multi', options: ['None', 'Physiotherapy', 'Corticosteroid Injection', 'Surgery', 'Medication only'] },
  { key: 'Previous Corticosteroid Injection (Y/N, date)', label: 'Previous Corticosteroid Injection', section: 'hist', type: 'ynDate', required: true },
  { key: 'Aggravating Factors', section: 'hist', type: 'text', suggestions: ['Overhead reaching', 'Overhead lifting at work', 'Lying on affected side', 'Lifting', 'Reaching behind back'] },
  { key: 'Easing Factors', section: 'hist', type: 'text', suggestions: ['Rest', 'Sling', 'Avoiding overhead position', 'Ice', 'Heat', 'Analgesic medication'] },
  { key: 'Night Pain (Y/N)', label: 'Night Pain', section: 'hist', type: 'bool', required: true },
  { key: 'Sleep Disturbance Due to Pain (Y/N)', label: 'Sleep Disturbance Due to Pain', section: 'hist', type: 'bool', required: true },
  { key: 'Smoking Status', section: 'hist', type: 'select', options: ['Never', 'Former', 'Current'], required: true },
  { key: 'Cervical Spine Screen (Clear/Not Clear - referred-pain differential)', label: 'Cervical Spine Screen', section: 'hist', type: 'select', options: ['Clear', 'Not Clear (refer for cervical spine assessment)'], required: true, help: '"Not Clear" must be documented in Red Flags before Diagnosis is locked.' },

  // Examination
  { key: 'Shoulder Flexion ROM (active/passive)', label: 'Shoulder Flexion ROM', section: 'exam', type: 'int', min: 0, max: 180, unit: 'deg', required: true },
  { key: 'Shoulder Abduction ROM (active/passive)', label: 'Shoulder Abduction ROM', section: 'exam', type: 'int', min: 0, max: 180, unit: 'deg', required: true },
  { key: 'Painful Arc (60-120 deg)', label: 'Painful Arc', section: 'exam', type: 'select', options: ARC, required: true },
  { key: 'Muscle Strength (MMT) - ER/IR/Abduction', label: 'Muscle Strength (MMT, 0-5)', section: 'exam', type: 'mmt', required: true },

  // Special tests
  { key: 'Empty Can (Jobe) Test', section: 'tests', type: 'select', options: TEST, required: true },
  { key: 'Full Can Test', section: 'tests', type: 'select', options: TEST, required: true },
  { key: 'External Rotation Lag Sign', section: 'tests', type: 'select', options: TEST, required: true },
  { key: 'Drop Arm Test', section: 'tests', type: 'select', options: TEST, required: true },
  { key: 'Lift-Off Test (subscapularis)', section: 'tests', type: 'select', options: TEST, required: true },
  { key: 'Belly Press Test', section: 'tests', type: 'select', options: TEST, required: true },
  { key: "Speed's Test (biceps)", section: 'tests', type: 'select', options: TEST, required: true },
  { key: "Yergason's Test (biceps)", section: 'tests', type: 'select', options: TEST, required: true },
  { key: 'Hawkins-Kennedy Impingement Test', section: 'tests', type: 'select', options: TEST, required: true },
  { key: 'Neer Impingement Test', section: 'tests', type: 'select', options: TEST, required: true },

  // Imaging
  { key: 'MRI_Rotator Cuff Tear Grade (partial/full-thickness) / Goutallier Fatty Infiltration Grade', label: 'MRI: Rotator Cuff Tear / Goutallier Grade', section: 'imaging', type: 'mri', required: true },
  { key: 'Ultrasound_Tendon Tear Size', label: 'Ultrasound: Tendon Tear Size', section: 'imaging', type: 'usSize', min: 0, max: 100, decimals: 1, unit: 'mm', help: 'Valid range not yet defined in the rule document; 0-100 mm used provisionally.' },
  { key: 'Acromiohumeral Distance (Ultrasound/X-Ray, mm)', label: 'Acromiohumeral Distance', section: 'imaging', type: 'dec', min: 0, max: 30, decimals: 1, unit: 'mm', help: 'Normal 7-14 mm; <7 mm suggests cuff tear / tear arthropathy.' },

  // Diagnosis & scores
  { key: 'Diagnosis', section: 'dx', type: 'select', options: CONDITIONS.map(c => c.name).concat([S18]), required: true },
  { key: 'Red Flags / Precautions', section: 'dx', type: 'text', suggestions: ['None identified', 'Cervical spine screen not clear - referred for cervical spine assessment, shoulder pathway continues in parallel', 'Night pain present - routine monitoring, no red flag confirmed on screen'], required: true },
  { key: 'Visual Analog Scale (VAS)', label: 'VAS', section: 'dx', type: 'dec', min: 0, max: 10, decimals: 1, unit: '/10', required: true },
  { key: 'ASES Score', section: 'dx', type: 'dec', min: 0, max: 100, decimals: 1, unit: '100 = best', required: true },
  { key: 'Constant-Murley Score', section: 'dx', type: 'dec', min: 0, max: 100, decimals: 1, unit: '100 = best' },
  { key: 'SPADI', section: 'dx', type: 'dec', min: 0, max: 100, decimals: 1, unit: '% · 100 = worst' },
  { key: 'DASH Score', section: 'dx', type: 'dec', min: 0, max: 100, decimals: 1, unit: '100 = worst' },
  { key: 'Functional Test', section: 'dx', type: 'select', options: ['Pass', 'Partial', 'Fail'], required: true, help: 'Record the specific test used (e.g. Overhead Reach, Apley Scratch) in Notes.' },

  // Plan
  { key: 'Rehabilitation Phase', section: 'plan', type: 'select', options: PHASES, required: true },
  { key: 'Treatment Plan Mapping (Protocol ID)', label: 'Treatment Plan (Protocol ID)', section: 'plan', type: 'protocol', required: true, help: 'Filtered to protocols matching the Diagnosis and Rehabilitation Phase.' },
  { key: 'Patient Goals / Expectations', section: 'plan', type: 'textarea' },

  // Follow-up
  { key: 'Progress / Follow-up Tracking', section: 'fu', type: 'textarea', help: 'One entry per visit, with a date.' },
  { key: 'Follow_Up_Shoulder Abduction ROM', label: 'Follow-up: Shoulder Abduction ROM', section: 'fu', type: 'int', min: 0, max: 180, unit: 'deg' },
  { key: 'Follow_Up_Empty Can/Full Can Strength', label: 'Follow-up: Empty Can/Full Can Strength', section: 'fu', type: 'int', min: 0, max: 5, unit: 'MRC 0-5' },
  { key: 'Follow_Up_ASES', label: 'Follow-up: ASES', section: 'fu', type: 'dec', min: 0, max: 100, decimals: 1 },
  { key: 'Follow_Up_Painful Arc', label: 'Follow-up: Painful Arc', section: 'fu', type: 'select', options: ARC },
  { key: 'Follow_Up_Balance and Stability', label: 'Follow-up: Balance and Stability', section: 'fu', type: 'select', options: ['Normal', 'Mild Deficit', 'Moderate Deficit', 'Severe Deficit'] },
  { key: 'Return to Activities', section: 'fu', type: 'select', options: ['Full return', 'Partial return (modified duties)', 'Not yet returned', 'Not applicable'] },
  { key: 'Notes', section: 'fu', type: 'textarea' },
];

const MRI_TEAR = ['None', 'Partial-thickness', 'Full-thickness (small <1cm)', 'Full-thickness (medium 1-3cm)', 'Full-thickness (large 3-5cm)', 'Full-thickness (massive >5cm)'];
const GOUTALLIER = ['Grade 0', 'Grade 1', 'Grade 2', 'Grade 3', 'Grade 4'];
const US_NA = 'Not applicable (no structural tear on imaging)';

export const SCHEMA = { group: 'S01', title: 'Rotator Cuff and Biceps Tendon Pathology', SECTIONS, FIELDS, CONDITIONS, S18, MRI_TEAR, GOUTALLIER, US_NA, ARC };
