/**
 * Model- and human-facing rendering of the tools' canonical JSON values.
 * Dependency-free apart from the pricing helpers, so it is self-checkable.
 */
export interface NextSwitch {
    atUtc: string;
    atLocal: string;
    becomes: 'peak' | 'off-peak';
    countdown: string;
}
export interface BalanceValue {
    error?: string;
    isAvailable?: boolean;
    currencies?: Array<{
        currency: string;
        totalBalance: string;
        grantedBalance: string;
        toppedUpBalance: string;
    }>;
}
export interface StatusValue {
    isPeak: boolean;
    period: 'peak' | 'off-peak';
    multiplier: number;
    /** The schedule zone the peak windows are judged in. */
    timeZone: string;
    /** The zone `nowLocal`/`atLocal` are expressed in. */
    displayTimeZone: string;
    nowUtc: string;
    nowLocal: string;
    nextSwitch: NextSwitch | null;
    balance?: BalanceValue;
}
export interface OffPeakValue {
    /** The schedule zone the windows are judged in. */
    timeZone: string;
    /** The zone `startLocal` is expressed in. */
    displayTimeZone: string;
    offPeakMultiplier: number;
    windows: Array<{
        startUtc: string;
        endUtc: string | null;
        durationMinutes: number | null;
        startLocal: {
            date: string;
            time: string;
            time_zone: string;
        };
    }>;
    hint: string;
}
export declare function renderStatus(value: StatusValue): string;
export declare function renderOffPeak(value: OffPeakValue): string;
