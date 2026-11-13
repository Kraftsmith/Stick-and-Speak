// Children's profiles on this device: where each saved game lives in localStorage (Specs/features/startup.md 5).
// Storage only: no DOM and no game rules. state.js turns a stored profile into the running game `S`.
//
//   sticker-profiles       [ { id, createdAt, lastPlayedAt } ]   the order is the order of creation
//   sticker-current        id of the profile that is playing
//   sticker-profile-<id>   the saved game: progress, coins, stickers, albums, settings
//   sticker-local-<id>     { kidName, mute, baseVersion, dirty, changedAt }: what never leaves this device
//   sticker-backup-<date>  profiles put aside before the cloud copy or a backup file replaced or removed them, kept for 30 days
//   sticker-device         { askWho: 'kids' | 'parent' | 'never', deviceId }
//   sticker-broken-<date>  the text of a saved game that could not be read
import { today } from './util.js';

export const MAX_PROFILES = 4;
const LIST = 'sticker-profiles', CURRENT = 'sticker-current', DEVICE = 'sticker-device';
const DOC = id => 'sticker-profile-' + id, LOCAL = id => 'sticker-local-' + id;
// saves made before profiles existed; the first one found becomes profile 1. The old key stays for one more version.
const OLD_KEYS = ['stick-and-speak', 'sticker-proto-v2'];
// fields of the running game that are kept in sticker-local-<id>, not in the saved game
const LOCAL_FIELDS = ['kidName', 'mute'];

const ls = localStorage;
const read = (key, fallback) => { try { const v = JSON.parse(ls.getItem(key)); return v == null ? fallback : v; } catch (e) { return fallback; } };
const write = (key, value) => ls.setItem(key, JSON.stringify(value));
const uuid = () => crypto.randomUUID ? crypto.randomUUID()
  : '10000000-1000-4000-8000-100000000000'.replace(/[018]/g, c => (c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> c / 4).toString(16));
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);

/* ================= the list ================= */
export function list() { const l = read(LIST, []); return Array.isArray(l) ? l.filter(p => p && p.id) : []; }
export const has = id => list().some(p => p.id === id);
export const current = () => ls.getItem(CURRENT);
// the profile that played last (the first one, when none has played yet)
export function lastPlayed() { return list().reduce((a, p) => !a || (p.lastPlayedAt || 0) > (a.lastPlayedAt || 0) ? p : a, null); }

// a new profile; `state` is a saved game to start from (a migrated old save), otherwise the game starts empty.
// Returns the id, or null when the device already has MAX_PROFILES.
export function create({ kidName = '', state = {} } = {}) {
  const l = list();
  if (l.length >= MAX_PROFILES) return null;
  const id = uuid();
  write(LIST, [...l, { id, createdAt: Date.now(), lastPlayedAt: 0 }]);
  write(LOCAL(id), { kidName, mute: false, baseVersion: 0, dirty: false });
  save(id, Object.assign({}, state, { kidName: kidName || state.kidName || '' }));
  return id;
}

// makes the profile the playing one and remembers when; returns false for an unknown id
function switchTo(id) {
  const l = list(), p = l.find(x => x.id === id);
  if (!p) return false;
  p.lastPlayedAt = Date.now();
  write(LIST, l); ls.setItem(CURRENT, id);
  return true;
}
export { switchTo as switch };

// deletes the profile and its saved game; the last profile cannot be deleted.
// If it was the playing one, the profile that played last before it becomes current (the caller loads it).
export function remove(id) {
  const l = list();
  if (l.length < 2 || !l.some(p => p.id === id)) return false;
  write(LIST, l.filter(p => p.id !== id));
  ls.removeItem(DOC(id)); ls.removeItem(LOCAL(id));
  if (current() === id) ls.setItem(CURRENT, lastPlayed().id);
  return true;
}

/* ================= one profile ================= */
// { state, local }: the saved game and the device-only record. A saved game that cannot be read is put aside
// under sticker-broken-<date> and the profile starts empty (startup.md 4.7).
export function load(id) {
  const text = ls.getItem(DOC(id));
  let state = {};
  if (text) {
    try { state = JSON.parse(text); } catch (e) { state = null; }
    if (!isObj(state)) { ls.setItem('sticker-broken-' + today(), text); ls.removeItem(DOC(id)); state = {}; }
  }
  const local = Object.assign({ kidName: '', mute: false, baseVersion: 0, dirty: false }, read(LOCAL(id), {}));
  return { state, local };
}
// writes the running game: the device-only fields go to sticker-local-<id>, everything else to sticker-profile-<id>
export function save(id, game) {
  const state = Object.assign({}, game), local = localOf(id);
  LOCAL_FIELDS.forEach(f => { if (f in state) { local[f] = state[f]; delete state[f]; } });
  write(DOC(id), state); write(LOCAL(id), local);
}
function localOf(id) { const v = read(LOCAL(id), {}); return isObj(v) ? v : {}; }
// changes fields of a stored game without loading it (the picture of a child who is not playing now)
export function patch(id, fields) { const { state, local } = load(id); save(id, Object.assign(state, local, fields)); }
// baseVersion and dirty belong to the copy on this device (the cloud sync reads and sets them)
export function setLocal(id, patch) { write(LOCAL(id), Object.assign(localOf(id), patch)); }

