// Start-up (Specs/features/startup.md): from the launch screen to the first screen of the app.
//   boot()        the steps of a cold start: read the device, choose the screen, wait for the launch screen, show it
//   route()       which screen comes after the launch screen, by what is stored on the device
//   enterHome(id) a child starts playing: the profile is loaded, the new day and its coins are counted for that child
// and the two screens that can come before the home screen: the first run (for the grown-up) and "Who's playing?".
import { $ } from './stage.js';
import { U } from './session.js';
import { Profiles } from './profiles.js';
import { S, save, useProfile, newProfile, profileCards, avatarPic, deviceLang, LANGS } from './state.js';
import { ECON, SETS } from './data.js';
import { I } from './icons.js';
import { today, esc } from './util.js';
import { say, ru, sfx, renderMute } from './audio.js';
import { renderHello, renderCoins, overlay, closeOverlay, addCoins } from './ui.js';
import { go, onEnter } from './nav.js';

/* ================= the launch screen ================= */
// #splash is the first thing in the markup and is drawn before any script runs; here it only goes away.
const MIN = 2000, MAX = 2500;  // ms from the start of the page: long enough to see the picture, never a wait for the network
const splash = document.getElementById('splash');
// a touch on the launch screen is not a touch in the game: nothing reacts and the music does not start
if (splash) splash.addEventListener('pointerdown', ev => ev.stopPropagation());
const until = ms => new Promise(res => setTimeout(res, Math.max(0, ms - performance.now())));
// Resolves when the launch screen may leave: it has been up for MIN and `ready` has settled, or at MAX whatever
// `ready` does. `ready` is what the start waits for (the cloud copy of the progress); without it that is at MIN.
export function splashTime(ready) {
  const settled = Promise.resolve(ready).catch(() => {});
  return Promise.all([until(MIN), Promise.race([settled, until(MAX)])]);
}
export function hideSplash() {
  if (!splash || splash.classList.contains('out')) return;
  splash.classList.add('out');
  setTimeout(() => splash.remove(), 400);
}

/* ================= the route ================= */
// Where the launch screen leads (startup.md 4.2). Only what is stored on this device decides; the network never does.
//   { screen: 'firstrun' }                a device without profiles: the screen for the grown-up
//   { screen: 'who' }                     two or more children and they are asked who plays
//   { screen: 'home', profileId }         one child, or several and the parent chose "do not ask"
export function route() {
  const list = Profiles.list();
  if (!list.length) return { screen: 'firstrun' };
  if (list.length === 1) return { screen: 'home', profileId: list[0].id };
  if (Profiles.device().askWho === 'never') return { screen: 'home', profileId: Profiles.lastPlayed().id };
  return { screen: 'who' };
}
const starters = {
  home: r => enterHome(r.profileId),
  who: () => showWho(),
  firstrun: () => go('firstrun'),
};

/* ================= a child starts playing ================= */
// Called when the profile is known: right after the launch screen, by a tap on "Who's playing?", by "Start" on the
// first run, by "Switch" in the parent zone. The new day (the minutes of the daily limit start again) and the coins
// for coming back belong to this child. `greet`: the voice says hello.
export function enterHome(profileId, { greet = false } = {}) {
  if (!useProfile(profileId)) return false;
  const day = today(), newDay = S.day !== day, firstEver = !S.day;
  if (newDay) { S.day = day; S.usedMs = 0; save(); }
  U.home = 'home'; U.streak = 0; U.pathTr = 'main'; U.sceneId = SETS[0].id; U.parentThen = null;
  renderHello(); renderCoins(); renderMute();
  go('home');
  if (greet) say(ru('Привет!'));
  // coins for the first visit of the day; not on the very first day, the child has the starting coins
  if (newDay && !firstEver) setTimeout(() => {
    if (U.current !== 'home') return;
    overlay(`<div class="bigpic">${I.coin}</div><div class="gain">+${ECON.daily} ${I.coin}</div><div class="row"><button class="btn orange" id="hi">Hi!</button></div>`);
    $('hi').onclick = () => { closeOverlay(); addCoins(ECON.daily, { x: 600, y: 400 }); say('Монетки за то, что пришёл!'); };
  }, 400);
  return true;
}

/* ================= texts of the two screens ================= */
// Text only, for the grown-up, in the three languages of the instructions (startup.md 3.2, 3.4).
const T = {
  ru: { title: 'Это для взрослых', ask: 'Как зовут ребёнка?', lang: 'Язык инструкций:', start: 'Начать', skip: 'Пропустить',
        account: 'Уже есть аккаунт? Войти, чтобы вернуть прогресс', who: 'Кто играет?', noname: 'Без имени', eg: 'Маша' },
  en: { title: 'For grown-ups', ask: 'What is the child’s name?', lang: 'Instructions language:', start: 'Start', skip: 'Skip',
        account: 'Already have an account? Sign in to restore progress', who: 'Who’s playing?', noname: 'No name', eg: 'Masha' },
  uk: { title: 'Це для дорослих', ask: 'Як звати дитину?', lang: 'Мова інструкцій:', start: 'Почати', skip: 'Пропустити',
        account: 'Вже є акаунт? Увійти, щоб повернути прогрес', who: 'Хто грає?', noname: 'Без імені', eg: 'Маша' },
};

