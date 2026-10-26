// Records all nine walkthroughs in order (scripts/record-dl01.js … record-dl09.js), one after another.
//   node scripts/record-dl-all.js          # all of them
//   node scripts/record-dl-all.js 3 7      # just DL 03 and DL 07
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import process from 'node:process';

const here = dirname(fileURLToPath(import.meta.url));
const picked = process.argv.slice(2).map(Number).filter((n) => n >= 1 && n <= 9);
const list = picked.length ? picked : [1, 2, 3, 4, 5, 6, 7, 8, 9];
const failed = [];
for (const n of list) {
  const file = join(here, `record-dl0${n}.js`);
  const r = spawnSync(process.execPath, [file], { stdio: 'inherit' });
  if (r.status !== 0) failed.push(`DL 0${n}`);
}
if (failed.length) {
  console.error(`\nFailed: ${failed.join(', ')}`);
  process.exit(1);
}
console.log(`\nDone: ${list.length} walkthrough${list.length === 1 ? '' : 's'} in recordings/`);
