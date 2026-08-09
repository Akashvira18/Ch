/**
 * chartDataProvider.js
 *
 * The generic contract every data source implements: file adapters,
 * simulated data, and (in the future) a live website adapter. Nothing in
 * the analysis engine or UI talks to a specific data source directly - it
 * only ever talks to something shaped like a ChartDataProvider. This is
 * what makes it possible to later drop the overlay into a browser
 * extension/userscript without touching the analysis or UI code.
 *
 * Concrete implementations: src/data/manualInputAdapter.js (wrapped),
 * src/data/simulatedAdapter.js (wrapped), src/data/futureDomAdapter.js,
 * src/data/futureCanvasAdapter.js.
 */
export class ChartDataProvider {
  /** @returns {Array<{timestamp:number, open:number, high:number, low:number, close:number, volume:number|null}>} */
  getCandles() {
    throw new Error("getCandles() not implemented");
  }

  /** @returns {number|null} */
  getCurrentPrice() {
    throw new Error("getCurrentPrice() not implemented");
  }

  /** @returns {string|null} e.g. "1m", "5m" */
  getTimeframe() {
    throw new Error("getTimeframe() not implemented");
  }

  /** @param {(candles: Array) => void} callback */
  subscribe(callback) {
    throw new Error("subscribe() not implemented");
  }

  /** @param {(candles: Array) => void} callback */
  unsubscribe(callback) {
    throw new Error("unsubscribe() not implemented");
  }
}

/**
 * Wraps a plain, static candle array (e.g. from a CSV/JSON upload or the
 * simulator) as a ChartDataProvider so the rest of the app can treat static
 * and live sources identically.
 */
export class StaticCandleProvider extends ChartDataProvider {
  constructor(candles = [], timeframe = null) {
    super();
    this._candles = candles;
    this._timeframe = timeframe;
    this._subscribers = [];
  }

  setCandles(candles) {
    this._candles = candles;
    this._subscribers.forEach((cb) => cb(this._candles));
  }

  appendCandle(candle) {
    this._candles = [...this._candles, candle];
    this._subscribers.forEach((cb) => cb(this._candles));
  }

  getCandles() {
    return this._candles;
  }

  getCurrentPrice() {
    return this._candles.length ? this._candles[this._candles.length - 1].close : null;
  }

  getTimeframe() {
    return this._timeframe;
  }

  subscribe(callback) {
    this._subscribers.push(callback);
  }

  unsubscribe(callback) {
    this._subscribers = this._subscribers.filter((cb) => cb !== callback);
  }
}
