// Stick & Speak site. Pictures, icons and voice clips come straight from the game in ../web/ (no copies).
import { VOICE } from '../web/js/gen/voice.js';
import { SFX } from '../web/js/gen/sfx.js';
import { I } from '../web/js/icons.js';

const WEB = '../web/';
const $ = s => document.querySelector(s);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const fileOf = w => w.toLowerCase().replace(/ /g, '-');
const img = (set, w) => `${WEB}img/stickers/${set}/${fileOf(w)}.png`;
const calm = matchMedia('(prefers-reduced-motion: reduce)').matches;

// icons: <span data-icon="play"> gets the game's SVG
document.querySelectorAll('[data-icon]').forEach(el => { el.innerHTML = I[el.dataset.icon] || ''; });

/* ---- voice: the English word, then the sticker's own sound if it has one (rare and special stickers) ---- */
let cur = null;
function say(w, set) {
  const clip = VOICE['en|' + w];
  if (!clip) return;
  if (cur) cur.pause();
  const a = cur = new Audio(`${WEB}audio/voice/${clip}.mp3`);
  a.play().catch(() => {});
  if (SFX.includes(set + ':' + w)) a.addEventListener('ended', () => {
    if (cur !== a) return;
    cur = new Audio(`${WEB}audio/sfx/${set}-${fileOf(w)}.mp3`);
    cur.play().catch(() => {});
  });
}

// the word as text above the sticker, for a muted phone
const label = $('#word');
let labelT = 0;
function showWord(el) {
  const r = el.getBoundingClientRect();
  label.textContent = el.dataset.w;
  label.style.left = r.left + r.width / 2 + 'px';
  label.style.top = Math.max(60, r.top - 6) + 'px';
  label.classList.add('show');
  clearTimeout(labelT);
  labelT = setTimeout(() => label.classList.remove('show'), 1300);
}
function pop(el) { el.classList.remove('pop'); void el.offsetWidth; el.classList.add('pop'); }
function tap(el) { say(el.dataset.w, el.dataset.set); showWord(el); pop(el); }

function sticker(set, w, special) {
  const b = document.createElement('button');
  b.type = 'button'; b.className = 'stk' + (special ? ' sp' : ''); b.dataset.w = w; b.dataset.set = set;
  b.setAttribute('aria-label', w);
  b.innerHTML = `<img src="${img(set, w)}" alt="" draggable="false">`;
  return b;
}

document.addEventListener('click', e => {
  const el = e.target.closest('.stk');
  if (el) { if (!el.dataset.dragged) tap(el); return; }
  const card = e.target.closest('.album');
  if (card) { open(card.dataset.set); tryBox.scrollIntoView({ behavior: calm ? 'auto' : 'smooth', block: 'center' }); }
});
window.addEventListener('scroll', () => label.classList.remove('show'), { passive: true });

/* ---- the albums: name, set id, two stickers already on the page, five in the tray (the last one is the special, it moves) ---- */
const ALBUMS = [
  ['Farm', 'farm', ['cow', 'horse'], ['pig', 'sheep', 'duck', 'tractor', 'unicorn']],
  ['Forest', 'forest', ['fox', 'owl'], ['bear', 'deer', 'hedgehog', 'frog', 'dragon']],
  ['Sea', 'sea', ['whale', 'octopus'], ['fish', 'crab', 'turtle', 'dolphin', 'mermaid']],
  ['Savanna', 'savanna', ['lion', 'giraffe'], ['zebra', 'monkey', 'elephant', 'hippo', 'dinosaur']],
  ['Toys', 'toys', ['teddy bear', 'robot'], ['ball', 'kite', 'train', 'drum', 'carousel']],
  ['Home', 'home', ['sofa', 'clock'], ['chair', 'bed', 'TV', 'window', 'Christmas tree']],
  ['Kitchen', 'kitchen', ['apple', 'pizza'], ['banana', 'cheese', 'milk', 'egg', 'cake']],
];
const DEFAULT_ALBUM = 'toys';
const SPOTS = [[20, 68], [80, 64]];   // where the two stickers lie: x %, y % of the page
const DROP = [50, 62];                // where the demo puts the third one

