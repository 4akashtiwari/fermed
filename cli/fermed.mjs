#!/usr/bin/env node
/*
 * fermed — one entry point for every command.
 *
 *   fermed <command> [args]
 *
 * Exists so a worker agent has one thing to learn (`fermed`) instead of seven
 * script paths, and so `fermed` can be installed globally later without changing
 * any documentation.
 */

import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const COMMANDS = {
  render: ['render.mjs', 'render a spec to MP4 (or stills)'],
  validate: ['validate.mjs', 'schema check + storyboard'],
  'lint-style': ['lint-style.mjs', 'taste guardrails: copy length, camera flow, style drift'],
  'check-layout': ['check-layout.mjs', 'prove no type collides, clips or overflows, at every aspect'],
  inspect: ['inspect.mjs', 'dump what the timeline computes at 10 story points'],
  new: ['new.mjs', 'scaffold a spec from the template'],
  doctor: ['doctor.mjs', 'environment preflight'],
  help: [null, 'this message'],
};

const [cmd, ...rest] = process.argv.slice(2);

if (!cmd || cmd === 'help' || cmd === '--help' || cmd === '-h') {
  const pad = Math.max(...Object.keys(COMMANDS).map((k) => k.length));
  console.log('\nfermed — spec-driven 3D scroll stories\n');
  for (const [name, [, desc]] of Object.entries(COMMANDS)) {
    console.log(`  ${name.padEnd(pad)}  ${desc}`);
  }
  console.log(`
typical loop
  fermed doctor
  fermed new "Project Name" chrome-bloom
  fermed validate specs/project-name.json
  fermed lint-style specs/project-name.json
  fermed check-layout specs/project-name.json --aspects 16:9,9:16
  fermed render specs/project-name.json --stills 0.15,0.5,0.85
  fermed render specs/project-name.json --out out/project-name.mp4
`);
  process.exit(0);
}

const entry = COMMANDS[cmd];
if (!entry || !entry[0]) {
  console.error(`unknown command "${cmd}". Try: fermed help`);
  process.exit(1);
}

const child = spawn(process.execPath, [path.join(__dirname, entry[0]), ...rest], {
  stdio: 'inherit',
  cwd: process.cwd(),
});
child.on('exit', (code) => process.exit(code ?? 0));
child.on('error', (err) => {
  console.error('[fermed]', err.message);
  process.exit(1);
});
