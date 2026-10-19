# Clinical sign-off: 32 rules to confirm

**Shoulder CDSS routing** (`src/ShoulderRouter/`). Prepared 11 October 2026 for clinician review; items 26–32 (the node walk) added 19 October 2026.

**Read this first**

- No website or guideline gives a "100% accurate" cut-off for these rules. Guidelines differ from each other, and many items are design choices. This file gives the best-supported answer I found and where it came from. **A clinician makes the final decision on every item.**
- Each item lists:
  - **App now**: what the app does today.
  - **Sources say**: what guidelines and studies say, in my own words.
  - **Suggested**: a value to consider.
  - **How sure**: how strong the evidence is.
- "Test data" numbers come from the 7,200 Golden Dataset test rows (400 per wrapper). The Golden Dataset is simulated, so it shows the effect of a change but cannot prove a clinical value is right.
- I read most sources through search summaries. Where I could not open the original, the item says so.
- SH-RF-01 is not in this list, because its rule comes from the S07 document. This is not medical advice: it is a checklist for clinician review.

## Summary

| # | Rule | App now | Verdict |
|---|---|---|---|
| 1 | Infection in a replacement (RF-02) | Replacement + fever, red/leaking wound, or cloudy fluid | Matches |
| 2 | Vein clot (RF-03) | Swollen arm with big veins, girth over 2 cm, or blue arm | Matches (2 cm is from the S15 doc only) |
| 3 | Blocked artery (RF-04) | No wrist pulse, or pale and cold arm | Matches |
| 4 | Tumour (RF-05) | Suspicious scan/biopsy, or lump + cancer history | **Differs**: UK red flags also count any unexplained lump |
| 5 | Scapula torn away (RF-06) | High-energy injury + vessel damage | **Differs**: nerve-only damage also happens |
| 6 | Open fracture, nerve or artery damage (RF-07) | Open or tented skin, or axillary nerve/artery damage | Matches the docs; nerve-only is your call |
| 7 | Torn nerve root (RF-08) | Traction + absent reflex, or no feeling + 2 weak nerves | **Differs**: root avulsion has its own signs |
| 8 | Child safeguarding (RF-09) | Injury the story does not explain | Matches NICE |
| 9 | Two flags at once | Emergency wins, then the lower number | Your call |
| 10 | Frozen shoulder limits | ER −25%, ABD −8%, IR −5% | **Differs**: sources use ER −50% |
| 11 | Normal range | 90° / 180° / 70° | Matches (IR 70° weakly sourced) |
| 12 | Arthritis grade | KL 2 or more = arthritis | Matches |
| 13 | Weak nerve | MRC 3 or less | Your call |
| 14 | Child age | Under 18 | Matches |
| 15 | Deformity after injury | Fracture until X-ray | Matches |
| 16 | Fracture next to a replacement | Goes to S13 | Matches |
| 17 | Weak cuff muscles | Nerve problem only with EMG or MRI | Matches |
| 18 | Serratus / trapezius weakness | Nerve group (S16) | Matches |
| 19 | O'Brien's test | Inside = SLAP, on top = AC | Matches |
| 20 | Snapping scapula / bursitis | General branch (B10) | Your call |
| 21 | Instability tests vs internal impingement | Always S02 | Your call |
| 22 | Older operations | Only the index surgery goes to S12 | Your call |
| 23 | Tests per branch | See the table in item 23 | Your call |
| 24 | "No signs" / "All normal" answers | See the table in item 24 | Your call |
| 25 | Question wording | Plain English + exact column | Your call |
| 26 | Node order inside B10 | Structural findings first | Your call |
| 27 | Cuff weakness | MRC 4 or less in ER, IR or abduction = cuff | Your call |
| 28 | Winging with a normal scapular rhythm | Bursa lifting the blade (S10) | Your call |
| 29 | Fracture not imaged yet / no fracture | Deformity site decides; high-energy, no fracture = S10 | Your call |
| 30 | Both AC and SC joints tender, or neither | Each joint's own tests, X-ray and injection decide | Your call |
| 31 | Node order inside B8 | Named nerve (S16), then thoracic outlet (S14), then dermatome/reflex/EMG (S16) | Your call |
| 32 | Each wrapper's own findings in the branch walk | Added to B6, B7, B8, B9, B10 | Your call |

At the end: **5 red flags from UK guidance that are not among the docs' 9**, and a list of what I could not check.

---

## Red flags

### 1. Infection in a shoulder replacement (SH-RF-02, urgent same day)

**Question:** Should a shoulder replacement plus fever, a red or leaking wound, or cloudy joint fluid stop the case as a suspected infection?

- **App now:** Applies only when History records a joint replacement in this shoulder. Fires on any one of: fever "Yes", wound discharge/erythema "Present", or joint aspirate "Turbid" or "Purulent".
- **Sources say:**
  - The 2018 international consensus (ICM) on shoulder infection calls it **definite** with any of these: a sinus tract (a channel from the skin to the implant), pus in the joint, or two matching cultures of a virulent germ.
  - Unexpected wound drainage is its strongest minor sign (4 points). High CRP (over 10 mg/L), high ESR (over 30 mm/h) and abnormal joint-fluid tests are other minor signs.
  - Fever is not an ICM sign. But red skin, fever or feeling unwell is a standard shoulder infection red flag.
  - ICM criteria are for diagnosing infection after tests. A screen at intake should catch more cases than that.
