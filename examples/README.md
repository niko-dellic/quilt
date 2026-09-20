# Application examples

Each directory is an independent application with public npm imports, its own
package manifest, and no aliases into Quilt source.

| Starter              | Run after installing |
| -------------------- | -------------------- |
| [Vanilla](vanilla)   | `npm run dev`        |
| [React](react)       | `npm run dev`        |
| [Electron](electron) | `npm start`          |

Use Node 24. Copy a starter directory, run
`npm install`, then the command above. `npm run build` checks TypeScript and builds
the app. Electron loads the built files locally; it needs no development server.

## Testing changes from this checkout

From the repository root:

```sh
npm ci
npm run pack:all
cd examples/vanilla
npm install ../../artifacts/packages/quilt-core-0.3.0.tgz ../../artifacts/packages/quilt-vanilla-0.3.0.tgz
npm run dev
```

Use the same procedure in `examples/electron`, then `npm start`. For
`examples/react`, include `../../artifacts/packages/quilt-react-0.3.0.tgz` in
the install command. These local installs change that copy's dependency paths.
The repository's `npm run test:examples` performs this in temporary copies,
builds all three, and exercises the actual packed packages.

## What to try

1. Edit the note; pop it out and close the companion. The application-owned text
   survives both view mounts.
2. Switch theme while the companion is open. The CSS variable and stylesheet
   reach the other document. React also updates a provider's label.
3. Save workspace while the companion remains open. JSON contains docked layout,
   theme overrides, tab-bar options, and auto-collapse settings.
4. Load that JSON. Invalid input leaves the workspace intact. Note text is
   application data and intentionally outside the workspace document.
5. Close the note. Its registration opts into Quilt's confirmation dialog;
   cancel to preserve it. Remove `confirmClose: true` to disable confirmation.
6. Dispose the workspace while a companion is open to verify teardown.

The theme references `--app-accent`; JSON retains the reference, not the resolved
color or the application's `data-theme` selection. Load the supplied stylesheet
and save application preferences separately. For debounced localStorage with
error handling and cleanup, see [Web integration](../docs/integration.md).

These examples cover a single notes pane. For the packaged desktop demo, see
[desktop](../desktop/README.md). Applications provide authentication, note-data
persistence, and any native window restoration.
