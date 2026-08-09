/**
 * storage.js
 *
 * Thin, defensive localStorage wrapper. All reads/writes are wrapped in
 * try/catch so the app keeps working in private-browsing modes or when
 * storage is full/disabled - it just falls back to defaults / in-memory.
 */
import { DEFAULT_SETTINGS, STORAGE_KEYS } from "./config.js";

export function loadSettings() {
  const stored = safeGet(STORAGE_KEYS.settings);
  if (!stored) return { ...DEFAULT_SETTINGS };
  try {
    const parsed = JSON.parse(stored);
    return { ...DEFAULT_SETTINGS, ...parsed, weights: { ...DEFAULT_SETTINGS.weights, ...(parsed.weights || {}) } };
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

export function saveSettings(settings) {
  safeSet(STORAGE_KEYS.settings, JSON.stringify(settings));
}

export function loadSignalHistory() {
  const stored = safeGet(STORAGE_KEYS.signalHistory);
  if (!stored) return [];
  try {
    return JSON.parse(stored);
  } catch {
    return [];
  }
}

export function saveSignalHistory(records) {
  safeSet(STORAGE_KEYS.signalHistory, JSON.stringify(records));
}

export function loadPanelState() {
  const stored = safeGet(STORAGE_KEYS.panelState);
  if (!stored) return null;
  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function savePanelState(state) {
  safeSet(STORAGE_KEYS.panelState, JSON.stringify(state));
}

function safeGet(key) {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key, value) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Storage unavailable/full - silently continue without persistence.
  }
}
