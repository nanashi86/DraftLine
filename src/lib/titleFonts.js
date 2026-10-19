// Typography for the title on the Title Page only. The screenplay body always stays
// Courier Prime 12pt (10 pitch) — nothing here is ever applied to the editor or print body.
// Every family is a Google Font, loaded by the non-blocking "title fonts" stylesheet in
// index.html (a test checks that each one is there).
//
// `bold` is the weight used when Bold is on, or null for single-weight typefaces
// (Bold is disabled for those rather than letting the browser fake it).

export const TITLE_FONT_GROUPS = [
  'Classic screenplay',
  'Serif',
  'Sans',
  'Display',
  'Script & handwritten',
];

export const TITLE_FONTS = [
  // Classic screenplay
  { id: 'courier-prime', group: 0, label: 'Courier Prime', note: 'Industry standard', family: "'Courier Prime', 'Courier New', monospace", bold: 700, upper: true, tracking: 0 },
  { id: 'special-elite', group: 0, label: 'Special Elite', note: 'Gritty / vintage typewriter', family: "'Special Elite', 'Courier New', monospace", bold: null, upper: false, tracking: 0 },
  // Serif
  { id: 'cinzel', group: 1, label: 'Cinzel', note: 'Prestige / dramatic', family: "'Cinzel', serif", bold: 700, upper: true, tracking: 0.04 },
  { id: 'cinzel-decorative', group: 1, label: 'Cinzel Decorative', note: 'Artistic / ornate prestige', family: "'Cinzel Decorative', serif", bold: 700, upper: false, tracking: 0.02 },
  { id: 'playfair', group: 1, label: 'Playfair Display', note: 'Literary / classic', family: "'Playfair Display', serif", bold: 700, upper: false, tracking: 0 },
  { id: 'cormorant', group: 1, label: 'Cormorant Garamond', note: 'Refined / historical', family: "'Cormorant Garamond', serif", bold: 700, upper: false, tracking: 0.01 },
  { id: 'abril', group: 1, label: 'Abril Fatface', note: 'Loud / high-impact display', family: "'Abril Fatface', serif", bold: null, upper: false, tracking: 0.01 },
  { id: 'rye', group: 1, label: 'Rye', note: 'Vintage / retro Western', family: "'Rye', serif", bold: null, upper: false, tracking: 0.01 },
  // Sans
  { id: 'montserrat', group: 2, label: 'Montserrat', note: 'Clean / contemporary', family: "'Montserrat', sans-serif", bold: 800, upper: true, tracking: 0.12 },
  { id: 'roboto', group: 2, label: 'Roboto', note: 'Clean modern sans', family: "'Roboto', sans-serif", bold: 700, upper: false, tracking: 0 },
  { id: 'inter', group: 2, label: 'Inter', note: 'Business / corporate', family: "'Inter', sans-serif", bold: 800, upper: false, tracking: -0.01 },
  { id: 'zen-maru', group: 2, label: 'Zen Maru Gothic', note: 'Calm / rounded minimalist', family: "'Zen Maru Gothic', sans-serif", bold: 700, upper: false, tracking: 0.02 },
  { id: 'oswald', group: 2, label: 'Oswald', note: 'Heavy modern editorial', family: "'Oswald', sans-serif", bold: 700, upper: true, tracking: 0.04 },
  { id: 'bebas', group: 2, label: 'Bebas Neue', note: 'Punchy / thriller condensed', family: "'Bebas Neue', sans-serif", bold: null, upper: true, tracking: 0.03 },
  { id: 'google-sans', group: 2, label: 'Google Sans', note: 'Friendly geometric sans', family: "'Google Sans', 'Open Sans', system-ui, sans-serif", bold: 700, upper: false, tracking: 0 },
  { id: 'anta', group: 2, label: 'Anta', note: 'Angular techno sans', family: "'Anta', sans-serif", bold: null, upper: false, tracking: 0.02 },
  // Display
  { id: 'orbitron', group: 3, label: 'Orbitron', note: 'Futuristic / sci-fi', family: "'Orbitron', sans-serif", bold: 800, upper: true, tracking: 0.06 },
  { id: 'audiowide', group: 3, label: 'Audiowide', note: 'Techno / industrial', family: "'Audiowide', sans-serif", bold: null, upper: false, tracking: 0.03 },
  { id: 'amatic', group: 3, label: 'Amatic SC', note: 'Indie / quirky condensed', family: "'Amatic SC', sans-serif", bold: 700, upper: false, tracking: 0.04 },
  { id: 'asimovian', group: 3, label: 'Asimovian', note: 'Retro sci-fi display', family: "'Asimovian', sans-serif", bold: null, upper: false, tracking: 0.02 },
  { id: 'boldonse', group: 3, label: 'Boldonse', note: 'Ultra-bold, wide poster', family: "'Boldonse', sans-serif", bold: null, upper: false, tracking: 0 },
  { id: 'manufacturing-consent', group: 3, label: 'Manufacturing Consent', note: 'Blackletter / fraktur', family: "'Manufacturing Consent', serif", bold: null, upper: false, tracking: 0 },
  { id: 'anton-sc', group: 3, label: 'Anton SC', note: 'Tall condensed small caps', family: "'Anton SC', sans-serif", bold: null, upper: false, tracking: 0.03 },
  { id: 'danfo', group: 3, label: 'Danfo', note: 'Lagos bus-sign display', family: "'Danfo', serif", bold: null, upper: false, tracking: 0 },
  { id: 'sankofa', group: 3, label: 'Sankofa Display', note: 'Bold, patterned display', family: "'Sankofa Display', sans-serif", bold: null, upper: false, tracking: 0.02 },
  { id: 'matemasie', group: 3, label: 'Matemasie', note: 'Chunky rounded display', family: "'Matemasie', sans-serif", bold: null, upper: false, tracking: 0.01 },
  { id: 'tilt-neon', group: 3, label: 'Tilt Neon', note: 'Neon-tube sign', family: "'Tilt Neon', sans-serif", bold: null, upper: false, tracking: 0.02 },
  { id: 'doto', group: 3, label: 'Doto', note: 'Dot-matrix / LED', family: "'Doto', monospace", bold: 800, upper: true, tracking: 0.04 },
  { id: 'tiny5', group: 3, label: 'Tiny5', note: '8-bit pixel', family: "'Tiny5', sans-serif", bold: null, upper: false, tracking: 0.02 },
  // Script & handwritten
  { id: 'great-vibes', group: 4, label: 'Great Vibes', note: 'Elegant cursive', family: "'Great Vibes', cursive", bold: null, upper: false, tracking: 0 },
  { id: 'pacifico', group: 4, label: 'Pacifico', note: 'Vintage brush script', family: "'Pacifico', cursive", bold: null, upper: false, tracking: 0 },
  { id: 'caveat', group: 4, label: 'Caveat', note: 'Playful / warm handwriting', family: "'Caveat', cursive", bold: 700, upper: false, tracking: 0 },
  // Google Fonts names these two "Playwrite ZA" and "Playwrite US Modern".
  { id: 'playwrite-za', group: 4, label: 'Playwrite South Africa', note: 'School-style cursive', family: "'Playwrite ZA', cursive", bold: null, upper: false, tracking: 0 },
  { id: 'playwrite-us-modern', group: 4, label: 'Playwrite USA Modern', note: 'Modern school handwriting', family: "'Playwrite US Modern', cursive", bold: null, upper: false, tracking: 0 },
  { id: 'delicious-handrawn', group: 4, label: 'Delicious Handrawn', note: 'Casual marker hand', family: "'Delicious Handrawn', cursive", bold: null, upper: false, tracking: 0 },
  { id: 'mynerve', group: 4, label: 'Mynerve', note: 'Quick, slanted handwriting', family: "'Mynerve', cursive", bold: null, upper: false, tracking: 0 },
  { id: 'bonheur-royale', group: 4, label: 'Bonheur Royale', note: 'Formal flourished script', family: "'Bonheur Royale', cursive", bold: null, upper: false, tracking: 0 },
  { id: 'miss-fajardose', group: 4, label: 'Miss Fajardose', note: 'Delicate copperplate script', family: "'Miss Fajardose', cursive", bold: null, upper: false, tracking: 0 },
];

