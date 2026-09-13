/**
 * The composer chip: the whale lives in the composer tool row next to the model
 * selector, so the current tariff is visible without opening Settings, and one
 * click opens the zone picker and the account balance.
 *
 * It registers into the `conversation.input.left` slot declared by
 * `@deepseek-ai/dsh-client-ui-conversation` — a session-scoped list slot, so the
 * chip appears once per Session and must be a React component like any other
 * occupant.
 */
import { useEffect, useRef, useState, type ReactElement } from 'react'

import { localDateInZone, localTimeInZone } from '../pricing.js'
import { BALANCE_TTL_MS, readBalance, type BalanceState } from './balance-client.js'
import { liveStatus, resolveDisplayZone, type ConfigSnapshot } from './card-model.js'
import { pickLocale, type Locale } from './i18n.js'
import type { SettingsScope } from './scope.js'
import { useNow, useSettingsSnapshot } from './use-scope.js'
import { ZoneSelect } from './zone-select.js'

const DEFAULT_API_BASE = 'https://api.deepseek.com'

interface Strings {
  peak: string
  offPeak: string
  until: string
  now: string
  schedule: string
  balance: string
  refresh: string
  noKey: string
  loading: string
}

const STRINGS: Record<Locale, Strings> = {
  en: {
    peak: 'PEAK',
    offPeak: 'OFF-PEAK',
    until: 'Switch in',
    now: 'Now',
    schedule: 'DeepSeek schedule zone:',
    balance: 'Balance',
    refresh: 'refresh',
    noKey: 'No API key yet — add one in the plugin settings to see the balance.',
    loading: 'reading…',
  },
  ru: {
    peak: 'ПИК',
    offPeak: 'OFF-PEAK',
    until: 'До переключения',
    now: 'Сейчас',
    schedule: 'Зона расписания DeepSeek:',
    balance: 'Баланс',
    refresh: 'обновить',
    noKey: 'API-ключ не задан — добавьте его в настройках плагина, чтобы видеть баланс.',
    loading: 'читаю…',
  },
  zh: {
    peak: '峰值',
    offPeak: '非峰值',
    until: '距切换',
    now: '当前',
    schedule: 'DeepSeek 计费时区：',
    balance: '余额',
    refresh: '刷新',
    noKey: '尚未设置 API 密钥 —— 在插件设置中添加后可查看余额。',
    loading: '读取中…',
  },
}

const CHIP_STYLE = {
  font: 'inherit',
  color: 'inherit',
  background: 'transparent',
  border: '1px solid rgba(127,127,127,0.35)',
  borderRadius: 999,
  padding: '2px 10px',
  cursor: 'pointer',
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  lineHeight: 1.6,
  whiteSpace: 'nowrap',
} as const

const PANEL_STYLE = {
  position: 'absolute',
  bottom: 'calc(100% + 8px)',
  left: 0,
  zIndex: 60,
  minWidth: 280,
  maxWidth: 340,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  padding: '10px 12px',
  border: '1px solid rgba(127,127,127,0.4)',
  borderRadius: 12,
  background: 'var(--dsh-surface, Canvas)',
  color: 'inherit',
  boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
  fontSize: '0.92em',
  lineHeight: 1.5,
} as const

/** `HH:MM:SS` -> `HH:MM`, so the chip stays narrow. */
function shortCountdown(countdown: string): string {
  return /^\d{2}:\d{2}:\d{2}$/.test(countdown) ? countdown.slice(0, 5) : countdown
}

/** One currency symbol for the compact chip. */
function currencySymbol(currency: string): string {
  if (currency === 'CNY') return '¥'
  if (currency === 'USD') return '$'
  return `${currency} `
}

/**
 * Build the chip component bound to one namespace scope.
 * @param scope - the settings scope bound on the owning plugin's fiber.
 * @returns the React component to register into `conversation.input.left`.
 */
