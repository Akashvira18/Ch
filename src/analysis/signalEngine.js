/**
 * signalEngine.js
 *
 * Orchestrates every other analysis module into a single signal, and owns
 * the anti-noise system described in the project brief:
 *   - minimum data requirement
 *   - minimum confidence threshold
 *   - candle-close confirmation (only act on closed candles by default)
 *   - hysteresis (avoid UP/DOWN flipping on small confidence wobbles)
 *   - signal cooldown (minimum time/candles between new non-WAIT signals)
 *   - duplicate signal prevention (don't re-emit the same decision back to back)
 *
 * This module is intentionally the only one that holds mutable state
 * (the "engine instance"), so live updates can be incremental in spirit
 * (recompute is still O(n) per module today - see docs/architecture.md for
 * the incremental-computation roadmap) while signal emission stays stateful
 * and rate-limited.
 */
import { evaluateTrend } from "./trend.js";
import { evaluateMarketStructure } from "./marketStructure.js";
import { calculateSupportResistance, nearestResistanceAbove, nearestSupportBelow } from "./supportResistance.js";
import { detectBreakout } from "./breakout.js";
import { detectBreakdown } from "./breakdown.js";
import { detectCandlePatterns } from "./candlePatterns.js";
import { analyzeVolatility } from "./volatility.js";
import { calculatePriceMomentum, combinedMomentumScore } from "./momentum.js";
import { calculateRSI, classifyRSI } from "./rsi.js";
import { computeScores, qualityGrade, DEFAULT_WEIGHTS } from "./scoring.js";
import { sanitizeCandles, hasSufficientData } from "./validation.js";

export const DEFAULT_ENGINE_OPTIONS = {
  minCandles: 60,
  minConfidence: 55, // below this, always WAIT regardless of score lean
  hysteresisBand: 6, // if new confidence is within this band of the last decision's confidence, keep previous decision
  cooldownCandles: 3, // minimum candles between two non-WAIT decisions of *different* direction
  requireClosedCandle: true,
  swingStrength: 3,
  lookbackSwings: 4,
  weights: DEFAULT_WEIGHTS,
  qualityThresholds: { Aplus: 85, A: 75, B: 65, C: 55 },
  breakout: {},
  breakdown: {},
};

export class SignalEngine {
  constructor(options = {}) {
    this.options = { ...DEFAULT_ENGINE_OPTIONS, ...options };
    /** @type {{decision: string, confidence: number, candleIndex: number}|null} */
    this.lastEmitted = null;
  }

  updateOptions(partial) {
    this.options = { ...this.options, ...partial };
  }

