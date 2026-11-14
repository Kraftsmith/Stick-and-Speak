// The album: one page per set; its shelf holds the whole set. Stickers are tried on and bought on the page, dragged
// from the shelf, moved, scaled, rotated, flipped, put back (features/stick.md).
import { Cloud } from './cloud.js';
import { $, frame, pt, rectIn, capture } from './stage.js';
import { U } from './session.js';
import { S, save, sceneOpen, timeUp, parentAcc, parentDat } from './state.js';
import { stickerLocked } from './premium.js';
import { openParent } from './parent.js';
import { SCENES, SETS, STICKERS, STICKER_FX, MAX_MOVING, pic, iconOf } from './data.js';
import { BG } from './gen/art.js';
import { I } from './icons.js';
import { say, ru, en, sfx, sayThenSound } from './audio.js';
import { overlay, closeOverlay, confetti, renderCoins } from './ui.js';
import { go, onEnter, onLeave } from './nav.js';

/* ================= buying (features/stick.md 5) ================= */
// Spends the coins and counts the sticker as bought. Where the new piece goes (the shelf or straight onto the page)
// is up to the caller. Returns null if the coins are short, else { first, newPage }: the child's first piece of this
// sticker, and the first sticker of its set (the album opens with it).
export function buySticker(st) {
  if (S.coins < st.price) return null;
  const first = !S.bought[st.key], newPage = !sceneOpen(st.set);
  S.coins -= st.price;
  S.bought[st.key] = (S.bought[st.key] || 0) + 1;
  save(); renderCoins(true);
  Cloud.pushSoon();   // a purchase goes to the cloud copy at once (cloud-sync.md 4.4)
  return { first, newPage };
}
// the trophy for a complete set, once per set
export function checkSetComplete(setId) {
  const set = SETS.find(s => s.id === setId);
  if (S.rewarded.includes(setId) || !set.items.every(([, w]) => S.bought[setId + ':' + w])) return;
  S.rewarded.push(setId);
  save();
  setTimeout(() => {
    confetti(); say(ru('Ты собрал весь набор!'), en(set.name + '!'), ru('Тебе кубок!'), ru('Покажи ' + parentDat() + '!'));
    overlay(`<div class="bigpic">${iconOf(set)}${I.trophy}</div><div class="gain">${set.name}: 12/12</div>
      <div class="row"><button class="btn to-stick" id="tostick">${I.stick} Stick</button><button class="btn gray" id="cl">${I.close}</button></div>`);
    // already in this album: the button just closes the window
    $('tostick').onclick = () => { if (U.current === 'album' && U.sceneId === setId) { closeOverlay(); renderAlbum(); return; } U.sceneId = setId; go('album'); };
    $('cl').onclick = closeOverlay;
  }, 1800);
}

