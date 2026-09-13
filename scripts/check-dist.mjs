// `dist/` is committed so that `dsh plugin add github:…` works in one command:
// a git dependency's `prepare` script is exactly what pnpm ≥ 10 refuses to run
// until it is allowlisted, so shipping the built output removes the step instead
// of documenting it.
//
// The trade-off is that the committed artifact can drift from the sources. This
// gate is the guard. It runs AFTER `npm run build` and asks one question: is the
// artifact we are about to publish — the one in the index — exactly what the
// sources produce right now?
//
//   - an unstaged change under dist/ means the build output is not what will be
//     committed;
//   - an untracked file under dist/ means it would not be published at all;
//   - a file that changes only once committed (index vs HEAD) is fine here: that
//     is the normal "stage, then commit" step, and comparing against HEAD would
//     fail on every legitimate rebuild.
import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('..', import.meta.url))

if (!existsSync(new URL('../.git', import.meta.url))) {
  console.log('check-dist: skipped (not a git checkout)')
  process.exit(0)
}

/** Run one git query; a missing git binary is a skip, not a failure. */
function git(args) {
  return execFileSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
}

let unstaged
let untracked
try {
  unstaged = git(['diff', '--name-only', '--', 'dist'])
  untracked = git(['ls-files', '--others', '--exclude-standard', '--', 'dist'])
} catch (error) {
  console.log(`check-dist: skipped (git unavailable: ${error instanceof Error ? error.message : String(error)})`)
  process.exit(0)
}

const problems = []
if (unstaged.trim().length > 0) problems.push('not staged:\n' + unstaged.trimEnd())
if (untracked.trim().length > 0) problems.push('untracked (would not be published):\n' + untracked.trimEnd())

if (problems.length > 0) {
  console.error(
    'check-dist: the published dist/ must be exactly what the sources build.\n' +
      problems.join('\n') +
      '\n\nRun `npm run build`, then `git add dist` and commit it.',
  )
  process.exit(1)
}
console.log('check-dist: dist/ is staged and matches a fresh build')
