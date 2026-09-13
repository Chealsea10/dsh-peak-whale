/**
 * Pure logic behind the Peak Whale settings card: derives the live tariff
 * view from a config snapshot and validates form input before it is written
 * to the settings scope. No DOM, no dsh imports — self-checkable.
 */
export interface ConfigSnapshot {
    /** Schedule zone: where the peak windows are written (DeepSeek uses Beijing time). */
    timeZone: string;
    /** Display-only zone for shown times; empty falls back to the browser's own zone here. */
    displayTimeZone?: string;
    peakWindows: string[];
    peakWeekdaysOnly: boolean;
    peakMultiplier: number;
    offPeakMultiplier: number;
    apiKey?: string;
    apiBase?: string;
}
export interface LiveStatusOk {
    ok: true;
    isPeak: boolean;
    period: 'peak' | 'off-peak';
    multiplier: number;
    countdown: string | null;
    becomes: 'peak' | 'off-peak' | null;
    /** Time of the next switch in the display zone. */
    nextLocalTime: string | null;
    /** Zone the shown times are in. */
    displayTimeZone: string;
    /** Zone the peak windows are judged in. */
    timeZone: string;
}
export interface LiveStatusError {
    ok: false;
    error: string;
}
/**
 * The zone the UI should show times in: the configured display zone, else the
 * browser's own zone. The host resolves an empty display zone to the schedule
 * zone, so until a display zone is written the chip reads in the user's clock
 * while the agent keeps quoting the published schedule — which is why the
 * popover names both zones instead of leaving the difference implicit.
 */
export declare function resolveDisplayZone(snapshot: ConfigSnapshot): string;
export declare function liveStatus(now: Date, snapshot: ConfigSnapshot): LiveStatusOk | LiveStatusError;
/** Form input ('09:00-12:00, 14:00-18:00') -> windows array; error message instead of a throw. */
export declare function parseWindowsInput(input: string): {
    ok: true;
    windows: string[];
} | {
    ok: false;
    error: string;
};
export declare function windowsInput(windows: readonly string[]): string;
