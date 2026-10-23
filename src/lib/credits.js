// About → Executive Producers & Patrons, read from public/credits.json so backers can be added
// without touching the app's code:
//
//   {
//     "updated": "2026-10-23",
//     "producers": [
//       "Jane Doe",                                  ← a plain name is an Executive Producer
//       { "name": "John Roe", "tier": "Patron" }     ← or name a tier: "Executive Producer" | "Patron"
//     ]
//   }
//
// The service worker fetches this file network-first (src/pwa/sw.template.js), so a deployed edit
// shows up on the next open of About while online; offline, the last copy seen is used.

export const CREDIT_TIERS = ['Executive Producer', 'Patron'];
const MAX_NAME = 80;
const MAX_ENTRIES = 1000;

/** credits.json (already parsed) → [{ name, tier }], dropping anything malformed. Never throws. */
export function normalizeCredits(json) {
  const list = Array.isArray(json?.producers) ? json.producers : [];
  const out = [];
  const seen = new Set();
  for (const entry of list.slice(0, MAX_ENTRIES)) {
    const raw = typeof entry === 'string' ? entry : entry?.name;
    if (typeof raw !== 'string') continue;
    const name = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
    if (!name) continue;
    const tier = CREDIT_TIERS.includes(entry?.tier) ? entry.tier : 'Executive Producer';
    const key = `${tier}\n${name.toLowerCase()}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({ name, tier });
  }
  return out;
}

/**
 * Load the credits from `url`. Resolves to [] on any failure (offline, 404, bad JSON, aborted),
 * so callers never see a rejected promise.
 */
export async function loadCredits(url, { fetchImpl = globalThis.fetch, signal } = {}) {
  try {
    const res = await fetchImpl(url, { cache: 'no-cache', signal });
    if (!res?.ok) return [];
    return normalizeCredits(await res.json());
  } catch {
    return [];
  }
}
