import type { Context } from '@deepseek-ai/cordis';
import Schema from '@deepseek-ai/schemastery';
export declare const name = "peak-whale";
export declare const inject: string[];
export declare const NAMESPACE = "peak-whale";
/**
 * The `settings` service of the dsh host (`@deepseek-ai/dsh-settings`), declared
 * locally: the package is not a dependency of this plugin, so nothing else
 * contributes the property to cordis' `Context`.
 *
 * `installSection` is the optional-consumer form — it registers this plugin's
 * namespace as a composition base while the settings provider is present and
 * hands back the authoritative config source through `setSource`.
 */
interface SettingsSectionHooks<T> {
    /** Receive the active config source (settings scope while attached, else the composition entry). */
    setSource(current: () => T): void;
    /** Re-judge derived state after an attach, a detach, or a committed change. */
    onChange(): void;
    /** Reject a resolved section the schema alone cannot judge. */
    validate?(value: T): void;
}
interface SettingsService {
    installSection<T>(owner: Context, namespace: string, schema: unknown, entry: T, hooks: SettingsSectionHooks<T>): void;
}
declare module '@deepseek-ai/cordis' {
    interface Context {
        /** Optional dsh host service; reached only through `ctx.inject(['settings'], …)`. */
        settings: SettingsService;
    }
}
export interface Config {
    /** The SCHEDULE zone the pricing windows are evaluated in (DeepSeek publishes them in Beijing time). */
    timeZone: string;
    /** Display-only zone for the times users read; empty falls back to `timeZone`. */
    displayTimeZone: string;
    /** Weekday peak windows, 'HH:MM-HH:MM' in `timeZone` wall time. */
    peakWindows: string[];
    /** Limit the peak windows to Monday-Friday. */
    peakWeekdaysOnly: boolean;
    peakMultiplier: number;
    offPeakMultiplier: number;
    /** Optional DeepSeek API key; enables the balance section of the status tool. */
    apiKey: string;
    apiBase: string;
}
export declare const Config: Schema<Config>;
export declare function apply(ctx: Context, config: Config): void;
export {};
