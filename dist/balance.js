/**
 * Balance lookup against the DeepSeek open platform (GET /user/balance).
 * Only ever called with the user's own configured API key.
 */
export async function fetchBalance(apiBase, apiKey, signal) {
    const url = `${apiBase.replace(/\/+$/, '')}/user/balance`;
    const response = await fetch(url, {
        headers: { Authorization: `Bearer ${apiKey}` },
        signal,
    });
    if (response.status === 401)
        throw new Error('DeepSeek API rejected the key (HTTP 401)');
    if (!response.ok)
        throw new Error(`balance request failed with HTTP ${response.status}`);
    const body = (await response.json());
    return {
        isAvailable: body.is_available === true,
        currencies: (body.balance_infos ?? []).map((info) => ({
            currency: info.currency ?? 'CNY',
            totalBalance: info.total_balance ?? '?',
            grantedBalance: info.granted_balance ?? '?',
            toppedUpBalance: info.topped_up_balance ?? '?',
        })),
    };
}
