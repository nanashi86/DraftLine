# DraftLine Co-Write: real-time collaboration (optional subscription)

> **Status: Stage 4 of 4: last in the development order, long-term future, not approved for implementation.**
> Rewritten November 19, 2026 for the approved **Option D** model. No release date. See
> [`../../ROADMAP.md`](../../ROADMAP.md).
>
> **DraftLine Co-Write is a planned optional subscription that works alongside free DraftLine Core
> or a purchased DraftLine Pro.** It is not part of Pro, doesn't require Pro, and Pro doesn't require it. Only the
> writer **hosting** a session needs it; invited writers join free, with Core or Pro.
>
> **No existing DraftLine functionality may be removed, restricted, or transferred to a paid product.** Solo writing
> stays complete, local-first, offline-capable and account-free. Writers who never use Co-Write see one menu item
> (⋮ → Co-Write…) that opens a short preview, and nothing else changes.

This is a feasibility and boundaries brief, not a design. It records what the current code means for collaboration,
the decisions that shape the architecture, the operating responsibilities a live service brings, and what to
prototype first. Licences and payment integration: [`pro-license.md`](pro-license.md). Data safety:
[`data-integrity.md`](data-integrity.md).

---

## 1. Concept

Optional real-time co-writing for two or more writers: shared sessions, live cursors and presence, synchronised edits,
guest invitations and permissions (owner, editor, commenter, viewer), safe conflict handling, and a clean hand-off back
to ordinary solo writing. Where it lives today: **Write → ⋮ → Co-Write…** opens the planned-feature preview
("Write together, wherever you are."). Nothing behind it is built.

## 2. Infrastructure candidates (subject to feasibility testing)

| Area | Candidate | Why |
|---|---|---|
| Real-time relay | **Cloudflare Workers + Durable Objects over WebSockets**, one Durable Object per session, using the WebSocket Hibernation API | Usage-based, near-zero idle cost, single-threaded authority per session; the same Cloudflare account already runs the feedback Worker |
| Licence checks | The licence Worker in [`pro-license.md`](pro-license.md): the host's Co-Write lease is checked at every session start | No accounts |
| Payments | A Merchant of Record handling the subscription ([`pro-license.md`](pro-license.md) §10) | No tax compliance to run |

These are **preferred candidates, not a final architecture.** The **$5/month Workers Paid plan is the floor, not the
total cost** (§9).

Durable Objects pricing as published by Cloudflare (checked November 2026; re-check before launch): billed by requests
and duration; hibernating sessions accrue no duration; Workers Paid includes 1 million requests and 400,000 GB-s a
month, then $0.15 per million requests and $12.50 per million GB-s; incoming WebSocket messages count 20:1; SQLite
storage per object is included up to the plan's limits; prototyping works on the free plan.

## 3. What the current code means for collaboration

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
| Forward compatibility | `projectStorage.js` `toRecord` | Unknown record fields are dropped on save. Any Co-Write metadata stored on a project needs the pass-through fix in [`data-integrity.md`](data-integrity.md). |
| Privacy promise | README, Philosophy page | The editor is telemetry-free and nothing is uploaded. Co-Write necessarily sends script content to other people through a relay. That must be **opt-in per project**, clearly disclosed, and ideally end-to-end encrypted. |
| Dependencies | DraftLine's standing rule: no new dependencies | Mature collaborative-editing libraries are dependencies. Using one is a deliberate exception to decide, and could be loaded only when a session starts. The relay (Durable Objects) and licence checks (Web Crypto) need no new app dependencies. |
| Existing hosting | Cloudflare Worker for feedback (`draftline-feedback`) | There is precedent and an account for small serverless infrastructure. Long-lived sessions need stateful relays, which is what Durable Objects provide (the preferred candidate, §5). |

## 4. Synchronisation: CRDT or server-authoritative (not decided)

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

How each fits the candidate relay:
- **A:** the session's Durable Object forwards updates and stores the log, without reading the text, so E2E stays
  possible.
- **B and C:** they map naturally onto it too, because each Durable Object is a single-threaded authority for its
  session, so it can order edits or grant scene claims.
- **D:** needs no relay at all.

## 5. Session architecture questions

### 5.1 Independent local undo and redo
Today's undo (`hooks/useHistory.js`) is snapshot-based and would revert collaborators' edits. Co-Write needs per-writer,
operation-based undo that reverts only that writer's changes; solo mode keeps today's undo exactly.

### 5.2 Concurrent screenplay and structural edits
Element-type changes, Enter-splits and merges, Scene Board moves, Format Doctor fixes and character renames touch
several elements at once. Each needs a defined merge rule (for example: a type change and a text edit to the same
element both apply; a rename is one operation that touches every cue). Formatting ranges (`formatting.js`) must move
with concurrent text edits.

### 5.3 Mobile IME and offline reconnection
A remote change must never land inside an element the local writer is composing in (IME, predictive text). Apply remote
changes to that element after composition ends. Offline edits queue locally and merge on reconnect; a long offline
period may need a "your changes and theirs" review instead of a silent merge.

