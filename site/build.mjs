// Builds what Vercel serves into dist/: the site at /, the game at /play/ (Specs/Web/Web.md, section 10).
//   node site/build.mjs
// The site's sources read the game's pictures, icons and clips from ../web/ (handy on a local server from the
// repository root); in dist/ the game lives in play/, so those paths are rewritten here.
import { cpSync, rmSync, mkdirSync, readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');
const SKIP_WEB = new Set(['.vercel', '.gitignore', 'README.md', 'node_modules']);
const SKIP_SITE = new Set(['build.mjs', 'kill-sw.js']);

rmSync(dist, { recursive: true, force: true });
mkdirSync(join(dist, 'play'), { recursive: true });

for (const f of readdirSync(join(root, 'site'))) if (!SKIP_SITE.has(f)) cpSync(join(root, 'site', f), join(dist, f), { recursive: true });
for (const f of readdirSync(join(root, 'web'))) if (!SKIP_WEB.has(f)) cpSync(join(root, 'web', f), join(dist, 'play', f), { recursive: true });

// ../web/ -> ./play/ in the site's own files
let n = 0;
for (const f of ['index.html', 'site.css', 'site.js']) {
  const p = join(dist, f), src = readFileSync(p, 'utf8');
  const out = src.replaceAll('../web/', './play/');
  n += src.split('../web/').length - 1;
  writeFileSync(p, out);
}

// The game used to live at / with a service worker that controls the whole site. This one replaces it for those
// who played there: it removes itself, and the game's own worker takes over under /play/.
cpSync(join(root, 'site', 'kill-sw.js'), join(dist, 'sw.js'));

console.log(`dist/ ready: site at /, game at /play/ (${n} paths rewritten)`);
