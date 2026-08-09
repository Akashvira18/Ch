/**
 * atr.js - Average True Range (Wilder's smoothing), used for volatility and
 * for sizing breakout/breakdown confirmation thresholds.
 */

/**
 * @param {Array<{high:number, low:number, close:number}>} candles
 * @param {number} period default 14
 * @returns {(number|null)[]}
 */
export function calculateATR(candles, period = 14) {
  const out = new Array(candles.length).fill(null);
  if (candles.length < period + 1) return out;

  const trueRanges = new Array(candles.length).fill(null);
  for (let i = 1; i < candles.length; i++) {
    const c = candles[i];
    const prevClose = candles[i - 1].close;
    trueRanges[i] = Math.max(
      c.high - c.low,
      Math.abs(c.high - prevClose),
      Math.abs(c.low - prevClose)
    );
  }

  let sum = 0;
  for (let i = 1; i <= period; i++) sum += trueRanges[i];
  let atr = sum / period;
  out[period] = atr;

  for (let i = period + 1; i < candles.length; i++) {
    atr = (atr * (period - 1) + trueRanges[i]) / period;
    out[i] = atr;
  }
  return out;
}

/** Returns ATR as a percentage of price - useful for comparing volatility across symbols. */
export function atrPercent(atrValue, price) {
  if (!Number.isFinite(atrValue) || !Number.isFinite(price) || price === 0) return null;
  return (atrValue / price) * 100;
}
