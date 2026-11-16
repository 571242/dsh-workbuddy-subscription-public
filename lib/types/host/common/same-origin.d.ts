import type { IncomingMessage } from 'node:http';
/**
 * Whether one mutation request comes from this application's own document.
 *
 * Two shapes reach these routes:
 *
 * 1. A browser page served by this Host. The browser states its origin, and it
 *    must name the same authority the request was addressed to. A cross-site
 *    POST always states the foreign origin, so this comparison is what rejects
 *    it.
 *
 * 2. The DSH Desktop shell. Electron's `forwardWebRequest` admits only requests
 *    whose origin is the `dsh-app://app` document, then *removes* the `origin`
 *    header before forwarding to the Host — that application scheme is not an
 *    HTTP origin the Host could compare against. A forwarded request therefore
 *    arrives with no `origin` at all, addressed to the loopback Host.
 *
 * A missing `origin` is consequently accepted only when the request was
 * addressed to a loopback authority, and a stated `origin` must still match
 * exactly. This is not a CSRF opening: a browser cannot issue a cross-site POST
 * without stating the foreign origin, so every cross-site request still fails
 * the comparison — the loopback clause admits only the desktop shell's already
 * validated forward, and a request that never reached loopback keeps the strict
 * requirement.
 *
 * @param request - Incoming mutation request.
 * @returns whether the request may be treated as same-origin.
 */
export declare function isSameOriginMutation(request: IncomingMessage): boolean;
//# sourceMappingURL=same-origin.d.ts.map