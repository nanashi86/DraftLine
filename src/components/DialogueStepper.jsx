import StatusStepper from './StatusStepper.jsx';
import { MessageSquare } from 'lucide-react';
import { stepperPosition } from '../lib/dialogueFilter.js';

// A speech bubble from Lucide at the stepper weight (14px, stroke 1.75 ≈ 1px), the same line as Format,
// Density and Find beside it. (The Characters drawer's Dialogue tab keeps its own bubble, drawn to match
// the other drawer tab icons.)
const ICON = <MessageSquare size={14} strokeWidth={1.75} aria-hidden />;

/**
 * Status bar, while the Characters → Dialogue filter is on (StatusStepper's shared capsule):
 *
 *   [ 💬 MARIE · 3 of 12   ‹  › ] (✕)      💬 = Lucide MessageSquare
 *
 *   label  → a dropup list of every speech (Sc. · p. — "snippet"); a row jumps there
 *   ‹ ›    → previous / next speech, looping (also Alt+↑ / Alt+↓, and [ / ] outside the text)
 *   ✕      → clears the filter
 * `stops` come from dialogueStops(); `index` is the current one (-1 before the first step).
 */
export default function DialogueStepper({ name, stops, index, onStep, onGo, onClear }) {
  const total = stops.length;
  return (
    <StatusStepper
      tone="neutral"
      name={name}
      icon={ICON}
      label={<span className="stepper-name">{name}</span>}
      position={stepperPosition(index, total)}
      ariaLabel={`${name}’s dialogue`}
      title={`Every speech by ${name} — pick one to jump to it`}
      onStep={total ? onStep : undefined}
      stepNoun={`speech by ${name}`}
      onDismiss={onClear}
      dismissLabel="Clear the dialogue filter (Esc)"
      list={{
        heading: `${name} · ${total} ${total === 1 ? 'speech' : 'speeches'}`,
        ariaLabel: `${name}’s speeches`,
        items: stops.map((s) => ({ key: s.id, label: s.label })),
        current: index,
        onPick: onGo,
      }}
    />
  );
}
