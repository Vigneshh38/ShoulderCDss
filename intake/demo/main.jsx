// Demo host: stands in for the CDSS app to show how IntakeRouter is wired in.
import { StrictMode, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import IntakeRouter from '../src/IntakeRouter';
import { SAMPLE_CASES } from './sampleCases.js';
import './demo.css';

function App() {
  const routerRef = useRef(null);
  // In the real app the backend/clinic system issues this; the patient never types it.
  const [caseId, setCaseId] = useState('SH-C-000001');
  const [last, setLast] = useState(null);

  const load = s => { setCaseId(s.record['Case ID']); routerRef.current.setRecord(s.record); };

  return (
    <>
      <header className="demo-head">
        <div>
          <h1>Shoulder intake router</h1>
          <p>Set A → red-flag check → Set B → wrapper · SMAART Shoulder CDSS</p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {SAMPLE_CASES.map(s => (
            <button key={s.label} type="button" onClick={() => load(s)}>Load Set A from {s.label}</button>
          ))}
        </div>
      </header>
      <IntakeRouter ref={routerRef} caseId={caseId} onSubmit={(record, route) => setLast({ route, record })} />
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
