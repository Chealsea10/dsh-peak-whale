// Runtime smoke test: runs apply() against a cordis-faithful fake context, then
// executes both tools and validates arguments and canonical outputs with
// dsh-tools' own JSON Schema validator — the same enforcement the real registry
// applies.
//
// "Cordis-faithful" matters: a plain object context silently yields `undefined`
// for any service a plugin reads without declaring it, which is exactly how the
// shipped `ctx.settings` probe passed this test while crashing every real dsh
// boot with "cannot get property \"settings\" without inject". The context below
// throws on undeclared service access instead, and models `ctx.inject` as the
// deferred consumer it is.
//
// (Registered definitions carry compiled schemas, so validateJsonSchemaValue
// is used for both sides, not the author-spec validateArgs.)
import assert from 'node:assert/strict'

import { validateJsonSchemaValue } from '@deepseek-ai/dsh-tools'

import { Config, NAMESPACE, apply } from '../dist/index.js'

const config = {
  timeZone: 'Asia/Shanghai',
  peakWindows: ['09:00-12:00', '14:00-18:00'],
  peakWeekdaysOnly: true,
  peakMultiplier: 1,
  offPeakMultiplier: 0.5,
  apiKey: '',
  apiBase: 'https://api.deepseek.com',
}

/** Wrap a service bag so reading an undeclared service throws, as cordis does. */
function makeContext(services) {
  return new Proxy(services, {
    get(target, property, receiver) {
      if (typeof property === 'string' && !(property in target)) {
        throw new Error(`cannot get property "${property}" without inject`)
      }
      return Reflect.get(target, property, receiver)
    },
  })
}

// --- case 1: no settings provider in the composition -------------------------
// The deferred-consumer contract: ctx.inject must NOT be read as a property, and
// the tools must register even though the settings service never arrives.
const registered = []
const requestedInjections = []
const settingsOnlyCtx = makeContext({
  tools: {
    register(definition) {
      registered.push(definition)
      return () => {}
    },
  },
  inject(deps, callback) {
    requestedInjections.push(deps)
    return { deps, callback } // a real Fiber; deliberately never activated here
  },
})

assert.doesNotThrow(
  () => apply(settingsOnlyCtx, config),
  'apply() must not read an undeclared service — reading ctx.settings directly crashes the dsh boot',
)
assert.deepEqual(requestedInjections, [['settings']], "apply() must request 'settings' through ctx.inject")
assert.deepEqual(registered.map((tool) => tool.name), ['deepseek_peak_status', 'deepseek_next_offpeak'])

const exec = { signal: new AbortController().signal }

const status = registered[0]
assert.deepEqual(validateJsonSchemaValue(status.parameters, { includeBalance: true }), [])
assert.deepEqual(validateJsonSchemaValue(status.parameters, {}), [])
assert.ok(validateJsonSchemaValue(status.parameters, { includeBalance: 'yes' }).length > 0)
const statusValue = await status.execute({ includeBalance: false }, exec)
assert.deepEqual(validateJsonSchemaValue(status.output.schema, statusValue), [])
assert.match(statusValue.nowLocal, /^\d{4}-\d{2}-\d{2} \d{2}:\d{2} \(Asia\/Shanghai\)$/)
assert.ok(statusValue.nextSwitch === null || typeof statusValue.nextSwitch.countdown === 'string')
assert.ok(statusValue.nextSwitch === null || statusValue.nextSwitch.atUtc > statusValue.nowUtc)
const statusBlocks = status.output.render({}, statusValue)
assert.equal(statusBlocks[0].type, 'text')
assert.match(statusBlocks[0].text, /🐋/)

const offpeak = registered[1]
assert.deepEqual(validateJsonSchemaValue(offpeak.parameters, { count: 3 }), [])
assert.deepEqual(validateJsonSchemaValue(offpeak.parameters, {}), [])
assert.ok(validateJsonSchemaValue(offpeak.parameters, { count: 1.5 }).length > 0)
const offpeakValue = await offpeak.execute({ count: 0 }, exec) // out-of-range input is clamped by execute
assert.deepEqual(validateJsonSchemaValue(offpeak.output.schema, offpeakValue), [])
assert.ok(offpeakValue.windows.length >= 1 && offpeakValue.windows.length <= 3)
assert.equal(offpeakValue.timeZone, 'Asia/Shanghai')
const offpeakBlocks = offpeak.output.render({}, offpeakValue)
assert.equal(offpeakBlocks[0].type, 'text')
assert.match(offpeakBlocks[0].text, /🐋💤/)

// --- case 2: a settings provider arrives -------------------------------------
// installSection must be wired to this plugin's namespace, schema and config,
// and a committed change must actually move the tools' effective pricing.
let installed = null
const reboundTools = []
const settingsCtx = makeContext({
  tools: {
    register(definition) {
      reboundTools.push(definition)
      return () => {}
    },
  },
  inject(deps, callback) {
    if (deps.includes('settings')) callback(makeContext({ settings: { installSection: (...args) => (installed = args) } }))
    return { deps }
  },
})

apply(settingsCtx, { ...config })

assert.ok(installed !== null, "a present settings provider must receive installSection")
const [owner, namespace, schema, entry, hooks] = installed
assert.equal(namespace, NAMESPACE)
assert.equal(schema, Config, 'the namespace must be installed with the plugin Config schema')
assert.deepEqual(entry, { ...config })
assert.equal(typeof hooks.setSource, 'function')
assert.equal(typeof hooks.onChange, 'function')
assert.equal(typeof hooks.validate, 'function')

assert.doesNotThrow(() => hooks.validate({ ...config }))
assert.throws(
  () => hooks.validate({ ...config, peakWindows: ['not-a-window'] }),
  'the validate hook must reject windows the schema cannot express',
)

// Attach a settings-backed source and re-judge: the tool output must follow.
let current = { ...config, timeZone: 'UTC' }
hooks.setSource(() => current)
hooks.onChange()
assert.equal(reboundTools.length, 2, 'the second composition must register both tools')
const rebound = await reboundTools[0].execute({ includeBalance: false }, exec)
assert.match(rebound.nowLocal, /\(UTC\)$/, 'a settings change must change the pricing time zone the tools use')

// --- case 3: an older host whose settings service has no installSection ------
// dsh 0.1.0-rc.x exposes register/get/update/replace/mutate but not
// installSection. The plugin must degrade (tools still register) rather than
// throw inside its own fiber.
const legacyTools = []
const legacyCtx = makeContext({
  tools: {
    register(definition) {
      legacyTools.push(definition)
      return () => {}
    },
  },
  inject(deps, callback) {
    if (deps.includes('settings')) callback(makeContext({ settings: { register: () => ({}) } }))
    return { deps }
  },
})
let legacyError = null
try {
  apply(legacyCtx, { ...config })
} catch (error) {
  legacyError = error
}
assert.equal(legacyError, null, 'a settings service without installSection must not fail apply()')
assert.equal(legacyTools.length, 2, 'the tools must still register on an older host')

console.log('--- deepseek_peak_status renders as:\n' + statusBlocks[0].text)
console.log('--- deepseek_next_offpeak renders as:\n' + offpeakBlocks[0].text)
console.log(
  'smoke: tools registered with and without a settings provider (and on a host without ' +
    'installSection), executed and schema-validated',
)
