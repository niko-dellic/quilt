# Quilt desktop demo

This application bundles the vanilla and React demos and their assets. It opens
the vanilla demo; the header switches to React. It runs offline without a separate
Node.js installation.

Download the application from the [desktop page](https://quilt-layouts.vercel.app/electron.html)
or [GitHub Releases](https://github.com/niko-dellic/quilt/releases/tag/desktop-v0.2.2).
See the [release notes](../docs/desktop-release.md) for installation instructions.

## Develop and verify

From the repository root with Node 24:

```sh
npm ci
npm run build:desktop
npm run test:desktop
npm run package:desktop
npm run test:desktop -- --packaged
```

Packaging uses the current host architecture by default. The GitHub Desktop demo
workflow packages macOS arm64/x64 DMGs, a Windows x64 portable EXE, and a Linux x64
DEB on matching runners. Packaged smoke tests exercise both framework showcases,
native popouts, theme synchronization, resize, workspace JSON, and cleanup.
Linux requires a display, supplied in CI by Xvfb.

Run the Desktop demo workflow on main with publish enabled to create a separate
`desktop-v<version>` release with binaries and checksums. This does not republish
npm packages or replace their existing release archives. Existing desktop tags
are not overwritten. Bump the desktop release version before replacing a binary.

The host loads only bundled files with sandboxing, context isolation, and no
Node integration. New windows are restricted to Quilt's about:blank companions.
Closing the main window destroys companions. External repository links open in
the system browser. Both framework examples reuse the same application source
as the web demos; desktop-specific HTML changes are limited to navigation.

These builds have no developer certificate and are not notarized. macOS uses an
ad-hoc signature to keep the bundle internally valid after packaging. See the [release notes](../docs/desktop-release.md) for first-run OS prompts.
