/**
 * The hub's provider registry: one descriptor per subscription line.
 *
 * This is the single place the overview learns what a line is called, what
 * its card looks like, how its enable switch talks to the host, and which
 * section the detail page mounts. Adding a line to the hub means adding one
 * entry here — the overview, the navigation and the card rendering all read
 * this table.
 */
import type { ReactElement } from 'react';
import type { PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import type { HubProviderId } from './brand-icons.tsx';
/** What the detail page hands to a mounted section. */
export interface HubDetailRenderProps {
    t: (key: any) => string;
    onModelChange?: () => void;
    /** The settings.section runtime props (close, etc.) the host slot passes in. */
    runtime: PropsRuntime<'settings.section'>;
}
export interface HubProviderDescriptor {
    id: HubProviderId;
    /** Display name; brand names stay literal, matching the former tabs. */
    name: string;
    /**
     * Commit an enable/disable to the line's own settings endpoint.
     *
     * The overview deliberately reuses each line's existing mutation route
     * rather than adding a second mutator to the aggregated overview route —
     * the aggregated route stays read-only, and every line keeps exactly one
     * place that writes its `enabled` flag. Null when the line has no switch.
     */
    setEnabled: ((enabled: boolean) => Promise<void>) | null;
    renderDetail(props: HubDetailRenderProps): ReactElement;
}
/** Card order on the overview; also the former tab order. */
export declare const HUB_PROVIDERS: readonly HubProviderDescriptor[];
export declare function hubProviderDescriptor(id: string): HubProviderDescriptor | undefined;
//# sourceMappingURL=providers.d.ts.map