### 5.4 Durable Object session recovery
The session's Durable Object keeps its update log in its own storage, so a restart or eviction resumes from the log.
Clients keep their own full copy and resend unacknowledged updates after reconnecting. The relay is never the only copy.

### 5.5 Guest invitations, permissions and revocation
- Invites are unguessable links (a capability), optionally with an expiry and a role.
- The host can change a guest's role or remove them at any time; removal closes their connection and rotates the
  session key so the old link stops working.
- Guests need no account, no key and no purchase.

### 5.6 Session limits and abuse controls
Per host: concurrent sessions, guests per session, message rate, update size and stored log size, with plain messages
when a limit is reached. Rate-limit invite-link guessing and connection attempts. A licence unlocks hosting, not
unlimited service.

### 5.7 Privacy, authentication and encryption
- Co-Write is **opt-in per project**, and the first time a project is shared DraftLine says plainly that the script
  travels through DraftLine's relay to the invited writers.
- Hosts authenticate with their Co-Write lease; guests with the invite capability.
- **End-to-end encryption is the goal**: with a CRDT (§4 A) the relay only forwards encrypted updates and never reads
  the script. A server-authoritative design (§4 B) needs to read text, which conflicts with E2E; that trade-off is the
  central decision.
- No analytics on session content; Worker logs off.

## 6. Subscription status during and after sessions

| Situation | What happens |
|---|---|
| Host's subscription active | Host can start and run sessions; guests join free |
| Host cancels | Sessions keep working until the period ends ("Canceled, active until …") |
| Payment fails | Retries by the provider; grace (about 7 days) keeps sessions working |
| Expires during a live session | The session runs to its natural end (or a fixed cut-off, for example 24 hours), then can't be restarted; nobody loses typing in progress |
| Expired | No new hosted sessions. Every participant keeps their local copy, editable as an ordinary solo project, with Core (and Pro, if owned) unchanged |
| Pro owned, Co-Write expired | Pro is untouched |
| Guest has no licence | Joins anyway; that's the design |

**No writer ever has to renew Co-Write to get a co-written screenplay back.**

## 7. If the service is unavailable

- Every participant always holds a complete local copy in their own library; an outage pauses live sync, nothing else.
- Writing continues offline; changes merge (or are offered for review) on reconnect.
- Every export and backup works without the service.
- If Co-Write were ever discontinued, sessions end, projects stay, and the shutdown is announced in advance.

## 8. Works the same with Core and Pro

Co-Write syncs Core data (script, Scene Board, optionally the Story Bible and Plan). If the host owns Pro and the
project is locked for production, the Pro data (locked pages, revision rounds) syncs too; guests without Pro see it
read-only, exactly as described in [`pro-license.md`](pro-license.md) §6. Pro is never required to join.

## 9. Operating responsibilities and costs

- **Hosting beyond $5/month**: Durable Object requests and duration above the included amounts, storage of session
  logs, the licence Worker's traffic, plus domain and email. Measure real cost per active session-hour in the spike
  (§10) before fixing the price.
- **Payment fees** per charge, which weigh more on a small recurring charge than on a one-time purchase.
- **Incident response**: an on-call reality for a solo developer. Status page or Discord channel, a documented
  "relay down" message in the app, and a rollback plan for relay deployments.
- **Support**: lost keys, invite problems, "my co-writer's changes didn't arrive", refunds. Budget time for it.
- **Security**: invite-link abuse, denial of service, dependency updates for any collaborative-editing library.
- **Licence recovery and expiry**: covered by [`pro-license.md`](pro-license.md) §3–5.

## 10. Research plan (before any commitment)

1. **Cross-tab sync prototype (local, no server)** to test the element-model bridge, per-writer undo and IME behaviour
   at zero cost. Possibly worth shipping in Core.
2. **Relay spike on Durable Objects** (free plan): latency, reconnect, offline merge, hibernation and real usage per
   session-hour.
3. **Choose the sync approach** (§4) from those results, then limits, price and whether to build.
4. The data-integrity groundwork ([`data-integrity.md`](data-integrity.md)) is in place before any Co-Write metadata
   is stored on a project.

## 11. Boundaries (non-negotiable)

- Solo writing stays exactly as it is: local-first, offline, no account, the same undo.
- Co-Write is per project and opt-in; leaving a session returns the project to solo mode with all content kept.
- No mandatory cloud storage. Invited writers never pay and need no account.
- Every copy of DraftLine opens and preserves a project that was once co-written.

## 12. Open questions for Eric

1. Real-time typing (§4 A or B) for v1, or scene-level turn-taking (C)?
2. A collaborative-editing dependency, loaded only for Co-Write: acceptable?
3. End-to-end encryption: a requirement?
4. Guest limits per session and per host.
5. Which project parts sync in v1: script only, or also the Scene Board, Story Bible and Plan?
6. Should asynchronous `.draftline` merging (§4 D) be a free Core feature regardless?
7. Should the relay be open source and self-hostable?

## History (superseded)

Earlier November 2026 drafts placed Co-Write inside a monthly "DraftLine Pro" subscription with a different payment
provider. Superseded: Co-Write is its own optional subscription that works with Core or Pro, and this document is the
authoritative Co-Write spec.
