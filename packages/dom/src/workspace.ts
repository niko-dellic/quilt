import { LayoutStore, parseLayout, createLayout } from 'quilt-core';
import type { Layout, AutoCollapse, Json } from 'quilt-core';
import { validateScrollbars } from './scrollbars.js';
import type { ScrollbarOptions } from './types.js';
import type { LayoutTheme } from './theme.js';
import { validateTheme } from './theme.js';
import type { TabBarOptions } from './types.js';
import { validateTabBar } from './tab-bar.js';
export interface WorkspacePreset {
  version: 1;
  scrollbars?: ScrollbarOptions;
  layout: Layout;
  theme: LayoutTheme;
  tabBar: TabBarOptions;
  autoCollapse: AutoCollapse;
}
/** Normalize only a copy; live companion ownership is unaffected. */
export function dockLayout(input: unknown): Layout {
  const store = new LayoutStore(parseLayout(input));
  try {
    for (const entry of [...store.getSnapshot().popouts]) store.returnPane(entry.paneId);
    return store.export();
  } finally {
    store.dispose();
  }
}
export function parseWorkspace(input: unknown): WorkspacePreset {
  createLayout({
    pane: { id: 'validation', type: 'validation', title: '', params: input as Json },
  });
  if (!input || typeof input !== 'object') throw new Error('Expected workspace object');
  const value = input as WorkspacePreset;
  if (value.version !== 1) throw new Error('Expected workspace version 1');
  if (!['disabled', 'protected', 'enabled'].includes(value.autoCollapse))
    throw new Error('Invalid autoCollapse');
  validateScrollbars(value.scrollbars);
  validateTheme(value.theme);
  if (!value.tabBar || typeof value.tabBar !== 'object' || Array.isArray(value.tabBar))
    throw new Error('Invalid tabBar');
  validateTabBar(value.tabBar);
  return {
    version: 1,
    ...(value.scrollbars === undefined ? {} : { scrollbars: structuredClone(value.scrollbars) }),
    layout: dockLayout(value.layout),
    theme: structuredClone(value.theme),
    tabBar: structuredClone(value.tabBar),
    autoCollapse: value.autoCollapse,
  };
}
