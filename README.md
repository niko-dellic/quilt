# Quilt

[![CI](https://github.com/niko-dellic/quilt/actions/workflows/ci.yml/badge.svg)](https://github.com/niko-dellic/quilt/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/quilt-react)](https://www.npmjs.com/package/quilt-react)

<!-- shared-overview:start -->

Quilt is a TypeScript library for split panes, tab groups, and popout windows.
It provides a framework-independent layout model, a DOM renderer, and React bindings.
Applications supply pane content and manage their own data and storage.

- Nested horizontal and vertical splits, with minimum and maximum pane sizes.
- Tab groups with configurable orientation, appearance, and per-pane permissions.
- CSS theme tokens and typed theme presets.
- Versioned JSON for layout and workspace settings.
- Same-origin popout windows that return their panes when closed.
- Keyboard navigation, optional shortcuts, and optional close confirmation.

## Demos

- [Vanilla TypeScript](https://quilt-layouts.vercel.app/vanilla.html)
- [React](https://quilt-layouts.vercel.app/react.html)
- Customize and export theme JSON from the **Theming** tab in either demo.
- [Electron desktop downloads](https://quilt-layouts.vercel.app/electron.html) for macOS, Windows, and Ubuntu/Debian

![Quilt demo showing pane arrangements, scene interaction, and workspace presets](docs/media/demo-walkthrough.webp)

See [screenshots and controls](docs/showcase.md) or the [application examples](examples/README.md).
The desktop application contains the same vanilla and React demos and runs offline.
Demo builds have no trusted developer certificate; see the [installation notes](docs/desktop-release.md).

<!-- shared-overview:end -->

## Packages

| Package         | Purpose                                                                                   |
| --------------- | ----------------------------------------------------------------------------------------- |
| `quilt-core`    | Layout model, validation, constraints, commands, and subscriptions; no browser dependency |
| `quilt-vanilla` | DOM renderer, tabs, menus, gestures, themes, and companion windows                        |
| `quilt-react`   | React components and hooks using the same model and DOM renderer                          |

Packages include ESM, TypeScript declarations, and source maps. React is a peer
dependency of `quilt-react`; it is not required by `quilt-vanilla`.
See [host compatibility](docs/compatibility.md) for tested environments and limitations.

## Installation

```sh
# Vanilla DOM
npm install quilt-vanilla

# React
npm install quilt-react

# Layout model only
npm install quilt-core
```

The adapters install their Quilt dependencies automatically. React applications need
React and React DOM 18.3 or 19. These are peer dependencies, so Quilt shares the
application’s React installation. In an existing React app, the command above is enough.

Use ESM imports and a bundler with CSS support. Import the adapter stylesheet once
and give the workspace container an explicit height. TypeScript React applications
also need matching `@types/react` and `@types/react-dom` packages.

## Quickstart

```ts
import { createLayout, LayoutStore, mountLayout } from 'quilt-vanilla';
import 'quilt-vanilla/styles.css';

const store = new LayoutStore(createLayout());
const workspace = mountLayout(document.getElementById('workspace')!, { store });
// Give #workspace an explicit height. Dispose both objects when removing it.
```

Follow the [Vanilla quickstart](https://quilt-layouts.vercel.app/docs/quickstart-vanilla)
or [React quickstart](https://quilt-layouts.vercel.app/docs/quickstart-react) to add application content.

## Configuration and persistence

Register pane types with `PaneRegistry`, or use separate `TabRegistry` and renderer
maps. Configure themes through CSS custom properties or `setTheme`. Tab orientation,
shape, and placement can be set globally or per region. Pane size constraints can
also define fixed toolbars and sidebars.

```ts
const json = JSON.stringify(mounted.exportWorkspace());
mounted.loadWorkspace(JSON.parse(json));
```

Workspace JSON contains layout, theme overrides, tab-bar settings, and automatic
collapse settings. Invalid input leaves the workspace unchanged. Exports save
popped-out panes in docked positions without closing their live windows. Loading
a workspace closes superseded companions and restores panes in the main layout.

Application data, renderer registrations, callbacks, stylesheets, and font files
are not included. Raw core snapshots remain available for model consumers.
See [save/load and storage examples](docs/integration.md#workspace-json).

## Limitations

- Each popout contains one pane and depends on the main session and the same origin.
- Browser popouts require a user action. Browsers may adjust their size and position
  or open a tab instead. Loading JSON does not open windows.
- Quilt does not provide storage or native window restoration.
- Electron is tested with the included hosts. Tauri native popouts and dedicated
  Vue bindings are not implemented; see [host compatibility](docs/compatibility.md).
- If a workspace is smaller than its pane constraints allow, it scrolls.

<!-- shared-docs:start -->

## Documentation

- [Getting started](https://quilt-layouts.vercel.app/docs/getting-started)
- [API reference](https://quilt-layouts.vercel.app/docs/api-reference/)
- [Themes and tab bars](https://quilt-layouts.vercel.app/docs/theming)
- [Registration, React context, persistence, and confirmation](https://quilt-layouts.vercel.app/docs/integration)
- [Examples](https://quilt-layouts.vercel.app/docs/examples)
- [Troubleshooting](https://quilt-layouts.vercel.app/docs/troubleshooting)
- [Migration](https://quilt-layouts.vercel.app/docs/migration)
- [Changelog](https://github.com/niko-dellic/quilt/blob/main/CHANGELOG.md)

<!-- shared-docs:end -->

## Development

Use Node 24. From a checkout:

```sh
npm ci
npm run build
npm run dev
```

Open [localhost:5186](http://localhost:5186). Demos use compiled package outputs;
rebuild after changing library source.

To run the checks:

```sh
npx playwright install chromium firefox webkit
npm run check
```

The suite covers the model, browser interactions and companion windows, React
bindings, and applications installed from package archives. Electron tests need a
display; Linux CI uses Xvfb. See [contributing](CONTRIBUTING.md),
[site deployment](docs/deployment.md), and [release instructions](docs/releases.md).

## License

[MIT](LICENSE) © niko-dellic
