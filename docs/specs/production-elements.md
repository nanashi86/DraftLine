# Shared production elements (Stage 2, Phase 2)

> **Status:** built. Phase 2A: data model, migration, reconciliation, operations, scheduling by identity. Phase 2B:
> the eight-category Breakdowns, suggestions, the element card, shooting-day needs with quantities, the CSV.
> Code: `src/lib/elements.js`, `src/lib/productionData.js`, `src/lib/schedule.js` (`elementUsage`),
> `src/components/planning/ElementPopover.jsx`, `PlanningWorkspace.jsx` (Breakdowns). Tests:
> `tests/elements.test.js`, `tests/browser/elements.browser.js`.

**Enter once, use everywhere.** A thing a production needs (the Black SUV, the ferry passengers, a squib) is one
**element** with a stable id, and every scene that needs it **links** to it with that scene's own quantity and note.

## Stored (inside `project.production`, so it travels with the project everywhere)

```
production.elements: { [id]: { id, category, name, from? } }          the registry
production.scenes[sceneHeadingId]:
  links:    { [category]: [{ id, qty?, note? }] }                       SOURCE OF TRUTH
  extras / props / wardrobe / vehicles: [name…]                         projection for older builds
  unlinked: [{ id, category, name, qty?, note? }]                       links an older build's edit set aside
```

- **Element:** identity, category and name only. No costs, rates or inventory: those belong to Budget (Phase 3),
  which will refer to elements by id.
- **Link:** this scene needs that element; `qty` (a positive whole number, or absent = not said; never 0, never
  invented) and `note` are this scene's. 20 extras in one scene and 12 in another are never added up.
- **Unused elements stay** in the registry (for reuse, and for Budget later). Only **Delete everywhere** removes one.
- Cast and places are **not** stored here: cast comes from the script with its stable cast numbers; places from
  the slugline. A scripted place isn't a physical filming location; Phase 3 can map one to the other by the
  slugline's location text without anything stored now.

## Categories

| Category | Projects into (older builds' list) |
|---|---|
| Background / Extras | Background / Extras |
| Props & Set Dressing | Props & Set Dressing |
| Wardrobe · Hair & Makeup · Special Effects · Visual Effects | Wardrobe & SFX |
| Vehicles · Stunts | Vehicles & Stunts |

Items from the old mixed lists are **not classified by their text**: "Wardrobe & SFX" items become Wardrobe and
"Vehicles & Stunts" items Vehicles, with `from` remembering where they came from until the writer reclassifies them.

## Migration and reconciliation (one mechanism: `reconcile`, run whenever production is read)

For each scene and each older list, the stored names are compared with the projection of the scene's links:

- **Same** (any order or capitals): the links stand. The normal case; nothing changes.
- **Different** (an older DraftLine edited the list): links whose name is still there stay; a removed name's link
  goes to `unlinked` with its quantity and note (recoverable, never dropped); a name that comes back to the same
  scene's list (its undo there, or typed again) takes that link back from `unlinked`: same identity, quantity, note
  and category. Any other new name links to *the one* element of that name in the list's categories, or to a new
  element. When several elements share the name (kept separate on purpose) it doesn't guess: a new one.
  **Delete everywhere** also clears the element's set-aside links, so a deleted element never comes back that way.
  `unlinked` has **no limit**: every set-aside link is kept, however many (only an exact copy of another is left
  out, so reconciling twice adds nothing). An identity, quantity or note is never dropped to save space.
- **No links at all** (a project from before Phase 2): the migration. Items whose names differ only by capitals or
  spacing in the same list become one element, spelled as most scenes spell it; spelling variants, plurals and
  quantities written in the text are left alone; a comma inside an item is never split.

Ids made by migration come from the category and name, so every tab, computer, snapshot and backup migrates the
same project to the same ids. It runs in memory: **opening a project writes nothing**; the next ordinary save
stores the result. Running it again changes nothing.

Every in-app change edits links and elements and then writes the lists from them, so the lists never look like an
older build's edit. Undo restores exactly the scenes and elements a step changed (`sliceOf` / `applySlice`): undoing
an add takes back the element it created.

## Operations (`productionData.js`)

`addNeed` (reuse the one element of that name, or a new one; `reuse: false` keeps it separate) · `removeNeed`
(this scene only) · `setNeed` (quantity, note) · `renameElement` (everywhere; `renameClashes` lists scenes where
another element has that name) · `reclassifyElement` (every scene's link moves) · `separateNeed` (this scene gets
its own element) · `mergeElements` (same category; where a scene had both with **different quantities** it returns
the conflicts and changes nothing until the writer chooses; notes are kept side by side) · `deleteElement`.
Since Phase 3A, merge and delete (and purge) also carry the element's budget lines in the same step (re-pointed,
or kept for review): [`budget.md`](budget.md).

