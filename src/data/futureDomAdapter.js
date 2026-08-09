/**
 * futureDomAdapter.js
 *
 * INTERFACE STUB - intentionally not wired to any specific website.
 *
 * This defines the shape a "read candles from the host page's own DOM"
 * adapter would implement once the overlay is embedded on a permitted site
 * (see /overlay/README.md for the extension/userscript integration story).
 *
 * It implements the ChartDataProvider contract (see overlay/chartDataProvider.js)
 * so the rest of the app never needs to know whether data came from a file
 * upload, a simulation, or a live page.
 *
 * IMPORTANT / SCOPE LIMITS:
 *  - This adapter must only ever read data that is already rendered and
 *    visible to the user in the page's own DOM (e.g. a visible price table
 *    or ticker element). It must never attempt to bypass authentication,
 *    rate limits, or anti-automation protections, and must never call
 *    private/internal APIs that are not intended for this kind of access.
 *  - Selector configuration is left empty here on purpose. Fill in
 *    `selectors` only for a site where you have the legal right to do so
 *    (e.g. your own account, or a site whose terms explicitly allow it).
 */
import { ChartDataProvider } from "../../overlay/chartDataProvider.js";

export class FutureDomAdapter extends ChartDataProvider {
  /**
   * @param {Object} config
   * @param {Object} config.selectors - CSS selectors for the host page's DOM.
   *   Left as null placeholders - see overlay/README.md "Adding a site adapter".
   * @param {number} [config.pollIntervalMs=1000]
   */
  constructor(config = {}) {
    super();
    this.selectors = config.selectors || {
      priceElement: null, // e.g. '.ticker-price' - fill in for a permitted site
      candleRows: null, // e.g. '.ohlc-table tbody tr'
      timeframeIndicator: null, // e.g. '.timeframe-selector .active'
    };
    this.pollIntervalMs = config.pollIntervalMs || 1000;
    this._subscribers = [];
    this._pollHandle = null;
    this._candles = [];
  }

  /** @returns {Array} the most recently read candle set. */
  getCandles() {
    if (!this.selectors.candleRows) {
      throw new Error(
        "FutureDomAdapter has no `candleRows` selector configured. " +
          "This adapter is a template - configure selectors for a specific, permitted site before use."
      );
    }
    return this._readCandlesFromDom();
  }

  getCurrentPrice() {
    if (!this.selectors.priceElement) return null;
    const el = document.querySelector(this.selectors.priceElement);
    if (!el) return null;
    const parsed = parseFloat(el.textContent.replace(/[^0-9.-]/g, ""));
    return Number.isFinite(parsed) ? parsed : null;
  }

  getTimeframe() {
    if (!this.selectors.timeframeIndicator) return null;
    const el = document.querySelector(this.selectors.timeframeIndicator);
    return el ? el.textContent.trim() : null;
  }

  subscribe(callback) {
    this._subscribers.push(callback);
    if (!this._pollHandle) {
      this._pollHandle = setInterval(() => {
        try {
          const candles = this.getCandles();
          this._subscribers.forEach((cb) => cb(candles));
        } catch (err) {
          // Swallow per-poll errors so a transient DOM change doesn't kill the loop.
          console.warn("[FutureDomAdapter] poll failed:", err.message);
        }
      }, this.pollIntervalMs);
    }
  }

  unsubscribe(callback) {
    this._subscribers = this._subscribers.filter((cb) => cb !== callback);
    if (this._subscribers.length === 0 && this._pollHandle) {
      clearInterval(this._pollHandle);
      this._pollHandle = null;
    }
  }

  _readCandlesFromDom() {
    // Placeholder reference implementation: expects each row to expose
    // data-* attributes. Replace with real parsing logic for your target
    // page's actual markup once selectors are configured.
    const rows = document.querySelectorAll(this.selectors.candleRows);
    const candles = [];
    rows.forEach((row) => {
      const timestamp = Number(row.dataset.timestamp);
      const open = Number(row.dataset.open);
      const high = Number(row.dataset.high);
      const low = Number(row.dataset.low);
      const close = Number(row.dataset.close);
      const volume = row.dataset.volume ? Number(row.dataset.volume) : null;
      if ([timestamp, open, high, low, close].every(Number.isFinite)) {
        candles.push({ timestamp, open, high, low, close, volume });
      }
    });
    this._candles = candles;
    return candles;
  }
}
