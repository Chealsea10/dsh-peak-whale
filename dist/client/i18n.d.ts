/**
 * Locale selection for the browser half.
 *
 * The card/chip copy is our own: we do not register a locale namespace, so the
 * slot `t` seat would only echo keys back. The browser's language is the honest
 * source, and it keeps the plugin free of a locale-service dependency.
 */
/** The three languages this plugin speaks. */
export type Locale = 'en' | 'ru' | 'zh';
/** Pick a supported locale from the browser, defaulting to English. */
export declare function pickLocale(): Locale;
/** Choose one of three translations. */
export declare function tr<T>(locale: Locale, values: Record<Locale, T>): T;
