export interface WebServerOriginSource {
    readonly host: string;
    readonly port: number | undefined;
    getOrigin?(): string;
}
export declare function webServerOrigin(server: WebServerOriginSource): string;
//# sourceMappingURL=webserver-compat.d.ts.map