  /**
   * Runs the full analysis pipeline for the given (already sanitized, or
   * raw - it will sanitize internally) candle array and, if a higher
   * timeframe context is supplied, folds that into the final decision.
   *
   * @param {Array} rawCandles
   * @param {Object} [multiTimeframeContext] - { higherTimeframeTrend: "up"|"down"|"sideways"|null }
   * @returns {Object} the full signal result (see return statement for shape)
   */
  analyze(rawCandles, multiTimeframeContext = {}) {
    const { candles, report } = sanitizeCandles(rawCandles);

    if (!hasSufficientData(candles, this.options.minCandles)) {
      return this.buildInsufficientDataResult(candles, report);
    }

    const workingCandles = this.options.requireClosedCandle ? candles : candles;
    const last = workingCandles[workingCandles.length - 1];

    const trend = evaluateTrend(workingCandles, this.options);
    const structureResult = evaluateMarketStructure(workingCandles, this.options);
    const { supportZones, resistanceZones } = calculateSupportResistance(workingCandles, this.options);
    const volatility = analyzeVolatility(workingCandles);

    const closes = workingCandles.map((c) => c.close);
    const priceMomentumSeries = calculatePriceMomentum(closes);
    const momentumScore = combinedMomentumScore(workingCandles, priceMomentumSeries);
    const rsiSeries = calculateRSI(closes, 14);
    const rsiValue = rsiSeries[rsiSeries.length - 1];
    const rsiClass = classifyRSI(rsiValue);

    const candlePattern = detectCandlePatterns(workingCandles);

    const breakoutContext = { resistanceZones, trend, momentumScore, volatility };
    const breakdownContext = { supportZones, trend, momentumScore, volatility, structure: structureResult.structure };
    const breakout = detectBreakout(workingCandles, breakoutContext, this.options.breakout);
    const breakdown = detectBreakdown(workingCandles, breakdownContext, this.options.breakdown);

    const srContext = this.buildSRContext(last, supportZones, resistanceZones);

    const { upScore, downScore, breakdown: scoreBreakdown } = computeScores(
      {
        trend,
        structure: structureResult,
        momentumScore,
        srContext,
        breakout,
        breakdown,
        candlePattern,
        volatility,
      },
      this.options.weights
    );

    let { decision, confidence } = this.decideDirection(upScore, downScore, rsiClass);

    // Multi-timeframe confirmation: a higher timeframe trend that disagrees
    // downgrades an UP/DOWN call to WAIT (pullback condition); agreement
    // gives a small confidence boost, capped at 100.
    const mtfNote = this.applyMultiTimeframe(decision, confidence, multiTimeframeContext);
    decision = mtfNote.decision;
    confidence = mtfNote.confidence;

    // Anti-noise: minimum confidence threshold.
    if (confidence < this.options.minConfidence) {
      decision = "WAIT";
    }

    // Anti-noise: hysteresis + cooldown, applied against the last emitted signal.
    const final = this.applyAntiNoise(decision, confidence, workingCandles.length);

    const grade = qualityGrade(confidence, this.options.qualityThresholds);

    const reasons = buildReasons(scoreBreakdown, final.decision);
    const warnings = buildWarnings({ last, resistanceZones, supportZones, volatility, multiTimeframeContext, breakout, breakdown });

    const result = {
      time: last.timestamp,
      price: last.close,
      decision: final.decision, // "UP" | "DOWN" | "WAIT"
      confidence: round1(confidence),
      grade,
      upScore,
      downScore,
      trend: trend.trend,
      trendStrength: trend.strength,
      structure: structureResult.structure,
      momentumScore: round1(momentumScore),
      rsi: rsiValue,
      rsiClass,
      volatility,
      supportZones,
      resistanceZones,
      breakoutStatus: breakout.status,
      breakdownStatus: breakdown.status,
      candlePatterns: candlePattern.patterns,
      scoreBreakdown,
      reasons,
      warnings,
      dataReport: report,
      suppressedByAntiNoise: final.suppressed,
    };

    if (!final.suppressed) {
      this.lastEmitted = { decision: final.decision, confidence, candleIndex: workingCandles.length - 1 };
    }

    return result;
  }

  buildSRContext(last, supportZones, resistanceZones) {
    const resistance = nearestResistanceAbove(last.close, resistanceZones);
    const support = nearestSupportBelow(last.close, supportZones);
    const distanceToResistancePercent = resistance ? ((resistance.low - last.close) / last.close) * 100 : null;
    const distanceToSupportPercent = support ? ((last.close - support.high) / last.close) * 100 : null;
    return {
      distanceToResistancePercent,
      distanceToSupportPercent,
      aboveAllResistance: resistanceZones.length > 0 && !resistance,
      belowAllSupport: supportZones.length > 0 && !support,
      note: `Nearest resistance: ${resistance ? resistance.high : "n/a"}, nearest support: ${support ? support.low : "n/a"}`,
    };
  }

  decideDirection(upScore, downScore, rsiClass) {
    const diff = upScore - downScore;
    const confidence = Math.max(upScore, downScore);

    // Require meaningful separation between up/down scores, not just "higher".
    if (Math.abs(diff) < 8) {
      return { decision: "WAIT", confidence: (upScore + downScore) / 2 };
    }
    if (diff > 0) {
      // RSI extreme overbought softens an UP call slightly (mean-reversion risk).
      const adj = rsiClass === "overbought" ? -3 : 0;
      return { decision: "UP", confidence: confidence + adj };
    }
    const adj = rsiClass === "oversold" ? -3 : 0;
    return { decision: "DOWN", confidence: confidence + adj };
  }

