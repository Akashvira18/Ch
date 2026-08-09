# Overlay Architecture

This folder is the bridge between the core analysis engine (`/src/analysis`)
and *some other page* that isn't this repository's own `index.html` — most
likely a browser extension content script or a userscript (Violentmonkey /
Tampermonkey) running on a charting website you have the right to read data
from.

## Design principle

The core analyzer and UI never know or care where candles came from. They
only depend on the `ChartDataProvider` interface:

```js
class ChartDataProvider {
  getCandles();       // -> Candle[]
  getCurrentPrice();  // -> number | null
  getTimeframe();     // -> string | null
  subscribe(cb);       // cb(candles) fires on new data
  unsubscribe(cb);
}
```

Anything that implements this shape can drive the overlay: a CSV upload, a
simulator, or a live page adapter. This repo ships four implementations:

| File | Purpose |
|---|---|
| `chartDataProvider.js` | The interface itself, plus `StaticCandleProvider` (wraps a plain array — used by the static site and by CSV/JSON/simulated adapters). |
| `exampleChartAdapter.js` | **Template only.** Shows the shape of a real DOM-reading adapter with placeholder selectors. Replace the selectors and parsing logic for your target page. |
| `../src/data/futureDomAdapter.js` | Interface + helpers for polling structured DOM elements on a host page. |
| `../src/data/futureCanvasAdapter.js` | Interface + helpers for a host page that only renders to `<canvas>` (no accessible DOM data) — documents the constraints (pixel/OCR-based extraction is out of scope here; this repo does not attempt canvas pixel-reading). |

## Mounting the overlay

```js
import { mountOverlay } from "./overlay.js";
import { ExampleChartAdapter } from "./exampleChartAdapter.js";

const provider = new ExampleChartAdapter({
  selectors: {
    candleRowContainer: "#your-real-container",
    candleRow: ".your-real-row",
    attr: { timestamp: "data-ts", open: "data-o", high: "data-h", low: "data-l", close: "data-c" },
  },
});

const handle = mountOverlay({ provider, pollIntervalMs: 1000 });
// later: handle.destroy();
```

`mountOverlay()` injects a scoped, `!important`-guarded stylesheet
(`overlay.css`) so the panel renders consistently regardless of the host
page's own CSS, creates a `SignalEngine`, and keeps a draggable panel in
sync with whatever the provider reports.

## Turning this into a browser extension

1. **Manifest V3 Chrome extension**: create `manifest.json` with a
   `content_scripts` entry pointing at your target's URL pattern, and bundle
   this repo's `src/` + `overlay/` folders as extension resources (no
   bundler required — they're plain ES modules; use
   `"type": "module"` dynamic `import()` from your content script, or list
   them under `web_accessible_resources` and `import()` by extension URL).
2. **Firefox**: same approach using WebExtensions (`manifest_version: 2` or
   `3`); the content script and resource-loading mechanics are equivalent.
3. **Violentmonkey / Tampermonkey userscript**: add a `@match` header for
   your permitted target, then either inline the modules or `@require` them
   from a URL you control (e.g. your own GitHub Pages deployment of this
   repo), and call `mountOverlay()` on page load.

In every case, **only** replace `exampleChartAdapter.js` (or write a new
adapter) — the engine, scoring, UI, and anti-noise logic in `src/` are
reused unmodified.

## What this deliberately does NOT do

- No authentication bypass, token extraction, or session hijacking.
- No circumvention of anti-bot / anti-scraping protections.
- No reading of data the user isn't already legitimately viewing in their
  own browser.
- No canvas pixel-scraping or OCR to reconstruct chart data from an image.

Integrating with any specific third-party website is the *integrator's*
responsibility: check that site's terms of service before deploying an
adapter against it.
