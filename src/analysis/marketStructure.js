/**
 * marketStructure.js
 *
 * Detects swing highs/lows using a fractal-style lookback (a candle is a
 * swing high if it's the highest of its `strength` neighbors on each side),
 * classifies the sequence of swings into Higher-High/Higher-Low/Lower-High/
 * Lower-Low, and rolls that up into an overall structure verdict.
 *
 * Deliberately requires multiple confirmed swings - a single candle is never
 * enough to call a trend.
 */

/**
 * @param {Array<{high:number, low:number, timestamp:number}>} candles
 * @param {number} strength how many candles on each side must be lower/higher (fractal width)
 * @returns {{swingHighs: Array, swingLows: Array}}
 */
export function detectSwings(candles, strength = 3) {
  const swingHighs = [];
  const swingLows = [];

  for (let i = strength; i < candles.length - strength; i++) {
    const window = candles.slice(i - strength, i + strength + 1);
    const candle = candles[i];

    const isHigh = window.every((c) => c.high <= candle.high) &&
      window.filter((c) => c.high === candle.high).length === 1;
    const isLow = window.every((c) => c.low >= candle.low) &&
      window.filter((c) => c.low === candle.low).length === 1;

    if (isHigh) swingHighs.push({ index: i, price: candle.high, timestamp: candle.timestamp });
    if (isLow) swingLows.push({ index: i, price: candle.low, timestamp: candle.timestamp });
  }

  return { swingHighs, swingLows };
}

/**
 * Labels each swing high/low relative to the previous swing of the same type
 * (Higher High, Lower High, Higher Low, Lower Low).
 */
export function classifySwingSequence(swingHighs, swingLows) {
  const labeledHighs = swingHighs.map((swing, i) => {
    if (i === 0) return { ...swing, label: "H" };
    return { ...swing, label: swing.price > swingHighs[i - 1].price ? "HH" : "LH" };
  });
  const labeledLows = swingLows.map((swing, i) => {
    if (i === 0) return { ...swing, label: "L" };
    return { ...swing, label: swing.price > swingLows[i - 1].price ? "HL" : "LL" };
  });
  return { labeledHighs, labeledLows };
}

/**
 * Rolls up the most recent labeled swings into an overall structure verdict.
 * Requires at least 2 highs and 2 lows to say anything other than "insufficient-data".
 *
 * @returns {{structure: "bullish"|"bearish"|"range"|"transition"|"insufficient-data",
 *            lastHighLabel: string|null, lastLowLabel: string|null,
 *            structureBreak: boolean}}
 */
export function evaluateMarketStructure(candles, options = {}) {
  const { swingStrength = 3, lookbackSwings = 4 } = options;
  const { swingHighs, swingLows } = detectSwings(candles, swingStrength);

  if (swingHighs.length < 2 || swingLows.length < 2) {
    return {
      structure: "insufficient-data",
      lastHighLabel: null,
      lastLowLabel: null,
      structureBreak: false,
      swingHighs,
      swingLows,
    };
  }

  const { labeledHighs, labeledLows } = classifySwingSequence(swingHighs, swingLows);
  const recentHighs = labeledHighs.slice(-lookbackSwings);
  const recentLows = labeledLows.slice(-lookbackSwings);

  const bullishHighs = recentHighs.filter((h) => h.label === "HH").length;
  const bearishHighs = recentHighs.filter((h) => h.label === "LH").length;
  const bullishLows = recentLows.filter((l) => l.label === "HL").length;
  const bearishLows = recentLows.filter((l) => l.label === "LL").length;

  const bullScore = bullishHighs + bullishLows;
  const bearScore = bearishHighs + bearishLows;

  const lastHighLabel = recentHighs[recentHighs.length - 1]?.label ?? null;
  const lastLowLabel = recentLows[recentLows.length - 1]?.label ?? null;

  let structure = "range";
  if (bullScore >= bearScore + 2) structure = "bullish";
  else if (bearScore >= bullScore + 2) structure = "bearish";
  else if (Math.abs(bullScore - bearScore) <= 1 && bullScore + bearScore >= 2) structure = "transition";

  // A structure break: last swing high breaks bearish pattern (HH after LHs) or
  // last swing low breaks bullish pattern (LL after HLs).
  const structureBreak =
    (lastHighLabel === "HH" && recentHighs.length > 1 && recentHighs[recentHighs.length - 2].label === "LH") ||
    (lastLowLabel === "LL" && recentLows.length > 1 && recentLows[recentLows.length - 2].label === "HL");

  return { structure, lastHighLabel, lastLowLabel, structureBreak, swingHighs, swingLows, labeledHighs, labeledLows };
}
