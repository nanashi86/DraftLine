// Money for the Budget (lib/budget.js): one currency per project, amounts as whole numbers of its minor
// unit (cents, or yen, or fils), and quantities with up to two decimals stored as plain numbers.
//
// Arithmetic is exact: a line's amount is rate × quantities ÷ divisors worked out in BigInt and rounded
// once (half away from zero). BigInt never leaves this file's results: every amount handed back is an
// ordinary Number within Number.MAX_SAFE_INTEGER, or null when it would not be (`overflow`).

const CODE = /^[A-Z]{3}$/;
const known = (() => {
  try {
    return new Set(Intl.supportedValuesOf('currency'));
  } catch {
    return null; // an engine without the list: a well-formed code is accepted
  }
})();

/** An ISO 4217 currency code this browser knows ("USD", "JPY", "KWD"). */
export const isCurrency = (code) => typeof code === 'string' && CODE.test(code) && (!known || known.has(code));

const digitsCache = new Map();
/** Decimals of the currency's minor unit: USD 2, JPY 0, KWD 3 (null for an unknown code). */
export function currencyDigits(code) {
  if (!isCurrency(code)) return null;
  if (!digitsCache.has(code)) {
    let d;
    try {
      d = new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits;
    } catch {
      d = null;
    }
    digitsCache.set(code, d);
  }
  return digitsCache.get(code);
}

/** A stored amount: a whole number of minor units, 0 or more, within the safe range. */
export const isAmount = (v) => Number.isSafeInteger(v) && v >= 0;

/** The largest quantity or duration a line takes (a typo guard, far above any real production). */
export const MAX_QUANTITY = 1e9;
/** A stored quantity or duration: above 0, at most two decimals. */
export const isQuantity = (v) => typeof v === 'number' && Number.isFinite(v) && v > 0 && v <= MAX_QUANTITY
  && Math.abs(Math.round(v * 100) - v * 100) < 1e-6;
/** A quantity in hundredths, as a BigInt (isQuantity first). */
export const hundredths = (v) => BigInt(Math.round(v * 100));

/** A percentage in basis points (10 % = 1000): a whole number from 0 to 100 000 (1 000 %). */
export const isBasisPoints = (v) => Number.isInteger(v) && v >= 0 && v <= 100000;

/** n ÷ d rounded half away from zero (BigInt, d > 0). */
export function roundDiv(n, d) {
  const neg = n < 0n;
  const a = neg ? -n : n;
  const q = (a * 2n + d) / (2n * d);
  return neg ? -q : q;
}
const toSafe = (big) => (big <= BigInt(Number.MAX_SAFE_INTEGER) && big >= -BigInt(Number.MAX_SAFE_INTEGER) ? Number(big) : null);

/**
 * rate × (product of nums) ÷ (product of dens), rounded once → a safe Number of minor units, or null
 * when the result is out of range. nums / dens are BigInts (quantities in hundredths, with 100n
 * among the dens for each).
 */
export function amountOf(rate, nums = [], dens = []) {
  let n = BigInt(rate);
  let d = 1n;
  for (const x of nums) n *= x;
  for (const x of dens) d *= x;
  return toSafe(roundDiv(n, d));
}
/** amount × basis points, rounded once (contingency, a percentage fee). */
export const applyBasisPoints = (amount, bp) => toSafe(roundDiv(BigInt(amount) * BigInt(bp), 10000n));
/** A sum of safe amounts, or null when it isn't safe. */
export const sumAmounts = (list) => toSafe(list.reduce((s, v) => s + BigInt(v), 0n));

/**
 * Text typed as an amount ("1,250.50", "1250.5", "1 250") → { value } in minor units, or { error }:
 * 'invalid' (not a plain number), 'precision' (more decimals than the currency has: never rounded
 * silently), 'range'. `decimal` is the locale's decimal mark; the other mark and spaces are grouping.
 */
export function parseAmount(text, digits, { decimal = '.' } = {}) {
  if (!Number.isInteger(digits) || digits < 0) return { error: 'invalid' };
  const group = decimal === ',' ? /[.\s']/g : /[,\s']/g; // \s covers no-break and narrow spaces
  const s = String(text ?? '').trim().replace(group, '');
  const m = s.match(decimal === ',' ? /^(\d+)(?:,(\d*))?$/ : /^(\d+)(?:\.(\d*))?$/);
  if (!m) return { error: 'invalid' };
  const frac = (m[2] || '').replace(/0+$/, '');
  if (frac.length > digits) return { error: 'precision' };
  const big = BigInt(m[1]) * 10n ** BigInt(digits) + BigInt((frac || '0').padEnd(digits, '0') || '0');
  const value = toSafe(big);
  return value === null ? { error: 'range' } : { value };
}

/** Minor units → "$1,250.50" in the locale (or "1,250.50" with no currency set). */
export function formatMoney(amount, currency, locale) {
  const digits = currencyDigits(currency) ?? 2;
  const major = amount / 10 ** digits;
  try {
    return new Intl.NumberFormat(locale, currency && isCurrency(currency)
      ? { style: 'currency', currency, minimumFractionDigits: digits, maximumFractionDigits: digits }
      : { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(major);
  } catch {
    return major.toFixed(digits);
  }
}

/** Plain decimal text for a quantity in a basis ("1.5", "12"). */
export const quantityText = (v) => (Number.isInteger(v) ? String(v) : String(Math.round(v * 100) / 100));
