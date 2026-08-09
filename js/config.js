/**
 * config.js
 *
 * Central default configuration for the whole app. This is the single
 * source of truth the settings panel edits and storage.js persists -
 * everything else should read settings through this shape rather than
 * hard-coding numbers.
 */
import { DEFAULT_WEIGHTS } from "../src/analysis/scoring.js";

export const DEFAULT_SETTINGS = {
  // Indicator periods
  emaPeriods: "9,21,50,200",
  smaPeriods: "20,50,200",
  rsiPeriod: 14,
  macdFast: 12,
  macdSlow: 26,
  macdSignal: 9,
  atrPeriod: 14,

  // Structure / S&R
  swingStrength: 3,
  lookbackSwings: 4,
  srClusterToleranceATR: 0.35,

  // Signal engine
  minCandles: 60,
  minConfidence: 55,
  hysteresisBand: 6,
  cooldownCandles: 3,
  requireClosedCandle: true,
  breakoutThresholdPercent: 0.05,
  breakdownThresholdPercent: 0.05,
  useMultiTimeframe: false,

  // Quality grading thresholds
  qualityThresholds: { Aplus: 85, A: 75, B: 65, C: 55 },

  // Scoring weights (must total 100 - the settings panel warns otherwise)
  weights: { ...DEFAULT_WEIGHTS },

  // Chart / UI toggles
  showEma: true,
  showSupportResistance: true,
  showBreakoutMarkers: true,
  showSignalMarkers: true,
  candlesToShow: 90,

  // Backtest defaults
  backtestHoldCandles: 10,
  backtestWinThresholdPercent: 0.15,
  backtestLossThresholdPercent: 0.15,
};

/** Converts flat settings into the nested shape SignalEngine expects. */
export function settingsToEngineOptions(settings) {
  return {
    minCandles: settings.minCandles,
    minConfidence: settings.minConfidence,
    hysteresisBand: settings.hysteresisBand,
    cooldownCandles: settings.cooldownCandles,
    requireClosedCandle: settings.requireClosedCandle,
    swingStrength: settings.swingStrength,
    lookbackSwings: settings.lookbackSwings,
    clusterToleranceATR: settings.srClusterToleranceATR,
    weights: settings.weights,
    qualityThresholds: settings.qualityThresholds,
    breakout: { breakoutThresholdPercent: settings.breakoutThresholdPercent },
    breakdown: { breakdownThresholdPercent: settings.breakdownThresholdPercent },
  };
}

export const STORAGE_KEYS = {
  settings: "sta_settings_v1",
  signalHistory: "sta_signal_history_v1",
  panelState: "sta_panel_state_v1",
};
