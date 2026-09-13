import type { Context as ClientContext } from '@deepseek-ai/cordis';
export declare const NAMESPACE = "peak-whale";
export declare const inject: string[];
export type { SettingsScope, SettingsScopeBinder, SettingsScopeSnapshot, } from './scope.js';
/** The composer tool row slot declared by `@deepseek-ai/dsh-client-ui-conversation`. */
export declare const CHIP_SLOT = "conversation.input.left";
/** The plugin-configuration card slot declared by the settings-plugins package. */
export declare const CARD_SLOT = "settings.plugin.item";
export declare function apply(ctx: ClientContext): void;
