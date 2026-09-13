// Source-level gate for the files that touch @deepseek-ai packages.
//
// `npm run build` already typechecks both halves against the installed peer
// packages; this pass needs no type information at all, so it still runs (and
// still catches a syntax error or a renamed entry point) in a checkout where
// those peers are absent. Dependency-free modules (pricing, render, card-model)
// get a real strict typecheck in the selfcheck script.
import { existsSync, readFileSync } from 'node:fs'
import ts from 'typescript'

const files = [
  'src/index.ts',
  'src/balance.ts',
  'src/client/index.ts',
  'src/client/scope.ts',
  'src/client/i18n.ts',
  'src/client/timezones.ts',
  'src/client/balance-client.ts',
  'src/client/use-scope.ts',
  'src/client/zone-select.tsx',
  'src/client/peak-whale-card.tsx',
  'src/client/peak-whale-chip.tsx',
]

const missing = files.filter((file) => !existsSync(file))
if (missing.length > 0) {
  console.error(`parse-check: declared source entry missing: ${missing.join(', ')}`)
  process.exit(1)
}

for (const file of files) {
  const source = readFileSync(file, 'utf8')
  const result = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.NodeNext,
      target: ts.ScriptTarget.ES2022,
      jsx: ts.JsxEmit.ReactJSX,
    },
    reportDiagnostics: true,
    fileName: file,
  })
  const diagnostics = (result.diagnostics ?? []).map((d) =>
    `${file}: ${ts.flattenDiagnosticMessageText(d.messageText, '\n')}`,
  )
  if (diagnostics.length > 0) {
    console.error(diagnostics.join('\n'))
    process.exit(1)
  }
}
console.log('parse-check: dsh-facing entry files parse cleanly')
