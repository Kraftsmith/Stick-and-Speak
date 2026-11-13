// Sound: the voice (recorded clips, else speech synthesis, else the native TTS plugin), sound effects, background music.
import { S, save } from './state.js';
import { U, LESSON_SCREENS } from './session.js';
import { $ } from './stage.js';
import { VOICE } from './gen/voice.js';
import { SFX } from './gen/sfx.js';
import { sfxFile } from './data.js';
import { NTTS } from './platform.js';
import { ICON_SND, ICON_MUTE } from './icons.js';

/* ---- voice: instructions in Russian, English words in English ---- */
export const ru = t => [t, 'ru'], en = t => [t, 'en'], cheer = t => [t, 'ru', 1];
let voices = {};
function loadVoices() {
  const v = speechSynthesis.getVoices();
  voices.ru = v.find(x => x.lang.startsWith('ru'));
  voices.en = v.find(x => x.lang === 'en-US') || v.find(x => x.lang.startsWith('en'));
}
try { loadVoices(); speechSynthesis.addEventListener('voiceschanged', loadVoices); } catch (e) {}
let sayGen = 0;
export const ttsState = { log: '' };   // the last native TTS error, shown in the parent zone
const clipOf = p => { const [text, lang] = typeof p === 'string' ? [p, 'ru'] : p; const f = VOICE[lang + '|' + text]; return f ? 'audio/voice/' + f + '.mp3' : null; };
let clipAudio = null;
function playClip(src) {
  return new Promise(res => {
    if (clipAudio) { clipAudio.pause(); clipAudio = null; }
    const a = new Audio(src); a.volume = S.voiceVol / 100; clipAudio = a;
    a.onended = a.onerror = () => { if (clipAudio === a) clipAudio = null; res(); };
    a.play().catch(() => res());
  });
}
// The Voices table (parent zone, Testing): one line through its clip or through the device's voice, whatever the
// app would pick. Resolves when it ends, false if cut short. `how`: 'clip' | 'device'
export function hearLine(lang, text, how) {
  stopVoice();
  const gen = sayGen, p = [text, lang], src = clipOf(p);
  if (how === 'clip' && !src) return Promise.resolve(false);
  return (how === 'clip' ? playClip(src) : speakPart(p)).then(() => gen === sayGen);
}
export const hasClip = (lang, text) => !!clipOf([text, lang]);
// the device voices the app would use when a line has no clip (browser only; the native app uses the system TTS)
export const deviceVoices = () => NTTS ? { ru: 'system TTS (ru-RU)', en: 'system TTS (en-US)' }
  : { ru: voices.ru ? voices.ru.name + ' · ' + voices.ru.lang : 'none: Russian is read by the default voice', en: voices.en ? voices.en.name + ' · ' + voices.en.lang : 'none' };
export function stopVoice() {
  sayGen++; stopFx();
  if (clipAudio) { clipAudio.pause(); clipAudio = null; }
  if (NTTS) NTTS.stop().catch(() => {}); else try { speechSynthesis.cancel(); } catch (e) {}
}
// TTS for a single part (browser or native); resolves when it ends
function speakPart(p) {
  const [text, lang] = typeof p === 'string' ? [p, 'ru'] : p;
  if (NTTS) {
    const o = { text, lang: lang === 'en' ? 'en-US' : 'ru-RU', rate: lang === 'en' ? 0.8 : 0.95, pitch: 1.15, volume: S.voiceVol / 100, queueStrategy: 1 };
    return NTTS.speak(o).catch(e => {
      ttsState.log = (e && e.message) || String(e);
      if (/initialized/i.test(ttsState.log)) return new Promise(r => setTimeout(r, 600)).then(() => NTTS.speak(o)).catch(() => {});
    });
  }
  return new Promise(res => {
    try {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = lang === 'en' ? 'en-US' : 'ru-RU'; u.rate = lang === 'en' ? 0.8 : 0.95; u.pitch = 1.15; u.volume = S.voiceVol / 100;
      if (voices[lang]) u.voice = voices[lang];
      u.onend = u.onerror = () => res(); speechSynthesis.speak(u);
    } catch (e) { res(); }
  });
}
export function say(...parts) {
  if (S.mute || !S.voiceVol) return;
  if (!S.hints && LESSON_SCREENS.includes(U.current)) parts = parts.filter(p => typeof p !== 'string' && (p[1] !== 'ru' || p[2]));
  if (!parts.length) return;
  stopVoice();
  const gen = sayGen;
  // resolves true when everything was said, false when another line or a change of screen cut it short
  return parts.reduce((chain, p) => chain.then(() => {
    if (gen !== sayGen) return;
    const src = clipOf(p);
    return src ? playClip(src) : speakPart(p);
  }), Promise.resolve()).then(() => gen === sayGen);
}
// The own sound of a rare or special sticker (SPEC 3.6): a short clip from app/sfx.js; silent until its file exists.
let fxAudio = null;
function stopFx() { if (fxAudio) { fxAudio.pause(); fxAudio = null; } }
export function stickerSound(key) {
  stopFx();
  if (S.mute || !SFX.includes(key)) return;
  const a = new Audio(sfxFile(key)); a.volume = (S.sfxVol == null ? 100 : S.sfxVol) / 100; fxAudio = a;
  a.onended = a.onerror = () => { if (fxAudio === a) fxAudio = null; };
  a.play().catch(() => {});
}
// the name, then the sticker's sound; `then` runs with the sound (the scene of a special sticker)
export function sayThenSound(key, parts, then) {
  Promise.resolve(say(...parts)).then(done => { if (done === false) return; stickerSound(key); if (then) then(); });
}

