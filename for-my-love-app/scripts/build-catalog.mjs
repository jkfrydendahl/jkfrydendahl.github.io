// Commit the generated catalog so a Vercel project rooted at vercel-backend
// needs no access to files outside its project directory.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import vm from 'node:vm';

export function buildCatalog() {
  const context = vm.createContext({ window: {} });
  for (const name of ['content.js', 'soundtracks.js']) {
    vm.runInContext(readFileSync(new URL(`../${name}`, import.meta.url), 'utf8'), context);
  }
  const content = { ...context.window.APP_CONTENT, soundtracks: context.window.SOUNDTRACKS };
  const version = createHash('sha256').update(JSON.stringify(content)).digest('hex');
  return `${JSON.stringify({ version, ...content }, null, 2)}\n`;
}

const target = new URL('../vercel-backend/lib/catalog.json', import.meta.url);
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const generated = buildCatalog();
  if (process.argv.includes('--check')) {
    if (readFileSync(target, 'utf8') !== generated) {
      throw new Error('Catalog is out of date. Run node for-my-love-app/scripts/build-catalog.mjs');
    }
    console.log('Backend catalog matches quotes, nicknames, emojis, and soundtracks.');
  } else {
    writeFileSync(target, generated);
    console.log('Updated backend catalog.');
  }
}
