// Shoulder CDSS routing: everything asked before a wrapper is opened, drawn as a metro line. Red flags and the branch
// walk pick a branch; the node walk then walks that branch, one question at a time, down to one wrapper.
//
//   <ShoulderRouter
//     ref={routerRef}                  // optional: getRecord(), getAnswers(), evaluate(), reset(), loadSample(i)
//     caseId="S05-C-000123"            // system/clinic-assigned; shown read-only, never typed in
//     onChange={(answers, ev) => {}}   // every edit
//     onRouted={record => {}}          // when the clinician confirms the wrapper
//     theme="light"                    // optional; otherwise the OS setting, with a toggle in the header
//     persist                          // keep progress in this browser (localStorage); default true
//     applyThemeTo="document"          // optional: put the theme on <html> instead of the component root
//     allowDownload={false}            // optional: hide "Download JSON" where downloads are blocked
//     initialSample={24}               // optional: open with this SAMPLES case loaded (when nothing is saved)
//   />
//
// The confirmed record keys every answer by its exact Medical Record Library column: `core` holds the 23 shared
// columns plus Red Flags / Precautions, `wrapperFields` holds each wrapper's own columns, `rows` holds the one wrapper's
// row, `routing` holds the trace (red flags, branch walk, node walk).
import { createContext, forwardRef, useCallback, useContext, useEffect, useId, useImperativeHandle, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { BUILT, WRAPPERS, SHARED_FIELDS, ROUTING_FIELDS, RED_FLAGS_DOC, RED_FLAG_FIELD_NOTES, WORKFLOW, SAMPLES } from './routingData.generated.js';
import { STOPS, LINES, CORE_FIELDS, HISTORY_FIELDS, PROCEDURES, WHEN_HINT, COL, QUESTIONS, KEYS, FLAGS, SCREENS, SCREEN, FLAG_BRANCH, FULL_ROM, NODES, NODE, NODE_START, EXIT, answerNode, mriCell, derivedDominant, surgeryOf } from './routingSpec.js';
import { evaluate, routeOf, buildRecord, fromDatasetRow, fillNormal, sharedCell, nodeKey, nodeReasonKey } from './engine.js';
import { NA, has, num, capsularPattern, ROM_NORM, REFLEX, girthDiff, formatFever, parseMmt3, formatMmt3, parseMri, parseUsSize } from './values.js';
import './ShoulderRouter.css';

// ---------- small helpers ----------
const cls = (...x) => x.filter(Boolean).join(' ');
const optV = o => (typeof o === 'object' ? o.v : o);
const optL = o => (typeof o === 'object' ? o.l : o);
const bc = id => `var(--b${SCREEN[id].n})`;
const lc = stop => `var(${LINES[stop.line].c})`;
const fmt = n => Number(n).toLocaleString('en-GB');
const clip = (s, n) => (s && s.length > n ? `${s.slice(0, n - 1)}…` : s);
const reduced = () => { try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
const BOILER = /generic_check\(\)|no dedicated override/i;
// A build can compile the file download out: scripts/build_artifact.mjs defines __SR_DOWNLOADS__ as false,
// because the claude.ai artifact viewer blocks downloads. Everywhere else it is undefined, so downloads stay on.
const DOWNLOADS = typeof __SR_DOWNLOADS__ === 'undefined' || __SR_DOWNLOADS__; // eslint-disable-line no-undef
const ALL_SHARED = [...CORE_FIELDS, ...HISTORY_FIELDS];
const BRANCH_OF = {};
for (const s of SCREENS) for (const w of s.wrappers) (BRANCH_OF[w] ||= []).push(s.id);
const INDEX_WRAPPERS = Object.values(WRAPPERS).filter(W => W.surgery.some(([k, c]) => k.includes('index procedure') && c > 0)).map(W => W.id);

// Which rules read which answer (shown on the field cards).
const READERS = {};
const addReader = (k, id) => { const r = (READERS[k] ||= []); if (!r.includes(id)) r.push(id); };
for (const f of FLAGS) { f.questions.forEach(k => addReader(k, f.id)); (f.reads || []).forEach(k => addReader(k, f.id)); }
for (const s of SCREENS) s.questions.forEach(k => addReader(k, s.id));
for (const n of NODES) n.questions.forEach(k => addReader(k, n.id));
for (const f of ALL_SHARED) (f.reads || []).forEach(id => addReader(f.key, id));
const ruleName = id => (SCREEN[id] ? `B${SCREEN[id].n} ${SCREEN[id].name}` : NODE[id] ? `Node ${id} ${NODE[id].name}` : `${id} ${RED_FLAGS_DOC[id]?.desc || ''}`);
// The branch a decision point or node belongs to (for its colour).
const branchOfRule = id => (SCREEN[id] ? id : NODE[id] ? NODE[id].branch : null);
const labelOf = k => QUESTIONS[k]?.label || ALL_SHARED.find(f => f.key === k.split('::')[0])?.label || k.split('::')[0];

function numError(def, v) {
  if (v === undefined || v === null || v === '' || v === NA) return null;
  const s = String(v).trim();
  if (!/^-?\d+(\.\d+)?$/.test(s)) return 'Must be a number.';
  const n = Number(s);
  if (def.kind === 'int' && !Number.isInteger(n)) return 'Must be a whole number.';
  if (def.decimals != null && (s.split('.')[1] || '').length > def.decimals) return `At most ${def.decimals} decimal place${def.decimals === 1 ? '' : 's'}.`;
  if (n < def.min || n > def.max) return `Out of range: valid ${def.min}–${def.max}. Rejected, not clamped.`;
  return null;
}

function readStore(key) { try { const v = JSON.parse(localStorage.getItem(key)); return v && v.v === 1 ? v : null; } catch { return null; } }
function writeStore(key, v) { try { localStorage.setItem(key, JSON.stringify({ v: 1, ...v })); } catch { /* storage blocked */ } }

// ---------- metro shapes ----------
function shapeGeo(kind, r) {
  const poly = (n, rot = -Math.PI / 2, rr = r) => Array.from({ length: n }, (_, i) => { const a = rot + (i * 2 * Math.PI) / n; return `${(rr * Math.cos(a)).toFixed(2)},${(rr * Math.sin(a)).toFixed(2)}`; }).join(' ');
  switch (kind) {
    case 'triangle': return { tag: 'polygon', points: poly(3, -Math.PI / 2, r * 1.18) };
    case 'square': return { tag: 'rect', x: -r * 0.86, y: -r * 0.86, width: r * 1.72, height: r * 1.72 };
    case 'diamond': return { tag: 'polygon', points: `0,${-r * 1.15} ${r * 1.15},0 0,${r * 1.15} ${-r * 1.15},0` };
    case 'pentagon': return { tag: 'polygon', points: poly(5, -Math.PI / 2, r * 1.05) };
    case 'gem': return { tag: 'polygon', points: poly(6, 0, r * 1.05) };
    case 'star': {
      const p = [];
      for (let i = 0; i < 10; i++) { const rr = i % 2 ? r * 0.55 : r * 1.25; const a = -Math.PI / 2 + (i * Math.PI) / 5; p.push(`${(rr * Math.cos(a)).toFixed(2)},${(rr * Math.sin(a)).toFixed(2)}`); }
      return { tag: 'polygon', points: p.join(' ') };
    }
    case 'cross': { const a = r * 0.42, b = r * 1.05; return { tag: 'polygon', points: `${-a},${-b} ${a},${-b} ${a},${-a} ${b},${-a} ${b},${a} ${a},${a} ${a},${b} ${-a},${b} ${-a},${a} ${-b},${a} ${-b},${-a} ${-a},${-a}` }; }
    case 'wedge': return { tag: 'path', d: `M0,${-r * 1.15} L${r * 0.95},${r * 0.75} A${r * 1.2},${r * 1.2} 0 0 1 ${-r * 0.95},${r * 0.75} Z` };
    default: return { tag: 'circle', cx: 0, cy: 0, r };
  }
}
function ShapeEl({ kind, r, ...rest }) {
  const { tag: T, ...geo } = shapeGeo(kind, r);
  return <T className="sr-shape" {...geo} {...rest} />;
}
function Shape({ kind, size = 24, fill = 'var(--station)', stroke = 'var(--ink)', sw }) {
  return (
    <svg width={size} height={size} viewBox={`${-size / 2} ${-size / 2} ${size} ${size}`} aria-hidden="true" style={{ flex: 'none', overflow: 'visible' }}>
      <ShapeEl kind={kind} r={size * 0.32} fill={fill} stroke={stroke} strokeWidth={sw || Math.max(2, size * 0.1)} strokeLinejoin="round" />
    </svg>
  );
}
// 45-degree metro path: horizontal, diagonal, horizontal.
function metroPath(x1, y1, x2, y2, bendAt = 0.5) {
  const dy = y2 - y1, dx = x2 - x1, ady = Math.abs(dy);
  if (ady < 1) return `M${x1},${y1} H${x2}`;
  if (Math.abs(dx) < ady) return `M${x1},${y1} V${y1 + (dy - Math.sign(dy) * Math.abs(dx))} L${x2},${y2}`;
  const mid = x1 + dx * bendAt, a = mid - (Math.sign(dx) * ady) / 2, b = mid + (Math.sign(dx) * ady) / 2;
  return `M${x1},${y1} H${a} L${b},${y2} H${x2}`;
}

// ---------- hover card ----------
const Ctx = createContext(null);
const useR = () => useContext(Ctx);

function useTip() {
  const [tip, setTip] = useState(null);
  const timer = useRef(null), pinned = useRef(false), owner = useRef(null);
  const api = useMemo(() => {
    const show = (el, content, opts = {}) => { clearTimeout(timer.current); pinned.current = !!opts.pin; owner.current = el; setTip({ rect: el.getBoundingClientRect(), content, pin: !!opts.pin, color: opts.color }); };
    const hide = () => { clearTimeout(timer.current); pinned.current = false; owner.current = null; setTip(null); };
    const hideSoon = () => { clearTimeout(timer.current); timer.current = setTimeout(() => { if (!pinned.current) setTip(null); }, 140); };
    const keep = () => clearTimeout(timer.current);
    const hover = (build, opts = {}) => ({
      onPointerEnter: e => { if (e.pointerType === 'mouse' && !pinned.current) show(e.currentTarget, build(), opts); },
      onPointerLeave: e => { if (e.pointerType === 'mouse' && !pinned.current) hideSoon(); },
      onFocus: e => { if (!pinned.current) show(e.currentTarget, build(), opts); },
      onBlur: () => { if (!pinned.current) hideSoon(); },
    });
    const on = (build, opts = {}) => ({
      ...hover(build, opts),
      onClick: e => { e.stopPropagation(); if (pinned.current && owner.current === e.currentTarget) hide(); else show(e.currentTarget, build(), { ...opts, pin: true }); },
    });
    return { show, hide, hideSoon, keep, hover, on, pinned, owner };
  }, []);
  return [tip, api];
}

function Tip({ tip, api }) {
  const ref = useRef(null);
  const [pos, setPos] = useState(null);
  useLayoutEffect(() => {
    if (!tip || !ref.current) { setPos(null); return; }
    const r = tip.rect, vw = window.innerWidth, vh = window.innerHeight, tw = ref.current.offsetWidth, th = ref.current.offsetHeight;
    let x = r.right + 14, y = r.top - 8;
    if (x + tw > vw - 12) x = r.left - tw - 14;
    if (x < 12) { x = Math.min(Math.max(12, r.left), vw - tw - 12); y = r.bottom + 10; if (y + th > vh - 12) y = r.top - th - 10; }
    setPos({ left: x, top: Math.min(Math.max(12, y), vh - th - 12) });
  }, [tip]);
  if (!tip) return null;
  return (
    <div ref={ref} className="sr-tip" role="dialog" aria-live="polite"
      style={{ left: pos?.left ?? -9999, top: pos?.top ?? 0, borderColor: tip.color || 'var(--ink)', visibility: pos ? 'visible' : 'hidden' }}
      onPointerEnter={api.keep} onPointerLeave={() => { if (!tip.pin) api.hideSoon(); }}>
      {tip.pin && <button type="button" className="x" aria-label="Close" onClick={api.hide}>×</button>}
      {tip.content}
      <div className="pin">{tip.pin ? 'Pinned. Press Esc or × to close.' : 'Click to pin this card.'}</div>
    </div>
  );
}
const TipHead = ({ shape = 'circle', color, title, sub }) => (
  <div className="tt"><Shape kind={shape} size={30} stroke={color || 'var(--ink)'} sw={3} /><div><b>{title}</b>{sub && <div className="small muted">{sub}</div>}</div></div>
);
const TipSec = ({ title, children }) => <div className="sec"><h3>{title}</h3>{children}</div>;
function Bars({ rows, total }) {
  const t = total || rows.reduce((s, r) => s + r[1], 0) || 1;
  return (
    <div className="sr-bars">
      {rows.map(([v, c]) => {
        const p = (100 * c) / t;
        return <div className="b" key={v}><span title={v}>{v || '(blank)'}</span><em>{p < 1 ? '<1' : Math.round(p)}%</em><i style={{ '--w': `${Math.max(1.5, p)}%` }} /></div>;
      })}
    </div>
  );
}
const ReaderChips = ({ k }) => {
  const r = READERS[k] || [];
  return r.length
    ? <div className="sr-chips">{r.map(id => <span key={id} className="sr-chip">{branchOfRule(id) && <span className="sw" style={{ background: bc(branchOfRule(id)) }} />}{ruleName(id)}</span>)}</div>
    : <div className="small muted">Recorded for the wrapper record. No routing rule reads it.</div>;
};

function sharedCard(def) {
  const sf = SHARED_FIELDS[def.key] || {};
  return (
    <>
      <TipHead shape="circle" color="var(--red)" title={def.label || def.key} sub="Shared column · the same header in all 18 workbooks" />
      <TipSec title="Exact Excel column"><code>{def.key}</code></TipSec>
      {sf.values && (
        <TipSec title={`Valid values · ${sf.rule}`}>
          <div className="small">{sf.type}: {sf.values}</div>
          {sf.sameInAll18 && <div className="small muted">Identical Layer 1 rule in all 18 workbooks.</div>}
        </TipSec>
      )}
      {sf.notes && !BOILER.test(sf.notes) && <TipSec title="Rule note"><div className="small">{clip(sf.notes, 340)}</div></TipSec>}
      {sf.top && <TipSec title={`Across the 18 Golden Datasets · ${fmt(BUILT.rows)} rows`}><Bars rows={sf.top.slice(0, 7)} total={BUILT.rows} /></TipSec>}
      {def.key === COL.surgery && (
        <TipSec title="What the datasets show">
          <div className="small">Only {INDEX_WRAPPERS.join(' and ')} record a surgery as "(index procedure for this record)", in every row. That phrase is what separates the two surgery decision points (B2, B3) from earlier, unrelated operations.</div>
        </TipSec>
      )}
      <TipSec title="How routing uses it"><ReaderChips k={def.key} /></TipSec>
    </>
  );
}

function questionCard(q) {
  if (q.ui) {
    return (
      <>
        <TipHead shape="circle" color="var(--muted)" title={q.label} sub="Not an Excel column" />
        <div className="small">{q.help || (q.col ? `A "Yes" is written into ${q.col}, a column all 18 workbooks have.` : 'A routing helper.')}</div>
        <TipSec title="Read by"><ReaderChips k={q.key} /></TipSec>
      </>
    );
  }
  const first = (READERS[q.key] || []).find(id => SCREEN[id]);
  return (
    <>
      <TipHead shape={first ? SCREEN[first].shape : 'cross'} color={first ? bc(first) : 'var(--stop)'} title={q.label} sub={q.cols.map(([w]) => `${w} ${WRAPPERS[w].name}`).join(' + ')} />
      <TipSec title={q.cols.length > 1 ? 'Exact Excel columns' : 'Exact Excel column'}>
        {q.cols.map(([w, c]) => <div key={w} className="small"><b>{w}</b> · <code>{c}</code></div>)}
      </TipSec>
      {q.kind === 'derivedFrom' && <div className="small">Filled from "Previous shoulder surgery" in History, so it is never typed twice.</div>}
      {q.cols.map(([w, c]) => {
        const info = ROUTING_FIELDS[c]?.[w];
        if (!info) return null;
        return (
          <TipSec key={`d${w}`} title={`${w} Golden Dataset · ${fmt(info.rows)} rows`}>
            {info.values && <div className="small">{info.rule}: {info.type}. {clip(info.values, 220)}</div>}
            <Bars rows={info.top.slice(0, 6)} total={info.rows} />
            {info.notes && !BOILER.test(info.notes) && <div className="small muted">{clip(info.notes, 260)}</div>}
          </TipSec>
        );
      })}
      <TipSec title="Read by"><ReaderChips k={q.key} /></TipSec>
    </>
  );
}

function wrapperCard(w) {
  const W = WRAPPERS[w], br = BRANCH_OF[w] || [];
  return (
    <>
      <TipHead shape="square" color={br[0] ? bc(br[0]) : 'var(--ink)'} title={`${w} · ${W.name}`} sub={`${fmt(W.rows)} rows · ${W.columns} columns · ${W.conditions.length} conditions`} />
      <TipSec title="Conditions (Layer 3 DDX rules)"><ul>{W.conditions.map(c => <li key={c.name}>{c.name} <span className="muted">· {c.age}</span></li>)}</ul></TipSec>
      <TipSec title="Grading field (picks the protocol)"><div className="small"><b>{W.grading.field}</b>: {W.grading.values}</div></TipSec>
      <TipSec title="Branch"><div className="sr-chips">{br.map(id => <span key={id} className="sr-chip"><span className="sw" style={{ background: bc(id) }} />B{SCREEN[id].n} {SCREEN[id].name}</span>)}</div></TipSec>
      {W.redFlags.length > 0 && <TipSec title="Red flags that route here"><div className="sr-chips">{W.redFlags.map(id => <span key={id} className="sr-chip stop">{id}</span>)}</div></TipSec>}
      <div className="small muted">{W.file}</div>
    </>
  );
}

function screenCard(s) {
  const docs = WORKFLOW.presenting.filter(p => p.ids.some(id => s.wrappers.includes(id)));
  return (
    <>
      <TipHead shape={s.shape} color={bc(s.id)} title={`B${s.n} · ${s.name}`} sub={`Workflow Guide, Step 2: “${s.doc}”`} />
      <div className="small">{s.ask}</div>
      <TipSec title="Wrappers"><div className="sr-chips">{s.wrappers.map(w => <span key={w} className="sr-chip">{w} {WRAPPERS[w].name}</span>)}</div></TipSec>
      {docs.length > 0 && <TipSec title="The guide's presenting picture"><ul>{docs.map(d => <li key={d.picture}>{d.picture} → {d.group}</li>)}</ul></TipSec>}
      {s.questions.length > 0 && <TipSec title="Asks"><ul>{s.questions.map(k => <li key={k}>{labelOf(k)}</li>)}</ul></TipSec>}
      {s.draft && <div className="small muted">Draft rule: the threshold is ours and needs clinical sign-off.</div>}
    </>
  );
}

// ---------- controls ----------
function Seg({ options, value, onChange, na, naLabel = 'Not assessed', label, disabled }) {
  const opts = options.map(o => ({ v: optV(o), l: optL(o) }));
  const known = value === undefined || value === null || value === '' || value === NA || opts.some(o => o.v === value);
  return (
    <div className="sr-seg" role="radiogroup" aria-label={label}>
      {opts.map(o => (
        <button key={o.v} type="button" role="radio" aria-checked={value === o.v} className={value === o.v ? 'on' : ''} disabled={disabled} title={o.l !== o.v ? `Excel value: ${o.v}` : undefined} onClick={() => onChange(value === o.v ? '' : o.v)}>{o.l}</button>
      ))}
      {na && <button type="button" role="radio" aria-checked={value === NA} className={cls('na', value === NA && 'on')} disabled={disabled} onClick={() => onChange(value === NA ? '' : NA)}>{naLabel}</button>}
      {!known && <button type="button" role="radio" aria-checked="true" className="on raw" title="Value from the Golden Dataset that is not one of the listed options" onClick={() => onChange('')}>{String(value)}</button>}
    </div>
  );
}

function NumIn({ def, value, onChange, na, naLabel, label }) {
  const err = numError(def, value);
  return (
    <div className="sr-inrow">
      <input className={cls('sr-in num', err && 'err')} inputMode="decimal" aria-label={label} aria-invalid={!!err} value={value === NA ? '' : value ?? ''} placeholder={`${def.min}–${def.max}`} onChange={e => onChange(e.target.value.trim())} />
      {def.unit && <span className="sr-unit">{def.unit}</span>}
      {na && <div className="sr-seg"><button type="button" className={cls('na', value === NA && 'on')} aria-pressed={value === NA} onClick={() => onChange(value === NA ? '' : NA)}>{naLabel || 'Not assessed'}</button></div>}
    </div>
  );
}

function TextIn({ value, onChange, suggestions, placeholder, label }) {
  const id = useId();
  return (
    <>
      <input className="sr-in" type="text" value={value ?? ''} placeholder={placeholder} aria-label={label} list={suggestions ? id : undefined} autoComplete="off" onChange={e => onChange(e.target.value)} />
      {suggestions && <datalist id={id}>{suggestions.map(s => <option key={s} value={s} />)}</datalist>}
    </>
  );
}

function Multi({ def, value, onChange, spec, onSpec }) {
  const vals = Array.isArray(value) ? value : [];
  const [more, setMore] = useState(false);
  const extra = vals.filter(x => !def.options.includes(x) && !(more && (def.more || []).includes(x)));
  const toggle = o => {
    let n = vals.includes(o) ? vals.filter(x => x !== o) : [...vals, o];
    if (o === 'None' && !vals.includes('None')) n = ['None'];
    else if (o !== 'None') n = n.filter(x => x !== 'None');
    onChange(n.length ? n : '');
  };
  return (
    <>
      <div className="sr-seg">
        {def.options.map(o => <button key={o} type="button" aria-pressed={vals.includes(o)} className={vals.includes(o) ? 'on' : ''} onClick={() => toggle(o)}>{o}</button>)}
        {extra.map(x => <button key={x} type="button" aria-pressed="true" className="on raw" title="Written in the Golden Datasets; not in the Layer 1 vocabulary" onClick={() => toggle(x)}>{x}</button>)}
        {more && (def.more || []).map(o => <button key={o} type="button" aria-pressed={vals.includes(o)} className={cls('raw', vals.includes(o) && 'on')} title="Written in the Golden Datasets; not in the Layer 1 vocabulary" onClick={() => toggle(o)}>{o}</button>)}
        {(def.more || []).length > 0 && <button type="button" className="na" onClick={() => setMore(m => !m)}>{more ? 'Fewer' : `More from the datasets (${def.more.length})`}</button>}
      </div>
      {def.specify && vals.includes(def.specify) && <input className="sr-in" placeholder="Specify…" value={spec || ''} onChange={e => onSpec(e.target.value)} />}
    </>
  );
}

// The procedure list, grouped by the workbook whose cells spell it that way.
const PROC_BY_SOURCE = (() => {
  const g = new Map();
  for (const p of PROCEDURES) { const k = p.from; if (!g.has(k)) g.set(k, []); g.get(k).push(p); }
  return [...g.entries()];
})();

function SurgeryIn() {
  const { a, set, setMany } = useR();
  const k = COL.surgery, v = a[k], p = n => a[`${k}::${n}`];
  const s = surgeryOf(a);
  const route = !s.any || !s.proc ? null
    : !s.thisSide ? 'The other shoulder: no surgical decision point fires.'
      : s.proc.group === 'S13' ? 'A joint replacement in this shoulder: decision point B2 routes it to S13.'
        : s.proc.group === 'fracture' ? 'Fracture surgery: the fracture decision point (B1) handles it.'
          : s.proc.group === 'none' ? 'An earlier, unrelated operation: recorded only.'
            : s.proc.group === 'S12' || s.proc.group === 'S12-other'
              ? (s.index === 'Yes' ? 'The reason for this visit: decision point B3 routes it to S12.' : s.index === 'No' ? 'An earlier operation, not the reason for this visit: recorded only.' : 'Say whether it is the reason for this visit.')
              : `Post-operative care for this procedure lives inside ${s.proc.group}, so no surgical decision point fires.`;
  const cell = sharedCell(HISTORY_FIELDS.find(f => f.kind === 'surgery'), a);
  const clearParts = Object.fromEntries(['procedure', 'side', 'when', 'index', 'spec'].map(n => [`${k}::${n}`, '']));
  const fmt = s.proc?.fmt;
  const arthro = QUESTIONS[KEYS.arthro];
  return (
    <>
      <Seg options={['Yes', 'No']} value={v} label="Previous shoulder surgery" na onChange={x => (x === 'Yes' ? set(k, 'Yes') : setMany({ [k]: x, ...clearParts }))} />
      {v === 'Yes' && (
        <div className="sr-sub">
          <div className="q">Procedure, as the datasets write it</div>
          <select className="sr-in" aria-label="Procedure" value={p('procedure') || ''} onChange={e => set(`${k}::procedure`, e.target.value)}>
            <option value="">Select the procedure…</option>
            {PROC_BY_SOURCE.map(([from, list]) => (
              <optgroup key={from} label={from.includes('Layer') ? 'Other' : `As written in ${from}`}>
                {list.map(x => <option key={x.v} value={x.v}>{x.v}</option>)}
              </optgroup>
            ))}
          </select>
          {s.proc?.group === 'S13' && (
            <>
              <div className="q">{arthro.label} <span className="muted">(S13 column)</span></div>
              <Seg options={arthro.options} value={typeof a[KEYS.arthro] === 'string' ? a[KEYS.arthro] : null} label={arthro.label} onChange={x => set(KEYS.arthro, x)} />
            </>
          )}
          {p('procedure') === 'Other (specify)' && <input className="sr-in" placeholder="Name the procedure" value={p('spec') || ''} onChange={e => set(`${k}::spec`, e.target.value)} />}
          <div className="q">Which shoulder?</div>
          <Seg options={['This shoulder', 'Other side']} value={p('side') || 'This shoulder'} label="Which shoulder" onChange={x => set(`${k}::side`, x || 'This shoulder')} />
          <div className="q">Is this surgery the reason for this visit (post-op rehab, or a problem with it)?</div>
          <Seg options={['Yes', 'No']} value={p('index')} label="Reason for this visit" onChange={x => set(`${k}::index`, x)} />
          {/* No "when" in these cells: S12 records the timing in its own Post-Operative Week field. */}
          {!(fmt === 'bare' || fmt === 'prevside' || (s.index === 'Yes' && s.thisSide && (s.proc?.group === 'S12' || s.proc?.group === 'S12-other'))) && (
            <>
              <div className="q">When</div>
              <input className="sr-in" placeholder={WHEN_HINT[fmt] || 'e.g. approx. 3 years ago'} value={p('when') || ''} onChange={e => set(`${k}::when`, e.target.value)} />
            </>
          )}
          {route && <div className="sr-hint">{route}</div>}
        </div>
      )}
      {cell && <div className="sr-colname">Excel cell: <b>{cell}</b></div>}
    </>
  );
}

function Rom3In({ k }) {
  const { a, set } = useR();
  const v = a[k];
  const obj = v && typeof v === 'object' ? v : null;
  const [s, setS] = useState(() => ({ er: obj ? String(obj.er) : '', abd: obj ? String(obj.abd) : '', ir: obj ? String(obj.ir) : '' }));
  useEffect(() => {
    if (obj) setS(cur => (Number(cur.er) === obj.er && Number(cur.abd) === obj.abd && Number(cur.ir) === obj.ir ? cur : { er: String(obj.er), abd: String(obj.abd), ir: String(obj.ir) }));
    else if (v === FULL_ROM || v === NA) setS({ er: '', abd: '', ir: '' });
  }, [v, obj?.er, obj?.abd, obj?.ir]); // eslint-disable-line react-hooks/exhaustive-deps
  const commit = next => {
    setS(next);
    const n = ['er', 'abd', 'ir'].map(x => (next[x] === '' ? NaN : Number(next[x])));
    if (n.every(x => Number.isFinite(x) && x >= 0 && x <= 180)) set(k, { er: n[0], abd: n[1], ir: n[2] });
    else if (obj) set(k, '');
  };
  const p = obj ? capsularPattern(obj) : null;
  return (
    <>
      <div className="sr-inrow">
        {['er', 'abd', 'ir'].map(x => (
          <label key={x}>{x.toUpperCase()}<input className="sr-in num" style={{ width: 76 }} inputMode="numeric" placeholder="0–180" value={s[x]} onChange={e => commit({ ...s, [x]: e.target.value.trim() })} />°</label>
        ))}
      </div>
      <Seg options={[{ v: FULL_ROM, l: 'Full passive range' }]} value={typeof v === 'string' ? v : null} na label="Passive range" onChange={x => set(k, x)} />
      {p && (
        <div className="sr-meter">
          {['er', 'abd', 'ir'].map(x => (
            <div key={x}>
              <div className="sr-row" style={{ justifyContent: 'space-between' }}><span>{x.toUpperCase()} {obj[x]}° of {ROM_NORM[x]}°</span><span className="muted">−{Math.round(p.loss[x] * 100)}%</span></div>
              <div className="bar"><i style={{ width: `${Math.round(p.loss[x] * 100)}%`, background: p.capsular ? 'var(--b5)' : 'var(--ink)' }} /></div>
            </div>
          ))}
          <div className={p.capsular ? '' : 'muted'}>{p.capsular ? 'Capsular pattern: every direction restricted, external rotation most.' : 'Not a capsular pattern.'}</div>
        </div>
      )}
    </>
  );
}

function GirthIn({ k }) {
  const { a, set } = useR();
  const v = a[k];
  const obj = v && typeof v === 'object' ? v : null;
  const [s, setS] = useState(() => ({ aff: obj ? String(obj.aff) : '', un: obj ? String(obj.un) : '' }));
  useEffect(() => {
    if (obj) setS(cur => (Number(cur.aff) === obj.aff && Number(cur.un) === obj.un ? cur : { aff: String(obj.aff), un: String(obj.un) }));
    else if (v === NA) setS({ aff: '', un: '' });
  }, [v, obj?.aff, obj?.un]); // eslint-disable-line react-hooks/exhaustive-deps
  const commit = next => {
    setS(next);
    const x = Number(next.aff), y = Number(next.un);
    if (next.aff !== '' && next.un !== '' && x > 0 && y > 0 && x < 100 && y < 100) set(k, { aff: x, un: y });
    else if (obj) set(k, '');
  };
  const d = obj ? girthDiff(obj) : null;
  return (
    <>
      <div className="sr-inrow">
        <label>Affected<input className="sr-in num" style={{ width: 80 }} inputMode="decimal" value={s.aff} onChange={e => commit({ ...s, aff: e.target.value.trim() })} />cm</label>
        <label>Unaffected<input className="sr-in num" style={{ width: 80 }} inputMode="decimal" value={s.un} onChange={e => commit({ ...s, un: e.target.value.trim() })} />cm</label>
      </div>
      <Seg options={[]} value={v === NA ? NA : null} na naLabel="Not measured" label="Limb girth" onChange={x => set(k, x)} />
      {d != null && <div className={d > 2 ? 'sr-err' : 'small muted'}>Difference {d} cm{d > 2 ? ': more than 2 cm' : ''}</div>}
    </>
  );
}

function FeverIn({ k }) {
  const { a, set } = useR();
  const v = a[k];
  const yn = typeof v === 'string' && v !== NA ? (v.startsWith('Yes') ? 'Yes' : v.startsWith('No') ? 'No' : v) : v;
  const temp = typeof v === 'string' ? (/Temp\s*([\d.]+)/.exec(v) || [])[1] || '' : '';
  const [t, setT] = useState(temp);
  useEffect(() => { if (Number(temp) !== Number(t)) setT(temp); }, [temp]); // eslint-disable-line react-hooks/exhaustive-deps
  const put = s => { setT(s); const n = Number(s); set(k, formatFever({ yn: 'Yes', temp: s && Number.isFinite(n) ? n : null })); };
  return (
    <>
      <Seg options={['Yes', 'No']} value={yn} na label="Fever" onChange={x => set(k, x === 'Yes' ? formatFever({ yn: 'Yes', temp: t ? Number(t) : null }) : x)} />
      {yn === 'Yes' && <div className="sr-inrow"><label>Temperature<input className="sr-in num" style={{ width: 80 }} inputMode="decimal" placeholder="38.5" value={t} onChange={e => put(e.target.value.trim())} /></label><span className="sr-unit">°C (optional)</span></div>}
    </>
  );
}

function ReflexIn({ k }) {
  const { a, set } = useR();
  const v = a[k];
  const obj = v && typeof v === 'object' ? v : {};
  const put = (side, x) => { const n = { biceps: obj.biceps || '', triceps: obj.triceps || '', [side]: x }; set(k, n.biceps || n.triceps ? n : ''); };
  return (
    <>
      <div className="sr-inrow">
        {['biceps', 'triceps'].map(side => (
          <label key={side}>{side[0].toUpperCase() + side.slice(1)}
            <select className="sr-in" style={{ width: 'auto' }} value={obj[side] || ''} onChange={e => put(side, e.target.value)}>
              <option value="">–</option>
              {REFLEX.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          </label>
        ))}
      </div>
      <Seg options={[]} value={v === NA ? NA : null} na naLabel="Not tested" label="Reflexes" onChange={x => set(k, x)} />
    </>
  );
}

// S12 "Post-Operative Week/Phase": weeks, plus the phase the cell carries ("Week 23.5 (Phase 4)").
function WeekIn({ q }) {
  const { a, set } = useR();
  const ph = `${q.key}::phase`;
  return (
    <>
      <NumIn def={q} value={a[q.key]} na naLabel={q.naLabel} label={q.label} onChange={x => set(q.key, x)} />
      {a[q.key] !== NA && <Seg options={q.phases} value={a[ph]} label="Rehabilitation phase" onChange={x => set(ph, x)} />}
      {num(a, q.key) != null && num(a, q.key) <= 52 && a[ph] && <div className="sr-colname">Excel cell: <b>Week {Number(a[q.key]).toFixed(1)} ({a[ph]})</b></div>}
    </>
  );
}

// S01 "ER:4/IR:4/Abd:4": three MRC grades, written once all three are given.
function Mmt3In({ q }) {
  const { a, set } = useR();
  const v = a[q.key];
  const empty = { er: '', ir: '', abd: '' };
  const [s, setS] = useState(() => parseMmt3(v) || empty);
  useEffect(() => { const p = parseMmt3(v); if (p) setS(p); else if (v === NA) setS(empty); }, [v]); // eslint-disable-line react-hooks/exhaustive-deps
  const put = (d, g) => {
    const n = { ...s, [d]: g };
    setS(n);
    if (['er', 'ir', 'abd'].every(x => n[x] !== '')) set(q.key, formatMmt3(n));
    else if (has(a, q.key)) set(q.key, '');
  };
  return (
    <>
      <div className="sr-inrow">
        {[['er', 'ER'], ['ir', 'IR'], ['abd', 'Abd']].map(([d, l]) => (
          <label key={d}>{l}
            <select className="sr-in" style={{ width: 'auto' }} value={String(s[d])} onChange={e => put(d, e.target.value === '' ? '' : Number(e.target.value))}>
              <option value="">–</option>
              {[5, 4, 3, 2, 1, 0].map(g => <option key={g} value={g}>{g}</option>)}
            </select>
          </label>
        ))}
      </div>
      <Seg options={[]} value={v === NA ? NA : null} na naLabel="Not tested" label={q.label} onChange={x => { setS(empty); set(q.key, x); }} />
      {parseMmt3(v) && <div className="sr-colname">Excel cell: <b>{v}</b></div>}
    </>
  );
}

// S01 "Tear: Partial-thickness; Goutallier: Grade 1": the tear and the Goutallier grade, written once both are given.
function MriIn({ q }) {
  const { a, set } = useR();
  const v = a[q.key];
  const [s, setS] = useState(() => parseMri(v) || { tear: '', grade: '' });
  useEffect(() => { const p = parseMri(v); if (p) setS(p); else if (v === NA) setS({ tear: '', grade: '' }); }, [v]);
  const put = n => {
    setS(n);
    if (n.tear && n.grade) set(q.key, mriCell(n.tear, n.grade));
    else if (has(a, q.key) && v !== NA) set(q.key, '');
  };
  return (
    <>
      <div className="sr-sub"><div className="q">Rotator cuff tear</div><Seg options={q.tears} value={s.tear} label="MRI tear" onChange={t => put({ ...s, tear: t })} /></div>
      <div className="sr-sub"><div className="q">Goutallier fatty infiltration</div><Seg options={q.grades} value={s.grade} label="Goutallier grade" onChange={g => put({ ...s, grade: g })} /></div>
      <Seg options={[]} value={v === NA ? NA : null} na naLabel={q.naLabel} label={q.label} onChange={x => { setS({ tear: '', grade: '' }); set(q.key, x); }} />
      {parseMri(v) && <div className="sr-colname">Excel cell: <b>{v}</b></div>}
    </>
  );
}

// S01 "12 mm", or the "not applicable" text when ultrasound shows no structural tear.
function UsIn({ q }) {
  const { a, set } = useR();
  const v = a[q.key];
  const [t, setT] = useState(() => (parseUsSize(v) != null ? String(parseUsSize(v)) : ''));
  useEffect(() => { const x = parseUsSize(v); if (x != null) setT(String(x)); else if (v === NA || v === q.noTear) setT(''); }, [v, q.noTear]);
  const err = t !== '' ? numError(q, t) : null;
  const put = x => {
    setT(x);
    if (x !== '' && !numError(q, x)) set(q.key, `${Number(x)} mm`);
    else if (parseUsSize(v) != null) set(q.key, '');
  };
  return (
    <>
      <div className="sr-inrow">
        <input className={cls('sr-in num', err && 'err')} inputMode="decimal" aria-label={`${q.label}, mm`} aria-invalid={!!err} placeholder={`${q.min}–${q.max}`} value={t} onChange={e => put(e.target.value.trim())} />
        <span className="sr-unit">mm</span>
      </div>
      <Seg options={[{ v: q.noTear, l: 'No tear on ultrasound' }]} value={v === q.noTear || v === NA ? v : null} na naLabel={q.naLabel} label={q.label} onChange={x => { setT(''); set(q.key, x); }} />
      {err && <div className="sr-err">{err}</div>}
    </>
  );
}

function DerivedFrom() {
  const { a, go } = useR();
  const s = surgeryOf(a);
  const text = !s.known ? 'Not answered yet in History.'
    : s.unknown ? 'History: previous surgery not assessed.'
      : !s.any ? 'History: no previous shoulder surgery.'
        : !s.proc ? 'History: surgery recorded, procedure not picked yet.'
          : `History: ${s.proc.l || s.proc.v}${s.thisSide ? '' : ' (other shoulder)'}${s.index === 'Yes' ? ', the reason for this visit' : s.index === 'No' ? ', not the reason for this visit' : ''}.`;
  return <div className="sr-derived"><span>{text}</span><button type="button" className="sr-btn" onClick={() => go(1)}>Edit in History</button></div>;
}

function QControl({ q }) {
  const { a, set, setMany } = useR();
  const v = a[q.key];
  const naOk = !(q.options || []).some(o => ['Not Performed', 'Not Yet Performed'].includes(optV(o)));
  switch (q.kind) {
    case 'seg': {
      const desc = `${q.key}::desc`;
      return (
        <>
          <Seg options={q.options} value={typeof v === 'string' ? v : null} label={q.label} na={naOk} naLabel={q.naLabel} onChange={x => (q.describe && x !== 'Present' ? setMany({ [q.key]: x, [desc]: '' }) : set(q.key, x))} />
          {q.describe && v === 'Present' && (
            <input className="sr-in" placeholder="Describe (optional): written as “Present - …”" aria-label={`${q.label}: description`} value={a[desc] || ''} onChange={e => set(desc, e.target.value)} />
          )}
        </>
      );
    }
    case 'int': case 'dec': return <NumIn def={q} value={v} na naLabel={q.naLabel} label={q.label} onChange={x => set(q.key, x)} />;
    case 'week': return <WeekIn q={q} />;
    case 'fever': return <FeverIn k={q.key} />;
    case 'girth': return <GirthIn k={q.key} />;
    case 'reflex': return <ReflexIn k={q.key} />;
    case 'rom3': return <Rom3In k={q.key} />;
    case 'mmt3': return <Mmt3In q={q} />;
    case 'mri': return <MriIn q={q} />;
    case 'usSize': return <UsIn q={q} />;
    case 'derivedFrom': return <DerivedFrom />;
    default: return null;
  }
}

// One wrapper-specific question (red flags and branch walk).
function Question({ k }) {
  const { a, assumed, tip } = useR();
  const q = QUESTIONS[k];
  if (!q || (q.when && !q.when(a))) return null;
  const err = q.kind === 'int' || q.kind === 'dec' || q.kind === 'week' ? numError(q, a[k]) : null;
  const isAssumed = assumed.has(k);
  return (
    <div className={cls('sr-field', has(a, k) && !err && 'done', isAssumed && 'assumed', err && 'bad')}>
      <div className="sr-fhead">
        <div className="t">
          <div className="sr-flabel">{q.label}</div>
          {q.ask && q.ask !== q.label && <div className="sr-ask">{q.ask}</div>}
        </div>
        {isAssumed && <span className="sr-tag" title="This case's own workbook has no such column, so it got the normal answer">assumed</span>}
        <button type="button" className="sr-info" aria-label={`About ${q.label}`} {...tip.on(() => questionCard(q))}>i</button>
      </div>
      <QControl q={q} />
      <div className="sr-colname">
        {q.ui ? <>Not an Excel column{q.col ? <> · writes <b>{q.col}</b></> : null}</> : q.cols.map(([w, c], i) => <span key={w}>{i > 0 && ' + '}<b>{w}</b> · {c}</span>)}
      </div>
      {q.help && <div className="sr-hint">{q.help}</div>}
      {err && <div className="sr-err">{err}</div>}
    </div>
  );
}

// One shared intake column (Patient and History stops).
function SharedControl({ def }) {
  const { a, set } = useR();
  const k = def.key, v = a[k], label = def.label || k;
  switch (def.kind) {
    case 'seg':
      return (
        <>
          <Seg options={def.options} value={v} label={label} na onChange={x => set(k, x)} />
          {def.specify && v === def.specify && <input className="sr-in" placeholder="Specify…" value={a[`${k}::spec`] || ''} onChange={e => set(`${k}::spec`, e.target.value)} />}
        </>
      );
    case 'yn': return <Seg options={['Yes', 'No']} value={v} label={label} na onChange={x => set(k, x)} />;
    case 'int': case 'dec': return <NumIn def={def} value={v} label={label} na onChange={x => set(k, x)} />;
    case 'text': return <TextIn value={v} label={label} placeholder={def.placeholder} suggestions={def.suggestions} onChange={x => set(k, x)} />;
    case 'multi': return <Multi def={def} value={v} spec={a[`${k}::spec`]} onChange={x => set(k, x)} onSpec={x => set(`${k}::spec`, x)} />;
    case 'derived': {
      const d = derivedDominant(a);
      if (d.editable) return <Seg options={['Yes', 'No']} value={a[k]} label={label} onChange={x => set(k, x)} />;
      return <div className="sr-derived">{d.value ? <><span className="sr-chip doc">{d.value}</span><span className="muted">derived from Laterality and Dominant arm</span></> : <span className="muted">Set Laterality (Patient stop) and Dominant arm first.</span>}</div>;
    }
    case 'surgery': return <SurgeryIn />;
    default: return null;
  }
}

function SharedField({ def }) {
  const { a, assumed, tip } = useR();
  const k = def.key, label = def.label || k;
  const err = def.kind === 'int' || def.kind === 'dec' ? numError(def, a[k]) : null;
  const done = def.kind === 'derived' ? !!derivedDominant(a).value : has(a, k);
  return (
    <div className={cls('sr-field', done && !err && 'done', assumed.has(k) && 'assumed', err && 'bad', def.kind === 'surgery' && 'wide')}>
      <div className="sr-fhead">
        <div className="t">
          <div className="sr-flabel">{label}</div>
          {label !== k && <div className="sr-colname">{k}</div>}
        </div>
        {(READERS[k] || []).length > 0 && <span className="sr-tag reads" title={`Routing reads it: ${READERS[k].map(ruleName).join('; ')}`}>routing</span>}
        <button type="button" className="sr-info" aria-label={`About ${label}`} {...tip.on(() => sharedCard(def))}>i</button>
      </div>
      <SharedControl def={def} />
      {def.help && <div className="sr-hint">{def.help}</div>}
      {err && <div className="sr-err">{err}</div>}
    </div>
  );
}

function WrapperChip({ w }) {
  const { tip } = useR();
  const br = BRANCH_OF[w]?.[0];
  return (
    <button type="button" className="sr-chip" style={{ whiteSpace: 'normal', textAlign: 'left' }} {...tip.on(() => wrapperCard(w), { color: br ? bc(br) : undefined })}>
      <span className="sw" style={{ background: br ? bc(br) : 'var(--ink)' }} />{w} {WRAPPERS[w].name}
    </button>
  );
}

function StateBadge({ state, urgent }) {
  const map = { fires: [urgent ? 'refer' : 'stop', 'Fires'], clear: ['ok', 'Clear'], open: ['idle', 'Open'], na: ['idle', 'N/A'], unreached: ['idle', 'Not reached'] };
  const [c, t] = map[state] || ['idle', state];
  return <span className={cls('sr-stamp sm', c)}>{t}</span>;
}

// ---------- page furniture ----------
function StopHead({ i, purpose }) {
  const s = STOPS[i], L = LINES[s.line];
  return (
    <div className="sr-svhead">
      <Shape kind={s.shape} size={64} stroke={lc(s)} sw={6} />
      <div>
        <div className="sr-eyebrow" style={{ color: lc(s) }}>Stop {i + 1} of {STOPS.length} · {L.name}</div>
        <h1 id={`sr-title-${s.id}`}>{s.name}</h1>
        <p>{purpose}</p>
      </div>
    </div>
  );
}
const Facts = ({ items }) => (
  <div className="sr-why">{items.map(([n, l]) => <div className="sr-fact" key={l}><div className="n">{n}</div><div className="l">{l}</div></div>)}</div>
);
const Legend = () => (
  <div className="sr-legend">
    <span><span className="sr-tag reads" style={{ marginRight: 6 }}>routing</span>a routing rule reads it</span>
    <span><i style={{ width: 22, height: 12, borderRadius: 4, border: '2px dashed var(--muted)' }} />assumed normal (dataset case loaded)</span>
    <span><span className="sr-info" style={{ display: 'inline-grid', width: 20, height: 20, fontSize: 11, marginRight: 6 }}>i</span>what the Excel files say about the field</span>
  </div>
);

function Strip({ cur, seen, onGo, ev, route }) {
  const pathRef = useRef(null), trainRef = useRef(null), lens = useRef([]), last = useRef(cur);
  const gap = 112, pad = 40, W = pad * 2 + (STOPS.length - 1) * gap, H = 66;
  const lineIdx = [...new Set(STOPS.map(s => s.line))];
  const xs = STOPS.map((_, i) => pad + i * gap), ys = STOPS.map(s => (lineIdx.indexOf(s.line) % 2 ? 32 : 16));
  const segs = STOPS.slice(1).map((s, i) => metroPath(xs[i], ys[i], xs[i + 1], ys[i + 1], 0.5));
  const full = `M${xs[0]},${ys[0]} ${segs.map(d => d.replace(/^M[^ ]+ /, '')).join(' ')}`;
  const place = len => {
    const p = pathRef.current;
    if (!p?.getTotalLength) return;
    const L = p.getTotalLength(), q1 = p.getPointAtLength(len), q2 = p.getPointAtLength(Math.min(len + 1, L));
    const ang = (Math.atan2(q2.y - q1.y, q2.x - q1.x) * 180) / Math.PI;
    trainRef.current?.setAttribute('transform', `translate(${q1.x},${q1.y - 11}) rotate(${ang})`);
  };
  useLayoutEffect(() => {
    const p = pathRef.current;
    if (!p?.getTotalLength) return;
    const L = p.getTotalLength();
    lens.current = xs.map(x => { let lo = 0, hi = L; for (let n = 0; n < 30; n++) { const m = (lo + hi) / 2; if (p.getPointAtLength(m).x < x) lo = m; else hi = m; } return (lo + hi) / 2; });
    place(lens.current[cur] || 0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const from = lens.current[last.current] || 0, to = lens.current[cur] || 0;
    last.current = cur;
    if (reduced() || from === to) { place(to); return undefined; }
    const t0 = performance.now(), dur = Math.min(1100, 380 + Math.abs(to - from) * 1.4);
    let raf;
    const step = t => { const k = Math.min(1, (t - t0) / dur); const e = k < 0.5 ? 2 * k * k : 1 - (-2 * k + 2) ** 2 / 2; place(from + (to - from) * e); if (k < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [cur]); // eslint-disable-line react-hooks/exhaustive-deps
  const status = id => (id === 'flags' ? (ev.halt ? 'var(--stop)' : ev.openFlags.length ? null : 'var(--ok)')
    : id === 'walk' && route.branch ? bc(route.branch)
      : id === 'nodes' && route.nodes.wrapper ? 'var(--ok)'
        : id === 'result' && route.nodes.wrapper ? bc(route.branch) : null);
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Route map: stop ${cur + 1} of ${STOPS.length}`}>
      {segs.map((d, i) => <path key={d} d={d} fill="none" stroke={lc(STOPS[i + 1])} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" />)}
      <path ref={pathRef} d={full} fill="none" stroke="none" />
      {STOPS.map((s, i) => {
        const on = i === cur, st = status(s.id);
        return (
          <g key={s.id} className="sr-node" transform={`translate(${xs[i]},${ys[i]})`} tabIndex={0} role="button" aria-label={`Stop ${i + 1}: ${s.name}`} aria-current={on ? 'step' : undefined}
            onClick={() => onGo(i)} onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onGo(i); } }}>
            <circle r={16} fill="transparent" />
            <ShapeEl kind={s.shape} r={7.5} fill={on ? 'var(--ink)' : seen[s.id] ? lc(s) : 'var(--station)'} stroke="var(--ink)" strokeWidth={2.6} strokeLinejoin="round" transform={on ? 'scale(1.35)' : undefined} />
            {st && <circle cx={10} cy={-9} r={4.5} fill={st} stroke="var(--paper)" strokeWidth={1.5} />}
            <text y={H - 5 - ys[i]} textAnchor="middle">{s.name}</text>
          </g>
        );
      })}
      <g ref={trainRef} style={{ pointerEvents: 'none' }}>
        <rect x={-11} y={-6} width={22} height={12} rx={3.5} fill="var(--ink)" />
        <rect x={4} y={-3.5} width={4} height={7} rx={1.2} fill="var(--paper)" />
      </g>
    </svg>
  );
}

function Clock({ cur }) {
  const f = (cur + 1) / STOPS.length, ang = f * 2 * Math.PI - Math.PI / 2;
  const d = f >= 1 ? 'M20,6 A14,14 0 1 1 19.99,6 Z' : `M20,20 L20,6 A14,14 0 ${f > 0.5 ? 1 : 0} 1 ${(20 + 14 * Math.cos(ang)).toFixed(2)},${(20 + 14 * Math.sin(ang)).toFixed(2)} Z`;
  return (
    <>
      <div><div>Stop</div><div className="num">{String(cur + 1).padStart(2, '0')}/{String(STOPS.length).padStart(2, '0')}</div></div>
      <svg width="40" height="40" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="16" fill="var(--station)" stroke="var(--ink)" strokeWidth="2.5" /><path d={d} fill="var(--ink)" /></svg>
    </>
  );
}

// ---------- stop 1: patient ----------
function SamplePanel() {
  const { loaded, loadSample, newPatient, assumed } = useR();
  const [pick, setPick] = useState(loaded ? String(loaded.idx) : '');
  const groups = useMemo(() => { const g = {}; SAMPLES.forEach((s, i) => (g[s.wrapper] ||= []).push(i)); return g; }, []);
  return (
    <div className="sr-panel sr-col">
      <div className="sr-row" style={{ justifyContent: 'space-between' }}>
        <h3>Try a Golden Dataset case</h3>
        <button type="button" className="sr-btn" onClick={newPatient}>Start a new patient</button>
      </div>
      <p className="small muted">
        Load one of {SAMPLES.length} simulated test cases from the Golden Datasets, one per condition (not real patients). A row only
        has its own workbook's columns, so every other routing question gets its normal answer and is drawn dashed.
      </p>
      <div className="sr-inrow" style={{ flexWrap: 'nowrap' }}>
        <select className="sr-in" aria-label="Real case to load" value={pick} onChange={e => setPick(e.target.value)}>
          <option value="">Choose a case…</option>
          {Object.entries(groups).map(([w, idxs]) => (
            <optgroup key={w} label={`${w} · ${WRAPPERS[w].name}`}>
              {idxs.map(i => <option key={i} value={i}>{SAMPLES[i].Diagnosis} · {SAMPLES[i]['Case ID']}</option>)}
            </optgroup>
          ))}
        </select>
        <button type="button" className="sr-bigbtn" style={{ padding: '9px 18px' }} disabled={pick === ''} onClick={() => loadSample(Number(pick))}>Load</button>
      </div>
      {loaded && (
        <div className="sr-loaded small">
          <Shape kind="square" size={22} stroke={bc(BRANCH_OF[loaded.wrapper][0])} sw={3} />
          <div>Example loaded: simulated case <b>{loaded.caseId}</b> from <b>{loaded.wrapper}</b> {WRAPPERS[loaded.wrapper].name}, {loaded.diagnosis} ({loaded.phase}). {assumed.size} routing answers are assumed normal (dashed).</div>
        </div>
      )}
    </div>
  );
}

function PatientStop() {
  const { a } = useR();
  const answered = CORE_FIELDS.filter(f => has(a, f.key)).length;
  return (
    <>
      <StopHead i={0} purpose="The core block (columns A–M) that every wrapper records first. It is asked before anyone knows the condition group, so these are the only answers every branch can read." />
      <Facts items={[
        [CORE_FIELDS.length, 'core columns, the same header in all 18 workbooks'],
        [fmt(BUILT.rows), 'case rows across the 18 Golden Datasets'],
        [CORE_FIELDS.filter(f => f.reads).length, 'read by the routing rules'],
        [`${answered}/${CORE_FIELDS.length}`, 'answered for this patient'],
      ]} />
      <SamplePanel />
      <Legend />
      <div className="sr-fields">{CORE_FIELDS.map(f => <SharedField key={f.key} def={f} />)}</div>
    </>
  );
}

// ---------- stop 2: history ----------
function HistoryStop() {
  const { a } = useR();
  const answered = HISTORY_FIELDS.filter(f => (f.kind === 'derived' ? !!derivedDominant(a).value : has(a, f.key))).length;
  return (
    <>
      <StopHead i={1} purpose="The shared history block, the same 11 columns in all 18 workbooks. Previous surgery is asked in parts, because three decision points read it." />
      <Facts items={[
        [HISTORY_FIELDS.length, 'shared history columns (added on the 29 Sep 2026 completeness review)'],
        [`${INDEX_WRAPPERS.length} of 18`, `workbooks record a surgery as "index procedure for this record" (${INDEX_WRAPPERS.join(', ')}, every row)`],
        [HISTORY_FIELDS.filter(f => f.reads).length, 'read by the routing rules'],
        [`${answered}/${HISTORY_FIELDS.length}`, 'answered for this patient'],
      ]} />
      <Legend />
      <div className="sr-fields">{HISTORY_FIELDS.map(f => <SharedField key={f.key} def={f} />)}</div>
    </>
  );
}

// ---------- stop 3: red flags ----------
function FlagCard({ r }) {
  const { a, fillKeys, go } = useR();
  const f = r.flag, doc = RED_FLAGS_DOC[f.id];
  const col = f.emergency ? 'var(--stop)' : 'var(--refer)';
  const visible = f.questions.filter(k => QUESTIONS[k] && (!QUESTIONS[k].when || QUESTIONS[k].when(a)));
  return (
    <div className={cls('sr-flag', r.state, !f.emergency && 'urgent')}>
      <div className="sr-flaghead">
        <Shape kind={f.emergency ? 'cross' : 'triangle'} size={30} stroke={col} fill={r.state === 'fires' ? col : 'var(--station)'} sw={3} />
        <div><span className="id">{f.id}</span><b>{doc.desc}</b></div>
        <StateBadge state={r.state} urgent={!f.emergency} />
      </div>
      <div className="sr-chips">
        <span className={cls('sr-chip', f.emergency ? 'stop' : 'refer')}>{doc.urgency}</span>
        {f.wrappers.map(w => <WrapperChip key={w} w={w} />)}
        <span className={cls('sr-chip', f.draft ? 'draft' : 'doc')}>{f.draft ? 'Draft trigger' : 'Trigger written in the docs'}</span>
      </div>
      <div className="sr-trigger">{f.trigger}</div>
      {(RED_FLAG_FIELD_NOTES[f.id] || []).map(n => <div key={n.wrapper} className="sr-trigger">{n.wrapper} document: “{n.text}”</div>)}
      {r.state === 'na' ? <div className="sr-note"><span>{r.note}</span></div>
        : r.note ? <div className="sr-note"><span>{r.note} <button type="button" className="sr-btn" onClick={() => go(f.id === 'SH-RF-09' ? 0 : 1)}>Go there</button></span></div>
          : <div className="sr-qs">{visible.map(k => <Question key={k} k={k} />)}</div>}
      <div className="sr-flagfoot">
        <div className="small">
          {r.state === 'fires' ? r.signals.join('; ')
            : r.state === 'clear' ? (r.assumed?.length ? `Clear, assuming ${r.assumed.join('; ')}` : 'Clear: no sign.')
              : r.state === 'open' && !r.note ? `${(r.missing || []).length} to answer` : ''}
        </div>
        {r.state !== 'na' && !r.note && <button type="button" className="sr-btn" onClick={() => fillKeys(f.questions)}>No signs</button>}
      </div>
    </div>
  );
}

function FlagsStop() {
  const { ev, go } = useR();
  const applicable = ev.flags.filter(f => f.state !== 'na');
  const done = applicable.filter(f => f.state !== 'open').length;
  const emergency = FLAGS.filter(f => f.emergency).length;
  const h = ev.halt, open = ev.openFlags.length;
  const hb = h ? SCREEN[FLAG_BRANCH[h.id]] : null;
  return (
    <>
      <StopHead i={2} purpose="Screened before any branching (Workflow Guide, Step 1). If a flag fires, the case is halted for urgent referral and goes straight to that flag's wrapper." />
      <Facts items={[
        [FLAGS.length, 'red flags, rebuilt from section 10 of the 18 wrapper documents'],
        [emergency, 'emergency: same-day referral'],
        [FLAGS.length - emergency, 'urgent'],
        [`${done}/${applicable.length}`, 'screened for this patient'],
      ]} />
      <div className="sr-two">
        <div className="sr-col sr-sticky">
          <div className="sr-panel sr-col">
            <div className="sr-row">{h ? <span className="sr-stamp stop">Halt</span> : open ? <span className="sr-stamp idle">{open} to screen</span> : <span className="sr-stamp ok">Clear</span>}</div>
            <div className="sr-say" style={{ borderColor: h ? 'var(--stop)' : open ? 'var(--muted)' : 'var(--ok)' }}>
              {h ? `${h.id}: ${RED_FLAGS_DOC[h.id].desc}. ${RED_FLAGS_DOC[h.id].urgency}. No rehabilitation plan: the case goes straight to ${h.flag.wrappers.join(' / ')} (branch ${hb.n}, ${hb.name}).`
                : open ? `Screen every flag before branching: answer its questions, or press "No signs" when there are none. ${open} still open.`
                  : 'No red flag fired. The case can be routed to a branch.'}
            </div>
            {ev.fired.length > 1 && <div className="small">{ev.fired.length} flags fired. Emergencies outrank urgent flags, so {h.id} decides the route. All of them are written into Red Flags / Precautions.</div>}
            {h ? <button type="button" className="sr-bigbtn" onClick={() => go(4)}>See the routed branch →</button>
              : !open ? <button type="button" className="sr-bigbtn" onClick={() => go(3)}>Walk the branches →</button> : null}
          </div>
          <div className="sr-panel small sr-col">
            <b style={{ fontWeight: 500 }}>Where these come from</b>
            <span>The ID, description, urgency and wrapper of each flag come from section 10 of the wrapper documents. The full rule set should live in Shoulder_CDSS_Wrapper_Routing_Map.xlsx, which was never provided.</span>
            <span>Only SH-RF-01's trigger is written down (in S07's document). The other eight triggers are drafts built from each wrapper's own columns and need clinical sign-off.</span>
            <span>A fired flag writes its dataset wording into Red Flags / Precautions.</span>
          </div>
        </div>
        <div className="sr-flags">{ev.flags.map(r => <FlagCard key={r.id} r={r} />)}</div>
      </div>
    </>
  );
}

// ---------- stop 4: branch walk ----------
const WALK_COLS = (() => {
  const c = new Set(), w = new Set();
  for (const s of SCREENS) for (const k of s.questions) { const q = QUESTIONS[k]; if (!q || q.ui || q.kind === 'derivedFrom') continue; for (const [ww, cc] of q.cols) { c.add(`${ww}|${cc}`); w.add(ww); } }
  return { n: c.size, w: w.size };
})();

function WalkLine({ view, onPick }) {
  const { ev, tip } = useR();
  const gap = 54, top = 24, x = 30, W = 320, H = top * 2 + gap * (SCREENS.length - 1);
  const ys = SCREENS.map((_, i) => top + i * gap);
  const stopAt = ev.halt ? SCREENS.findIndex(s => s.id === ev.branch) : Math.max(0, ev.walk.findIndex(w => w.state === 'open' || w.state === 'fires'));
  return (
    <div className="sr-panel sr-line">
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label="The eleven decision points">
        <path d={`M${x},${ys[0]} V${ys[ys.length - 1]}`} stroke="var(--hair)" strokeWidth={8} strokeLinecap="round" fill="none" />
        {!ev.halt && stopAt > 0 && <path d={`M${x},${ys[0]} V${ys[stopAt]}`} stroke="var(--yellow)" strokeWidth={8} strokeLinecap="round" fill="none" />}
        {SCREENS.map((s, i) => {
          const state = ev.halt ? (s.id === ev.branch ? 'fires' : 'unreached') : ev.walk[i].state;
          const fill = state === 'fires' ? bc(s.id) : 'var(--station)';
          const stroke = state === 'fires' ? bc(s.id) : state === 'clear' ? 'var(--ok)' : state === 'open' ? 'var(--ink)' : 'var(--hair)';
          const viewing = view === s.id;
          return (
            <g key={s.id} className={cls('sr-st', state, viewing && 'viewing')} transform={`translate(${x},${ys[i]})`} tabIndex={0} role="button" aria-pressed={viewing}
              aria-label={`Decision point ${s.n}: ${s.name}, ${state}`} onClick={() => onPick(s.id)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(s.id); } }} {...tip.hover(() => screenCard(s), { color: bc(s.id) })}>
              <rect x={-x} y={-gap / 2} width={W} height={gap} fill={viewing ? 'var(--grid)' : 'transparent'} rx={12} />
              {state === 'open' && <circle className="sr-ring" r={12} />}
              <ShapeEl kind={s.shape} r={9} fill={fill} stroke={stroke} strokeWidth={3} strokeLinejoin="round" transform={viewing ? 'scale(1.25)' : undefined} />
              {state === 'clear' && <path d="M-4,0.5 L-1,3.5 L4.5,-3" stroke="var(--ok)" strokeWidth={2.4} fill="none" strokeLinecap="round" strokeLinejoin="round" />}
              <text className="lab" x={24} y={-1} style={state === 'fires' ? { fill: bc(s.id), fontWeight: 600 } : undefined}>{s.n}. {s.name}</text>
              <text className="sub" x={24} y={15}>{s.wrappers.join(' · ')}{state === 'fires' ? '  → the branch' : ''}</text>
            </g>
          );
        })}
        <g className="sr-train" style={{ transform: `translate(${x - 21}px, ${ys[Math.max(0, stopAt)]}px)`, pointerEvents: 'none' }}>
          <rect x={-6} y={-11} width={12} height={22} rx={4} fill="var(--ink)" />
          <rect x={-3.5} y={-7} width={7} height={5} rx={1.4} fill="var(--paper)" />
        </g>
      </svg>
    </div>
  );
}

function ScreenPanel({ s, r }) {
  const { a, ev, fillKeys, setWalkView, go } = useR();
  const visible = s.questions.filter(k => QUESTIONS[k] && (!QUESTIONS[k].when || QUESTIONS[k].when(a)));
  const fillable = visible.filter(k => QUESTIONS[k].kind !== 'derivedFrom');
  const nerves = visible.filter(k => QUESTIONS[k].group === 'nerves');
  const rest = visible.filter(k => QUESTIONS[k].group !== 'nerves');
  const state = r?.state || 'unreached';
  const next = ev.current || ev.suggested;
  const nextS = next && next !== s.id ? SCREEN[next] : null;
  return (
    <div className="sr-panel sr-screen">
      <div className="top">
        <div style={{ minWidth: 0 }}>
          <div className="sr-eyebrow" style={{ color: bc(s.id) }}>Decision point {s.n} of {SCREENS.length} · “{s.doc}”</div>
          <h2>{s.name}</h2>
          <p className="muted" style={{ marginTop: 6 }}>{s.ask}</p>
        </div>
        {state === 'fires' ? <span className="sr-stamp" style={{ color: bc(s.id) }}>Branch {s.n}</span> : <StateBadge state={state} />}
      </div>
      <div className="sr-chips">
        {s.wrappers.map(w => <WrapperChip key={w} w={w} />)}
        {s.halt && <span className="sr-chip stop">Halt group</span>}
        {s.draft && <span className="sr-chip draft">Draft rule</span>}
      </div>
      {state === 'fires' && <div className="sr-list">{(r.signals || []).map(x => <div key={x} className="sr-good"><span>{x}</span></div>)}</div>}
      {r?.note && <div className="sr-note"><span>{r.note}</span></div>}
      {state === 'clear' && r.assumed?.length > 0 && <div className="sr-note"><span>Passed on an assumption: {r.assumed.join('; ')}</span></div>}
      {state === 'open' && r.missing?.length > 0 && <div className="small muted">Waiting for: {r.missing.map(labelOf).join(', ')}</div>}
      {rest.length > 0 && <div className="sr-qgrid">{rest.map(k => <Question key={k} k={k} />)}</div>}
      {nerves.length > 0 && (
        <div className="sr-col">
          <div className="sr-row" style={{ justifyContent: 'space-between' }}><h3>Named-nerve strength (S16, MRC 0–5)</h3><button type="button" className="sr-btn" onClick={() => fillKeys(nerves)}>All 5/5</button></div>
          <div className="sr-nervegrid">{nerves.map(k => <Question key={k} k={k} />)}</div>
        </div>
      )}
      {s.id === 'B11' && <div className="small">S18 holds rare and diagnostically uncertain conditions. Inside it, Symptom Pattern and the Referred Pain Screen (cervical, cardiac, diaphragmatic) are asked next.</div>}
      <div className="sr-row">
        {fillable.length > 0 && <button type="button" className="sr-btn" onClick={() => fillKeys(fillable)}>All normal</button>}
        {state === 'clear' && nextS && <button type="button" className="sr-bigbtn" onClick={() => setWalkView(next)}>Next: {nextS.n}. {nextS.name} →</button>}
        {state === 'fires' && !ev.halt && <button type="button" className="sr-bigbtn" onClick={() => go(4)}>See branch {s.n} →</button>}
        {state === 'unreached' && <span className="small muted">Not reached: an earlier decision point is still open or has already matched. Its questions are shown so you can see what it will ask.</span>}
      </div>
    </div>
  );
}

function WalkStop() {
  const { ev, walkView, setWalkView, go } = useR();
  const view = walkView || ev.current || ev.suggested || 'B1';
  const decided = ev.walk.filter(w => w.state === 'fires' || w.state === 'clear').length;
  return (
    <>
      <StopHead i={3} purpose="The eleven decision points, in the order the Workflow Guide gives. The first one that matches is the branch. Answers from earlier stops carry over, so some points decide themselves." />
      <Facts items={[
        [SCREENS.length, 'decision points, in the Workflow Guide order'],
        ['1st', 'match wins: later points are not read'],
        [WALK_COLS.n, `Excel columns asked here, from ${WALK_COLS.w} workbooks`],
        [`${decided}/${SCREENS.length}`, 'decided for this patient'],
      ]} />
      {ev.halt && (
        <div className="sr-banner">
          <span className="sr-stamp sm stop">Halt</span>
          <span style={{ flex: 1 }}>Red flag <b>{ev.halt.id}</b> fired, so the walk is not used: the case goes to branch {SCREEN[ev.branch].n}, {SCREEN[ev.branch].name}. The walk below is shown for information only.</span>
          <button type="button" className="sr-btn" onClick={() => go(4)}>See the branch</button>
        </div>
      )}
      {!ev.halt && ev.openFlags.length > 0 && (
        <div className="sr-banner warn">
          <span className="sr-stamp sm refer">Wait</span>
          <span style={{ flex: 1 }}>{ev.openFlags.length} red flag{ev.openFlags.length > 1 ? 's are' : ' is'} not screened yet. The guide screens red flags before any branching.</span>
          <button type="button" className="sr-btn" onClick={() => go(2)}>Finish the red flags</button>
        </div>
      )}
      <div className="sr-walk">
        <WalkLine view={view} onPick={setWalkView} />
        <ScreenPanel key={view} s={SCREEN[view]} r={ev.walk.find(w => w.id === view)} />
      </div>
    </>
  );
}

// ---------- the branch board (stop 5) ----------
function BranchBoard({ final, suggested }) {
  const { tip } = useR();
  const W = 860, rowH = 31, top = 18, H = top * 2 + rowH * (SCREENS.length - 1), hx = 60, hy = H / 2, x2 = 350;
  const chosenRef = useRef(null), firstDraw = useRef(true);
  // Draw the chosen line in only when the choice changes; on arrival the board is shown complete.
  useEffect(() => {
    const p = chosenRef.current;
    if (firstDraw.current) { firstDraw.current = false; return; }
    if (!p || reduced()) return;
    try {
      const L = p.getTotalLength();
      p.style.transition = 'none'; p.style.strokeDasharray = `${L}`; p.style.strokeDashoffset = `${L}`;
      p.getBoundingClientRect();
      p.style.transition = 'stroke-dashoffset .8s cubic-bezier(.4,0,.2,1)'; p.style.strokeDashoffset = '0';
    } catch { /* not measurable */ }
  }, [final]);
  const fi = SCREENS.findIndex(s => s.id === final);
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Branch board: branch ${SCREEN[final].n}, ${SCREEN[final].name}`}>
      {SCREENS.map((s, k) => {
        const y = top + k * rowH, on = s.id === final, sug = s.id === suggested && !on;
        return (
          <g key={s.id} {...tip.hover(() => screenCard(s), { color: bc(s.id) })}>
            <path ref={on ? chosenRef : undefined} d={metroPath(hx + 24, hy, x2, y, 0.22)} fill="none" stroke={bc(s.id)} strokeWidth={on ? 10 : 5} strokeLinecap="round" strokeLinejoin="round" opacity={on ? 1 : sug ? 0.7 : 0.2} strokeDasharray={sug ? '1 10' : undefined} />
            <circle cx={x2} cy={y} r={on ? 11 : 8} fill={on ? 'var(--ink)' : 'var(--station)'} stroke="var(--ink)" strokeWidth={3} opacity={on || sug ? 1 : 0.45} />
            <text className="lab" x={x2 + 22} y={y + 5} opacity={on || sug ? 1 : 0.5} style={on ? { fontWeight: 600 } : undefined}>B{s.n} · {s.name}</text>
            <text className="sub" x={W - 6} y={y + 5} textAnchor="end" opacity={on || sug ? 1 : 0.5}>{s.wrappers.join(' ')}{sug ? ' · engine' : ''}</text>
          </g>
        );
      })}
      <circle cx={hx} cy={hy} r={24} fill="var(--station)" stroke="var(--ink)" strokeWidth={5} />
      <text className="lab" x={hx} y={hy + 5} textAnchor="middle" style={{ fontWeight: 600 }}>Start</text>
      <g transform={`translate(${x2 - 32},${top + fi * rowH - 17})`} style={{ pointerEvents: 'none' }}>
        <rect x={-14} y={-8} width={28} height={16} rx={4.5} fill="var(--ink)" />
        <rect x={5} y={-4.5} width={5} height={9} rx={1.5} fill="var(--paper)" />
      </g>
    </svg>
  );
}

function Candidate({ w, hints, branchId, carried }) {
  const { tip } = useR();
  const W = WRAPPERS[w];
  return (
    <div className={cls('sr-cand', hints.length > 0 && 'lead')}>
      <div className="sr-row" style={{ justifyContent: 'space-between' }}>
        <span className="w" style={{ color: bc(branchId) }}>{w}</span>
        {hints.length > 0 && <span className="sr-chip doc">Findings point here</span>}
      </div>
      <b>{W.name}</b>
      {hints.map(h => <div key={h.why} className="small">{h.why}</div>)}
      {w === 'S10' && branchId === 'B10' && <div className="small muted">Here only for its non-fracture conditions (snapping scapula, scapulothoracic bursitis).</div>}
      <ul>{W.conditions.map(c => <li key={c.name}>{c.name}</li>)}</ul>
      <div className="small muted">Next inside {w}: {W.specificFields.length} group fields{carried ? `, ${carried} already answered here` : ''}. Grading field: {W.grading.field}.</div>
      <div><button type="button" className="sr-btn" {...tip.on(() => wrapperCard(w), { color: bc(branchId) })}>Details</button></div>
    </div>
  );
}

// The engine's answer at a node, in words.
const engineSays = auto => (auto.option ? `${auto.option.l}${auto.signals?.length ? `: ${auto.signals.join('; ')}` : ''}` : auto.note || (auto.missing?.length ? `waiting for ${auto.missing.map(labelOf).join(', ')}` : 'no answer yet'));
const whereTo = o => (o.exit ? 'S18' : o.to ? `${o.to} ${WRAPPERS[o.to].name}` : `node ${o.next}`);

// The nodes of one branch as a line: the path taken so far is drawn in the branch colour, the node waiting for an
// answer pulses, and nodes off the path are faded.
function NodeLine({ branch, nw, view, onPick }) {
  const { tip } = useR();
  const nodes = NODES.filter(n => n.branch === branch);
  const step = Object.fromEntries(nw.steps.map(s => [s.id, s]));
  const gap = 58, top = 24, x = 30, W = 320, H = top * 2 + gap * nodes.length;
  const ys = nodes.map((_, i) => top + i * gap);
  const color = bc(branch);
  return (
    <div className="sr-panel sr-line">
      <svg viewBox={`0 0 ${W} ${H}`} role="group" aria-label={`The ${nodes.length} nodes of branch ${SCREEN[branch].n}`}>
        <path d={`M${x},${ys[0]} V${H - top}`} stroke="var(--hair)" strokeWidth={8} strokeLinecap="round" fill="none" />
        {nodes.map((n, i) => {
          const s = step[n.id];
          const state = !s ? 'unreached' : s.pick ? (s.pick.to ? 'fires' : 'clear') : 'open';
          const viewing = view === n.id;
          const sub = s?.pick ? `${s.by === 'clinician' ? 'Clinician' : 'Engine'}: ${s.pick.l} → ${s.pick.to ? (s.pick.exit ? 'S18' : s.pick.to) : s.pick.next}` : s ? 'waiting for an answer' : n.options.filter(o => o.to).map(o => o.to).filter((w, k, arr) => arr.indexOf(w) === k).join(' · ');
          return (
            <g key={n.id} className={cls('sr-st', state, viewing && 'viewing')} transform={`translate(${x},${ys[i]})`} tabIndex={0} role="button" aria-pressed={viewing}
              aria-label={`Node ${n.id}: ${n.name}, ${state}`} onClick={() => onPick(n.id)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onPick(n.id); } }}>
              <rect x={-x} y={-gap / 2} width={W} height={gap} fill={viewing ? 'var(--grid)' : 'transparent'} rx={12} />
              {state === 'open' && <circle className="sr-ring" r={12} />}
              <ShapeEl kind="diamond" r={8.5} fill={state === 'fires' ? color : 'var(--station)'} stroke={state === 'unreached' ? 'var(--hair)' : state === 'open' ? 'var(--ink)' : color} strokeWidth={3} strokeLinejoin="round" transform={viewing ? 'scale(1.25)' : undefined} />
              <text className="lab" x={24} y={-1} style={state === 'fires' ? { fill: color, fontWeight: 600 } : undefined}>{n.id} · {n.name}</text>
              <text className="sub" x={24} y={15}>{clip(sub, 44)}</text>
            </g>
          );
        })}
        {nw.wrapper && (
          <g transform={`translate(${x},${H - top})`} {...tip.on(() => wrapperCard(nw.wrapper), { color })}>
            <ShapeEl kind="square" r={9} fill={nw.exit ? 'var(--station)' : color} stroke={nw.exit ? 'var(--muted)' : color} strokeWidth={3} />
            <text className="lab" x={24} y={5} style={{ fontWeight: 600 }}>{nw.wrapper} · {clip(WRAPPERS[nw.wrapper].name, 30)}</text>
          </g>
        )}
      </svg>
    </div>
  );
}

function NodePanel({ n, s, branch }) {
  const { a, set, setMany, fillKeys, go, setNodeView } = useR();
  const reasonId = useId();
  const auto = s?.auto || answerNode(n, a);
  const chosen = a[nodeKey(n.id)] || null;
  const opts = [...n.options, EXIT];
  const pick = s?.pick || (chosen ? opts.find(o => o.v === chosen) : auto.option) || null;
  const visible = n.questions.filter(k => QUESTIONS[k] && (!QUESTIONS[k].when || QUESTIONS[k].when(a)));
  const fillable = visible.filter(k => !QUESTIONS[k].ui || QUESTIONS[k].normal !== undefined);
  // Stay on this node after answering, so a reason box that opens is in view; "Next" moves on.
  const choose = v => { setNodeView(n.id); if (v === auto.option?.v) setMany({ [nodeKey(n.id)]: '', [nodeReasonKey(n.id)]: '' }); else set(nodeKey(n.id), v); };
  const differs = !!chosen && (!auto.option || chosen !== auto.option.v);
  return (
    <div className="sr-panel sr-screen">
      <div className="top">
        <div style={{ minWidth: 0 }}>
          <div className="sr-eyebrow" style={{ color: bc(branch) }}>Node {n.id} · branch {SCREEN[branch].n}, {SCREEN[branch].name}</div>
          <h2>{n.name}</h2>
          <p className="muted" style={{ marginTop: 6 }}>{n.ask}</p>
        </div>
        {!s ? <StateBadge state="unreached" /> : s.pick ? <span className="sr-stamp sm" style={{ color: bc(branch) }}>{s.pick.l}</span> : <StateBadge state="open" />}
      </div>
      {!s && <div className="small muted">Not on this case's path: an earlier node is still open or led elsewhere. Its questions are shown so you can see what it asks.</div>}
      <div className={auto.option ? 'sr-good' : 'sr-note'}><span><b style={{ fontWeight: 500 }}>Engine:</b> {engineSays(auto)}</span></div>
      {auto.assumed?.length > 0 && <div className="sr-note"><span>Answered on an assumption: {auto.assumed.join('; ')}</span></div>}
      {visible.length > 0 && <div className="sr-qgrid">{visible.map(k => <Question key={k} k={k} />)}</div>}
      {fillable.length > 0 && <div className="sr-row"><button type="button" className="sr-btn" onClick={() => fillKeys(fillable)}>All normal</button></div>}
      <div className="sr-col" style={{ gap: 8 }}>
        <h3>Answer</h3>
        <div className="sr-seg" role="radiogroup" aria-label={`Answer at node ${n.id}`}>
          {opts.map(o => (
            <button key={o.v} type="button" role="radio" aria-checked={pick?.v === o.v} className={cls(pick?.v === o.v && 'on', o.exit && 'na')} onClick={() => choose(o.v)}>
              {o.l} → {whereTo(o)}{auto.option?.v === o.v ? ' · engine' : ''}
            </button>
          ))}
        </div>
        {chosen && <div className="sr-row"><button type="button" className="sr-btn" onClick={() => setMany({ [nodeKey(n.id)]: '', [nodeReasonKey(n.id)]: '' })}>Follow the engine</button><span className="small muted">The clinician's answer is saved with the case.</span></div>}
        {differs && (
          <>
            <label className="small" htmlFor={reasonId}>Why “{opts.find(o => o.v === chosen)?.l}”? {auto.option ? `The engine answered “${auto.option.l}”.` : 'The engine could not answer this node.'} Required, and saved with the case.</label>
            <textarea id={reasonId} className="sr-in" value={a[nodeReasonKey(n.id)] || ''} placeholder="e.g. the MRI report shows a full-thickness tear that the form above does not record" onChange={e => set(nodeReasonKey(n.id), e.target.value)} />
          </>
        )}
      </div>
      {s?.pick && (
        <div className="sr-row">
          {s.pick.next ? <button type="button" className="sr-bigbtn" onClick={() => setNodeView(s.pick.next)}>Next: node {s.pick.next} →</button>
            : <button type="button" className="sr-bigbtn" onClick={() => go(5)}>Ends at {s.pick.to}: see the wrapper →</button>}
        </div>
      )}
    </div>
  );
}

function NotYet({ i, purpose }) {
  const { ev, go } = useR();
  return (
    <>
      <StopHead i={i} purpose={purpose} />
      <div className="sr-panel sr-col">
        <div><span className="sr-stamp idle">Not yet</span></div>
        <div className="sr-say">{ev.openFlags.length ? `${ev.openFlags.length} red flag${ev.openFlags.length > 1 ? 's' : ''} still to screen.` : `Decision point ${SCREEN[ev.current].n} (${SCREEN[ev.current].name}) is waiting for answers.`}</div>
        <div><button type="button" className="sr-bigbtn" onClick={() => go(ev.openFlags.length ? 2 : 3)}>{ev.openFlags.length ? 'Screen the red flags' : 'Continue the branch walk'}</button></div>
      </div>
    </>
  );
}

// ---------- stop 5: the node walk ----------
const NODE_PURPOSE = 'Inside the branch, one question at a time, down to the one wrapper the case goes into. Each answer ends at a wrapper or leads to the next node, and every node also offers “None of these fit - clinician review”.';
function NodesStop() {
  const { ev, route, override, setOverride, nodeView, setNodeView, go } = useR();
  const reasonId = useId();
  if (!route.branch) return <NotYet i={4} purpose={NODE_PURPOSE} />;
  const S = SCREEN[route.branch];
  const nw = route.nodes;
  const nodes = NODES.filter(n => n.branch === route.branch);
  const view = nodes.some(n => n.id === nodeView) ? nodeView : nw.at || nw.steps.at(-1)?.id || NODE_START[route.branch];
  const hd = ev.halt ? RED_FLAGS_DOC[ev.halt.id] : null;
  const answered = nw.steps.filter(s => s.pick).length;
  return (
    <>
      <StopHead i={4} purpose={NODE_PURPOSE} />
      <Facts items={[
        [NODES.length, `nodes, in the ${Object.keys(NODE_START).length} branches that hold more than one wrapper`],
        [route.candidates.length, `candidate wrapper${route.candidates.length > 1 ? 's' : ''} for this case (${route.candidates.join(', ')})`],
        [nw.single ? '–' : `${answered}`, nw.single ? 'no node walk needed' : `node${answered === 1 ? '' : 's'} answered on the path`],
        [nw.wrapper || '…', nw.wrapper ? WRAPPERS[nw.wrapper].name : 'the wrapper, once the walk ends'],
      ]} />
      <div className="sr-panel sr-board"><BranchBoard final={route.branch} suggested={ev.branch} /></div>
      <div className="sr-result">
        <div className="sr-col">
          <div className="sr-panel sr-col">
            <div className="sr-row">
              {ev.halt && <span className="sr-stamp stop">Halt · {ev.halt.id}</span>}
              <span className="sr-stamp" style={{ color: bc(route.branch) }}>Branch {S.n}</span>
              <h2 style={{ flex: '1 1 200px' }}>{S.name}</h2>
            </div>
            <div className="sr-say" style={{ borderColor: bc(route.branch) }}>
              {override.branch ? `The clinician chose branch ${S.n}. The engine suggested branch ${SCREEN[ev.branch].n}, ${SCREEN[ev.branch].name}.`
                : ev.halt ? `Red flag ${ev.halt.id} (${hd.desc.toLowerCase()}) routed the case here without the branch walk. ${hd.urgency}.`
                  : `Decision point ${S.n} was the first to match: ${(ev.walk.find(w => w.id === ev.branch)?.signals || []).join('; ')}.`}
            </div>
            {nw.single && (
              <>
                <div className="sr-good"><span>This {ev.halt && !override.branch ? 'red flag' : 'branch'} leads to one wrapper, {nw.wrapper} {WRAPPERS[nw.wrapper].name}, so there is no node walk.</span></div>
                <div><button type="button" className="sr-bigbtn" onClick={() => go(5)}>See the wrapper →</button></div>
              </>
            )}
          </div>
          {!nw.single && (
            <div className="sr-walk">
              <NodeLine branch={route.branch} nw={nw} view={view} onPick={setNodeView} />
              <NodePanel key={view} n={NODE[view]} s={nw.steps.find(x => x.id === view)} branch={route.branch} />
            </div>
          )}
        </div>
        <div className="sr-col sr-sticky">
          <div className="sr-panel sr-col">
            <h3>Clinician's choice of branch</h3>
            <div className="sr-seg">
              <button type="button" className={!override.branch ? 'on' : ''} onClick={() => setOverride({ branch: null, reason: '' })}>Follow the engine (B{SCREEN[ev.branch].n})</button>
              {SCREENS.filter(s => s.id !== ev.branch).map(s => (
                <button key={s.id} type="button" title={s.name} className={override.branch === s.id ? 'on' : ''} onClick={() => setOverride(o => ({ branch: s.id, reason: o.reason }))}>B{s.n}</button>
              ))}
            </div>
            {override.branch && (
              <>
                <label className="small" htmlFor={reasonId}>Why branch {S.n}, {S.name}? Required, and saved with the case.</label>
                <textarea id={reasonId} className="sr-in" value={override.reason} placeholder="e.g. the instability tests were pain-limited; the MRI already shows a full-thickness tear" onChange={e => setOverride(o => ({ ...o, reason: e.target.value }))} />
                {ev.halt && <div className="sr-bad"><span>The halt stays: {ev.halt.id} still needs {hd.urgency.toLowerCase()} referral.</span></div>}
              </>
            )}
          </div>
          {!nw.single && (
            <div className="sr-panel sr-col small">
              <b style={{ fontWeight: 500 }}>How the nodes work</b>
              <span>The engine reads the answers and proposes an answer at each node, the way the Knee CDSS walks its branches. A yes/no node says yes on the first sign; a node with several answers waits until all its questions are answered.</span>
              <span>A different answer from the engine's needs a written reason. “None of these fit” ends in S18 for clinician review.</span>
              <span>The node order and the MRC threshold are drafts for clinical sign-off.</span>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ---------- stop 6: the wrapper ----------
const RESULT_PURPOSE = 'The one wrapper this case goes into, and the whole route that led there. Confirm to save the record for the wrapper form.';
function ResultStop() {
  const { ev, route, override, loaded, go, record, preview, confirm, blockers, setWalkView, setNodeView, allowDownload } = useR();
  const [copied, setCopied] = useState(false);
  const jsonRef = useRef(null);
  if (!route.branch) return <NotYet i={5} purpose={RESULT_PURPOSE} />;
  const nw = route.nodes;
  const S = SCREEN[route.branch];
  const w = nw.wrapper;
  const hd = ev.halt ? RED_FLAGS_DOC[ev.halt.id] : null;
  const docs = w ? WORKFLOW.presenting.filter(p => p.ids.includes(w)) : [];
  const download = DOWNLOADS ? () => {
    const url = URL.createObjectURL(new Blob([JSON.stringify(record, null, 2)], { type: 'application/json' }));
    const el = document.createElement('a');
    el.href = url; el.download = `${(record.caseId || 'shoulder-routing').replace(/[^\w-]/g, '_')}.json`; el.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  } : null;
  // If the clipboard is refused, select the JSON so the clinician can copy it by hand.
  const selectJson = () => { const el = jsonRef.current; if (!el) return; const r = document.createRange(); r.selectNodeContents(el); const s = window.getSelection(); s.removeAllRanges(); s.addRange(r); setCopied('selected'); };
  const copy = () => {
    try {
      navigator.clipboard.writeText(JSON.stringify(record, null, 2)).then(() => { setCopied('copied'); setTimeout(() => setCopied(false), 1500); }, selectJson);
    } catch { selectJson(); }
  };
  return (
    <>
      <StopHead i={5} purpose={RESULT_PURPOSE} />
      <div className="sr-result">
        <div className="sr-col">
          <div className="sr-panel sr-col">
            <div className="sr-row">
              {ev.halt && <span className="sr-stamp stop">Halt · {ev.halt.id}</span>}
              <span className="sr-stamp" style={{ color: bc(route.branch) }}>{w || 'Not yet'}</span>
              <h2 style={{ flex: '1 1 200px' }}>{w ? WRAPPERS[w].name : `Branch ${S.n}: the node walk is not finished`}</h2>
            </div>
            {!w ? (
              <>
                <div className="sr-say">Node {nw.at} is waiting for an answer.</div>
                <div><button type="button" className="sr-bigbtn" onClick={() => { setNodeView(nw.at); go(4); }}>Continue the node walk</button></div>
              </>
            ) : (
              <div className="sr-say" style={{ borderColor: bc(route.branch) }}>
                {ev.halt && !override.branch ? `Red flag ${ev.halt.id} → branch` : 'Branch'} {S.n}, {S.name}{nw.single ? '' : ` → ${nw.steps.length} node${nw.steps.length > 1 ? 's' : ''}`} → {w}.
                {nw.exit ? ' No node answer fitted, so the case goes to S18 for clinician review.' : ''}
              </div>
            )}
            {ev.halt && <div className="sr-bad"><span>No rehabilitation plan until the referral clears the case ({hd.urgency.toLowerCase()}). Every fired flag is written into Red Flags / Precautions.</span></div>}
            {loaded && w && (
              loaded.wrapper === w
                ? <div className="sr-good"><span>This dataset case comes from {loaded.wrapper} ({loaded.diagnosis}), and the walk ends in {w}.</span></div>
                : <div className="sr-bad"><span>This dataset case comes from {loaded.wrapper} ({loaded.diagnosis}), but the walk ends in {w}.</span></div>
            )}
          </div>
          {w && <div className="sr-cands"><Candidate w={w} branchId={route.branch} hints={(override.branch ? [] : ev.hints || []).filter(h => h.w === w)} carried={Object.keys(preview.wrapperFields[w] || {}).filter(c => WRAPPERS[w].specificFields.includes(c)).length} /></div>}
          {docs.length > 0 && (
            <div className="sr-panel sr-col small">
              <h3>What the Workflow Guide says</h3>
              {docs.map(d => <div key={d.picture}>“{d.picture}” → <b style={{ fontWeight: 500 }}>{d.group}</b></div>)}
            </div>
          )}
          <div className="sr-panel sr-col">
            <h3>The branch walk</h3>
            <div className="sr-trace">
              {ev.walk.map((x, i) => {
                const s = SCREENS[i];
                const why = x.state === 'fires' ? (x.signals || [])[0] : x.state === 'clear' ? (x.note || (x.assumed?.length ? `clear, assuming ${x.assumed[0]}` : 'clear')) : x.state === 'open' ? 'waiting for answers' : 'not reached';
                return (
                  <button key={s.id} type="button" onClick={() => { setWalkView(s.id); go(3, { view: s.id }); }}>
                    <Shape kind={s.shape} size={18} stroke={x.state === 'fires' ? bc(s.id) : x.state === 'clear' ? 'var(--ok)' : 'var(--hair)'} fill={x.state === 'fires' ? bc(s.id) : 'var(--station)'} sw={2.4} />
                    <span className="n">B{s.n}</span>
                    <span>{s.name} <span className="r">· {why}</span></span>
                  </button>
                );
              })}
            </div>
          </div>
          {!nw.single && (
            <div className="sr-panel sr-col">
              <h3>The node walk</h3>
              <div className="sr-trace">
                {nw.steps.map(s => (
                  <button key={s.id} type="button" onClick={() => { setNodeView(s.id); go(4); }}>
                    <Shape kind="diamond" size={18} stroke={s.pick ? bc(route.branch) : 'var(--hair)'} fill={s.pick?.to ? bc(route.branch) : 'var(--station)'} sw={2.4} />
                    <span className="n">{s.id}</span>
                    <span>{s.node.name} <span className="r">· {s.pick ? `${s.pick.l} → ${s.pick.to || s.pick.next}${s.by === 'clinician' ? ' (clinician)' : ''}` : 'waiting for an answer'}</span></span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
        <div className="sr-col sr-sticky">
          <div className="sr-panel sr-col">
            <h3>Save the routing</h3>
            {blockers.map(b => <div key={b} className="sr-bad"><span>{b}</span></div>)}
            <button type="button" className="sr-bigbtn" disabled={blockers.length > 0} onClick={confirm}>{w ? `Confirm ${w}` : 'Confirm'}</button>
            {record && (
              <>
                <div className="sr-good"><span>Confirmed. The record keys every answer by its exact Excel column, ready for the {w} form.</span></div>
                <div className="sr-row">
                  {DOWNLOADS && allowDownload && <button type="button" className="sr-btn" onClick={download}>Download JSON</button>}
                  <button type="button" className="sr-btn" onClick={copy}>{copied === 'copied' ? 'Copied' : 'Copy JSON'}</button>
                  {copied === 'selected' && <span className="small muted">Copying is blocked here: the JSON is selected, so press Ctrl+C.</span>}
                </div>
                <pre ref={jsonRef} className="sr-json">{JSON.stringify(record, null, 2)}</pre>
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ---------- the component ----------
const BODIES = { patient: PatientStop, history: HistoryStop, flags: FlagsStop, walk: WalkStop, nodes: NodesStop, result: ResultStop };

const sampleState = idx => {
  const row = SAMPLES[idx];
  if (!row) return null;
  const { answers, assumed, raw } = fromDatasetRow(row);
  return { answers, assumed, raw, loaded: { idx, caseId: row['Case ID'], wrapper: row.wrapper, diagnosis: row.Diagnosis, phase: row['Rehabilitation Phase'] } };
};

const ShoulderRouter = forwardRef(function ShoulderRouter(
  { caseId = '', onChange, onRouted, theme, persist = true, storageKey = 'shoulder-router.v1', className = '', applyThemeTo = 'self', allowDownload = true, initialSample = null },
  ref,
) {
  const saved = useMemo(() => (persist ? readStore(storageKey) : null), []); // eslint-disable-line react-hooks/exhaustive-deps
  const start = useMemo(() => (saved ? null : initialSample != null ? sampleState(initialSample) : null), []); // eslint-disable-line react-hooks/exhaustive-deps
  const [a, setA] = useState(() => saved?.a || start?.answers || {});
  const [assumedArr, setAssumed] = useState(() => saved?.assumed || start?.assumed || []);
  // Original Excel cells of a loaded dataset case, written back verbatim while their answers are unchanged.
  const [raw, setRaw] = useState(() => saved?.raw || start?.raw || {});
  const [stop, setStop] = useState(() => Math.min(STOPS.length - 1, Math.max(0, saved?.stop || 0)));
  const [dir, setDir] = useState(1);
  const [moved, setMoved] = useState(false);
  const [seen, setSeen] = useState(() => saved?.seen || { [STOPS[0].id]: 1 });
  const [override, setOverrideRaw] = useState(() => saved?.override || { branch: null, reason: '' });
  const [loaded, setLoaded] = useState(() => saved?.loaded || start?.loaded || null);
  const [walkView, setWalkView] = useState(() => saved?.walkView || null);
  const [nodeView, setNodeView] = useState(() => saved?.nodeView || null);
  const [record, setRecord] = useState(null);
  const [themeState, setThemeState] = useState(() => saved?.theme || null);
  const [resetKey, setResetKey] = useState(0);
  const rootRef = useRef(null);
  const [tipState, tip] = useTip();
  const ev = useMemo(() => evaluate(a), [a]);
  const route = useMemo(() => routeOf(a, ev, override), [a, ev, override]);
  const assumed = useMemo(() => new Set(assumedArr), [assumedArr]);
  const preview = useMemo(() => buildRecord(a, { override, assumed: assumedArr, raw }), [a, override, assumedArr, raw]);
  const caseIdShown = caseId || loaded?.caseId || '';

  useEffect(() => {
    if (persist) writeStore(storageKey, { a, assumed: assumedArr, raw, stop, seen, override, loaded, walkView, nodeView, theme: themeState });
  }, [persist, storageKey, a, assumedArr, raw, stop, seen, override, loaded, walkView, nodeView, themeState]);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onRoutedRef = useRef(onRouted);
  onRoutedRef.current = onRouted;
  useEffect(() => { onChangeRef.current?.(a, ev); }, [a, ev]);

  const setMany = useCallback(obj => {
    const keys = Object.keys(obj);
    setA(prev => {
      const n = { ...prev };
      for (const [k, v] of Object.entries(obj)) { if (v === '' || v === undefined || v === null) delete n[k]; else n[k] = v; }
      return n;
    });
    setAssumed(prev => (prev.some(k => keys.includes(k)) ? prev.filter(k => !keys.includes(k)) : prev));
    setRecord(null);
  }, []);
  const set = useCallback((k, v) => setMany({ [k]: v }), [setMany]);
  const fillKeys = useCallback(keys => {
    const n = fillNormal(a, keys);
    const changed = keys.filter(k => n[k] !== a[k]);
    if (changed.length) setMany(Object.fromEntries(changed.map(k => [k, n[k]])));
  }, [a, setMany]);
  const setOverride = useCallback(u => { setOverrideRaw(u); setRecord(null); }, []);

  const go = useCallback((i, opts = {}) => {
    const to = Math.max(0, Math.min(STOPS.length - 1, i));
    if (to === stop && !opts.view) return;
    setDir(to >= stop ? 1 : -1);
    setMoved(true);
    setStop(to);
    setSeen(s => (s[STOPS[to].id] ? s : { ...s, [STOPS[to].id]: 1 }));
    if (STOPS[to].id === 'walk') setWalkView(opts.view || ev.current || ev.suggested || 'B1');
    if (STOPS[to].id === 'nodes' && opts.node) setNodeView(opts.node);
    tip.hide();
    requestAnimationFrame(() => {
      const el = rootRef.current;
      if (!el) return;
      const y = el.getBoundingClientRect().top + window.scrollY;
      if (window.scrollY > y) window.scrollTo({ top: y, behavior: reduced() ? 'auto' : 'smooth' });
    });
  }, [stop, ev, tip]);
  const goRef = useRef(go);
  goRef.current = go;
  const stopRef = useRef(stop);
  stopRef.current = stop;

  const loadSample = useCallback(idx => {
    const s = sampleState(idx);
    if (!s) return;
    setA(s.answers); setAssumed(s.assumed); setRaw(s.raw); setLoaded(s.loaded);
    setOverrideRaw({ branch: null, reason: '' }); setRecord(null); setWalkView(null); setNodeView(null); setResetKey(n => n + 1);
  }, []);
  const newPatient = useCallback(() => {
    setA({}); setAssumed([]); setRaw({}); setLoaded(null); setOverrideRaw({ branch: null, reason: '' }); setRecord(null); setWalkView(null); setNodeView(null);
    setSeen({ [STOPS[0].id]: 1 }); setResetKey(n => n + 1); setDir(-1); setMoved(true); setStop(0);
  }, []);

  const invalid = useMemo(() => {
    const out = [];
    for (const f of CORE_FIELDS) if ((f.kind === 'int' || f.kind === 'dec') && numError(f, a[f.key])) out.push(f.label || f.key);
    for (const q of Object.values(QUESTIONS)) if ((q.kind === 'int' || q.kind === 'dec' || q.kind === 'week') && numError(q, a[q.key])) out.push(q.label);
    return out;
  }, [a]);
  const blockers = [
    ev.openFlags.length > 0 && `${ev.openFlags.length} red flag${ev.openFlags.length > 1 ? 's' : ''} not screened yet.`,
    invalid.length > 0 && `Fix the out-of-range or non-numeric value${invalid.length > 1 ? 's' : ''}: ${invalid.join(', ')}.`,
    override.branch && override.reason.trim().length < 5 && 'Write a reason for choosing a different branch.',
    !ev.branch && 'No branch yet.',
    route.branch && !route.nodes.wrapper && `The node walk is waiting at node ${route.nodes.at}.`,
    ...route.nodes.steps.filter(x => x.differs && x.reason.trim().length < 5).map(x => `Write a reason for the answer at node ${x.id}: it is not the engine's.`),
  ].filter(Boolean);
  const confirm = useCallback(() => {
    const rec = buildRecord(a, { caseId: caseIdShown, override, assumed: assumedArr, raw });
    setRecord(rec);
    onRoutedRef.current?.(rec);
  }, [a, caseIdShown, override, assumedArr, raw]);

  useImperativeHandle(ref, () => ({
    getRecord: () => buildRecord(a, { caseId: caseIdShown, override, assumed: assumedArr, raw }),
    getAnswers: () => a,
    evaluate: () => ev,
    reset: newPatient,
    loadSample,
  }), [a, caseIdShown, override, assumedArr, raw, ev, newPatient, loadSample]);

  useEffect(() => {
    const onKey = e => {
      if (e.key === 'Escape') tip.hide();
      const t = e.target instanceof Node ? e.target : document.body;
      if (e.altKey || e.ctrlKey || e.metaKey || /INPUT|SELECT|TEXTAREA/.test(t.tagName || '') || t.isContentEditable || t.closest?.('.sr-seg, .sr-st, .sr-node')) return;
      if (!rootRef.current?.contains(t) && t !== document.body) return;
      if (e.key === 'ArrowRight') goRef.current(stopRef.current + 1);
      if (e.key === 'ArrowLeft') goRef.current(stopRef.current - 1);
    };
    const onDown = e => {
      if (tip.pinned.current && !e.target.closest?.('.sr-tip') && !(tip.owner.current && tip.owner.current.contains(e.target))) tip.hide();
    };
    window.addEventListener('keydown', onKey);
    document.addEventListener('pointerdown', onDown);
    return () => { window.removeEventListener('keydown', onKey); document.removeEventListener('pointerdown', onDown); };
  }, [tip]);

  const themeAttr = theme || themeState || undefined;
  const onDoc = applyThemeTo === 'document';
  // On a standalone page the colour tokens live on <html>, where the viewer's own theme setting also lands.
  useEffect(() => { if (onDoc && themeAttr) document.documentElement.dataset.theme = themeAttr; }, [onDoc, themeAttr]);
  const toggleTheme = () => {
    const current = themeAttr || (onDoc ? document.documentElement.dataset.theme : undefined);
    const dark = current ? current === 'dark' : window.matchMedia?.('(prefers-color-scheme: dark)').matches;
    setThemeState(dark ? 'light' : 'dark');
  };
  const S = STOPS[stop];
  const Body = BODIES[S.id];
  const nw = route.nodes;
  const status = !route.branch ? (ev.openFlags.length ? `${ev.openFlags.length} red flag${ev.openFlags.length > 1 ? 's' : ''} to screen` : `Waiting at decision point ${SCREEN[ev.current].n}`)
    : `${ev.halt ? `Halt · ${ev.halt.id} → ` : ''}Branch ${SCREEN[route.branch].n}${nw.wrapper ? ` → ${nw.wrapper} · ${WRAPPERS[nw.wrapper].name}` : ` · node walk at ${nw.at}`}`;
  const ctx = { a, set, setMany, fillKeys, assumed, ev, route, preview, tip, go, override, setOverride, loaded, loadSample, newPatient, walkView, setWalkView, nodeView, setNodeView, record, confirm, blockers, allowDownload, raw };

  return (
    <Ctx.Provider value={ctx}>
      <div className={cls('sr', className)} data-theme={onDoc ? undefined : themeAttr} ref={rootRef}>
        <header className="sr-top">
          <div className="sr-topin">
            <div className="sr-brand">Shoulder CDSS Metro<small>Routing to a wrapper · Case {caseIdShown || 'assigned on save'}</small></div>
            <div className="sr-strip"><Strip cur={stop} seen={seen} onGo={go} ev={ev} route={route} /></div>
            <div className="sr-clock">
              <Clock cur={stop} />
              {!theme && <button type="button" className="sr-iconbtn" aria-label="Switch light or dark" onClick={toggleTheme}>◐</button>}
            </div>
          </div>
        </header>
        <main className="sr-main">
          <section key={`${S.id}-${resetKey}`} className={cls('sr-sv', moved && 'moved', dir < 0 && 'back')} aria-labelledby={`sr-title-${S.id}`}>
            <Body />
          </section>
        </main>
        <nav className="sr-nav" aria-label="Previous and next stop">
          <div className="sr-navin">
            <button type="button" className="sr-navbtn prev" disabled={stop === 0} onClick={() => go(stop - 1)}>
              <span className="disc" aria-hidden="true">←</span><span className="lab"><span>Back</span><b>{stop > 0 ? STOPS[stop - 1].name : ''}</b></span>
            </button>
            <div className="sr-navmid">{status}</div>
            <button type="button" className="sr-navbtn next" disabled={stop === STOPS.length - 1} onClick={() => go(stop + 1)}>
              <span className="disc" aria-hidden="true">→</span><span className="lab"><span>Next stop</span><b>{stop < STOPS.length - 1 ? STOPS[stop + 1].name : 'End of the line'}</b></span>
            </button>
          </div>
        </nav>
        <Tip tip={tipState} api={tip} />
      </div>
    </Ctx.Provider>
  );
});

export default ShoulderRouter;
