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
import { renderHello, renderCoins, renderCollN, overlay, closeOverlay, addCoins } from './ui.js';
import { go, onEnter } from './nav.js';
import { Cloud } from './cloud.js';
import { mountSignIn, mountKids } from './account.js';
import { Premium, promoAllowed } from './premium.js';
import { mountPromoStart, premiumText } from './paywall.js';

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
  Cloud.onProfile();
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
// Text only, for the grown-up, in every language of the instructions (startup.md 3.2, 3.4).
const T = {
  ru: { title: 'Это для взрослых', ask: 'Как зовут ребёнка?', lang: 'Язык инструкций:', start: 'Начать', skip: 'Пропустить',
        account: 'Уже есть аккаунт? Войти, чтобы вернуть прогресс', who: 'Кто играет?', noname: 'Без имени', eg: 'Маша' },
  en: { title: 'For grown-ups', ask: 'What is the child’s name?', lang: 'Instructions language:', start: 'Start', skip: 'Skip',
        account: 'Already have an account? Sign in to restore progress', who: 'Who’s playing?', noname: 'No name', eg: 'Masha' },
  uk: { title: 'Це для дорослих', ask: 'Як звати дитину?', lang: 'Мова інструкцій:', start: 'Почати', skip: 'Пропустити',
        account: 'Вже є акаунт? Увійти, щоб повернути прогрес', who: 'Хто грає?', noname: 'Без імені', eg: 'Маша' },
  de: { title: 'Für Erwachsene', ask: 'Wie heißt das Kind?', lang: 'Sprache der Anleitungen:', start: 'Los geht’s', skip: 'Überspringen',
        account: 'Schon ein Konto? Anmelden und den Fortschritt zurückholen', who: 'Wer spielt?', noname: 'Ohne Namen', eg: 'Mia' },
  fr: { title: 'Pour les adultes', ask: 'Comment s’appelle l’enfant ?', lang: 'Langue des consignes :', start: 'Commencer', skip: 'Passer',
        account: 'Déjà un compte ? Se connecter pour retrouver la progression', who: 'Qui joue ?', noname: 'Sans nom', eg: 'Léa' },
  es: { title: 'Para adultos', ask: '¿Cómo se llama el niño?', lang: 'Idioma de las instrucciones:', start: 'Empezar', skip: 'Omitir',
        account: '¿Ya tienes cuenta? Inicia sesión para recuperar el progreso', who: '¿Quién juega?', noname: 'Sin nombre', eg: 'Lucía' },
};

