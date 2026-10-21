// Expand / collapse for the right-dock drawers (Story Bible, Characters): a toggle left of the
// close button widens the drawer over the whole workspace (the script stays where it is under
// it), with the content kept to a readable column. Esc collapses first, then closes; closing
// always brings the drawer back at its usual side-panel width next time.

/** Tooltip for the toggle in each state. */
export const expandTitle = (expanded) => (expanded ? 'Collapse to side panel' : 'Expand to full screen');

export const EXPAND_ARIA_LABEL = 'Toggle panel width';

/** What Esc does in an open drawer: collapse an expanded one, otherwise close it. */
export const escapeAction = (expanded) => (expanded ? 'collapse' : 'close');

/** Widest the content column gets when expanded (px), so lines stay readable. */
export const EXPANDED_READING_WIDTH = 960;
