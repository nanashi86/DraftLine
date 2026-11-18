# DraftLine Pro: Co-Write, Write Together

> **Status: Future Pro concept — not approved for implementation.** Tentative exploration: 2027 (Q1–Q2), subject to
> feasibility and priorities. Written November 2026 against DraftLine 0.11.0 (commit `343c49a`). The infrastructure
> and business baseline below was decided in November 2026; the sync model (§3) is still open.
>
> **No existing DraftLine functionality may be removed, restricted, or transferred from the free browser application
> to a paid product.** DraftLine Core (*Write Your Story*) stays complete, local-first, offline-capable and
> account-free. Writers who never use Co-Write see no change in how DraftLine works. The only visible addition is
> a greyed-out Co-Write entry point that explains itself when clicked ([`pro-license.md`](pro-license.md) §4a).

This is a feasibility and boundaries brief, not a design. Its job is to say what the current code means for
collaboration, which questions decide the architecture, and what to prototype first. The hosting, payments and
licensing stack is decided (next section); how edits are merged (§3) is not. See also
[`../../ROADMAP.md`](../../ROADMAP.md) (Phase 2) and [`pro-license.md`](pro-license.md).

---

## Baseline decisions for Phase 2 (November 2026)

The guiding constraint: **no fixed costs beyond about $5/month, nothing that scales with idle users, and nothing a
solo developer has to run by hand.**

| Area | Decision | Why |
|---|---|---|
| **Brand** | **DraftLine** is the one name for the software, repo, domain and ecosystem. There are no separate Co-Write apps, repos or brands. | Keeps brand authority, search ranking and AlternativeTo presence in one place. |
| **Taxonomy** | **DraftLine (DL)**: the local-first software (web, PWA, Windows and Android apps): storage, offline use, pagination, FDX/Fountain/PDF export. **DraftLine Core (DLC)**: the free-forever tool suite. **DraftLine Pro: Co-Write (DLP:CO-W)**: an optional paid **cloud service**, real-time WebSocket relays for multi-writer rooms. **DraftLine Pro: Production (DLP:PROD)**: the **Shoot** workspace (local shooting-script tools) **bundled with the Co-Write service**. | Makes clear what's software (free) and what's a service (paid). |
| **Tier names** | **DraftLine Pro: Co-Write** (*Write Together*) and **DraftLine Pro: Production** (*Page to Production*) are the official business tier names in all docs, the roadmap, checkout and receipts. In running text, "Co-Write" and "Production" are fine after the full name appears once. Short forms DL, DLC, DLP:CO-W and DLP:PROD are for internal docs only. | One consistent name everywhere a writer pays or reads. |
| **Messaging** | "DraftLine is free" means the software and every Core writing, planning and export tool are free forever. Writers pay only if they opt into server infrastructure (Co-Write) or the studio-grade production suite (Production). | An honest, testable promise. |
| **UI gating** | Pro entry points (for example the Co-Write session control) are always visible in the same place, greyed out without a licence. Clicking one opens a modal that explains the tier and links to Settings → Pro License. No layout shifts, no unprompted upsells. Full rules: [`pro-license.md`](pro-license.md) §4a. | Discoverable without cluttering or nagging. |
| **Payments** | A **Merchant of Record** processes every Pro subscription. **Lemon Squeezy** is the named provider (5% + 50¢ per transaction, no monthly fee). The MoR is the legal seller and handles global sales tax/VAT, receipts, refunds and chargebacks. **No Stripe Billing, no custom tax logic, no base subscription fees.** | $0 fixed cost, and no tax compliance to run. |
| **Licensing** | A **Cloudflare Worker + KV/D1** issues and renews licence keys from the MoR's webhooks. Apps verify short **leases** locally with a **Web Crypto public key**. **No user accounts and no user database**: only licence records (key hash, tier, status, period end, device ids). Offline grace period. Writers enter the key in **Settings → Pro License**. Full design: [`pro-license.md`](pro-license.md). | Fits "no accounts" and works offline. It runs within the same Workers plan as the relay. |
| **Real-time relay** | **Cloudflare Workers + Durable Objects over WebSockets**, on the **$5/month Workers Paid plan**. One Durable Object per Co-Write session holds the connections and the session's update log, and uses the **WebSocket Hibernation API**. | Usage-based scaling with near-zero idle cost (below). The same Cloudflare account already runs the feedback Worker. |

**Why the relay costs almost nothing when idle** (Cloudflare's published Durable Objects pricing, checked November
2026; re-check before launch):
- Durable Objects are billed by **requests** and **duration** (wall-clock time while running). With the
  **Hibernation API**, a session whose writers are connected but quiet **hibernates and accrues no duration
  charges**. Sessions nobody has open cost nothing.
