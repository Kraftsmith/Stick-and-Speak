// Sticker art pipeline: Art/stickers/<set>/<word>.png (Codex output, ~1250px, transparent)
//   -> web/img/stickers/<set>/<word>.png (360px) and the module web/js/gen/art.js (which stickers have artwork).
// Also the launch screen: Art/splash.png -> web/img/splash.jpg.
// Run: node app/art.js   (needs ffmpeg on PATH)
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'Art', 'stickers'), DST = path.join(ROOT, 'web', 'img', 'stickers');
const GEN = path.join(ROOT, 'web', 'js', 'gen', 'art.js');
const SIZE = 360;
const art = {};
for (const set of fs.existsSync(SRC) ? fs.readdirSync(SRC) : []) {
  const dir = path.join(SRC, set);
  if (!fs.statSync(dir).isDirectory()) continue;
  for (const f of fs.readdirSync(dir)) {
    if (!/^[a-z-]+\.png$/.test(f)) continue;
    const word = f.slice(0, -4), src = path.join(dir, f), out = path.join(DST, set, f);
    fs.mkdirSync(path.dirname(out), { recursive: true });
    if (!fs.existsSync(out) || fs.statSync(out).mtimeMs < fs.statSync(src).mtimeMs) {
      // keep the alpha channel; fit inside a square and pad to it so every sticker is the same box
      execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src,
        '-vf', `scale=${SIZE}:${SIZE}:force_original_aspect_ratio=decrease,pad=${SIZE}:${SIZE}:(ow-iw)/2:(oh-ih)/2:color=0x00000000,format=rgba`,
        '-compression_level', '9', out]);
      console.log('made', set + '/' + f);
    }
    (art[set] = art[set] || []).push(word);
  }
}
// the launch screen: Art/splash.png -> web/img/splash.jpg (at most 1920px wide)
const SPLASH = path.join(ROOT, 'Art', 'splash.png'), SPLASH_OUT = path.join(ROOT, 'web', 'img', 'splash.jpg');
if (fs.existsSync(SPLASH) && (!fs.existsSync(SPLASH_OUT) || fs.statSync(SPLASH_OUT).mtimeMs < fs.statSync(SPLASH).mtimeMs)) {
  execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', SPLASH, '-vf', "scale='min(1920,iw)':-2:flags=lanczos,format=yuvj444p", '-q:v', '3', SPLASH_OUT]);
  console.log('made splash.jpg');
}
// iOS shows this picture while the app starts (LaunchScreen.storyboard, image "Splash"); Android draws its own launch
// screen from the app icon and a colour (res/values/splash.xml), so it gets no file
const IOS_SPLASH = path.join(__dirname, 'ios', 'App', 'App', 'Assets.xcassets', 'Splash.imageset');
if (fs.existsSync(SPLASH_OUT) && fs.existsSync(IOS_SPLASH)) {
  for (const f of fs.readdirSync(IOS_SPLASH)) if (f !== 'splash.jpg') fs.rmSync(path.join(IOS_SPLASH, f));
  fs.copyFileSync(SPLASH_OUT, path.join(IOS_SPLASH, 'splash.jpg'));
  fs.writeFileSync(path.join(IOS_SPLASH, 'Contents.json'), JSON.stringify({
    images: [{ idiom: 'universal', filename: 'splash.jpg', scale: '1x' }, { idiom: 'universal', scale: '2x' }, { idiom: 'universal', scale: '3x' }],
    info: { version: 1, author: 'xcode' } }, null, 2) + '\n');
}
// backgrounds: Art/backgrounds/<id>.png (Codex output, 3:2) -> web/img/bg/<id>.jpg, cropped to the middle band the screen shows:
// an album page is 1280x620, the home screen ("homescreen") 1280x800
const BG_SRC = path.join(ROOT, 'Art', 'backgrounds'), BG_DST = path.join(ROOT, 'web', 'img', 'bg');
const bg = [];
for (const f of fs.existsSync(BG_SRC) ? fs.readdirSync(BG_SRC) : []) {
  if (!/^[a-z]+\.png$/.test(f)) continue;
  const id = f.slice(0, -4), src = path.join(BG_SRC, f), out = path.join(BG_DST, id + '.jpg');
  const ratio = id === 'homescreen' ? '800/1280' : '620/1280';
  fs.mkdirSync(BG_DST, { recursive: true });
  if (!fs.existsSync(out) || fs.statSync(out).mtimeMs < fs.statSync(src).mtimeMs) {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src, '-vf', `crop=iw:trunc(iw*${ratio}/2)*2,scale='min(1920,iw)':-2:flags=lanczos,format=yuvj444p`, '-q:v', '3', out]);
    console.log('made bg/' + id + '.jpg');
  }
  bg.push(id);
}
// race artwork (Specs/features/racing.md): Art/race/<name>.png (Codex output, transparent) -> web/img/race/<name>.png,
// fitted into a box twice the size it is shown at: the cars 120x200, the gate beam 520x174, a sign 200x196
const RACE_SRC = path.join(ROOT, 'Art', 'race'), RACE_DST = path.join(ROOT, 'web', 'img', 'race');
const RACE_BOX = { 'car-red': [240, 400], 'car-blue': [240, 400], 'gate-bar': [1040, 347], sign: [400, 400] };
const race = [];
for (const f of fs.existsSync(RACE_SRC) ? fs.readdirSync(RACE_SRC) : []) {
  const id = f.slice(0, -4);
  if (!f.endsWith('.png') || !RACE_BOX[id]) continue;
  const src = path.join(RACE_SRC, f), out = path.join(RACE_DST, f), [w, h] = RACE_BOX[id];
  fs.mkdirSync(RACE_DST, { recursive: true });
  if (!fs.existsSync(out) || fs.statSync(out).mtimeMs < fs.statSync(src).mtimeMs) {
    execFileSync('ffmpeg', ['-v', 'error', '-y', '-i', src,
      '-vf', `scale=${w}:${h}:force_original_aspect_ratio=decrease:flags=lanczos,pad=${w}:${h}:(ow-iw)/2:(oh-ih)/2:color=0x00000000,format=rgba`,
      '-compression_level', '9', out]);
    console.log('made race/' + f);
  }
  race.push(id);
}
Object.values(art).forEach(a => a.sort());
fs.mkdirSync(path.dirname(GEN), { recursive: true });
fs.writeFileSync(GEN, `// Generated by app/art.js: which stickers have real artwork (img/stickers/<set>/<word>.png). Do not edit by hand.\nexport const ART = ${JSON.stringify(art)};\n// backgrounds with artwork (img/bg/<id>.jpg): album pages by set id, and "homescreen"\nexport const BG = ${JSON.stringify(bg.sort())};\n// race pictures with artwork (img/race/<name>.png); the race draws the rest itself\nexport const RACE_ART = ${JSON.stringify(race.sort())};\n`);
console.log('ART:', Object.entries(art).map(([s, a]) => `${s} ${a.length}`).join(', ') || 'none');
