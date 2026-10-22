import { Stethoscope } from 'lucide-react';
import StatusStepper from './StatusStepper.jsx';
import { ISSUE_KINDS, canFix } from '../lib/formatDoctor.js';
import { stepperPosition } from '../lib/dialogueFilter.js';

const ICON = <Stethoscope size={14} strokeWidth={1.75} aria-hidden />;
const firstLine = (t) => (t.trim() ? t.trim().split('\n')[0] : '(empty line)');

/**
 * Status bar, while the Format Doctor has findings (StatusStepper's shared capsule):
 *
 *   [ 🩺 Format · 2 of 7   ‹  › ] (✕)
 *
 *   label → a dropup list of every finding (kind · page — the line) with Fix / Ignore on each, and
 *           "Open Format Doctor…" for Fix All
 *   ‹ ›   → previous / next finding, scrolled to and pulsed
 *   ✕     → hides the stepper until something new turns up
 */
export default function FormatStepper({ issues, index, pageOfBlock = {}, onStep, onGo, onFix, onIgnore, onOpenDoctor, onDismiss }) {
  const total = issues.length;
  return (
    <StatusStepper
      tone="neutral"
      name="format"
      icon={ICON}
      label="Format"
      position={stepperPosition(index, total)}
      ariaLabel="Format Doctor findings"
      title="Every Format Doctor finding — Fix or Ignore each one"
      onStep={total ? onStep : undefined}
      stepNoun="finding"
      onDismiss={onDismiss}
      dismissLabel="Hide the Format stepper"
      list={{
        heading: `Format Doctor · ${total} ${total === 1 ? 'finding' : 'findings'}`,
        ariaLabel: 'Format Doctor findings',
        current: index,
        onPick: onGo,
        items: issues.map((it) => ({
          key: `${it.id}:${it.kind}`,
          label: ISSUE_KINDS[it.kind].label,
          tag: `p. ${pageOfBlock[it.id] ?? '–'}`,
          sub: firstLine(it.text),
          mono: true,
          actions: [
            ...(canFix(it.kind) ? [{ label: 'Fix', primary: true, title: ISSUE_KINDS[it.kind].fix, onClick: () => onFix(it) }] : []),
            { label: 'Ignore', title: 'Hide this finding for this session', onClick: () => onIgnore(it) },
          ],
        })),
        footer: { label: 'Open Format Doctor…', onClick: onOpenDoctor },
      }}
    />
  );
}
