// The parent's account and the cloud copy of the progress (Specs/features/cloud-sync.md, startup.md 4.3).
// The account is the source of truth, the device keeps a working copy: every screen reads and writes the local game;
// this module watches it, sends it to the server in the background and takes in what the account has.
// Nothing here is ever shown to the child and nothing waits for the network. Without a sign-in the module sleeps.
//
//   sticker-account   { id, email, token, pending, needsLogin, ahead, savedAt, deletes }   the signed-in parent
//   per profile (sticker-local-<id>): baseVersion, the version in the cloud this copy grew from; dirty, there are
//   changes the cloud has not got; changedAt, when the last of them was made.
import { Profiles, MAX_PROFILES } from './profiles.js';
import { profileId, watchSave, reloadProfile, renameProfile } from './state.js';
import { U } from './session.js';
import { isNative } from './platform.js';
import { onLeave } from './nav.js';
import { SCHEMA, toDoc, fromDoc, mergeDoc, migrateDoc, isEmptyDoc, countsOf } from './doc.js';

// on the site the API is the same domain; the native apps are served from the device and call the site
const API_BASE = isNative ? 'https://stickandplay.kids' : '';
const ACCOUNT = 'sticker-account', SIM = 'sticker-sim';
const PULL_EVERY = 5 * 60000, QUIET = 60000, TIMEOUT = 20000;

const read = () => { try { const a = JSON.parse(localStorage.getItem(ACCOUNT)); return a && a.id ? a : null; } catch (e) { return null; } };
let acct = read();
const keep = () => { if (acct) localStorage.setItem(ACCOUNT, JSON.stringify(acct)); else localStorage.removeItem(ACCOUNT); };
const fail = kind => Object.assign(new Error(kind), { kind });
const wait = ms => new Promise(res => setTimeout(res, ms));

/* ================= who listens ================= */
// the parent zone redraws its lines; the start-up redraws the screens a child sees when the cloud changed the game
const listeners = [];
export const onChange = fn => { listeners.push(fn); };
const emit = (what = {}) => listeners.forEach(fn => { try { fn(what); } catch (e) { console.error(e); } });

/* ================= testing ================= */
// Simulations of the Testing tab (startup.md 10); kept for the browser tab, so they survive a reload:
//   'offline'  every request fails after 5 s      'revoked'  every request answers 401
export const sim = () => sessionStorage.getItem(SIM) || '';
export function setSim(mode) { if (mode) sessionStorage.setItem(SIM, mode); else sessionStorage.removeItem(SIM); }
// what the last pull did, for the Boot log
export const lastPull = { at: '', ms: 0, text: 'no account on this device', rows: {} };

/* ================= requests ================= */
async function request(method, path, body, { keepalive = false } = {}) {
  if (sim() === 'offline') { await wait(5000); throw fail('network'); }
  if (sim() === 'revoked' && !path.startsWith('/api/auth') && path !== '/api/config') return { status: 401, data: null };
  const headers = {};
  if (body) headers['Content-Type'] = 'application/json';
  if (acct && acct.token) headers.Authorization = 'Bearer ' + acct.token;
  const stop = new AbortController(), timer = setTimeout(() => stop.abort(), TIMEOUT);
  let res;
  try {
    res = await fetch(API_BASE + path, { method, headers, body: body ? JSON.stringify(body) : undefined, credentials: 'include', keepalive, signal: stop.signal });
  } catch (e) { throw fail('network'); } finally { clearTimeout(timer); }
  let data = null; try { data = await res.json(); } catch (e) {}
  return { status: res.status, data, token: res.headers.get('set-auth-token') };
}
// the session is gone (the account was deleted elsewhere, the sign-in was revoked): the device plays on locally
function relogin() { if (acct && !acct.needsLogin) { acct.needsLogin = true; keep(); emit(); } }

/* ================= state ================= */
let pushing = false, pulling = null, offline = false, deferred = false, lastPullAt = 0;
let quietTimer = null, soonTimer = null, retryTimer = null, retryMs = 0;
const blocked = new Set();   // profiles the server did not take; they wait for the next pull
const ready = () => !!acct && !acct.needsLogin && !acct.pending;
// the playing profile's game may be replaced only where nothing on screen holds a part of it
const safe = () => ['home', 'path', 'who', 'firstrun', 'parent'].includes(U.current);
const dirtyIds = () => Profiles.list().map(p => p.id).filter(id => Profiles.load(id).local.dirty);

