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
- **Reports as a view without a tab.** While Reports is showing, no tab in the segment is lit. The header label
  already reads "Plan · Reports" (`App.jsx`), and that may be enough. Decide whether the ⋮ item shows "Showing" as
  its hint, the way the collapsed view items do.
- **The narrow-window fallback.** When the tab segment doesn't fit, `planTools.views` (built from `PLAN_VIEWS`) is
  listed in ⋮. Reports must come out of `PLAN_VIEWS` so it isn't listed twice.
- **Filtering.** `PlanFilter` is hidden on Reports (`planView !== 'reports'`), which still works. Schedule and Budget
  need a decision on whether the scene filter applies to them.
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

## 3. Schedule: functional direction (ideas to scope)

- Arrange strips into **shooting days**, with day-break dividers. This is a *schedule order* separate from script
  order. The ROADMAP's earlier "Interactive Stripboard & Shooting Days" item belongs here.
- Group or sort by location, INT/EXT, day/night or cast.
- Tentative dates per shooting day, including a start date with optional days off.
- Estimated time per scene and per day, from page eighths and a pages-per-day rate the writer sets.
- Conflict flags. Examples:
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

## 4. Budget: functional direction (ideas to scope)

- Categories: cast, crew, locations, props and set dressing, wardrobe, equipment, vehicles, post-production, other.
- Lines connected to the breakdown, for example:
  - a cast member's rate × scheduled days (from Schedule);
  - a location's cost per shoot day;
  - priced breakdown items.

  Free-form lines are allowed too.
- Totals per category and overall, with an optional contingency percentage.
- Scenarios: duplicate a budget ("Low", "Target") and compare totals side by side.
- Export as CSV, and possibly PDF later. The currency symbol is a setting. No exchange rates.
- **Scope guard:** approachable estimates for writers and independent filmmakers. No payroll, fringes, tax
  incentives, cost reporting or chart-of-accounts templates in v1.

**Proposed stored shape** (to validate):
`production.budget = { currency, scenarios: [{ id, name, lines: [{ id, category, label, qty, rate, unit, link? }], contingency }] }`.

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

## 6. Open questions for Eric

1. Schedule v1 scope: shooting days with drag and estimates only, or conflict flags too?
2. Is schedule order separate from script order (recommended), or does reordering the Schedule ever reorder the
   script? It never should, by default.
3. Budget v1 scope: categories, lines and totals only, or scenarios too?
4. Does Budget link to Schedule in v1 (rates × days), or does that come later?
5. Does the Plan scene filter apply to Schedule and Budget?
6. When Reports is showing without a tab, is "Plan · Reports" in the header enough, or should the ⋮ item show
   "Showing"?
7. Currency: one per project, or a global setting?
8. Should Schedule and Budget have their own Snapshots-aware Compare, or is whole-project Snapshots enough for v1?