/* ================= the cloud copy (cloud.js) ================= */
// a profile that came from the cloud: it keeps the id it has there. Returns false at the limit or for a known id.
export function adopt(id, state, local = {}) {
  const l = list();
  if (l.length >= MAX_PROFILES || l.some(p => p.id === id)) return false;
  write(LIST, [...l, { id, createdAt: Date.now(), lastPlayedAt: 0 }]);
  write(LOCAL(id), Object.assign({ kidName: '', mute: false, baseVersion: 0, dirty: false }, local));
  write(DOC(id), state);
  return true;
}
// removes a profile whatever the list holds (the last one too): the cloud decides, not the parent
export function drop(id) {
  write(LIST, list().filter(p => p.id !== id));
  ls.removeItem(DOC(id)); ls.removeItem(LOCAL(id));
  if (current() === id) { const p = lastPlayed(); if (p) ls.setItem(CURRENT, p.id); else ls.removeItem(CURRENT); }
}
// the profile gets a new id (its old one belongs to another account in the cloud); returns the new id
export function reid(id) {
  const l = list(), p = l.find(x => x.id === id);
  if (!p) return null;
  const to = uuid(), doc = ls.getItem(DOC(id)), local = ls.getItem(LOCAL(id));
  p.id = to; write(LIST, l);
  if (doc != null) ls.setItem(DOC(to), doc);
  if (local != null) ls.setItem(LOCAL(to), local);
  ls.removeItem(DOC(id)); ls.removeItem(LOCAL(id));
  if (current() === id) ls.setItem(CURRENT, to);
  return to;
}
// puts profiles aside before they are replaced or removed: one record per day, kept for 30 days
const BACKUP = 'sticker-backup-', KEEP_DAYS = 30;
export function backup(ids) {
  const key = BACKUP + today(), rec = read(key, { profiles: [] });
  ids.forEach(id => { if (has(id)) rec.profiles.push({ id, at: Date.now(), ...load(id) }); });
  if (rec.profiles.length) write(key, rec);
}
export function backups() { return Object.keys(ls).filter(k => k.startsWith(BACKUP)).sort().map(k => ({ key: k, ...read(k, { profiles: [] }) })); }
export function purgeBackups() {
  const limit = new Date(Date.now() - KEEP_DAYS * 864e5).toISOString().slice(0, 10);
  Object.keys(ls).filter(k => k.startsWith(BACKUP) && k.slice(BACKUP.length) < limit).forEach(k => ls.removeItem(k));
}

/* ================= the backup file (backup.js) ================= */
// every profile on the device gives way to the given ones: [ { id, createdAt, lastPlayedAt, state, local } ]
export function replaceAll(profiles, currentId) {
  list().forEach(p => { ls.removeItem(DOC(p.id)); ls.removeItem(LOCAL(p.id)); });
  write(LIST, profiles.map(p => ({ id: p.id, createdAt: p.createdAt || Date.now(), lastPlayedAt: p.lastPlayedAt || 0 })));
  profiles.forEach(p => { write(DOC(p.id), p.state); write(LOCAL(p.id), Object.assign({ kidName: '', mute: false, baseVersion: 0, dirty: false }, p.local)); });
  ls.setItem(CURRENT, profiles.some(p => p.id === currentId) ? currentId : profiles[0].id);
}
// bytes the saved games and everything else of the app take in localStorage (two bytes a character)
export function size() { return Object.keys(ls).filter(k => k.startsWith('sticker-')).reduce((n, k) => n + (k.length + (ls.getItem(k) || '').length) * 2, 0); }

/* ================= the device ================= */
export function device() {
  const d = read(DEVICE, {});
  if (isObj(d) && d.deviceId && d.askWho) return d;
  const fixed = { askWho: 'kids', deviceId: uuid(), ...(isObj(d) ? d : {}) };
  fixed.askWho = fixed.askWho || 'kids'; fixed.deviceId = fixed.deviceId || uuid();
  write(DEVICE, fixed); return fixed;
}
export function setDevice(patch) { const d = Object.assign(device(), patch); write(DEVICE, d); return d; }

/* ================= start ================= */
// A save made before profiles existed becomes profile 1, once; the old key stays for one more version.
// Returns the new profile's id, or null when there was nothing to move.
export function migrate() {
  device();
  if (list().length) return null;
  for (const k of OLD_KEYS) {
    const old = read(k, null);
    if (isObj(old)) return create({ state: Object.assign({ avatar: 'farm:cow' }, old) });
  }
  return null;
}
// a parent's "Reset everything" on the Testing tab: every profile, the device record and the old saves
export function wipe() {
  Object.keys(ls).filter(k => k.startsWith('sticker-') || OLD_KEYS.includes(k)).forEach(k => ls.removeItem(k));
}

export const Profiles = { list, has, current, create, switch: switchTo, remove, load, save, patch, setLocal, device, setDevice, migrate, lastPlayed, wipe,
  adopt, drop, reid, backup, backups, purgeBackups, replaceAll, size };
