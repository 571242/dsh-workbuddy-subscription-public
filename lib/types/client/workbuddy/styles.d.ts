export declare const STYLE_ID = "dsh-workbuddy-settings-style";
/**
 * WorkBuddy-only additions to the shared settings design system.
 *
 * The base control styles (`.dsha-page`, `.dsha-group`, `.dsha-models`, the
 * account card, …) come from the stylesheet the sibling routes install, in the
 * same order the client installs them, so this file declares only what stays
 * unique to this card: the mono credential paths and the login-progress line.
 *
 * Everything this tab used to declare locally — the per-model capability line
 * and the account-region headings — is gone: the model pill is name-only like
 * every sibling tab, and the account card is the shared one.
 */
export declare function installWorkBuddyStyles(): void;
//# sourceMappingURL=styles.d.ts.map