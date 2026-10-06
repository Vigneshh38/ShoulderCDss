// The 9 intake red flags (SH-RF-01 to SH-RF-09). Checked after Set A and before Set B.
// A red flag sends the case to urgent referral, whatever the main complaint is
// (Shoulder_CDSS_Workflow_and_Navigation_Guide.docx, Section 2, Step 1).
//
// The master list lives in Shoulder_CDSS_Wrapper_Routing_Map.xlsx, which is not in this repo.
// Each rule's ID, description, urgency and wrapper is copied from section 10 of the wrapper
// rule document named in `source`. `signs` explains the flag in plain words, using the
// condition's key feature from the Condition Master List (Layer3_DDX_Rules) where one exists.
export const RED_FLAGS = [
  {
    id: 'SH-RF-01', title: 'Posterior sternoclavicular dislocation with retrosternal compromise',
    urgency: 'Emergency (same-day surgical/vascular)', wrappers: ['S07'], source: 'S07_Field_Rule_Logic_Document.docx',
    signs: 'Collarbone pushed backwards at the breastbone, with signs of pressure behind it: breathlessness (dyspnoea), trouble swallowing (dysphagia) or a weaker pulse.',
  },
  {
    id: 'SH-RF-02', title: 'Suspected periprosthetic joint infection',
    urgency: 'Urgent (same-day)', wrappers: ['S13'], source: 'S13_Field_Rule_Logic_Document.docx',
    signs: 'Infection around a shoulder replacement: fever, wound discharge or very raised CRP/ESR/WCC (blood infection markers), or slowly worsening pain with loosening months to years later.',
  },
  {
    id: 'SH-RF-03', title: 'Suspected venous thoracic outlet syndrome (effort thrombosis)',
    urgency: 'Emergency (same-day vascular)', wrappers: ['S15'], source: 'S15_Field_Rule_Logic_Document.docx',
    signs: 'Sudden swelling or bluish colour (cyanosis) of one arm after hard, repeated arm activity. Suggests a clot in the subclavian vein.',
  },
  {
    id: 'SH-RF-04', title: 'Suspected arterial thoracic outlet syndrome / limb ischaemia',
    urgency: 'Emergency (same-day vascular)', wrappers: ['S15'], source: 'S15_Field_Rule_Logic_Document.docx',
    signs: 'The pulse weakens in certain arm positions, or the fingers lose blood supply (digital ischaemia).',
  },
  {
    id: 'SH-RF-05', title: 'Suspected neoplastic process (bone or soft tissue)',
    urgency: 'Urgent (halt-and-refer)', wrappers: ['S18'], source: 'S18_Field_Rule_Logic_Document.docx',
    signs: 'A possible tumour: a destructive lesion on imaging, night pain, or whole-body (systemic) symptoms. No diagnosis is finalised clinically.',
  },
  {
    id: 'SH-RF-06', title: 'Scapulothoracic dissociation',
    urgency: 'Emergency (limb-threatening)', wrappers: ['S10'], source: 'S10_Field_Rule_Logic_Document.docx',
    signs: 'A high-energy injury that tears the shoulder blade away from the chest wall, with blood-vessel or nerve injury.',
  },
  {
    id: 'SH-RF-07', title: 'Open fracture or neurovascular compromise',
    urgency: 'Emergency', wrappers: ['S08', 'S09', 'S10'], source: 'S08, S09 and S10 Field Rule Logic Documents',
    signs: 'The broken bone has come through the skin (open fracture), or the arm has lost blood supply or nerve function.',
    pickLabel: 'Which bone is broken?',
  },
  {
    id: 'SH-RF-08', title: 'Traumatic brachial plexus injury with suspected root avulsion',
    urgency: 'Urgent', wrappers: ['S16'], source: 'S16_Field_Rule_Logic_Document.docx',
    signs: 'Widespread weakness and numbness in a brachial plexus (nerve bundle) pattern after a traction injury, such as a motorcycle accident. Nerve roots may be torn from the spinal cord (root avulsion).',
  },
  {
    id: 'SH-RF-09', title: 'Safeguarding concern in paediatric presentation',
    urgency: 'Urgent', wrappers: ['S17'], source: 'S17_Field_Rule_Logic_Document.docx',
    signs: 'A concern that a child may be at risk of harm or neglect.',
  },
];
