/**
 * settingsPanel.js
 *
 * Renders a form for every configurable engine parameter listed in the
 * project brief (EMA/RSI/MACD/ATR periods, swing lookback, S/R sensitivity,
 * min confidence, cooldown, breakout/breakdown thresholds, candle
 * confirmation, multi-timeframe toggle). Changes are pushed to the caller
 * via onApply(settings) - persistence itself lives in js/storage.js so this
 * module has no direct localStorage dependency (easier to unit test / reuse
 * inside the overlay bundle).
 */

const FIELDS = [
  { key: "emaPeriods", label: "EMA periods", type: "text", hint: "comma-separated, e.g. 9,21,50,200" },
  { key: "smaPeriods", label: "SMA periods", type: "text", hint: "comma-separated, e.g. 20,50,200" },
  { key: "rsiPeriod", label: "RSI period", type: "number", min: 2, max: 100 },
  { key: "macdFast", label: "MACD fast", type: "number", min: 2, max: 50 },
  { key: "macdSlow", label: "MACD slow", type: "number", min: 2, max: 100 },
  { key: "macdSignal", label: "MACD signal", type: "number", min: 2, max: 50 },
  { key: "atrPeriod", label: "ATR period", type: "number", min: 2, max: 100 },
  { key: "swingStrength", label: "Swing lookback (fractal width)", type: "number", min: 1, max: 10 },
  { key: "srClusterToleranceATR", label: "Support/Resistance sensitivity (x ATR)", type: "number", step: 0.05, min: 0.05, max: 2 },
  { key: "minConfidence", label: "Minimum confidence", type: "number", min: 0, max: 100 },
  { key: "cooldownCandles", label: "Signal cooldown (candles)", type: "number", min: 0, max: 50 },
  { key: "breakoutThresholdPercent", label: "Breakout threshold (%)", type: "number", step: 0.01, min: 0 },
  { key: "breakdownThresholdPercent", label: "Breakdown threshold (%)", type: "number", step: 0.01, min: 0 },
  { key: "requireClosedCandle", label: "Require candle-close confirmation", type: "checkbox" },
  { key: "useMultiTimeframe", label: "Enable multi-timeframe confirmation", type: "checkbox" },
];

const WEIGHT_FIELDS = [
  { key: "trend", label: "Trend" },
  { key: "marketStructure", label: "Market Structure" },
  { key: "momentum", label: "Momentum" },
  { key: "supportResistance", label: "Support/Resistance" },
  { key: "breakoutBreakdown", label: "Breakout/Breakdown" },
  { key: "candleConfirmation", label: "Candle Confirmation" },
  { key: "volatility", label: "Volatility" },
];

export function createSettingsPanel(currentSettings, onApply) {
  const el = document.createElement("form");
  el.className = "sta-settings";
  el.innerHTML = `
    <div class="sta-settings__group" data-group="general"></div>
    <div class="sta-settings__group">
      <div class="sta-settings__heading">Signal weights (must total 100)</div>
      <div class="sta-settings__weights" data-group="weights"></div>
      <div class="sta-settings__weight-total">Total: <span data-field="weightTotal">100</span>/100</div>
    </div>
    <div class="sta-settings__actions">
      <button type="submit" class="sta-btn sta-btn--primary">Apply Settings</button>
      <button type="button" class="sta-btn" data-action="reset">Reset to Defaults</button>
    </div>
  `;

  const generalGroup = el.querySelector('[data-group="general"]');
  for (const field of FIELDS) {
    generalGroup.appendChild(buildField(field, currentSettings));
  }

  const weightsGroup = el.querySelector('[data-group="weights"]');
  for (const field of WEIGHT_FIELDS) {
    const row = document.createElement("label");
    row.className = "sta-settings__field sta-settings__field--weight";
    row.innerHTML = `<span>${field.label}</span>`;
    const input = document.createElement("input");
    input.type = "number";
    input.min = "0";
    input.max = "100";
    input.name = `weight_${field.key}`;
    input.value = currentSettings.weights?.[field.key] ?? 0;
    input.addEventListener("input", updateWeightTotal);
    row.appendChild(input);
    weightsGroup.appendChild(row);
  }

  function updateWeightTotal() {
    const total = WEIGHT_FIELDS.reduce((sum, f) => {
      const input = el.querySelector(`[name="weight_${f.key}"]`);
      return sum + (Number(input.value) || 0);
    }, 0);
    const totalField = el.querySelector('[data-field="weightTotal"]');
    totalField.textContent = String(total);
    totalField.classList.toggle("sta-settings__weight-total--warn", total !== 100);
  }
  updateWeightTotal();

  el.addEventListener("submit", (e) => {
    e.preventDefault();
    onApply(collectSettings(el, currentSettings));
  });

  el.querySelector('[data-action="reset"]').addEventListener("click", () => {
    onApply(null); // signals caller to reset to DEFAULT_ENGINE_OPTIONS
  });

  return el;
}

function buildField(field, settings) {
  const wrapper = document.createElement("label");
  wrapper.className = "sta-settings__field";
  const value = settings[field.key];

  if (field.type === "checkbox") {
    wrapper.innerHTML = `
      <span>${field.label}</span>
      <input type="checkbox" name="${field.key}" ${value ? "checked" : ""} />
    `;
  } else {
    const attrs = [
      field.min !== undefined ? `min="${field.min}"` : "",
      field.max !== undefined ? `max="${field.max}"` : "",
      field.step !== undefined ? `step="${field.step}"` : "",
    ].join(" ");
    wrapper.innerHTML = `
      <span>${field.label}${field.hint ? `<small>${field.hint}</small>` : ""}</span>
      <input type="${field.type}" name="${field.key}" value="${value ?? ""}" ${attrs} />
    `;
  }
  return wrapper;
}

function collectSettings(formEl, base) {
  const settings = { ...base };
  for (const field of FIELDS) {
    const input = formEl.querySelector(`[name="${field.key}"]`);
    if (!input) continue;
    if (field.type === "checkbox") settings[field.key] = input.checked;
    else if (field.type === "number") settings[field.key] = Number(input.value);
    else settings[field.key] = input.value;
  }

  const weights = {};
  for (const field of WEIGHT_FIELDS) {
    const input = formEl.querySelector(`[name="weight_${field.key}"]`);
    weights[field.key] = Number(input.value) || 0;
  }
  settings.weights = weights;

  return settings;
}
