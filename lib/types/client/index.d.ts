import type { Context as ClientContext } from '@deepseek-ai/cordis';
import { type LocaleKey } from './locales.ts';
import { type AntigravityLocaleKey } from './antigravity/locales.ts';
import { type ClaudeLocaleKey } from './claude/locales.ts';
import { type CommandCodeLocaleKey } from './command-code/locales.ts';
import { type KimiCodeLocaleKey } from './kimi-code/locales.ts';
import { type MinimaxCodeLocaleKey } from './minimax-code/locales.ts';
import { type WorkBuddyLocaleKey } from './workbuddy/locales.ts';
import { type GlmCodingPlanLocaleKey } from './glm-coding-plan/locales.ts';
import { type OllamaLocaleKey } from './ollama/locales.ts';
import { type StepCodeLocaleKey } from './step-code/locales.ts';
import { type ProgressUpdatesLocaleKey } from './progress-updates/locales.ts';
declare module '@deepseek-ai/dsh-client-ui-slots' {
    /**
     * Every namespace this plugin registers, typed by that line's own dictionary.
     *
     * These were `any`, which made a renamed or misspelled key invisible to the
     * compiler: the card rendered the key name itself and only a human noticed.
     * Each line exports its key union beside its dictionaries, so this map is now
     * the compile-time half of the locale contract.
     */
    interface LocaleNamespaceMap {
        'dsh-chatgpt-subscription': LocaleKey;
        'dsh-antigravity': AntigravityLocaleKey;
        'dsh-claude': ClaudeLocaleKey;
        'dsh-command-code': CommandCodeLocaleKey;
        'dsh-kimi-code': KimiCodeLocaleKey;
        'dsh-minimax-code': MinimaxCodeLocaleKey;
        'dsh-workbuddy': WorkBuddyLocaleKey;
        'dsh-glm-coding-plan': GlmCodingPlanLocaleKey;
        'dsh-ollama': OllamaLocaleKey;
        'dsh-step-code': StepCodeLocaleKey;
        'dsh-progress-updates': ProgressUpdatesLocaleKey;
    }
}
export declare const inject: string[];
export declare function apply(ctx: ClientContext): void;
//# sourceMappingURL=index.d.ts.map