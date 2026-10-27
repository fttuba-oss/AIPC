import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
function files(directory: string): string[] { return fs.readdirSync(directory, { withFileTypes: true }).flatMap(e => e.isDirectory() ? files(path.join(directory, e.name)) : [path.join(directory, e.name)]); }
test('domain imports cannot reach the other domain, legacy code, or application shells', () => {
 for (const domain of ['score','practice']) {
  const directory = path.resolve('src/modules', domain);
  const allowed = [directory, path.resolve('src/contracts'), path.resolve('src/server')];
  for (const file of files(directory).filter(f => /\.tsx?$/.test(f))) {
   const source = fs.readFileSync(file, 'utf8');
   for (const match of source.matchAll(/(?:from\s*|import\s*\(\s*|import\s*)['"]([^'"]+)['"]/g)) {
    const spec = match[1]; if (!spec.startsWith('.')) continue;
    const resolved = path.resolve(path.dirname(file), spec);
    if (/\.(css)$/.test(resolved)) continue; // Frozen app-wide styles.
    assert.ok(allowed.some(root => resolved === root || resolved.startsWith(root + path.sep)), `${file} imports outside its domain: ${spec}`);
   }
  }
 }
});
test('both app shells use the same public score viewer', () => {
 for (const role of ['teacher','student']) {
  const content = fs.readFileSync(`src/apps/${role}/${role === 'teacher' ? 'TeacherApp' : 'StudentApp'}.tsx`, 'utf8');
  assert.match(content, /from ['"]\.\.\/\.\.\/modules\/score['"]/);
  assert.match(content, /<ScoreViewer selection=/);
 }
});