/* ---- the mini album: drag stickers from the tray onto the page and back ---- */
const page = $('#page'), tray = $('#tray'), tryBox = $('.try'), row = $('#albumRow');

function put(b, x, y) {
  b.style.left = x + '%'; b.style.top = y + '%';
  page.appendChild(b);
}

function draggable(b) {
  let pid = null, sx = 0, sy = 0, drag = false;
  b.addEventListener('pointerdown', e => {
    pid = e.pointerId; sx = e.clientX; sy = e.clientY; drag = false;
    b.setPointerCapture(pid);
  });
  b.addEventListener('pointermove', e => {
    if (e.pointerId !== pid) return;
    if (!drag && Math.hypot(e.clientX - sx, e.clientY - sy) > 8) {
      drag = true;
      b.style.width = page.clientWidth * 0.19 + 'px';   // the size it will have on the page
      b.classList.add('drag');
      label.classList.remove('show');
    }
    if (drag) { b.style.left = e.clientX + 'px'; b.style.top = e.clientY + 'px'; }
  });
  const end = e => {
    if (e.pointerId !== pid) return;
    pid = null;
    if (!drag) return;
    drag = false;
    b.classList.remove('drag'); b.style.width = '';
    const r = page.getBoundingClientRect();
    const inside = e.type === 'pointerup' && e.clientX > r.left && e.clientX < r.right && e.clientY > r.top && e.clientY < r.bottom;
    if (inside) {
      const fresh = b.parentNode !== page;
      put(b, (e.clientX - r.left) / r.width * 100, Math.min(92, Math.max(12, (e.clientY - r.top) / r.height * 100)));
      if (fresh) tap(b);
    } else {
      b.style.left = b.style.top = '';
      tray.appendChild(b);   // dropped outside the page: back to the tray, never lost
    }
    b.dataset.dragged = '1';   // the click that follows a drag is not a tap
    setTimeout(() => { delete b.dataset.dragged; }, 60);
  };
  b.addEventListener('pointerup', end);
  b.addEventListener('pointercancel', end);
  return b;
}

// show an album in the tablet
function open(set) {
  const a = ALBUMS.find(x => x[1] === set);
  if (!a) return;
  const [, , onPage, inTray] = a;
  demoRun++;   // stops a demo that is under way
  finger.style.opacity = 0;
  page.replaceChildren(); tray.replaceChildren();
  page.style.backgroundImage = `url("${WEB}img/bg/${set}.jpg")`;
  onPage.forEach((w, i) => put(draggable(sticker(set, w)), ...SPOTS[i]));
  inTray.forEach((w, i) => tray.appendChild(draggable(sticker(set, w, i === inTray.length - 1))));
  row.querySelectorAll('.album').forEach(c => c.classList.toggle('sel', c.dataset.set === set));
  demo();
}

/* ---- the demo: a finger drags the first sticker from the tray onto the page and taps it.
        It repeats while the tablet is on screen and stops for good once the visitor touches the tablet. ---- */
const finger = document.createElement('span');
finger.className = 'finger demo';
tryBox.appendChild(finger);
let touched = false, visible = false, demoRun = 0;
tryBox.querySelector('.tablet').addEventListener('pointerdown', () => { touched = true; demoRun++; finger.style.opacity = 0; }, true);

const at = (el, fx = .5, fy = .5) => {   // a point of an element, in the tryBox's coordinates
  const r = el.getBoundingClientRect(), b = tryBox.getBoundingClientRect();
  return [r.left - b.left + r.width * fx, r.top - b.top + r.height * fy];
};
function fingerTo(x, y, ms) {
  finger.style.transition = ms ? `left ${ms}ms ease-in-out, top ${ms}ms ease-in-out, opacity .3s, transform .15s` : 'none';
  finger.style.left = x + 'px'; finger.style.top = y + 'px';
}
const land = s => { s.classList.remove('fly'); s.style.transition = s.style.transform = ''; };

