export type Provider = "openai" | "anthropic" | "mock";

export function chatProvider(): Provider {
  const p = (process.env.AI_PROVIDER || "mock").toLowerCase();
  if (p === "openai" && process.env.OPENAI_API_KEY) return "openai";
  if (p === "anthropic" && process.env.ANTHROPIC_API_KEY) return "anthropic";
  return "mock";
}

export function chatModel(p: Provider = chatProvider()): string {
  if (p === "mock") return "template-mock";
  if (process.env.AI_MODEL) return process.env.AI_MODEL;
  return p === "openai" ? "gpt-4o-mini" : "claude-sonnet-4-5";
}

export function embeddingsProvider(): "openai" | "local" {
  const p = (process.env.EMBEDDINGS_PROVIDER || "auto").toLowerCase();
  if (p === "local") return "local";
  if (process.env.OPENAI_API_KEY) return "openai";
  return "local";
}

export function imagesEnabled(): boolean {
  return process.env.AI_IMAGES === "1" && !!process.env.OPENAI_API_KEY;
}
