// The title page's Author and Contact for new scripts.
//
// A new script starts with both empty. The Title Page form and the on-screen cover then show
// Chilli Palmer (a Get Shorty homage, with a 555 number) as faint placeholder text — never stored,
// never printed. Saving the Title Page remembers its Author and Contact (localStorage) and the next
// new script starts with those instead. A script that already has an author or contact (typed,
// imported or opened from a file) is never touched.
//
// The contact block follows the author, so personal details never land on someone else's script.
// Every change replaces the whole block — it is never spliced, merged line by line or appended to:
//   • author "Eric Lemaire" / "Eric Lemaire Jr." (exactly, any case) → ERIC_CONTACT;
//   • author cleared                                                 → '' (Chilli's placeholder shows);
//   • the writer's own remembered author                             → their remembered contact;
//   • any other author: a contact the form filled in itself is cleared; one the writer typed stays.

export const AUTHOR_KEY = 'draftline_user_author';
export const CONTACT_KEY = 'draftline_user_contact';

/** Placeholder text only (form fields and the on-screen cover): never stored in a script, never printed. */
export const AUTHOR_PLACEHOLDER = 'Chilli Palmer';
export const CHILLI_CONTACT = `Chilli Palmer\n555-012-3456\ngetshorty@palmerfilms.com`;
export const CONTACT_PLACEHOLDER = CHILLI_CONTACT;
export const ERIC_CONTACT = `Eric Lemaire\n339-545-0929 (Mobile)\n617-549-5955 (WhatsApp)\nelemaire86@gmail.com`;

const ERIC_NAMES = ['eric lemaire', 'eric lemaire jr.'];
const norm = (s) => String(s ?? '').trim().toLowerCase();
const sameName = (a, b) => norm(a) === norm(b);

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

/** True when `author` is exactly "Eric Lemaire" or "Eric Lemaire Jr." (any case, spaces around ignored). */
export const isEricLemaire = (author) => ERIC_NAMES.includes(norm(author));

/**
 * The contact block to fill in for `author` ('' for none):
 *   • the contact the writer last saved, when `author` is the author saved with it;
 *   • otherwise ERIC_CONTACT, for exactly "Eric Lemaire" / "Eric Lemaire Jr.";
 *   • otherwise blank.
 */
export function contactForAuthor(author, storage = browserStorage()) {
  if (!String(author ?? '').trim()) return '';
  const savedAuthor = read(storage, AUTHOR_KEY);
  const savedContact = read(storage, CONTACT_KEY);
  if (savedContact && savedAuthor && sameName(savedAuthor, author)) return savedContact;
  return isEricLemaire(author) ? ERIC_CONTACT : '';
}

/** { author, contact } for a new script: what the Title Page last saved, else both empty. */
export function authorDefaults(storage = browserStorage()) {
  const author = read(storage, AUTHOR_KEY) ?? '';
  return { author, contact: contactForAuthor(author, storage) };
}

/**
 * The Title Page form after the Author field changes → { contact, contactAuto }. `contactAuto` is
 * the contact the form last filled in by itself (null if none); `contactTouched` is true once the
 * writer has typed in or cleared the contact themselves. The contact is always replaced whole:
 *   • "Eric Lemaire" / "Eric Lemaire Jr."  → ERIC_CONTACT, whatever was there;
 *   • author cleared                       → '', whatever was there (the placeholder shows again);
 *   • another author: their remembered contact if the box holds nothing of the writer's; a contact
 *     the form filled in itself is cleared; anything the writer typed is left exactly as it is.
 */
export function contactAfterAuthorChange({ author, contact = '', contactAuto = null, contactTouched = false }, storage = browserStorage()) {
  const name = norm(author);
  if (ERIC_NAMES.includes(name)) return { contact: ERIC_CONTACT, contactAuto: ERIC_CONTACT };
  if (!name) return { contact: '', contactAuto: null };
  // Still exactly what the form put there (even if the writer typed in the box at some point): the
  // form's to replace. Anything else in the box is the writer's own and stays exactly as it is.
  const auto = contactAuto !== null && contact === contactAuto;
  if (!auto && (contactTouched || contact.trim())) return { contact, contactAuto };
  const next = contactForAuthor(author, storage);
  if (next) return { contact: next, contactAuto: next };
  return auto ? { contact: '', contactAuto: null } : { contact, contactAuto };
}

/** Remember the Title Page's author and contact for the next new script. Returns true if stored. */
export function rememberAuthorDefaults({ author, contact }, storage = browserStorage()) {
  try {
    if (!storage) return false;
    if (typeof author === 'string') storage.setItem(AUTHOR_KEY, author);
    if (typeof contact === 'string') storage.setItem(CONTACT_KEY, contact);
    return true;
  } catch {
    return false; // full or blocked storage: new scripts simply start empty
  }
}

/**
 * Title page metadata for a brand-new script (merge over EMPTY_META). Anything in `meta` wins — including an explicit
 * empty author or contact — so the remembered values only fill fields the caller didn't set.
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
 * nor a contact yet, the remembered ones are suggested (kept only if the writer saves). Nothing
 * remembered: both stay empty and the placeholders show. Anything already there is left as is.
 */
export function titlePageSeed(meta = {}, storage = browserStorage()) {
  const blank = !meta.author?.trim() && !meta.contact?.trim();
  if (!blank) return { meta, suggested: false };
  const d = authorDefaults(storage);
  if (!d.author && !d.contact) return { meta, suggested: false };
  return { meta: { ...meta, ...d }, suggested: true };
}
