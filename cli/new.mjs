#!/usr/bin/env node
/* fermed new — scaffold a spec from a template. */
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { STYLESET_NAMES } from '../engine/stylesets.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

const [name, styleset = 'editorial-noir'] = process.argv.slice(2);
if (!name) {
  console.error('usage: node cli/new.mjs <slug> [styleset]');
  console.error('stylesets:', STYLESET_NAMES.join(', '));
  process.exit(1);
}
if (!STYLESET_NAMES.includes(styleset) && !styleset.includes('/')) {
  console.error(`unknown styleset "${styleset}". Choose: ${STYLESET_NAMES.join(', ')}`);
  process.exit(1);
}

const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const templatePath = path.join(ROOT, 'specs', '_template.json');
const template = JSON.parse(await fs.readFile(templatePath, 'utf8'));
template.meta.title = name;
template.meta.slug = slug;
template.styleset = styleset;

const out = path.join(ROOT, 'specs', `${slug}.json`);
await fs.writeFile(out, JSON.stringify(template, null, 2) + '\n');
console.log(`✓ wrote ${path.relative(process.cwd(), out)}`);
console.log(`\n  npm run dev    → http://localhost:5173/?spec=/specs/${slug}.json`);
console.log(`  npm run render → node cli/render.mjs specs/${slug}.json\n`);
