/**
 * app.js
 *
 * Boots the static-hosted application: wires together data import, the
 * signal engine, the chart renderer, the floating overlay panel, the
 * signal card, settings, history, and backtesting. Everything here is
 * plain ES modules with relative imports, so this runs from any static
 * host (including a GitHub Pages project subdirectory) with no build step.
 */
import { SignalEngine } from "../src/analysis/signalEngine.js";
import { SignalHistory } from "../src/analysis/signalHistory.js";
import { calculateStandardEMASet } from "../src/analysis/ema.js";
import { ChartRenderer } from "../src/chart/chartRenderer.js";
import { StaticCandleProvider } from "../overlay/chartDataProvider.js";
import { OverlayPanel } from "../src/ui/overlayPanel.js";
import { createSignalCard, createOverlayReadout } from "../src/ui/signalCard.js";
import { createSettingsPanel } from "../src/ui/settingsPanel.js";
import { createHistoryPanel } from "../src/ui/historyPanel.js";
import { createDataImportPanel } from "../src/ui/dataImportPanel.js";
import { runBacktest } from "../src/backtest/backtestEngine.js";
import { generateSimulatedCandles } from "../src/data/simulatedAdapter.js";
import { loadSettings, saveSettings, loadSignalHistory, saveSignalHistory, loadPanelState, savePanelState } from "./storage.js";
import { settingsToEngineOptions, DEFAULT_SETTINGS } from "./config.js";
import { debounce } from "../src/utils/helpers.js";

class App {
  constructor() {
    this.settings = loadSettings();
    this.engine = new SignalEngine(settingsToEngineOptions(this.settings));
    this.history = SignalHistory.fromJSON(loadSignalHistory());
    this.provider = new StaticCandleProvider(generateSimulatedCandles({ count: 200, regime: "mixed" }));
    this.dataSourceLabel = "Simulated (mixed, 200 candles)";
    this.latestSignal = null;

    this._buildLayout();
    this._wireChart();
    this._wireOverlayPanel();
    this._wireTabs();
    this.provider.subscribe(() => this.runAnalysis());
    this.runAnalysis();
  }

  _buildLayout() {
    this.els = {
      chartCanvas: document.getElementById("sta-chart-canvas"),
      dataSourceLabel: document.getElementById("sta-data-source-label"),
      tabButtons: document.querySelectorAll(".sta-tabs__btn"),
      tabPanels: document.querySelectorAll(".sta-tabs__panel"),
      overlayMount: document.getElementById("sta-overlay-mount"),
      signalCardMount: document.getElementById("sta-signal-card-mount"),
      importMount: document.getElementById("sta-import-mount"),
      settingsMount: document.getElementById("sta-settings-mount"),
      historyMount: document.getElementById("sta-history-mount"),
      backtestMount: document.getElementById("sta-backtest-mount"),
      chartToggles: document.getElementById("sta-chart-toggles"),
    };
  }

  _wireChart() {
    this.chart = new ChartRenderer(this.els.chartCanvas, {
      showEma: this.settings.showEma,
      showSupportResistance: this.settings.showSupportResistance,
      showBreakoutMarkers: this.settings.showBreakoutMarkers,
      showSignalMarkers: this.settings.showSignalMarkers,
      candlesToShow: this.settings.candlesToShow,
    });

    const toggleDefs = [
      { key: "showEma", label: "EMA lines" },
      { key: "showSupportResistance", label: "S/R zones" },
      { key: "showBreakoutMarkers", label: "Breakout/breakdown markers" },
      { key: "showSignalMarkers", label: "Signal markers" },
    ];
    this.els.chartToggles.innerHTML = "";
    for (const def of toggleDefs) {
      const label = document.createElement("label");
      label.className = "sta-toggle";
      label.innerHTML = `<input type="checkbox" ${this.settings[def.key] ? "checked" : ""} /> ${def.label}`;
      label.querySelector("input").addEventListener("change", (e) => {
        this.settings[def.key] = e.target.checked;
        this.chart.setOptions({ [def.key]: e.target.checked });
        this.chart.render();
        saveSettings(this.settings);
      });
      this.els.chartToggles.appendChild(label);
    }
  }

