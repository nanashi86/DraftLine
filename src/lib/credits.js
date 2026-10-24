// About → Credits, read from public/credits.json so backers are added by editing that file alone:
//
//   {
//     "catalyst": ["First Supporter Name"],                         ← THE CATALYST: the very first backer
//     "executiveProducers": ["Jane Doe"],                           ← EXECUTIVE PRODUCERS ($25 tier)
//     "screeningRoom": ["John Roe", { "name": "Ann Lee" }]          ← THE SCREENING ROOM ($3 and $10 tiers)
//   }
//
// Each list takes plain names or { "name": "..." } objects, shown in the order given. Blank, duplicate,
// over-long or malformed entries are dropped. An older file with a single "producers" list is read as
// executiveProducers. The service worker fetches this file network first (src/pwa/sw.template.js), so a
// deployed edit shows on the next open of About while online; offline, the last copy seen is used.

export const CREDIT_SECTIONS = ['catalyst', 'executiveProducers', 'screeningRoom'];
const MAX_NAME = 80;
const MAX_ENTRIES = 1000;

const empty = () => ({ catalyst: [], executiveProducers: [], screeningRoom: [] });

function names(list) {
  if (!Array.isArray(list)) return [];
  const out = [];
  const seen = new Set();
  for (const entry of list.slice(0, MAX_ENTRIES)) {
    const raw = typeof entry === 'string' ? entry : entry?.name;
    if (typeof raw !== 'string') continue;
    const name = raw.replace(/\s+/g, ' ').trim().slice(0, MAX_NAME);
    if (!name || seen.has(name.toLowerCase())) continue;
    seen.add(name.toLowerCase());
    out.push(name);
  }
  return out;
}

/** credits.json (already parsed) → { catalyst, executiveProducers, screeningRoom } of names. Never throws. */
export function normalizeCredits(json) {
  if (!json || typeof json !== 'object') return empty();
  return {
    catalyst: names(json.catalyst),
    executiveProducers: names(json.executiveProducers ?? json.producers),
    screeningRoom: names(json.screeningRoom),
  };
}

/** True when no section has anyone in it. */
export const hasNoCredits = (c) => CREDIT_SECTIONS.every((k) => !c[k].length);

/**
 * Load the credits from `url`. Resolves to empty sections on any failure (offline, 404, bad JSON,
 * aborted), so callers never see a rejected promise.
 */
export async function loadCredits(url, { fetchImpl = globalThis.fetch, signal } = {}) {
  try {
    const res = await fetchImpl(url, { cache: 'no-cache', signal });
    if (!res?.ok) return empty();
    return normalizeCredits(await res.json());
  } catch {
    return empty();
  }
}
