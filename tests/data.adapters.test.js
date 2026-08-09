import { describe, test, assert, assertEqual } from "./testHarness.js";
import { parseCSV } from "../src/data/csvAdapter.js";
import { parseJSON } from "../src/data/jsonAdapter.js";
import { isValidCandleShape } from "../src/analysis/validation.js";

describe("CSV adapter", () => {
  test("parses the documented header format", () => {
    const csv = "timestamp,open,high,low,close,volume\n1700000000,100,101,99,100.5,1200\n1700000060,100.5,102,100,101.8,1300\n";
    const rows = parseCSV(csv);
    assertEqual(rows.length, 2);
    assert(isValidCandleShape({ ...rows[0], timestamp: rows[0].timestamp }), "First parsed row should be a valid candle");
  });

  test("auto-converts second-based epoch timestamps to milliseconds", () => {
    const csv = "timestamp,open,high,low,close\n1700000000,100,101,99,100.5\n";
    const rows = parseCSV(csv);
    assert(rows[0].timestamp > 1_000_000_000_000, "Second-epoch timestamps should be upscaled to ms");
  });

  test("works without a header row and without a volume column", () => {
    const csv = "1700000000,100,101,99,100.5\n1700000060,100.5,102,100,101.8\n";
    const rows = parseCSV(csv);
    assertEqual(rows.length, 2);
    assertEqual(rows[0].volume, null);
  });

  test("returns an empty array for empty input rather than throwing", () => {
    assertEqual(parseCSV("").length, 0);
    assertEqual(parseCSV(null).length, 0);
  });
});

describe("JSON adapter", () => {
  test("parses an array of candle objects", () => {
    const json = JSON.stringify([
      { timestamp: 1700000000000, open: 100, high: 101, low: 99, close: 100.5, volume: 1000 },
    ]);
    const rows = parseJSON(json);
    assertEqual(rows.length, 1);
  });

  test("throws a clear, catchable error on malformed JSON (caught at the UI layer, never crashes the app)", () => {
    let threw = false;
    let message = "";
    try {
      parseJSON("{ not valid json");
    } catch (err) {
      threw = true;
      message = err.message;
    }
    assert(threw, "parseJSON should throw on malformed input so the UI can show a friendly error");
    assert(message.length > 0, "Error should carry a descriptive message");
  });
});