let actx, musicBusNode = null;
const musicGain = () => Math.max(0, Math.min(100, S.musicVol)) / 50;   // 50% = the designed level, 100% = twice as loud
function musicBus() {
  if (!musicBusNode) { musicBusNode = actx.createGain(); musicBusNode.gain.value = musicGain(); musicBusNode.connect(actx.destination); }
  return musicBusNode;
}
function beep(freqs, dur = .12, type = 'sine') {
  if (S.mute) return;
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)();
    freqs.forEach((f, i) => {
      const o = actx.createOscillator(), g = actx.createGain();
      o.type = type; o.frequency.value = f; o.connect(g); g.connect(actx.destination);
      const t = actx.currentTime + i * dur;
      g.gain.setValueAtTime(.15, t); g.gain.exponentialRampToValueAtTime(.001, t + dur * 1.5);
      o.start(t); o.stop(t + dur * 1.6);
    });
  } catch (e) {}
}
export const sfx = { ok: () => beep([660, 880, 1320], .09), no: () => beep([220, 180], .12, 'triangle'),
  coin: () => beep([1200, 1600], .05, 'square'), snap: () => beep([520], .06, 'triangle'), pop: () => beep([400, 800], .05),
  miss: () => beep([330, 262], .1), gas: () => beep([150, 210], .03, 'triangle'),
  // lines (Specs/features/Lines.md): a ball hops, a new ball lands, a letter lights up, a row of balls bursts
  hop: () => beep([300, 520, 700], .05, 'triangle'), plop: () => beep([620, 420], .04), tick: () => beep([1040], .035, 'triangle'),
  burst: () => beep([900, 1200, 1500, 1900], .04) };
// the race car's motor: one quiet filtered tone, its pitch follows the speed (k = 0 at rest … 1 at top speed)
export const engine = (() => {
  let o = null, g = null;
  return {
    start() {
      if (o || S.mute) return;
      try {
        actx = actx || new (window.AudioContext || window.webkitAudioContext)();
        const f = actx.createBiquadFilter(); o = actx.createOscillator(); g = actx.createGain();
        o.type = 'sawtooth'; o.frequency.value = 55; f.type = 'lowpass'; f.frequency.value = 380; g.gain.value = 0;
        o.connect(f); f.connect(g); g.connect(actx.destination); o.start();
        g.gain.setTargetAtTime(.03, actx.currentTime, .2);
      } catch (e) { o = null; }
    },
    set(k) { if (o) o.frequency.setTargetAtTime(55 + 70 * k, actx.currentTime, .08); },
    stop() {
      if (!o) return;
      const oo = o, gg = g; o = g = null;
      try { gg.gain.setTargetAtTime(0, actx.currentTime, .06); oo.stop(actx.currentTime + .4); } catch (e) {}
    },
  };
})();

/* ---- fallback music: an original 8-bar music-box tune, synthesized live (used only if audio/main.mp3 can't load) ----
   C – G – Am – F | C – G – F – G, 92 bpm. */
