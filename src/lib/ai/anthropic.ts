import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import type { ChatProvider, ChatRequest } from "./types";

/** Claude via the official Anthropic SDK. Server-side only; the key never reaches the browser. */
export class AnthropicProvider implements ChatProvider {
  readonly name = "anthropic";
  readonly isDemo = false;
  private client: Anthropic;
  private model: string;

  constructor(apiKey: string, model = process.env.AI_MODEL || "claude-opus-5-5") {
    this.client = new Anthropic({ apiKey });
    this.model = model;
  }

  async *stream(req: ChatRequest, signal?: AbortSignal): AsyncIterable<string> {
    const stream = this.client.beta.messages.stream(
      {
        model: this.model,
        max_tokens: req.maxTokens ?? 4000,
        system: req.system,
        messages: req.messages.map((m) => ({ role: m.role, content: m.content })),
        output_config: { effort: req.effort ?? "low" },
        // If a safety classifier declines, the API retries on a fallback model in the same call.
        betas: ["server-side-fallback-2026-07-01"],
        fallbacks: "default",
      },
      { signal },
    );
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        yield event.delta.text;
      }
    }
    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") {
      yield "\n\nI can't help with that one. Try asking in a different way, or talk to your teacher.";
    } else if (final.stop_reason === "max_tokens") {
      yield "\n\n(I stopped there to keep things short — ask me to continue.)";
    }
  }
}
