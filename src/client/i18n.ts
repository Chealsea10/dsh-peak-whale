/**
 * Locale selection for the browser half.
 *
 * The card/chip copy is our own: we do not register a locale namespace, so the
 * slot `t` seat would only echo keys back. The browser's language is the honest
 * source, and it keeps the plugin free of a locale-service dependency.
 */

/** The three languages this plugin speaks. */
export type Locale = 'en' | 'ru' | 'zh'

/** Pick a supported locale from the browser, defaulting to English. */
export function pickLocale(): Locale {
  const language = typeof navigator === 'undefined' ? '' : (navigator.language ?? '').toLowerCase()
  if (language.startsWith('ru')) return 'ru'
  if (language.startsWith('zh')) return 'zh'
  return 'en'
}

/** Choose one of three translations. */
export function tr<T>(locale: Locale, values: Record<Locale, T>): T {
  return values[locale]
}
