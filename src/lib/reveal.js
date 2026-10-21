// Bring an element into view and pulse it briefly so the eye finds it (Density jumps).

export const PULSE_CLASS = 'is-pulse';
export const PULSE_MS = 1400;

/**
 * Smoothly centre `el` in its scroller and give it a temporary pulse ring. Returns true if it
 * did. `schedule` is setTimeout (injectable for tests). Re-pulsing restarts the animation.
 */
export function revealAndPulse(el, { schedule = (fn, ms) => setTimeout(fn, ms), pulse = true } = {}) {
  if (!el) return false;
  el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  if (!pulse) return true;
  el.classList.remove(PULSE_CLASS);
  void el.offsetWidth; // restart the CSS animation when the same element pulses again
  el.classList.add(PULSE_CLASS);
  schedule(() => el.classList.remove(PULSE_CLASS), PULSE_MS);
  return true;
}
