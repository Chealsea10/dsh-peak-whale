/**
 * Peak/off-peak pricing math for the DeepSeek API.
 *
 * Default rule (as popularised by the DeepSeekStatus menu bar app):
 *   peak = Mon-Fri 09:00-12:00 and 14:00-18:00, Beijing time;
 *   everything else (nights, weekends, the lunch break) is half price.
 * Chinese public holidays are NOT accounted for.
 *
 * All functions take UTC instants; wall-clock time is derived through Intl,
 * so any IANA time zone works, DST shifts included.
 */
const MINUTE = 60_000;
/** A weekly pattern always flips within 7 days; 8 covers DST edge cases. */
const SCAN_HORIZON_MINUTES = 8 * 24 * 60;
export function parseWindows(specs) {
    return specs.map((spec, i) => {
        const match = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(spec.trim());
        if (!match)
            throw new Error(`peakWindows[${i}]: expected 'HH:MM-HH:MM', got '${spec}'`);
        const [, sh, sm, eh, em] = match;
        const startMinute = Number(sh) * 60 + Number(sm);
        const endMinute = Number(eh) * 60 + Number(em);
        if (startMinute >= endMinute || endMinute > 24 * 60) {
            throw new Error(`peakWindows[${i}]: '${spec}' must be a within-day window with start < end`);
        }
        return { startMinute, endMinute };
    });
}
/** Validates the zone and window specs, so bad config fails the plugin load with an actionable error. */
export function resolvePricing(config) {
    try {
        new Intl.DateTimeFormat('en-US', { timeZone: config.timeZone });
    }
    catch {
        throw new Error(`timeZone: '${config.timeZone}' is not a valid IANA time zone`);
    }
    const display = (config.displayTimeZone ?? '').trim();
    if (display.length > 0) {
        try {
            new Intl.DateTimeFormat('en-US', { timeZone: display });
        }
        catch {
            throw new Error(`displayTimeZone: '${display}' is not a valid IANA time zone`);
        }
    }
    return {
        ...config,
        displayTimeZone: display.length > 0 ? display : config.timeZone,
        windows: parseWindows(config.peakWindows),
    };
}
const wallClockFormatters = new Map();
function wallClockFormatter(timeZone) {
    let formatter = wallClockFormatters.get(timeZone);
    if (!formatter) {
        formatter = new Intl.DateTimeFormat('en-US', {
            timeZone,
            weekday: 'short',
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
        });
        wallClockFormatters.set(timeZone, formatter);
    }
    return formatter;
}
const WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
export function wallClockInZone(instant, timeZone) {
    const parts = wallClockFormatter(timeZone).formatToParts(instant);
    let weekday = -1;
    let hour = -1;
    let minute = -1;
    for (const part of parts) {
        if (part.type === 'weekday')
            weekday = WEEKDAY_INDEX[part.value] ?? -1;
        else if (part.type === 'hour')
            hour = Number(part.value);
        else if (part.type === 'minute')
            minute = Number(part.value);
    }
    if (weekday < 0 || hour < 0 || minute < 0)
        throw new Error(`unknown IANA time zone '${timeZone}'`);
    return { weekday, minuteOfDay: hour * 60 + minute };
}
export function classify(instant, pricing) {
    // The SCHEDULE zone, never the display zone: the tariff is judged where
    // DeepSeek publishes its windows, regardless of where the user reads it.
    const { weekday, minuteOfDay } = wallClockInZone(instant, pricing.timeZone);
    const weekdayPeak = !pricing.peakWeekdaysOnly || (weekday >= 1 && weekday <= 5);
    const inWindow = weekdayPeak &&
        pricing.windows.some((w) => minuteOfDay >= w.startMinute && minuteOfDay < w.endMinute);
    return inWindow
        ? { isPeak: true, period: 'peak', multiplier: pricing.peakMultiplier }
        : { isPeak: false, period: 'off-peak', multiplier: pricing.offPeakMultiplier };
}
/**
 * The next instant (minute-aligned, strictly after `instant`) where the period flips,
 * or null if the config produces an unchanging period for a full week.
 */
export function nextBoundary(instant, pricing) {
    const startIsPeak = classify(instant, pricing).isPeak;
    const cursor = new Date(Math.floor(instant.getTime() / MINUTE) * MINUTE + MINUTE);
    for (let i = 0; i < SCAN_HORIZON_MINUTES; i++) {
        if (classify(cursor, pricing).isPeak !== startIsPeak)
            return cursor;
        cursor.setTime(cursor.getTime() + MINUTE);
    }
    return null;
}
const dateFormatters = new Map();
const timeFormatters = new Map();
/** 'YYYY-MM-DD' in the zone (en-CA yields ISO ordering). */
export function localDateInZone(instant, timeZone) {
    let formatter = dateFormatters.get(timeZone);
    if (!formatter) {
        formatter = new Intl.DateTimeFormat('en-CA', {
            timeZone,
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
        });
        dateFormatters.set(timeZone, formatter);
    }
    return formatter.format(instant);
}
/** 'HH:MM' in the zone. */
export function localTimeInZone(instant, timeZone) {
    let formatter = timeFormatters.get(timeZone);
    if (!formatter) {
        formatter = new Intl.DateTimeFormat('en-GB', {
            timeZone,
            hour: '2-digit',
            minute: '2-digit',
            hourCycle: 'h23',
        });
        timeFormatters.set(timeZone, formatter);
    }
    return formatter.format(instant);
}
function makeWindow(start, end, timeZone) {
    return {
        startUtc: start.toISOString(),
        endUtc: end === null ? null : end.toISOString(),
        durationMinutes: end === null ? null : Math.round((end.getTime() - start.getTime()) / MINUTE),
        startLocal: { date: localDateInZone(start, timeZone), time: localTimeInZone(start, timeZone), time_zone: timeZone },
    };
}
/**
 * The next `count` off-peak windows as UTC intervals. The window containing
 * `instant` (if any) starts at `instant` itself, so it is immediately actionable.
 */
export function upcomingOffPeakWindows(instant, pricing, count) {
    const windows = [];
    let runStart = classify(instant, pricing).isPeak ? null : new Date(instant.getTime());
    const cursor = new Date(Math.floor(instant.getTime() / MINUTE) * MINUTE + MINUTE);
    for (let i = 0; i < SCAN_HORIZON_MINUTES && windows.length < count; i++) {
        const isPeak = classify(cursor, pricing).isPeak;
        if (!isPeak && runStart === null)
            runStart = new Date(cursor.getTime());
        if (isPeak && runStart !== null) {
            windows.push(makeWindow(runStart, new Date(cursor.getTime()), pricing.displayTimeZone));
            runStart = null;
        }
        cursor.setTime(cursor.getTime() + MINUTE);
    }
    if (runStart !== null && windows.length < count) {
        windows.push(makeWindow(runStart, null, pricing.displayTimeZone));
    }
    return windows;
}
export function formatCountdown(ms) {
    const total = Math.max(0, Math.round(ms / 1000));
    const hours = Math.floor(total / 3600);
    const minutes = Math.floor((total % 3600) / 60);
    const seconds = total % 60;
    const pad = (n) => String(n).padStart(2, '0');
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}
