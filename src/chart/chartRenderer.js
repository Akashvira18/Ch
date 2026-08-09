/**
 * chartRenderer.js
 *
 * A dependency-free canvas candlestick chart. Deliberately hand-rolled
 * rather than pulling in a heavy charting library, so the whole app has
 * zero npm/build requirements and works from a static GitHub Pages URL.
 * Draws candles, a grid, price/time scales, EMA overlay lines, support/
 * resistance zones, and breakout/breakdown/signal markers.
 *
 * Rendering is done on `requestAnimationFrame` and only redraws when
 * `render()` is explicitly called (event-driven, not a constant loop) to
 * keep this light on mobile battery/CPU.
 */
import { formatPrice, formatTime, clamp } from "../utils/helpers.js";

const PADDING = { top: 16, right: 64, bottom: 28, left: 8 };

export class ChartRenderer {
  /**
   * @param {HTMLCanvasElement} canvas
   * @param {Object} [options]
   */
  constructor(canvas, options = {}) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d");
    this.options = {
      showEma: true,
      showSupportResistance: true,
      showBreakoutMarkers: true,
      showSignalMarkers: true,
      candlesToShow: 90,
      theme: DEFAULT_THEME,
      ...options,
    };

    this.data = {
      candles: [],
      emaLines: {}, // { ema9: [...], ema21: [...], ema50: [...] }
      supportZones: [],
      resistanceZones: [],
      markers: [], // [{ index, type: 'breakout'|'breakdown'|'signal-up'|'signal-down', label }]
    };

