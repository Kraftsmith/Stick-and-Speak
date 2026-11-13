// What differs between the browser and the Capacitor shells (Android / iOS). Everything else is plain web.
export const CAP = window.Capacitor;
export const isNative = !!(CAP && CAP.isNativePlatform && CAP.isNativePlatform());

// inside the Android app (Capacitor) the WebView has no speechSynthesis, so use the native TTS plugin
// (the page has no @capacitor/core, so call the plugin straight through the native bridge)
export const NTTS = CAP && CAP.nativePromise && CAP.getPlatform && CAP.getPlatform() === 'android' ? {
  speak: o => CAP.nativePromise('TextToSpeech', 'speak', o),
  stop: () => CAP.nativePromise('TextToSpeech', 'stop', {}),
  supported: lang => CAP.nativePromise('TextToSpeech', 'isLanguageSupported', { lang }).then(r => !!(r && r.supported)),
  install: () => CAP.nativePromise('TextToSpeech', 'openInstall', {}),
} : null;

// Opened from the home screen (the manifest: fullscreen) or inside the native apps. Read once, at load: the first
// touch in a browser tab goes full screen (below), and then the display mode of a plain tab says "fullscreen" too.
export const installed = isNative || navigator.standalone === true || matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
// iPhone and iPad (an iPad calls itself a Mac): Safari drops the data of a site not opened for 7 days, unless the
// site is on the Home Screen
export const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
// Chrome on Android offers to install the game by itself. A child must not see that offer: it is kept for the
// button in the parent zone (parent.js).
let installOffer = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installOffer = e; });
addEventListener('appinstalled', () => { installOffer = null; });
export const canInstall = () => !!installOffer;
export function install() {
  if (!installOffer) return Promise.resolve(false);
  const e = installOffer; installOffer = null; e.prompt();
  return e.userChoice.then(c => c.outcome === 'accepted').catch(() => false);
}

// Where the saved game lives, for the Boot log: whether the browser promised not to evict it, and how much the site
// stores (the browser's estimate: the saved games, the offline cache, everything). null = the browser does not say.
export const storage = { persisted: null, usage: null, quota: null };
export async function storageCheck() {
  const st = navigator.storage;
  try { if (st && st.persisted) storage.persisted = await st.persisted(); } catch (e) {}
  try { if (st && st.estimate) { const e = await st.estimate(); storage.usage = e.usage; storage.quota = e.quota; } } catch (e) {}
  return storage;
}

// Offline: a service worker keeps the app, its artwork and the voice clips on the device (web only: the native shells
// bundle the files). Persistent storage asks the browser not to evict the saved game when space runs low.
export function registerOffline() {
  if (isNative) return;
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().then(ok => { storage.persisted = ok; }).catch(() => {});
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  navigator.serviceWorker.register('sw.js', { type: 'module' }).catch(() => {});
}

// Phones and tablets in a browser: the first touch goes full screen and locks the landscape orientation, where the
// browser allows it. Installed from the home screen (manifest: fullscreen, landscape) and in the native shells this is
// already so; on a computer with a mouse nothing happens.
export function fullscreenOnFirstTouch() {
  if (isNative) return;
  const touch = matchMedia('(pointer: coarse)').matches, standalone = matchMedia('(display-mode: standalone), (display-mode: fullscreen)').matches;
  if (!touch || standalone || !document.documentElement.requestFullscreen) return;
  addEventListener('pointerdown', () => {
    document.documentElement.requestFullscreen({ navigationUI: 'hide' })
      .then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'))
      .catch(() => {});
  }, { once: true });
}
