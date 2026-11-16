import type { StreamChunk } from '../common/llm-compat.ts';
import type { OllamaStreamEvent, OllamaToolCall } from './client.ts';
/**
 * Translate Ollama's stream events into DSH's block protocol.
 *
 * DSH wants a block opened, filled with deltas, then closed with the assembled
 * content. Ollama's surface streams text and tool calls as two interleaved
 * kinds of delta with no block framing of its own, so this state machine owns
 * the framing: one text block at a time, and one block per tool call that is
 * closed only once its arguments are complete.
 *
 * Closing a tool call late is the point. An arguments string arrives in pieces,
 * and a block closed on the first piece would hand the agent a truncated tool
 * invocation - which fails as a JSON parse error inside the model loop rather
 * than as anything that names the real cause.
 */
export interface OllamaStreamState {
    /** Index the next opened block takes. */
    nextBlockIndex: number;
    /** The open text block, or null when the stream is on a tool call. */
    textBlock: {
        index: number;
        text: string;
    } | null;
    /** The open reasoning block, closed when the answer starts or a tool is called. */
    thinkingBlock: {
        index: number;
        text: string;
    } | null;
    /** Call id -> the call being accumulated, with the block it will close. */
    toolCalls: Map<string, {
        call: OllamaToolCall;
        blockIndex: number;
    }>;
    /** True once any content has been produced. */
    hasContent: boolean;
}
export declare function createStreamState(): OllamaStreamState;
/** Fold one event into chunks, opening and closing blocks as the stream needs. */
export declare function applyEvent(state: OllamaStreamState, event: OllamaStreamEvent): StreamChunk[];
/**
 * Close the turn.
 *
 * A stream that ends while a text block is still open is a real possibility - the
 * model can be cut off mid-sentence - so the block is closed with what arrived
 * rather than dropped, and the text the user sees is the text that streamed.
 */
export declare function closeStream(state: OllamaStreamState): StreamChunk[];
//# sourceMappingURL=mapper.d.ts.map