## Scheduling

A shooting day's requirements are grouped by element id: each element once, with every scene's quantity and note
beside it. `elementUsage(rows, schedule)` gives each element's scenes and shooting days; both are derived every
time, so moving a scene moves its needs.

## Interface (Phase 2B)

- **Breakdowns**: Cast, then the eight categories (four columns by two rows from 1100 px wide; fewer columns below,
  one on a phone), then Production Notes. An item is a chip: its name (opens the element card), `×qty` when set, and
  × (remove from this scene).
- **+ Add** is a combobox: up to six elements of that category not already in the scene, names starting with the
  typed text first, each with the scenes using it (or "not in a scene"); then **+ New “text”** (`reuse: false`, hinted
  "separate" when the name exists). `Enter` with no suggestion chosen adds the typed text (comma-separated, one
  undo step) with reuse. Only `Enter` or a pick adds: `Escape` and blur discard the text. Arrow keys, `Enter`,
  `Escape`; options keep the field's focus, and rows are 36 px tall on touch screens. An **unused** element (no
  scene entry links to it, `linkedIds`) has a trash button in its row (`Shift+Delete` on the active row): App's
  `purge` deletes it only if `scenesNeeding` is empty, as one undo step; `Ctrl+Z` in the field undoes it right
  after. Unused elements are otherwise kept indefinitely.
- **Element card** (`ElementPopover`): *Element* (name: rename everywhere on `Enter` only, "Press Enter to rename"
  while it differs, refused with the clashing scenes named; category: a shared element asks **Move everywhere**; a `from` hint with **That's right**) · *In scene
  N* (quantity, a whole number above 0 or empty; note) · *Used in* (scene buttons, shooting days) · **Separate here**
  (only when shared) · **Merge into…** (same category; a quantity choice per conflicting scene, Merge disabled until
  each is chosen) · **Remove from scene** · **Delete everywhere…** (inline confirmation). Each action is one undo step.
  Footer emphasis: Separate / Merge neutral, Remove quiet, Delete destructive. `Escape` closes and discards anything
  unconfirmed (an open Select takes the first one); an outside click commits quantity and note (as blur would) and
  toasts if a rename was left unconfirmed.
- **Shooting day**: the day card lists each category's elements once: `Name · sc 4 ×20 (wet), sc 9 ×12` when a scene
  gave a quantity or note, otherwise just the name. The Stripboard strips are unchanged.
- **CSV** (File ▾ → Scene Breakdown): one column per category, in the order above; each cell is `Name ×qty (note)`
  items joined with `; `.

## Compatibility

- **Older builds (Phase 0 – 1.5)** read and edit the four lists and carry `elements`, `links` and `unlinked`
  through unchanged; reconciliation keeps everything they didn't touch, and sets aside what they removed.
- **DraftLine from before Phase 0** drops unknown fields when it saves: the names survive and are linked again by
  name; per-scene quantities and notes from that save are lost (as any unknown field was then).
- Forward compatibility: unknown fields on elements, links, scenes and production, and links in categories this
  build doesn't know, are kept untouched.
