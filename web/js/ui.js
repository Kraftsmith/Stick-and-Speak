// Things every screen uses: the coin counter and flying coins, confetti, the overlay card, the greeting.
import { $, frame, rectIn } from './stage.js';
import { S, save, uniqueOwned } from './state.js';
import { STICKER_N } from './data.js';
import { ART, BG } from './gen/art.js';
import { I } from './icons.js';
import { sfx } from './audio.js';

// preload the artwork so the album and the puzzle canvas never wait for it
export const IMGS = {};
Object.entries(ART).forEach(([s, ws]) => ws.forEach(w => { const p = `img/stickers/${s}/${w}.png`, i = new Image(); i.src = p; IMGS[p] = i; }));

export function renderCoins(bump) {
  $('coinN').textContent = S.coins;
  if (bump) { const c = $('coins'); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
}
export function addCoins(n, from) {
  S.coins += n; save();
  const target = rectIn($('coins'));
  const count = Math.min(n, 8);
  for (let i = 0; i < count; i++) {
    const c = document.createElement('div');
    c.className = 'flycoin'; c.innerHTML = I.coin;
    c.style.left = (from.x + (Math.random() * 80 - 40)) + 'px';
    c.style.top = (from.y + (Math.random() * 80 - 40)) + 'px';
    frame.appendChild(c);
    setTimeout(() => { c.style.left = (target.x + 10) + 'px'; c.style.top = (target.y + 6) + 'px'; }, 30 + i * 70);
    setTimeout(() => { c.remove(); sfx.coin(); renderCoins(true); }, 760 + i * 70);
  }
}
export function confetti() {
  const colors = ['#ff8fb3', '#ffd34d', '#6cc4ff', '#7fd08a', '#c9a6ff'];
  for (let i = 0; i < 26; i++) {
    const c = document.createElement('div'); c.className = 'confetti' + (i % 2 ? ' round' : '');
    c.style.background = colors[i % colors.length];
    c.style.left = Math.random() * 1240 + 'px'; c.style.top = (-60 - Math.random() * 120) + 'px';
    c.style.animationDelay = Math.random() * .4 + 's';
    frame.appendChild(c); setTimeout(() => c.remove(), 2000);
  }
}
export function overlay(html) { $('card').innerHTML = html; $('overlay').classList.add('on'); }
export function closeOverlay() { $('overlay').classList.remove('on'); }

// the sticker count on the home screen
export function renderCollN() { $('collN').textContent = uniqueOwned() + '/' + STICKER_N; }
// the greeting on the home screen; the voice never says the name
export function renderHello() { $('hello').textContent = S.kidName ? 'Hi, ' + S.kidName + '!' : ''; }
// the home screen and the two screens before it share one landscape; with artwork it is a picture
if (BG.includes('homescreen')) ['home', 'who', 'firstrun'].forEach(id => $(id).classList.add('art'));
