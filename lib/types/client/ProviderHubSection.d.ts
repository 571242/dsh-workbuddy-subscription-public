import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import { NS } from './locales.ts';
type Props = PropsRuntime<'settings.section'> & PropsLocale<typeof NS> & {
    onModelChange?: () => void;
};
/**
 * Single settings page hosting every subscription provider. The opening
 * screen is the overview — one card per line with its enable switch and
 * account count — and picking a card replaces it with that line's detail
 * page under a back bar. Only the active view is mounted, mirroring the
 * shell's behavior of mounting just the selected settings page (each
 * provider section refetches its status on mount).
 */
export declare function ProviderHubSection({ t, onModelChange, ...runtime }: Props): React.JSX.Element;
export {};
//# sourceMappingURL=ProviderHubSection.d.ts.map