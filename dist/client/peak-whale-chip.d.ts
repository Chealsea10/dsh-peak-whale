/**
 * The composer chip: the whale lives in the composer tool row next to the model
 * selector, so the current tariff is visible without opening Settings, and one
 * click opens the zone picker and the account balance.
 *
 * It registers into the `conversation.input.left` slot declared by
 * `@deepseek-ai/dsh-client-ui-conversation` — a session-scoped list slot, so the
 * chip appears once per Session and must be a React component like any other
 * occupant.
 */
import { type ReactElement } from 'react';
import { type ConfigSnapshot } from './card-model.js';
import type { SettingsScope } from './scope.js';
/**
 * Build the chip component bound to one namespace scope.
 * @param scope - the settings scope bound on the owning plugin's fiber.
 * @returns the React component to register into `conversation.input.left`.
 */
export declare function createPeakWhaleChip(scope: SettingsScope<ConfigSnapshot>): () => ReactElement | null;
