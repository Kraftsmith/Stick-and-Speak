// Voice clips with ElevenLabs: every spoken line of the app -> web/audio/voice/<hash>.mp3, the manifest
// web/audio/voice/manifest.json and the module web/js/gen/voice.js (key "lang|text" -> file).
// Run: node app/voice.js            (skips clips that already exist; re-run after changing texts)
//      node app/voice.js --force    (re-render everything, e.g. after changing the voice)
//      node app/voice.js --force --lang en   (re-render one language only, e.g. after changing its model)
//      node app/voice.js --list     (only print the lines that have no clip yet and refresh the manifest; no API calls)
//      node app/voice.js --redo marked.txt   (re-render the lines in the file: "lang<TAB>text" per line, as Testing → Voices →
//                                             Copy marked gives them)
// The API key is read from ELEVENLABS_API_KEY or from the .env file in ENV_FILE (never stored here).
const fs = require('fs'), path = require('path'), crypto = require('crypto'), { pathToFileURL } = require('url');
const ROOT = path.join(__dirname, '..');
const WEB = path.join(ROOT, 'web');
const OUT = path.join(WEB, 'audio', 'voice');
const GEN = path.join(WEB, 'js', 'gen', 'voice.js');
const ENV_FILE = process.env.ENV_FILE || 'C:/Users/User/Documents/Projects/EgzaminPolskiB1/.env';
const FORCE = process.argv.includes('--force');
const LIST = process.argv.includes('--list');
const ONLY_LANG = process.argv.includes('--lang') ? process.argv[process.argv.indexOf('--lang') + 1] : null;
const REDO = process.argv.includes('--redo') ? process.argv[process.argv.indexOf('--redo') + 1] : null;

// ---- voices: one per language. An English voice reads Russian with an accent, so Russian lines need
// a native Russian voice from the ElevenLabs library (added to "My voices", then its id goes here or in VOICE_RU).
const VOICES = {
  en: process.env.VOICE_EN || 'XrExE9yKIg1WjnnlVkGX',   // "Matilda"
  ru: process.env.VOICE_RU || 'XrExE9yKIg1WjnnlVkGX',   // TODO: native Russian voice id
};
// ---- model, one per language. English must enforce the language: eleven_multilingual_v2 ignores language_code and
// guesses the language from the text, and a lone English word has nothing to guess from ("kite" came out as Italian
// "ki-te"). Only Turbo v2.5 and Flash v2.5 honour language_code, so English stays on Turbo v2.5.
// Russian: whole Russian sentences leave nothing to guess, and Turbo v2.5 read them with an accent and wrong stresses;
// from 2026-11-12 new and re-rendered Russian lines use Multilingual v2 (TASKS 4а.2). Clips made before keep Turbo v2.5
// until they are re-rendered (--force --lang ru).
const MODELS = { en: process.env.VOICE_MODEL_EN || 'eleven_turbo_v2_5', ru: process.env.VOICE_MODEL_RU || 'eleven_multilingual_v2' };
const takesLanguageCode = model => /_v2_5$|^eleven_v3$/.test(model);
// Lines that still sounded wrong with the language's model, heard in Testing → Voices (2026-11-12): their own model.
// Mostly short lines: a word or two gives the model too little to hold a Russian accent with this voice.
const LINE_MODEL = {
  'ru|Найди букву': 'eleven_v3', 'ru|Запомни!': 'eleven_v3', 'ru|Найди парочки!': 'eleven_v3', 'ru|Финиш!': 'eleven_v3', 'ru|Тебе кубок!': 'eleven_v3',
};
const modelOf = (lang, text) => LINE_MODEL[lang + '|' + text] || MODELS[lang];
// v3 takes stability 0 / 0.5 / 1 only and no other settings
const settingsFor = (model, lang) => model === 'eleven_v3' ? { stability: 0.5 } : { ...SETTINGS, speed: SPEED[lang] };
const SETTINGS = { stability: 0.55, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true };
const SPEED = { ru: 0.95, en: 0.85 };   // English a bit slower: the child is hearing new words

function apiKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  const m = fs.readFileSync(ENV_FILE, 'utf8').match(/^elevenlabs_api_key=(.+)$/im);
  if (!m) throw new Error('no elevenlabs_api_key in ' + ENV_FILE);
  return m[1].trim().replace(/^"|"$/g, '');
}

