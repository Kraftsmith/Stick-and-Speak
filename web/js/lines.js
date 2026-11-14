// Lines: coloured balls, one colour per word, gathered into one row (Specs/features/Lines.md).
// Every ball carries a letter of its word (no letters on difficulty 1, colours only). When all the balls of a colour stand
// side by side in a row or a column, they sort themselves into the word, the word is said and its picture shows.
// Level 2 (task.ci): a letter team is one ball, ship = [sh][i][p]. Order mode (task.order, level 3): the row counts only
// when the word reads right, left to right or top to bottom.
import { $, pt, rectIn, capture } from './stage.js';
import { U } from './session.js';
import { S, save, praise, learnedWords, learnedLetters, learnedChunks } from './state.js';
import { LINES_LEVELS, LINE_COLORS, ECON, LETTERS, THEMES, WORD_INFO, CHUNKS, picOf, emojiOf, chunkTiles } from './data.js';
import { I } from './icons.js';
import { shuffle, one } from './util.js';
import { say, ru, en, cheer, sfx } from './audio.js';
import { confetti, addCoins } from './ui.js';
import { go, onLeave } from './nav.js';
import { L, later, nextTask, dotsHtml, onTask } from './lessons.js';

// The board is as large as the height between the top bar and the dots allows (and never wider than AREA.w); the word
// cards stand right beside it and the two are centred together, so a wide phone has no empty band between them.
const AREA = { y: 120, w: 840, h: 590 }, CARDS_W = 210, CARDS_GAP = 46, FRAME_W = 1280;   // frame pixels
const SAY_GO = 'Собери шарики одного цвета в ряд!', SAY_ORDER = 'Поставь шарики по порядку, чтобы получилось слово!';
const HOP_MS = 400, IDLE_MS = 15000, TUT_IDLE_MS = 8000;

let G = null;   // the game on the screen
const wait = ms => new Promise(r => setTimeout(r, ms));
const alive = me => G === me && U.current === 'lines';
// the emoji of a word: lesson words, level-2 words, the example words of the letters
const EMO = {}; LETTERS.forEach(([, ws]) => ws.forEach(([w, e]) => { EMO[w] = e; }));
const emo = w => emojiOf(w) || EMO[w] || '⭐';

/* ================= the words of a game (Lines.md 6) ================= */
// 3–4 letters, one word ("teddy bear", "yo-yo" and "TV" do not fit); words with mistakes first inside each source
function pickWords(task, n, maxLen) {
  const err = S.stats.err || {};
  const weakFirst = ws => { const s = shuffle([...new Set(ws)]); return [...s.filter(w => err[w] > 0), ...s.filter(w => !(err[w] > 0))]; };
  const out = [];
  if (task.ci != null) {
    // level 2: the group's words, then words of learned teams, then any team met so far on the path; 3–4 balls each
    const words = ci => CHUNKS[ci][2].map(x => x[0]);
    const cols = [(task.cis || [task.ci]).flatMap(words), learnedChunks().flatMap(words), CHUNKS.slice(0, task.ci + 1).map((_, ci) => ci).flatMap(words)];
    for (const col of cols) for (const w of weakFirst(col)) {
      const k = chunkTiles(w, task.ci).length;
      if (out.length < n && k >= 3 && k <= maxLen && !out.includes(w)) out.push(w);
    }
    return out;
  }
  const fits = (w, m) => w.length >= 3 && w.length <= m && /^[a-z]+$/.test(w);
  const learned = learnedWords();
  const own = [
    task.li != null ? LETTERS[task.li][1].map(x => x[0]) : [],              // the letter's example words: S -> sun
    learned.filter(w => WORD_INFO[w] && WORD_INFO[w].theme === task.theme),  // this theme's learned words
    [...learned, ...learnedLetters().flatMap(li => LETTERS[li][1].map(x => x[0]))],
  ];
  const any = Object.values(THEMES).flat().map(x => x[0]);   // nothing learned yet (Testing): any level-1 word
  // level 1 prefers three letters; four only when there are not enough
  const passes = maxLen === 3 ? [[own, 3], [own, 4], [[any], 3], [[any], 4]] : [[own, maxLen], [[any], maxLen]];
  for (const [cols, m] of passes) for (const col of cols) for (const w of weakFirst(col))
    if (out.length < n && fits(w, m) && !out.includes(w)) out.push(w);
  return out;
}

