/**
 * jsonAdapter.js
 *
 * Accepts several common JSON shapes for candle data:
 *   1. Array of objects: [{timestamp, open, high, low, close, volume}, ...]
 *   2. Array of arrays (OHLCV order): [[timestamp, open, high, low, close, volume], ...]
 *   3. { candles: [...] } wrapper object
 *   4. Object keyed by exchange-style short keys: {t, o, h, l, c, v}
 */

/**
 * @param {string|Object} jsonInput - raw JSON text or an already-parsed object/array
 * @returns {Array<Object>} raw candle-like objects
 */
export function parseJSON(jsonInput) {
  let data = jsonInput;
  if (typeof jsonInput === "string") {
    try {
      data = JSON.parse(jsonInput);
    } catch (err) {
      throw new Error(`Invalid JSON: ${err.message}`);
    }
  }

  const list = Array.isArray(data) ? data : Array.isArray(data?.candles) ? data.candles : null;
  if (!list) {
    throw new Error("Unrecognized JSON shape. Expected an array of candles or { candles: [...] }.");
  }

  return list.map((item) => normalizeItem(item)).filter(Boolean);
}

function normalizeItem(item) {
  if (Array.isArray(item)) {
    const [timestamp, open, high, low, close, volume] = item;
    return { timestamp: toMs(timestamp), open, high, low, close, volume: volume ?? null };
  }
  if (item && typeof item === "object") {
    const timestamp = item.timestamp ?? item.time ?? item.t ?? item.date;
    const open = item.open ?? item.o;
    const high = item.high ?? item.h;
    const low = item.low ?? item.l;
    const close = item.close ?? item.c;
    const volume = item.volume ?? item.vol ?? item.v ?? null;
    return { timestamp: toMs(timestamp), open, high, low, close, volume };
  }
  return null;
}

function toMs(value) {
  if (typeof value === "number") {
    return value < 1e12 && value > 1e8 ? value * 1000 : value;
  }
  if (typeof value === "string") {
    const asNumber = Number(value);
    if (Number.isFinite(asNumber)) return toMs(asNumber);
    const parsed = Date.parse(value);
    return Number.isFinite(parsed) ? parsed : NaN;
  }
  return NaN;
}

/** Reads a File/Blob (e.g. from an <input type="file">) and resolves to candle-like objects. */
export function parseJSONFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      try {
        resolve(parseJSON(String(reader.result)));
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(reader.error || new Error("Failed to read JSON file"));
    reader.readAsText(file);
  });
}