  _wireOverlayPanel() {
    const savedPanelState = loadPanelState();
    this.overlayPanel = new OverlayPanel({
      mountTarget: this.els.overlayMount,
      title: "SMART ANALYZER",
      initialOpacity: savedPanelState?.opacity ?? 1,
    });
    if (savedPanelState?.compact) this.overlayPanel.toggleCompact(true);
    if (savedPanelState?.minimized) this.overlayPanel.toggleMinimize(true);

    this.overlayReadout = createOverlayReadout();
    this.overlayPanel.setBody(this.overlayReadout.el);
    this.overlayPanel.onChange(debounce((state) => savePanelState(state), 300));
  }

  _wireTabs() {
    this.els.tabButtons.forEach((btn) => {
      btn.addEventListener("click", () => {
        this.els.tabButtons.forEach((b) => b.classList.remove("is-active"));
        this.els.tabPanels.forEach((p) => (p.hidden = true));
        btn.classList.add("is-active");
        document.getElementById(`sta-tab-${btn.dataset.tab}`).hidden = false;
        if (btn.dataset.tab === "history") this.historyPanel?.refresh();
      });
    });

    // Signal card
    this.signalCard = createSignalCard();
    this.els.signalCardMount.appendChild(this.signalCard.el);

    // Data import
    const importPanel = createDataImportPanel((candles, label) => {
      this.provider.setCandles(candles);
      this.dataSourceLabel = label;
      this.els.dataSourceLabel.textContent = label;
      this.engine = new SignalEngine(settingsToEngineOptions(this.settings)); // fresh engine avoids stale anti-noise state across a full data swap
    });
    this.els.importMount.appendChild(importPanel);

    // Settings
    this._renderSettingsPanel();

    // History
    this.historyPanel = createHistoryPanel(this.history, {
      onOutcomeChange: () => saveSignalHistory(this.history.toJSON()),
    });
    this.els.historyMount.appendChild(this.historyPanel.el);

    // Backtest
    this._wireBacktestPanel();
  }

  _renderSettingsPanel() {
    this.els.settingsMount.innerHTML = "";
    const panel = createSettingsPanel(this.settings, (newSettings) => {
      this.settings = newSettings || { ...DEFAULT_SETTINGS };
      saveSettings(this.settings);
      this.engine.updateOptions(settingsToEngineOptions(this.settings));
      this.chart.setOptions({
        showEma: this.settings.showEma,
        showSupportResistance: this.settings.showSupportResistance,
        showBreakoutMarkers: this.settings.showBreakoutMarkers,
        showSignalMarkers: this.settings.showSignalMarkers,
        candlesToShow: this.settings.candlesToShow,
      });
      this.runAnalysis();
      if (!newSettings) this._renderSettingsPanel(); // re-render form with reset values
    });
    this.els.settingsMount.appendChild(panel);
  }

  _wireBacktestPanel() {
    const mount = this.els.backtestMount;
    mount.innerHTML = `
      <div class="sta-backtest__controls">
        <label>Hold period (candles)
          <input type="number" id="sta-bt-hold" value="${this.settings.backtestHoldCandles}" min="1" max="200" />
        </label>
        <label>Win threshold (%)
          <input type="number" id="sta-bt-win" value="${this.settings.backtestWinThresholdPercent}" step="0.01" min="0" />
        </label>
        <label>Loss threshold (%)
          <input type="number" id="sta-bt-loss" value="${this.settings.backtestLossThresholdPercent}" step="0.01" min="0" />
        </label>
        <button type="button" class="sta-btn sta-btn--primary" id="sta-bt-run">Run Backtest on Current Data</button>
      </div>
      <p class="sta-backtest__disclaimer">
        Historical simulation only. Signals are generated using only data available up to
        each point in time (no look-ahead). Past results do not guarantee future performance.
      </p>
      <div class="sta-backtest__results" id="sta-bt-results" hidden></div>
    `;

    mount.querySelector("#sta-bt-run").addEventListener("click", () => {
      const holdCandles = Number(mount.querySelector("#sta-bt-hold").value) || 10;
      const winThresholdPercent = Number(mount.querySelector("#sta-bt-win").value) || 0.15;
      const lossThresholdPercent = Number(mount.querySelector("#sta-bt-loss").value) || 0.15;

      const report = runBacktest(this.provider.getCandles(), {
        engineOptions: settingsToEngineOptions(this.settings),
        holdCandles,
        winThresholdPercent,
        lossThresholdPercent,
      });

      const resultsEl = mount.querySelector("#sta-bt-results");
      resultsEl.hidden = false;
      if (report.error) {
        resultsEl.innerHTML = `<p class="sta-import__status sta-import__status--error">${report.error}</p>`;
        return;
      }
      const s = report.summary;
      resultsEl.innerHTML = `
        <div class="sta-history__stats">
          <div class="sta-stat"><span>Signals</span><strong>${s.total}</strong></div>
          <div class="sta-stat"><span>Wins</span><strong>${s.wins}</strong></div>
          <div class="sta-stat"><span>Losses</span><strong>${s.losses}</strong></div>
          <div class="sta-stat"><span>Win Rate</span><strong>${s.winRate === null ? "n/a" : s.winRate.toFixed(1) + "%"}</strong></div>
          <div class="sta-stat"><span>Avg Return</span><strong>${s.avgReturn === null ? "n/a" : s.avgReturn.toFixed(2) + "%"}</strong></div>
          <div class="sta-stat"><span>Max Drawdown</span><strong>${s.maxDrawdown.toFixed(2)}%</strong></div>
          <div class="sta-stat"><span>Profit Factor</span><strong>${formatProfitFactor(s.profitFactor)}</strong></div>
        </div>
      `;
    });
  }

