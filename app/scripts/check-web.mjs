import { existsSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const prototypeDir = resolve(appDir, '..', 'prototype');
const html = readFileSync(resolve(prototypeDir, 'index.html'), 'utf8');
const scriptStart = html.lastIndexOf('<script>');
const scriptEnd = html.lastIndexOf('</script>');

if (scriptStart < 0 || scriptEnd <= scriptStart) throw new Error('index.html must contain one inline application script');
new Function(html.slice(scriptStart + '<script>'.length, scriptEnd));

for (const marker of ['viewport-fit=cover', 'safe-area-inset-left', 'visualViewport', 'ResizeObserver']) {
  if (!html.includes(marker)) throw new Error(`Responsive viewport marker is missing: ${marker}`);
}

const manifest = JSON.parse(readFileSync(resolve(prototypeDir, 'manifest.json'), 'utf8'));
if (manifest.orientation !== 'landscape') throw new Error('The web manifest must stay landscape-only');

for (const entry of ['icon.png', 'img', 'audio']) {
  if (!existsSync(resolve(prototypeDir, entry))) throw new Error(`Missing prototype asset: ${entry}`);
}

console.log('Web app checks passed');
