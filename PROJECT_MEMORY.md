# Shoulder CDSS: Project Memory / Handoff

> Context file for continuing this project in a new AI chat session. Read this first, then the files it points to.
> Last updated: 2026-10-19

---

## 1. What we are building

A **UI for the SMAART Shoulder CDSS** (Clinical Decision Support System for physiotherapy). It will be **integrated into an existing Knee CDSS app that is already finished and built in React**.

The shoulder system has **18 condition groups ("wrappers"), S01–S18**. Each wrapper has:
- a **Field Rule Logic Document** (`.docx`) that specifies every field: data type, valid range or allowed values, diagnosis rules, phase logic and follow-up rules
- a **Golden Dataset** (`.xlsx`, simulated data) with 3 sheets:
  - **Medical Record Library (MRL):** one row per patient case
  - **Experience Base:** AI decision audit trail, errors and corrections
  - **Protocol:** exercise/treatment prescriptions keyed by Diagnosis + grading + Phase + Age range

## 2. Repository layout (`D:\physio`, git repo)

```
logic_docs/   6 system-level docs (Master Flow, Workflow & Navigation, Field Interaction
              Implementation + Matrix, Field Rule Logic Library, Simulation Validation)
wrappers/     S01..S18, each with <Sxx>_Field_Rule_Logic_Document.docx + Golden Dataset .xlsx
s01/          React intake form for S01 + Vite demo app
  src/S01IntakeForm/   the drop-in component folder
    S01IntakeForm.jsx  component (forwardRef; props below)
    rules.js           pure validate/serialize/parse (no React; backend can reuse)
    schema.js          63 MRL fields + 7 S01 conditions (DDX text, age bands)
    protocols.js       278 protocol rows generated from the S01 Protocol sheet
    S01IntakeForm.css  styles scoped under .s01, themable via --s01-* CSS vars
  demo/                demo host app standing in for the Knee app
```

Run the demo: `cd s01 && npm install && npm run dev` (port 5501).

## 3. Decisions already made (with the user)

1. **React component**, plain JSX (not TypeScript; can add types if the Knee app uses TS).
2. **Case ID is NOT a form input.** The docs say it is "System-generated or clinic-assigned". It is passed in as the `caseId` prop and shown read-only. If none is passed, the record goes out blank for the backend to assign.
3. **Output record = exact MRL column headers**, in the Golden Dataset cell formats (e.g. `ER:4/IR:4/Abd:4`, `Tear: None; Goutallier: Grade 0`, `45.8 weeks`).
4. **Validation follows the docs strictly:** an out-of-range value is rejected, never clamped. Soft checks are flagged for review, not blocked.
5. `Affected Side Is Dominant` is **derived** from Laterality + Dominant Arm. It is editable only when Laterality is Bilateral or Dominant Arm is Ambidextrous.
6. **Data-quality problems are to be fixed LATER.** The user explicitly parked them (see section 7).
7. **Overall UX design agreed:**
   - **Common core fields first.** The docs define 35 fields shared by every wrapper.
   - **Then branch** to the right wrapper (cluster).
   - **Then reach the leaf** (the specific condition) using that wrapper's diagnosis rules.
   - A patient goes into **exactly one primary wrapper**. Candidates can stay open during questioning, but the case must commit to one. Overlaps use a cross-reference, never a double entry.
   - **Branch questions only use info available at that stage:** history, then quick exam, then special tests and imaging inside the wrapper.
   - **Red flags are screened before any branching.**

### S01IntakeForm props
`caseId`, `initialRecord`, `existingCaseIds`, `previousPhase`, `onChange(record, result)`, `onSubmit(record, result)` (fires only when valid), `showExport`, `theme`.
Ref methods: `validate()`, `getRecord()`, `getRaw()`, `setRecord(rec)`, `reset()`.

## 4. How the system is designed (from logic_docs)

**Intake flow (Workflow & Navigation Guide):**
1. **Red-flag screen first.** There are 9 rules, SH-RF-01..09. Any one of them sends the case to urgent referral.
2. **Branch screens in this order; the first match wins:**
   fracture/dislocation → prior arthroplasty → prior non-arthroplasty surgery → vascular → capsular pattern → instability → AC/SC joint → neurological → paediatric/congenital → default mechanical/arthritic/scapular → **S18 fallback**
3. **Inside the wrapper:** core fields, then group-specific exam/imaging, then Diagnosis + Red Flags.
4. **PROMs** (skipped for S13/S15 in Phase 1).
5. **Rehab Phase 1–4.**
6. **Protocol** selected by **Diagnosis + grading/staging field + Rehab Phase + Age range**.
7. **Follow-up fields.**

