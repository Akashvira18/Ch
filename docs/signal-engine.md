# Signal Engine Methodology

## What "confidence" means (and doesn't mean)

Every result from `SignalEngine.analyze()` includes a `confidence` number
from 0-100. **This is a measure of how many independent technical
confirmations currently agree with each other — it is not a probability
that the next candle will move in that direction.** The engine never
claims certainty, never outputs 100% as a guarantee, and is explicitly
designed to prefer `WAIT` over a low-quality directional call. Nothing in
this codebase should ever be presented to a user as a guaranteed or
"can't lose" signal — see the disclaimer in `README.md`.

## The scoring model

Two scores are computed on every call: `upScore` and `downScore`, each
0-100, built from the same seven weighted components (default weights,
configurable in Settings and `js/config.js`):

| Component | Weight | Source module |
|---|---|---|
| Trend | 25 | `trend.js` (EMA alignment, price vs EMA21, slope) |
| Market structure | 20 | `marketStructure.js` (HH/HL vs LH/LL sequences) |
| Momentum | 15 | `momentum.js` (rate of change + candle momentum) |
| Support/Resistance | 15 | `supportResistance.js` (proximity to nearest zone) |
| Breakout/Breakdown | 15 | `breakout.js` / `breakdown.js` |
| Candle confirmation | 5 | `candlePatterns.js` |
| Volatility | 5 | `volatility.js` (penalizes abnormally low/high volatility) |

`computeScores()` in `scoring.js` returns a `breakdown` array with each
component's contribution to both scores plus a human-readable `note` —
this is exactly what powers the "Why?" list in the signal card. Nothing in
the UI's explanation is hard-coded; it's generated from the same numbers
that produced the score.

## From scores to a decision

```
diff = upScore - downScore
confidence = max(upScore, downScore)

if |diff| < 8            -> WAIT   (scores too close together)
else if diff > 0         -> UP     (with a small RSI-overbought penalty)
else                      -> DOWN   (with a small RSI-oversold penalty)

if confidence < minConfidence (default 55) -> forced WAIT
```

Example, matching the project brief:

- `UP = 82, DOWN = 18` → **UP**, confidence 82
- `UP = 58, DOWN = 42` → **WAIT** (diff = 16... wait, see note below)
- `UP = 20, DOWN = 80` → **DOWN**, confidence 80

> Note: the brief's illustrative 58/42 example has a diff of 16, which
> would actually clear the 8-point separation bar in the default
> configuration. The `WAIT` case is triggered whenever the two scores are
> close (by default, within 8 points of each other) OR whenever confidence
> falls under the configurable `minConfidence` floor (default 55) — e.g.
> `UP = 54, DOWN = 46` (diff 8, right at the boundary) or `UP = 50,
> DOWN = 50` both resolve to WAIT. Both thresholds are adjustable in
> Settings if you want a stricter or looser bar.

## Signal quality grades

```
A+  : confidence >= 85
A   : confidence >= 75
B   : confidence >= 65
C   : confidence >= 55
WAIT: below the configured minimum
```

Thresholds are configurable (`qualityThresholds` in Settings).

## Anti-noise system

The engine deliberately makes it hard to flip direction on tiny wobbles:

- **Minimum confidence threshold** — anything below `minConfidence` is
  forced to `WAIT` regardless of which side "won".
- **Hysteresis band** (`hysteresisBand`, default 6) — if the new confidence
  is within this band of the *last emitted* signal's confidence and the
  direction hasn't changed, the repeat is marked `suppressedByAntiNoise:
  true` rather than treated as a fresh signal.
- **Cooldown** (`cooldownCandles`, default 3) — a *direction flip*
  (UP→DOWN or DOWN→UP) within this many candles of the last emitted signal
  is suppressed; the engine keeps reporting the previous decision until the
  cooldown window has passed.
- **Candle-close confirmation** (`requireClosedCandle`, default `true`) —
  the app is expected to feed the engine closed candles by default rather
  than an in-progress candle, so a signal isn't generated and then
  invalidated by the same candle finishing differently.
- **Minimum data requirement** (`minCandles`, default 60) — below this, the
  engine returns an explicit "insufficient data" `WAIT` result rather than
  guessing from a handful of candles.

## Multi-timeframe confirmation

If you pass a `{ higherTimeframeTrend: "up" | "down" | "sideways" }`
context as the second argument to `analyze()`:

- Higher timeframe **agrees** with the current-timeframe decision → small
  confidence boost (+6, capped at 100).
- Higher timeframe is **sideways** → small confidence penalty (-3).
- Higher timeframe **disagrees outright** → the decision is downgraded to
  `WAIT` ("pullback condition"), matching the brief's example (5m bullish,
  1m bearish → WAIT).

## Breakout / breakdown classification

Both `breakout.js` and `breakdown.js` require multiple simultaneous
confirmations (price crossing the level, candle closing beyond it, minimum
distance threshold, momentum agreement, trend agreement, and — when
available — volatility/volume context) before returning `"confirmed"`
rather than `"possible"`. A prior breakout/breakdown that fails to hold and
closes back on the original side of the level is classified
`"false-breakout"` / `"false-breakdown"` instead of silently disappearing.

## What this system is not

It is not a price predictor, not a guarantee, and not investment advice.
See the README's Limitations and Disclaimer sections.