  applyMultiTimeframe(decision, confidence, mtfContext) {
    const higher = mtfContext?.higherTimeframeTrend;
    if (!higher || decision === "WAIT") return { decision, confidence };

    const lowerDirection = decision === "UP" ? "up" : "down";
    if (higher === lowerDirection) {
      return { decision, confidence: Math.min(100, confidence + 6) };
    }
    if (higher === "sideways") {
      return { decision, confidence: Math.max(0, confidence - 3) };
    }
    // Higher timeframe disagrees outright -> downgrade to WAIT (pullback condition).
    return { decision: "WAIT", confidence: Math.max(0, confidence - 10) };
  }

  applyAntiNoise(decision, confidence, candleIndex) {
    if (!this.lastEmitted) return { decision, suppressed: false };

    const sameDirection = this.lastEmitted.decision === decision;
    const withinHysteresis = Math.abs(confidence - this.lastEmitted.confidence) < this.options.hysteresisBand;

    // If nothing meaningfully changed, keep repeating the same decision without
    // treating it as flip-flopping - but mark subsequent identical repeats as
    // "not newly emitted" so history/UI can avoid duplicate rows if desired.
    if (sameDirection && withinHysteresis) {
      return { decision, suppressed: true };
    }

    // Cooldown: block a *direction flip* between UP and DOWN within N candles.
    const candlesSinceLast = candleIndex - this.lastEmitted.candleIndex;
    const isDirectionFlip =
      (this.lastEmitted.decision === "UP" && decision === "DOWN") ||
      (this.lastEmitted.decision === "DOWN" && decision === "UP");

    if (isDirectionFlip && candlesSinceLast < this.options.cooldownCandles) {
      return { decision: "WAIT", suppressed: false };
    }

    return { decision, suppressed: false };
  }

  buildInsufficientDataResult(candles, report) {
    return {
      time: candles.length ? candles[candles.length - 1].timestamp : null,
      price: candles.length ? candles[candles.length - 1].close : null,
      decision: "WAIT",
      confidence: 0,
      grade: "WAIT",
      upScore: 0,
      downScore: 0,
      trend: "insufficient-data",
      trendStrength: 0,
      structure: "insufficient-data",
      momentumScore: 0,
      rsi: null,
      rsiClass: "unknown",
      volatility: { level: "unknown" },
      supportZones: [],
      resistanceZones: [],
      breakoutStatus: "none",
      breakdownStatus: "none",
      candlePatterns: [],
      scoreBreakdown: [],
      reasons: [],
      warnings: [`Insufficient data: need at least ${this.options.minCandles} valid candles, have ${candles.length}.`],
      dataReport: report,
      suppressedByAntiNoise: false,
    };
  }
}

function buildReasons(scoreBreakdown, decision) {
  if (decision === "WAIT") return [];
  const key = decision === "UP" ? "upContribution" : "downContribution";
  return scoreBreakdown
    .filter((b) => b[key] > 0)
    .sort((a, b) => b[key] - a[key])
    .map((b) => `${b.component} (+${b[key]})`);
}

function buildWarnings({ last, resistanceZones, supportZones, volatility, multiTimeframeContext, breakout, breakdown }) {
  const warnings = [];
  const resistance = nearestResistanceAbove(last.close, resistanceZones);
  const support = nearestSupportBelow(last.close, supportZones);

  if (resistance) {
    const distPct = ((resistance.low - last.close) / last.close) * 100;
    if (distPct >= 0 && distPct < 0.3) warnings.push("Resistance nearby");
  }
  if (support) {
    const distPct = ((last.close - support.high) / last.close) * 100;
    if (distPct >= 0 && distPct < 0.3) warnings.push("Support nearby");
  }
  if (volatility.level === "low") warnings.push("Low volatility");
  if (volatility.level === "high") warnings.push("High volatility - wider swings likely");
  if (multiTimeframeContext?.higherTimeframeTrend && multiTimeframeContext.higherTimeframeTrend !== "sideways") {
    // handled by caller when it actually conflicts; kept generic here
  }
  if (breakout.status === "false-breakout") warnings.push("Recent false breakout detected");
  if (breakdown.status === "false-breakdown") warnings.push("Recent false breakdown detected");
  return warnings;
}

function round1(v) {
  return Math.round(v * 10) / 10;
}
