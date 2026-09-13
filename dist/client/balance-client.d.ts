/**
 * Browser-side balance lookup.
 *
 * `api.deepseek.com/user/balance` answers CORS: it echoes the page origin, allows
 * the `authorization` header, and accepts a `GET` preflight, so the card and the
 * composer chip can read the balance directly instead of routing it through the
 * agent. The key is the one already in this plugin's settings section — and it is
 * deliberately NOT declared `role('secret')`, so a redacting wire surface still
 * delivers it to this browser, which is what makes the balance possible at all.
 * (The trade-off: the key is readable by the page. It is already stored verbatim
 * in the profile's settings file, and the Web UI is loopback-only.)
 */
import type { BalanceSnapshot } from '../balance.js';
/** Result of one balance attempt, never a throw. */
export type BalanceState = {
    status: 'idle';
} | {
    status: 'loading';
} | {
    status: 'ok';
    snapshot: BalanceSnapshot;
    at: number;
} | {
    status: 'error';
    error: string;
    at: number;
};
/** How long a fetched balance is reused before the next read refetches. */
export declare const BALANCE_TTL_MS = 60000;
/**
 * Read the balance for a key, reusing a recent result.
 * @param apiBase - API root, e.g. `https://api.deepseek.com`.
 * @param apiKey - the configured key.
 * @param signal - abort signal for unmount/cancel.
 * @param force - ignore the cache (the refresh action).
 * @returns the balance state; failures come back as `error`, never a throw.
 */
export declare function readBalance(apiBase: string, apiKey: string, signal?: AbortSignal, force?: boolean): Promise<BalanceState>;
/** Drop the cache (used by the tests and the refresh action). */
export declare function clearBalanceCache(): void;
