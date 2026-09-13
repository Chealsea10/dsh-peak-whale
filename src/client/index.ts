import type { Context as ClientContext } from '@deepseek-ai/cordis'

import type { ConfigSnapshot } from './card-model.js'
import { createPeakWhaleCard } from './peak-whale-card.js'
import { createPeakWhaleChip } from './peak-whale-chip.js'
import type { SettingsScopeBinder } from './scope.js'

// The settings and slot declaration packages are not dependencies of this
// plugin, so their surfaces are typed locally to the shapes published by the
// dsh build this plugin targets (see ./scope.ts). Cross-plugin collaboration
// still goes through cordis services: no value import from another plugin
// exists (bundle-purity gate), and both surfaces draw their own DOM instead of
// importing the settings-plugins card chrome.

export const NAMESPACE = 'peak-whale'

export const inject = ['slots', 'locale', 'settingsScope']

export type {
  SettingsScope,
  SettingsScopeBinder,
  SettingsScopeSnapshot,
} from './scope.js'

interface SlotsService {
  /**
   * Run `callback` once the named slot is declared by its owner. The callback
   * returns a disposer (or an iterable of them).
   */
  inject(key: string, callback: () => unknown): unknown
  /** Register one entry into an already-declared slot. */
  register(options: Record<string, unknown>, component: unknown): () => void
}

/** The composer tool row slot declared by `@deepseek-ai/dsh-client-ui-conversation`. */
export const CHIP_SLOT = 'conversation.input.left'

/** The plugin-configuration card slot declared by the settings-plugins package. */
export const CARD_SLOT = 'settings.plugin.item'

export function apply(ctx: ClientContext): void {
  const host = ctx as ClientContext & {
    settingsScope: SettingsScopeBinder
    slots: SlotsService
  }

  // Bound here, on this plugin's fiber, so the scope's disposer rides our unload.
  const scope = host.settingsScope.bind<ConfigSnapshot>({ namespace: NAMESPACE })

  // Surface 1: the whale in the composer tool row, next to the model selector.
  // `slots.inject` waits for the declaration, so a composition without the
  // conversation UI simply never shows the chip instead of failing the load.
  host.slots.inject(CHIP_SLOT, () =>
    host.slots.register(
      {
        name: CHIP_SLOT,
        id: NAMESPACE,
        order: 10,
        locale: NAMESPACE,
      },
      createPeakWhaleChip(scope),
    ),
  )

  // Surface 2: the full configuration card under Settings -> Plugins.
  host.slots.inject(CARD_SLOT, () =>
    host.slots.register(
      {
        name: CARD_SLOT,
        key: NAMESPACE,
        locale: NAMESPACE,
      },
      createPeakWhaleCard(scope),
    ),
  )
}
