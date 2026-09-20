# Troubleshooting

## The workspace is blank or has no height

Give the container an explicit height, or a flex/grid allocation with a parent that
has a defined height. Percentage heights need a sized parent. Import
`quilt-vanilla/styles.css` or `quilt-react/styles.css` once in the application.

## A pane shows an unknown-type placeholder

The pane's `type` must match a registered renderer or component. Loading JSON does
not register its types. Register them in the application; the pane record and ID
remain available until the view is supplied.

## A popout does not open

Call `popout(id)` directly from a click or other user gesture, before awaiting other
work. Check workspace `popouts` and the pane's capabilities. The returned promise
resolves to `false` if opening or mounting fails; the source pane is preserved.
Browsers may open tabs instead of windows or restrict placement.

## React state resets when a pane moves to a window

Changing documents remounts the view. Put durable state outside the pane component,
and subscribe to it from the view. Declarative `<Workspace>` panes receive application
providers through portals. The imperative `reactRenderer` creates a separate root.

## A theme property disappears after setTheme

`setTheme` replaces overrides. Pass the complete desired object, for example
`{ ...themes.dark, accent: '#82baff' }`. Passing `{}` clears API overrides and allows
container CSS variables to inherit again. Call `refreshTheme()` after CSSOM or
media-driven changes that do not cause DOM mutations.

## An exported theme looks different in another application

Theme files include configured tokens. They do not bundle fonts, application CSS
variables, or pane-content styles. Supply those dependencies in the receiving
application. See the [theme reference](theming.md).

## Saving did not preserve a detached window or document content

Workspace presets deliberately restore popped-out panes docked. Store application
content separately. The JSON contains layout and appearance, not application data.

## A pane renderer fails

Use `onError` to report failures and `retryPane(id)` after fixing the cause. Report
asynchronous renderer failures through the supplied `reportError` callback.

## Where to report an issue

Include the Quilt version, browser or desktop host, a small reproduction, and any
reported error in a [GitHub issue](https://github.com/niko-dellic/quilt/issues).
Remove sensitive application data from shared workspace JSON.
