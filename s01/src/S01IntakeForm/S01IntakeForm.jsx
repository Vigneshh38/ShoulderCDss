// S01 - Rotator Cuff and Biceps Tendon Pathology: Medical Record Library intake form.
//
//   <S01IntakeForm
//     ref={formRef}                    // optional: validate(), getRecord(), getRaw(), setRecord(rec), reset()
//     caseId="S01-C-000123"            // system/clinic-assigned; never entered on the form
//     initialRecord={record}           // optional: an MRL row (exact column headers) to edit
//     existingCaseIds={[...]}          // optional: Case ID uniqueness check
//     previousPhase="Phase 2"          // optional: no-phase-skipping rule
//     onChange={(record, result) => {}}
//     onSubmit={(record, result) => {}} // only called when there are no blocking errors
//   />
//
// `record` is keyed by the exact MRL column headers, in the Golden Dataset's cell format.
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, useId } from 'react';
import { SCHEMA as S } from './schema.js';
import { PROTOCOLS } from './protocols.js';
import { validate, serialize, parse, derivedDominant } from './rules.js';
import './S01IntakeForm.css';

const PROTOCOL_KEY = 'Treatment Plan Mapping (Protocol ID)';
const WIDE = new Set(['textarea', 'multi', 'mri', 'protocol']);
const emptyRaw = () => parse({});

function Seg({ name, options, value, onChange, disabled }) {
  return (
    <div className="s01-seg" role="radiogroup">
      {options.map(o => (
        <label key={o}>
          <input type="radio" name={name} value={o} checked={value === o} disabled={disabled} onChange={() => onChange(o)} />
          <span>{o}</span>
        </label>
      ))}
    </div>
  );
}

function Select({ id, value, options, onChange, placeholder = 'Select…', disabled, render = o => o }) {
  return (
    <select id={id} value={value ?? ''} disabled={disabled} onChange={e => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map(o => <option key={typeof o === 'string' ? o : o.id} value={typeof o === 'string' ? o : o.id}>{render(o)}</option>)}
    </select>
  );
}

function NumInput({ id, f, value, onChange, disabled }) {
  return (
    <div className="s01-num">
      <input type="text" inputMode="decimal" id={id} value={value ?? ''} disabled={disabled} placeholder={`${f.min}–${f.max}`} onChange={e => onChange(e.target.value)} />
      {f.unit && <span>{f.unit}</span>}
    </div>
  );
}

