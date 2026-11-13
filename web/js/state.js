// The running game of the playing profile and everything derived from it: progress, what is open, the daily limit.
import { STICKERS, SETS, ECON, TRACKS, THEMES, THEME_ORDER, LETTERS, CHUNKS, PRAISE, pic } from './data.js';
import { one } from './util.js';
import { Profiles } from './profiles.js';

/* ================= state ================= */
// a new game; a profile's saved game is laid over it
const fresh = () => ({
  coins: ECON.start,
  inv: {},        // stickers on the shelf, ready to place: key -> count
  bought: {},     // total ever bought: key -> count
  scenes: {},     // sceneId -> placed items
  unlocked: [],   // (old saves) scenes opened by completing sets — no longer used
  rewarded: [],   // set ids whose completion reward was given
  stats: { tasks:0, correct:0, wrong:0, puzzles:0, pairs:0, lines:0, linesWords:0, races:0, raceWins:0, words:{}, letters:{} },
  limit: 0, day: '', usedMs: 0,   // daily limit in minutes, 0 = none; only a parent sets it
  prog: null,     // track -> { lessonIdx: 'ok' | 'gold' }
  lastTrack: null,
  stickHint: false, // the hand on the album shelf was shown (features/stick.md 3)
  lastScene: null,  // the album the child opened last: Stick on the home screen opens it (features/stick.md 3)
});
// The running game of the profile that is playing. It is always this one object: useProfile() refills it in place,
// so modules may keep the import. Until the start-up has chosen a profile (startup.js) it is a new game that is not
// stored. Stored per profile by profiles.js (the child's name and mute stay on the device).
export const S = fresh();
let PID = null;   // id of the profile S belongs to; null until one is chosen
export const profileId = () => PID;
export const save = () => { if (PID) Profiles.save(PID, S); };
// makes the profile the playing one and loads its saved game into S, repairing what old saves got wrong
// `played` false: only look at the profile ("Who's playing?" shows the settings of the child who played last)
export function useProfile(id, played = true) {
  if (!(played ? Profiles.switch(id) : Profiles.has(id))) return false;
  const { state, local } = Profiles.load(id);
  PID = id;
  Object.keys(S).forEach(k => delete S[k]);
  Object.assign(S, fresh(), state, { kidName: local.kidName || '', mute: !!local.mute });
  S.prog = Object.assign({ main: {}, lvl2: {} }, S.prog);
  // saves made before pairs, lines and the race became circles of their own (progV 2): the lessons were numbered
  // without them. A lesson done then is done now together with its games, which were played inside it.
  if (S.progV !== 2) {
    Object.keys(TRACKS).forEach(tr => {
      const old = S.prog[tr]; S.prog[tr] = {};
      Object.keys(old).forEach(k => (TRACKS[tr].before[k] || []).forEach((i, n) => { S.prog[tr][i] = n ? 'ok' : old[k]; }));
    });
    S.progV = 2;
  }
  S.stats.err = S.stats.err || {};   // word / letter -> mistakes
  // drop stickers that no longer exist (renamed words), so old saves keep working
  ['inv', 'bought'].forEach(b => Object.keys(S[b]).forEach(k => { if (!STICKERS[k]) delete S[b][k]; }));
  // old album pages: meadow -> farm, room -> toys; stickers on removed pages go back to the shelf
  [['meadow', 'farm'], ['room', 'toys']].forEach(([a, b]) => { if (S.scenes[a]) { S.scenes[b] = (S.scenes[b] || []).concat(S.scenes[a]); delete S.scenes[a]; } });
  Object.keys(S.scenes).forEach(id => {
    const keep = !!SETS.find(s => s.id === id);
    S.scenes[id] = S.scenes[id].filter(it => {
      if (!STICKERS[it.k]) return false;
      if (!keep) { S.inv[it.k] = (S.inv[it.k] || 0) + 1; return false; }
      return true;
    });
    if (!keep) delete S.scenes[id];
  });
  Object.keys(S.scenes).forEach(id => S.scenes[id] = S.scenes[id].filter(it => {
    if (STICKERS[it.k].set === id) return true;
    S.inv[it.k] = (S.inv[it.k] || 0) + 1; return false;
  }));
  // old saves had a 20-minute limit on by default; switch it off unless a parent chose it
  if (!S.limitSet) { S.limit = 0; S.limitSet = true; }
  // settings (3.10): music volume 0..100 (50 = the designed level), who the child calls for help
  if (S.musicVol == null) S.musicVol = S.music === false ? 0 : 50;
  S.parentWho = S.parentWho || '';
  if (S.voiceVol == null) S.voiceVol = 100;      // voice volume 0..100
  if (!LANGS.some(l => l[0] === S.lang)) S.lang = deviceLang();   // language of the instructions (3.10)
  if (!AVATARS.includes(S.avatar)) S.avatar = freeAvatar(id);    // the picture on "Who's playing?"
  if (S.hints == null) S.hints = true;           // spoken task instructions in lessons; praise and English words always play
  save();
  return true;
}
/* ================= children ================= */
// languages of the instructions; the device language if it is one of them, English otherwise
export const LANGS = [['en', 'English'], ['ru', 'Русский'], ['uk', 'Українська'], ['de', 'Deutsch'], ['fr', 'Français'], ['es', 'Español']];
export function deviceLang() {
  const l = (typeof navigator !== 'undefined' && navigator.language || 'en').slice(0, 2).toLowerCase();
  return LANGS.some(x => x[0] === l) ? l : 'en';
}
// a child's picture on "Who's playing?": the eight word stickers of the free Farm set (startup.md 4.5)
export const AVATARS = SETS[0].items.slice(0, 8).map(([, w]) => SETS[0].id + ':' + w);
export const avatarPic = key => pic(STICKERS[key] || STICKERS[AVATARS[0]]);
// the first picture no other child on this device has
export function freeAvatar(exceptId) {
  const taken = Profiles.list().filter(p => p.id !== exceptId).map(p => Profiles.load(p.id).state.avatar);
  return AVATARS.find(a => !taken.includes(a)) || AVATARS[0];
}
// a new child: starts an empty game with a name (kept on the device), settings and a free picture; null at the limit
export function newProfile({ kidName = '', lang = deviceLang(), parentWho = '', avatar } = {}) {
  return Profiles.create({ kidName, state: { lang, parentWho, avatar: AVATARS.includes(avatar) ? avatar : freeAvatar() } });
}
// every child on the device, in the order of creation: what the lists show without loading the game
export function profileCards() {
  return Profiles.list().map(p => {
    const { state, local } = Profiles.load(p.id), words = (state.stats || {}).words || {};
    return { id: p.id, name: local.kidName || '', avatar: AVATARS.includes(state.avatar) ? state.avatar : AVATARS[0],
             words: Object.values(words).filter(n => n > 0).length, playing: p.id === PID, lastPlayedAt: p.lastPlayedAt || 0 };
  });
}

