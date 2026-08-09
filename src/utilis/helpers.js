/**
 * helpers.js
 * Small, dependency-free utility functions shared across the analysis engine,
 * chart renderer, and UI layer. Kept generic on purpose so this file has no
 * knowledge of "candles" or "signals" - just numbers and arrays.
 */

/** Round a number to a fixed number of decimals, returning a Number (not a string). */
export function roundTo(value, decimals = 4) {
  if (!Number.isFinite(value)) return value;
  const factor = 10 ** decimals;
  return Math.round((value + Number.EPSILON) * factor) / factor;
}

/** Clamp a number between min and max. */
export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

/** Simple mean of an array of numbers. Returns NaN for an empty array. */
export function mean(arr) {
  if (!arr || arr.length === 0) return NaN;
  let sum = 0;
  for (const v of arr) sum += v;
  return sum / arr.length;
}

/** Population standard deviation. */
export function stdDev(arr) {
  if (!arr || arr.length < 2) return 0;
  const m = mean(arr);
  const variance = mean(arr.map((v) => (v - m) ** 2));
  return Math.sqrt(variance);
}

/** Returns the last N items of an array (or the whole array if shorter). */
export function lastN(arr, n) {
  if (!arr) return [];
  return arr.slice(Math.max(0, arr.length - n));
}

/** Safe division that returns a fallback instead of NaN/Infinity. */
export function safeDivide(numerator, denominator, fallback = 0) {
  if (!Number.isFinite(denominator) || denominator === 0) return fallback;
  const result = numerator / denominator;
  return Number.isFinite(result) ? result : fallback;
}

/** Linear-interpolate a value from one range to another, clamped to the output range. */
export function mapRange(value, inMin, inMax, outMin, outMax) {
  if (inMax === inMin) return outMin;
  const t = clamp((value - inMin) / (inMax - inMin), 0, 1);
  return outMin + t * (outMax - outMin);
}

/** Generates a short unique-enough id for UI list keys / signal history rows. */
export function uid(prefix = "id") {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/** Debounce a function call - used for resize handlers / settings persistence. */
export function debounce(fn, waitMs = 150) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), waitMs);
  };
}

/** Formats a timestamp (ms epoch or ISO string) into a short local time label. */
export function formatTime(timestamp, includeDate = false) {
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return "--:--";
  const timeStr = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
  if (!includeDate) return timeStr;
  const dateStr = d.toLocaleDateString();
  return `${dateStr} ${timeStr}`;
}

/** Formats a price with a sensible number of decimals based on magnitude. */
export function formatPrice(price) {
  if (!Number.isFinite(price)) return "--";
  const decimals = price >= 1000 ? 2 : price >= 1 ? 4 : 6;
  return price.toFixed(decimals);
}

/** Deep-clone a plain JSON-serializable object/array (candles, settings). */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}