/* ================= first run ================= */
// One short screen, shown once on a device without profiles. Nothing is spoken: it is for the grown-up.
let frLang = deviceLang();
// "Already have an account?": the sign-in comes with the parent account (cloud-sync); until a handler is set the line is hidden
let signIn = null;
export function onSignIn(fn) { signIn = fn; }
function renderFirstRun() {
  const t = T[frLang];
  $('frTitle').textContent = t.title; $('frAsk').textContent = t.ask; $('frLangL').textContent = t.lang;
  $('frName').placeholder = t.eg; $('frStart').textContent = t.start; $('frSkip').textContent = t.skip;
  $('frLangs').innerHTML = LANGS.map(([k, name]) => `<button data-l="${k}" class="${k === frLang ? 'on' : ''}">${name}</button>`).join('');
  $('frLangs').querySelectorAll('button').forEach(b => b.onclick = () => { frLang = b.dataset.l; renderFirstRun(); });
  $('frAcc').textContent = t.account; $('frAcc').style.display = signIn ? '' : 'none';
}
function firstRunDone(withName) {
  const id = newProfile({ kidName: withName ? $('frName').value.trim() : '', lang: frLang });
  if (id) enterHome(id, { greet: true });
}
$('frStart').onclick = () => firstRunDone(true);
$('frSkip').onclick = () => firstRunDone(false);
$('frName').onkeydown = ev => { if (ev.key === 'Enter') firstRunDone(true); };
$('frAcc').onclick = () => { if (signIn) signIn(); };
onEnter('firstrun', renderFirstRun);

/* ================= who's playing? ================= */
// Shown at a cold start when the device has two or more children (and from the Testing tab). No profile is chosen
// yet: the settings and the language are those of the child who played last, the parent zone opens on that profile.
export function showWho() {
  const last = Profiles.lastPlayed();
  if (!last) return go('firstrun');
  useProfile(last.id, false);
  U.home = 'who'; renderMute();
  go('who');
}
function renderWho() {
  const cards = profileCards(), last = Profiles.lastPlayed(), t = T[S.lang] || T.en, ask = Profiles.device().askWho;
  $('whoTitle').textContent = t.who;
  $('whoLock').innerHTML = I.lock;
  $('whoCards').innerHTML = cards.map(c => `<button class="whocard ${last && c.id === last.id ? 'last' : ''}" data-id="${c.id}">
      <span class="wav">${avatarPic(c.avatar)}</span><span class="wname ${c.name ? '' : 'none'}">${esc(c.name || t.noname)}</span></button>`).join('');
  let chosen = false;
  $('whoCards').querySelectorAll('.whocard').forEach(b => b.onclick = () => {
    if (chosen) return;
    const enter = () => enterHome(b.dataset.id, { greet: true });
    // "Ask for the parent code": the same lock as the parent zone, then the child's home screen
    if (ask === 'parent') { sfx.pop(); U.parentThen = enter; go('parent'); return; }
    chosen = true; sfx.pop(); b.classList.add('picked');
    setTimeout(enter, 380);
  });
  say(ru('Кто играет?'));
}
onEnter('who', renderWho);

/* ================= boot ================= */
// What the last cold start did, for the Testing tab ("Boot log")
export const bootLog = { at: '', route: null, splashMs: 0, pull: 'no account on this device', profiles: [] };
// A cold start (startup.md 4.1). The numbers are the steps of the spec.
export async function boot() {
  // 2. what is on the device: a save from before profiles becomes profile 1
  const migrated = Profiles.migrate();
  // 3. the screen after the launch screen, by local data
  const r = route();
  // 4-5. the cloud copy of the progress is asked for here and applied if it comes in time (cloud-sync; not yet)
  const pulled = null;
  // 6. the launch screen leaves; the chosen screen is drawn under it first
  await splashTime(pulled);
  starters[r.screen](r);
  hideSplash();
  Object.assign(bootLog, { at: new Date().toLocaleTimeString(), route: r, splashMs: Math.round(performance.now()),
    profiles: Profiles.list().map(p => { const l = Profiles.load(p.id).local;
      return { id: p.id, name: l.kidName, baseVersion: l.baseVersion, dirty: l.dirty, action: p.id === migrated ? 'migrated from the old save' : 'local, unchanged' }; }) });
  return r;
}
