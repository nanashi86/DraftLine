import { Search } from 'lucide-react';
import StatusStepper from './StatusStepper.jsx';
import { ELEMENT_META } from '../lib/screenplay.js';
import { stepperPosition } from '../lib/dialogueFilter.js';

const ICON = <Search size={14} strokeWidth={1.75} aria-hidden />;
const LIST_MAX = 200;

/** A few words either side of a match, for the list. */
function snippet(text, start, end) {
  const a = Math.max(0, start - 24);
  const b = Math.min(text.length, end + 32);
  return `${a > 0 ? '…' : ''}${text.slice(a, b).replace(/\s+/g, ' ')}${b < text.length ? '…' : ''}`;
}

/**
 * Status bar, after the Find bar is closed with a search still on (StatusStepper's capsule):
 *
 *   [ ⌕ Find · 3 of 12   ‹  › ] (✕)
 *
 *   label → a dropup list of the matches (element · page — the words around it); Open Find… reopens the bar
 *   ‹ ›   → previous / next match, highlighted and scrolled to
 *   ✕     → ends the search (the highlights go)
 */
export default function FindStepper({ matches, index, blocksById, pageOfBlock = {}, query, onStep, onGo, onOpen, onDismiss }) {
  const total = matches.length;
  return (
    <StatusStepper
      tone="neutral"
      name={`find:${query}`}
      icon={ICON}
      label="Find"
      position={stepperPosition(index, total)}
      ariaLabel={`Matches for “${query}”`}
      title={`Every match for “${query}”`}
      onStep={total ? onStep : undefined}
      stepNoun="match"
      onDismiss={onDismiss}
      dismissLabel="End the search"
      list={{
        heading: `“${query}” · ${total} ${total === 1 ? 'match' : 'matches'}${total > LIST_MAX ? ` (first ${LIST_MAX} listed)` : ''}`,
        ariaLabel: `Matches for “${query}”`,
        current: index,
        onPick: onGo,
        items: matches.slice(0, LIST_MAX).map((m) => {
          const b = blocksById.get(m.id);
          return {
            key: `${m.id}:${m.start}`,
            label: ELEMENT_META[b?.type]?.label || 'Element',
            tag: `p. ${pageOfBlock[m.id] ?? '–'}`,
            sub: b ? snippet(b.text, m.start, m.end) : '',
            mono: true,
          };
        }),
        footer: { label: 'Open Find…', onClick: onOpen },
      }}
    />
  );
}
