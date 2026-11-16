export declare const POOL_STYLE_ID = "dsh-provider-pool-style";
/**
 * Styles the shared account-pool card adds on top of the existing provider
 * stylesheets: the badge variants no single provider tab owned before.
 *
 * Additive on purpose — the shared `.dsha-*` block and each provider's own
 * tweaks keep living in their own modules, in the order the client installs
 * them, so nothing that already rendered changes appearance.
 */
export declare function installPoolStyles(): void;
//# sourceMappingURL=styles.d.ts.map