/* ================= the board ================= */
const rc = k => [Math.floor(k / G.cols), k % G.cols];
const kOf = (r, c) => (r < 0 || c < 0 || r >= G.rows || c >= G.cols ? -1 : r * G.cols + c);
const xy = k => { const [r, c] = rc(k); return [c * G.cell, r * G.cell]; };
const T = (x, y) => `translate(${x}px, ${y}px)`;
const place = b => { b.el.style.transform = T(...xy(b.k)); };
const colourAt = k => (k >= 0 && G.at[k] ? G.at[k].w : null);
function cellAt(ev) {
  const q = pt(ev), g = rectIn($('lgrid'));
  const c = Math.floor((q.x - g.x) / G.cell), r = Math.floor((q.y - g.y) / G.cell);
  return kOf(r, c);
}

// the balls of a word: letters (capitals on level 1, small ones with order), or level-2 pieces with a team as one ball
const tilesOf = w => (G.ci != null ? chunkTiles(w, G.ci) : (G.lower ? w : w.toUpperCase()).split(''));
const ballsOf = A => A.tiles.map(ch => makeBall(A, ch));
function makeBall(A, ch) {
  const el = document.createElement('div');
  el.className = 'lb wait' + (ch.length > 1 ? ' two' : '');   // hidden until it lands on the board
  el.style.setProperty('--c', A.col[0]); el.style.setProperty('--t', A.col[1]);
  el.innerHTML = `<div class="lball"><i>${G.letters ? ch : ''}</i></div>`;
  $('lgrid').appendChild(el);
  const b = { w: A.w, ch, el, k: -1, A };
  A.balls.push(b);
  return b;
}
function addCard(A, fresh) {
  const c = document.createElement('div');
  c.className = 'lcard' + (fresh ? ' fresh' : '');
  c.style.setProperty('--c', A.col[0]);
  c.innerHTML = `<div class="lpicw">${picOf(A.w, emo(A.w))}</div><div class="lbar">${A.tiles.map(() => '<b></b>').join('')}</div>`;
  c.onclick = () => { if (G.tut === 'demo') return; sfx.pop(); say(en(A.w)); bounce(c); };
  $('lcards').appendChild(c);
  A.card = c;
}
const bounce = el => { el.classList.remove('bump'); void el.offsetWidth; el.classList.add('bump'); };
function bounceCards(gap = 900) { G.active.forEach((A, i) => { const me = G; setTimeout(() => { if (alive(me) && A.card) bounce(A.card); }, i * gap); }); }

