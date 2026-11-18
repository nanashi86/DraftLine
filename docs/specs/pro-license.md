# DraftLine Pro Licences: tokens, renewal and expiry

> **Status: future Pro infrastructure — not approved for implementation.** Written November 2026. Needed before
> **DraftLine Pro: Co-Write** (*Write Together*) or **DraftLine Pro: Production** (*Page to Production*) can launch.
>
> **No existing DraftLine functionality may be removed, restricted, or transferred from the free browser application
> to a paid product.** A licence only ever unlocks Pro features. Core never asks for one, on any platform, and a
> lapsed licence never locks anyone out of their own scripts.

This is the setup outline for how Pro licences are issued, checked, renewed and expired, written so that "let's build
the licence system" can start from it. It applies to both Pro tiers. Pricing and tiers live in
[`co-write.md`](co-write.md) §6. See also [`production-revisions-concept.md`](production-revisions-concept.md) and
[`../../ROADMAP.md`](../../ROADMAP.md).

---

## 1. Principles

- **No accounts.** The writer's proof of purchase is a **licence key** they save, entered once in **Settings → Pro
  License**. No sign-up, no password, no DraftLine profile.
- **Tied to the writer, not the platform.** One key works in the browser, the installed PWA, and the Windows and
  Android/ChromeOS apps.
- **Works offline.** Day to day, DraftLine checks the licence on the device. It goes online only to renew it, and
  never needs to on every launch.
- **Expiry, not punishment.** Cancelling simply stops renewals, and the licence runs out at the end of what was paid
  for, plus a grace period. Nothing is deleted, and Core keeps working.
- **Minimal data.** The licence service stores only what it needs to say "this key is active for this tier until this
  date". No script content, no names, no IP logs (Cloudflare Worker logs stay off, as for feedback).
- **No new app dependencies.** Signature checks use the browser's built-in Web Crypto.

## 2. The two pieces: key and lease

| | **Licence key** | **Lease** |
|---|---|---|
| What it is | A long random string, e.g. `DL-PRO-7K4Q-…` | A small signed record the app stores and checks |
| Who sees it | The writer saves it, from the receipt email or success page | Invisible. DraftLine keeps it on the device. |
| Lifetime | As long as the subscription exists | Short: the paid period's end + grace (about 5 weeks at most) |
| Purpose | "Who I am" for renewal | "What I'm allowed, until when", checkable offline |

**Lease contents** (signed by the licence service):

```json
{ "v": 1, "lid": "random licence id", "tier": "cowrite" | "production",
  "exp": "2026-12-25T00:00:00Z", "iat": "2026-11-18T10:00:00Z", "dev": "random device id" }
```

- Signed with a private key held only by the licence service (a Worker secret). The matching **public key ships in
  the app**, and the app verifies leases with Web Crypto: ECDSA P-256 is universally supported; Ed25519 if every
  target browser supports it by then.
- The key itself is never stored in plain form on the server, only a hash, so a leaked database can't be turned back
  into keys.
- The device id is random, created on the device, and means nothing outside DraftLine. It exists only for device
  limits (§5).

## 3. Lifecycle

```
Buy (Stripe/Lemon Squeezy/Paddle) or Patreon pledge
        │  webhook
        ▼
Licence service (Cloudflare Worker + KV/D1): create key → status: active, tier, periodEnd
        │  key shown on the success page and in the receipt email
        ▼
Writer pastes key into Settings → Pro License
        │  POST /activate {key, deviceId}
        ▼
Signed lease stored on the device → Pro features unlocked, offline
        │  when online, at most about once a day: POST /renew {key, deviceId}
        ▼
Active? → fresh lease (exp = periodEnd + grace)        Not active? → no new lease; the current one runs out
```

| Event (from the payment provider or Patreon) | Licence status | What renewal returns |
|---|---|---|
| Payment succeeded / pledge active | `active`, `periodEnd` moves forward | New lease to `periodEnd` + grace |
| Payment failed, provider retrying | `past_due` | New lease, but capped at the grace window, never extended past it |
| Cancelled (by the writer) | `active` until `periodEnd`, then `ended` | Leases up to `periodEnd` + grace, then none |
| Refund or chargeback | `revoked` immediately | None. The Co-Write relay rejects at once. |
| Key leaked or abused | `revoked`, and a replacement key is issued | None for the old key |
| Resubscribed | `active` again, **same key** | New lease. Nothing to re-enter. |
| Tier change (Co-Write ↔ Production) | Same key, new `tier` | Next lease carries the new tier |

**Grace period:** about 7 days after `periodEnd`, so a writer who is offline, travelling or fixing a card isn't cut
off mid-scene. The lease's `exp` already includes it, so this works with no connection at all.

## 4. What the app does

