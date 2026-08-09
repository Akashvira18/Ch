# Architecture

## Layers

```
┌─────────────────────────────────────────────────────────┐
│  UI (src/ui/*, js/app.js)                                │
│  - overlayPanel, signalCard, settingsPanel,               │
│    historyPanel, dataImportPanel                          │
└───────────────▲─────────────────────────────────────────┘
                │ reads results / writes settings
┌───────────────┴─────────────────────────────────────────┐
│  Chart rendering (src/chart/chartRenderer.js)             │
│  - canvas candlesticks, EMA overlays, S/R zones, markers   │
└───────────────▲─────────────────────────────────────────┘
                │ candles + engine result
┌───────────────┴─────────────────────────────────────────┐
│  Signal Engine (src/analysis/signalEngine.js)              │
│  - orchestrates every module below, owns anti-noise state  │
└───────────────▲─────────────────────────────────────────┘
                │ pure function calls, no shared state
┌───────────────┴─────────────────────────────────────────┐
│  Analysis modules (src/analysis/*.js)                      │
│  ema, sma, rsi, macd, atr, momentum, volatility,            │
│  marketStructure, supportResistance, breakout, breakdown,   │
│  candlePatterns, trend, scoring, signalHistory, validation   │
└───────────────▲─────────────────────────────────────────┘
                │ sanitized Candle[]
┌───────────────┴─────────────────────────────────────────┐
│  Data adapters (src/data/*.js, overlay/chartDataProvider)   │
│  manualInput, csv, json, simulated, futureDom, futureCanvas │
└─────────────────────────────────────────────────────────┘
```

Every layer only depends on the layer directly below it. The analysis
modules are pure functions with no DOM access and no shared mutable state
(the only stateful object in the whole engine is `SignalEngine`, which
tracks the last emitted signal for hysteresis/cooldown purposes). This is
what makes the engine independently testable (see `/tests`) and reusable
inside the `overlay/` bootstrap without pulling in any UI code.

## Data flow, one candle at a time

1. A `ChartDataProvider` (static or live) calls its subscribers with a new
   `Candle[]`.
2. `SignalEngine.analyze(candles)`:
   - sanitizes/validates the input (`validation.js`) — drops malformed or
     duplicate candles rather than throwing
   - bails out to a `WAIT` / "insufficient data" result if there aren't
     enough candles yet
   - runs trend, market structure, support/resistance, volatility,
     momentum, RSI, candle patterns, breakout, and breakdown detection
   - feeds all of that into `computeScores()` for a transparent UP/DOWN
     score breakdown
   - applies multi-timeframe context (if supplied), the minimum-confidence
     floor, and the hysteresis/cooldown anti-noise logic
   - returns one large, UI-ready result object (see `signal-engine.md`)
3. `js/app.js` takes that result and updates the chart, the signal card,
   and (if the decision wasn't suppressed) appends it to `SignalHistory`.

## Why not recompute everything from scratch on a real exchange feed?

Today, `analyze()` is O(n) in the number of candles passed to it — simple,
correct, and fast enough for realistic candle counts (hundreds to a few
thousand) even on mobile. The `ema.js` module does expose `updateEMA()`, an
O(1) incremental step, as a first building block toward a fully incremental
pipeline; a production high-frequency deployment would extend that pattern
to `atr.js`, `rsi.js`, and the swing/S-R detectors so a live loop never
re-walks the whole history on every tick. That refactor is intentionally
out of scope here (see "Limitations" in the README) — recompute-from-scratch
is the correct default. Only replace it if you have measured that it is
actually a bottleneck for your data rate.

## Historical vs. real-time vs. backtesting

These three modes are kept structurally separate on purpose:

- **Real-time analysis** (`js/app.js`, `overlay/overlay.js`): one call to
  `SignalEngine.analyze()` per new candle, using whatever the engine's
  *current* state is (hysteresis/cooldown carry across calls).
- **Historical analysis**: the same `analyze()` call, run once against a
  static uploaded dataset — no "future" data exists to leak in because
  there's only one snapshot.
- **Backtesting** (`src/backtest/backtestEngine.js`): replays a historical
  dataset by calling `analyze()` repeatedly with only `candles[0..i]` at
  step `i`, using a **fresh** `SignalEngine` instance for the whole run.
  Outcomes are then evaluated strictly forward from `i+1`. This is the
  mechanism that prevents look-ahead bias — see `backtesting.md`.

## Overlay / extension architecture

See `overlay/README.md` for the full integration guide. In short: the
`ChartDataProvider` interface (`overlay/chartDataProvider.js`) is the only
contract the engine and UI depend on, so a browser extension content script
or userscript can supply live candles from a permitted third-party page
without any change to `src/analysis` or `src/ui`.
