// The race: two cars on a straight road, a gas button, two lanes, word gates with coins (Specs/features/racing.md).
import { $, pt } from './stage.js';
import { U } from './session.js';
import { S, save, praise } from './state.js';
import { RACE, RACE_LEVELS, ECON, CHUNK_WORD, picOf, emojiOf } from './data.js';
import { I } from './icons.js';
import { RACE_ART } from './gen/art.js';
import { shuffle, one } from './util.js';
import { say, ru, en, cheer, sfx, engine } from './audio.js';
import { confetti, addCoins } from './ui.js';
import { go, onLeave } from './nav.js';
import { L, later, nextTask, dotsHtml, onTask } from './lessons.js';

/* ---- the picture: everything is in stage pixels; the road is 520 wide and starts at x = 380 ---- */
const ROAD_X = 380, CAR_Y = 500, CAR_H = 200;   // the child's car stays here, the road scrolls under it
const LANE_X = [70, 330];                       // left edge of a car in the left and the right lane, inside the road
const TAP = .2, FADE = 1.2;                      // one tap: a fifth of the way from rest to top; the extra speed fades with this time constant, s
const GLIDE = 1040;                             // lane change: 260 px in a quarter of a second
let GATE_TOP = 14;   // a gate far ahead waits here; lower with the artwork gate, whose beam and flags stand above the signs
const COIN_TOP = 130;            // a gate or a coin still far ahead waits here, at the top of the screen
const ICON_GAS = '<svg viewBox="0 0 100 100" aria-hidden="true"><path d="M50 16 L84 54 H63 V84 H37 V54 H16 Z" fill="#fff" stroke="#fff" stroke-width="8" stroke-linejoin="round"/></svg>';
const car = (body, dark, glass) => `<svg viewBox="0 0 120 200" aria-hidden="true">
  <g fill="#3c3a45"><rect x="4" y="32" width="18" height="40" rx="7"/><rect x="98" y="32" width="18" height="40" rx="7"/>
    <rect x="4" y="132" width="18" height="40" rx="7"/><rect x="98" y="132" width="18" height="40" rx="7"/></g>
  <rect x="14" y="6" width="92" height="188" rx="34" fill="${dark}"/>
  <rect x="14" y="2" width="92" height="186" rx="34" fill="${body}"/>
  <path d="M28 62 Q60 44 92 62 L86 88 H34 Z" fill="${glass}"/>
  <path d="M34 140 H86 L90 158 Q60 168 30 158 Z" fill="${glass}"/>
  <rect x="34" y="92" width="52" height="44" rx="12" fill="#ffffff55"/>
  <circle cx="34" cy="20" r="8" fill="#fff6c9"/><circle cx="86" cy="20" r="8" fill="#fff6c9"/>
  <path d="M56 8 h8 v36 h-8 z" fill="#ffffff66"/>
</svg>`;

// sticker-style artwork from app/art.js (img/race/<name>.png) where it exists; else the SVG car and the CSS gate above
const hasArt = n => (RACE_ART || []).includes(n);
const carPic = (name, ...svg) => hasArt(name) ? `<img class="rimg" src="img/race/${name}.png" alt="" draggable="false">` : car(...svg);

let R = null, raf = 0;
const put = (el, x, y) => { el.style.transform = `translate(${x}px, ${y}px)`; };
const carLane = () => (R.x < (LANE_X[0] + LANE_X[1]) / 2 ? 0 : 1);
// only while this race is still the one on the screen
const soon = (fn, ms) => { const me = R; later(() => { if (R === me) fn(); }, ms); };

function stopRace() { cancelAnimationFrame(raf); raf = 0; engine.stop(); R = null; }
onLeave(stopRace);

