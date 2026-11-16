import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { PluginStatusDto, QuotaWindowDto } from '../shared/contracts.ts';
import { NS } from './locales.ts';
type Props = PropsRuntime<'settings.section'> & PropsLocale<typeof NS>;
type BusyAction = 'login' | 'token' | 'quota' | 'reset-credit' | 'test' | 'logout' | 'preferences' | 'set-primary' | 'delete' | 'clear-cooldown' | 'strategy' | 'adopt' | 'adopt-disable' | null;
type Translate = Props['t'];
export declare function CodexSubscriptionSection({ t }: Props): React.JSX.Element;
/**
 * Read-only view of the fetch selection, shown under the search source.
 *
 * Both blocks are optional on the status DTO, so every row is rendered only from
 * a value the host actually reported. That distinction is load-bearing: a
 * missing `switcher` means the host tells us nothing and the row stays hidden,
 * while a reported `configuredFetchProvider: null` is a real answer — the host
 * pinned no provider, which is the DSH default. Guessing an id there would claim
 * a provider the settings page never observed.
 *
 * Nothing here is editable: the mode and the limits live in the plugin Config,
 * not in the preferences this card sits in, so the numbers cannot be mistaken for
 * a setting that this page can change.
 */
export declare function FetchProviderStatusCard({ status, t }: {
    status: PluginStatusDto | null | undefined;
    t: Translate;
}): React.JSX.Element | null;
export declare function ResetCreditsFact({ resetCredits, busy, onUse, t }: {
    resetCredits: NonNullable<PluginStatusDto['quota']['resetCredits']>;
    busy: BusyAction;
    onUse: () => Promise<void>;
    t: Translate;
}): React.JSX.Element;
export declare function QuotaBar({ label, window, t }: {
    label: string;
    window: QuotaWindowDto;
    t: Translate;
}): React.JSX.Element;
export declare function windowLabel(minutes: number | null | undefined, t: Translate): string;
export declare function parsePositiveCapacity(value: string): number | null;
export declare function parseCapacity(value: string, maxContextWindow?: number): number | null;
export declare function formatReset(seconds: number | undefined | null): string;
export {};
//# sourceMappingURL=CodexSubscriptionSection.d.ts.map