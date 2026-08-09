/**
 * historyPanel.js
 *
 * Renders the Signal History table (Time/Signal/Confidence/Trend/Breakout/
 * Structure/Outcome/Status), lets the user mark WIN/LOSS/NEUTRAL outcomes,
 * and shows aggregate stats. Stats are explicitly labeled as historical only.
 */
import { formatTime } from "../utils/helpers.js";

export function createHistoryPanel(signalHistory, { onOutcomeChange } = {}) {
  const el = document.createElement("div");
  el.className = "sta-history";
  el.innerHTML = `
    <div class="sta-history__stats"></div>
    <div class="sta-history__disclaimer">
      Past performance of these signals does not guarantee future results. This table
      reflects historical model output only.
    </div>
    <div class="sta-history__table-wrap">
      <table class="sta-history__table">
        <thead>
          <tr>
            <th>Time</th><th>Signal</th><th>Conf.</th><th>Trend</th>
            <th>Breakout</th><th>Structure</th><th>Outcome</th><th>Status</th>
          </tr>
        </thead>
        <tbody></tbody>
      </table>
    </div>
  `;

  const statsEl = el.querySelector(".sta-history__stats");
  const tbody = el.querySelector("tbody");

  function renderStats() {
    const s = signalHistory.computeStats();
    statsEl.innerHTML = `
      <div class="sta-stat"><span>Total</span><strong>${s.totalSignals}</strong></div>
      <div class="sta-stat"><span>UP</span><strong>${s.upSignals}</strong></div>
      <div class="sta-stat"><span>DOWN</span><strong>${s.downSignals}</strong></div>
      <div class="sta-stat"><span>WAIT</span><strong>${s.waitSignals}</strong></div>
      <div class="sta-stat"><span>Win Rate</span><strong>${s.winRate === null ? "n/a" : s.winRate.toFixed(1) + "%"}</strong></div>
      <div class="sta-stat"><span>Avg Confidence</span><strong>${s.avgConfidence === null ? "n/a" : s.avgConfidence.toFixed(1)}</strong></div>
      <div class="sta-stat"><span>False Signal Rate</span><strong>${s.falseSignalRate === null ? "n/a" : s.falseSignalRate.toFixed(1) + "%"}</strong></div>
      <div class="sta-stat"><span>Max Consec. Losses</span><strong>${s.maxConsecutiveLosses}</strong></div>
    `;
  }

  function renderTable() {
    tbody.innerHTML = "";
    const rows = [...signalHistory.all()].reverse();
    for (const record of rows) {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${formatTime(record.time, true)}</td>
        <td class="sta-history__signal sta-history__signal--${record.signal.toLowerCase()}">${record.signal}</td>
        <td>${Math.round(record.confidence)}</td>
        <td>${record.trend}</td>
        <td>${record.breakout}</td>
        <td>${record.structure}</td>
        <td class="sta-history__outcome-cell"></td>
        <td>${record.status}</td>
      `;
      const outcomeCell = tr.querySelector(".sta-history__outcome-cell");
      outcomeCell.appendChild(buildOutcomeSelect(record, onOutcomeChange, renderStats));
      tbody.appendChild(tr);
    }
  }

  function refresh() {
    renderStats();
    renderTable();
  }

  refresh();
  return { el, refresh };
}

function buildOutcomeSelect(record, onOutcomeChange, afterChange) {
  const select = document.createElement("select");
  select.className = "sta-history__outcome-select";
  const options = ["PENDING", "WIN", "LOSS", "NEUTRAL"];
  for (const opt of options) {
    const option = document.createElement("option");
    option.value = opt;
    option.textContent = opt;
    if (opt === record.outcome) option.selected = true;
    select.appendChild(option);
  }
  select.disabled = record.signal === "WAIT";
  select.addEventListener("change", () => {
    record.outcome = select.value;
    record.status = select.value === "PENDING" ? "OPEN" : "CLOSED";
    if (onOutcomeChange) onOutcomeChange(record);
    if (afterChange) afterChange();
  });
  return select;
}
