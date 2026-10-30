/**
 * Monochrome 14×14 stroke icons for the Story Bible and Characters tabs. They draw in
 * currentColor, so a tab's icon follows its text: muted when inactive, white when active.
 */
const PATHS = {
  // Bios: a user bust — head and shoulders
  bios: (
    <>
      <circle cx="7" cy="4.6" r="2.4" />
      <path d="M2.3 12.6c.5-2.5 2.4-3.9 4.7-3.9s4.2 1.4 4.7 3.9" />
    </>
  ),
  // Dialogue: a rounded speech bubble with a tail
  dialogue: (
    <path d="M3.4 2.4h7.2a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2H6.6l-2.9 2.2v-2.2h-.3a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2Z" />
  ),
  // DNA: an open book
  dna: (
    <>
      <path d="M7 3.6C5.8 2.7 4.1 2.3 1.6 2.4v8.4c2.5-.1 4.2.3 5.4 1.2 1.2-.9 2.9-1.3 5.4-1.2V2.4c-2.5-.1-4.2.3-5.4 1.2Z" />
      <path d="M7 3.6V12" />
    </>
  ),
  // Glossary: a closed reference book with lines of entries on its cover
  glossary: (
    <>
      <path d="M3 2.9a1.3 1.3 0 0 1 1.3-1.3H11v10.8H4.3A1.3 1.3 0 0 0 3 13.7Z" />
      <path d="M3 13.7a1.3 1.3 0 0 1 1.3-1.3H11" />
      <path d="M5.8 4.6h3M5.8 6.8h2.2" />
    </>
  ),
  // Notes: a sheet of paper with a folded corner
  notes: (
    <>
      <path d="M3.2 1.6h5l2.6 2.6v8.2H3.2Z" />
      <path d="M8.2 1.6v2.6h2.6" />
      <path d="M5 7.2h4M5 9.6h3" />
    </>
  ),
};

export default function TabIcon({ name }) {
  const shape = PATHS[name];
  if (!shape) return null;
  return (
    <svg
      className="tab-icon"
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      data-icon={name}
    >
      {shape}
    </svg>
  );
}
