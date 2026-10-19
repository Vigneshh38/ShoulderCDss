// Draw the routing map: every path from intake to one wrapper (red flags, the branch walk, the node walk), as SVG.
//
//   node scripts/draw_routing_map.mjs [out.svg]        (default: docs/routing_map.svg)
//
// Everything is read from src/ShoulderRouter/routingSpec.js, so the picture cannot drift from the rules. Open the SVG
// in a browser, or render it to PNG with any SVG tool. Colours are the router's light theme (ShoulderRouter.css).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { FLAGS, SCREENS, SCREEN, FLAG_BRANCH, NODES, NODE_START } from '../src/ShoulderRouter/routingSpec.js';
import { WRAPPERS, RED_FLAGS_DOC } from '../src/ShoulderRouter/routingData.generated.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.argv[2] || path.join(HERE, '..', 'docs', 'routing_map.svg');

const C = {
  paper: '#f3f1ec', grid: '#e6e2d9', ink: '#24231f', muted: '#7a766c', card: '#fdfcf9', hair: '#d6d1c5', stop: '#d8392b', refer: '#e0961a',
  B1: '#e2473a', B2: '#c23660', B3: '#9a5a3a', B4: '#2f6fc4', B5: '#17998a', B6: '#efb520', B7: '#e57a2e', B8: '#7a52c2', B9: '#cf4f97', B10: '#3b9a4a', B11: '#a39f95',
};
const FONT = "Inter, 'DejaVu Sans', Arial, sans-serif";
const esc = s => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
// Greedy word wrap by an average character width (Inter, about 0.56 em).
function wrap(text, px, size) {
  const max = Math.max(8, Math.floor(px / (size * 0.56)));
  const lines = [];
  let cur = '';
  for (const word of String(text).split(/\s+/)) {
    if (!cur) cur = word;
    else if ((cur + ' ' + word).length <= max) cur += ' ' + word;
    else { lines.push(cur); cur = word; }
  }
  if (cur) lines.push(cur);
  return lines;
}
const out = [];
const add = s => out.push(s);
function text(x, y, s, { size = 13, weight = 400, fill = C.ink, anchor = 'start', italic = false } = {}) {
  add(`<text x="${x}" y="${y}" font-family="${FONT}" font-size="${size}" font-weight="${weight}" fill="${fill}" text-anchor="${anchor}"${italic ? ' font-style="italic"' : ''}>${esc(s)}</text>`);
}
function lines(x, y, ls, opts = {}) { const lh = opts.lh || Math.round((opts.size || 13) * 1.35); ls.forEach((l, i) => text(x, y + i * lh, l, opts)); return ls.length * lh; }
function box(x, y, w, h, { fill = C.card, stroke = C.hair, sw = 1.5, r = 12, dash = null } = {}) {
  add(`<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"${dash ? ` stroke-dasharray="${dash}"` : ''}/>`);
}
function arrow(d, { stroke = C.ink, sw = 2, dash = null, head = 'a-ink' } = {}) {
  add(`<path d="${d}" fill="none" stroke="${stroke}" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round"${dash ? ` stroke-dasharray="${dash}"` : ''} marker-end="url(#${head})"/>`);
}

// The branch a wrapper is drawn in (its first branch), for its colour.
const BRANCH_OF = {};
for (const s of SCREENS) for (const w of s.wrappers) BRANCH_OF[w] ||= s.id;
const wColor = w => C[BRANCH_OF[w]] || C.ink;

// A wrapper chip: coloured square, id, name (up to two lines). Returns its height.
const chipLines = (w, width) => wrap(`${w} · ${WRAPPERS[w].name}`, width - 34, 12.5).slice(0, 2);
const chipH = (w, width) => 12 + chipLines(w, width).length * 17;
function chip(x, y, w, { width = 300, exit = false } = {}) {
  const ls = chipLines(w, width);
  const h = 12 + ls.length * 17;
  box(x, y, width, h, { fill: exit ? C.card : '#ffffff', stroke: exit ? C.muted : wColor(w), sw: 2, r: 9, dash: exit ? '5 4' : null });
  add(`<rect x="${x + 10}" y="${y + 10}" width="12" height="12" rx="2" fill="${exit ? C.card : wColor(w)}" stroke="${exit ? C.muted : wColor(w)}" stroke-width="1.5"/>`);
  lines(x + 30, y + 21, ls, { size: 12.5, weight: 500, lh: 17 });
  return h;
}

