// Trace a letter, a letter team, a word or a shape: free-hand drawing over the outline on a canvas.
import { $, pt, rectIn, capture } from './stage.js';
import { U } from './session.js';
import { LETTERS, CHUNKS, SHAPES, sndOf } from './data.js';
import { I } from './icons.js';
import { say, ru, en, sfx } from './audio.js';
import { go } from './nav.js';
import { dotsHtml, onTask } from './lessons.js';
import { Q, setQ, answerQ } from './quiz.js';

/* ================= trace: a letter, a letter team or a word (free-hand drawing over the outline) ================= */
// sizes are for a single letter on the 600×600 card; longer text uses a wide card and thinner strokes scale with the font
const TR = { BRUSH: 26, TOL: 34, STEP: 10, NEED: .8, MAXOFF: .35 };
let T = null;
function letterFont(px) { return `800 ${px}px ${getComputedStyle($('stage')).fontFamily}`; }
// font size that fits the text into the card
function traceFit(text, W, H) {
  const c = document.createElement('canvas').getContext('2d');
  let px = Math.min(460, H * .82);
  c.font = letterFont(px);
  const w = c.measureText(text).width;
  if (w > W * .88) px *= W * .88 / w;
  return px;
}
// draws the text centred in the card; mode: 'guide' (pale fill + dashed outline), 'mask', 'zone' (mask widened by the tolerance), 'done'
function drawGlyph(ctx, ch, mode) {
  const { W, H, px, k } = T;
  ctx.clearRect(0, 0, W, H);
  if (T.shape) return drawShape(ctx, mode);
  ctx.font = letterFont(px); ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
  const m = ctx.measureText(ch), y = H / 2 + (m.actualBoundingBoxAscent - m.actualBoundingBoxDescent) / 2;
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  // only T.hl (e.g. "ch" in "chick") is traced; the rest of the word is printed solid and is not part of the task
  const [a, b] = T.hl || [0, ch.length], x0 = W / 2 - m.width / 2;
  const pre = ch.slice(0, a), mid = ch.slice(a, b), post = ch.slice(b);
  const xm = x0 + ctx.measureText(pre).width, xp = x0 + ctx.measureText(ch.slice(0, b)).width;
  if (mode === 'guide' || mode === 'done') { ctx.fillStyle = '#8b7966'; ctx.fillText(pre, x0, y); ctx.fillText(post, xp, y); }
  if (mode === 'guide') {
    ctx.fillStyle = '#f1e7d6'; ctx.fillText(mid, xm, y);
    ctx.setLineDash([14 * k, 12 * k]); ctx.lineWidth = 5; ctx.strokeStyle = '#b9a383'; ctx.strokeText(mid, xm, y); ctx.setLineDash([]);
  } else if (mode === 'done') {
    ctx.fillStyle = '#5fc27a'; ctx.fillText(mid, xm, y);
  } else {
    ctx.fillStyle = '#000'; ctx.fillText(mid, xm, y);
    if (mode === 'zone') { ctx.lineWidth = TR.TOL * 2 * k; ctx.strokeStyle = '#000'; ctx.strokeText(mid, xm, y); }
  }
}
// a shape of level 1 (data.js SHAPES): a thick line to follow instead of a filled letter. The path is drawn on the
// 600×600 card, scaled around the centre for the smaller repeat.
const SHAPE_W = 46;
function drawShape(ctx, mode) {
  const p = T.shape;
  ctx.save();
  ctx.translate(T.W / 2, T.H / 2); ctx.scale(T.k, T.k); ctx.translate(-300, -300);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  if (mode === 'guide') {
    ctx.strokeStyle = '#f1e7d6'; ctx.lineWidth = SHAPE_W; ctx.stroke(p);
    ctx.setLineDash([14, 14]); ctx.lineWidth = 5; ctx.strokeStyle = '#b9a383'; ctx.stroke(p); ctx.setLineDash([]);
  } else {
    ctx.strokeStyle = mode === 'done' ? '#5fc27a' : '#000';
    ctx.lineWidth = mode === 'zone' ? SHAPE_W + TR.TOL * 2 : SHAPE_W; ctx.stroke(p);
  }
  ctx.restore();
}
function glyphMask(ch, mode) {
  const c = document.createElement('canvas'); c.width = T.W; c.height = T.H;
  const x = c.getContext('2d'); drawGlyph(x, ch, mode);
  return x.getImageData(0, 0, T.W, T.H).data;
}
function startTrace(task) {
  if (U.current !== 'trace') go('trace');
  if (U.current !== 'trace') return;
  let ch, id, phrase, after;
  if (task.shape != null) {              // level 1: a shape, named in English
    const name = SHAPES[task.shape][0]; ch = ''; id = name;
    phrase = [ru('Обведи!'), en(name)]; after = [en(name)];
  } else if (task.text) {                // level 3: a letter team ("oy") or a word ("boy")
    ch = task.text; id = CHUNKS[task.ci][0];
    const team = task.text === CHUNKS[task.ci][0];
    // in a word only the team's letters are traced: "ch" in "chick"
    phrase = team ? [ru('Обведи буквы'), en(sndOf(task.ci) + '.')] : [ru('Обведи буквы'), en(sndOf(task.ci) + ','), ru('в слове'), en(task.text)];
    after = team ? [en(sndOf(task.ci) + '.')] : [en(task.text + '.')];
  } else {
    const L0 = LETTERS[task.li][0]; ch = task.low ? L0.toLowerCase() : L0; id = L0;
    phrase = [ru(task.low ? 'Обведи маленькую букву' : 'Обведи букву'), en(L0)]; after = [en(L0)];
  }
  setQ({ task, miss: 0, locked: false, wrongAt: [], drag: false, id, after, phrase });
  // one letter: the square card; two or more: the wide card
  const wide = ch.length > 1, W = wide ? 870 : 600, H = wide ? 480 : 600;
  $('trace').classList.toggle('wide', wide); $('tcard').classList.toggle('wide', wide);
  ['tguide', 'tink'].forEach(id => { const c = $(id); c.width = W; c.height = H; });
  const px = traceFit(ch, W, H);
  const at = task.text && task.ci != null ? ch.indexOf(CHUNKS[task.ci][0]) : -1;
  const shape = task.shape != null ? new Path2D(SHAPES[task.shape][1]) : null;
  T = { ch, W, H, px, k: shape ? (task.small ? .62 : 1) : px / 460, shape, pts: [], zone: null, ink: 0, off: 0, last: null,
        hl: at >= 0 ? [at, at + CHUNKS[task.ci][0].length] : null };
  $('tdots').innerHTML = dotsHtml();
  $('tstreak').innerHTML = U.streak > 0 ? I.fire.repeat(Math.min(U.streak % 3 || 3, 3)) : '';
  $('tcard').classList.remove('ok');
  drawGlyph($('tguide').getContext('2d'), ch, 'guide');
  // target points inside the glyphs, and the tolerance zone around them
  const mask = glyphMask(ch, 'mask'), step = Math.max(6, Math.round(TR.STEP * T.k));
  T.zone = glyphMask(ch, 'zone');
  for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step)
    if (mask[(y * W + x) * 4 + 3] > 128) T.pts.push({ x, y, hit: false });
  traceClear();
  $('tspk').onclick = () => say(...Q.phrase);
  setTimeout(() => say(...Q.phrase), 250);
}
function traceClear() {
  if (!T) return;
  $('tink').getContext('2d').clearRect(0, 0, T.W, T.H);
  T.pts.forEach(p => p.hit = false); T.ink = 0; T.off = 0; T.last = null;
}
function traceDot(x, y) {
  const inZone = x >= 0 && y >= 0 && x < T.W && y < T.H && T.zone[((y | 0) * T.W + (x | 0)) * 4 + 3] > 128;
  T.ink++; if (!inZone) T.off++;
  const r2 = ((TR.BRUSH + 8) * T.k) ** 2;
  if (inZone) T.pts.forEach(p => { if (!p.hit && (p.x - x) ** 2 + (p.y - y) ** 2 < r2) p.hit = true; });
}
(() => {
  const ink = $('tink'), ctx = ink.getContext('2d');
  const local = ev => { const q = pt(ev), r = rectIn(ink); return { x: (q.x - r.x) * T.W / r.w, y: (q.y - r.y) * T.H / r.h }; };
  const seg = (a, b) => {
    ctx.strokeStyle = '#ff8a3d'; ctx.lineWidth = TR.BRUSH * 2 * T.k; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    const n = Math.max(1, Math.ceil(Math.hypot(b.x - a.x, b.y - a.y) / 6));
    for (let i = 1; i <= n; i++) traceDot(a.x + (b.x - a.x) * i / n, a.y + (b.y - a.y) * i / n);
  };
  ink.addEventListener('pointerdown', ev => {
    if (!T || Q.locked) return; capture(ink, ev);
    const p = local(ev); T.last = p; seg(p, p);
  });
  ink.addEventListener('pointermove', ev => { if (!T || !T.last || Q.locked) return; const p = local(ev); seg(T.last, p); T.last = p; });
  const up = () => {
    if (!T || !T.last) return; T.last = null;
    const cover = T.pts.filter(p => p.hit).length / T.pts.length, offR = T.off / T.ink;
    if (T.ink > 40 && offR > TR.MAXOFF) {          // scribbled mostly outside the letters
      answerQ($('tcard'), false); setTimeout(traceClear, 500); return;
    }
    if (cover >= TR.NEED) {
      drawGlyph($('tguide').getContext('2d'), T.ch, 'done');
      ctx.clearRect(0, 0, T.W, T.H);
      $('tcard').classList.add('ok');
      answerQ($('tcard'), true);
    }
  };
  ink.addEventListener('pointerup', up); ink.addEventListener('pointercancel', up);
  $('tclear').onclick = () => { sfx.pop(); traceClear(); };
})();
onTask('trace', startTrace);
