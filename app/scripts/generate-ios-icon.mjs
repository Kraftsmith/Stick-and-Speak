import { copyFile, mkdtemp, rm } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

const appDir = resolve(import.meta.dirname, '..');
const source = resolve(appDir, '../prototype/img/stickers/forest/fox.png');
const nativeIcon = resolve(appDir, 'ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png');
const webIcon = resolve(appDir, '../prototype/icon.png');
const work = await mkdtemp(join(tmpdir(), 'stick-and-speak-icon-'));

function sips(...args) {
  const result = spawnSync('/usr/bin/sips', args, { stdio: 'inherit' });
  if (result.status !== 0) throw new Error(`sips failed with status ${result.status}`);
}

try {
  const sticker = join(work, 'sticker.png');
  const padded = join(work, 'padded.png');
  const flattened = join(work, 'flattened.jpg');
  const icon = join(work, 'icon.png');

  await copyFile(source, sticker);
  sips('-Z', '760', sticker, '--out', sticker);
  sips('--padToHeightWidth', '1024', '1024', '--padColor', 'F6D68B', sticker, '--out', padded);

  // App Store icons must be opaque; JPEG is used only as a lossless-in-practice
  // flattening step before writing the final RGB PNG.
  sips('-s', 'format', 'jpeg', '-s', 'formatOptions', '100', padded, '--out', flattened);
  sips('-s', 'format', 'png', flattened, '--out', icon);

  await Promise.all([copyFile(icon, nativeIcon), copyFile(icon, webIcon)]);
  console.log('Generated opaque 1024×1024 iOS and web icons from the existing fox sticker.');
} finally {
  await rm(work, { recursive: true, force: true });
}