// a new ball must not land in a row the child is building: next to two of one colour, or between two of one colour
function blocked(k) {
  const [r, c] = rc(k);
  return [[0, 1], [1, 0]].some(([dr, dc]) => {
    const at = s => colourAt(kOf(r + dr * s, c + dc * s));
    const same = (a, b) => a && a === b;
    return same(at(1), at(2)) || same(at(-1), at(-2)) || same(at(-1), at(1));
  });
}
const freeCells = () => G.at.map((b, k) => (b ? -1 : k)).filter(k => k >= 0);
function drop(b, k, grow) {
  b.k = k; G.at[k] = b; place(b); b.el.classList.remove('wait');
  if (grow) { b.el.classList.add('grow'); sfx.plop(); }
}
// the balls of the first words: scattered so that no two of one colour stand side by side and no word is made
function scatter(balls) {
  const n = G.cols * G.rows;
  for (let t = 0; t < 300; t++) {
    const cells = shuffle([...Array(n).keys()]).slice(0, balls.length);
    const w = {}; cells.forEach((k, i) => { w[k] = balls[i].w; });
    const touching = cells.some(k => { const [r, c] = rc(k); return [kOf(r, c + 1), kOf(r + 1, c)].some(m => m >= 0 && w[m] === w[k]); });
    if (touching && t < 250) continue;
    balls.forEach((b, i) => drop(b, cells[i], false));
    if (!made().length) return;
    balls.forEach(b => { G.at[b.k] = null; b.k = -1; });
  }
  balls.forEach((b, i) => drop(b, freeCells()[0], false));   // never reached on these boards
}
function enterWord(fresh) {
  const w = G.queue.shift(), tiles = tilesOf(w), A = { w, tiles, n: tiles.length, col: G.colours.shift(), balls: [] };
  G.active.push(A); addCard(A, fresh);
  return A;
}
// after a move that made no word: new balls of the next word in the queue
function spawn(n) {
  for (let i = 0; i < n; i++) {
    if (!G.buf.length) {
      if (!G.queue.length) return;
      const A = enterWord(true); say(en(A.w));
      G.buf = shuffle(ballsOf(A));
    }
    const free = freeCells().filter(k => !(G.hint && G.hint.k === k)), ok = free.filter(k => !blocked(k));
    if (!free.length) return;
    const b = G.buf.shift(); drop(b, one(ok.length ? ok : free), true);
  }
}
// all the balls of a word stand side by side in one row or one column
function lined(A) {
  if (A.balls.length < A.n || A.balls.some(b => b.k < 0)) return false;
  const p = A.balls.map(b => rc(b.k)), rs = p.map(x => x[0]), cs = p.map(x => x[1]);
  const span = a => Math.max(...a) - Math.min(...a);
  return (span(rs) === 0 && span(cs) === A.n - 1) || (span(cs) === 0 && span(rs) === A.n - 1);
}
// the word reads right: left to right in a row, top to bottom in a column
const inOrder = A => A.balls.slice().sort((a, b) => a.k - b.k).every((b, i) => b.ch === A.tiles[i]);
// the words that are made (with order: lined up and reading right)
const made = () => G.active.filter(A => lined(A) && (!G.order || inOrder(A)));

/* ================= a game ================= */
function startLines(task) {
  if (U.current !== 'lines') go('lines');
  if (U.current !== 'lines') return;
  const lv = Math.min(task.level, LINES_LEVELS.length), V = LINES_LEVELS[lv - 1];
  const words = pickWords(task, V.words, V.maxLen);
  const cell = Math.min(Math.floor(AREA.w / V.cols), Math.floor(AREA.h / V.rows));
  const x0 = Math.round((FRAME_W - (CARDS_W + CARDS_GAP + cell * V.cols)) / 2);   // the left edge of the cards
  G = { level: lv, cols: V.cols, rows: V.rows, cell, letters: V.letters || task.ci != null || !!task.order, ci: task.ci, order: !!task.order,
        lower: task.ci != null || !!task.order, start: V.start, spawnN: V.spawn, hintAfter: V.hint,
        at: Array(V.cols * V.rows).fill(null), queue: words.slice(), colours: shuffle(LINE_COLORS), active: [], buf: [],
        total: words.length, done: 0, sel: null, lock: true, noWord: 0, hint: null, idle: 0, tut: !S.stats.lines ? 'demo' : null };
  $('lspk').innerHTML = I.speaker;
  $('llvl').innerHTML = I.star.repeat(lv);
  $('ldots').innerHTML = dotsHtml();
  $('lcards').innerHTML = '';
  const g = $('lgrid');
  g.innerHTML = '';
  Object.assign(g.style, { width: cell * V.cols + 'px', height: cell * V.rows + 'px',
    left: x0 + CARDS_W + CARDS_GAP + 'px', top: AREA.y + (AREA.h - cell * V.rows) / 2 + 'px' });
  $('lcards').style.left = x0 + 'px';
  g.style.setProperty('--cell', cell + 'px');
  for (let k = 0; k < V.cols * V.rows; k++) { const c = document.createElement('div'); c.className = 'lcell'; const [x, y] = xy(k); c.style.transform = T(x, y); g.appendChild(c); }
  // the first words are on the board from the start (on level 1 all of them; nothing falls there)
  const first = [];
  while (G.active.length < V.start && G.queue.length) first.push(...ballsOf(enterWord(false)));
  scatter(first);
  const go1 = G.order ? SAY_ORDER : SAY_GO;
  $('lspk').onclick = () => { if (G.tut !== 'demo') { say(ru(go1)); bounceCards(); } };
  const me = G;
  (async () => {
    // the instruction, then each card bounces while its word is said (paced by the voice, not by a timer; at least
    // a short pause each when the sound is off)
    await Promise.all([say(ru(go1)), wait(900)]); if (!alive(me)) return;
    for (const A of G.active.slice()) {
      if (A.card) bounce(A.card);
      await Promise.all([say(en(A.w)), wait(700)]); if (!alive(me)) return;
    }
    await wait(300); if (!alive(me)) return;
    if (G.tut) await demo(me); if (!alive(me)) return;
    G.lock = false; idle();
  })();
}

