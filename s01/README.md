# S01 Intake Form: Rotator Cuff & Biceps Tendon Pathology (React)

This is a React component for entering an S01 **Medical Record Library** case. All rules come from `S01_Field_Rule_Logic_Document.docx`.

## Drop into the Knee CDSS app

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

## Run the demo

```bash
npm install
npm run dev
```

Then open http://localhost:5501. The demo page in `demo/` stands in for the Knee app.

## How rules are enforced

- **Rejected (blocks submit):** missing required fields, values outside a numeric range (never clamped), wrong integer or decimal precision, values outside the allowed set, "None" combined with other options, a Protocol ID that doesn't exist or doesn't match the Diagnosis and Phase, Cervical screen "Not Clear" with no cervical note in Red Flags, a duplicate Case ID, and a phase skip with no reason in Notes.
- **Flagged for review (does not block):** BMI outside 12–45, Age outside the diagnosis's typical age band, Time Since Onset that doesn't fit Onset, MRI findings that don't fit the Diagnosis or the ultrasound, and follow-up values that got worse with no progress note.
- **Info:** anticoagulant or corticosteroid medication, overhead-demand occupation, night pain, AHD below 7 mm, and diagnoses routed to S18.
- **Derived field:** `Affected Side Is Dominant` is calculated from Laterality and Dominant Arm. You pick it manually only when Laterality is Bilateral or Dominant Arm is Ambidextrous.
- **Protocol picker:** only lists protocols that match the Diagnosis and Phase. Changing either one clears a protocol that no longer matches.

## Known gaps (from the rule-document issues, to fix later)

- `Ultrasound_Tendon Tear Size` has no range in the document. The form uses 0–100 mm for now.
- `Notes` is included (63 fields) even though the Golden Dataset sheet has no Notes column.
- Experience Base and Protocol sheet entry are not included. This form covers the patient record only.
