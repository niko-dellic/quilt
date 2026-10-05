import { message } from './messages.js';
import { themeProperties } from './theme.js';
import type { Pane, WindowPlacement } from 'quilt-core';
import type { ResolvedLayoutOptions } from './types.js';
import { el, Scope } from './lifetime.js';
import { mountPane } from './panes.js';
import type { MountedPane } from './panes.js';
interface Companion {
  window: Window;
  mounted: MountedPane;
  replacement?: MountedPane;
  scope: Scope;
  suppressReturn: boolean;
  syncTheme: () => void;
}
/** The opener owns all state; child documents never load an independent app bundle. */
export class Windows {
  private companions = new Map<string, Companion>();
  private scope = new Scope();
  private stopped = false;
  private opening = new Map<string, { cancel: () => void; scope: Scope; window: Window }>();
  constructor(
    private doc: Document,
    private options: ResolvedLayoutOptions,
    private error: (e: unknown) => void,
    private themeRoot: HTMLElement,
  ) {
    const interval = setInterval(() => this.check(), 300);
    this.scope.add(() => clearInterval(interval));
    this.scope.listen(doc.defaultView!, 'pagehide', () => this.dispose());
    // Loading data never opens a browser window. Restore missing windows into the main layout.
    this.restoreMissing();
    this.scope.add(options.store.subscribe(() => this.reconcile()));
  }
  private restoreMissing() {
    for (const entry of [...this.options.store.getSnapshot().popouts]) {
      if (!this.companions.has(entry.paneId)) {
        this.options.store.returnPane(entry.paneId);
      }
    }
  }
  private available() {
    return !this.stopped && this.options.popouts !== false;
  }
  refresh() {
    for (const [id, operation] of this.opening)
      if (!this.available() || !this.options.store.can(id, 'popout')) operation.cancel();
    for (const c of this.companions.values()) {
      c.mounted.updateScrollbars(this.options.scrollbars);
      c.replacement?.updateScrollbars(this.options.scrollbars);
      const button = c.window.document.querySelector('.layouts-companion-bar button');
      if (button) button.textContent = message(this.options, 'Return to layout');
    }
    this.reconcile();
  }
  refreshTheme() {
    for (const companion of this.companions.values()) companion.syncTheme();
  }
  retryPane(id: string) {
    const companion = this.companions.get(id);
    if (companion) {
      companion.mounted.signature = '';
      this.reconcile();
    }
  }
  private reconcile() {
    if (this.stopped) return;
    for (const [id, c] of this.companions)
      if (!this.options.store.getSnapshot().popouts.some((p) => p.paneId === id))
        this.closeCompanion(id, c);
    for (const [id, c] of this.companions) {
      const pane = this.options.store.getSnapshot().panes[id];
      if (
        !pane ||
        c.replacement ||
        (JSON.stringify(pane) === c.mounted.signature &&
          c.mounted.renderer === this.options.renderers?.[pane.type])
      )
        continue;
      try {
        if (
          c.mounted.signature === '' ||
          c.mounted.renderer !== this.options.renderers?.[pane.type] ||
          pane.type !== c.mounted.pane.type ||
          JSON.stringify(pane.params) !== JSON.stringify(c.mounted.pane.params)
        ) {
          const replacement = mountPane(c.window.document, pane, 'popout', {
            ...this.options,
            onError: this.error,
          });
          c.replacement = replacement;
          replacement.host.style.visibility = 'hidden';
          c.mounted.host.parentElement?.append(replacement.host);
          const finish = () => {
            if (this.companions.get(id) !== c || c.replacement !== replacement) return;
            delete c.replacement;
            if (
              JSON.stringify(this.options.store.getSnapshot().panes[id]) !==
                replacement.signature ||
              this.options.renderers?.[pane.type] !== replacement.renderer
            ) {
              replacement.dispose();
              this.reconcile();
              return;
            }
            replacement.host.style.removeProperty('visibility');
            c.mounted.host.replaceWith(replacement.host);
            c.mounted.dispose();
            c.mounted = replacement;
          };
          if (replacement.view.ready)
            void replacement.view.ready.then(finish, (error) => {
              if (c.replacement !== replacement) return;
              delete c.replacement;
              replacement.dispose();
              c.mounted.failed = true;
              this.error(error);
            });
          else finish();
        } else {
          c.mounted.view.update?.(pane);
          c.mounted.pane = pane;
          c.mounted.signature = JSON.stringify(pane);
        }
        c.window.document.title = pane.title + ' — layouts';
        const title = c.window.document.querySelector('.layouts-companion-bar strong');
        if (title) title.textContent = pane.title;
      } catch (error) {
        this.error(error);
      }
    }
    this.restoreMissing();
  }
  private styles(target: Window, pane: Pane, scope: Scope) {
    const source = this.doc,
      dest = target.document;
    dest.title = pane.title + ' — layouts';
    const base = dest.createElement('base');
    base.href = source.baseURI;
    dest.head.append(base);
    const holder = dest.createElement('meta');
    holder.dataset.layoutsStyles = '';
    dest.head.append(holder);
    let copied: Element[] = [];
    const copy = () => {
      copied.forEach((n) => n.remove());
      copied = Array.from(source.head.querySelectorAll('link[rel="stylesheet"], style')).map(
        (n) => n.cloneNode(true) as Element,
      );
      copied.forEach((n) => dest.head.append(n));
      dest.documentElement.className = source.documentElement.className;
      dest.body.className = source.body.className;
      for (const original of [source.documentElement, source.body]) {
        const next = original === source.body ? dest.body : dest.documentElement;
        for (const attribute of Array.from(next.attributes))
          if (attribute.name === 'style' || attribute.name.startsWith('data-'))
            next.removeAttribute(attribute.name);
        for (const attribute of Array.from(original.attributes))
          if (attribute.name === 'style' || attribute.name.startsWith('data-'))
            next.setAttribute(attribute.name, attribute.value);
      }
    };
    copy();
    const observer = new MutationObserver(copy);
    observer.observe(source.head, { childList: true, subtree: true, characterData: true });
    observer.observe(source.body, { attributes: true });
    observer.observe(source.documentElement, { attributes: true });
    scope.add(() => observer.disconnect());
  }
  async open(id: string, placement: WindowPlacement = {}): Promise<boolean> {
    if (!this.available() || this.opening.has(id)) return false;
    const existing = this.companions.get(id);
    if (existing) {
      existing.window.focus();
      return true;
    }
    const pane = this.options.store.getSnapshot().panes[id];
    if (!pane || !this.options.store.can(id, 'popout')) return false;
    let child: Window | null = null,
      mounted: MountedPane | undefined;
    const scope = new Scope();
    try {
      const requested = { width: 640, height: 480, ...placement };
      const features = [
        'popup=yes',
        ...Object.entries(requested).map(([key, value]) => `${key}=${Math.round(value)}`),
      ].join(',');
      child = this.options.openWindow
        ? this.options.openWindow(pane, requested)
        : this.doc.defaultView!.open('about:blank', '', features);
      if (!child)
        throw new Error(
          message(
            this.options,
            'The browser blocked the popout. Allow popups or try again from the pane menu.',
          ),
        );
      const dest = child.document;
      dest.body.replaceChildren();
      this.styles(child, pane, scope);
      const shell = el(dest, 'div', 'layouts layouts-companion');
      const bar = el(dest, 'header', 'layouts-companion-bar');
      const button = el(
        dest,
        'button',
        'layouts-button',
        message(this.options, 'Return to layout'),
      );
      button.type = 'button';
      bar.append(el(dest, 'strong', '', pane.title), button);
      shell.append(bar);
      dest.body.append(shell);
      const syncTheme = () => {
        const computed = this.doc.defaultView!.getComputedStyle(this.themeRoot);
        for (const property of Object.values(themeProperties)) {
          const value = computed.getPropertyValue(property);
          if (value.trim()) shell.style.setProperty(property, value);
          else shell.style.removeProperty(property);
        }
      };
      syncTheme();
      const themeObserver = new MutationObserver(syncTheme);
      for (let node: HTMLElement | null = this.themeRoot; node; node = node.parentElement)
        themeObserver.observe(node, { attributes: true });
      themeObserver.observe(this.doc.head, { childList: true, subtree: true, characterData: true });
      scope.add(() => themeObserver.disconnect());
      this.options.prepareWindow?.(child, pane);
      mounted = mountPane(dest, pane, 'popout', { ...this.options, onError: this.error });
      shell.append(mounted.host);
      let cancel!: () => void;
      const cancelled = new Promise<never>((_, reject) => {
        cancel = () => reject(new Error('Popout opening cancelled'));
      });
      // Attach a rejection observer even when a synchronous renderer has no readiness promise.
      void cancelled.catch(() => {});
      this.opening.set(id, { cancel, scope, window: child });
      scope.listen(child, 'pagehide', cancel);
      const original = JSON.stringify(pane);
      scope.add(
        this.options.store.subscribe((event) => {
          if (
            event.action === 'load' ||
            JSON.stringify(this.options.store.getSnapshot().panes[id]) !== original
          )
            cancel();
        }),
      );
      scope.listen(button, 'click', () => this.returnPane(id));
      if (mounted.view.ready) await Promise.race([mounted.view.ready, cancelled]);
      if (!this.available() || child.closed) throw new Error('Popout opening cancelled');
      mounted.updateScrollbars(this.options.scrollbars);
      this.opening.delete(id);
      const c: Companion = { window: child, mounted, scope, suppressReturn: false, syncTheme };
      this.companions.set(id, c);
      // Leave detection supplements closed-window polling; neither is a persistence guarantee.
      scope.listen(child, 'pagehide', () => {
        if (!c.suppressReturn && !this.stopped) queueMicrotask(() => this.returnPane(id));
      });
      child.focus();
      this.options.store.popout(id, requested, { source: 'user' });
      return true;
    } catch (error) {
      this.opening.delete(id);
      this.companions.delete(id);
      scope.dispose();
      try {
        mounted?.dispose();
      } catch {
        /* Finish rollback. */
      }
      try {
        child?.close();
      } catch {
        /* Browser may already have closed it. */
      }
      this.error(error);
      return false;
    }
  }
  returnPane(id: string) {
    if (this.stopped) return;
    const pending = this.opening.get(id);
    if (pending) {
      pending.cancel();
      return;
    }
    try {
      this.options.store.returnPane(id);
    } catch (error) {
      this.error(error);
    }
  }
  private closeCompanion(id: string, c: Companion) {
    c.suppressReturn = true;
    this.companions.delete(id);
    c.scope.dispose();
    c.replacement?.dispose();
    delete c.replacement;
    try {
      c.mounted.dispose();
    } catch (error) {
      this.error(error);
    }
    try {
      c.window.close();
    } catch {
      /* A user may have navigated the companion away. */
    }
  }
  private check() {
    if (this.stopped) return;
    for (const operation of this.opening.values()) {
      try {
        if (operation.window.closed || !operation.window.document.defaultView) operation.cancel();
      } catch {
        operation.cancel();
      }
    }
    for (const [id, c] of this.companions) {
      try {
        if (c.window.closed || c.window.document.defaultView === null) this.returnPane(id);
      } catch {
        this.returnPane(id);
      }
    }
  }
  dispose() {
    if (this.stopped) return;
    this.stopped = true;
    for (const operation of this.opening.values()) {
      operation.cancel();
      operation.scope.dispose();
    }
    this.opening.clear();
    this.scope.dispose();
    for (const [id, c] of this.companions) {
      try {
        c.window.document.body.replaceChildren(
          el(
            c.window.document,
            'p',
            'layouts-placeholder',
            message(this.options, 'Disconnected: the main layout session has ended.'),
          ),
        );
      } catch {
        /* Inaccessible or already closed. */
      }
      this.closeCompanion(id, c);
    }
  }
}
