// Testing → Voices: every line of the voice list (app/voice.js) in Russian and English, whether it has a recorded clip
// or is read by the device's voice, with buttons to hear either. Lines that sound wrong (an accent, a wrong stress) are
// ticked and copied as a list, for re-recording (TASKS.md 4а).
import { VOICE, LINES } from './gen/voice.js';
import { hearLine, hasClip, deviceVoices, stopVoice } from './audio.js';
import { esc } from './util.js';

const MARKS_KEY = 'dev-voice-marks';   // on this device only, not in a profile; not "sticker-…", so Reset everything keeps it
const marks = new Set(JSON.parse(localStorage.getItem(MARKS_KEY) || '[]'));
const saveMarks = () => localStorage.setItem(MARKS_KEY, JSON.stringify([...marks]));
let filter = 'ru', playingAll = 0;
const ALL = LINES.map(k => { const i = k.indexOf('|'); return { key: k, lang: k.slice(0, i), text: k.slice(i + 1) }; });
const FILTERS = [['ru', 'Русский'], ['en', 'English'], ['noclip', 'No clip (device voice)'], ['marked', 'Marked'], ['all', 'All']];
const shown = () => ALL.filter(l => filter === 'all' ? true : filter === 'noclip' ? !hasClip(l.lang, l.text) : filter === 'marked' ? marks.has(l.key) : l.lang === filter);

function summary() {
  const part = lang => { const ls = ALL.filter(l => l.lang === lang), clips = ls.filter(l => hasClip(l.lang, l.text)).length;
    return `${lang.toUpperCase()}: ${ls.length} lines, ${clips} recorded, <b>${ls.length - clips} device voice</b>`; };
  const dv = deviceVoices();
  return `<div class="vsum">${part('ru')} · ${part('en')} · marked: ${marks.size}<br>
    Device voice now — ru: ${esc(dv.ru)}; en: ${esc(dv.en)}<br>
    <span class="pnote">Recorded clips: ElevenLabs, app/voice.js (Russian is still read by the English voice “Matilda”, TASKS 4а.1). Lines in say(...) that are missing from the list are not here (TASKS 4а.6).</span></div>`;
}
export function voicesHtml() {
  const rows = shown();
  return `<div class="vlist">${summary()}
    <div class="ptime">${FILTERS.map(([k, l]) => `<button data-vf="${k}" class="${filter === k ? 'on' : ''}">${l}</button>`).join('')}</div>
    <div class="ptime"><button id="vall">▶ Play all shown (${rows.length})</button><button id="vstop">■ Stop</button>
      <button id="vcopy">Copy marked</button><button id="vclear">Clear marks</button></div>
    <textarea id="vout" class="vout" readonly style="display:none"></textarea>
    <table class="vtab"><tr><th></th><th>Line</th><th>Source</th><th>Clip</th><th>Device</th><th>Wrong?</th></tr>
    ${rows.map((l, i) => { const clip = hasClip(l.lang, l.text);
      return `<tr data-i="${i}" class="${marks.has(l.key) ? 'marked' : ''}"><td class="vl">${l.lang}</td><td class="vt">${esc(l.text)}</td>
        <td class="${clip ? 'vok' : 'vdev'}">${clip ? 'clip ' + VOICE[l.key] : 'device voice'}</td>
        <td><button data-play="clip" ${clip ? '' : 'disabled'}>▶</button></td><td><button data-play="device">▶</button></td>
        <td><input type="checkbox" data-mark ${marks.has(l.key) ? 'checked' : ''}></td></tr>`; }).join('')}
    </table></div>`;
}
// wires the table inside `root`; `rerender` redraws the whole tab
export function bindVoices(root, rerender) {
  const rows = shown();
  const playing = tr => { root.querySelectorAll('tr.now').forEach(r => r.classList.remove('now')); if (tr) { tr.classList.add('now'); tr.scrollIntoView({ block: 'nearest' }); } };
  root.querySelectorAll('[data-vf]').forEach(b => b.onclick = () => { filter = b.dataset.vf; playingAll++; stopVoice(); rerender(); });
  root.querySelectorAll('.vtab tr[data-i]').forEach(tr => {
    const l = rows[+tr.dataset.i];
    tr.querySelectorAll('[data-play]').forEach(b => b.onclick = () => { playingAll++; playing(tr); hearLine(l.lang, l.text, b.dataset.play).then(() => playing(null)); });
    tr.querySelector('[data-mark]').onchange = e => { if (e.target.checked) marks.add(l.key); else marks.delete(l.key); saveMarks(); tr.classList.toggle('marked', e.target.checked); };
  });
  // one after another, the clip where there is one (what the child hears), else the device voice
  root.querySelector('#vall').onclick = async () => {
    const me = ++playingAll;
    for (const tr of root.querySelectorAll('.vtab tr[data-i]')) {
      if (me !== playingAll || !tr.isConnected) return;
      const l = rows[+tr.dataset.i]; playing(tr);
      await hearLine(l.lang, l.text, hasClip(l.lang, l.text) ? 'clip' : 'device');
      await new Promise(r => setTimeout(r, 350));
    }
    playing(null);
  };
  root.querySelector('#vstop').onclick = () => { playingAll++; stopVoice(); playing(null); };
  root.querySelector('#vcopy').onclick = () => {
    const text = ALL.filter(l => marks.has(l.key)).map(l => `${l.lang}\t${l.text}\t${hasClip(l.lang, l.text) ? 'clip ' + VOICE[l.key] : 'device voice'}`).join('\n');
    const out = root.querySelector('#vout'); out.style.display = 'block'; out.value = text || '(nothing marked)'; out.select();
    try { navigator.clipboard.writeText(text); } catch (e) {}
  };
  root.querySelector('#vclear').onclick = () => { if (!confirm('Clear all marks?')) return; marks.clear(); saveMarks(); rerender(); };
}
