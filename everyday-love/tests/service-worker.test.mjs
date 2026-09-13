import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';

test('worker precaches runtime CSS and changes cache version for a CSS-only update', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'everyday-love-'));
  try {
    await mkdir(join(dir, '_next/static'), { recursive: true });
    for (const [name, content] of Object.entries({ 'index.html': '<html>Love</html>', '404.html': 'not found', '_next/static/app.js': 'void 0', '_next/static/app.css': 'body { color: red; }' })) await writeFile(join(dir, name), content);
    const generate = () => execFileSync(process.execPath, [resolve('scripts/build-service-worker.mjs'), dir]);
    generate();
    const first = await readFile(join(dir, 'sw.js'), 'utf8');
    assert.match(first, /\.\/_next\/static\/app\.css/);
    assert.match(first, /\.\/_next\/static\/app\.js/);
    assert.doesNotMatch(first, /404\.html/);
    generate();
    assert.equal(await readFile(join(dir, 'sw.js'), 'utf8'), first, 'generation is deterministic');
    await writeFile(join(dir, '_next/static/app.css'), 'body { color: blue; }');
    generate();
    const second = await readFile(join(dir, 'sw.js'), 'utf8');
    assert.notEqual(first.match(/const CACHE = (.*);/)[1], second.match(/const CACHE = (.*);/)[1]);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
