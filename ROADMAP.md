# DraftLine™ Roadmap

> **DraftLine Core is and will always remain free, private and local-first.
> No user surveillance, no third-party ad tracking, no locked formats, and no feature you have today will ever be paywalled.**

Your scripts live on your machine: in your browser, or as `.draftline` files in a folder you choose.
Every script exports to open formats (Final Draft `.fdx`, Fountain and PDF), so you're never locked in.

**No subscriptions. No distractions. No compromises. Just Write.**

## One product: DraftLine

**DraftLine** is the single name for the software, the GitHub repo, the domain ([draftlineapp.com](https://draftlineapp.com))
and everything around it. Inside it there's a complete free core, and two optional extras planned for later:

| Product | Access | What it is |
|---|---|---|
| **DraftLine Core** | **Free forever** | Everything DraftLine does today: writing, the Scene Board, the Story Bible, Plan (Breakdowns, Stripboard, Reports), every import and export, offline use and folder sync. **Table Read, Schedule and Budget will be part of Core when they ship.** |
| **DraftLine Pro** | **Planned one-time purchase** | Core plus **Shoot**: locked pages and scene numbers, revision rounds and revised pages for production. **A one-time purchase, not a subscription.** *(future, deferred)* |
| **DraftLine Co-Write** | **Planned optional subscription** | Optional real-time co-writing, hosted by DraftLine. Works with **Core or Pro**. Only the writer hosting a session needs it; invited writers join free. *(long-term future)* |

Pro and Co-Write don't exist yet. **Pricing and availability will be announced when these features are ready.**

- **Core is not a trial or a limited version.** It's the whole app, and it keeps getting new features.
- **Pro is bought once.** No subscription, no expiry, and it never requires Co-Write.
- **Co-Write is the only subscription**, because it's a live hosted service. It never requires Pro, and letting it
  lapse never touches Core, Pro or your scripts.
- **Your work is always yours.** With or without Pro or Co-Write, you can open, edit, print, export, back up and
  recover everything you've written.
- **Licences unlock capabilities, not platforms.** The browser, the installed app and the planned Windows and
  Android/ChromeOS apps are all free; Pro and Co-Write work on all of them. No accounts.
- **What you'll see.** Shoot sits after Page, Split and Board; Schedule and Budget sit in Plan; Table Read and
  Co-Write are in ⋮. Each opens a short note about what's planned. No pop-ups, badges or reminders you didn't click for.

## Shipped

- [x] **Core Web Engine**: Final Draft (`.fdx`) and Fountain import and export, a compiled PDF built right in
  DraftLine, Format Doctor, the Density Risk meter, and an offline library that keeps working without a connection.
- [x] **In-app feedback**: ⋮ → Send Feedback… goes straight to the developer, anonymous unless you add your email.

## What's next

The order below is the plan of priority and expected effort, **not release dates**. Each stage needs its own approval
before work starts, and ships when it's ready.

- [ ] **Stage 1 · DraftLine Core: Table Read** (*next planned feature, free*)
  Hear your script read aloud with your computer's own voices: Play, Pause, Stop and speed, starting from the top, a
  scene or where you are. Character voices and a "Rehearse as…" mode later. Nothing is sent anywhere by default, no
  AI, no account. Voice quality and offline voices depend on your system and browser.
- [ ] **Stage 2 · DraftLine Core: Schedule & Budget** (*free*)
  Plan becomes **Breakdowns · Stripboard · Schedule · Budget**; Reports is in ⋮ and works as it does now.
  - **Schedule**: scenes into shooting days, in an order separate from the script, with page-eighths, pages per day,
    grouping by location, cast, INT/EXT and time of day, practical conflict warnings and CSV export.
  - **Budget**: cast, crew, locations, props, wardrobe, equipment, vehicles, post and your own lines; costs linked to
    breakdown and schedule quantities, totals, contingency, your currency and CSV export.
  - **Before this ships:** data-safety groundwork so newer project data can never be lost by an older copy of
    DraftLine (unknown-field preservation, a schema update, compatibility tests). Details:
    [`docs/specs/data-integrity.md`](docs/specs/data-integrity.md).
- [ ] **Stage 3 · DraftLine Pro: Shoot & Production Revisions** (*future, deferred; one-time purchase*)
  Locked pages and A-pages, omitted pages and scenes, locked and suffixed scene numbers, revision rounds and colours,
  changed-line asterisks, a revision archive and comparison, revised-pages-only PDFs and Final Draft revision
  interoperability. Locked pagination stays separate from ordinary pagination so Core is never slowed or changed.
  Revisited when there's demand and it's technically ready; being Stage 3 doesn't mean it starts right after Stage 2.
- [ ] **Stage 4 · DraftLine Co-Write** (*long-term future; optional subscription*)
  Shared sessions, live cursors, synchronised edits, guest invitations and permissions, per-writer undo, offline
  reconnection and reliable local copies for everyone. It has the most technical and operational complexity, so it
  comes last, and only once real hosting and support costs are understood.

**Data safety comes first.** If a risk to existing writers' data is found, fixing it takes priority over any feature,
including Table Read.

## Also on the table

These are separate from the stages above:

- **Native apps**: a Windows desktop app and an Android and Chromebook app on Google Play (macOS, Linux and iOS aren't
  planned for now). They're free, like the browser version: Core costs nothing on any platform, and Pro and Co-Write
  work on all of them. Supporters (Patreon's Writers' Room and Executive Producer tiers, and Ko-fi) get early access
  once the Ko-fi goal is reached.
- **Performance benchmarks** for very long scripts, and **tablet and touch layout** improvements (Core).
- **Licences and payments** are built only when a paid stage is approved. Design notes:
  [`docs/specs/pro-license.md`](docs/specs/pro-license.md).

Design notes for everything here live in [`docs/specs/`](docs/specs/).

## How to support

DraftLine is built by one writer-developer, funded by the people who use it.

- **Patreon:** [patreon.com/DraftLine](https://patreon.com/DraftLine). The Writers' Room and Executive Producer tiers
  include early access to the desktop and Android builds, and are planned to include DraftLine Pro and Co-Write when
  they launch, as promised.
- **Ko-fi:** [ko-fi.com/draftline](https://ko-fi.com/draftline)
- **Discord:** [discord.gg/8ytSsSWsPX](https://discord.gg/8ytSsSWsPX): the DraftLine Writers' Room, for
  feedback, bug reports and early builds

Ideas and bug reports are just as welcome: use ⋮ → **Send Feedback…** in the app, or open an
issue on GitHub.