/* ---- the child's very first game: a hand shows one move (Lines.md 4.1, step 2) ---- */
function showMove() {
  for (const A of shuffle(G.active)) for (const anchor of A.balls) {
    const [r, c] = rc(anchor.k);
    for (const t of [kOf(r, c + 1), kOf(r, c - 1), kOf(r + 1, c), kOf(r - 1, c)]) {
      if (t < 0 || G.at[t]) continue;
      const mover = A.balls.find(b => b !== anchor);
      if (mover) return { ball: mover, k: t };
    }
  }
  return null;
}
function hand(k) {
  let h = $('lhand');
  if (!h) { h = document.createElement('div'); h.id = 'lhand'; h.className = 'lhand'; h.textContent = '👆'; $('lgrid').appendChild(h); }
  const [x, y] = xy(k); h.style.transform = T(x + G.cell * .35, y + G.cell * .45); h.classList.add('on');
}
const handOff = () => { const h = $('lhand'); if (h) h.classList.remove('on'); };
async function demo(me, moveIt = true) {
  const m = showMove(); if (!m) { G.tut = null; return; }
  G.lock = true;
  hand(m.ball.k); await say(ru('Нажми на шарик!')); await wait(500); if (!alive(me)) return;
  select(m.ball); hand(m.k); await say(ru('А теперь — куда его поставить!')); await wait(500); if (!alive(me)) return;
  handOff();
  if (moveIt) {
    await hop(m.ball, m.k, true); if (!alive(me)) return;
    if (made().length) { G.tut = null; await afterMove(me); return; }   // the shown move happened to make a word
  }
  else select(null);
  G.tut = 'watch'; G.lock = false;
}

/* ---- input: tap a ball, tap a free cell; or drag the ball there ---- */
let press = null;
function select(b) {
  if (G.sel) G.sel.el.classList.remove('sel');
  G.sel = b; if (b) b.el.classList.add('sel');
}
function down(ev) {
  if (!G || G.lock) return;
  touched();
  const k = cellAt(ev); if (k < 0) return;
  const b = G.at[k];
  if (b) { capture($('lgrid'), ev); const q = pt(ev); press = { b, x: q.x, y: q.y, drag: false }; return; }
  if (G.sel) hop(G.sel, k, true);
}
function moveP(ev) {
  if (!press || !G) return;
  const q = pt(ev);
  if (!press.drag && Math.hypot(q.x - press.x, q.y - press.y) > 18) { press.drag = true; select(press.b); press.b.el.classList.add('drag'); sfx.pop(); }
  if (press.drag) { const g = rectIn($('lgrid')); press.b.el.style.transform = T(q.x - g.x - G.cell / 2, q.y - g.y - G.cell / 2); }
}
function up(ev) {
  if (!press || !G) return;
  const { b, drag } = press; press = null;
  if (drag) {
    b.el.classList.remove('drag');
    const k = cellAt(ev);
    if (k >= 0 && !G.at[k] && !G.lock) hop(b, k, false); else { place(b); select(null); }
  } else if (G.sel === b) select(null);
  else { select(b); sfx.pop(); }
}
async function hop(b, k, jump) {
  const me = G, from = xy(b.k), to = xy(k);
  G.lock = true; select(null);
  G.at[b.k] = null; b.k = k; G.at[k] = b;
  if (G.hint && G.hint.k === k) clearHint();
  if (jump) {
    sfx.hop();
    const mid = [(from[0] + to[0]) / 2, (from[1] + to[1]) / 2 - Math.min(90, 30 + Math.hypot(to[0] - from[0], to[1] - from[1]) / 4)];
    b.el.animate([{ transform: T(...from) }, { transform: T(...mid) + ' scale(1.08)', offset: .5 }, { transform: T(...to) }], { duration: HOP_MS, easing: 'ease-in-out' });
  } else sfx.snap();
  place(b);
  await wait(jump ? HOP_MS + 20 : 120); if (!alive(me)) return;
  if (G.tut === 'demo') return;   // the demo move: only shows how
  await afterMove(me);
}
async function afterMove(me) {
  let got = made();
  if (!got.length) {
    spawn(G.spawnN);
    if (G.spawnN) { await wait(380); if (!alive(me)) return; }
    got = made();
  }
  if (got.length) {
    G.noWord = 0;
    for (const A of got) { await collect(A, me); if (!alive(me)) return; }
    if (G.done >= G.total) return linesDone();
    // the board ran empty before the next word came: it comes now, whole
    if (!G.at.some(Boolean)) {
      const fresh = G.buf.splice(0);   // the balls of a word that had started to fall
      while (G.active.length < G.start && G.queue.length) fresh.push(...ballsOf(enterWord(true)));
      scatter(fresh); fresh.forEach(b => b.el.classList.add('grow')); sfx.plop();
      say(...G.active.map(A => en(A.w)));
    }
  } else {
    if (G.order) { await wrongOrder(me); if (!alive(me)) return; }
    if (++G.noWord >= G.hintAfter) linesHint();
  }
  G.lock = false; idle();
}
// order mode: a row of one colour that does not read right. The balls in their right place glow, the others wobble,
// the word is said. Once for each new arrangement, not after every move.
async function wrongOrder(me) {
  for (const A of G.active) {
    if (!lined(A) || inOrder(A)) { A.wrong = null; continue; }
    const key = A.balls.map(b => b.k).join();
    if (A.wrong === key) continue;
    A.wrong = key;
    sfx.no();
    const sorted = A.balls.slice().sort((a, b) => a.k - b.k);
    sorted.forEach((b, i) => {
      if (b.ch === A.tiles[i]) b.el.classList.add('glow');
      else { const inner = b.el.firstChild; inner.classList.remove('wob'); void inner.offsetWidth; inner.classList.add('wob'); }
    });
    await say(en(A.w)); await wait(400);
    sorted.forEach(b => b.el.classList.remove('glow'));
    if (!alive(me)) return;
  }
}

