import type { FetchConfigurationDto } from '../shared/contracts.ts';
export declare const DEFAULT_FETCH_MAX_BODY_CHARS = 100000;
export declare const DEFAULT_FETCH_MAX_RESPONSE_BYTES: number;
export declare function positiveFetchLimit(value: number | undefined, fallback: number, name: string): number;
export declare function resolveFetchConfiguration(config: Partial<FetchConfigurationDto>): FetchConfigurationDto;
//# sourceMappingURL=fetch-configuration.d.ts.map