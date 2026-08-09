/**
 * ema.js - Exponential Moving Average
 *
 * Standard EMA with seed = SMA of the first `period` values, which is the
 * conventional approach and avoids the first-value-equals-price distortion
 * you get from naively seeding with close[0].
 */

/**
 * Computes an EMA series for an array of numeric source values (e.g. closes).
 * @param {number[]} values
 * @param {number} period
 * @returns {(number|null)[]} same length as `values`; entries before the
 *   series has enough data are `null`.
 */
export function calculateEMA(values, period) {
  const out = new Array(values.length).fill(null);
  if (!Array.isArray(values) || values.length < period || period <= 0) return out;

  const k = 2 / (period + 1);
  const seed = values.slice(0, period).reduce((a, b) => a + b, 0) / period;
  out[period - 1] = seed;

  let prev = seed;
  for (let i = period; i < values.length; i++) {
    const value = values[i] * k + prev * (1 - k);
    out[i] = value;
    prev = value;
  }
  return out;
}

/** Incremental EMA update - used by the live loop to avoid recomputing the whole series. */
export function updateEMA(prevEma, newValue, period) {
  if (prevEma === null || prevEma === undefined) return newValue;
  const k = 2 / (period + 1);
  return newValue * k + prevEma * (1 - k);
}

/**
 * Convenience: computes the standard EMA set (9/21/50/200) for a candle array's closes.
 * @param {Array<{close:number}>} candles
 */
export function calculateStandardEMASet(candles) {
  const closes = candles.map((c) => c.close);
  return {
    ema9: calculateEMA(closes, 9),
    ema21: calculateEMA(closes, 21),
    ema50: calculateEMA(closes, 50),
    ema200: calculateEMA(closes, 200),
  };
}

export function lastValue(series) {
  if (!series || series.length === 0) return null;
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i] !== null) return series[i];
  }
  return null;
}
