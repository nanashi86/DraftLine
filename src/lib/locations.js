// Filming locations (Stage 2, Phase 3A): the physical places a production shoots, kept apart from the
// script's places. A slugline says where the story happens ("HARBOR - DOCK"); a filming location is
// where the camera actually goes ("Port de Fécamp, quai 3"). Many scripted places can shoot at one
// location; a single scene can be assigned elsewhere. Nothing is ever made from a slugline: the writer
// adds a location and says which scripted places it covers.
//
// Stored at production.locations (productionData.js), losslessly: every field of a site, and a newer
// build's whole object (version above LOCATIONS_VERSION), is kept exactly as it was.
//
//   { version: 1,
//     sites:  { [siteId]: { id, name, address?, note? } },
//     places: { [PLACE]: siteId },     PLACE: basePlace() of a heading, "HARBOR"
//     scenes: { [sceneId]: siteId } }  a scene shot somewhere other than its place's site

import { jsonCopy } from './passThrough.js';
import { basePlace } from './schedule.js';

export const LOCATIONS_VERSION = 1;
const plain = (v) => !!v && typeof v === 'object' && !Array.isArray(v);
const cleanText = (v) => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '');
export const newSiteId = () => `loc-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;

/** Can this version read and change it? (Absent; or an object, not newer.) */
export const locationsReadable = (raw) => raw == null || (plain(raw) && !(Number.isInteger(raw.version) && raw.version > LOCATIONS_VERSION));

/** Stored → clean, or null when there's nothing. Lossless: unreadable entries are left as they are. */
export function normalizeLocations(raw) {
  if (raw == null) return null;
  const copy = jsonCopy(raw);
  if (copy === undefined) return null;
  if (!locationsReadable(copy)) return copy; // a newer build's (or a shape this one doesn't know): untouched
  // Exactly as stored: nothing added on reading (a site's id is its key; changes add what they need).
  const empty = (k) => copy[k] === undefined || (plain(copy[k]) && !Object.keys(copy[k]).length);
  const extra = Object.keys(copy).some((k) => !['version', 'sites', 'places', 'scenes'].includes(k));
  return empty('sites') && empty('places') && empty('scenes') && !extra ? null : copy;
}

const sitesOf = (loc) => (plain(loc?.sites) ? loc.sites : {});
const isSite = (loc, id) => typeof id === 'string' && plain(sitesOf(loc)[id]);
/** A site's name ('' when it has none). */
export const siteName = (loc, id) => cleanText(sitesOf(loc)[id]?.name);

/** The filming location a breakdown row shoots at: its own assignment, else its place's; null if none. */
export function siteOfRow(loc, row) {
  if (!loc || !locationsReadable(loc)) return null;
  const own = plain(loc.scenes) ? loc.scenes[row.id] : undefined;
  if (isSite(loc, own)) return own;
  const place = basePlace(row.location || row.heading);
  const viaPlace = plain(loc.places) ? loc.places[place] : undefined;
  return isSite(loc, viaPlace) ? viaPlace : null;
}

/**
 * Where each site is used, and which scripted places have no site yet:
 *   { sites: Map siteId → [sceneId…], unassigned: [{ place, sceneIds }] }  (rows: buildBreakdown's)
 */
export function siteUsage(loc, rows) {
  const sites = new Map();
  const open = new Map();
  for (const r of rows) {
    const id = siteOfRow(loc, r);
    if (id) {
      if (!sites.has(id)) sites.set(id, []);
      sites.get(id).push(r.id);
    } else {
      const place = basePlace(r.location || r.heading);
      if (!place) continue;
      if (!open.has(place)) open.set(place, []);
      open.get(place).push(r.id);
    }
  }
  return { sites, unassigned: [...open].map(([place, sceneIds]) => ({ place, sceneIds })) };
}

// ---- Changes (pure: production in, production out; lib/productionData.js applies them) ------------

/** The registry to change: a copy, created when absent. null when a newer build's (never changed). */
export function locationsDraft(production) {
  const cur = production?.locations;
  if (cur != null && !locationsReadable(cur)) return null;
  const d = jsonCopy(cur) || {};
  d.version = LOCATIONS_VERSION;
  for (const k of ['sites', 'places', 'scenes']) if (!plain(d[k])) d[k] = {};
  for (const [id, site] of Object.entries(d.sites)) if (plain(site)) site.id = id;
  return d;
}

/** Fields of a site from the writer: { name, address, note } (name required when adding). */
export function siteFields(fields = {}) {
  const out = {};
  for (const k of ['name', 'address', 'note']) {
    if (fields[k] === undefined) continue;
    const t = cleanText(fields[k]);
    if (k === 'name' && !t) return null;
    out[k] = t;
  }
  return out;
}

export { basePlace };
