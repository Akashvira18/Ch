# Smart Trading Chart Breakdown & Trend Analyzer

A browser-based, client-side-only technical analysis overlay that reads
candlestick (OHLCV) data and produces a transparent, multi-factor
**UP / DOWN / WAIT** signal with a documented confidence score — trend,
market structure, momentum, support/resistance, breakout/breakdown
detection, and candle pattern confirmation, all visible in a "Why?"
breakdown rather than a black box.

**No backend. No build step. No paid API. Runs entirely from GitHub Pages
or any static host.**

> ⚠️ **This is an analytical/educational tool, not financial advice.**
> See [Disclaimer](#disclaimer).

---

## Features

- **10+ analysis dimensions**: trend, market structure (HH/HL/LH/LL),
  breakout, breakdown, false-breakout/false-breakdown detection, momentum,
  volatility, support/resistance zones, candle patterns, signal quality
  grading (A+ through WAIT).
- **Transparent scoring**: a documented, configurable weighted model
  (trend 25 / structure 20 / momentum 15 / S-R 15 / breakout-breakdown 15 /
  candle 5 / volatility 5 = 100 points) — every "Why?" reason is generated
  from real numbers, never hard-coded copy.
- **Anti-noise system**: minimum confidence floor, hysteresis, signal
  cooldown, and a minimum-data requirement so the engine prefers `WAIT`
  over a weak call — see [`docs/signal-engine.md`](docs/signal-engine.md).
- **No look-ahead backtesting**: replays history one candle at a time
  through a fresh engine instance — see [`docs/backtesting.md`](docs/backtesting.md).
- **Signal history tracking** with win/loss/neutral outcome marking and
  aggregate stats (win rate, average confidence, false-signal rate, max
  consecutive losses) — explicitly labeled as historical, not predictive.
- **Zero-dependency canvas chart** (candlesticks, EMA overlays, S/R zones,
  breakout/breakdown/signal markers) — no charting library, no CDN, no
  build step.
- **Draggable, mobile-responsive overlay panel** with minimize/compact
  modes and an opacity slider.
- **CSV / JSON / paste / simulated** data import, plus an architecture
  designed so a future browser extension or userscript can feed it live
  data from a permitted third-party page without touching the engine.
- **Settings persisted in `localStorage`** — every threshold, period, and
  weight is user-configurable.

## Architecture

See [`docs/architecture.md`](docs/architecture.md) for the full breakdown.
In short:

```
data adapters  →  analysis engine (pure functions)  →  SignalEngine (stateful, anti-noise)  →  chart + UI
```

```
smart-trading-analyzer/
├── index.html               Static entry point
├── css/                     main / chart / overlay / responsive styles
├── js/                      app.js (bootstrap), config.js, storage.js
├── src/
│   ├── analysis/            ema, sma, rsi, macd, atr, momentum, volatility,
│   │                        marketStructure, supportResistance, breakout,
│   │                        breakdown, candlePatterns, trend, scoring,
│   │                        signalEngine, signalHistory, validation
│   ├── data/                manualInput, csv, json, simulated,
│   │                        futureDom, futureCanvas adapters
│   ├── chart/                chartRenderer.js (dependency-free canvas chart)
│   ├── ui/                   overlayPanel, signalCard, settingsPanel,
│   │                        historyPanel, dataImportPanel
│   └── backtest/             backtestEngine.js (no-look-ahead replay)
├── overlay/                  ChartDataProvider interface, overlay.js
│                             bootstrap, overlay.css, ExampleChartAdapter,
│                             README.md (extension/userscript guide)
├── sample-data/sample.csv    deterministic sample OHLCV dataset
├── docs/                     architecture, signal-engine, integration,
│                             backtesting
└── tests/                    dependency-free Node test suite
```

## Installation / local usage

No build step, no package manager required for the app itself.

```bash
git clone <this-repo-url>
cd smart-trading-analyzer
# Any static file server works, e.g.:
python3 -m http.server 8080
# then open http://localhost:8080
```

Opening `index.html` directly via `file://` also works in most browsers
since everything is plain ES modules with relative paths, though a local
server is recommended for consistent module-loading behavior.

## Deploying to GitHub Pages

1. Push this repository to GitHub.
2. Go to **Settings → Pages**.
3. Under **Build and deployment**, choose **Deploy from a branch**, select
   your default branch and the repository root (`/`) as the folder.
4. Save, then open the generated `https://<user>.github.io/<repo>/` URL.

No build command is required — all paths in `index.html` and every JS
module are relative, so this also works correctly when the site is served
from a project subdirectory (i.e. `<repo>` in the URL above), not just from
a custom domain root.

## CSV format

```
timestamp,open,high,low,close,volume
1700000000,161.20,161.72,161.20,161.57,1364
1700000060,161.57,162.09,161.38,161.95,1087
```

Header row optional (auto-detected), `volume` optional, timestamps may be
seconds, milliseconds, or ISO date strings. See
[`sample-data/sample.csv`](sample-data/sample.csv) and
[`docs/integration.md`](docs/integration.md) for the full format
reference including the JSON shape.

## Indicators

| Indicator | Periods | Module |
|---|---|---|
| EMA | 9 / 21 / 50 / 200 | `src/analysis/ema.js` |
| SMA | 20 / 50 / 200 | `src/analysis/sma.js` |
| RSI | 14 (Wilder smoothing) | `src/analysis/rsi.js` |
| MACD | 12 / 26 / 9 | `src/analysis/macd.js` |
| ATR | 14 | `src/analysis/atr.js` |

All periods are configurable in the Settings tab and persisted in
`localStorage`.

## Signal scoring

See [`docs/signal-engine.md`](docs/signal-engine.md) for the full
methodology, including the exact weighting table, the WAIT/UP/DOWN decision
rule, quality grades (A+/A/B/C/WAIT), and the anti-noise system
(hysteresis, cooldown, minimum-confidence floor).

**Confidence is model confidence based on technical confirmations agreeing
with each other — it is never presented or intended as a guaranteed
probability of the next candle's direction.**

## Overlay architecture / browser extension integration

See [`overlay/README.md`](overlay/README.md) and
[`docs/integration.md`](docs/integration.md). The core engine and UI are
fully decoupled from any specific data source via the `ChartDataProvider`
interface, so the same code can later run inside a Chrome/Firefox extension
content script or a Violentmonkey/Tampermonkey userscript targeting a
permitted website — only a new adapter needs to be written.

## Backtesting

See [`docs/backtesting.md`](docs/backtesting.md). The backtest engine
replays historical data one candle at a time through a fresh engine
instance and evaluates outcomes strictly against *future* candles relative
to each signal, so results are not contaminated by look-ahead bias.
Backtest output is always a **historical simulation**, never a promise
about future performance.

## Configuration

Everything under **Settings** is persisted to `localStorage` and includes:
EMA/SMA/RSI/MACD/ATR periods, swing lookback, support/resistance
sensitivity, minimum confidence, signal cooldown, hysteresis band, breakout
and breakdown distance thresholds, candle-close confirmation, scoring
weights, quality grade thresholds, and chart/overlay toggles. See
`js/config.js` for the full default shape.

## Testing

```bash
node tests/run.js
```

Zero dependencies, plain Node ES modules — no install step. Covers EMA,
RSI, MACD, ATR, swing detection, support/resistance, bullish/bearish
structure, breakout, breakdown, false-breakout, scoring, candle-close
sanitization, the full `SignalEngine` pipeline end-to-end, and the
backtest engine's no-look-ahead guarantee.

## Limitations

- This is a technical-analysis tool. It has no knowledge of news,
  fundamentals, order flow, or macro events, and cannot anticipate them.
- All indicators are lagging by nature; no combination of them can predict
  the future with certainty.
- The canvas chart is hand-rolled for zero dependencies — it is not a
  substitute for a professional charting platform for execution.
- The live-DOM and live-canvas data adapters (`futureDomAdapter.js`,
  `futureCanvasAdapter.js`) ship as documented interfaces and helpers, not
  as a working integration with any specific website — see
  `overlay/README.md` for why, and what integrating one responsibly looks
  like.
- Backtest results do not model slippage, fees, or execution latency.

## Disclaimer

This software is provided for educational and analytical purposes only. It
is **not** financial advice, and it does not guarantee the accuracy,
completeness, or profitability of any signal, score, or classification it
produces — including "confirmed" breakouts/breakdowns and any backtest or
historical win-rate statistic. Trading and investing involve substantial
risk of loss, including the possible loss of your entire investment. Past
or simulated performance is not indicative of future results. You are
solely responsible for any financial decisions you make; consider
consulting a licensed financial professional before making them. The
authors and contributors accept no liability for losses arising from use
of this software. See [`LICENSE`](LICENSE) for the software license.