export const TITLE_SIZES = [
  { pt: 18, label: 'Small (18pt)' },
  { pt: 24, label: 'Medium (24pt)' },
  { pt: 32, label: 'Large (32pt)' },
  { pt: 40, label: 'Extra Large (40pt)' },
  { pt: 48, label: 'Poster / Heavy (48pt)' },
];

export const DEFAULT_TITLE_FONT = 'courier-prime';
export const DEFAULT_TITLE_SIZE = 32;
export const DEFAULT_TITLE_BOLD = true;
export const DEFAULT_CREDIT = 'Written by';
export const CREDIT_SUGGESTIONS = [
  'Written by',
  'Screenplay by',
  'Teleplay by',
  'Story by',
  'Speculative screenplay by',
  'Pilot written by',
];

export function titleFont(id) {
  return TITLE_FONTS.find((f) => f.id === id) || TITLE_FONTS[0];
}

/** Normalised title typography from script metadata (fills in defaults). */
export function titleTypography(meta = {}) {
  const font = titleFont(meta.titleFont);
  const size = TITLE_SIZES.some((s) => s.pt === Number(meta.titleSize)) ? Number(meta.titleSize) : DEFAULT_TITLE_SIZE;
  const boldRequested = meta.titleBold ?? DEFAULT_TITLE_BOLD;
  const weight = boldRequested && font.bold ? font.bold : 400;
  return { font, size, bold: weight > 400, weight };
}

