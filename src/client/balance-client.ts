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
import type { BalanceSnapshot } from '../balance.js'

/** Result of one balance attempt, never a throw. */
export type BalanceState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ok'; snapshot: BalanceSnapshot; at: number }
  | { status: 'error'; error: string; at: number }

/** Shared cache so N open Sessions do not each fire a request. */
let cache: { key: string; at: number; state: BalanceState } | null = null

/** How long a fetched balance is reused before the next read refetches. */
export const BALANCE_TTL_MS = 60_000

/**
 * Read the balance for a key, reusing a recent result.
 * @param apiBase - API root, e.g. `https://api.deepseek.com`.
 * @param apiKey - the configured key.
 * @param signal - abort signal for unmount/cancel.
 * @param force - ignore the cache (the refresh action).
 * @returns the balance state; failures come back as `error`, never a throw.
 */
export async function readBalance(
  apiBase: string,
  apiKey: string,
  signal?: AbortSignal,
  force = false,
): Promise<BalanceState> {
  const cacheKey = `${apiBase}|${apiKey}`
  if (!force && cache !== null && cache.key === cacheKey && Date.now() - cache.at < BALANCE_TTL_MS) {
    return cache.state
  }
  const state = await request(apiBase, apiKey, signal)
  cache = { key: cacheKey, at: Date.now(), state }
  return state
}

/** Drop the cache (used by the tests and the refresh action). */
export function clearBalanceCache(): void {
  cache = null
}

async function request(apiBase: string, apiKey: string, signal?: AbortSignal): Promise<BalanceState> {
  const url = `${apiBase.replace(/\/+$/, '')}/user/balance`
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: 'application/json' },
      signal,
    })
    if (response.status === 401) {
      return { status: 'error', error: 'HTTP 401 — ключ отклонён', at: Date.now() }
    }
    if (!response.ok) {
      return { status: 'error', error: `HTTP ${response.status}`, at: Date.now() }
    }
    const body = (await response.json()) as {
      is_available?: boolean
      balance_infos?: Array<{
        currency?: string
        total_balance?: string
        granted_balance?: string
        topped_up_balance?: string
      }>
    }
    return {
      status: 'ok',
      at: Date.now(),
      snapshot: {
        isAvailable: body.is_available === true,
        currencies: (body.balance_infos ?? []).map((info) => ({
          currency: info.currency ?? 'CNY',
          totalBalance: info.total_balance ?? '?',
          grantedBalance: info.granted_balance ?? '?',
          toppedUpBalance: info.topped_up_balance ?? '?',
        })),
      },
    }
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') return { status: 'idle' }
    return {
      status: 'error',
      error: error instanceof Error ? error.message : String(error),
      at: Date.now(),
    }
  }
}
