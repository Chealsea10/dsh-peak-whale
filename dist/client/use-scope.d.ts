import type { ConfigSnapshot } from './card-model.js';
import type { SettingsScope, SettingsScopeSnapshot } from './scope.js';
/**
 * Track one namespace's snapshot across React renders.
 * @param scope - the scope bound on the owning plugin's fiber.
 * @returns the current snapshot, replaced on every committed change.
 */
export declare function useSettingsSnapshot(scope: SettingsScope<ConfigSnapshot>): SettingsScopeSnapshot<ConfigSnapshot>;
/** A ticking clock, so countdowns re-render once per second. */
export declare function useNow(intervalMs?: number): Date;
