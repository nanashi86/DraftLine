// DL 11 · Plan — Production schedule and shooting days
//
// NOT READY TO RECORD: DraftLine's Plan workspace has Breakdowns, Stripboard and Reports, but no
// Schedule yet (no shooting days, day-break banners or shooting hours). This script checks for a
// Schedule view and, until there is one, stops before recording so the curriculum isn't given a video
// of features that don't exist. record-dl-all.js counts it as skipped, not failed.
//
// The walkthrough to record once Schedule ships (fill in its real labels then):
//   1. Plan → Schedule.
//   2. Add a Day Break banner between two shoot days.
//   3. Change a day's shooting hours.
//   4. Show the scenes regrouping by location across the day cards.
//
//   node scripts/record-dl11.js
//   → recordings/DL_11_Plan_ProductionScheduleAndShootingDays/DL_11_Plan_ProductionScheduleAndShootingDays.mp4 (+ .webm)
import process from 'node:process';
import { SKIPPED_EXIT, main, record } from './lib/demoKit.js';

const READY = false; // set to true when Plan → Schedule exists, and write the steps below

if (!READY) {
  console.log('DL 11 skipped: Plan → Schedule doesn’t exist in DraftLine yet (see the notes at the top of this script).');
  process.exit(SKIPPED_EXIT);
}

main(() => record({
  folder: 'DL_11_Plan_ProductionScheduleAndShootingDays',
  maxSeconds: 45,
  async run({ page, click, glide, hold, say }) {
    await glide([960, 520]);
    await hold(2000);

    say('Plan → Schedule');
    await click(page.getByRole('radio', { name: 'Plan', exact: true }), 1200);
    await click(page.getByRole('radio', { name: /^Schedule/ }), 1500);

    // TODO when Schedule exists: add a Day Break, change shooting hours, show location grouping.
    await hold(3000);
  },
}));
