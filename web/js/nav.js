// Screens: which one is open, Back, the daily time limit. Screens register what to draw when they open.
import { $ } from './stage.js';
import { U, LESSON_SCREENS } from './session.js';
import { S, save, timeUp } from './state.js';
import { today } from './util.js';
import { stopVoice, music, sfx } from './audio.js';
import { closeOverlay, renderCollN } from './ui.js';

/* ================= navigation ================= */
// the screen a Back press returns to
const parentOf = { path:'home', intro:'path', quiz:'path', trace:'path', puzzle:'path', pairs:'path', lines:'path', race:'path', album:'home', parent:'home', collection:'home' };
// a screen registers what to draw when it opens; what must close whenever the screen changes registers with onLeave
const enter = {}, leave = [];
// screens without a Back button: the home screen and the two that can come before it
const START_SCREENS = ['home', 'who', 'firstrun'];
export const onEnter = (id, fn) => { enter[id] = fn; };
export const onLeave = fn => { leave.push(fn); };
export function go(id) {
  stopVoice();
  if (timeUp() && ['path', 'intro', 'quiz', 'trace', 'puzzle', 'pairs', 'lines', 'race', 'collection'].includes(id)) id = 'album';
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('on', s.id === id));
  if (id === 'home') U.streak = 0;
  U.current = id;
  $('back').style.display = START_SCREENS.includes(id) ? 'none' : 'grid';
  $('coins').style.display = id === 'parent' || id === 'who' || id === 'firstrun' ? 'none' : 'flex';
  $('mute').style.display = id === 'firstrun' ? 'none' : '';
  closeOverlay(); leave.forEach(fn => fn());
  if (id === 'home') renderCollN();
  if (id !== 'parent') { U.parentThen = null; music.setMood(LESSON_SCREENS.includes(id) ? 'low' : 'full'); }
  if (enter[id]) enter[id]();
}
$('back').onclick = () => { sfx.pop(); const to = parentOf[U.current] || 'home'; go(to === 'home' ? U.home : to); };
document.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { sfx.pop(); go(b.dataset.go); });

/* ================= time limit ================= */
setInterval(() => {
  if (document.hidden || U.current === 'parent' || U.current === 'who' || U.current === 'firstrun') return;
  if (S.day !== today()) { S.day = today(); S.usedMs = 0; }
  S.usedMs += 5000; save();
  if (timeUp() && !['album', 'parent', 'home'].includes(U.current)) go('album');
  // time ran out in the album itself: it falls asleep now (a sticker being tried on goes back, nothing is bought)
  else if (timeUp() && U.current === 'album' && !$('album').classList.contains('sleep')) go('album');
}, 5000);
