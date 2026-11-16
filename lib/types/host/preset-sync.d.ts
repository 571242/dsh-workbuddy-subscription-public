/**
 * Get this plugin's bundled agent presets in front of the running harness:
 * either declared at runtime, or copied into the harness-home preset root.
 *
 * DSH discovers agent presets only from configured roots, the shipped
 * `agent-presets` package's own `presets/` directory, and
 * `<dshHome>/.agent-presets`. A plugin package cannot register a root by
 * existing, so the way a preset travels with an npm install is to ship the
 * directory inside the package and copy it into the harness-home root at
 * startup — the same arrangement `@linxin666/dsh-liangshen` uses.
 *
 * Copy is per-preset-directory and idempotent: a target tree byte-identical to
 * the bundled one is skipped, otherwise the whole tree is copied and any
 * target-only files are pruned. Preset ids listed in `retire` are removed
 * when the bundle no longer ships them. Directories this plugin does not own —
 * presets the user wrote by hand, or another plugin's — are never touched.
 *
 * `fs.cpSync({ recursive: true })` is deliberately avoided: on Node 22 for
 * Windows it can abort the process with STATUS_STACK_BUFFER_OVERRUN when the
 * source path contains non-ASCII characters (nodejs/node#54476). The copy is
 * per-entry instead, which also lets source mtimes ride along.
 *
 * A preset row names the package it mounts, so a name the running installation
 * does not ship makes the whole preset unresolvable. Text naming a package the
 * harness renamed is therefore reconciled with the installation before it is
 * compared or written.
 *
 * Harness 0.1.7 stopped reading that root and takes presets from a plugin row
 * instead, which this package declares at runtime
 * (`src/host/agent-preset.ts`, because shipping the row itself would break the
 * generations that do not have it). {@link installBundledPresets} is the one
 * entry point for both mechanisms: it copies the tree only when that runtime
 * declaration was unavailable, so a harness that reads no discovery root is
 * never written to.
 * @module dsh-chatgpt-subscription/preset-sync
 */
import type { PresetHost, PresetInstall } from './agent-preset.ts';
/** The preset directory this package ships. */
export declare const BUNDLED_PRESET_IDS: readonly string[];
/**
 * Candidate directories where the running harness or profile packages reside.
 * @param entryScript - harness CLI entry script, defaults to this process's.
 */
export declare function candidatePackageRoots(entryScript?: string | undefined): string[];
/**
 * Whether a package is installed in any candidate node_modules tree.
 * Matches DSH agent-presets' own discovery check.
 */
export declare function packageInstalled(specifier: string, roots?: readonly string[]): boolean;
/**
 * Whether a bare specifier resolves from this module in the running
 * installation. A harness whose Node build exposes no `import.meta.resolve`
 * or whose plugin is executed from outside the profile tree falls through to
 * checking candidate `node_modules` trees across the running harness home.
 * @param specifier - bare package specifier.
 * @returns whether the specifier resolves.
 */
export declare function resolvesFromHere(specifier: string): boolean;
/**
 * Point every renamed package name at the spelling this installation ships.
 *
 * A name that still resolves is left alone, and so is a rename whose
 * replacement does not resolve: with neither spelling present the preset is
 * unresolvable either way, and rewriting would only hide which name was tried.
 * @param content - bundled preset file text.
 * @param resolves - whether a bare specifier resolves in this installation.
 * @returns the text to write, equal to `content` when no rename applies.
 */
export declare function reconcilePackageNames(content: string, resolves: (specifier: string) => boolean): string;
/**
 * Reconcile one bundled preset file with the packages this installation ships:
 * a renamed package takes the spelling it carries, and a row it cannot mount is
 * disabled rather than left to mark the whole preset unresolvable.
 * @param content - bundled preset file text.
 * @param resolves - whether a bare specifier resolves in this installation.
 * @returns the text to write.
 */
export declare function reconcilePreset(content: string, resolves: (specifier: string) => boolean): string;
/** One preset file's text, rewritten for the running installation. */
export type PresetFileRewrite = (relativePath: string, content: string) => string;
/** Rewrite bundled preset text for the packages this installation ships. */
export declare const rewritePresetFile: PresetFileRewrite;
/** One sync run's outcome, grouped for diagnostics. */
export interface PresetSyncResult {
    /** Preset ids whose tree was (re)written this run. */
    synced: string[];
    /** Preset ids already current — nothing copied. */
    current: string[];
    /** Preset ids that failed, with the underlying error message. */
    failed: {
        id: string;
        error: string;
    }[];
    /** Previously bundled preset ids removed from the target root this run. */
    retired: string[];
}
/**
 * The package root, found by walking up from this module to the nearest
 * `package.json`.
 *
 * A fixed `../presets/` is wrong here: this module sits two levels below the
 * package root under `src/host/` but is bundled flat into `lib/`, so the same
 * relative specifier resolves to a different directory in each layout. Walking
 * up is layout-independent — it holds under `src/`, under the bundled
 * `lib/`, and when the package is reached through a pnpm symlink or a
 * Windows junction.
 * @returns absolute package root path.
 */
export declare function packageRoot(): string;
/** Absolute path of the `presets/` directory shipped inside this package. */
export declare function bundledPresetsRoot(): string;
/** The harness-home agent-presets discovery root this plugin syncs into. */
export declare function presetTargetRoot(home: string): string;
/**
 * Copy `sourceDir` into `targetDir` idempotently.
 * @param sourceDir - bundled preset directory.
 * @param targetDir - discovery-root directory for the same preset id.
 * @param rewrites - replacement text by path relative to `sourceDir`; a rewritten file is compared by content, since its target carries no source mtime.
 * @returns whether anything was written.
 */
export declare function syncOnePreset(sourceDir: string, targetDir: string, rewrites?: ReadonlyMap<string, string>): 'synced' | 'current';
/**
 * Sync every bundled preset into `targetRoot`, then remove ids named in
 * `retire` that the bundle no longer ships. Only those exact ids are removed;
 * every other target directory is left alone.
 * @param sourceRoot - this package's bundled `presets/` directory.
 * @param targetRoot - harness-home agent-presets discovery root.
 * @param retire - previously bundled preset ids to remove when absent from the source.
 * @param rewrite - rewrites preset text for the running installation; omission copies the bundle verbatim.
 * @returns the grouped outcome of the run.
 */
export declare function syncPresetTrees(sourceRoot: string, targetRoot: string, retire?: readonly string[], rewrite?: PresetFileRewrite): PresetSyncResult;
/**
 * Make this package's bundled agent presets available on the running harness.
 *
 * The harness-home copy is the mechanism for every generation before 0.1.7,
 * and the fallback for one whose runtime declaration is missing or unusable.
 * It is skipped entirely when the declaration already took the presets: a
 * harness that registers presets from a plugin row reads no discovery root, so
 * the copy would write files nothing reads.
 * @param host - plugin context: the effect seam and the logger.
 * @param install - what the runtime declaration attempt reported.
 * @returns the effect body's disposer, for `ctx.effect`.
 */
export declare function installBundledPresets(host: PresetHost, install: PresetInstall): () => void;
//# sourceMappingURL=preset-sync.d.ts.map