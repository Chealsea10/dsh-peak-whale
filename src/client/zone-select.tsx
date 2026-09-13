/**
 * Time-zone picker shared by the settings card and the composer chip: a select
 * of common zones (plus the browser's own), with an escape hatch for any other
 * IANA name. Choosing a zone the schedule is NOT quoted in is the common case —
 * DeepSeek publishes peak hours in Beijing time, so a Moscow user needs the
 * conversion spelled out, which is why every option shows its live UTC offset.
 */
import type { ReactElement } from 'react'

import { pickLocale, type Locale } from './i18n.js'
import { CUSTOM_ZONE, ZONE_CHOICES, browserZone, isValidZone, zoneOffsetLabel } from './timezones.js'

const LABELS: Record<Locale, { zone: string; auto: string; custom: string; invalid: string }> = {
  en: { zone: 'Time zone', auto: 'Local (auto)', custom: 'Other (IANA)…', invalid: 'Unknown IANA zone' },
  ru: { zone: 'Таймзона', auto: 'Локальная (авто)', custom: 'Другая (IANA)…', invalid: 'Неизвестная IANA-зона' },
  zh: { zone: '时区', auto: '本地（自动）', custom: '其他（IANA）…', invalid: '未知的 IANA 时区' },
}

const selectStyle = {
  font: 'inherit',
  color: 'inherit',
  background: 'transparent',
  border: '1px solid rgba(127,127,127,0.4)',
  borderRadius: 8,
  padding: '4px 6px',
  maxWidth: '100%',
} as const

const inputStyle = {
  ...selectStyle,
  padding: '4px 8px',
  width: '100%',
  boxSizing: 'border-box',
} as const

export interface ZoneSelectProps {
  /** Current IANA zone. */
  value: string
  /** Commit a new zone. */
  onChange: (zone: string) => void
  /** Render read-only (memory-mode connections). */
  disabled?: boolean
  /** Instant used for the offset column. */
  now: Date
  /** Include the surrounding label row (the card wants it, the chip does not). */
  withLabel?: boolean
}

/**
 * Render the picker.
 * @param props - current zone, commit callback, and render options.
 * @returns the control.
 */
export function ZoneSelect(props: ZoneSelectProps): ReactElement {
  const locale = pickLocale()
  const t = LABELS[locale]
  const own = browserZone()
  const known = ZONE_CHOICES.some((choice) => choice.id === props.value)
  const custom = !known

  const options: Array<{ id: string; label: string }> = []
  if (!ZONE_CHOICES.some((choice) => choice.id === own)) {
    options.push({ id: own, label: `${t.auto} — ${own}` })
  }
  for (const choice of ZONE_CHOICES) {
    const offset = zoneOffsetLabel(choice.id, props.now)
    options.push({ id: choice.id, label: `${choice.label[locale]} · ${offset}` })
  }
  options.push({ id: CUSTOM_ZONE, label: t.custom })

  const control = (
    <select
      style={selectStyle}
      disabled={props.disabled}
      value={custom ? CUSTOM_ZONE : props.value}
      onChange={(event) => {
        if (event.target.value !== CUSTOM_ZONE) props.onChange(event.target.value)
      }}
    >
      {options.map((option) => (
        <option key={option.id} value={option.id}>
          {option.label}
        </option>
      ))}
    </select>
  )

  if (!props.withLabel) {
    return (
      <>
        {control}
        {custom ? (
          <input
            type="text"
            style={inputStyle}
            disabled={props.disabled}
            defaultValue={props.value}
            key={props.value}
            onBlur={(event) => {
              const next = event.target.value.trim()
              if (next.length > 0 && isValidZone(next)) props.onChange(next)
            }}
          />
        ) : null}
      </>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <label>{t.zone}</label>
      {control}
      {custom ? (
        <>
          <input
            type="text"
            style={inputStyle}
            disabled={props.disabled}
            defaultValue={props.value}
            key={props.value}
            onBlur={(event) => {
              const next = event.target.value.trim()
              if (next.length > 0 && isValidZone(next)) props.onChange(next)
            }}
          />
          {isValidZone(props.value) ? null : (
            <span style={{ color: '#d64545', fontSize: '0.85em' }}>{t.invalid}</span>
          )}
        </>
      ) : null}
    </div>
  )
}
