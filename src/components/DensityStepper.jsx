import { TriangleAlert } from 'lucide-react';
import StatusStepper from './StatusStepper.jsx';
import { densityLabel, densityTitle, riskPosition } from '../lib/pacing.js';

const DENSITY_ICON = <TriangleAlert size={14} strokeWidth={1.75} aria-hidden />;

/**
 * Status bar density control — the same compact capsule as the Format and Dialogue steppers
 * (StatusStepper, amber):
 *   Optimal   → muted text "Density · Optimal".
 *   Risks     → [ ⚠ Density · – of 9   ‹  › ]: ‹ › turn the highlights on and step (looping); the
 *               label opens the list of every risk by scene and page (picking one jumps there).
 *   Stepping  → [ ⚠ Density · 3 of 9   ‹  › ] (✕): ✕ turns the highlights off again.
 */
export default function DensityStepper({ density, on, index, locations, onStep, onGo, onOff }) {
  if (!density.dense) {
    return <span className="status-density" title={densityTitle(density)}>{densityLabel(density)}</span>;
  }
  return (
    <StatusStepper
      tone="amber"
      name="density"
      icon={DENSITY_ICON}
      label="Density"
      position={riskPosition(density, on ? index : -1)}
      ariaLabel="Density: skim risks"
      title={`${densityTitle(density)} Click Density to list them all; ‹ › step through them.`}
      onStep={onStep}
      stepNoun="skim risk"
      onDismiss={on ? onOff : undefined}
      dismissLabel="Hide the density highlights"
      list={{
        heading: `${density.dense} skim ${density.dense === 1 ? 'risk' : 'risks'} · ${density.percent}% of action`,
        ariaLabel: 'Skim risks',
        items: locations.map((l) => ({ key: l.id, label: l.label, sub: `${l.lines} lines` })),
        current: on ? index : -1,
        onPick: onGo,
      }}
    />
  );
}
