// A lesson: its intro cards and task list, running the tasks one after another, the reward at the end.
import { $ } from './stage.js';
import { U } from './session.js';
import { S, save, isDone, wordsOf, learnedWords, learnedLetters, learnedChunks } from './state.js';
import { TRACKS, THEMES, LETTERS, CHUNKS, CHUNK_WORD, WORD_INFO, SETS, STICKERS, ECON, pic, picOf, markWord, sndOf } from './data.js';
import { I, ICON_NEXT } from './icons.js';
import { one, shuffle } from './util.js';
import { say, en, cheer, sfx } from './audio.js';
import { overlay, closeOverlay, addCoins, confetti } from './ui.js';
import { go } from './nav.js';

/* ================= intro cards ================= */
export function showIntro(cards, done) {
  go('intro'); if (U.current !== 'intro') return;
  let i = 0;
  const show = () => {
    const c = cards[i];
    $('icard').innerHTML = `<div class="icard">${c.html}</div>`;
    $('idots').innerHTML = cards.map((_, j) => `<div class="dot ${j <= i ? 'done' : ''}"></div>`).join('');
    $('icard').firstChild.onclick = () => c.speak();
    setTimeout(c.speak, 200);
  };
  $('inext').onclick = () => { sfx.pop(); i++; if (i < cards.length) show(); else done(); };
  show();
}

/* ================= lessons ================= */
export function reviewWord(exclude) {
  const pool = learnedWords().filter(w => !exclude.includes(w));
  if (!pool.length) return null;
  const weak = pool.filter(w => S.stats.err[w] > 0);   // words with mistakes come back more often
  return weak.length && Math.random() < .7 ? one(weak) : one(pool);
}
// letters shown as options: learned ones + the focus; in the first lessons pad with the next letters in order
export function letterPool(li) {
  const ids = [...new Set([...learnedLetters(), li])];
  for (let i = 0; ids.length < 3 && i < LETTERS.length; i++) if (!ids.includes(i)) ids.push(i);
  return ids;
}
export function letterIntro(li) {
  const [ch, ws] = LETTERS[li];
  return { html: `<div class="letterbig">${ch}${ch.toLowerCase()}</div>
      <div class="lpics">${ws.map(([w, e]) => `<div>${picOf(w, e)}<small><b>${w[0]}</b>${w.slice(1)}</small></div>`).join('')}</div>`,
    speak: () => say(en(ch + '.'), en(`${ch} is for ${ws.map(w => w[0]).join(', and ')}.`)) };
}
export function chunkIntro(ci) {
  const [c, s, ws] = CHUNKS[ci];
  return { html: `<div class="chunkbig">${c}</div>
      <div class="lpics">${ws.map(([w, e]) => `<div>${picOf(w, e)}<small>${markWord(w, c)}</small></div>`).join('')}</div>`,
    speak: () => say(en(s + '.'), en(`${s}, as in ${ws.map(w => w[0]).join(', and ')}.`)) };
}
// extra words when the lesson's own are not enough: this theme's learned words, then any learned, then the whole theme
export const themeWordsFirst = t => [...learnedWords().filter(w => WORD_INFO[w].theme === t), ...learnedWords(), ...THEMES[t].map(x => x[0])];
// level 2: words of the learned letter teams first, then every level-2 word
export const chunkWordsFirst = cis => [...learnedChunks().filter(c => !cis.includes(c)), ...CHUNKS.map((_, i) => i)].flatMap(ci => CHUNKS[ci][2].map(x => x[0]));

