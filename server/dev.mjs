// A local stand-in for Vercel: the site at /, the game at /play/, the functions of api/ at /api/.
//   node --env-file=.env.local server/dev.mjs [port]        (3210 by default)
// The files are read from site/ and web/ as they are, without a build; the functions are the same modules Vercel runs.
// `vercel dev` does the same, but on Windows it needs the right to create symlinks.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, normalize, resolve } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const port = +process.argv[2] || 3210;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.webp': 'image/webp',
  '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg', '.mp4': 'video/mp4', '.ico': 'image/x-icon', '.woff2': 'font/woff2' };

// /api/auth/<path> -> api/auth.js?path=<path> (the rewrite of vercel.json); /api/profiles/<id> -> api/profiles/[id].js
function route(url) {
  const p = url.pathname.replace(/\/+$/, '');
  if (p === '/api/auth' || p.startsWith('/api/auth/')) { url.searchParams.set('path', p.slice('/api/auth/'.length)); return 'api/auth.js'; }
  if (/^\/api\/profiles\/[^/]+$/.test(p)) return 'api/profiles/[id].js';
  if (p === '/api/profiles') return 'api/profiles/index.js';
  return p.slice(1) + '.js';
}
const loaded = {};
async function callApi(req, res, url) {
  const file = route(url);
  if (file.split('/').some(s => s.startsWith('_') || s === '..')) return send(res, 404, 'not found');
  let mod;
  try { mod = loaded[file] = loaded[file] || await import(pathToFileURL(join(root, file)).href); } catch (e) {
    if (e.code === 'ERR_MODULE_NOT_FOUND' && String(e.message).includes(file.split('/').pop())) return send(res, 404, 'not found');
    console.error(e); return send(res, 500, 'the function did not load');
  }
  const chunks = []; for await (const c of req) chunks.push(c);
  const init = { method: req.method, headers: req.headers };
  if (!['GET', 'HEAD'].includes(req.method)) init.body = Buffer.concat(chunks);
  const out = await mod.default.fetch(new Request(url, init));
  const headers = {}; out.headers.forEach((v, k) => { if (k !== 'set-cookie') headers[k] = v; });
  const cookies = out.headers.getSetCookie(); if (cookies.length) headers['set-cookie'] = cookies;
  res.writeHead(out.status, headers); res.end(Buffer.from(await out.arrayBuffer()));
}
const send = (res, status, text) => { res.writeHead(status, { 'Content-Type': 'text/plain' }); res.end(text); };

async function sendFile(res, url) {
  let p = decodeURIComponent(url.pathname);
  if (p === '/play') { res.writeHead(308, { Location: '/play/' }); return res.end(); }
  // the site reads the game's pictures from ../web/; from the root that is /web/
  const [base, rel] = p.startsWith('/play/') ? ['web', p.slice(6)] : p.startsWith('/web/') ? ['web', p.slice(5)] : ['site', p.slice(1)];
  let file = normalize(join(root, base, rel));
  if (!file.startsWith(join(root, base))) return send(res, 403, 'forbidden');
  try { if ((await stat(file)).isDirectory()) file = join(file, 'index.html'); } catch (e) {}
  try {
    const body = await readFile(file);
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] || 'application/octet-stream', 'Cache-Control': 'no-store' }); res.end(body);
  } catch (e) { send(res, 404, 'not found'); }
}

createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  (url.pathname.startsWith('/api/') ? callApi(req, res, url) : sendFile(res, url))
    .catch(e => { console.error(e); if (!res.headersSent) send(res, 500, 'error'); else res.end(); });
}).listen(port, () => console.log(`http://localhost:${port}/  (site)   http://localhost:${port}/play/  (game)   /api/`));