export const account = () => acct && { id: acct.id, email: acct.email, pending: !!acct.pending };
// what the parent zone shows (cloud-sync.md 3.2):
//   'out' | 'relogin' | 'update' | 'saving' | 'offline' | 'saved', and when the cloud last took a write
export function status() {
  if (!acct) return { state: 'out' };
  const at = acct.savedAt || 0;
  if (acct.needsLogin) return { state: 'relogin', at };
  if (acct.ahead) return { state: 'update', at };
  if (pushing) return { state: 'saving', at };
  if ((offline || navigator.onLine === false) && dirtyIds().length) return { state: 'offline', at };
  return { state: 'saved', at };
}

/* ================= dirty ================= */
// Called for every save of the playing game. The write itself waits for an event (a screen change, a purchase, the
// app going to the background) or, for quiet changes like the minutes of the daily limit, for a minute.
// After a sign-out the changes are still noted: the same parent may sign in again, and what was played meanwhile
// must not be taken for an old copy.
export function markDirty(id) {
  if (!id || !(acct || Profiles.device().lastAccountId) || !Profiles.has(id)) return;
  Profiles.setLocal(id, { dirty: true, changedAt: Date.now() });
  if (ready() && !quietTimer) quietTimer = setTimeout(() => { quietTimer = null; push(); }, QUIET);
}
export function pushSoon() {
  if (!ready() || soonTimer) return;
  soonTimer = setTimeout(() => { soonTimer = null; push(); }, 400);
}

/* ================= pull ================= */
// Takes every profile of the account from the server and brings the device up to date (startup.md 4.3).
export function pull() {
  if (!ready()) return Promise.resolve(null);
  if (pulling) return pulling;
  const t0 = performance.now();
  pulling = (async () => {
    try {
      const r = await request('GET', '/api/profiles');
      if (r.status === 401) { relogin(); Object.assign(lastPull, { text: 'the session is not valid: sign in again' }); return null; }
      if (r.status !== 200 || !r.data) throw fail('server');
      offline = false; lastPullAt = Date.now();
      if (r.data.account && r.data.account.email) acct.email = r.data.account.email;
      const rows = apply(r.data.profiles || []);
      Object.assign(lastPull, { at: new Date().toLocaleTimeString(), ms: Math.round(performance.now() - t0), rows,
        text: `answered in ${Math.round(performance.now() - t0)} ms` });
      if (dirtyIds().length) pushSoon();
      return rows;
    } catch (e) {
      offline = true; Object.assign(lastPull, { ms: Math.round(performance.now() - t0), text: 'no answer: ' + (e.kind || e.message) });
      emit(); return null;
    } finally { pulling = null; }
  })();
  return pulling;
}

// The rules of startup.md 4.3 for one answer of the server. Returns { id: { cloud, action } } for the Boot log.
function apply(server) {
  const rows = {}, seen = new Set();
  const note = (id, cloud, action) => { rows[id] = { cloud, action }; };
  let applied = false, profiles = false;
  acct.ahead = false; deferred = false; blocked.clear();
  for (const p of server) {
    seen.add(p.id);
    if ((acct.deletes || []).includes(p.id)) continue;   // deleted here, the server has not been told yet
    const doc = migrateDoc({ ...p.state, schema: p.schema });
    if (!doc) { acct.ahead = true; blocked.add(p.id); note(p.id, p.version, 'a newer format: not applied, update the app'); continue; }
    const at = Date.parse(p.updated_at) || 0;
    if (!Profiles.has(p.id)) {
      // added on another device: appears here without a name, with the picture and the language of the document
      const ok = Profiles.adopt(p.id, fromDoc(doc), { baseVersion: p.version, dirty: false });
      profiles = profiles || ok; note(p.id, p.version, ok ? 'created from the cloud' : 'no free place on this device'); continue;
    }
    const { state, local } = Profiles.load(p.id);
    if (p.version <= (local.baseVersion || 0)) { note(p.id, p.version, p.version < local.baseVersion ? 'the cloud is older than the base (!)' : 'unchanged'); continue; }
    const playing = p.id === profileId();
    if (playing && !safe()) { deferred = true; note(p.id, p.version, 'newer in the cloud: waits for a safe moment'); continue; }
    const next = local.dirty ? mergeDoc({ doc: toDoc(state), at: local.changedAt || 0 }, { doc, at }) : doc;
    Profiles.save(p.id, fromDoc(next, local));
    Profiles.setLocal(p.id, { baseVersion: p.version });
    note(p.id, p.version, local.dirty ? 'merged with the cloud' : 'taken from the cloud');
    applied = applied || playing;
  }
  for (const { id } of Profiles.list()) {
    if (seen.has(id)) continue;
    const { local } = Profiles.load(id);
    // never in the cloud (or the cloud is empty): this device has the only copy, it goes up
    if (!local.baseVersion || !server.length) {
      Profiles.setLocal(id, { baseVersion: 0, dirty: true, changedAt: local.changedAt || Date.now() });
      note(id, 0, 'only on this device: to be sent'); continue;
    }
    // deleted on another device. A child who is playing right now plays on until the next start.
    if (id === profileId() && U.home === 'home') { blocked.add(id); note(id, 0, 'deleted on another device: gone at the next start'); continue; }
    Profiles.backup([id]); Profiles.drop(id); profiles = true;
    note(id, 0, 'deleted on another device: removed, a copy is kept for 30 days');
  }
  keep();
  if (applied) reloadProfile();
  emit({ applied, profiles });
  return rows;
}

