// Content of the app: sticker sets, vocabulary, letters, letter teams, lesson tracks, album pages, the economy.
// No DOM here: app/voice.js imports this file in Node to know every line the voice must say.
import { ART } from './gen/art.js';
import { I } from './icons.js';

// Albums = sticker sets = vocabulary themes. Every sticker is an English word.
// The first 8 items of a set are the theme's lesson words; then 3 rare and 1 special sticker.
// group: odd-one-out never mixes two animal themes (a fox is not "odd" among farm animals).
export const SETS = [
  { id:'farm', name:'Farm', ru:'Ферма', icon:'🐄', group:'animals', items:[
    ['🐄','cow',20],['🐖','pig',20],['🐑','sheep',20],['🐔','hen',20],['🐎','horse',20],['🐇','rabbit',20],['🦆','duck',20],['🐐','goat',20],
    ['🐕','dog',50,'rare'],['🐈','cat',50,'rare'],['🚜','tractor',50,'rare'],['🦄','unicorn',100,'special'] ]},
  { id:'forest', name:'Forest', ru:'Лес', icon:'🦊', group:'animals', items:[
    ['🦊','fox',20],['🐻','bear',20],['🦉','owl',20],['🦌','deer',20],['🦔','hedgehog',20],['🐺','wolf',20],['🍄','mushroom',20],['🐸','frog',20],
    ['🦫','beaver',50,'rare'],['🦝','raccoon',50,'rare'],['🦋','butterfly',50,'rare'],['🐉','dragon',100,'special'] ]},
  { id:'sea', name:'Sea', ru:'Море', icon:'🐳', group:'animals', items:[
    ['🐟','fish',20],['🦀','crab',20],['🐙','octopus',20],['🐳','whale',20],['🐬','dolphin',20],['🦈','shark',20],['🐢','turtle',20],['🐚','shell',20],
    ['🪼','jellyfish',50,'rare'],['🦭','seal',50,'rare'],['🦞','lobster',50,'rare'],['🧜‍♀️','mermaid',100,'special'] ]},
  { id:'savanna', name:'Savanna', ru:'Саванна', icon:'🦁', group:'animals', items:[
    ['🦁','lion',20],['🐅','tiger',20],['🐘','elephant',20],['🦒','giraffe',20],['🦓','zebra',20],['🐒','monkey',20],['🦛','hippo',20],['🦏','rhino',20],
    ['🐊','crocodile',50,'rare'],['🦩','flamingo',50,'rare'],['🐆','leopard',50,'rare'],['🦕','dinosaur',100,'special'] ]},
  { id:'toys', name:'Toys', ru:'Детская', icon:'🧸', group:'things', items:[
    ['⚽','ball',20],['🧸','teddy bear',20],['🪁','kite',20],['🎈','balloon',20],['🥁','drum',20],['🧩','puzzle',20],['🤖','robot',20],['🛴','scooter',20],
    ['🪀','yo-yo',50,'rare'],['🚂','train',50,'rare'],['🪆','nesting dolls',50,'rare'],['🎠','carousel',100,'special'] ]},
  { id:'home', name:'Home', ru:'Дом', icon:'🛋️', group:'things', items:[
    ['🛏️','bed',20],['🪑','chair',20],['🛋️','sofa',20],['🚪','door',20],['🪟','window',20],['📺','TV',20],['🕰️','clock',20],['🛁','bath',20],
    ['🪞','mirror',50,'rare'],['💻','computer',50,'rare'],['☎️','phone',50,'rare'],['🎄','Christmas tree',100,'special'] ]},
  { id:'kitchen', name:'Kitchen', ru:'Кухня', icon:'🍳', group:'things', items:[
    ['🍎','apple',20],['🍌','banana',20],['🍓','strawberry',20],['🥕','carrot',20],['🧀','cheese',20],['🥚','egg',20],['🥛','milk',20],['🥄','spoon',20],
    ['🍕','pizza',50,'rare'],['🍦','ice cream',50,'rare'],['🍩','donut',50,'rare'],['🎂','cake',100,'special'] ]},
];
export const slug = w => w.toLowerCase().replace(/[^a-z]+/g, "-");   // "teddy bear" -> teddy-bear.png
export const STICKERS = {};
SETS.forEach(s => s.items.forEach(([e,w,p,r]) => STICKERS[s.id+':'+w] = { key:s.id+':'+w, e, w, price:p, rarity:r||'common', set:s.id,
  img: (ART[s.id] || []).includes(slug(w)) ? `img/stickers/${s.id}/${slug(w)}.png` : null }));