- **Suggested:** Keep. Optionally mention a sinus tract in the wound question.
- **How sure:** High for the signs. I read the ICM point table on conference slides, not in the original paper.
- **Sources:** [ICM 2018 shoulder infection, Garrigues et al. JSES 2019](https://doi.org/10.1016/j.jse.2019.04.016) · [ICM point table (Garrigues slides)](https://foreonline.org/wp-content/uploads/2020/02/9.-Garrigues_Case-Infection-Surrounding-TSA.pdf) · [Shoulder red flags (GPnotebook)](https://gpnotebook.com/pages/musculoskeletal-medicine/red-flags-when-assessing-the-shoulder-joint)
- **Decision:** ☐ Keep ☐ Change to: ______

### 2. Vein clot in the arm (SH-RF-03, emergency)

**Question:** Should a swollen arm with big veins, an arm more than 2 cm bigger than the other, or a blue arm stop the case as a suspected vein clot?

- **App now:** Fires on any one of: venous distension/swelling "Present", a limb girth difference over 2 cm, or colour "Asymmetric - Cyanosed/Cold".
- **Sources say:**
  - Effort thrombosis (Paget-Schroetter) usually shows sudden swelling of the whole arm, pain or heaviness, a bluish hand, and visible veins over the shoulder and chest. It is typical in young, active people after hard arm use.
  - The validated arm-clot score (Constans) uses swelling on one side that pits when pressed, local pain, and a line or pacemaker in that arm. It has no centimetre cut-off.
  - The 2 cm figure comes only from the S15 document.
  - A blue arm points to a vein problem. A pale, cold arm points to an artery problem.
- **Check:** The S15 option joins "Cyanosed" and "Cold". With a vein clot the arm is usually blue and swollen, but not cold. Confirm that a blue, warm arm should still be recorded with this option.
- **Suggested:** Keep all three signs. Keep 2 cm, but record that it is the S15 document's value, not a validated cut-off.
- **How sure:** High for the signs. Low for the 2 cm number.
- **Sources:** [CMAJ review](https://www.cmaj.ca/content/187/13/990) · [PMC review](https://pmc.ncbi.nlm.nih.gov/articles/PMC4577346) · [Constans score paper](https://thieme-connect.com/products/ejournals/pdf/10.1160/TH07-08-0485.pdf)
- **Decision:** ☐ Keep ☐ Change to: ______

### 3. Blocked artery (SH-RF-04, emergency)

**Question:** Should no pulse at the wrist, or a pale, cold arm, stop the case as a blocked artery?

- **App now:** Fires on radial pulse "Absent on affected side" or colour "Asymmetric - Pale/Cold". A pulse that is only "Reduced" does not fire the flag. It sends the case to the vascular branch (B4) instead.
- **Sources say:**
  - A sudden loss of blood flow to a limb shows the "6 Ps": pain, pallor (pale), pulseless, pins and needles, paralysis, and a cold limb.
  - You do not need all six. Any of them with a suspected blockage is an emergency. One guide asks for a vascular surgeon within 30 minutes.
  - Arterial thoracic outlet syndrome can show a cold, pale or blotchy hand, fingertip ulcers, weak pulses, and a blood pressure difference over 20 mmHg between the arms.
- **Suggested:** Keep. A "Reduced" pulse on its own (often positional) stays a vascular-branch finding, not an emergency.
- **How sure:** High.
- **Sources:** [SVS patient leaflet: acute limb ischaemia](https://vascular.org/sites/default/files/2025-12/SVS_YVH_AcuteLimbIschemia.pdf) · [NHS Highland vascular guideline](https://www.rightdecisions.scot.nhs.uk/tam-treatments-and-medicines-nhs-highland/therapeutic-guidelines/vascular/vascular-guidelines/) · [Ontario ED guide](https://devcorh.corhealthontario.ca/Acute-Limb-Ischemia-Guide-for-ED-Clinicians-FINAL-V1-June2023.pdf) · [Arterial TOS case series](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC7884024/)
- **Decision:** ☐ Keep ☐ Change to: ______

### 4. Possible tumour (SH-RF-05, urgent)

**Question:** Should a suspicious scan or biopsy, or a lump in someone who has had cancer, stop the case as a possible tumour?

- **App now:**
  - Fires on tumour findings "Suspicious finding - biopsy pending" or "Biopsy-confirmed ...".
  - It also fires on mass palpation "Present" when the co-morbidities include "Malignancy".
  - A "Present" on its own does not fire, because the S18 column records a lump and grinding (crepitus) in the same cell.
- **Sources say:**
  - UK shoulder red flags (based on the BESS guidance) treat any of these as a possible tumour, for urgent (2-week) referral: a history of cancer, signs of cancer such as weight loss, or any unexplained deformity, lump or swelling.
  - A tumour at the top of the lung (Pancoast) can show up as shoulder pain, mostly in smokers. A chest X-ray helps.
- **Suggested:** Fire on any new, unexplained lump, with or without a cancer history. This needs one extra yes/no question ("Is it a lump, not just grinding?"), because the Excel cell cannot tell them apart.
- **How sure:** Medium. I read the red-flag list through GPnotebook, not the BESS document itself.
- **Sources:** [Shoulder red flags (GPnotebook)](https://gpnotebook.com/pages/musculoskeletal-medicine/red-flags-when-assessing-the-shoulder-joint) · [Shoulder referral criteria (GPnotebook)](https://gpnotebook.com/pages/rheumatology/referral-criteria-from-primary-care-shoulder-pain) · [Pancoast case report (HK Practitioner 2025)](https://hkcfp.org.hk/Upload/HK_Practitioner/2025/hkp2025vol47Mar/case_report.html)
- **Decision:** ☐ Keep ☐ Change to: ______

### 5. Shoulder blade torn away from the chest wall (SH-RF-06, emergency)

**Question:** Should a high-energy injury with damaged blood vessels or nerves stop the case as a possible scapulothoracic dissociation?

- **App now:** Fires only when the S10 mechanism is "High-energy trauma for fracture" **and** the neurovascular status is "Impaired - Vascular" or "Impaired - Combined". Nerve-only damage (motor or sensory) does not fire it.
- **Sources say:**
  - This injury is a closed "internal amputation" of the shoulder girdle. Signs: large shoulder swelling, a pulseless arm, and nerve loss. The whole arm is paralysed in over half of cases.
  - Artery damage and brachial plexus damage are each found in most cases. One summary gives 88% for the artery and 80% for a complete plexus injury. Some cases have nerve damage only, or neither.
  - On a chest X-ray, the shoulder blade sits more than 1 cm further out than on the other side.
- **Test data:**
  - The current rule catches 15 of 38 dissociation rows.
  - "High-energy injury + any nerve or vessel damage" would catch 24 of 38. It would also fire on 13 ordinary scapula fractures.
  - Both kinds go to the same fracture branch (B1), so only the red-flag text in the record changes.
- **Suggested:** Fire on a high-energy injury with any nerve or vessel damage, and ask for a chest X-ray to check whether the shoulder blade has moved outwards.
- **How sure:** Low to medium. The evidence is mostly reviews and case reports.
- **Sources:** [Review (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC5333671) · [WikEM](https://wikem.org/wiki/Scapulothoracic_dissociation)
- **Decision:** ☐ Keep ☐ Change to: ______

### 6. Open fracture, or nerve or artery damage after an injury (SH-RF-07, emergency)

**Question:** Should broken skin over a fracture, or a damaged axillary nerve or artery, stop the case as an emergency?

- **App now:** All of these are emergencies, as the wrapper documents say ("open fracture or neurovascular compromise: emergency"). It fires on any one of:
  - S08 skin "Open"
  - S09 skin "Not Clear" (read as tented skin) or "Abnormal Finding (specify) - open fracture"
  - S08 neurovascular status "Impaired - Nerve (axillary)", "Impaired - Vascular (axillary artery)" or "Impaired - Combined"
- **Sources say:**
  - **Open fracture:** the BOA standard (BOAST, 2017) asks for IV antibiotics as soon as possible, ideally within 1 hour of injury. This is an emergency.
  - **Skin tented over a collarbone fracture:** needs urgent orthopaedic review. Case reports show the skin can break, though some reviews call that risk mostly theoretical.
  - **Axillary nerve:** injury is common after a dislocation or an upper-arm fracture. One 135-patient study found it in 13%, and reviews report about 6% to 48%. It usually recovers over months.
  - **Axillary artery:** injury is rare (review figures: about 1–2% of dislocations or less), but it can cost the limb.
- **Suggested:** Keep open fractures and artery damage as emergencies. Decide whether a nerve-only injury should be "urgent" rather than "emergency". That would change the documents' wording, so it needs sign-off.
- **How sure:** High for open fractures. Medium for tenting and the nerve figures.
- **Sources:** [BOAST open fractures](https://www.boa.ac.uk/resource/boast-4-pdf.html) · [Tenting case report (PMC)](https://www.ncbi.nlm.nih.gov/pmc/articles/PMC12375512/) · [Tenting report, Am J Orthop](https://mdedge.com/content/skin-tenting-secondary-displaced-clavicle-fracture-more-theoretical-risk-report-2-adolescent) · [Axillary nerve study (EOA)](https://eoa.org.eg/wp-content/uploads/2023/09/14.pdf)
- **Decision:** ☐ Keep ☐ Change to: ______

### 7. Torn nerve root (SH-RF-08, urgent)

**Question:** Which signs after a stretching injury should flag a torn nerve root (root avulsion)?

- **App now:** Fires when the S16 mechanism is "Traumatic traction injury" **and** either:
  - a reflex is graded 0 (absent), or
  - dermatomal sensation is "Absent" and 2 or more named nerves are at MRC 3 or less.
- **Sources say:** These signs show a plexus injury, but not that the root is torn. A root avulsion (a tear right next to the spinal cord) has its own signs:
  - Horner's syndrome (droopy eyelid, small pupil, no sweating on that side of the face): the T1 root.
  - Weak serratus anterior (winging) or rhomboids: these nerves leave the roots before the plexus.
  - A raised diaphragm on chest X-ray (phrenic nerve).
  - Severe burning pain in a numb arm.
  - EMG at 3–4 weeks: denervated back muscles next to the spine, and normal sensory signals despite numbness.
- **Test data:**
  - The flag fires on 36 of 64 "Traumatic brachial plexus injury (upper/lower trunk)" rows. Those are trunk injuries, not root tears. No test diagnosis is a root tear.
  - After a traction injury, a weak serratus shows up only in long thoracic nerve palsy rows. So a weak serratus alone is not enough: other nerves must be weak too.
- **Suggested:**
  - Keep the current rule. These signs still show a serious plexus injury that needs quick referral (my reasoning).
  - Add a root-tear sign the Excel can show: serratus anterior at MRC 3 or less together with another weak nerve.
  - Horner's syndrome has no Excel column. Add it as a yes/no question if wanted.
- **How sure:** Medium. Teaching texts and reviews agree.
- **Sources:** [Wheeless: preganglionic injury](https://www.wheelessonline.com/nerves/preganglionic-brachial-plexus-injury/) · [Brachial plexus review (Hutaif Ortho)](https://hutaifortho.com/en/brachial-plexus)
- **Decision:** ☐ Keep ☐ Change to: ______

### 8. Child safeguarding (SH-RF-09, urgent)

**Question:** For a child, should an injury that the story does not explain trigger safeguarding?

- **App now:** For patients under 18 there is one yes/no question: "Is there a safeguarding concern: an injury the history does not explain, or one that does not fit the child's age or development?" A "Yes" fires the flag and is written into Red Flags / Precautions.
- **Sources say:** NICE (CG89, which covers under-18s) says to suspect maltreatment in any of these cases:
  - a fracture with no bone-weakening condition, where the explanation is missing or does not fit
  - fractures of different ages
  - X-rays showing fractures nobody knew about
  - In December 2025 NICE added a definition of "independently mobile". Injuries in babies who cannot yet move about on their own are more concerning.
- **Suggested:** Keep. Add two prompts to the question: "fractures of different ages" and "an injury in a baby who is not yet mobile".
- **How sure:** High.
- **Sources:** [NICE CG89](https://www.nice.org.uk/guidance/cg89) · [NICE CG89 recommendations](https://www.nice.org.uk/guidance/CG89/chapter/recommendations) · [GPnotebook summary](https://gpnotebook.com/pages/musculoskeletal-medicine/fractures-in-physical-abuse)
- **Decision:** ☐ Keep ☐ Change to: ______

### 9. Two flags at once

**Question:** If two flags fire, which one decides where the case goes?

- **App now:** Emergency flags (RF-01, 03, 04, 06, 07) win over urgent ones (RF-02, 05, 08, 09). Between two flags of the same level, the lower number wins. Every fired flag is still saved in the record.
- **Sources say:** General triage practice deals with the most time-critical problem first. No source sets a rule for two shoulder flags.
- **Suggested:** Keep. Example: if RF-03 (vein) and RF-04 (artery) both fire, RF-03 picks the branch. Both go to S15 anyway.
- **How sure:** Your call.
- **Decision:** ☐ Keep ☐ Change to: ______

---

## Numbers

### 10. Frozen shoulder limits (branch B5)

**Question:** How much stiffness counts as frozen shoulder?

- **App now:**
  - Passive range is below normal by at least 25% for external rotation (ER), 8% for abduction (ABD) and 5% for internal rotation (IR), with ER reduced the most. "Normal" is 90° / 180° / 70° (item 11).
  - It also needs no arthritis on X-ray (KL below 2), and an onset that is not sudden (under 2 weeks) or congenital.
  - No document gives these limits. They were set so that every early S05 test case passes.
- **Sources say:**
  - There are no official criteria: the diagnosis is clinical.
  - The usual rule is ER at least 50% lower than the other shoulder (or ER under 30°), plus at least 25% loss in two other directions.
  - The UK FROST pathway refers on "ER loss of 50% or more versus the other side", after ruling out arthritis, a missed posterior dislocation and cancer.
- **Test data (232 early S05 cases):**

  | Rule | Cases caught |
  |---|---|
  | App now | 232 of 232 |
  | ER −50% | 172 of 232 |
  | ER −50% plus ABD and IR −25% | 143 of 232 |

  The test cases are less stiff than the textbook rule allows: ER is 10° to 65°, median 35°.
- **Also:** The Excel stores only the painful shoulder. So the app compares with a fixed normal (90°), not with the other shoulder as the sources do.
- **Suggested:**
  - Use the textbook rule: ER at least 50% lower than the other shoulder, plus at least 25% loss of ABD and IR. If the other shoulder is not measured, use ER 45° or less.
  - Ask for the other shoulder's range as a helper question (not written to the Excel).
  - If you think the less stiff test cases are real frozen shoulders, keep the app's limits instead.
- **How sure:** Medium. The 50% rule is widely used, but no official guideline sets it.
- **Sources:** [Physiotutors: frozen shoulder diagnosis](https://www.physiotutors.com/wiki/frozen-shoulder-diagnosis/) · [Radiopaedia](https://radiopaedia.org/articles/adhesive-capsulitis-of-the-shoulder) · [UK FROST pathway slides](https://healthinnovationnetwork.com/wp-content/uploads/2023/06/5.-UK-FROST-23Jun2023-Lucksy-Mel-Presentation.pdf) · [BESS frozen shoulder pathway 2025](https://www.ndorms.ox.ac.uk/publications/2118244/modal)
- **Decision:** ☐ Keep ☐ Change to: ______

### 11. Normal range used for the percentages

**Question:** Is the normal passive range 90° ER, 180° ABD and 70° IR?

- **App now:** ER 90°, ABD 180°, IR 70°.
- **Sources say:**
  - The AAOS figures are flexion 180°, abduction 180° and ER 90°.
  - IR 70° appears in teaching material, but I could not find it in an AAOS source.
  - A 2020 study of normal shoulders notes that no published study backs these values, and that range falls with age.
  - Other charts give ER and IR as 60° to 90°.
- **Suggested:** Keep 90/180/70 as the fallback. Prefer the patient's other shoulder when it is measured (see item 10).
- **How sure:** Medium overall. Low for IR 70°.
- **Sources:** [BMC Musculoskeletal Disorders 2020](https://link.springer.com/article/10.1186/s12891-020-03665-9)
- **Decision:** ☐ Keep ☐ Change to: ______

### 12. Arthritis grade on X-ray

**Question:** Does Kellgren-Lawrence (KL) grade 2 or more mean arthritis (S06), not frozen shoulder?

- **App now:** KL grade 2, 3 or 4 sends stiffness in a capsular pattern to the arthritis group (S06, in B10). If no X-ray was done, B5 can still fire, with a note saying so.
- **Sources say:**
  - KL grade 2 means definite bone spurs (osteophytes), possibly with a narrowed joint. KL 2 or more is the usual cut-off for arthritis on X-ray.
  - Frozen shoulder X-rays are normal.
  - Pathways rule out arthritis (and a missed posterior dislocation) before calling a stiff shoulder frozen.
  - For the shoulder, the Samilson-Prieto grade is also widely used.
- **Suggested:** Keep KL 2 or more. Decide whether B5 should wait for an X-ray instead of firing with "X-ray not done".
- **How sure:** High for KL 2 or more.
- **Sources:** [Radiographic classification of osteoarthritis](https://en.wikipedia.org/wiki/Radiographic_classification_of_osteoarthritis) · [UK FROST pathway slides](https://healthinnovationnetwork.com/wp-content/uploads/2023/06/5.-UK-FROST-23Jun2023-Lucksy-Mel-Presentation.pdf)
- **Decision:** ☐ Keep ☐ Change to: ______

### 13. Weak nerve cut-off

**Question:** Does a muscle strength of 3 out of 5 or less mean a weak nerve?

- **App now:** A named nerve's muscle counts as weak at MRC 3 or less. This is used in branch B8 and flag RF-08.
- **Sources say:**
  - MRC 3: the muscle moves through its full range against gravity, but not against any resistance.
  - MRC 4: it moves against some resistance, but is weaker than normal.
  - MRC 5: normal.
  - Any grade under 5 is weakness. No guideline sets a cut-off for sending a patient to a nerve group.
- **Test data:** In 237 of 238 early S16 cases, the weakest nerve is at 2 or less. So choosing 3 or 4 makes almost no difference on the test data.
- **Suggested:**
  - Keep 3 or less to avoid false alarms. Pain from a cuff problem can make a muscle test as 4 (my reasoning).
  - Use 4 or less if you want to catch mild, early nerve palsies.
- **How sure:** Your call. The MRC definitions themselves are certain.
- **Sources:** [MRC scale (Physiotutors)](https://www.physiotutors.com/wiki/mrc-scale/) · [MRC scale (ESICM)](https://www.esicm.org/wp-content/uploads/2022/06/Appendix3-MRC.pdf)
- **Decision:** ☐ Keep ☐ Change to: ______

### 14. Child age

**Question:** Does under 18 count as a child?

- **App now:** Under 18 brings up the safeguarding question (RF-09) and the paediatric check (B9).
- **Sources say:** NICE's child maltreatment guideline covers children and young people under 18. The UN Convention on the Rights of the Child defines a child as anyone under 18.
- **Suggested:** Keep.
- **How sure:** High.
- **Sources:** [NICE CG89](https://www.nice.org.uk/guidance/cg89) · [CNTW summary of CG89](https://cntw.nhs.uk/resource-library/child-maltreatment-when-to-suspect-maltreatment-under-18s) · [UN Convention on the Rights of the Child](https://www.ohchr.org/en/instruments-mechanisms/instruments/convention-rights-child)
- **Decision:** ☐ Keep ☐ Change to: ______

### 15. Deformity after an injury

**Question:** Does a visible deformity after an injury count as a fracture until an X-ray is done?

- **App now:**
  - Deformity "Present" with imaging "Not imaged yet" goes to the fracture branch (B1).
  - If imaging shows no fracture, the case moves on, and a dislocation is looked for at B6.
  - A high-energy injury also fires B1.
- **Sources say:**
  - The ACR (2024) says a plain X-ray is the first test for acute shoulder pain after an injury. CT or MRI come only if the X-ray is normal or unclear.
  - UK shoulder red flags say an unreduced dislocation needs same-day referral. Its signs are lost rotation and an abnormal shape after an injury, a fit or an electric shock.
- **Suggested:** Keep. Note that an unreduced dislocation is not one of the docs' 9 red flags (see the section at the end).
- **How sure:** High.
- **Sources:** [ACR Appropriateness Criteria: acute shoulder pain](https://acsearch.acr.org/list/TopicNarrativePdf?topicId=91) · [Shoulder red flags (GPnotebook)](https://gpnotebook.com/pages/musculoskeletal-medicine/red-flags-when-assessing-the-shoulder-joint)
- **Decision:** ☐ Keep ☐ Change to: ______

---

## Routing choices

### 16. Fracture next to a shoulder replacement

**Question:** Should a fracture next to a shoulder replacement go to S13, not S08?

- **App now:** A humerus fracture on imaging in a shoulder with a replacement skips the fracture branch (B1). B2 sends it to S13, which lists "Periprosthetic humeral fracture".
- **Sources say:** Treatment depends on whether the implant's stem is loose (redo the replacement) or stable (fix with a plate). So it is a joint-replacement problem. These fractures follow 1–3% of shoulder replacements.
- **Suggested:** Keep.
- **How sure:** High.
- **Sources:** [Review, Annals of Joint](https://aoj.amegroups.org/article/view/4386) · [Radiopaedia: Wright and Cofield classification](https://radiopaedia.org/articles/wright-and-cofield-classification-of-postoperative-periprosthetic-humeral-fractures)
- **Decision:** ☐ Keep ☐ Change to: ______

### 17. Weak rotator cuff muscles

**Question:** Should weak supraspinatus/infraspinatus count as a nerve problem only when EMG or MRI shows it?

- **App now:** Supra/infraspinatus at MRC 3 or less counts as a suprascapular nerve problem only with an abnormal EMG, or an MRI showing where the nerve is squeezed.
- **Sources say:**
  - EMG and nerve conduction studies are the standard way to confirm a suprascapular nerve injury.
  - MRI finds a cyst or a cuff tear. A cuff tear causes the same weakness and wasting.
  - A weak infraspinatus with a normal supraspinatus points to compression at the spinoglenoid notch.
- **Suggested:** Keep.
- **How sure:** High.
- **Sources:** [Review (PMC)](https://pmc.ncbi.nlm.nih.gov/articles/PMC3501891) · [CMAJ](https://www.cmaj.ca/content/195/40/E1384)
- **Decision:** ☐ Keep ☐ Change to: ______

### 18. Serratus and trapezius weakness

**Question:** Should a weak serratus anterior or trapezius go to the nerve group (S16), not the scapula group (S11)?

- **App now:**
  - Serratus anterior or trapezius at MRC 3 or less goes to the nerve group (S16, branch B8).
  - Abnormal shoulder-blade movement without weakness goes to the scapula group (S11, branch B10).
- **Sources say:**
  - In a series of 128 people with winging on one side, long thoracic nerve palsy (serratus) caused 54% and spinal accessory nerve palsy (trapezius) caused 30%. Both are nerve palsies, confirmed by EMG.
  - Kibler's "dyskinesis" describes abnormal movement, not a nerve injury.
- **Suggested:** Keep.
- **How sure:** High.
- **Sources:** [Unilateral scapular winging (128 cases)](https://www.clinician.com/articles/143202-unilateral-scapular-winging) · [AANEM: mononeuropathies in scapular winging](https://www.aanem.org/about-aanem/news-express/news/2025/04/03/patient-safety--mononeuropathies-in-scapular-winging)
- **Decision:** ☐ Keep ☐ Change to: ______

### 19. O'Brien's test

**Question:** Does deep pain inside the joint mean SLAP (S02), and pain on top of the shoulder mean the AC joint (S04)?

- **App now:** A positive test (deep pain inside the joint) means SLAP (S02). Pain on top means the AC joint: the clinician records O'Brien "Negative" in the S02 column.
- **Sources say:**
  - O'Brien's original paper (1998) says pain "inside" means the labrum and pain "on top" means the AC joint.
  - Later studies found the test much less accurate for SLAP than first reported, so read it together with other tests.
- **Suggested:** Keep.
- **How sure:** High for the meaning. The test's accuracy is only moderate.
- **Sources:** [O'Brien et al. 1998 (PubMed)](https://pubmed.ncbi.nlm.nih.gov/9784804/) · [Physiopedia](https://www.physio-pedia.com/O%27Briens_Test)
- **Decision:** ☐ Keep ☐ Change to: ______

### 20. Snapping scapula and scapulothoracic bursitis (S10)

**Question:** Should S10's non-fracture conditions be found at the general branch, not the fracture branch?

- **App now:** "Scapulothoracic Crepitus/Snapping" finds them at the general branch (B10), not the fracture branch (B1).
- **Sources say:** These are overuse conditions, not injuries. No guideline covers how an app should route them.
- **Suggested:** Keep.
- **How sure:** Your call.
- **Decision:** ☐ Keep ☐ Change to: ______

### 21. Instability tests and internal impingement

**Question:** Should positive instability tests always go to S02, even when the problem may be S03's internal impingement?

- **App now:** Any of these sends the case to instability (S02): a positive apprehension, relocation, sulcus or O'Brien test, or one or more past dislocations.
- **Sources say:** In throwers with internal impingement, the relocation test often relieves pain without real apprehension. In one series of 41 professional throwers, about 63% had these subtle signs, and none had real apprehension.
- **Test data:** A possible exception would be "relocation positive, apprehension not positive, no past dislocations". It would move 10 of 400 S02 cases away from S02: 8 first-time dislocations and 2 SLAP lesions.
- **Suggested:** Keep for now. An exception would also need a reliable "overhead thrower, no injury" answer.
- **How sure:** Low (one small series).
- **Sources:** [Radsource: internal impingement](https://radsource.us/internal-impingement/) · [Relias: posterior internal impingement in throwers](https://reliasmedia.com/articles/54563-posterior-internal-impingement-of-the-rotator-cuff-in-throwers)
- **Decision:** ☐ Keep ☐ Change to: ______

### 22. Older operations

**Question:** Should only the surgery that is the reason for this visit go to S12?

- **App now:** Only surgery that meets all three conditions goes to S12: it is the reason for this visit, it was on this shoulder, and it was within the last 52 weeks. Older or unrelated operations are recorded in History only.
- **Sources say:** No outside source covers this. All S12 records describe the "index procedure for this record", and S12 covers weeks 0–52.
- **Suggested:** Keep.
- **How sure:** Your call.
- **Decision:** ☐ Keep ☐ Change to: ______

### 23. Tests that make each branch fire

**Question:** Are these the right findings for each branch? The branches are checked in this order, and the first one that fires wins.

| Branch | Fires on any one of |
|---|---|
| B1 Fracture / dislocation | Imaging shows a fracture; a deformity not yet imaged; a high-energy injury |
| B2 Joint replacement | A replacement in this shoulder (History) |
| B3 Other surgery | The index surgery on this shoulder, weeks 0–52 |
| B4 Vascular | Pulse reduced or absent; colour or temperature change; venous swelling; any vascular onset answer |
| B5 Frozen shoulder | Capsular pattern (item 10) with KL below 2 and an onset that is not sudden |
| B6 Instability | 1 or more past dislocations; apprehension, relocation, sulcus, O'Brien, **Jerk, Kim, load-and-shift or drawer** positive; **a labral tear or a Hill-Sachs lesion on MRI** |
| B7 AC / SC joint | AC or SC tenderness or deformity; **AC compression, piano key or AC O'Brien's positive; Rockwood II–VI on X-ray; relief from an AC injection; SC serial compression positive; SC displacement on the serendipity view** |
| B8 Neurological | C8–T1 sensation reduced or absent; Roos, Adson, Wright, costoclavicular or ULTT positive; **a plexus compression site on MRI/CT; a cervical rib (felt or on X-ray)**; dermatome sensation reduced or absent; axillary, long thoracic or spinal accessory at MRC 3 or less; suprascapular at MRC 3 or less with EMG or MRI support |
| B9 Paediatric | Congenital onset; **os acromiale (X-ray or tender), at any age**; or under 18 with a birth-related, developmental or inflammatory onset, or a dystocia/traction birth history |
| B10 Mechanical / arthritic / scapular | Painful arc; Empty Can, Full Can, Lift-Off, Speed's, **ER lag, drop arm, belly press or Yergason's** positive; **a cuff tear on MRI or ultrasound**; Hawkins-Kennedy or Neer positive; subacromial tenderness; **a thickened bursa on ultrasound or relief from a subacromial injection**; crepitus; KL 2 or more; **symmetric joint involvement or extra-articular features**; dyskinesis; winging; snapping |

The findings in **bold** were added on 19 October 2026 (item 32).
| B11 Fallback (S18) | Nothing above fired |

- **Sources say:** The branch order is from the Workflow Guide. The tests are the wrapper Excel columns. No outside source covers this app's routing.
- **Suggested:** A clinician reads the table and tries some test cases in the app. One point to check: is one positive positional test (for example Adson's) enough for B8?
- **How sure:** Your call.
- **Decision:** ☐ Keep ☐ Change to: ______

### 24. What the "No signs" and "All normal" buttons fill in

**Question:** Are these the right "normal" answers?

- **App now:** The buttons fill only questions that are still blank:

| Filled with | Questions |
|---|---|
| "Negative" (says the test was done) | Apprehension, Relocation, Sulcus, O'Brien, Roos, Adson, Empty Can, Hawkins-Kennedy |
| "Not Performed" | Cross-body adduction, Wright, Costoclavicular, ULTT, Full Can, Lift-Off, Speed's, Neer |
| "Absent" / "Normal" / "Symmetric" / "No" / "Clear" | Deformity, AC/SC, venous swelling, wound, mass, crepitus, winging, snapping, subacromial tenderness, painful arc, sensation (C8–T1 and dermatomes), dyskinesis, pulse, colour, fever, retrosternal screen, safeguarding |
| Numbers / range | Past dislocations 0; nerve strength 5 of 5; passive range "full" |
| "Not Yet Performed" / "Not imaged yet" | EMG, tumour imaging, fracture imaging |
| Left as "not assessed / not applicable" | Joint fluid, arm girth, injury mechanism and neurovascular status, skin over a fracture, nerve-injury mechanism, reflexes, X-ray grade, end-feel, vascular onset, MRI nerve site, child onset and birth history, post-op week |

- **Problem to check:**
  - "Negative" says a test was done. If a clinician presses "All normal" without doing the 8 main tests, the record says they were done and were negative.
  - "No signs" on the safeguarding card records "No concern".
- **Suggested:**
  - Fill every test with "Not Performed" unless the clinician enters a result. The app then lists it as an assumption.
  - Always ask the safeguarding question one by one: leave it out of "No signs".
- **How sure:** Your call.
- **Decision:** ☐ Keep ☐ Change to: ______

### 25. Question wording

**Question:** Is every question clear in plain English?

- **App now:** Each question shows a plain-English line next to the exact Excel column. The "i" button shows the column, its Layer 1 rule, and how its values are spread across the data.
- **Sources say:** No source can check this. A clinician needs to read it.
- **Suggested:** A clinician reads all 94 routing questions and 23 shared fields in the app, and marks any wording that could mislead.
- **How sure:** Your call.
- **Decision:** ☐ Done ☐ Changes listed: ______

---

## Node walk (added 19 October 2026)

Inside a branch that holds more than one wrapper, the node walk asks one question at a time until one wrapper is left (`NODES` in `src/ShoulderRouter/routingSpec.js`; the map is `docs/routing_map.png`). These items come from the project's own documents (the DDX rules in `Layer3_DDX_Rules` and the Workflow Guide's presenting-picture table). **I did not search outside sources for them.**

"Test data" below is all 418,500 Golden Dataset rows. On those rows the node walk ends in the right wrapper for 100% of Phase 1–2 rows that reached the right branch (0 of 218,032 wrong). The data is simulated, so this shows the rules agree with the data, not that they are clinically right.

### 26. Node order inside B10 (Mechanical / arthritic / scapular)

**Question:** Is this the right order? The first "yes" decides the wrapper.

| Node | Question | Yes → |
|---|---|---|
| B10.1 | X-ray glenohumeral arthritis, Kellgren-Lawrence 2 or more | S06 |
| B10.2 | Symmetric joint involvement, or extra-articular features | S06 |
| B10.3 | A cuff tear on MRI or ultrasound | S01 |
| B10.4 | External rotation lag sign or drop arm test positive | S01 |
| B10.5 | Glenohumeral crepitus | S06 |
| B10.6 | Snapping or grinding under the shoulder blade | S10 |
| B10.7 | Scapular dyskinesis | S11 |
| B10.8 | Winging with a normal scapular rhythm (item 28) | S10 |
| B10.9 | Empty Can, Full Can, Lift-Off, Belly Press, Speed's or Yergason's positive, or weakness MRC 4 or less (item 27) | S01 |
| B10.10 | Painful arc, Hawkins-Kennedy, Neer, subacromial tenderness, a thickened bursa on ultrasound, or relief from a subacromial injection | S03 |
| — | Nothing fits | S18, clinician review |

- **Why this order:** structural findings first.
  - Arthritis on X-ray goes to S06 even with a cuff tear: DDX S01-007 (early cuff arthropathy) needs a preserved joint space, and DDX S06-004 (advanced) has arthritic change.
  - A tear on imaging and the lag / drop-arm signs (DDX S01-003) come before the scapula, so a cuff tear with secondary dyskinesis stays in S01.
  - The provocation tests come last, because they overlap most (DDX S01-001 and S03-001 both have a painful arc and positive impingement tests).
- **Test data:** 48 rows end in the wrong wrapper, all recovered Phase 4 S01 rows with every cuff test negative, strength 5/5 and no tear. They end in S03.
- **Suggested:** Keep, unless a clinician sees a case type the order gets wrong.
- **How sure:** Your call.
- **Decision:** ☐ Keep ☐ Change to: ______

### 27. Cuff weakness cut-off (node B10.9)

**Question:** Should weakness of MRC 4 or less in external rotation, internal rotation or abduction count as a cuff sign?

- **App now:** Yes, at node B10.9, after the scapular nodes and only when nothing structural fired earlier.
- **Sources say (project documents):** DDX S01-002 (partial-thickness tear) is "weakness with preserved passive ROM". The S03 rules do not mention strength.
- **Problem to check:** Pain can make an impingement patient test weak. With this rule such a patient goes to S01, not S03.
- **Test data:** 4,195 S01 rows have weakness as their only cuff sign.
- **Suggested:** Keep, or require MRC 3 or less.
- **How sure:** Your call.
- **Decision:** ☐ Keep ☐ Change to: ______

### 28. Winging with a normal scapular rhythm (node B10.8)

**Question:** Should winging with an otherwise normal scapular rhythm go to S10 (a bursa or mass lifting the blade off the chest wall), not S11?

- **App now:** Yes. Winging with dyskinesis goes to S11 at node B10.7 first. If the rhythm was not assessed, the engine does not answer and the clinician picks.
- **Sources say (project documents):** DDX S10-005 (scapulothoracic bursitis) is "localised scapulothoracic tenderness/swelling"; DDX S11 lists the winging conditions with altered scapular rhythm.
- **Test data:** 106 S10 rows record winging without snapping.
- **Suggested:** Keep.
- **How sure:** Your call.
- **Decision:** ☐ Keep ☐ Change to: ______

### 29. Fracture branch before the X-ray, and with no fracture (nodes B1.2, B1.3)

**Question:** Before imaging, should the site of the deformity pick the wrapper? After a high-energy injury with no fracture on imaging, should the case go to S10?

- **App now:**
  - B1.2: deformity of the upper arm or shoulder → S08, of the collarbone → S09, a high-energy injury to the shoulder blade → S10. If more than one fits, the clinician picks.
  - B1.3: no fracture on imaging after a high-energy injury → S10 (scapulothoracic dissociation can occur without a fracture, DDX S10-006).
- **Test data:** every S08, S09 and S10 fracture row records its imaging, so these two nodes are not exercised by the data.
- **Suggested:** Keep, and get an X-ray before the wrapper form is opened.
- **How sure:** Your call.
- **Decision:** ☐ Keep ☐ Change to: ______

### 30. Both AC and SC joints tender, or neither (node B7.2)

**Question:** Should each joint's own tests, X-ray and injection decide when both joints are tender, or neither is?

- **App now:** AC: cross-body adduction, AC compression, piano key or AC O'Brien's positive, Rockwood II–VI on X-ray, or relief from an AC injection. SC: serial compression positive, or displacement on the serendipity view. If both or neither fit, the clinician picks.
- **Note:** Cross-body adduction counts here, but not to enter B7: S03 records it for impingement too.
- **Suggested:** Keep.
- **How sure:** Your call.
- **Decision:** ☐ Keep ☐ Change to: ______

### 31. Node order inside B8 (Neurological)

**Question:** Should a weak named shoulder nerve go to S16 before the thoracic outlet signs are read?

- **App now:** B8.1 a named shoulder nerve at MRC 3 or less (axillary, long thoracic, spinal accessory; suprascapular only with abnormal EMG or a notch on MRI) → S16; B8.2 positional thoracic outlet tests, C8–T1 sensory change, a compression site on MRI/CT or a cervical rib → S14; B8.3 dermatomal sensory loss, a diminished reflex or an abnormal EMG → S16.
- **Why:** these four nerves are not C8–T1 (DDX S14-001 is a C8–T1 deficit). An abnormal EMG alone is read only after the thoracic outlet signs, because true neurogenic TOS also has abnormal nerve conduction.
- **Suggested:** Keep.
- **How sure:** Your call.
- **Decision:** ☐ Keep ☐ Change to: ______

### 32. Each wrapper's own findings in the branch walk

**Question:** Should these findings, each from a wrapper's own Excel columns, also make its decision point fire? (They are in bold in item 23's table.)

| Branch | Added | DDX rule | Rows that now reach their branch |
|---|---|---|---|
| B6 → S02 | Jerk, Kim, load-and-shift, drawer positive; labral tear or Hill-Sachs on MRI | S02-001, 002, 006 | 1,160 (S02 now 100%) |
| B7 → S04 / S07 | AC compression, piano key, AC O'Brien's; Rockwood II–VI; AC injection relief; SC serial compression; serendipity displacement | S04-001, 002, 003; S07 | 3,869 (S04), 2,381 (S07) |
| B8 → S14 | Plexus compression site on MRI/CT; cervical rib felt or on X-ray | S14-003 | 478 |
| B9 → S17 | Os acromiale on X-ray or tender, at any age | S17-004 (15–30 years) | 283 (S17 now 100%) |
| B10 → S01 / S03 / S06 | ER lag, drop arm, belly press, Yergason's; cuff tear on MRI/ultrasound; bursa on ultrasound; subacromial injection relief; symmetric joints or extra-articular features | S01-002, 003, 004, 005; S03-002; S06-003 | 1,613 (S01), 1,854 (S03), 397 (S06) |

- **Not added:** cross-body adduction alone (S03 records it too), S06 serology and morning stiffness (combined cells; would add 74 rows), S06 Walch pattern (every S06 row has one).
- **Suggested:** Keep.
- **How sure:** Your call.
- **Decision:** ☐ Keep ☐ Change to: ______

## Red flags in UK guidance that are not among the docs' 9

The 9 flags come from section 10 of the wrapper documents. UK shoulder red flags (based on BESS) also list the five below. Decide whether to add them:

1. **Infection in a shoulder without a replacement (septic arthritis):** a hot, red, swollen, very painful joint, maybe with fever or feeling unwell. Needs same-day referral. RF-02 covers replacements only.
2. **Unreduced dislocation:** lost rotation and an abnormal shape after an injury, a fit or an electric shock. Needs same-day referral.
3. **Sudden serious loss of strength or feeling in the arm** that did not follow a stretching injury. Needs urgent referral. B8 routes it, but nothing stops the case.
4. **Acute rotator cuff tear after an injury** (sudden weakness after trauma). Needs urgent referral.
5. **Pain coming from somewhere else:** the heart, the lungs (for example a Pancoast tumour in a smoker) or the abdomen. S18 has a "Referred Pain Screen" column that the routing does not ask yet.

**Sources:** [Shoulder red flags (GPnotebook)](https://gpnotebook.com/pages/musculoskeletal-medicine/red-flags-when-assessing-the-shoulder-joint) · [Shoulder referral criteria (GPnotebook)](https://gpnotebook.com/pages/rheumatology/referral-criteria-from-primary-care-shoulder-pain) · [Pancoast case report (HK Practitioner 2025)](https://hkcfp.org.hk/Upload/HK_Practitioner/2025/hkp2025vol47Mar/case_report.html) · [BESS patient care pathways](https://www.bess.ac.uk/clinical/patient-care-pathways/)

## What I could not check

- **BESS's own 2025 pathway documents:** I read summaries (GPnotebook, the Oxford abstract), not the PDFs.
- **The ICM 2018 shoulder infection point table:** I read it on conference slides, not in the original paper.
- **IR 70° as an AAOS normal:** found only in teaching material.
- **The shoulder-blade displacement cut-off for scapulothoracic dissociation:** from case reports only.
- **The axillary artery injury rate:** from review summaries. I did not open the original papers.

## After sign-off

1. Tick each "Decision" line.
2. Make the changes. The values live in two files:
   - `src/ShoulderRouter/routingSpec.js`: red flags, branches and the node walk (`NODES`).
   - `src/ShoulderRouter/values.js`: frozen-shoulder limits and the normal range.
3. Re-run the test scripts (commands in the README) to see the effect on the test data.