/* ================= building a race ================= */
function startRace(task) {
  if (U.current !== 'race') go('race');
  if (U.current !== 'race') return;
  stopRace();
  const lv = Math.min(task.level, RACE_LEVELS.length), [gates, think, farDecoy, boost] = RACE_LEVELS[lv - 1];
  // the first coin lies on the road with no gate: on level 1, and in a child's very first race instead of one gate
  const lead = lv === 1 || !S.stats.races, nGates = lv === 1 ? gates : gates - (lead ? 1 : 0);
  // words with mistakes first, then the lesson's other words, then the fallback list; no repeats
  const own = shuffle(task.words), weak = own.filter(w => S.stats.err[w] > 0);
  const words = [...new Set([...weak, ...own, ...shuffle(task.more)])].slice(0, nGates);
  const sameTeam = (a, b) => CHUNK_WORD[a] && CHUNK_WORD[b] && CHUNK_WORD[a].ci === CHUNK_WORD[b].ci;
  const wrongFor = w => {
    const all = [...new Set([...task.words, ...task.more])];
    const pool = (farDecoy && task.far.length ? task.far : all).filter(x => x !== w && !sameTeam(x, w));
    return one(pool.length ? pool : all.filter(x => x !== w));
  };
  const n = words.length + (lead ? 1 : 0), items = [];
  let side = one([0, 1]), run = 0;
  for (let i = 0; i < n; i++) {
    const d = RACE.len * (.14 + .74 * i / (n - 1));
    if (lead && i === 0) { items.push({ kind: 'coin', d, state: 'far' }); continue; }
    const s = run >= 2 ? 1 - side : one([0, 1]);          // never three gates in a row on one side
    run = s === side ? run + 1 : 1; side = s;
    const w = words[i - (lead ? 1 : 0)];
    items.push({ kind: 'gate', d, lane: s, w, wrong: wrongFor(w), state: 'far' });
  }
  const top = RACE.top * boost;
  R = { lv, think, top, rest: RACE.rest, len: RACE.len, items, phase: 'wait', t: 0, last: performance.now(),
    d: 0, v: 0, kick: 0, lane: 1, x: LANE_X[1], taps: 0, got: 0, missRun: 0, cur: null,
    rd: 0, rlane: 0, rx: LANE_X[0], rnext: 3, won: null, doneAt: 0 };

  $('rspk').innerHTML = I.speaker; $('rgas').innerHTML = ICON_GAS;
  $('rlvl').innerHTML = I.star.repeat(lv);
  $('rdots').innerHTML = dotsHtml();
  $('rme').innerHTML = carPic('car-red', '#f0694c', '#b8452f', '#3f4a66'); $('rrival').innerHTML = carPic('car-blue', '#5b9be0', '#3a6fae', '#3f4a66');
  $('race').classList.toggle('art-gate', hasArt('gate-bar')); GATE_TOP = hasArt('gate-bar') ? 86 : 14; $('race').classList.toggle('art-sign', hasArt('sign'));
  $('rgates').innerHTML = ''; $('rthings').innerHTML = ''; $('rcount').textContent = '';
  items.forEach(it => {
    const el = document.createElement('div');
    if (it.kind === 'gate') {
      el.className = 'rgate';
      el.innerHTML = [0, 1].map(s => { const w = s === it.lane ? it.w : it.wrong;
        return `<div class="rsign${s === it.lane ? ' right' : ''}">${picOf(w, emojiOf(w))}<span class="tip">${I.coin}</span></div>`; }).join('');
      $('rgates').appendChild(el);
    } else {
      el.className = 'rcoin'; el.innerHTML = I.coin + '<i>👆</i>';
      $('rthings').appendChild(el);
    }
    it.el = el;
  });
  const intro = [ru('Жми на кнопку, чтобы ехать быстрее!'), ru('Собирай монеты!')];
  $('rspk').onclick = () => { if (R && R.cur) say(en(R.cur.w)); else say(...intro); };
  $('rgas').classList.add('wait');
  draw();
  raf = requestAnimationFrame(frame);
  // the instruction, then "Three, two, one, go!" with the numbers on the screen
  say(...intro);
  const wait = S.hints && !S.mute && S.voiceVol ? 3900 : 600;
  [['3', 'Three!'], ['2', 'Two!'], ['1', 'One!']].forEach(([c, t], i) => soon(() => count(c, t), wait + i * 850));
  soon(() => { count('GO!', 'Go!'); $('rgas').classList.remove('wait'); R.phase = 'run'; R.v = R.rest; }, wait + 3 * 850);
  soon(() => { $('rcount').textContent = ''; }, wait + 3 * 850 + 900);
}
function count(c, t) {
  const el = $('rcount'); el.textContent = c;
  el.classList.remove('go'); void el.offsetWidth; el.classList.add('go');
  sfx.pop(); say(en(t));
}

