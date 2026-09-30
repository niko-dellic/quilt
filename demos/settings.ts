import { defaultShortcuts } from 'quilt-vanilla';
import type { Capability, CapabilityPolicy, PaneRenderer, WorkspaceHandle } from 'quilt-vanilla';
import { groups } from 'quilt-core';
import { onWorkspace } from './model.js';

// Application-owned session choices survive view moves, closes, and popouts.
let policy: CapabilityPolicy = {};
let shortcuts = true;
let middleClick = true;
let popouts = true;
const controls: readonly [Capability, string][] = [
  ['resize', 'Resize panes'],
  ['close', 'Close tabs and panes'],
  ['addTab', 'Add tabs'],
  ['reorder', 'Reorder tabs'],
  ['move', 'Move tabs between panes'],
  ['maximize', 'Maximize panes'],
  ['split', 'Split panes'],
  ['join', 'Join panes'],
  ['popout', 'Pop out tabs'],
];
export const settings: PaneRenderer = ({ element, document: doc }) => {
  element.classList.add('demo-settings');
  const text = (tag: string, value: string) => {
    const node = doc.createElement(tag);
    node.textContent = value;
    return node;
  };
  element.append(
    text('h2', 'Workspace settings'),
    text('p', 'Change a setting, then try it in the workspace. Changes apply immediately.'),
  );
  const section = (title: string) => {
    const fieldset = doc.createElement('fieldset');
    fieldset.append(text('legend', title));
    element.append(fieldset);
    return fieldset;
  };
  const field = (parent: HTMLElement, label: string, input: HTMLElement) => {
    const row = doc.createElement('label');
    row.className = 'demo-setting';
    input.setAttribute('aria-label', label);
    row.append(text('span', label), input);
    parent.append(row);
  };
  const select = (
    parent: HTMLElement,
    label: string,
    values: readonly (readonly [string, string])[],
  ) => {
    const input = doc.createElement('select');
    for (const [value, title] of values) {
      const option = doc.createElement('option');
      option.value = value;
      option.textContent = title;
      input.append(option);
    }
    field(parent, label, input);
    return input;
  };
  const check = (parent: HTMLElement, label: string) => {
    const input = doc.createElement('input');
    input.type = 'checkbox';
    field(parent, label, input);
    return input;
  };
  let workspace: WorkspaceHandle | undefined;
  const behavior = section('Workspace behavior');
  const collapse = select(behavior, 'Auto collapse empty panes', [
    ['disabled', 'Keep empty panes'],
    ['protected', 'Collapse except after popout'],
    ['enabled', 'Always collapse'],
  ]);
  const windows = check(behavior, 'Allow popout windows');
  const keys = check(behavior, 'Enable demo shortcuts');
  const middle = check(behavior, 'Middle-click closes tabs');
  behavior.append(
    text(
      'small',
      'Popout windows is a master switch. Disabling it leaves existing windows open so they can return.',
    ),
  );
  const permissions = section('Interaction rules');
  const scope = select(permissions, 'Settings scope', [
    ['workspace', 'Whole workspace'],
    ['group', 'One pane region'],
    ['pane', 'One tab'],
  ]);
  const target = select(permissions, 'Apply to', []);
  permissions.append(
    text(
      'small',
      'Overrides take priority over defaults. Inherit uses the existing rule. Saved tab restrictions still apply unless you override that tab.',
    ),
  );
  const flags = new Map(
    controls.map(([key, label]) => [
      key,
      select(permissions, label, [
        ['', 'Inherit'],
        ['true', 'Allow'],
        ['false', 'Block'],
      ]),
    ]),
  );
  const detail = section('Selected pane or tab');
  const orientation = select(detail, 'Tab orientation override', [
    ['', 'Workspace default'],
    ['top', 'Horizontal'],
    ['left', 'Vertical'],
  ]);
  const display = select(detail, 'Tab display override', [
    ['', 'Workspace default'],
    ['automatic', 'Automatic'],
    ['compact', 'Compact'],
  ]);
  const confirmation = check(detail, 'Confirm before closing this tab');
  const sizes = new Map(
    (
      [
        ['minWidth', 'Minimum width (px)'],
        ['maxWidth', 'Maximum width (px)'],
        ['minHeight', 'Minimum height (px)'],
        ['maxHeight', 'Maximum height (px)'],
      ] as const
    ).map(([key, label]) => {
      const input = doc.createElement('input');
      input.type = 'number';
      input.min = '0';
      input.step = '1';
      input.placeholder = 'No limit';
      field(detail, label, input);
      return [key, input] as const;
    }),
  );
  const sizeError = text('small', '');
  sizeError.setAttribute('role', 'status');
  detail.append(sizeError);
  const help = text(
    'small',
    'Select a pane region or tab above to change its tab bar. Close confirmation applies to a selected tab.',
  );
  detail.append(help);
  const reset = doc.createElement('button');
  reset.type = 'button';
  reset.textContent = 'Reset interaction rules';
  element.append(reset);
  element.append(
    text(
      'small',
      'Colors, spacing, and tab shapes are available in Theming. Use Reset in Theming to restore the layout if you close this tab.',
    ),
  );
  let signature = '';
  const selectedGroup = () => {
    const layout = workspace?.getLayout();
    return (
      layout &&
      groups(layout.root).find((group) =>
        scope.value === 'group'
          ? group.id === target.value
          : scope.value === 'pane' && group.panes.includes(target.value),
      )
    );
  };
  const update = () => {
    if (!workspace) return;
    const layout = workspace.getLayout();
    const all = groups(layout.root);
    const choices =
      scope.value === 'group'
        ? all
            .filter(
              (group) =>
                !group.panes.length || group.panes.some((id) => layout.panes[id]?.header !== false),
            )
            .map((group) => [
              group.id,
              group.panes.map((id) => layout.panes[id]!.title).join(' / ') || 'Empty pane',
            ])
        : scope.value === 'pane'
          ? Object.values(layout.panes)
              .filter((pane) => pane.header !== false)
              .map((pane) => [pane.id, pane.title])
          : [];
    const next = JSON.stringify([scope.value, choices]);
    if (signature !== next) {
      signature = next;
      const previous = target.value;
      target.replaceChildren();
      for (const [id, label] of choices) {
        const option = doc.createElement('option');
        option.value = id!;
        option.textContent = label!;
        target.append(option);
      }
      if (choices.some(([id]) => id === previous)) target.value = previous;
    }
    target.parentElement!.hidden = scope.value === 'workspace';
    const values =
      scope.value === 'workspace'
        ? policy.defaults
        : scope.value === 'group'
          ? policy.groups?.[target.value]
          : policy.panes?.[target.value];
    for (const [key, input] of flags) {
      input.value = values?.[key] === undefined ? '' : String(values[key]);
      input.disabled = scope.value !== 'workspace' && !target.value;
    }
    collapse.value = workspace.getAutoCollapse();
    windows.checked = popouts;
    keys.checked = shortcuts;
    middle.checked = middleClick;
    const group = selectedGroup();
    orientation.disabled = display.disabled = !group;
    orientation.value = group?.tabPlacement ?? '';
    display.value = group?.tabDisplay ?? '';
    confirmation.disabled = scope.value !== 'pane' || !layout.panes[target.value];
    confirmation.checked = !confirmation.disabled && !!layout.panes[target.value]?.confirmClose;
    for (const [key, input] of sizes) {
      input.disabled = confirmation.disabled;
      input.value = confirmation.disabled
        ? ''
        : String(layout.panes[target.value]?.size?.[key] ?? '');
    }
    sizeError.textContent = '';
  };
  scope.onchange = target.onchange = update;
  for (const [key, input] of flags)
    input.onchange = () => {
      const next = structuredClone(policy);
      const values =
        scope.value === 'workspace'
          ? (next.defaults ??= {})
          : scope.value === 'group'
            ? ((next.groups ??= {})[target.value] ??= {})
            : ((next.panes ??= {})[target.value] ??= {});
      if (input.value === '') delete values[key];
      else values[key] = input.value === 'true';
      policy = next;
      workspace?.updateOptions({ capabilities: policy });
    };
  collapse.onchange = () =>
    workspace?.setAutoCollapse(collapse.value as 'disabled' | 'protected' | 'enabled');
  windows.onchange = () => {
    popouts = windows.checked;
    workspace?.updateOptions({ popouts });
  };
  const applyKeys = () => {
    shortcuts = keys.checked;
    middleClick = middle.checked;
    workspace?.updateOptions({
      shortcuts: { ...(shortcuts ? defaultShortcuts : {}), middleClickClose: middleClick },
    });
  };
  keys.onchange = middle.onchange = applyKeys;
  orientation.onchange = () => {
    const group = selectedGroup();
    if (group)
      workspace?.setTabPlacement(
        group.id,
        orientation.value ? (orientation.value as 'top' | 'left') : undefined,
      );
  };
  display.onchange = () => {
    const group = selectedGroup();
    if (group)
      workspace?.setTabDisplay(
        group.id,
        display.value ? (display.value as 'automatic' | 'compact') : undefined,
      );
  };
  confirmation.onchange = () => {
    const pane = workspace?.getLayout().panes[target.value];
    if (pane) workspace?.updatePane({ ...pane, confirmClose: confirmation.checked });
  };
  for (const [key, input] of sizes)
    input.onchange = () => {
      const pane = workspace?.getLayout().panes[target.value];
      if (!pane) return;
      const size = { ...pane.size };
      if (input.value === '') delete size[key];
      else if (!input.validity.valid || !Number.isFinite(input.valueAsNumber)) {
        sizeError.textContent = 'Enter a nonnegative whole number, or leave the limit blank.';
        return;
      } else size[key] = input.valueAsNumber;
      if (
        (size.minWidth ?? 0) > (size.maxWidth ?? Infinity) ||
        (size.minHeight ?? 0) > (size.maxHeight ?? Infinity)
      ) {
        sizeError.textContent = 'Minimum size cannot exceed maximum size.';
        return;
      }
      workspace?.updatePane({ ...pane, size });
    };
  reset.onclick = () => {
    policy = {};
    shortcuts = middleClick = popouts = true;
    workspace?.updateOptions({
      capabilities: undefined,
      popouts: true,
      shortcuts: defaultShortcuts,
    });
    workspace?.setAutoCollapse('disabled');
    update();
  };
  let unsubscribe = () => {};
  const unbind = onWorkspace((value) => {
    unsubscribe();
    workspace = value;
    unsubscribe = value.on('change', update);
    update();
  });
  return {
    dispose() {
      unbind();
      unsubscribe();
      for (const input of element.querySelectorAll('input, select'))
        (input as HTMLInputElement).onchange = null;
      reset.onclick = null;
    },
  };
};
