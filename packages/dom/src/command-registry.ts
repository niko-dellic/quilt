import type {
  CommandId,
  CustomCommandId,
  CommandRegistration,
  RegisteredCommand,
  RegisteredShortcut,
  ShortcutRegistration,
  ShortcutConflict,
  ShortcutConflictPolicy,
  WorkspaceSettings,
  LayoutOptionUpdates,
} from './types.js';
import {
  actionOrder,
  isWorkspaceAction,
  registeredShortcuts,
  formatShortcut,
} from './shortcut-registration.js';

export class ShortcutConflictError extends Error {
  readonly code = 'SHORTCUT_CONFLICT';
  constructor(readonly conflicts: readonly ShortcutConflict[]) {
    super(
      `Conflicting shortcuts: ${conflicts.map(({ binding, actions }) => `${formatShortcut(binding)} (${actions.join(', ')})`).join('; ')}`,
    );
    this.name = 'ShortcutConflictError';
  }
}
type CommandEntry = { definition: Readonly<CommandRegistration>; controller: AbortController };
type Settings = Pick<
  LayoutOptionUpdates,
  'commands' | 'shortcuts' | 'shortcutConflictPolicy' | 'onShortcutConflict'
>;

/** Per-workspace state shared by the menu, keyboard listener, and public API. */
export class CommandRegistry {
  private commands = new Map<CustomCommandId, CommandEntry>();
  private bindings = new Map<CommandId, RegisteredShortcut>();
  private policy: ShortcutConflictPolicy = 'priority';
  private warn: WorkspaceSettings['onShortcutConflict'];
  private listeners = new Set<() => void>();
  private disposed = false;
  constructor(
    settings: Settings,
    private report: (error: unknown) => void,
  ) {
    this.prepare(settings)();
  }
  private alive() {
    if (this.disposed) throw new Error('Command registry has been disposed');
  }
  private entry(command: CommandRegistration): CommandEntry {
    if (
      !command ||
      typeof command.id !== 'string' ||
      !/^[^.\s]+(?:\.[^.\s]+)+$/.test(command.id) ||
      typeof command.label !== 'string' ||
      !command.label.trim() ||
      typeof command.execute !== 'function' ||
      (command.enabled !== undefined && typeof command.enabled !== 'function')
    )
      throw new Error('A custom command needs a namespaced id, label, and execute callback');
    return { definition: Object.freeze({ ...command }), controller: new AbortController() };
  }
  private ordered(
    bindings = this.bindings,
    commands = this.commands,
  ): readonly RegisteredShortcut[] {
    return Object.freeze(
      [...actionOrder, ...commands.keys()].flatMap((id) => {
        const entry = bindings.get(id);
        return entry?.bindings.length ? [entry] : [];
      }),
    );
  }
  private conflicts(
    bindings = this.bindings,
    commands = this.commands,
  ): readonly ShortcutConflict[] {
    const keys = new Map<
      string,
      { binding: RegisteredShortcut['bindings'][number]; actions: CommandId[] }
    >();
    for (const entry of this.ordered(bindings, commands))
      for (const binding of entry.bindings) {
        const normalized = Object.freeze({ ...binding, key: binding.key.toLowerCase() });
        const key = JSON.stringify([
          normalized.key,
          !!binding.ctrl,
          !!binding.alt,
          !!binding.shift,
          !!binding.meta,
        ]);
        const item = keys.get(key) ?? { binding: normalized, actions: [] };
        if (!item.actions.includes(entry.action)) item.actions.push(entry.action);
        keys.set(key, item);
      }
    return Object.freeze(
      [...keys.values()]
        .filter((item) => item.actions.length > 1)
        .map((item) =>
          Object.freeze({ binding: item.binding, actions: Object.freeze(item.actions) }),
        ),
    );
  }
  /** Validate now; the renderer commits after validating its other options. */
  prepare(next: Settings): () => void {
    this.alive();
    let commands = this.commands;
    if ('commands' in next) {
      commands = new Map();
      for (const command of next.commands ?? []) {
        const entry = this.entry(command);
        if (commands.has(command.id)) throw new Error(`Duplicate command: ${command.id}`);
        const previous = this.commands.get(command.id);
        commands.set(
          command.id,
          previous &&
            previous.definition.execute === command.execute &&
            previous.definition.enabled === command.enabled
            ? { definition: entry.definition, controller: previous.controller }
            : entry,
        );
      }
    }
    let bindings = new Map(this.bindings);
    for (const id of bindings.keys())
      if (!isWorkspaceAction(id) && !commands.has(id)) bindings.delete(id);
    if ('shortcuts' in next)
      bindings = new Map(
        registeredShortcuts({ shortcuts: next.shortcuts }, [...commands.keys()]).map((entry) => [
          entry.action,
          entry,
        ]),
      );
    const policy =
      'shortcutConflictPolicy' in next ? (next.shortcutConflictPolicy ?? 'priority') : this.policy;
    if (!['priority', 'warn', 'error'].includes(policy))
      throw new Error('Invalid shortcut conflict policy');
    const warn = 'onShortcutConflict' in next ? next.onShortcutConflict : this.warn;
    const conflicts = this.conflicts(bindings, commands);
    if (policy === 'error' && conflicts.length) throw new ShortcutConflictError(conflicts);
    return () => this.commit(commands, bindings, policy, warn);
  }
  private commit(
    commands: Map<CustomCommandId, CommandEntry>,
    bindings: Map<CommandId, RegisteredShortcut>,
    policy = this.policy,
    warn = this.warn,
  ) {
    const before = JSON.stringify(this.getShortcutConflicts());
    const previousPolicy = this.policy;
    const liveControllers = new Set([...commands.values()].map((entry) => entry.controller));
    const removed = [...this.commands.values()].filter(
      (entry) => !liveControllers.has(entry.controller),
    );
    this.commands = commands;
    this.bindings = bindings;
    this.policy = policy;
    this.warn = warn;
    for (const entry of removed) entry.controller.abort();
    for (const listener of [...this.listeners]) {
      try {
        listener();
      } catch (error) {
        this.report(error);
      }
    }
    const conflicts = this.getShortcutConflicts();
    if (
      policy === 'warn' &&
      conflicts.length &&
      (before !== JSON.stringify(conflicts) || previousPolicy !== policy)
    ) {
      try {
        if (warn) warn(conflicts);
        else console.warn(new ShortcutConflictError(conflicts));
      } catch (error) {
        this.report(error);
      }
    }
  }
  registerShortcut(action: CommandId, registration: ShortcutRegistration): () => void {
    this.alive();
    if (!isWorkspaceAction(action) && !this.commands.has(action))
      throw new Error(`Unknown shortcut command: ${action}`);
    const normalized = registeredShortcuts({ shortcuts: { [action]: registration } }, [
      ...this.commands.keys(),
    ])[0];
    const token: RegisteredShortcut =
      normalized ?? Object.freeze({ action, bindings: Object.freeze([]), handling: 'quilt' });
    const bindings = new Map(this.bindings).set(action, token);
    const conflicts = this.conflicts(bindings);
    if (this.policy === 'error' && conflicts.length) throw new ShortcutConflictError(conflicts);
    this.commit(this.commands, bindings);
    return () => {
      if (this.disposed || this.bindings.get(action) !== token) return;
      const remaining = new Map(this.bindings);
      remaining.delete(action);
      this.commit(this.commands, remaining);
    };
  }
  registerCommand(command: CommandRegistration): () => void {
    this.alive();
    const entry = this.entry(command);
    if (this.commands.has(command.id)) throw new Error(`Duplicate command: ${command.id}`);
    this.commit(new Map(this.commands).set(command.id, entry), this.bindings);
    return () => {
      if (this.disposed || this.commands.get(command.id) !== entry) return;
      const commands = new Map(this.commands),
        bindings = new Map(this.bindings);
      commands.delete(command.id);
      bindings.delete(command.id);
      this.commit(commands, bindings);
    };
  }
  getCommand(id: CommandId) {
    return isWorkspaceAction(id) ? undefined : this.commands.get(id);
  }
  getCommands(): readonly RegisteredCommand[] {
    return Object.freeze(
      [...this.commands.values()].map(({ definition }) =>
        Object.freeze({ id: definition.id, label: definition.label }),
      ),
    );
  }
  getShortcuts() {
    return this.ordered();
  }
  getShortcutConflicts() {
    return this.conflicts();
  }
  subscribe(listener: () => void) {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    const entries = [...this.commands.values()];
    this.commands.clear();
    this.bindings.clear();
    this.listeners.clear();
    for (const entry of entries) entry.controller.abort();
  }
}
