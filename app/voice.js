// Voice clips with ElevenLabs: every spoken line of the app -> prototype/audio/voice/<hash>.mp3
// and the `const VOICE = {...}` manifest line in prototype/index.html (key "lang|text" -> file).
// Run: node app/voice.js            (skips clips that already exist; re-run after changing texts)
//      node app/voice.js --force    (re-render everything, e.g. after changing the voice)
// The API key is read from ELEVENLABS_API_KEY or from the .env file in ENV_FILE (never stored here).
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'prototype', 'audio', 'voice');
const HTML = path.join(ROOT, 'prototype', 'index.html');
const ENV_FILE = process.env.ENV_FILE || 'C:/Users/User/Documents/Projects/EgzaminPolskiB1/.env';
const FORCE = process.argv.includes('--force');

// ---- voices: one per language. An English voice reads Russian with an accent, so Russian lines need
// a native Russian voice from the ElevenLabs library (added to "My voices", then its id goes here or in VOICE_RU).
const VOICES = {
  en: process.env.VOICE_EN || 'XrExE9yKIg1WjnnlVkGX',   // "Matilda"
  ru: process.env.VOICE_RU || 'XrExE9yKIg1WjnnlVkGX',   // TODO: native Russian voice id
};
const MODEL = process.env.VOICE_MODEL || 'eleven_multilingual_v2';
const SETTINGS = { stability: 0.55, similarity_boost: 0.8, style: 0.25, use_speaker_boost: true };
const SPEED = { ru: 0.95, en: 0.85 };   // English a bit slower: the child is hearing new words

function apiKey() {
  if (process.env.ELEVENLABS_API_KEY) return process.env.ELEVENLABS_API_KEY;
  const m = fs.readFileSync(ENV_FILE, 'utf8').match(/^elevenlabs_api_key=(.+)$/im);
  if (!m) throw new Error('no elevenlabs_api_key in ' + ENV_FILE);
  return m[1].trim().replace(/^"|"$/g, '');
}

// ---- the app's data, evaluated from index.html so the word lists never drift
const html = fs.readFileSync(HTML, 'utf8');
const block = (start, end) => { const a = html.indexOf(start); const b = html.indexOf(end, a); if (a < 0 || b < 0) throw new Error('block ' + start); return html.slice(a, b); };
const data = {};
new Function('out', block('const SETS = [', '\nconst slug') + '\nout.SETS = SETS;')(data);
new Function('out', block('const LETTERS = [', '\n];') + '\n];\nout.LETTERS = LETTERS;')(data);
new Function('out', block('const CHUNKS = [', '\n];') + '\n];\nout.CHUNKS = CHUNKS;')(data);
const { SETS, LETTERS, CHUNKS } = data;

// ---- every line the app can say. Keep in step with say(...) calls in index.html.
const ru = t => ['ru', t], en = t => ['en', t];
const lines = [];
const PRAISE = ['Молодец!', 'Правильно!', 'Ура!', 'Отлично!', 'Супер!'];
[ 'Найди', 'Перетащи картинку к её тени!', 'Что здесь лишнее? Нажми!', 'Каких букв не хватает?', 'Найди букву', 'С какой буквы начинается', '?',
  'Три подряд! Бонус!', 'Не спеши. Послушай ещё раз.', 'Посмотри, вот здесь!', 'Попробуй ещё!', 'Без единой ошибки! Золотая звезда!', 'Урок пройден!',
  'В магазине новый набор стикеров!', 'Можно купить стикер!', 'Обведи буквы', 'в слове', 'Обведи маленькую букву', 'Обведи букву', 'Собери картинку!',
  'Ура! Новый стикер!', 'И новый альбом!', 'Ты собрал весь набор!', 'Тебе кубок!', 'Привет!', 'Привет! Это проверка.', 'Монетки за то, что пришёл!', ...PRAISE,
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

// ---- render
const key = ([lang, text]) => lang + '|' + text;
const file = k => crypto.createHash('md5').update(k).digest('hex').slice(0, 10) + '.mp3';
const uniq = [...new Map(lines.map(l => [key(l), l])).values()];
fs.mkdirSync(OUT, { recursive: true });
async function tts(lang, text) {
  const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${VOICES[lang]}?output_format=mp3_44100_64`, {
    method: 'POST', headers: { 'xi-api-key': apiKey(), 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, model_id: MODEL, language_code: lang, voice_settings: { ...SETTINGS, speed: SPEED[lang] } }),
  });
  if (!r.ok) throw new Error(`${r.status} ${await r.text()}`);
  return Buffer.from(await r.arrayBuffer());
}
(async () => {
  let made = 0, chars = 0, failed = 0;
  const todo = uniq.filter(l => FORCE || !fs.existsSync(path.join(OUT, file(key(l)))));
  console.log(`${uniq.length} lines, ${todo.length} to render`);
  const queue = todo.slice();
  await Promise.all(Array.from({ length: 2 }, async () => {
    for (let l; (l = queue.shift());) {
      const [lang, text] = l;
      try { fs.writeFileSync(path.join(OUT, file(key(l))), await tts(lang, text)); made++; chars += text.length; process.stdout.write(`${lang} ${text}\n`); }
      catch (e) { failed++; console.error('FAILED', lang, text, e.message.slice(0, 200)); }
    }
  }));
  const manifest = {};
  uniq.forEach(l => { const f = file(key(l)); if (fs.existsSync(path.join(OUT, f))) manifest[key(l)] = f.slice(0, -4); });
  fs.writeFileSync(path.join(OUT, 'manifest.json'), JSON.stringify(manifest));
  let h = fs.readFileSync(HTML, 'utf8');
  if (!/^const VOICE = .*$/m.test(h)) throw new Error('index.html has no "const VOICE" line');
  h = h.replace(/^const VOICE = .*$/m, `const VOICE = ${JSON.stringify(manifest)};   // generated by app/voice.js: "lang|text" -> audio/voice/<file>.mp3`);
  fs.writeFileSync(HTML, h);
  console.log(`made ${made} clips (${chars} chars), failed ${failed}, manifest ${Object.keys(manifest).length}`);
})();
