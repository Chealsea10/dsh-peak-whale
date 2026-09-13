// Client-half gate: executes the built browser bundle the way the dsh client
// module loader does, then drives the registered card the way the slot renderer
// does. This is the check that `npm run verify` was missing — it fails on every
// one of the three defects that made the shipped web UI dead:
//
//   1. a bundle that is not `window.__ModuleLoader__.load({ id, factory })`
//      (a plain CJS bundle throws "module is not defined" in a classic script);
//   2. an `apply()` that reads a service the context does not provide;
//   3. a card that is not a React component (a class with `render()` returning
//      an HTMLElement cannot be mounted by React).
//
// It runs without React or a DOM: `react` and `react/jsx-runtime` are stubbed to
// their baseline shapes, and any require outside the shell's frozen baseline
// module table is a loud failure (the bundle-purity gate).
import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import vm from 'node:vm'

/** Exact module-table keys the shell seeds (see the web shell's staticModules). */
const BASELINE_MODULES = new Set([
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
])

const manifest = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'))
// Optional argument: check an artifact other than the freshly built one — e.g. the
// exact bytes the running dsh web server serves for this plugin's `./client`.
const bundlePath = process.argv[2] ?? fileURLToPath(new URL('../dist/client/index.js', import.meta.url))
const source = await readFile(bundlePath, 'utf8')

// --- 1. the artifact must register a lazy-CJS factory ------------------------
assert.ok(
  source.includes('window.__ModuleLoader__.load('),
  'dist/client/index.js is not a client bundle: it never calls window.__ModuleLoader__.load({ id, factory })',
)

const registrations = []
const sandbox = {
  console,
  navigator: { language: 'en-US' },
  window: {
    __ModuleLoader__: { load: (registration) => registrations.push(registration) },
    setInterval: () => 0,
    clearInterval: () => {},
  },
}
vm.runInNewContext(source, sandbox, { filename: 'dist/client/index.js' })

assert.equal(registrations.length, 1, 'the bundle must register exactly one module factory')
assert.equal(registrations[0].id, manifest.name, 'the registration id must be the package name')
assert.equal(typeof registrations[0].factory, 'function', 'the registration must carry a factory')

// --- 2. the factory must materialize against the baseline table only --------
const reactStub = {
  useState: (initial) => [typeof initial === 'function' ? initial() : initial, () => {}],
  useEffect: () => {},
  useMemo: (factory) => factory(),
  useRef: (value) => ({ current: value }),
  createElement: (type, props, ...children) => ({ type, props: { ...(props ?? {}), children } }),
}
const jsxRuntimeStub = {
  jsx: (type, props) => ({ type, props: props ?? {} }),
  jsxs: (type, props) => ({ type, props: props ?? {} }),
  Fragment: Symbol('react.fragment'),
}
const stubs = { react: reactStub, 'react/jsx-runtime': jsxRuntimeStub }

const required = []
function requireStub(specifier) {
  required.push(specifier)
  if (!BASELINE_MODULES.has(specifier)) {
    throw new Error(
      `bundle required '${specifier}', which is not in the shell's baseline module table — ` +
        'declare it under dsh.client.external and make sure a composed plugin bundle supplies it',
    )
  }
  return stubs[specifier] ?? {}
}

const clientExports = registrations[0].factory(requireStub)
assert.equal(typeof clientExports.apply, 'function', 'the client half must export apply()')
assert.ok(Array.isArray(clientExports.inject), 'the client half must export an inject array')
assert.ok(clientExports.inject.includes('slots'), "the client half must inject 'slots'")
assert.ok(clientExports.inject.includes('settingsScope'), "the client half must inject 'settingsScope'")

// --- 3. apply() must only read services it declared -------------------------
const NAMESPACE = 'peak-whale'
let snapshot = {
  status: 'ready',
  value: {
    timeZone: 'Asia/Shanghai',
    peakWindows: ['09:00-12:00', '14:00-18:00'],
    peakWeekdaysOnly: true,
    peakMultiplier: 1,
    offPeakMultiplier: 0.5,
    apiKey: '',
    apiBase: 'https://api.deepseek.com',
  },
  user: { offPeakMultiplier: 0.5 },
  writable: true,
}
const writes = []
const scope = {
  getSnapshot: () => snapshot,
  subscribe: () => () => {},
  set: (field, value) => {
    writes.push(['set', field, value])
    return Promise.resolve()
  },
  unset: (field) => {
    writes.push(['unset', field])
    return Promise.resolve()
  },
}