/**
 * Inline style for the title. `scale` converts print points to the target unit
 * (1 → pt for print; 30/72 → px for the 30px-per-inch preview sheet).
 */
export function titleStyle(meta, scale = 1, unit = 'pt') {
  const { font, size, weight } = titleTypography(meta);
  return {
    fontFamily: font.family,
    fontSize: `${size * scale}${unit}`,
    lineHeight: 1.15,
    fontWeight: weight,
    letterSpacing: font.tracking ? `${font.tracking}em` : undefined,
    textTransform: font.upper ? 'uppercase' : 'none',
    textDecoration: font.id === 'courier-prime' ? 'underline' : 'none',
  };
}

// ---------------------------------------------------------------------------
// Draft version / date (bottom-right block of the title page)
// ---------------------------------------------------------------------------

export const DRAFT_VERSIONS = ['First Draft', 'Second Draft', 'Revised Draft', 'Final Draft', 'Shooting Draft'];

const VERSION_RE = /\b(?:draft|revision|revised|rewrite|polish)\b/i;
const MONTH_RE = /\b(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sep(?:t(?:ember)?)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\b\.?/i;
const NUMERIC_DATE_RE = /\b\d{1,2}[/.-]\d{1,2}[/.-]\d{2,4}\b|\b\d{4}-\d{2}-\d{2}\b/;

/** "Sixth & Final Draft", "Revised Pink Draft", "Production Revision" … */
export function looksLikeDraftVersion(text) {
  const t = (text || '').trim();
  return !!t && t.length <= 60 && VERSION_RE.test(t) && !/\bby\b/i.test(t);
}

/** "October 19, 2026", "19 Oct 2026", "10/19/26", "2026-10-19". Bare years and phone numbers don't count. */
export function looksLikeDate(text) {
  const t = (text || '').trim();
  return !!t && t.length <= 40 && (MONTH_RE.test(t) || NUMERIC_DATE_RE.test(t)) && !/@/.test(t);
}

/** Lines of the bottom-right draft block, version above date, blanks dropped. */
export function draftLines(meta = {}) {
  return [meta.draftVersion, meta.draftDate].map((v) => (v || '').trim()).filter(Boolean);
}

/**
 * Split a combined draft block (a Fountain "Draft date:" value, or FDX right-aligned
 * lines) back into { draftVersion, draftDate }.
 */
export function splitDraftInfo(text) {
  const lines = (text || '').split('\n').map((l) => l.trim()).filter(Boolean);
  const version = lines.filter((l) => looksLikeDraftVersion(l));
  const rest = lines.filter((l) => !looksLikeDraftVersion(l));
  return { draftVersion: version.join(' · '), draftDate: rest.join('\n') };
}
