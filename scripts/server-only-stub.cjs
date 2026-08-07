// Dev-only preload that lets modules under lib/ be exercised from a plain Node
// script (smoke tests, dry runs) instead of only inside a Next request.
//
//   node --require ./scripts/server-only-stub.cjs --import tsx ./some-script.ts
//
// It neutralises two Next-only constraints:
//
// 1. `server-only` — lib/airtable.ts and lib/retainers.ts import this marker,
//    whose index.js throws unless resolved under the "react-server" export
//    condition. Passing --conditions=react-server fixes that but also flips
//    React to its react-server subset, which throws its own "not yet supported
//    outside of experimental channels" error. Stubbing the one package is the
//    narrow fix.
//
// 2. `unstable_cache` — throws "Invariant: incrementalCache missing" outside a
//    Next request context. Here it becomes a pass-through, so cached readers
//    execute their underlying fetch directly. A script wants live data anyway.
//
// NEVER load this from application code — it defeats a real safety marker and
// silently disables caching.

const path = require("node:path");

// --- 1. server-only -> empty module -------------------------------------
const resolved = require.resolve("server-only");
require.cache[resolved] = {
  id: resolved,
  filename: resolved,
  path: path.dirname(resolved),
  loaded: true,
  children: [],
  paths: [],
  exports: {},
};

// --- 2. unstable_cache -> pass-through ----------------------------------
// Patched before lib/* is loaded, so the app's import picks up the stub.
try {
  const nextCache = require("next/cache");
  Object.defineProperty(nextCache, "unstable_cache", {
    value: (fn) => fn,
    configurable: true,
    writable: true,
  });
} catch (err) {
  console.warn("[server-only-stub] could not patch next/cache:", err.message);
}
