import { themes, themeFamilies, themeProperties } from 'quilt-vanilla';
import { workspace, workspaceSession } from './model.js';
import { defaultThemeName } from './theme.js';
import { addThemeFields, installThemeExport } from './theme-export.js';
import type { LayoutTheme, WorkspaceHandle } from 'quilt-vanilla';
// Controls belong to the demo session and survive pane moves and layout resets.
let settings: HTMLElement | undefined;
let settingsHost: HTMLElement | undefined;
let applySettings: (() => void) | undefined;
export function mountTheming(element: HTMLElement) {
  settingsHost = element;
  element.classList.add('demo-theming');
  const heading = element.ownerDocument.createElement('h2');
  heading.textContent = 'Workspace theming';
  const description = element.ownerDocument.createElement('p');
  description.className = 'demo-theming-description';
  description.textContent =
    'Customize colors, spacing, and pane controls. Changes apply immediately.';
  element.append(heading, description);
  if (settings) element.append(settings);
  const win = element.ownerDocument.defaultView!;
  const frame = win.requestAnimationFrame(() => applySettings?.());
  return {
    dispose() {
      win.cancelAnimationFrame(frame);
      if (settingsHost === element) {
        settings?.remove();
        settingsHost = undefined;
      }
    },
  };
}
export function setupShell(getMounted: () => WorkspaceHandle | undefined) {
  // Page departure tears down the workspace/companions and shell subscriptions.
  // History-cache restoration does not rerun entry modules, so start a fresh
  // demo document instead of restoring those disposed resources.
  const restore = (event: PageTransitionEvent) => {
    if (event.persisted) window.location.reload();
  };
  window.addEventListener('pageshow', restore);
  window.addEventListener('pagehide', (event) => {
    if (!event.persisted) window.removeEventListener('pageshow', restore);
  });
  const overrides: LayoutTheme = {};
  let syncThemeFields = (_theme: LayoutTheme) => {};
  let headerHeight = 32,
    headerWidth = 32,
    fontSize = 11,
    iconSize = 16,
    radius = 5,
    handleWidth = 4,
    showDisabledHandles = false,
    cornerSize = 8,
    cornerInset = 0,
    cornerStroke = 2,
    cornerOpacity = 35;
  let cornerStyle = 'bracket',
    cornerVisibility = 'always',
    cornerColor = 'muted';
  settings = document.createElement('div');
  settings.className = 'demo-actions';
  settings.setAttribute('aria-label', 'Workspace controls');
  for (const [id, label] of [
    ['json-open', 'Layout JSON'],
    ['reset', 'Reset'],
  ]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.id = id!;
    button.textContent = label!;
    settings.append(button);
  }
  settingsHost?.append(settings);
  const themeSelect = document.createElement('select');
  themeSelect.setAttribute('aria-label', 'Workspace theme');
  for (const name of [
    'sage',
    'light',
    'dark',
    ...Object.keys(themeFamilies).flatMap((family) => [`${family}-dark`, `${family}-light`]),
  ]) {
    const option = document.createElement('option');
    option.value = name;
    option.textContent = name[0]!.toUpperCase() + name.slice(1);
    themeSelect.append(option);
  }
  themeSelect.value = defaultThemeName;
  const applyTheme = () => {
    const theme = themeSelect.value.includes('-')
      ? themeFamilies[themeSelect.value.split('-')[0] as keyof typeof themeFamilies][
          themeSelect.value.split('-')[1] as 'dark' | 'light'
        ]
      : themes[themeSelect.value as keyof typeof themes];
    document.documentElement.style.colorScheme = themeSelect.value.includes('dark')
      ? 'dark'
      : 'light';
    const configured: LayoutTheme = {
      ...theme,
      fontSize: `${fontSize}px`,
      iconSize: `${iconSize}px`,
      headerHeight: `${headerHeight}px`,
      headerWidth: `${headerWidth}px`,
      radius: `${radius}px`,
      cornerHandleSize: `${cornerSize}px`,
      cornerHandleInset: `${cornerInset}px`,
      cornerHandleColor: `var(--layouts-${cornerColor})`,
      cornerHandleOpacity: cornerVisibility === 'hover' ? '0' : String(cornerOpacity / 100),
      cornerHandleDisplay: cornerVisibility === 'hidden' ? 'none' : 'block',
      cornerHandleBorderWidth:
        cornerStyle === 'dot'
          ? '0'
          : cornerStyle === 'square'
            ? `${cornerStroke}px`
            : `${cornerStroke}px 0 0 ${cornerStroke}px`,
      cornerHandleRadius:
        cornerStyle === 'dot' ? '50%' : cornerStyle === 'rounded' ? '50% 0 0 0' : '0',
      cornerHandleFill: cornerStyle === 'dot' ? `var(--layouts-${cornerColor})` : 'transparent',
      resizeHandleWidth: `${handleWidth}px`,
      disabledResizeHandleWidth: showDisabledHandles ? `${handleWidth}px` : '0px',
      ...overrides,
    };
    for (const key of [
      'bg',
      'panel',
      'header',
      'text',
      'muted',
      'line',
      'accent',
      'focus',
    ] as const) {
      document.documentElement.style.setProperty(themeProperties[key], configured[key]!);
    }
    getMounted()?.setTheme(configured);
    syncThemeFields(configured);
  };
  themeSelect.onchange = () => {
    for (const key of [
      'bg',
      'panel',
      'header',
      'text',
      'muted',
      'line',
      'accent',
      'focus',
    ] as const)
      delete overrides[key];
    applyTheme();
  };
  applyTheme();
  const labelControl = (control: HTMLElement, text: string) => {
    const label = document.createElement('label');
    label.className = 'demo-field';
    const caption = document.createElement('span');
    caption.textContent = text;
    label.append(caption, control);
    return label;
  };
  const themeField = labelControl(themeSelect, 'Theme');
  settings.prepend(themeField);
  const barSelect = document.createElement('select');
  barSelect.setAttribute('aria-label', 'Taper options');
  for (const [value, label] of [
    ['full', 'Full-width'],
    ['angle', 'Angle'],
    ['round', 'Round'],
    ['scoop', 'Scoop'],
    ['vertical', 'Fitted'],
    ['rounded', 'Rounded'],
  ]) {
    const option = document.createElement('option');
    option.value = value!;
    option.textContent = label!;
    barSelect.append(option);
  }
  barSelect.value = 'angle';
  const barField = labelControl(barSelect, 'Taper options');
  const placement = document.createElement('select');
  placement.setAttribute('aria-label', 'Tab orientation');
  for (const [value, label] of [
    ['top', 'Top'],
    ['left', 'Vertical'],
  ]) {
    const option = document.createElement('option');
    option.value = value!;
    option.textContent = label!;
    placement.append(option);
  }
  const placementField = labelControl(placement, 'Tab orientation');
  const choice = (label: string, choices: [string, string][]) => {
    const select = document.createElement('select');
    select.setAttribute('aria-label', label);
    for (const [value, text] of choices) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = text;
      select.append(option);
    }
    return { select, field: labelControl(select, label) };
  };
  const display = choice('Tab display', [
    ['automatic', 'Automatic'],
    ['compact', 'Compact'],
  ]);
  const attachment = choice('Tab placement', [
    ['anchored', 'Anchored'],
    ['floating', 'Floating'],
  ]);
  const fit = choice('Fit', [
    ['full', 'Full-width'],
    ['fit', 'Fit-width'],
  ]);
  const corners = choice('Corner type', [
    ['fitted', 'Fitted'],
    ['rounded', 'Rounded'],
    ['capsule', 'Capsule'],
  ]);
  attachment.select.value = 'floating';
  fit.select.value = 'fit';
  corners.select.value = 'rounded';
  const amount = document.createElement('input');
  amount.type = 'range';
  amount.step = '1';
  const amountField = labelControl(amount, 'Angle');
  amountField.classList.add('demo-range');
  const values = { angle: '60', round: '32', scoop: '32' };
  const applyBar = () => {
    const shape = barSelect.value as 'angle' | 'round' | 'scoop' | 'vertical' | 'rounded' | 'full';
    const position = placement.value as 'top' | 'left';
    const tabDisplay = display.select.value as 'automatic' | 'compact';
    if (attachment.select.value === 'floating') {
      getMounted()?.setTabBar({
        placement: position,
        display: tabDisplay,
        attachment: 'floating',
        fit: fit.select.value as 'full' | 'fit',
        corners: corners.select.value as 'fitted' | 'rounded' | 'capsule',
      });
      return;
    }
    if (shape === 'full' || shape === 'vertical' || shape === 'rounded') {
      getMounted()?.setTabBar(
        shape === 'full'
          ? { placement: position, display: tabDisplay, mode: 'full' }
          : { placement: position, display: tabDisplay, mode: 'tapered', shape },
      );
      return;
    }
    const value = Number(amount.value);
    const name = shape === 'angle' ? 'Angle' : shape === 'round' ? 'Round width' : 'Scoop width';
    const unit = shape === 'angle' ? '°' : 'px';
    amount.setAttribute('aria-label', name);
    amount.setAttribute('aria-valuetext', `${value} ${shape === 'angle' ? 'degrees' : 'pixels'}`);
    amountField.querySelector('span')!.textContent = `${name}: ${value}${unit}`;
    values[shape] = amount.value;
    // Angle is measured from the horizontal.
    const taperWidth =
      shape === 'angle'
        ? (position === 'left' ? headerWidth : headerHeight) / Math.tan((value * Math.PI) / 180)
        : value;
    getMounted()?.setTabBar({
      placement: position,
      display: tabDisplay,
      mode: 'tapered',
      shape,
      taperWidth,
    });
  };
  const updateAmount = () => {
    const shape = barSelect.value as keyof typeof values;
    const floating = attachment.select.value === 'floating';
    barField.hidden = floating;
    barSelect.disabled = floating;
    fit.field.hidden = !floating;
    fit.select.disabled = !floating;
    corners.field.hidden = !floating;
    corners.select.disabled = !floating;
    amountField.hidden = floating || !(shape in values);
    amount.disabled = amountField.hidden;
    if (!amountField.hidden) {
      amount.min = '1';
      amount.max = shape === 'angle' ? '89' : '128';
      amount.value = values[shape];
    }
    applyBar();
  };
  attachment.select.onchange = updateAmount;
  fit.select.onchange = applyBar;
  corners.select.onchange = applyBar;
  display.select.onchange = applyBar;
  amount.oninput = applyBar;
  barSelect.onchange = updateAmount;
  placement.onchange = () => {
    updateAmount();
  };
  themeField.after(placementField, barField, amountField);
  updateAmount();
  const section = (name: string, open = true) => {
    const region = document.createElement('section');
    region.className = 'demo-settings-section';
    region.setAttribute('aria-label', name);
    const details = document.createElement('details');
    details.open = open;
    const summary = document.createElement('summary');
    summary.textContent = name;
    const chevron = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    chevron.setAttribute('viewBox', '0 0 24 24');
    chevron.setAttribute('aria-hidden', 'true');
    const path = document.createElementNS(chevron.namespaceURI, 'path');
    path.setAttribute('d', 'm6 9 6 6 6-6');
    chevron.append(path);
    summary.append(chevron);
    const content = document.createElement('div');
    content.className = 'demo-settings-fields';
    details.append(summary, content);
    region.append(details);
    return { region, content };
  };
  const themeSection = section('Theme');
  const colorSection = section('Colors', false);
  const spacingSection = section('Spacing', false);
  const scrollbarSection = section('Scrollbars', false);
  const scrollbarVisibility = document.createElement('select');
  scrollbarVisibility.setAttribute('aria-label', 'Scrollbar visibility');
  for (const [value, label] of [
    ['native', 'Native'],
    ['always', 'Always visible'],
    ['auto-hide', 'Auto-hide'],
  ]) {
    const option = document.createElement('option');
    option.value = value!;
    option.textContent = label!;
    scrollbarVisibility.append(option);
  }
  const scrollbarPlacement = document.createElement('select');
  scrollbarPlacement.setAttribute('aria-label', 'Scrollbar placement');
  for (const [value, label] of [
    ['overlay', 'Overlay'],
    ['gutter', 'Gutter'],
  ]) {
    const option = document.createElement('option');
    option.value = value!;
    option.textContent = label!;
    scrollbarPlacement.append(option);
  }
  const scrollbarReveal = document.createElement('select');
  scrollbarReveal.setAttribute('aria-label', 'Scrollbar reveal on');
  for (const [value, label] of [
    ['pointer', 'Pointer activity or scrolling'],
    ['scroll', 'Scroll intent only'],
  ]) {
    const option = document.createElement('option');
    option.value = value!;
    option.textContent = label!;
    scrollbarReveal.append(option);
  }
  const scrollbarDelay = document.createElement('input');
  scrollbarDelay.type = 'number';
  scrollbarDelay.className = 'demo-theme-value';
  scrollbarDelay.min = '0';
  scrollbarDelay.step = 'any';
  scrollbarDelay.required = true;
  scrollbarDelay.setAttribute('aria-label', 'Scrollbar idle delay (ms)');
  scrollbarDelay.title = 'Time without interaction before the 300 ms fade begins.';
  const syncScrollbars = () => {
    const value = getMounted()?.exportWorkspace().scrollbars;
    scrollbarVisibility.value = value ? (value.visibility ?? 'auto-hide') : 'native';
    scrollbarPlacement.value = value?.placement ?? 'overlay';
    scrollbarPlacement.disabled = !value;
    scrollbarReveal.value = value?.revealOn ?? 'scroll';
    scrollbarReveal.disabled = !value || value.visibility === 'always';
    scrollbarDelay.value = String(value?.hideDelay ?? 500);
    scrollbarDelay.disabled = !value || value.visibility === 'always';
  };
  const applyScrollbars = () => {
    if (!scrollbarDelay.checkValidity() || !Number.isFinite(scrollbarDelay.valueAsNumber)) {
      scrollbarDelay.reportValidity();
      return;
    }
    getMounted()?.updateOptions({
      scrollbars:
        scrollbarVisibility.value === 'native'
          ? undefined
          : {
              visibility: scrollbarVisibility.value as 'always' | 'auto-hide',
              placement: scrollbarPlacement.value as 'overlay' | 'gutter',
              hideDelay: scrollbarDelay.valueAsNumber,
              revealOn: scrollbarReveal.value as 'pointer' | 'scroll',
            },
    });
    syncScrollbars();
  };
  scrollbarVisibility.onchange = applyScrollbars;
  scrollbarPlacement.onchange = applyScrollbars;
  scrollbarDelay.onchange = applyScrollbars;
  scrollbarReveal.onchange = applyScrollbars;
  scrollbarSection.content.append(
    labelControl(scrollbarVisibility, 'Visibility'),
    labelControl(scrollbarPlacement, 'Placement'),
    labelControl(scrollbarReveal, 'Reveal on'),
    labelControl(scrollbarDelay, 'Idle delay (ms)'),
  );
  syncScrollbars();
  const unsubscribeScrollbars = getMounted()?.on('change', syncScrollbars);
  window.addEventListener('pagehide', () => unsubscribeScrollbars?.(), { once: true });
  const fontSection = section('Font');
  const tabSection = section('Tab');
  const resizeSection = section('Resizing');
  const cornerSection = section('Corner handles');
  themeSection.content.append(themeField);
  tabSection.content.append(
    placementField,
    display.field,
    attachment.field,
    barField,
    amountField,
    fit.field,
    corners.field,
  );
  const resizing = resizeSection.content;
  const resizeStyle = document.createElement('select');
  resizeStyle.setAttribute('aria-label', 'Resize style');
  for (const [value, label] of [
    ['gutter', 'Gutter between panes'],
    ['border', 'Single border with hover grip'],
  ]) {
    const option = document.createElement('option');
    option.value = value!;
    option.textContent = label!;
    resizeStyle.append(option);
  }
  resizeStyle.value = 'border';
  const gutterControls: HTMLElement[] = [];
  resizeStyle.onchange = () => {
    for (const control of gutterControls) control.hidden = resizeStyle.value !== 'gutter';
    getMounted()?.updateOptions({ resizeMode: resizeStyle.value as 'gutter' | 'border' });
  };
  resizing.append(labelControl(resizeStyle, 'Resize style'));
  settings.prepend(
    themeSection.region,
    colorSection.region,
    fontSection.region,
    tabSection.region,
    resizeSection.region,
    cornerSection.region,
    spacingSection.region,
    scrollbarSection.region,
  );
  syncThemeFields = addThemeFields({
    labelControl,
    sections: {
      colors: colorSection.content,
      font: fontSection.content,
      spacing: spacingSection.content,
      scrollbars: scrollbarSection.content,
      resizing,
    },
    onChange: (key, value) => {
      if (value) overrides[key] = value;
      else delete overrides[key];
      applyTheme();
    },
  });
  const exportTheme = document.createElement('button');
  exportTheme.type = 'button';
  exportTheme.className = 'demo-export-theme';
  exportTheme.textContent = 'Export theme';
  settings.append(exportTheme);
  const themeGuide = document.createElement('a');
  themeGuide.href = 'https://quilt-layouts.vercel.app/docs/theming';
  themeGuide.target = '_blank';
  themeGuide.rel = 'noopener noreferrer';
  themeGuide.className = 'demo-theme-guide';
  themeGuide.textContent = 'Theme guide ↗';
  settings.append(themeGuide);
  const disposeExport = installThemeExport(
    exportTheme,
    () => getMounted()?.exportWorkspace().theme,
  );
  window.addEventListener('pagehide', disposeExport, { once: true });
  applyTheme();
  for (const [name, initial, min, max, update] of [
    [
      'Resize handle width',
      handleWidth,
      2,
      16,
      (v: number) => {
        handleWidth = v;
      },
    ],
    [
      'Tab height',
      headerHeight,
      28,
      48,
      (v: number) => {
        headerHeight = v;
      },
    ],
    [
      'Tab width',
      headerWidth,
      28,
      240,
      (v: number) => {
        headerWidth = v;
      },
    ],
    [
      'Text size',
      fontSize,
      10,
      16,
      (v: number) => {
        fontSize = v;
      },
    ],
    [
      'Icon size',
      iconSize,
      12,
      24,
      (v: number) => {
        iconSize = v;
      },
    ],
    [
      'Corner radius',
      radius,
      0,
      12,
      (v: number) => {
        radius = v;
      },
    ],
  ] as const) {
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.value = String(initial);
    input.setAttribute('aria-label', name);
    const field = labelControl(input, `${name}: ${initial}px`);
    field.classList.add('demo-range');
    input.oninput = () => {
      update(Number(input.value));
      field.querySelector('span')!.textContent =
        `${input.getAttribute('aria-label')}: ${input.value}px`;
      applyTheme();
      applyBar();
    };
    if (name === 'Resize handle width') {
      gutterControls.push(field);
      field.hidden = resizeStyle.value !== 'gutter';
      resizing.append(field);
    } else if (name === 'Text size' || name === 'Icon size') fontSection.content.append(field);
    else tabSection.content.append(field);
  }
  for (const [name, entries, initial, update] of [
    [
      'Handle style',
      [
        ['bracket', 'Bracket'],
        ['rounded', 'Rounded bracket'],
        ['square', 'Square'],
        ['dot', 'Dot'],
      ],
      cornerStyle,
      (v: string) => {
        cornerStyle = v;
      },
    ],
    [
      'Visibility',
      [
        ['always', 'Always'],
        ['hover', 'On hover'],
        ['hidden', 'Hidden'],
      ],
      cornerVisibility,
      (v: string) => {
        cornerVisibility = v;
      },
    ],
    [
      'Handle color',
      [
        ['muted', 'Muted'],
        ['line', 'Border'],
        ['accent', 'Accent'],
      ],
      cornerColor,
      (v: string) => {
        cornerColor = v;
      },
    ],
  ] as const) {
    const control = choice(
      name,
      entries.map(([value, label]) => [value, label]),
    );
    control.select.value = initial;
    control.select.onchange = () => {
      update(control.select.value);
      applyTheme();
    };
    cornerSection.content.append(control.field);
  }
  for (const [name, initial, min, max, unit, update] of [
    [
      'Handle size',
      cornerSize,
      8,
      24,
      'px',
      (v: number) => {
        cornerSize = v;
      },
    ],
    [
      'Handle inset',
      cornerInset,
      0,
      12,
      'px',
      (v: number) => {
        cornerInset = v;
      },
    ],
    [
      'Stroke width',
      cornerStroke,
      1,
      4,
      'px',
      (v: number) => {
        cornerStroke = v;
      },
    ],
    [
      'Idle opacity',
      cornerOpacity,
      0,
      100,
      '%',
      (v: number) => {
        cornerOpacity = v;
      },
    ],
  ] as const) {
    const input = document.createElement('input');
    input.type = 'range';
    input.min = String(min);
    input.max = String(max);
    input.value = String(initial);
    input.setAttribute('aria-label', name);
    const field = labelControl(input, `${name}: ${initial}${unit}`);
    field.classList.add('demo-range');
    input.oninput = () => {
      update(Number(input.value));
      field.querySelector('span')!.textContent = `${name}: ${input.value}${unit}`;
      applyTheme();
    };
    cornerSection.content.append(field);
  }
  const disabledLabel = document.createElement('label');
  disabledLabel.className = 'demo-handle-toggle';
  const disabledInput = document.createElement('input');
  disabledInput.type = 'checkbox';
  disabledInput.checked = showDisabledHandles;
  disabledLabel.append(disabledInput, 'Show disabled resize handles');
  disabledInput.onchange = () => {
    showDisabledHandles = disabledInput.checked;
    applyTheme();
  };
  gutterControls.push(disabledLabel);
  disabledLabel.hidden = resizeStyle.value !== 'gutter';
  resizing.append(disabledLabel);
  applySettings = () => {
    applyTheme();
    applyBar();
  };
  const output = document.querySelector<HTMLTextAreaElement>('#layout-json')!;
  const dialog = document.querySelector<HTMLDialogElement>('#json-dialog')!;
  // Dialogs must belong to the fullscreen subtree to remain visible.
  document.querySelector('.demo-main')!.append(dialog);
  const error = document.querySelector<HTMLElement>('#json-error')!;
  settings.querySelector('#json-open')!.addEventListener('click', () => {
    output.value = JSON.stringify(getMounted()?.exportWorkspace(), null, 2);
    error.textContent = '';
    dialog.showModal();
  });
  document.querySelector('#json-cancel')!.addEventListener('click', () => dialog.close());
  document.querySelector('#json-load')!.addEventListener('click', () => {
    try {
      const input: unknown = JSON.parse(output.value);
      if (input && typeof input === 'object' && 'layout' in input)
        getMounted()?.loadWorkspace(input);
      else workspace.loadLayout(input); // Accept earlier layout-only JSON too.
      dialog.close();
    } catch (e) {
      error.textContent = e instanceof Error ? e.message : String(e);
    }
  });
  settings.querySelector('#reset')!.addEventListener('click', () => workspaceSession.reset());
}