/* ---- a word is made: sort into spelling order, light the letters, say it, show the picture, pop ---- */
async function collect(A, me) {
  if (G.hint && G.hint.w === A.w) clearHint();
  const cells = A.balls.map(b => b.k).sort((a, b) => a - b), left = A.balls.slice();
  const ordered = A.tiles.map(ch => left.splice(left.findIndex(b => b.ch === ch), 1)[0]);
  ordered.forEach((b, i) => { b.k = cells[i]; G.at[cells[i]] = b; b.el.classList.add('slide'); place(b); });
  await wait(600); if (!alive(me)) return;
  if (G.letters) for (const b of ordered) { b.el.classList.add('lit'); sfx.tick(); await wait(260); if (!alive(me)) return; }
  sfx.ok(); say(en(A.w + '!'));
  // the picture above the row (beside a column), inside the board
  const [x0, y0] = xy(cells[0]), [x1, y1] = xy(cells[cells.length - 1]), P = 200;
  const pic = document.createElement('div');
  pic.className = 'lshow';
  // the caption as the balls spell it; a letter team stands out
  const cap = A.tiles.map(t => (t.length > 1 ? `<em>${t}</em>` : t)).join('');
  pic.innerHTML = `<div class="lpicw">${picOf(A.w, emo(A.w))}</div>${G.letters ? `<b>${cap}</b>` : ''}`;
  // never on top of the word: above or below a row, beside a column, on the side with more room
  const cx = (x0 + x1 + G.cell) / 2, cy = (y0 + y1 + G.cell) / 2, bw = G.cell * G.cols, bh = G.cell * G.rows, H = P + 56;
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  let px, py;
  if (y0 === y1) { px = clamp(cx - P / 2, 0, bw - P); py = clamp(y0 >= bh - y1 - G.cell ? y0 - H - 6 : y1 + G.cell + 6, -110, bh - H + 40); }
  else { px = x0 + G.cell + P + 12 <= bw ? x0 + G.cell + 12 : x0 - P - 12; py = clamp(cy - H / 2, 0, bh - H); }
  pic.style.transform = T(px, py); $('lgrid').appendChild(pic);
  ordered.forEach(b => b.el.classList.add('glow'));
  await wait(1200); if (!alive(me)) return;
  sfx.burst();
  ordered.forEach(b => { b.el.classList.add('burst'); G.at[b.k] = null; });
  A.card.classList.add('got');
  await wait(450); if (!alive(me)) return;
  ordered.forEach(b => b.el.remove()); pic.classList.add('away');
  await wait(450); if (!alive(me)) return;
  pic.remove(); A.card.classList.add('gone');
  const c = A.card; setTimeout(() => c.remove(), 400);
  G.active = G.active.filter(x => x !== A); G.done++;
}

