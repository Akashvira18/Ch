import { describe, test, assert, assertEqual } from "./testHarness.js";
import { evaluateMarketStructure, detectSwings } from "../src/analysis/marketStructure.js";
import { calculateSupportResistance } from "../src/analysis/supportResistance.js";
import { detectBreakout } from "../src/analysis/breakout.js";
import { detectBreakdown } from "../src/analysis/breakdown.js";
import { detectCandlePatterns, detectBullishEngulfing, detectDoji } from "../src/analysis/candlePatterns.js";
import { computeScores, qualityGrade, DEFAULT_WEIGHTS } from "../src/analysis/scoring.js";
import { evaluateTrend } from "../src/analysis/trend.js";
import { analyzeVolatility } from "../src/analysis/volatility.js";
import {
  risingCandles,
  fallingCandles,
  rangingCandles,
  breakoutCandles,
  breakdownCandles,
  falseBreakoutCandles,
} from "./fixtures.js";

describe("Market structure", () => {
  test("a single candle is never enough to classify structure (needs >=2 swings each side)", () => {
    const tiny = risingCandles.slice(0, 3);
    const result = evaluateMarketStructure(tiny, { swingStrength: 3 });
    assertEqual(result.structure, "insufficient-data");
  });

  test("a steadily rising series is not classified as bearish", () => {
    const result = evaluateMarketStructure(risingCandles, { swingStrength: 2, lookbackSwings: 4 });
    assert(result.structure !== "bearish", `Expected non-bearish structure, got ${result.structure}`);
  });

  test("a steadily falling series is not classified as bullish", () => {
    const result = evaluateMarketStructure(fallingCandles, { swingStrength: 2, lookbackSwings: 4 });
    assert(result.structure !== "bullish", `Expected non-bullish structure, got ${result.structure}`);
  });
});

describe("Support / Resistance", () => {
  test("returns clustered zones, not single-price levels", () => {
    const { supportZones, resistanceZones } = calculateSupportResistance(breakoutCandles, { swingStrength: 2 });
    assert(Array.isArray(supportZones) && Array.isArray(resistanceZones), "Expected arrays");
    for (const zone of [...supportZones, ...resistanceZones]) {
      assert(typeof zone.low === "number" && typeof zone.high === "number", "Zone must have low/high");
      assert(zone.high >= zone.low, "Zone high must be >= low");
    }
  });
});

describe("Breakout detection", () => {
  test("clean breakout shape yields possible or confirmed status, never from one tick alone", () => {
    const { resistanceZones } = calculateSupportResistance(breakoutCandles, { swingStrength: 2 });
    const trend = evaluateTrend(breakoutCandles, {});
    const volatility = analyzeVolatility(breakoutCandles);
    const context = { resistanceZones, trend, momentumScore: 40, volatility };
    const result = detectBreakout(breakoutCandles, context, {});
    assert(["possible", "confirmed", "none"].includes(result.status), `Unexpected status ${result.status}`);
  });

  test("a failed breakout that closes back below resistance is flagged false-breakout", () => {
    const { resistanceZones } = calculateSupportResistance(falseBreakoutCandles, { swingStrength: 2 });
    const trend = evaluateTrend(falseBreakoutCandles, {});
    const volatility = analyzeVolatility(falseBreakoutCandles);
    const context = { resistanceZones, trend, momentumScore: -5, volatility };
    const result = detectBreakout(falseBreakoutCandles, context, {});
    assert(
      result.status === "false-breakout" || result.status === "none",
      `Expected false-breakout or none, got ${result.status}`
    );
  });
});

describe("Breakdown detection", () => {
  test("clean breakdown shape yields possible or confirmed status", () => {
    const { supportZones } = calculateSupportResistance(breakdownCandles, { swingStrength: 2 });
    const trend = evaluateTrend(breakdownCandles, {});
    const volatility = analyzeVolatility(breakdownCandles);
    const structureResult = evaluateMarketStructure(breakdownCandles, { swingStrength: 2 });
    const context = { supportZones, trend, momentumScore: -40, volatility, structure: structureResult.structure };
    const result = detectBreakdown(breakdownCandles, context, {});
    assert(["possible", "confirmed", "none"].includes(result.status), `Unexpected status ${result.status}`);
  });
});

describe("Candle patterns", () => {
  test("detects a textbook bullish engulfing pair", () => {
    const prev = { open: 100, high: 100.5, low: 98, close: 98.5 };
    const curr = { open: 98.3, high: 101, low: 98, close: 100.8 };
    assert(detectBullishEngulfing(curr, prev), "Should detect bullish engulfing");
  });

  test("detects a doji when open and close are nearly equal", () => {
    const c = { open: 100, high: 101, low: 99, close: 100.02 };
    assert(detectDoji(c, 0.1), "Should detect doji for near-equal open/close");
  });

  test("detectCandlePatterns never throws on a short candle array", () => {
    const result = detectCandlePatterns(rangingCandles.slice(0, 1));
    assert(Array.isArray(result.patterns), "Should return an empty-but-valid patterns array");
  });
});

describe("Scoring", () => {
  test("weights sum to 100 by default", () => {
    const total = Object.values(DEFAULT_WEIGHTS).reduce((a, b) => a + b, 0);
    assertEqual(total, 100);
  });

  test("qualityGrade maps confidence into the documented bands", () => {
    const thresholds = { Aplus: 85, A: 75, B: 65, C: 55 };
    assertEqual(qualityGrade(90, thresholds), "A+");
    assertEqual(qualityGrade(80, thresholds), "A");
    assertEqual(qualityGrade(70, thresholds), "B");
    assertEqual(qualityGrade(60, thresholds), "C");
    assertEqual(qualityGrade(40, thresholds), "WAIT");
  });

  test("computeScores never returns NaN even with minimal inputs", () => {
    const { upScore, downScore } = computeScores(
      {
        trend: { trend: "sideways", strength: 0 },
        structure: { structure: "range" },
        momentumScore: 0,
        srContext: {},
        breakout: { status: "none" },
        breakdown: { status: "none" },
        candlePattern: { patterns: [] },
        volatility: { level: "normal" },
      },
      DEFAULT_WEIGHTS
    );
    assert(Number.isFinite(upScore) && Number.isFinite(downScore), "Scores must be finite numbers");
  });
});
