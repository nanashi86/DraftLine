import { useEffect, useState } from 'react';

/**
 * A drawer's expanded (full workspace width) state — see lib/panelExpand.js.
 *  • Closing the drawer brings it back at side-panel width next time.
 *  • Going to the script (a Dialogue line's "Go ↗", or clicking into the page) collapses it, so
 *    the line you jumped to isn't hidden under the drawer.
 */
export function useExpandedPanel(open) {
  const [expanded, setExpanded] = useState(false);
  if (!open && expanded) setExpanded(false);

  useEffect(() => {
    if (!expanded) return undefined;
    const onFocus = (e) => {
      if (e.target?.closest?.('.sheet')) setExpanded(false);
    };
    document.addEventListener('focusin', onFocus);
    return () => document.removeEventListener('focusin', onFocus);
  }, [expanded]);

  return [expanded, setExpanded];
}
