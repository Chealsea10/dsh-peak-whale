/**
 * The settings-namespace scope contract this plugin consumes, declared locally
 * because `@deepseek-ai/dsh-client-ui-settings` is not a dependency of this
 * package. Shapes are taken from that runtime's own declarations
 * (`lib/types/client/settings-contract.d.ts`, dsh 0.1.5-rc.1).
 *
 * A scope is NOT a snapshot: reads go through `getSnapshot()` and changes arrive
 * through `subscribe()` — there are no `value`/`user` properties to read.
 */
/** Client-side sync state of one settings namespace. */
export interface SettingsScopeSnapshot<T> {
    /**
     * `loading` until the first accepted section, `ready` while one stands, and
     * `unavailable` when the namespace is not exposed to this client or the
     * connection keeps preferences process-local (memory mode).
     */
    status: 'loading' | 'ready' | 'unavailable';
    /** Last accepted schema-resolved section; undefined before the first acceptance. */
    value: T | undefined;
    /**
     * Raw user layer as stored. A field's PRESENCE here is what marks it
     * overridden — an override equal to the composition default is still one.
     */
    user: unknown;
    /** Whether the Host document accepts writes; memory mode never does. */
    writable: boolean;
}
/** Reactive owner handle over one namespace's durable section. */
export interface SettingsScope<T> {
    getSnapshot(): SettingsScopeSnapshot<T>;
    subscribe(listener: () => void): () => void;
    set(field: string, value: unknown): Promise<void>;
    unset(field: string): Promise<void>;
}
/** The client settings service face that binds a scope to one namespace. */
export interface SettingsScopeBinder {
    bind<T>(spec: {
        namespace: string;
    }): SettingsScope<T>;
}
