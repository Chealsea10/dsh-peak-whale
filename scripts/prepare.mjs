// Package prepare script: builds BOTH halves in the one order that leaves a
// consistent dist/ — host JS + declarations, client declarations, then the
// client bundle last (the bundler is the only writer of dist/client/index.js;
// a tsc pass must never overwrite it with unbundled ESM).
//
// A host build that fails only because the @deepseek-ai peer types are absent
// (installing the checkout outside dsh) is skipped with a warning — every other
// failure aborts the install.
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { rmSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))
const require = createRequire(import.meta.url)
const tsc = require.resolve('typescript/bin/tsc')

function run(file, args) {
  try {
    execFileSync(process.execPath, [file, ...args], { cwd: root, stdio: ['ignore', 'inherit', 'pipe'] })
    return { ok: true }
  } catch (error) {
    return { ok: false, stderr: String(error.stderr ?? error) }
  }
}

function fail(result) {
  process.stderr.write(result.stderr)
  process.exit(1)
}

rmSync(new URL('../dist', import.meta.url), { recursive: true, force: true })

const host = run(tsc, ['-p', 'tsconfig.json'])
if (!host.ok) {
  const missingPeersOnly = /TS2307/.test(host.stderr) && /@deepseek-ai\//.test(host.stderr)
  if (!missingPeersOnly) fail(host)
  process.stderr.write(
    '[dsh-peak-whale] skipped the host build: @deepseek-ai peer types are not resolvable here ' +
      '(they resolve inside a dsh workspace). Run `dsh plugin add` from there, or install the peers.\n',
  )
}

const client = run(tsc, ['-p', 'tsconfig.client.json'])
if (!client.ok) fail(client)

const bundle = run(fileURLToPath(new URL('build-client.mjs', import.meta.url)), [])
if (!bundle.ok) fail(bundle)
