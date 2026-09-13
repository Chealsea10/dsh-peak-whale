/**
 * Time-zone choices for the pickers. A free-text IANA field is the wrong
 * affordance: the common answer for most users is "the one I am in", and a typo
 * only surfaces later as a failed pricing resolve.
 */

/** One selectable zone. */
export interface ZoneChoice {
  /** IANA identifier, e.g. `Europe/Moscow`. */
  id: string
  /** Human label, localized at render time. */
  label: Record<'en' | 'ru' | 'zh', string>
}

/**
 * Curated zones. DeepSeek's own peak schedule is quoted in Beijing time, so
 * `Asia/Shanghai` heads the list; `Europe/Moscow` is included because the
 * plugin's first users are there. The browser's own zone and a custom IANA
 * entry are appended at render time.
 */
export const ZONE_CHOICES: readonly ZoneChoice[] = [
  { id: 'Europe/Moscow', label: { en: 'Moscow', ru: 'Москва', zh: '莫斯科' } },
  { id: 'Asia/Shanghai', label: { en: 'Beijing', ru: 'Пекин', zh: '北京' } },
  { id: 'UTC', label: { en: 'UTC', ru: 'UTC', zh: 'UTC' } },
  { id: 'Europe/London', label: { en: 'London', ru: 'Лондон', zh: '伦敦' } },
  { id: 'Europe/Berlin', label: { en: 'Berlin', ru: 'Берлин', zh: '柏林' } },
  { id: 'Europe/Kyiv', label: { en: 'Kyiv', ru: 'Киев', zh: '基辅' } },
  { id: 'Asia/Yerevan', label: { en: 'Yerevan', ru: 'Ереван', zh: '埃里温' } },
  { id: 'Asia/Tbilisi', label: { en: 'Tbilisi', ru: 'Тбилиси', zh: '第比利斯' } },
  { id: 'Asia/Dubai', label: { en: 'Dubai', ru: 'Дубай', zh: '迪拜' } },
  { id: 'Asia/Almaty', label: { en: 'Almaty', ru: 'Алматы', zh: '阿拉木图' } },
  { id: 'Asia/Yekaterinburg', label: { en: 'Yekaterinburg', ru: 'Екатеринбург', zh: '叶卡捷琳堡' } },
  { id: 'Asia/Novosibirsk', label: { en: 'Novosibirsk', ru: 'Новосибирск', zh: '新西伯利亚' } },
  { id: 'Asia/Vladivostok', label: { en: 'Vladivostok', ru: 'Владивосток', zh: '符拉迪沃斯托克' } },
  { id: 'Asia/Tokyo', label: { en: 'Tokyo', ru: 'Токио', zh: '东京' } },
  { id: 'Asia/Singapore', label: { en: 'Singapore', ru: 'Сингапур', zh: '新加坡' } },
  { id: 'Asia/Kolkata', label: { en: 'Kolkata', ru: 'Калькутта', zh: '加尔各答' } },
  { id: 'America/New_York', label: { en: 'New York', ru: 'Нью-Йорк', zh: '纽约' } },
  { id: 'America/Los_Angeles', label: { en: 'Los Angeles', ru: 'Лос-Анджелес', zh: '洛杉矶' } },
]

/** Sentinel value of the "type an IANA name" entry. */
export const CUSTOM_ZONE = '__custom__'

/** Whether a zone identifier is one `Intl` accepts. */
export function isValidZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-US', { timeZone: zone })
    return true
  } catch {
    return false
  }
}

/** The browser's own zone, or `UTC` when unavailable (SSR-less, but be safe). */
export function browserZone(): string {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone
    return zone && isValidZone(zone) ? zone : 'UTC'
  } catch {
    return 'UTC'
  }
}

/**
 * Current UTC offset of a zone, e.g. `UTC+03:00`, for display beside a label.
 * @param zone - IANA identifier.
 * @param at - instant to evaluate the offset at (DST-correct).
 * @returns the offset label, or `''` when the zone is unusable.
 */
export function zoneOffsetLabel(zone: string, at: Date): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: zone, timeZoneName: 'longOffset' }).formatToParts(at)
    const name = parts.find((part) => part.type === 'timeZoneName')?.value ?? ''
    return name.replace(/^GMT/, 'UTC')
  } catch {
    return ''
  }
}
