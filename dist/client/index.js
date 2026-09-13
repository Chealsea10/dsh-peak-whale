window.__ModuleLoader__.load({
	id: "dsh-peak-whale",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);

// src/client/index.ts
var index_exports = {};
__export(index_exports, {
  CARD_SLOT: () => CARD_SLOT,
  CHIP_SLOT: () => CHIP_SLOT,
  NAMESPACE: () => NAMESPACE,
  apply: () => apply,
  inject: () => inject
});
module.exports = __toCommonJS(index_exports);

// src/client/peak-whale-card.tsx
var import_react2 = require("react");

// src/pricing.ts
var MINUTE = 6e4;
var SCAN_HORIZON_MINUTES = 8 * 24 * 60;
function parseWindows(specs) {
  return specs.map((spec, i) => {
    const match = /^(\d{1,2}):(\d{2})\s*-\s*(\d{1,2}):(\d{2})$/.exec(spec.trim());
    if (!match) throw new Error(`peakWindows[${i}]: expected 'HH:MM-HH:MM', got '${spec}'`);
    const [, sh, sm, eh, em] = match;
    const startMinute = Number(sh) * 60 + Number(sm);
    const endMinute = Number(eh) * 60 + Number(em);
    if (startMinute >= endMinute || endMinute > 24 * 60) {
      throw new Error(`peakWindows[${i}]: '${spec}' must be a within-day window with start < end`);
    }
    return { startMinute, endMinute };
  });
}
function resolvePricing(config) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: config.timeZone });
  } catch {
    throw new Error(`timeZone: '${config.timeZone}' is not a valid IANA time zone`);
  }
  const display = (config.displayTimeZone ?? "").trim();
  if (display.length > 0) {
    try {
      new Intl.DateTimeFormat("en-US", { timeZone: display });
    } catch {
      throw new Error(`displayTimeZone: '${display}' is not a valid IANA time zone`);
    }
  }
  return {
    ...config,
    displayTimeZone: display.length > 0 ? display : config.timeZone,
    windows: parseWindows(config.peakWindows)
  };
}
var wallClockFormatters = /* @__PURE__ */ new Map();
function wallClockFormatter(timeZone) {
  let formatter = wallClockFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-US", {
      timeZone,
      weekday: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    });
    wallClockFormatters.set(timeZone, formatter);
  }
  return formatter;
}
var WEEKDAY_INDEX = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
function wallClockInZone(instant, timeZone) {
  const parts = wallClockFormatter(timeZone).formatToParts(instant);
  let weekday = -1;
  let hour = -1;
  let minute = -1;
  for (const part of parts) {
    if (part.type === "weekday") weekday = WEEKDAY_INDEX[part.value] ?? -1;
    else if (part.type === "hour") hour = Number(part.value);
    else if (part.type === "minute") minute = Number(part.value);
  }
  if (weekday < 0 || hour < 0 || minute < 0) throw new Error(`unknown IANA time zone '${timeZone}'`);
  return { weekday, minuteOfDay: hour * 60 + minute };
}
function classify(instant, pricing) {
  const { weekday, minuteOfDay } = wallClockInZone(instant, pricing.timeZone);
  const weekdayPeak = !pricing.peakWeekdaysOnly || weekday >= 1 && weekday <= 5;
  const inWindow = weekdayPeak && pricing.windows.some((w) => minuteOfDay >= w.startMinute && minuteOfDay < w.endMinute);
  return inWindow ? { isPeak: true, period: "peak", multiplier: pricing.peakMultiplier } : { isPeak: false, period: "off-peak", multiplier: pricing.offPeakMultiplier };
}
function nextBoundary(instant, pricing) {
  const startIsPeak = classify(instant, pricing).isPeak;
  const cursor = new Date(Math.floor(instant.getTime() / MINUTE) * MINUTE + MINUTE);
  for (let i = 0; i < SCAN_HORIZON_MINUTES; i++) {
    if (classify(cursor, pricing).isPeak !== startIsPeak) return cursor;
    cursor.setTime(cursor.getTime() + MINUTE);
  }
  return null;
}
var dateFormatters = /* @__PURE__ */ new Map();
var timeFormatters = /* @__PURE__ */ new Map();
function localDateInZone(instant, timeZone) {
  let formatter = dateFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit"
    });
    dateFormatters.set(timeZone, formatter);
  }
  return formatter.format(instant);
}
function localTimeInZone(instant, timeZone) {
  let formatter = timeFormatters.get(timeZone);
  if (!formatter) {
    formatter = new Intl.DateTimeFormat("en-GB", {
      timeZone,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23"
    });
    timeFormatters.set(timeZone, formatter);
  }
  return formatter.format(instant);
}
function formatCountdown(ms) {
  const total = Math.max(0, Math.round(ms / 1e3));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor(total % 3600 / 60);
  const seconds = total % 60;
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

// src/client/balance-client.ts
var cache = null;
var BALANCE_TTL_MS = 6e4;
async function readBalance(apiBase, apiKey, signal, force = false) {
  const cacheKey = `${apiBase}|${apiKey}`;
  if (!force && cache !== null && cache.key === cacheKey && Date.now() - cache.at < BALANCE_TTL_MS) {
    return cache.state;
  }
  const state = await request(apiBase, apiKey, signal);
  cache = { key: cacheKey, at: Date.now(), state };
  return state;
}
async function request(apiBase, apiKey, signal) {
  const url = `${apiBase.replace(/\/+$/, "")}/user/balance`;
  try {
    const response = await fetch(url, {
      headers: { Authorization: `Bearer ${apiKey}`, Accept: "application/json" },
      signal
    });
    if (response.status === 401) {
      return { status: "error", error: "HTTP 401 \u2014 \u043A\u043B\u044E\u0447 \u043E\u0442\u043A\u043B\u043E\u043D\u0451\u043D", at: Date.now() };
    }
    if (!response.ok) {
      return { status: "error", error: `HTTP ${response.status}`, at: Date.now() };
    }
    const body = await response.json();
    return {
      status: "ok",
      at: Date.now(),
      snapshot: {
        isAvailable: body.is_available === true,
        currencies: (body.balance_infos ?? []).map((info) => ({
          currency: info.currency ?? "CNY",
          totalBalance: info.total_balance ?? "?",
          grantedBalance: info.granted_balance ?? "?",
          toppedUpBalance: info.topped_up_balance ?? "?"
        }))
      }
    };
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") return { status: "idle" };
    return {
      status: "error",
      error: error instanceof Error ? error.message : String(error),
      at: Date.now()
    };
  }
}

// src/client/timezones.ts
var ZONE_CHOICES = [
  { id: "Europe/Moscow", label: { en: "Moscow", ru: "\u041C\u043E\u0441\u043A\u0432\u0430", zh: "\u83AB\u65AF\u79D1" } },
  { id: "Asia/Shanghai", label: { en: "Beijing", ru: "\u041F\u0435\u043A\u0438\u043D", zh: "\u5317\u4EAC" } },
  { id: "UTC", label: { en: "UTC", ru: "UTC", zh: "UTC" } },
  { id: "Europe/London", label: { en: "London", ru: "\u041B\u043E\u043D\u0434\u043E\u043D", zh: "\u4F26\u6566" } },
  { id: "Europe/Berlin", label: { en: "Berlin", ru: "\u0411\u0435\u0440\u043B\u0438\u043D", zh: "\u67CF\u6797" } },
  { id: "Europe/Kyiv", label: { en: "Kyiv", ru: "\u041A\u0438\u0435\u0432", zh: "\u57FA\u8F85" } },
  { id: "Asia/Yerevan", label: { en: "Yerevan", ru: "\u0415\u0440\u0435\u0432\u0430\u043D", zh: "\u57C3\u91CC\u6E29" } },
  { id: "Asia/Tbilisi", label: { en: "Tbilisi", ru: "\u0422\u0431\u0438\u043B\u0438\u0441\u0438", zh: "\u7B2C\u6BD4\u5229\u65AF" } },
  { id: "Asia/Dubai", label: { en: "Dubai", ru: "\u0414\u0443\u0431\u0430\u0439", zh: "\u8FEA\u62DC" } },
  { id: "Asia/Almaty", label: { en: "Almaty", ru: "\u0410\u043B\u043C\u0430\u0442\u044B", zh: "\u963F\u62C9\u6728\u56FE" } },
  { id: "Asia/Yekaterinburg", label: { en: "Yekaterinburg", ru: "\u0415\u043A\u0430\u0442\u0435\u0440\u0438\u043D\u0431\u0443\u0440\u0433", zh: "\u53F6\u5361\u6377\u7433\u5821" } },
  { id: "Asia/Novosibirsk", label: { en: "Novosibirsk", ru: "\u041D\u043E\u0432\u043E\u0441\u0438\u0431\u0438\u0440\u0441\u043A", zh: "\u65B0\u897F\u4F2F\u5229\u4E9A" } },
  { id: "Asia/Vladivostok", label: { en: "Vladivostok", ru: "\u0412\u043B\u0430\u0434\u0438\u0432\u043E\u0441\u0442\u043E\u043A", zh: "\u7B26\u62C9\u8FEA\u6C83\u65AF\u6258\u514B" } },
  { id: "Asia/Tokyo", label: { en: "Tokyo", ru: "\u0422\u043E\u043A\u0438\u043E", zh: "\u4E1C\u4EAC" } },
  { id: "Asia/Singapore", label: { en: "Singapore", ru: "\u0421\u0438\u043D\u0433\u0430\u043F\u0443\u0440", zh: "\u65B0\u52A0\u5761" } },
  { id: "Asia/Kolkata", label: { en: "Kolkata", ru: "\u041A\u0430\u043B\u044C\u043A\u0443\u0442\u0442\u0430", zh: "\u52A0\u5C14\u5404\u7B54" } },
  { id: "America/New_York", label: { en: "New York", ru: "\u041D\u044C\u044E-\u0419\u043E\u0440\u043A", zh: "\u7EBD\u7EA6" } },
  { id: "America/Los_Angeles", label: { en: "Los Angeles", ru: "\u041B\u043E\u0441-\u0410\u043D\u0434\u0436\u0435\u043B\u0435\u0441", zh: "\u6D1B\u6749\u77F6" } }
];
var CUSTOM_ZONE = "__custom__";
function isValidZone(zone) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}
function browserZone() {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone && isValidZone(zone) ? zone : "UTC";
  } catch {
    return "UTC";
  }
}
function zoneOffsetLabel(zone, at) {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName: "longOffset" }).formatToParts(at);
    const name = parts.find((part) => part.type === "timeZoneName")?.value ?? "";
    return name.replace(/^GMT/, "UTC");
  } catch {
    return "";
  }
}