// who the child is told to call: '' = "mom or dad"; 'custom' uses parentAcc / parentDat
export const PARENTS = {
  mom:     { label: 'Mom',     acc: 'маму',     dat: 'маме' },
  dad:     { label: 'Dad',     acc: 'папу',     dat: 'папе' },
  grandma: { label: 'Grandma', acc: 'бабушку',  dat: 'бабушке' },
  grandpa: { label: 'Grandpa', acc: 'дедушку',  dat: 'дедушке' },
};
// "позови маму" (whom?) and "покажи маме" (to whom?)
export const parentAcc = () => S.parentWho === 'custom' ? (S.parentAcc || 'маму или папу') : (PARENTS[S.parentWho] || { acc: 'маму или папу' }).acc;
export const parentDat = () => S.parentWho === 'custom' ? (S.parentDat || 'маме или папе') : (PARENTS[S.parentWho] || { dat: 'маме или папе' }).dat;
// praise sometimes carries the child's name, not every time
export const praise = () => one(PRAISE);   // the name is never spoken: it is shown on screen only

// derived from the saved game
export const uniqueOwned = () => Object.keys(S.bought).filter(k => S.bought[k] > 0).length;
// an album page opens when the first sticker of its set is bought
export const sceneOpen = id => Object.keys(S.bought).some(k => S.bought[k] > 0 && STICKERS[k].set === id);
// the daily limit set by a parent (0 = none)
export function timeUp() { return S.limit > 0 && S.usedMs >= S.limit * 60000; }
// a parent's "Reset everything"
export function resetAll() { Profiles.wipe(); location.reload(); }

/* ================= progress ================= */
export const isDone = (tr, i) => !!S.prog[tr][i];
export function nextIdx(tr) { const n = TRACKS[tr].lessons.length; for (let i = 0; i < n; i++) if (!isDone(tr, i)) return i; return n; }
export const doneCount = tr => Object.keys(S.prog[tr]).length;
export const wordsOf = ls => THEMES[ls.theme].slice(ls.part * 4, ls.part * 4 + 4).map(x => x[0]);
export const learnedWords = () => TRACKS.main.lessons.flatMap((ls, i) => isDone('main', i) && ls.kind === 'words' ? wordsOf(ls) : []);
export const learnedLetters = () => TRACKS.main.lessons.filter((ls, i) => isDone('main', i) && ls.kind === 'letter').map(ls => ls.li);
// level 2 opens when level 1 is finished (or the parent opens it)
export const levelOpen = tr => tr === 'main' || S.lvl2open || nextIdx('main') >= TRACKS.main.lessons.length;
export const learnedChunks = () => TRACKS.lvl2.lessons.filter((ls, i) => isDone('lvl2', i) && ls.kind === 'chunk').map(ls => ls.ci);
export function chunkPool(ci) {
  const ids = [...new Set([...learnedChunks(), ci])];
  for (let i = 0; ids.length < 3 && i < CHUNKS.length; i++) if (!ids.includes(i)) ids.push(i);
  return ids;
}
export const themeStarted = t => isDone('main', TRACKS.main.islands[THEME_ORDER.indexOf(t)].idx[0]);