/* ================= album ================= */
// features/stick.md: every album page can be opened; one is open (lit) once a sticker of its set is bought.
// Its shelf holds all 12 stickers of the set; a sticker not bought (or with every piece on the page) is tried on the page
// and bought there with the coin button.
let selected = null;   // the tapped sticker (its toolbar is open)
function sceneData() { return S.scenes[U.sceneId] = S.scenes[U.sceneId] || []; }
const setOf = id => SETS.find(s => s.id === id);
const keysOf = id => setOf(id).items.map(([, w]) => id + ':' + w);   // the set's own order: 8 common, 3 rare, 1 special
const haveN = id => keysOf(id).filter(k => S.bought[k]).length;
function renderTabs() {
  $('scenetabs').innerHTML = SCENES.map(s => {
    const open = sceneOpen(s.id);
    return `<button class="st ${s.id === U.sceneId ? 'on' : ''} ${open ? '' : 'locked'} ${S.rewarded.includes(s.id) ? 'cup' : ''}" data-s="${s.id}" style="background:${s.bg}">${iconOf(setOf(s.id) || s)}<span class="n">${haveN(s.id)}/12</span></button>`;
  }).join('');
  // a closed album opens too: the child sees what can be collected there
  $('scenetabs').querySelectorAll('.st').forEach(b => b.onclick = () => {
    if (b.dataset.s === U.sceneId) return;
    U.sceneId = b.dataset.s; sfx.pop(); renderAlbum();
  });
}
function renderAlbum() {
  cancelTrial(true);
  $('album').classList.toggle('sleep', timeUp());
  $('album').classList.toggle('closed', !sceneOpen(U.sceneId));
  if (S.lastScene !== U.sceneId) { S.lastScene = U.sceneId; save(); }
  renderTabs();
  // the picture is on the scene, which runs out to the window's edges; the decoration and the stickers are on the page,
  // the part of it inside the frame (css/album.css)
  const sc = $('scene'); sc.className = 'scene ' + SCENES.find(s => s.id === U.sceneId).css; sc.innerHTML = '<div class="page" id="page"></div>';
  const page = $('page');
  // the page is a picture in the style of the stickers; a page without one keeps the drawn page and its decoration
  const art = BG.includes(U.sceneId);
  sc.classList.toggle('art', art); sc.style.backgroundImage = art ? `url("img/bg/${U.sceneId}.jpg")` : '';
  if (!art) SCENES.find(s => s.id === U.sceneId).deco.forEach(([e, x, y, f]) => page.innerHTML += `<div class="deco" style="left:${x}px;top:${y}px;font-size:${f}px">${e}</div>`);
  sceneData().forEach(it => page.appendChild(placedEl(it)));
  limitMotion();
  hideTools();
  renderShelf();
  $('shelf').scrollLeft = 0;
  if (timeUp()) { say(ru('Стикеры спят. Позови ' + parentAcc() + ', чтобы поиграть ещё.')); return; }
  hopAffordable();
  if (!S.stickHint) handHint();
}
// a cell's state (features/stick.md 4): 'new' not bought, 'have' pieces on the shelf, 'done' every piece is on a page
function cellState(k) { return S.inv[k] > 0 ? 'have' : S.bought[k] ? 'done' : 'new'; }
function renderShelf() {
  const shelf = $('shelf');
  shelf.innerHTML = keysOf(U.sceneId).map(k => {
    const st = STICKERS[k], state = cellState(k);
    return `<div class="tk ${st.rarity} ${state} ${trial && trial.k === k ? 'trying' : ''}" data-k="${k}">${pic(st)}`
      + (state === 'have' ? (S.inv[k] > 1 ? `<b>${S.inv[k]}</b>` : '') : `<span class="price">${I.coin}${st.price}</span>`)
      + (state === 'done' ? '<i class="got">✓</i>' : '') + '</div>';
  }).join('');
  shelf.querySelectorAll('.tk').forEach(t => dragFromShelf(t));
}
// on entering: the stickers the coins are enough for hop once, one after another (features/stick.md 4)
function hopAffordable() {
  if (stickerLocked(U.sceneId)) return;
  [...$('shelf').querySelectorAll('.tk:not(.have)')].filter(t => S.coins >= STICKERS[t.dataset.k].price)
    .forEach((t, i) => setTimeout(() => { t.classList.remove('hop'); void t.offsetWidth; t.classList.add('hop'); }, 400 + i * 160));
}
// the very first album: a hand drags a sticker from the shelf to the page, once (features/stick.md 3)
function handHint() {
  const cells = [...$('shelf').querySelectorAll('.tk')];
  const t = cells.find(c => S.coins >= STICKERS[c.dataset.k].price) || cells[0];
  if (!t) return;
  S.stickHint = true; save();
  const r = rectIn(t), h = document.createElement('div');
  h.className = 'shand'; h.textContent = '👆';
  h.style.left = (r.x + r.w / 2) + 'px'; h.style.top = (r.y + r.h / 2) + 'px';
  h.style.setProperty('--dx', (640 - r.x - r.w / 2) + 'px'); h.style.setProperty('--dy', (330 - r.y - r.h / 2) + 'px');
  $('album').appendChild(h);
  const off = () => { h.remove(); document.removeEventListener('pointerdown', off, true); };
  document.addEventListener('pointerdown', off, true);
  setTimeout(off, 5200);
}
function placedEl(it) {
  const st = STICKERS[it.k], el = document.createElement('div');
  const fx = STICKER_FX[it.k];
  el.className = 'placed ' + st.rarity + (fx && fx.move ? ' mv-' + fx.move : ''); el.innerHTML = pic(st); el._it = it;
  applyT(el); dragPlaced(el); return el;
}
function applyT(el) {
  const it = el._it;
  el.style.left = it.x + 'px'; el.style.top = it.y + 'px';
  el.style.transform = `translate(-50%,-50%) rotate(${it.r}deg) scale(${it.f ? -it.s : it.s}, ${it.s})`;
  el.style.zIndex = it.z;
}
function showLabel(el) {
  document.querySelectorAll('.label').forEach(l => l.remove());
  const r = rectIn(el), l = document.createElement('div');
  l.className = 'label'; l.textContent = STICKERS[el._it.k].w;
  l.style.left = (r.x + r.w / 2) + 'px'; l.style.top = Math.max(10, r.y - 70) + 'px';
  $('album').appendChild(l); setTimeout(() => l.remove(), 1500);
  // the name; a rare or special sticker then makes its own sound, a special one plays its little scene with it
  const k = el._it.k;
  if (STICKER_FX[k]) sayThenSound(k, [en(STICKERS[k].w)], () => act(el)); else say(en(STICKERS[k].w));
}
// the scene of a special sticker: a one-second move of its own and something flying out of it
function act(el) {
  const fx = STICKER_FX[el._it.k];
  if (!fx || !fx.act || !el.isConnected) return;
  const cls = 'act-' + fx.act;
  el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls);
  setTimeout(() => el.classList.remove(cls), 1300);
  if (!fx.burst) return;
  for (let i = 0; i < 6; i++) {
    const p = document.createElement('span'); p.className = 'fxp ' + fx.burst;
    p.style.setProperty('--dx', (Math.random() * 160 - 80 | 0) + 'px'); p.style.setProperty('--dy', (-60 - Math.random() * 90 | 0) + 'px');
    p.style.animationDelay = (i * 70) + 'ms';
    el.appendChild(p); setTimeout(() => p.remove(), 1500 + i * 70);
  }
}
// special stickers move all the time, but only MAX_MOVING at once: the ones on top (touched last) move, the rest stand still
function limitMotion() {
  const moving = [...$('scene').querySelectorAll('.placed[class*=" mv-"]')].sort((a, b) => b._it.z - a._it.z);
  moving.forEach((el, i) => el.classList.toggle('still', i >= MAX_MOVING));
}
// A shelf cell: a tap names the sticker; moving up drags it to the page; moving along the shelf scrolls it
// (scrolled here for touch and mouse alike: the browser would take a diagonal drag for a scroll).
function dragFromShelf(t) {
  let ghost = null, start = null, scrollX = null;
  const k = t.dataset.k;
  t.addEventListener('pointerdown', ev => {
    if (timeUp()) return;
    capture(t, ev); start = pt(ev); ghost = null; scrollX = null;
  });
  t.addEventListener('pointermove', ev => {
    if (!start) return;
    const q = pt(ev), dx = q.x - start.x, dy = q.y - start.y;
    if (!ghost) {
      // up by a little (even diagonally, even after scrolling a bit) is a drag to the page; sideways inside the shelf scrolls it
      if (dy > -24) {
        if (scrollX == null && Math.abs(dx) > 8) scrollX = $('shelf').scrollLeft;
        if (scrollX != null) $('shelf').scrollLeft = scrollX - dx;
        return;
      }
      scrollX = null;
      ghost = document.createElement('div'); ghost.className = 'dragghost'; ghost.innerHTML = pic(STICKERS[k]);
      frame.appendChild(ghost); sfx.pop(); hideTools();
    }
    ghost.style.left = q.x + 'px'; ghost.style.top = q.y + 'px';
  });
  const up = ev => {
    if (!start) return;
    const q = pt(ev), wasDrag = !!ghost, wasScroll = scrollX != null;
    start = null; scrollX = null;
    if (ghost) { ghost.remove(); ghost = null; }
    if (wasScroll) return;
    if (!wasDrag) { nameSticker(k); return; }
    if (!(q.y < 600 && q.y > 0 && q.x > 0 && q.x < 1280)) return;
    if (S.inv[k] > 0) placeFromShelf(k, q);
    else startTrial(k, q);
  };
  t.addEventListener('pointerup', up);
  t.addEventListener('pointercancel', () => { start = null; scrollX = null; if (ghost) { ghost.remove(); ghost = null; } });
}
// the name; a rare or special sticker then makes its own sound
function nameSticker(k) { if (STICKER_FX[k]) sayThenSound(k, [en(STICKERS[k].w)]); else say(en(STICKERS[k].w)); }
const topZ = () => sceneData().reduce((m, i) => Math.max(m, i.z), 0);
// a bought piece from the shelf: placed for free
function placeFromShelf(k, q) {
  cancelTrial(true);
  const it = { k, x: q.x, y: q.y, s: 1, r: 0, f: false, z: topZ() + 1 };
  sceneData().push(it); S.inv[k]--; save();
  const el = placedEl(it); $('page').appendChild(el);
  el.animate([{ scale: .3 }, { scale: 1.15 }, { scale: 1 }], { duration: 300 });
  // just placed: the child sees the sticker land and hears its name; the toolbar comes only on a tap
  sfx.snap(); renderShelf(); limitMotion(); showLabel(el);
}

