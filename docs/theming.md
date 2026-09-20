# Theming

Themes style workspace chrome: tabs, menus, dividers, picker, and companion window
bars. Pane content is application-owned and may consume these same tokens. A
canvas's authored colors are content, not theme tokens.

Quilt accepts CSS custom properties on its container. Variables inherit normally. Defaults are CSS
fallbacks, so a nested `.layouts` element does not overwrite container values.

```css
.my-workspace {
  --layouts-panel: var(--panel);
  --layouts-header: var(--panel2);
  --layouts-text: var(--ink);
  --layouts-line: var(--line);
  --layouts-accent: var(--accent);
}
```

| Typed key      | CSS property              | Role / default                                    |
| -------------- | ------------------------- | ------------------------------------------------- |
| `bg`           | `--layouts-bg`            | Workspace and divider background / `#161a20`      |
| `panel`        | `--layouts-panel`         | Content surface, selected tab, input / `#1d222a`  |
| `header`       | `--layouts-header`        | Headers and menus / `#242a34`                     |
| `text`         | `--layouts-text`          | Primary text / `#e5e9f0`                          |
| `muted`        | `--layouts-muted`         | Secondary text / `#a2acba`                        |
| `line`         | `--layouts-line`          | Borders / `#39414e`                               |
| `accent`       | `--layouts-accent`        | Selection, resize and drop indicators / `#8bbaaa` |
| `focus`        | `--layouts-focus`         | Keyboard focus / `#b3decf`                        |
| `radius`       | `--layouts-radius`        | Control corners / `5px`                           |
| `fontFamily`   | `--layouts-font-family`   | Chrome font / `system-ui, sans-serif`             |
| `fontSize`     | `--layouts-font-size`     | Chrome text size / `13px`                         |
| `headerHeight` | `--layouts-header-height` | Tab strip height / `34px`                         |

`panelPadding` / `--layouts-panel-padding` sets the shared panel inset (default
`8px`; use a nonnegative CSS length). Floating tab bars use it for their edge
inset. Application content can use `padding: var(--layouts-panel-padding, 8px)`;
the demo uses it for Hotkeys, Objects, Inspector, Timeline, and Theming. Canvas
content stays edge-to-edge. Table cell padding and control spacing remain separate.
For example, `workspace.setTheme({ panelPadding: '12px' })` aligns content and
floating chrome with one value.

Use the typed API for presets and runtime changes:

```ts
import { Workspace, themes } from 'quilt-vanilla';
const workspace = new Workspace({
  container: host,
  initialLayout,
  renderers,
  tabs,
  theme: { ...themes.light, accent: '#8060c0' },
});
workspace.setTheme(themes.dark);
workspace.setTheme({}); // remove API overrides; inherit container CSS again
```

`themes.dark`, `themes.light`, and `themes.sage` provide color presets. Values are
CSS strings. `setTheme` replaces the previous API overrides rather than merging
with them. Precedence follows normal CSS: inline API overrides, local CSS rules,
inherited container values, then dark fallback values. Theme changes do not
reload JSON, dispose views, or reset application data. React accepts the same
`theme` prop and updates it without remounting; its imperative ref also exposes
`setTheme`.

Companion windows receive the resolved workspace tokens when opening and when
host/ancestor attributes or head styles change. Arbitrary media-query changes or
stylesheet edits made only through CSSOM do not emit DOM mutations; call
`refreshTheme()` when driving themes that way. Use concrete CSS values in API themes
when custom properties depend on ancestors absent from companion windows.

Theme preferences are separate from core layout JSON and included as configured overrides in workspace presets. The
library does not read OS preferences or write browser storage. The demo theme
selector switches chrome presets; visualization palettes remain authored data.

## Exporting theme files from the demos

