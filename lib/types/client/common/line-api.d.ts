export interface LineApi {
    /** Any route under the line's prefix, unwrapping whichever envelope arrives. */
    request<T>(path: string, init?: RequestInit): Promise<T>;
    get<T>(path: string): Promise<T>;
    post<T>(path: string, body?: object): Promise<T>;
}
export declare function createLineApi(prefix: string, label: string): LineApi;
//# sourceMappingURL=line-api.d.ts.map