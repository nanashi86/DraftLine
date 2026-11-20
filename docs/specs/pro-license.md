# Licences and access: DraftLine Pro (one-time) and DraftLine Co-Write (subscription)

> **Status: future infrastructure, not approved for implementation.** Rewritten November 19, 2026 for the approved
> **Option D** model. Needed only when Stage 3 (DraftLine Pro) or Stage 4 (DraftLine Co-Write) is approved
> ([`../../ROADMAP.md`](../../ROADMAP.md)). Payments: [`payments.md`](payments.md).
>
> **No existing DraftLine functionality may be removed, restricted, or transferred from the free application to a
> paid product.** A licence only ever unlocks Pro capabilities or Co-Write hosting. DraftLine Core never asks for one,
> on any platform, and no licence state ever locks anyone out of their own scripts.

## 0. The model (Option D, approved November 2026)

| Product | Planned price | What it gives |
|---|---|---|
| **DraftLine Core** | Free forever | Everything DraftLine does today, plus Table Read, Schedule and Budget when they ship |
| **DraftLine Pro** | **$29.99 one-time** | Core plus **Shoot** and the advanced production-revision workflows. Owned, not rented. |
| **DraftLine Co-Write** | **$4.99/month** | Hosting real-time co-writing sessions. Works with Core **or** Pro. |

Prices are plans for unreleased products, not offers. A writer can have:

1. **Core only**: free.
2. **Core + Co-Write**: $4.99/month while they want to host sessions.
3. **Pro**: $29.99 once, no subscription.
4. **Pro + Co-Write**: $29.99 once, plus $4.99/month while collaboration is active.

**Pro and Co-Write are independent.** Pro never requires Co-Write; Co-Write never requires Pro; Co-Write is not part
of Pro; there's no combined tier.

*Superseded (kept for history): the November 2026 drafts described "DraftLine Pro: Co-Write" (about $4.99/month) and
"DraftLine Pro: Production" (about $9.99/month, including Co-Write) as two monthly tiers of one Pro subscription, with
a single **Settings → Pro License** screen and greyed-out Pro badges in the toolbar. All of that is replaced below.
The earlier pricing alternatives (Options A–C) are historical only; [`co-write.md`](co-write.md) (History) keeps a
short record of the superseded model.*

## 1. Principles

- **No accounts, no user database.** Proof of purchase is a key the writer keeps. The licence service stores licence
  records (key hash, product, status, dates, device ids), never people. Email and payment details stay with the payment
  provider.
- **Licences unlock capabilities, not platforms.** The same key works in the browser, the installed app and the planned
  Windows and Android/ChromeOS apps. Native apps are free; they aren't a paid tier.
- **Offline first.** Pro is verified on the device with no connection at all. Co-Write needs a connection anyway (it's
  a live service), so its check rides along with the session.
- **Separate records for separate things.** Pro ownership and Co-Write subscription status are two entitlements, issued,
  stored, checked and shown separately. One never changes the other.
- **Minimal data, no new app dependencies.** Signatures are checked with the browser's built-in Web Crypto. Worker logs
  stay off.

## 2. Two entitlements

| | **DraftLine Pro** | **DraftLine Co-Write** |
|---|---|---|
| Kind | Perpetual ownership | Subscription |
| Key | `DL-PRO-…` (kept by the writer) | `DL-CW-…` (kept by the writer) |
| On the device | A **signed Pro certificate**: `{ v, product: "pro", lid, major: 1, iat, dev }`. **No expiry date.** | A **signed lease**: `{ v, product: "cowrite", lid, exp, iat, dev }`, valid to the paid period's end + grace |
| Checked | Offline, forever: signature + product + major version | At session start by the relay, and offline for the UI until `exp` |
| Renewal | None needed. An occasional, optional online check only refreshes the revocation status (§4). | About once a day when online, while active |
| Ends when | Only by revocation for refund, chargeback or a leaked key | The subscription ends (after the paid period + grace) |

**Does the existing token design support this?** Yes, with one change. The November design (licence key + short signed
lease, Cloudflare Worker + KV/D1, Web Crypto ECDSA P-256) already covers the Co-Write lease, device registration,
offline checks and lost-key recovery without accounts. Pro needs a **second record type that doesn't expire**, plus a
small **revocation list** for refunds and leaked keys (§4). Both fit the same Worker and the same public key in the app.

## 3. Lifecycle

