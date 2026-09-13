// Self-check for the pricing math: compiles src/pricing.ts to .selfcheck/
// (see the `selfcheck` npm script), then asserts a known Monday/Sunday series
// against the DeepSeekStatus rule: peak = Mon-Fri 09:00-12:00, 14:00-18:00 Beijing.
import assert from 'node:assert/strict'

import {
  classify,
  formatCountdown,
  localDateInZone,
  localTimeInZone,
  nextBoundary,
  parseWindows,
  resolvePricing,
  upcomingOffPeakWindows,
} from '../.selfcheck/pricing.js'
import { renderOffPeak, renderStatus } from '../.selfcheck/render.js'
import { liveStatus, parseWindowsInput, windowsInput } from '../.selfcheck/client/card-model.js'

const pricing = resolvePricing({
  timeZone: 'Asia/Shanghai',
  peakWindows: ['09:00-12:00', '14:00-18:00'],
  peakWeekdaysOnly: true,
  peakMultiplier: 1,
  offPeakMultiplier: 0.5,
})

// 2026-09-14 is a Monday; 2026-09-12 the Saturday before.
assert.equal(classify(new Date('2026-09-14T02:00:00Z'), pricing).period, 'peak') // Mon 10:00 +08
assert.equal(classify(new Date('2026-09-14T05:30:00Z'), pricing).period, 'off-peak') // Mon 13:30 lunch break
assert.equal(classify(new Date('2026-09-14T09:59:00Z'), pricing).period, 'peak') // Mon 17:59
assert.equal(classify(new Date('2026-09-14T10:00:00Z'), pricing).period, 'off-peak') // Mon 18:00
assert.equal(classify(new Date('2026-09-14T00:59:00Z'), pricing).period, 'off-peak') // Mon 08:59
assert.equal(classify(new Date('2026-09-14T01:00:00Z'), pricing).period, 'peak') // Mon 09:00
assert.equal(classify(new Date('2026-09-12T02:00:00Z'), pricing).period, 'off-peak') // Sat 10:00
assert.equal(classify(new Date('2026-09-13T02:00:00Z'), pricing).period, 'off-peak') // Sun 10:00
assert.equal(classify(new Date('2026-09-14T02:00:00Z'), pricing).multiplier, 1)
assert.equal(classify(new Date('2026-09-14T05:30:00Z'), pricing).multiplier, 0.5)

// Boundary scan: 08:59 -> 09:00 Beijing, and 10:00 -> 12:00 (lunch).
assert.equal(nextBoundary(new Date('2026-09-14T00:59:30Z'), pricing)?.toISOString(), '2026-09-14T01:00:00.000Z')
assert.equal(nextBoundary(new Date('2026-09-14T02:00:00Z'), pricing)?.toISOString(), '2026-09-14T04:00:00.000Z')

// Friday 18:00 Beijing starts the weekend; the next flip is Monday 09:00.
assert.equal(nextBoundary(new Date('2026-09-11T10:30:00Z'), pricing)?.toISOString(), '2026-09-14T01:00:00.000Z')

// Upcoming off-peak windows starting from Monday 10:00 Beijing (peak):
// Mon lunch 12-14, Mon 18:00 -> Tue 09:00, Tue lunch 12-14.
const windows = upcomingOffPeakWindows(new Date('2026-09-14T02:00:00Z'), pricing, 3)
assert.deepEqual(
  windows.map((w) => [w.startUtc, w.endUtc, w.durationMinutes]),
  [
    ['2026-09-14T04:00:00.000Z', '2026-09-14T06:00:00.000Z', 120],
    ['2026-09-14T10:00:00.000Z', '2026-09-15T01:00:00.000Z', 900],
    ['2026-09-15T04:00:00.000Z', '2026-09-15T06:00:00.000Z', 120],
  ],
)
assert.deepEqual(windows[0].startLocal, { date: '2026-09-14', time: '12:00', time_zone: 'Asia/Shanghai' })

// A moment already inside off-peak yields the ongoing window first.
const ongoing = upcomingOffPeakWindows(new Date('2026-09-14T05:00:00Z'), pricing, 1)
assert.equal(ongoing[0].startUtc, '2026-09-14T05:00:00.000Z')
assert.equal(ongoing[0].endUtc, '2026-09-14T06:00:00.000Z')

// Arbitrary zones work: Monday 10:00 in Berlin (CEST, +2) is peak.
const berlin = resolvePricing({
  timeZone: 'Europe/Berlin',
  peakWindows: ['09:00-12:00', '14:00-18:00'],
  peakWeekdaysOnly: true,
  peakMultiplier: 1,
  offPeakMultiplier: 0.5,
})
assert.equal(classify(new Date('2026-09-14T08:00:00Z'), berlin).period, 'peak') // 10:00 CEST
assert.equal(classify(new Date('2026-09-14T11:00:00Z'), berlin).period, 'off-peak') // 13:00 CEST

// Degenerate config: no windows at all -> always off-peak, no boundary.
const alwaysOff = resolvePricing({
  timeZone: 'UTC',
  peakWindows: [],
  peakWeekdaysOnly: false,
  peakMultiplier: 1,
  offPeakMultiplier: 0.5,
})
assert.equal(classify(new Date('2026-09-14T02:00:00Z'), alwaysOff).period, 'off-peak')
assert.equal(nextBoundary(new Date('2026-09-14T02:00:00Z'), alwaysOff), null)

