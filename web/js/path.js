// The lesson path: one line of lessons per level, scrolled sideways, centred on the current lesson.
import { $, scale } from './stage.js';
import { U } from './session.js';
import { S, save, nextIdx, levelOpen } from './state.js';
import { TRACKS, LEVELS, THEMES, iconOf, picOf } from './data.js';
import { I } from './icons.js';
import { sfx } from './audio.js';
import { go, onEnter } from './nav.js';
import { startLesson } from './lessons.js';
import { Premium, lessonLocked } from './premium.js';
import { openParent } from './parent.js';

// "Play" on the home screen opens the path, on the level the child played last
$('playBtn').onclick = () => { sfx.pop(); U.pathTr = S.lastTrack && TRACKS[S.lastTrack] && levelOpen(S.lastTrack) ? S.lastTrack : 'main'; go('path'); };
/* ================= lesson path ================= */
function renderPath() {
  const T = TRACKS[U.pathTr], cur = nextIdx(U.pathTr);
  $('ptitle').innerHTML = LEVELS.map(([tr, name]) =>
    `<button class="lvtab ${tr === U.pathTr ? 'on' : ''} ${levelOpen(tr) ? '' : 'locked'}" data-tr="${tr}">${levelOpen(tr) ? '' : I.lock + ' '}${name}</button>`).join('');
  $('ptitle').querySelectorAll('.lvtab').forEach(b => b.onclick = () => {
    if (!levelOpen(b.dataset.tr)) { sfx.no(); return; }
    if (b.dataset.tr !== U.pathTr) { U.pathTr = b.dataset.tr; S.lastTrack = U.pathTr; save(); sfx.pop(); renderPath(); }
  });
  // a single line of circles joined by connectors; a small theme tag sits above the first lesson of each theme
  const firstOf = {}; T.islands.forEach(is => firstOf[is.idx[0]] = is);
  $('islands').innerHTML = '<div class="pline">' + T.lessons.map((ls, i) => {
    // the next lesson past the free twenty waits for a grown-up: a lock, not the orange circle (subscription.md 3)
    const st = S.prog[U.pathTr][i], pay = !st && i === cur && lessonLocked(U.pathTr, i);
    const cls = st ? 'done' : pay ? 'pay' : i === cur ? 'cur' : 'locked';
    const is = firstOf[i];
    return (i ? `<div class="conn ${st ? 'done' : ''}"></div>` : '') +
      `<div class="lwrap">${is ? `<div class="ttag">${is.set ? iconOf(is.set) : is.icon}<small>${is.label}</small></div>` : ''}
        <button class="ln ${cls}" data-i="${i}">${ls.kind === 'words' ? picOf(THEMES[ls.theme][ls.part ? 4 : 0][0], ls.icon) : ls.icon}${st ? `<span class="mk">${st === 'gold' ? I.gold : I.star}</span>` : pay ? `<span class="mk">${I.lock}</span>` : ''}</button></div>`;
  }).join('') + '</div>';
  // centre the U.current lesson
  const box = $('islands'), target = box.querySelector(`.ln[data-i="${Math.min(cur, T.lessons.length - 1)}"]`);
  box.scrollLeft = target.parentElement.offsetLeft - box.clientWidth / 2 + 54;
  box.querySelectorAll('.ln').forEach(b => b.onclick = () => {
    if (box._dragged) return;
    const i = +b.dataset.i;
    if (b.classList.contains('locked')) { sfx.no(); return; }
    // no price and no "buy" on the child's side: the lock calls the grown-up and leads to the parent lock
    if (b.classList.contains('pay')) { sfx.pop(); openParent('premium'); return; }
    // a done lesson starts the new one: a child taps any circle just to play. Once the level is finished, it replays.
    // ...unless the new one is locked: then the finished lesson itself is played again
    sfx.pop(); startLesson(U.pathTr, cur < T.lessons.length && !lessonLocked(U.pathTr, cur) ? cur : i);
  });
}

// swipe the path sideways with a finger or mouse
(() => {
  const box = $('islands'); let st = null;
  box.addEventListener('pointerdown', ev => { st = { x: ev.clientX, l: box.scrollLeft }; box._dragged = false; });
  box.addEventListener('pointermove', ev => {
    if (!st) return; const dx = (ev.clientX - st.x) / scale;
    if (Math.abs(dx) > 10) box._dragged = true;
    box.scrollLeft = st.l - dx;
  });
  const end = () => { st = null; setTimeout(() => box._dragged = false, 0); };
  box.addEventListener('pointerup', end); box.addEventListener('pointercancel', end); box.addEventListener('pointerleave', end);
})();
onEnter('path', renderPath);
// premium came or went while the path is open: the lock appears or leaves without a sound
Premium.onChange(() => { if (U.current === 'path') renderPath(); });
