/**
 * scoring.js
 *
 * The transparent, weighted multi-factor scorer at the heart of the engine.
 * Produces an UP score and a DOWN score (each 0-100, built from the same
 * weighted components) plus a per-component breakdown so the UI can render
 * "Why?" reasons and warnings from real numbers - never hard-coded text.
 *
 * Default weights (sum to 100):
 *   trend               25
 *   marketStructure     20
 *   momentum            15
 *   supportResistance   15
 *   breakoutBreakdown   15
 *   candleConfirmation   5
 *   volatility           5
 *
 * All weights are configurable via `weights` (see config.js for the
 * app-wide defaults, which are persisted through the settings panel).
 */

export const DEFAULT_WEIGHTS = {
  trend: 25,
  marketStructure: 20,
  momentum: 15,
  supportResistance: 15,
  breakoutBreakdown: 15,
  candleConfirmation: 5,
  volatility: 5,
};

/**
 * @param {Object} inputs - pre-computed results from the other analysis modules
 * @param {Object} inputs.trend - result of evaluateTrend()
 * @param {Object} inputs.structure - result of evaluateMarketStructure()
 * @param {number} inputs.momentumScore - -100..100
 * @param {Object} inputs.srContext - { distanceToResistancePercent, distanceToSupportPercent }
 * @param {Object} inputs.breakout - result of detectBreakout()
 * @param {Object} inputs.breakdown - result of detectBreakdown()
 * @param {Object} inputs.candlePattern - result of detectCandlePatterns()
 * @param {Object} inputs.volatility - result of analyzeVolatility()
 * @param {Object} [weights] - override DEFAULT_WEIGHTS
 * @returns {{
 *   upScore: number, downScore: number,
 *   breakdown: Array<{component:string, upContribution:number, downContribution:number, weight:number, note:string}>,
 * }}
 */
