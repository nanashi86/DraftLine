// Forward compatibility: keep project data this build doesn't know about.
//
// A newer DraftLine may add fields to a project (a schedule, a budget, locked pages…). An older copy
// that opens and saves the project must not delete them. These helpers carry such fields through
// untouched, under three rules:
//   • Fields this build knows are always rebuilt by its own code; an unknown field can never
//     replace or shadow one of them.
//   • Only plain JSON data is carried (strings, finite numbers, booleans, null, arrays, plain
//     objects), deep-copied. Functions, class instances, cycles and absurdly deep nesting are dropped.
//   • Keys that could reach an object's prototype (__proto__, constructor, prototype) are never copied.
// docs/specs/data-integrity.md has the full design.

const BLOCKED_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_DEPTH = 64;

const isPlainObject = (v) => {
  if (!v || typeof v !== 'object' || Array.isArray(v)) return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
};

/** A deep copy of `value` if it's plain JSON data, otherwise undefined. */
export function jsonCopy(value, depth = 0, seen = new Set()) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : undefined;
  if (typeof value !== 'object' || depth > MAX_DEPTH || seen.has(value)) return undefined;
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      const out = [];
      for (const item of value) {
        const c = jsonCopy(item, depth + 1, seen);
        out.push(c === undefined ? null : c); // JSON.stringify's own rule for arrays
      }
      return out;
    }
    if (!isPlainObject(value)) return undefined;
    const out = {};
    for (const [k, v] of Object.entries(value)) {
      if (BLOCKED_KEYS.has(k)) continue;
      const c = jsonCopy(v, depth + 1, seen);
      if (c !== undefined) out[k] = c;
    }
    return out;
  } finally {
    seen.delete(value);
  }
}

/** The fields of `obj` whose names aren't in `known`, as plain JSON copies ({} when none). */
export function unknownFields(obj, known) {
  const out = {};
  if (!isPlainObject(obj)) return out;
  for (const [k, v] of Object.entries(obj)) {
    if (known.has(k) || BLOCKED_KEYS.has(k)) continue;
    const c = jsonCopy(v);
    if (c !== undefined) out[k] = c;
  }
  return out;
}

/**
 * Put `extra`'s fields onto `target` (mutating it) where the name is unknown and `target` doesn't
 * already have it. Returns `target`.
 */
export function addUnknownFields(target, extra, known) {
  if (!isPlainObject(extra)) return target;
  for (const [k, v] of Object.entries(extra)) {
    if (known.has(k) || BLOCKED_KEYS.has(k) || Object.prototype.hasOwnProperty.call(target, k)) continue;
    const c = jsonCopy(v);
    if (c !== undefined) target[k] = c;
  }
  return target;
}

export const hasUnknownFields = (extra) => isPlainObject(extra) && Object.keys(extra).length > 0;