// src/client/card-model.ts
function resolveDisplayZone(snapshot) {
  const configured = (snapshot.displayTimeZone ?? "").trim();
  if (configured.length > 0) return configured;
  const own = browserZone();
  return own.length > 0 ? own : snapshot.timeZone;
}
function liveStatus(now, snapshot) {
  let pricing;
  try {
    pricing = resolvePricing(snapshot);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  const period = classify(now, pricing);
  const boundary = nextBoundary(now, pricing);
  return {
    ok: true,
    isPeak: period.isPeak,
    period: period.period,
    multiplier: period.multiplier,
    countdown: boundary === null ? null : formatCountdown(boundary.getTime() - now.getTime()),
    becomes: boundary === null ? null : classify(boundary, pricing).period,
    nextLocalTime: boundary === null ? null : localTimeInZone(boundary, pricing.displayTimeZone),
    displayTimeZone: pricing.displayTimeZone,
    timeZone: pricing.timeZone
  };
}
function parseWindowsInput(input) {
  const windows = input.split(",").map((part) => part.trim()).filter((part) => part.length > 0);
  try {
    parseWindows(windows);
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
  return { ok: true, windows };
}
function windowsInput(windows) {
  return windows.join(", ");
}

// src/client/i18n.ts
function pickLocale() {
  const language = typeof navigator === "undefined" ? "" : (navigator.language ?? "").toLowerCase();
  if (language.startsWith("ru")) return "ru";
  if (language.startsWith("zh")) return "zh";
  return "en";
}

// src/client/use-scope.ts
var import_react = require("react");
function useSettingsSnapshot(scope) {
  const [snapshot, setSnapshot] = (0, import_react.useState)(
    () => scope.getSnapshot()
  );
  (0, import_react.useEffect)(() => {
    setSnapshot(scope.getSnapshot());
    return scope.subscribe(() => setSnapshot(scope.getSnapshot()));
  }, [scope]);
  return snapshot;
}
function useNow(intervalMs = 1e3) {
  const [now, setNow] = (0, import_react.useState)(() => /* @__PURE__ */ new Date());
  (0, import_react.useEffect)(() => {
    const timer = window.setInterval(() => setNow(/* @__PURE__ */ new Date()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

// src/client/zone-select.tsx
var import_jsx_runtime = require("react/jsx-runtime");
var LABELS = {
  en: { zone: "Time zone", auto: "Local (auto)", custom: "Other (IANA)\u2026", invalid: "Unknown IANA zone" },
  ru: { zone: "\u0422\u0430\u0439\u043C\u0437\u043E\u043D\u0430", auto: "\u041B\u043E\u043A\u0430\u043B\u044C\u043D\u0430\u044F (\u0430\u0432\u0442\u043E)", custom: "\u0414\u0440\u0443\u0433\u0430\u044F (IANA)\u2026", invalid: "\u041D\u0435\u0438\u0437\u0432\u0435\u0441\u0442\u043D\u0430\u044F IANA-\u0437\u043E\u043D\u0430" },
  zh: { zone: "\u65F6\u533A", auto: "\u672C\u5730\uFF08\u81EA\u52A8\uFF09", custom: "\u5176\u4ED6\uFF08IANA\uFF09\u2026", invalid: "\u672A\u77E5\u7684 IANA \u65F6\u533A" }
};
var selectStyle = {
  font: "inherit",
  color: "inherit",
  background: "transparent",
  border: "1px solid rgba(127,127,127,0.4)",
  borderRadius: 8,
  padding: "4px 6px",
  maxWidth: "100%"
};
var inputStyle = {
  ...selectStyle,
  padding: "4px 8px",
  width: "100%",
  boxSizing: "border-box"
};
function ZoneSelect(props) {
  const locale = pickLocale();
  const t = LABELS[locale];
  const own = browserZone();
  const known = ZONE_CHOICES.some((choice) => choice.id === props.value);
  const custom = !known;
  const options = [];
  if (!ZONE_CHOICES.some((choice) => choice.id === own)) {
    options.push({ id: own, label: `${t.auto} \u2014 ${own}` });
  }
  for (const choice of ZONE_CHOICES) {
    const offset = zoneOffsetLabel(choice.id, props.now);
    options.push({ id: choice.id, label: `${choice.label[locale]} \xB7 ${offset}` });
  }
  options.push({ id: CUSTOM_ZONE, label: t.custom });
  const control = /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
    "select",
    {
      style: selectStyle,
      disabled: props.disabled,
      value: custom ? CUSTOM_ZONE : props.value,
      onChange: (event) => {
        if (event.target.value !== CUSTOM_ZONE) props.onChange(event.target.value);
      },
      children: options.map((option) => /* @__PURE__ */ (0, import_jsx_runtime.jsx)("option", { value: option.id, children: option.label }, option.id))
    }
  );
  if (!props.withLabel) {
    return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      control,
      custom ? /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "input",
        {
          type: "text",
          style: inputStyle,
          disabled: props.disabled,
          defaultValue: props.value,
          onBlur: (event) => {
            const next = event.target.value.trim();
            if (next.length > 0 && isValidZone(next)) props.onChange(next);
          }
        },
        props.value
      ) : null
    ] });
  }
  return /* @__PURE__ */ (0, import_jsx_runtime.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: 4 }, children: [
    /* @__PURE__ */ (0, import_jsx_runtime.jsx)("label", { children: t.zone }),
    control,
    custom ? /* @__PURE__ */ (0, import_jsx_runtime.jsxs)(import_jsx_runtime.Fragment, { children: [
      /* @__PURE__ */ (0, import_jsx_runtime.jsx)(
        "input",
        {
          type: "text",
          style: inputStyle,
          disabled: props.disabled,
          defaultValue: props.value,
          onBlur: (event) => {
            const next = event.target.value.trim();
            if (next.length > 0 && isValidZone(next)) props.onChange(next);
          }
        },
        props.value
      ),
      isValidZone(props.value) ? null : /* @__PURE__ */ (0, import_jsx_runtime.jsx)("span", { style: { color: "#d64545", fontSize: "0.85em" }, children: t.invalid })
    ] }) : null
  ] });
}

