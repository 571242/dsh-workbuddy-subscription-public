/**
 * Install the ChatGPT tab's stylesheet as a document-owned, never-removed
 * `<style>` element.
 *
 * The other client stylesheets this plugin installs are additive: their
 * installers no-op when the element already exists and their disposers do
 * nothing, so a restart can never take the styles away. This one used to
 * create *and remove* its element, and the dedupe handoff was racy: on a
 * plugin fiber restart (config change, dependency reload, HMR) the new fiber
 * ran `apply()` before the old fiber's async unload removed the element —
 * dedupe saw the old tag, returned a no-op disposer, and the old unload then
 * deleted the only copy. Every later restart kept returning the no-op, so the
 * stylesheet never came back and the settings page rendered unstyled.
 *
 * Fix: treat the tag as owned by the document rather than by one fiber —
 * create it when missing, refresh `textContent` when a rebuilt bundle ships
 * different CSS (HMR), and return a no-op disposer unconditionally, matching
 * the additive installers.
 *
 * Every other sheet this plugin injects now goes through the same installer
 * (`installPluginStyle`), which additionally stamps the ownership attributes
 * the client module system needs so the tag cannot be claimed by, and later
 * removed with, some other package.
 */
export declare function installStyles(): () => void;
//# sourceMappingURL=styles.d.ts.map