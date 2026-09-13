# dsh-peak-whale 🐋

DeepSeek API **peak/off-peak pricing awareness** for [DeepSeek Harness (dsh)](https://github.com/deepseek-ai/deepseek-harness).

The DeepSeek open platform bills inference at **half price outside peak hours**. Inspired by the
[DeepSeekStatus](https://github.com/owenzhao/DeepSeekStatus) macOS menu bar app, this plugin moves
that whale from your menu bar into your agent's toolbox: the agent can check the current tariff,
see a countdown to the next switch, read your balance, and — most usefully — **schedule batch work
to run inside the cheap window**.

## Tools

| Tool | What it does |
| --- | --- |
| `deepseek_peak_status` | Current period (peak / off-peak), price multiplier, countdown to the next switch, optional account balance. |
| `deepseek_next_offpeak` | The next N off-peak windows as UTC intervals (plus a `schedule_create`-ready `LocalAtInput`), so the agent can plan half-price runs. |

Example rendered output of `deepseek_peak_status`:

```
🐋 DeepSeek API: PEAK (×1) — 2026-09-14 10:23 (Asia/Shanghai)
Next switch → off-peak at 2026-09-14 12:00 (Asia/Shanghai), in 01:36:59
Balance (CNY): total 42.13, granted 0.00, topped up 42.13
```

Example prompts that make use of it:

- «Сейчас дорого? Если да — запланируй прогон тестов на ближайшее дешёвое окно.»
  The agent calls `deepseek_next_offpeak`, then the built-in `schedule_create`
  (`kind: 'at'`, `at: windows[0].startUtc`) with your prompt.
- «Проверь баланс и скажи, успеем ли докрутить индексацию до конца off-peak.»

## Web UI

The plugin ships two halves in one package: the Node half (tools, above) and a browser half with
**two surfaces**, both declared through the package's `dsh.client` field and its `./client` export.

### The composer chip

A compact chip sits in the composer tool row — the row with the model selector, plan/attach
controls — registered into `conversation.input.left`, the slot
`@deepseek-ai/dsh-client-ui-conversation` declares for exactly this. It shows the whale, the
countdown to the next switch, and the account balance, so the tariff is readable without opening
anything:

```
🐋💤 07:44   $0.53 · ¥67.81
```

Clicking it opens a panel with the full countdown, the current time in your zone, a **time-zone
picker**, and the balance with a refresh action. The chip is session-scoped, so it appears once per
Session; a composition without the conversation UI simply never shows it (`slots.inject` waits for
the declaration instead of failing the load).

### The settings card

A **Peak Whale card** under *Settings → Plugins* (`settings.plugin.item`), for the full
configuration: both time zones, peak windows with client-side validation, multipliers, the API key,
and the balance. Fields carrying a user override show an *overridden* badge with a reset action, and
the form is read-only when the connection keeps preferences process-local.

### Time zones: schedule vs display

The two are deliberately separate, and conflating them silently corrupts the tariff:

- **`timeZone` is the schedule zone** — the zone DeepSeek's peak windows are written in. The
  platform publishes them in Beijing time, so this stays `Asia/Shanghai` unless DeepSeek changes its
  schedule. Pointing it at your own city would reinterpret `09:00-12:00` as *your* morning and shift
  which hours count as peak.
- **`displayTimeZone` is display-only** — the zone times are *shown* in. Unset, the UI renders in
  the browser's own zone, so a Moscow user immediately reads their own clock; setting it (the chip's
  picker does) also makes the agent's output quote that zone.

So the chip happily shows `Сейчас 20:15 (Europe/Moscow)` while announcing the switch at `04:00` —
because 04:00 in Moscow *is* 09:00 in Beijing, where the peak actually starts. Classification always
runs on the schedule zone; `npm run client-check` asserts that changing the display zone cannot
change the classified period.

### The balance

`api.deepseek.com/user/balance` answers CORS (it echoes the page origin and allows the
`authorization` header), so the browser reads the balance directly with the key from this plugin's
settings section and caches it for a minute. Two consequences worth stating plainly:

- the key is **not** declared `role('secret')`, because a redacting wire surface would strip it
  before the browser could use it. It is already stored verbatim in the profile's settings file, and
  the Web UI is loopback-only — but if you would rather the key never reach the page, remove it from
  this plugin and ask the agent for `deepseek_peak_status` with `includeBalance` instead, which
  fetches server-side;
- with no key configured the UI says so instead of showing a blank.

### Two contracts that are easy to get wrong

Both are load-bearing, and both are now gated by `npm run client-check`:

- **The client half must be a lazy-CJS factory bundle.** The loader fetches a package's `./client`
  export as a *classic* `<script>` and runs it, so the artifact must call
  `window.__ModuleLoader__.load({ id: '<package name>', factory: (require) => exports })`. A plain
  esbuild CJS bundle (`module.exports = …`) throws `ReferenceError: module is not defined` and
  registers nothing — the package appears to install fine and the surfaces simply never exist.
  `scripts/build-client.mjs` emits the required wrapper.
- **A slot occupant must be a React component.** The renderer mounts entries with
  `jsx(entry.component, props)`, so a class exposing an imperative `render(): HTMLElement` is called
  as a plain function by React and throws. Both surfaces here are function components that subscribe
  to their settings scope themselves (`getSnapshot()` + `subscribe()`), which is also the only
  correct read path: a `SettingsScope` has no `value`/`user` properties.

The host half reaches the dsh `settings` service through `ctx.inject(['settings'], …)`, never by
reading `ctx.settings` directly: an undeclared service read throws
`cannot get property "settings" without inject`, which fails the whole plugin tree and takes the
entire dsh boot down with it. Through `ctx.inject` the namespace is optional — without a settings
provider the tools still register.

## Pricing rule

Defaults follow DeepSeekStatus: **peak = Mon–Fri 09:00–12:00 and 14:00–18:00 Beijing time**;
everything else (nights, weekends, the lunch break) is half price. Chinese public holidays are
**not** accounted for. If DeepSeek changes the schedule, adjust `peakWindows` in the config — no
code edit needed.

## Configuration

```yaml
config:
  timeZone: 'Asia/Shanghai'      # SCHEDULE zone: where the peak windows are written (DeepSeek uses Beijing)
  displayTimeZone: ''            # DISPLAY zone for shown times; '' = the browser's own zone
  peakWindows: ['09:00-12:00', '14:00-18:00']
  peakWeekdaysOnly: true
  peakMultiplier: 1
  offPeakMultiplier: 0.5
  apiKey: ''                     # optional; enables the balance in the tools and in the UI
  apiBase: 'https://api.deepseek.com'
```

> The API key is stored in the dsh profile config. The tools send it only to `apiBase`'s
> `/user/balance` endpoint; the Web UI also reads the balance with it (see
> [The balance](#the-balance)). Leave it empty if you don't need balance display.

## Install

`dsh plugin` is a thin **pnpm forwarder**: it runs `pnpm <args…>` inside the profile directory, so
pnpm has to be on PATH — otherwise `dsh plugin` exits 127 with `pnpm not found on PATH`. Node ships
corepack, so:

```sh
corepack enable pnpm      # or: npm install -g pnpm
```

`--profile` is **required**; plugin management has no default profile. `dsh plugin add …` on its own
fails with `error: required option '--profile <name>' not specified`.

The loader consumes built artifacts and `dist/` is gitignored, so build once first:

```sh
npm install && npm run build
```

Then, **from this directory**, add the plugin to the profile that serves your web UI:

```sh
dsh plugin --profile web add .
```

Use `.` (or an absolute path) rather than the folder name. Relative path specs are anchored to the
directory you invoke `dsh` from, so `./dsh-peak-whale` typed from *inside* this checkout would point
at a nested directory that does not exist.

On success `dsh` reconciles the profile's `dsh.profile.bundles` list against the installed state: a
dependency that declares `dsh.bundle` — this package declares `cordis.patch.yml` — is appended as a
profile layer automatically, so no manual manifest editing. A dependency without `dsh.bundle` is
installed as a plain library and reported with a warning. Restart `dsh web` to pick up the new layer.

**From GitHub** the artifact is built on install instead:

```sh
dsh plugin --profile web add github:Chealsea10/dsh-peak-whale#v0.1.0
```

`dist/` is not committed, so the install runs this package's `prepare` script — and pnpm ≥ 10 blocks
a git dependency's build scripts until it is allowlisted. The first attempt therefore stops with:

```
Error: ERR_PNPM_GIT_DEP_PREPARE_NOT_ALLOWED
  The git-hosted package "dsh-peak-whale@0.1.0" needs to execute build scripts but is not
  in the "allowBuilds" allowlist.
```

Copy the exact key pnpm prints into the profile's `pnpm-workspace.yaml` and re-run the same command
(pnpm keys the entry by the resolved tarball URL, so the pinned ref is part of it):

```yaml
allowBuilds:
  dsh-peak-whale@https://codeload.github.com/Chealsea10/dsh-peak-whale/tar.gz/<resolved-sha>: true
```

Installing from a local checkout instead (see above) skips this: you build once yourself and the
directory is linked, never packed.

The plugin only appears in dsh **after** one of the steps above — installing registers its bundle
(`cordis.patch.yml`) in the dsh profile; from then on both halves load automatically on every
`dsh web` start, no web-app rebuild needed.

**Local development without installing** — build, copy `cordis.example.yml`, point its `name` at a
**`file://` URL to `dist/index.js`** (not `src/index.ts`: the sources use NodeNext `.js` specifiers
that Node resolves literally and cannot map back to `.ts`), then:

```sh
dsh web --patch /absolute/path/to/dsh-peak-whale/cordis.example.yml
```

Use the URL form rather than a bare filesystem path: dsh `0.1.0-rc.x` rejects the latter with
`ERR_UNSUPPORTED_ESM_URL_SCHEME: Received protocol 'c:'`, while `0.1.5-rc.1` accepts both. On Windows
that is `file:///C:/path/to/dsh-peak-whale/dist/index.js`.

Launcher flags must precede the web app's own flags, so keep `--patch` before `--port`/`--no-open`
(`dsh web --no-open --port 3099 --patch …` fails with `unknown option '--patch'`).

### dsh version

Install into the profile served by the `dsh` you actually run — check `dsh --version` first, and be
aware a machine can carry several installs (a global npm one and an `npx` one, for example) whose
profile directories are shared but whose package versions are not.

The web config card needs a host that ships `settings.installSection`, i.e. **`0.1.5-rc.1` or
newer**; `0.1.0-rc.x` exposes `register`/`get`/`update`/`replace`/`mutate` only. On such a host the
plugin degrades on purpose — both tools still register, and it logs
`this host's settings service has no installSection (dsh 0.1.0-rc.x)` instead of failing. This was
verified by booting `0.1.0-rc.7` against the built plugin: tools registered, warning logged, no
failure.

## Development

```sh
npm install
npm run verify        # build + host/client typecheck, pricing assertions, tool smoke test, client gate
npm run browser-check # optional: real-browser check against a running `dsh web`
```

Layout:

- `src/pricing.ts` — dependency-free tariff math (any IANA zone, DST-aware), including the
  schedule/display zone split;
- `src/render.ts` — model/human-facing rendering of the tools' canonical values;
- `src/balance.ts` — `GET /user/balance` client (host side);
- `src/index.ts` — host half: tool registration and the settings namespace;
- `src/client/` — browser half: `card-model.ts` (pure logic), `timezones.ts` (zone catalogue),
  `balance-client.ts` (browser balance read), `i18n.ts`, `use-scope.ts` (scope subscription hooks),
  `zone-select.tsx` (shared picker), `peak-whale-card.tsx`, `peak-whale-chip.tsx`, and
  `index.ts` (scope binding + the two slot registrations); bundled by esbuild into
  `dist/client/index.js`.

Verification layers, all wired into `npm run verify`:

- `npm run build` — `tsc` for the host **excluding** `src/client` (so a `tsc` pass can never
  overwrite the bundle with unbundled ESM), `tsc` declarations for the client half, then the client
  bundle last;
- `npm run selfcheck` — ~40 known-instant cases (Mon/Sun series, DST in Berlin, degenerate configs,
  bad input, rendering) against the compiled pure modules;
- `npm run smoke` — runs `apply()` against a **cordis-faithful** fake context: undeclared service
  access throws and `ctx.inject` is modelled as the deferred consumer it is. Covers the
  no-settings-provider, settings-provider, and old-host-without-`installSection` compositions,
  executes both tools and validates their arguments and canonical outputs with dsh-tools' own JSON
  Schema validator, and asserts that a committed settings change actually moves the zone the tools
  use;
- `npm run client-check` — executes `dist/client/index.js` the way the client module loader does
  (classic script, baseline module table) and drives both registered surfaces the way the slot
  renderer does (`jsx(component, props)`, plain function call). Fails on a bundle that never
  registers, on a bundle requiring a module outside the shell's baseline, on an `apply()` reading an
  undeclared service, on a surface that is not a React component, on a missing Moscow/Shanghai zone
  option, and on a display zone that changes the classified period. Accepts an optional path
  argument, so it can also be pointed at the exact bytes a running server serves:
  `node scripts/client-check.mjs /tmp/served-client.js`;
- `npm run browser-check` — opt-in, needs a running `dsh web` composing this plugin plus Playwright
  (`PW_PORT`, `PW_TOKEN`, optionally `PW_PLAYWRIGHT`/`PW_CHANNEL`). Opens the UI, finds the composer
  chip, opens its panel, and reports the chip text, the zone options, the selected zone and the
  balance line; fails on any page error or console error.

### Verified against

Checked against the installed dsh `0.1.5-rc.1`: the composer chip and the settings card both mount in
a real browser with live countdowns and no console or page errors, the chip auto-selects the
browser's own zone (`Europe/Moscow` on the machine this was verified on) while the schedule zone
stays `Asia/Shanghai`, the balance renders in both surfaces from a configured key, the plugin tree
boots with the settings service present, and the tools load with and without it. The bundle the
running server actually serves was fed back through `client-check` as well, so the verified artifact
is the delivered one, not just the local build.

Checked against `0.1.0-rc.7` (an older install that bundles `dsh-*-0.1.0-rc.8`): boot succeeds, both
tools register, and the missing-`installSection` warning is logged instead of an error. Its
`settings.plugin.item` slot contract is identical (`keyed`, `scope: root`, empty owner props), so the
card would render there too; only the namespace behind it is unavailable.

The settings and slot **declaration** packages are declared locally rather than imported. They do
exist on npm, but only as `0.0.1-rc.x` placeholders (and the published `dsh-client-ui-slots` has no
`./client` export), so typing against them would pin this plugin to a different API than the
`0.1.5-rc.1` build it actually runs against. The surfaces used here were taken from that runtime's
own declarations, and `src/client/index.ts` plus the `settings` augmentation in `src/index.ts` are
the only places that would need touching if they shift.

> dsh is a developer preview: "there will be compatibility-breaking changes". Pin versions and
> re-run `npm run verify` after upgrading dsh.

## License

MIT
