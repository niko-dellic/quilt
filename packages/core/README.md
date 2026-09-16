# quilt-core

Framework-independent layout JSON, validation, commands, and subscriptions. No DOM or React dependency. MIT licensed; ships ESM, TypeScript declarations, and sources for editor navigation.

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

![Quilt demo showing pane arrangements, scene interaction, and workspace presets](https://raw.githubusercontent.com/niko-dellic/quilt/main/docs/media/demo-walkthrough.webp)

See [screenshots and controls](https://github.com/niko-dellic/quilt/blob/main/docs/showcase.md) or the [application examples](https://github.com/niko-dellic/quilt/blob/main/examples/README.md).
The desktop application contains the same vanilla and React demos and runs offline.
Demo builds have no trusted developer certificate; see the [installation notes](https://github.com/niko-dellic/quilt/blob/main/docs/desktop-release.md).

<!-- shared-overview:end -->

## Install

```sh
npm install quilt-core
```

Use ESM imports. For local development archives, see [packaging instructions](https://github.com/niko-dellic/quilt/blob/main/docs/packaging.md).

## Use

```ts
import { createLayout, LayoutStore, validate } from 'quilt-core';

const store = new LayoutStore(
  createLayout({
    pane: { id: 'notes', type: 'notes', title: 'Notes' },
  }),
);
const unsubscribe = store.subscribe(({ action, layout }) => {
  console.log(action, JSON.stringify(layout));
});
store.split('main', 'horizontal', {
  id: 'preview',
  type: 'preview',
  title: 'Preview',
});
console.log(validate(store.export())); // []
unsubscribe();
store.dispose();
```

`createLayout()` returns a fresh empty layout. `createLayout({ pane, groupId })` returns a validated clone, activates the supplied pane, and defaults `groupId` to `main`. It preserves IDs and throws `LayoutError` for invalid input. `parseLayout` validates complete JSON; `validate` returns issues without throwing for invalid layout input.

Development and verification use Node 24; browser use requires modern JavaScript support including `structuredClone`. This package needs no stylesheet or host element. The `quilt-vanilla` DOM adapter and `quilt-react` binding provide views. Application data and persistence remain application-owned.

See [API documentation](https://github.com/niko-dellic/quilt/blob/main/docs/api.md) and [migration notes](https://github.com/niko-dellic/quilt/blob/main/docs/migration.md).

<!-- shared-docs:start -->

## Documentation

- [Configuration and API](https://github.com/niko-dellic/quilt/blob/main/docs/api.md)
- [Themes and tab bars](https://github.com/niko-dellic/quilt/blob/main/docs/theming.md)
- [Registration, React context, persistence, and close confirmation](https://github.com/niko-dellic/quilt/blob/main/docs/integration.md)
- [Pane and window lifecycle](https://github.com/niko-dellic/quilt/blob/main/docs/lifecycle.md)
- [Application examples](https://github.com/niko-dellic/quilt/blob/main/examples/README.md)
- [0.2.1 upgrade checklist](https://github.com/niko-dellic/quilt/blob/main/docs/migration.md)
- [Local packages and consumer integration](https://github.com/niko-dellic/quilt/blob/main/docs/packaging.md)
- [Changelog](https://github.com/niko-dellic/quilt/blob/main/CHANGELOG.md)

<!-- shared-docs:end -->
