/**
 * sma.js - Simple Moving Average
 */

/**
 * @param {number[]} values
 * @param {number} period
 * @returns {(number|null)[]}
 */
export function calculateSMA(values, period) {
  const out = new Array(values.length).fill(null);
  if (!Array.isArray(values) || values.length < period || period <= 0) return out;

  let windowSum = 0;
  for (let i = 0; i < values.length; i++) {
    windowSum += values[i];
    if (i >= period) windowSum -= values[i - period];
    if (i >= period - 1) out[i] = windowSum / period;
  }
  return out;
}

/**
 * Convenience: computes the standard SMA set (20/50/200) for a candle array's closes.
 * @param {Array<{close:number}>} candles
 */
export function calculateStandardSMASet(candles) {
  const closes = candles.map((c) => c.close);
  return {
    sma20: calculateSMA(closes, 20),
    sma50: calculateSMA(closes, 50),
    sma200: calculateSMA(closes, 200),
  };
}
