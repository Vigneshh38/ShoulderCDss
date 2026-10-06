// Set B: the branch questions that send a case to one wrapper.
//
// Order and wrappers come from Shoulder_CDSS_Workflow_and_Navigation_Guide.docx:
//   Section 2, Step 2  - the order of the screens (the "Branch Flow Decision Points")
//   Section 3 table    - which wrapper(s) each presenting picture leads to
// Ask the branches in order and stop at the first "Yes". When a branch holds more than one
// wrapper, a second question picks the wrapper. Branch 10 is a pick-only branch. Branch 11
// (S18) is the fallback when nothing fits.
//
// `help` lines that send a case to a later branch keep each of the 97 conditions in its own
// wrapper (Condition Master List, Layer3_DDX_Rules), even though the screens run in a fixed order.
// `hint` reads Set A and only suggests; it never answers for the clinician.

const has = (raw, k, v) => raw[k] === v;

export const FRACTURE_SITES = [
  { wrapper: 'S08', label: 'Upper arm near the shoulder (proximal humerus)', detail: 'Includes greater tuberosity avulsion and a fracture through a known bone lesion.' },
  { wrapper: 'S09', label: 'Collarbone (clavicle)', detail: 'Includes a birth-related collarbone fracture and a fracture that has not healed (non-union).' },
  { wrapper: 'S10', label: 'Shoulder blade (scapula), including the glenoid', detail: 'Body, neck or glenoid fracture, or scapulothoracic dissociation.' },
];

