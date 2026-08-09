/**
 * macd.js - Moving Average Convergence Divergence (12/26/9 default)
 */
import { calculateEMA } from "./ema.js";

/**
 * @param {number[]} closes
 * @param {number} fast default 12
 * @param {number} slow default 26
 * @param {number} signalPeriod default 9
 * @returns {{macd:(number|null)[], signal:(number|null)[], histogram:(number|null)[]}}
 */
export function calculateMACD(closes, fast = 12, slow = 26, signalPeriod = 9) {
  const emaFast = calculateEMA(closes, fast);
  const emaSlow = calculateEMA(closes, slow);

  const macdLine = closes.map((_, i) => {
    if (emaFast[i] === null || emaSlow[i] === null) return null;
    return emaFast[i] - emaSlow[i];
  });

  // Signal line is the EMA of the MACD line, but only over the defined portion.
  const firstDefined = macdLine.findIndex((v) => v !== null);
  const signal = new Array(closes.length).fill(null);
  if (firstDefined !== -1) {
    const macdSlice = macdLine.slice(firstDefined).map((v) => v);
    const signalSlice = calculateEMA(macdSlice, signalPeriod);
    for (let i = 0; i < signalSlice.length; i++) signal[firstDefined + i] = signalSlice[i];
  }

  const histogram = closes.map((_, i) => {
    if (macdLine[i] === null || signal[i] === null) return null;
    return macdLine[i] - signal[i];
  });

  return { macd: macdLine, signal, histogram };
}

/** Detects a bullish/bearish MACD crossover on the most recent two points. */
export function detectMACDCrossover(macd, signal) {
  const n = macd.length;
  if (n < 2) return "none";
  const m0 = macd[n - 2];
  const s0 = signal[n - 2];
  const m1 = macd[n - 1];
  const s1 = signal[n - 1];
  if (![m0, s0, m1, s1].every((v) => v !== null)) return "none";
  if (m0 <= s0 && m1 > s1) return "bullish-cross";
  if (m0 >= s0 && m1 < s1) return "bearish-cross";
  return "none";
}
