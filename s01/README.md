# Shoulder CDSS: React components

Two components for the Knee CDSS app, plus a demo host (`demo/`) with a tab for each:

1. **`ShoulderRouter`**: everything asked *before* a wrapper is opened. It covers the shared intake, the red-flag screen and the branch walk, and ends at the branch.
2. **`S01IntakeForm`**: the full S01 Medical Record Library form.

## Run the demo

```bash
npm install
npm run dev
```

Then open http://localhost:5501. The demo page in `demo/` stands in for the Knee app, with one tab for the branch routing and one for the S01 form.

## Branch routing (`src/ShoulderRouter/`)

Five stops, drawn as a metro line in the same style as the Knee CDSS Metro page:

| Stop | What it asks |
|---|---|
| 1. Patient | The 12 core columns (A–M) that all 18 workbooks share |
| 2. History | The 11 shared history columns. Previous surgery is asked in parts: procedure, side, timing, and whether it is the reason for this visit |
| 3. Red flags | SH-RF-01 to 09. A fired flag halts the case and routes it straight to that flag's wrapper |
| 4. Branch walk | The 11 decision points in the Workflow Guide's order. The first match wins |
| 5. Branch | The branch and its wrappers, a clinician override (reason required), and the confirmed record |

```jsx
import ShoulderRouter from './cdss/shoulder/ShoulderRouter';

<ShoulderRouter
  caseId={caseIdFromBackend}        // shown read-only, never typed in
  onRouted={record => api.saveRouting(record)}   // when the clinician confirms the branch
  onChange={(answers, ev) => {}}    // every edit; ev = evaluate(answers)
  theme="light"                     // optional; otherwise the OS setting, with a toggle in the header
  persist                           // keep progress in this browser (localStorage); default true
/>
```