```
Purchase (Pro, one-time) or subscription (Co-Write) through the payment provider (payments.md)
        │  signed webhook
        ▼
Licence Worker: create key → record { product, status, periodEnd? }
        │  key on the success page and in the receipt email
        ▼
Settings → Licenses & Access: paste key → POST /activate { key, deviceId }
        │
        ├─ Pro: signed certificate stored; Pro capabilities on, offline, with no expiry
        └─ Co-Write: signed lease stored; hosting on until exp; renewed when online
```

| Event | DraftLine Pro | DraftLine Co-Write |
|---|---|---|
| Paid | `owned` | `active`, period moves forward |
| Payment failed, retrying | n/a | `past_due`, lease capped at grace |
| Cancelled by the writer | n/a | `active` until period end ("canceled, active until …"), then `expired` |
| Refund or chargeback | `revoked` | `revoked` |
| Key leaked or abused | old key `revoked`, replacement issued free | same |
| Resubscribed | n/a | same key, `active` again |
| A newer paid major version ships | **Nothing changes.** Pro 1 stays owned and working. | n/a |

**Grace** (Co-Write): about 7 days after the period ends, already inside the lease's `exp`, so an offline writer isn't
cut off mid-session.

## 4. Revocation without accounts

- The Worker publishes a small signed **revocation list** (licence ids only, no personal data).
- Pro: the app fetches it **occasionally** when online (for example weekly), never on every launch and never blocking.
  A revoked certificate turns Pro capabilities off on that device; Pro data stays readable (§6). Offline, the
  certificate keeps working.
- Co-Write: the relay checks the host's lease and the list at every session start; a revoked host can't open sessions.
- Revocation is **only** for refunds, chargebacks and leaked keys, never for a newer version, never for inactivity.

## 5. Settings → Licenses & Access (future UI, not built)

A short section in Settings, consistent with the existing rows. **Not a storefront**: no prices, banners or prompts
unless the writer opens it, and no automatic upsell dialogs anywhere.

**DraftLine Pro**
- Status: **Not purchased** / **Purchased** ("DraftLine Pro 1 · purchased · this device").
- "One-time purchase. No subscription."
- **Enter licence key** (activation), **Restore** (paste the key again after a reinstall), **Remove from this device**.
- "Checked on this device. Works offline."
- No billing dates; nothing renews.

**DraftLine Co-Write**
- Status: **Not subscribed** / **Active** (renews on …) / **Canceled, active until …** / **Expired**.
- **Enter licence key**; **Manage subscription** (opens the payment provider's customer portal) when available.
- "You can host co-writing sessions" / "Invited writers can join your sessions free" when active.
- Renewal and cancellation information when available.

The two blocks never depend on each other: buying Pro doesn't show Co-Write as active, and an expired Co-Write never
touches the Pro block.

**Public placeholders today** (the planned-feature previews, `lib/plannedFeatures.js`) already distinguish the two:
Shoot says "Planned for DraftLine Pro … A future optional upgrade. DraftLine Core remains free."; Co-Write says
"Planned optional collaboration … A future optional hosted service. Solo writing stays free." **No prices appear in
the app** (decided November 19, 2026); they live only in the planning docs.

## 6. Guarantees (permanent)

- **Core is always available**, on every platform, with no key.
- **Purchased Pro capabilities stay usable** under their perpetual entitlement. No expiry because a billing period
  ends; a newer paid major version never revokes the version you bought.
- **Co-Write expiring never disables Pro**, and never disables Core.
- **No subscription ending ever deletes or hides project data.**
- **Writers can always print, export, back up and recover everything they created**: PDF, Final Draft, Fountain and a
  complete `.draftline` backup, with or without any licence.
- **Production revisions and archives stay accessible**: visible, printable and exportable, including existing
  revised-pages-only PDFs, regardless of licence status.
- **Core writing stays editable** in every project.
- **No export may silently discard important project metadata.** If a format can't carry something (Fountain can't
  hold revision rounds), DraftLine says so at export and the complete `.draftline` backup still has it.
- **No writer has to renew Co-Write to get a co-written screenplay back**: every participant keeps a local copy.
- **No writer has to buy Pro again to open or export an existing project.**

### Opening a Pro project on a device without Pro

| | Allowed |
|---|---|
| Open, read, scroll, search | Yes |
| Edit the script, Scene Board, Story Bible, Plan (Core) | Yes |
| See locked page numbers, scene numbers, revision colours and marks | Yes, read-only |
| Print and export (PDF, revised-pages PDFs already produced, FDX, Fountain, `.draftline`) | Yes |
| Start a new revision round, change locks, generate new revised pages | No: opens the Shoot preview explaining Pro |
| Remove locking to go back to ordinary pagination | Yes (it only removes Pro data; confirm in the Shoot spec) |

