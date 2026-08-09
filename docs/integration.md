# Integration Guide

This document covers two things: importing your own data into the static
site, and integrating the overlay into another page (extension/userscript).

## Importing data into the static site

Open the **Data** tab and choose one of:

- **Upload CSV** — see the format below; `sample-data/sample.csv` is a
  ready-to-use example.
- **Upload JSON** — an array of `{timestamp, open, high, low, close,
  volume}` objects, an array of `[timestamp, open, high, low, close,
  volume]` arrays, or `{ "candles": [...] }`.
- **Paste OHLC data** — paste CSV or JSON text directly.
- **Generate simulated candles** — a seeded, deterministic random walk with
  selectable regime (up/down/range/mixed) for demos and testing; the header
  always labels this clearly as **Simulated**, never as real market data.

### CSV format

```
timestamp,open,high,low,close,volume
1700000000,161.20,161.72,161.20,161.57,1364
1700000060,161.57,162.09,161.38,161.95,1087
```

- Header row is optional (auto-detected).
- `volume` column is optional — the engine runs fine without it.
- `timestamp` may be seconds or milliseconds since epoch, or an ISO date
  string; the adapter normalizes to milliseconds automatically.
- Semicolon-delimited exports are also auto-detected.

### JSON format

```json
[
  { "timestamp": 1700000000000, "open": 161.20, "high": 161.72, "low": 161.20, "close": 161.57, "volume": 1364 },
  { "timestamp": 1700000060000, "open": 161.57, "high": 162.09, "low": 161.38, "close": 161.95, "volume": 1087 }
]
```

## Integrating the overlay elsewhere (browser extension / userscript)

See `overlay/README.md` for the complete guide, including the
`ChartDataProvider` interface, the `ExampleChartAdapter` template, and
step-by-step notes for Chrome (Manifest V3), Firefox WebExtensions, and
Violentmonkey/Tampermonkey userscripts. The short version:

1. Write (or copy/adapt) a `ChartDataProvider` implementation for your
   permitted target page — only read data the page already legitimately
   exposes to the user's browser (visible DOM values). Never bypass
   authentication or anti-bot protections.
2. `import { mountOverlay } from "./overlay/overlay.js"` and call
   `mountOverlay({ provider })`.
3. That's it — the same `SignalEngine`, scoring, and UI panel used by the
   static site now run against your live data source.

## Multi-timeframe data

If you have candle data for more than one timeframe, pass a
`higherTimeframeTrend` context into `SignalEngine.analyze(candles, {
higherTimeframeTrend: "up" | "down" | "sideways" })` — typically computed
by running `evaluateTrend()` (or a second `SignalEngine` instance) against
your higher-timeframe candles first. See `docs/signal-engine.md` for how
this affects the final decision.
