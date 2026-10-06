// The 18 shoulder wrappers (condition groups).
// Names and halt-group flags from Shoulder_CDSS_Master_System_Flow_and_Document_Guide.docx, Sections 5 and 6.
export const WRAPPERS = {
  S01: { name: 'Rotator Cuff and Biceps Tendon Pathology' },
  S02: { name: 'Glenohumeral Instability and Labral Injuries' },
  S03: { name: 'Subacromial Impingement Syndrome and Subacromial/Subdeltoid Bursitis' },
  S04: { name: 'Acromioclavicular (AC) Joint Pathology' },
  S05: { name: 'Adhesive Capsulitis (Frozen Shoulder)' },
  S06: { name: 'Glenohumeral Osteoarthritis and Inflammatory Arthropathy' },
  S07: { name: 'Sternoclavicular (SC) Joint Pathology' },
  S08: { name: 'Proximal Humerus Fractures' },
  S09: { name: 'Clavicle Fractures' },
  S10: { name: 'Scapular Fractures and Scapulothoracic Disorders' },
  S11: { name: 'Scapular Dyskinesis and Periscapular Muscle Dysfunction' },
  S12: { name: 'Post-Surgical Rotator Cuff Repair and Stabilization' },
  S13: { name: 'Periprosthetic Joint Infection and Post-Arthroplasty Complications', halt: 'Halt group: Phase 1 is an urgent-referral pathway with referral-only protocols. Normal rehab (Phase 2-4) starts only after the case is cleared. This wrapper has no PROM fields.' },
  S14: { name: 'Thoracic Outlet Syndrome - Neurogenic' },
  S15: { name: 'Thoracic Outlet Syndrome - Vascular', halt: 'Halt group: Phase 1 is an urgent vascular-referral pathway with referral-only protocols, until imaging excludes thrombosis or aneurysm. This wrapper has no PROM fields.' },
  S16: { name: 'Brachial Plexus and Peripheral Nerve Injuries' },
  S17: { name: 'Pediatric and Congenital Shoulder Conditions' },
  S18: { name: 'Miscellaneous Rare and Diagnostically Uncertain Conditions', halt: 'One diagnosis here ("Primary/metastatic tumour of proximal humerus or scapula") is Phase 1 and referral-only. The other 6 diagnoses follow normal phases.' },
};

// Conditions that sit close to another wrapper, taken from the Condition Master List
// (Shoulder_CDSS_Field_Rule_Logic_Library.xlsx, sheet Layer3_DDX_Rules). Shown as "also check" notes.
export const CROSS_REFS = {
  S01: [{ to: 'S06', note: 'Rotator cuff tear arthropathy: the early (pre-arthritic) form is S01, the advanced (Hamada stage) form is S06.' }],
  S02: [
    { to: 'S03', note: 'Internal impingement in throwing athletes and instability-related secondary impingement are S03 conditions.' },
    { to: 'S16', note: 'Axillary nerve palsy after a dislocation is an S16 condition.' },
  ],
  S03: [{ to: 'S02', note: 'Secondary impingement caused by instability: S02 covers the instability itself.' }],
  S06: [{ to: 'S01', note: 'Rotator cuff tear arthropathy: the early (pre-arthritic) form is S01, the advanced (Hamada stage) form is S06.' }],
  S08: [{ to: 'S13', note: 'A fracture around a shoulder replacement (periprosthetic humeral fracture) is S13.' }],
  S10: [{ to: 'S11', note: 'Scapular winging or abnormal scapular movement without snapping or bursitis is S11.' }],
  S11: [{ to: 'S16', note: 'Serratus anterior palsy (long thoracic nerve) and trapezius palsy (spinal accessory nerve) are listed in both S11 and S16.' }],
  S12: [{ to: 'S05', note: 'A shoulder that becomes stiff in all directions weeks to months after surgery is S05 (secondary adhesive capsulitis, post-surgical).' }],
  S14: [{ to: 'S16', note: 'A traumatic brachial plexus injury with a real nerve deficit is S16.' }],
  S16: [
    { to: 'S11', note: 'Long thoracic and spinal accessory nerve palsy are listed in both S16 and S11.' },
    { to: 'S14', note: 'Traction-type brachial plexus irritation with normal nerve conduction is an S14 condition.' },
  ],
};
