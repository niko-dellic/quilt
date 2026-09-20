# Core concepts

## Pane

A pane is a record with a stable ID, a type, and a title. Its type selects the
application renderer or React component. Metadata belongs in the layout; durable
application data belongs in your application state.

## Group and split

A group holds panes as tabs and identifies the active pane. A split divides two
child regions horizontally or vertically. Splits and groups form a tree, so layouts
can nest. Pane size constraints limit how regions can resize.

## Workspace and layout

A **workspace** is the running Quilt instance: it owns the layout model, views,
interactions, dialogs, and companion windows. Vanilla creates `new Workspace({ container })`;
React mounts `<Workspace>`. There is no store to construct or manage.

A **layout** is the serializable arrangement of panes, groups, and splits.
`workspace.getLayout()` reads a stable immutable snapshot. `exportWorkspace()` also
includes appearance and workspace settings for persistence.

A **pane type** supplies creation metadata and its renderer or React component.
`workspace.addPane('notes')` creates an instance and returns a **pane handle**.
Use its methods to change the pane; use `id` for identity and `title` for its label.

The browser-free `LayoutStore` in `quilt-core` is an advanced model-only API.
It cannot be injected into a mounted workspace.

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
