// Demo host: stands in for the Knee CDSS app to show how S01IntakeForm is wired in.
import { StrictMode, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import S01IntakeForm from '../src/S01IntakeForm';
import { SAMPLE_CASE } from './sampleCase.js';
import './demo.css';

function App() {
  const formRef = useRef(null);
  // In the real app the backend/clinic system issues this; the patient never types it.
  const [caseId, setCaseId] = useState('S01-C-036001');
  const [last, setLast] = useState(null);

  return (
    <>
      <header className="demo-head">
        <div>
          <h1>S01 · Rotator Cuff &amp; Biceps Tendon Pathology</h1>
          <p>Medical Record Library intake · SMAART Shoulder CDSS</p>
        </div>
        <button type="button" onClick={() => { setCaseId(SAMPLE_CASE['Case ID']); formRef.current.setRecord(SAMPLE_CASE); }}>
          Load sample case (S01-C-000004)
        </button>
      </header>
      <S01IntakeForm
        ref={formRef}
        caseId={caseId}
        onSubmit={record => setLast(record)}
      />
      {last && (
        <pre className="demo-out">
          <button type="button" onClick={() => setLast(null)}>Close</button>
          {JSON.stringify(last, null, 2)}
        </pre>
      )}
    </>
  );
}

createRoot(document.getElementById('root')).render(<StrictMode><App /></StrictMode>);
