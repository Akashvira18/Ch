/**
 * breakout.js
 *
 * A breakout is never confirmed from a single tick. This module requires
 * several independent confirmations before upgrading POSSIBLE -> CONFIRMED,
 * and separately tracks FALSE breakouts (broke out, then failed to hold).
 */

/**
 * @param {Array} candles
 * @param {Object} context - precomputed results from other modules to avoid recompute
 * @param {Array} context.resistanceZones
 * @param {Object} context.trend
 * @param {number} context.momentumScore -100..100
 * @param {Object} context.volatility
 * @param {Object} options
 * @returns {{status: "none"|"possible"|"confirmed"|"false-breakout",
 *            level: number|null, confirmations: string[], distancePercent: number|null}}
 */
export function detectBreakout(candles, context, options = {}) {
  const {
    breakoutThresholdPercent = 0.05, // min distance beyond resistance, as % of price
    requireCandleClose = true,
    requireMomentumConfirmation = true,
    requireTrendConfirmation = true,
    lookbackForFalseBreakout = 5,
  } = options;

  const { resistanceZones = [], trend = {}, momentumScore = 0, volatility = {} } = context;
  if (candles.length < 3 || resistanceZones.length === 0) {
    return { status: "none", level: null, confirmations: [], distancePercent: null };
  }

  const last = candles[candles.length - 1];
  const nearestZone = resistanceZones
    .filter((z) => z.high <= last.close || z.high <= last.high)
    .sort((a, b) => b.high - a.high)[0];

  if (!nearestZone) {
    return { status: "none", level: null, confirmations: [], distancePercent: null };
  }

  const level = nearestZone.high;
  const confirmations = [];
  const distancePercent = ((last.close - level) / level) * 100;

  const priceCrossed = last.high > level;
  const candleClosedAbove = last.close > level;
  const distanceOk = distancePercent >= breakoutThresholdPercent;
  const momentumOk = momentumScore > 10;
  const trendOk = trend.trend === "up";
  const volatilityOk = volatility.level !== "low";

  if (priceCrossed) confirmations.push("Price crossed above resistance");
  if (candleClosedAbove) confirmations.push("Candle closed above resistance");
  if (distanceOk) confirmations.push(`Breakout distance ${distancePercent.toFixed(2)}% exceeds threshold`);
  if (momentumOk) confirmations.push("Momentum confirms breakout");
  if (trendOk) confirmations.push("Trend confirms breakout");
  if (volatilityOk) confirmations.push("Volatility supports move");

  if (!priceCrossed) {
    return { status: "none", level, confirmations: [], distancePercent };
  }

  // Was this a breakout on a previous candle that has now failed to hold? -> false breakout
  const recentCandles = candles.slice(-lookbackForFalseBreakout - 1, -1);
  const brokeOutRecently = recentCandles.some((c) => c.high > level);
  const nowBelowAgain = last.close < level;
  if (brokeOutRecently && nowBelowAgain) {
    return { status: "false-breakout", level, confirmations: ["Price returned below resistance after breaking out"], distancePercent };
  }

  const requiredChecks = [
    candleClosedAbove || !requireCandleClose,
    distanceOk,
    momentumOk || !requireMomentumConfirmation,
    trendOk || !requireTrendConfirmation,
    volatilityOk,
  ];
  const confirmedCount = requiredChecks.filter(Boolean).length;

  let status = "possible";
  if (confirmedCount === requiredChecks.length) status = "confirmed";

  return { status, level, confirmations, distancePercent };
}
