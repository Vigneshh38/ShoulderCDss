# Shoulder Intake Router (React)

The first screen of a new shoulder case. It decides **which wrapper (S01–S18)** the case belongs to, and stops there. The wrapper's own form (like `s01/`) takes over after that.

```
Set A: common fields  →  Red-flag check  →  Set B: branch questions  →  one wrapper
   (24 fields)            (9 rules)          (11 branches, in order)
```

1. **Set A** has the 24 fields that every wrapper's Medical Record Library starts with: the Core block (columns A–M, 13 fields) plus the shared history and screening block (11 fields). Their rules are identical in all 18 groups.
2. **The red-flag check** has 9 danger signs (SH-RF-01 to 09). If one is present, the case goes straight to urgent referral in that flag's wrapper, and Set B is skipped.
3. **Set B** asks the branches one at a time, in a fixed order. The first "Yes" picks the branch. If the branch holds more than one wrapper, a second question picks the wrapper. If nothing fits, the case goes to S18.

## Where every rule comes from

| Part | Source |
|---|---|
| Set A fields, types, allowed values, ranges | `Shoulder_CDSS_Field_Rule_Logic_Library.xlsx`, sheet `Layer1_Field_Validators` (checked to be identical for all 18 groups) |
| Red flags: ID, description, urgency, wrapper | Section 10 of each `wrappers/Sxx/Sxx_Field_Rule_Logic_Document.docx` (S07, S08, S09, S10, S13, S15, S16, S17, S18) |
| Red-flag plain-English signs | Key Differentiating Feature column of the Condition Master List (`Layer3_DDX_Rules`) |
| Set B order | `Shoulder_CDSS_Workflow_and_Navigation_Guide.docx`, Section 2, Step 2 |
| Set B wrapper(s) for each branch | Same guide, Section 3 table |
| "Answer No, picked up at Branch N" notes | Condition Master List: keeps each of the 97 conditions in its own wrapper even though the branches run in a fixed order |
| Halt-group notes (S13, S15, S18) | `Shoulder_CDSS_Master_System_Flow_and_Document_Guide.docx`, Section 6 |

## The 11 branches

| # | Branch | Wrapper(s) | Second question |
|---|---|---|---|
| 1 | Fracture / dislocation | S08 · S09 · S10 | Which bone? |
| 2 | Shoulder replacement with a problem | S13 | – |
| 3 | Other recent shoulder surgery | S12 | – |
| 4 | Blood vessels | S15 | – |
| 5 | Stiff in all directions | S05 | – |
| 6 | Unstable shoulder joint | S02 | – |
| 7 | AC or SC joint | S04 · S07 | Which joint? |
| 8 | Nerves | S14 · S16 | Which pattern? |
| 9 | Children and conditions from birth | S17 | – |
| 10 | Common shoulder problems | S01 · S03 · S06 · S11 · S10 | Which picture fits best? |
| 11 | Fallback | S18 | – |

Extra rules:
- Branches 2 and 3 can't be "Yes" if Set A says "Previous Shoulder Surgery: No". The screen asks you to fix one of them.
- Changing an earlier answer clears all the answers after it, so an old answer further down can never decide the route.
- If red flags point to different wrappers, you choose one primary wrapper. A case is never the primary case in two wrappers.
- Hints from Set A (for example "Onset is Congenital-Developmental" at Branch 9) only suggest. They never answer for you.

## Use it in the CDSS app

Copy `src/IntakeRouter/` into the host app. It only needs `react`.

```jsx
import IntakeRouter from './cdss/shoulder/IntakeRouter';

<IntakeRouter
  caseId={caseIdFromBackend}            // system/clinic-assigned, shown read-only
  initialRecord={savedRecord}           // optional: Set A fields (exact MRL column headers)
  existingCaseIds={ids}                 // optional: Case ID uniqueness check
  onRoute={(record, route) => {}}       // every time a route is found or changes
  onSubmit={(record, route) => open(route.wrapper, record)}  // "Open Sxx" button
  theme="light"                         // optional: "light" | "dark"; defaults to the OS setting
/>
```

- `record` holds the 24 Set A fields, keyed by the **exact MRL column headers** in the Golden Dataset cell format. You can pass it straight to a wrapper form as `initialRecord`, for example `S01IntakeForm`.
- `route` is `{ via: 'setB' | 'redflag', wrapper, wrapperName, branch, branchTitle, redFlags, halt, path, alsoCheck }`.
- Through a `ref` you can call `getRecord()`, `getRoute()`, `setRecord(record)` and `reset()`.
- `evaluate`, `validateSetA`, `checkRedFlags` and `walkSetB` (in `rules.js`) are plain functions with no React, so a backend can run the same routing.
- Styles are scoped under `.ir`. Override the `--ir-*` CSS variables to match the host theme.

| File | Purpose |
|---|---|
| `IntakeRouter.jsx` | The component |
| `rules.js` | Set A validation, red-flag check, Set B routing, and MRL cell conversion (no React) |
| `setA.js` | The 24 common fields |
| `redFlags.js` | The 9 red flags |
| `setB.js` | The 11 branches and their second questions |
| `wrappers.js` | The 18 wrapper names, halt-group notes and "also check" cross-references |
| `IntakeRouter.css` | Scoped styles |

## Run it

```bash
npm install
npm run dev     # http://localhost:5502
npm test        # 21 routing tests (Node's built-in test runner)
```

The demo page can load Set A from two real Golden Dataset rows (S01-C-000004 and S17-C-000001).

## Known gaps (to confirm with a clinician)

- **The question wording is plain English based on the guide.** The guide only names each screen (for example "capsular-pattern screen"), so the full question text comes from its Section 3 table and the Condition Master List. A clinician should review it.
- **The Wrapper Routing Map is not in the repo.** It is the official source for the red flags and the branch order. The 9 red flags here match every wrapper document, but the Routing Map may hold trigger details those documents don't have.
- **Routine rehab after a shoulder replacement has no wrapper.** S13 covers a replacement *with* a problem. A replacement that is working well falls through to the later branches.
- **Some conditions are listed in two wrappers.** Long thoracic and spinal accessory nerve palsy appear in both S11 and S16. Because Branch 8 comes before Branch 10, they route to S16. The result screen shows an "Also check" note.
- **Set A follows the Rule Library, and some datasets don't.** Loading those rows shows "Not a permitted value":
  - S13 Pain Location "Deep/diffuse shoulder" (8,785 rows)
  - S11 Onset values like "Insidious - overhead athlete" (20,000 rows)
  - S04 and S05 Cervical Screen "Not Clear" without the "(refer …)" text
  - S04 and S05 Previous Treatment joined with " + "
  - S17 Pain Location "Other (specify) - …" instead of "Other (specify): …"
- **Age allows one decimal.** The Rule Library says only "0–120", and S17 stores children's ages to one decimal (e.g. 4.4). The S01 form only allows whole numbers.
