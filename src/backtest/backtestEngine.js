/**
 * backtestEngine.js
 *
 * Replays historical candles one at a time through a FRESH SignalEngine
 * instance, feeding it only `candles[0..i]` at each step - never the full
 * dataset - so indicators, support/resistance, and signals are computed
 * exactly as they would have been in real time. This is the load-bearing
 * guarantee against look-ahead bias.
 *
 * Outcome evaluation happens strictly forward: for a signal generated at
 * index i, the "future" window is candles[i+1 .. i+holdCandles], which is
 * fine because that data is only used AFTER the signal for that index has
 * already been recorded - it is never fed back into the engine's inputs.
 *
 * Clearly label any output from this module as historical simulation - see
 * ui usage in js/app.js and docs/backtesting.md.
 */
import { SignalEngine } from "../analysis/signalEngine.js";
import { sanitizeCandles, hasSufficientData } from "../analysis/validation.js";

/**
 * @param {Array} rawCandles - full historical dataset
 * @param {Object} options
 * @param {Object} [options.engineOptions] - passed to `new SignalEngine()`
 * @param {number} [options.holdCandles=10] - how many candles forward to measure the outcome over
 * @param {number} [options.winThresholdPercent=0.15] - min favorable move (%) to count as a WIN
 * @param {number} [options.lossThresholdPercent=0.15] - min adverse move (%) to count as a LOSS
 * @returns {Object} backtest report
 */
export function runBacktest(rawCandles, options = {}) {
  const {
    engineOptions = {},
    holdCandles = 10,
    winThresholdPercent = 0.15,
    lossThresholdPercent = 0.15,
  } = options;

  const { candles } = sanitizeCandles(rawCandles);
  const minRequired = (engineOptions.minCandles || 60) + 1;

  if (!hasSufficientData(candles, minRequired)) {
    return {
      signals: [],
      summary: emptySummary(),
      error: `Insufficient data for backtest: need at least ${minRequired} candles, have ${candles.length}.`,
    };
  }

  const engine = new SignalEngine(engineOptions);
  const signals = [];

  // Start once the engine has its minimum required window, and stop early
  // enough that every signal has a full forward-looking window to evaluate.
  const start = engine.options.minCandles;
  const end = candles.length - 1;

  for (let i = start; i <= end; i++) {
    const windowCandles = candles.slice(0, i + 1); // only data up to and including candle i
    const result = engine.analyze(windowCandles);

    if (result.decision === "WAIT" || result.suppressedByAntiNoise) continue;

    const outcome = evaluateOutcome(candles, i, holdCandles, result.decision, winThresholdPercent, lossThresholdPercent);
    signals.push({
      index: i,
      time: result.time,
      decision: result.decision,
      confidence: result.confidence,
      grade: result.grade,
      entryPrice: candles[i].close,
      ...outcome,
    });
  }

  return { signals, summary: summarize(signals) };
}

/**
 * Looks forward from index `i` (exclusive) up to `holdCandles` candles and
 * classifies the outcome as WIN/LOSS/NEUTRAL based on which threshold the
 * price reaches first, and computes the realized return at the end of the
 * hold period regardless.
 */
function evaluateOutcome(candles, i, holdCandles, decision, winThresholdPercent, lossThresholdPercent) {
  const entry = candles[i].close;
  const forwardEnd = Math.min(candles.length - 1, i + holdCandles);
  const forwardWindow = candles.slice(i + 1, forwardEnd + 1);

  if (forwardWindow.length === 0) {
    return { outcome: "NEUTRAL", returnPercent: 0, exitPrice: entry, candlesHeld: 0 };
  }

  let outcome = "NEUTRAL";
  for (const candle of forwardWindow) {
    const favorableMove = decision === "UP"
      ? ((candle.high - entry) / entry) * 100
      : ((entry - candle.low) / entry) * 100;
    const adverseMove = decision === "UP"
      ? ((entry - candle.low) / entry) * 100
      : ((candle.high - entry) / entry) * 100;

    if (favorableMove >= winThresholdPercent) {
      outcome = "WIN";
      break;
    }
    if (adverseMove >= lossThresholdPercent) {
      outcome = "LOSS";
      break;
    }
  }

  const exitCandle = forwardWindow[forwardWindow.length - 1];
  const exitPrice = exitCandle.close;
  const returnPercent = decision === "UP"
    ? ((exitPrice - entry) / entry) * 100
    : ((entry - exitPrice) / entry) * 100;

  return { outcome, returnPercent, exitPrice, candlesHeld: forwardWindow.length };
}

function summarize(signals) {
  const total = signals.length;
  const wins = signals.filter((s) => s.outcome === "WIN").length;
  const losses = signals.filter((s) => s.outcome === "LOSS").length;
  const neutral = signals.filter((s) => s.outcome === "NEUTRAL").length;
  const winRate = total > 0 ? (wins / total) * 100 : null;
  const avgReturn = total > 0 ? signals.reduce((s, sig) => s + sig.returnPercent, 0) / total : null;

  // Max drawdown across the sequential equity curve of returns (simple sum, not compounded).
  let equity = 0;
  let peak = 0;
  let maxDrawdown = 0;
  for (const s of signals) {
    equity += s.returnPercent;
    peak = Math.max(peak, equity);
    maxDrawdown = Math.max(maxDrawdown, peak - equity);
  }

  const grossWin = signals.filter((s) => s.returnPercent > 0).reduce((sum, s) => sum + s.returnPercent, 0);
  const grossLoss = Math.abs(signals.filter((s) => s.returnPercent < 0).reduce((sum, s) => sum + s.returnPercent, 0));
  const profitFactor = grossLoss > 0 ? grossWin / grossLoss : total > 0 ? Infinity : null;

  return { total, wins, losses, neutral, winRate, avgReturn, maxDrawdown, profitFactor };
}

function emptySummary() {
  return { total: 0, wins: 0, losses: 0, neutral: 0, winRate: null, avgReturn: null, maxDrawdown: 0, profitFactor: null };
}