export const BRANCHES = [
  {
    id: 'B1', title: 'Fracture / dislocation', wrappers: ['S08', 'S09', 'S10'],
    question: 'Is there a fracture (broken bone) of the upper arm, collarbone or shoulder blade? This includes a new fracture, a fracture-dislocation, and a fracture that has not healed.',
    help: [
      'A dislocation with no fracture: answer No. Branch 6 (shoulder joint, S02) or Branch 7 (AC or SC joint) picks it up.',
      'A Hill-Sachs or bony Bankart lesion after a dislocation: answer No. It is an S02 condition (Branch 6).',
      'A fracture around a shoulder replacement: answer No. Branch 2 (S13) picks it up.',
      'An old fracture that has healed: answer No.',
    ],
    pick: { question: 'Which bone?', options: FRACTURE_SITES },
  },
  {
    id: 'B2', title: 'Shoulder replacement (arthroplasty)', wrappers: ['S13'], needsSurgery: true,
    question: 'Does the patient have a shoulder replacement (arthroplasty) with a problem: infection, instability or dislocation, loosening, a fracture around the implant, or rotator cuff failure after a reverse replacement?',
    help: ['A replacement with none of these problems: answer No.'],
  },
  {
    id: 'B3', title: 'Other shoulder surgery', wrappers: ['S12'], needsSurgery: true,
    question: 'Has the patient had recent, documented shoulder surgery that was not a replacement? For example: rotator cuff repair, Bankart repair, Latarjet, SLAP repair or subacromial decompression.',
    help: [],
  },
  {
    id: 'B4', title: 'Blood vessels (vascular)', wrappers: ['S15'],
    question: 'Is there sudden swelling or colour change of the arm, a pulse difference between the arms, or a pulsing lump or bruit (a whooshing sound through a stethoscope) above the collarbone?',
    help: [],
  },
  {
    id: 'B5', title: 'Stiff in all directions (capsular pattern)', wrappers: ['S05'],
    question: 'Is the shoulder stiff in all directions, even when someone else moves it (passive movement), with turning outwards (external rotation) the most limited, and did it come on slowly, in stages?',
    help: [],
  },
  {
    id: 'B6', title: 'Unstable shoulder joint (instability)', wrappers: ['S02'],
    question: 'Is the apprehension or relocation test positive, is there a history of dislocation or partial dislocation (subluxation), is the joint generally loose (positive sulcus sign), or is O\'Brien\'s test positive (suggests a SLAP lesion)?',
    help: [],
  },
  {
    id: 'B7', title: 'AC or SC joint', wrappers: ['S04', 'S07'],
    question: 'Is the tenderness, swelling or deformity in the AC joint (top of the shoulder) or the SC joint (where the collarbone meets the breastbone)?',
    help: [],
    hint: raw => (has(raw, 'Pain_Location', 'Superior (AC/SC)') ? 'Set A: Pain Location is "Superior (AC/SC)".' : ''),
    pick: {
      question: 'Which joint?',
      options: [
        { wrapper: 'S04', label: 'AC joint (acromioclavicular), on top of the shoulder', detail: 'Sprain, separation, arthritis or distal clavicle osteolysis.' },
        { wrapper: 'S07', label: 'SC joint (sternoclavicular), where the collarbone meets the breastbone', detail: 'Sprain, dislocation, instability, arthritis or condensing osteitis.' },
      ],
    },
  },
  {
    id: 'B8', title: 'Nerves (neurological)', wrappers: ['S14', 'S16'],
    question: 'Is there a nerve problem: arm symptoms in certain positions with positive provocative tests, or weakness or numbness from a named nerve or the brachial plexus (the nerve bundle to the arm)?',
    help: ['A birth-related brachial plexus palsy (Erb\'s or Klumpke\'s): answer No. It is an S17 condition (Branch 9).'],
    hint: raw => (has(raw, 'Pain_Location', 'Radiating below elbow') ? 'Set A: Pain Location is "Radiating below elbow".' : ''),
    pick: {
      question: 'Which pattern?',
      options: [
        { wrapper: 'S14', label: 'Arm symptoms in certain positions, with positive provocative tests, in a C8-T1 pattern', detail: 'Thoracic outlet syndrome, nerve type.' },
        { wrapper: 'S16', label: 'Weakness or numbness of a named nerve, or a brachial plexus injury', detail: 'Axillary, suprascapular, long thoracic or spinal accessory nerve; traumatic plexus injury; Parsonage-Turner syndrome.' },
      ],
    },
  },
  {
    id: 'B9', title: 'Children and conditions from birth', wrappers: ['S17'],
    question: 'Is this a birth-related or congenital (present from birth) problem, or a childhood condition such as juvenile arthritis?',
    help: [
      'Includes Erb\'s and Klumpke\'s palsy, Sprengel deformity, os acromiale, glenoid dysplasia and juvenile idiopathic arthritis.',
      'A birth-related collarbone fracture is an S09 condition (Branch 1).',
    ],
    hint: raw => {
      const out = [];
      if (has(raw, 'Onset', 'Congenital-Developmental')) out.push('Set A: Onset is "Congenital-Developmental".');
      if (raw['Age'] !== undefined && raw['Age'] !== '' && Number(raw['Age']) <= 16) out.push(`Set A: Age is ${Number(raw['Age'])}.`);
      return out.join(' ');
    },
  },
  {
    id: 'B10', title: 'Common shoulder problems (default groups)', wrappers: ['S01', 'S03', 'S06', 'S11', 'S10'], pickOnly: true,
    question: 'Which picture fits best?',
    help: [],
    pick: {
      question: 'Which picture fits best?',
      options: [
        { wrapper: 'S01', label: 'Painful arc, positive Empty Can / Full Can test, weakness, but normal passive movement', detail: 'Rotator cuff and biceps.' },
        { wrapper: 'S03', label: 'Painful arc with normal cuff strength, and MRI shows no tear', detail: 'Impingement and bursitis.' },
        { wrapper: 'S06', label: 'Grinding (crepitus) and joint-space narrowing on X-ray, with or without positive blood tests (serology)', detail: 'Arthritis.' },
        { wrapper: 'S11', label: 'Shoulder blade sticks out (winging) or moves abnormally, with no fracture', detail: 'Scapular dyskinesis.' },
        { wrapper: 'S10', label: 'Snapping or grinding under the shoulder blade, or scapulothoracic bursitis, with no fracture', detail: 'S10\'s non-fracture conditions (from the Condition Master List).' },
        { wrapper: 'S18', label: 'None of these fit clearly', detail: 'Goes to the S18 fallback (Branch 11).' },
      ],
    },
  },
  {
    id: 'B11', title: 'Fallback: rare or uncertain', wrappers: ['S18'], fallback: true,
    question: 'None of the branches fit clearly.',
    help: [],
  },
];
