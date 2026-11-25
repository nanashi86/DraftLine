// What the Budget's interface needs around lib/budget.js and lib/money.js: words for the costing
// methods, the browser's number format, typed amounts and quantities, and a currency to suggest.
// No money is worked out here: every figure on screen comes from budgetModel (lib/budget.js).

import { MAX_QUANTITY, currencyDigits, formatMoney, isCurrency, parseAmount, quantityText } from './money.js';
import { METHODS } from './budget.js';

/** The seven costing methods, in the popover's order, with what the rate is "per". */
export const METHOD_CHOICES = [
  { id: 'flat', label: 'Flat fee', per: '' },
  { id: 'unit', label: 'Per unit', per: 'unit' },
  { id: 'day', label: 'Per day', per: 'day' },
  { id: 'unitDay', label: 'Per unit per day', per: 'unit/day' },
  { id: 'week', label: 'Per week', per: 'week' },
  { id: 'unitWeek', label: 'Per unit per week', per: 'unit/week' },
  { id: 'personDay', label: 'Per person-day', per: 'person-day' },
];
export const perLabel = (method) => METHOD_CHOICES.find((m) => m.id === method)?.per || '';

/** The browser's decimal mark ("." or ","). */
export function decimalMark(locale) {
  try {
    return new Intl.NumberFormat(locale).formatToParts(1.5).find((p) => p.type === 'decimal')?.value || '.';
  } catch {
    return '.';
  }
}

/**
 * A typed rate → { value } (minor units) or { error, message }. A currency sign may be typed or not;
 * more decimals than the currency has are refused, never rounded; an empty field is { empty: true }.
 */
export function parseRate(text, currency, locale) {
  const raw = String(text ?? '').trim();
  if (!raw) return { empty: true };
  const digits = currencyDigits(currency) ?? 2;
  if (/[-−]/.test(raw)) return { error: 'invalid', message: 'Use an amount of 0 or more' }; // never flipped to positive
  const cleaned = raw.replace(/^[^\d.,]+|[^\d.,]+$/g, '').trim(); // "$12.50", "12,50 €"
  const r = parseAmount(cleaned, digits, { decimal: decimalMark(locale) });
  if (r.error === 'precision') return { error: 'precision', message: digits ? `Use up to ${digits} decimal${digits === 1 ? '' : 's'}` : 'Use whole amounts in this currency' };
  if (r.error === 'range') return { error: 'range', message: 'That amount is too large' };
  if (r.error) return { error: 'invalid', message: 'Use a number, like 12.50' };
  return { value: r.value };
}

