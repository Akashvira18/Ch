/**
 * volatility.js
 *
 * Classifies current volatility relative to its own recent history, so the
 * read is self-normalizing across different instruments/timeframes rather
 * than relying on a hard-coded absolute threshold.
 */
import { calculateATR } from "./atr.js";
import { mean, stdDev } from "../utils/helpers.js";

/**
 * @param {Array} candles
 * @param {number} atrPeriod
 * @param {number} lookback how many recent ATR values to compare against
 */
export function analyzeVolatility(candles, atrPeriod = 14, lookback = 30) {
  const atrSeries = calculateATR(candles, atrPeriod);
  const validAtr = atrSeries.filter((v) => v !== null);
  if (validAtr.length < 5) {
    return { level: "unknown", atr: null, atrZScore: null, rangeExpansion: null };
  }

  const currentAtr = validAtr[validAtr.length - 1];
  const history = validAtr.slice(Math.max(0, validAtr.length - lookback), validAtr.length - 1);
  const m = mean(history);
  const sd = stdDev(history);
  const zScore = sd > 0 ? (currentAtr - m) / sd : 0;

  let level = "normal";
  if (zScore >= 1.25) level = "high";
  else if (zScore <= -1.0) level = "low";

  // Range expansion: is the most recent candle's range bigger than the recent average range?
  const recentRanges = candles.slice(-lookback).map((c) => c.high - c.low);
  const avgRange = mean(recentRanges.slice(0, -1));
  const lastRange = recentRanges[recentRanges.length - 1];
  const rangeExpansion = avgRange > 0 ? lastRange / avgRange : 1;

  return {
    level, // "low" | "normal" | "high" | "unknown"
    atr: currentAtr,
    atrZScore: zScore,
    rangeExpansion, // >1 = expanding, <1 = contracting
  };
}

/** True when volatility is abnormally weak - used to veto breakout confirmations. */
export function isAbnormallyLowVolatility(volatilityResult) {
  return volatilityResult.level === "low";
}