const boundNamespaces = []
const injectedSlotKeys = []
const registered = []
const services = {
  settingsScope: {
    bind({ namespace }) {
      boundNamespaces.push(namespace)
      return scope
    },
  },
  slots: {
    inject(key, callback) {
      injectedSlotKeys.push(key)
      return callback()
    },
    register(options, component) {
      registered.push({ options, component })
      return () => {}
    },
  },
}
// Mirror cordis: reading an undeclared service throws instead of yielding undefined.
const ctx = new Proxy(services, {
  get(target, property, receiver) {
    if (typeof property === 'string' && !(property in target)) {
      throw new Error(`cannot get property "${property}" without inject`)
    }
    return Reflect.get(target, property, receiver)
  },
})

clientExports.apply(ctx)

assert.deepEqual(boundNamespaces, [NAMESPACE], 'the surfaces must bind the peak-whale settings namespace')
assert.deepEqual(
  [...injectedSlotKeys].sort(),
  ['conversation.input.left', 'settings.plugin.item'],
  'the plugin must contribute a composer chip and a settings card',
)
assert.equal(registered.length, 2, 'the plugin must register exactly two slot entries')

const chip = registered.find((entry) => entry.options.name === 'conversation.input.left')
const card = registered.find((entry) => entry.options.name === 'settings.plugin.item')
assert.ok(chip, 'the composer chip must register into conversation.input.left')
assert.ok(card, 'the settings card must register into settings.plugin.item')
assert.equal(chip.options.id, NAMESPACE, 'the list slot entry must carry an id')
assert.equal(card.options.key, NAMESPACE, 'the keyed slot entry must be keyed by the namespace')
assert.equal(typeof chip.component, 'function', 'the chip must be a React function component')
assert.equal(typeof card.component, 'function', 'the card must be a React function component')

// --- 4. both surfaces must render as React renders them ---------------------
// React calls function components; a structural walk of the element tree has to
// do the same, or a nested component's output is invisible to these assertions.
function walkElements(node, visit) {
  if (Array.isArray(node)) {
    for (const child of node) walkElements(child, visit)
    return
  }
  if (!node || typeof node !== 'object') return
  if (typeof node.type === 'function') {
    visit(node)
    walkElements(node.type(node.props ?? {}), visit)
    return
  }
  visit(node)
  if (node.props) walkElements(node.props.children, visit)
}

function collectText(node, into = []) {
  walkElements(node, (element) => {
    const children = element.props?.children
    const list = Array.isArray(children) ? children : [children]
    for (const child of list) {
      if (typeof child === 'string') into.push(child)
      if (typeof child === 'number') into.push(String(child))
    }
  })
  return into
}

// React calls a function component plainly; a class component would throw here.
const tree = card.component({})
assert.ok(tree && typeof tree === 'object', 'the card must return a React element')
const text = collectText(tree).join(' ')
assert.match(text, /🐋/, 'the card must render the live tariff status')
assert.match(text, /(PEAK|OFF-PEAK)/, 'the card must render the current period')
assert.match(text, /Show times in/, 'the card must render the display-zone picker')
assert.match(text, /DeepSeek schedule zone/, 'the card must render the schedule-zone picker')

// The chip is the always-visible surface next to the model selector.
const chipTree = chip.component({})
assert.ok(chipTree && typeof chipTree === 'object', 'the chip must return a React element')
const chipText = collectText(chipTree).join(' ')
assert.match(chipText, /🐋/, 'the chip must show the whale')
assert.match(chipText, /\d{2}:\d{2}/, 'the chip must show the countdown to the next switch')

// A bad time zone must degrade to the notice branch, not throw out of render.
const goodSnapshot = snapshot
snapshot = { ...goodSnapshot, value: { ...goodSnapshot.value, timeZone: 'Not/AZone' } }
assert.doesNotThrow(() => card.component({}), 'an invalid time zone must not crash the card render')
assert.match(collectText(card.component({})).join(' '), /⚠️/, 'an invalid time zone must surface as a notice')
assert.doesNotThrow(() => chip.component({}), 'an invalid time zone must not crash the chip render')

