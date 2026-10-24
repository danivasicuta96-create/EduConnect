export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface ChatRequest {
  system: string;
  messages: ChatTurn[];
  /** Hint for providers that support reasoning depth. */
  effort?: "low" | "medium" | "high";
  maxTokens?: number;
}

/**
 * Provider-independent chat interface. Implementations stream plain text.
 * Add a provider by implementing this and registering it in `provider.ts`.
 */
export interface ChatProvider {
  readonly name: string;
  readonly isDemo: boolean;
  stream(request: ChatRequest, signal?: AbortSignal): AsyncIterable<string>;
}