function Control({ f, id, raw, set, protocols }) {
  const k = f.key;
  const v = raw[k];
  const sub = p => raw[`${k}::${p}`];
  const setSub = p => val => set(`${k}::${p}`, val);
  const spec = (show, p, placeholder, type = 'text') =>
    show && <input type={type} className="s01-spec" value={sub(p) ?? ''} placeholder={placeholder} onChange={e => setSub(p)(e.target.value)} />;

  switch (f.type) {
    case 'text':
      return (
        <>
          <input type="text" id={id} value={v ?? ''} list={f.suggestions ? `${id}-dl` : undefined} autoComplete="off" onChange={e => set(k, e.target.value)} />
          {f.suggestions && <datalist id={`${id}-dl`}>{f.suggestions.map(s => <option key={s} value={s} />)}</datalist>}
        </>
      );
    case 'textarea':
      return <textarea id={id} rows={3} value={v ?? ''} onChange={e => set(k, e.target.value)} />;
    case 'int': case 'dec': case 'weeks':
      return <NumInput id={id} f={f} value={v} onChange={val => set(k, val)} />;
    case 'usSize':
      return (
        <>
          <NumInput id={id} f={f} value={v} disabled={!!sub('na')} onChange={val => set(k, val)} />
          <label className="s01-check"><input type="checkbox" checked={!!sub('na')} onChange={e => setSub('na')(e.target.checked)} /> {S.US_NA}</label>
        </>
      );
    case 'select':
      return (
        <>
          {f.options.length <= 4 && !f.specify
            ? <Seg name={id} options={f.options} value={v} onChange={val => set(k, val)} />
            : <Select id={id} value={v} options={f.options} onChange={val => set(k, val)} />}
          {spec(f.specify && v === f.specify, 'spec', 'Specify…')}
        </>
      );
    case 'multi': {
      const vals = v || [];
      const toggle = o => set(k, vals.includes(o) ? vals.filter(x => x !== o) : [...vals, o]);
      return (
        <>
          <div className="s01-chips">
            {f.options.map(o => (
              <label key={o}><input type="checkbox" checked={vals.includes(o)} onChange={() => toggle(o)} /><span>{o}</span></label>
            ))}
          </div>
          {spec(f.specify && vals.includes(f.specify), 'spec', 'Specify malignancy…')}
        </>
      );
    }
    case 'bool':
      return <Seg name={id} options={['Yes', 'No']} value={v} onChange={val => set(k, val)} />;
    case 'ynText':
      return <><Seg name={id} options={['Yes', 'No']} value={v} onChange={val => set(k, val)} />{spec(v === 'Yes', 'text', f.placeholder)}</>;
    case 'ynDate':
      return <><Seg name={id} options={['Yes', 'No']} value={v} onChange={val => set(k, val)} />{spec(v === 'Yes', 'date', '', 'date')}</>;
    case 'derived': {
      const d = derivedDominant(raw);
      return (
        <div className="s01-derived">
          <Seg name={id} options={['Yes', 'No']} value={d.value} disabled={!d.editable} onChange={val => set(k, val)} />
          <small>{d.editable ? 'Bilateral / ambidextrous: choose manually.' : d.value ? 'Auto-derived from Laterality and Dominant Arm.' : 'Set Laterality and Dominant Arm.'}</small>
        </div>
      );
    }
    case 'mmt':
      return (
        <div className="s01-mmt">
          {['ER', 'IR', 'Abd'].map(p => (
            <label key={p}><span>{p}</span><Select value={sub(p)} options={['0', '1', '2', '3', '4', '5']} placeholder="–" onChange={setSub(p)} /></label>
          ))}
        </div>
      );
    case 'mri':
      return (
        <div className="s01-pair">
          <label><span>Tear</span><Select id={id} value={sub('tear')} options={S.MRI_TEAR} onChange={setSub('tear')} /></label>
          <label><span>Goutallier</span><Select value={sub('gout')} options={S.GOUTALLIER} onChange={setSub('gout')} /></label>
        </div>
      );
    case 'protocol': {
      const dx = raw['Diagnosis'], ph = raw['Rehabilitation Phase'];
      const s18 = dx === S.S18;
      const sel = PROTOCOLS.find(p => p.id === v);
      return (
        <>
          <Select
            id={id} value={v} options={protocols} disabled={s18 || !dx || !ph} onChange={val => set(k, val)}
            placeholder={s18 ? 'Not applicable (routed to S18)' : !dx || !ph ? 'Select diagnosis and phase first' : `Select protocol… (${protocols.length} available)`}
            render={p => `${p.id} · ${p.category} · ${p.name}`}
          />
          {sel && <div className="s01-proto-detail"><span>{sel.grade}</span><span>Age {sel.age}</span></div>}
        </>
      );
    }
    default:
      return null;
  }
}

