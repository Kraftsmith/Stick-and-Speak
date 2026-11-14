// Service worker: the app works offline in the browser, like the installed app does (SPEC 7, "Офлайн").
// The app shell (page, styles, scripts) is served network-first, so an update arrives as soon as there is a
// connection and the cached copy carries the app when there is none. Artwork, music and voice clips never change
// once published (new words get new files), so they are served cache-first and fetched once.
// The native shells (Capacitor) bundle every file and do not register this worker (js/platform.js).
import { ART, BG, RACE_ART } from './js/gen/art.js';
import { VOICE } from './js/gen/voice.js';
import { SFX } from './js/gen/sfx.js';
import { sfxFile } from './js/data.js';

const CACHE = 'stick-and-speak-17';   // the name keeps the app's first name on purpose; 17: premium.js and paywall.js joined the shell
const SHELL = [
  './', 'index.html', 'manifest.json', 'icon.png',
  'css/base.css', 'css/home.css', 'css/learn.css', 'css/lesson.css', 'css/album.css', 'css/collection.css', 'css/parent.css', 'css/startup.css',
  'js/main.js', 'js/version.js', 'js/platform.js', 'js/icons.js', 'js/gen/art.js', 'js/gen/voice.js', 'js/gen/sfx.js', 'js/data.js', 'js/util.js', 'js/stage.js',
  'js/session.js', 'js/startup.js', 'js/profiles.js', 'js/state.js', 'js/audio.js', 'js/ui.js', 'js/nav.js', 'js/lessons.js', 'js/quiz.js', 'js/trace.js', 'js/puzzle.js',
  'js/pairs.js', 'js/lines.js', 'js/race.js', 'js/path.js', 'js/album.js', 'js/collection.js', 'js/parent.js', 'js/voicelist.js', 'js/cloud.js', 'js/account.js', 'js/doc.js', 'js/backup.js', 'js/premium.js', 'js/paywall.js',
];
const ARTWORK = ['img/splash.jpg', ...BG.map(b => `img/bg/${b}.jpg`), ...Object.entries(ART).flatMap(([set, words]) => words.map(w => `img/stickers/${set}/${w}.png`)), ...(RACE_ART || []).map(n => `img/race/${n}.png`)];
const MUSIC = ['audio/main.mp3', 'audio/lesson.mp3'];
const CLIPS = [...SFX.map(sfxFile), ...[...new Set(Object.values(VOICE))].map(f => `audio/voice/${f}.mp3`)];
const isAsset = url => /\/(img|audio)\//.test(url.pathname);

// fetch what is not cached yet, one file at a time, and never fail the whole batch over one file
async function fill(cache, urls) {
  for (const u of urls) {
    if (await cache.match(u)) continue;
    try { await cache.add(u); } catch (e) {}
  }
}

self.addEventListener('install', ev => {
  ev.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await cache.addAll(SHELL);          // without the shell there is no app: a failure here fails the install
    await fill(cache, [...ARTWORK, ...MUSIC]);
    self.skipWaiting();
  })());
});

self.addEventListener('activate', ev => {
  ev.waitUntil((async () => {
    for (const k of await caches.keys()) if (k !== CACHE) await caches.delete(k);
    await self.clients.claim();
    // the voice clips come last and in the background: the app is usable before they are all here
    fill(await caches.open(CACHE), CLIPS);
  })());
});

self.addEventListener('fetch', ev => {
  const req = ev.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  // the cloud copy of the progress must never come from a cache (cloud-sync.md 5.3)
  if (url.pathname.startsWith('/api/')) return;
  ev.respondWith(isAsset(url) ? cacheFirst(req) : networkFirst(req));
});

async function cacheFirst(req) {
  const cache = await caches.open(CACHE);
  const hit = await cache.match(req.url, { ignoreSearch: true });
  if (hit) return withRange(req, hit);
  const res = await fetch(req);
  if (res.ok) cache.put(req.url, res.clone());
  return res;
}

async function networkFirst(req) {
  const cache = await caches.open(CACHE);
  try {
    const res = await fetch(req);
    if (res.ok) cache.put(req, res.clone());
    return res;
  } catch (e) {
    const hit = await cache.match(req, { ignoreSearch: true }) || (req.mode === 'navigate' && await cache.match('index.html'));
    return hit || Response.error();
  }
}

// Audio elements may ask for a byte range; a cached whole file is sliced to answer it (Safari refuses a 200 otherwise).
async function withRange(req, res) {
  const range = req.headers.get('range');
  if (!range) return res;
  const buf = await res.arrayBuffer();
  const m = /bytes=(\d*)-(\d*)/.exec(range);
  const start = m && m[1] ? +m[1] : 0, end = m && m[2] ? Math.min(+m[2], buf.byteLength - 1) : buf.byteLength - 1;
  return new Response(buf.slice(start, end + 1), { status: 206, headers: {
    'Content-Type': res.headers.get('Content-Type') || 'application/octet-stream',
    'Content-Range': `bytes ${start}-${end}/${buf.byteLength}`, 'Content-Length': String(end - start + 1), 'Accept-Ranges': 'bytes',
  } });
}
