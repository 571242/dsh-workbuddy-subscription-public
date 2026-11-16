/**
 * Shared installer for every stylesheet this plugin injects.
 *
 * The DSH client module system books stylesheet ownership by attribute. When a
 * package's factory materializes it claims every untagged `<style>` in the
 * document for itself (`style:not([data-plugin])` gains that package's id); when
 * a package reloads, is replaced at a new revision, or is pruned from the graph,
 * it removes every tag carrying its id. A sheet injected as a plain
 * `<style id=…>` therefore gets claimed by whichever sibling package
 * materializes next and is then deleted as that sibling's bookkeeping — which is
 * how the whole shared provider design system (`.dsha-*`) disappeared from the
 * settings page while the already-tagged chat-only `…/main` sheet survived.
 *
 * Tagging every sheet with this package's own `data-plugin` and a unique
 * `data-plugin-css` keeps the module system from attributing it to another
 * package, and re-running the installer on every `apply()` restores it after one
 * of our own reloads. The tag is owned by the document: the installer refreshes
 * stale text but never removes the element, so a stale fiber's teardown can
 * never take the styles away.
 */
export declare const PLUGIN_ID = "@eddyskywalker/dsh-chatgpt-subscription";
export declare function installPluginStyle(name: string, css: string, legacyId?: string): () => void;
//# sourceMappingURL=plugin-style.d.ts.map