// ---- every line the app can say, built from the app's own data module so the word lists never drift.
// Keep in step with say(...) calls in web/js/*.js.
function allLines({ SETS, LETTERS, CHUNKS }) {
  const ru = t => ['ru', t], en = t => ['en', t];
  const lines = [];
  const PRAISE = ['Молодец!', 'Правильно!', 'Ура!', 'Отлично!', 'Супер!'];
  [ 'Найди', 'Перетащи картинку к её тени!', 'Что здесь лишнее? Нажми!', 'Каких букв не хватает?', 'Найди букву', 'С какой буквы начинается', '?',
    'Три подряд! Бонус!', 'Не спеши. Послушай ещё раз.', 'Посмотри, вот здесь!', 'Попробуй ещё!', 'Без единой ошибки! Золотая звезда!', 'Урок пройден!',
    'Можно купить стикер!', 'Обведи буквы', 'в слове', 'Обведи маленькую букву', 'Обведи букву', 'Собери картинку!', 'Запомни!', 'Найди парочки!', 'Жми на кнопку, чтобы ехать быстрее!', 'Собирай монеты!', 'Финиш!', 'Ты первый!',
    'Собери шарики одного цвета в ряд!', 'Поставь шарики по порядку, чтобы получилось слово!', 'Нажми на шарик!', 'А теперь — куда его поставить!',
    'Ура! Новый стикер!', 'И новый альбом!', 'Ещё немного монет! Пойдём играть?', 'Ты собрал весь набор!', 'Тебе кубок!', 'Привет!', 'Кто играет?', 'Привет! Это проверка.', 'Монетки за то, что пришёл!', ...PRAISE,
  ].forEach(t => lines.push(ru(t)));
  // the grown-up's name in every form the settings offer
  const PARENTS = [['маму', 'маме'], ['папу', 'папе'], ['бабушку', 'бабушке'], ['дедушку', 'дедушке'], ['маму или папу', 'маме или папе']];
  PARENTS.forEach(([acc, dat]) => {
    lines.push(ru(`Покажи ${dat}!`), ru(`Стикеры спят. Позови ${acc}, чтобы поиграть ещё.`), ru(`Это для взрослых. Позови ${acc}!`), ru(`Позови ${acc}! Покажи ${dat}!`));
  });
  // English: words, sticker names, set names, letters, sounds and the lesson sentences built from them
  const words = new Set();
  SETS.forEach(s => { lines.push(en(s.name), en(s.name + '!')); s.items.forEach(([, w]) => words.add(w)); });
  LETTERS.forEach(([ch, ws]) => {
    ws.forEach(([w]) => words.add(w));
    lines.push(en(ch), en(ch + '.'), en(`${ch} is for ${ws.map(w => w[0]).join(', and ')}.`));
    ws.forEach(([w]) => lines.push(en(`${ch}. ${w}.`)));
  });
  CHUNKS.forEach(([c, s, ws]) => {
    ws.forEach(([w]) => words.add(w));
    lines.push(en(s + '.'), en(s + ','), en(`${s}, as in ${ws.map(w => w[0]).join(', and ')}.`), en(`${s}, as in ${ws[0][0]}.`));
  });
  words.forEach(w => lines.push(en(w), en(w + '.'), en(w + '!')));
  lines.push(en('Hello!'), en('Hello! This is a test.'));
  lines.push(en('Three!'), en('Two!'), en('One!'), en('Go!'));   // the race countdown
  return lines;
}

// ---- render
const key = ([lang, text]) => lang + '|' + text;
const file = k => crypto.createHash('md5').update(k).digest('hex').slice(0, 10) + '.mp3';
async function tts(lang, text) {
  const model = modelOf(lang, text);
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICES[lang]}?output_format=mp3_44100_64`, {
    method: 'POST', headers: { 'xi-api-key': apiKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: model, ...(takesLanguageCode(model) ? { language_code: lang } : {}), voice_settings: settingsFor(model, lang) }),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return Buffer.from(await r.arrayBuffer());
}
(async () => {
  const data = await import(pathToFileURL(path.join(WEB, 'js', 'data.js')).href);
  const uniq = [...new Map(allLines(data).map(l => [key(l), l])).values()];
  fs.mkdirSync(OUT, { recursive: true });
  // --redo: the lines listed in the file, re-rendered even if their clip exists (a line not in the list is reported)
  const redo = REDO ? new Set(fs.readFileSync(REDO, 'utf8').split(/\r?\n/).filter(s => s.trim()).map(s => { const [lang, text] = s.split('\t'); return lang.trim() + '|' + text; })) : null;
  if (redo) [...redo].filter(k => !uniq.some(l => key(l) === k)).forEach(k => console.log('not in the list, skipped:', k));
  const todo = uniq.filter(l => (!ONLY_LANG || l[0] === ONLY_LANG) && (redo ? redo.has(key(l)) : FORCE || !fs.existsSync(path.join(OUT, file(key(l))))));
  console.log(`${uniq.length} lines, ${todo.length} to render`);
  if (LIST) { todo.forEach(([lang, text]) => console.log(lang, text)); writeManifest(uniq); return; }
  let made = 0, chars = 0, failed = 0;
  const queue = todo.slice();
  await Promise.all(Array.from({ length: 2 }, async () => {
    for (let l; (l = queue.shift());) {
      const [lang, text] = l;
      try { fs.writeFileSync(path.join(OUT, file(key(l))), await tts(lang, text)); made++; chars += text.length; process.stdout.write(`${lang} ${text}\n`); }
      catch (e) { failed++; console.error('FAILED', lang, text, e.message.slice(0, 200)); }
    }
  }));
  const n = writeManifest(uniq);
  console.log(`made ${made} clips (${chars} chars), failed ${failed}, manifest ${n}`);
})();
// VOICE: the lines that have a clip; LINES: every line of the list, with or without a clip (the Voices table in the
// parent zone, Testing, shows both, so a line spoken by the device's voice is easy to find)
function writeManifest(uniq) {
  const manifest = {};
  uniq.forEach(l => { const f = file(key(l)); if (fs.existsSync(path.join(OUT, f))) manifest[key(l)] = f.slice(0, -4); });
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest));
  fs.writeFileSync(GEN, `// Generated by app/voice.js: every spoken line, "lang|text" -> audio/voice/<file>.mp3. Do not edit by hand.\n`
    + `export const VOICE = ${JSON.stringify(manifest)};\n`
    + `// every line of the list in app/voice.js, recorded or not\nexport const LINES = ${JSON.stringify(uniq.map(key))};\n`);
  return Object.keys(manifest).length;
}
