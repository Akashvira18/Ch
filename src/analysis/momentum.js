/**
 * momentum.js
 *
 * Combines price Rate-of-Change, a short EMA-of-ROC "price momentum" smoother,
 * and per-candle body/wick momentum into a single momentum read used by the
 * scoring engine.
 */
import { calculateEMA } from "./ema.js";

/** Rate of Change over `period` candles, expressed as a percentage. */
export function calculateROC(closes, period = 10) {
  const out = new Array(closes.length).fill(null);
  for (let i = period; i < closes.length; i++) {
    const past = closes[i - period];
    if (past === 0) continue;
    out[i] = ((closes[i] - past) / past) * 100;
  }
  return out;
}

/** Smooths ROC with a short EMA to reduce single-candle noise. */
export function calculatePriceMomentum(closes, rocPeriod = 10, smoothPeriod = 5) {
  const roc = calculateROC(closes, rocPeriod);
  const firstDefined = roc.findIndex((v) => v !== null);
  if (firstDefined === -1) return new Array(closes.length).fill(null);
  const slice = roc.slice(firstDefined);
  const smoothed = calculateEMA(slice, smoothPeriod);
  const out = new Array(closes.length).fill(null);
  for (let i = 0; i < smoothed.length; i++) out[firstDefined + i] = smoothed[i];
  return out;
}

/**
 * Per-candle momentum: body size relative to the candle's own range, signed
 * by direction. A strong bullish candle scores near +1, a strong bearish
 * candle near -1, a doji-like candle near 0.
 */
export function candleMomentum(candle) {
  const range = candle.high - candle.low;
  if (range <= 0) return 0;
  const body = candle.close - candle.open;
  return clampSigned(body / range);
}

/** Average candle momentum over the last N candles - a short-term thrust read. */
export function recentCandleMomentum(candles, lookback = 5) {
  const recent = candles.slice(Math.max(0, candles.length - lookback));
  if (recent.length === 0) return 0;
  const sum = recent.reduce((acc, c) => acc + candleMomentum(c), 0);
  return sum / recent.length;
}

/** Combines smoothed price momentum + recent candle thrust into a single -100..100 score. */
export function combinedMomentumScore(candles, priceMomentumSeries) {
  const idx = candles.length - 1;
  const pm = priceMomentumSeries[idx]; // percent ROC-based
  const cm = recentCandleMomentum(candles, 5); // -1..1

  const pmScore = pm === null ? 0 : clampSigned(pm / 5) * 60; // scale typical ROC% into +-60
  const cmScore = cm * 40; // candle thrust contributes up to +-40
  return clampSigned((pmScore + cmScore) / 100) * 100;
}

function clampSigned(v) {
  return Math.max(-1, Math.min(1, v));
}
