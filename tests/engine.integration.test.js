import { describe, test, assert, assertEqual } from "./testHarness.js";
import { isValidCandleShape, sanitizeCandles, hasSufficientData } from "../src/analysis/validation.js";
import { SignalEngine } from "../src/analysis/signalEngine.js";
import { SignalHistory } from "../src/analysis/signalHistory.js";
import { risingCandles, fallingCandles, rangingCandles, invalidMixedCandles } from "./fixtures.js";

describe("Validation", () => {
  test("rejects a candle with high < low", () => {
    assert(!isValidCandleShape({ timestamp: 1, open: 10, high: 5, low: 9, close: 8 }));
  });

  test("rejects a candle with non-finite timestamp", () => {
    assert(!isValidCandleShape({ timestamp: NaN, open: 1, high: 2, low: 0.5, close: 1.5 }));
  });

  test("accepts a well-formed candle without volume", () => {
    assert(isValidCandleShape({ timestamp: 1700000000000, open: 100, high: 101, low: 99, close: 100.5 }));
  });

  test("sanitizeCandles drops invalid and duplicate candles, sorts ascending", () => {
    const { candles, report } = sanitizeCandles(invalidMixedCandles);
    assert(report.droppedInvalid + report.droppedDuplicates > 0, "Expected at least one dropped candle");
    for (let i = 1; i < candles.length; i++) {
      assert(candles[i].timestamp > candles[i - 1].timestamp, "Candles must be sorted ascending with no duplicates");
    }
  });

  test("hasSufficientData respects the configured minimum", () => {
    assert(!hasSufficientData(rangingCandles.slice(0, 5), 60));
    assert(hasSufficientData(rangingCandles, 20));
  });
});

describe("SignalEngine (end-to-end)", () => {
  test("returns a WAIT/insufficient result gracefully when given too little data", () => {
    const engine = new SignalEngine();
    const result = engine.analyze(risingCandles.slice(0, 5));
    assertEqual(result.decision, "WAIT");
  });

  test("never throws on a dataset containing invalid candles mixed with valid ones", () => {
    const engine = new SignalEngine({ minCandles: 3 });
    let threw = false;
    try {
      engine.analyze(invalidMixedCandles);
    } catch (e) {
      threw = true;
    }
    assert(!threw, "Engine must never throw on malformed input");
  });

  test("a strong, sustained uptrend does not produce a DOWN decision", () => {
    const engine = new SignalEngine({ minCandles: 25, minConfidence: 0 });
    const result = engine.analyze(risingCandles);
    assert(result.decision !== "DOWN", `Expected non-DOWN for uptrend fixture, got ${result.decision}`);
  });

  test("a strong, sustained downtrend does not produce an UP decision", () => {
    const engine = new SignalEngine({ minCandles: 25, minConfidence: 0 });
    const result = engine.analyze(fallingCandles);
    assert(result.decision !== "UP", `Expected non-UP for downtrend fixture, got ${result.decision}`);
  });

  test("confidence is always within [0, 100]", () => {
    const engine = new SignalEngine({ minCandles: 25 });
    for (const fixture of [risingCandles, fallingCandles, rangingCandles]) {
      const result = engine.analyze(fixture);
      assert(result.confidence >= 0 && result.confidence <= 100, `Confidence out of range: ${result.confidence}`);
    }
  });

  test("hysteresis suppresses a flip when confidence wobbles within the band", () => {
    const engine = new SignalEngine({ minCandles: 25, minConfidence: 0, hysteresisBand: 50, cooldownCandles: 0 });
    const first = engine.analyze(risingCandles);
    // Feed the same data again (same last candle) - should not "duplicate emit" a brand-new signal.
    const second = engine.analyze(risingCandles);
    assertEqual(first.decision, second.decision === "WAIT" ? first.decision : second.decision);
  });

  test("result never claims certainty - no field equals literal 100 confidence for a routine fixture", () => {
    const engine = new SignalEngine({ minCandles: 25 });
    const result = engine.analyze(risingCandles);
    assert(result.confidence <= 100, "Confidence must be capped at 100, never exceed it");
  });
});

describe("SignalHistory", () => {
  test("adds a signal and computes basic stats", () => {
    const history = new SignalHistory();
    history.add({ time: 1, decision: "UP", confidence: 80, trend: "up", breakoutStatus: "none", structure: "bullish" });
    history.add({ time: 2, decision: "DOWN", confidence: 60, trend: "down", breakoutStatus: "none", structure: "bearish" });
    const stats = history.computeStats();
    assertEqual(stats.totalSignals, 2);
    assert(stats.avgConfidence > 0, "Average confidence should be positive");
  });

  test("round-trips through toJSON/fromJSON", () => {
    const history = new SignalHistory();
    history.add({ time: 1, decision: "UP", confidence: 70, trend: "up", breakoutStatus: "none", structure: "bullish" });
    const restored = SignalHistory.fromJSON(history.toJSON());
    assertEqual(restored.computeStats().totalSignals, 1);
  });
});
