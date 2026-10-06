// Shoulder intake router: Set A (common fields) -> red-flag check -> Set B (branch questions) -> wrapper.
//
//   <IntakeRouter
//     ref={routerRef}                  // optional: getRecord(), getRoute(), setRecord(rec), reset()
//     caseId="SH-C-000123"             // system/clinic-assigned; never entered on the form
//     initialRecord={record}           // optional: Set A fields (exact MRL column headers)
//     existingCaseIds={[...]}          // optional: Case ID uniqueness check
//     onRoute={(record, route) => {}}  // every time a route is found or changes
//     onSubmit={(record, route) => {}} // "Open wrapper" button; only enabled once routed
//   />
//
// `record` holds the 24 Set A fields keyed by the exact MRL column headers, in the Golden Dataset's
// cell format, so it can seed the chosen wrapper's form. `route` says which wrapper and why.
import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, useId } from 'react';
import { SET_A as S } from './setA.js';
import { RED_FLAGS } from './redFlags.js';
import { BRANCHES, FRACTURE_SITES } from './setB.js';
import { WRAPPERS } from './wrappers.js';
import { evaluate, serialize, parse, derivedDominant, emptyAnswers, clearAfter } from './rules.js';
import './IntakeRouter.css';

const emptyRaw = () => parse({});
const WIDE = new Set(['multi']);
const siteLabel = w => FRACTURE_SITES.find(s => s.wrapper === w)?.label || w;

function Seg({ name, options, value, onChange, disabled }) {
  return (
    <div className="ir-seg" role="radiogroup">
      {options.map(o => (
        <label key={o}>
          <input type="radio" name={name} value={o} checked={value === o} disabled={disabled} onChange={() => onChange(o)} />
          <span>{o}</span>
        </label>
      ))}
    </div>
  );
}

function Select({ id, value, options, onChange, placeholder = 'Select…' }) {
  return (
    <select id={id} value={value ?? ''} onChange={e => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {options.map(o => <option key={o} value={o}>{o}</option>)}
    </select>
  );
}

function Control({ f, id, raw, set }) {
  const k = f.key;
  const v = raw[k];
  const sub = p => raw[`${k}::${p}`];
  const setSub = p => val => set(`${k}::${p}`, val);
  const spec = (show, p, placeholder) =>
    show && <input type="text" className="ir-spec" value={sub(p) ?? ''} placeholder={placeholder} onChange={e => setSub(p)(e.target.value)} />;

  switch (f.type) {
    case 'text':
      return (
        <>
          <input type="text" id={id} value={v ?? ''} list={f.suggestions ? `${id}-dl` : undefined} autoComplete="off" onChange={e => set(k, e.target.value)} />
          {f.suggestions && <datalist id={`${id}-dl`}>{f.suggestions.map(s => <option key={s} value={s} />)}</datalist>}
        </>
      );
    case 'int': case 'dec':
      return (
        <div className="ir-num">
          <input type="text" inputMode="decimal" id={id} value={v ?? ''} placeholder={`${f.min}–${f.max}`} onChange={e => set(k, e.target.value)} />
          {f.unit && <span>{f.unit}</span>}
        </div>
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
          <div className="ir-chips">
            {f.options.map(o => (
              <label key={o}><input type="checkbox" checked={vals.includes(o)} onChange={() => toggle(o)} /><span>{o}</span></label>
            ))}
          </div>
          {spec(f.specify && vals.includes(f.specify), 'spec', 'Specify…')}
          {f.other && <input type="text" className="ir-spec" value={sub('other') ?? ''} placeholder="Other (free text)…" onChange={e => setSub('other')(e.target.value)} />}
        </>
      );
    }
    case 'bool':
      return <Seg name={id} options={['Yes', 'No']} value={v} onChange={val => set(k, val)} />;
    case 'ynText':
      return <><Seg name={id} options={['Yes', 'No']} value={v} onChange={val => set(k, val)} />{spec(v === 'Yes', 'text', f.placeholder)}</>;
    case 'derived': {
      const d = derivedDominant(raw);
      return (
        <div className="ir-derived">
          <Seg name={id} options={['Yes', 'No']} value={d.value} disabled={!d.editable} onChange={val => set(k, val)} />
          <small>{d.editable ? 'Bilateral / ambidextrous: choose manually.' : d.value ? 'Worked out from Laterality and Dominant Arm.' : 'Set Laterality and Dominant Arm.'}</small>
        </div>
      );
    }
    default:
      return null;
  }
}