    this._resizeObserver = new ResizeObserver(() => this._handleResize());
    this._resizeObserver.observe(canvas.parentElement || canvas);
    this._handleResize();
  }

  setOptions(partial) {
    this.options = { ...this.options, ...partial };
  }

  setData(data) {
    this.data = { ...this.data, ...data };
  }

  destroy() {
    this._resizeObserver.disconnect();
  }

  _handleResize() {
    const parent = this.canvas.parentElement || this.canvas;
    const dpr = window.devicePixelRatio || 1;
    const rect = parent.getBoundingClientRect();
    const width = Math.max(280, Math.floor(rect.width));
    const height = Math.max(220, Math.floor(rect.height));
    this.canvas.width = width * dpr;
    this.canvas.height = height * dpr;
    this.canvas.style.width = `${width}px`;
    this.canvas.style.height = `${height}px`;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.width = width;
    this.height = height;
    this.render();
  }

  render() {
    const { ctx, width, height } = this;
    if (!width || !height) return;
    const theme = this.options.theme;
    const candles = this.data.candles.slice(-this.options.candlesToShow);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = theme.background;
    ctx.fillRect(0, 0, width, height);

    if (candles.length < 2) {
      this._drawEmptyState(theme);
      return;
    }

    const plotWidth = width - PADDING.left - PADDING.right;
    const plotHeight = height - PADDING.top - PADDING.bottom;
    const candleSlotWidth = plotWidth / candles.length;
    const candleBodyWidth = Math.max(1, candleSlotWidth * 0.6);

    const { min, max } = this._priceRange(candles);
    const yFor = (price) => PADDING.top + (1 - (price - min) / (max - min || 1)) * plotHeight;
    const xFor = (i) => PADDING.left + i * candleSlotWidth + candleSlotWidth / 2;

    this._drawGrid(theme, plotWidth, plotHeight, min, max, yFor);
    if (this.options.showSupportResistance) this._drawZones(theme, plotWidth, min, max, yFor);
    this._drawCandles(candles, theme, xFor, yFor, candleBodyWidth);
    if (this.options.showEma) this._drawEmaLines(candles, theme, xFor, yFor);
    if (this.options.showBreakoutMarkers || this.options.showSignalMarkers) {
      this._drawMarkers(candles, xFor, yFor, theme);
    }
    this._drawPriceScale(theme, min, max, yFor, plotWidth);
    this._drawTimeScale(candles, theme, xFor, plotHeight);
  }

  _priceRange(candles) {
    let min = Infinity;
    let max = -Infinity;
    for (const c of candles) {
      if (c.low < min) min = c.low;
      if (c.high > max) max = c.high;
    }
    const padding = (max - min) * 0.08 || max * 0.01 || 1;
    return { min: min - padding, max: max + padding };
  }

  _drawGrid(theme, plotWidth, plotHeight, min, max, yFor) {
    const { ctx } = this;
    ctx.strokeStyle = theme.grid;
    ctx.lineWidth = 1;
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const price = min + ((max - min) * i) / steps;
      const y = yFor(price);
      ctx.beginPath();
      ctx.moveTo(PADDING.left, y);
      ctx.lineTo(PADDING.left + plotWidth, y);
      ctx.stroke();
    }
  }

  _drawZones(theme, plotWidth, min, max, yFor) {
    const { ctx } = this;
    const drawZoneSet = (zones, color) => {
      for (const zone of zones) {
        if (zone.high < min || zone.low > max) continue;
        const yTop = yFor(zone.high);
        const yBottom = yFor(zone.low);
        ctx.fillStyle = color;
        ctx.fillRect(PADDING.left, yTop, plotWidth, Math.max(1, yBottom - yTop));
      }
    };
    drawZoneSet(this.data.resistanceZones || [], theme.resistanceZone);
    drawZoneSet(this.data.supportZones || [], theme.supportZone);
  }

  _drawCandles(candles, theme, xFor, yFor, bodyWidth) {
    const { ctx } = this;
    candles.forEach((c, i) => {
      const x = xFor(i);
      const isUp = c.close >= c.open;
      const color = isUp ? theme.bullish : theme.bearish;
      ctx.strokeStyle = color;
      ctx.fillStyle = color;
      ctx.lineWidth = 1;

      // Wick
      ctx.beginPath();
      ctx.moveTo(x, yFor(c.high));
      ctx.lineTo(x, yFor(c.low));
      ctx.stroke();

      // Body
      const yOpen = yFor(c.open);
      const yClose = yFor(c.close);
      const top = Math.min(yOpen, yClose);
      const bodyHeight = Math.max(1, Math.abs(yClose - yOpen));
      ctx.fillRect(x - bodyWidth / 2, top, bodyWidth, bodyHeight);
    });
  }

  _drawEmaLines(candles, theme, xFor, yFor) {
    const { ctx } = this;
    const totalLen = this.data.candles.length;
    const offset = totalLen - candles.length;
    const lineDefs = [
      { key: "ema9", color: theme.ema9 },
      { key: "ema21", color: theme.ema21 },
      { key: "ema50", color: theme.ema50 },
    ];

    for (const def of lineDefs) {
      const series = this.data.emaLines[def.key];
      if (!series) continue;
      ctx.strokeStyle = def.color;
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      let started = false;
      candles.forEach((_, i) => {
        const value = series[offset + i];
        if (value === null || value === undefined) return;
        const x = xFor(i);
        const y = yFor(value);
        if (!started) {
          ctx.moveTo(x, y);
          started = true;
        } else {
          ctx.lineTo(x, y);
        }
      });
      ctx.stroke();
    }
  }

  _drawMarkers(candles, xFor, yFor, theme) {
    const { ctx } = this;
    const totalLen = this.data.candles.length;
    const offset = totalLen - candles.length;

    for (const marker of this.data.markers || []) {
      const localIndex = marker.index - offset;
      if (localIndex < 0 || localIndex >= candles.length) continue;
      const candle = candles[localIndex];
      const x = xFor(localIndex);

      if (marker.type === "breakout" && this.options.showBreakoutMarkers) {
        this._drawTriangleMarker(x, yFor(candle.high) - 10, theme.bullish, "up");
      } else if (marker.type === "breakdown" && this.options.showBreakoutMarkers) {
        this._drawTriangleMarker(x, yFor(candle.low) + 10, theme.bearish, "down");
      } else if (marker.type === "signal-up" && this.options.showSignalMarkers) {
        this._drawDotMarker(x, yFor(candle.low) + 14, theme.bullish);
      } else if (marker.type === "signal-down" && this.options.showSignalMarkers) {
        this._drawDotMarker(x, yFor(candle.high) - 14, theme.bearish);
      }
    }
  }

  _drawTriangleMarker(x, y, color, direction) {
    const { ctx } = this;
    const size = 6;
    ctx.fillStyle = color;
    ctx.beginPath();
    if (direction === "up") {
      ctx.moveTo(x, y - size);
      ctx.lineTo(x - size, y + size);
      ctx.lineTo(x + size, y + size);
    } else {
      ctx.moveTo(x, y + size);
      ctx.lineTo(x - size, y - size);
      ctx.lineTo(x + size, y - size);
    }
    ctx.closePath();
    ctx.fill();
  }

  _drawDotMarker(x, y, color) {
    const { ctx } = this;
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(x, y, 4, 0, Math.PI * 2);
    ctx.fill();
  }

  _drawPriceScale(theme, min, max, yFor, plotWidth) {
    const { ctx } = this;
    ctx.fillStyle = theme.text;
    ctx.font = "11px -apple-system, system-ui, sans-serif";
    ctx.textAlign = "left";
    const steps = 5;
    for (let i = 0; i <= steps; i++) {
      const price = min + ((max - min) * i) / steps;
      const y = yFor(price);
      ctx.fillText(formatPrice(price), PADDING.left + plotWidth + 6, y + 4);
    }
  }

  _drawTimeScale(candles, theme, xFor, plotHeight) {
    const { ctx } = this;
    ctx.fillStyle = theme.textMuted;
    ctx.font = "10px -apple-system, system-ui, sans-serif";
    ctx.textAlign = "center";
    const labelEvery = Math.max(1, Math.floor(candles.length / 5));
    candles.forEach((c, i) => {
      if (i % labelEvery !== 0) return;
      ctx.fillText(formatTime(c.timestamp), xFor(i), PADDING.top + plotHeight + 18);
    });
  }

  _drawEmptyState(theme) {
    const { ctx, width, height } = this;
    ctx.fillStyle = theme.textMuted;
    ctx.font = "13px -apple-system, system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("Load candle data to see the chart", width / 2, height / 2);
  }
}

export const DEFAULT_THEME = {
  background: "#0b0e14",
  grid: "rgba(255,255,255,0.06)",
  text: "#c6ccd6",
  textMuted: "#6b7280",
  bullish: "#26a69a",
  bearish: "#ef5350",
  ema9: "#f5c542",
  ema21: "#42a5f5",
  ema50: "#ab47bc",
  supportZone: "rgba(38,166,154,0.14)",
  resistanceZone: "rgba(239,83,80,0.14)",
};
