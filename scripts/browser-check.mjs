// Real-browser check of the plugin's web half: opens the dsh web UI served on
// PW_PORT, looks for the whale chip in the composer tool row, opens its popover,
// and reads the zone picker and the balance out of the live DOM. Console errors
// and page errors are captured and reported: a crashing client bundle or a
// non-React surface shows up here and nowhere else.
//
// Opt-in: needs a running `dsh web` that composes this plugin and a Playwright
// install. Point PW_PLAYWRIGHT at a playwright entry file when it is not
// resolvable from this package, e.g.
//   PW_PORT=3080 PW_TOKEN=... PW_PLAYWRIGHT=/path/to/playwright/index.js npm run browser-check
import { pathToFileURL } from 'node:url'

async function loadPlaywright() {
  try {
    return await import('playwright')
  } catch (error) {
    if (!process.env.PW_PLAYWRIGHT) {
      throw new Error(
        'playwright is not resolvable from this package; set PW_PLAYWRIGHT to a playwright entry file (e.g. /path/to/node_modules/playwright/index.js)',
        { cause: error },
      )
    }
    return await import(pathToFileURL(process.env.PW_PLAYWRIGHT).href)
  }
}

// Playwright's entry is CJS: through an ESM import its exports may land on
// `default` depending on how it was resolved.
const playwright = await loadPlaywright()
const chromium = playwright.chromium ?? playwright.default?.chromium
if (!chromium) throw new Error('loaded playwright but found no chromium export')

// Prefer Playwright's bundled browser; fall back to an installed Chrome/Edge so
// the check runs without `npx playwright install`.
async function launch() {
  try {
    return await chromium.launch()
  } catch (error) {
    const channel = process.env.PW_CHANNEL ?? 'chrome'
    console.warn(`bundled chromium unavailable (${String(error).split('\n')[0]}); retrying with channel '${channel}'`)
    return await chromium.launch({ channel })
  }
}

const port = process.env.PW_PORT ?? '3080'
const token = process.env.PW_TOKEN ?? ''
const url = `http://127.0.0.1:${port}/?token=${token}`

const browser = await launch()
const page = await browser.newPage()

const consoleErrors = []
const pageErrors = []
page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text())
})
page.on('pageerror', (error) => pageErrors.push(String(error)))

await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60_000 })
await page.waitForFunction(() => document.querySelector('[data-dsh-boot]') === null, null, { timeout: 60_000 })

// A session-scoped slot needs a Session; start one if the landing page has none.
if ((await page.locator('.dsh-peak-whale-chip').count()) === 0) {
  const newSession = page.locator('button', { hasText: /new session/i }).first()
  if ((await newSession.count()) > 0) {
    await newSession.click({ timeout: 10_000 }).catch(() => {})
    await page.waitForTimeout(2500)
  }
}

const chip = page.locator('.dsh-peak-whale-chip').first()
const chipCount = await page.locator('.dsh-peak-whale-chip').count()
const chipText = chipCount > 0 ? (await chip.innerText()).trim() : ''

let panelText = ''
let zoneOptions = []
let selectedZone = ''
if (chipCount > 0) {
  await chip.click({ timeout: 10_000 }).catch(() => {})
  await page.waitForTimeout(1500)
  const panel = page.locator('.dsh-peak-whale-panel').first()
  if ((await panel.count()) > 0) {
    panelText = (await panel.innerText()).trim()
    const select = panel.locator('select').first()
    if ((await select.count()) > 0) {
      zoneOptions = await select.locator('option').allInnerTexts()
      selectedZone = await select.inputValue()
    }
  }
}

const result = {
  chipCount,
  chipText,
  panelOpened: panelText.length > 0,
  panelText: panelText.slice(0, 500),
  zoneOptionCount: zoneOptions.length,
  hasMoscow: zoneOptions.some((option) => /Москва|Moscow/.test(option)),
  selectedZone,
  hasBalanceLine: /¥|\$|CNY|USD|Баланс|Balance|余额/.test(panelText),
  consoleErrors: consoleErrors.slice(0, 12),
  pageErrors: pageErrors.slice(0, 12),
}
console.log(JSON.stringify(result, null, 2))

await page.screenshot({ path: process.env.PW_SHOT ?? 'peak-whale-chip.png', fullPage: false })
await browser.close()

if (pageErrors.length > 0) process.exit(2)
if (chipCount === 0) process.exit(3)