/* ================= first run ================= */
// One short screen, shown once on a device without profiles. Nothing is spoken: it is for the grown-up.
let frLang = deviceLang();
// 'form': the name and the language; 'signin': "Already have an account?" was pressed; 'kids': the children that came
// from the cloud get their names (startup.md 3.3)
let frStep = 'form', frKids = [], frWays = false;   // frWays: the server offers a way to sign in
Cloud.providers().then(w => { frWays = w.length > 0; if (U.current === 'firstrun' && frStep === 'form') renderFirstRun(); });
function frShow() {
  $('frForm').style.display = frStep === 'kids' ? 'none' : '';
  $('frAct').style.display = frStep === 'form' ? '' : 'none';
  $('frSign').style.display = frStep === 'signin' || frStep === 'promo' ? '' : 'none';
  $('frKids').style.display = frStep === 'kids' ? '' : 'none';
}
// after the names: one child goes home, several are asked who plays
function afterKids() { frStep = 'form'; frKids = []; const r = route(); if (r.screen === 'home') enterHome(r.profileId, { greet: true }); else starters[r.screen](r); }
function showKids(ids) { frStep = 'kids'; frKids = ids; go('firstrun'); }
function renderFirstRun() {
  const t = T[frLang] || T.en;
  $('frTitle').textContent = t.title; $('frAsk').textContent = t.ask; $('frLangL').textContent = t.lang;
  $('frName').placeholder = t.eg; $('frStart').textContent = t.start; $('frSkip').textContent = t.skip;
  $('frLangs').innerHTML = LANGS.map(([k, name]) => `<button data-l="${k}" class="${k === frLang ? 'on' : ''}">${name}</button>`).join('');
  $('frLangs').querySelectorAll('button').forEach(b => b.onclick = () => { frLang = b.dataset.l; renderFirstRun(); });
  // signed in with an empty cloud: the line has done its work, the child made here becomes the account's first
  $('frAcc').textContent = t.account; $('frAcc').style.display = Cloud.account() || !frWays ? 'none' : '';
  // "I have a promo code" (subscription.md 5): on Android and on the site, where the free plan has its locks and the
  // server offers a way to sign in; gone once the family has premium
  $('frPromo').textContent = premiumText(frLang).line;
  $('frPromo').style.display = promoAllowed && Premium.limitsOn() && frWays && Premium.state().kind !== 'premium' ? '' : 'none';
  const joined = r => { if (r && r.kids && r.kids.length) showKids(r.kids); else { frStep = 'form'; renderFirstRun(); } };
  if (frStep === 'promo') mountPromoStart($('frSign'), { lang: frLang, onBack: () => { frStep = 'form'; renderFirstRun(); }, onDone: joined });
  if (frStep === 'signin') mountSignIn($('frSign'), { lang: frLang, firstRun: true,
    onBack: () => { frStep = 'form'; renderFirstRun(); },
    onDone: r => { if (r.kids && r.kids.length) showKids(r.kids); else { frStep = 'form'; renderFirstRun(); } } });
  if (frStep === 'kids') mountKids($('frKids'), frKids, frLang, afterKids);
  frShow();
}
function firstRunDone(withName) {
  const id = newProfile({ kidName: withName ? $('frName').value.trim() : '', lang: frLang });
  if (id) enterHome(id, { greet: true });
}
$('frStart').onclick = () => firstRunDone(true);
$('frSkip').onclick = () => firstRunDone(false);
$('frName').onkeydown = ev => { if (ev.key === 'Enter') firstRunDone(true); };
$('frAcc').onclick = () => { frStep = 'signin'; renderFirstRun(); };
$('frPromo').onclick = () => { frStep = 'promo'; renderFirstRun(); };
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
// The cloud changed the game on screen, or the children on the device (startup.md 4.3): redrawn without sound or motion
Cloud.onChange(({ applied, profiles }) => {
  if (applied) { renderHello(); renderCoins(); renderCollN(); renderMute(); if (U.current === 'path') go('path'); }
  if (profiles && U.current === 'who') { const r = route(); if (r.screen === 'who') showWho(); else starters[r.screen](r); }
});
// A cold start (startup.md 4.1). The numbers are the steps of the spec.
export async function boot() {
  // 2. what is on the device: a save from before profiles becomes profile 1
  const migrated = Profiles.migrate();
  // 3. the screen after the launch screen, by local data
  let r = route();
  // 4-5. the cloud copy of the progress: asked for now, applied if it comes before the launch screen must leave.
  // A late answer is applied by cloud.js in a safe moment. The way back from Google / Apple finishes the sign-in first.
  let inTime = false, pulledRows = null;
  const pulled = Promise.resolve(Cloud.resume()).then(back => {
    if (back && back.step === 'done' && back.kids.length && back.kids.length === Profiles.list().length) frKids = back.kids;
    return Cloud.bootPull();
  }).then(rows => { inTime = true; pulledRows = rows; return rows; });
  // 6. the launch screen leaves; the chosen screen is drawn under it first
  await splashTime(pulled);
  const asked = Cloud.lastPull.text;
  // the cloud does not change the route, with two exceptions: the child the route led to was deleted on another
  // device, and the device has just got its children from the cloud (they are named first)
  if (frKids.length) showKids(frKids);
  else { if (r.screen === 'who' ? Profiles.list().length < 2 : !(r.profileId && Profiles.has(r.profileId))) r = route(); starters[r.screen](r); }
  hideSplash();
  Object.assign(bootLog, { at: new Date().toLocaleTimeString(), route: r, splashMs: Math.round(performance.now()),
    pull: !pulledRows && inTime ? asked : inTime ? asked + ', in time' : 'no answer before the launch screen left: applied later, in a safe moment',
    profiles: Profiles.list().map(p => { const l = Profiles.load(p.id).local;
      return { id: p.id, name: l.kidName, baseVersion: l.baseVersion, dirty: l.dirty, action: p.id === migrated ? 'migrated from the old save' : pulledRows && pulledRows[p.id] ? pulledRows[p.id].action : 'local, unchanged' }; }) });
  return r;
}
