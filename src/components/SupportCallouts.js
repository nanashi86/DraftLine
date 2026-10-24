// The two support callouts (lib/supportTips.js decides when they may appear):
//   ExportToast          — bottom-right, after an export: the status line, plus now and then the tip
//   DoctorSupportFooter  — one quiet line under a clean Format Doctor report
//
// Plain createElement so node:test can render them. Neither takes focus or listens for keys:
// the toast is a polite live region you can ignore, point at (it waits), or close.

import { createElement as h, useEffect, useRef, useState } from 'react';
import { Check, X } from 'lucide-react';
import { EXPORT_TOAST_MS, KO_FI_URL, PATREON_URL, autoDismiss } from '../lib/supportTips.js';

const link = (href, text) => h('a', { href, target: '_blank', rel: 'noopener noreferrer' }, text);

/**
 * "Script exported successfully (name.fdx)" — with, when `tip`, the support line and a
 * "Don't show again". Closes itself after `ms` (paused while pointed at or focused).
 * onClose({ mute }) — mute is true when you closed it with ✕ or Don't show again while the tip showed.
 */
export function ExportToast({ fileName, message = 'Script exported successfully', tip = false, onClose, ms = EXPORT_TOAST_MS }) {
  const [el, setEl] = useState(null); // the toast's element, once mounted
  const close = useRef(onClose);
  useEffect(() => { close.current = onClose; });
  // Closes itself after `ms`; waits while you point at it or tab into it.
  useEffect(() => {
    if (!el) return undefined;
    const timer = autoDismiss(() => close.current({ mute: false }), ms);
    const pause = () => timer.pause();
    const resume = () => timer.resume();
    const out = (e) => { if (!el.contains(e.relatedTarget)) timer.resume(); };
    el.addEventListener('mouseenter', pause);
    el.addEventListener('mouseleave', resume);
    el.addEventListener('focusin', pause);
    el.addEventListener('focusout', out);
    return () => {
      timer.cancel();
      el.removeEventListener('mouseenter', pause);
      el.removeEventListener('mouseleave', resume);
      el.removeEventListener('focusin', pause);
      el.removeEventListener('focusout', out);
    };
  }, [el, ms]);
  return h(
    'div',
    {
      ref: setEl,
      className: `export-toast${tip ? ' has-tip' : ''}`,
      role: 'status',
      'aria-live': 'polite',
    },
    h(
      'div',
      { className: 'et-line' },
      h(Check, { className: 'et-ok', size: 15, strokeWidth: 2, 'aria-hidden': true }),
      h('span', { className: 'et-msg' }, message, fileName ? h('span', { className: 'et-file' }, ` (${fileName})`) : null),
      h(
        'button',
        {
          type: 'button',
          className: 'et-close',
          'aria-label': tip ? 'Close, and don’t show the support note again' : 'Close',
          title: tip ? 'Close · the support note won’t show again' : 'Close',
          onClick: () => onClose({ mute: tip }),
        },
        h(X, { size: 14, strokeWidth: 2, 'aria-hidden': true }),
      ),
    ),
    tip && h(
      'p',
      { className: 'et-tip' },
      'DraftLine is free & offline. If it saved you time today, consider supporting on ',
      link(KO_FI_URL, 'Ko-fi'),
      ' or ',
      link(PATREON_URL, 'Patreon'),
      '.',
      h('button', { type: 'button', className: 'et-mute', onClick: () => onClose({ mute: true }) }, 'Don’t show again'),
    ),
  );
}

/** Under a clean Format Doctor report: "Independent & ad-free · Support on Ko-fi · Patreon · Dismiss". */
export function DoctorSupportFooter({ onDismiss }) {
  return h(
    'p',
    { className: 'fd-support' },
    'Independent & ad-free',
    h('span', { className: 'fd-support-sep', 'aria-hidden': 'true' }, ' · '),
    link(KO_FI_URL, 'Support on Ko-fi'),
    h('span', { className: 'fd-support-sep', 'aria-hidden': 'true' }, ' · '),
    link(PATREON_URL, 'Patreon'),
    h('span', { className: 'fd-support-sep', 'aria-hidden': 'true' }, ' · '),
    h('button', { type: 'button', className: 'fd-support-dismiss', onClick: onDismiss, title: 'Don’t show this again' }, 'Dismiss'),
  );
}
