// Records the walkthroughs in order (scripts/record-dl01.js … record-dl16.js), one after another.
//   node scripts/record-dl-all.js          # all of them
//   node scripts/record-dl-all.js 3 7      # just DL 03 and DL 07
//   DEMO_CHECK=1 node scripts/record-dl-all.js   # rehearse every step quickly, record nothing
// A walkthrough that isn't ready to record (exit code SKIPPED_EXIT) is listed as skipped, not failed.
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';
import { SKIPPED_EXIT } from './lib/demoKit.js';

const LAST = 16;
const here = dirname(fileURLToPath(import.meta.url));
const pad = (n) => String(n).padStart(2, '0');
const picked = process.argv.slice(2).map(Number).filter((n) => Number.isInteger(n) && n >= 1 && n <= LAST);
const list = picked.length ? picked : Array.from({ length: LAST }, (_, i) => i + 1);
const failed = [];
const skipped = [];
for (const n of list) {
  const r = spawnSync(process.execPath, [join(here, `record-dl${pad(n)}.js`)], { stdio: 'inherit' });
  if (r.status === SKIPPED_EXIT) skipped.push(`DL ${pad(n)}`);
  else if (r.status !== 0) failed.push(`DL ${pad(n)}`);
}
const done = list.length - failed.length - skipped.length;
console.log(`\nDone: ${done} walkthrough${done === 1 ? '' : 's'} in recordings/`);
if (skipped.length) console.log(`Skipped (not ready): ${skipped.join(', ')}`);
if (failed.length) {
  console.error(`Failed: ${failed.join(', ')}`);
  process.exit(1);
}
