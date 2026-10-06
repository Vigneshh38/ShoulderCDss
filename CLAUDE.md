# CLAUDE.md: SMAART Shoulder CDSS

Notes for anyone (people or Claude) working in this repo: what's here, how to run it, which document to trust, and **every problem found so far in the docs and data**. All numbers below were checked against the actual files on 2026-10-06.

CDSS = Clinical Decision Support System. It helps physiotherapists and clinicians enter shoulder cases, route each case to the right condition group, and pick a rehab protocol.

---

## 1. Repo map

```
logic_docs/   6 system-level documents (rules, flows, guides)
wrappers/     S01-S18: one Golden Dataset (.xlsx) + one Field Rule Logic Document (.docx) per group
s01/          React intake form for S01 (Rotator Cuff and Biceps), port 5501
intake/       React intake router: Set A -> red flags -> Set B -> wrapper, port 5502
```

| Command | What it does |
|---|---|
| `cd s01 && npm install && npm run dev` | S01 form demo at http://localhost:5501 |
| `cd intake && npm install && npm run dev` | Intake router demo at http://localhost:5502 |
| `cd intake && npm test` | 21 routing tests (Node's built-in test runner) |
| `npm run build` (in either folder) | Production build into `dist/` (git-ignored) |

There are no tests for `s01/` yet.

## 2. Words used everywhere

- **Group / wrapper (S01-S18):** a family of shoulder conditions. Each has one workbook with 3 sheets.
- **MRL (Medical Record Library):** one row per patient visit.
- **Protocol:** the exercise/treatment rows to choose from.
- **Experience Base (EB):** the log of cases where a clinician corrected the AI. The system learns from it after review.
- **Golden Dataset:** simulated (made-up) patients used to test the rules. **Never copy its rows into real records.**
- **Red flag:** a danger sign that sends the case to urgent referral (SH-RF-01 to 09).
- **Halt group:** S13 and S15. Phase 1 means "stop and refer". S18 has one diagnosis (the tumour) that works the same way.
- **PROM:** a patient questionnaire score (ASES, SPADI, DASH, ...). S13 and S15 have no PROM fields at all.
- **Three-layer engine:**
  - Layer 1 checks each field on its own (validators).
  - Layer 2 links fields across sheets (event bus).
  - Layer 3 holds the decision rules: DDX (differential diagnosis), PHASE, FINAL (diagnosis lock) and PROTO (protocol choice).

## 3. Which document to trust

Reading order for development:
1. `Shoulder_CDSS_Field_Interaction_Implementation.docx`, the only engineer-facing guide. **Its Section 7 (as-built) corrects Sections 2-6.**
2. `Shoulder_CDSS_Field_Rule_Logic_Library.xlsx`, the rules. **It is the spec for field types and allowed values.**
3. `Shoulder_CDSS_Field_Interaction_Matrix.xlsx`, how fields link, including the MRL-to-Protocol name mapping.
4. `wrappers/Sxx/Sxx_Field_Rule_Logic_Document.docx`, every field of one group.
5. `Shoulder_CDSS_Simulation_Validation_Layer_Requirements.docx`, needed only for the Experience Base review flow.

When sources disagree:
- the Rule Library beats the Golden Datasets (the datasets break the rules in many places, see Section 8)
- "as-built" sections beat "pre-build" ones
- the Condition Master List (`Layer3_DDX_Rules`, 97 conditions) decides which wrapper a condition belongs to

## 4. Code conventions (s01/ and intake/)

- Records use the **exact MRL column headers** as keys, in the Golden Dataset cell format (e.g. `ER:4/IR:4/Abd:4`, `Yes - <procedure>`, `45.8 weeks`).
- `rules.js` holds plain functions with no React (validate / serialize / parse), so a backend can run the same checks.
- Out-of-range numbers are **rejected, never clamped**. Soft problems are flags (warnings), not errors.
- `Affected Side Is Dominant` is always **derived** from Laterality + Dominant Arm. Only for Bilateral or Ambidextrous is it chosen by hand.
- CSS is scoped under one class (`.s01`, `.ir`) with `--s01-*` / `--ir-*` tokens and light/dark support.
- Case ID is system-assigned, passed in as a prop, never typed in.
- Every rule in code should name its source document in a comment.

## 5. The intake router (intake/), in short

- **Set A:** 24 common fields (Core A-M = 13, shared history = 11). Rules identical in all 18 groups, matched word for word to the Rule Library.
- **Red flags:** the 9 SH-RF rules. The master list is in the missing Routing Map, so ID, description, urgency and wrapper were copied from section 10 of each group's rule document (all 9 match). A "Yes" routes straight to that wrapper and skips Set B. SH-RF-07 asks which bone (S08/S09/S10).
- **Set B:** 11 branches in the Workflow guide's order (Section 2, Step 2). The first "Yes" wins, and a second question picks the wrapper when a branch has several. "Answer No here" notes keep each of the 97 conditions in its own wrapper.
- Full details and gaps: `intake/README.md`.

---

## 6. Missing files (referenced by the docs, not in the repo)

| File | Who refers to it | Why it matters |
|---|---|---|
| `Shoulder_CDSS_Wrapper_Routing_Map.xlsx` (7 sheets) | Workflow guide Steps 1-2 and Section 3; every wrapper rule doc, section 10; Rule Library `Red_Flag_Rule_Set` | Official red-flag rules, branch order and Cross-Reference Index. The Rule Library's red-flag sheet only points here. |
| `Shoulder_CDSS_Condition_Grouping_Rationale_and_Index.md` | Master guide Section 2; Workflow guide Section 3 | Group rationale and cross-references |
| `Shoulder_CDSS_Condition_Master_List.csv` | Master guide Section 2; Implementation guide 4.1 | A copy exists as Rule Library sheet `Layer3_DDX_Rules` (97 rows) |
| `Shoulder_Condition_Wrapper_Workbooks/` (the empty wrapper workbooks) | Workflow guide Step 3 and Section 7 | The repo only has Golden Datasets, in `wrappers/` |

---

## 7. Mistakes in the documents

### 7.1 Workflow and Navigation Guide (`logic_docs/Shoulder_CDSS_Workflow_and_Navigation_Guide.docx`, v2.0)

| # | Where | Problem | Evidence |
|---|---|---|---|
| W1 | Section 7 | Says the Golden Datasets have "0 contradictions". False: see D1, about 13% of patient rows have a wrong "Affected Side Is Dominant". | All 18 datasets |
| W2 | Section 2, Step 4 | Says to skip PROMs for S13/S15 Phase 1 "until the halt pathway clears", as if they're filled in later. S13 and S15 have **no PROM fields at all**, in any phase. | Master guide Section 6; S13/S15 MRL columns |
| W3 | Section 2, Step 3 | Order given as Core (A-M) → group fields → Diagnosis. It **leaves out the shared 11-field history block** (added 2026-09-29), which all 18 groups have. | Master guide 3.1; all datasets |
| W4 | Section 2, Steps 1-2; Section 3 | Depends on the Routing Map, the Grouping Rationale index and the Cross-Reference Index. None of these are in the repo. | Section 6 above |
| W5 | Section 7 | Says every row is "explicitly labelled SIMULATED". Only S08 and S18 rows say "Simulated case record" (in Notes). 14 groups have no Notes column. Only S15's file name has `_SIMULATED`. | All datasets |
| W6 | Section 7, Step 3 | File names `..._Golden_Dataset_SIMULATED.xlsx` in `Shoulder_Condition_Wrapper_Workbooks/`. In the repo the folder is `wrappers/`, and 17 of 18 names have no `_SIMULATED`. | Repo |
| W7 | Section 7 | "28,741 rows per group" (517,347 in total) is out of date. Real total: **532,283** (29,571 per group). It also adds all 3 sheets together; MRL alone averages about 23,250. | Row counts |
| W8 | Section 4 | Says the Experience Base has 29 fields. Real sheets: 30 columns in most groups, 31 in some, **35 in S04, 36 in S05**. | EB headers |
| W9 | Section 3 vs Section 5 | "Never primary in two wrappers" (Section 3) vs "never in two Experience Bases" (Section 5): the same rule worded two ways. | The guide itself |
| W10 | Section 3 table | "Isolated named-nerve deficit → S16" leaves out brachial plexus injuries (multi-nerve), which S16 also covers. Clinical check needed. | S16 condition list |

Routing gaps in the guide's fixed screen order. The intake router handles these with "answer No here" notes:
- Fracture screen (1) comes before the replacement screen (2), so a **fracture around a shoulder replacement** (S13) would land in S08.
- Neuro screen (8) comes before the paediatric screen (9), so a **birth-related brachial plexus palsy** (S17) would land in S16.
- A Hill-Sachs or bony Bankart lesion (S02) could be caught by the fracture screen.
- **SLAP lesion** (S02): its sign is a positive O'Brien's test with a *normal* apprehension test, which doesn't match the guide's instability description.
- **S10's non-fracture conditions** (snapping scapula, scapulothoracic bursitis) have no screen at all.
- **No wrapper covers routine rehab after a working shoulder replacement.** S13 only covers replacements with a problem.
- Some conditions are in **two wrappers**: long thoracic and spinal accessory nerve palsy are in both S11 and S16.

### 7.2 Master System Flow and Document Guide (`logic_docs/Shoulder_CDSS_Master_System_Flow_and_Document_Guide.docx`)

| # | Where | Problem |
|---|---|---|
| M1 | Sections 5 and 8.4 | "0 contradictions" claim is false (see D1). |
| M2 | Section 5 table | Row counts out of date for S04 and S05 (all other groups match). |
| M3 | Section 5 table | MRL column counts don't match. 14 groups are 1 lower than stated (no Notes column). S04 and S05 are much higher. |
| M4 | Section 3.1 | Says the shared closing block includes **Notes**. Only S04, S05, S08 and S18 have a Notes column. |
| M5 | Section 3.2 | "Identical 29-field Experience Base": real sheets have 30-36 columns (see W8). |
| M6 | Section 3.3 | "Identical 21-field Protocol schema": **S04 has 27 columns, S05 has 28**, with extra columns such as Therapy Class, Modality Type and Protocol Role. |
| M7 | Section 8.4 | "517,347 total rows": real total is 532,283. |
| M8 | Headings | Goes from Section 6 straight to 8.1: no Section 7, no Section 8 heading. |
| M9 | Section 2 table, row 9 | Golden Dataset "Purpose" cell is just "-". |

Row counts for M2 (stated → actual):

| Group | Sheet | Stated | Actual |
|---|---|---|---|
| S04 | Protocol / MRL / EB | 104 / 21,000 / 5,250 | 118 / 27,500 / 5,600 |
| S05 | Protocol / MRL / EB | 102 / 21,000 / 5,250 | 124 / 28,500 / 5,800 |

MRL column counts for M3 (stated / actual):

| S01 | S02 | S03 | S04 | S05 | S06 | S07 | S08 | S09 | S10 | S11 | S12 | S13 | S14 | S15 | S16 | S17 | S18 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| 63/62 | 60/59 | 54/53 | **49/57** | **51/57** | 53/52 | 47/46 | 54/54 | 50/49 | 48/47 | 50/49 | 54/53 | 53/52 | 54/53 | 46/45 | 51/50 | 56/55 | 51/51 |

### 7.3 Field Interaction Implementation Guide (`logic_docs/Shoulder_CDSS_Field_Interaction_Implementation.docx`)

| # | Where | Problem |
|---|---|---|
| I1 | Page 1 (v2.0 note) | "0 contradictions" claim is false (see D1). |
| I2 | Section 2 | Says the S13/S15 **Onset** field locks Rehabilitation Phase to "Phase 1 - Red Flag Screen". Two problems: Section 7.1 says the direction is reversed (the "cleared" status is decided first and the phase follows from it), and the data only uses the value **"Phase 1"**. |
| I3 | Section 3 | Says the grading column has the "same-named column" on both sheets. True for only 8 of 18 groups (Section 7.3 and the Interaction Matrix `MRL_to_Protocol_Mapping` say so). |

### 7.4 Simulation Validation Layer Requirements (`logic_docs/Shoulder_CDSS_Simulation_Validation_Layer_Requirements.docx`)

| # | Problem |
|---|---|
| V1 | No title page, no Section 1 or 2. It starts at an unnumbered heading ("Review Model: ...") and then jumps to Section 3. |

### 7.5 Field Rule Logic Library and Interaction Matrix

| # | Where | Problem |
|---|---|---|
| L1 | Library `Red_Flag_Rule_Set` | Has no rules, only a pointer to the missing Routing Map. The 9 rules can only be rebuilt from the wrapper docs' section 10. |
| L2 | Library `Layer1_Field_Validators`, Age | Says "0 = neonate (S17 only)". The Interaction Matrix (`Shared_Core_Block_Rules`) says S09 (birth-related clavicle fracture) **and** S17 use Age near 0. S09 data has Age 0. |
| L3 | Library, "0 contradictions" | The v2.0 READ ME and the Matrix READ ME both repeat the false claim. |
| L4 | Library, Age | Range is "0-120" with no rule on decimals. S17 stores ages to one decimal (e.g. 4.4), but the S01 form only allows whole numbers. |

---

## 8. Problems in the Golden Datasets (`wrappers/Sxx/*_Golden_Dataset*.xlsx`)

### D1. Wrong "Affected Side Is Dominant" (the big one)

Rule: Yes only when Laterality = Dominant Arm; Bilateral is the exception.
- **54,211 of 418,500 MRL rows (~13%)** break it.
- Only S04 and S05 are clean.
- Example: S01-C-000004 has Right side + Left dominant + "Yes".

| S01 | S02 | S03 | S04 | S05 | S06 | S07 | S08 | S09 |
|---|---|---|---|---|---|---|---|---|
| 4,808 | 4,020 | 2,723 | 0 | 0 | 2,889 | 2,820 | 3,377 | 2,876 |

| S10 | S11 | S12 | S13 | S14 | S15 | S16 | S17 | S18 |
|---|---|---|---|---|---|---|---|---|
| 3,075 | 2,670 | 3,263 | 2,994 | 3,760 | 2,747 | 4,117 | 4,114 | 3,958 |

### D2. Set A values that break the Rule Library

| Group | Field | Value used | Rows | Rule Library says |
|---|---|---|---|---|
| S13 | Pain_Location | "Deep/diffuse shoulder" | 8,785 | Not an allowed value |
| S17 | Pain_Location | "Other (specify) - not applicable, ..." | 7,108 | Format is "Other (specify): text" (S04/S05 use this correctly) |
| S11 | Onset | "Insidious - non-athlete" / "Insidious - overhead athlete" / "Acute-on-chronic" | 20,000 (every row) | Not allowed values |
| S04, S05 | Cervical Spine Screen | "Not Clear" | 2,247 / 2,512 | Must be "Not Clear (refer for cervical spine assessment)" |
| S04, S05 | Previous Treatment Received | joined with " + " (e.g. "Physiotherapy + Surgery") | 9,019 / 6,284 | Multi-select; other groups use ", " |
| S17 | Age | one decimal place (e.g. 4.4) | 18,045 | Range only. Not an error, but differs from S01's whole-number rule |

Allowed (not errors), noted for parsing:
- **Co-morbidities** is free text with a recommended list. Groups use extra values like Hypertension, Cervical Spondylosis and Hypercoagulable Disorder. Separators mix "; " and ", ", and some items have commas inside brackets, e.g. "Anxiety/Depression (self-reported, non-diagnostic)". `intake/rules.js` splits only on commas/semicolons outside brackets.

### D3. Other dataset facts

- **SIMULATED label:** only S08 and S18 MRL rows carry "Simulated case record" (in Notes). Only S15's file name has `_SIMULATED`.
- **Notes column:** only in S04, S05, S08, S18.
- **Previous Shoulder Surgery:** S12 and S13 have "Yes - ..." in every row (expected, since every case had surgery).
- **Sheets:** all 18 files have the same 3 sheets: Medical Record Library, Experience Base, Protocol.
- **Shared fields:** all 18 have `Follow_Up_Balance and Stability` and `Return to Activities`.
- **Halt groups:** S13 and S15 Phase 1 protocol rows are all "Referral-Only (Phase 1 halt groups)" (S13: 18 rows, S15: 12 rows).
- **S18 tumour:** in S18, only "Primary/metastatic tumour..." is pinned to Phase 1 (1,361 rows).
- **Totals:** 532,283 rows; 418,500 MRL rows; 97 named conditions.

---

## 9. Known gaps in the code

- **s01 protocol picker:** `s01/` only filters protocols by Diagnosis + Phase (`S01IntakeForm.jsx:168`). The PROTO rule says Diagnosis + grade + Phase + Age range. The grade and age are already in `protocols.js` but unused.
- **s01 README gaps:** Ultrasound tear size has no range in the rule doc (0-100 mm used for now), and Notes is included although the S01 dataset has no Notes column.
- **intake wording:** the Set B question wording is a plain-English reading of the guide and Condition Master List. It needs a clinician's review.
- **intake red flags:** the red-flag "signs" text explains each flag in plain words. The official trigger criteria are in the missing Routing Map.
- **intake → wrapper:** the router stops at "which wrapper". Opening the wrapper form with Set A pre-filled is not built yet.