const S01IntakeForm = forwardRef(function S01IntakeForm(
  { caseId = '', initialRecord, existingCaseIds, previousPhase, onChange, onSubmit, showExport = true, theme, className = '' },
  ref,
) {
  const uid = useId().replace(/:/g, '');
  const rootRef = useRef(null);
  const [raw, setRaw] = useState(() => (initialRecord ? parse(initialRecord) : emptyRaw()));
  const [touched, setTouched] = useState(false);

  const opts = useMemo(() => ({ caseId, existingCaseIds, previousPhase }), [caseId, existingCaseIds, previousPhase]);
  const result = useMemo(() => validate(raw, opts), [raw, opts]);
  const record = useMemo(() => serialize(raw, caseId), [raw, caseId]);
  const protocols = useMemo(
    () => PROTOCOLS.filter(p => p.dx === raw['Diagnosis'] && p.phase === raw['Rehabilitation Phase']),
    [raw['Diagnosis'], raw['Rehabilitation Phase']], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  useEffect(() => { onChangeRef.current && onChangeRef.current(record, result); }, [record, result]);

  const set = (name, value) =>
    setRaw(prev => {
      const next = { ...prev, [name]: value };
      // A protocol only stays selected while it still matches the Diagnosis and Phase.
      if (name === 'Diagnosis' || name === 'Rehabilitation Phase') {
        const p = PROTOCOLS.find(x => x.id === next[PROTOCOL_KEY]);
        if (p && (p.dx !== next['Diagnosis'] || p.phase !== next['Rehabilitation Phase'])) next[PROTOCOL_KEY] = '';
      }
      return next;
    });

  const scrollToFirstError = () =>
    requestAnimationFrame(() => rootRef.current?.querySelector('.s01-has-err')?.scrollIntoView({ behavior: 'smooth', block: 'center' }));

  const check = () => { setTouched(true); if (!result.ok) scrollToFirstError(); return result; };

  const download = (name, text, type) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const csvCell = v => (/[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  const fileName = (caseId || 'S01-case').replace(/[^\w-]/g, '_');

  const act = kind => {
    if (!check().ok) return;
    if (kind === 'json') download(`${fileName}.json`, JSON.stringify(record, null, 2), 'application/json');
    if (kind === 'csv') download(`${fileName}.csv`, `${Object.keys(record).map(csvCell).join(',')}\n${Object.values(record).map(csvCell).join(',')}\n`, 'text/csv');
    if (kind === 'submit') onSubmit && onSubmit(record, result);
  };

  const reset = () => { setRaw(emptyRaw()); setTouched(false); };

  useImperativeHandle(ref, () => ({
    validate: check,
    getRecord: () => record,
    getRaw: () => raw,
    setRecord: rec => { setRaw(parse(rec)); setTouched(false); },
    reset,
  }), [record, raw, result]); // eslint-disable-line react-hooks/exhaustive-deps

  const cond = S.CONDITIONS.find(c => c.name === raw['Diagnosis']);
  const sectionErrors = sec => S.FIELDS.filter(f => f.section === sec && result.errors[f.key]).length;
  const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;

  return (
    <div className={`s01 ${className}`} data-theme={theme} ref={rootRef}>
      <div className="s01-layout">
        <nav className="s01-nav">
          <div className="s01-case">
            <span>Case ID</span>
            <strong>{caseId || 'Assigned on save'}</strong>
            {result.errors['Case ID'] && <em className="s01-err">{result.errors['Case ID'][0]}</em>}
          </div>
          {S.SECTIONS.map(s => (
            <a key={s.id} href={`#${uid}-${s.id}`}>
              {s.title}
              {touched && sectionErrors(s.id) > 0 && <em>{sectionErrors(s.id)}</em>}
            </a>
          ))}
        </nav>

        <form className="s01-form" noValidate autoComplete="off" onSubmit={e => { e.preventDefault(); act('submit'); }}>
          {S.SECTIONS.map(s => (
            <section key={s.id} className="s01-card" id={`${uid}-${s.id}`}>
              <h2>{s.title}</h2>
              <div className="s01-grid">
                {S.FIELDS.filter(f => f.section === s.id && f.type !== 'system').map(f => {
                  const id = `${uid}-${f.key.replace(/[^a-z0-9]+/gi, '-')}`;
                  const errs = touched ? result.errors[f.key] || [] : [];
                  const help = f.key === 'Diagnosis' && cond ? `DDX: ${cond.ddx} · Typical age ${cond.age[0]}-${cond.age[1]}` : f.help;
                  return (
                    <div key={f.key} className={`s01-field${WIDE.has(f.type) || f.key === 'Red Flags / Precautions' ? ' s01-wide' : ''}${errs.length ? ' s01-has-err' : ''}`}>
                      <label className="s01-label" htmlFor={id}>{f.label || f.key}{f.required && <b aria-hidden="true">*</b>}</label>
                      <Control f={f} id={id} raw={raw} set={set} protocols={protocols} />
                      {help && <p className="s01-help">{help}</p>}
                      <ul className="s01-msgs" aria-live="polite">
                        {errs.map(m => <li key={'e' + m} className="s01-err">{m}</li>)}
                        {(result.warnings[f.key] || []).map(m => <li key={'w' + m} className="s01-warn">{m}</li>)}
                        {(result.info[f.key] || []).map(m => <li key={'i' + m} className="s01-info">{m}</li>)}
                      </ul>
                    </div>
                  );
                })}
              </div>
            </section>
          ))}
        </form>
      </div>

      <div className="s01-bar">
        <div className="s01-status">
          {touched && <span className={result.ok ? 's01-ok' : 's01-bad'}>{result.ok ? 'Valid' : plural(result.errorCount, 'error')}</span>}
          {result.warningCount > 0 && <span className="s01-warnc">{plural(result.warningCount, 'flag')} for review</span>}
        </div>
        <div className="s01-actions">
          <button type="button" className="s01-ghost" onClick={() => { if (window.confirm('Clear all fields?')) reset(); }}>Reset</button>
          {showExport && <button type="button" className="s01-ghost" onClick={() => act('csv')}>Export CSV row</button>}
          {showExport && <button type="button" className="s01-ghost" onClick={() => act('json')}>Download JSON</button>}
          <button type="button" className="s01-primary" onClick={() => act('submit')}>Validate &amp; Submit</button>
        </div>
      </div>
    </div>
  );
});

export default S01IntakeForm;
