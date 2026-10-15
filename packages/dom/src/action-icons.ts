import type { ResolvedLayoutOptions } from './types.js';
const paths = {
  'add-tab': ['M12 5v14M5 12h14'],
  'split-right': ['M3 4h18v16H3z', 'M12 4v16'],
  'split-below': ['M3 4h18v16H3z', 'M3 12h18'],
  'tab-orientation': ['M3 4h18v16H3z', 'M3 9h18', 'M8 9v11'],
  join: ['M3 4h18v16H3z', 'm7 9 3 3-3 3m10-6-3 3 3 3'],
  maximize: ['M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5'],
  dedicate: ['M9 3h6v6l3 3v3H6v-3l3-3z', 'M12 15v6'],
  'allow-tabs': ['M3 4h18v16H3z', 'M3 9h18M9 4v5M15 4v5'],
  restore: ['M3 8h5V3m13 5h-5V3M8 21v-5H3m13 5v-5h5'],
  popout: ['M14 3h7v7m0-7L11 13', 'M10 3H3v18h18v-7'],
  close: ['m6 6 12 12M6 18 18 6'],
  cancel: ['M9 5 2 12l7 7M2 12h14a5 5 0 0 0 0-10'],
} as const;
export type ActionIcon = keyof typeof paths;
/** Small built-in chrome icons; applications may override the namespaced keys. */
export function actionIcon(
  doc: Document,
  name: ActionIcon,
  options: Pick<ResolvedLayoutOptions, 'renderIcon'>,
): Element {
  const custom = options.renderIcon?.(`layouts:${name}`, doc);
  if (custom) return custom;
  const svg = doc.createElementNS('http://www.w3.org/2000/svg', 'svg');
  for (const [key, value] of Object.entries({
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    'stroke-width': '1.7',
    'stroke-linecap': 'round',
    'stroke-linejoin': 'round',
    focusable: 'false',
  }))
    svg.setAttribute(key, value);
  for (const d of paths[name]) {
    const path = doc.createElementNS(svg.namespaceURI, 'path');
    path.setAttribute('d', d);
    svg.append(path);
  }
  return svg;
}