/* ================= controls ================= */
function gas() {
  if (!R || R.phase !== 'run') return;
  R.v = Math.min(R.top, R.v + TAP * (R.top - R.rest)); R.taps++; R.kick = 1;
  sfx.gas();
}
function setLane(l) {
  if (!R || R.phase === 'done' || R.lane === l) return;
  R.lane = l; sfx.snap();
}
// the gas button and the road listen on their own, so two hands work at once
$('rgas').addEventListener('pointerdown', ev => { ev.preventDefault(); $('rgas').classList.add('press'); gas(); });
['pointerup', 'pointercancel', 'pointerleave'].forEach(t => $('rgas').addEventListener(t, () => $('rgas').classList.remove('press')));
// a tap on a half of the road, or a finger dragged across it, moves the car to that lane
const steer = ev => setLane(pt(ev).x < ROAD_X + 260 ? 0 : 1);
$('road').addEventListener('pointerdown', ev => { ev.preventDefault(); steer(ev); });
$('road').addEventListener('pointermove', ev => { if (ev.pointerType !== 'mouse' || ev.buttons) steer(ev); });
// a keyboard, for checking in a desktop browser
addEventListener('keydown', ev => {
  if (U.current !== 'race' || !R) return;
  if (ev.key === 'ArrowLeft') setLane(0);
  else if (ev.key === 'ArrowRight') setLane(1);
  else if ((ev.key === ' ' || ev.key === 'ArrowUp') && !ev.repeat) gas();
  else return;
  ev.preventDefault();
});

/* ================= one frame ================= */
const glide = (x, to, dt) => (x < to ? Math.min(to, x + GLIDE * dt) : Math.max(to, x - GLIDE * dt));
function frame(now) {
  if (!R) return;
  raf = requestAnimationFrame(frame);
  const dt = Math.min(.1, Math.max(0, (now - R.last) / 1000)); R.last = now;
  if (R.phase === 'wait') return;
  R.t += dt;
  // the child's car: every tap adds speed, and the extra speed melts away on its own, the faster the more there is of it.
  // So the speed follows how often the button is tapped: about 1 tap a second is a quarter of the way to the top, 4–5 is the top.
  if (R.phase === 'run') R.v = R.rest + (R.v - R.rest) * Math.exp(-dt / FADE);
  else R.v = Math.max(0, R.v - 900 * dt);
  R.d += R.v * dt;
  R.x = glide(R.x, LANE_X[R.lane], dt); R.kick = Math.max(0, R.kick - dt * 5);
  rival(dt);
  R.items.forEach(step);
  if (R.phase === 'run') { engine.start(); engine.set((R.v - R.rest) / (R.top - R.rest)); }
  if (R.phase === 'run' && R.d >= R.len) finish();
  draw();
  if (R.phase === 'done' && R.t > R.doneAt + 3) { cancelAnimationFrame(raf); raf = 0; }   // both cars have stopped
}
// The other car keeps close to the child (never much more than a screen ahead or behind), gives way, takes no coins.
// A child who taps the gas at all is not overtaken on the last third of the road.
function rival(dt) {
  const gap = R.rd - R.d;
  let v = R.rest + (R.top - R.rest) * (.5 + .12 * Math.sin(R.t * .6));
  if (gap > 420) v = Math.min(v, R.v * .9);
  if (gap < -420) v = Math.max(v, R.v * 1.12);
  if (R.d > R.len * 2 / 3 && R.taps >= 8) v = Math.min(v, R.v * .85);
  if (R.phase === 'wait') v = 0;
  if (R.won === null && R.rd >= R.len) R.won = false;
  // past the line it rolls to a stop: ahead of the child if it came first, just over the line if not
  const park = R.len + (R.won === false ? 330 : 30);
  if (R.won !== null) v = Math.min(Math.max(v, 200), Math.max(0, (park - R.rd) * 3));
  R.rd += v * dt;
  const near = Math.abs(gap) < CAR_H + 50;
  R.rnext -= dt;
  if (near && R.rlane === R.lane) R.rlane = 1 - R.lane;
  else if (!near && R.rnext <= 0 && R.won === null) { R.rlane = 1 - R.rlane; R.rnext = 3 + Math.random() * 4; }
  R.rx = glide(R.rx, LANE_X[R.rlane], dt);
}
// a gate or a coin: far ahead → shown and waiting at the top → passed
function step(it) {
  const dist = it.d - R.d;
  if (it.state === 'far') {
    // shown early enough to choose a lane even if the child speeds up right after
    it.lead = (it.kind === 'gate' ? R.think : 2.4) * (R.v + R.top) / 2;
    if (dist > it.lead) return;
    it.state = 'on'; it.el.classList.add('on');
    if (it.kind === 'gate') {
      R.cur = it; say(en(it.w));
      if (R.missRun >= 2) { R.missRun = 0; it.el.classList.add('hint'); }   // two coins missed in a row: show where the coin is
    } else it.lane = 1 - R.lane;   // the first coin lies in the other lane, a hand points at it
    return;
  }
  if (it.state !== 'on') return;
  if (it.kind === 'gate') {
    if (!it.again && R.lv < 3 && dist <= it.lead / 2) { it.again = true; say(en(it.w)); }   // the word once more on the way
    if (dist > 0) return;
    it.state = 'past'; if (R.cur === it) R.cur = null;
    const sign = it.el.children[it.lane];
    if (carLane() === it.lane) { R.missRun = 0; sign.classList.add('ok'); it.el.classList.remove('hint'); collect(it.lane); say(en(it.w + '!')); }
    // the other picture: not a mistake, the coin just stays behind; the right picture lights up and the word sounds again
    else { R.missRun++; it.el.classList.remove('hint'); sign.classList.add('lit'); sfx.miss(); say(en(it.w)); }
  } else if (dist <= 0 && carLane() === it.lane) { it.state = 'past'; it.el.classList.remove('on'); collect(it.lane); }
  else if (dist < -CAR_H) { it.state = 'past'; R.missRun++; }
}
function collect(lane) {
  R.got++; L.earned++;
  sfx.coin();
  addCoins(1, { x: ROAD_X + LANE_X[lane] + 30, y: CAR_Y - 60 });
}

