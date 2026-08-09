# Backtesting

## What it does

`src/backtest/backtestEngine.js` replays a historical candle dataset
through the signal engine one candle at a time and records what the engine
*would have* signaled at each point, then checks — strictly using
candles that come **after** that point — whether the move played out.

## How look-ahead bias is prevented

This is the single most important property of the backtest engine, so it's
worth spelling out precisely:

- At step `i`, the engine is called with `candles.slice(0, i + 1)` — i.e.
  only candle `0` through candle `i`, inclusive. It has no way to see
  `candles[i+1]` or anything later.
- A **fresh `SignalEngine` instance** is used for the entire backtest run,
  so hysteresis/cooldown state accumulates the same way it would have
  in a real live session — it isn't reset or replayed with foreknowledge.
- Indicators, support/resistance zones, and market structure are therefore
  computed exactly as they would have been in real time at candle `i` —
  never "smoothed" using future candles.
- Only *after* a signal has been recorded for index `i` does the code look
  at `candles[i+1 .. i+holdCandles]` to score the **outcome** of that
  already-recorded signal. That forward-looking window is used purely for
  grading, never fed back into any indicator or decision.

## Running a backtest

From the **Backtest** tab: choose (or keep) the currently loaded dataset,
set `holdCandles` (how many future candles to evaluate the outcome over),
and the win/loss thresholds (minimum favorable/adverse % move to count as
a WIN or LOSS — anything that reaches neither within the hold window is
`NEUTRAL`). Click Run.

## Reading the results

| Field | Meaning |
|---|---|
| `signals` | One row per non-WAIT, non-suppressed signal generated during the replay |
| `entryPrice` | The close of the candle at the moment the signal fired |
| `outcome` | `WIN` / `LOSS` / `NEUTRAL`, based on which threshold (if any) was hit first within the hold window |
| `returnPercent` | Realized return at the end of the hold window (directionally adjusted for UP vs DOWN) |
| `summary.winRate` | Wins ÷ total signals |
| `summary.avgReturn` | Mean `returnPercent` across all signals |
| `summary.maxDrawdown` | Largest peak-to-trough drop in the simple (non-compounded) cumulative return curve |
| `summary.profitFactor` | Gross positive return ÷ gross negative return (∞ if there were no losing signals) |

## Important limitations

- This is a **historical simulation**, not a live trading record. It
  ignores spread, slippage, fees, liquidity, and order execution
  mechanics entirely.
- Past performance on historical or simulated data is **not** a promise of
  future results. Small sample sizes, one particular symbol/timeframe, or
  a lucky/unlucky regime in your test window can all make results look
  better or worse than the strategy's true edge (if any).
- Changing `holdCandles` and the win/loss thresholds changes the results
  significantly — try a few configurations rather than trusting a single
  run, and be skeptical of settings you had to hand-tune to make the
  numbers look good (overfitting).
- The engine intentionally emits fewer signals when confidence is low
  (`WAIT` is preferred over a weak call) — a backtest with very few
  signals is not evidence of a bad strategy, and a backtest with many
  signals is not automatically evidence of a good one.