- **Workers Paid ($5/month) includes** 1 million Durable Object requests and 400,000 GB-s of duration a month. After
  that it costs $0.15 per million requests and $12.50 per million GB-s.
- **WebSocket traffic is cheap:** opening a connection counts as one request, **incoming messages count 20:1** (100
  messages = 5 requests), and outgoing messages are free. Keystrokes should still be batched into small updates
  rather than sent one per character.
- **Storage:** the session log lives in the Durable Object's own SQLite storage, whose monthly allowance (5 GB,
  millions of row writes) is included.
- **Prototyping is $0:** Durable Objects (SQLite-backed) are also on Cloudflare's free plan, with daily limits. The
  $5 plan is only needed for launch.

**Provider risk (payments):** Stripe acquired Lemon Squeezy in 2024. Third-party reports in 2026 describe it as in
maintenance mode and steering merchants toward Stripe Managed Payments. **The decision is the Merchant of Record
model, not the brand.** To keep switching cheap:
- licence keys are generated by DraftLine's own Worker, **not** by Lemon Squeezy's built-in key feature;
- the Worker treats webhooks through one small adapter per provider.

**Paddle** (also a Merchant of Record, same 5% + 50¢ structure) is the drop-in alternative. Check payout support for
Eric's country of residence before signing up.

## 1. Concept

Optional real-time collaborative screenwriting for two or more writers:
- shared sessions;
- live cursors and presence;
- synchronized edits;
- permissions (owner, editor, commenter or viewer);
- conflict handling;
- optional comments and review;
- a clean hand-off back to ordinary solo writing.

**DraftLine Pro: Co-Write** is a paid Pro tier. Direction (Nov 2026, prices not final): a **monthly subscription of
around $4.99**. The subscriber invites collaborators, who **co-write free without paying**. **DraftLine Pro:
Production** (around $9.99/month) includes Co-Write. The native apps are free for everyone; a Pro licence unlocks the
tier on any platform (§6).

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
| Dependencies | DraftLine's standing rule: no new dependencies | Mature collaborative-editing libraries are dependencies. Using one is a deliberate exception to decide, and could be loaded only when a session starts. The relay (Durable Objects) and licence checks (Web Crypto) need no new app dependencies. |
| Existing hosting | Cloudflare Worker for feedback (`draftline-feedback`) | There is precedent and an account for small serverless infrastructure. Long-lived sessions need stateful relays, which is what Durable Objects provide (decided, see Baseline decisions). |

## 3. Sync model options (still open; all run on the decided Durable Objects relay)

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

How each fits the decided relay:
- **A:** the session's Durable Object forwards updates and stores the log, without reading the text, so E2E stays
  possible.
- **B and C:** they map naturally onto it too, because each Durable Object is a single-threaded authority for its
  session, so it can order edits or grant scene claims.
- **D:** needs no relay at all.

## 4. Boundaries (non-negotiable)

- Solo writing stays exactly as it is: local-first, offline, no account, and the same undo.
- Co-Write is **per project and opt-in**. Leaving a session returns the project to ordinary solo mode with all
  content kept locally.
- No mandatory cloud storage for anyone. Invited collaborators never need to buy anything and need no account
  (decided).
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
- **Running costs** that grow with usage, for a free-first project. Mitigated by the Baseline decisions: a fixed
  $5/month, usage-based Durable Objects with hibernation, and percentage-only payment fees. Per-licence session and
  invitee limits (§6) keep a single heavy user from dominating costs.
- **Maintenance load** for a solo developer: a live service has uptime, abuse and support costs that a static app
  doesn't.

## 6. Commercial model

**Pro pricing model (direction, prices not final).** One DraftLine, one licence, write anywhere.
- **Pro is a licence tied to the writer, not to a platform.** It's a monthly subscription to one of two tiers:
  - **DraftLine Pro: Co-Write**, around **$4.99/month**. The subscriber can invite collaborators, who co-write free without
    paying.
  - **DraftLine Pro: Production**, around **$9.99/month**, **including everything in Co-Write**.
- **Platforms are not paywalled.** The browser, the installed PWA, and the planned desktop (Windows)
  and Android/ChromeOS apps are all just ways to use DraftLine. **Core is free on every one of them**, and a Pro
  licence unlocks its tier on every one of them. Subscribe once, enter the token on Windows, use the same licence
  on a Chromebook, with no second purchase.