// a set's icon is the sticker it is named after (cow for Farm, fox for Forest...)
SETS.forEach(s => { const it = s.items.find(([e]) => e === s.icon); s.img = it ? STICKERS[s.id + ':' + it[1]].img : null; });
export const pic = o => o && o.img ? `<img class="spic" src="${o.img}" alt="" draggable="false">` : (o ? o.e : '');
export const iconOf = s => s.img ? pic(s) : s.icon;
export const STICKER_N = Object.keys(STICKERS).length;

// Vocabulary: 7 themes × 8 words, studied in this order (the same order as the albums).
export const THEME_ORDER = SETS.map(s => s.id);
export const THEME_META = Object.fromEntries(SETS.map(s => [s.id, [s.icon, s.name]]));
export const THEMES = Object.fromEntries(SETS.map(s => [s.id, s.items.slice(0, 8).map(([e, w]) => [w, e])]));
export const WORDS = Object.values(THEMES).flat();
export const WORD_INFO = {};
THEME_ORDER.forEach(t => THEMES[t].forEach(([w, e]) => WORD_INFO[w] = { w, e, theme: t, img: STICKERS[t + ':' + w].img }));
// any word: a sticker's artwork, else a lesson-word picture from img/stickers/words/, else its emoji
export const picOf = (w, e) => WORD_INFO[w] ? pic(WORD_INFO[w]) : (ART.words || []).includes(slug(w)) ? pic({ img: `img/stickers/words/${slug(w)}.png` }) : e;

// Letters in phonics order: two per theme
export const LETTERS = [
  ['S',[['sun','☀️'],['socks','🧦']]], ['A',[['apple','🍎'],['ant','🐜']]], ['T',[['tiger','🐅'],['turtle','🐢']]],
  ['P',[['pig','🐖'],['pizza','🍕']]], ['I',[['insect','🪲']]], ['N',[['nose','👃'],['nest','🪺']]],
  ['M',[['moon','🌙'],['milk','🥛']]], ['D',[['dog','🐕'],['duck','🦆']]], ['G',[['goat','🐐'],['grapes','🍇']]],
  ['O',[['octopus','🐙'],['otter','🦦']]], ['C',[['cat','🐈'],['cake','🎂']]], ['E',[['egg','🥚'],['elephant','🐘']]],
  ['H',[['horse','🐎'],['hippo','🦛']]], ['R',[['rabbit','🐇'],['robot','🤖']]],
];
export const PZ_COLORS = ['#ffd36b','#b8f0a0','#b9c8ff','#9fe0ff','#d8f3c8','#ffd0b5','#ffe9a8','#ffc9ec'];
// puzzle levels: [cols, rows, ghost underlay]
export const PZ_LEVELS = [[2,2,false],[3,2,false],[3,3,true]];   // 4, 6, 9 pieces
// pairs (memory) levels, the same ladder as the puzzle: [cols, rows, preview ms]; pairs = cols*rows/2
export const MEM_LEVELS = [[3,2,3000],[4,2,2000],[4,3,0]];   // 3, 4, 6 pairs
// the race (Specs/features/racing.md): the track in stage pixels, the speed with no taps and with fast taps (px/s)
export const RACE = { len: 20000, rest: 260, top: 650 };
// race levels, the same ladder: [gates, seconds to choose a lane, the wrong picture comes from another theme, top speed ×]
export const RACE_LEVELS = [[4, 4, true, 1], [5, 3.5, false, 1], [6, 3, false, 1.15]];
// lines (Specs/features/Lines.md), the same ladder: the board, words in a game and on the board at the start, the longest
// word, new balls after a move that made no word, moves before a hint, letters on the balls (none on level 1: colours only)
export const LINES_LEVELS = [
  { cols: 5, rows: 4, words: 2, start: 2, maxLen: 3, spawn: 0, hint: 4, letters: false },
  { cols: 6, rows: 5, words: 3, start: 2, maxLen: 4, spawn: 1, hint: 4, letters: true },
  { cols: 7, rows: 5, words: 4, start: 2, maxLen: 4, spawn: 2, hint: 5, letters: true },
];
// one colour per word, [ball, letter]; colour-blind safe (Okabe–Ito) and every two differ in lightness too
export const LINE_COLORS = [['#f2cf2e', '#5a4300'], ['#1f6fc0', '#fff'], ['#e2572b', '#fff'], ['#d77fb6', '#fff']];

