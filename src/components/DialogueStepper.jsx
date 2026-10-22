import StatusStepper from './StatusStepper.jsx';
import TabIcon from './TabIcon.jsx';
import { stepperPosition } from '../lib/dialogueFilter.js';

/**
 * Status bar, while the Characters → Dialogue filter is on (StatusStepper's shared capsule):
 *
 *   [ 💬 MARIE · 3 of 12   ‹  › ] (✕)      💬 = the Characters drawer's Dialogue tab icon
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
      icon={<TabIcon name="dialogue" />}
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
