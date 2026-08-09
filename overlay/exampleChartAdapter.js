/**
 * exampleChartAdapter.js
 *
 * EXAMPLE ONLY. This shows the shape of a real ChartDataProvider
 * implementation for a hypothetical, permitted integration target. It does
 * NOT target any real website, does NOT bypass authentication, does NOT
 * touch any protected/authenticated API, and does NOT circumvent anti-bot
 * protection. It only reads data that is already rendered in the DOM of a
 * page the user is legitimately viewing (e.g. numbers printed in the page's
 * own visible markup) - the same thing a user's own eyes can already see.
 *
 * To integrate with a real, permitted site:
 *   1. Confirm you are allowed to do this (site terms of service, robots
 *      policy, and applicable law/contract).
 *   2. Replace the selectors below with the real page's DOM structure.
 *   3. Replace parseRowToCandle() with real parsing logic for that page.
 *   4. Keep everything else the same - the SignalEngine and UI never need
 *      to know where candles came from.
 */
import { ChartDataProvider } from "./chartDataProvider.js";

const DEFAULT_SELECTORS = {
  // CSS selector for a container holding rows/elements that represent candles.
  candleRowContainer: "[data-example-candle-table]",
  candleRow: "[data-example-candle-row]",
  // Attribute names expected on each row element (placeholders).
  attr: {
    timestamp: "data-ts",
    open: "data-open",
    high: "data-high",
    low: "data-low",
    close: "data-close",
    volume: "data-volume",
  },
  // Selector for a single "last price" element, if the page exposes one.
  currentPriceEl: "[data-example-last-price]",
  timeframeEl: "[data-example-timeframe]",
};

export class ExampleChartAdapter extends ChartDataProvider {
  /**
   * @param {Object} config
   * @param {Partial<typeof DEFAULT_SELECTORS>} [config.selectors]
   * @param {number} [config.pollIntervalMs=1000]
   * @param {Document} [config.document=window.document]
   */
  constructor(config = {}) {
    super();
    this.selectors = { ...DEFAULT_SELECTORS, ...(config.selectors || {}) };
    this.pollIntervalMs = config.pollIntervalMs ?? 1000;
    this.doc = config.document || (typeof document !== "undefined" ? document : null);
    this.listeners = new Set();
    this._pollHandle = null;
    this._lastSerialized = null;
  }

  getCandles() {
    if (!this.doc) return [];
    const container = this.doc.querySelector(this.selectors.candleRowContainer);
    if (!container) return [];
    const rows = Array.from(container.querySelectorAll(this.selectors.candleRow));
    return rows.map((row) => this._parseRowToCandle(row)).filter(Boolean);
  }

  getCurrentPrice() {
    if (!this.doc) return null;
    const el = this.doc.querySelector(this.selectors.currentPriceEl);
    if (!el) return null;
    const value = parseFloat(el.textContent.replace(/,/g, ""));
    return Number.isFinite(value) ? value : null;
  }

  getTimeframe() {
    if (!this.doc) return null;
    const el = this.doc.querySelector(this.selectors.timeframeEl);
    return el ? el.textContent.trim() : null;
  }

  subscribe(callback) {
    this.listeners.add(callback);
    if (!this._pollHandle) {
      this._pollHandle = setInterval(() => this._checkForChanges(), this.pollIntervalMs);
    }
    return () => this.unsubscribe(callback);
  }

  unsubscribe(callback) {
    this.listeners.delete(callback);
    if (this.listeners.size === 0 && this._pollHandle) {
      clearInterval(this._pollHandle);
      this._pollHandle = null;
    }
  }

  _checkForChanges() {
    const candles = this.getCandles();
    const serialized = candles.length ? `${candles.length}:${candles[candles.length - 1].timestamp}` : "";
    if (serialized !== this._lastSerialized) {
      this._lastSerialized = serialized;
      for (const cb of this.listeners) cb(candles);
    }
  }

  _parseRowToCandle(row) {
    const a = this.selectors.attr;
    const num = (name) => {
      const raw = row.getAttribute(name);
      const v = raw === null ? NaN : parseFloat(raw);
      return Number.isFinite(v) ? v : null;
    };
    const timestamp = num(a.timestamp);
    const open = num(a.open);
    const high = num(a.high);
    const low = num(a.low);
    const close = num(a.close);
    const volume = num(a.volume);
    if ([timestamp, open, high, low, close].some((v) => v === null)) return null;
    const candle = { timestamp, open, high, low, close };
    if (volume !== null) candle.volume = volume;
    return candle;
  }
}