/* ---- lesson paths (SPEC 3.1): one per learning section, grouped into "islands" ---- */
export function mkTrack(title, sayTxt, islands) {
  const lessons = [];
  islands.forEach(is => { is.idx = is.lessons.map(l => { lessons.push(l); return lessons.length - 1; }); });
  // saves made before the games had their own circles numbered the lessons without them: old number -> the lesson
  // and the game circles that follow it (the games were played inside that lesson)
  const before = [];
  lessons.forEach((l, i) => { if (l.kind === 'game') before[before.length - 1].push(i); else before.push([i]); });
  return { title, say: sayTxt, islands, lessons, before };
}
// a game on the path: its own circle right after the lesson it belongs to (SPEC 3.1)
const game = (g, of) => ({ kind: 'game', game: g, of, theme: of.theme, level: of.level, icon: I[g] });
// ONE progression. Words, letters and puzzles are task types mixed inside lessons; pairs, lines and the race are
// circles of their own. Theme = 5 lessons, a game after each: words 1–4, pairs, 1st letter, lines, words 5–8, pairs,
// 2nd letter, lines, review, race. Two letters per theme in phonics order.
export const PZ_LEVEL_BY_THEME = [1, 1, 2, 2, 2, 3, 3];
export const TRACKS = {
  main: mkTrack('Learn', 'Поехали учиться!', THEME_ORDER.map((t, ti) => {
    const level = PZ_LEVEL_BY_THEME[ti], l1 = ti * 2, l2 = ti * 2 + 1;
    return { icon: THEME_META[t][0], set: SETS.find(s => s.id === t), label: THEME_META[t][1], lessons: [
      { kind: 'words', theme: t, ti, part: 0, level, icon: THEMES[t][0][1] },
      { kind: 'letter', theme: t, ti, li: l1, level, icon: LETTERS[l1][0] },
      { kind: 'words', theme: t, ti, part: 1, level, icon: THEMES[t][4][1] },
      { kind: 'letter', theme: t, ti, li: l2, level, icon: LETTERS[l2][0] },
      { kind: 'review', theme: t, ti, letters: [l1, l2], level, icon: I.review },
    ].flatMap(l => [l, game({ words: 'pairs', letter: 'lines', review: 'race' }[l.kind], l)]) };
  })),
};

/* ---- Level 2: letter teams — two letters that make one sound ("oy" as in "boy") ----
   [team, how the voice says the sound, example words]. Words are drawn by emoji, so each must be unambiguous. */
export const CHUNKS = [
  ['sh', 'shh', [['ship','🚢'],['shell','🐚']]],
  ['ch', 'ch',  [['chick','🐤'],['cheese','🧀']]],
  ['ee', 'ee',  [['bee','🐝'],['tree','🌳']]],
  ['oo', 'oo',  [['moon','🌙'],['spoon','🥄']]],
  ['ar', 'ar',  [['car','🚗'],['star','⭐']]],
  ['or', 'or',  [['corn','🌽'],['horse','🐎']]],
  ['ai', 'ay',  [['rain','🌧️'],['snail','🐌']]],
  ['oa', 'oh',  [['boat','⛵'],['goat','🐐']]],
  ['oy', 'oy',  [['boy','👦'],['oyster','🦪']]],
  ['ow', 'ow',  [['cow','🐄'],['owl','🦉']]],
  ['ck', 'k',   [['duck','🦆'],['clock','🕰️']]],
  ['ng', 'ng',  [['ring','💍'],['king','🤴']]],
];
export const CHUNK_WORD = {};   // word -> { w, e, ci }
CHUNKS.forEach(([c, s, ws], ci) => ws.forEach(([w, e]) => CHUNK_WORD[w] = { w, e, ci }));
// the word with its team shown as a gap: "b _ _"
export const gapWord = (w, c) => w.replace(c, `<span class="gap">${'_'.repeat(c.length).split('').join(' ')}</span>`);
export const markWord = (w, c) => w.replace(c, `<b>${c}</b>`);
export const sndOf = ci => CHUNKS[ci][1];
// Lines on level 2 (Specs/features/Lines.md 9, q. 6): a word cut into balls, every letter team up to upTo is one ball
// (ship -> sh, i, p); later teams stay single letters, the child has not met them yet
export function chunkTiles(w, upTo) {
  const known = CHUNKS.slice(0, upTo + 1).map(c => c[0]), out = [];
  for (let i = 0; i < w.length;) {
    const two = w.slice(i, i + 2);
    if (two.length === 2 && known.includes(two)) { out.push(two); i += 2; } else out.push(w[i++]);
  }
  return out;
}
// the example words of these teams that make 3–4 balls
export const linesChunkWords = (cis, upTo) => cis.flatMap(ci => CHUNKS[ci][2].map(x => x[0]))
  .filter(w => { const n = chunkTiles(w, upTo).length; return n >= 3 && n <= 4; });

