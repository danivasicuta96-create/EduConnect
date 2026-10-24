import "server-only";
import type { ChatProvider } from "./types";
import { DemoProvider } from "./demo";

/**
 * Select the configured provider. Set AI_PROVIDER=anthropic with
 * ANTHROPIC_API_KEY to use Claude; anything else (or a missing key) falls
 * back to the offline demo provider.
 */
export async function getChatProvider(): Promise<ChatProvider> {
  const choice = (process.env.AI_PROVIDER ?? (process.env.ANTHROPIC_API_KEY ? "anthropic" : "demo")).toLowerCase();
  if (choice === "anthropic" && process.env.ANTHROPIC_API_KEY) {
    const { AnthropicProvider } = await import("./anthropic");
    return new AnthropicProvider(process.env.ANTHROPIC_API_KEY);
  }
  return new DemoProvider();
}

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY) && (process.env.AI_PROVIDER ?? "anthropic").toLowerCase() === "anthropic";
}