export function buildLesson(tr, idx) {
  const ls = TRACKS[tr].lessons[idx];
  let intro = [], tasks = [];
  // every lesson mixes task types: pictures, letters, drag-and-drop; a words lesson ends with a puzzle.
  // Pairs, lines and the race are circles of their own on the path, right after the lesson they belong to.
  if (ls.kind === 'game') {
    const of = ls.of, level = ls.level;
    if (of.kind === 'words') tasks = [{ t: 'pairs', words: shuffle(wordsOf(of)), more: themeWordsFirst(of.theme), level }];
    else if (of.kind === 'letter') tasks = [{ t: 'lines', li: of.li, theme: of.theme, level }];   // balls that make words (Specs/features/Lines.md)
    else if (of.kind === 'review') {
      // wrong pictures on the easy level come from other themes
      const ws = shuffle(THEMES[of.theme].map(x => x[0]));
      tasks = [{ t: 'race', words: ws, more: learnedWords(), far: learnedWords().filter(w => WORD_INFO[w].theme !== of.theme), level }];
    } else if (of.kind === 'chunk') { const a = of.ci - of.ci % 2; tasks = [{ t: 'lines', ci: of.ci, cis: [a, a + 1], level }]; }
    else {
      // level 2 review: pairs, then the race, on the four example words of the group
      const words = of.cis.flatMap(ci => shuffle(CHUNKS[ci][2].map(x => x[0])));
      tasks = [{ t: ls.game, words, more: chunkWordsFirst(of.cis), far: [], level }];
    }
  } else if (ls.kind === 'words') {
    const ws = shuffle(wordsOf(ls));
    intro = wordsOf(ls).map(w => ({ html: `<div class="pic">${pic(WORD_INFO[w])}</div><div class="word">${w}</div>`, speak: () => say(en(w)) }));
    tasks = [{ t: 'pick', w: ws[0] }, { t: 'pick', w: ws[1] }, { t: 'pair', w: ws[2] }, { t: 'pick', w: ws[3] },
             { t: 'puzzle', w: one(ws), level: ls.level }];
  } else if (ls.kind === 'letter') {
    intro = [letterIntro(ls.li)];
    tasks = [{ t: 'trace', li: ls.li }, { t: 'find', li: ls.li }, { t: 'first', li: ls.li },
             { t: 'trace', li: ls.li, low: true }, { t: 'first', li: ls.li }];
    const r = reviewWord([]); if (r) tasks.splice(3, 0, { t: 'pick', w: r });
  } else if (ls.kind === 'chunk') {
    // level 2: one letter team per lesson; tracing grows from two letters to a whole word
    const [w1, w2] = shuffle(CHUNKS[ls.ci][2].map(x => x[0]));
    intro = [chunkIntro(ls.ci)];
    tasks = [{ t: 'trace', text: CHUNKS[ls.ci][0], ci: ls.ci }, { t: 'chunk', ci: ls.ci }, { t: 'missing', w: w1 },
             { t: 'trace', text: w1, ci: ls.ci }, { t: 'missing', w: w2 }, { t: 'puzzle', w: w2, e: CHUNK_WORD[w2].e, level: ls.level }];
  } else if (ls.kind === 'chunkreview') {
    const [a, b] = shuffle(ls.cis), wa = shuffle(CHUNKS[a][2].map(x => x[0])), wb = shuffle(CHUNKS[b][2].map(x => x[0]));
    const old = learnedChunks().filter(c => !ls.cis.includes(c));
    tasks = [{ t: 'chunk', ci: a }, { t: 'missing', w: wb[0] }, { t: 'trace', text: wa[0], ci: a },
             { t: 'chunk', ci: old.length ? one(old) : b }];
  } else {
    const ws = shuffle(THEMES[ls.theme].map(x => x[0]));
    const [a, b] = shuffle(ls.letters);
    tasks = [{ t: 'pick', w: ws[0] }, { t: 'trace', li: a }, { t: 'odd', theme: ls.theme },
             { t: 'pairs', words: ws, more: learnedWords(), level: ls.level },
             { t: 'first', li: b }];
  }
  return { tr, idx, ls, intro, tasks, i: 0, earned: 0, misses: 0 };
}
export let L = null;   // the running lesson: tasks, the U.current task index, coins earned, mistakes
export function startLesson(tr, idx) {
  if (idx >= TRACKS[tr].lessons.length) { U.pathTr = tr; go('path'); return; }
  U.pathTr = tr; S.lastTrack = tr; save();
  L = buildLesson(tr, idx); U.streak = 0;
  if (L.intro.length) showIntro(L.intro, runTask); else runTask();
}
// the quiz, trace, puzzle, pairs, lines and race modules register how each task type starts
const starters = {};
export function onTask(t, fn) { starters[t] = fn; }
export function runTask() {
  if (L.i >= L.tasks.length) return endLesson();
  const task = L.tasks[L.i];
  starters[task.t](task);
}
export function nextTask() { L.i++; runTask(); }
// testing: open a lesson at its first task of one type; extra changes that task (a variant not on any path yet)
export function startAt(tr, idx, t, extra) {
  closeOverlay(); U.pathTr = tr; L = buildLesson(tr, idx); U.streak = 0;
  L.i = Math.max(0, L.tasks.findIndex(x => x.t === t));
  if (extra) Object.assign(L.tasks[L.i], extra);
  runTask();
}
// continue only if the child is still in this lesson
export function later(fn, ms) { const me = L; setTimeout(() => { if (L === me && ['quiz', 'trace', 'puzzle', 'pairs', 'lines', 'race'].includes(U.current)) fn(); }, ms); }
export const dotsHtml = () => L.tasks.map((_, i) => `<div class="dot ${i < L.i ? 'done' : ''}"></div>`).join('');