export const synthMusic = (() => {
  const BPM = 92, BEAT = 60 / BPM, LOUD = { full: .16, low: .06 };
  const N = n => 440 * Math.pow(2, ({ C:-9, D:-7, E:-5, F:-4, G:-2, A:0, B:2 }[n[0]] + (+n.slice(-1) - 4) * 12) / 12);
  // melody: [note, beats] per bar
  const MEL = [
    [['E4',.5],['G4',.5],['C5',1],['B4',.5],['A4',.5],['G4',1]],
    [['G4',.5],['A4',.5],['B4',1],['D5',1],['B4',1]],
    [['C5',.5],['B4',.5],['A4',1],['E4',1],['A4',1]],
    [['F4',.5],['G4',.5],['A4',1],['C5',1],['A4',1]],
    [['G4',1],['E4',.5],['G4',.5],['C5',1],['E5',1]],
    [['D5',1],['B4',.5],['G4',.5],['D5',1],['B4',1]],
    [['A4',.5],['C5',.5],['F5',1],['E5',.5],['D5',.5],['C5',1]],
    [['B4',1],['D5',1],['C5',2]],
  ];
  const CH = [['C3','E4','G4'],['G2','B3','D4'],['A2','C4','E4'],['F2','A3','C4'],['C3','E4','G4'],['G2','B3','D4'],['F2','A3','C4'],['G2','B3','D4']];
  let out = null, bar = 0, next = 0, timer = null, mood = 'full';
  const on = () => S.music !== false && S.musicVol > 0 && !S.mute;
  function tone(f, t, len, type, vol) {
    const o = actx.createOscillator(), g = actx.createGain();
    o.type = type; o.frequency.value = f; o.connect(g); g.connect(out);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(vol, t + .015);
    g.gain.exponentialRampToValueAtTime(.0008, t + len);
    o.start(t); o.stop(t + len + .05);
  }
  function scheduleBar(t) {
    const b = bar % 8, [root, c1, c2] = CH[b];
    let x = t;
    MEL[b].forEach(([n, d]) => {            // music box: sine + a soft octave shimmer
      tone(N(n), x, d * BEAT * 1.6, 'sine', .5);
      tone(N(n) * 2, x, d * BEAT * .6, 'triangle', .07);
      x += d * BEAT;
    });
    [0, 2].forEach(k => tone(N(root), t + k * BEAT, BEAT * 1.8, 'triangle', .38));          // bass on beats 1 and 3
    [.5, 1.5, 2.5, 3.5].forEach((k, i) => tone(N(i % 2 ? c2 : c1), t + k * BEAT, BEAT * .8, 'sine', .12));  // soft off-beat chords
    bar++;
  }
  function tick() {
    while (next < actx.currentTime + .6) { scheduleBar(next); next += 4 * BEAT; }
  }
  function start() {
    if (!on() || timer || document.hidden) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      if (!out) { out = actx.createGain(); out.gain.value = 0; out.connect(musicBus()); }
      out.gain.cancelScheduledValues(actx.currentTime);
      out.gain.setTargetAtTime(LOUD[mood], actx.currentTime, .4);
      next = Math.max(next, actx.currentTime + .1);
      tick(); timer = setInterval(tick, 200);
    } catch (e) {}
  }
  function stop() {
    clearInterval(timer); timer = null;
    if (out) out.gain.setTargetAtTime(0, actx.currentTime, .15);
  }
  return {
    start, stop,
    setMood(m) { mood = m; if (out && timer) out.gain.setTargetAtTime(LOUD[m], actx.currentTime, .5); },
    toggle(v) { S.music = v; save(); v ? start() : stop(); },
  };
})();

/* ---- background music (made in Suno) ----
   full: "Sticker Meadow" (audio/main.mp3) on menus and the album; low: "Bouncy Plucked Motif" (audio/lesson.mp3) in lessons.
   Each track loops with a crossfade over its ending; switching screens crossfades between the tracks; stops when the app is hidden. */
