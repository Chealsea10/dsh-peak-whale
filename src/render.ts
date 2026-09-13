/**
 * Model- and human-facing rendering of the tools' canonical JSON values.
 * Dependency-free apart from the pricing helpers, so it is self-checkable.
 */

import { localDateInZone, localTimeInZone } from './pricing.js'

export interface NextSwitch {
  atUtc: string
  atLocal: string
  becomes: 'peak' | 'off-peak'
  countdown: string
}

export interface BalanceValue {
  error?: string
  isAvailable?: boolean
  currencies?: Array<{ currency: string; totalBalance: string; grantedBalance: string; toppedUpBalance: string }>
}

export interface StatusValue {
  isPeak: boolean
  period: 'peak' | 'off-peak'
  multiplier: number
  /** The schedule zone the peak windows are judged in. */
  timeZone: string
  /** The zone `nowLocal`/`atLocal` are expressed in. */
  displayTimeZone: string
  nowUtc: string
  nowLocal: string
  nextSwitch: NextSwitch | null
  balance?: BalanceValue
}

export interface OffPeakValue {
  /** The schedule zone the windows are judged in. */
  timeZone: string
  /** The zone `startLocal` is expressed in. */
  displayTimeZone: string
  offPeakMultiplier: number
  windows: Array<{
    startUtc: string
    endUtc: string | null
    durationMinutes: number | null
    startLocal: { date: string; time: string; time_zone: string }
  }>
  hint: string
}

export function renderStatus(value: StatusValue): string {
  const whale = value.isPeak ? '🐋' : '🐋💤'
  const lines: string[] = []
  lines.push(`${whale} DeepSeek API: ${value.period.toUpperCase()} (×${value.multiplier}) — ${value.nowLocal}`)
  if (value.nextSwitch) {
    lines.push(`Next switch → ${value.nextSwitch.becomes} at ${value.nextSwitch.atLocal}, in ${value.nextSwitch.countdown}`)
  }
  if (value.balance) {
    if (value.balance.error) {
      lines.push(`Balance: unavailable — ${value.balance.error}`)
    } else if (!value.balance.currencies || value.balance.currencies.length === 0) {
      lines.push('Balance: no currency entries returned')
    } else {
      for (const entry of value.balance.currencies) {
        const flag = value.balance.isAvailable ? '' : ' — account flagged unavailable'
        lines.push(
          `Balance (${entry.currency}): total ${entry.totalBalance}, granted ${entry.grantedBalance}, topped up ${entry.toppedUpBalance}${flag}`,
        )
      }
    }
  }
  return lines.join('\n')
}

export function renderOffPeak(value: OffPeakValue): string {
  // Times read in the display zone; without one configured the host sets it
  // equal to the schedule zone, so this is the same output as before.
  const zone = value.displayTimeZone ?? value.timeZone
  const lines: string[] = []
  lines.push(`🐋💤 Off-peak ×${value.offPeakMultiplier} windows (${zone}):`)
  value.windows.forEach((window, i) => {
    const start = `${window.startLocal.date} ${window.startLocal.time}`
    const end = window.endUtc === null ? 'ongoing' : localEndOf(window.endUtc, zone)
    lines.push(`  ${i + 1}. ${start} → ${end} local (${window.startUtc} → ${window.endUtc ?? '?'})`)
  })
  lines.push(value.hint)
  return lines.join('\n')
}

function localEndOf(endUtc: string, timeZone: string): string {
  const end = new Date(endUtc)
  return `${localDateInZone(end, timeZone)} ${localTimeInZone(end, timeZone)}`
}
