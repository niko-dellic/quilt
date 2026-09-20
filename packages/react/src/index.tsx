import {
  Component,
  createElement,
  forwardRef,
  useImperativeHandle,
  useLayoutEffect,
  useEffect,
  useState,
  useMemo,
  useRef,
  useSyncExternalStore,
} from 'react';
import type { ComponentType, CSSProperties, ReactNode, RefAttributes, ReactElement } from 'react';
import { createRoot } from 'react-dom/client';
import { createPortal, flushSync } from 'react-dom';
import { Workspace as VanillaWorkspace, PaneRegistry } from 'quilt-vanilla';
import type {
  WorkspaceOptions,
  WorkspaceHandle,
  PaneContext,
  PaneRenderer,
  InitialConfiguration,
  PaneTypes,
} from 'quilt-vanilla';
import type { Layout as LayoutSnapshot } from 'quilt-core';
export type PaneProps<State = unknown> = Omit<PaneContext<State>, 'element'>;
class Boundary extends Component<
  { children: ReactNode; onError: (error: unknown) => void; fallback?: string },
  { failed: boolean }
> {
  override state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  override componentDidCatch(error: unknown) {
    this.props.onError(error);
  }
  override render() {
    return this.state.failed
      ? createElement(
          'div',
          { role: 'alert' },
          this.props.fallback ?? 'Pane could not be rendered.',
        )
      : this.props.children;
  }
}
/** A separate root is created for each pane view, including companion documents. */
export function reactRenderer<State = unknown>(
  component: ComponentType<PaneProps<State>>,
): PaneRenderer<State> {
  return (context) => {
    const root = createRoot(context.element);
    let failure: unknown;
    const { element: _element, ...props } = context;
    try {
      flushSync(() =>
        root.render(
          createElement(Boundary, {
            onError: (error) => {
              failure = error;
            },
            children: createElement(component, props),
          }),
        ),
      );
      if (failure) throw failure;
    } catch (error) {
      root.unmount();
      throw error;
    }
    return {
      dispose() {
        root.unmount();
      },
      update(pane) {
        root.render(
          createElement(Boundary, {
            onError: (error) => {
              context.reportError(error);
            },
            children: createElement(component, { ...props, pane }),
          }),
        );
      },
    };
  };
}

interface PortalEntry {
  id: number;
  context: PaneContext;
  component: ComponentType<PaneProps>;
  ready: () => void;
  fail: (error: unknown) => void;
}
function Ready({ children, onReady }: { children: ReactNode; onReady: () => void }) {
  useLayoutEffect(onReady, [onReady]);
  return children;
}
function createBridge() {
  let sequence = 0;
  let entries: PortalEntry[] = [];
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const listener of listeners) listener();
  };
  const cache = new WeakMap<ComponentType<PaneProps>, PaneRenderer>();
  return {
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    snapshot: () => entries,
    renderer(component: ComponentType<PaneProps>): PaneRenderer {
      let renderer = cache.get(component);
      if (renderer) return renderer;
      renderer = (context) => {
        let resolve!: () => void, reject!: (error: unknown) => void;
        const ready = new Promise<void>((yes, no) => {
          resolve = yes;
          reject = no;
        });
        void ready.catch(() => {});
        const entry: PortalEntry = {
          id: ++sequence,
          context,
          component,
          ready: resolve,
          fail: reject,
        };
        entries = [...entries, entry];
        emit();
        return {
          ready,
          update(pane) {
            entry.context = { ...entry.context, pane };
            entries = [...entries];
            emit();
          },
          dispose() {
            entries = entries.filter((value) => value !== entry);
            emit();
            reject(new Error('Pane disposed before readiness'));
          },
        };
      };
      cache.set(component, renderer);
      return renderer;
    },
  };
}
export type WorkspaceProps<State = unknown> = Omit<
  WorkspaceOptions<State>,
  | 'container'
  | 'paneTypes'
  | 'renderers'
  | 'registry'
  | 'tabs'
  | 'initialLayout'
  | 'initialWorkspace'