// The unavailable branch must render its notice rather than a broken form, and
// the chip must disappear entirely instead of showing a stale tariff.
snapshot = { ...goodSnapshot, status: 'unavailable', value: undefined }
assert.match(collectText(card.component({})).join(' '), /not served by this deployment/)
assert.equal(chip.component({}), null, 'the chip must render nothing while the namespace is unavailable')
snapshot = goodSnapshot

// --- 4b. the display zone must never move the tariff ------------------------
// DeepSeek publishes its peak hours in Beijing time. A user reading times in
// their own clock must not thereby shift which hours count as peak, so the
// classification has to be byte-identical across display zones.
const periodOf = (rendered) => {
  const match = /(?:🐋|🐋💤)\s+(PEAK|OFF-PEAK|ПИК|非峰值)/.exec(collectText(rendered).join(' '))
  return match ? match[1] : null
}
snapshot = { ...goodSnapshot, value: { ...goodSnapshot.value, displayTimeZone: '' } }
const withoutDisplay = periodOf(card.component({}))
const withoutDisplayText = collectText(card.component({})).join(' ')
snapshot = { ...goodSnapshot, value: { ...goodSnapshot.value, displayTimeZone: 'Europe/Moscow' } }
const withDisplay = periodOf(card.component({}))
const withDisplayText = collectText(card.component({})).join(' ')
assert.ok(withoutDisplay !== null && withDisplay !== null, 'the card must render a period token')
assert.equal(
  withDisplay,
  withoutDisplay,
  'the display zone must not change the classified period — only the schedule zone may',
)
assert.match(withDisplayText, /Europe\/Moscow/, 'the card must show times in the configured display zone')
assert.ok(
  !/Asia\/Shanghai$/.test(withDisplayText.split('DeepSeek schedule zone')[0]),
  'the "now" line must use the display zone, not the schedule zone',
)
snapshot = goodSnapshot

// --- 5. writes must reach the namespace scope -------------------------------
// Both surfaces wire controls to scope.set/scope.unset; assert the wiring exists
// by exercising every change handler the same way a browser event would.
const handlers = []
walkElements(card.component({}), (element) => {
  if (typeof element.props?.onChange === 'function') handlers.push(element.props.onChange)
  if (typeof element.props?.onBlur === 'function') handlers.push(element.props.onBlur)
})
assert.ok(handlers.length > 0, 'the card must wire at least one controlled input to the scope')
for (const handler of handlers) {
  try {
    handler({ target: { value: '0.25', checked: true } })
  } catch (error) {
    throw new Error(`a card input handler threw: ${String(error)}`)
  }
}
assert.ok(writes.length > 0, 'an input change must write through the settings scope')

// The zone picker must offer the curated zones, Moscow included. It is read off
// the card, which always renders the control; the chip's copy lives in its
// popover, which is closed on first render by design.
const zoneOptions = []
walkElements(tree, (element) => {
  if (element.type !== 'select' || !element.props) return
  const children = Array.isArray(element.props.children) ? element.props.children : [element.props.children]
  for (const option of children) {
    if (option && option.props && option.props.value) zoneOptions.push(option.props.value)
  }
})
assert.ok(zoneOptions.includes('Europe/Moscow'), 'the zone picker must offer Europe/Moscow')
assert.ok(zoneOptions.includes('Asia/Shanghai'), 'the zone picker must offer Asia/Shanghai')
assert.ok(zoneOptions.includes('__custom__'), 'the zone picker must allow any IANA zone')

console.log(
  `client-check: 1 factory registered, ${registered.length} surfaces (composer chip + settings card) ` +
    `bound to '${NAMESPACE}', rendered; ${zoneOptions.length} zone option(s); ` +
    `${writes.length} write(s) routed; requires: ${[...new Set(required)].sort().join(', ')}`,
)

console.log(
  `client-check: 1 factory registered, ${registered.length} surfaces (composer chip + settings card) ` +
    `bound to '${NAMESPACE}', rendered; ${zoneOptions.length} zone option(s); ` +
    `${writes.length} write(s) routed; requires: ${[...new Set(required)].sort().join(', ')}`,
)
