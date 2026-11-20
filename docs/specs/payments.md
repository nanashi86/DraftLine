# Payments: providers for DraftLine Pro (one-time) and DraftLine Co-Write (subscription)

> **Status: research, November 19, 2026. No provider is chosen, no account is opened, nothing is built.** The
> payment stack is an enabling workstream, needed only when a paid product (Stage 3 Pro or Stage 4 Co-Write) is
> approved. It must handle **both** a one-time purchase (DraftLine Pro, $29.99 planned) and a monthly subscription
> (DraftLine Co-Write, $4.99/month planned). Licences and entitlements: [`pro-license.md`](pro-license.md).
>
> This replaces the earlier "Lemon Squeezy decided" baseline in `co-write.md` and `pro-license.md`.

## 1. What changed: Lemon Squeezy is closing

Lemon Squeezy announced on **November 16, 2026** that it is winding down:
- new store sign-ups are closed;
- migration tooling launches **December 2, 2026**;
- it **stops processing all transactions on March 31, 2027**;
- Stripe points merchants to **Stripe Managed Payments**, with promotional MoR pricing (1.5%) for migrating
  merchants through December 1, 2027.

**Lemon Squeezy is no longer an option for DraftLine.** Sources: Lemon Squeezy's own blog index ("Lemon Squeezy will
stop processing transactions for all businesses on March 31, 2027"), and Tech Startups' report of the announcement.

## 2. Merchant of Record or direct

| | Merchant of Record (MoR) | Direct (you are the merchant) |
|---|---|---|
| Legal seller | The provider | DraftLine (Eric, or his business) |
| Sales tax / VAT / GST | Provider registers, collects, files and remits worldwide | DraftLine must register where thresholds are met (EU VAT OSS, UK VAT, US states, …) and file |
| Refunds, chargebacks | Provider handles disputes; refund policy is partly theirs | DraftLine handles and pays dispute fees |
| Fees | Higher (about 5–7% all in) | Lower (about 3–4% before tax tooling) |
| Fit for a solo developer | Strong: no tax compliance to run | Weak, unless sales are small and local |

**Recommendation (unchanged in principle): a Merchant of Record.** The brand is open again.

## 3. Candidates

Fees from the providers' own pages on November 19, 2026; re-check before signing up.

| | **Paddle** | **Polar** | **Stripe Managed Payments** | **Stripe direct** |
|---|---|---|---|---|
| Model | MoR | MoR | MoR (on Stripe) | Direct |
| Fee | **5% + 50¢**, no monthly fee | Starter **5% + 50¢** free; paid plans from $20/month (3.8% + 40¢) | **3.5%** on top of standard Stripe processing | Standard Stripe processing; Billing and Tax extra |
| Extra fees | Products under $10 need custom pricing (Co-Write at $4.99 is affected) | +1.5% non-US cards; $15 per dispute; Stripe payout fees passed through | Optional extras (billing features, local methods) priced separately | Billing (subscriptions) and Stripe Tax add percentages; dispute fees |
| One-time + subscriptions | Yes (subscriptions explicit; digital products listed) | Yes | Yes (Checkout, Payment Links, Billing) | Yes |
| Licence keys | Not used (DraftLine issues its own) | Has a licence-key benefit (not needed) | None (Lemon Squeezy's keys don't carry over) | None |
| **Seller eligibility** | "Anywhere in the world" except a sanctions list; **Rwanda and the Dominican Republic are not on it** | Payouts via Stripe Connect Express; **Rwanda and the Dominican Republic are listed** | Business must be based in **US, CA, most of the EU/EEA, GB, CH, NO, AU, HK, JP or SG**; **not Rwanda or the Dominican Republic** | Business must be in a Stripe-supported country |
| Notes | Mature; handles subscription dunning and cancellations | Developer-friendly; newer company; fees changed in 2026 | Stripe's eligibility review; low dispute rate required; can refund within 60 days | Tax compliance would be DraftLine's job |

**Eligibility matters most.** Eric is based in Rwanda and planning a move to the Dominican Republic. Stripe Managed
Payments and Stripe direct would need a business registered in a supported country (for example a US LLC); that's a
legal and tax decision outside this document. **Paddle and Polar can pay out to both countries** as their pages read
today.

**Small-price caution.** At $4.99, a 5% + 50¢ fee takes about 15% (75¢). Paddle asks products under $10 to contact
them for pricing. Options to evaluate: annual Co-Write billing (about $49.99/year), or a provider whose fixed fee is
lower. The $29.99 one-time Pro pays about 6.7% at 5% + 50¢.

## 4. Requirements any provider must meet

- **Both product types** from one account: a one-time Pro purchase and a monthly (optionally yearly) Co-Write plan.
- **Webhooks**: `purchase completed`, `refund`, `chargeback`, `subscription created / renewed / payment failed /
  cancelled / ended`, delivered with signatures and retries. DraftLine's licence Worker verifies each one and is
  idempotent (the same event twice changes nothing).
- **Cancellation and renewal**: the provider runs dunning and the customer portal; DraftLine only mirrors status.
- **Perpetual licence restoration**: a buyer who lost their Pro key can recover it from the receipt email or the
  provider's order lookup; DraftLine's Worker can re-send it by order id (no account).
- **Entitlement delivery**: DraftLine's Worker issues its own keys on the purchase webhook, so changing provider means
  changing only a webhook adapter.
- **Refunds and chargebacks**: a refunded or charged-back Pro purchase revokes that key (see `pro-license.md`).
- **Payouts** to a bank account Eric can actually receive in.

## 5. Costs beyond transaction fees

- Cloudflare Workers Paid, **$5/month** (licence service and Co-Write relay share it), plus usage above the included
  amounts once Co-Write has real sessions.
- Payout and currency-conversion fees (Polar passes Stripe's through; others vary).
- Dispute fees where charged ($15 per dispute on Polar).
- Support time: lost keys, refunds, "it says expired".
- Accounting and any business registration a provider requires.

## 6. Next steps (only when a paid stage is approved)

1. Confirm eligibility and payouts with **Paddle** and **Polar** directly for Eric's country of residence at that time.
2. Ask Paddle about pricing for a $4.99 product; model annual Co-Write.
3. Build the licence Worker's webhook adapter against one provider's sandbox; keep the adapter boundary so a second
   provider is a small addition.
4. Revisit Stripe Managed Payments only if a supported business location becomes practical.

## Sources

- Lemon Squeezy blog (index, wind-down notice): https://www.lemonsqueezy.com/blog
- Tech Startups, Nov 16, 2026: https://techstartups.com/2026/11/16/stripe-shuts-down-lemon-squeezy-just-two-years-after-acquisition-giving-businesses-until-march-2027-to-migrate/
- Stripe Managed Payments: https://stripe.com/managed-payments
- Stripe Managed Payments eligibility: https://docs.stripe.com/payments/managed-payments/eligibility
- Paddle pricing: https://www.paddle.com/pricing
- Paddle supported countries: https://www.paddle.com/help/start/intro-to-paddle/which-countries-are-supported-by-paddle
- Polar pricing: https://polar.sh/resources/pricing
- Polar supported countries: https://polar.sh/docs/merchant-of-record/supported-countries
