// Demo host: stands in for the Knee CDSS app to show how the shoulder components are wired in.
import { StrictMode, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import S01IntakeForm from '../src/S01IntakeForm';
import ShoulderRouter from '../src/ShoulderRouter';
import { SAMPLE_CASE } from './sampleCase.js';
import './demo.css';

const VIEWS = [
  { id: 'routing', label: 'Routing' },
  { id: 's01', label: 'S01 intake form' },
];

function S01Demo() {
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

function App() {
  const [view, setView] = useState(() => { try { return localStorage.getItem('demo.view') || 'routing'; } catch { return 'routing'; } });
  const pick = v => { setView(v); try { localStorage.setItem('demo.view', v); } catch { /* storage blocked */ } };
  return (
    <>
      <nav className="demo-tabs" role="tablist" aria-label="Demo views">
        <span>SMAART Shoulder CDSS · demo host</span>
        {VIEWS.map(v => (
          <button key={v.id} type="button" role="tab" aria-selected={view === v.id} onClick={() => pick(v.id)}>{v.label}</button>
        ))}
      </nav>
      {view === 'routing'
        ? <ShoulderRouter onRouted={record => console.info('Routed shoulder case', record)} />
        : <S01Demo />}
    </>
  );
}

// Reuse the root when Vite hot-reloads this module (editing the routing rules re-runs it).
const container = document.getElementById('root');
container.__root ||= createRoot(container);
container.__root.render(<StrictMode><App /></StrictMode>);
