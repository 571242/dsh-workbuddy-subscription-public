/**
 * Post-hoc visibility for child routes the delegation guard cannot pre-empt.
 *
 * `subagentModelAuthorization` gates one model-authored tool call. Two whole
 * classes of child creation never pass through such a call, so no tool guard can
 * see them:
 *
 * - a delegation tool that exposes no route parameters and inherits the
 *   caller's route (`subagent_fork`);
 * - a subsystem that starts children itself without any delegation tool at all
 *   (`ralph`, the `workflow` engine, a plugin calling `ctx.subagents.start`).
 *
 * Every session-backed child still leaves two durable facts, which is enough to
 * reconstruct what actually ran:
 *
 * - the parent records one `subagent/catalog` event per continuable child, and
 *   the child's own session header names its `parentSession`;
 * - the child records one immutable `subagent/descriptor` whose
 *   `agentProvider`/`agentModel` are the resolved child route (absent when the
 *   child inherited the parent's route, which is the common case).
 *
 * This module folds those facts into an advisory list. It never blocks and never
 * mutates a session: its whole job is to make an unauthorized child route
 * visible instead of silent.
 * @module dsh-chatgpt-subscription/subagent-route-audit
 */
/** One record of a child session whose route is known. */
export interface ChildRouteFinding {
    /** The child session id. */
    readonly childId: string;
    /** The parent session id, when the child's header names one. */
    readonly parentId?: string;
    /** The `ctx.subagents` provider that established the child. */
    readonly provider?: string;
    /** The child's own resolved provider, absent when it inherited the parent's. */
    readonly childProvider?: string;
    /** The child's own resolved model, absent when it inherited the parent's. */
    readonly childModel?: string;
    /** Short display label recorded with the descriptor. */
    readonly label?: string;
}
/** One child that ran on a route the governing allowlist does not authorize. */
export interface RouteViolation {
    /** The child that ran on the unauthorized route. */
    readonly finding: ChildRouteFinding;
    /**
     * The route the child actually ran on. For a route-preserving child this is
     * the parent's route, which is why the finding keeps both.
     */
    readonly route: {
        readonly provider?: string;
        readonly model?: string;
    };
    /**
     * Whether the child's route equals its parent's current route.
     *
     * This is deliberately a comparison rather than a claim about which mechanism
     * chose the route. A forked child's descriptor DOES record the route it ran
     * on — the delegation seam stamps the parent's route into the child's options
     * — so a descriptor alone cannot prove whether the child inherited the route
     * or was handed it explicitly. Equality is the checkable fact, and it is the
     * one that decides whether re-delegating through an explicit tool would even
     * change anything.
     */
    readonly sameAsParent: boolean;
}
/** One exact provider/model route authorized for children. */
export interface AuditedRoute {
    readonly provider: string;
    readonly model: string;
}
/** Minimal session view this fold reads: the header and the ordered event log. */
export interface AuditedSession {
    readonly id?: unknown;
    readonly header?: {
        readonly parentSession?: unknown;
        readonly origin?: unknown;
    };
    readonly events?: readonly {
        readonly type?: unknown;
        readonly data?: unknown;
    }[];
}
/** Session lookup used to resolve a child's parent for inherited-route attribution. */
export interface AuditedSessions {
    get(id: string): AuditedSession | undefined;
}
/**
 * Extract the child route a descriptor recorded.
 * @param data - `subagent/descriptor` payload.
 * @returns the declared route fields plus provider and label, each when present.
 */
export declare function readChildDescriptor(data: unknown): Omit<ChildRouteFinding, 'childId' | 'parentId'> | undefined;
/**
 * Read the child-route allowlist a session recorded, from its own log.
 *
 * The live guard reads the same event through `policyRoutesOf`, which walks a
 * session's `eventAt` accessor. The audit holds a resolved session instead, so
 * it scans the snapshot it already has rather than reopening the log per child.
 * @param session - the session whose policy is read.
 * @returns the authorized routes, or undefined when the session recorded none.
 */
export declare function auditedRoutesOf(session: AuditedSession): AuditedRoute[] | undefined;
/**
 * Collect the child routes one parent session recorded.
 *
 * Discovery uses both durable signals because they cover different backends: a
 * `subagent/catalog` event names every continuable child the parent created,
 * while a descriptor-less or one-shot child is only reachable by scanning the
 * registry for a session whose header names this parent.
 * @param parent - the parent session to inspect.
 * @param sessions - registry used to resolve each child's own log and header.
 * @returns one finding per child whose route could be read.
 */
export declare function childRoutesOf(parent: AuditedSession, sessions: AuditedSessions): ChildRouteFinding[];
/**
 * Resolve the route a finding actually ran on, following the parent when the
 * child recorded none, and report whether it matches the parent's.
 * @param finding - the child under audit.
 * @param sessions - registry used to resolve the parent.
 * @returns the effective route and whether it equals the parent's route.
 */
export declare function effectiveRouteOf(finding: ChildRouteFinding, sessions: AuditedSessions): RouteViolation['route'] & {
    sameAsParent: boolean;
};
/**
 * Fold one parent session's children into the violations worth reporting.
 * A finding with an unresolvable route is reported as neither: guessing would
 * turn this advisory list into a source of false accusations.
 * @param parent - the parent session to audit.
 * @param sessions - registry used to resolve children and parents.
 * @param allowed - routes the parent Session authorized, when it recorded any.
 * @returns violations, ordered as the children were discovered.
 */
export declare function auditChildRoutes(parent: AuditedSession, sessions: AuditedSessions, allowed: readonly AuditedRoute[] | undefined): RouteViolation[];
/**
 * Render one violation as a single model-facing line.
 * @param violation - the violation to describe.
 * @returns a one-line summary naming the child, its route, and its origin.
 */
export declare function violationText(violation: RouteViolation): string;
//# sourceMappingURL=subagent-route-audit.d.ts.map