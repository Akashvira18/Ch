/**
 * validation.js
 *
 * All candle data enters the analysis engine through this module first.
 * Responsibilities:
 *  - reject/repair malformed OHLCV rows
 *  - detect and drop duplicate timestamps
 *  - detect missing candles (gaps) without crashing the engine
 *  - guarantee that anything downstream only ever sees clean, ordered candles
 *
 * The engine must NEVER throw because of one bad candle - it should
 * skip/flag it and keep going.
 */

/**
 * @typedef {Object} Candle
 * @property {number} timestamp - epoch ms (or any monotonically increasing number)
 * @property {number} open
 * @property {number} high
 * @property {number} low
 * @property {number} close
 * @property {number|null} [volume] - optional, may be null/undefined
 */

/** Checks that a single raw candle has the right shape and finite OHLC values. */
export function isValidCandleShape(candle) {
  if (!candle || typeof candle !== "object") return false;
  const { timestamp, open, high, low, close } = candle;
  const nums = [timestamp, open, high, low, close];
  if (!nums.every((v) => typeof v === "number" && Number.isFinite(v))) return false;
  if (open <= 0 || high <= 0 || low <= 0 || close <= 0) return false;
  // High/low must actually bound the open/close (allow tiny float slop)
  const eps = Math.max(1e-8, Math.abs(high) * 1e-9);
  if (high + eps < Math.max(open, close, low)) return false;
  if (low - eps > Math.min(open, close, high)) return false;
  if (high + eps < low) return false;
  return true;
}

/**
 * Cleans a raw array of candle-like objects into a sanitized, sorted,
 * de-duplicated candle array. Returns both the clean data and a report of
 * what was dropped/fixed so the UI can surface it instead of failing silently.
 *
 * @param {Array<Object>} rawCandles
 * @returns {{candles: Candle[], report: {droppedInvalid: number, droppedDuplicates: number, gapsDetected: number, sanitizedVolume: number}}}
 */
export function sanitizeCandles(rawCandles) {
  const report = { droppedInvalid: 0, droppedDuplicates: 0, gapsDetected: 0, sanitizedVolume: 0 };
  if (!Array.isArray(rawCandles)) {
    return { candles: [], report };
  }

  // Coerce numeric-ish strings (common with CSV input) then validate.
  const coerced = rawCandles
    .map((raw) => {
      if (!raw || typeof raw !== "object") return null;
      const candle = {
        timestamp: toNumber(raw.timestamp ?? raw.time ?? raw.date),
        open: toNumber(raw.open ?? raw.o),
        high: toNumber(raw.high ?? raw.h),
        low: toNumber(raw.low ?? raw.l),
        close: toNumber(raw.close ?? raw.c),
        volume: raw.volume ?? raw.vol ?? raw.v,
      };
      if (candle.volume === undefined || candle.volume === null || candle.volume === "") {
        candle.volume = null;
      } else {
        const v = toNumber(candle.volume);
        candle.volume = Number.isFinite(v) && v >= 0 ? v : null;
        if (candle.volume === null) report.sanitizedVolume++;
      }
      return candle;
    })
    .filter((c) => {
      const ok = c && isValidCandleShape(c);
      if (!ok) report.droppedInvalid++;
      return ok;
    });

  // Sort ascending by time, then drop duplicate timestamps (keep last seen).
  coerced.sort((a, b) => a.timestamp - b.timestamp);
  const byTimestamp = new Map();
  for (const c of coerced) {
    if (byTimestamp.has(c.timestamp)) report.droppedDuplicates++;
    byTimestamp.set(c.timestamp, c);
  }
  const candles = Array.from(byTimestamp.values());

  // Gap detection: look at the modal spacing between candles and flag outliers.
  if (candles.length > 3) {
    const diffs = [];
    for (let i = 1; i < candles.length; i++) diffs.push(candles[i].timestamp - candles[i - 1].timestamp);
    const modal = mode(diffs);
    if (modal > 0) {
      for (const d of diffs) {
        if (d > modal * 1.5) report.gapsDetected++;
      }
    }
  }

  return { candles, report };
}

/** Returns true if there are enough candles for a given lookback-based calculation. */
export function hasSufficientData(candles, minRequired) {
  return Array.isArray(candles) && candles.length >= minRequired;
}

/** Guards a numeric indicator value, converting NaN/Infinity into null so the UI can render "--". */
export function guardNumeric(value) {
  return Number.isFinite(value) ? value : null;
}

function toNumber(v) {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") {
    // Support ISO date strings for timestamp fields.
    const asFloat = parseFloat(v);
    if (Number.isFinite(asFloat) && String(asFloat).length >= v.trim().length - 2) return asFloat;
    const asDate = Date.parse(v);
    if (Number.isFinite(asDate)) return asDate;
    return NaN;
  }
  if (v instanceof Date) return v.getTime();
  return NaN;
}

function mode(arr) {
  const counts = new Map();
  let best = arr[0];
  let bestCount = 0;
  for (const v of arr) {
    const c = (counts.get(v) || 0) + 1;
    counts.set(v, c);
    if (c > bestCount) {
      bestCount = c;
      best = v;
    }
  }
  return best;
}
