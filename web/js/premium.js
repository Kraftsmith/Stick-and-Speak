// Premium (Specs/features/subscription.md): what is free, what is locked, and whether this family has paid.
// The only place that knows the border of the free plan; every screen asks here.
//   sticker-premium   { account, until, forever, source, checkedAt }   what the server said last, kept for 7 days offline
//   sticker-paywall   the Testing switch: '' | 'on' | 'free' | 'premium'
import { S, isDone, doneCount } from './state.js';
import { TRACKS, SETS } from './data.js';
import { CAP, isNative } from './platform.js';
import { Cloud } from './cloud.js';

// The locks are switched off until a subscription can really be bought in the stores (TASKS 3.9): a child must never
// meet a lock that the parent has no way to open. The Testing tab switches them on for one device.
export const PAYWALL = false;
// the free plan: 20 circles of the lesson path (any levels, counted once and for ever), one album, one child
export const FREE = { lessons: 20, album: SETS[0].id, profiles: 1 };
// The plans. The prices are the ones set in the stores for the euro countries; inside the native apps the store's own
// price in the local currency replaces them when the purchases are connected (TASKS 3.2).
export const PLANS = [
  { id: 'premium_monthly', kind: 'month', price: '4,99 €' },
  { id: 'premium_yearly', kind: 'year', price: '29,99 €', best: true },
  { id: 'premium_lifetime', kind: 'forever', price: '69,99 €' },
];
// Apple does not allow an app to open paid content with its own codes (App Store Review Guideline 3.1.1): the iOS app
// has no field for a promo code and never mentions one. The site on an iPhone is the site: the field is there.
export const promoAllowed = !(isNative && CAP.getPlatform && CAP.getPlatform() === 'ios');

const KEY = 'sticker-premium', MODE = 'sticker-paywall';
const OFFLINE_MS = 7 * 86400000, FRESH_MS = 3600000;

const read = () => { try { const c = JSON.parse(localStorage.getItem(KEY)); return c && c.account ? c : null; } catch (e) { return null; } };
let cache = read();
const keep = () => { try { if (cache) localStorage.setItem(KEY, JSON.stringify(cache)); else localStorage.removeItem(KEY); } catch (e) {} };
const listeners = [];
export const onChange = fn => { listeners.push(fn); };
const emit = () => listeners.forEach(fn => { try { fn(); } catch (e) { console.error(e); } });

/* ================= testing ================= */
export const mode = () => { try { return localStorage.getItem(MODE) || ''; } catch (e) { return ''; } };
export function setMode(m) { try { if (m) localStorage.setItem(MODE, m); else localStorage.removeItem(MODE); } catch (e) {} emit(); }
// are the locks of the free plan in force on this device
export const limitsOn = () => PAYWALL || mode() !== '';

/* ================= the state ================= */
// What the parent zone shows:
//   'free'      never had premium            'premium'  open now (until a date, or for ever)
//   'expired'   had it, the time is over      'stale'    had it, but the device has not asked the server for 7 days
export function state() {
  const m = mode();
  if (m === 'premium') return { kind: 'premium', until: null, forever: true, source: 'testing' };
  if (m === 'free') return { kind: 'free' };
  const acc = Cloud.account();
  if (!cache || !acc || cache.account !== acc.id) return { kind: 'free' };
  const { until, forever, source, checkedAt } = cache, now = Date.now();
  if (!forever && !until) return { kind: 'free' };
  if (!forever && until <= now) return { kind: 'expired', until, source };
  if (now - checkedAt > OFFLINE_MS) return { kind: 'stale', until, forever, source };
  return { kind: 'premium', until, forever, source };
}
export const isPremium = () => !limitsOn() || state().kind === 'premium';

/* ================= what is locked ================= */
// circles of the path the child has finished, on every level
export const lessonsDone = () => Object.keys(TRACKS).reduce((n, tr) => n + doneCount(tr), 0);
// a new lesson past the free twenty; a finished lesson is never locked and can be played again
export const lessonLocked = (tr, i) => !isPremium() && !isDone(tr, i) && lessonsDone() >= FREE.lessons;
// new stickers are bought in the free album only; stickers the child already has stay and stick anywhere
export const stickerLocked = setId => !isPremium() && setId !== FREE.album;
// a second child on the device
export const canAddProfile = n => isPremium() || n < FREE.profiles;

/* ================= the server ================= */
function take(data) {
  const acc = Cloud.account(); if (!acc) return;
  cache = { account: acc.id, until: data.until ? Date.parse(data.until) : null, forever: !!data.forever, source: data.source || 'promo', checkedAt: Date.now() };
  keep(); emit();
}
// asks the server what the account has; without an answer what the device remembers stays (for 7 days)
export async function refresh() {
  const acc = Cloud.account();
  if (!acc) { if (cache) { cache = null; keep(); emit(); } return state(); }
  try {
    const r = await Cloud.call('GET', '/api/premium');
    if (r.status === 200 && r.data) take(r.data);
  } catch (e) {}
  return state();
}
// a promo code: { ok, until, forever } or { error: 'not_found' | 'expired' | 'exhausted' | 'already_used' | 'signin' | 'network' }
export async function redeem(code) {
  if (!promoAllowed) return { error: 'not_found' };
  if (!Cloud.account()) return { error: 'signin' };
  let r;
  try { r = await Cloud.call('POST', '/api/redeem', { code }); } catch (e) { return { error: 'network' }; }
  if (r.status === 401) return { error: 'signin' };
  if (r.status === 200 && r.data && r.data.ok) { take({ ...r.data, source: 'promo' }); return r.data; }
  return { error: r.data && ['not_found', 'expired', 'exhausted', 'already_used'].includes(r.data.error) ? r.data.error : 'network' };
}

/* ================= start ================= */
export function init() {
  let last = (Cloud.account() || {}).id || null;
  refresh();
  // the parent signed in, signed out or deleted the account: premium belongs to the account, not to the device
  Cloud.onChange(() => {
    const id = (Cloud.account() || {}).id || null;
    if (id === last) return;
    last = id; refresh();
  });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && cache && Date.now() - cache.checkedAt > FRESH_MS) refresh(); });
}

export const Premium = { PAYWALL, FREE, PLANS, promoAllowed, init, onChange, mode, setMode, limitsOn, state, isPremium, lessonsDone, lessonLocked,
  stickerLocked, canAddProfile, refresh, redeem };
