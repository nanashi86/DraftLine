# DraftLine Core: Schedule & Budget (Plan workspace)

> **Status: Stage 2 — after Table Read, subject to reassessment; not yet approved for implementation.** Written
> November 2026 against DraftLine 0.11.0 (commit `343c49a`); updated November 19, 2026. Eric approves the start of
> work, and the scope at that time.
>
> **Product:** DraftLine Core. **Schedule and Budget are free Core features**, never Pro or Co-Write.
>
> **Mandatory prerequisite: data integrity.** Before any Schedule or Budget data is stored, the unknown-field
> pass-through, schema v2 migration and compatibility tests in [`data-integrity.md`](data-integrity.md) ship first
> (one release ahead), so an older copy of DraftLine can never silently delete a schedule or a budget.

This is a planning brief for a future implementation session. It records the navigation (now in place as previews),
the functional direction, what the current code already provides, and the questions to settle first. It is not a
finished specification: the feature lists below are ideas to scope, not commitments.

See also [`../../ROADMAP.md`](../../ROADMAP.md) (Stage 2).

---

## 1. Navigation (done November 19, 2026, as previews)

The navigation is already in place; Schedule and Budget open a planned-feature preview until they're built.

| # | Plan tab | Icon | Today |
|---|---|---|---|
| 1 | Breakdowns | `LayoutList` | Unchanged |
| 2 | Stripboard | `Rows3` | Unchanged |
| 3 | Schedule | Lucide `calendar-check` (`CalendarCheck`) | Opens the preview ("Plan your shooting days.") |
| 4 | Budget | Lucide `calculator` (`Calculator`) | Opens the preview ("Know what your story could cost.") |

**Reports left the tab row and is in ⋮, in both Write and Plan,** right after Format Doctor:
View Snapshots → Margin Notes → Format Doctor → **Reports** → … It opens the same Reports view as before, the header
still says **"Plan · Reports"**, and nothing about Reports changed. In code: `PLAN_TABS` (Breakdowns, Stripboard) drives
the tab row, `PLAN_VIEWS` still includes Reports for the view itself and the label, and `onReports: openReports` is
passed in both workspaces. The planned tabs come from `lib/plannedFeatures.js`.

When Schedule and Budget are built, they replace their preview handlers with `setPlanView('schedule' | 'budget')` and
join `PLAN_TABS`; the tab row doesn't move.

Details to handle during implementation:
- **Reports as a view without a tab (decided).** While Reports is showing, no tab is lit, and the header label
  **"Plan · Reports"** (already in `App.jsx`) is the only indicator. The ⋮ item gets no "Showing" hint.
- **The narrow-window fallback (done).** When the tab segment doesn't fit, ⋮ lists Breakdowns, Stripboard,
  Schedule and Budget; Reports appears once, in its usual place.
- **Filtering (decided).** The Plan scene filter (`lib/planFilter.js`) **applies to Schedule and Budget too**, as it
  does to Breakdowns and Stripboard. It stays hidden on Reports (`planView !== 'reports'`), which always covers the
  whole script. Budget totals should say when they're filtered (as the Plan summary line already does with
  "· filtered"), so a filtered total is never mistaken for the whole budget.
- **Tests to update:**
  - `tests/toolbar.test.js`, `tests/toolbarAlignment.test.js` and `tests/uiLabels.test.js` (menu order and labels);
  - `tests/reports.test.js`;
  - any test that counts Plan tabs.
- **Docs to update when it ships:**
  - `src/content/userGuide.md` (in-app help, checked by `tests/docsCoverage.test.js`);
  - the README feature list;
  - `public/features/index.html` and `public/compare/index.html`;
  - `public/llms.txt`, which currently says DraftLine has "no shoot scheduling or budgeting".

## 2. What Schedule and Budget can build on

All confirmed in code:
- **Breakdown rows are derived every time from the script**, never copied: `productionEngine.js` `buildBreakdown`
  produces scene number, slugline parts (`parseSlugline`: setting, location, time, period), length in eighths,
  speaking cast with cast numbers (`castNumbers`), and the stored asset lists.
- **Stored production data** is `project.production = { version: 1, scenes: { [sceneHeadingId]: { extras, props,
  wardrobe, vehicles, notes } } }` (`productionData.js`). It is keyed by scene-heading id, so it follows a scene
  when the scene is edited or moved.
- **Stripboard** (`PlanningWorkspace.jsx`): one colour-coded strip per scene, **in script order**, coloured by
  setting and day or night (`stripColor`, `STRIP_COLORS`). It is not reorderable today.
- **Reports** (`reports.js`): scenes, characters, locations and script totals, each as CSV.
- **Exports**: `breakdownCsv` and `reportCsv`, through the existing download helper.

## 3. Schedule: functional direction

- Arrange strips into **shooting days**, with day-break dividers. **Schedule order is separate from script order
  (decided): rearranging shoot days never reorders the script.** The ROADMAP's earlier "Interactive Stripboard & Shooting Days" item belongs here.
