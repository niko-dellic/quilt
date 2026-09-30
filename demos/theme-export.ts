import type { LayoutTheme } from 'quilt-vanilla';
import { themeProperties } from 'quilt-vanilla';
type Token = keyof LayoutTheme;
export function addThemeFields({
  labelControl,
  sections,
  onChange,
}: {
  labelControl: (control: HTMLElement, text: string) => HTMLElement;
  sections: Record<'colors' | 'font' | 'spacing' | 'scrollbars' | 'resizing', HTMLElement>;
  onChange: (key: Token, value: string) => void;
}) {
  const fields: [Token, string, keyof typeof sections, string, string][] = [
    ['bg', 'Background', 'colors', 'color', '#161a20'],
    ['panel', 'Panel', 'colors', 'color', '#1d222a'],
    ['header', 'Header', 'colors', 'color', '#242a34'],
    ['text', 'Text', 'colors', 'color', '#e5e9f0'],
    ['muted', 'Muted text', 'colors', 'color', '#a2acba'],
    ['line', 'Border', 'colors', 'color', '#39414e'],
    ['accent', 'Accent', 'colors', 'color', '#8bbaaa'],
    ['focus', 'Focus ring', 'colors', 'color', '#b3decf'],
    ['fontFamily', 'Font family', 'font', 'font-family', 'system-ui, sans-serif'],
    ['panelPadding', 'Panel padding', 'spacing', 'width', '8px'],
    ['controlHeight', 'Control height', 'spacing', 'width', '28px'],
    ['spacing', 'Control spacing', 'spacing', 'width', '5px'],
    ['scrollbarThumb', 'Thumb color', 'scrollbars', 'color', 'var(--layouts-line)'],
    ['scrollbarTrack', 'Track color', 'scrollbars', 'color', 'transparent'],
    ['scrollbarSize', 'Scrollbar size', 'scrollbars', 'width', '6px'],
  ];
  const inputs = new Map<Token, HTMLInputElement>();
  for (const [key, label, section, property, fallback] of fields) {
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'demo-theme-value';
    input.setAttribute('aria-label', label);
    input.setAttribute('aria-invalid', 'false');
    input.placeholder = fallback;
    input.title = themeProperties[key];
    input.spellcheck = false;
    input.onchange = () => {
      const value = input.value.trim();
      const valid = !value || CSS.supports(property, value);
      input.setCustomValidity(valid ? '' : `Enter a valid CSS ${property} value.`);
      input.setAttribute('aria-invalid', String(!valid));
      if (valid) onChange(key, value);
      else input.reportValidity();
    };
    const field = labelControl(input, label);
    if (key === 'fontFamily') field.classList.add('demo-field-wide');
    sections[section].append(field);
    inputs.set(key, input);
  }
  const frozenMode = document.createElement('select');
  frozenMode.setAttribute('aria-label', 'Frozen border');
  for (const [value, title] of [
    ['inherit', 'Use theme border'],
    ['custom', 'Custom color'],
    ['hidden', 'Hidden'],
  ]) {
    const option = document.createElement('option');
    option.value = value!;
    option.textContent = title!;
    frozenMode.append(option);
  }
  const frozenColor = document.createElement('input');
  frozenColor.type = 'color';
  frozenColor.setAttribute('aria-label', 'Frozen border color');
  const frozenColorField = labelControl(frozenColor, 'Frozen border color');
  frozenColorField.classList.add('demo-color-picker-field');
  sections.colors.append(labelControl(frozenMode, 'Frozen border'), frozenColorField);
  let customFrozenColor = '#39414e';
  frozenMode.onchange = () => {
    onChange(
      'frozenPaneBorder',
      frozenMode.value === 'inherit'
        ? ''
        : frozenMode.value === 'hidden'
          ? 'transparent'
          : customFrozenColor,
    );
  };
  frozenColor.oninput = () => {
    customFrozenColor = frozenColor.value;
    onChange('frozenPaneBorder', customFrozenColor);
  };
  return (theme: LayoutTheme) => {
    const value = theme.frozenPaneBorder;
    frozenMode.value =
      !value || value === 'var(--layouts-line)'
        ? 'inherit'
        : value === 'transparent'
          ? 'hidden'
          : 'custom';
    frozenColorField.hidden = frozenMode.value !== 'custom';
    if (frozenMode.value !== 'hidden') {
      // Resolve theme references and CSS colors before supplying native RGB input.
      const probe = document.createElement('span');
      probe.style.color = value ?? theme.line ?? '#39414e';
      sections.colors.append(probe);
      const color = getComputedStyle(probe).color;
      probe.remove();
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = 1;
      const context = canvas.getContext('2d')!;
      context.fillStyle = color;
      context.fillRect(0, 0, 1, 1);
      const rgb = context.getImageData(0, 0, 1, 1).data;
      const resolved =
        '#' +
        Array.from(rgb.slice(0, 3), (channel) => channel.toString(16).padStart(2, '0')).join('');
      frozenColor.value = resolved;
      customFrozenColor = resolved;
    }

    for (const [key, input] of inputs) {
      input.value = theme[key] ?? '';
      input.setCustomValidity('');
      input.setAttribute('aria-invalid', 'false');
    }
  };
}
export function installThemeExport(
  button: HTMLButtonElement,
  getTheme: () => LayoutTheme | undefined,
) {
  const urls = new Map<string, { timer: number; win: Window }>();
  const onClick = () => {
    const theme = getTheme();
    if (!theme) return;
    const doc = button.ownerDocument;
    const win = doc.defaultView!;
    const url = URL.createObjectURL(
      new Blob([JSON.stringify(theme, null, 2) + '\n'], { type: 'application/json' }),
    );
    const anchor = doc.createElement('a');
    anchor.href = url;
    anchor.download = 'quilt-theme.json';
    doc.body.append(anchor);
    anchor.click();
    anchor.remove();
    const timer = win.setTimeout(() => {
      URL.revokeObjectURL(url);
      urls.delete(url);
    }, 1000);
    urls.set(url, { timer, win });
  };
  button.addEventListener('click', onClick);
  return () => {
    button.removeEventListener('click', onClick);
    for (const [url, { timer, win }] of urls) {
      win.clearTimeout(timer);
      URL.revokeObjectURL(url);
    }
    urls.clear();
  };
}
