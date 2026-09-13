// Bundles the browser half into the ONE artifact shape the dsh client module
// loader can consume. The loader fetches a plugin's `./client` export as a
// classic <script> and expects it to register a lazy-CJS factory:
//
//   window.__ModuleLoader__.load({ id: '<package name>', factory: (require) => exports })
//
// A plain esbuild CJS bundle does NOT satisfy that contract: in a classic script
// there is no `module` global, so `module.exports = ...` throws
// "ReferenceError: module is not defined" and nothing is ever registered. This
// script therefore compiles to CJS and wraps the result in the factory closure
// the loader materializes.
//
// The `@deepseek-ai/*` and React imports stay external and are resolved against
// the shell's frozen baseline module table at materialization time
// (react, react/jsx-runtime, react-dom, react-dom/client, @deepseek-ai/cordis,
// dsh-client-store, dsh-client-ui-slots, dsh-client-ui-primitives,
// dsh-client-ui-dockkit). Anything else must be declared under dsh.client.external.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'

import { build } from 'esbuild'

/** Exact module-table keys the shell seeds; everything else fails resolution. */
const BASELINE_MODULES = [
  'react',
  'react/jsx-runtime',
  'react-dom',
  'react-dom/client',
  '@deepseek-ai/cordis',
  '@deepseek-ai/dsh-client-store',
  '@deepseek-ai/dsh-client-ui-slots',
  '@deepseek-ai/dsh-client-ui-primitives',
  '@deepseek-ai/dsh-client-ui-dockkit',
]

const root = new URL('../', import.meta.url)
const outfile = new URL('dist/client/index.js', root)
const manifest = JSON.parse(await readFile(new URL('package.json', root), 'utf8'))

const result = await build({
  entryPoints: [fileURLToPath(new URL('src/client/index.ts', root))],
  outfile: 'dist/client/index.js',
  bundle: true,
  write: false,
  format: 'cjs',
  platform: 'browser',
  target: 'es2022',
  jsx: 'automatic',
  external: ['@deepseek-ai/*', ...BASELINE_MODULES],
  legalComments: 'none',
  sourcemap: false,
  logLevel: 'warning',
})

const body = result.outputFiles[0].text.replace(/\n?\/\/# sourceMappingURL=.*\s*$/, '')

// `module`/`exports` are factory-locals, exactly as in the in-repo client
// bundles: esbuild's CJS epilogue assigns `module.exports`, and we hand that
// object back to the loader as the bundle's exports.
const wrapped = `window.__ModuleLoader__.load({
\tid: ${JSON.stringify(manifest.name)},
\tfactory: (require) => {
\t\tvar module = { exports: {} };
\t\tvar exports = module.exports;
${body}
\t\treturn module.exports;
\t}
});
`

await mkdir(new URL('dist/client/', root), { recursive: true })
await writeFile(outfile, wrapped)
console.log(`dist/client/index.js  ${(Buffer.byteLength(wrapped) / 1024).toFixed(1)}kb`)
