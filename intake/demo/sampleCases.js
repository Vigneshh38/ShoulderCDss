// Set A fields copied from real Golden Dataset rows (simulated patients), so the demo starts from realistic data.
// Only the 24 Set A columns are kept. "Expected" is the wrapper that row belongs to.
export const SAMPLE_CASES = [
  {
    label: 'S01-C-000004', expected: 'S01',
    record: {
      'Case ID': 'S01-C-000004', 'Age': 37, 'Gender': 'Male', 'BMI': 27.8, 'Co-morbidities': 'None', 'Medication History': 'None',
      'Occupation': 'Teacher', 'Activity Level': 'Light', 'Laterality': 'Right', 'Pain_Location': 'Anterior', 'Pain_Nature': 'Mixed',
      'Pain_Intensity': 4, 'Onset': 'Insidious', 'Dominant Arm (Right/Left/Ambidextrous)': 'Left', 'Affected Side Is Dominant (Y/N)': 'Yes',
      'Previous Shoulder Surgery - Any (Y/N, procedure/date if known)': 'No', 'Previous Episode(s) of Same Complaint (Y/N)': 'No',
      'Previous Treatment Received (physiotherapy/injection/surgery/none)': 'None', 'Aggravating Factors': 'Lifting', 'Easing Factors': 'Heat',
      'Night Pain (Y/N)': 'Yes', 'Sleep Disturbance Due to Pain (Y/N)': 'No', 'Smoking Status': 'Never',
      'Cervical Spine Screen (Clear/Not Clear - referred-pain differential)': 'Clear',
    },
  },
  {
    // The dataset row has Pain_Location "Other (specify) - not applicable, ..." which is not the rule-library
    // format; it is written here as "Other (specify): ..." so the sample loads cleanly.
    label: 'S17-C-000001', expected: 'S17',
    record: {
      'Case ID': 'S17-C-000001', 'Age': 4.4, 'Gender': 'Male', 'BMI': 11.6, 'Co-morbidities': 'None', 'Medication History': 'NSAIDs as needed',
      'Occupation': 'Not applicable (paediatric patient)', 'Activity Level': 'Competitive Athlete', 'Laterality': 'Left',
      'Pain_Location': 'Other (specify): not applicable, pre-verbal/developmental presentation', 'Pain_Nature': 'Mixed', 'Pain_Intensity': 0,
      'Onset': 'Congenital-Developmental', 'Dominant Arm (Right/Left/Ambidextrous)': 'Left', 'Affected Side Is Dominant (Y/N)': 'No',
      'Previous Shoulder Surgery - Any (Y/N, procedure/date if known)': 'No', 'Previous Episode(s) of Same Complaint (Y/N)': 'No',
      'Previous Treatment Received (physiotherapy/injection/surgery/none)': 'None',
      'Aggravating Factors': 'Not applicable (pre-verbal/developmental presentation)', 'Easing Factors': 'Not applicable (pre-verbal/developmental presentation)',
      'Night Pain (Y/N)': 'No', 'Sleep Disturbance Due to Pain (Y/N)': 'No', 'Smoking Status': 'Never',
      'Cervical Spine Screen (Clear/Not Clear - referred-pain differential)': 'Clear',
    },
  },
];
