/**
 * overlay.js
 *
 * Generic, host-page-agnostic bootstrap for the floating analyzer overlay.
 * This is the piece that a future browser extension content script or a
 * Violentmonkey/Tampermonkey userscript would call after providing a
 * concrete ChartDataProvider (a live site adapter, or one of the adapters
 * in /src/data/). It has ZERO knowledge of any specific trading website.
 *
 * Usage (see README.md in this folder for the full integration guide):
 *
 *   import { mountOverlay } from "./overlay.js";
 *   import { ExampleChartAdapter } from "./exampleChartAdapter.js";
 *
 *   const provider = new ExampleChartAdapter({ selectors: { ... } });
 *   const handle = mountOverlay({ provider });
 *
 *   // later, to remove it:
 *   handle.destroy();
 */
import { SignalEngine, DEFAULT_ENGINE_OPTIONS } from "../src/analysis/signalEngine.js";
import { OverlayPanel } from "../src/ui/overlayPanel.js";
import { createOverlayReadout } from "../src/ui/signalCard.js";

/**
 * @param {Object} config
 * @param {import("./chartDataProvider.js").ChartDataProvider} config.provider
 * @param {Object} [config.engineOptions] - overrides for SignalEngine options
 * @param {HTMLElement} [config.mountTarget=document.body]
 * @param {number} [config.pollIntervalMs=null] - if the provider doesn't push
 *   updates via subscribe(), poll it on an interval instead
 * @returns {{ panel: OverlayPanel, engine: SignalEngine, destroy: () => void }}
 */
export function mountOverlay(config) {
  const { provider, engineOptions = {}, mountTarget = document.body, pollIntervalMs = null } = config;
  if (!provider) throw new Error("mountOverlay requires a ChartDataProvider `provider`.");

  injectOverlayStyles();

  const engine = new SignalEngine({ ...DEFAULT_ENGINE_OPTIONS, ...engineOptions });
  const panel = new OverlayPanel({ mountTarget, title: "SMART ANALYZER" });
  const readout = createOverlayReadout();
  panel.setBody(readout.el);

  const update = () => {
    let candles;
    try {
      candles = provider.getCandles();
    } catch (err) {
      console.warn("[overlay] provider.getCandles() failed:", err.message);
      return;
    }
    if (!Array.isArray(candles) || candles.length === 0) return;
    const result = engine.analyze(candles);
    readout.update(result);
  };

  provider.subscribe(update);
  update();

  let pollHandle = null;
  if (pollIntervalMs) {
    pollHandle = setInterval(update, pollIntervalMs);
  }

  return {
    panel,
    engine,
    destroy() {
      provider.unsubscribe(update);
      if (pollHandle) clearInterval(pollHandle);
      panel.destroy();
    },
  };
}

let stylesInjected = false;
function injectOverlayStyles() {
  if (stylesInjected) return;
  stylesInjected = true;
  const link = document.createElement("link");
  link.rel = "stylesheet";
  // Resolve relative to this module so it works regardless of the host page's own base URL.
  link.href = new URL("./overlay.css", import.meta.url).href;
  document.head.appendChild(link);
}
