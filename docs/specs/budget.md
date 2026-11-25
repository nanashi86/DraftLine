# Budget (Stage 2, Phase 3)

> **Status:** Phase 3A built: data model, calculation engine, money, filming locations, budget-aware
> production changes, undo and storage. No interface yet (Plan → Budget still shows its preview); Phase 3B
> adds it, Phase 3C reports, exports and documentation.
> Code: `src/lib/budget.js`, `src/lib/money.js`, `src/lib/locations.js`, `src/lib/productionData.js`.
> Tests: `tests/budget.test.js`; `tests/browser/budgetRename.browser.js` (Rename Character with budget lines:
> undo, redo, reload).

**Enter once, use everywhere.** Every element in a scene, every speaking character and every filming location is
already a budget row. The writer adds rates (and, where needed, methods, quantities and notes) and their own
costs; nothing about the production is typed twice. No rates are suggested and nothing is assumed to cost
anything: an empty rate is unknown, and 0 is confirmed free.

## Stored (inside `project.production`)

A **sparse overlay**. Rows for sources are computed every time ("candidates"); a **line** is stored only once
the writer gives a row something, or adds a cost of their own. Opening a project writes nothing, and a row
nobody touched can't be orphaned.

```js
production.budget = {
  version: 1, currency: 'USD',                       // ISO 4217; required before any amount is entered
  plannedDays: 12,                                   // shooting days, estimated, until there's a schedule
  week: { days: 5 | 7, rounding: 'prorate' | 'up' }, // the project's week (default 5, prorated)
  contingency: { bp: 1000 },                         // 10 % of the subtotal
  fees: [{ id, label, bp, base: 'subtotal' | 'withContingency', note } | { id, label, amount, note }],
  lines: { [id]: {
    section, label, source: { kind: 'element' | 'site', id } | { kind: 'cast', name },
    method, rate,                                    // minor units; absent / null = unknown; 0 = free
    qty: { from: 'derived' } | { from: 'manual', value },
    days: { from: 'use' | 'span' | 'calendar' | 'shoot' } | { from: 'manual', value },
    usage: 'reuse' | 'consume', holds: 'unpaid' | 'paid', week: { days, rounding }, note,
    origin: [{ kind, id | name, name }],             // every source it was re-pointed from
    review: { reason: 'merged' | 'deleted' | 'renamed', group, from, footprint },
  } },
}
production.locations = {
  version: 1,
  sites: { [id]: { id, name, address, note } },      // physical filming locations
  places: { [PLACE]: siteId },                       // scripted place (basePlace of a heading) → site
  scenes: { [sceneId]: siteId },                     // one scene shot elsewhere (interface: later)
}
```

- **Lossless.** Both objects are kept exactly as stored: nothing is added or dropped on reading; values are
  validated when read (an unreadable rate shows as unknown, flagged, and stays stored). A newer build's
  (`version` above this one's, or a shape this one doesn't know) is never changed, by any operation.
- **Absent when empty**, so projects from before the Budget are unchanged and normalizing is stable.
- Filming locations are never made from sluglines. Many scripted places can map to one location.

## Sections

Cast · Background / Extras · Props & Set Dressing · Wardrobe · Hair & Makeup · Vehicles · Stunts · Special Effects ·
Visual Effects · Locations · Crew · Equipment · Transport · Catering · Accommodation · Pre-production ·
Post-production · Other. A sourced line follows its source's category unless its section is set.

## Calculation (`budgetModel(production, rows, scheduleModel)`, pure)

| Method | Amount |
|---|---|
| `flat` (fee, one-time purchase) | rate |
| `unit` | rate × quantity |
| `day` (a package per day) | rate × days |
| `unitDay` | rate × quantity × days |
| `week` / `unitWeek` | rate × (quantity ×) weeks; weeks = days ÷ week length, prorated or rounded up as set |
| `personDay` | rate × person-days — never × days again |

**Derived quantities.** Reusable element (default): the most needed in one scene. Consumable: the sum across
scenes. Background person-days: each shooting day's largest call, added over days (the basis says it assumes
the same people cover a day's scenes; quantities can be entered instead). An unset scene quantity counts as 1,
flagged `assumedQty`. Cast and locations: 1.

**Days.** `use`: shooting days it's used on (cast: work days, plus holds when `holds: 'paid'`; holds are
always shown). `span`: first to last day it's used, in shooting days (continuous rental). `calendar`: the same
in calendar days, only when every day in the span is dated, in order, with no repeats — otherwise unknown,
flagged `datesUncertain`, with a manual alternative. `shoot`: every shooting day, or `plannedDays` as an
estimate before there's a schedule. `manual`.

**Money.** Integer minor units; quantities to two decimals; each line is rate × factors ÷ divisors in BigInt,
rounded once (half away from zero); sections and totals add rounded lines. BigInt never leaves `money.js`;
anything beyond `Number.MAX_SAFE_INTEGER` is `null` with an `overflow` flag. Typed amounts are never rounded
(`parseAmount` refuses extra decimals).

**Totals.** Subtotal: lines with a known amount, not in review. Contingency: a percentage of that subtotal.
Each fee: a fixed amount, or a percentage of the subtotal or of subtotal + contingency — never of another fee,
so nothing is circular. Lines in review, or whose source is gone, are summed apart (`unresolved`), never in
the total. `status`: `incomplete` (a missing rate, quantity or days; scenes unscheduled while there's a
schedule; a review; an overflow; priced locations while scripted places are unassigned), `estimated`
(planned days or assumed quantities), else `complete`. A partly scheduled script is never complete.

## Production changes

| Change | Budget |
|---|---|
| Schedule, scene quantities | recomputed; manual values never change |
| Rename an element | its lines show the new name |
| Reclassify | lines move section (unless set) |
| Separate | the new element starts unpriced |
| Merge A into B | A's lines re-pointed to B, with A in `origin`; if B had lines too, all of them go to review together (keep as separate costs, or remove one) |
| Delete or purge an element; remove a location | its lines stay, in review, with a `footprint` (the element and its links, or the site and what mapped to it) so their last amount still shows; the writer keeps it as a cost of its own (provenance kept), relinks it, or removes it |
| Rename a character | its cast lines follow, in the same undo step; onto a name with lines, both go to review |
| An older build deletes, merges or renames a character | lines left pointing at nothing: flagged `missingSource`, amount unknown, never guessed |

Each of these is part of the same single undo step as the change itself.

## Undo, storage, other guarantees

- `changedParts` / `sliceOf` / `applySlice` cover budget lines and settings and locations entries (or the
  whole object when either side is a newer build's), so undo puts back exactly what a step changed and nothing
  written since (other rates, notes, schedule).
- Saves, snapshots, copies, linked folders and multi-tab checks carry `production` as a whole (tested:
  `toRecord`/`toDoc`, `createRevision`).
- Changing the currency with amounts entered asks first, then keeps face value (12.50 stays 12.50, never
  converted); an amount the new currency can't hold refuses the change, naming the lines.
- The Budget never changes the script or the schedule.