// Level 2 path: 6 groups × (team A, team B, lines, review, pairs, race). Lines: each letter team is one ball
// (Lines.md 9, q. 6), so the circle is there only if at least two words of the group make 3–4 balls
// (not "oy · ow": boy, cow, owl are two balls, oyster five).
TRACKS.lvl2 = mkTrack('Level 2', 'Второй уровень! Поехали!', [0, 1, 2, 3, 4, 5].map(g => {
  const a = g * 2, b = g * 2 + 1, level = g < 3 ? 2 : 3;
  const B = { kind: 'chunk', ci: b, level, icon: CHUNKS[b][0] }, R = { kind: 'chunkreview', cis: [a, b], level, icon: I.review };
  return { icon: CHUNKS[a][2][0][1], label: CHUNKS[a][0] + ' · ' + CHUNKS[b][0], lessons: [
    { kind: 'chunk', ci: a, level, icon: CHUNKS[a][0] },
    B, ...(linesChunkWords([a, b], b).length >= 2 ? [game('lines', B)] : []),
    R, game('pairs', R), game('race', R),
  ] };
}));
export const LEVELS = [['main', 'Level 1'], ['lvl2', 'Level 2']];

// Album pages: one per sticker set. A page opens when the first sticker of its set is bought.
export const SCENES = [
  { id:'farm', css:'meadow', icon:'🐄', bg:'#9fdc7c', deco:[['🌳',60,250,150],['🌳',1090,230,170],['☁️',300,40,90],['☁️',820,70,80]] },
  { id:'forest', css:'forest', icon:'🦊', bg:'#5f9e6e', deco:[['🌲',20,170,230],['🌲',1060,150,250],['🌳',230,260,150],['🌲',880,280,150],['🍂',600,520,50]] },
  { id:'sea', css:'sea', icon:'🐳', bg:'#3aa4d8', deco:[['🪸',100,470,120],['🪸',1080,480,110],['🫧',600,350,50],['🫧',650,250,36]] },
  { id:'savanna', css:'savanna', icon:'🦁', bg:'#e8b85a', deco:[['🌳',80,200,190],['🌳',1050,240,140],['☀️',1060,40,110],['🌾',500,470,70]] },
  { id:'toys', css:'room', icon:'🧸', bg:'#ffd0e0', deco:[['🪟',540,60,160],['🖼️',140,90,110],['🧺',1000,330,130]] },
  { id:'home', css:'home', icon:'🛋️', bg:'#c9b3e6', deco:[['🖼️',180,80,110],['🪴',1080,300,150],['💡',620,10,70]] },
  { id:'kitchen', css:'kitchen', icon:'🍳', bg:'#ffe08a', deco:[['🪟',560,50,150],['🫖',150,250,90],['🍽️',980,260,90]] },
];

/* ---- rare and special stickers (SPEC 3.6, 3.7) ----
   snd:   the sticker's own sound, played after its name; the text is the prompt app/sfx.js renders (ElevenLabs Sound Effects)
   move:  how a special sticker moves on the page all the time (CSS animation .mv-<move> in album.css)
   act:   the short scene when a special sticker is tapped (.act-<act>); burst: what flies out of it (smoke, bubbles, stars, confetti) */