// src/client/peak-whale-card.tsx
var import_jsx_runtime2 = require("react/jsx-runtime");
var DEFAULT_API_BASE = "https://api.deepseek.com";
var STRINGS = {
  en: {
    subtitle: "DeepSeek API peak / half-price off-peak awareness.",
    peak: "PEAK",
    offPeak: "OFF-PEAK",
    nextSwitch: "Next switch \u2192",
    now: "Now",
    displayZone: "Show times in",
    scheduleZone: "DeepSeek schedule zone",
    scheduleZoneHint: "The schedule zone is where DeepSeek publishes its peak hours (Beijing). Changing it changes which hours count as peak \u2014 use the display zone above to read times in your own clock.",
    peakWindows: "Peak windows (HH:MM-HH:MM, comma-separated)",
    peakWeekdaysOnly: "Peak on weekdays only (Mon\u2013Fri)",
    peakMultiplier: "Peak multiplier",
    offPeakMultiplier: "Off-peak multiplier",
    apiKey: "DeepSeek API key \u2014 enables the balance",
    overridden: "overridden",
    reset: "reset",
    apply: "apply",
    invalidWindows: "Invalid windows \u2014 not saved",
    loading: "Loading the peak-whale settings\u2026",
    unavailable: "The peak-whale settings namespace is not served by this deployment.",
    readOnly: "This connection keeps preferences process-local \u2014 the fields are read-only.",
    balance: "Balance",
    refresh: "refresh",
    balanceHint: "Add a DeepSeek API key to see the account balance here and in the composer chip.",
    toolsHint: "The whale also sits in the composer row: click it for the zone picker and the balance. The agent answers via deepseek_peak_status and can schedule work into half-price windows with deepseek_next_offpeak."
  },
  ru: {
    subtitle: "\u041F\u0438\u043A\u043E\u0432\u044B\u0435 \u0438 \u043F\u043E\u043B\u0446\u0435\u043D\u044B (off-peak) \u0442\u0430\u0440\u0438\u0444\u044B DeepSeek API.",
    peak: "\u041F\u0418\u041A",
    offPeak: "OFF-PEAK",
    nextSwitch: "\u041F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u0435 \u2192",
    now: "\u0421\u0435\u0439\u0447\u0430\u0441",
    displayZone: "\u041F\u043E\u043A\u0430\u0437\u044B\u0432\u0430\u0442\u044C \u0432\u0440\u0435\u043C\u044F \u0432",
    scheduleZone: "\u0417\u043E\u043D\u0430 \u0440\u0430\u0441\u043F\u0438\u0441\u0430\u043D\u0438\u044F DeepSeek",
    scheduleZoneHint: "\u0417\u043E\u043D\u0430 \u0440\u0430\u0441\u043F\u0438\u0441\u0430\u043D\u0438\u044F \u2014 \u0442\u0430, \u0432 \u043A\u043E\u0442\u043E\u0440\u043E\u0439 DeepSeek \u043F\u0443\u0431\u043B\u0438\u043A\u0443\u0435\u0442 \u043F\u0438\u043A\u043E\u0432\u044B\u0435 \u0447\u0430\u0441\u044B (\u041F\u0435\u043A\u0438\u043D). \u0415\u0451 \u0438\u0437\u043C\u0435\u043D\u0435\u043D\u0438\u0435 \u043C\u0435\u043D\u044F\u0435\u0442 \u0438 \u0442\u043E, \u043A\u0430\u043A\u0438\u0435 \u0447\u0430\u0441\u044B \u0441\u0447\u0438\u0442\u0430\u044E\u0442\u0441\u044F \u043F\u0438\u043A\u043E\u0432\u044B\u043C\u0438: \u0447\u0442\u043E\u0431\u044B \u0432\u0438\u0434\u0435\u0442\u044C \u0441\u0432\u043E\u0451 \u0432\u0440\u0435\u043C\u044F, \u0438\u0441\u043F\u043E\u043B\u044C\u0437\u0443\u0439\u0442\u0435 \u0437\u043E\u043D\u0443 \u043F\u043E\u043A\u0430\u0437\u0430 \u0432\u044B\u0448\u0435.",
    peakWindows: "\u041F\u0438\u043A\u043E\u0432\u044B\u0435 \u043E\u043A\u043D\u0430 (\u0427\u0427:\u041C\u041C-\u0427\u0427:\u041C\u041C, \u0447\u0435\u0440\u0435\u0437 \u0437\u0430\u043F\u044F\u0442\u0443\u044E)",
    peakWeekdaysOnly: "\u041F\u0438\u043A \u0442\u043E\u043B\u044C\u043A\u043E \u043F\u043E \u0431\u0443\u0434\u043D\u044F\u043C (\u043F\u043D\u2013\u043F\u0442)",
    peakMultiplier: "\u041C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044C \u043F\u0438\u043A\u0430",
    offPeakMultiplier: "\u041C\u043D\u043E\u0436\u0438\u0442\u0435\u043B\u044C off-peak",
    apiKey: "\u041A\u043B\u044E\u0447 DeepSeek API \u2014 \u0432\u043A\u043B\u044E\u0447\u0430\u0435\u0442 \u043F\u043E\u043A\u0430\u0437 \u0431\u0430\u043B\u0430\u043D\u0441\u0430",
    overridden: "\u043F\u0435\u0440\u0435\u043E\u043F\u0440\u0435\u0434\u0435\u043B\u0435\u043D\u043E",
    reset: "\u0441\u0431\u0440\u043E\u0441",
    apply: "\u043F\u0440\u0438\u043C\u0435\u043D\u0438\u0442\u044C",
    invalidWindows: "\u041D\u0435\u043A\u043E\u0440\u0440\u0435\u043A\u0442\u043D\u044B\u0435 \u043E\u043A\u043D\u0430 \u2014 \u043D\u0435 \u0441\u043E\u0445\u0440\u0430\u043D\u0435\u043D\u043E",
    loading: "\u0417\u0430\u0433\u0440\u0443\u0437\u043A\u0430 \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043A peak-whale\u2026",
    unavailable: "\u041F\u0440\u043E\u0441\u0442\u0440\u0430\u043D\u0441\u0442\u0432\u043E \u043D\u0430\u0441\u0442\u0440\u043E\u0435\u043A peak-whale \u043D\u0435 \u043E\u0431\u0441\u043B\u0443\u0436\u0438\u0432\u0430\u0435\u0442\u0441\u044F \u044D\u0442\u0438\u043C \u0440\u0430\u0437\u0432\u0451\u0440\u0442\u044B\u0432\u0430\u043D\u0438\u0435\u043C.",
    readOnly: "\u042D\u0442\u043E \u0441\u043E\u0435\u0434\u0438\u043D\u0435\u043D\u0438\u0435 \u0445\u0440\u0430\u043D\u0438\u0442 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0438 \u043B\u043E\u043A\u0430\u043B\u044C\u043D\u043E \u0432 \u043F\u0440\u043E\u0446\u0435\u0441\u0441\u0435 \u2014 \u043F\u043E\u043B\u044F \u0442\u043E\u043B\u044C\u043A\u043E \u0434\u043B\u044F \u0447\u0442\u0435\u043D\u0438\u044F.",
    balance: "\u0411\u0430\u043B\u0430\u043D\u0441",
    refresh: "\u043E\u0431\u043D\u043E\u0432\u0438\u0442\u044C",
    balanceHint: "\u0414\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u043A\u043B\u044E\u0447 DeepSeek API, \u0447\u0442\u043E\u0431\u044B \u0432\u0438\u0434\u0435\u0442\u044C \u0431\u0430\u043B\u0430\u043D\u0441 \u0437\u0434\u0435\u0441\u044C \u0438 \u0432 \u0447\u0438\u043F\u0435 \u0443 \u043F\u043E\u043B\u044F \u0432\u0432\u043E\u0434\u0430.",
    toolsHint: "\u041A\u0438\u0442 \u0442\u0430\u043A\u0436\u0435 \u0436\u0438\u0432\u0451\u0442 \u0432 \u0441\u0442\u0440\u043E\u043A\u0435 \u043A\u043E\u043C\u043F\u043E\u0437\u0435\u0440\u0430: \u043D\u0430\u0436\u043C\u0438\u0442\u0435 \u043D\u0430 \u043D\u0435\u0433\u043E, \u0447\u0442\u043E\u0431\u044B \u0432\u044B\u0431\u0440\u0430\u0442\u044C \u0442\u0430\u0439\u043C\u0437\u043E\u043D\u0443 \u0438 \u0443\u0432\u0438\u0434\u0435\u0442\u044C \u0431\u0430\u043B\u0430\u043D\u0441. \u0410\u0433\u0435\u043D\u0442 \u043E\u0442\u0432\u0435\u0447\u0430\u0435\u0442 \u0447\u0435\u0440\u0435\u0437 deepseek_peak_status \u0438 \u0443\u043C\u0435\u0435\u0442 \u043F\u043B\u0430\u043D\u0438\u0440\u043E\u0432\u0430\u0442\u044C \u0440\u0430\u0431\u043E\u0442\u0443 \u043D\u0430 \u0434\u0435\u0448\u0451\u0432\u044B\u0435 \u043E\u043A\u043D\u0430 \u0447\u0435\u0440\u0435\u0437 deepseek_next_offpeak."
  },
  zh: {
    subtitle: "DeepSeek API \u5CF0\u503C / \u534A\u4EF7\u975E\u5CF0\u503C\u611F\u77E5\u3002",
    peak: "\u5CF0\u503C",
    offPeak: "\u975E\u5CF0\u503C",
    nextSwitch: "\u4E0B\u6B21\u5207\u6362 \u2192",
    now: "\u5F53\u524D",
    displayZone: "\u65F6\u95F4\u663E\u793A\u65F6\u533A",
    scheduleZone: "DeepSeek \u8BA1\u8D39\u65F6\u533A",
    scheduleZoneHint: "\u8BA1\u8D39\u65F6\u533A\u662F DeepSeek \u516C\u5E03\u5CF0\u503C\u65F6\u6BB5\u6240\u7528\u7684\u65F6\u533A\uFF08\u5317\u4EAC\uFF09\u3002\u6539\u52A8\u5B83\u4F1A\u6539\u53D8\u54EA\u4E9B\u5C0F\u65F6\u7B97\u4F5C\u5CF0\u503C \u2014\u2014 \u82E5\u53EA\u60F3\u6309\u81EA\u5DF1\u7684\u65F6\u949F\u67E5\u770B\u65F6\u95F4\uFF0C\u8BF7\u4F7F\u7528\u4E0A\u9762\u7684\u663E\u793A\u65F6\u533A\u3002",
    peakWindows: "\u5CF0\u503C\u7A97\u53E3\uFF08HH:MM-HH:MM\uFF0C\u9017\u53F7\u5206\u9694\uFF09",
    peakWeekdaysOnly: "\u4EC5\u5DE5\u4F5C\u65E5\u4E3A\u5CF0\u503C\uFF08\u5468\u4E00\u81F3\u5468\u4E94\uFF09",
    peakMultiplier: "\u5CF0\u503C\u500D\u7387",
    offPeakMultiplier: "\u975E\u5CF0\u503C\u500D\u7387",
    apiKey: "DeepSeek API \u5BC6\u94A5 \u2014 \u7528\u4E8E\u663E\u793A\u4F59\u989D",
    overridden: "\u5DF2\u8986\u76D6",
    reset: "\u91CD\u7F6E",
    apply: "\u5E94\u7528",
    invalidWindows: "\u7A97\u53E3\u683C\u5F0F\u65E0\u6548 \u2014 \u672A\u4FDD\u5B58",
    loading: "\u6B63\u5728\u52A0\u8F7D peak-whale \u8BBE\u7F6E\u2026",
    unavailable: "\u6B64\u90E8\u7F72\u672A\u63D0\u4F9B peak-whale \u8BBE\u7F6E\u547D\u540D\u7A7A\u95F4\u3002",
    readOnly: "\u6B64\u8FDE\u63A5\u5C06\u504F\u597D\u4FDD\u5B58\u5728\u8FDB\u7A0B\u5185 \u2014 \u5B57\u6BB5\u4E3A\u53EA\u8BFB\u3002",
    balance: "\u4F59\u989D",
    refresh: "\u5237\u65B0",
    balanceHint: "\u6DFB\u52A0 DeepSeek API \u5BC6\u94A5\u540E\uFF0C\u53EF\u5728\u6B64\u5904\u548C\u8F93\u5165\u6846\u65C1\u7684\u82AF\u7247\u4E2D\u67E5\u770B\u4F59\u989D\u3002",
    toolsHint: "\u9CB8\u9C7C\u4E5F\u4F1A\u51FA\u73B0\u5728\u8F93\u5165\u6846\u5DE5\u5177\u884C\uFF1A\u70B9\u51FB\u53EF\u5207\u6362\u65F6\u533A\u5E76\u67E5\u770B\u4F59\u989D\u3002\u4EE3\u7406\u901A\u8FC7 deepseek_peak_status \u56DE\u7B54\uFF0C\u5E76\u53EF\u7528 deepseek_next_offpeak \u628A\u5DE5\u4F5C\u5B89\u6392\u5230\u534A\u4EF7\u65F6\u6BB5\u3002"
  }
};
function asRecord(value) {
  return value !== null && typeof value === "object" ? value : {};
}
var rootStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 12,
  font: "inherit",
  color: "inherit"
};
var rowStyle = { display: "flex", flexDirection: "column", gap: 4 };
var rowHeadStyle = { display: "flex", alignItems: "baseline", gap: 8 };
var inputStyle2 = {
  font: "inherit",
  color: "inherit",
  background: "transparent",
  border: "1px solid rgba(127,127,127,0.4)",
  borderRadius: 8,
  padding: "6px 10px",
  width: "100%",
  boxSizing: "border-box"
};
var badgeStyle = {
  fontSize: "0.75em",
  opacity: 0.7,
  border: "1px solid rgba(127,127,127,0.4)",
  borderRadius: 999,
  padding: "1px 8px"
};
var linkButtonStyle = {
  font: "inherit",
  background: "none",
  border: "none",
  color: "inherit",
  textDecoration: "underline",
  cursor: "pointer",
  padding: 0
};
var statusBoxStyle = {
  padding: "10px 12px",
  border: "1px solid rgba(127,127,127,0.35)",
  borderRadius: 10,
  lineHeight: 1.5,
  whiteSpace: "pre-line"
};
function createPeakWhaleCard(scope) {
  return function PeakWhaleCard() {
    const t = STRINGS[pickLocale()];
    const snapshot = useSettingsSnapshot(scope);
    const now = useNow();
    const [draftWindows, setDraftWindows] = (0, import_react2.useState)(null);
    const [windowsError, setWindowsError] = (0, import_react2.useState)(null);
    const [balance, setBalance] = (0, import_react2.useState)({ status: "idle" });
    const [balanceNonce, setBalanceNonce] = (0, import_react2.useState)(0);
    const apiKey = (snapshot.value?.apiKey ?? "").trim();
    const apiBase = (snapshot.value?.apiBase ?? "").trim() || DEFAULT_API_BASE;
    (0, import_react2.useEffect)(() => {
      if (apiKey.length === 0) {
        setBalance({ status: "idle" });
        return;
      }
      const controller = new AbortController();
      setBalance((previous) => previous.status === "ok" ? previous : { status: "loading" });
      void readBalance(apiBase, apiKey, controller.signal, balanceNonce > 0).then((state) => {
        if (!controller.signal.aborted) setBalance(state);
      });
      return () => controller.abort();
    }, [apiKey, apiBase, balanceNonce]);
    if (snapshot.status === "unavailable") {
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: { margin: 0, opacity: 0.8 }, children: t.unavailable });
    }
    if (snapshot.value === void 0) {
      return /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: { margin: 0, opacity: 0.8 }, children: t.loading });
    }
    const value = snapshot.value;
    const overrides = asRecord(snapshot.user);
    const disabled = !snapshot.writable;
    const isOverridden = (field) => Object.hasOwn(overrides, field);
    const displayZone = resolveDisplayZone(value);
    const status = liveStatus(now, { ...value, displayTimeZone: displayZone });
    const row = (field, label, control) => /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: rowStyle, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: rowHeadStyle, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("label", { children: label }),
        isOverridden(field) ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: badgeStyle, children: t.overridden }) : null,
        isOverridden(field) ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("button", { type: "button", style: linkButtonStyle, onClick: () => void scope.unset(field), children: t.reset }) : null
      ] }),
      control
    ] });
    const textField = (field, label, type = "text") => row(
      field,
      label,
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "input",
        {
          type,
          style: inputStyle2,
          disabled,
          placeholder: type === "password" ? "sk-\u2026" : void 0,
          defaultValue: String(value[field] ?? ""),
          onChange: (event) => void scope.set(field, event.target.value)
        },
        `${field}:${String(value[field] ?? "")}`
      )
    );
    const numberField = (field, label) => row(
      field,
      label,
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
        "input",
        {
          type: "number",
          min: 0,
          step: 0.05,
          style: inputStyle2,
          disabled,
          defaultValue: String(value[field] ?? ""),
          onChange: (event) => {
            const parsed = Number(event.target.value);
            if (Number.isFinite(parsed)) void scope.set(field, parsed);
          }
        },
        `${field}:${String(value[field] ?? "")}`
      )
    );
    const shownWindows = draftWindows ?? windowsInput(value.peakWindows ?? []);
    return /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("section", { className: "dsh-peak-whale-card", style: rootStyle, children: [
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: { margin: 0, opacity: 0.8 }, children: t.subtitle }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("div", { style: statusBoxStyle, children: status.ok ? /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)(import_jsx_runtime2.Fragment, { children: [
        `${status.isPeak ? "\u{1F40B}" : "\u{1F40B}\u{1F4A4}"} ${status.isPeak ? t.peak : t.offPeak} \xD7${status.multiplier}`,
        `
${t.now} ${localTimeInZone(now, displayZone)}, ${localDateInZone(now, displayZone)} (${displayZone})`,
        displayZone !== value.timeZone ? `
${t.scheduleZone}: ${value.timeZone}` : "",
        status.countdown !== null && status.becomes !== null && status.nextLocalTime !== null ? `
${t.nextSwitch} ${status.becomes === "peak" ? t.peak : t.offPeak} ${status.nextLocalTime}, ${status.countdown}` : ""
      ] }) : `\u26A0\uFE0F ${status.error}` }),
      disabled ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: { margin: 0, opacity: 0.75, fontSize: "0.92em" }, children: t.readOnly }) : null,
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "grid", gridTemplateColumns: "1fr", gap: 10 }, children: [
        row(
          "displayTimeZone",
          t.displayZone,
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            ZoneSelect,
            {
              value: displayZone,
              now,
              disabled,
              onChange: (zone) => void scope.set("displayTimeZone", zone)
            }
          )
        ),
        row(
          "timeZone",
          t.scheduleZone,
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            ZoneSelect,
            {
              value: value.timeZone,
              now,
              disabled,
              onChange: (zone) => void scope.set("timeZone", zone)
            }
          )
        ),
        /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: { margin: 0, opacity: 0.7, fontSize: "0.85em" }, children: t.scheduleZoneHint }),
        row(
          "peakWindows",
          t.peakWindows,
          /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", gap: 8, alignItems: "center" }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "input",
              {
                type: "text",
                style: inputStyle2,
                disabled,
                value: shownWindows,
                onChange: (event) => setDraftWindows(event.target.value)
              }
            ),
            /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
              "button",
              {
                type: "button",
                style: { ...inputStyle2, width: "auto", cursor: "pointer" },
                disabled,
                onClick: () => {
                  const parsed = parseWindowsInput(shownWindows);
                  setWindowsError(parsed.ok ? null : `${t.invalidWindows}: ${parsed.error}`);
                  if (parsed.ok) {
                    void scope.set("peakWindows", parsed.windows);
                    setDraftWindows(null);
                  }
                },
                children: t.apply
              }
            )
          ] })
        ),
        windowsError !== null ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { color: "#d64545", fontSize: "0.85em" }, children: windowsError }) : null,
        row(
          "peakWeekdaysOnly",
          t.peakWeekdaysOnly,
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "input",
            {
              type: "checkbox",
              disabled,
              defaultChecked: value.peakWeekdaysOnly === true,
              onChange: (event) => void scope.set("peakWeekdaysOnly", event.target.checked)
            },
            `peakWeekdaysOnly:${String(value.peakWeekdaysOnly)}`
          )
        ),
        numberField("peakMultiplier", t.peakMultiplier),
        numberField("offPeakMultiplier", t.offPeakMultiplier),
        textField("apiKey", t.apiKey, "password")
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: 2 }, children: [
        /* @__PURE__ */ (0, import_jsx_runtime2.jsxs)("div", { style: { display: "flex", alignItems: "baseline", gap: 8 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("strong", { children: t.balance }),
          apiKey.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)(
            "button",
            {
              type: "button",
              style: linkButtonStyle,
              onClick: () => setBalanceNonce((nonce) => nonce + 1),
              children: t.refresh
            }
          ) : null
        ] }),
        apiKey.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { opacity: 0.75, fontSize: "0.92em" }, children: t.balanceHint }) : balance.status === "loading" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { opacity: 0.75, fontSize: "0.92em" }, children: t.loading }) : balance.status === "error" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { color: "#d64545", fontSize: "0.92em" }, children: balance.error }) : balance.status === "ok" && balance.snapshot.currencies.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { fontSize: "0.92em" }, children: balance.snapshot.currencies.map((entry) => `${entry.currency} ${entry.totalBalance}`).join(" \xB7 ") }) : balance.status === "ok" ? /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("span", { style: { opacity: 0.75, fontSize: "0.92em" }, children: "\u2014" }) : null
      ] }),
      /* @__PURE__ */ (0, import_jsx_runtime2.jsx)("p", { style: { margin: 0, opacity: 0.75, fontSize: "0.92em" }, children: t.toolsHint })
    ] });
  };
}