export function computeScores(inputs, weights = DEFAULT_WEIGHTS) {
  const breakdown = [];
  let upScore = 0;
  let downScore = 0;

  // --- Trend (25) ---
  {
    const w = weights.trend;
    const t = inputs.trend || {};
    const strengthFraction = (t.strength || 0) / 100;
    let up = 0;
    let down = 0;
    if (t.trend === "up") up = w * (0.5 + 0.5 * strengthFraction);
    else if (t.trend === "down") down = w * (0.5 + 0.5 * strengthFraction);
    else if (t.trend === "sideways") {
      up = w * 0.2;
      down = w * 0.2;
    }
    upScore += up;
    downScore += down;
    breakdown.push({
      component: "Trend",
      upContribution: round1(up),
      downContribution: round1(down),
      weight: w,
      note: `EMA alignment: ${t.emaAlignment ?? "n/a"}, trend: ${t.trend ?? "n/a"}`,
    });
  }

  // --- Market structure (20) ---
  {
    const w = weights.marketStructure;
    const s = inputs.structure || {};
    let up = 0;
    let down = 0;
    if (s.structure === "bullish") up = w;
    else if (s.structure === "bearish") down = w;
    else if (s.structure === "transition") {
      up = w * 0.4;
      down = w * 0.4;
    } else if (s.structure === "range") {
      up = w * 0.25;
      down = w * 0.25;
    }
    if (s.structureBreak && s.structure === "bullish") up += w * 0.1;
    if (s.structureBreak && s.structure === "bearish") down += w * 0.1;
    upScore += Math.min(up, w);
    downScore += Math.min(down, w);
    breakdown.push({
      component: "Market Structure",
      upContribution: round1(Math.min(up, w)),
      downContribution: round1(Math.min(down, w)),
      weight: w,
      note: `Structure: ${s.structure ?? "n/a"}${s.structureBreak ? " (structure break)" : ""}`,
    });
  }

  // --- Momentum (15) ---
  {
    const w = weights.momentum;
    const m = inputs.momentumScore ?? 0; // -100..100
    const up = m > 0 ? w * Math.min(1, m / 60) : 0;
    const down = m < 0 ? w * Math.min(1, -m / 60) : 0;
    upScore += up;
    downScore += down;
    breakdown.push({
      component: "Momentum",
      upContribution: round1(up),
      downContribution: round1(down),
      weight: w,
      note: `Momentum score: ${m.toFixed(1)}`,
    });
  }

  // --- Support / Resistance (15) ---
  {
    const w = weights.supportResistance;
    const sr = inputs.srContext || {};
    // Closer to support with room below resistance favors up; the inverse favors down.
    let up = 0;
    let down = 0;
    if (sr.distanceToSupportPercent !== null && sr.distanceToSupportPercent !== undefined) {
      if (sr.distanceToSupportPercent < 0.5) up += w * 0.5; // sitting right on support = bullish reaction zone
    }
    if (sr.distanceToResistancePercent !== null && sr.distanceToResistancePercent !== undefined) {
      if (sr.distanceToResistancePercent < 0.5) down += w * 0.5; // sitting right under resistance = bearish reaction zone
    }
    if (sr.aboveAllResistance) up += w * 0.5;
    if (sr.belowAllSupport) down += w * 0.5;
    upScore += Math.min(up, w);
    downScore += Math.min(down, w);
    breakdown.push({
      component: "Support/Resistance",
      upContribution: round1(Math.min(up, w)),
      downContribution: round1(Math.min(down, w)),
      weight: w,
      note: sr.note || "Price positioned relative to nearest zones",
    });
  }

  // --- Breakout / Breakdown (15) ---
  {
    const w = weights.breakoutBreakdown;
    const bo = inputs.breakout || {};
    const bd = inputs.breakdown || {};
    let up = 0;
    let down = 0;
    if (bo.status === "confirmed") up = w;
    else if (bo.status === "possible") up = w * 0.4;
    else if (bo.status === "false-breakout") down = w * 0.3; // failed breakout is itself a bearish tell

    if (bd.status === "confirmed") down = Math.max(down, w);
    else if (bd.status === "possible") down = Math.max(down, w * 0.4);
    else if (bd.status === "false-breakdown") up = Math.max(up, w * 0.3);

    upScore += up;
    downScore += down;
    breakdown.push({
      component: "Breakout/Breakdown",
      upContribution: round1(up),
      downContribution: round1(down),
      weight: w,
      note: `Breakout: ${bo.status ?? "none"}, Breakdown: ${bd.status ?? "none"}`,
    });
  }

  // --- Candle confirmation (5) - capped, confirmation only ---
  {
    const w = weights.candleConfirmation;
    const bias = inputs.candlePattern?.bias ?? 0; // -1..1
    const up = bias > 0 ? w * bias : 0;
    const down = bias < 0 ? w * -bias : 0;
    upScore += up;
    downScore += down;
    breakdown.push({
      component: "Candle Confirmation",
      upContribution: round1(up),
      downContribution: round1(down),
      weight: w,
      note: inputs.candlePattern?.patterns?.length
        ? `Patterns: ${inputs.candlePattern.patterns.join(", ")}`
        : "No significant pattern",
    });
  }

  // --- Volatility (5) - normal/high volatility supports either direction; low volatility supports neither ---
  {
    const w = weights.volatility;
    const level = inputs.volatility?.level;
    let up = 0;
    let down = 0;
    if (level === "normal" || level === "high") {
      up = w * 0.5;
      down = w * 0.5;
    }
    upScore += up;
    downScore += down;
    breakdown.push({
      component: "Volatility",
      upContribution: round1(up),
      downContribution: round1(down),
      weight: w,
      note: `Volatility level: ${level ?? "unknown"}`,
    });
  }

  return {
    upScore: round1(clampScore(upScore)),
    downScore: round1(clampScore(downScore)),
    breakdown,
  };
}

function clampScore(v) {
  return Math.max(0, Math.min(100, v));
}
function round1(v) {
  return Math.round(v * 10) / 10;
}

/** Maps a confidence number to a letter quality grade per the configured thresholds. */
export function qualityGrade(confidence, thresholds) {
  const t = thresholds || { Aplus: 85, A: 75, B: 65, C: 55 };
  if (confidence >= t.Aplus) return "A+";
  if (confidence >= t.A) return "A";
  if (confidence >= t.B) return "B";
  if (confidence >= t.C) return "C";
  return "WAIT";
}
