/// <reference types="vite/client" />
import 'quilt-vanilla/styles.css';
import {
  createLayout,
  LayoutStore,
  mountLayout,
  themes,
  themeFamilies,
  themeProperties,
  type LayoutTheme,
  type PaneRenderer,
} from 'quilt-vanilla';

type Token = keyof LayoutTheme;
const query = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const status = query('#theme-status');
const output = query('#theme-json');
const preset = query<HTMLSelectElement>('#theme-preset');
const file = query<HTMLInputElement>('#theme-file');
const exportButton = query<HTMLButtonElement>('#export-theme');
const palettes: Record<string, LayoutTheme> = { ...themes };
for (const [family, modes] of Object.entries(themeFamilies))
  for (const [mode, value] of Object.entries(modes)) palettes[`${family}-${mode}`] = value;
for (const name of Object.keys(palettes)) preset.add(new Option(name.replaceAll('-', ' · '), name));
preset.add(new Option('Custom theme', 'custom'));
preset.value = 'neutral-dark';
let theme: LayoutTheme = { ...palettes[preset.value] };
let revision = 0;
let disposed = false;
let notes = 'Try changing the palette, then pop this pane into a window. Your notes stay here.';
const store = new LayoutStore(
  createLayout({ pane: { id: 'welcome', type: 'sample', title: 'Overview' } }),
);
store.add({ id: 'notes', type: 'sample', title: 'Notes' }, 'main');
store.split('main', 'horizontal', { id: 'details', type: 'sample', title: 'Details' });
const initialLayout = store.export();
const sample: PaneRenderer = ({ element, document: doc, pane }) => {
  element.classList.add('builder-pane');
  const heading = doc.createElement('h2');
  heading.textContent =
    pane.id === 'details' ? 'Small details. Your style.' : 'A place for your ideas.';
  const copy = doc.createElement('p');
  copy.textContent =
    pane.id === 'details'
      ? 'Tab bars, borders, menus, and focus states all share your theme. Resize this pane to see it adapt.'
      : 'This is a real Quilt workspace. Move a tab, explore its menu, or open it in a companion window.';
  element.append(heading, copy);
  for (const color of ['accent', 'focus', 'header', 'line']) {
    const swatch = doc.createElement('span');
    swatch.className = 'builder-swatch';
    swatch.style.background = `var(--layouts-${color})`;
    element.append(swatch);
  }
  const label = doc.createElement('label');
  label.textContent = 'Preview notes';
  const input = doc.createElement('textarea');
  input.value = notes;
  input.setAttribute('aria-label', 'Preview notes');
  const onInput = () => {
    notes = input.value;
  };
  input.addEventListener('input', onInput);
  label.append(input);
  if (pane.id !== 'details') element.append(label);
  return {
    dispose() {
      input.removeEventListener('input', onInput);
    },
  };
};
const mounted = mountLayout(query('#theme-preview'), {
  store,
  renderers: { sample },
  theme,
  tabBar: { attachment: 'floating', fit: 'fit' },
  onError: (error) => {
    status.textContent = error instanceof Error ? error.message : String(error);
  },
});
const groups: Record<string, Token[]> = {
  Colors: ['bg', 'panel', 'header', 'text', 'muted', 'line', 'accent', 'focus'],
  'Typography & spacing': [
    'fontFamily',
    'fontSize',
    'iconSize',
    'radius',
    'panelPadding',
    'headerHeight',
    'headerWidth',
    'controlHeight',
    'spacing',
  ],
  'Dividers & scrollbars': [
    'resizeHandleWidth',
    'disabledResizeHandleWidth',
    'frozenPaneBorder',
    'scrollbarThumb',
    'scrollbarTrack',
    'scrollbarSize',
  ],
  'Corner handles': [
    'cornerHandleSize',
    'cornerHandleInset',
    'cornerHandleColor',
    'cornerHandleOpacity',
    'cornerHandleDisplay',
    'cornerHandleBorderWidth',
    'cornerHandleRadius',
    'cornerHandleFill',
  ],
};
const colors = new Set<Token>([
  ...groups.Colors!,
  'frozenPaneBorder',
  'scrollbarThumb',
  'scrollbarTrack',
  'cornerHandleColor',
  'cornerHandleFill',
]);
function validValue(key: Token, value: string) {
  if (!value.trim()) return false;
  if (key === 'cornerHandleDisplay') return value === 'block' || value === 'none';
  const property = colors.has(key)
    ? 'color'
    : key === 'fontFamily'
      ? 'font-family'
      : key === 'cornerHandleOpacity'
        ? 'opacity'
        : key === 'cornerHandleBorderWidth'
          ? 'border-width'
          : key === 'radius' || key === 'cornerHandleRadius'
            ? 'border-radius'
            : 'width';
  return CSS.supports(property, value);
}
function parseTheme(value: unknown): LayoutTheme {
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error('Expected a theme JSON object, not a workspace preset.');
  for (const [key, token] of Object.entries(value)) {
    if (!Object.hasOwn(themeProperties, key)) throw new Error(`Unknown theme token: ${key}`);
    if (typeof token !== 'string' || !validValue(key as Token, token))
      throw new Error(`Invalid CSS value for ${key}.`);
  }
  return value as LayoutTheme;
}
const fields = new Map<Token, HTMLInputElement>();
const pickers = new Map<Token, HTMLInputElement>();
const cleanups: (() => void)[] = [];
function listen(element: HTMLElement, event: string, fn: EventListener) {
  element.addEventListener(event, fn);
  cleanups.push(() => element.removeEventListener(event, fn));
}
function syncFields() {
  for (const [key, field] of fields) {
    field.value = theme[key] ?? '';
    field.setAttribute('aria-invalid', 'false');
  }
  for (const [key, picker] of pickers) {
    const value = theme[key] ?? '';
    picker.value = /^#[0-9a-f]{6}$/i.test(value) ? value : '#808080';
    picker.title = `Choose a color for ${key}; replaces the CSS expression with a hex color`;
  }
  exportButton.disabled = false;
}
function apply(next: LayoutTheme, message: string, sync = true) {
  mounted.setTheme(next);
  theme = { ...next };
  revision++;
  output.textContent = JSON.stringify(theme, null, 2);
  status.textContent = message;
  if (sync) syncFields();
}
function edit() {
  const next: LayoutTheme = {};
  let invalid: Token | undefined;
  for (const [key, field] of fields) {
    const value = field.value.trim();
    const valid = !value || validValue(key, value);
    field.setAttribute('aria-invalid', String(!valid));
    if (!valid) invalid ??= key;
    else if (value) next[key] = value;
  }
  revision++;
  if (invalid) {
    status.textContent = `Enter a valid CSS value for ${invalid}. Preview keeps the last valid theme.`;
    exportButton.disabled = true;
    return;
  }
  exportButton.disabled = false;
  preset.value = 'custom';
  apply(next, 'Preview updated. Export to keep your theme.', false);
}
for (const [name, keys] of Object.entries(groups)) {
  const details = document.createElement('details');
  details.open = name === 'Colors';
  const summary = document.createElement('summary');
  summary.textContent = name;
  details.append(summary);
  for (const key of keys) {
    const label = document.createElement('label');
    label.className = 'token-field';
    const title = document.createElement('span');
    title.textContent = key.replace(/[A-Z]/g, (c) => ` ${c.toLowerCase()}`);
    const row = document.createElement('div');
    row.className = 'token-inputs';
    const input = document.createElement('input');
    input.type = 'text';
    input.setAttribute('aria-label', key);
    input.placeholder = 'Inherit / default';
    input.title = themeProperties[key];
    fields.set(key, input);
    listen(input, 'input', edit);
    if (colors.has(key)) {
      const picker = document.createElement('input');
      picker.type = 'color';
      picker.setAttribute('aria-label', `Choose ${key} color`);
      pickers.set(key, picker);
      row.append(picker);
      listen(picker, 'input', () => {
        input.value = picker.value;
        edit();
      });
      listen(input, 'input', () => {
        if (/^#[0-9a-f]{6}$/i.test(input.value)) picker.value = input.value;
      });
    }
    row.append(input);
    label.append(title, row);
    details.append(label);
  }
  query('#token-controls').append(details);
}
listen(preset, 'change', () => {
  if (preset.value !== 'custom')
    apply({ ...palettes[preset.value] }, 'Preset applied. Fine-tune any token below.');
});
listen(query('#reset-preview'), 'click', () => {
  store.load(initialLayout);
});
listen(query('#reset-theme'), 'click', () => {
  preset.value = 'neutral-dark';
  apply({ ...palettes['neutral-dark'] }, 'Reset to neutral dark.');
});
listen(query('#import-theme'), 'click', () => file.click());
listen(file, 'change', async () => {
  const selected = file.files?.[0];
  file.value = '';
  if (!selected) return;
  const current = ++revision;
  try {
    if (selected.size > 128 * 1024) throw new Error('Theme files must be smaller than 128 KB.');
    const parsed = parseTheme(JSON.parse(await selected.text()));
    if (disposed || revision !== current) return;
    apply(parsed, `Imported ${selected.name}.`);
    preset.value = 'custom';
  } catch (error) {
    if (!disposed && revision === current)
      status.textContent = `Import failed: ${error instanceof Error ? error.message : String(error)} Your theme is unchanged.`;
  }
});
const urls = new Set<string>();
const timers = new Set<number>();
listen(exportButton, 'click', () => {
  const url = URL.createObjectURL(
    new Blob([JSON.stringify(theme, null, 2) + '\n'], { type: 'application/json' }),
  );
  urls.add(url);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'quilt-theme.json';
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  const timer = window.setTimeout(() => {
    URL.revokeObjectURL(url);
    urls.delete(url);
    timers.delete(timer);
  }, 1000);
  timers.add(timer);
  status.textContent = 'Exported quilt-theme.json. Import it into your app or this builder.';
});
apply(theme, 'Your theme stays in this browser until you export it.');
function dispose() {
  if (disposed) return;
  disposed = true;
  revision++;
  cleanups.forEach((fn) => fn());
  timers.forEach((timer) => clearTimeout(timer));
  urls.forEach((url) => URL.revokeObjectURL(url));
  window.removeEventListener('pagehide', dispose);
  mounted.dispose();
  store.dispose();
}
window.addEventListener('pagehide', dispose, { once: true });
import.meta.hot?.dispose(dispose);