- **Every question is a real Excel column.** It uses that wrapper's own cell wording (e.g. `ER 80 / ABD 165 / IR 65`, `Yes (Temp 38.5 C)`). The `i` button on each field shows the exact column, its Layer 1 rule, and how its values are spread across that wrapper's dataset rows.
- **The record** has three parts:
  - `core`: the 23 shared columns plus `Red Flags / Precautions`
  - `wrapperFields`: each wrapper's own columns, keyed by exact header
  - `rows`: for each wrapper in the final branch, its Medical Record Library row written the way that workbook writes it (its own separators, "Other (specify)" style, "Not Clear" wording, red-flag phrasing, and S11's onset). `scripts/check_cells.mjs` compares these rows cell by cell with the Excel.
  - `routing`: red-flag states, the walk trace, suggested and final branch, override and reason, and any not-assessed answers
- **Three states, never two.** Blank means not asked, "Not assessed" means looked at but could not answer, and anything else is a finding. A "Not assessed" answer can let a decision point pass, but it is listed as an assumption.
- **Try a Golden Dataset case:** loads one of 97 simulated test cases, one per condition. A row only has its own workbook's columns, so the other routing questions get their normal answer. Those are drawn dashed and left out of the saved record.
- `evaluate`, `buildRecord` and `fromDatasetRow` (in `engine.js`) are plain JS with no React, so a server can run the same rules.

| File | Purpose |
|---|---|
| `ShoulderRouter.jsx` / `.css` | The component and its scoped styles (`.sr`, Jost font loaded in `index.html`) |
| `routingSpec.js` | The stops, questions, 9 red flags and 11 decision points, with their rules |
| `engine.js` | Evaluation, the output record, and loading a dataset row |
| `values.js` | Value helpers and the composite cell formats |
| `routingData.generated.js` | Built from the 18 Golden Datasets and the docs. **Do not edit by hand** |

**Regenerate the data, then check the routing against the Golden Dataset rows:**

```bash
python scripts/build_routing_data.py --test-out routing_test.json --test-rows 400
node scripts/test_routing.mjs routing_test.json
```

**Check that nothing deviates from the Excel files.** The first script checks every column and option against all 18 workbooks. The second loads each test row and compares every cell the app would write with the original:

```bash
python scripts/audit_fields.py field_audit.txt
node scripts/check_cells.mjs routing_test.json
```

**Build the standalone page** (the claude.ai artifact version). It writes one self-contained HTML file: React 18.3.1 is loaded from cdnjs, and downloads are compiled out because the artifact viewer blocks them.

```bash
node scripts/build_artifact.mjs shoulder-cdss-metro.html
```

On 7,200 Golden Dataset rows (400 per wrapper), 92.6% land in a branch that holds their own wrapper. For first presentations (Phase 1–2, where routing happens), the figure is 97.1%. Most misses are recovering Phase 3–4 cases whose tests have already returned to normal, or rows whose own workbook records no positive finding.

**Still drafts, for clinical sign-off.** `Shoulder_CDSS_Wrapper_Routing_Map.xlsx` was never provided. It should hold the official branch questions and the 9 red-flag rules.
- **From the docs:**
  - The branch order (Workflow Guide, Step 2)
  - Branch membership (the guide's presenting-picture table)
  - Each red flag's ID, description, urgency and wrapper (section 10 of the wrapper documents)
  - SH-RF-01's trigger (S07 document)
- **Ours, marked as drafts in the app:**
  - Every other trigger
  - The capsular-pattern thresholds
  - The nerve-weakness cut-off (MRC 3 or less)

`clinical_signoff_questions.md` lists the 25 rules a clinician must confirm. For each one it gives the app's current value, what guidelines and studies say (with links), and a suggested value.

## S01 intake form (`src/S01IntakeForm/`)

This is a React component for entering an S01 **Medical Record Library** case. All rules come from `S01_Field_Rule_Logic_Document.docx`.

### Drop into the Knee CDSS app

Copy `src/S01IntakeForm/` into the Knee app, for example as `src/cdss/shoulder/S01IntakeForm/`. It only needs `react`; there are no other dependencies.

```jsx
import S01IntakeForm from './cdss/shoulder/S01IntakeForm';

<S01IntakeForm
  caseId={caseIdFromBackend}          // system/clinic-assigned, shown read-only, never typed in
  initialRecord={savedRecord}         // optional: edit an existing MRL row
  existingCaseIds={ids}               // optional: Case ID uniqueness check
  previousPhase="Phase 2"             // optional: blocks phase skipping unless Notes give a reason
  onChange={(record, result) => {}}   // every edit; result has { ok, errors, warnings, info }
  onSubmit={(record, result) => api.saveS01(record)}  // only fires when there are no blocking errors
  showExport={false}                  // hide the JSON/CSV download buttons
  theme="light"                       // optional: "light" | "dark"; defaults to the OS setting
/>
```

- `record` uses the **exact MRL column headers** as keys, in the Golden Dataset cell format. For example: `ER:4/IR:4/Abd:4`, `Tear: None; Goutallier: Grade 0`, `45.8 weeks`.
- Through a `ref` you can call `validate()`, `getRecord()`, `getRaw()`, `setRecord(record)` and `reset()`. Use these if the Knee app drives submission from its own buttons.
- `validate`, `serialize` and `parse` (in `rules.js`) are plain functions that don't need React, so the backend can run the same checks.
- Styles are scoped under `.s01`. Override the `--s01-*` CSS variables to match the Knee app's theme.

**Case ID** is not a form field. The rule document says it is "System-generated or clinic-assigned; never reused". Pass it in as `caseId`, or leave it empty and have the backend assign it on save. The sidebar then shows "Assigned on save".

| File | Purpose |
|---|---|
| `S01IntakeForm.jsx` | The component |
| `rules.js` | Validation, cross-field rules, and converting between form state and MRL cells (no React) |
| `schema.js` | All 63 MRL fields (type, range, allowed values, section) and the S01 conditions with DDX text and age bands |
| `protocols.js` | The 278 Protocol-sheet rows, generated from the Golden Dataset. Regenerate if that sheet changes |
| `S01IntakeForm.css` | Scoped styles |

### How rules are enforced

- **Rejected (blocks submit):** missing required fields, values outside a numeric range (never clamped), wrong integer or decimal precision, values outside the allowed set, "None" combined with other options, a Protocol ID that doesn't exist or doesn't match the Diagnosis and Phase, Cervical screen "Not Clear" with no cervical note in Red Flags, a duplicate Case ID, and a phase skip with no reason in Notes.
- **Flagged for review (does not block):** BMI outside 12–45, Age outside the diagnosis's typical age band, Time Since Onset that doesn't fit Onset, MRI findings that don't fit the Diagnosis or the ultrasound, and follow-up values that got worse with no progress note.
- **Info:** anticoagulant or corticosteroid medication, overhead-demand occupation, night pain, AHD below 7 mm, and diagnoses routed to S18.
- **Derived field:** `Affected Side Is Dominant` is calculated from Laterality and Dominant Arm. You pick it manually only when Laterality is Bilateral or Dominant Arm is Ambidextrous.
- **Protocol picker:** only lists protocols that match the Diagnosis and Phase. Changing either one clears a protocol that no longer matches.

### Known gaps (from the rule-document issues, to fix later)

- `Ultrasound_Tendon Tear Size` has no range in the document. The form uses 0–100 mm for now.
- `Notes` is included (63 fields) even though the Golden Dataset sheet has no Notes column.
- Experience Base and Protocol sheet entry are not included. This form covers the patient record only.
