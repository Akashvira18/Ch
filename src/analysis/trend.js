/**
 * trend.js
 *
 * Trend is deliberately derived from MULTIPLE candles worth of evidence:
 * EMA stacking/alignment + price position relative to EMA21 + market
 * structure agreement. A single candle can never flip this on its own.
 */
import { calculateStandardEMASet, lastValue } from "./ema.js";
import { evaluateMarketStructure } from "./marketStructure.js";

/**
 * @param {Array} candles
 * @param {Object} options
 * @returns {{
 *  trend: "up"|"down"|"sideways"|"insufficient-data",
 *  strength: number, // 0-100
 *  emaAlignment: "bullish"|"bearish"|"mixed",
 *  priceAboveEma21: boolean|null,
 *  structure: string
 * }}
 */
export function evaluateTrend(candles, options = {}) {
  if (candles.length < 25) {
    return {
      trend: "insufficient-data",
      strength: 0,
      emaAlignment: "mixed",
      priceAboveEma21: null,
      structure: "insufficient-data",
    };
  }

  const { ema9, ema21, ema50 } = calculateStandardEMASet(candles);
  const e9 = lastValue(ema9);
  const e21 = lastValue(ema21);
  const e50 = lastValue(ema50);
  const price = candles[candles.length - 1].close;

  let emaAlignment = "mixed";
  if (e9 !== null && e21 !== null) {
    if (e50 !== null) {
      if (e9 > e21 && e21 > e50) emaAlignment = "bullish";
      else if (e9 < e21 && e21 < e50) emaAlignment = "bearish";
    } else {
      if (e9 > e21) emaAlignment = "bullish";
      else if (e9 < e21) emaAlignment = "bearish";
    }
  }

  const priceAboveEma21 = e21 !== null ? price > e21 : null;
  const { structure } = evaluateMarketStructure(candles, options);

  // Combine EMA alignment + structure agreement into a 0-100 strength score.
  let strength = 0;
  if (emaAlignment === "bullish") strength += 40;
  if (emaAlignment === "bearish") strength += 40;
  if (priceAboveEma21 === true && emaAlignment === "bullish") strength += 20;
  if (priceAboveEma21 === false && emaAlignment === "bearish") strength += 20;
  if (structure === "bullish" && emaAlignment === "bullish") strength += 25;
  if (structure === "bearish" && emaAlignment === "bearish") strength += 25;
  if (structure === "range" || structure === "transition") strength = Math.min(strength, 45);

  let trend = "sideways";
  if (emaAlignment === "bullish" && (structure === "bullish" || structure === "transition")) trend = "up";
  else if (emaAlignment === "bearish" && (structure === "bearish" || structure === "transition")) trend = "down";
  else if (emaAlignment === "bullish" && priceAboveEma21) trend = "up";
  else if (emaAlignment === "bearish" && priceAboveEma21 === false) trend = "down";

  return {
    trend,
    strength: Math.max(0, Math.min(100, strength)),
    emaAlignment,
    priceAboveEma21,
    structure,
    ema: { ema9: e9, ema21: e21, ema50: e50 },
  };
}