**Settings → Pro License** (the same on every platform):
- A field to paste the key, then **Activate**.
- A status line, for example "Pro: Production · active · checked Nov 18 · valid until Dec 25".
- **Remove licence** (frees this device's slot).
- Plain messages: "Couldn't reach the licence service. Pro stays on until Dec 25." / "This licence has ended. Your
  scripts are safe; Pro features are off. Resubscribe and this key works again."

**On launch and every few hours:**
- Verify the stored lease's signature and `exp` locally.
- Valid: unlocked.
- Expired: Pro features off.
- If online and the lease expires within about 21 days (or a day has passed since the last check): renew quietly in
  the background.

**When a licence ends:**

| | Keeps working | Turns off |
|---|---|---|
| **Everything** | All of Core, every script, every export, on every platform | Nothing that was free |
| **Co-Write** | The project stays on the device as an ordinary solo script with all content | Hosting and joining live sessions. Invitees lose access to that session. |
| **Production** | Locked pages, scene numbers, revision marks and colours stay **visible and printable (read-only)** | Starting a new colour round, changing locks, revised-pages PDFs (to confirm, §8) |

## 5. Device limits and sharing

- Each key can have a few active devices at once (proposed: **3**). `/activate` and `/renew` register the random
  device id.
- A device that hasn't renewed in about 30 days frees its slot automatically. **Remove licence** frees it at once.
- Over the limit: activation fails with "This licence is active on 3 devices. Remove it from one, or wait 30 days."
- The Co-Write relay checks the **host's** lease at the start of every session and periodically during it. Guests
  join by invite link and need no licence.

**Honest limit:** DraftLine is open source, so anyone can edit their own copy to skip the check. That's accepted.
What's actually worth protecting is enforced on the server: **Co-Write hosting** (the relay checks every session).
Production is mostly on-device, so its licence works largely on trust, like most indie software.

## 6. Patreon

Patreon's The Writers' Room ($10) and Executive Producer ($25) tiers are planned to include a **Pro: Production
licence** ([`co-write.md`](co-write.md) §6).
- **Issuing:** a Patreon webhook (pledge created) tells the licence service to create a key. The patron gets it
  through a **claim page**: they sign in with Patreon (their existing Patreon login, not a DraftLine account), and the
  page shows their key. Alternatively, send it in a Patreon message.
- **Renewal:** active pledge in an eligible tier means renewals succeed. A deleted pledge or a tier dropped below
  eligible means `ended` at the end of the paid month. The same grace and read-only rules apply.
- A patron who also buys a subscription keeps one key, and the higher tier wins.

## 7. Building it (when approved)

1. **Choose a payment provider.** A *merchant of record* (for example Lemon Squeezy or Paddle) handles sales tax,
   VAT, receipts and refunds, which matters for a solo developer. Some include built-in licence keys that could
   replace part of §3. Stripe is cheaper but leaves taxes to you.
2. **Licence service:** a Cloudflare Worker with `/activate`, `/renew`, `/deactivate`, plus webhook endpoints for the
   provider and Patreon, and KV or D1 storage. Store the key hash, tier, status, `periodEnd`, device ids and last
   renewal.
3. **App side:**
   - `src/lib/proLicense.js`: lease storage, signature verification, the renewal schedule and a `proTier()` helper
     that features call. Pure functions, unit-tested.
   - The Settings → Pro License row.
   - Persistence: store the lease and device id with the existing per-device settings (`lib/userSettings.js`) or
     their own small key. **Never inside a project**, so `.draftline` files and backups never carry a licence.
4. **Tests:**
   - valid, expired and tampered leases;
   - the grace boundary;
   - clock skew (never trust a lease issued in the future);
   - renewal backoff when offline;
   - tier downgrade;
   - device-limit messages;
   - "Core features never consult `proTier()`", guarded by a test.
5. **Order:** licence service, then the app's Settings row behind a hidden developer flag, then the first Pro feature
   (Co-Write) reads `proTier()`.

## 8. Open questions

1. **Payment provider:** a merchant of record (simpler taxes) or Stripe (cheaper)?
2. **Grace period** length (7 days proposed) and the renewal window (renew when under 21 days left)?
3. **Device limit:** 3 per key? Does the Windows app plus the browser plus a Chromebook count as 3?
4. **Production after lapse:** besides read-only viewing and printing, can writers still *unlock* a locked script to
   go back to ordinary pagination? Proposed: yes, since unlocking only removes Pro data and never adds any.
5. **Lost keys:** recover through the provider's customer portal or receipt email, through the Patreon claim page,
   or by emailing support (manual)?
6. **Ko-fi:** early access is not a licence. How do Ko-fi supporters get early builds: emailed links, or a code?

---

*Platform scope (November 2026): the native apps planned are **Windows** and **Android/ChromeOS**. macOS, Linux and
iOS are not planned for now. The licence design above is platform-neutral, so adding them later changes nothing here.*
