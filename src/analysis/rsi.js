/**
 * rsi.js - Relative Strength Index (Wilder's smoothing method)
 */

/**
 * @param {number[]} closes
 * @param {number} period default 14
 * @returns {(number|null)[]}
 */
export function calculateRSI(closes, period = 14) {
  const out = new Array(closes.length).fill(null);
  if (!Array.isArray(closes) || closes.length < period + 1) return out;

  let gainSum = 0;
  let lossSum = 0;
  for (let i = 1; i <= period; i++) {
    const change = closes[i] - closes[i - 1];
    if (change >= 0) gainSum += change;
    else lossSum += -change;
  }
  let avgGain = gainSum / period;
  let avgLoss = lossSum / period;
  out[period] = rsiFromAverages(avgGain, avgLoss);

  for (let i = period + 1; i < closes.length; i++) {
    const change = closes[i] - closes[i - 1];
    const gain = change > 0 ? change : 0;
    const loss = change < 0 ? -change : 0;
    avgGain = (avgGain * (period - 1) + gain) / period;
    avgLoss = (avgLoss * (period - 1) + loss) / period;
    out[i] = rsiFromAverages(avgGain, avgLoss);
  }
  return out;
}

function rsiFromAverages(avgGain, avgLoss) {
  if (avgLoss === 0) return avgGain === 0 ? 50 : 100;
  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

/** Simple classification helper used by the scoring engine and UI labels. */
export function classifyRSI(rsiValue) {
  if (rsiValue === null || rsiValue === undefined) return "unknown";
  if (rsiValue >= 70) return "overbought";
  if (rsiValue <= 30) return "oversold";
  if (rsiValue > 50) return "bullish-bias";
  if (rsiValue < 50) return "bearish-bias";
  return "neutral";
}
