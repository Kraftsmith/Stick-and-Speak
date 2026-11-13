// Pairs: the memory game (SPEC 3.4.1, Specs/features/pairs.md).
import { $ } from './stage.js';
import { U } from './session.js';
import { S, save, praise } from './state.js';
import { MEM_LEVELS, ECON, picOf, emojiOf } from './data.js';
import { I, CARD_BACK } from './icons.js';
import { shuffle, one } from './util.js';
import { say, ru, en, cheer, sfx } from './audio.js';
import { confetti, addCoins } from './ui.js';
import { go } from './nav.js';
import { L, later, nextTask, dotsHtml, onTask } from './lessons.js';

/* ================= pairs: the memory game (SPEC 3.4.1, Specs/features/pairs.md) ================= */
let M = null;
function startPairs(task) {
  if (U.current !== 'pairs') go('pairs');
  if (U.current !== 'pairs') return;
  const [cols, rows, preview] = MEM_LEVELS[Math.min(task.level, MEM_LEVELS.length) - 1];
  // the lesson's own words first (shuffled), then the fallback list, no repeats
  const words = [...new Set([...shuffle(task.words), ...shuffle(task.more)])].slice(0, cols * rows / 2);
  M = { level: task.level, left: words.length, open: [], lock: true, missRun: 0 };
  $('mspk').innerHTML = I.speaker;
  $('mlvl').innerHTML = I.star.repeat(task.level);
  $('mdots').innerHTML = dotsHtml();
  const g = $('mgrid'), cw = Math.min(250, Math.floor((1040 - 24 * (cols - 1)) / cols), Math.floor((580 - 24 * (rows - 1)) / rows));
  g.style.setProperty('--cw', cw + 'px'); g.style.gridTemplateColumns = `repeat(${cols}, ${cw}px)`;
  g.innerHTML = '';
  shuffle(words.flatMap(w => [w, w])).forEach(w => {
    const c = document.createElement('div');
    c.className = 'mcard'; c.dataset.w = w;
    c.innerHTML = `<div class="in"><div class="b">${CARD_BACK}</div><div class="f">${picOf(w, emojiOf(w))}</div></div>`;
    c.onclick = () => flipCard(c);
    g.appendChild(c);
  });
  const phrase = [ru('Найди парочки!')];
  $('mspk').onclick = () => say(...phrase);
  const begin = () => { say(...phrase); later(() => { M.lock = false; }, 400); };
  if (preview) {   // levels 1–2: show every card first, then turn them over
    say(ru('Запомни!'));
    later(() => g.querySelectorAll('.mcard').forEach(c => c.classList.add('open')), 300);
    later(() => { g.querySelectorAll('.mcard').forEach(c => c.classList.remove('open')); begin(); }, 300 + preview);
  } else begin();
}
function flipCard(c) {
  if (!M || M.lock || c.classList.contains('open') || c.classList.contains('done')) return;
  const w = c.dataset.w;
  c.classList.add('open'); c._seen = true; sfx.pop(); M.open.push(c);
  if (M.open.length < 2) { say(en(w)); return; }
  const [a, b] = M.open; M.open = []; M.lock = true;
  if (a.dataset.w === b.dataset.w) {
    M.missRun = 0; M.left--;
    a.classList.remove('open'); b.classList.remove('open'); a.classList.add('done'); b.classList.add('done');
    sfx.ok(); say(en(w + '!'));
    if (M.left === 0) later(pairsDone, 600); else later(() => { M.lock = false; }, 500);
  } else {
    // not a mistake: a card never seen cannot be known, so no coins are lost and the gold star stays
    M.missRun++; say(en(w));
    later(() => {
      a.classList.remove('open'); b.classList.remove('open'); sfx.miss(); M.lock = false;
      if (M.missRun >= 3) pairsHint();
    }, 1000);
  }
}
// after three misses in a row: wobble both cards of an unfound pair, preferably one the child has already seen
function pairsHint() {
  M.missRun = 0;
  const cards = [...$('mgrid').querySelectorAll('.mcard:not(.done)')];
  const byWord = {}; cards.forEach(c => (byWord[c.dataset.w] = byWord[c.dataset.w] || []).push(c));
  const pairs = Object.values(byWord), seen = pairs.filter(p => p.every(c => c._seen));
  const p = one(seen.length ? seen : pairs);
  p.forEach(c => { c.classList.remove('wob'); void c.offsetWidth; c.classList.add('wob'); });
  say(ru('Посмотри, вот здесь!'));
}
function pairsDone() {
  if (U.current !== 'pairs') return;
  const gain = ECON.pairs[Math.min(M.level, 3) - 1];
  S.stats.pairs = (S.stats.pairs || 0) + 1; S.stats.tasks++; save();
  L.earned += gain;
  confetti(); sfx.ok(); say(cheer(praise()));
  addCoins(gain, { x: 640, y: 420 });
  later(nextTask, 2200);
}
onTask('pairs', startPairs);