/* ================= push ================= */
// Sends every changed profile. A write carries the version it grew from; if the cloud has moved on, the server
// answers with its document, the two are merged here and the write is tried again (cloud-sync.md 4.5).
export async function push({ keepalive = false } = {}) {
  if (!ready() || pushing) return;
  clearTimeout(quietTimer); quietTimer = null;
  if (!dirtyIds().length && !(acct.deletes || []).length) return;
  pushing = true; emit();
  try {
    for (const id of (acct.deletes || []).slice()) {
      const r = await request('DELETE', '/api/profiles/' + id);
      if (r.status === 401) { relogin(); throw fail('stop'); }
      if (r.status >= 500) throw fail('server');
      acct.deletes = acct.deletes.filter(x => x !== id); keep();
    }
    for (const { id } of Profiles.list()) await pushOne(id, keepalive);
    offline = false; retryMs = 0;
  } catch (e) {
    if (e.kind === 'network' || e.kind === 'server') {
      offline = true;
      // the server is down: try again later, doubling the pause up to 10 minutes; no network: the `online` event does it
      if (e.kind === 'server') { retryMs = Math.min(retryMs ? retryMs * 2 : 1000, 600000); clearTimeout(retryTimer); retryTimer = setTimeout(push, retryMs); }
    } else if (e.kind !== 'stop') console.error(e);
  } finally { pushing = false; emit(); }
}
async function pushOne(id, keepalive) {
  for (let i = 0; i < 3; i++) {
    const { state, local } = Profiles.load(id);
    if (!local.dirty || blocked.has(id)) return;
    const sentAt = local.changedAt || 0;
    const r = await request('PUT', '/api/profiles/' + id,
      { base: local.baseVersion || 0, state: toDoc(state), schema: SCHEMA, device: Profiles.device().deviceId }, { keepalive });
    if (r.status === 401) { relogin(); throw fail('stop'); }
    if (r.status >= 500 || !r.data) throw fail('server');
    if (r.status === 404) {
      // never sent, and the id is taken: it was made under another account. The profile gets a new id.
      if (!local.baseVersion) { const to = Profiles.reid(id); renameProfile(id, to); id = to; continue; }
      blocked.add(id); return;   // deleted elsewhere: the next pull removes it here
    }
    if (r.status !== 200) {   // too large, a fifth profile: not tried again until the game changes
      console.warn('cloud: profile not saved,', r.data.error || r.status); Profiles.setLocal(id, { dirty: false }); return;
    }
    if (r.data.ok) {
      const now = Profiles.load(id).local;
      Profiles.setLocal(id, { baseVersion: r.data.version, dirty: (now.changedAt || 0) !== sentAt });
      acct.savedAt = Date.now(); keep(); return;
    }
    // the cloud has a newer document: merge and write again
    const doc = migrateDoc({ ...r.data.state, schema: r.data.schema });
    if (!doc) { acct.ahead = true; keep(); blocked.add(id); return; }
    const playing = id === profileId();
    if (playing && !safe()) { deferred = true; return; }
    Profiles.save(id, fromDoc(mergeDoc({ doc: toDoc(state), at: sentAt }, { doc, at: Date.parse(r.data.updated_at) || 0 }), local));
    Profiles.setLocal(id, { baseVersion: r.data.version, dirty: true });
    if (playing) { reloadProfile(); emit({ applied: true }); }
  }
}

