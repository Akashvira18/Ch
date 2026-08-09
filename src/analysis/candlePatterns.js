/**
 * candlePatterns.js
 *
 * Detects single/two-candle patterns from the most recent candles. These are
 * intentionally treated as CONFIRMATION ONLY elsewhere in the engine
 * (scoring.js caps candle-pattern contribution at 5/100) - never a
 * standalone signal generator.
 */

function bodySize(c) {
  return Math.abs(c.close - c.open);
}
function range(c) {
  return c.high - c.low;
}
function upperWick(c) {
  return c.high - Math.max(c.open, c.close);
}
function lowerWick(c) {
  return Math.min(c.open, c.close) - c.low;
}
function isBullish(c) {
  return c.close > c.open;
}
function isBearish(c) {
  return c.close < c.open;
}

export function detectDoji(candle, threshold = 0.1) {
  const r = range(candle);
  if (r === 0) return false;
  return bodySize(candle) / r <= threshold;
}

export function detectHammer(candle) {
  const r = range(candle);
  if (r === 0) return false;
  const body = bodySize(candle);
  const lw = lowerWick(candle);
  const uw = upperWick(candle);
  return lw >= body * 2 && uw <= body * 0.5 && body / r <= 0.4;
}

export function detectShootingStar(candle) {
  const r = range(candle);
  if (r === 0) return false;
  const body = bodySize(candle);
  const lw = lowerWick(candle);
  const uw = upperWick(candle);
  return uw >= body * 2 && lw <= body * 0.5 && body / r <= 0.4;
}

export function detectPinBar(candle) {
  return detectHammer(candle) || detectShootingStar(candle);
}

export function detectStrongBullishCandle(candle) {
  const r = range(candle);
  if (r === 0) return false;
  return isBullish(candle) && bodySize(candle) / r >= 0.7;
}

export function detectStrongBearishCandle(candle) {
  const r = range(candle);
  if (r === 0) return false;
  return isBearish(candle) && bodySize(candle) / r >= 0.7;
}

export function detectInsideBar(candle, prevCandle) {
  if (!prevCandle) return false;
  return candle.high <= prevCandle.high && candle.low >= prevCandle.low;
}

export function detectBullishEngulfing(candle, prevCandle) {
  if (!prevCandle) return false;
  return (
    isBearish(prevCandle) &&
    isBullish(candle) &&
    candle.open <= prevCandle.close &&
    candle.close >= prevCandle.open
  );
}

export function detectBearishEngulfing(candle, prevCandle) {
  if (!prevCandle) return false;
  return (
    isBullish(prevCandle) &&
    isBearish(candle) &&
    candle.open >= prevCandle.close &&
    candle.close <= prevCandle.open
  );
}

/**
 * Runs the full pattern suite against the most recent candle (and its
 * predecessor, for two-candle patterns). Returns a flat list of pattern
 * names that fired, plus a signed bias (-1 bearish .. +1 bullish) summarizing
 * them for the scoring engine.
 */
export function detectCandlePatterns(candles) {
  if (candles.length === 0) return { patterns: [], bias: 0 };
  const candle = candles[candles.length - 1];
  const prev = candles.length > 1 ? candles[candles.length - 2] : null;

  const found = [];
  if (detectDoji(candle)) found.push({ name: "doji", bias: 0 });
  if (detectHammer(candle)) found.push({ name: "hammer", bias: 1 });
  if (detectShootingStar(candle)) found.push({ name: "shooting-star", bias: -1 });
  if (detectStrongBullishCandle(candle)) found.push({ name: "strong-bullish", bias: 1 });
  if (detectStrongBearishCandle(candle)) found.push({ name: "strong-bearish", bias: -1 });
  if (detectInsideBar(candle, prev)) found.push({ name: "inside-bar", bias: 0 });
  if (detectBullishEngulfing(candle, prev)) found.push({ name: "bullish-engulfing", bias: 1 });
  if (detectBearishEngulfing(candle, prev)) found.push({ name: "bearish-engulfing", bias: -1 });

  const bias = found.length === 0 ? 0 : found.reduce((s, p) => s + p.bias, 0) / found.length;
  return { patterns: found.map((p) => p.name), bias };
}
