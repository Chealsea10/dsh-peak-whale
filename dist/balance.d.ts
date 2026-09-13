/**
 * Balance lookup against the DeepSeek open platform (GET /user/balance).
 * Only ever called with the user's own configured API key.
 */
export interface BalanceEntry {
    currency: string;
    totalBalance: string;
    grantedBalance: string;
    toppedUpBalance: string;
}
export interface BalanceSnapshot {
    isAvailable: boolean;
    currencies: BalanceEntry[];
}
export declare function fetchBalance(apiBase: string, apiKey: string, signal?: AbortSignal): Promise<BalanceSnapshot>;
