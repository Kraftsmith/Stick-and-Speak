import { cpSync, existsSync, mkdirSync, rmSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const sourceDir = resolve(appDir, '..', 'prototype');
const outputDir = resolve(appDir, 'www');
const required = ['index.html', 'manifest.json', 'icon.png', 'img', 'audio'];

for (const entry of required) {
  if (!existsSync(resolve(sourceDir, entry))) {
    throw new Error(`Missing web asset: prototype/${entry}`);
  }
}

// app/www is generated output. Recreate it to prevent deleted or renamed assets
// from lingering in an iOS bundle after an incremental Capacitor sync.
rmSync(outputDir, { recursive: true, force: true });
mkdirSync(outputDir, { recursive: true });
cpSync(sourceDir, outputDir, { recursive: true });

console.log(`Prepared web assets in ${outputDir}`);
