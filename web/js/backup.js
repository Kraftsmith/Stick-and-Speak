// The backup file of the parent zone (Specs/features/startup.md 5.1): every child on this device in one JSON file.
// A parent saves it by hand and loads it on this or another device; it is the only way to carry the progress over
// without an account. No DOM except the download link; parent.js draws the buttons.
//
//   { app: 'stick-and-play', format: 1, schema, version, exportedAt, current,
//     profiles: [ { id, createdAt, lastPlayedAt, name, mute, state } ] }
//
// `state` is the saved game as profiles.js stores it (the flat form of state.js), so a file is an exact copy and
// state.js repairs an old one when it is loaded. `schema` is the format of the cloud document this app wrote
// (doc.js): a file made by a newer app is refused, like a newer cloud document.
import { Profiles, MAX_PROFILES } from './profiles.js';
import { SCHEMA } from './doc.js';
import { VERSION } from './version.js';
import { today } from './util.js';

export const FORMAT = 1;
const APP = 'stick-and-play', MAX_BYTES = 4e6;
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);

export function makeBackup() {
  return { app: APP, format: FORMAT, schema: SCHEMA, version: VERSION, exportedAt: new Date().toISOString(), current: Profiles.current(),
    profiles: Profiles.list().map(p => {
      const { state, local } = Profiles.load(p.id);
      return { id: p.id, createdAt: p.createdAt || 0, lastPlayedAt: p.lastPlayedAt || 0, name: local.kidName || '', mute: !!local.mute, state };
    }) };
}

// Hands the file to the parent: the share sheet on phones and tablets where it takes such a file ("Save to Files",
// mail, a messenger), a download everywhere else. Resolves to 'shared' | 'saved' | 'cancelled'.
export async function saveBackupFile() {
  const text = JSON.stringify(makeBackup()), name = `stick-and-play-${today()}.json`;
  if (typeof File === 'function' && navigator.canShare && matchMedia('(pointer: coarse)').matches) {
    const file = new File([text], name, { type: 'application/json' });
    if (navigator.canShare({ files: [file] })) {
      try { await navigator.share({ files: [file], title: name }); return 'shared'; }
      catch (e) { if (e.name === 'AbortError') return 'cancelled'; }   // anything else: fall back to the download
    }
  }
  const a = document.createElement('a'), url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return 'saved';
}

// Reads the text of a file. { file, kids: [names], date } when it is a backup this app can load, else
// { error: 'big' | 'unreadable' | 'foreign' | 'newer' | 'empty' }.
export function readBackup(text) {
  if (typeof text !== 'string' || text.length > MAX_BYTES) return { error: 'big' };
  let f; try { f = JSON.parse(text); } catch (e) { return { error: 'unreadable' }; }
  if (!isObj(f) || f.app !== APP || typeof f.format !== 'number' || !Array.isArray(f.profiles)) return { error: 'foreign' };
  if (f.format > FORMAT || (typeof f.schema === 'number' && f.schema > SCHEMA)) return { error: 'newer' };
  const seen = new Set(), profiles = [];
  for (const p of f.profiles) {
    if (!isObj(p) || typeof p.id !== 'string' || !/^[0-9a-f-]{8,64}$/i.test(p.id) || seen.has(p.id) || !isObj(p.state)) continue;
    seen.add(p.id);
    const state = Object.assign({}, p.state);
    // what the game reads as a table or a list must be one; state.js fills in whatever is dropped here
    ['inv', 'bought', 'scenes', 'stats', 'prog'].forEach(k => { if (k in state && !isObj(state[k])) delete state[k]; });
    ['unlocked', 'rewarded'].forEach(k => { if (k in state && !Array.isArray(state[k])) delete state[k]; });
    if (typeof state.coins !== 'number' || !isFinite(state.coins)) delete state.coins;
    profiles.push({ id: p.id, createdAt: +p.createdAt || 0, lastPlayedAt: +p.lastPlayedAt || 0,
      name: typeof p.name === 'string' ? p.name.slice(0, 12) : '', mute: !!p.mute, state });
    if (profiles.length === MAX_PROFILES) break;
  }
  if (!profiles.length) return { error: 'empty' };
  const at = Date.parse(f.exportedAt) || 0;
  return { file: { current: typeof f.current === 'string' ? f.current : null, at, profiles },
    kids: profiles.map(p => p.name), date: at ? new Date(at).toLocaleDateString() : '' };
}

// Replaces every child on the device with the children of the file. What was on the device is put aside first
// (sticker-backup-<date>, 30 days), like before the cloud copy replaces it. `signedIn`: the device has an account;
// then the loaded games are marked as changed at the time the file was made, so the next pull merges them with the
// cloud copy by the rules of two devices (cloud-sync.md 4.5) instead of losing either.
// Returns false when the copy of the current progress could not be put aside (no room): nothing is replaced then.
// The caller must stop the running game from being saved (state.js detach) and reload the page.
export function restoreBackup(file, signedIn) {
  try { Profiles.backup(Profiles.list().map(p => p.id)); } catch (e) { return false; }
  const at = file.at || Date.now();
  Profiles.replaceAll(file.profiles.map(p => ({ id: p.id, createdAt: p.createdAt, lastPlayedAt: p.lastPlayedAt, state: p.state,
    local: { kidName: p.name, mute: p.mute, baseVersion: 0, dirty: !!signedIn, changedAt: at } })), file.current);
  return true;
}
