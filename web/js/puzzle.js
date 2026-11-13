// The jigsaw: a sticker picture cut into 4, 6 or 9 pieces, dragged from the tray onto the board.
import { $, pt, rectIn, capture } from './stage.js';
import { U } from './session.js';
import { S, save } from './state.js';
import { PZ_LEVELS, PZ_COLORS, WORD_INFO, ECON } from './data.js';
import { I } from './icons.js';
import { one, shuffle } from './util.js';
import { say, en, cheer, sfx } from './audio.js';
import { confetti, addCoins, IMGS } from './ui.js';
import { go } from './nav.js';
import { L, later, nextTask, dotsHtml, onTask } from './lessons.js';

/* ================= puzzle ================= */
let PZ = null;
function puzzleImage(emoji, bg, im) {
  const c = document.createElement('canvas'); c.width = c.height = 560;
  const x = c.getContext('2d');
  x.fillStyle = bg; x.fillRect(0, 0, 560, 560);
  x.fillStyle = 'rgba(255,255,255,.35)';
  for (let i = 0; i < 9; i++) { x.beginPath(); x.arc(Math.random()*560, Math.random()*560, 20 + Math.random()*40, 0, 7); x.fill(); }
  x.font = '400px "Segoe UI Emoji","Apple Color Emoji","Noto Color Emoji",sans-serif';
  x.fillStyle = '#000'; x.textAlign = 'center'; x.textBaseline = 'middle';   // opaque, or the emoji inherits the circles' transparency
  if (im && im.complete && im.naturalWidth) x.drawImage(im, 50, 50, 460, 460); else x.fillText(emoji, 280, 300);
  return c.toDataURL();
}
function startPuzzle(task) {
  if (U.current !== 'puzzle') go('puzzle');
  if (U.current !== 'puzzle') return;
  const li = task.level - 1;
  const [cols, rows, ghost] = PZ_LEVELS[li];
  const word = task.w, emoji = task.e || WORD_INFO[word].e;
  const art = !task.e && WORD_INFO[word] && WORD_INFO[word].img;
  const img = puzzleImage(emoji, one(PZ_COLORS), art && IMGS[art]);
  PZ = { word, emoji, level: task.level, left: cols * rows };
  $('lvl').innerHTML = I.star.repeat(task.level);
  $('pdots').innerHTML = dotsHtml();
  $('pname').classList.remove('on');
  const board = $('board'), tray = $('tray'), host = $('puzzle');
  board.querySelectorAll('.slot').forEach(e => e.remove());
  host.querySelectorAll('.piece').forEach(e => e.remove());
  $('ghost').style.backgroundImage = ghost ? `url(${img})` : 'none';
  const cw = 560 / cols, ch = 560 / rows, b = rectIn(board), t = rectIn(tray);
  const spots = [];
  for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) spots.push({ r, c });
  const n = spots.length, tcols = n <= 2 ? 1 : n <= 4 ? 2 : 3;
  const trows = Math.ceil(n / tcols), tw = (t.w - 40) / tcols, th = (t.h - 40) / trows;
  shuffle(spots).forEach((sp, i) => {
    const slot = document.createElement('div');
    slot.className = 'slot';
    // only the inner grid lines are dashed; the board itself is the rounded outer frame
    Object.assign(slot.style, { left: sp.c * cw + 'px', top: sp.r * ch + 'px', width: cw + 'px', height: ch + 'px',
      borderTopWidth: '0', borderLeftWidth: '0', borderRightWidth: sp.c < cols - 1 ? '' : '0', borderBottomWidth: sp.r < rows - 1 ? '' : '0' });
    board.appendChild(slot);
    const p = document.createElement('div');
    p.className = 'piece';
    const k = Math.min(1, (tw - 14) / cw, (th - 14) / ch);
    Object.assign(p.style, { width: cw + 'px', height: ch + 'px', backgroundImage: `url(${img})`,
      backgroundSize: '560px 560px', backgroundPosition: `${-sp.c * cw}px ${-sp.r * ch}px`, transform: `scale(${k})`, transformOrigin: '0 0' });
    const hx = t.x + 20 + (i % tcols) * tw + (tw - cw * k) / 2, hy = t.y + 20 + Math.floor(i / tcols) * th + (th - ch * k) / 2;
    p.style.left = hx + 'px'; p.style.top = hy + 'px';
    p._home = { x: hx, y: hy, k }; p._target = { x: b.x + sp.c * cw, y: b.y + sp.r * ch };
    // a corner piece takes the board's rounded corner once it snaps in
    const R = parseFloat(getComputedStyle(board).borderTopLeftRadius) || 0, top = sp.r === 0, bot = sp.r === rows - 1, lft = sp.c === 0, rgt = sp.c === cols - 1;
    p._radius = [top && lft, top && rgt, bot && rgt, bot && lft].map(on => (on ? R : 0) + 'px').join(' ');
    host.appendChild(p);
    dragPiece(p, Math.min(cw, ch));
  });
  say('Собери картинку!');
}
function dragPiece(p, cell) {
  let off = null;
  p.addEventListener('pointerdown', ev => {
    if (p._done) return;
    capture(p, ev);
    const q = pt(ev), x = parseFloat(p.style.left), y = parseFloat(p.style.top), k = p._home.k;
    p.classList.remove('back');
    off = { x: (q.x - x) / k, y: (q.y - y) / k };
    p.style.transform = 'scale(1)';
    p.style.left = (q.x - off.x) + 'px'; p.style.top = (q.y - off.y) + 'px';
    p.classList.add('drag'); sfx.pop();
  });
  p.addEventListener('pointermove', ev => {
    if (!off) return; const q = pt(ev);
    p.style.left = (q.x - off.x) + 'px'; p.style.top = (q.y - off.y) + 'px';
  });
  const up = () => {
    if (!off) return; off = null; p.classList.remove('drag');
    const x = parseFloat(p.style.left), y = parseFloat(p.style.top);
    if (Math.hypot(x - p._target.x, y - p._target.y) < cell * 0.4) {
      p._done = true; p.classList.add('snap'); p.style.borderRadius = p._radius;
      p.style.left = p._target.x + 'px'; p.style.top = p._target.y + 'px';
      sfx.snap(); PZ.left--;
      if (PZ.left === 0) setTimeout(puzzleDone, 400);
    } else {
      p.classList.add('back'); sfx.no();
      p.style.transform = `scale(${p._home.k})`;
      p.style.left = p._home.x + 'px'; p.style.top = p._home.y + 'px';
    }
  };
  p.addEventListener('pointerup', up); p.addEventListener('pointercancel', up);
}
function puzzleDone() {
  if (U.current !== 'puzzle') return;
  const gain = ECON.puzzle[Math.min(PZ.level, 3) - 1];
  S.stats.puzzles++; S.stats.tasks++; save();
  L.earned += gain;
  confetti(); sfx.ok(); say(cheer('Ура!'), en(PZ.word + '!'));
  const b = rectIn($('board'));
  $('board').animate([{ transform: 'scale(1)' }, { transform: 'scale(1.06) rotate(-2deg)' }, { transform: 'scale(1)' }], { duration: 600 });
  $('pname').textContent = PZ.word; $('pname').classList.add('on');
  addCoins(gain, { x: b.x + b.w / 2, y: b.y + b.h / 2 });
  later(nextTask, 2200);
}
onTask('puzzle', startPuzzle);
