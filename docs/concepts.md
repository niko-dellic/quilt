# Core concepts

## Pane

A pane is a record with a stable ID, a type, and a title. Its type selects the
application renderer or React component. Metadata belongs in the layout; durable
application data belongs in your application state.

## Group and split

A group holds panes as tabs and identifies the active pane. A split divides two
child regions horizontally or vertically. Splits and groups form a tree, so layouts
can nest. Pane size constraints limit how regions can resize.

## Store and mounted workspace

`LayoutStore` owns the validated layout model. `mountLayout` or React's `<Layout>`
connects it to the DOM and adds interaction, chrome, and companion windows.
Keep the store stable while the workspace is mounted. Replacing it replaces the
workspace session. Dispose a store you own after its views are unmounted.

## Views and application data

Moving within one document preserves stable views where supported. Moving to or
from a companion document remounts the view. React-local component state cannot
be relied on across that transition. Keep documents, jobs, and durable state outside
renderer lifetimes; dispose view resources without deleting application data.

[Lifecycle details](lifecycle.md) describe readiness, cleanup, and failure handling.

## Three kinds of JSON

| File or value    | Includes                                                        | Use it for                            |
| ---------------- | --------------------------------------------------------------- | ------------------------------------- |
| Raw layout       | Pane records, tree, detached records                            | Advanced model manipulation           |
| Workspace preset | Docked layout, theme overrides, tab-bar settings, auto-collapse | Save/restore user configuration       |
| Theme            | Typed appearance overrides                                      | Share appearance between applications |

Callbacks, components, fonts, stylesheets, and pane data are not serialized.
Workspace exports leave live popouts untouched but save them docked. Loading a
workspace closes superseded companions; it never opens new windows.

[Persistence guide](integration.md#workspace-json) · [Theme files](theming.md#exporting-theme-files-from-the-demos)
