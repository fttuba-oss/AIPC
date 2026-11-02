import { readFile, writeFile, mkdir, copyFile, cp, stat } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const run = (file, args = [], env = process.env) => execFileSync(process.execPath, [path.join(root, file), ...args], { cwd: root, env, stdio: 'inherit' });
run('scripts/setup-audio.mjs');
run('node_modules/typescript/bin/tsc', ['-b']);
run('node_modules/vite/bin/vite.js', ['build'], { ...process.env, AIPC_STUDENT_TRIAL: 'true' });

const dist = path.join(root, 'dist');
const { xml } = JSON.parse(await readFile(path.join(root, 'storage/scores/score_1792034229527_snur.json'), 'utf8'));
if (typeof xml !== 'string' || !xml.includes('<score-partwise')) throw new Error('Sunny Island source is missing.');
await mkdir(path.join(dist, 'trial'), { recursive: true });
await writeFile(path.join(dist, 'trial/sunny-island.musicxml'), xml);
await cp(path.join(root, 'public/audio'), path.join(dist, 'audio'), { recursive: true });
await copyFile(path.join(dist, 'student.html'), path.join(dist, 'index.html'));
for (const entry of ['index.html', 'student.html']) {
  const file = path.join(dist, entry);
  // The ordinary dev favicon is not part of this standalone trial.
  await writeFile(file, (await readFile(file, 'utf8')).replace(/\s*<link rel="icon"[^>]*>/g, ''));
}
await writeFile(path.join(dist, '.nojekyll'), '');
const credits = await import('node:fs/promises').then(fs => fs.readdir(path.join(root, 'licenses')));
await writeFile(path.join(dist, 'audio/vendor/licenses/index.html'), `<!doctype html><html lang="en"><meta charset="utf-8"><title>AIPC audio credits</title><h1>Audio credits and licences</h1><ul>${credits.map(name => `<li><a href="${encodeURIComponent(name)}">${name}</a></li>`).join('')}</ul></html>`);
// Fail the build rather than accidentally publish the teacher portal or studio data.
const html = await readFile(path.join(dist, 'index.html'), 'utf8');
if (!html.includes('Student Practice Companion')) throw new Error('Trial entry is not the student page.');
for (const forbidden of ['storage', 'api']) {
  try { await stat(path.join(dist, forbidden)); } catch (error) { if (error.code === 'ENOENT') continue; throw error; }
  throw new Error(`Trial output unexpectedly contains ${forbidden}.`);
}
console.log('Student-only Sunny Island trial ready in dist. Serve over HTTPS or localhost.');