Open the **Theming** tab in the [vanilla](https://quilt-layouts.vercel.app/vanilla.html)
or [React](https://quilt-layouts.vercel.app/react.html) demo. Choose a preset, edit
the controls in its accordions, and click **Export theme** at the bottom to download
`quilt-theme.json`. Colors, font family, spacing, scrollbars, and frozen borders
accept CSS values, including custom-property references and relative lengths.
Invalid CSS values leave the applied theme unchanged. Export captures the actual
mounted theme, including settings loaded through Workspace JSON.

The file is a plain `LayoutTheme` object, not a workspace preset:

```json
{
  "panel": "#171717",
  "text": "#fafafa",
  "accent": "#82baff",
  "headerHeight": "2.5rem"
}
```

With a bundler that supports JSON imports (and TypeScript's `resolveJsonModule`):

```tsx
import theme from './quilt-theme.json';
import { Workspace, type LayoutTheme } from 'quilt-react';

const customTheme = theme satisfies LayoutTheme;
// Vanilla: mounted.setTheme(customTheme);
<Workspace initialLayout={initialLayout} components={components} theme={customTheme} />;
```

For a user-selected file, parse its text and pass the object to `setTheme` in a
try/catch. Quilt rejects unknown token names and non-string values; CSS value
interpretation belongs to the browser. The demo fields also check CSS syntax before applying values. Empty fields clear
custom overrides. Selecting a preset replaces color overrides and retains density
and geometry settings. Theme-file import belongs to your application; the demos
load complete workspace presets through Layout JSON.

Only configured tokens are exported, not computed colors, layout settings, pane
data, fonts, or stylesheets. A value such as `var(--brand-color)` still requires
that application variable; its preview uses the surrounding page's CSS when
available. Install fonts and provide application styles in companion documents
as described below. Relative lengths resolve in the consuming application's context.

## Families, density and portable presets

`themeFamilies.neutral`, `.zinc`, `.stone` and `.mist` each expose `light` and
`dark` color objects inspired by shadcn palettes. Existing `themes.dark`,
`themes.light` and `themes.sage` retain their values. Both demo selectors include
all variants. Choose the family and mode in your application; Quilt has no
singleton preference state, persistence, or framework dependency.

Additional tokens:

| Typed key      | CSS property              | Default                                  |
| -------------- | ------------------------- | ---------------------------------------- |
| scrollbarThumb | --layouts-scrollbar-thumb | line token                               |
| scrollbarTrack | --layouts-scrollbar-track | transparent                              |
| scrollbarSize  | --layouts-scrollbar-size  | 6px (WebKit; standards engines use thin) |
| controlHeight  | --layouts-control-height  | 28px                                     |
| spacing        | --layouts-spacing         | 5px                                      |

Chrome font weight inherits from the host. Density can be expressed with
`headerHeight`, `controlHeight`, `spacing` and `fontSize`; structural pane sizes
and divider gaps remain layout configuration. Font files and licensing belong to
the consuming application. The library never downloads a font.

```ts
import { themeFamilies, type LayoutTheme } from 'quilt-vanilla';
const myThemes = {
  graphite: { ...themeFamilies.zinc.dark, accent: '#82baff' },
} satisfies Record<string, LayoutTheme>;
workspace.setTheme({
  ...myThemes.graphite,
  fontSize: '13px',
  headerHeight: '38px',
  controlHeight: '32px',
});
```

```tsx
import { Workspace, themeFamilies } from 'quilt-react';
// Changing this prop updates chrome without remounting registered content.
<Workspace
  initialLayout={initialLayout}
  components={components}
  theme={themeFamilies.stone.light}
/>;
```

### Mapping shadcn semantic roles

```css
.workspace {
  --layouts-bg: var(--background);
  --layouts-panel: var(--card);
  --layouts-header: var(--muted);
  --layouts-text: var(--foreground);
  --layouts-muted: var(--muted-foreground);
  --layouts-line: var(--border);
  --layouts-accent: var(--primary);
  --layouts-focus: var(--ring);
  --layouts-radius: var(--radius);
  --layouts-font-family: var(--font-sans);
}
```

No Tailwind installation is required for these variables. Set all overrides as
one theme object when switching a preset: `setTheme` replaces previous inline
overrides. Use `setTheme({})` to return to CSS inheritance. Workspace JSON includes configured theme overrides, including `fontFamily`.
Application preferences and font files must be saved or loaded separately. Copy application content
variables and font styles to companion documents in `prepareWindow`; the library
propagates its own resolved chrome tokens on subsequent theme changes. Theme
updates never reset pane view state, selection, or content renderers.

## Tab bars

The default full-width tab bar reserves a header row. Set `tabBar` on
`Workspace` or React's `Workspace` to use a content-fitting overlay instead:

```ts
const tabBar = {
  mode: 'tapered' as const,
  shape: 'round' as const,
  regions: { 'inspector-group': { mode: 'full' as const } },
};
```

`TabBarStyle` accepts `mode: 'full' | 'tapered'`,
`shape: 'angle' | 'round' | 'scoop' | 'vertical' | 'rounded'`, and optional `taperWidth` in positive,
finite CSS pixels. The default shape is `angle`; omitted width matches the
header height. All curved and angled caps extend farther right at the top than
at the bottom. Use `{ mode: 'tapered', shape: 'vertical' }` for a fitted bar
with a straight vertical edge and no cap; `taperWidth` has no effect for this
shape. `TabBarOptions.regions` supplies partial overrides keyed by
stable group IDs. New groups inherit the workspace default.

Tapered tabs fit their icon, label, and close button up to 180px. The actions
button follows the tabs, then the end cap. When that footprint cannot leave 12px clear at the pane edge,
the cap disappears and the bar fills the region. Tabs use the existing
compression and scrolling behavior; the menu stays visible. The cap returns
when space permits. Content remains underneath in either case, so resizing
or adding tabs does not move the pane content.

The area beside the short bar remains interactive. Applications should keep
essential content clear of the painted bar. Each region exposes
`--layouts-tab-bar-width` (including the cap) and `--layouts-tab-bar-height`,
both in pixels, for positioning content. Hidden headers expose zero values.
The demos show using the height to inset inspector and help content while
allowing the scene to fill the region.

Call `mounted.setTabBar(options)` to replace the current configuration without
remounting pane views. Passing `{}` restores defaults. Invalid shape/mode values
or nonpositive/nonfinite widths throw without changing the current configuration.
React prop changes update the same renderer in place; callback and component-map
identity changes do not rebuild the workspace. Tab-bar settings are included in
workspace JSON, but excluded from raw core layout JSON.
Companion windows retain their title and Return bar; returning a pane uses the
destination group's settings. End caps use SVG paths and theme colors, without
requiring CSS `corner-shape` support.

Active tabs use a rounded, inset background to indicate selection.
The demos expose header height, text size, control corner radius, theme presets,
and fitted-bar shape in the right-side Theming tab.

Set `tabBar: { placement: 'left' }` for a 32px icon-only rail. Full mode reserves this space; fitted styles overlay the content and taper at the bottom, with the same 12px edge clearance as top tabs. Hovering
an icon shows the renderer's tooltip with the full tab name. Up/Down
arrows navigate the tabs; Home/End and vertical drag reordering are supported.
The actions menu includes Close, and middle-click closing remains available when
enabled. `placement: 'top'` restores top tabs; mode and shape apply in both placements.
Placement supports region overrides and live changes through `setTabBar`.

`resizeHandleWidth` sets the default divider gap as a CSS length (default `'4px'`).
Explicit split gaps still take precedence for resizable dividers.
Disabled dividers have no gap by default. Set `disabledResizeHandleWidth` to a
CSS length to show their space without enabling resizing. The demo's
“Show disabled resize handles” switch uses the selected handle width. These
renderer settings affect allocation and resize limits without modifying Layout JSON.

When a disabled divider has no gap, a 1px decorative border marks its shared
edge by default. It uses the theme's `line` color, takes no layout space, and
never intercepts input. Set `frozenPaneBorder` (CSS: `--layouts-frozen-pane-border`)
to `'transparent'` to hide it or another CSS color to override it. Borders are
omitted when disabled resize gaps are shown. Both demos group handle width,
auto collapse and disabled handles under **Resizing**. The single “Show disabled
resize handles” checkbox automatically shows shared borders when unchecked.

### Saved orientation per region

Each pane region's actions menu includes **Tab orientation**: horizontal (top),
vertical (left), or workspace default. Tabs sharing a region share its orientation.
The choice is saved as the optional group field `tabPlacement: 'top' | 'left'`
in Layout JSON v1. Existing JSON without this field continues to inherit renderer
settings. A saved choice takes precedence over global and region `tabBar.placement`
settings; other bar settings still apply normally.

Use `workspace.setTabPlacement(groupId, 'left')` (or `'top'`) to change it live without
remounting content. Pass `undefined` to remove the saved override. Moving a tab
into another region adopts that destination's orientation; preserved regions
retain their setting through popout and return.

`iconSize` (`--layouts-icon-size`, default `16px`) controls tab and menu icons in
both tab orientations. Both demos expose an **Icon size** slider from 12–24px.
Close and overflow action icons retain their compact size.

A gapless frozen boundary has one border owner: its split. Descendant pane frames
and tab outlines omit that shared edge, including across nested splits. This
avoids doubled lines with either tab orientation and every bar shape. Shared borders do not alter content or control bounds.

The demos always show separate **Tab height** and **Tab width** sliders, both
defaulting to `32px`, so mixed pane orientations can be configured independently.
The vertical rail uses `headerWidth` (`--layouts-header-width`, default `32px`);
top tabs use `headerHeight`. Both dimensions update live, including fitted tab outlines.

### Anchored and floating bars

The demo's **Tab orientation** selects top or vertical tabs. **Tab placement**
selects anchored (the default) or floating. Floating bars overlay content with
the `panelPadding` inset (8px by default). Their **Fit** selector offers full-width or fit-width; for vertical
rails this controls the occupied height. **Corner type** selects fitted (square),
rounded, or capsule. Floating bars do not use taper settings. Anchored bars expose
**Taper options**, including `rounded`, a fitted bar with rounded corners and no cap
(distinct from `round`, the curved end cap).

```ts
mounted.setTabBar({
  placement: 'left', // orientation; retained API name for compatibility
  attachment: 'floating',
  fit: 'fit', // 'full' fills the available span, keeping the inset
  corners: 'capsule', // 'fitted' | 'rounded' | 'capsule'
});
```

These renderer settings support `regions` overrides and the React `tabBar` prop.
Saved group `tabPlacement` still overrides orientation. Floating fit defaults to
`fit` and corners to `rounded`. Overflow fills the inset span while keeping the
menu available. Content stays mounted and does not move when floating fit changes;
occupied width/height custom properties include the leading inset.

Both demos start with floating fit-width tabs. Floating bars preserve their inset
from content scrollbars as well as pane edges, including overlay scrollbars. The
available span updates when pane content, overflow, or scrollbar sizing changes.
The leading inset uses `panelPadding` (8px by default). Scrollbar clearance is reserved only at the
trailing edge where the scrollbar appears; it does not push the bar inward
on the opposite side.

### Tab display

`tabBar.display` accepts `automatic` (default) or `compact`, independently of
orientation. Automatic tabs show labels when their allocated width permits;
vertical rails can also show labels when widened. Compact tabs always hide labels
and close buttons, with full-name tooltips. Closing remains available through the
pane menu and enabled middle-click gestures.

Each region's **Tab display** menu offers Workspace default, Automatic, and Compact.
Overrides persist as optional group `tabDisplay` in Layout JSON v1. Set them using
`workspace.setTabDisplay(groupId, 'compact')`; pass `undefined` to inherit the workspace
setting again. Orientation and display overrides do not remount pane content.
The Theming pane exposes the workspace display default and a rail width up to 240px.

Automatic vertical tabs show a close button only for the active tab, at every rail
width. It sits below the tab, centered in the rail. Only that tab reserves the
extra height; inactive tabs and Compact mode hide the close button.

### Corner handles

Both demos include a collapsible **Corner handles** section with bracket, rounded
bracket, square, and dot styles; always/on-hover/hidden visibility; handle size,
inset, stroke width, idle opacity, and muted/border/accent colors. Hovered handles
use full opacity. Hidden handles remove pointer targets; menu split/join actions
remain available. Size includes the drag target, with the mark inset 2px inside it.

Applications can use these `LayoutTheme` values (or their corresponding
`--layouts-corner-handle-*` CSS properties):

| Theme key                 | Default                        |
| ------------------------- | ------------------------------ |
| `cornerHandleSize`        | `8px`                          |
| `cornerHandleInset`       | `0px`                          |
| `cornerHandleColor`       | muted theme color              |
| `cornerHandleOpacity`     | `0.35`                         |
| `cornerHandleDisplay`     | `block` (`none` hides targets) |
| `cornerHandleBorderWidth` | `2px 0 0 2px`                  |
| `cornerHandleRadius`      | `0px`                          |
| `cornerHandleFill`        | `transparent`                  |

For example, a dot uses border width `0`, radius `50%`, and a theme color as fill.
These settings update chrome without remounting pane content or changing JSON.

Tab tooltips depend only on actual label visibility: icon-only tabs show their
full name, including Automatic tabs compressed by available space. Visible labels
suppress tooltips. This applies to both orientations and updates as tabs resize.
Horizontal tooltips appear below the tab; vertical tooltips appear to its right.

## Complete public token mapping

Import `themeProperties` to map every typed key below to its `--layouts-*` CSS
property. Configured overrides are serialized by `exportWorkspace`; inherited
application CSS and font files are not. Omitted tokens use CSS inheritance and
then the defaults below. `setTheme` replaces overrides, and `{}` clears them.

Length tokens support CSS lengths (including `rem`, `em`, and `calc()`). Colors
support CSS color expressions and custom-property references. Opacity is a CSS
number; display is `block` or `none`. Stroke width accepts CSS border-width
shorthand. Family accepts a CSS font-family list. Font files stay app-owned.

| Key                         | Default                 | Value kind       |
| --------------------------- | ----------------------- | ---------------- |
| `bg`                        | `#161a20`               | Color            |
| `panel`                     | `#1d222a`               | Color            |
| `header`                    | `#242a34`               | Color            |
| `text`                      | `#e5e9f0`               | Color            |
| `muted`                     | `#a2acba`               | Color            |
| `line`                      | `#39414e`               | Color            |
| `accent`                    | `#8bbaaa`               | Color            |
| `focus`                     | `#b3decf`               | Color            |
| `radius`                    | `5px`                   | Length           |
| `fontFamily`                | `system-ui, sans-serif` | Family           |
| `fontSize`                  | `13px`                  | Length           |
| `iconSize`                  | `16px`                  | Length           |
| `panelPadding`              | `8px`                   | Length           |
| `headerHeight`              | `34px`                  | Length           |
| `headerWidth`               | `32px`                  | Length           |
| `resizeHandleWidth`         | `4px`                   | Length           |
| `disabledResizeHandleWidth` | `0px`                   | Length           |
| `frozenPaneBorder`          | `line`                  | Color            |
| `cornerHandleSize`          | `8px`                   | Length           |
| `cornerHandleInset`         | `0px`                   | Length           |
| `cornerHandleColor`         | `muted`                 | Color            |
| `cornerHandleOpacity`       | `0.35`                  | Number           |
| `cornerHandleDisplay`       | `block`                 | Display          |
| `cornerHandleBorderWidth`   | `2px 0 0 2px`           | Stroke shorthand |
| `cornerHandleRadius`        | `0px`                   | Length           |
| `cornerHandleFill`          | `transparent`           | Color            |
| `scrollbarThumb`            | `line`                  | Color            |
| `scrollbarTrack`            | `transparent`           | Color            |
| `scrollbarSize`             | `6px`                   | Length           |
| `controlHeight`             | `28px`                  | Length           |
| `spacing`                   | `5px`                   | Length           |

## Automatic minimum sizes

Mounted workspaces keep each group's tab bar large enough for all its tabs in
their smallest presentation, plus its close and menu controls. This applies to
top and left bars, including floating bars, in both vanilla and React. Automatic
display can hide labels while retaining the active tab's close button; compact
display hides labels and close buttons.

Quilt recalculates this minimum when tabs, orientation, permissions, or theme
geometry change. Larger application-provided pane minimums still apply. If an
application maximum is smaller than the required chrome, the chrome minimum
takes precedence in the mounted view. A single pane with `header: false` has no
tab-bar minimum.

If the container cannot fit the combined minimums, the workspace scrolls rather
than shrinking away tab controls. Pane content can still scroll independently.
These measured constraints are renderer-owned: they do not modify exported
layout JSON or the browser-free layout model. Use `refreshTheme()` after external
CSSOM changes, as described above. Custom CSS that changes Quilt's structural
chrome rules may require its own sizing adjustments.
