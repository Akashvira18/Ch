/**
 * overlayPanel.js
 *
 * The floating, draggable "SMART ANALYZER" panel shell. Handles dragging,
 * minimize/maximize, opacity, and compact mode. The actual content
 * (signal card, indicator readout) is injected by the caller via
 * `panel.setBody(node)` - this module only owns the chrome/interaction
 * behavior so it can be reused by both the main app (js/app.js) and the
 * injectable overlay bundle (overlay/overlay.js).
 */
import { clamp } from "../utils/helpers.js";

export class OverlayPanel {
  /**
   * @param {Object} options
   * @param {HTMLElement} [options.mountTarget=document.body]
   * @param {string} [options.title="SMART ANALYZER"]
   * @param {number} [options.initialOpacity=1]
   * @param {{x:number,y:number}} [options.initialPosition]
   */
  constructor(options = {}) {
    this.mountTarget = options.mountTarget || document.body;
    this.title = options.title || "SMART ANALYZER";
    this.state = {
      minimized: false,
      compact: false,
      opacity: options.initialOpacity ?? 1,
      position: options.initialPosition || { x: null, y: null }, // null = CSS default (top-right)
    };

    this._build();
    this._wireDragging();
  }

  _build() {
    const root = document.createElement("div");
    root.className = "sta-panel";
    root.setAttribute("role", "region");
    root.setAttribute("aria-label", this.title);

    root.innerHTML = `
      <div class="sta-panel__header" data-drag-handle>
        <span class="sta-panel__title">${escapeHtml(this.title)}</span>
        <div class="sta-panel__controls">
          <input type="range" class="sta-panel__opacity" min="30" max="100" value="${Math.round(this.state.opacity * 100)}" title="Panel opacity" aria-label="Panel opacity" />
          <button class="sta-panel__btn" data-action="compact" title="Toggle compact mode" aria-label="Toggle compact mode">▤</button>
          <button class="sta-panel__btn" data-action="minimize" title="Minimize" aria-label="Minimize">–</button>
        </div>
      </div>
      <div class="sta-panel__body"></div>
    `;

    this.mountTarget.appendChild(root);
    this.el = root;
    this.headerEl = root.querySelector(".sta-panel__header");
    this.bodyEl = root.querySelector(".sta-panel__body");
    this.opacitySlider = root.querySelector(".sta-panel__opacity");
    this.compactBtn = root.querySelector('[data-action="compact"]');
    this.minimizeBtn = root.querySelector('[data-action="minimize"]');

    this.opacitySlider.addEventListener("input", (e) => {
      this.setOpacity(Number(e.target.value) / 100);
    });
    this.compactBtn.addEventListener("click", () => this.toggleCompact());
    this.minimizeBtn.addEventListener("click", () => this.toggleMinimize());
  }

  setBody(node) {
    this.bodyEl.innerHTML = "";
    this.bodyEl.appendChild(node);
  }

  setOpacity(value) {
    this.state.opacity = clamp(value, 0.3, 1);
    this.el.style.opacity = String(this.state.opacity);
    this._emitChange();
  }

  toggleCompact(force) {
    this.state.compact = force ?? !this.state.compact;
    this.el.classList.toggle("sta-panel--compact", this.state.compact);
    this._emitChange();
  }

  toggleMinimize(force) {
    this.state.minimized = force ?? !this.state.minimized;
    this.el.classList.toggle("sta-panel--minimized", this.state.minimized);
    this.minimizeBtn.textContent = this.state.minimized ? "+" : "–";
    this.minimizeBtn.setAttribute("aria-label", this.state.minimized ? "Restore" : "Minimize");
    this._emitChange();
  }

  /** @param {(state:Object)=>void} callback */
  onChange(callback) {
    this._onChange = callback;
  }

  _emitChange() {
    if (this._onChange) this._onChange({ ...this.state });
  }

  _wireDragging() {
    let dragging = false;
    let startX = 0;
    let startY = 0;
    let originX = 0;
    let originY = 0;

    const onPointerDown = (e) => {
      // Don't start a drag from interactive controls in the header.
      if (e.target.closest(".sta-panel__btn, .sta-panel__opacity")) return;
      dragging = true;
      const point = e.touches ? e.touches[0] : e;
      startX = point.clientX;
      startY = point.clientY;
      const rect = this.el.getBoundingClientRect();
      originX = rect.left;
      originY = rect.top;
      this.el.classList.add("sta-panel--dragging");
      window.addEventListener("mousemove", onPointerMove);
      window.addEventListener("touchmove", onPointerMove, { passive: false });
      window.addEventListener("mouseup", onPointerUp);
      window.addEventListener("touchend", onPointerUp);
    };

    const onPointerMove = (e) => {
      if (!dragging) return;
      if (e.cancelable) e.preventDefault();
      const point = e.touches ? e.touches[0] : e;
      const dx = point.clientX - startX;
      const dy = point.clientY - startY;
      const maxX = window.innerWidth - this.el.offsetWidth - 4;
      const maxY = window.innerHeight - this.el.offsetHeight - 4;
      const x = clamp(originX + dx, 4, Math.max(4, maxX));
      const y = clamp(originY + dy, 4, Math.max(4, maxY));
      this.el.style.left = `${x}px`;
      this.el.style.top = `${y}px`;
      this.el.style.right = "auto";
      this.state.position = { x, y };
    };

    const onPointerUp = () => {
      dragging = false;
      this.el.classList.remove("sta-panel--dragging");
      window.removeEventListener("mousemove", onPointerMove);
      window.removeEventListener("touchmove", onPointerMove);
      window.removeEventListener("mouseup", onPointerUp);
      window.removeEventListener("touchend", onPointerUp);
      this._emitChange();
    };

    this.headerEl.addEventListener("mousedown", onPointerDown);
    this.headerEl.addEventListener("touchstart", onPointerDown, { passive: true });
  }

  destroy() {
    this.el.remove();
  }
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}