// ---------- layout ----------
const W = 2320, PAD = 40;
const SPINE_X = PAD, SPINE_W = 470;          // branch decision points
const NODE_X = 600, NODE_W = 470;            // node cards
const LEAF_X = NODE_X + NODE_W + 60, LEAF_W = 420;
const INDEX_X = 1640, INDEX_W = W - 1640 - PAD;
const RF_W = LEAF_X + LEAF_W - PAD + 20;
let y = 0;

// Title
text(PAD, 58, 'Shoulder CDSS · routing map', { size: 34, weight: 600 });
lines(PAD, 92, wrap('Every path from intake to one wrapper. Red flags are screened first; if none fires, the branch walk asks the 11 decision points in the Workflow Guide order and the first match is the branch; inside a branch with more than one wrapper, the node walk asks one question at a time until one wrapper is left. Drawn from routingSpec.js. Draft rules: for clinical sign-off.', 1460, 15), { size: 15, fill: C.muted, lh: 21 });
y = 160;

// ---------- 1. red flags ----------
text(PAD, y, '1 · RED FLAGS · screened before any branching', { size: 13, weight: 700, fill: C.muted });
y += 14;
const rfTop = y;
const rfRows = FLAGS.map(f => {
  const doc = RED_FLAGS_DOC[f.id];
  const ls = wrap(`${doc.desc}`, 820, 13);
  return { f, doc, ls, h: Math.max(36 + ls.length * 18, f.wrappers.length > 1 ? 0 : chipH(f.wrappers[0], LEAF_W) + 14) };
});
const rfH = rfRows.reduce((s, r) => s + r.h, 0) + 24;
box(PAD, rfTop, RF_W, rfH, { r: 14 });
let ry = rfTop + 12;
for (const r of rfRows) {
  const col = r.f.emergency ? C.stop : C.refer;
  // cross for emergency, triangle for urgent
  if (r.f.emergency) add(`<path d="M${PAD + 22},${ry + 10} h8 v8 h8 v8 h-8 v8 h-8 v-8 h-8 v-8 h8 z" fill="${col}"/>`);
  else add(`<path d="M${PAD + 30},${ry + 9} l12,22 h-24 z" fill="${col}"/>`);
  text(PAD + 60, ry + 22, r.f.id, { size: 13, weight: 700 });
  const dh = lines(PAD + 150, ry + 22, r.ls, { size: 13, lh: 18 });
  text(PAD + 150, ry + 22 + dh, `${r.doc.urgency}${r.f.draft ? ' · draft trigger, for clinical sign-off' : ' · trigger written in the S07 document'}`, { size: 12, fill: C.muted });
  // target
  const multi = r.f.wrappers.length > 1;
  const tx = LEAF_X;
  arrow(`M${PAD + 1000},${ry + 18} H${tx - 4}`, { stroke: col });
  if (multi) {
    box(tx, ry + 4, LEAF_W, 28, { stroke: C[FLAG_BRANCH[r.f.id]], sw: 2, r: 9 });
    text(tx + 12, ry + 23, `node walk ${NODE_START[FLAG_BRANCH[r.f.id]]} → ${r.f.wrappers.join(' / ')}`, { size: 12.5, weight: 500 });
  } else chip(tx, ry + 4, r.f.wrappers[0], { width: LEAF_W });
  ry += r.h;
}
y = rfTop + rfH + 18;
text(PAD + 18, y + 6, 'A fired flag halts the case for urgent referral and goes straight to its wrapper. Emergencies outrank urgent flags. If no flag fires:', { size: 13, fill: C.muted });
y += 34;