async function demo() {
  if (calm || touched || !visible) return;
  const run = ++demoRun;
  const ok = () => run === demoRun && !touched && visible;
  await sleep(900);
  while (ok()) {
    const s = tray.querySelector('.stk');
    if (!s) break;
    const [sx, sy] = at(s), [px, py] = at(page, DROP[0] / 100, DROP[1] / 100);
    // the finger comes to the sticker in the tray
    fingerTo(sx + 60, sy + 70, 0); finger.style.transform = ''; void finger.offsetWidth;
    finger.style.opacity = 1; fingerTo(sx, sy, 600);
    await sleep(680); if (!ok()) break;
    // presses it and carries it onto the page
    finger.style.transform = 'scale(.86)';
    await sleep(200); if (!ok()) break;
    s.classList.add('fly');
    s.style.transition = 'transform 900ms ease-in-out';
    s.style.transform = `translate(${px - sx}px, ${py - sy}px) scale(${page.clientWidth * 0.19 / s.offsetWidth})`;
    fingerTo(px, py, 900);
    await sleep(940); land(s); if (!ok()) break;
    put(s, ...DROP); pop(s);
    // lets go, then taps it: the word shows
    finger.style.transform = ''; fingerTo(px + 28, py + 34, 300);
    await sleep(750); if (!ok()) break;
    fingerTo(px, py, 260);
    await sleep(300); if (!ok()) break;
    finger.style.transform = 'scale(.86)'; showWord(s); pop(s);
    await sleep(220); finger.style.transform = '';
    await sleep(1500);
    finger.style.opacity = 0;
    await sleep(500); if (!ok()) break;
    // the sticker goes back to the tray and the demo starts again
    s.style.left = s.style.top = ''; tray.prepend(s);
    await sleep(1300);
  }
  if (run === demoRun) finger.style.opacity = 0;
}

/* ---- the row of seven albums: a tap on a card opens it in the tablet ---- */
for (const [name, set, onPage, inTray] of ALBUMS) {
  const pic = document.createElement('div');
  pic.className = 'pic';
  pic.style.backgroundImage = `url("${WEB}img/bg/${set}.jpg")`;
  for (const w of [...onPage, inTray[inTray.length - 1]]) pic.appendChild(sticker(set, w));
  const fig = document.createElement('figure');
  fig.appendChild(pic);
  fig.insertAdjacentHTML('beforeend', `<figcaption>${name}<span>12 stickers</span></figcaption>`);
  const card = document.createElement('div');
  card.className = 'album'; card.dataset.set = set;
  card.appendChild(fig);
  row.appendChild(card);
}
open(DEFAULT_ALBUM);
{ // bring the default album's card into the middle of the row (scrolls the row only, not the page)
  const c = row.querySelector('.album.sel');
  if (c) row.scrollLeft = c.offsetLeft - (row.clientWidth - c.offsetWidth) / 2;
}
if ('IntersectionObserver' in window) new IntersectionObserver(es => {
  visible = es[0].isIntersecting;
  if (visible) demo();
}, { threshold: .6 }).observe(tryBox);

/* ---- game cards: a mouse plays them on hover (CSS); on a touch screen the card in the middle of the screen plays ---- */
if (matchMedia('(hover: none)').matches && 'IntersectionObserver' in window) {
  const io = new IntersectionObserver(es => es.forEach(e => e.target.classList.toggle('play', e.isIntersecting)),
    { rootMargin: '-35% 0px -35% 0px' });
  document.querySelectorAll('.game').forEach(g => io.observe(g));
}

/* ---- "notify me": the prototype sends nothing ---- */
$('#notify').addEventListener('submit', e => {
  e.preventDefault();
  $('#notifyMsg').textContent = 'Prototype: the address was not sent anywhere.';
});