## 7. Feature entry points in the interface

Today (November 2026, built): **Shoot** sits after Board in Write's view switch with the Lucide `film` icon;
**Schedule** and **Budget** sit after Stripboard in Plan; **Table Read…** and **Co-Write…** are in Write's ⋮ menu.
Each opens a short planned-feature preview (`components/PlannedFeatureModal.jsx`). Rules, now and when Pro ships:

1. **Static layout.** Entry points are in every copy of DraftLine, in the same place and size, whatever the licence
   state. Nothing appears, disappears or shifts.
2. **No padlock, no greyed-out state, no "Pro" badge or price on the toolbar or menu items.** Shoot looks like Page,
   Split and Board. (DraftLine's padlock already means Viewing mode and the Project Lock.)
3. **Click → one calm dialog.** Without the entitlement, Shoot opens the same compact preview it opens today, which
   will then also offer **Enter licence key** (Settings → Licenses & Access) and **Learn more**. With Pro, Shoot opens
   the workspace.
4. **Never unprompted.** No pop-ups, banners, timers or reminders. The dialog only opens when the writer clicks.
5. Co-Write's entry point behaves the same way for hosting; joining a session by invite never needs a licence.

Building it later: a `entitlements.js` helper (`hasPro()`, `coWriteStatus()`), pure and unit-tested; tests that the
toolbar layout is identical in every licence state and that Core features never consult entitlements.

## 8. Device limits and sharing

- Proposed: **3 active devices per key**, for each product. A device unseen for about 30 days frees its slot; **Remove
  from this device** frees it at once.
- The Co-Write relay checks the **host's** lease at every session start; guests join by invite link with no key.
- **Honest limit:** DraftLine is MIT open source, so anyone can patch their own copy to skip the Pro check. That's
  accepted: Pro works largely on trust, like most indie software, while what costs money to run (Co-Write hosting) is
  enforced on the server.

## 9. Supporters (Patreon, Ko-fi): needs Eric's decision

Existing public promises (README, ROADMAP, Patreon tier text) say The Writers' Room ($10/month) and Executive
Producer ($25/month) are "planned to include a Pro: Production licence (which includes Co-Write)". Under Option D,
Pro no longer includes Co-Write. To keep the promise intact, one of:

- **A.** Eligible patrons get a **Pro key** (perpetual, kept even if they stop pledging) **and Co-Write hosting while
  their pledge is active** (a Co-Write lease that follows the pledge). Closest to what was promised.
- **B.** Eligible patrons get a **Pro key** only, and the "includes Co-Write" wording is retired with notice.

Recommended: **A**. Early access to the native apps (when the Ko-fi goal is reached) is unchanged and isn't a
licence. Issuing: a Patreon webhook creates the key; a claim page signs in with Patreon (their existing login, not a
DraftLine account) and shows it.

## 10. Build order (when approved)

1. Payment provider sandbox + the Worker's webhook adapter ([`payments.md`](payments.md)).
2. Licence Worker on Cloudflare (KV or D1): `/activate`, `/restore`, `/deactivate`, `/renew` (Co-Write), the
   revocation list, provider and Patreon webhooks. Shares the $5/month Workers Paid plan with the relay.
3. App: `entitlements.js`, the Licenses & Access section behind a hidden developer flag, then the first paid feature
   reads it. Licence data is stored per device (like `userSettings.js`), **never inside a project**, so backups and
   `.draftline` files never carry a licence.
4. Tests: valid, tampered and revoked certificates; expired, grace and future-dated leases; clock skew; offline
   behaviour; device-limit messages; "Core never consults entitlements".

## 11. Open questions

1. **Major-version policy for Pro.** What a $29.99 purchase covers (for example "Pro 1.x, including all 1.x updates")
   and whether a future Pro 2 is a paid upgrade. **Not decided; nothing should promise unlimited future major
   versions.** Whatever is decided, Pro 1 keeps working forever.
2. Device limit (3?) and whether browser + installed app on one computer count as one.
3. Co-Write grace length (7 days proposed) and annual billing (see `payments.md` on fees at $4.99).
4. Lost keys: receipt email and the provider's order lookup first; manual support as a fallback?
5. Supporter option A or B (§9).
6. Refund window for Pro (the provider's default, or DraftLine's own, such as 30 days).

---

*Platform scope: native apps planned for Windows and Android/ChromeOS; macOS, Linux and iOS aren't planned for now.
Nothing above depends on the platform.*
