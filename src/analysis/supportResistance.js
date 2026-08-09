/**
 * supportResistance.js
 *
 * Support/resistance is never presented as a single exact price. Swing highs
 * and lows within a lookback window are clustered by proximity (using an
 * ATR-scaled tolerance) into ZONES, weighted by how many times price
 * respected that area (touch count) and how recent those touches were.
 */
import { detectSwings } from "./marketStructure.js";
import { calculateATR } from "./atr.js";

/**
 * @param {Array} candles
 * @param {Object} options
 * @param {number} options.lookback how many recent candles to consider
 * @param {number} options.swingStrength fractal width for swing detection
 * @param {number} options.clusterToleranceATR cluster radius as a multiple of ATR
 * @param {number} options.maxZones cap on returned zones per side
 * @returns {{supportZones: Array, resistanceZones: Array}}
 */
export function calculateSupportResistance(candles, options = {}) {
  const {
    lookback = 120,
    swingStrength = 3,
    clusterToleranceATR = 0.35,
    maxZones = 3,
  } = options;

  const windowStart = Math.max(0, candles.length - lookback);
  const windowed = candles.slice(windowStart);
  if (windowed.length < swingStrength * 2 + 5) {
    return { supportZones: [], resistanceZones: [] };
  }

  const { swingHighs, swingLows } = detectSwings(windowed, swingStrength);
  const atrSeries = calculateATR(windowed, 14);
  const atr = lastDefined(atrSeries) || estimateRangeFallback(windowed);

  const tolerance = Math.max(atr * clusterToleranceATR, priceEpsilon(windowed));

  const resistanceZones = clusterIntoZones(
    swingHighs.map((s) => ({ price: s.price, index: s.index })),
    tolerance,
    windowed.length
  ).slice(0, maxZones);

  const supportZones = clusterIntoZones(
    swingLows.map((s) => ({ price: s.price, index: s.index })),
    tolerance,
    windowed.length
  ).slice(0, maxZones);

  return {
    supportZones: supportZones.sort((a, b) => b.strength - a.strength),
    resistanceZones: resistanceZones.sort((a, b) => b.strength - a.strength),
  };
}

/**
 * Greedy clustering: sort points, then group any point within `tolerance` of
 * the running cluster average. Each resulting zone stores min/max bounds,
 * touch count, and a recency-weighted strength score.
 */
function clusterIntoZones(points, tolerance, totalLength) {
  if (points.length === 0) return [];
  const sorted = [...points].sort((a, b) => a.price - b.price);

  const clusters = [];
  let current = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const point = sorted[i];
    const clusterAvg = current.reduce((s, p) => s + p.price, 0) / current.length;
    if (Math.abs(point.price - clusterAvg) <= tolerance) {
      current.push(point);
    } else {
      clusters.push(current);
      current = [point];
    }
  }
  clusters.push(current);

  return clusters.map((cluster) => {
    const prices = cluster.map((p) => p.price);
    const min = Math.min(...prices);
    const max = Math.max(...prices);
    const touches = cluster.length;
    // Recency weight: touches near the end of the window count more.
    const recencyWeight = cluster.reduce((s, p) => s + (p.index + 1) / totalLength, 0) / touches;
    const strength = Math.round(Math.min(100, touches * 25 * (0.5 + recencyWeight)));
    return {
      low: roundZone(min),
      high: roundZone(max),
      mid: roundZone((min + max) / 2),
      touches,
      strength, // 0-100, used for zone opacity + confirmation weighting
    };
  });
}

/** Finds the nearest resistance zone above the current price (or null). */
export function nearestResistanceAbove(price, resistanceZones) {
  const above = resistanceZones.filter((z) => z.low >= price);
  if (above.length === 0) return null;
  return above.reduce((closest, z) => (z.low < closest.low ? z : closest));
}

/** Finds the nearest support zone below the current price (or null). */
export function nearestSupportBelow(price, supportZones) {
  const below = supportZones.filter((z) => z.high <= price);
  if (below.length === 0) return null;
  return below.reduce((closest, z) => (z.high > closest.high ? z : closest));
}

function lastDefined(series) {
  for (let i = series.length - 1; i >= 0; i--) {
    if (series[i] !== null) return series[i];
  }
  return null;
}

function estimateRangeFallback(candles) {
  const ranges = candles.slice(-20).map((c) => c.high - c.low);
  return ranges.reduce((a, b) => a + b, 0) / Math.max(1, ranges.length);
}

function priceEpsilon(candles) {
  const avgPrice = candles.reduce((s, c) => s + c.close, 0) / candles.length;
  return avgPrice * 0.0005;
}

function roundZone(price) {
  const decimals = price >= 1000 ? 2 : price >= 1 ? 4 : 6;
  return Number(price.toFixed(decimals));
}
