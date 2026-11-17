# DraftLine Pro: Co-Write, Write Together

> **Status: Future Pro concept — not approved for implementation.** Tentative exploration: 2027 (Q1–Q2), subject to
> feasibility and priorities. Written November 2026 against DraftLine 0.11.0 (commit `343c49a`).
>
> **No existing DraftLine functionality may be removed, restricted, or transferred from the free browser application
> to a paid product.** DraftLine Core (*Write Your Story*) stays complete, local-first, offline-capable and
> account-free. Writers who never use Co-Write must see no change at all.

This is a feasibility and boundaries brief, not a design. Its job is to say what the current code means for
collaboration, which questions decide the architecture, and what to prototype first. No architecture is chosen
here. See also [`../../ROADMAP.md`](../../ROADMAP.md) (Phase 2).

---

## 1. Concept

Optional real-time collaborative screenwriting for two or more writers:
- shared sessions;
- live cursors and presence;
- synchronized edits;
- permissions (owner, editor, commenter or viewer);
- conflict handling;
- optional comments and review;
- a clean hand-off back to ordinary solo writing.

Co-Write is a potential paid Pro offering. One candidate model: the **session owner pays and invited collaborators
join free**. That is not decided (§6).

## 2. What the current code means for collaboration

These findings are confirmed in code.

