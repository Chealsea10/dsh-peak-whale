/**
 * The browser-side Peak Whale card for the dsh "Plugin configuration" tab.
 *
 * The slot renderer mounts registered entries with `jsx(entry.component, props)`,
 * so a card must be a React component — a class with an imperative
 * `render(): HTMLElement` is called as a plain function by React and throws.
 * This card is a function component that subscribes to its settings scope
 * itself (`getSnapshot` + `subscribe`), which keeps it independent of the
 * slot-injection hook protocol and of any cross-plugin value import.
 */
import { type ReactElement } from 'react';
import { type ConfigSnapshot } from './card-model.js';
import type { SettingsScope } from './scope.js';
/**
 * Build the card component bound to one namespace scope.
 * @param scope - the settings scope bound on the owning plugin's fiber.
 * @returns the React component to register into `settings.plugin.item`.
 */
export declare function createPeakWhaleCard(scope: SettingsScope<ConfigSnapshot>): () => ReactElement;
