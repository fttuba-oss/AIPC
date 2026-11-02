import { mkdir, readFile, writeFile, copyFile, stat, readdir, rm } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const manifest = JSON.parse(await readFile(path.join(root, 'audio-assets.json'), 'utf8'));
const target = process.env.AIPC_AUDIO_ASSET_DIR || path.join(root, 'public/audio/vendor');
const cache = process.env.AIPC_AUDIO_CACHE_DIR || path.join(root, 'node_modules/.cache/aipc-audio');
await mkdir(target, { recursive: true }); await mkdir(cache, { recursive: true });
const digest = async p => { const hash = createHash('sha256'); for await (const chunk of createReadStream(p)) hash.update(chunk); return hash.digest('hex'); };
const exists = async p => { try { return (await stat(p)).size > 0; } catch { return false; } };
async function download(url, destination) {
  const temporary = destination + '.download';
  try {
    execFileSync(process.platform === 'win32' ? 'curl.exe' : 'curl', ['--fail', '--location', '--silent', '--show-error', '--retry', '2', '--max-time', '300', url, '--output', temporary], { stdio: 'inherit' });
    await copyFile(temporary, destination);
  } finally { await rm(temporary, { force: true }); }
}
const font = path.join(target, 'FluidR3_GM.sf2');
if (!await exists(font)) {
  const deb = path.join(cache, 'fluid-soundfont.deb');
  if (!await exists(deb)) await download(manifest.fluidR3.url, deb);
  const bytes = await readFile(deb);
  if (createHash('sha256').update(bytes).digest('hex') !== manifest.fluidR3.sha256) {
    await rm(deb); throw new Error('FluidR3 checksum mismatch. Removed the download; rerun setup:audio.');
  }
  // Debian's ar container is simple to read; Windows and Linux tar both unpack data.tar.xz.
  let offset = 8, archive;
  while (offset + 60 <= bytes.length) {
    const header = bytes.subarray(offset, offset + 60).toString('ascii');
    const size = Number(header.slice(48, 58).trim());
    const name = header.slice(0, 16).trim().replace(/\/$/, '');
    if (!Number.isFinite(size) || size < 0) throw new Error('Invalid Debian archive');
    if (name.startsWith('data.tar')) { archive = path.join(cache, name); await writeFile(archive, bytes.subarray(offset + 60, offset + 60 + size)); break; }
    offset += 60 + size + size % 2;
  }
  if (!archive) throw new Error('FluidR3 package contains no data archive');
  const extracted = path.join(cache, 'extracted'); await mkdir(extracted, { recursive: true });
  execFileSync('tar', ['-xf', archive, '-C', extracted], { stdio: 'inherit' });
  await copyFile(path.join(extracted, 'usr/share/sounds/sf2/FluidR3_GM.sf2'), font);
}
if (await digest(font) !== manifest.fluidR3.soundfontSha256) throw new Error('Installed FluidR3 bank is damaged. Delete public/audio/vendor/FluidR3_GM.sf2 and rerun setup:audio.');
for (const [source, destination] of [
  ['externals/libfluidsynth-2.4.6.js', 'libfluidsynth.js'],
  ['dist/js-synthesizer.worklet.min.js', 'js-synthesizer.worklet.js'],
]) await copyFile(path.join(root, 'node_modules/js-synthesizer', source), path.join(target, destination));
const samples = path.join(target, 'vsco'); await mkdir(samples, { recursive: true });
const files = [...new Set(Object.values(manifest.vsco.families).flatMap(layers => layers.flatMap(layer => layer.files)))];
// Sequential downloads keep setup portable and avoid rate-limiting the sample host.
for (const name of files) {
  const file = path.join(samples, name);
  if (!await exists(file) || await digest(file) !== manifest.vsco.sha256[name]) await download(manifest.vsco.baseUrl + encodeURIComponent(name), file);
  if (await digest(file) !== manifest.vsco.sha256[name]) { await rm(file); throw new Error(`VSCO sample checksum mismatch: ${name}`); }
}
const licenseTarget = path.join(target, 'licenses'); await mkdir(licenseTarget, { recursive: true });
for (const name of await readdir(path.join(root, 'licenses'))) await copyFile(path.join(root, 'licenses', name), path.join(licenseTarget, name));
console.log(`Audio assets ready: FluidR3, FluidSynth worklet, ${files.length} VSCO recordings.`);
