// Table Read's settings, kept on this device only (localStorage "draftline:tableRead:v1").
//
// Why not in the project: a browser voice is a voice installed on this computer ("Microsoft Aria",
// "Samantha"…); the same choice means nothing on another computer or phone. So voice choices stay
// with the device, per project, and the project itself — the .draftline file, backups, snapshots,
// folder sync, Character Bios — never changes because of Table Read. On another device (or after
// restoring a backup) every character simply gets an automatic voice again.
//
//   { rate, readAction, readParens, onlineConsent,
//     projects: { [projectId]: { voices: { [CUE NAME | '__narrator__']: voiceURI }, at } } }
//
// onlineConsent: the writer's one-time answer before an online voice first speaks — 'online' (send the
// text to the voice provider) or 'device' (on-device voices only); absent until they answer. Per device.
//
// Every read and write is guarded: blocked storage (some private windows) just means nothing is
// remembered. At most MAX_PROJECTS projects are kept, the least recently used dropped first.

import { RATES } from './tableRead.js';

export const TABLE_READ_KEY = 'draftline:tableRead:v1';
export const MAX_PROJECTS = 100;
export const DEFAULT_PREFS = { rate: 1, readAction: true, readParens: false, onlineConsent: null };
export const CONSENTS = ['online', 'device'];

const store = () => {
  try {
    return globalThis.localStorage || null;
  } catch {
    return null;
  }
};

function readAll() {
  try {
    const raw = store()?.getItem(TABLE_READ_KEY);
    const v = raw ? JSON.parse(raw) : null;
    return v && typeof v === 'object' && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

function writeAll(v) {
  try {
    store()?.setItem(TABLE_READ_KEY, JSON.stringify(v));
    return true;
  } catch {
    return false;
  }
}

/** Speed and reading toggles (the same for every project on this device). */
export function loadPrefs() {
  const all = readAll();
  return {
    rate: RATES.includes(all.rate) ? all.rate : DEFAULT_PREFS.rate,
    readAction: typeof all.readAction === 'boolean' ? all.readAction : DEFAULT_PREFS.readAction,
    readParens: typeof all.readParens === 'boolean' ? all.readParens : DEFAULT_PREFS.readParens,
    onlineConsent: CONSENTS.includes(all.onlineConsent) ? all.onlineConsent : null,
  };
}

export function savePrefs(patch) {
  const all = readAll();
  const next = { ...all };
  if (RATES.includes(patch.rate)) next.rate = patch.rate;
  if (typeof patch.readAction === 'boolean') next.readAction = patch.readAction;
  if (typeof patch.readParens === 'boolean') next.readParens = patch.readParens;
  if (CONSENTS.includes(patch.onlineConsent)) next.onlineConsent = patch.onlineConsent;
  else if (patch.onlineConsent === null) delete next.onlineConsent; // ask again next time
  return writeAll(next);
}

const cleanVoices = (v) => {
  const out = {};
  if (v && typeof v === 'object') for (const [k, uri] of Object.entries(v)) if (k && typeof uri === 'string' && uri) out[k] = uri;
  return out;
};

/** This project's voice choices on this device: { [name | NARRATOR]: voiceURI }. */
export function loadVoices(projectId) {
  if (!projectId) return {};
  return cleanVoices(readAll().projects?.[projectId]?.voices);
}

/** Replace this project's voice choices (an empty map forgets the project). */
export function saveVoices(projectId, voices, now = Date.now()) {
  if (!projectId) return false;
  const all = readAll();
  const projects = { ...(all.projects && typeof all.projects === 'object' ? all.projects : {}) };
  const v = cleanVoices(voices);
  if (Object.keys(v).length) projects[projectId] = { voices: v, at: now };
  else delete projects[projectId];
  const ids = Object.keys(projects);
  if (ids.length > MAX_PROJECTS) {
    ids.sort((a, b) => (projects[b].at || 0) - (projects[a].at || 0)).slice(MAX_PROJECTS).forEach((id) => delete projects[id]);
  }
  return writeAll({ ...all, projects });
}

/** A character renamed everywhere (Characters → Rename): its voice choice follows the new name. */
export function renameVoice(projectId, oldName, newName) {
  const from = String(oldName || '').trim().toUpperCase();
  const to = String(newName || '').trim().toUpperCase();
  if (!projectId || !from || !to || from === to) return false;
  const v = loadVoices(projectId);
  if (!v[from]) return false;
  v[to] = v[from];
  delete v[from];
  return saveVoices(projectId, v);
}
