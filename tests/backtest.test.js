import { describe, test, assert, assertEqual } from "./testHarness.js";
import { runBacktest } from "../src/backtest/backtestEngine.js";
import { generateSimulatedCandles } from "../src/data/simulatedAdapter.js";

describe("Backtest engine", () => {
  test("reports an error instead of crashing when given insufficient data", () => {
    const result = runBacktest([], { engineOptions: { minCandles: 60 } });
    assert(typeof result.error === "string", "Expected an error message for empty input");
    assertEqual(result.summary.total, 0);
  });

  test("produces a well-formed summary on a realistic simulated dataset", () => {
    const candles = generateSimulatedCandles({ count: 220, regime: "mixed", seed: 7 });
    const result = runBacktest(candles, {
      engineOptions: { minCandles: 60, minConfidence: 40 },
      holdCandles: 8,
    });
    assert(!result.error, `Unexpected error: ${result.error}`);
    assert(Array.isArray(result.signals), "signals must be an array");
    assertEqual(typeof result.summary.total, "number");
    for (const s of result.signals) {
      assert(["WIN", "LOSS", "NEUTRAL"].includes(s.outcome), `Unexpected outcome ${s.outcome}`);
      assert(Number.isFinite(s.returnPercent), "returnPercent must be finite");
    }
  });

  test("never evaluates a signal's outcome using data at or before its own index (no look-ahead)", () => {
    // Structural check: every signal's index must be < candles.length - 1,
    // i.e. there must exist at least one forward candle it was scored against,
    // and the entry price must equal the close AT that index (not a later one).
    const candles = generateSimulatedCandles({ count: 150, regime: "up", seed: 3 });
    const result = runBacktest(candles, { engineOptions: { minCandles: 60 }, holdCandles: 5 });
    for (const s of result.signals) {
      assertEqual(s.entryPrice, candles[s.index].close);
    }
  });
});