/* ---- trying a sticker on (features/stick.md 5) ---- */
// one at a time: { k, el, ui, timer }. Never in S.scenes and never saved until the coin button is pressed.
let trial = null;
const clampX = x => Math.max(70, Math.min(1210, x)), clampY = y => Math.max(70, Math.min(500, y));
function startTrial(k, q) {
  cancelTrial(true);
  if (timeUp()) return;
  hideTools();
  // an album outside the free plan: the sticker can be tried on, but a lock stands where the coin button would be
  // (features/stick.md 7); it calls the grown-up, with no price and no "buy" on the child's side
  const st = STICKERS[k], locked = stickerLocked(st.set), enough = !locked && S.coins >= st.price;
  const el = document.createElement('div');
  el.className = 'placed trial ' + st.rarity; el.innerHTML = pic(st);
  el._it = { k, x: clampX(q.x), y: clampY(q.y), s: 1, r: 0, f: false, z: topZ() + 2 };
  applyT(el);
  const ui = document.createElement('div'); ui.className = 'trialui';
  ui.innerHTML = locked ? `<button class="buybtn paylock" id="paybtn">${I.lock}</button>`
    : enough ? `<button class="buybtn" id="buybtn">${I.coin}<span>${st.price}</span></button>`
    : `<div class="need"><i style="width:${Math.min(100, S.coins / st.price * 100)}%"></i></div>`;
  ui.style.zIndex = el._it.z + 1;
  $('page').append(el, ui);
  el.animate([{ scale: .3 }, { scale: 1.1 }, { scale: 1 }], { duration: 260 });
  trial = { k, el, ui, timer: null, locked };
  placeUi();
  renderShelf();
  dragTrial(el);
  ui.addEventListener('pointerdown', ev => ev.stopPropagation());
  if (locked) { $('paybtn').onclick = ev => { ev.stopPropagation(); sfx.pop(); openParent('premium'); }; nameSticker(k); }
  else if (enough) { $('buybtn').onclick = ev => { ev.stopPropagation(); buyTrial(); }; nameSticker(k); }
  else {
    // not enough coins: it was fine to look; it slides back and Play comes in its place (no red, no "wrong" sound)
    say(en(st.w));
    trial.timer = setTimeout(notEnough, 3000);
  }
}
function placeUi() {
  if (!trial) return;
  const it = trial.el._it;
  trial.ui.style.left = it.x + 'px'; trial.ui.style.top = Math.min(560, it.y + 95) + 'px';
}
function dragTrial(el) {
  let off = null, moved = false, startQ = null;
  el.addEventListener('pointerdown', ev => {
    ev.stopPropagation(); capture(el, ev);
    const q = pt(ev); off = { x: q.x - el._it.x, y: q.y - el._it.y }; startQ = q; moved = false;
  });
  el.addEventListener('pointermove', ev => {
    if (!off) return;
    const q = pt(ev);
    if (Math.hypot(q.x - startQ.x, q.y - startQ.y) > 8) moved = true;
    if (!moved) return;
    el._it.x = Math.max(0, Math.min(1280, q.x - off.x)); el._it.y = Math.max(0, Math.min(800, q.y - off.y));
    applyT(el); placeUi();
  });
  const up = () => {
    if (!off) return; off = null;
    if (!trial || trial.el !== el) return;
    // dragged back onto the shelf: no
    if (el._it.y > 620) { cancelTrial(); return; }
    el._it.x = clampX(el._it.x); el._it.y = clampY(el._it.y); applyT(el); placeUi();
    if (!moved) { if (!trial.locked && S.coins < STICKERS[trial.k].price) notEnough(); else nameSticker(trial.k); }
  };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
}
// the sticker flies back to its shelf cell; nothing is spent. `now`: no animation (the page is redrawn anyway)
function cancelTrial(now) {
  if (!trial) return;
  const { el, ui, timer, k } = trial; trial = null;
  clearTimeout(timer); ui.remove();
  const cell = $('shelf').querySelector(`.tk[data-k="${CSS.escape(k)}"]`);
  if (cell) cell.classList.remove('trying');
  if (now || !cell || !el.isConnected) { el.remove(); return; }
  const r = rectIn(cell), from = el._it;
  el.animate([{ left: from.x + 'px', top: from.y + 'px', opacity: .55 }, { left: (r.x + r.w / 2) + 'px', top: (r.y + r.h / 2) + 'px', opacity: 0, scale: .5 }],
    { duration: 380, easing: 'ease-in', fill: 'forwards' });
  setTimeout(() => el.remove(), 400);
}
function notEnough() {
  if (!trial) return;
  const at = { ...trial.el._it };
  cancelTrial();
  say(ru('Ещё немного монет! Пойдём играть?'));
  const b = document.createElement('button');
  b.className = 'btn to-play playhint'; b.innerHTML = `${I.play} Play`;
  b.style.left = at.x + 'px'; b.style.top = at.y + 'px';
  b.addEventListener('pointerdown', ev => ev.stopPropagation());
  b.onclick = () => { $('playBtn').click(); };
  $('page').appendChild(b);
  setTimeout(() => { b.classList.add('gone'); setTimeout(() => b.remove(), 400); }, 4500);
}
// the coin button: the only thing that spends coins
function buyTrial() {
  if (!trial || trial.locked || timeUp()) return;
  const { k, el } = trial, st = STICKERS[k], set = setOf(st.set);
  const got = buySticker(st);
  if (!got) return;
  clearTimeout(trial.timer); trial.ui.remove(); trial = null;
  flyCoins(el);
  const it = { ...el._it, z: topZ() + 1 };
  sceneData().push(it); save();
  setTimeout(() => {
    const placed = placedEl(it);
    if (el.isConnected) el.replaceWith(placed); else if ($('page')) $('page').appendChild(placed);
    placed.animate([{ scale: 1 }, { scale: 1.25 }, { scale: 1 }], { duration: 320 });
    sfx.snap(); limitMotion();
    say(...(got.first ? [ru('Ура! Новый стикер!')] : []), en(st.w), ...(got.newPage ? [ru('И новый альбом!'), en(set.name)] : []));
    if (got.first) confetti();
    // the first sticker opens the album: the page and its tab light up, the count goes from 0/12 to 1/12
    $('album').classList.remove('closed');
    renderTabs(); renderShelf();
    checkSetComplete(st.set);
  }, 650);
}
// coins fly from the counter into the sticker being bought
function flyCoins(el) {
  const from = rectIn($('coins')), to = rectIn(el);
  for (let i = 0; i < 5; i++) {
    const c = document.createElement('div'); c.className = 'flycoin'; c.innerHTML = I.coin;
    c.style.left = (from.x + 10) + 'px'; c.style.top = (from.y + 6) + 'px';
    frame.appendChild(c);
    setTimeout(() => { c.style.left = (to.x + to.w / 2 - 20 + (Math.random() * 40 - 20)) + 'px'; c.style.top = (to.y + to.h / 2 - 20) + 'px'; }, 30 + i * 60);
    setTimeout(() => { c.remove(); sfx.coin(); }, 700 + i * 60);
  }
}
const trash = $('trash');
// a sticker dragged back onto the shelf goes back into it, the same as one dropped on the trash
const overShelf = q => q.y >= rectIn($('shelf')).y;
const overTrash = q => { const r = rectIn(trash); return Math.hypot(q.x - (r.x + r.w / 2), q.y - (r.y + r.h / 2)) < 90; };
function removePlaced(el) {
  const it = el._it, d = sceneData();
  d.splice(d.indexOf(it), 1); S.inv[it.k] = (S.inv[it.k] || 0) + 1; save();
  hideTools();
  el.animate([{ opacity: 1 }, { opacity: 0, scale: .2 }], { duration: 200, fill: 'forwards' });
  setTimeout(() => { el.remove(); renderShelf(); limitMotion(); }, 200);
  sfx.pop();
}
function dragPlaced(el) {
  const ptrs = new Map();
  let off = null, moved = false, pinch = null, startQ = null;
  el.addEventListener('pointerdown', ev => {
    if (timeUp()) return;
    ev.stopPropagation(); capture(el, ev);
    const q = pt(ev); ptrs.set(ev.pointerId, q);
    hideTools(); cancelTrial();
    if (ptrs.size === 1) { off = { x: q.x - el._it.x, y: q.y - el._it.y }; moved = false; startQ = q; trash.classList.add('on'); }
    if (ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      pinch = { d: Math.hypot(b.x - a.x, b.y - a.y), ang: Math.atan2(b.y - a.y, b.x - a.x), s: el._it.s, r: el._it.r };
      off = null; moved = true; trash.classList.remove('on');
    }
  });
  el.addEventListener('pointermove', ev => {
    if (!ptrs.has(ev.pointerId)) return;
    const q = pt(ev); ptrs.set(ev.pointerId, q);
    if (pinch && ptrs.size === 2) {
      const [a, b] = [...ptrs.values()];
      const d = Math.hypot(b.x - a.x, b.y - a.y), ang = Math.atan2(b.y - a.y, b.x - a.x);
      el._it.s = Math.max(.4, Math.min(3, pinch.s * d / pinch.d));
      el._it.r = pinch.r + (ang - pinch.ang) * 180 / Math.PI;
      applyT(el); return;
    }
    if (!off) return;
    if (Math.hypot(q.x - startQ.x, q.y - startQ.y) > 8) moved = true;
    el._it.x = Math.max(0, Math.min(1280, q.x - off.x)); el._it.y = Math.max(0, Math.min(620, q.y - off.y));
    trash.classList.toggle('hot', overTrash(q));
    applyT(el);
  });
  const up = ev => {
    if (!ptrs.has(ev.pointerId)) return;
    const q = ptrs.get(ev.pointerId); ptrs.delete(ev.pointerId);
    if (pinch) { if (ptrs.size === 0) { pinch = null; save(); select(el); } return; }
    if (!off) return; off = null;
    // ask before hiding the trash: a hidden one has no size and nothing would ever land in it
    const inTrash = overTrash(q) || (moved && overShelf(q));   // a tap on a sticker that hangs over the shelf is not a drag
    trash.classList.remove('on', 'hot');
    if (inTrash) { removePlaced(el); return; }
    save(); select(el);
    if (!moved) showLabel(el);
  };
  el.addEventListener('pointerup', up); el.addEventListener('pointercancel', up);
}
function select(el) {
  document.querySelectorAll('.placed.sel').forEach(e => e.classList.remove('sel'));
  selected = el; el.classList.add('sel');
  // the touched sticker comes to the front
  const it = el._it, top = Math.max(...sceneData().map(i => i.z));
  if (it.z < top || sceneData().filter(i => i.z === top).length > 1) { it.z = top + 1; applyT(el); save(); limitMotion(); }
  // a sticker mid-animation (the landing pop) reports a wrong size: place the toolbar when it settles
  const anim = el.getAnimations().find(a => a.playState === 'running' && a.effect && !(a.effect.getTiming().iterations === Infinity));
  if (anim) { anim.onfinish = () => { if (selected === el) select(el); }; return; }
  const t = $('tools'); t.classList.add('on');
  // never cover the sticker: above it, else below it, else beside it (scene area: y 110..620)
  const r = rectIn(el), W = t.offsetWidth, H = t.offsetHeight, GAP = 18, TOP = 110, BOTTOM = 620;
  let x = r.x + r.w / 2 - W / 2, y;
  if (r.y - GAP - H >= TOP) y = r.y - GAP - H;
  else if (r.y + r.h + GAP + H <= BOTTOM) y = r.y + r.h + GAP;
  else {
    y = r.y + r.h / 2 - H / 2;
    x = r.x + r.w + GAP + W <= 1270 ? r.x + r.w + GAP : r.x - GAP - W;
  }
  t.style.left = Math.max(10, Math.min(1270 - W, x)) + 'px';
  t.style.top = Math.max(TOP, Math.min(BOTTOM - H, y)) + 'px';
}
function hideTools() { $('tools').classList.remove('on'); document.querySelectorAll('.placed.sel').forEach(e => e.classList.remove('sel')); selected = null; }
// a tap anywhere else on the page: the toolbar closes, a sticker being tried on goes back
$('scene').addEventListener('pointerdown', () => { hideTools(); cancelTrial(); });
$('tools').querySelectorAll('button').forEach(b => b.onclick = ev => {
  ev.stopPropagation(); if (!selected) return;
  const it = selected._it, zs = sceneData().map(i => i.z); sfx.pop();
  switch (b.dataset.t) {
    case 'up': it.s = Math.min(3, it.s + .2); break;
    case 'down': it.s = Math.max(.4, it.s - .2); break;
    case 'rot': it.r = (it.r + 30) % 360; break;
    case 'flip': it.f = !it.f; break;
  }
  save(); applyT(selected); select(selected);
});
// "Stick" on the home screen opens the album the child opened last; the first time, the first one (Farm)
$('stickBtn').onclick = () => { sfx.pop(); U.sceneId = SCENES.some(s => s.id === S.lastScene) ? S.lastScene : SCENES[0].id; go('album'); };
onEnter('album', renderAlbum);
onLeave(() => { hideTools(); cancelTrial(true); });
