/**
 * breakdown.js
 *
 * Mirror of breakout.js for the downside: price breaking below a support
 * zone. Requires multiple confirmations before CONFIRMED, and separately
 * flags FALSE breakdowns where price reclaims support after breaking it.
 */

/**
 * @param {Array} candles
 * @param {Object} context
 * @param {Array} context.supportZones
 * @param {Object} context.trend
 * @param {number} context.momentumScore -100..100
 * @param {Object} context.volatility
 * @param {string} context.structure
 * @param {Object} options
 */
export function detectBreakdown(candles, context, options = {}) {
  const {
    breakdownThresholdPercent = 0.05,
    requireCandleClose = true,
    requireMomentumConfirmation = true,
    requireTrendConfirmation = true,
    requireStructureConfirmation = true,
    lookbackForFalseBreakdown = 5,
  } = options;

  const { supportZones = [], trend = {}, momentumScore = 0, volatility = {}, structure = "" } = context;
  if (candles.length < 3 || supportZones.length === 0) {
    return { status: "none", level: null, confirmations: [], distancePercent: null };
  }

  const last = candles[candles.length - 1];
  const nearestZone = supportZones
    .filter((z) => z.low >= last.close || z.low >= last.low)
    .sort((a, b) => a.low - b.low)[0];

  if (!nearestZone) {
    return { status: "none", level: null, confirmations: [], distancePercent: null };
  }

  const level = nearestZone.low;
  const confirmations = [];
  const distancePercent = ((level - last.close) / level) * 100;

  const priceCrossed = last.low < level;
  const candleClosedBelow = last.close < level;
  const distanceOk = distancePercent >= breakdownThresholdPercent;
  const momentumOk = momentumScore < -10;
  const trendOk = trend.trend === "down";
  const structureOk = structure === "bearish" || structure === "transition";

  if (priceCrossed) confirmations.push("Price crossed below support");
  if (candleClosedBelow) confirmations.push("Candle closed below support");
  if (distanceOk) confirmations.push(`Breakdown distance ${distancePercent.toFixed(2)}% exceeds threshold`);
  if (momentumOk) confirmations.push("Bearish momentum confirms");
  if (trendOk) confirmations.push("Trend confirms breakdown");
  if (structureOk) confirmations.push("Market structure confirms");

  if (!priceCrossed) {
    return { status: "none", level, confirmations: [], distancePercent };
  }

  const recentCandles = candles.slice(-lookbackForFalseBreakdown - 1, -1);
  const brokeDownRecently = recentCandles.some((c) => c.low < level);
  const nowAboveAgain = last.close > level;
  if (brokeDownRecently && nowAboveAgain) {
    return { status: "false-breakdown", level, confirmations: ["Price reclaimed support after breaking down"], distancePercent };
  }

  const requiredChecks = [
    candleClosedBelow || !requireCandleClose,
    distanceOk,
    momentumOk || !requireMomentumConfirmation,
    trendOk || !requireTrendConfirmation,
    structureOk || !requireStructureConfirmation,
  ];
  const confirmedCount = requiredChecks.filter(Boolean).length;

  let status = "possible";
  if (confirmedCount === requiredChecks.length) status = "confirmed";

  return { status, level, confirmations, distancePercent };
}

/** Determines whether price is currently "testing" a support zone (within a small tolerance, not yet broken). */
export function isTestingSupport(candle, supportZones, toleranceFraction = 0.001) {
  return supportZones.some((z) => {
    const tolerance = z.low * toleranceFraction;
    return candle.low <= z.high + tolerance && candle.low >= z.low - tolerance;
  });
}
