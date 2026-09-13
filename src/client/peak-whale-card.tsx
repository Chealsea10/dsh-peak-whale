/**
 * The browser-side Peak Whale card for the dsh "Plugin configuration" tab.
 *
 * The slot renderer mounts registered entries with `jsx(entry.component, props)`,
 * so a card must be a React component — a class with an imperative
 * `render(): HTMLElement` is called as a plain function by React and throws.
 * This card is a function component that subscribes to its settings scope
 * itself (`getSnapshot` + `subscribe`), which keeps it independent of the
 * slot-injection hook protocol and of any cross-plugin value import.
 */
import { useEffect, useState, type ReactElement } from 'react'

import { localDateInZone, localTimeInZone } from '../pricing.js'
import { readBalance, type BalanceState } from './balance-client.js'
import { liveStatus, parseWindowsInput, resolveDisplayZone, windowsInput, type ConfigSnapshot } from './card-model.js'
import { pickLocale, type Locale } from './i18n.js'
import type { SettingsScope } from './scope.js'
import { useNow, useSettingsSnapshot } from './use-scope.js'
import { ZoneSelect } from './zone-select.js'

const DEFAULT_API_BASE = 'https://api.deepseek.com'

interface Strings {
  subtitle: string
  peak: string
  offPeak: string
  nextSwitch: string
  now: string
  displayZone: string
  scheduleZone: string
  scheduleZoneHint: string
  peakWindows: string
  peakWeekdaysOnly: string
  peakMultiplier: string
  offPeakMultiplier: string
  apiKey: string
  overridden: string
  reset: string
  apply: string
  invalidWindows: string
  loading: string
  unavailable: string
  readOnly: string
  balance: string
  refresh: string
  balanceHint: string
  toolsHint: string
}

