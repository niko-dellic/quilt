# Contributing

Use Node 24 and `npm ci`. Build packages in dependency order with `npm run build`; demos consume package output, not sibling source aliases. Rebuild after package edits, and restart Vite after reinstalling dependencies.

The core package contains no DOM, React, timers, storage, or browser-window code. The DOM package owns arrangement and chrome, not application data. React bindings reuse the DOM implementation and core store; do not introduce a second layout model. Keep lifetimes explicit and release all listeners, observers, frames, roots, and companion windows.

JSON v1 is a public contract. Add versioned migrations for future breaking changes. Core commands must validate atomically and preserve the old snapshot on failure. Do not silently discard panes to resolve a constraint conflict.

Validation: `npm run check`. The full gate builds packages, checks demo/test types, runs unit tests, exercises Chromium/Firefox/WebKit, builds demos, and installs packed artifacts in an isolated temporary consumer. Install test browsers first with `npx playwright install chromium firefox webkit`.

The npm packages are `quilt-core`, `quilt-vanilla`, and `quilt-react`. `npm run pack:all` writes three local archives and a checksum manifest in `artifacts/packages`. Do not commit node_modules, dist, test output, or generated archives. See [release instructions](docs/releases.md) for npm publication and desktop builds.

Keep changes focused. Tests should cover observable behaviors and failure recovery, particularly cross-document lifetime and preservation of application-owned data.

## Shared package documentation

Edit the `shared-overview` and `shared-docs` sections in the root README, then run
`npm run docs:sync`. Package installation and usage sections stay package-specific.
Generated sections use absolute image and documentation URLs for npm.
`npm run docs:check` (included in `npm run check`) rejects stale package READMEs.
