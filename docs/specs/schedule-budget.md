# DraftLine Core: Schedule & Budget (Plan workspace)

> **Status: next Core candidate. Not yet approved for implementation.** Written November 2026 against
> DraftLine 0.11.0 (commit `343c49a`). Eric approves the start of work, and the scope at that time.
>
> **Product:** DraftLine Core, *Write Your Story*. **Schedule and Budget are free Core features, not Pro.**

This is a planning brief for a future implementation session. It records the intended navigation change, the
functional direction, what the current code already provides, and the questions to settle first. It is not a
finished specification: the feature lists below are ideas to scope, not commitments.

See also [`../../ROADMAP.md`](../../ROADMAP.md) (Phase 1).

---

## 1. Navigation change

**Today** (`src/App.jsx`):
- `WORKSPACES` is Write (`PenLine`) and Plan (`Clapperboard`).
- `PLAN_VIEWS` holds three primary tabs:
  - Breakdowns (`LayoutList`)
  - Stripboard (`Rows3`)
  - Reports (`ChartColumn`)

**Planned**: exactly four primary Plan tabs, in this order:

| # | Tab | Icon |
|---|---|---|
| 1 | Breakdowns | keep `LayoutList` |
| 2 | Stripboard | keep `Rows3` |
| 3 | Schedule | Lucide `calendar-check` (`CalendarCheck`) |
| 4 | Budget | Lucide `calculator` (`Calculator`) |

**Reports leaves the tab row and moves into Plan's ⋮ menu, immediately after Format Doctor.** Its functionality is
unchanged. This is a relocation, not a removal or a downgrade.

What the code already does, which makes this small:
- **The Write workspace's ⋮ menu already lists Reports right after Format Doctor.** `src/lib/toolbar.js` builds the
  menu in this order: View Snapshots → Margin Notes → Format Doctor → Reports → Keyboard Shortcuts → … The Reports
  item calls `openReports()`, which switches to Plan → Reports.
- In Plan, `App.jsx` passes `onReports: inPlan ? null : openReports`, so the item is hidden there because Reports is
  a tab. The change is to pass a Plan-side handler (`setPlanView('reports')`) instead of `null`, which gives Plan's
  menu the same order as Write's:
  1. View Snapshots
  2. Margin Notes
  3. Format Doctor
  4. **Reports**
  5. the rest, in their current order

Details to handle during implementation:
- **Reports as a view without a tab (decided).** While Reports is showing, no tab is lit, and the header label
  **"Plan · Reports"** (already in `App.jsx`) is the only indicator. The ⋮ item gets no "Showing" hint.
- **The narrow-window fallback.** When the tab segment doesn't fit, `planTools.views` (built from `PLAN_VIEWS`) is
  listed in ⋮. Reports must come out of `PLAN_VIEWS` so it isn't listed twice.
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

- **Forward compatibility (confirmed risk).** `normalizeProduction()` rebuilds `production` with only
  `version` and `scenes`, and `toRecord()` in `projectStorage.js` keeps only the fields it knows. A project saved
  with Schedule or Budget data, then opened and saved by an older cached DraftLine, a second computer on an older
  build through folder sync, or a `.draftline` backup restored into an older version, **would lose that data
  silently**. Before this ships:
  - `normalizeProduction` and `toRecord` should keep unknown keys;
  - `PRODUCTION_VERSION` should be bumped to `2`, with a migration test.

  This is the same prerequisite the Production concept needs.
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