export const music = (() => {
  const TRK = {
    full: { src: 'audio/main.mp3', end: 101, vol: .45 },
    low:  { src: 'audio/lesson.mp3', end: 119, vol: .22 },   // quieter: the voice must stay clear
  };
  const XF = 2.5;
  let failed = false, mood = 'full', cur = null, timer = null;
  const on = () => S.music !== false && S.musicVol > 0 && !S.mute;
  function load(tk) {
    if (!tk.loading) tk.loading = fetch(tk.src).then(r => { if (!r.ok) throw new Error(r.status); return r.arrayBuffer(); })
      .then(x => new Promise((res, rej) => actx.decodeAudioData(x, res, rej))).then(buf => { tk.buf = buf; })
      .catch(() => { failed = true; });
    return tk.loading;
  }
  // one pass of a track; the next pass starts XF seconds before this one ends and the two crossfade
  function playAt(p, t, first) {
    const s = actx.createBufferSource(), g = actx.createGain(), end = t + p.tk.end;
    s.buffer = p.tk.buf; s.connect(g); g.connect(p.out);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(1, t + (first ? .6 : XF));
    g.gain.setValueAtTime(1, end - XF); g.gain.linearRampToValueAtTime(0, end);
    s.start(t, 0); s.stop(end + .05);
    p.srcs.push(s); p.nextAt = end - XF;
  }
  function tick() { if (cur) while (cur.nextAt < actx.currentTime + 1.5) playAt(cur, cur.nextAt, false); }
  function fadeOut(p, sec) {
    if (!p) return;
    const t = actx.currentTime;
    p.out.gain.cancelScheduledValues(t); p.out.gain.setValueAtTime(p.out.gain.value, t); p.out.gain.linearRampToValueAtTime(0, t + sec);
    setTimeout(() => p.srcs.forEach(s => { try { s.stop(); } catch (e) {} }), sec * 1000 + 100);
  }
  function play(m) {
    const tk = TRK[m];
    if (!tk.buf) { load(tk).then(() => { if (cur === null && mood === m) start(); }); return; }
    const out = actx.createGain(); out.connect(musicBus());
    out.gain.setValueAtTime(0, actx.currentTime); out.gain.linearRampToValueAtTime(tk.vol, actx.currentTime + .8);
    cur = { m, tk, out, srcs: [], nextAt: 0 };
    playAt(cur, actx.currentTime + .05, true);
    if (!timer) timer = setInterval(tick, 500);
  }
  function start() {
    if (!on() || cur || document.hidden) return;
    try {
      actx = actx || new (window.AudioContext || window.webkitAudioContext)();
      if (actx.state === 'suspended') actx.resume();
      if (failed) { synthMusic.setMood(mood); return synthMusic.start(); }
      play(mood);
      load(TRK[mood === 'full' ? 'low' : 'full']);   // fetch the other track in the background
    } catch (e) {}
  }
  function stop() {
    synthMusic.stop();
    clearInterval(timer); timer = null;
    if (cur) { fadeOut(cur, .3); cur = null; }
  }
  return {
    start, stop,
    setMood(m) {
      synthMusic.setMood(m);
      if (m === mood) return;
      mood = m;
      if (!cur) return;
      fadeOut(cur, 1); cur = null;                      // crossfade to the other track
      if (on() && !document.hidden) { if (TRK[m].buf) play(m); else load(TRK[m]).then(() => { if (!cur && mood === m && on()) play(m); }); }
    },
    toggle(v) { S.music = v; save(); v ? start() : stop(); },
    // the volume slider: 0 switches the music off, anything else plays at that level
    setVol(v) {
      S.musicVol = v; S.music = v > 0; save();
      if (musicBusNode) musicBusNode.gain.setTargetAtTime(musicGain(), actx.currentTime, .05);
      v > 0 ? start() : stop();
    },
  };
})();
// sound on/off for the whole app (speaker icon in the top bar)
export function renderMute() { const b = $('mute'); b.innerHTML = S.mute ? ICON_MUTE : ICON_SND; b.classList.toggle('off', !!S.mute); }
$('mute').onclick = ev => {
  ev.stopPropagation();
  S.mute = !S.mute; save(); renderMute();
  if (S.mute) {
    music.stop();
    engine.stop();
    stopVoice();
  } else { music.start(); sfx.pop(); }
};
renderMute();
// browsers allow sound only after the first touch
addEventListener('pointerdown', () => music.start(), { once: true });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { music.stop(); try { actx && actx.suspend(); } catch (e) {} }
  else { try { actx && actx.resume(); } catch (e) {} music.start(); }
});
