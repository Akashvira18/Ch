/**
 * simulatedAdapter.js
 *
 * Generates synthetic OHLCV candles using a bounded random walk with an
 * optional drift/regime schedule, so demos and tests can exercise trend,
 * range, breakout, and breakdown code paths deterministically (via a seeded
 * PRNG) without any network dependency.
 *
 * This is clearly a SIMULATION - never present simulated candles as real
 * market data in the UI (see js/app.js data-source labeling).
 */

/** Mulberry32 seeded PRNG - deterministic, dependency-free. */
function mulberry32(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * @param {Object} options
 * @param {number} [options.count=200] number of candles to generate
 * @param {number} [options.startPrice=100]
 * @param {number} [options.intervalMs=60000] candle spacing
 * @param {number} [options.volatility=0.4] percent volatility per candle
 * @param {"up"|"down"|"sideways"|"mixed"} [options.regime="mixed"]
 * @param {number} [options.seed=42] PRNG seed for reproducibility
 * @param {boolean} [options.includeVolume=true]
 * @returns {Array<Object>}
 */
export function generateSimulatedCandles(options = {}) {
  const {
    count = 200,
    startPrice = 100,
    intervalMs = 60000,
    volatility = 0.4,
    regime = "mixed",
    seed = 42,
    includeVolume = true,
  } = options;

  const rand = mulberry32(seed);
  const candles = [];
  let price = startPrice;
  const now = Date.now();
  const startTime = now - count * intervalMs;

  const segments = buildRegimeSegments(count, regime, rand);

  for (let i = 0; i < count; i++) {
    const drift = segments[i]; // -1, 0, or +1 style bias for this candle
    const changePercent = (rand() - 0.5) * volatility + drift * (volatility * 0.35);
    const open = price;
    const close = Math.max(0.0001, open * (1 + changePercent / 100));

    const wickRange = Math.abs(close - open) * (0.4 + rand() * 1.2) + open * (volatility / 400);
    const high = Math.max(open, close) + wickRange * rand();
    const low = Math.min(open, close) - wickRange * rand();

    const volume = includeVolume ? Math.round(500 + rand() * 4500) : null;

    candles.push({
      timestamp: startTime + i * intervalMs,
      open: round(open),
      high: round(high),
      low: round(Math.max(0.0001, low)),
      close: round(close),
      volume,
    });

    price = close;
  }

  return candles;
}

/** Builds a per-candle drift schedule so a "mixed" regime naturally contains
 * trending stretches, ranges, and at least one breakout-style thrust. */
function buildRegimeSegments(count, regime, rand) {
  if (regime === "up") return new Array(count).fill(1);
  if (regime === "down") return new Array(count).fill(-1);
  if (regime === "sideways") return new Array(count).fill(0);

  // "mixed": stitch together random segments with different drift.
  const segments = [];
  let remaining = count;
  const drifts = [1, -1, 0, 1, -1, 0];
  let d = 0;
  while (remaining > 0) {
    const len = Math.min(remaining, 15 + Math.floor(rand() * 30));
    const drift = drifts[d % drifts.length];
    for (let i = 0; i < len; i++) segments.push(drift);
    remaining -= len;
    d++;
  }
  return segments.slice(0, count);
}

function round(v) {
  return Math.round(v * 10000) / 10000;
}
