import { readFileSync } from 'node:fs';
import { kv } from '@vercel/kv';
import { createDisplayHandler } from '../lib/display-handler.js';

const catalog = JSON.parse(readFileSync(new URL('../lib/catalog.json', import.meta.url), 'utf8'));
export default createDisplayHandler({ store: kv, catalog });
