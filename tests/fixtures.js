/**
 * fixtures.js - deterministic candle datasets used across the test suite.
 * No randomness: every test run produces identical inputs and therefore
 * identical, reproducible assertions.
 */

/** Builds a candle from simple numbers with an auto-incrementing timestamp. */
function candle(i, open, high, low, close, volume) {
  return { timestamp: 1700000000000 + i * 60000, open, high, low, close, volume };
}

/** 40 closes rising steadily - used for EMA/RSI/MACD/trend "clearly up" checks. */
export const risingCandles = Array.from({ length: 40 }, (_, i) => {
  const base = 100 + i * 0.8;
  return candle(i, base, base + 0.5, base - 0.3, base + 0.4, 1000 + i * 10);
});

/** 40 closes falling steadily - used for "clearly down" checks. */
export const fallingCandles = Array.from({ length: 40 }, (_, i) => {
  const base = 140 - i * 0.8;
  return candle(i, base, base + 0.3, base - 0.5, base - 0.4, 1000 + i * 10);
});

/** Flat/ranging closes with tiny noise - used for sideways/WAIT checks. */
export const rangingCandles = Array.from({ length: 40 }, (_, i) => {
  const wobble = Math.sin(i / 2) * 0.6;
  const base = 100 + wobble;
  return candle(i, base, base + 0.4, base - 0.4, base + (i % 2 === 0 ? 0.1 : -0.1), 900);
});

/**
 * A clean resistance test-and-breakout shape: price oscillates under 110
 * for a while (building a resistance cluster), then breaks and closes above
 * it with strong follow-through candles.
 */
export const breakoutCandles = [
  ...Array.from({ length: 20 }, (_, i) => {
    const base = 105 + Math.sin(i) * 1.2;
    const high = Math.min(109.8, base + 1.5);
    return candle(i, base, high, base - 1.0, base + 0.2, 1000);
  }),
  candle(20, 109.0, 111.5, 108.8, 111.2, 3200),
  candle(21, 111.2, 113.0, 110.9, 112.6, 2800),
  candle(22, 112.6, 114.1, 112.0, 113.8, 2600),
];

/** Equivalent shape for a support breakdown. */
export const breakdownCandles = [
  ...Array.from({ length: 20 }, (_, i) => {
    const base = 95 - Math.sin(i) * 1.2;
    const low = Math.max(90.2, base - 1.5);
    return candle(i, base, base + 1.0, low, base - 0.2, 1000);
  }),
  candle(20, 91.0, 91.2, 88.5, 88.8, 3300),
  candle(21, 88.8, 89.0, 87.4, 87.6, 2900),
  candle(22, 87.6, 87.9, 86.2, 86.5, 2700),
];

/** A breakout that immediately fails and closes back below resistance - "false breakout". */
export const falseBreakoutCandles = [
  ...Array.from({ length: 20 }, (_, i) => {
    const base = 105 + Math.sin(i) * 1.2;
    const high = Math.min(109.8, base + 1.5);
    return candle(i, base, high, base - 1.0, base + 0.2, 1000);
  }),
  candle(20, 109.0, 111.0, 108.8, 110.6, 2000), // pokes above, closes above
  candle(21, 110.6, 110.8, 106.5, 107.0, 2400), // fails, closes back below resistance
  candle(22, 107.0, 107.6, 105.8, 106.2, 1800),
];

export const invalidMixedCandles = [
  candle(0, 100, 101, 99, 100.5, 1000),
  { timestamp: NaN, open: 1, high: 2, low: 0, close: 1 }, // invalid timestamp
  { timestamp: 1700000060000, open: 100.5, high: 99, low: 98, close: 100 }, // high < low-ish inconsistency
  candle(1, 100.5, 101.5, 100, 101, 1100),
  candle(1, 999, 999, 999, 999, 1), // duplicate timestamp (same index -> same ts) should be dropped
  candle(2, 101, 102, 100.5, 101.8, 1200),
];