| Area | Where | What it means for Co-Write |
|---|---|---|
| Document model | `screenplay.js` `makeBlock`; `App.jsx` state | The script is an array of elements `{ id, type, text, marks?, note?, dual? }` with stable ids. That maps naturally onto a list of records with a text field each, which is the shape collaborative data structures handle well. |
| Derived layout | `paginate`, `analyzeScript`, `buildBreakdown` | Pages, (MORE)/(CONT'D), scene numbers, breakdowns and reports are **computed from the elements**, not stored. Collaborators only need to sync elements. Each client lays out pages itself, and they agree as long as their line counts agree (the same editor-vs-PDF measurement caveat noted in [`production-revisions-concept.md`](production-revisions-concept.md)). |
| Inline formatting | `formatting.js` (`marks` as ranges, `reconcileMarks`) | Bold, italic and underline are character ranges per element. Concurrent edits must move ranges correctly, which collaborative text types do with formatting attributes. Needs care. |
| Undo / redo | `hooks/useHistory.js` | **Snapshot-based**: `past / present / future` arrays of whole element lists, coalesced while typing, up to 300 steps. **Incompatible with remote edits as it stands.** Undo would revert collaborators' changes. Co-Write needs per-user, operation-based undo. Solo mode keeps today's. |
| Persistence | `projectStorage.js` `saveActiveProject`, crash journal | One IndexedDB record per project, saved whole. No operation log. A collaborative session needs its own update log that is merged into the record. |
| Multi-tab | none | No coordination between two tabs on the same project today; the last save wins. Cross-tab sync is a small, free, local stepping stone that exercises the same merge problems. |
| Folder sync | `folderSync.js` | Whole-file, newest `updatedAt` wins. That is not a merge. Co-Write must not depend on it. |
| Other project parts | `beats`, `characters`, `storyNotes`, `storyDna`, `production`, `revisions` | The Scene Board (cards linked by `sceneId`), Story Bible, Plan data and Snapshots would each need a sync rule. v1 can sync only the script and the board. |
| Mobile input | `Editor.jsx` phone view; `tests/browser/composition.browser.js` | A remote change landing in the element someone is composing in (IME, predictive text) is a known hazard class. DraftLine already had to fix doubled words at page seams. |
| Forward compatibility | `projectStorage.js` `toRecord` | Unknown record fields are dropped on save. Any Co-Write metadata stored on a project needs the same pass-through fix described for Production and Schedule/Budget. |
| Privacy promise | README, Philosophy page | The editor is telemetry-free and nothing is uploaded. Co-Write necessarily sends script content to other people through a relay. That must be **opt-in per project**, clearly disclosed, and ideally end-to-end encrypted. |
| Dependencies | DraftLine's standing rule: no new dependencies | Mature collaborative-editing libraries are dependencies. Using one is a deliberate exception to decide, and could be loaded only when a session starts. |
| Existing hosting | Cloudflare Worker for feedback (`draftline-feedback`) | There is precedent and an account for small serverless infrastructure. Long-lived sessions need stateful relays, not just stateless Workers. |

## 3. Architecture options to evaluate (none chosen)

- **A. CRDT-based sync.** The script becomes a shared list of elements, each with shared text and formatting. A
  relay forwards updates and stores the session log. This gives:
  - offline edits that merge on reconnect;
  - no central authority over the text;
  - E2E encryption that stays feasible, since the relay only forwards bytes.

  Costs:
  - a dependency;
  - a model bridge between the CRDT and today's immutable element array;
  - per-user undo;
  - larger saved state.
- **B. Server-authoritative operations (OT-style).** A server orders edits. Conceptually simpler conflict rules, but
  it needs a trusted server that reads the text (so no E2E), and it fits offline editing poorly.
- **C. "Co-Write Lite": scene-level turn-taking.** Writers claim a scene while editing it, others see it update live,
  and merges happen at scene granularity. This is far less complex and covers many writing partnerships, but it
  isn't true simultaneous typing.
- **D. Asynchronous collaboration.** Exchange `.draftline` files and merge with a three-way merge built on
  `scriptDiff.js` (`diffScripts` already pairs elements by id). It needs no server and works with today's files, but
  it isn't real-time.

C and D may be worth more per hour of work than A, and D could even be a Core feature. That is a product decision.

## 4. Boundaries (non-negotiable)

- Solo writing stays exactly as it is: local-first, offline, no account, and the same undo.
- Co-Write is **per project and opt-in**. Leaving a session returns the project to ordinary solo mode with all
  content kept locally.
- No mandatory cloud storage for anyone. Invited collaborators should not need to buy anything (if the owner-pays
  model is chosen), and ideally need no account.
- The free app must at least **open and preserve** a project that was once co-written.

## 5. Risks

- **Undo semantics.** Users expect Ctrl+Z to undo *their* change only. This is the most visible correctness issue.
- **Formatting ranges and element-type changes** under concurrent edits, for example one writer retyping a line as
  Dialogue while another edits its text.
- **Structural edits racing**: Enter-split, merge, Scene Board moves, Format Doctor fixes and character rename are
  multi-element changes.
- **IME composition** while remote edits arrive, especially on phones.
- **Data loss at the edges**: leaving or rejoining sessions, offline merges, and old app versions dropping session
  metadata.
- **Privacy and trust**: relays, encryption keys, invite links and removing a collaborator.
- **Running costs** that grow with usage, for a free-first project. The pricing must cover them sustainably.
- **Maintenance load** for a solo developer: a live service has uptime, abuse and support costs that a static app
  doesn't.

## 6. Commercial questions

- One-time licence vs subscription: hosted relays are an **ongoing** cost, which favours a subscription or a
  session- or seat-based model over a one-time licence.
- Owner-pays with free guests: simple to explain, and it keeps Core writers free. Needs abuse limits (session size,
  storage).
- Self-hostable relay: open-source the relay so anyone can run their own for free, and sell the hosted one. This fits
  DraftLine's MIT values and makes "Pro" about convenience rather than lock-in.
- Accounts: hosted billing needs some identity for the owner. Guests could join by invite link alone.

## 7. Research plan (before any commitment)

1. **Cross-tab sync prototype (local, no server).** Two tabs editing one project, merging live. Use it to test the
   element-model bridge, per-user undo and IME behaviour, with zero hosting cost. Possibly worth shipping in Core.
2. **Relay spike.** A minimal relay (for example a stateful Cloudflare worker) with two browsers, measuring latency,
   reconnect and offline merge, plus an estimate of cost per active session-hour.
3. **Decide A, B, C or D** from those results, then the commercial model, then whether to build.

## 8. Open questions for Eric

1. Is real-time typing (A or B) required for v1, or would scene-level turn-taking (C) satisfy most writing
   partnerships?
2. Is a dependency for collaborative editing acceptable, loaded only for Co-Write?
3. Is end-to-end encryption a requirement, given DraftLine's privacy promise?
4. Pricing model: subscription, owner-pays sessions, or a self-hostable relay plus a paid hosted one?
5. Do guests need accounts, or are invite links enough?
6. Which project parts sync in v1: the script only, or also the Scene Board, Story Bible and Plan?
7. Should asynchronous merging of `.draftline` files (D) be a free Core feature regardless?
