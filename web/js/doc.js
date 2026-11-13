// The profile document: the form in which a child's progress travels to the cloud and back
// (Specs/features/cloud-sync.md 4.2, 4.5, 5.4). No DOM, no storage, no imports: plain data in, plain data out.
//   toDoc(game)            the saved game of a profile (the flat form of state.js) -> the document
//   fromDoc(doc, local)    the document -> a saved game; `local` is what never leaves the device (the name, mute)
//   mergeDoc(a, b)         two documents that grew apart on two devices -> one, field by field
//   migrateDoc(doc)        a document of an older format -> the format this app writes
// The name of the child is not in the document: the cloud holds no personal data of a child.

export const SCHEMA = 1;   // the format this app reads and writes

const obj = v => (v && typeof v === 'object' && !Array.isArray(v) ? v : {});
const arr = v => (Array.isArray(v) ? v : []);
const num = (v, d = 0) => (typeof v === 'number' && isFinite(v) ? v : d);
const copy = v => JSON.parse(JSON.stringify(v));

export function toDoc(g) {
  g = obj(g);
  const prog = obj(g.prog), stats = Object.assign({ tasks: 0, correct: 0, wrong: 0, puzzles: 0, pairs: 0, words: {}, letters: {}, err: {} }, obj(g.stats));
  return copy({
    schema: SCHEMA,
    coins: num(g.coins),
    bought: obj(g.bought),
    scenes: obj(g.scenes),
    rewarded: arr(g.rewarded),
    prog: { main: obj(prog.main), lvl2: obj(prog.lvl2) },
    lvl2open: !!g.lvl2open,
    lastTrack: g.lastTrack || 'main',
    stats,
    time: { day: g.day || '', usedMs: num(g.usedMs) },
    settings: { lang: g.lang || '', musicVol: num(g.musicVol, 50), voiceVol: num(g.voiceVol, 100), sfxVol: num(g.sfxVol, 100), hints: g.hints !== false,
                limit: num(g.limit), parentWho: g.parentWho || '', parentAcc: g.parentAcc || '', parentDat: g.parentDat || '', avatar: g.avatar || '' },
    // where the child is with the album: the hand on the shelf was shown, the album opened last (features/stick.md 3)
    album: { hint: !!g.stickHint, last: g.lastScene || null },
  });
}

// stickers on the shelf: bought and not on a page. Never stored in the document, it would drift apart in a merge.
export function shelf(bought, scenes) {
  const placed = {};
  Object.values(obj(scenes)).forEach(list => arr(list).forEach(it => { placed[it.k] = (placed[it.k] || 0) + 1; }));
  const inv = {};
  Object.entries(obj(bought)).forEach(([k, n]) => { const left = n - (placed[k] || 0); if (left > 0) inv[k] = left; });
  return inv;
}

export function fromDoc(doc, local) {
  const d = copy(obj(doc)), s = obj(d.settings), t = obj(d.time), a = obj(d.album), l = obj(local);
  return {
    coins: num(d.coins), bought: obj(d.bought), scenes: obj(d.scenes), inv: shelf(d.bought, d.scenes),
    unlocked: [], rewarded: arr(d.rewarded),
    stats: obj(d.stats),
    limit: num(s.limit), limitSet: true, day: t.day || '', usedMs: num(t.usedMs),
    prog: { main: obj(obj(d.prog).main), lvl2: obj(obj(d.prog).lvl2) }, progV: 2,
    lvl2open: !!d.lvl2open, lastTrack: d.lastTrack || 'main',
    stickHint: !!a.hint, lastScene: a.last || null,
    lang: s.lang || '', musicVol: num(s.musicVol, 50), music: num(s.musicVol, 50) > 0, voiceVol: num(s.voiceVol, 100), sfxVol: num(s.sfxVol, 100),
    hints: s.hints !== false, parentWho: s.parentWho || '', parentAcc: s.parentAcc || '', parentDat: s.parentDat || '', avatar: s.avatar || '',
    kidName: l.kidName || '', mute: !!l.mute,
  };
}

