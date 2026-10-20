// The writer's own name and contact block, pre-filled on every new script's title page.
//
// Saving the Title Page remembers its Author and Contact (localStorage) for the next new
// script; until then — or when what's remembered is empty — the built-in defaults apply.
// Only *new* projects and an empty title page are ever filled in: a script that already has
// an author or contact (typed, imported or opened from a file) is never touched.
//
// The contact block follows the author, so personal details never land on someone else's
// script: Eric Lemaire's contact is only ever filled in for an author that includes
// "eric lemaire"; a writer's own remembered contact only for that same remembered author;
// any other author starts with a blank contact.

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

/** True when `author` is Eric Lemaire ("Eric Lemaire", "eric lemaire jr.", "By Eric Lemaire" …). */
export const isEricLemaire = (author) => String(author ?? '').trim().toLowerCase().includes('eric lemaire');

const sameName = (a, b) => String(a ?? '').trim().toLowerCase() === String(b ?? '').trim().toLowerCase();

/**
 * The contact block to fill in for `author` ('' for none):
 *   • the contact the writer last saved, when `author` is the author saved with it;
 *   • otherwise Eric Lemaire's contact block, when `author` matches "eric lemaire";
 *   • otherwise blank.
 */
export function contactForAuthor(author, storage = browserStorage()) {
  if (!String(author ?? '').trim()) return '';
  const savedAuthor = read(storage, AUTHOR_KEY);
  const savedContact = read(storage, CONTACT_KEY);
  if (savedContact && savedAuthor && sameName(savedAuthor, author)) return savedContact;
  return isEricLemaire(author) ? DEFAULT_CONTACT : '';
}

/** { author, contact } for a new script: the author last saved (else Eric Lemaire) and their contact. */
export function authorDefaults(storage = browserStorage()) {
  const author = read(storage, AUTHOR_KEY) ?? DEFAULT_AUTHOR;
  return { author, contact: contactForAuthor(author, storage) };
}

/**
 * The Title Page form after the Author field changes. `contactAuto` is the contact the form last
 * filled in by itself (null if none); `contactTouched` is true once the writer has typed in or
 * cleared the contact themselves — from then on it's never changed for them.
 *   • A matching author fills an empty (or still auto-filled) contact.
 *   • Changing to a non-matching author clears a contact that was only auto-filled.
 * Returns { contact, contactAuto }.
 */
export function contactAfterAuthorChange({ author, contact = '', contactAuto = null, contactTouched = false }, storage = browserStorage()) {
  if (contactTouched) return { contact, contactAuto };
  const untouched = !contact.trim() || (contactAuto !== null && contact === contactAuto);
  if (!untouched) return { contact, contactAuto };
  const next = contactForAuthor(author, storage);
  if (next) return { contact: next, contactAuto: next };
  return contactAuto !== null && contact === contactAuto ? { contact: '', contactAuto: null } : { contact, contactAuto };
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
  const author = meta.author !== undefined ? meta.author : authorDefaults(storage).author;
  return {
    ...meta,
    author,
    contact: meta.contact !== undefined ? meta.contact : contactForAuthor(author, storage),
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