// src/client/peak-whale-chip.tsx
var import_react3 = require("react");
var import_jsx_runtime3 = require("react/jsx-runtime");
var DEFAULT_API_BASE2 = "https://api.deepseek.com";
var STRINGS2 = {
  en: {
    peak: "PEAK",
    offPeak: "OFF-PEAK",
    until: "Switch in",
    now: "Now",
    schedule: "DeepSeek schedule zone:",
    balance: "Balance",
    refresh: "refresh",
    noKey: "No API key yet \u2014 add one in the plugin settings to see the balance.",
    loading: "reading\u2026"
  },
  ru: {
    peak: "\u041F\u0418\u041A",
    offPeak: "OFF-PEAK",
    until: "\u0414\u043E \u043F\u0435\u0440\u0435\u043A\u043B\u044E\u0447\u0435\u043D\u0438\u044F",
    now: "\u0421\u0435\u0439\u0447\u0430\u0441",
    schedule: "\u0417\u043E\u043D\u0430 \u0440\u0430\u0441\u043F\u0438\u0441\u0430\u043D\u0438\u044F DeepSeek:",
    balance: "\u0411\u0430\u043B\u0430\u043D\u0441",
    refresh: "\u043E\u0431\u043D\u043E\u0432\u0438\u0442\u044C",
    noKey: "API-\u043A\u043B\u044E\u0447 \u043D\u0435 \u0437\u0430\u0434\u0430\u043D \u2014 \u0434\u043E\u0431\u0430\u0432\u044C\u0442\u0435 \u0435\u0433\u043E \u0432 \u043D\u0430\u0441\u0442\u0440\u043E\u0439\u043A\u0430\u0445 \u043F\u043B\u0430\u0433\u0438\u043D\u0430, \u0447\u0442\u043E\u0431\u044B \u0432\u0438\u0434\u0435\u0442\u044C \u0431\u0430\u043B\u0430\u043D\u0441.",
    loading: "\u0447\u0438\u0442\u0430\u044E\u2026"
  },
  zh: {
    peak: "\u5CF0\u503C",
    offPeak: "\u975E\u5CF0\u503C",
    until: "\u8DDD\u5207\u6362",
    now: "\u5F53\u524D",
    schedule: "DeepSeek \u8BA1\u8D39\u65F6\u533A\uFF1A",
    balance: "\u4F59\u989D",
    refresh: "\u5237\u65B0",
    noKey: "\u5C1A\u672A\u8BBE\u7F6E API \u5BC6\u94A5 \u2014\u2014 \u5728\u63D2\u4EF6\u8BBE\u7F6E\u4E2D\u6DFB\u52A0\u540E\u53EF\u67E5\u770B\u4F59\u989D\u3002",
    loading: "\u8BFB\u53D6\u4E2D\u2026"
  }
};
var CHIP_STYLE = {
  font: "inherit",
  color: "inherit",
  background: "transparent",
  border: "1px solid rgba(127,127,127,0.35)",
  borderRadius: 999,
  padding: "2px 10px",
  cursor: "pointer",
  display: "inline-flex",
  alignItems: "center",
  gap: 6,
  lineHeight: 1.6,
  whiteSpace: "nowrap"
};
var PANEL_STYLE = {
  position: "absolute",
  bottom: "calc(100% + 8px)",
  left: 0,
  zIndex: 60,
  minWidth: 280,
  maxWidth: 340,
  display: "flex",
  flexDirection: "column",
  gap: 8,
  padding: "10px 12px",
  border: "1px solid rgba(127,127,127,0.4)",
  borderRadius: 12,
  background: "var(--dsh-surface, Canvas)",
  color: "inherit",
  boxShadow: "0 8px 24px rgba(0,0,0,0.18)",
  fontSize: "0.92em",
  lineHeight: 1.5
};
function shortCountdown(countdown) {
  return /^\d{2}:\d{2}:\d{2}$/.test(countdown) ? countdown.slice(0, 5) : countdown;
}
function currencySymbol(currency) {
  if (currency === "CNY") return "\xA5";
  if (currency === "USD") return "$";
  return `${currency} `;
}
function createPeakWhaleChip(scope) {
  return function PeakWhaleChip() {
    const t = STRINGS2[pickLocale()];
    const snapshot = useSettingsSnapshot(scope);
    const now = useNow();
    const [open, setOpen] = (0, import_react3.useState)(false);
    const [balance, setBalance] = (0, import_react3.useState)({ status: "idle" });
    const [balanceNonce, setBalanceNonce] = (0, import_react3.useState)(0);
    const rootRef = (0, import_react3.useRef)(null);
    const value = snapshot.value;
    const apiKey = (value?.apiKey ?? "").trim();
    const apiBase = (value?.apiBase ?? "").trim() || DEFAULT_API_BASE2;
    (0, import_react3.useEffect)(() => {
      if (apiKey.length === 0) {
        setBalance({ status: "idle" });
        return;
      }
      const controller = new AbortController();
      setBalance((previous) => previous.status === "ok" ? previous : { status: "loading" });
      void readBalance(apiBase, apiKey, controller.signal, balanceNonce > 0).then((state) => {
        if (!controller.signal.aborted) setBalance(state);
      });
      return () => controller.abort();
    }, [apiKey, apiBase, balanceNonce]);
    (0, import_react3.useEffect)(() => {
      if (!open) return;
      const onPointerDown = (event) => {
        if (rootRef.current !== null && !rootRef.current.contains(event.target)) setOpen(false);
      };
      const onKeyDown = (event) => {
        if (event.key === "Escape") setOpen(false);
      };
      document.addEventListener("mousedown", onPointerDown);
      document.addEventListener("keydown", onKeyDown);
      return () => {
        document.removeEventListener("mousedown", onPointerDown);
        document.removeEventListener("keydown", onKeyDown);
      };
    }, [open]);
    if (snapshot.status !== "ready" || value === void 0) return null;
    const displayZone = resolveDisplayZone(value);
    const status = liveStatus(now, { ...value, displayTimeZone: displayZone });
    const whale = status.ok ? status.isPeak ? "\u{1F40B}" : "\u{1F40B}\u{1F4A4}" : "\u{1F40B}";
    const period = status.ok ? status.isPeak ? t.peak : t.offPeak : "?";
    const countdown = status.ok && status.countdown !== null ? shortCountdown(status.countdown) : null;
    const balanceSummary = balance.status === "ok" && balance.snapshot.currencies.length > 0 ? balance.snapshot.currencies.map((entry) => `${currencySymbol(entry.currency)}${entry.totalBalance}`).join(" \xB7 ") : null;
    return /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { ref: rootRef, style: { position: "relative", display: "inline-flex" }, children: [
      /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(
        "button",
        {
          type: "button",
          className: "dsh-peak-whale-chip",
          style: CHIP_STYLE,
          title: status.ok ? `${period} \xD7${status.multiplier}` : value.timeZone,
          "aria-expanded": open,
          onClick: () => setOpen((previous) => !previous),
          children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: whale }),
            countdown !== null ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: countdown }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { children: period }),
            balanceSummary !== null ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { opacity: 0.75 }, children: balanceSummary }) : null
          ]
        }
      ),
      open ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { className: "dsh-peak-whale-panel", style: PANEL_STYLE, children: [
        status.ok ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { children: [
          `${whale} ${period} \xD7${status.multiplier}`,
          status.countdown !== null && status.nextLocalTime !== null ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("br", {}),
            `${t.until} ${status.countdown}`,
            status.becomes !== null ? ` \u2192 ${status.becomes === "peak" ? t.peak : t.offPeak}` : "",
            ` ${status.nextLocalTime}`
          ] }) : null,
          /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("br", {}),
          `${t.now} ${localTimeInZone(now, displayZone)}, ${localDateInZone(now, displayZone)} (${displayZone})`,
          displayZone !== value.timeZone ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)(import_jsx_runtime3.Fragment, { children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("br", {}),
            `${t.schedule} ${value.timeZone}`
          ] }) : null
        ] }) : /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("div", { style: { color: "#d64545" }, children: `\u26A0\uFE0F ${status.error}` }),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
          ZoneSelect,
          {
            value: displayZone,
            now,
            disabled: !snapshot.writable,
            onChange: (zone) => void scope.set("displayTimeZone", zone)
          }
        ),
        /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { display: "flex", flexDirection: "column", gap: 2 }, children: [
          /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("div", { style: { display: "flex", alignItems: "baseline", gap: 8 }, children: [
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { opacity: 0.75 }, children: t.balance }),
            balance.status === "ok" || balance.status === "error" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)(
              "button",
              {
                type: "button",
                style: {
                  font: "inherit",
                  background: "none",
                  border: "none",
                  color: "inherit",
                  textDecoration: "underline",
                  cursor: "pointer",
                  padding: 0
                },
                onClick: () => setBalanceNonce((n) => n + 1),
                children: t.refresh
              }
            ) : null
          ] }),
          apiKey.length === 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { opacity: 0.75 }, children: t.noKey }) : balance.status === "loading" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { opacity: 0.75 }, children: t.loading }) : balance.status === "error" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { color: "#d64545" }, children: balance.error }) : balance.status === "ok" && balance.snapshot.currencies.length > 0 ? /* @__PURE__ */ (0, import_jsx_runtime3.jsxs)("span", { children: [
            balance.snapshot.currencies.map((entry) => `${entry.currency} ${entry.totalBalance}`).join(" \xB7 "),
            /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { opacity: 0.6 }, children: ` (${Math.max(0, Math.round((Date.now() - balance.at) / 1e3))}s, TTL ${BALANCE_TTL_MS / 1e3}s)` })
          ] }) : balance.status === "ok" ? /* @__PURE__ */ (0, import_jsx_runtime3.jsx)("span", { style: { opacity: 0.75 }, children: "\u2014" }) : null
        ] })
      ] }) : null
    ] });
  };
}

// src/client/index.ts
var NAMESPACE = "peak-whale";
var inject = ["slots", "locale", "settingsScope"];
var CHIP_SLOT = "conversation.input.left";
var CARD_SLOT = "settings.plugin.item";
function apply(ctx) {
  const host = ctx;
  const scope = host.settingsScope.bind({ namespace: NAMESPACE });
  host.slots.inject(
    CHIP_SLOT,
    () => host.slots.register(
      {
        name: CHIP_SLOT,
        id: NAMESPACE,
        order: 10,
        locale: NAMESPACE
      },
      createPeakWhaleChip(scope)
    )
  );
  host.slots.inject(
    CARD_SLOT,
    () => host.slots.register(
      {
        name: CARD_SLOT,
        key: NAMESPACE,
        locale: NAMESPACE
      },
      createPeakWhaleCard(scope)
    )
  );
}

		return module.exports;
	}
});
