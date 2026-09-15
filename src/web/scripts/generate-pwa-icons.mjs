#!/usr/bin/env node
// Dev-only tool: rasterises `pwa-icon.svg` (the app's original mark, see that file's comment) into
// the PNG sizes the manifest (`public/manifest.webmanifest`) and `index.html`'s apple-touch-icon
// reference need. Not part of the Angular build — rerun manually (`node scripts/generate-pwa-icons.mjs`)
// after editing the source SVG and commit the resulting PNGs, the same way an update to any other
// static asset in `public/` is committed.
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const source = join(here, 'pwa-icon.svg');
const outDir = join(here, '../public/icons');

// The manifest lists these (icon set) plus a dedicated maskable entry at 192/512, reusing the
// same files — the source mark already keeps its content inside the maskable safe zone.
const sizes = [72, 96, 128, 144, 152, 192, 384, 512];

for (const size of sizes) {
  const out = join(outDir, `icon-${size}x${size}.png`);
  execFileSync('rsvg-convert', ['-w', String(size), '-h', String(size), '-o', out, source]);
  console.log(`Wrote ${out}`);
}

// iOS ignores the manifest and reads this size via <link rel="apple-touch-icon"> in index.html;
// it must have no transparency, which the source's full-bleed background already satisfies.
const appleTouchIcon = join(here, '../public/apple-touch-icon.png');
execFileSync('rsvg-convert', ['-w', '180', '-h', '180', '-o', appleTouchIcon, source]);
console.log(`Wrote ${appleTouchIcon}`);