/** An amount as it sits in a field: the number only, in the browser's format ("1,250.50"). */
export function amountField(amount, currency, locale) {
  if (!Number.isSafeInteger(amount)) return '';
  const digits = currencyDigits(currency) ?? 2;
  try {
    return new Intl.NumberFormat(locale, { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(amount / 10 ** digits);
  } catch {
    return (amount / 10 ** digits).toFixed(digits);
  }
}

/** Money as text: "$1,250.50", or "—" for unknown (null). */
export const money = (amount, currency, locale) => (amount === null || amount === undefined ? '—' : formatMoney(amount, currency, locale));

/** A typed quantity or number of days → { value } (above 0, up to two decimals) or { error, message }. */
export function parseQuantity(text, locale) {
  const raw = String(text ?? '').trim();
  if (!raw) return { empty: true };
  const dec = decimalMark(locale);
  const s = raw.replace(dec === ',' ? /[.\s']/g : /[,\s']/g, '').replace(',', '.');
  if (!/^\d+(\.\d+)?$/.test(s)) return { error: 'invalid', message: 'Use a number, like 3 or 1.5' };
  const v = Number(s);
  if (!(v > 0)) return { error: 'invalid', message: 'Use a number above 0' };
  if (Math.abs(Math.round(v * 100) - v * 100) > 1e-6) return { error: 'precision', message: 'Use up to 2 decimals' };
  if (v > MAX_QUANTITY) return { error: 'range', message: 'That number is too large' };
  return { value: v };
}
/** A percentage typed ("10", "7.25") → basis points, or { error }. */
export function parsePercent(text, locale) {
  const raw = String(text ?? '').trim().replace(/%$/, '').trim();
  if (!raw) return { empty: true };
  const s = decimalMark(locale) === ',' ? raw.replace(',', '.') : raw;
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return { error: 'invalid', message: 'Use a percentage, like 10 or 7.5' };
  const bp = Math.round(Number(s) * 100);
  if (bp > 100000) return { error: 'range', message: 'Up to 1000%' };
  return { value: bp };
}
export const percentText = (bp) => `${Number.isInteger(bp / 100) ? bp / 100 : (bp / 100).toFixed(2).replace(/0$/, '')}%`;

/** The currency's name in the browser's language ("US Dollar"), or its code. */
export function currencyName(code, locale) {
  try {
    return new Intl.DisplayNames([locale || 'en'], { type: 'currency' }).of(code) || code;
  } catch {
    return code;
  }
}

// The currency most used in a region: only to suggest one; the writer always confirms it.
const EURO = 'AT BE CY DE EE ES FI FR GR HR IE IT LT LU LV MT NL PT SI SK';
const BY_REGION = {
  ...Object.fromEntries(EURO.split(' ').map((r) => [r, 'EUR'])),
  US: 'USD', CA: 'CAD', MX: 'MXN', BR: 'BRL', AR: 'ARS', CL: 'CLP', CO: 'COP', PE: 'PEN', GB: 'GBP', CH: 'CHF', NO: 'NOK',
  SE: 'SEK', DK: 'DKK', IS: 'ISK', PL: 'PLN', CZ: 'CZK', HU: 'HUF', RO: 'RON', BG: 'BGN', TR: 'TRY', UA: 'UAH', IL: 'ILS',
  AE: 'AED', SA: 'SAR', EG: 'EGP', MA: 'MAD', NG: 'NGN', GH: 'GHS', KE: 'KES', RW: 'RWF', UG: 'UGX', TZ: 'TZS', ZA: 'ZAR',
  ET: 'ETB', SN: 'XOF', CI: 'XOF', CM: 'XAF', IN: 'INR', PK: 'PKR', BD: 'BDT', LK: 'LKR', CN: 'CNY', HK: 'HKD', TW: 'TWD',
  JP: 'JPY', KR: 'KRW', SG: 'SGD', MY: 'MYR', TH: 'THB', VN: 'VND', ID: 'IDR', PH: 'PHP', AU: 'AUD', NZ: 'NZD', HT: 'HTG',
  DO: 'DOP', JM: 'JMD', TT: 'TTD', CU: 'CUP', PR: 'USD', KW: 'KWD', BH: 'BHD', JO: 'JOD', QA: 'QAR',
};
/** A currency to suggest from the browser's language and region ("en-RW" → RWF), or null. */
export function suggestCurrency(locale = globalThis.navigator?.language) {
  try {
    const region = new Intl.Locale(locale || 'en').maximize().region;
    const code = BY_REGION[region];
    return isCurrency(code) ? code : null;
  } catch {
    return null;
  }
}
/** Currencies to choose from: the suggestion and the most used first, then every other one, by name. */
export function currencyChoices(locale, suggested = null) {
  const first = [...new Set([suggested, 'USD', 'EUR', 'GBP', 'CAD', 'AUD', 'JPY'].filter(isCurrency))];
  let all;
  try {
    all = Intl.supportedValuesOf('currency');
  } catch {
    all = first;
  }
  const rest = all.filter((c) => !first.includes(c) && isCurrency(c))
    .map((c) => ({ c, n: currencyName(c, locale) })).sort((a, b) => a.n.localeCompare(b.n));
  return [...first.map((c) => ({ value: c, label: `${currencyName(c, locale)} (${c})` })), ...rest.map(({ c, n }) => ({ value: c, label: `${n} (${c})` }))];
}

/**
 * The full account of a row, for its popover (and the table's tooltip): the engine's own basis, then
 * every flag in words. Nothing here is worked out: it says what budgetModel found.
 */
export function flagWords(r) {
  const f = new Set(r.flags);
  const out = [];
  if (f.has('missingSource')) out.push('no longer in the project');
  if (r.review?.reason === 'merged') out.push(`merged from ${r.review.from?.name || 'another item'}: review`);
  if (r.review?.reason === 'renamed') out.push(`renamed from ${r.review.from?.name || 'another name'}: review`);
  if (r.review?.reason === 'deleted') out.push('deleted from Breakdowns: review');
  if (f.has('needsSchedule')) out.push('after scheduling');
  if (f.has('missingQty')) out.push('quantity to enter');
  if (f.has('missingDays')) out.push('days to enter');
  if (f.has('unscheduled') && !f.has('needsSchedule')) out.push('some scenes not scheduled');
  if (f.has('assumedQty')) out.push('a scene’s quantity not set (counted as 1)');
  if (f.has('notInScript')) out.push('in no scene now');
  if (f.has('invalid')) out.push('a stored value can’t be read');
  if (f.has('overflow')) out.push('too large to add up');
  return out;
}
export const basisDetail = (r) => [r.basis, ...flagWords(r)].filter(Boolean).join(' · ') || (r.method === 'flat' ? 'flat fee' : '');

const count = (n, word) => `${quantityText(n)} ${word}${n === 1 ? '' : 's'}`;

/**
 * The table's short Basis: what's counted, in a few words ("1 unit · reusable · quantity assumed",
 * "45 person-days", "Not scheduled"). Built only from the row's own figures and flags, and from how
 * its stored `line` is set (entered or derived); every warning keeps a word here, the long account
 * stays in the popover (basisDetail).
 */
export function basisShort(r, line) {
  const f = new Set(r.flags);
  const m = METHODS[r.method] || {};
  const lead = [];
  const what = [];
  const after = [];
  if (f.has('missingSource')) lead.push('no longer in the project');
  if (r.review) lead.push(`${r.review.reason}: review`);

  const enteredQty = line?.qty?.from === 'manual';
  const partly = f.has('unscheduled') && !f.has('needsSchedule');
  let notScheduled = false;
  if (r.method === 'flat') what.push('flat fee');
  else if (r.method === 'personDay' && !enteredQty) {
    if (r.personDays === 0 && partly) notScheduled = true;
    else if (r.personDays !== null && r.personDays !== undefined) what.push(count(r.personDays, 'person-day'));
  } else if (r.method === 'personDay') {
    if (r.qty !== null && r.days !== null) what.push(`${quantityText(r.qty)} people × ${count(r.days, 'day')}`);
  } else {
    if (m.qty && r.qty !== null) {
      if (enteredQty) what.push(`${count(r.qty, 'unit')} · entered`);
      else if (r.source?.kind === 'element') {
        if (r.qty > 0) what.push(`${count(r.qty, 'unit')} · ${r.usage === 'consume' ? 'used up' : 'reusable'}`);
        else if (!f.has('notInScript')) what.push('in no scene');
      } else what.push(count(r.qty, 'unit'));
    }
    if (m.days && r.days !== null) {
      if (r.days === 0 && partly) notScheduled = true;
      else if (r.days === 0) what.push('on no shooting day');
      else {
        const from = line?.days?.from || (r.source ? 'use' : 'shoot');
        const days = f.has('estimate') ? `est. ${count(r.days, 'day')}`
          : from === 'manual' ? `${count(r.days, 'day')} · entered`
            : from === 'span' ? `${count(r.days, 'day')} · first to last`
              : from === 'calendar' ? count(r.days, 'calendar day')
                : from === 'shoot' ? count(r.days, 'shooting day')
                  : count(r.days, r.source?.kind === 'cast' ? 'work day' : 'day');
        what.push(r.weeks !== null && r.weeks !== undefined ? `${days} → ${count(r.weeks, 'week')}` : days);
        if (line?.holds === 'paid' && /\bholds?\b/.test(r.basis)) after.push('incl. holds');
      }
    }
  }
  if (notScheduled) return [...lead, 'Not scheduled'].join(' · ');
  if (f.has('needsSchedule')) after.push('after scheduling');
  if (f.has('missingQty')) after.push('quantity to enter');
  if (f.has('missingDays')) after.push('days to enter');
  if (partly) after.push('partly scheduled');
  if (f.has('assumedQty')) after.push('quantity assumed');
  if (f.has('notInScript')) after.push('in no scene now');
  if (f.has('datesUncertain')) after.push('dates unclear');
  if (f.has('invalid')) after.push('a stored value can’t be read');
  if (f.has('overflow')) after.push('too large to add up');
  return [...lead, ...what, ...after].join(' · ');
}
