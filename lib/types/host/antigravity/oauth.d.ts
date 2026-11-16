import { type Server } from 'node:http';
import { FileCredentialStore, type AntigravityCredentials } from './token-store.ts';
import { type LoadCodeAssistDetailResult } from './client.ts';
export interface WebLoginFlowState {
    status: 'idle' | 'pending' | 'complete' | 'error';
    authUrl?: string;
    startedAt?: number;
    completedAt?: number;
    email?: string;
    error?: string;
    validationUrl?: string;
    progress?: string;
}
export declare function callbackPort(): number;
/**
 * First usable loopback port for the callback listener.
 *
 * Windows (Hyper-V/WinNAT) dynamically reserves TCP port ranges that change on
 * every reboot, and the CLI's default port can land inside one — `listen` then
 * fails with `EACCES: permission denied ::1:51121` and browser authorization
 * never opens. A fixed port therefore cannot be relied on; the Google redirect
 * URI carries whatever port this returns, so any free loopback port works. A
 * configured `DSH_ANTIGRAVITY_CALLBACK_PORT` still wins — callers who set it
 * accept that the port must be usable.
 *
 * How wide such a reserved run is not something this function can look up — it
 * is the host's own bookkeeping — so the probe only has to be wider than the
 * widest run it can meet, and it walks a window sized for that (see
 * {@link CALLBACK_PORT_ATTEMPTS}) instead of guessing a block size. `start` and
 * `probe` are the seams that keep that claim testable: production probes from
 * the line's own default and judges each port by really binding it, and a test
 * can point the walk at a run whose width it controls.
 */
export declare function resolveCallbackPort(attempts?: number, host?: string, start?: number, 
/**
 * How one port is judged. Defaults to the real bind on `host`, the only
 * authority that can answer the question for the machine this will run on.
 *
 * Overridable because the width of the window is a contract while the width of
 * the run it must clear is a machine fact: Windows reservations appear *and*
 * are released while a test is running, and another process can own a port a
 * scenario wanted free, so a run built out of real sockets measures this host
 * as much as the probe. An injected judge gives the run a known width and
 * leaves the assertion about the window alone. (The Claude line injects its
 * probe the same way.)
 */
probe?: (port: number) => Promise<boolean>): Promise<number>;
export declare function resolveCallbackHost(raw?: string | undefined): string;
export declare function redirectUri(port?: number, host?: string): string;
export declare function clientId(): string;
export declare function clientSecret(): string;
export declare function generatePKCE(): {
    verifier: string;
    challenge: string;
};
export declare function openBrowser(url: string): void;
export declare function getUserEmail(token: string, fetchFn?: typeof fetch): Promise<string | undefined>;
export declare function startCallbackServer(expectedState: string): Promise<{
    server: Server;
    waitForCode: () => Promise<{
        code: string;
        state: string;
    }>;
    /** The redirect URI the provider receives: the probed port, not the default. */
    callbackUrl: string;
}>;
export declare function extractGoogleValidationUrl(text: string): string | undefined;
export declare function assertFreeTierEligible(payload: LoadCodeAssistDetailResult): void;
export declare function discoverAntigravityProject(token: string, fetchFn?: typeof fetch, signal?: AbortSignal, onProgress?: (stage: string) => void): Promise<string | undefined>;
export declare function exchangeOAuthCode(code: string, verifier: string, callbackUrl: string, fetchFn?: typeof fetch, signal?: AbortSignal, onProgress?: (stage: string) => void): Promise<AntigravityCredentials>;
export declare function beginWebLogin(store: FileCredentialStore, fetchFn?: typeof fetch, signal?: AbortSignal, onSave?: (credentials: AntigravityCredentials) => Promise<unknown>): Promise<WebLoginFlowState>;
export declare function getWebLoginStatus(): WebLoginFlowState;
export declare function refreshAntigravityToken(credentials: AntigravityCredentials, fetchFn?: typeof fetch): Promise<AntigravityCredentials>;
export declare function ensureApiKey(store: FileCredentialStore, fetchFn?: typeof fetch): Promise<{
    token: string;
    projectId?: string;
}>;
export declare function loginAndSave(store: FileCredentialStore, signal?: AbortSignal, onUrl?: (url: string) => void, fetchFn?: typeof fetch, onProgress?: (stage: string) => void, 
/**
 * 打开授权页的方式；缺省是本模块那份平台实现。
 *
 * 这一栏只是给测试留的口子：这一行以前是硬编码的 openBrowser(authUrl)，将来
 * 任何调用 loginAndSave 的用例都会在跑测试的机器上真的弹出窗口，而写用例的人
 * 不会事先知道。
 *
 * 默认值就是改动前那一行本身，所以**生产行为一点没变**：该开还是开。
 */
openFn?: (url: string) => void): Promise<AntigravityCredentials>;
//# sourceMappingURL=oauth.d.ts.map