/**
 * Subscribe a component to one settings namespace. Shared by the settings card
 * and the composer chip so both read the same authoritative section.
 */
import { useEffect, useState } from 'react'

import type { ConfigSnapshot } from './card-model.js'
import type { SettingsScope, SettingsScopeSnapshot } from './scope.js'

/**
 * Track one namespace's snapshot across React renders.
 * @param scope - the scope bound on the owning plugin's fiber.
 * @returns the current snapshot, replaced on every committed change.
 */
export function useSettingsSnapshot(
  scope: SettingsScope<ConfigSnapshot>,
): SettingsScopeSnapshot<ConfigSnapshot> {
  const [snapshot, setSnapshot] = useState<SettingsScopeSnapshot<ConfigSnapshot>>(() =>
    scope.getSnapshot(),
  )
  useEffect(() => {
    // Re-read before subscribing: a change committed between render and effect
    // would otherwise be missed until the next notification.
    setSnapshot(scope.getSnapshot())
    return scope.subscribe(() => setSnapshot(scope.getSnapshot()))
  }, [scope])
  return snapshot
}

/** A ticking clock, so countdowns re-render once per second. */
export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState<Date>(() => new Date())
  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), intervalMs)
    return () => window.clearInterval(timer)
  }, [intervalMs])
  return now
}