/* ================= formats ================= */
// MIGRATIONS[n] turns a document of format n + 1 into format n + 2. Empty while there is one format.
const MIGRATIONS = [];
// null: the document is newer than this app understands; it is neither read nor written (5.4)
export function migrateDoc(doc) {
  let d = copy(obj(doc)), v = num(d.schema, 1);
  if (v > SCHEMA) return null;
  for (; v < SCHEMA; v++) { d = MIGRATIONS[v - 1](d); d.schema = v + 1; }
  return d;
}

/* ================= what the lists show ================= */
// nothing bought, no lesson done, no task answered; the starting coins do not count (4.3)
export function isEmptyDoc(doc) {
  const d = obj(doc), p = obj(d.prog);
  return !Object.values(obj(d.bought)).some(n => n > 0) && !Object.keys(obj(p.main)).length && !Object.keys(obj(p.lvl2)).length && !num(obj(d.stats).tasks);
}
// "32 words · 14 stickers · 3 albums"
export function countsOf(doc) {
  const d = obj(doc), keys = Object.keys(obj(d.bought)).filter(k => d.bought[k] > 0);
  return { words: Object.values(obj(obj(d.stats).words)).filter(n => n > 0).length, stickers: keys.length, albums: new Set(keys.map(k => k.split(':')[0])).size };
}

/* ================= merge ================= */
// a and b are { doc, at }: `at` is when the document last changed (ms). Fields are joined by what they mean, not by
// "who was later" (the table in cloud-sync.md 4.5): a lesson done, a sticker bought or a trophy is never lost; a few
// coins or the place of one sticker may be.
export function mergeDoc(a, b) {
  const [late, early] = num(a.at) >= num(b.at) ? [a.doc, b.doc] : [b.doc, a.doc];
  const L = copy(obj(late)), E = copy(obj(early));
  const maxMap = (x, y) => { const out = Object.assign({}, obj(y)); Object.entries(obj(x)).forEach(([k, n]) => { out[k] = Math.max(num(n), num(out[k])); }); return out; };
  // lessons: done on either device is done; gold beats ok
  const prog = {};
  ['main', 'lvl2'].forEach(tr => {
    const x = obj(obj(L.prog)[tr]), y = obj(obj(E.prog)[tr]); prog[tr] = Object.assign({}, y, x);
    Object.keys(prog[tr]).forEach(i => { if (x[i] === 'gold' || y[i] === 'gold') prog[tr][i] = 'gold'; });
  });
  // counters: the larger one (both grew from the same base, a sum would double them)
  const ls = obj(L.stats), es = obj(E.stats), stats = {};
  new Set([...Object.keys(ls), ...Object.keys(es)]).forEach(k => {
    stats[k] = typeof ls[k] === 'object' || typeof es[k] === 'object' ? maxMap(ls[k], es[k]) : Math.max(num(ls[k]), num(es[k]));
  });
  // albums: each album as a whole from the later document; an album only the earlier one has stays
  const scenes = Object.assign({}, obj(E.scenes), obj(L.scenes));
  // the daily limit belongs to the child, not to the device
  const lt = obj(L.time), et = obj(E.time);
  const time = lt.day === et.day ? { day: lt.day || '', usedMs: Math.max(num(lt.usedMs), num(et.usedMs)) } : (lt.day || '') > (et.day || '') ? lt : et;
  return {
    schema: Math.max(num(L.schema, 1), num(E.schema, 1)),
    coins: num(L.coins),
    bought: maxMap(L.bought, E.bought),
    scenes,
    rewarded: [...new Set([...arr(E.rewarded), ...arr(L.rewarded)])],
    prog,
    lvl2open: !!L.lvl2open,
    lastTrack: L.lastTrack || E.lastTrack || 'main',
    stats,
    time,
    settings: Object.assign({}, obj(E.settings), obj(L.settings)),
    album: { hint: !!(obj(L.album).hint || obj(E.album).hint), last: obj(L.album).last || obj(E.album).last || null },
  };
}
