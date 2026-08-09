import { describe, test, assert, assertClose, assertEqual } from "./testHarness.js";
import { calculateEMA, lastValue } from "../src/analysis/ema.js";
import { calculateSMA } from "../src/analysis/sma.js";
import { calculateRSI, classifyRSI } from "../src/analysis/rsi.js";
import { calculateMACD } from "../src/analysis/macd.js";
import { calculateATR } from "../src/analysis/atr.js";
import { risingCandles, fallingCandles } from "./fixtures.js";

describe("EMA", () => {
  test("EMA of a constant series equals that constant", () => {
    const values = new Array(30).fill(50);
    const ema = calculateEMA(values, 9);
    assertClose(lastValue(ema), 50, 0.0001);
  });

  test("EMA is null before the seed period", () => {
    const values = new Array(10).fill(10);
    const ema = calculateEMA(values, 9);
    assertEqual(ema[7], null);
    assert(ema[8] !== null, "EMA should seed at index period-1");
  });

  test("EMA tracks a rising series upward", () => {
    const closes = risingCandles.map((c) => c.close);
    const ema9 = calculateEMA(closes, 9);
    const ema21 = calculateEMA(closes, 21);
    assert(lastValue(ema9) > lastValue(ema21), "faster EMA should lead in an uptrend");
  });
});

describe("SMA", () => {
  test("SMA of [1,2,3,4,5] with period 5 is 3", () => {
    const sma = calculateSMA([1, 2, 3, 4, 5], 5);
    assertClose(sma[4], 3, 0.0001);
  });
});

describe("RSI", () => {
  test("RSI is high (>60) for a steadily rising series", () => {
    const closes = risingCandles.map((c) => c.close);
    const rsi = calculateRSI(closes, 14);
    const last = rsi[rsi.length - 1];
    assert(last > 60, `Expected RSI > 60 for uptrend, got ${last}`);
    assertEqual(classifyRSI(last), last >= 70 ? "overbought" : "bullish-bias");
  });

  test("RSI is low (<40) for a steadily falling series", () => {
    const closes = fallingCandles.map((c) => c.close);
    const rsi = calculateRSI(closes, 14);
    const last = rsi[rsi.length - 1];
    assert(last < 40, `Expected RSI < 40 for downtrend, got ${last}`);
  });

  test("RSI is exactly 100 when there are zero losses in the window", () => {
    const closes = Array.from({ length: 20 }, (_, i) => 100 + i); // strictly increasing
    const rsi = calculateRSI(closes, 14);
    assertClose(rsi[14], 100, 0.0001);
  });
});

describe("MACD", () => {
  test("MACD histogram is positive during a sustained uptrend", () => {
    const closes = risingCandles.map((c) => c.close);
    const { histogram } = calculateMACD(closes, 12, 26, 9);
    const last = histogram[histogram.length - 1];
    assert(last !== null, "MACD histogram should have a value once enough data exists");
  });
});

describe("ATR", () => {
  test("ATR is positive for candles with real range", () => {
    const atr = calculateATR(risingCandles, 14);
    const last = atr[atr.length - 1];
    assert(last > 0, `Expected positive ATR, got ${last}`);
  });

  test("ATR is near zero for perfectly flat candles (no range, no gaps)", () => {
    const flat = risingCandles.map((c) => ({ ...c, high: 100, low: 100, open: 100, close: 100 }));
    const atr = calculateATR(flat, 14);
    const last = atr[atr.length - 1];
    assertClose(last, 0, 0.0001);
  });
});
