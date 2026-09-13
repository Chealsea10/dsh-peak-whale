/**
 * Time-zone choices for the pickers. A free-text IANA field is the wrong
 * affordance: the common answer for most users is "the one I am in", and a typo
 * only surfaces later as a failed pricing resolve.
 */
/** One selectable zone. */
export interface ZoneChoice {
    /** IANA identifier, e.g. `Europe/Moscow`. */
    id: string;
    /** Human label, localized at render time. */
    label: Record<'en' | 'ru' | 'zh', string>;
}
/**
 * Curated zones. DeepSeek's own peak schedule is quoted in Beijing time, so
 * `Asia/Shanghai` heads the list; `Europe/Moscow` is included because the
 * plugin's first users are there. The browser's own zone and a custom IANA
 * entry are appended at render time.
 */
export declare const ZONE_CHOICES: readonly ZoneChoice[];
/** Sentinel value of the "type an IANA name" entry. */
export declare const CUSTOM_ZONE = "__custom__";
/** Whether a zone identifier is one `Intl` accepts. */
export declare function isValidZone(zone: string): boolean;
/** The browser's own zone, or `UTC` when unavailable (SSR-less, but be safe). */
export declare function browserZone(): string;
/**
 * Current UTC offset of a zone, e.g. `UTC+03:00`, for display beside a label.
 * @param zone - IANA identifier.
 * @param at - instant to evaluate the offset at (DST-correct).
 * @returns the offset label, or `''` when the zone is unusable.
 */
export declare function zoneOffsetLabel(zone: string, at: Date): string;