/* ================= sign-in ================= */
let ways = null;
// The ways to sign in this server offers: ['email', 'google', 'apple'], or [] while the server has no keys for any
// (then the app shows no account at all). Google and Apple inside the native apps need their plugins (TASKS 2.6б,
// 9.2); until then the apps offer the e-mail code only. Without an answer the e-mail code is assumed.
export async function providers() {
  if (ways) return ways;
  try {
    const r = await request('GET', '/api/config');
    ways = (r.data && r.data.providers || ['email']).filter(p => !isNative || p === 'email');
  } catch (e) { return ['email']; }
  return ways;
}
// the letter with the 6-digit code
export async function sendCode(email) {
  const r = await request('POST', '/api/auth/email-otp/send-verification-otp', { email, type: 'sign-in' });
  if (r.status === 429) throw fail('often');
  if (r.status !== 200) throw fail(r.status === 400 ? 'email' : 'server');
}
// the code from the letter; resolves to what link() found
export async function verifyCode(email, otp) {
  const r = await request('POST', '/api/auth/sign-in/email-otp', { email, otp });
  if (r.status === 429) throw fail('often');
  if (r.status !== 200 || !r.data || !r.data.user) throw fail(r.status >= 500 ? 'server' : 'code');
  return signedIn(r.data.user, r.token);
}
// Google / Apple in a browser: the page leaves for the provider and comes back with ?signedin=1 (see resume())
export async function social(provider) {
  const back = new URL(location.href); back.searchParams.set('signedin', '1');
  const r = await request('POST', '/api/auth/sign-in/social', { provider, callbackURL: back.href });
  if (r.status !== 200 || !r.data || !r.data.url) throw fail('server');
  location.href = r.data.url;
}
// after the way back from Google / Apple: null if this start is not one, else what link() found
export async function resume() {
  const url = new URL(location.href);
  if (!url.searchParams.has('signedin')) return null;
  url.searchParams.delete('signedin'); history.replaceState(null, '', url);
  try {
    const r = await request('GET', '/api/auth/get-session');
    return r.status === 200 && r.data && r.data.user ? await signedIn(r.data.user, null) : null;
  } catch (e) { return null; }
}
function signedIn(user, token) {
  // the same account as before on this device: the copies still match their versions; another one: they start anew
  if (Profiles.device().lastAccountId !== user.id) Profiles.list().forEach(p => Profiles.setLocal(p.id, { baseVersion: 0, dirty: false }));
  acct = { id: user.id, email: user.email, token: isNative ? token : null, pending: true, deletes: [] };
  Profiles.setDevice({ lastAccountId: user.id }); keep();
  return link();
}

/* ================= the device joins the account ================= */
// Right after a sign-in. Looks at what the cloud has and what the device has (cloud-sync.md 3.3):
//   both have progress        -> { step: 'found', cloud: [...], local: [...], canKeep }: the parent chooses, then choose()
//   anything else             -> joined silently: { step: 'done', kids: [ids that came from the cloud], lostCurrent }
let found = null;
export async function link() {
  const r = await request('GET', '/api/profiles');
  if (r.status === 401) { relogin(); throw fail('code'); }
  if (r.status !== 200 || !r.data) throw fail('server');
  const cloud = r.data.profiles || [];
  const fresh = Profiles.list().map(p => ({ id: p.id, ...Profiles.load(p.id) })).filter(l => !l.local.baseVersion && !cloud.some(c => c.id === l.id));
  const full = fresh.filter(l => !isEmptyDoc(toDoc(l.state)));
  if (cloud.length && full.length) {
    found = { cloud, fresh, full };
    return { step: 'found', canKeep: cloud.length + full.length <= MAX_PROFILES,
      cloud: cloud.map(c => ({ id: c.id, at: Date.parse(c.updated_at) || 0, ...countsOf(c.state) })),
      local: full.map(l => ({ id: l.id, name: l.local.kidName || '', ...countsOf(toDoc(l.state)) })) };
  }
  return join(cloud, fresh, []);
}
// the parent's answer on "Found progress": 'cloud' takes the cloud's progress (the device's is put aside for 30 days),
// 'keep' adds the device's children to the account
export function choose(what) {
  if (!found) return null;
  const { cloud, fresh, full } = found; found = null;
  return join(cloud, fresh, what === 'cloud' ? full.map(l => l.id) : []);
}
function join(cloud, fresh, replaced) {
  const before = new Set(Profiles.list().map(p => p.id)), was = profileId();
  if (replaced.length) Profiles.backup(replaced);
  // the cloud has children: an empty profile made on this device a minute ago is not one more child
  const gone = cloud.length ? fresh.filter(l => replaced.includes(l.id) || isEmptyDoc(toDoc(l.state))).map(l => l.id) : [];
  gone.forEach(id => Profiles.drop(id));
  delete acct.pending; delete acct.needsLogin; keep();
  apply(cloud);
  lastPullAt = Date.now();
  pushSoon();
  return { step: 'done', kids: Profiles.list().map(p => p.id).filter(id => !before.has(id)), lostCurrent: !!was && !Profiles.has(was) };
}