// ---------- 2 + 3. branch walk and node walk ----------
text(PAD, y, '2 · BRANCH WALK · first match wins', { size: 13, weight: 700, fill: C.muted });
text(NODE_X, y, '3 · NODE WALK · inside the branch, down to one wrapper', { size: 13, weight: 700, fill: C.muted });
y += 16;
const spineTop = y;
const spineCenters = [];
for (const s of SCREENS) {
  const col = C[s.id];
  const qls = wrap(s.ask, SPINE_W - 40, 13);
  const sh = 46 + qls.length * 18;
  // the node chain (or single wrapper) to the right
  const nodes = NODES.filter(n => n.branch === s.id);
  let rowH = sh;
  const rowTop = y;
  if (!nodes.length) {
    const ch = chip(NODE_X, y + sh / 2 - chipH(s.wrappers[0], LEAF_W) / 2, s.wrappers[0], { width: LEAF_W });
    arrow(`M${SPINE_X + SPINE_W},${y + sh / 2} H${NODE_X - 4}`, { stroke: col, sw: 2.5, head: `a-${s.id}` });
    text(SPINE_X + SPINE_W + 14, y + sh / 2 - 7, 'yes', { size: 12, weight: 600, fill: col });
    if (s.halt) text(NODE_X + LEAF_W + 14, y + sh / 2 + 5, 'halt group: urgent referral first (Phase 1)', { size: 12, fill: C.stop });
    rowH = Math.max(sh, ch);
  } else {
    // draw nodes top to bottom in definition order; each option leads right (a wrapper) or down (the next node)
    let ny = y;
    const pos = {};
    const cards = nodes.map(n => {
      const qls2 = wrap(n.ask, NODE_W - 28, 12.5);
      // An answer row is as tall as the wrapper chip it leads to.
      const rows = n.options.map(o => (o.to ? Math.max(26, chipH(o.to, LEAF_W) + 6) : 26));
      const h = 40 + qls2.length * 17 + rows.reduce((t, r) => t + r, 0) + 8;
      return { n, qls2, h, rows };
    });
    for (const c of cards) { pos[c.n.id] = { y: ny, h: c.h }; ny += c.h + 34; }
    arrow(`M${SPINE_X + SPINE_W},${y + sh / 2} H${NODE_X - 4}`, { stroke: col, sw: 2.5, head: `a-${s.id}` });
    text(SPINE_X + SPINE_W + 14, y + sh / 2 - 7, 'yes', { size: 12, weight: 600, fill: col });
    for (const c of cards) {
      const { n } = c, p = pos[n.id];
      box(NODE_X, p.y, NODE_W, p.h, { stroke: col, sw: 2, r: 12 });
      add(`<path d="M${NODE_X + 22},${p.y + 12} l9,9 l-9,9 l-9,-9 z" fill="${col}"/>`);
      text(NODE_X + 40, p.y + 26, `${n.id} · ${n.name}`, { size: 14, weight: 600 });
      lines(NODE_X + 14, p.y + 48, c.qls2, { size: 12.5, fill: C.muted, lh: 17 });
      let oy = p.y + 40 + c.qls2.length * 17 + 8;
      n.options.forEach((o, k) => {
        const rh = c.rows[k], ry0 = oy + (rh - 22) / 2;
        const label = o.otherwise ? `${o.l} (otherwise)` : o.l;
        add(`<rect x="${NODE_X + 12}" y="${ry0}" width="${NODE_W - 24}" height="22" rx="6" fill="${C.paper}"/>`);
        text(NODE_X + 22, ry0 + 15, label, { size: 12.5, weight: 500 });
        if (o.to) {
          const ly = ry0 + 11;
          arrow(`M${NODE_X + NODE_W - 12},${ly} H${LEAF_X - 4}`, { stroke: col, head: `a-${s.id}` });
          chip(LEAF_X, ly - chipH(o.to, LEAF_W) / 2, o.to, { width: LEAF_W });
        } else if (o.next) {
          const t = pos[o.next];
          text(NODE_X + NODE_W - 22, ry0 + 15, `→ ${o.next}`, { size: 12.5, weight: 600, fill: col, anchor: 'end' });
          // down the left edge of the card to the next node
          if (t.y > p.y) arrow(`M${NODE_X + 6},${ry0 + 11} H${NODE_X - 12} V${t.y + 20} H${NODE_X - 2}`, { stroke: col, sw: 1.8, head: `a-${s.id}` });
        }
        oy += rh;
      });
      // the engine's answer when nothing fits, and the exit every node offers
      const lastOpt = n.options.some(o => o.otherwise);
      if (!lastOpt) {
        arrow(`M${NODE_X + NODE_W / 2},${p.y + p.h} V${p.y + p.h + 22}`, { stroke: C.muted, sw: 1.5, dash: '4 4', head: 'a-muted' });
        text(NODE_X + NODE_W / 2 + 10, p.y + p.h + 18, n.choice ? 'none or several fit → clinician picks (or S18)' : 'nothing fits → clinician review (S18)', { size: 12, fill: C.muted });
      }
    }
    rowH = Math.max(sh, ny - y - 34 + 24);
  }
  // the decision point box on the spine
  box(SPINE_X, y, SPINE_W, sh, { stroke: col, sw: 2.5, r: 14 });
  add(`<rect x="${SPINE_X}" y="${y}" width="10" height="${sh}" rx="4" fill="${col}"/>`);
  text(SPINE_X + 24, y + 28, `B${s.n} · ${s.name}`, { size: 16, weight: 600 });
  if (s.draft) text(SPINE_X + SPINE_W - 14, y + 28, 'draft', { size: 11.5, fill: C.muted, anchor: 'end' });
  lines(SPINE_X + 24, y + 50, qls, { size: 13, fill: C.muted, lh: 18 });
  spineCenters.push({ s, y, h: sh, rowTop, rowH });
  y = rowTop + rowH + 40;
}
// "no" arrows down the spine
for (let i = 0; i < spineCenters.length - 1; i++) {
  const a = spineCenters[i], b = spineCenters[i + 1];
  const x = SPINE_X + 60;
  arrow(`M${x},${a.y + a.h} V${b.y - 2}`, { stroke: C.ink, sw: 2 });
  text(x + 10, a.y + a.h + 22, 'no', { size: 12, weight: 600 });
}
const spineBottom = y;
text(NODE_X, y - 8, 'Every node also offers “None of these fit - clinician review”, which ends in S18. A clinician answer that differs from the engine needs a written reason.', { size: 13, fill: C.muted });
y += 20;