| Platform | Core | Co-Write licence | Production licence |
|---|---|---|---|
| Browser | Free | Unlocked | Unlocked |
| Installed PWA | Free | Unlocked | Unlocked |
| Windows app (planned) | Free | Unlocked | Unlocked |
| Android/ChromeOS app (planned) | Free | Unlocked | Unlocked |

- **Entering the licence:** a **"Pro License"** field in **Settings**, the same on every platform, where the writer
  pastes their token. No account.
- **How licences are issued, renewed and expire:** [`pro-license.md`](pro-license.md).
- **A licence unlocks features, not unlimited service.** Hosting, storage, concurrent sessions and devices per token
  get reasonable limits, defined before launch.

Why a subscription fits: hosted relays are an **ongoing** cost that grows with use, and a monthly price covers it
where a one-time licence wouldn't.

Still open:
- **Limits for free invitees**: how many per session, and per subscriber.
- **Identity (decided): no accounts.** Paying for Pro gives the subscriber a **unique licence token**, which they
  must save and enter in **Settings → Pro License** on any platform. The token unlocks the tier's features and
  authenticates the subscriber to the relay. It is **not** needed to download or use any DraftLine app. Invitees join by **invite link alone** and need no token. How keys, renewal, expiry, grace, device limits and lost keys work is in
  [`pro-license.md`](pro-license.md).
- **Lapsed subscriptions (decided)**: the licence simply stops renewing and runs out after the paid period plus a
  grace period. The co-written project stays on the device, fully editable as an ordinary solo Core project. Live
  sessions end. See [`pro-license.md`](pro-license.md) §3–4.
- **Self-hosting**: should the relay be open source, so anyone can run their own? That fits MIT, but competes with
  the paid hosted relay.
- **Patreon (decided)**: eligible active Patreon supporters get a **Pro: Production licence** (which includes
  Co-Write). Eligible tiers (proposed, to confirm when Pro launches): **The Writers' Room** ($10/month) and
  **Executive Producer** ($25/month). **In the Credits** ($3/month) stays credits, a Discord role and the community.
  When Pro launches, add "Pro: Production licence" to those tiers' perks on Patreon. Still open: how tokens are issued
  and expired as pledges start and stop.
- **Early access (decided)**: supporters get **early access to the native desktop and Android apps** before public
  release, provided the Ko-fi goal ("DraftLine Native Desktop & Android/ChromeOS Builds") is reached.
  - **Patreon, already advertised:** Patreon's **The Writers' Room** ($10/month) and **Executive Producer** ($25/month) tiers both list early access. The Writers' Room's description promises
    "early beta access to standalone desktop (Windows, macOS, Linux) and Android/ChromeOS builds". *(Native apps are
    now scoped to Windows and Android/ChromeOS; update that tier text so it only promises those.)* These promises are
    kept. In the Credits ($3) does not include early access.
  - **Ko-fi:** supporters get early access too. This isn't stated on Ko-fi yet (as of November 2026), so add it to
    the goal description when the apps get close. Early access is a head start, not a paywall: the apps are
  free for everyone once released.
- **Payments (decided)**: a Merchant of Record (Lemon Squeezy; Paddle as the fallback) handles checkout, global
  tax/VAT, receipts, refunds and chargebacks. See Baseline decisions.

## 7. Research plan (before any commitment)

1. **Cross-tab sync prototype (local, no server).** Two tabs editing one project, merging live. Use it to test the
   element-model bridge, per-user undo and IME behaviour, with zero hosting cost. Possibly worth shipping in Core.
2. **Relay spike on Durable Objects** (free plan, $0). One Durable Object per session using the WebSocket
   Hibernation API, with two browsers. Measure latency, reconnect, offline merge, hibernation behaviour, and real
   requests and GB-s per active session-hour, to confirm the cost model above.
3. **Decide A, B, C or D** from those results, then final prices and limits, then whether to build.

## 8. Open questions for Eric

1. Is real-time typing (A or B) required for v1, or would scene-level turn-taking (C) satisfy most writing
   partnerships?
2. Is a dependency for collaborative editing acceptable, loaded only for Co-Write?
3. Is end-to-end encryption a requirement, given DraftLine's privacy promise?
4. Pricing details: final prices, invitee limits, and whether the relay is also self-hostable (§6). *(Payments via
   a Merchant of Record and hosting on Cloudflare Durable Objects are decided.)*
5. *(Decided: no accounts. Subscribers hold a licence token; guests join by invite link.)*
6. Which project parts sync in v1: the script only, or also the Scene Board, Story Bible and Plan?
7. Should asynchronous merging of `.draftline` files (D) be a free Core feature regardless?
