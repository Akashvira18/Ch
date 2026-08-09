/**
 * futureCanvasAdapter.js
 *
 * INTERFACE STUB - for host pages that render their chart to a <canvas>
 * with no accessible DOM/data layer. Rather than pixel-scraping (fragile
 * and easy to get wrong), this adapter's contract assumes the host page
 * (or a permitted browser extension content script with appropriate
 * access) exposes a structured data hook - e.g. the page's own chart
 * library instance, or a postMessage bridge - and this class simply
 * normalizes whatever that hook returns into the app's Candle shape.
 *
 * This file intentionally contains NO logic that reads canvas pixels,
 * intercepts network requests, or defeats any protection mechanism. See
 * overlay/README.md for the supported integration patterns.
 */
import { ChartDataProvider } from "../../overlay/chartDataProvider.js";

export class FutureCanvasAdapter extends ChartDataProvider {
  /**
   * @param {Object} config
   * @param {() => Array|null} [config.dataHook] - function that returns the
   *   host page's current candle array (e.g. reading a chart library's
   *   public `.data()` API, or a value bridged via `window.postMessage`
   *   from a content script the user has knowingly installed).
   * @param {number} [config.pollIntervalMs=1000]
   */
  constructor(config = {}) {
    super();
    this.dataHook = typeof config.dataHook === "function" ? config.dataHook : null;
    this.pollIntervalMs = config.pollIntervalMs || 1000;
    this._subscribers = [];
    this._pollHandle = null;
  }

  getCandles() {
    if (!this.dataHook) {
      throw new Error(
        "FutureCanvasAdapter has no dataHook configured. Provide a function that " +
          "returns structured candle data from the host page (e.g. via a chart " +
          "library's public API or an explicit postMessage bridge)."
      );
    }
    const raw = this.dataHook();
    return Array.isArray(raw) ? raw : [];
  }

  getCurrentPrice() {
    const candles = this.getCandles();
    return candles.length ? candles[candles.length - 1].close : null;
  }

  getTimeframe() {
    return null; // Host-specific - override in a concrete site adapter if available.
  }

  subscribe(callback) {
    this._subscribers.push(callback);
    if (!this._pollHandle) {
      this._pollHandle = setInterval(() => {
        try {
          callback(this.getCandles());
        } catch (err) {
          console.warn("[FutureCanvasAdapter] poll failed:", err.message);
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
}

/**
 * Example postMessage bridge helper: a permitted content script running on
 * the host page can `window.postMessage({ type: "SMART_ANALYZER_CANDLES", candles }, "*")`
 * and this helper turns that into a dataHook for FutureCanvasAdapter.
 */
export function createPostMessageDataHook(messageType = "SMART_ANALYZER_CANDLES") {
  let latest = [];
  window.addEventListener("message", (event) => {
    if (event.data && event.data.type === messageType && Array.isArray(event.data.candles)) {
      latest = event.data.candles;
    }
  });
  return () => latest;
}