// ---------- 4. index: how each wrapper is reached ----------
const reach = {};
for (const f of FLAGS) for (const w of f.wrappers) (reach[w] ||= []).push(`red flag ${f.id}${f.wrappers.length > 1 ? ` (then node walk ${NODE_START[FLAG_BRANCH[f.id]]})` : ''}`);
for (const s of SCREENS) if (!NODE_START[s.id]) for (const w of s.wrappers) (reach[w] ||= []).push(`branch B${s.n}`);
for (const n of NODES) for (const o of n.options) if (o.to) (reach[o.to] ||= []).push(`B${SCREEN[n.branch].n} → node ${n.id} “${o.l}”`);
(reach.S18 ||= []).push('the exit at any node');
let iy = spineTop;
text(INDEX_X, iy - 16, '4 · WHERE EACH WRAPPER IS REACHED', { size: 13, weight: 700, fill: C.muted });
const ids = Object.keys(WRAPPERS).sort();
for (const w of ids) {
  const rl = reach[w].flatMap(r => wrap(`· ${r}`, INDEX_W - 20, 12));
  const ch = chip(INDEX_X, iy, w, { width: INDEX_W });
  lines(INDEX_X + 14, iy + ch + 18, rl, { size: 12, fill: C.muted, lh: 16 });
  iy += ch + 10 + rl.length * 16 + 16;
}

const H = Math.max(y, iy) + PAD;
const defs = ['ink', 'muted', ...SCREENS.map(s => s.id)].map(k => {
  const col = k === 'ink' ? C.ink : k === 'muted' ? C.muted : C[k];
  return `<marker id="a-${k}" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="${col}"/></marker>`;
}).join('');
const head = [
  `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">`,
  `<title>Shoulder CDSS routing map</title>`,
  `<defs>${defs}<pattern id="grid" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M44,0 H0 V44" fill="none" stroke="${C.grid}" stroke-width="1"/></pattern></defs>`,
  `<rect width="${W}" height="${H}" fill="${C.paper}"/><rect width="${W}" height="${H}" fill="url(#grid)"/>`,
].join('\n');
const svg = out.join('\n');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, `${head}\n${svg}\n</svg>\n`);
console.log(`wrote ${OUT} (${W}×${H}): ${FLAGS.length} red flags, ${SCREENS.length} decision points, ${NODES.length} nodes, ${ids.length} wrappers`);