function Choice({ name, options, value, onChange }) {
  return (
    <div className="ir-options" role="radiogroup">
      {options.map(o => (
        <label key={o.wrapper} className={value === o.wrapper ? 'ir-on' : ''}>
          <input type="radio" name={name} checked={value === o.wrapper} onChange={() => onChange(o.wrapper)} />
          <span className="ir-wcode">{o.wrapper}</span>
          <span className="ir-otext"><b>{o.label}</b>{o.detail && <small>{o.detail}</small>}</span>
        </label>
      ))}
    </div>
  );
}

const IntakeRouter = forwardRef(function IntakeRouter(
  { caseId = '', initialRecord, existingCaseIds, onRoute, onSubmit, theme, className = '' },
  ref,
) {
  const uid = useId().replace(/:/g, '');
  const rootRef = useRef(null);
  const [raw, setRaw] = useState(() => (initialRecord ? parse(initialRecord) : emptyRaw()));
  const [answers, setAnswers] = useState(emptyAnswers);
  const [touched, setTouched] = useState(false);

  const opts = useMemo(() => ({ caseId, existingCaseIds }), [caseId, existingCaseIds]);
  const ev = useMemo(() => evaluate(raw, answers, opts), [raw, answers, opts]);
  const record = useMemo(() => serialize(raw, caseId), [raw, caseId]);
  const route = ev.route;

  const onRouteRef = useRef(onRoute);
  onRouteRef.current = onRoute;
  const routeKey = route ? JSON.stringify(route) : '';
  useEffect(() => { if (route && onRouteRef.current) onRouteRef.current(record, route); }, [routeKey, record]); // eslint-disable-line react-hooks/exhaustive-deps

  const set = (name, value) => setRaw(prev => ({ ...prev, [name]: value }));
  const scrollTo = sel => requestAnimationFrame(() => rootRef.current?.querySelector(sel)?.scrollIntoView({ behavior: 'smooth', block: 'start' }));

  // ---- red flags ----
  const setFlag = (id, val) => setAnswers(a => {
    const rfPick = { ...a.rfPick };
    if (val === 'No') delete rfPick[id];
    return { ...a, rf: { ...a.rf, [id]: val }, rfPick, rfPrimary: '' };
  });
  const noneApply = () => setAnswers(a => ({ ...a, rf: Object.fromEntries(RED_FLAGS.map(r => [r.id, a.rf[r.id] === 'Yes' ? 'Yes' : 'No'])) }));

  // ---- Set B ----
  const answerBranch = (id, val) => setAnswers(a => {
    const next = clearAfter(a, id);
    const bPick = { ...next.bPick };
    if (val === 'No') delete bPick[id];
    return { ...next, b: { ...next.b, [id]: val }, bPick };
  });
  const pickBranch = (id, w) => setAnswers(a => { const next = clearAfter(a, id); return { ...next, bPick: { ...next.bPick, [id]: w } }; });
  const reopen = id => setAnswers(a => {
    const next = clearAfter(a, id);
    const b = { ...next.b }, bPick = { ...next.bPick };
    delete b[id]; delete bPick[id];
    return { ...next, b, bPick };
  });

  const reset = () => { setRaw(emptyRaw()); setAnswers(emptyAnswers()); setTouched(false); };
  const continueFromA = () => {
    setTouched(true);
    scrollTo(ev.setA.ok ? `#${uid}-rf` : '.ir-has-err');
  };

  useImperativeHandle(ref, () => ({
    getRecord: () => record,
    getRoute: () => route,
    setRecord: rec => { setRaw(parse(rec)); setAnswers(emptyAnswers()); setTouched(false); },
    reset,
  }), [record, route]); // eslint-disable-line react-hooks/exhaustive-deps

  const aOk = ev.setA.ok;
  const rfDone = aOk && ev.rf.done;
  const rfHit = rfDone && ev.rf.positive.length > 0;
  const steps = [
    { id: 'a', title: 'Set A · Common fields', state: aOk ? 'done' : touched ? 'err' : 'open', note: aOk ? '24 fields valid' : touched ? `${ev.setA.errorCount} to fix` : '24 fields' },
    { id: 'rf', title: 'Red-flag check', state: !aOk ? 'locked' : rfDone ? (rfHit ? 'alert' : 'done') : 'open', note: rfHit ? 'Urgent referral' : rfDone ? 'None found' : `${ev.rf.unanswered.length} to answer` },
    { id: 'b', title: 'Set B · Branch questions', state: !rfDone ? 'locked' : rfHit ? 'skipped' : ev.stage === 'done' ? 'done' : 'open', note: rfHit ? 'Skipped' : ev.stage === 'done' ? ev.route.branchTitle : 'One at a time' },
    { id: 'res', title: 'Wrapper', state: route ? 'done' : 'locked', note: route ? `${route.wrapper}` : 'Not yet' },
  ];

  const answered = new Map((ev.setB?.steps || []).map(s => [s.branch, s]));
  const current = ev.setB?.current || '';

  return (
    <div className={`ir ${className}`} data-theme={theme} ref={rootRef}>
      <div className="ir-layout">
        <nav className="ir-nav" aria-label="Intake steps">
          <div className="ir-case">
            <span>Case ID</span>
            <strong>{caseId || 'Assigned on save'}</strong>
            {ev.setA.errors['Case ID'] && <em className="ir-err">{ev.setA.errors['Case ID'][0]}</em>}
          </div>
          <ol>
            {steps.map(s => (
              <li key={s.id} className={`ir-step ir-s-${s.state}`}>
                <a href={`#${uid}-${s.id}`}><b>{s.title}</b><small>{s.note}</small></a>
              </li>
            ))}
          </ol>
        </nav>

        <div className="ir-main">
          {/* ---------------- Set A ---------------- */}
          <section className="ir-card" id={`${uid}-a`}>
            <header className="ir-head">
              <span className="ir-tag">Set A</span>
              <h2>Common fields</h2>
              <p>These 24 fields are the same in all 18 wrappers. Fill them in first.</p>
            </header>
            {S.SECTIONS.map(sec => (
              <div key={sec.id} className="ir-sec">
                <h3>{sec.title}</h3>
                <div className="ir-grid">
                  {S.FIELDS.filter(f => f.section === sec.id && f.type !== 'system').map(f => {
                    const id = `${uid}-${f.key.replace(/[^a-z0-9]+/gi, '-')}`;
                    const errs = touched ? ev.setA.errors[f.key] || [] : [];
                    return (
                      <div key={f.key} className={`ir-field${WIDE.has(f.type) ? ' ir-wide' : ''}${errs.length ? ' ir-has-err' : ''}`}>
                        <label className="ir-label" htmlFor={id}>{f.label || f.key}{f.required && <b aria-hidden="true">*</b>}</label>
                        <Control f={f} id={id} raw={raw} set={set} />
                        {f.help && <p className="ir-help">{f.help}</p>}
                        <ul className="ir-msgs" aria-live="polite">
                          {errs.map(m => <li key={'e' + m} className="ir-err">{m}</li>)}
                          {(ev.setA.warnings[f.key] || []).map(m => <li key={'w' + m} className="ir-warn">{m}</li>)}
                          {(ev.setA.info[f.key] || []).map(m => <li key={'i' + m} className="ir-info">{m}</li>)}
                        </ul>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
            <div className="ir-foot">
              {touched && !aOk && <span className="ir-bad">{ev.setA.errorCount} {ev.setA.errorCount === 1 ? 'field needs' : 'fields need'} fixing</span>}
              {aOk && <span className="ir-good">Set A is complete</span>}
              <button type="button" className="ir-primary" onClick={continueFromA}>Continue to red-flag check</button>
            </div>
          </section>

          {/* ---------------- Red flags ---------------- */}
          <section className={`ir-card${aOk ? '' : ' ir-locked'}`} id={`${uid}-rf`} aria-disabled={!aOk}>
            <header className="ir-head">
              <span className="ir-tag ir-tag-rf">Step 2</span>
              <h2>Red-flag check</h2>
              <p>Check these 9 danger signs before any branch question. If one is present, the case goes to urgent referral, whatever the main complaint is.</p>
            </header>
            {!aOk ? (
              <p className="ir-lockmsg">Finish Set A first.</p>
            ) : (
              <>
                <div className="ir-rflist">
                  {RED_FLAGS.map(r => {
                    const v = answers.rf[r.id];
                    return (
                      <div key={r.id} className={`ir-rf${v === 'Yes' ? ' ir-rf-yes' : ''}`}>
                        <div className="ir-rf-text">
                          <div className="ir-rf-top"><code>{r.id}</code><span className="ir-urg">{r.urgency}</span><span className="ir-to">→ {r.wrappers.join(' / ')}</span></div>
                          <b>{r.title}</b>
                          <small>{r.signs}</small>
                        </div>
                        <Seg name={`${uid}-${r.id}`} options={['Yes', 'No']} value={v} onChange={val => setFlag(r.id, val)} />
                        {v === 'Yes' && r.wrappers.length > 1 && (
                          <div className="ir-rf-pick">
                            <span>{r.pickLabel}</span>
                            <Choice name={`${uid}-${r.id}-pick`} value={answers.rfPick[r.id]}
                              options={r.wrappers.map(w => ({ wrapper: w, label: siteLabel(w) }))}
                              onChange={w => setAnswers(a => ({ ...a, rfPick: { ...a.rfPick, [r.id]: w }, rfPrimary: '' }))} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {ev.rf.needPrimary && (
                  <div className="ir-primary-pick">
                    <p><b>These red flags point to different wrappers.</b> A case is the main (primary) case in only one wrapper. Choose it:</p>
                    <Choice name={`${uid}-primary`} value={answers.rfPrimary}
                      options={ev.rf.wrappers.map(w => ({ wrapper: w, label: WRAPPERS[w].name }))}
                      onChange={w => setAnswers(a => ({ ...a, rfPrimary: w }))} />
                  </div>
                )}
                <div className="ir-foot">
                  <span className={ev.rf.positive.length ? 'ir-bad' : 'ir-muted'}>
                    {ev.rf.positive.length ? `${ev.rf.positive.length} red flag${ev.rf.positive.length > 1 ? 's' : ''} present` : ev.rf.unanswered.length ? `${ev.rf.unanswered.length} of 9 still to answer` : 'No red flags'}
                  </span>
                  {ev.rf.unanswered.length > 0 && <button type="button" onClick={noneApply}>Mark the rest as No</button>}
                </div>
              </>
            )}
          </section>

          {/* ---------------- Set B ---------------- */}
          <section className={`ir-card${rfDone && !rfHit ? '' : ' ir-locked'}`} id={`${uid}-b`} aria-disabled={!rfDone || rfHit}>
            <header className="ir-head">
              <span className="ir-tag">Set B</span>
              <h2>Branch questions</h2>
              <p>Answer in order. The first "Yes" picks the branch, and the branch picks the wrapper.</p>
            </header>
            {!rfDone ? (
              <p className="ir-lockmsg">Finish the red-flag check first.</p>
            ) : rfHit ? (
              <p className="ir-lockmsg">Skipped. A red flag has already routed this case.</p>
            ) : (
              <ol className="ir-ladder">
                {BRANCHES.map((br, i) => {
                  const st = answered.get(br.id);
                  const isCur = br.id === current;
                  const isEnd = route && route.branch === br.id;
                  const later = !st && !isCur && !isEnd;
                  const hint = br.hint ? br.hint(raw) : '';
                  return (
                    <li key={br.id} className={`ir-br${isCur ? ' ir-cur' : ''}${isEnd ? ' ir-end' : ''}${st && st.answer === 'No' ? ' ir-no' : ''}${later ? ' ir-later' : ''}`}>
                      <div className="ir-br-head">
                        <span className="ir-br-n">{i + 1}</span>
                        <span className="ir-br-title">{br.title}</span>
                        <span className="ir-br-w">{br.wrappers.map(w => <code key={w}>{w}</code>)}</span>
                        {st && (
                          <span className="ir-br-ans">
                            <em className={st.answer === 'No' ? 'ir-ans-no' : 'ir-ans-yes'}>{br.pickOnly ? st.pick : st.answer}{!br.pickOnly && st.pick ? ` · ${st.pick}` : ''}</em>
                            <button type="button" className="ir-link" onClick={() => reopen(br.id)}>Change</button>
                          </span>
                        )}
                      </div>
                      {isCur && (
                        <div className="ir-br-body">
                          <p className="ir-q">{br.question}</p>
                          {br.help.length > 0 && <ul className="ir-bhelp">{br.help.map(h => <li key={h}>{h}</li>)}</ul>}
                          {hint && <p className="ir-hint">{hint}</p>}
                          {!br.pickOnly && <Seg name={`${uid}-${br.id}`} options={['Yes', 'No']} value={answers.b[br.id]} onChange={val => answerBranch(br.id, val)} />}
                          {ev.setB.conflict && <p className="ir-err ir-block">{ev.setB.conflict}</p>}
                          {br.pick && (br.pickOnly || answers.b[br.id] === 'Yes') && !ev.setB.conflict && (
                            <div className="ir-sub">
                              {!br.pickOnly && <p className="ir-q2">{br.pick.question}</p>}
                              <Choice name={`${uid}-${br.id}-pick`} options={br.pick.options} value={answers.bPick[br.id]} onChange={w => pickBranch(br.id, w)} />
                            </div>
                          )}
                        </div>
                      )}
                      {isEnd && br.fallback && <div className="ir-br-body"><p className="ir-q">{br.question}</p></div>}
                    </li>
                  );
                })}
              </ol>
            )}
          </section>

          {/* ---------------- Result ---------------- */}
          <section className={`ir-card ir-result${route ? '' : ' ir-locked'}`} id={`${uid}-res`}>
            <header className="ir-head">
              <span className={`ir-tag${route?.via === 'redflag' ? ' ir-tag-rf' : ''}`}>Result</span>
              <h2>{route ? 'Open this wrapper' : 'Wrapper'}</h2>
            </header>
            {!route ? (
              <p className="ir-lockmsg">The wrapper appears here once the questions above are answered.</p>
            ) : (
              <>
                <div className={`ir-dest${route.via === 'redflag' ? ' ir-dest-rf' : ''}`}>
                  <span className="ir-dest-code">{route.wrapper}</span>
                  <div>
                    <b>{route.wrapperName}</b>
                    <small>
                      {route.via === 'redflag'
                        ? `Urgent referral: red flag ${route.redFlags.join(', ')}. Set B was skipped.`
                        : `Branch ${BRANCHES.findIndex(b => b.id === route.branch) + 1}: ${route.branchTitle}`}
                    </small>
                  </div>
                </div>
                {route.via === 'redflag' && (
                  <ul className="ir-rfres">
                    {route.redFlags.map(id => { const r = RED_FLAGS.find(x => x.id === id); return <li key={id}><code>{id}</code> {r.title} <span className="ir-urg">{r.urgency}</span></li>; })}
                  </ul>
                )}
                {route.halt && <p className="ir-halt">{route.halt}</p>}
                {route.path.length > 0 && (
                  <div className="ir-path">
                    <h3>How it got here</h3>
                    <ol>{route.path.map(p => <li key={p.branch}><span>{p.title}</span><em className={p.answer === 'No' ? 'ir-ans-no' : 'ir-ans-yes'}>{p.pick && p.answer === 'Yes' ? `Yes · ${p.pick}` : p.answer}</em></li>)}</ol>
                  </div>
                )}
                {route.alsoCheck.length > 0 && (
                  <div className="ir-also">
                    <h3>Also check</h3>
                    <ul>{route.alsoCheck.map(c => <li key={c.note}><code>{c.to}</code> {c.note}</li>)}</ul>
                    <p className="ir-help">Before you finalise, check the Cross-Reference Index. It is in the Wrapper Routing Map, which is not in this repo.</p>
                  </div>
                )}
                <div className="ir-foot">
                  <span className="ir-muted">Next: open {route.wrapper} and carry on with its group-specific fields. Set A is passed along.</span>
                  {onSubmit && <button type="button" className="ir-primary" onClick={() => onSubmit(record, route)}>Open {route.wrapper}</button>}
                </div>
              </>
            )}
          </section>
        </div>
      </div>
      <div className="ir-bar">
        <span className="ir-muted">{route ? `Routed to ${route.wrapper} · ${route.wrapperName}` : 'Not routed yet'}</span>
        <button type="button" onClick={reset}>Start over</button>
      </div>
    </div>
  );
});

export default IntakeRouter;
