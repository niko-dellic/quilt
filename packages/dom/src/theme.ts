/** All values are CSS values. Theme state is separate from serialized layout structure. */
export interface LayoutTheme {
  bg?: string;
  panel?: string;
  header?: string;
  text?: string;
  muted?: string;
  line?: string;
  accent?: string;
  focus?: string;
  radius?: string;
  fontFamily?: string;
  fontSize?: string;
  /** Tab and menu icon size (default 16px). */
  iconSize?: string;
  /** Shared floating-tab inset and application content padding in CSS pixels (default 8px). */
  panelPadding?: string;
  headerHeight?: string;
  /** Width of the vertical tab rail (default 32px). */
  headerWidth?: string;
  /** Resize gap in CSS pixels (default 4px). Explicit split gaps take precedence. */
  resizeHandleWidth?: string;
  /** Gap for disabled dividers in CSS pixels (default 0px). */
  disabledResizeHandleWidth?: string;
  /** Border color at disabled, gapless boundaries; defaults to line. Use transparent to hide. */
  frozenPaneBorder?: string;
  /** 16px target size. */
  cornerHandleSize?: string;
  /** CSS cursor over corner handles (default crosshair). */
  cornerHandleCursor?: string;
  /** 0px offset from pane edges. */
  cornerHandleInset?: string;
  /** muted color. */
  cornerHandleColor?: string;
  /** 0.35 idle opacity. */
  cornerHandleOpacity?: string;
  /** block; none disables corner targets. */
  cornerHandleDisplay?: string;
  /** 1px 0 0 1px bracket stroke. */
  cornerHandleBorderWidth?: string;
  /** 0px. */
  cornerHandleRadius?: string;
  /** transparent. */
  cornerHandleFill?: string;
  scrollbarThumb?: string;
  scrollbarTrack?: string;
  scrollbarSize?: string;
  controlHeight?: string;
  spacing?: string;
}
export const themeProperties = {
  bg: '--layouts-bg',
  panel: '--layouts-panel',
  header: '--layouts-header',
  text: '--layouts-text',
  muted: '--layouts-muted',
  line: '--layouts-line',
  accent: '--layouts-accent',
  focus: '--layouts-focus',
  radius: '--layouts-radius',
  fontFamily: '--layouts-font-family',
  fontSize: '--layouts-font-size',
  iconSize: '--layouts-icon-size',
  panelPadding: '--layouts-panel-padding',
  headerHeight: '--layouts-header-height',
  headerWidth: '--layouts-header-width',
  resizeHandleWidth: '--layouts-resize-handle-width',
  disabledResizeHandleWidth: '--layouts-disabled-resize-handle-width',
  frozenPaneBorder: '--layouts-frozen-pane-border',
  cornerHandleSize: '--layouts-corner-handle-size',
  cornerHandleCursor: '--layouts-corner-handle-cursor',
  cornerHandleInset: '--layouts-corner-handle-inset',
  cornerHandleColor: '--layouts-corner-handle-color',
  cornerHandleOpacity: '--layouts-corner-handle-opacity',
  cornerHandleDisplay: '--layouts-corner-handle-display',
  cornerHandleBorderWidth: '--layouts-corner-handle-border-width',
  cornerHandleRadius: '--layouts-corner-handle-radius',
  cornerHandleFill: '--layouts-corner-handle-fill',
  scrollbarThumb: '--layouts-scrollbar-thumb',
  scrollbarTrack: '--layouts-scrollbar-track',
  scrollbarSize: '--layouts-scrollbar-size',
  controlHeight: '--layouts-control-height',
  spacing: '--layouts-spacing',
} as const;
/** Optional application presets: no framework, persistence, or global theme state. */
export const themeFamilies = {
  neutral: {
    dark: {
      bg: '#0a0a0a',
      panel: '#171717',
      header: '#262626',
      text: '#fafafa',
      muted: '#a3a3a3',
      line: '#525252',
      accent: '#e5e5e5',
      focus: '#e5e5e5',
    },
    light: {
      bg: '#fafafa',
      panel: '#ffffff',
      header: '#f5f5f5',
      text: '#171717',
      muted: '#525252',
      line: '#d4d4d4',
      accent: '#262626',
      focus: '#262626',
    },
  },
  zinc: {
    dark: {
      bg: '#09090b',
      panel: '#18181b',
      header: '#27272a',
      text: '#fafafa',
      muted: '#a1a1aa',
      line: '#52525b',
      accent: '#d4d4d8',
      focus: '#d4d4d8',
    },
    light: {
      bg: '#fafafa',
      panel: '#ffffff',
      header: '#f4f4f5',
      text: '#18181b',
      muted: '#52525b',
      line: '#d4d4d8',
      accent: '#3f3f46',
      focus: '#3f3f46',
    },
  },
  stone: {
    dark: {
      bg: '#0c0a09',
      panel: '#1c1917',
      header: '#292524',
      text: '#fafaf9',
      muted: '#a8a29e',
      line: '#57534e',
      accent: '#d6d3d1',
      focus: '#d6d3d1',
    },
    light: {
      bg: '#fafaf9',
      panel: '#ffffff',
      header: '#f5f5f4',
      text: '#1c1917',
      muted: '#57534e',
      line: '#d6d3d1',
      accent: '#57534e',
      focus: '#57534e',
    },
  },
  mist: {
    dark: {
      bg: '#0b1114',
      panel: '#141e23',
      header: '#1e2c32',
      text: '#edf4f7',
      muted: '#9eb5bf',
      line: '#425d69',
      accent: '#8bc5d8',
      focus: '#8bc5d8',
    },
    light: {
      bg: '#f4f8fa',
      panel: '#ffffff',
      header: '#eaf1f4',
      text: '#192c35',
      muted: '#465f6b',
      line: '#b8ccd5',
      accent: '#28647b',
      focus: '#28647b',
    },
  },
} as const satisfies Record<string, { dark: LayoutTheme; light: LayoutTheme }>;
export const themes = {
  dark: {
    bg: '#161a20',
    panel: '#1d222a',
    header: '#242a34',
    text: '#e5e9f0',
    muted: '#a2acba',
    line: '#39414e',
    accent: '#8bbaaa',
    focus: '#b3decf',
  },
  light: {
    bg: '#dce1e8',
    panel: '#ffffff',
    header: '#f0f3f7',
    text: '#202936',
    muted: '#586579',
    line: '#c9d1dc',
    accent: '#357a69',
    focus: '#195fc1',
  },
  sage: {
    bg: '#cbd3c7',
    panel: '#f1f3ed',
    header: '#e9ede4',
    text: '#2d4133',
    muted: '#72816e',
    line: '#d0d8c9',
    accent: '#6a957a',
    focus: '#316c4b',
  },
} as const satisfies Record<string, LayoutTheme>;
export function applyTheme(root: HTMLElement, theme: LayoutTheme) {
  validateTheme(theme);
  for (const key of Object.keys(themeProperties) as (keyof LayoutTheme)[]) {
    const value = theme[key];
    if (value === undefined) root.style.removeProperty(themeProperties[key]);
    else root.style.setProperty(themeProperties[key], value);
  }
}

export function validateTheme(theme: LayoutTheme) {
  if (!theme || typeof theme !== 'object' || Array.isArray(theme))
    throw new Error('Expected theme object');
  for (const [key, value] of Object.entries(theme)) {
    if (!Object.hasOwn(themeProperties, key) || typeof value !== 'string')
      throw new Error(`Invalid theme token: ${key}`);
  }
}
/** Resolve inherited CSS lengths using the same browser engine that paints chrome. */
export function themePixels(root: HTMLElement, property: string, fallback: number): number {
  const probe = root.ownerDocument.createElement('span');
  probe.style.cssText =
    'position:absolute;visibility:hidden;pointer-events:none;height:0;padding:0;border:0;min-width:0;max-width:none;';
  probe.style.width = `${fallback}px`;
  const authored = root.ownerDocument
    .defaultView!.getComputedStyle(root)
    .getPropertyValue(property)
    .trim();
  if (authored && authored !== 'auto') probe.style.width = authored;
  root.append(probe);
  try {
    const width = root.ownerDocument.defaultView!.getComputedStyle(probe).width;
    const value = Number.parseFloat(width);
    return Number.isFinite(value) && value >= 0 ? value : fallback;
  } finally {
    probe.remove();
  }
}
