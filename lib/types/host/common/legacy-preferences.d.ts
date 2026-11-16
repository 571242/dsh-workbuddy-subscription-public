/**
 * One-time import of the preferences earlier releases kept in the harness's own
 * settings document.
 *
 * Before harness 0.1.7 the plugin registered the `dsh-chatgpt-subscription`
 * namespace, so the harness persisted these preferences into
 * `$DSH_HOME/settings.yaml`. That document no longer exists from 0.1.7 on — the
 * plugin owns its storage there — so a generation without the register seam reads
 * the old section once and seeds the plugin document from it. A harness that
 * moved the document itself renames it to `settings.yaml.imported`, which is why
 * both names are read.
 *
 * The section is read from text rather than through a YAML dependency: this
 * package ships no YAML parser, and only its own four shapes ever appear under
 * that key — scalars, one nested map (`contextWindowOverrides`), block sequences
 * (`visibleModelIds`), and inline flow arrays. Anything the reader cannot make
 * sense of is left out, and the schema that validates the document decides what
 * the values mean.
 * @module dsh-chatgpt-subscription/legacy-preferences
 */
/**
 * Read the plugin's preferences out of the settings documents of earlier releases.
 *
 * @param homeDir - Harness home holding the documents; defaults to the live one.
 * @returns The stored preference values, or `undefined` when no document carries
 * a non-empty section for this plugin.
 */
export declare function readLegacyPreferences(homeDir?: string): Promise<Record<string, unknown> | undefined>;
//# sourceMappingURL=legacy-preferences.d.ts.map