  runAnalysis() {
    const candles = this.provider.getCandles();
    const mtfContext = this.settings.useMultiTimeframe ? this._buildHigherTimeframeContext(candles) : {};
    const result = this.engine.analyze(candles, mtfContext);
    this.latestSignal = result;

    this.els.dataSourceLabel.textContent = this.dataSourceLabel;
    this.signalCard.update(result);
    this.overlayReadout.update(result);

    const emaSet = calculateStandardEMASet(candles);
    const markers = buildMarkers(candles, result);

    this.chart.setData({
      candles,
      emaLines: emaSet,
      supportZones: result.supportZones,
      resistanceZones: result.resistanceZones,
      markers,
    });
    this.chart.render();

    if (!result.suppressedByAntiNoise && candles.length >= this.settings.minCandles) {
      this.history.add(result);
      saveSignalHistory(this.history.toJSON());
      this.historyPanel?.refresh();
    }
  }

  /** Aggregates the current candles into a coarser "higher timeframe" to feed multi-timeframe confirmation. */
  _buildHigherTimeframeContext(candles) {
    const factor = 5;
    if (candles.length < factor * this.settings.minCandles) return {};
    const aggregated = [];
    for (let i = 0; i + factor <= candles.length; i += factor) {
      const chunk = candles.slice(i, i + factor);
      aggregated.push({
        timestamp: chunk[0].timestamp,
        open: chunk[0].open,
        high: Math.max(...chunk.map((c) => c.high)),
        low: Math.min(...chunk.map((c) => c.low)),
        close: chunk[chunk.length - 1].close,
        volume: chunk.every((c) => c.volume !== null) ? chunk.reduce((s, c) => s + c.volume, 0) : null,
      });
    }
    if (aggregated.length < this.settings.minCandles) return {};
    const higherEngine = new SignalEngine(settingsToEngineOptions(this.settings));
    const higherResult = higherEngine.analyze(aggregated);
    return { higherTimeframeTrend: higherResult.trend === "up" || higherResult.trend === "down" ? higherResult.trend : "sideways" };
  }
}

function buildMarkers(candles, result) {
  const markers = [];
  const lastIndex = candles.length - 1;
  if (result.breakoutStatus === "confirmed" || result.breakoutStatus === "possible") {
    markers.push({ index: lastIndex, type: "breakout" });
  }
  if (result.breakdownStatus === "confirmed" || result.breakdownStatus === "possible") {
    markers.push({ index: lastIndex, type: "breakdown" });
  }
  if (result.decision === "UP") markers.push({ index: lastIndex, type: "signal-up" });
  if (result.decision === "DOWN") markers.push({ index: lastIndex, type: "signal-down" });
  return markers;
}

function formatProfitFactor(pf) {
  if (pf === null) return "n/a";
  if (pf === Infinity) return "∞";
  return pf.toFixed(2);
}

window.addEventListener("DOMContentLoaded", () => {
  new App();
});