export const STICKER_FX = {
  'farm:dog':            { snd: 'a small friendly dog barks twice' },
  'farm:cat':            { snd: 'a cute cat meows once' },
  'farm:tractor':        { snd: 'a tractor engine chugging, short' },
  'farm:unicorn':        { snd: 'a magical sparkling chime followed by a soft horse whinny', move: 'trot', act: 'rear', burst: 'stars' },
  'forest:beaver':       { snd: 'a beaver gnawing wood, quick crunching' },
  'forest:raccoon':      { snd: 'a playful raccoon chittering' },
  'forest:butterfly':    { snd: 'soft fluttering wings with a tiny twinkle' },
  'forest:dragon':       { snd: 'a small friendly cartoon dragon roar with a puff of fire', move: 'breathe', act: 'puff', burst: 'smoke' },
  'sea:jellyfish':       { snd: 'a soft underwater bubbly wobble, bloop' },
  'sea:seal':            { snd: 'a seal barks twice' },
  'sea:lobster':         { snd: 'two quick snappy claw clicks' },
  'sea:mermaid':         { snd: 'a magical underwater harp glissando with bubbles', move: 'swim', act: 'flip', burst: 'bubbles' },
  'savanna:crocodile':   { snd: 'a crocodile jaw snap with a short low growl, cartoon, not scary' },
  'savanna:flamingo':    { snd: 'a flamingo honks once, short' },
  'savanna:leopard':     { snd: 'a short leopard growl, cartoon, not scary' },
  'savanna:dinosaur':    { snd: 'a short friendly cartoon dinosaur roar', move: 'stomp', act: 'jump', burst: 'smoke' },
  'toys:yo-yo':          { snd: 'a yo-yo whirring down and zipping back up' },
  'toys:train':          { snd: 'a toy steam train whistle, choo choo' },
  'toys:nesting dolls':  { snd: 'three wooden toy pops rising in pitch' },
  'toys:carousel':       { snd: 'a short cheerful carousel music box phrase', move: 'rock', act: 'spin', burst: 'stars' },
  'home:mirror':         { snd: 'a magical glassy shimmer sparkle' },
  'home:computer':       { snd: 'a cheerful computer beep boop' },
  'home:phone':          { snd: 'an old telephone rings once' },
  'home:Christmas tree': { snd: 'sleigh bells jingling, festive, short', move: 'twinkle', act: 'shake', burst: 'stars' },
  'kitchen:pizza':       { snd: 'a short hot sizzle' },
  'kitchen:ice cream':   { snd: 'a cartoon slurp and a happy mmm' },
  'kitchen:donut':       { snd: 'a cartoon crunchy bite and a pop' },
  'kitchen:cake':        { snd: 'a party horn toot and a little cheer', move: 'jiggle', act: 'party', burst: 'confetti' },
};
// the file app/sfx.js writes for a sticker: "toys:nesting dolls" -> audio/sfx/toys-nesting-dolls.mp3
export const sfxFile = key => 'audio/sfx/' + key.toLowerCase().replace(/[^a-z0-9]+/g, '-') + '.mp3';
// special stickers move on the page; more than this many at once and the page flickers, the rest stand still
export const MAX_MOVING = 4;

/* ---- economy (SPEC 3.5) ---- */
export const ECON = {
  start: 20,          // exactly one common sticker: the first purchase opens the first album
  task: 2,            // correct answer
  firstTry: 1,        // + if no mistakes in this task
  streak: 2,          // + every 3 correct in a row
  puzzle: [4, 4, 5],  // by puzzle level 1..3
  pairs: [4, 4, 5],   // memory game finished, by level 1..3
  race: { max: [5, 5, 6], min: 3 },   // one per coin picked up on the road, by level 1..3; never fewer than min at the finish
  lines: [4, 4, 5],   // lines game finished, by level 1..3
  lessonFirst: 5,     // + first time a lesson is finished
  daily: 5,           // first visit of the day
};

// what the voice says after a correct answer
export const PRAISE = ['Молодец!', 'Правильно!', 'Ура!', 'Отлично!', 'Супер!'];
// the emoji of any lesson word (level 1 themes and level 2 letter teams)
export const emojiOf = w => WORD_INFO[w] ? WORD_INFO[w].e : CHUNK_WORD[w] ? CHUNK_WORD[w].e : '';
