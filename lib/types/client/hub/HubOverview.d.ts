import type { PropsLocale } from '@deepseek-ai/dsh-client-ui-slots';
import type { HubProviderSummaryDto } from '../../shared/hub-contracts.ts';
import type { NS } from '../locales.ts';
import { type HubProviderDescriptor } from './providers.tsx';
export type HubTranslate = PropsLocale<typeof NS>['t'];
interface Props {
    t: HubTranslate;
    onOpen(id: HubProviderDescriptor['id']): void;
}
/** The card's one-line annotation: accounts, then models, then state. */
export declare function cardAnnotation(summary: HubProviderSummaryDto | undefined, descriptor: HubProviderDescriptor, t: HubTranslate): string;
export declare function HubOverview({ t, onOpen }: Props): React.JSX.Element;
export {};
//# sourceMappingURL=HubOverview.d.ts.map