const STRINGS: Record<Locale, Strings> = {
  en: {
    subtitle: 'DeepSeek API peak / half-price off-peak awareness.',
    peak: 'PEAK',
    offPeak: 'OFF-PEAK',
    nextSwitch: 'Next switch →',
    now: 'Now',
    displayZone: 'Show times in',
    scheduleZone: 'DeepSeek schedule zone',
    scheduleZoneHint:
      'The schedule zone is where DeepSeek publishes its peak hours (Beijing). Changing it changes ' +
      'which hours count as peak — use the display zone above to read times in your own clock.',
    peakWindows: 'Peak windows (HH:MM-HH:MM, comma-separated)',
    peakWeekdaysOnly: 'Peak on weekdays only (Mon–Fri)',
    peakMultiplier: 'Peak multiplier',
    offPeakMultiplier: 'Off-peak multiplier',
    apiKey: 'DeepSeek API key — enables the balance',
    overridden: 'overridden',
    reset: 'reset',
    apply: 'apply',
    invalidWindows: 'Invalid windows — not saved',
    loading: 'Loading the peak-whale settings…',
    unavailable: 'The peak-whale settings namespace is not served by this deployment.',
    readOnly: 'This connection keeps preferences process-local — the fields are read-only.',
    balance: 'Balance',
    refresh: 'refresh',
    balanceHint: 'Add a DeepSeek API key to see the account balance here and in the composer chip.',
    toolsHint:
      'The whale also sits in the composer row: click it for the zone picker and the balance. ' +
      'The agent answers via deepseek_peak_status and can schedule work into half-price windows ' +
      'with deepseek_next_offpeak.',
  },
  ru: {
    subtitle: 'Пиковые и полцены (off-peak) тарифы DeepSeek API.',
    peak: 'ПИК',
    offPeak: 'OFF-PEAK',
    nextSwitch: 'Переключение →',
    now: 'Сейчас',
    displayZone: 'Показывать время в',
    scheduleZone: 'Зона расписания DeepSeek',
    scheduleZoneHint:
      'Зона расписания — та, в которой DeepSeek публикует пиковые часы (Пекин). Её изменение меняет ' +
      'и то, какие часы считаются пиковыми: чтобы видеть своё время, используйте зону показа выше.',
    peakWindows: 'Пиковые окна (ЧЧ:ММ-ЧЧ:ММ, через запятую)',
    peakWeekdaysOnly: 'Пик только по будням (пн–пт)',
    peakMultiplier: 'Множитель пика',
    offPeakMultiplier: 'Множитель off-peak',
    apiKey: 'Ключ DeepSeek API — включает показ баланса',
    overridden: 'переопределено',
    reset: 'сброс',
    apply: 'применить',
    invalidWindows: 'Некорректные окна — не сохранено',
    loading: 'Загрузка настроек peak-whale…',
    unavailable: 'Пространство настроек peak-whale не обслуживается этим развёртыванием.',
    readOnly: 'Это соединение хранит настройки локально в процессе — поля только для чтения.',
    balance: 'Баланс',
    refresh: 'обновить',
    balanceHint: 'Добавьте ключ DeepSeek API, чтобы видеть баланс здесь и в чипе у поля ввода.',
    toolsHint:
      'Кит также живёт в строке композера: нажмите на него, чтобы выбрать таймзону и увидеть баланс. ' +
      'Агент отвечает через deepseek_peak_status и умеет планировать работу на дешёвые окна ' +
      'через deepseek_next_offpeak.',
  },
  zh: {
    subtitle: 'DeepSeek API 峰值 / 半价非峰值感知。',
    peak: '峰值',
    offPeak: '非峰值',
    nextSwitch: '下次切换 →',
    now: '当前',
    displayZone: '时间显示时区',
    scheduleZone: 'DeepSeek 计费时区',
    scheduleZoneHint:
      '计费时区是 DeepSeek 公布峰值时段所用的时区（北京）。改动它会改变哪些小时算作峰值 —— ' +
      '若只想按自己的时钟查看时间，请使用上面的显示时区。',
    peakWindows: '峰值窗口（HH:MM-HH:MM，逗号分隔）',
    peakWeekdaysOnly: '仅工作日为峰值（周一至周五）',
    peakMultiplier: '峰值倍率',
    offPeakMultiplier: '非峰值倍率',
    apiKey: 'DeepSeek API 密钥 — 用于显示余额',
    overridden: '已覆盖',
    reset: '重置',
    apply: '应用',
    invalidWindows: '窗口格式无效 — 未保存',
    loading: '正在加载 peak-whale 设置…',
    unavailable: '此部署未提供 peak-whale 设置命名空间。',
    readOnly: '此连接将偏好保存在进程内 — 字段为只读。',
    balance: '余额',
    refresh: '刷新',
    balanceHint: '添加 DeepSeek API 密钥后，可在此处和输入框旁的芯片中查看余额。',
    toolsHint:
      '鲸鱼也会出现在输入框工具行：点击可切换时区并查看余额。' +
      '代理通过 deepseek_peak_status 回答，并可用 deepseek_next_offpeak 把工作安排到半价时段。',
  },
}

function asRecord(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : {}
}

const rootStyle = {
  display: 'flex',
  flexDirection: 'column',
  gap: 12,
  font: 'inherit',
  color: 'inherit',
} as const
const rowStyle = { display: 'flex', flexDirection: 'column', gap: 4 } as const
const rowHeadStyle = { display: 'flex', alignItems: 'baseline', gap: 8 } as const
const inputStyle = {
  font: 'inherit',
  color: 'inherit',
  background: 'transparent',
  border: '1px solid rgba(127,127,127,0.4)',
  borderRadius: 8,
  padding: '6px 10px',
  width: '100%',
  boxSizing: 'border-box',
} as const
const badgeStyle = {
  fontSize: '0.75em',
  opacity: 0.7,
  border: '1px solid rgba(127,127,127,0.4)',
  borderRadius: 999,
  padding: '1px 8px',
} as const
const linkButtonStyle = {
  font: 'inherit',
  background: 'none',
  border: 'none',
  color: 'inherit',
  textDecoration: 'underline',
  cursor: 'pointer',
  padding: 0,
} as const
const statusBoxStyle = {
  padding: '10px 12px',
  border: '1px solid rgba(127,127,127,0.35)',
  borderRadius: 10,
  lineHeight: 1.5,
  whiteSpace: 'pre-line',
} as const

