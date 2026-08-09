/**
 * manualInputAdapter.js
 *
 * Parses candle data a user pastes directly into a textarea. Accepts either
 * CSV-style lines (timestamp,open,high,low,close,volume) or whitespace/tab
 * separated values, one candle per line. Volume is optional on every line.
 */

/**
 * @param {string} text
 * @returns {Array<Object>} raw candle-like objects (not yet sanitized - pass
 *   through validation.sanitizeCandles before use)
 */
export function parseManualInput(text) {
  if (!text || typeof text !== "string") return [];

  const lines = text
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0 && !l.startsWith("#"));

  const candles = [];
  for (const line of lines) {
    // Skip an obvious header row.
    if (/timestamp/i.test(line) && /open/i.test(line)) continue;

    const parts = line.split(/[,\t;]+|\s{2,}|\s+(?=\S)/).filter((p) => p !== "");
    const cleaned = line.split(/[,\t;]+/).map((p) => p.trim()).filter((p) => p !== "");
    const fields = cleaned.length >= 5 ? cleaned : parts;

    if (fields.length < 5) continue;

    const [timestamp, open, high, low, close, volume] = fields;
    candles.push({
      timestamp: parseTimestampField(timestamp),
      open: Number(open),
      high: Number(high),
      low: Number(low),
      close: Number(close),
      volume: volume !== undefined && volume !== "" ? Number(volume) : null,
    });
  }
  return candles;
}

function parseTimestampField(value) {
  const asNumber = Number(value);
  if (Number.isFinite(asNumber)) {
    // Heuristic: treat as seconds if it looks like a 10-digit unix timestamp.
    return asNumber < 1e12 && asNumber > 1e8 ? asNumber * 1000 : asNumber;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

/** Builds a human-readable template shown as textarea placeholder in the UI. */
export function manualInputTemplate() {
  return [
    "# timestamp,open,high,low,close,volume (volume optional)",
    "1717200000000,160.9500,160.9820,160.9400,160.9780,1520",
    "1717200060000,160.9780,161.0050,160.9700,160.9990,1330",
  ].join("\n");
}