> &
  InitialConfiguration & {
    onReady?: (handle: WorkspaceHandle<State>) => void;
    className?: string;
    style?: CSSProperties;
  } & (
    | {
        paneTypes: PaneTypes<ComponentType<PaneProps<State>>>;
        registry?: never;
        components?: never;
        tabs?: never;
      }
    | {
        paneTypes?: undefined;
        registry: PaneRegistry<ComponentType<PaneProps<State>>>;
        components?: never;
        tabs?: never;
      }
    | {
        paneTypes?: undefined;
        registry?: undefined;
        components?: Record<string, ComponentType<PaneProps<State>>>;
        tabs?: import('quilt-vanilla').TabRegistry;
      }
  );
const WorkspaceImpl = forwardRef<WorkspaceHandle, WorkspaceProps>(function Workspace(props, ref) {
  const { paneTypes, components, registry, className, style, ...rest } = props;
  if ('store' in props)
    throw new Error('Quilt owns its store; pass initialLayout or initialWorkspace');
  if (props.initialLayout !== undefined && props.initialWorkspace !== undefined)
    throw new Error('initialLayout and initialWorkspace are mutually exclusive');
  const initial = useRef({
    initialLayout: props.initialLayout,
    initialWorkspace: props.initialWorkspace,
  });
  if (paneTypes && (registry || components || props.tabs))
    throw new Error('paneTypes cannot be combined with registry, components, or tabs');
  if (registry && (components || props.tabs))
    throw new Error('registry cannot be combined with components or tabs');
  const bridge = useMemo(createBridge, []);
  const entries = useSyncExternalStore(bridge.subscribe, bridge.snapshot, bridge.snapshot);
  const host = useRef<HTMLDivElement>(null);
  const [initializationFailure, setInitializationFailure] = useState<{ error: unknown } | null>(
    null,
  );
  const mounted = useRef<WorkspaceHandle | null>(null);
  const initialized = useRef(false);
  const appliedOptions = useRef<Record<string, unknown>>({});
  const latest = useRef(props);
  latest.current = props;
  const adapt = () => {
    const current = latest.current;
    const {
      store: _store,
      initialLayout: _initialLayout,
      initialWorkspace: _initialWorkspace,
      onReady: _onReady,
      components: map,
      paneTypes: types,
      registry: source,
      className: _className,
      style: _style,
      ...options
    } = current;
    const complete = Object.fromEntries(
      [
        'tabs',
        'theme',
        'tabBar',
        'getPaneState',
        'onError',
        'prepareWindow',
        'openWindow',
        'renderIcon',
        'shortcuts',
        'messages',
        'popouts',
        'confirmClose',
        'registry',
        'renderers',
        'paneTypes',
      ].map((key) => [key, undefined]),
    );
    if (types)
      return {
        ...complete,
        ...options,
        paneTypes: Object.fromEntries(
          Object.entries(types).map(([key, { render, ...entry }]) => [
            key,
            { ...entry, render: bridge.renderer(render) },
          ]),
        ),
      };
    if (source) {
      const adapted = new PaneRegistry<PaneRenderer>(
        source.list().map((entry) => ({ ...entry, view: bridge.renderer(entry.view) })),
      );
      return { ...complete, ...options, registry: adapted };
    }
    return {
      ...complete,
      ...options,
      renderers: Object.fromEntries(
        Object.entries(map ?? {}).map(([key, component]) => [key, bridge.renderer(component)]),
      ),
    };
  };
  const applyOptions = () => {
    if (!mounted.current) return;
    const next = adapt();
    const changes = Object.fromEntries(
      Object.entries(next).filter(([key, value]) => !Object.is(appliedOptions.current[key], value)),
    );
    mounted.current.updateOptions(changes);
    appliedOptions.current = next;
  };
  const api = useMemo<WorkspaceHandle>(() => {
    const instance = () => {
      if (!mounted.current)
        throw new Error(
          initialized.current ? 'Workspace has been disposed' : 'Workspace is not ready',
        );
      return mounted.current;
    };
    const methods = [
      ...Object.getOwnPropertyNames(VanillaWorkspace.prototype).filter(
        (key) => key !== 'constructor' && key !== 'isDisposed',
      ),
      'getLayout',
    ];
    const handle = Object.fromEntries(
      methods.map((key) => [
        key,
        (...args: unknown[]) => {
          try {
            const workspace = instance();
            const method = workspace[key as keyof WorkspaceHandle];
            return Reflect.apply(method as (...args: unknown[]) => unknown, workspace, args);
          } catch (error) {
            if (key === 'popout' || key === 'closePane' || key === 'closeGroup')
              return Promise.reject(error);
            throw error;
          }
        },
      ]),
    ) as unknown as WorkspaceHandle;
    Object.defineProperty(handle, 'isDisposed', {
      get: () => mounted.current?.isDisposed ?? initialized.current,
    });
    return handle;
  }, []);
  useImperativeHandle(ref, () => api, [api]);
  useEffect(() => {
    let cancelled = false;
    let instance: WorkspaceHandle | undefined;
    queueMicrotask(() => {
      if (cancelled || !host.current) return;
      try {
        const options = adapt();
        instance = new VanillaWorkspace({
          container: host.current,
          ...options,
          ...initial.current,
        } as unknown as WorkspaceOptions);
        appliedOptions.current = options;
        mounted.current = instance;
        initialized.current = true;
      } catch (error) {
        try {
          latest.current.onError?.(error);
        } finally {
          setInitializationFailure({ error });
        }
        return;
      }
      try {
        latest.current.onReady?.(api);
      } catch (error) {
        latest.current.onError?.(error);
      }
    });
    return () => {
      cancelled = true;
      if (mounted.current === instance) mounted.current = null;
      queueMicrotask(() => instance?.dispose());
    };
  }, [bridge, api]);
  // Only changes to public options update the DOM adapter; bridge renders don't rebuild chrome.
  useLayoutEffect(() => {
    applyOptions();
  }, [
    paneTypes,
    components,
    registry,
    rest.tabs,
    rest.theme,
    rest.tabBar,
    rest.getPaneState,
    rest.onError,
    rest.prepareWindow,
    rest.openWindow,
    rest.renderIcon,
    rest.shortcuts,
    rest.messages,
    rest.popouts,
    rest.confirmClose,
  ]);
  useLayoutEffect(() => registry?.subscribe(applyOptions), [registry, bridge]);
  if (initializationFailure) throw initializationFailure.error;
  return (
    <>
      <div ref={host} className={className} style={{ width: '100%', height: '100%', ...style }} />
      {entries.map((entry) => {
        const { element, ...context } = entry.context;
        return createPortal(
          <Boundary
            fallback={
              props.messages?.['Pane could not be rendered.'] ?? 'Pane could not be rendered.'
            }
            onError={(error) => {
              entry.fail(error);
              entry.context.reportError(error);
            }}
          >
            <Ready onReady={entry.ready}>{createElement(entry.component, context)}</Ready>
          </Boundary>,
          element,
          String(entry.id),
        );
      })}
    </>
  );
});
/** State is application-owned and shared by every registered pane in this layout. */
export const Workspace = WorkspaceImpl as <State = unknown>(
  props: WorkspaceProps<State> & RefAttributes<WorkspaceHandle<State>>,
) => ReactElement | null;
export function useLayoutSnapshot(workspace: WorkspaceHandle): LayoutSnapshot {
  const subscribe = useMemo(
    () => (listener: () => void) => workspace.on('change', listener),
    [workspace],
  );
  return useSyncExternalStore(subscribe, workspace.getLayout, workspace.getLayout);
}
export { LayoutError, createLayout, parseLayout, validate } from 'quilt-core';
export type {
  AutoCollapse,
  Json,
  Capability,
  Axis,
  Pane,
  Group,
  Split,
  Node,
  WindowPlacement,
  Popout,
  Layout as LayoutSnapshot,
  Issue,
  CommandOptions,
  Change,
  Bounds,
  JoinOptions,
} from 'quilt-core';
export { TabRegistry, themes, themeFamilies } from 'quilt-vanilla';
export type {
  TabRegistration,
  LayoutTheme,
  WorkspaceOptions,
  WorkspaceHandle,
  PaneContext,
  PaneView,
  PaneRenderer,
  InitialConfiguration,
  WorkspaceSettings,
  PaneTypes,
} from 'quilt-vanilla';

export {
  PaneRegistry,
  parseWorkspace,
  dockLayout,
  themeProperties,
  defaultMessages,
} from 'quilt-vanilla';
export type {
  PaneRegistration,
  WorkspacePreset,
  Messages,
  CloseRequest,
  KeyBinding,
  TabBarOptions,
  TabBarStyle,
} from 'quilt-vanilla';

export type {
  PaneHandle,
  PaneType,
  WorkspaceOptionUpdates,
  WorkspaceEvents,
  WorkspaceChange,
  AddPaneOptions,
  CloseOptions,
} from 'quilt-vanilla';
