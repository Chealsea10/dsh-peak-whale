import Schema from '@deepseek-ai/schemastery';
import { defineTool } from '@deepseek-ai/dsh-tools';
import { fetchBalance } from './balance.js';
import { classify, formatCountdown, localDateInZone, localTimeInZone, nextBoundary, parseWindows, resolvePricing, upcomingOffPeakWindows, } from './pricing.js';
import { renderOffPeak, renderStatus } from './render.js';
export const name = 'peak-whale';
export const inject = ['tools'];
export const NAMESPACE = 'peak-whale';
export const Config = Schema.object({
    timeZone: Schema.string().default('Asia/Shanghai'),
    displayTimeZone: Schema.string().default(''),
    peakWindows: Schema.array(Schema.string()).default(['09:00-12:00', '14:00-18:00']),
    peakWeekdaysOnly: Schema.boolean().default(true),
    peakMultiplier: Schema.number().default(1),
    offPeakMultiplier: Schema.number().default(0.5),
    apiKey: Schema.string().default(''),
    apiBase: Schema.string().default('https://api.deepseek.com'),
});
export function apply(ctx, config) {
    // Re-derived when the settings card writes a new config (validate refuses
    // specs the schema cannot express, so onChange only sees valid values).
    let pricing = resolvePricing(config);
    let source = () => config;
    // The settings service ships with the dsh host, not as a published package.
    // It MUST be reached through ctx.inject: reading `ctx.settings` directly
    // throws "cannot get property \"settings\" without inject" on a context whose
    // inject list does not declare it, and that throw takes down the whole plugin
    // tree (the entire dsh boot). ctx.inject is the deferred-consumer form — it
    // runs the callback once the service is available, and never blocks this
    // fiber, so without a settings provider the tools below still register.
    ctx.inject(['settings'], (settingsCtx) => {
        const settings = settingsCtx.settings;
        // Guarding a METHOD on an injected service is not the same mistake as
        // reading an undeclared service: the service here is guaranteed present, but
        // its API is younger than this plugin's oldest supported host.
        // `installSection` does not exist in dsh 0.1.0-rc.x (that generation exposes
        // register/get/update/replace/mutate only), and calling a missing method
        // would throw inside this fiber. The tools are unaffected either way.
        if (typeof settings.installSection !== 'function') {
            console.warn('[dsh-peak-whale] this host\'s settings service has no installSection (dsh 0.1.0-rc.x): ' +
                'the tools work, but the web config card gets no namespace to bind. Upgrade dsh to a build ' +
                'that ships installSection (0.1.5-rc.1 or newer).');
            return;
        }
        settings.installSection(ctx, NAMESPACE, Config, config, {
            validate: (value) => {
                parseWindows(value.peakWindows);
            },
            setSource: (current) => {
                source = current;
            },
            onChange: () => {
                pricing = resolvePricing(source());
            },
        });
    });
    ctx.tools.register(defineTool({
        name: 'deepseek_peak_status',
        description: 'Show the current DeepSeek API pricing period: peak vs half-price off-peak, the price ' +
            'multiplier, a countdown to the next switch, and (optionally) the API account balance. ' +
            'Use it before committing to expensive batch work.',
        parameters: {
            includeBalance: {
                type: 'boolean',
                description: 'Also fetch the account balance (requires apiKey in the plugin config).',
            },
        },
        async execute(args, exec) {
            const now = new Date();
            const period = classify(now, pricing);
            const boundary = nextBoundary(now, pricing);
            // Shown times use the DISPLAY zone; the peak judgement above uses the
            // SCHEDULE zone. With no display zone configured the two are identical.
            const zone = pricing.displayTimeZone;
            const value = {
                isPeak: period.isPeak,
                period: period.period,
                multiplier: period.multiplier,
                timeZone: pricing.timeZone,
                displayTimeZone: zone,
                nowUtc: now.toISOString(),
                nowLocal: `${localDateInZone(now, zone)} ${localTimeInZone(now, zone)} (${zone})`,
                nextSwitch: boundary
                    ? {
                        atUtc: boundary.toISOString(),
                        atLocal: `${localDateInZone(boundary, zone)} ${localTimeInZone(boundary, zone)} (${zone})`,
                        becomes: classify(boundary, pricing).period,
                        countdown: formatCountdown(boundary.getTime() - now.getTime()),
                    }
                    : null,
            };
            if (args.includeBalance === true) {
                // source(), not the `config` closure: once the settings provider
                // attaches, the authoritative section (and with it the apiKey/apiBase
                // the user typed into the card) lives behind source(). Reading the
                // composition entry here silently reported "no apiKey configured" for
                // every user who configured the key through the UI.
                value.balance = await balanceValue(source(), exec.signal);
            }
            return value;
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    isPeak: { type: 'boolean', required: true },
                    period: { type: 'string', enum: ['peak', 'off-peak'], required: true },
                    multiplier: { type: 'number', required: true },
                    timeZone: { type: 'string', required: true },
                    displayTimeZone: { type: 'string', required: true },
                    nowUtc: { type: 'string', required: true },
                    nowLocal: { type: 'string', required: true },
                    nextSwitch: {
                        oneOf: [
                            {
                                type: 'object',
                                additionalProperties: false,
                                properties: {
                                    atUtc: { type: 'string', required: true },
                                    atLocal: { type: 'string', required: true },
                                    becomes: { type: 'string', enum: ['peak', 'off-peak'], required: true },
                                    countdown: { type: 'string', required: true },
                                },
                            },
                            { type: 'null' },
                        ],
                        required: true,
                    },
                    balance: {
                        type: 'object',
                        additionalProperties: false,
                        properties: {
                            error: { type: 'string' },
                            isAvailable: { type: 'boolean' },
                            currencies: {
                                type: 'array',
                                items: {
                                    type: 'object',
                                    additionalProperties: false,
                                    properties: {
                                        currency: { type: 'string', required: true },
                                        totalBalance: { type: 'string', required: true },
                                        grantedBalance: { type: 'string', required: true },
                                        toppedUpBalance: { type: 'string', required: true },
                                    },
                                },
                            },
                        },
                    },
                },
            },
            render: (_args, value) => [{ type: 'text', text: renderStatus(value) }],
        },
    }));
    ctx.tools.register(defineTool({
        name: 'deepseek_next_offpeak',
        description: 'List the upcoming off-peak (half-price) windows for the DeepSeek API as UTC intervals. ' +
            'Feed a window start into the built-in schedule tool (schedule_create, kind "at") to run ' +
            'batch work when inference costs half as much.',
        parameters: {
            count: {
                type: 'integer',
                description: 'How many windows to list (1-14, default 3).',
            },
        },
        async execute(args) {
            const requested = Math.floor(args.count ?? 3);
            const count = Math.min(Math.max(Number.isFinite(requested) ? requested : 3, 1), 14);
            const now = new Date();
            return {
                timeZone: pricing.timeZone,
                displayTimeZone: pricing.displayTimeZone,
                offPeakMultiplier: pricing.offPeakMultiplier,
                windows: upcomingOffPeakWindows(now, pricing, count),
                hint: "Schedule work inside a window with schedule_create: { kind: 'at', at: windows[i].startUtc, prompt: '...' }. " +
                    'The first window already containing "now" starts immediately.',
            };
        },
        output: {
            schema: {
                type: 'object',
                additionalProperties: false,
                properties: {
                    timeZone: { type: 'string', required: true },
                    displayTimeZone: { type: 'string', required: true },
                    offPeakMultiplier: { type: 'number', required: true },
                    windows: {
                        type: 'array',
                        required: true,
                        items: {
                            type: 'object',
                            additionalProperties: false,
                            properties: {
                                startUtc: { type: 'string', required: true },
                                endUtc: { oneOf: [{ type: 'string' }, { type: 'null' }], required: true },
                                durationMinutes: { oneOf: [{ type: 'integer' }, { type: 'null' }], required: true },
                                startLocal: {
                                    type: 'object',
                                    additionalProperties: false,
                                    required: true,
                                    properties: {
                                        date: { type: 'string', required: true },
                                        time: { type: 'string', required: true },
                                        time_zone: { type: 'string', required: true },
                                    },
                                },
                            },
                        },
                    },
                    hint: { type: 'string', required: true },
                },
            },
            render: (_args, value) => [{ type: 'text', text: renderOffPeak(value) }],
        },
    }));
    console.log('[dsh-peak-whale] tools registered: deepseek_peak_status, deepseek_next_offpeak');
}
async function balanceValue(config, signal) {
    if (!config.apiKey) {
        return { error: 'no apiKey configured - set it in the peak-whale plugin config to see balance' };
    }
    try {
        const snapshot = await fetchBalance(config.apiBase, config.apiKey, signal);
        return { isAvailable: snapshot.isAvailable, currencies: snapshot.currencies };
    }
    catch (error) {
        return { error: error instanceof Error ? error.message : String(error) };
    }
}