- Group or sort by location, INT/EXT, day/night or cast.
- Tentative dates per shooting day, including a start date with optional days off.
- Estimated time per scene and per day, from page eighths and a pages-per-day rate the writer sets.
- **Conflict warnings (in v1, decided).** Examples:
  - a cast member needed on more than a set number of days;
  - a night scene placed on a day-only date;
  - a location split across distant days;
  - a day over its page budget.
- Day-out-of-days (cast × day grid) is a natural later addition. Not for v1.
- Export: a shooting schedule CSV, and possibly a printable PDF later.

**Proposed stored shape** (to validate):
`production.schedule = { days: [{ id, date?, label?, sceneIds: [] }], unscheduled implicit, settings: { pagesPerDay } }`.
Days hold scene-heading ids, so they survive script edits. Scenes deleted from the script drop out. New scenes appear
as unscheduled.

## 4. Budget: functional direction

- Categories: cast, crew, locations, props and set dressing, wardrobe, equipment, vehicles, post-production, other.
- Lines connected to the breakdown, for example:
  - a cast member's rate × scheduled days (from Schedule);
  - a location's cost per shoot day;
  - priced breakdown items.

  Free-form lines are allowed too.
- Totals per category and overall, with an optional contingency percentage.
- **Linked to Schedule in v1 (decided)**: for example an actor's rate × the shoot days they're scheduled for, or a
  location's daily cost × its days. Changing the schedule updates the budget.
- **Scenarios ("Low" vs "Target"): not in v1 (recommended).** v1 is one budget: categories, lines, totals and an
  optional contingency. Linking to Schedule is already the hard part, and scenarios are mostly "duplicate and
  compare", which is easy to add once v1 is stable. The stored shape below already holds a list of scenarios (v1 uses
  one), so adding them later needs no data migration. Until then, a Snapshot taken before a big change serves as a
  rough "what was the budget before".
- **Currency (decided)**: one default for all projects, set in **Settings**, which a project can override for itself.
  The symbol and number format only, with no exchange rates. Settings already persists per device
  (`lib/userSettings.js`, `draftline_user_settings`). The project override lives with the project's budget.
- Export as CSV, and possibly PDF later.
- **Scope guard:** approachable estimates for writers and independent filmmakers. No payroll, fringes, tax
  incentives, cost reporting or chart-of-accounts templates in v1.

**Proposed stored shape** (to validate):
`production.budget = { currency?: override, scenarios: [{ id, name, lines: [{ id, category, label, qty, rate, unit, link? }], contingency }] }`.
v1 writes exactly one scenario. `link` points at a schedule-derived quantity (for example `{ kind: 'castDays', name }`).

## 5. Dependencies and constraints

- **Forward compatibility (confirmed risk, prerequisite).** `normalizeProduction()` keeps only `version: 1` and the
  scene lists, and `toRecord()` keeps only known fields, so today an older copy of DraftLine would delete Schedule and
  Budget data on its first save (confirmed by experiment). The fix, migration, ship order and tests are specified in
  [`data-integrity.md`](data-integrity.md) and must ship first.
- **No new dependencies** (DraftLine's standing rule). Drag-and-drop uses native HTML5 drag, as the Scene Board
  already does. Dates use the built-in `Intl` and `Date`.
- **Lucide icons only.** `CalendarCheck` and `Calculator` are confirmed present in the pinned `lucide-react`
  1.49.0.
- **Desktop layout must not change** beyond the tab row and the menu item. Phones and narrow windows use the
  existing collapse-into-⋮ behaviour.
- **Backups, folder sync and Snapshots** carry `production` already, so new keys travel automatically once
  pass-through is in place.
- **Offline and local-first.** Everything is computed and stored on the device, with no network.

## 6. Decisions (November 2026)

| # | Question | Decision |
|---|---|---|
| 1 | Schedule v1 scope | Shooting days with drag and drop, estimates, **and conflict warnings** |
| 2 | Schedule order vs script order | **Separate.** Rearranging shoot days never reorders the script. |
| 3 | Budget scenarios in v1 | **Not in v1** (recommendation). One budget; the data shape is ready for scenarios later. |
| 4 | Budget linked to Schedule in v1 | **Yes** (rates × scheduled days) |
| 5 | Plan scene filter on Schedule and Budget | **Yes.** Filtered totals are labelled as filtered. |
| 6 | Reports indicator when opened from ⋮ | **"Plan · Reports"** in the header only. No "Showing" hint. |
| 7 | Currency | **A global default in Settings**, overridable per project |
| 8 | Compare view for Schedule and Budget | **Not in v1** (recommendation). Whole-project Snapshots are enough. They already copy and restore `production` (`revisions.js` `createRevision`, `partsOf`), so Schedule and Budget data travel with them once stored there. Snapshot Compare stays script-only. A schedule or budget diff can come later if writers ask. |

Still open, to settle at the start of the implementation session:
- the exact conflict rules and thresholds for v1;
- the budget's category list and units;
- the CSV column layouts.
