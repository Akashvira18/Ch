/**
 * run.js - test suite entry point.
 * Usage: node tests/run.js
 * No install step required - pure ES modules, Node 18+ (uses only
 * built-ins). This is a dev-time tool only; it is not shipped to the
 * static site.
 */
import { summary } from "./testHarness.js";

await import("./analysis.indicators.test.js");
await import("./analysis.structure.test.js");
await import("./engine.integration.test.js");
await import("./backtest.test.js");
await import("./data.adapters.test.js");

summary();
