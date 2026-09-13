/**
 * Peak/off-peak pricing math for the DeepSeek API.
 *
 * Default rule (as popularised by the DeepSeekStatus menu bar app):
 *   peak = Mon-Fri 09:00-12:00 and 14:00-18:00, Beijing time;
 *   everything else (nights, weekends, the lunch break) is half price.
 * Chinese public holidays are NOT accounted for.
 *
 * All functions take UTC instants; wall-clock time is derived through Intl,
 * so any IANA time zone works, DST shifts included.
 */
export interface PricingConfig {
    /**
     * The SCHEDULE zone: the zone the peak windows are written in. DeepSeek
     * publishes its peak hours in Beijing time, so this must stay `Asia/Shanghai`
     * unless the platform changes its schedule — pointing it at your own zone
     * silently shifts which hours count as peak.
     */
    timeZone: string;
    /**
     * DISPLAY-only zone: the zone local times are *shown* in, never the one the
     * tariff is judged in. Empty (the default) falls back to `timeZone`. This is
     * what a Moscow user sets so countdowns read in their own clock while the
     * peak classification stays anchored to the published Beijing schedule.
     */
    displayTimeZone?: string;
    /** Peak windows as 'HH:MM-HH:MM' strings in `timeZone` wall time, start < end, within one day. */
    peakWindows: readonly string[];
    /** Restrict the peak windows to Monday-Friday. */
    peakWeekdaysOnly: boolean;
    peakMultiplier: number;
    offPeakMultiplier: number;
}
export interface ResolvedPricing extends PricingConfig {
    /** Resolved display zone, never empty (falls back to `timeZone`). */
    displayTimeZone: string;
    windows: ReadonlyArray<{
        startMinute: number;
        endMinute: number;
    }>;
}
export interface PricePeriod {
    isPeak: boolean;
    multiplier: number;
    period: 'peak' | 'off-peak';
}
export declare function parseWindows(specs: readonly string[]): Array<{
    startMinute: number;
    endMinute: number;
}>;
/** Validates the zone and window specs, so bad config fails the plugin load with an actionable error. */
export declare function resolvePricing(config: PricingConfig): ResolvedPricing;
export interface WallClock {
    /** 0 = Sunday ... 6 = Saturday, matching Date#getDay. */
    weekday: number;
    minuteOfDay: number;
}
export declare function wallClockInZone(instant: Date, timeZone: string): WallClock;
export declare function classify(instant: Date, pricing: ResolvedPricing): PricePeriod;
/**
 * The next instant (minute-aligned, strictly after `instant`) where the period flips,
 * or null if the config produces an unchanging period for a full week.
 */
export declare function nextBoundary(instant: Date, pricing: ResolvedPricing): Date | null;
export interface OffPeakWindow {
    startUtc: string;
    /** Null only for a degenerate config that never leaves off-peak. */
    endUtc: string | null;
    durationMinutes: number | null;
    /** Matches the schedule subsystem's LocalAtInput, for schedule_create. */
    startLocal: {
        date: string;
        time: string;
        time_zone: string;
    };
}
/** 'YYYY-MM-DD' in the zone (en-CA yields ISO ordering). */
export declare function localDateInZone(instant: Date, timeZone: string): string;
/** 'HH:MM' in the zone. */
export declare function localTimeInZone(instant: Date, timeZone: string): string;
/**
 * The next `count` off-peak windows as UTC intervals. The window containing
 * `instant` (if any) starts at `instant` itself, so it is immediately actionable.
 */
export declare function upcomingOffPeakWindows(instant: Date, pricing: ResolvedPricing, count: number): OffPeakWindow[];
export declare function formatCountdown(ms: number): string;
