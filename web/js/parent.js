// The parent zone behind the code: settings, progress, testing tools; also the 15-minute extension from the sleep screen.
import { $ } from './stage.js';
import { U } from './session.js';
import { S, save, detach, resetAll, nextIdx, doneCount, learnedWords, learnedLetters, uniqueOwned, parentAcc, parentDat, PARENTS,
  useProfile, profileId, newProfile, profileCards, freeAvatar, avatarPic, deviceLang, AVATARS, LANGS } from './state.js';
import { Profiles, MAX_PROFILES } from './profiles.js';
import { enterHome, showWho, bootLog } from './startup.js';
import { TRACKS, LETTERS, WORDS, STICKER_N } from './data.js';
import { pick, esc } from './util.js';
import { say, ru, en, sfx, music, ttsState, renderMute } from './audio.js';
import { NTTS, isNative, installed, isIOS, canInstall, install, storage, storageCheck } from './platform.js';
import { renderCoins, renderHello } from './ui.js';
import { go, onEnter } from './nav.js';
import { startAt } from './lessons.js';
import { voicesHtml, bindVoices } from './voicelist.js';
import { Cloud } from './cloud.js';
import { mountAccount } from './account.js';
import { saveBackupFile, readBackup, restoreBackup } from './backup.js';
import { Premium, FREE } from './premium.js';
import { mountPremium, premiumText } from './paywall.js';

