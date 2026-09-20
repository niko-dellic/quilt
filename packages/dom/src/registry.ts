import type { Pane } from 'quilt-core';
export interface TabRegistration {
  id: string;
  title: string;
  description?: string;
  icon?: string;
  keywords?: readonly string[];
  /** Source is undefined when creating content in a completely empty workspace.
   * Return a fresh pane with a unique id; undefined cancels creation. */
  create: (context: { source: Pane | undefined; groupId: string }) => Pane | undefined;
}
/** Available content types, independent of open pane instances and layout JSON. */
export class TabRegistry {
  private entries = new Map<string, TabRegistration>();
  private listeners = new Set<() => void>();
  constructor(entries: readonly TabRegistration[] = []) {
    for (const entry of entries) this.register(entry);
  }
  list(): readonly TabRegistration[] {
    return [...this.entries.values()];
  }
  register(entry: TabRegistration): () => void {
    if (!entry.id || this.entries.has(entry.id))
      throw new Error(`Duplicate or empty tab registration: ${entry.id}`);
    const stored = Object.freeze({
      ...entry,
      ...(entry.keywords ? { keywords: Object.freeze([...entry.keywords]) } : {}),
    });
    this.entries.set(entry.id, stored);
    this.emit();
    return () => {
      if (this.entries.get(entry.id) !== stored) return;
      this.entries.delete(entry.id);
      this.emit();
    };
  }
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private emit() {
    for (const listener of this.listeners) listener();
  }
}

let instanceSequence = 0;
export function createPaneId(): string {
  return (
    globalThis.crypto?.randomUUID?.() ?? `quilt-${Date.now().toString(36)}-${++instanceSequence}`
  );
}

export interface PaneRegistration<T> {
  type: string;
  title: string;
  view: T;
  description?: string;
  icon?: string;
  keywords?: readonly string[];
  confirmClose?: boolean;
  create?: (context: Parameters<TabRegistration['create']>[0]) => Partial<Pane> | undefined;
}
/** Framework-neutral registrations; the adapter supplies the view type. */
export class PaneRegistry<T> {
  private entries = new Map<string, Readonly<PaneRegistration<T>>>();
  private listeners = new Set<() => void>();
  readonly tabs = new TabRegistry();
  constructor(entries: readonly PaneRegistration<T>[] = []) {
    entries.forEach((entry) => this.register(entry));
  }
  list(): readonly Readonly<PaneRegistration<T>>[] {
    return [...this.entries.values()];
  }
  register(entry: PaneRegistration<T>): () => void {
    if (!entry.type || this.entries.has(entry.type))
      throw new Error(`Duplicate or empty pane type: ${entry.type}`);
    const stored = Object.freeze({
      ...entry,
      ...(entry.keywords ? { keywords: Object.freeze([...entry.keywords]) } : {}),
    });
    this.entries.set(entry.type, stored);
    const removeTab = this.tabs.register({
      id: entry.type,
      title: entry.title,
      ...(entry.description !== undefined ? { description: entry.description } : {}),
      ...(entry.icon !== undefined ? { icon: entry.icon } : {}),
      ...(entry.keywords !== undefined ? { keywords: entry.keywords } : {}),
      create: (context) => {
        const supplied = stored.create ? stored.create(context) : {};
        if (supplied === undefined) return undefined;
        return {
          type: stored.type,
          title: stored.title,
          ...(stored.icon !== undefined ? { icon: stored.icon } : {}),
          ...supplied,
          id: supplied.id ?? createPaneId(),
        };
      },
    });
    this.emit();
    return () => {
      if (this.entries.get(entry.type) !== stored) return;
      this.entries.delete(entry.type);
      removeTab();
      this.emit();
    };
  }
  subscribe(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  private emit() {
    for (const listener of [...this.listeners]) listener();
  }
}
