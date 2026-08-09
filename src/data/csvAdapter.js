/**
 * csvAdapter.js
 *
 * Parses CSV text in the documented format:
 *   timestamp,open,high,low,close,volume
 * Header row is optional and auto-detected. Volume column is optional.
 * Handles quoted fields, extra whitespace, and both comma and semicolon
 * delimiters (common in exports from European brokers).
 */

/**
 * @param {string} csvText
 * @returns {Array<Object>} raw candle-like objects
 */
export function parseCSV(csvText) {
  if (!csvText || typeof csvText !== "string") return [];

  const delimiter = detectDelimiter(csvText);
  const rows = csvText
    .split(/\r\n|\n|\r/)
    .map((r) => r.trim())
    .filter((r) => r.length > 0);

  if (rows.length === 0) return [];

  let dataRows = rows;
  const headerCols = splitCSVLine(rows[0], delimiter).map((c) => c.toLowerCase());
  let columnMap = { timestamp: 0, open: 1, high: 2, low: 3, close: 4, volume: 5 };

  const looksLikeHeader = headerCols.some((c) => ["timestamp", "time", "date", "open", "close"].includes(c));
  if (looksLikeHeader) {
    dataRows = rows.slice(1);
    columnMap = buildColumnMap(headerCols);
  }

  const candles = [];
  for (const row of dataRows) {
    const cols = splitCSVLine(row, delimiter);
    if (cols.length < 5) continue;

    const get = (key, fallbackIndex) => {
      const idx = columnMap[key] ?? fallbackIndex;
      return cols[idx];
    };

    candles.push({
      timestamp: parseTimestamp(get("timestamp", 0)),
      open: Number(get("open", 1)),
      high: Number(get("high", 2)),
      low: Number(get("low", 3)),
      close: Number(get("close", 4)),
      volume: columnMap.volume !== undefined && cols[columnMap.volume] !== undefined
        ? numOrNull(cols[columnMap.volume])
        : null,
    });
  }
  return candles;
}

function buildColumnMap(headerCols) {
  const map = {};
  headerCols.forEach((col, i) => {
    if (["timestamp", "time", "date"].includes(col)) map.timestamp = i;
    else if (["open", "o"].includes(col)) map.open = i;
    else if (["high", "h"].includes(col)) map.high = i;
    else if (["low", "l"].includes(col)) map.low = i;
    else if (["close", "c"].includes(col)) map.close = i;
    else if (["volume", "vol", "v"].includes(col)) map.volume = i;
  });
  return map;
}

function detectDelimiter(text) {
  const firstLine = text.split(/\r\n|\n|\r/)[0] || "";
  const commaCount = (firstLine.match(/,/g) || []).length;
  const semiCount = (firstLine.match(/;/g) || []).length;
  return semiCount > commaCount ? ";" : ",";
}

function splitCSVLine(line, delimiter) {
  // Minimal quoted-field aware split (handles "1,234" style quoted numbers).
  const result = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim());
      current = "";
    } else {
      current += ch;
    }
  }
  result.push(current.trim());
  return result;
}

function parseTimestamp(value) {
  const asNumber = Number(value);
  if (Number.isFinite(asNumber)) {
    return asNumber < 1e12 && asNumber > 1e8 ? asNumber * 1000 : asNumber;
  }
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : NaN;
}

function numOrNull(value) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** Reads a File/Blob (e.g. from an <input type="file">) and resolves to candle-like objects. */
export function parseCSVFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(parseCSV(String(reader.result)));
    reader.onerror = () => reject(reader.error || new Error("Failed to read CSV file"));
    reader.readAsText(file);
  });
}