/* ================= parent ================= */
let code = [], entered = [], parentTab = 'settings';
let fileNote = null;   // the line under the backup buttons: { text, bad }
let avEdit = null, adding = null, showBoot = false, showVoices = false, cloudDoc = null;   // the Children block: whose picture is being chosen, the new child's form
// a lock on the child's side (a lesson or a sticker outside the free plan) leads here: the parent code, then the tab
export function openParent(tab) { parentTab = tab; go('parent'); }
// sleep screen: a grown-up enters the code and the child gets 15 more minutes today
$('keepon').onclick = () => { sfx.pop(); U.parentThen = 'extend'; go('parent'); };
const NAMES = ['zero','one','two','three','four','five','six','seven','eight','nine'];
function renderParent() {
  $('lockpad').style.display = 'block'; $('pstats').style.display = 'none';
  code = pick([1,2,3,4,5,6,7,8,9], 3); entered = [];
  say(ru('Это для взрослых. Позови ' + parentAcc() + '!'));
  $('lockcode').textContent = code.map(n => NAMES[n]).join(', ');
  $('keys').innerHTML = [1,2,3,4,5,6,7,8,9,0].map(n => `<button data-n="${n}">${n}</button>`).join('');
  $('keys').querySelectorAll('button').forEach(b => b.onclick = () => {
    entered.push(+b.dataset.n);
    if (entered[entered.length - 1] !== code[entered.length - 1]) { entered = []; sfx.no(); return; }
    if (entered.length === 3) {
      // the code was asked for something else: a child chosen on "Who's playing?"
      if (typeof U.parentThen === 'function') { const then = U.parentThen; U.parentThen = null; then(); return; }
      if (U.parentThen === 'extend') {
        U.parentThen = null; S.usedMs = Math.max(0, S.limit * 60000 - 15 * 60000); save();
        U.pathTr = 'main'; go('path'); return;
      }
      showStats();
    }
  });
}
// Settings: the children on this device (cloud-sync.md 4.6, startup.md 3.5)
function kidsHtml() {
  const kids = profileCards(), many = kids.length > 1, ask = Profiles.device().askWho;
  const pics = (sel, attr) => `<div class="pavs">${AVATARS.map(a => `<button ${attr}="${a}" class="${a === sel ? 'on' : ''}">${avatarPic(a)}</button>`).join('')}</div>`;
  return `<div class="pkids"><div class="ph">Children</div>
    ${kids.map(k => `<div class="pkid ${k.playing ? 'cur' : ''}">
      <button class="pav" data-av="${k.id}" title="Change the picture">${avatarPic(k.avatar)}</button>
      <input type="text" data-name="${k.id}" maxlength="12" placeholder="No name" value="${esc(k.name)}">
      <span class="pkw">${k.words} words</span>
      ${k.playing ? '<b class="pknow">playing now</b>' : `<button data-sw="${k.id}">Switch</button>`}
      ${many ? `<button class="pkdel" data-del="${k.id}">Delete</button>` : ''}
      ${avEdit === k.id ? pics(k.avatar, `data-id="${k.id}" data-pick`) : ''}
    </div>`).join('')}
    ${adding ? `<div class="pkid new">
        <input type="text" id="akname" maxlength="12" placeholder="Name" value="${esc(adding.kidName)}">
        <span class="pkrow">Instructions: ${LANGS.map(([l, n]) => `<button data-al="${l}" class="${adding.lang === l ? 'on' : ''}">${n}</button>`).join('')}</span>
        <span class="pkrow">Child calls you: ${[['', 'Mom or Dad'], ...Object.entries(PARENTS).map(([k, p]) => [k, p.label])]
          .map(([k, l]) => `<button data-aw="${k}" class="${adding.parentWho === k ? 'on' : ''}">${l}</button>`).join('')}</span>
        ${pics(adding.avatar, 'data-apick')}
        <span class="pkrow"><button class="on" id="akadd">Add</button><button id="akcancel">Cancel</button></span>
      </div>`
      : kids.length >= MAX_PROFILES ? `<span class="pnote">${MAX_PROFILES} children at most</span>`
      : Premium.canAddProfile(kids.length) ? '<button id="kadd">+ Add a child</button>'
      : `<span class="pnote">The free plan is for one child. Premium opens up to ${MAX_PROFILES}.</span><button id="kprem">${premiumText(S.lang).tab}</button>`}
    ${many ? `<div class="pkrow pkask">Who plays at the start: ${[['kids', 'Children choose'], ['parent', 'Ask for the parent code'], ['never', 'Do not ask']]
        .map(([k, l]) => `<button data-ask="${k}" class="${ask === k ? 'on' : ''}">${l}</button>`).join('')}
        <span class="pnote">The “Who’s playing?” screen is shown every time the app starts. “Do not ask” opens the child who played last.</span></div>` : ''}
  </div>`;
}
function kidsWire(p) {
  const q = sel => p.querySelectorAll(sel);
  q('[data-name]').forEach(i => i.oninput = () => {
    const id = i.dataset.name, name = i.value.trim();
    if (id === profileId()) { S.kidName = name; save(); renderHello(); } else Profiles.setLocal(id, { kidName: name });
  });
  q('[data-av]').forEach(b => b.onclick = () => { avEdit = avEdit === b.dataset.av ? null : b.dataset.av; showStats(); });
  q('[data-pick]').forEach(b => b.onclick = () => {
    const id = b.dataset.id;
    if (id === profileId()) { S.avatar = b.dataset.pick; save(); } else { Profiles.patch(id, { avatar: b.dataset.pick }); Cloud.markDirty(id); }
    avEdit = null; showStats();
  });
  q('[data-sw]').forEach(b => b.onclick = () => { sfx.pop(); enterHome(b.dataset.sw); });
  q('[data-del]').forEach(b => b.onclick = () => {
    const id = b.dataset.del, kid = profileCards().find(k => k.id === id);
    if (!confirm(`Delete ${kid.name || 'this child'}? The stickers and albums will be gone.`)) return;
    const wasPlaying = id === profileId();
    if (Profiles.list().length > 1) Cloud.forget(id);   // with an account the child is deleted in the cloud too, and on the family's other devices
    if (!Profiles.remove(id)) return;
    if (wasPlaying) { useProfile(Profiles.current()); renderHello(); renderCoins(); renderMute(); }
    avEdit = null; showStats();
  });
  if ($('kprem')) $('kprem').onclick = () => { parentTab = 'premium'; showStats(); };
  if ($('kadd')) $('kadd').onclick = () => { adding = { kidName: '', lang: S.lang || deviceLang(), parentWho: S.parentWho || '', avatar: freeAvatar() }; showStats(); };
  if (adding) {
    $('akname').oninput = e => { adding.kidName = e.target.value.trim(); };
    q('[data-al]').forEach(b => b.onclick = () => { adding.lang = b.dataset.al; showStats(); });
    q('[data-aw]').forEach(b => b.onclick = () => { adding.parentWho = b.dataset.aw; showStats(); });
    q('[data-apick]').forEach(b => b.onclick = () => { adding.avatar = b.dataset.apick; showStats(); });
    $('akadd').onclick = () => { newProfile(adding); adding = null; Cloud.onProfile(); showStats(); };
    $('akcancel').onclick = () => { adding = null; showStats(); };
  }
  q('[data-ask]').forEach(b => b.onclick = () => { Profiles.setDevice({ askWho: b.dataset.ask }); showStats(); });
}
// Settings: where the progress lives and how to keep it (startup.md 5.1). Web only: the native apps keep the saved
// game in their own storage, and a WebView cannot hand a file over.
const FILE_ERRORS = {
  big: 'This file is too large to be a saved progress.',
  unreadable: 'This file cannot be read. Choose a file saved here with “Save progress to a file”.',
  foreign: 'This is not a Stick & Play progress file.',
  newer: 'This file was saved by a newer version of the game. Update the game and try again.',
  empty: 'There are no children in this file.',
  room: 'There is no room on this device to put the current progress aside. Nothing was changed.',
};
function deviceHtml() {
  if (isNative) return '';
  const touch = matchMedia('(pointer: coarse)').matches;
  // the hint is for a game played in a browser tab on a phone or tablet
  const home = installed || !touch ? '' : isIOS
    ? `<div class="pnote phome"><b>Add the game to the Home Screen.</b> Safari deletes the progress of a site that was not opened for 7 days; a game on the Home Screen is kept. In Safari: the Share button, then “Add to Home Screen”. The game on the Home Screen starts empty: save the progress to a file here first and load it there.</div>`
    : `<div class="pnote phome"><b>Add the game to the Home screen.</b> It opens full screen, like an app, and keeps the same progress. ${canInstall()
        ? '<button id="pinstall">Add to Home screen</button>' : 'In the browser menu (⋮): “Add to Home screen” or “Install app”.'}</div>`;
  return `<div class="pkids pdev"><div class="ph">Progress on this device</div>
    <div class="pnote">The progress is kept in this browser on this device${Cloud.account() ? ', and a copy in your account' : ''}. Clearing the site data, another browser or another address starts an empty game.</div>
    ${home}
    <div class="pkrow"><button id="fsave">Save progress to a file</button><button id="fload">Load from a file</button>
      <input type="file" id="ffile" accept="application/json,.json" hidden></div>
    <div class="pnote">The file holds every child on this device. Keep it as a spare copy or load it on another device.</div>
    ${fileNote ? `<div class="pnote ${fileNote.bad ? 'pbad' : 'pgood'}">${esc(fileNote.text)}</div>` : ''}</div>`;
}
function deviceWire() {
  if (isNative) return;
  if ($('pinstall')) $('pinstall').onclick = () => install().then(() => showStats());
  $('fsave').onclick = async () => {
    save();
    const how = await saveBackupFile().catch(() => 'failed');
    fileNote = how === 'cancelled' ? null : how === 'failed' ? { text: 'The file could not be saved.', bad: true }
      : { text: how === 'shared' ? 'The file is ready: choose where to keep it.' : 'Saved to the downloads of this device.' };
    showStats();
  };
  $('fload').onclick = () => $('ffile').click();
  $('ffile').onchange = async e => {
    const f = e.target.files[0]; if (!f) return;
    const got = readBackup(await f.text().catch(() => null));
    if (got.error) { fileNote = { text: FILE_ERRORS[got.error], bad: true }; showStats(); return; }
    const kids = got.kids.map(n => n || 'No name').join(', ');
    if (!confirm(`Replace the progress on this device with the file${got.date ? ' saved on ' + got.date : ''}?\n\nIn the file: ${kids}.\nWhat is on this device now is put aside for 30 days.`)) { e.target.value = ''; return; }
    save();
    if (!restoreBackup(got.file, !!Cloud.account())) { fileNote = { text: FILE_ERRORS.room, bad: true }; showStats(); return; }
    detach(); location.reload();
  };
}
// Testing: what the last cold start did (startup.md 10)
const kb = n => n == null ? '?' : n < 1e6 ? Math.round(n / 1024) + ' KB' : (n / 1048576).toFixed(n < 1e9 ? 1 : 0) + ' MB';
function bootHtml() {
  const r = bootLog.route || {};
  return `<table class="pboot">
    <tr><td>Started</td><td>${bootLog.at} · launch screen left at ${bootLog.splashMs} ms</td></tr>
    <tr><td>Route</td><td>${r.screen || '—'}${r.profileId ? ' · ' + r.profileId.slice(0, 8) : ''}</td></tr>
    <tr><td>Address</td><td>${esc(location.origin + location.pathname)} · ${isNative ? 'native app' : installed ? 'from the Home screen' : 'browser tab'}</td></tr>
    <tr><td>Persistent storage</td><td>${storage.persisted == null ? 'the browser does not say' : storage.persisted ? 'granted: the browser keeps the progress when space runs low' : 'not granted: the browser may delete the progress'}</td></tr>
    <tr><td>Storage used</td><td>saved games ${kb(Profiles.size())} · the whole site ${kb(storage.usage)} of ${kb(storage.quota)}</td></tr>
    <tr><td>Cloud at the start</td><td>${bootLog.pull}</td></tr>
    <tr><td>Last pull</td><td>${Cloud.lastPull.at ? Cloud.lastPull.at + ' · ' : ''}${Cloud.lastPull.text}${Cloud.sim() ? ' · simulating: ' + Cloud.sim() : ''}</td></tr>
    ${bootLog.profiles.map(b => `<tr><td>at the start: ${esc(b.name || 'No name')} · ${b.id.slice(0, 8)}</td><td>${b.action}</td></tr>`).join('')}
    ${Profiles.list().map(p => { const l = Profiles.load(p.id).local, c = Cloud.lastPull.rows[p.id];
      return `<tr><td>now: ${esc(l.kidName || 'No name')} · ${p.id.slice(0, 8)}</td><td>base v${l.baseVersion || 0} · cloud ${c ? 'v' + c.cloud : '—'} · ${l.dirty ? 'dirty' : 'clean'}${c ? ' · ' + c.action : ''}</td></tr>`; }).join('')}
  </table>`;
}
function showStats() {
  $('lockpad').style.display = 'none'; const p = $('pstats'); p.style.display = 'block';
  const acc = S.stats.correct + S.stats.wrong ? Math.round(S.stats.correct / (S.stats.correct + S.stats.wrong) * 100) : 0;
  const words = learnedWords(), letters = learnedLetters().map(i => LETTERS[i][0]);
  const weak = Object.entries(S.stats.err).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, n]) => `${k} (${n})`);
  const mins = Math.round(S.usedMs / 60000);
  const where = tr => { const i = nextIdx(tr), n = TRACKS[tr].lessons.length;
    return `${doneCount(tr)} of ${n}` + (i < n ? ` · now: ${TRACKS[tr].islands.find(is => is.idx.includes(i)).label}` : ' · all done'); };
  // "Unlock all" is there once the free plan has its locks (premium.js), and for a family that already has premium
  const prem = Premium.limitsOn() || Premium.state().kind !== 'free';
  if (parentTab === 'premium' && !prem) parentTab = 'settings';
  const TABS = [['settings', 'Settings'], ...(prem ? [['premium', premiumText(S.lang).tab]] : []), ['progress', 'Progress'], ['testing', 'Testing']];
  const tabs = `<div class="ptabs">${TABS.map(([k, l]) => `<button data-pt="${k}" class="${parentTab === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  const PROGRESS = `<table>
    <tr><td>Level 1: words</td><td>${where('main')}</td></tr>
    <tr><td>Level 2: letters</td><td>${where('abc')}</td></tr>
    <tr><td>Level 3: letter teams</td><td>${where('lvl2')}</td></tr>
    <tr><td>Correct answers</td><td>${acc}%</td></tr>
    <tr><td>English words (${words.length} of ${WORDS.length})</td><td style="font-weight:400;font-size:22px">${words.slice(-12).join(', ') || '—'}</td></tr>
    <tr><td>Letters (${letters.length} of ${LETTERS.length})</td><td>${letters.join(' ') || '—'}</td></tr>
    <tr><td>Frequent mistakes</td><td style="font-weight:400;font-size:22px">${weak.join(', ') || '—'}</td></tr>
    <tr><td>Puzzles solved</td><td>${S.stats.puzzles}</td></tr>
    <tr><td>Pairs games</td><td>${S.stats.pairs || 0}</td></tr>
    <tr><td>Lines games</td><td>${S.stats.lines || 0} (${S.stats.linesWords || 0} words)</td></tr>
    <tr><td>Races</td><td>${S.stats.races || 0} (first in ${S.stats.raceWins || 0})</td></tr>
    <tr><td>Stickers collected</td><td>${uniqueOwned()} of ${STICKER_N}</td></tr>
    <tr><td>Time today</td><td>${mins} min</td></tr>
  </table>`;
  const TESTING = `<div class="ptime">For testing:
    <button id="gift">+100 coins</button>
    <button id="skip">+1 lesson</button>
    <button id="lv2">${S.lvl2open ? 'All levels open' : 'Open all levels'}</button>
    <button id="tryrace">Race</button>
    <button id="tlines1">Lines ★</button><button id="tlines2">Lines ★★</button><button id="tlines3">Lines ★★★</button><button id="tlines4">Lines sh·ch</button><button id="tlines5">Lines ai·oa</button><button id="tlines6">Lines in order</button>
    <button id="tup">Time is up</button>
    <button id="treset">Reset time</button>
    <button id="twho">Show “Who’s playing?”</button>
    <button id="tboot" class="${showBoot ? 'on' : ''}">Boot log</button>
    <button id="tvoices" class="${showVoices ? 'on' : ''}">Voices</button>
    <button id="reset">Reset everything</button></div>
  <div class="ptime">Free plan locks:
    ${[['', Premium.PAYWALL ? 'as released (on)' : 'as released (off)'], ['on', 'on'], ['free', 'on, as free'], ['premium', 'on, as premium']]
      .map(([k, l]) => `<button data-pay="${k}" class="${Premium.mode() === k ? 'on' : ''}">${l}</button>`).join('')}
    <span class="pnote">now: ${Premium.limitsOn() ? 'locks on' : 'locks off'} · ${Premium.state().kind} · lessons done ${Premium.lessonsDone()} of ${FREE.lessons} free</span></div>
  <div class="ptime">Cloud:
    <button id="csync">Sync now</button>
    <button id="cdoc" class="${cloudDoc ? 'on' : ''}">Show cloud doc</button>
    <button id="cconf">Force conflict</button>
    <button id="cnewer">Simulate: cloud newer</button>
    <button id="coff" class="${Cloud.sim() === 'offline' ? 'on' : ''}">Simulate: no network</button>
    <button id="crev" class="${Cloud.sim() === 'revoked' ? 'on' : ''}">Simulate: revoked</button>
    <span class="pnote">${Cloud.account() ? esc(Cloud.account().email) + ' · ' + Cloud.status().state : 'not signed in: sign in on the Settings tab'}</span></div>
  ${cloudDoc ? `<textarea class="vout" readonly>${esc(cloudDoc)}</textarea>` : ''}${showBoot ? bootHtml() : ''}${showVoices ? voicesHtml() : ''}`;
  const SETTINGS = '<div id="paccount"></div>' + kidsHtml() + deviceHtml() + `<div class="ptime">Music volume: <input type="range" id="mvol" min="0" max="100" step="5" value="${S.musicVol}"><b id="mvoln">${S.musicVol ? S.musicVol + '%' : 'off'}</b></div>
  <div class="ptime">Voice volume: <input type="range" id="vvol" min="0" max="100" step="10" value="${S.voiceVol}"><b id="vvoln">${S.voiceVol ? S.voiceVol + '%' : 'off'}</b></div>
  <div class="ptime">Spoken hints in lessons: <button id="hon" class="${S.hints ? 'on' : ''}">on</button><button id="hoff" class="${!S.hints ? 'on' : ''}">off</button>
    <span class="pnote">off: no Russian instructions, only English words and praise</span></div>
  <div class="ptime">Child calls you: ${[['', 'Mom or Dad'], ...Object.entries(PARENTS).map(([k, p]) => [k, p.label]), ['custom', 'Other']]
      .map(([k, l]) => `<button data-pw="${k}" class="${S.parentWho === k ? 'on' : ''}">${l}</button>`).join('')}</div>
  ${S.parentWho === 'custom' ? `<div class="ptime">«Позови …» <input type="text" id="pacc" maxlength="16" placeholder="тётю" value="${esc(S.parentAcc || '')}">
      «Покажи …» <input type="text" id="pdat" maxlength="16" placeholder="тёте" value="${esc(S.parentDat || '')}"><button id="plisten">Listen</button></div>` : ''}
  <div class="ptime">Voice: <span id="vstat">…</span> <button id="vtest">Test</button>${NTTS ? ' <button id="vinst">Install voices</button>' : ''}</div>
  <div class="ptime">Daily limit: ${[15,20,30,0].map(m => `<button data-m="${m}" class="${S.limit === m ? 'on' : ''}">${m ? m + ' min' : 'no limit'}</button>`).join('')}</div>`;
  p.innerHTML = tabs + (parentTab === 'progress' ? PROGRESS : parentTab === 'testing' ? TESTING : parentTab === 'premium' ? '<div id="ppremium"></div>' : SETTINGS);
  p.querySelectorAll('[data-pt]').forEach(b => b.onclick = () => { parentTab = b.dataset.pt; showStats(); });
  p.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { S.limit = +b.dataset.m; save(); showStats(); });
  if (parentTab === 'premium') mountPremium($('ppremium'), { lang: S.lang, toSettings: () => { parentTab = 'settings'; showStats(); } });
  if (parentTab === 'testing') {
    p.querySelectorAll('[data-pay]').forEach(b => b.onclick = () => { Premium.setMode(b.dataset.pay); showStats(); });
    $('gift').onclick = () => { S.coins += 100; save(); renderCoins(); showStats(); };
    $('skip').onclick = () => { Object.keys(TRACKS).forEach(tr => { const i = nextIdx(tr); if (i < TRACKS[tr].lessons.length) S.prog[tr][i] = 'ok'; }); save(); showStats(); };
    $('tup').onclick = () => { if (!S.limit) S.limit = 15; S.usedMs = S.limit * 60000; save(); go('album'); };
    $('lv2').onclick = () => { S.lvl2open = true; save(); showStats(); };
    // the first circle of that game in a theme (level 1) or a group (level 2)
    const gameAt = (tr, n, g) => TRACKS[tr].islands[n].idx.find(i => TRACKS[tr].lessons[i].game === g);
    $('tryrace').onclick = () => startAt('main', gameAt('main', 0, 'race'), 'race');
    // the first lines of theme 1, 3 and 6: level 1, 2 and 3
    [[1, 0], [2, 2], [3, 5]].forEach(([n, t]) => { $('tlines' + n).onclick = () => startAt('main', gameAt('main', t, 'lines'), 'lines'); });
    // letter teams (level 3): group 1 and 4, a team on one ball; reading (not on a path yet): letters in order
    $('tlines4').onclick = () => startAt('lvl2', gameAt('lvl2', 0, 'lines'), 'lines');
    $('tlines5').onclick = () => startAt('lvl2', gameAt('lvl2', 3, 'lines'), 'lines');
    $('tlines6').onclick = () => startAt('main', gameAt('main', 5, 'lines'), 'lines', { order: true });
    $('treset').onclick = () => { S.usedMs = 0; save(); showStats(); };
    $('twho').onclick = () => showWho();
    $('tboot').onclick = () => { showBoot = !showBoot; showStats(); if (showBoot) storageCheck().then(() => { if (showBoot && parentTab === 'testing' && $('tboot')) showStats(); }); };
    $('tvoices').onclick = () => { showVoices = !showVoices; showStats(); };
    if (showVoices) bindVoices(p, showStats);
    $('reset').onclick = () => { if (confirm('Reset all progress?')) resetAll(); };
    // the cloud copy (cloud-sync.md 10, startup.md 10)
    $('csync').onclick = async () => { await Cloud.pull(); await Cloud.push(); showBoot = true; showStats(); };
    $('cdoc').onclick = async () => { cloudDoc = cloudDoc ? null : JSON.stringify(await Cloud.cloudDocs().catch(e => ({ error: e.message })), null, 1); showStats(); };
    $('cconf').onclick = async () => { await Cloud.forceConflict(); showBoot = true; showStats(); };
    $('cnewer').onclick = () => { Cloud.forgetVersions(); location.reload(); };
    $('coff').onclick = () => { Cloud.setSim(Cloud.sim() === 'offline' ? '' : 'offline'); showStats(); };
    $('crev').onclick = () => { Cloud.setSim(Cloud.sim() === 'revoked' ? '' : 'revoked'); showStats(); };
  }
  if (parentTab !== 'settings') return;
  $('mvol').oninput = e => { const v = +e.target.value; music.setVol(v); $('mvoln').textContent = v ? v + '%' : 'off'; };
  $('vvol').oninput = e => { S.voiceVol = +e.target.value; save(); $('vvoln').textContent = S.voiceVol ? S.voiceVol + '%' : 'off'; };
  $('vvol').onchange = () => say(ru('Привет!'), en('Hello!'));
  $('hon').onclick = () => { S.hints = true; save(); showStats(); };
  $('hoff').onclick = () => { S.hints = false; save(); showStats(); };
  kidsWire(p);
  deviceWire();
  // the parent's account; when the device joins or leaves one, the children around the block may have changed
  mountAccount($('paccount'), { onJoined: () => {
    if (!Profiles.has(profileId())) { useProfile(Profiles.list()[0].id); U.home = 'home'; }
    renderHello(); renderCoins(); renderMute(); showStats();
  } });
  p.querySelectorAll('[data-pw]').forEach(b => b.onclick = () => { S.parentWho = b.dataset.pw; save(); showStats(); });
  if ($('pacc')) {
    $('pacc').oninput = e => { S.parentAcc = e.target.value.trim(); save(); };
    $('pdat').oninput = e => { S.parentDat = e.target.value.trim(); save(); };
    $('plisten').onclick = () => say(ru('Позови ' + parentAcc() + '! Покажи ' + parentDat() + '!'));
  }
  $('vtest').onclick =() => say(ru('Привет! Это проверка.'), en('Hello! This is a test.'));
  if (NTTS) {
    $('vinst').onclick = () => NTTS.install().catch(() => {});
    Promise.all(['ru-RU', 'en-US'].map(l => NTTS.supported(l).catch(() => false)))
      .then(([r, e]) => { $('vstat').textContent = `Russian ${r ? '✓' : '✗'} · English ${e ? '✓' : '✗'}${ttsState.log ? ' · ' + ttsState.log : ''}`; });
  } else $('vstat').textContent = 'browser speech';
}
onEnter('parent', renderParent);
