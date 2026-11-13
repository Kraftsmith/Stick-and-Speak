// The collection: every set with its stickers, progress bar and trophy. A set is locked until its first sticker is
// bought, like its album (features/stick.md 6).
import { $ } from './stage.js';
import { S, sceneOpen } from './state.js';
import { SETS, STICKERS, pic, iconOf } from './data.js';
import { I } from './icons.js';
import { onEnter } from './nav.js';

/* ================= collection ================= */
function renderCollection() {
  $('colsets').innerHTML = SETS.map(s => {
    const have = s.items.filter(([, w]) => S.bought[s.id + ':' + w]).length, done = have === s.items.length;
    return `<div class="colset ${sceneOpen(s.id) ? '' : 'locked'}">
      <div class="si">${sceneOpen(s.id) ? iconOf(s) : I.lock}</div>
      <div class="bar">
        <div class="mini">${s.items.map(([e, w]) => `<span class="${S.bought[s.id + ':' + w] ? '' : 'no'}">${pic(STICKERS[s.id + ':' + w])}</span>`).join('')}</div>
        <div class="pb"><i style="width:${have / s.items.length * 100}%"></i></div>
      </div>
      <div class="rw ${done ? 'got' : ''}" title="Reward: a trophy">${done ? I.trophy : I.gift}</div>
    </div>`;
  }).join('');
}
onEnter('collection', renderCollection);