function draw() {
  const fast = Math.max(0, (R.v - R.rest) / (R.top - R.rest));
  put($('rme'), R.x, CAR_Y - 14 * R.kick - 26 * fast);   // the car jumps forward on a tap and sits higher on the road the faster it goes
  $('road').classList.toggle('fast', fast > .55);
  put($('rrival'), R.rx, CAR_Y - (R.rd - R.d));
  $('rlines').style.transform = `translateY(${R.d % 160}px)`;
  const side = `translateY(${R.d % 400}px)`; $('rsideL').style.transform = side; $('rsideR').style.transform = side;
  put($('rstart'), 0, Math.min(900, CAR_Y + R.d));
  put($('rfinish'), 0, Math.max(-100, CAR_Y - 36 - (R.len - R.d)));
  R.items.forEach(it => {
    if (it.state === 'far') return;
    const dist = it.d - R.d;
    if (it.kind === 'gate') put(it.el, 0, Math.min(900, Math.max(GATE_TOP, CAR_Y - 70 - dist)));
    else put(it.el, LANE_X[it.lane] + 10, Math.min(900, Math.max(COIN_TOP, CAR_Y - 50 - dist)));
  });
  const k = d => 290 * Math.max(0, Math.min(1, d / R.len));
  put($('rbarM'), k(R.d), 0); put($('rbarR'), k(R.rd), 0);
}

/* ================= the finish ================= */
function finish() {
  R.phase = 'done'; R.doneAt = R.t; R.cur = null;
  if (R.won === null) R.won = true;
  engine.stop();
  const more = Math.max(0, ECON.race.min - R.got);   // never fewer than the minimum: coins for the finish itself
  S.stats.races = (S.stats.races || 0) + 1; if (R.won) S.stats.raceWins = (S.stats.raceWins || 0) + 1;
  S.stats.tasks++; save();
  confetti(); sfx.ok();
  say(cheer('Финиш!'), cheer(R.won ? 'Ты первый!' : praise()));
  if (R.won) $('rme').insertAdjacentHTML('beforeend', `<div class="cup">${I.trophy}</div>`);
  if (more) { L.earned += more; soon(() => addCoins(more, { x: 640, y: 330 }), 500); }
  soon(nextTask, 2800);
}
onTask('race', startRace);