**Three-layer engine:**
- **Layer 1:** field validators. The Field Rule Logic Library sheet `Layer1_Field_Validators` has **1,862 rows defining every field of all 18 wrappers**. Use it to generate the other 17 form schemas instead of hand-coding them.
- **Layer 2:** cross-sheet event bus. MRL Diagnosis/grading/Phase filter Protocol rows and write Experience Base Condition.
- **Layer 3:** four rule types:
  - **DDX:** 97 conditions, each with age band, onset and key feature; in sheet `Layer3_DDX_Rules`
  - **PHASE:** phase gating
  - **FINAL:** Diagnosis locks once the grading field and Red Flags are both filled
  - **PROTO:** protocol selection

**Special groups:**
- **S13 (periprosthetic infection) and S15 (vascular TOS) are "halt" groups.** Phase 1 is locked to urgent referral, there are no PROMs, and rehab unlocks only once the case is "cleared".
- **S18:** only the tumour diagnosis is pinned to referral-only (Phase 1).
- **S12:** Phase is derived from Post-Operative Week.
- **S05:** everything is driven by Clinical Stage (Freezing/Frozen/Thawing/Resolved).

**Grading field per wrapper (used for protocol selection):**

| Wrapper | Grading field |
|---|---|
| S01 | MRI tear/Goutallier |
| S02 | Labral tear type |
| S03 | Bigliani acromion |
| S04 | Rockwood |
| S05 | Clinical Stage |
| S06 | Kellgren-Lawrence |
| S07 | SC displacement |
| S08 | Neer |
| S09 | Allman |
| S10 | Ideberg |
| S11 | Dyskinesis grade |
| S12 | Post-op week/phase |
| S13 | Component loosening |
| S14 | Nerve conduction |
| S15 | Doppler patency |
| S16 | EMG/nerve conduction |
| S17 | Mallet |
| S18 | Osteonecrosis staging |

Full detail is in `Grading_Staging_Scale_Reference`.

**Node walk (built 2026-10-19, draft order):**
- B1: which bone imaging shows (S08/S09/S10) → before the X-ray, the site of the deformity → no fracture after a high-energy injury: S10.
- B7: which joint is tender (S04/S07) → both or neither: each joint's own tests, X-ray and injection.
- B8: named shoulder nerve weak (S16) → thoracic outlet signs (S14) → dermatome / reflex / EMG (S16).
- B10: X-ray arthritis (S06) → inflammatory (S06) → cuff tear on imaging (S01) → lag / drop arm (S01) → crepitus (S06) → snapping scapula (S10) → dyskinesis (S11) → winging with normal rhythm (S10) → cuff/biceps test or MRC ≤ 4 (S01) → impingement / bursitis (S03) → else S18.

## 5. Missing files (asked the user; not yet provided)

| File | Why it matters |
|---|---|
| **Shoulder_CDSS_Wrapper_Routing_Map.xlsx** | Holds the 9 red-flag rules and the exact questions behind each branch screen. **This blocks the branching build.** The rule library says it was "out of scope for v2.0", so it may never have been finished. |
| Shoulder_CDSS_Condition_Master_List.csv | Content is duplicated in `Layer3_DDX_Rules`, so not blocking. |
| Shoulder_Condition_Grouping_Rationale_and_Index.md | Holds the cross-references between wrappers. |

If the Routing Map doesn't exist, the agreed fallback is to draft the branch screens from:
- the Workflow Guide's order
- its "presenting picture → wrapper" table
- the 97 DDX rules

A clinician then reviews and signs them off.

## 6. Status

- [x] Understood S01 docs + data; built the S01 React form; tested in the browser (validation, submit, protocol filtering).
- [x] Understood S02 docs + data (not built yet).
- [x] Organised all 18 wrappers into `wrappers/` and the logic docs into `logic_docs/`.
- [x] Read all 6 logic docs.
- [ ] **Next:** generate a field matrix (which fields appear in which wrapper) from `Layer1_Field_Validators`, cross-checked against the real dataset headers and the 35-field core.
- [ ] Refactor S01 into a **shared engine + per-wrapper schema/config**, so S02–S18 are configuration, not new code.
- [x] **Branch routing built** (`s01/src/ShoulderRouter/`, 2026-10-10): core intake → History → red flags (SH-RF-01..09) → 11-point branch walk → branch with clinician override (reason required). Every question is a real Excel column. Data comes from `s01/scripts/build_routing_data.py` (all 18 Golden Datasets + docs). Self-test with `s01/scripts/test_routing.mjs`: 92.6% of 7,200 real rows (97.1% of Phase 1–2) land in their own wrapper's branch.
  - The 9 red flags' ID, description, urgency and wrapper were recovered from section 10 of the wrapper docs. Only SH-RF-01's trigger is documented; the other triggers are drafts for clinical sign-off.
  - User decisions: keep the documented 11 branches, use field-question red flags, allow override only with a written reason.