/* ---- end of lesson ---- */
// the album Stick leads to after a lesson (features/stick.md 3): the album of the lesson's theme, else (a level 2 lesson,
// or nothing there the coins are enough for) the album opened last, else any album with a sticker the coins can buy
const STICKERS_OF = id => SETS.find(s => s.id === id).items.map(([, w]) => STICKERS[id + ':' + w]);
const affordableIn = id => STICKERS_OF(id).some(st => st.price <= S.coins);
function rewardAlbum(theme) {
  const tries = [theme, S.lastScene, ...SETS.map(s => s.id)].filter(id => SETS.some(s => s.id === id));
  return tries.find(affordableIn) || tries[0] || SETS[0].id;
}
// the cheapest sticker there is: the coins needed for Stick on the reward screen
const CHEAPEST = Math.min(...Object.values(STICKERS).map(st => st.price));
export function endLesson() {
  // a game circle has no wrong answers to count: an ordinary star, and no first-time bonus (its coins are the game's own)
  const isGame = L.ls.kind === 'game', first = !isDone(L.tr, L.idx) && !isGame, gold = L.misses === 0 && !isGame;
  S.prog[L.tr][L.idx] = gold || S.prog[L.tr][L.idx] === 'gold' ? 'gold' : 'ok';
  save();
  confetti(); sfx.ok();
  say(cheer(gold ? 'Без единой ошибки! Золотая звезда!' : 'Урок пройден!'));
  if (first) { L.earned += ECON.lessonFirst; addCoins(ECON.lessonFirst, { x: 620, y: 360 }); }   // first-time lesson bonus
  const me = L;
  setTimeout(() => {
    if (L !== me) return;
    const canBuy = S.coins >= CHEAPEST, hasNext = L.idx + 1 < TRACKS[L.tr].lessons.length;
    overlay(`<div class="bigpic">${gold ? I.gold : I.star}</div><div class="gain">+${L.earned} ${I.coin}</div>
      ${canBuy ? '<div class="hintbuy">You can buy a sticker! ➜</div>' : ''}
      <div class="row endrow">
        ${canBuy ? `<button class="btn to-stick" id="tostick">${I.stick} Stick</button>` : ''}
        <button class="btn green" id="nextl" title="Next">${ICON_NEXT}</button>
      </div>`);
    // only two choices: a sticker in the album, or the next lesson (the path, after the last one)
    $('nextl').onclick = () => { closeOverlay(); if (hasNext) startLesson(L.tr, L.idx + 1); else go('path'); };
    const ts = $('tostick'); if (ts) ts.onclick = () => { U.sceneId = rewardAlbum(L.ls.theme); go('album'); };
    if (canBuy) say(cheer('Можно купить стикер!'));
  }, 1700);
}
