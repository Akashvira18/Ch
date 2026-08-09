/**
 * dataImportPanel.js
 *
 * The "Data Import" UI: upload CSV, upload JSON, paste OHLC text, or
 * generate simulated candles. Delegates actual parsing to the adapters in
 * /src/data/ - this module is pure UI wiring plus basic user feedback.
 */
import { parseCSVFile } from "../data/csvAdapter.js";
import { parseJSONFile } from "../data/jsonAdapter.js";
import { parseManualInput, manualInputTemplate } from "../data/manualInputAdapter.js";
import { generateSimulatedCandles } from "../data/simulatedAdapter.js";

/**
 * @param {(candles: Array, sourceLabel: string) => void} onCandlesLoaded
 */
export function createDataImportPanel(onCandlesLoaded) {
  const el = document.createElement("div");
  el.className = "sta-import";
  el.innerHTML = `
    <div class="sta-import__tabs" role="tablist">
      <button type="button" class="sta-import__tab is-active" data-tab="csv">CSV</button>
      <button type="button" class="sta-import__tab" data-tab="json">JSON</button>
      <button type="button" class="sta-import__tab" data-tab="paste">Paste</button>
      <button type="button" class="sta-import__tab" data-tab="simulate">Simulate</button>
    </div>

    <div class="sta-import__panel" data-panel="csv">
      <input type="file" accept=".csv,text/csv" data-input="csv-file" />
      <p class="sta-import__hint">Format: timestamp,open,high,low,close,volume (volume optional). <a href="../sample-data/sample.csv" download>Download sample</a></p>
    </div>

    <div class="sta-import__panel" data-panel="json" hidden>
      <input type="file" accept=".json,application/json" data-input="json-file" />
      <p class="sta-import__hint">Array of {timestamp,open,high,low,close,volume} objects, or {candles:[...]}.</p>
    </div>

    <div class="sta-import__panel" data-panel="paste" hidden>
      <textarea data-input="paste-text" rows="6" placeholder="${manualInputTemplate()}"></textarea>
      <button type="button" class="sta-btn sta-btn--primary" data-action="parse-paste">Load Pasted Data</button>
    </div>

    <div class="sta-import__panel" data-panel="simulate" hidden>
      <div class="sta-import__sim-row">
        <label>Regime
          <select data-input="sim-regime">
            <option value="mixed">Mixed</option>
            <option value="up">Uptrend</option>
            <option value="down">Downtrend</option>
            <option value="sideways">Sideways</option>
          </select>
        </label>
        <label>Candles
          <input type="number" data-input="sim-count" value="200" min="60" max="2000" />
        </label>
      </div>
      <button type="button" class="sta-btn sta-btn--primary" data-action="generate-sim">Generate Simulated Candles</button>
      <p class="sta-import__hint">Simulated data is synthetic and for testing/demo only - never treat it as real market data.</p>
    </div>

    <div class="sta-import__status" data-status hidden></div>
  `;

  const statusEl = el.querySelector("[data-status]");
  const setStatus = (message, isError = false) => {
    statusEl.hidden = false;
    statusEl.textContent = message;
    statusEl.classList.toggle("sta-import__status--error", isError);
  };

  // Tabs
  el.querySelectorAll(".sta-import__tab").forEach((tabBtn) => {
    tabBtn.addEventListener("click", () => {
      el.querySelectorAll(".sta-import__tab").forEach((b) => b.classList.remove("is-active"));
      el.querySelectorAll(".sta-import__panel").forEach((p) => (p.hidden = true));
      tabBtn.classList.add("is-active");
      el.querySelector(`[data-panel="${tabBtn.dataset.tab}"]`).hidden = false;
    });
  });

  // CSV upload
  el.querySelector('[data-input="csv-file"]').addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const candles = await parseCSVFile(file);
      onCandlesLoaded(candles, `CSV: ${file.name}`);
      setStatus(`Loaded ${candles.length} candles from ${file.name}.`);
    } catch (err) {
      setStatus(`Failed to parse CSV: ${err.message}`, true);
    }
  });

  // JSON upload
  el.querySelector('[data-input="json-file"]').addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const candles = await parseJSONFile(file);
      onCandlesLoaded(candles, `JSON: ${file.name}`);
      setStatus(`Loaded ${candles.length} candles from ${file.name}.`);
    } catch (err) {
      setStatus(`Failed to parse JSON: ${err.message}`, true);
    }
  });

  // Paste
  el.querySelector('[data-action="parse-paste"]').addEventListener("click", () => {
    const text = el.querySelector('[data-input="paste-text"]').value;
    try {
      const candles = parseManualInput(text);
      if (candles.length === 0) throw new Error("No valid candle rows found.");
      onCandlesLoaded(candles, "Pasted data");
      setStatus(`Loaded ${candles.length} candles from pasted text.`);
    } catch (err) {
      setStatus(`Failed to parse pasted data: ${err.message}`, true);
    }
  });

  // Simulate
  el.querySelector('[data-action="generate-sim"]').addEventListener("click", () => {
    const regime = el.querySelector('[data-input="sim-regime"]').value;
    const count = Number(el.querySelector('[data-input="sim-count"]').value) || 200;
    const candles = generateSimulatedCandles({ count, regime, seed: Date.now() % 100000 });
    onCandlesLoaded(candles, `Simulated (${regime}, ${count} candles)`);
    setStatus(`Generated ${candles.length} simulated candles (${regime} regime).`);
  });

  return el;
}
