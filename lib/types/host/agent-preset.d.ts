/**
 * The `dispatch` agent preset as a runtime declaration.
 *
 * Harness 0.1.7 registers agent presets from a plugin row
 * (`@deepseek-ai/dsh-agent-preset`, whose class calls
 * `ctx.agentPresets.register(config)`) and stopped reading the harness-home
 * `<dshHome>/.agent-presets` directory altogether, so on that generation the
 * file copy `src/host/preset-sync.ts` performs is invisible work. Shipping the
 * row in this plugin's own bundle patch instead is not an option: the package
 * does not exist on the older generations this plugin still supports, and an
 * unresolved non-disabled entry makes 0.1.5/0.1.6's `assertEntriesLoaded` refuse
 * to boot the host. The declaration is therefore created here, at runtime, and
 * only after probing that the running installation has both the row package and
 * a usable `agentPresets` service.
 *
 * `presets/dispatch/` stays the shipped form of the preset: the YAML there is
 * what {@link DISPATCH_PRESET} transcribes, and it is also what every older
 * generation receives as files. A row edit belongs in both places.
 *
 * Nothing here imports `@deepseek-ai/dsh-agent-preset` or
 * `@deepseek-ai/dsh-agent-preset-registry`, not even as a type: neither package
 * exists on the generations this plugin still supports, and one build and one
 * bundle are shared across all of them.
 * @module dsh-chatgpt-subscription/agent-preset
 */
/** The row package whose presence marks a harness that takes presets from a row. */
export declare const PRESET_REGISTRY_PACKAGE = "@deepseek-ai/dsh-agent-preset";
/**
 * The package whose presence marks a harness (>= 0.2.1) that injects the
 * session working directory via `WORKING_DIRECTORY` user context and no longer
 * registers `{{cwd}}` as a `systemPrompt` variable.
 */
export declare const WORKING_DIRECTORY_PACKAGE = "@deepseek-ai/dsh-working-directory";
/** The id the `dispatch` preset is selectable under. */
export declare const DISPATCH_PRESET_ID = "dispatch";
/**
 * One plugin row of a preset declaration: the Loader's own entry shape, minus
 * the expression form `disabled` takes in YAML.
 */
export interface PresetRow {
    /** Row id inside the mounted preset tree. */
    id: string;
    /** Module specifier the row mounts. */
    name: string;
    /** Config for the row's plugin; for a group row, its nested rows. */
    config?: unknown;
    /** Whether the row owns a nested entry list. */
    group?: boolean;
    /** Whether the Loader starts the row. */
    disabled?: boolean;
    /** Service names the row isolates, each mapped to its realm label. */
    isolate?: Record<string, true | string>;
}
/** A preset as the harness's registry accepts one. */
export interface PresetDefinition {
    readonly id: string;
    readonly name?: string;
    readonly description?: string;
    readonly order?: number;
    readonly plugins: readonly PresetRow[];
}
/** The `agentPresets` service, as far as this declaration reads it. */
export interface AgentPresetRegistry {
    /**
     * Register one definition and mount its rows in a fresh scope.
     * @param definition - identity, display fields, and the rows to mount.
     * @returns the disposer that retires the definition and collects the scope.
     */
    register(definition: PresetDefinition): Promise<() => Promise<void>>;
}
/**
 * The plugin-context surface the preset wiring reads: the service lookup, the
 * effect seam that owns the registration's disposer, and the logger.
 */
export interface PresetHost {
    /** Read a service without declaring an injection — here `agentPresets`. */
    get(name: string): unknown;
    /** Register a disposer that runs when this plugin unloads. */
    effect(execute: () => Promise<() => Promise<void>>, label?: string): unknown;
    /** The plugin logger. */
    logger: {
        info(message: string): void;
        warn(message: string): void;
    };
}
/** Whether a bare specifier resolves in the running installation. */
export type SpecifierResolver = (specifier: string) => boolean;
/** What a runtime declaration attempt reported. */
export type PresetInstall = 'registered' | 'legacy';
/**
 * The `dispatch` (调度模式) preset: identity from `presets/dispatch/preset.yml`,
 * rows transcribed from `presets/dispatch/agent.cordis.yml` in the same order.
 *
 * The transcription carries harness 0.1.7's package names — the workflow row
 * mounts `@deepseek-ai/dsh-workflow-ptc`, the spelling 0.1.6 renamed the package
 * to — because this definition only ever reaches a harness that has the row
 * mechanism. `disabled` values are real booleans: the YAML `!!js` form exists
 * for text the Loader evaluates, and nothing evaluates this.
 */
export declare const DISPATCH_PRESET: PresetDefinition;
/**
 * Reconcile {@link DISPATCH_PRESET} with the running harness generation.
 *
 * Harnesses shipping `@deepseek-ai/dsh-working-directory` (>= 0.2.1) provide the
 * session working directory through the `WORKING_DIRECTORY` dynamic context and
 * no longer register `{{cwd}}` on `ctx.systemPrompt`, so keeping `persona.config.suffix`
 * (`Your working directory is {{cwd}}.`) makes `SystemPrompt` throw
 * `unknown prompt variable "{{cwd}}"` at render time. On 0.1.7–0.2.0 that package
 * is absent and `{{cwd}}` is still the only way the persona states the workspace,
 * so the unmodified {@link DISPATCH_PRESET} is returned unchanged.
 * @param resolves - whether a bare specifier resolves in this installation.
 * @returns the preset definition for the running harness generation.
 */
export declare function resolveDispatchPreset(resolves?: SpecifierResolver): PresetDefinition;
/**
 * Declare `dispatch` to the running harness, when the harness has the mechanism.
 *
 * Both halves of the probe matter: the row package is what makes a declarative
 * preset possible at all on a given generation, and the service is what a
 * harness shipping that package provides. A generation with either half missing
 * — every release before 0.1.7 — is reported as `'legacy'`, and the caller keeps
 * copying the bundled tree into the discovery root.
 *
 * Registration is asynchronous, so the report describes the decision rather
 * than its outcome: the effect owns the await, a failure is logged there, and
 * neither the probe nor the effect is allowed to throw at the caller.
 * @param host - plugin context: service lookup, effect seam, and logger.
 * @param resolves - whether a bare specifier resolves in this installation.
 * @returns `'registered'` when this call took the preset, `'legacy'` when the
 * caller still has to copy the bundled tree into the discovery root.
 */
export declare function installDispatchPreset(host: PresetHost, resolves?: SpecifierResolver): PresetInstall;
//# sourceMappingURL=agent-preset.d.ts.map