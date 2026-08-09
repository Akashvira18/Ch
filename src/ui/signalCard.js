/**
 * signalCard.js
 *
 * Renders the big visual signal card (🟢 UP / 🔴 DOWN / ⚪ WAIT + confidence),
 * plus the dynamically generated "Why?" reasons and "Warnings" lists. Every
 * line rendered here comes directly from a signalEngine result - nothing is
 * hard-coded text unrelated to the actual computed values.
 */

const DECISION_META = {
  UP: { emoji: "🟢", label: "UP", className: "sta-signal--up" },
  DOWN: { emoji: "🔴", label: "DOWN", className: "sta-signal--down" },
  WAIT: { emoji: "⚪", label: "WAIT", className: "sta-signal--wait" },
};

export function createSignalCard() {
  const el = document.createElement("div");
  el.className = "sta-signal-card";
  el.innerHTML = `
    <div class="sta-signal-card__main">
      <div class="sta-signal-card__emoji"></div>
      <div class="sta-signal-card__decision"></div>
      <div class="sta-signal-card__confidence"></div>
      <div class="sta-signal-card__grade"></div>
    </div>
    <div class="sta-signal-card__section">
      <div class="sta-signal-card__heading">Why?</div>
      <ul class="sta-signal-card__reasons"></ul>
    </div>
    <div class="sta-signal-card__section sta-signal-card__warnings-section" hidden>
      <div class="sta-signal-card__heading">Warnings</div>
      <ul class="sta-signal-card__warnings"></ul>
    </div>
    <p class="sta-signal-card__disclaimer">
      Model confidence based on technical confirmations - not a guaranteed outcome.
    </p>
  `;

  function update(signalResult) {
    const meta = DECISION_META[signalResult.decision] || DECISION_META.WAIT;
    el.className = `sta-signal-card ${meta.className}`;

    el.querySelector(".sta-signal-card__emoji").textContent = meta.emoji;
    el.querySelector(".sta-signal-card__decision").textContent = meta.label;
    el.querySelector(".sta-signal-card__confidence").textContent = `${Math.round(signalResult.confidence)}/100`;
    el.querySelector(".sta-signal-card__grade").textContent = `Quality: ${signalResult.grade}`;

    const reasonsEl = el.querySelector(".sta-signal-card__reasons");
    reasonsEl.innerHTML = "";
    if (signalResult.reasons.length === 0) {
      const li = document.createElement("li");
      li.textContent = signalResult.decision === "WAIT"
        ? "No high-quality confluence found - waiting for a clearer setup."
        : "No contributing factors available.";
      li.className = "sta-signal-card__reason-empty";
      reasonsEl.appendChild(li);
    } else {
      for (const reason of signalResult.reasons) {
        const li = document.createElement("li");
        li.textContent = `✓ ${reason}`;
        reasonsEl.appendChild(li);
      }
    }

    const warningsSection = el.querySelector(".sta-signal-card__warnings-section");
    const warningsEl = el.querySelector(".sta-signal-card__warnings");
    warningsEl.innerHTML = "";
    if (signalResult.warnings.length > 0) {
      warningsSection.hidden = false;
      for (const warning of signalResult.warnings) {
        const li = document.createElement("li");
        li.textContent = `⚠ ${warning}`;
        warningsEl.appendChild(li);
      }
    } else {
      warningsSection.hidden = true;
    }
  }

  return { el, update };
}

/**
 * Renders the compact overlay-panel readout (the "Signal / Confidence /
 * Trend / Structure / ..." rows shown in the brief's mockup).
 */
export function createOverlayReadout() {
  const el = document.createElement("div");
  el.className = "sta-readout";
  el.innerHTML = `
    <div class="sta-readout__row"><span>Signal</span><strong data-field="signal">--</strong></div>
    <div class="sta-readout__row"><span>Confidence</span><strong data-field="confidence">--</strong></div>
    <div class="sta-readout__row"><span>Trend</span><strong data-field="trend">--</strong></div>
    <div class="sta-readout__row"><span>Structure</span><strong data-field="structure">--</strong></div>
    <div class="sta-readout__row"><span>Momentum</span><strong data-field="momentum">--</strong></div>
    <div class="sta-readout__row"><span>Volatility</span><strong data-field="volatility">--</strong></div>
    <div class="sta-readout__divider"></div>
    <div class="sta-readout__row"><span>Resistance</span><strong data-field="resistance">--</strong></div>
    <div class="sta-readout__row"><span>Support</span><strong data-field="support">--</strong></div>
    <div class="sta-readout__row"><span>Breakout</span><strong data-field="breakout">--</strong></div>
    <div class="sta-readout__row"><span>Breakdown</span><strong data-field="breakdown">--</strong></div>
  `;

  function set(field, value) {
    const node = el.querySelector(`[data-field="${field}"]`);
    if (node) node.textContent = value;
  }

  function update(signalResult) {
    const meta = DECISION_META[signalResult.decision] || DECISION_META.WAIT;
    set("signal", `${meta.emoji} ${meta.label}`);
    set("confidence", `${Math.round(signalResult.confidence)}/100`);
    set("trend", capitalize(signalResult.trend));
    set("structure", capitalize(signalResult.structure));
    set("momentum", momentumLabel(signalResult.momentumScore));
    set("volatility", capitalize(signalResult.volatility.level));

    const resistance = signalResult.resistanceZones?.[0];
    const support = signalResult.supportZones?.[0];
    set("resistance", resistance ? `${resistance.low} - ${resistance.high}` : "n/a");
    set("support", support ? `${support.low} - ${support.high}` : "n/a");
    set("breakout", statusLabel(signalResult.breakoutStatus));
    set("breakdown", statusLabel(signalResult.breakdownStatus));
  }

  return { el, update };
}

function capitalize(str) {
  if (!str) return "n/a";
  return str.charAt(0).toUpperCase() + str.slice(1).replace(/-/g, " ");
}

function statusLabel(status) {
  if (!status || status === "none") return "None";
  return status
    .split("-")
    .map((w) => w.toUpperCase())
    .join(" ");
}

function momentumLabel(score) {
  if (score === null || score === undefined) return "n/a";
  const abs = Math.abs(score);
  const strength = abs >= 40 ? "Strong" : abs >= 15 ? "Moderate" : "Weak";
  const direction = score > 5 ? "Bullish" : score < -5 ? "Bearish" : "Flat";
  return `${strength} ${direction}`;
}
