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

// Offline: a service worker keeps the app, its artwork and the voice clips on the device (web only: the native shells
// bundle the files). Persistent storage asks the browser not to evict the saved game when space runs low.
export function registerOffline() {
  if (isNative || !('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  navigator.serviceWorker.register('sw.js', { type: 'module' }).catch(() => {});
  if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});
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