- [x] **Node walk built** (2026-10-19): inside a branch with more than one wrapper (B1, B7, B8, B10, and red flag SH-RF-07), one question per node down to **one wrapper**, like the Knee CDSS stage 03b. 18 nodes (`NODES` in `routingSpec.js`), a new "Node walk" stop, the final stop is now "Wrapper", and the record's `rows` holds only that wrapper's row plus a `routing.nodeWalk` trace.
  - The engine answers each node; the clinician can answer differently with a written reason; every node has "None of these fit - clinician review" → S18 (knee ruling 9).
  - The branch walk now also reads each wrapper's own defining findings (B6 posterior tests and MRI; B7 joint tests, X-ray, injection; B8 cervical rib and MRI/CT compression site; B9 os acromiale at any age; B10 lag, drop arm, belly press, Yergason's, MRI/ultrasound tear, bursa, injection, inflammatory signs). 29 new questions, all real Excel columns.
  - **Tested on all 418,500 rows** (`test_routing.mjs` on `--test-rows 0`): node walk 100% of Phase 1–2 rows that reached the right branch (0 of 218,032 wrong); final wrapper 94.80% of all rows, 98.30% of Phase 1–2 rows; 0 Phase 1–2 rows in a wrong wrapper (every other miss goes to S18 for clinician review). Before: 91.93% / 97.12% reached the right branch.
  - Cell check 100% on all rows (11,576,500 cells), field audit 0 problems, vite build OK, checked in the browser (6 cases + a node override).
  - Map of every path: `s01/docs/routing_map.svg` / `.png`, drawn from the spec by `scripts/draw_routing_map.mjs`.
  - Sign-off items 26–32 added to `s01/clinical_signoff_questions.md` (B10 node order, MRC ≤ 4 cuff weakness, pseudo-winging, B1 before X-ray, B7 both/neither tender, B8 order, the new branch findings).
- [ ] Next: open the wrapper form after the wrapper is chosen (start with S01, which exists), then the diagnosis/leaf flow inside the wrapper.
- [ ] Fix the S01 protocol filter. It matches Diagnosis + Phase only; the PROTO rule also needs the **grading field + Age range**.
- [ ] Fix the data issues (section 7) when the user asks.

## 7. Known problems found (PARKED: fix later)

**Do not trust the docs' "0 contradictions" claims.** Real checks found many. Their validators appear to have checked the generator's own construction rules, not clinical correctness.

**S01 (36,000 cases):**
1. **Affected Side Is Dominant is wrong in 4,808 rows** (strict rule, excluding Bilateral and Ambidextrous). Even Right side + Right dominant is recorded as "No" in 2,513 rows.
2. **Field counts don't match:**
   - The doc says the MRL has 63 fields; the sheet has 62 (no `Notes`).
   - The doc says the Experience Base has 29 fields; it has 30 (`Protocol ID (Reference)` instead of `Timestamp Last Updated`).
3. **Wrong section references:** "Section 5" should be Section 7 (grading scale); "Section 9" for medication flagging points to Phase Logic.
4. **`Ultrasound_Tendon Tear Size` has no defined range.** The form uses 0–100 mm provisionally.
5. **Clinical contradictions:**
   - e.g. Painful Arc "Present 120–180°" in a field whose header says 60–120°
   - Experience Base accepts LHB tendinopathy on a positive Drop Arm alone

**S02 (22,500 cases):**
1. **Affected Side Is Dominant is wrong in 4,020 rows.**
2. **Cases contradict the doc's own diagnosis rules:**
   - SLAP without a positive O'Brien's: 1,789 (half of all SLAP cases)
   - SLAP with positive apprehension: 454
   - MDI without a positive sulcus sign: 1,748
   - MDI with Beighton <4: 345
   - "Traumatic" anterior dislocation with an atraumatic mechanism: 1,100
   - Anterior dislocation with neither apprehension nor relocation positive: 704
   - Hill-Sachs diagnosis but no Hill-Sachs on MRI: 57
3. **Labral tear values don't line up:**
   - The Protocol sheet uses compound values the doc doesn't allow (`Bankart (with Hill-Sachs)`, `None / Bankart`, `SLAP Type I / II / III / IV`).
   - 857 Recurrent-subluxation cases with MRI "None" are mapped to Bankart protocols.
4. **WOSI is ambiguous.** The doc allows 0–2100 raw **or** 0–100% in the same field, and 400 follow-up values are ≤100, so they can't be interpreted.
5. **Neurovascular fields:**
   - Follow_Up_Neurovascular uses the baseline's 3 "Impaired" options, but the doc says "Intact / Impaired (describe)" (242 rows).
   - 261 cases have an impaired axillary nerve with Red Flags = "None identified".
