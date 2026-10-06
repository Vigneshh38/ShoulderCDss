# Shoulder CDSS (Clinical Decision Support System)

Comprehensive Clinical Decision Support System (CDSS) for Shoulder Pathologies covering conditions S01 through S18, including Golden Datasets, Field Rule Logic Documents, Interaction Matrices, and interactive Intake Forms.

## Repository Overview

```
.
├── logic_docs/       # Master system flows, field interaction matrices, and CDSS validation requirements
├── s01/              # Interactive React Intake Form for S01 Rotator Cuff & Biceps Tendon Pathology
│   ├── demo/         # Interactive Vite demo harness
│   ├── src/          # React component, schema, rules engine, and protocols
│   └── package.json
└── wrappers/         # Golden datasets & field rule logic documents across modules (S01 – S18)
    ├── S01/          # Rotator Cuff & Biceps Tendon Pathology
    ├── S02/          # Glenohumeral Instability & Labral Injuries
    ├── S03/          # Subacromial Impingement Syndrome & Subacromial-Subdeltoid Bursitis
    ├── S04/          # Acromioclavicular (AC) Joint Pathology
    ├── S05/          # Adhesive Capsulitis (Frozen Shoulder)
    ├── S06/          # Glenohumeral Osteoarthritis & Inflammatory Arthropathy
    ├── S07/          # Sternoclavicular (SC) Joint Pathology
    ├── S08/          # Proximal Humerus Fractures
    ├── S09/          # Clavicle Fractures
    ├── S10/          # Scapular Fractures & Scapulothoracic Disorders
    ├── S11/          # Scapular Dyskinesis & Periscapular Muscle Dysfunction
    ├── S12/          # Post-Surgical Rotator Cuff Repair & Stabilization
    ├── S13/          # Periprosthetic Joint Infection & Post-Arthroplasty Complications
    ├── S14/          # Thoracic Outlet Syndrome (Neurogenic)
    ├── S15/          # Thoracic Outlet Syndrome (Vascular)
    ├── S16/          # Brachial Plexus & Peripheral Nerve Injuries
    ├── S17/          # Pediatric & Congenital Shoulder Conditions
    └── S18/          # Miscellaneous Rare & Diagnostically Uncertain Conditions
```

## Getting Started (S01 Intake Form Demo)

```bash
cd s01
npm install
npm run dev
```

Open [http://localhost:5501](http://localhost:5501) to explore the S01 intake form demo.
