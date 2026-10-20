// The writer's own name and contact block, pre-filled on every new script's title page.
//
// Saving the Title Page remembers its Author and Contact (localStorage) for the next new
// script; until then — or when what's remembered is empty — the built-in defaults apply.
// Only *new* projects and an empty title page are ever filled in: a script that already has
// an author or contact (typed, imported or opened from a file) is never touched.

export const AUTHOR_KEY = 'draftline_user_author';
export const CONTACT_KEY = 'draftline_user_contact';

export const DEFAULT_AUTHOR = 'Eric Lemaire';
export const DEFAULT_CONTACT = [
  'Eric Lemaire',
  '339-545-0929 (Mobile)',
  '617-549-5955 (WhatsApp)',
  'elemaire86@gmail.com',
].join('\n');

const browserStorage = () => {
  try {
    return globalThis.localStorage ?? null;
  } catch {
    return null; // blocked storage throws on access
  }
};

function read(storage, key) {
  try {
    const v = storage?.getItem(key);
    return typeof v === 'string' && v.trim() ? v : null;
  } catch {
    return null;
  }
}

/** { author, contact } for a new script: what the writer last saved, else the defaults. */
export function authorDefaults(storage = browserStorage()) {
  return {
    author: read(storage, AUTHOR_KEY) ?? DEFAULT_AUTHOR,
    contact: read(storage, CONTACT_KEY) ?? DEFAULT_CONTACT,
  };
}

/** Remember the Title Page's author and contact for the next new script. Returns true if stored. */
export function rememberAuthorDefaults({ author, contact }, storage = browserStorage()) {
  try {
    if (!storage) return false;
    if (typeof author === 'string') storage.setItem(AUTHOR_KEY, author);
    if (typeof contact === 'string') storage.setItem(CONTACT_KEY, contact);
    return true;
  } catch {
    return false; // full or blocked storage: the defaults still apply
  }
}

/**
 * Title page metadata for a brand-new script (merge over EMPTY_META). Anything in `meta` wins — including an explicit
 * empty author or contact — so the defaults only fill fields the caller didn't set.
 */
export function newProjectMeta(meta = {}, storage = browserStorage()) {
  const d = authorDefaults(storage);
  return {
    ...meta,
    author: meta.author !== undefined ? meta.author : d.author,
    contact: meta.contact !== undefined ? meta.contact : d.contact,
  };
}

/**
 * The title page form's starting values for an existing script: when it has neither an author
 * nor a contact yet, they're suggested from the defaults (kept only if the writer saves).
 * Any author or contact already there — even just one of the two — is left exactly as is.
 */
export function titlePageSeed(meta = {}, storage = browserStorage()) {
  const blank = !meta.author?.trim() && !meta.contact?.trim();
  if (!blank) return { meta, suggested: false };
  return { meta: { ...meta, ...authorDefaults(storage) }, suggested: true };
}