// Bad window specs fail loudly at load time.
assert.throws(() => parseWindows(['9-17']), /expected 'HH:MM-HH:MM'/)
assert.throws(() => parseWindows(['14:00-09:00']), /start < end/)
assert.throws(() => parseWindows(['23:00-25:00']), /start < end/)

assert.equal(localDateInZone(new Date('2026-09-14T16:30:00Z'), 'Asia/Shanghai'), '2026-09-15')
assert.equal(localTimeInZone(new Date('2026-09-14T16:30:00Z'), 'Asia/Shanghai'), '00:30')
assert.equal(formatCountdown(3_661_000), '01:01:01')
assert.equal(formatCountdown(-5), '00:00:00')

// Rendering: peak with balance, off-peak bare, balance error, off-peak windows list.
const peakRender = renderStatus({
  isPeak: true,
  period: 'peak',
  multiplier: 1,
  nowUtc: '2026-09-14T02:23:47.000Z',
  nowLocal: '2026-09-14 10:23 (Asia/Shanghai)',
  nextSwitch: {
    atUtc: '2026-09-14T04:00:00.000Z',
    atLocal: '2026-09-14 12:00 (Asia/Shanghai)',
    becomes: 'off-peak',
    countdown: '01:36:13',
  },
  balance: {
    isAvailable: true,
    currencies: [{ currency: 'CNY', totalBalance: '42.13', grantedBalance: '0.00', toppedUpBalance: '42.13' }],
  },
})
assert.match(peakRender, /🐋 DeepSeek API: PEAK \(×1\) — 2026-09-14 10:23/)
assert.match(peakRender, /Next switch → off-peak at 2026-09-14 12:00 .* in 01:36:13/)
assert.match(peakRender, /Balance \(CNY\): total 42\.13, granted 0\.00, topped up 42\.13$/m)

assert.match(
  renderStatus({
    isPeak: false,
    period: 'off-peak',
    multiplier: 0.5,
    nowUtc: '2026-09-14T04:00:00.000Z',
    nowLocal: '2026-09-14 12:00 (Asia/Shanghai)',
    nextSwitch: null,
  }),
  /🐋💤 DeepSeek API: OFF-PEAK \(×0\.5\)/,
)

assert.match(
  renderStatus({
    isPeak: false,
    period: 'off-peak',
    multiplier: 0.5,
    nowUtc: '2026-09-14T04:00:00.000Z',
    nowLocal: '2026-09-14 12:00 (Asia/Shanghai)',
    nextSwitch: null,
    balance: { error: 'no apiKey configured - set it in the peak-whale plugin config to see balance' },
  }),
  /Balance: unavailable — no apiKey configured/,
)

const windowsRender = renderOffPeak({
  timeZone: 'Asia/Shanghai',
  offPeakMultiplier: 0.5,
  windows: [
    {
      startUtc: '2026-09-14T04:00:00.000Z',
      endUtc: '2026-09-14T06:00:00.000Z',
      durationMinutes: 120,
      startLocal: { date: '2026-09-14', time: '12:00', time_zone: 'Asia/Shanghai' },
    },
    {
      startUtc: '2026-09-14T10:00:00.000Z',
      endUtc: null,
      durationMinutes: null,
      startLocal: { date: '2026-09-14', time: '18:00', time_zone: 'Asia/Shanghai' },
    },
  ],
  hint: 'Schedule work inside a window with schedule_create.',
})
assert.match(windowsRender, /🐋💤 Off-peak ×0\.5 windows \(Asia\/Shanghai\)/)
assert.match(windowsRender, /1\. 2026-09-14 12:00 → 2026-09-14 14:00 local \(2026-09-14T04:00:00\.000Z → 2026-09-14T06:00:00\.000Z\)/)
assert.match(windowsRender, /2\. 2026-09-14 18:00 → ongoing local/)
assert.match(windowsRender, /Schedule work inside a window/)

// Settings-card model: live status view and windows form input handling.
const snapshot = {
  timeZone: 'Asia/Shanghai',
  peakWindows: ['09:00-12:00', '14:00-18:00'],
  peakWeekdaysOnly: true,
  peakMultiplier: 1,
  offPeakMultiplier: 0.5,
}
const cardStatus = liveStatus(new Date('2026-09-14T02:00:00Z'), snapshot)
assert.equal(cardStatus.ok, true)
assert.equal(cardStatus.isPeak, true)
assert.equal(cardStatus.becomes, 'off-peak')
assert.equal(cardStatus.nextLocalTime, '12:00')
assert.match(cardStatus.countdown, /^\d{2}:\d{2}:\d{2}$/)
assert.equal(cardStatus.countdown, '02:00:00') // Mon 10:00:00 -> 12:00:00
const badZone = liveStatus(new Date('2026-09-14T02:00:00Z'), { ...snapshot, timeZone: 'Not/AZone' })
assert.equal(badZone.ok, false)
assert.match(badZone.error, /time zone/i)
const parsedWindows = parseWindowsInput('09:00-12:00, 14:00-18:00')
assert.deepEqual(parsedWindows, { ok: true, windows: ['09:00-12:00', '14:00-18:00'] })
assert.equal(parseWindowsInput('25:00-26:00').ok, false)
assert.match(parseWindowsInput('12:00-09:00').error, /start < end/)
assert.equal(windowsInput(['09:00-12:00', '14:00-18:00']), '09:00-12:00, 14:00-18:00')

console.log('selfcheck: all pricing assertions passed')