/**
 * Build the card component bound to one namespace scope.
 * @param scope - the settings scope bound on the owning plugin's fiber.
 * @returns the React component to register into `settings.plugin.item`.
 */
export function createPeakWhaleCard(scope: SettingsScope<ConfigSnapshot>) {
  return function PeakWhaleCard(): ReactElement {
    const t = STRINGS[pickLocale()]

    const snapshot = useSettingsSnapshot(scope)
    const now = useNow()
    const [draftWindows, setDraftWindows] = useState<string | null>(null)
    const [windowsError, setWindowsError] = useState<string | null>(null)
    const [balance, setBalance] = useState<BalanceState>({ status: 'idle' })
    const [balanceNonce, setBalanceNonce] = useState(0)

    const apiKey = (snapshot.value?.apiKey ?? '').trim()
    const apiBase = (snapshot.value?.apiBase ?? '').trim() || DEFAULT_API_BASE

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

    if (snapshot.status === 'unavailable') {
      return <p style={{ margin: 0, opacity: 0.8 }}>{t.unavailable}</p>
    }
    if (snapshot.value === undefined) {
      return <p style={{ margin: 0, opacity: 0.8 }}>{t.loading}</p>
    }

    const value = snapshot.value
    const overrides = asRecord(snapshot.user)
    const disabled = !snapshot.writable
    const isOverridden = (field: string) => Object.hasOwn(overrides, field)
    const displayZone = resolveDisplayZone(value)
    const status = liveStatus(now, { ...value, displayTimeZone: displayZone })

    const row = (field: string, label: string, control: ReactElement): ReactElement => (
      <div style={rowStyle}>
        <div style={rowHeadStyle}>
          <label>{label}</label>
          {isOverridden(field) ? <span style={badgeStyle}>{t.overridden}</span> : null}
          {isOverridden(field) ? (
            <button type="button" style={linkButtonStyle} onClick={() => void scope.unset(field)}>
              {t.reset}
            </button>
          ) : null}
        </div>
        {control}
      </div>
    )

    const textField = (field: keyof ConfigSnapshot, label: string, type = 'text'): ReactElement =>
      row(
        field,
        label,
        <input
          type={type}
          style={inputStyle}
          disabled={disabled}
          placeholder={type === 'password' ? 'sk-…' : undefined}
          defaultValue={String(value[field] ?? '')}
          key={`${field}:${String(value[field] ?? '')}`}
          onChange={(event) => void scope.set(field, event.target.value)}
        />,
      )

    const numberField = (field: keyof ConfigSnapshot, label: string): ReactElement =>
      row(
        field,
        label,
        <input
          type="number"
          min={0}
          step={0.05}
          style={inputStyle}
          disabled={disabled}
          defaultValue={String(value[field] ?? '')}
          key={`${field}:${String(value[field] ?? '')}`}
          onChange={(event) => {
            const parsed = Number(event.target.value)
            if (Number.isFinite(parsed)) void scope.set(field, parsed)
          }}
        />,
      )

    const shownWindows = draftWindows ?? windowsInput(value.peakWindows ?? [])

    return (
      <section className="dsh-peak-whale-card" style={rootStyle}>
        <p style={{ margin: 0, opacity: 0.8 }}>{t.subtitle}</p>

        <div style={statusBoxStyle}>
          {status.ok ? (
            <>
              {`${status.isPeak ? '🐋' : '🐋💤'} ${status.isPeak ? t.peak : t.offPeak} ×${status.multiplier}`}
              {`\n${t.now} ${localTimeInZone(now, displayZone)}, ${localDateInZone(now, displayZone)} (${displayZone})`}
              {displayZone !== value.timeZone
                ? `\n${t.scheduleZone}: ${value.timeZone}`
                : ''}
              {status.countdown !== null && status.becomes !== null && status.nextLocalTime !== null
                ? `\n${t.nextSwitch} ${status.becomes === 'peak' ? t.peak : t.offPeak} ${status.nextLocalTime}, ${status.countdown}`
                : ''}
            </>
          ) : (
            `⚠️ ${status.error}`
          )}
        </div>

        {disabled ? (
          <p style={{ margin: 0, opacity: 0.75, fontSize: '0.92em' }}>{t.readOnly}</p>
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 10 }}>
          {row(
            'displayTimeZone',
            t.displayZone,
            <ZoneSelect
              value={displayZone}
              now={now}
              disabled={disabled}
              onChange={(zone) => void scope.set('displayTimeZone', zone)}
            />,
          )}

          {row(
            'timeZone',
            t.scheduleZone,
            <ZoneSelect
              value={value.timeZone}
              now={now}
              disabled={disabled}
              onChange={(zone) => void scope.set('timeZone', zone)}
            />,
          )}
          <p style={{ margin: 0, opacity: 0.7, fontSize: '0.85em' }}>{t.scheduleZoneHint}</p>

          {row(
            'peakWindows',
            t.peakWindows,
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <input
                type="text"
                style={inputStyle}
                disabled={disabled}
                value={shownWindows}
                onChange={(event) => setDraftWindows(event.target.value)}
              />
              <button
                type="button"
                style={{ ...inputStyle, width: 'auto', cursor: 'pointer' }}
                disabled={disabled}
                onClick={() => {
                  const parsed = parseWindowsInput(shownWindows)
                  setWindowsError(parsed.ok ? null : `${t.invalidWindows}: ${parsed.error}`)
                  if (parsed.ok) {
                    void scope.set('peakWindows', parsed.windows)
                    setDraftWindows(null)
                  }
                }}
              >
                {t.apply}
              </button>
            </div>,
          )}
          {windowsError !== null ? (
            <span style={{ color: '#d64545', fontSize: '0.85em' }}>{windowsError}</span>
          ) : null}

          {row(
            'peakWeekdaysOnly',
            t.peakWeekdaysOnly,
            <input
              type="checkbox"
              disabled={disabled}
              defaultChecked={value.peakWeekdaysOnly === true}
              key={`peakWeekdaysOnly:${String(value.peakWeekdaysOnly)}`}
              onChange={(event) => void scope.set('peakWeekdaysOnly', event.target.checked)}
            />,
          )}
          {numberField('peakMultiplier', t.peakMultiplier)}
          {numberField('offPeakMultiplier', t.offPeakMultiplier)}
          {textField('apiKey', t.apiKey, 'password')}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <strong>{t.balance}</strong>
            {apiKey.length > 0 ? (
              <button
                type="button"
                style={linkButtonStyle}
                onClick={() => setBalanceNonce((nonce) => nonce + 1)}
              >
                {t.refresh}
              </button>
            ) : null}
          </div>
          {apiKey.length === 0 ? (
            <span style={{ opacity: 0.75, fontSize: '0.92em' }}>{t.balanceHint}</span>
          ) : balance.status === 'loading' ? (
            <span style={{ opacity: 0.75, fontSize: '0.92em' }}>{t.loading}</span>
          ) : balance.status === 'error' ? (
            <span style={{ color: '#d64545', fontSize: '0.92em' }}>{balance.error}</span>
          ) : balance.status === 'ok' && balance.snapshot.currencies.length > 0 ? (
            <span style={{ fontSize: '0.92em' }}>
              {balance.snapshot.currencies
                .map((entry) => `${entry.currency} ${entry.totalBalance}`)
                .join(' · ')}
            </span>
          ) : balance.status === 'ok' ? (
            <span style={{ opacity: 0.75, fontSize: '0.92em' }}>—</span>
          ) : null}
        </div>

        <p style={{ margin: 0, opacity: 0.75, fontSize: '0.92em' }}>{t.toolsHint}</p>
      </section>
    )
  }
}