/* ================= leaving ================= */
// the progress stays on the device and stops going to the cloud
export async function signOut() {
  try { await push(); await request('POST', '/api/auth/sign-out', {}); } catch (e) {}
  acct = null; keep(); found = null; emit();
}
// deletes the account and the progress of every child in the cloud; the device keeps its copy
export async function deleteAccount() {
  const r = await request('POST', '/api/account/delete', {});
  if (r.status !== 200) throw fail(r.status === 401 ? 'code' : 'server');
  acct = null; keep(); found = null;
  Profiles.setDevice({ lastAccountId: null });
  Profiles.list().forEach(p => Profiles.setLocal(p.id, { baseVersion: 0, dirty: false }));
  emit();
}
// a child is deleted in the parent zone: call before the profile is removed from the device
export function forget(id) {
  if (!acct || !Profiles.load(id).local.baseVersion) return;
  acct.deletes = [...(acct.deletes || []), id]; keep(); pushSoon();
}

// a request under the parent's session for another module (premium.js); without an account it answers 401
export const call = (method, path, body) => acct ? request(method, path, body) : Promise.resolve({ status: 401, data: null });

/* ================= testing ================= */
export async function cloudDocs() { const r = await request('GET', '/api/profiles'); return r.status === 200 ? r.data : { error: r.status }; }
// the playing profile pretends to have grown from an older version: the write must come back as a conflict and merge
export function forceConflict() {
  const id = profileId(), { local } = Profiles.load(id);
  Profiles.setLocal(id, { baseVersion: Math.max(0, (local.baseVersion || 0) - 1), dirty: true, changedAt: Date.now() });
  return push();
}
// every copy pretends to be old: after a reload the documents must come from the cloud
export function forgetVersions() { Profiles.list().forEach(p => Profiles.setLocal(p.id, { baseVersion: 0, dirty: false })); }

/* ================= start ================= */
export function init() {
  Profiles.purgeBackups();
  watchSave(markDirty);
  // a screen change is the moment to write (the end of a lesson, leaving the album, the collection or the settings)
  // and, if a newer cloud copy is waiting, the moment to take it in
  onLeave(() => { if (deferred && safe()) pull(); else if (acct && dirtyIds().length) pushSoon(); });
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) push({ keepalive: true });
    else if (ready() && Date.now() - lastPullAt > PULL_EVERY) pull();
  });
  // the network is back: what the cloud has first, then what this device has to send
  addEventListener('online', () => { offline = false; if (ready()) pull().then(() => push()); });
}
// A child starts playing, or a child was added: a profile the cloud has never seen goes up, and the cloud copy is
// asked for again unless that has just been done (cloud-sync.md 4.4, "on a change of profile")
export function onProfile() {
  if (!ready()) return;
  Profiles.list().forEach(p => { const l = Profiles.load(p.id).local; if (!l.baseVersion && !l.dirty) Profiles.setLocal(p.id, { dirty: true, changedAt: Date.now() }); });
  if (Date.now() - lastPullAt > 10000) pull(); else pushSoon();
}
// the cloud copy for the start-up: resolves when it has been applied, or to null when there is nothing to wait for
export function bootPull() {
  if (!ready()) { lastPull.text = acct ? (acct.needsLogin ? 'the session is not valid: sign in again' : 'the sign-in is not finished') : 'no account on this device'; return null; }
  if (navigator.onLine === false) { lastPull.text = 'the device is offline'; return null; }
  return pull();
}

export const Cloud = { init, bootPull, onProfile, pull, push, pushSoon, markDirty, account, status, onChange, providers, sendCode, verifyCode, social, resume,
  link, choose, signOut, deleteAccount, forget, call, sim, setSim, lastPull, cloudDocs, forceConflict, forgetVersions };
