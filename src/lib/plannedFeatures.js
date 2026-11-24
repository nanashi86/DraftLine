// Planned features: where each one will live, and the short preview that opens there today.
// (Table Read has shipped: Write → ⋮ → Table Read… opens the player, components/TableRead.jsx.)
// Nothing here is built: each entry point opens PlannedFeatureModal with this wording and nothing else
// (no project data is read or written, no view changes, no network). ROADMAP.md has the plan.
//
//   Shoot              Write → Page | Split | Board | Shoot          DraftLine Pro (optional upgrade)
//   Budget             Plan  → Breakdowns | Stripboard | Budget     DraftLine Core (free)
//   Co-Write           Write → ⋮ → Co-Write…                         DraftLine Co-Write (optional hosted service)
//
// No prices in the app: these are unreleased, and there is nothing to buy (ROADMAP.md has the plan).

export const PLANNED_FEATURES = {
  shoot: {
    title: 'Shoot',
    status: 'Planned for DraftLine Pro',
    headline: 'From spec to shooting script.',
    body: 'Lock pages and scene numbers, manage revision rounds, and prepare revised pages for production.',
    note: 'A future optional upgrade. DraftLine Core remains free.',
  },
  budget: {
    title: 'Budget',
    status: 'Planned for DraftLine Core · Free',
    headline: 'Know what your story could cost.',
    body: 'Build practical production estimates using your scene breakdowns, shooting schedule, and customizable expenses.',
  },
  coWrite: {
    title: 'Co-Write',
    status: 'Planned optional collaboration',
    headline: 'Write together, wherever you are.',
    body: 'Collaborate on the same screenplay with invited writers, shared sessions, and synchronized edits.',
    note: 'A future optional hosted service. Solo writing stays free.',
  },
};

/** Write's view switch: Shoot follows Page | Split | Board (a preview for now, never a view). */
export const SHOOT_TAB = { id: 'shoot', label: 'Shoot', title: 'From spec to shooting script (planned)' };
/** Plan's tabs after Breakdowns | Stripboard (previews for now). Schedule is built: it's the Stripboard's
 *  Schedule view (Stage 2, Phase 1), so it has no tab of its own. */
export const PLAN_PLANNED_TABS = [
  { id: 'budget', label: 'Budget', title: 'Production estimates from your breakdowns and schedule (planned)' },
];