export function createPeakWhaleChip(scope: SettingsScope<ConfigSnapshot>) {
  return function PeakWhaleChip(): ReactElement | null {
    const t = STRINGS[pickLocale()]
    const snapshot = useSettingsSnapshot(scope)
    const now = useNow()
    const [open, setOpen] = useState(false)
    const [balance, setBalance] = useState<BalanceState>({ status: 'idle' })
    const [balanceNonce, setBalanceNonce] = useState(0)
    const rootRef = useRef<HTMLDivElement | null>(null)

    const value = snapshot.value
    const apiKey = (value?.apiKey ?? '').trim()
    const apiBase = (value?.apiBase ?? '').trim() || DEFAULT_API_BASE

    // Read the balance as soon as a key is configured: the whole point is not
    // having to go into Settings. A module-level cache keeps N open Sessions
    // from firing N requests.
    useEffect(() => {
      if (apiKey.length === 0) {
        setBalance({ status: 'idle' })
        return
      }
      const controller = new AbortController()
      setBalance((previous) => (previous.status === 'ok' ? previous : { status: 'loading' }))
      void readBalance(apiBase, apiKey, controller.signal, balanceNonce > 0).then((state) => {
        if (!controller.signal.aborted) setBalance(state)
      })
      return () => controller.abort()
    }, [apiKey, apiBase, balanceNonce])

    useEffect(() => {
      if (!open) return
      const onPointerDown = (event: MouseEvent) => {
        if (rootRef.current !== null && !rootRef.current.contains(event.target as Node)) setOpen(false)
      }
      const onKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') setOpen(false)
      }
      document.addEventListener('mousedown', onPointerDown)
      document.addEventListener('keydown', onKeyDown)
      return () => {
        document.removeEventListener('mousedown', onPointerDown)
        document.removeEventListener('keydown', onKeyDown)
      }
    }, [open])

    // Nothing to say until the namespace is served, or on a memory-mode connection.
    if (snapshot.status !== 'ready' || value === undefined) return null

    // Times read in the user's zone; the tariff is still judged in the schedule
    // zone (DeepSeek publishes its peak hours in Beijing time).
    const displayZone = resolveDisplayZone(value)
    const status = liveStatus(now, { ...value, displayTimeZone: displayZone })
    const whale = status.ok ? (status.isPeak ? '🐋' : '🐋💤') : '🐋'
    const period = status.ok ? (status.isPeak ? t.peak : t.offPeak) : '?'
    const countdown = status.ok && status.countdown !== null ? shortCountdown(status.countdown) : null
    const balanceSummary =
      balance.status === 'ok' && balance.snapshot.currencies.length > 0
        ? balance.snapshot.currencies
            .map((entry) => `${currencySymbol(entry.currency)}${entry.totalBalance}`)
            .join(' · ')
        : null

    return (
      <div ref={rootRef} style={{ position: 'relative', display: 'inline-flex' }}>
        <button
          type="button"
          className="dsh-peak-whale-chip"
          style={CHIP_STYLE}
          title={status.ok ? `${period} ×${status.multiplier}` : value.timeZone}
          aria-expanded={open}
          onClick={() => setOpen((previous) => !previous)}
        >
          <span>{whale}</span>
          {countdown !== null ? <span>{countdown}</span> : <span>{period}</span>}
          {balanceSummary !== null ? <span style={{ opacity: 0.75 }}>{balanceSummary}</span> : null}
        </button>

        {open ? (
          <div className="dsh-peak-whale-panel" style={PANEL_STYLE}>
            {status.ok ? (
              <div>
                {`${whale} ${period} ×${status.multiplier}`}
                {status.countdown !== null && status.nextLocalTime !== null ? (
                  <>
                    <br />
                    {`${t.until} ${status.countdown}`}
                    {status.becomes !== null ? ` → ${status.becomes === 'peak' ? t.peak : t.offPeak}` : ''}
                    {` ${status.nextLocalTime}`}
                  </>
                ) : null}
                <br />
                {`${t.now} ${localTimeInZone(now, displayZone)}, ${localDateInZone(now, displayZone)} (${displayZone})`}
                {displayZone !== value.timeZone ? (
                  <>
                    <br />
                    {`${t.schedule} ${value.timeZone}`}
                  </>
                ) : null}
              </div>
            ) : (
              <div style={{ color: '#d64545' }}>{`⚠️ ${status.error}`}</div>
            )}

            <ZoneSelect
              value={displayZone}
              now={now}
              disabled={!snapshot.writable}
              onChange={(zone) => void scope.set('displayTimeZone', zone)}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                <span style={{ opacity: 0.75 }}>{t.balance}</span>
                {balance.status === 'ok' || balance.status === 'error' ? (
                  <button
                    type="button"
                    style={{
                      font: 'inherit',
                      background: 'none',
                      border: 'none',
                      color: 'inherit',
                      textDecoration: 'underline',
                      cursor: 'pointer',
                      padding: 0,
                    }}
                    onClick={() => setBalanceNonce((n) => n + 1)}
                  >
                    {t.refresh}
                  </button>
                ) : null}
              </div>
              {apiKey.length === 0 ? (
                <span style={{ opacity: 0.75 }}>{t.noKey}</span>
              ) : balance.status === 'loading' ? (
                <span style={{ opacity: 0.75 }}>{t.loading}</span>
              ) : balance.status === 'error' ? (
                <span style={{ color: '#d64545' }}>{balance.error}</span>
              ) : balance.status === 'ok' && balance.snapshot.currencies.length > 0 ? (
                <span>
                  {balance.snapshot.currencies
                    .map((entry) => `${entry.currency} ${entry.totalBalance}`)
                    .join(' · ')}
                  <span style={{ opacity: 0.6 }}>
                    {` (${Math.max(0, Math.round((Date.now() - balance.at) / 1000))}s, TTL ${BALANCE_TTL_MS / 1000}s)`}
                  </span>
                </span>
              ) : balance.status === 'ok' ? (
                <span style={{ opacity: 0.75 }}>—</span>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    )
  }
}