/* ---- help: a ball wobbles and the free cell of its row is ringed (Lines.md 4.2) ---- */
function linesHint() {
  G.noWord = G.hintAfter - 3;   // the next hint three moves later
  let best = null;
  for (const A of G.active) {
    if (A.balls.length < A.n || A.balls.some(b => b.k < 0)) continue;
    const segs = [];
    for (let r = 0; r < G.rows; r++) for (let c = 0; c + A.n <= G.cols; c++) segs.push([...Array(A.n)].map((_, i) => kOf(r, c + i)));
    for (let c = 0; c < G.cols; c++) for (let r = 0; r + A.n <= G.rows; r++) segs.push([...Array(A.n)].map((_, i) => kOf(r + i, c)));
    for (const s of shuffle(segs)) {
      // with order a ball of the word in the wrong place of the segment is in the way too
      if (s.some((k, i) => G.at[k] && (G.at[k].w !== A.w || (G.order && G.at[k].ch !== A.tiles[i])))) continue;
      const own = s.filter(k => G.at[k]).length;
      if (own < A.n && (!best || own > best.own)) best = { A, s, own };
    }
  }
  if (!best) { bounceCards(400); return; }
  const i = best.s.findIndex(x => !G.at[x]), k = best.s[i];
  // the ball for that cell: with order the one with the right letter
  const b = best.A.balls.find(x => !best.s.includes(x.k) && (!G.order || x.ch === best.A.tiles[i]));
  clearHint();
  const ring = document.createElement('div');
  ring.className = 'lring'; ring.style.setProperty('--c', best.A.col[0]); ring.style.transform = T(...xy(k));
  $('lgrid').insertBefore(ring, $('lgrid').querySelector('.lb'));
  G.hint = { k, w: best.A.w, el: ring };
  const inner = b.el.firstChild; inner.classList.remove('wob'); void inner.offsetWidth; inner.classList.add('wob');
  say(ru('Посмотри, вот здесь!'));
}
function clearHint() { if (G && G.hint) { G.hint.el.remove(); G.hint = null; } }

/* ---- nothing touched for a while: the instruction again (in the first game: the hand again, sooner) ---- */
function touched() { if (G && G.tut === 'watch') G.tut = null; handOff(); idle(); }
function idle() {
  if (!G) return;
  clearTimeout(G.idle);
  const me = G, tut = G.tut === 'watch';
  G.idle = setTimeout(() => {
    if (!alive(me) || G.lock) return idle();
    if (tut) demo(me, false).then(() => alive(me) && idle());
    else { say(ru(G.order ? SAY_ORDER : SAY_GO)); bounceCards(400); idle(); }
  }, tut ? TUT_IDLE_MS : IDLE_MS);
}

function linesDone() {
  if (U.current !== 'lines') return;
  clearTimeout(G.idle);
  const gain = ECON.lines[Math.min(G.level, 3) - 1];
  S.stats.lines = (S.stats.lines || 0) + 1; S.stats.linesWords = (S.stats.linesWords || 0) + G.total; S.stats.tasks++; save();
  L.earned += gain;
  confetti(); sfx.ok(); say(cheer(praise()));
  addCoins(gain, { x: 790, y: 420 });
  later(nextTask, 2200);
}

const grid = $('lgrid');
grid.addEventListener('pointerdown', down);
grid.addEventListener('pointermove', moveP);
grid.addEventListener('pointerup', up);
grid.addEventListener('pointercancel', () => { if (press && G) { press.b.el.classList.remove('drag'); place(press.b); select(null); } press = null; });
onLeave(() => { if (G) clearTimeout(G.idle); press = null; });
onTask('lines', startLines);
