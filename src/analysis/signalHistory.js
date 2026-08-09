/**
 * signalHistory.js
 *
 * Tracks generated signals over time and computes aggregate stats. This is
 * a plain in-memory class - persistence (localStorage) is wired up by
 * js/storage.js so this module stays storage-agnostic and testable.
 *
 * IMPORTANT: these stats describe past signals only. Nothing here should be
 * read as a guarantee about future performance - the UI is required to
 * display a disclaimer alongside these numbers (see ui/historyPanel.js).
 */
import { uid } from "../utils/helpers.js";

export class SignalHistory {
  constructor(initialRecords = []) {
    /** @type {Array<Object>} */
    this.records = [...initialRecords];
  }

  /**
   * @param {Object} signal - output of signalEngine.generateSignal()
   * @returns {Object} the stored record (with id + outcome fields)
   */
  add(signal) {
    const record = {
      id: uid("sig"),
      time: signal.time,
      signal: signal.decision, // "UP" | "DOWN" | "WAIT"
      confidence: signal.confidence,
      trend: signal.trend,
      breakout: signal.breakoutStatus,
      breakdown: signal.breakdownStatus,
      structure: signal.structure,
      grade: signal.grade,
      outcome: "PENDING", // "WIN" | "LOSS" | "NEUTRAL" | "PENDING"
      status: "OPEN",
    };
    this.records.push(record);
    return record;
  }

  setOutcome(id, outcome) {
    const record = this.records.find((r) => r.id === id);
    if (!record) return null;
    record.outcome = outcome;
    record.status = "CLOSED";
    return record;
  }

  all() {
    return this.records;
  }

  clear() {
    this.records = [];
  }

  /**
   * Aggregate statistics. Decided (non-PENDING, non-WAIT) signals are used
   * for win-rate math; WAIT signals are counted separately since they are
   * not trade calls.
   */
  computeStats() {
    const total = this.records.length;
    const up = this.records.filter((r) => r.signal === "UP").length;
    const down = this.records.filter((r) => r.signal === "DOWN").length;
    const wait = this.records.filter((r) => r.signal === "WAIT").length;

    const decided = this.records.filter(
      (r) => (r.signal === "UP" || r.signal === "DOWN") && r.outcome !== "PENDING"
    );
    const wins = decided.filter((r) => r.outcome === "WIN").length;
    const losses = decided.filter((r) => r.outcome === "LOSS").length;
    const neutral = decided.filter((r) => r.outcome === "NEUTRAL").length;

    const winRate = decided.length > 0 ? (wins / decided.length) * 100 : null;
    const avgConfidence =
      total > 0 ? this.records.reduce((s, r) => s + (r.confidence || 0), 0) / total : null;

    const falseSignals = this.records.filter(
      (r) => r.breakout === "false-breakout" || r.breakdown === "false-breakdown"
    ).length;
    const falseSignalRate = total > 0 ? (falseSignals / total) * 100 : null;

    // Max consecutive losses (in chronological order among decided trades).
    let maxConsecutiveLosses = 0;
    let running = 0;
    for (const r of decided) {
      if (r.outcome === "LOSS") {
        running += 1;
        maxConsecutiveLosses = Math.max(maxConsecutiveLosses, running);
      } else {
        running = 0;
      }
    }

    return {
      totalSignals: total,
      upSignals: up,
      downSignals: down,
      waitSignals: wait,
      winRate,
      wins,
      losses,
      neutral,
      avgConfidence,
      falseSignalRate,
      maxConsecutiveLosses,
    };
  }

  toJSON() {
    return this.records;
  }

  static fromJSON(records) {
    return new SignalHistory(Array.isArray(records) ? records : []);
  }
}