6. **Doc housekeeping:**
   - The doc says 60 fields; the sheet has 59.
   - The Experience Base has 30 fields, not 29.
   - Family History says "see Section 6", but Section 6 doesn't define its values.

**Flags only (non-blocking), S02:** 3,734 patients are outside their diagnosis's age band; 169 have an Onset that doesn't match their weeks since injury.

**Across the docs:**
- **No real "cleared" field for S13/S15.** A hidden "cleared" value decides the halt status, but a live form needs real fields. A clinical definition is needed (the docs name Jeeva as sign-off for S13/S15).
- **File naming:** the docs say every dataset is named `..._Golden_Dataset_SIMULATED.xlsx`; only S15's file actually is.
- **Rows with no sign of their own condition (routing cannot reach them; they go to S18 for clinician review), 19 Oct 2026:** 3,771 Phase 1–2 rows, mainly S10 scapulothoracic bursitis with no snapping or winging (1,572; S10 has no tenderness or bursa column), S14 "disputed" neurogenic TOS with every test negative (569), S04 (735) and S07 (672) with no tenderness, negative tests and normal imaging, S06 with KL 0–1 and no crepitus (183). Plus Phase 3–4 recovered rows (all S05 and S16 misses). 48 recovered Phase 4 S01 rows (all tests negative, 5/5, no tear) end in S03.
- **Two malignancies in one Co-morbidities cell (S05, 3 rows):** the form has one "specify" text, so the second is kept as written (fixed in `fromDatasetRow`, 19 Oct 2026).
- **Surgery names are spelled several ways** across the workbooks (e.g. `Rotator cuff repair` / `rotator cuff repair` / `Arthroscopic RCR`). The app copies them exactly, so it works, but the Excel should be made consistent.

**Knee vs Shoulder value standardisation (checked 2026-10-19):**

- **The shoulder code matches the shoulder Excel.** `scripts/audit_fields.py` found 0 problems (65 routing questions, 23 shared fields, 38 procedures, all 18 workbooks). A separate check of the S01 form against all 36,000 S01 rows found every Excel value can be entered and every number fits the form's limits.
- **Knee and shoulder use different values for some of the same fields.** This is fine while they run as separate modules. It must be handled if they share an intake screen, a patient, or reports:

| Field | Knee Excel | Shoulder Excel | Real Excel difference? |
|---|---|---|---|
| BMI | 13–36.5 (knee app allows 11–40) | 10–44.9 (form allows 10–60) | **Yes.** Knee's 11–40 limit would block shoulder patients with BMI over 40 |
| Onset | No shared column; each wrapper has its own wording | One shared list: Acute (<2 weeks) / Subacute (2-12 weeks) / Chronic (>12 weeks) / Insidious / Congenital-Developmental | **Yes** |
| Activity Level | Sedentary / Light activity / Moderate activity / Active/regular exerciser / Competitive athlete / Age-appropriate play | Sedentary / Light / Moderate / Vigorous / Competitive Athlete | Wording only (needs a mapping) |
| Co-morbidities | e.g. Type 2 Diabetes Mellitus, Hypothyroidism (W01 only checked) | e.g. Diabetes Mellitus, Thyroid Disease | Wording only |
| Medication History | Free text, e.g. `None regular`, `NSAID PRN` | Free text, e.g. `None`, `NSAIDs as needed` | Wording only |
| Night Pain | Yes / No (W16) | Yes / No | No. The knee app's None / Mild / Constant-intense is its own list |
| Age | From 0 (W09 children) | 0–96 (form allows 0–120) | No. Only the app limits differ (knee app 2–100, months under 2) |

- **Also:** the knee app's own answer lists (`formSchema.json`, `screenOptionLists.json`) do not match the knee Excel for Activity Level, Night Pain, Co-morbidities and Medication. That belongs to the knee team.
- **Before joining the SMAART dashboard:** keep each joint's own limits (or widen shared ones, e.g. BMI) and add a knee↔shoulder value mapping for Activity Level, Co-morbidities and Medication. Decide Onset with Dr. Jeeva.
- **Source of knee values:** the knee workbooks are not in either repo. Values came from the knee repo's saved scans (`backend/_scratch/cov_after.json`, `_scratch/specCols.json`) and `rules/inputLimits.json`. Co-morbidities was seen for W01 only, Night Pain for W16 only, nothing for W18. Re-check against the real knee workbooks when available.

## 8. Working preferences of the user

- Explain in **plain, simple language**. When asked to explain a document, walk through it section by section with a worked patient example.
- **Check before building.** The user shares files incrementally and likes the AI to read and understand everything before coding.
- **Verify claims** in the docs against the actual data.
- **Ask before** large or irreversible steps.
- Short, clear answers work best.
