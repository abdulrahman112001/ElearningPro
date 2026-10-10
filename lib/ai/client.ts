import Anthropic from "@anthropic-ai/sdk"
import { betaZodOutputFormat } from "@anthropic-ai/sdk/helpers/beta/zod"
import type * as z from "zod/v4"

/**
 * The only module that talks to the Claude API. Everything else goes through
 * `generateStructured` / `streamChat`, so the model call can be mocked or
 * skipped (no ANTHROPIC_API_KEY = AI disabled, see lib/ai/guard.ts).
 */

export const DEFAULT_AI_MODEL = "claude-sonnet-5-5"

export function aiModel(): string {
  return process.env.AI_MODEL?.trim() || DEFAULT_AI_MODEL
}

export function isAiConfigured(): boolean {
  return !!process.env.ANTHROPIC_API_KEY?.trim()
}

// Models that accept the server-side refusal fallback (`fallbacks: "default"`).
const FALLBACK_MODELS = new Set(["claude-sonnet-5-5", "claude-opus-5-5", "claude-opus-5", "claude-fable-5-1"])

let _client: Anthropic | undefined
function client(): Anthropic {
  return (_client ??= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY, maxRetries: 2 }))
}

function fallbackParams(model: string) {
  return FALLBACK_MODELS.has(model)
    ? { betas: ["server-side-fallback-2026-07-01"] as Anthropic.Beta.AnthropicBeta[], fallbacks: "default" as const }
    : {}
}

export type AiUsageTokens = { model: string; inputTokens: number; outputTokens: number }

/** The model declined to answer (safety refusal) or produced unusable output. */
export class AiOutputError extends Error {
  constructor(public reason: "refusal" | "max_tokens" | "invalid_output", message?: string) {
    super(message ?? reason)
    this.name = "AiOutputError"
  }
}

function usageOf(model: string, usage: { input_tokens?: number | null; output_tokens?: number | null; cache_read_input_tokens?: number | null; cache_creation_input_tokens?: number | null }): AiUsageTokens {
  return {
    model,
    inputTokens: (usage.input_tokens ?? 0) + (usage.cache_read_input_tokens ?? 0) + (usage.cache_creation_input_tokens ?? 0),
    outputTokens: usage.output_tokens ?? 0,
  }
}

/** One request whose answer must match a Zod schema (structured outputs). */
export async function generateStructured<T>(opts: {
  system: string
  prompt: string
  schema: z.ZodType<T>
  maxTokens?: number
  effort?: "low" | "medium" | "high"
}): Promise<{ data: T; usage: AiUsageTokens }> {
  const model = aiModel()
  const response = await client().beta.messages.parse({
    model,
    max_tokens: opts.maxTokens ?? 16000,
    system: opts.system,
    messages: [{ role: "user", content: opts.prompt }],
    output_config: { effort: opts.effort ?? "medium", format: betaZodOutputFormat(opts.schema) },
    ...fallbackParams(model),
  })
  const usage = usageOf(model, response.usage)
  if (response.stop_reason === "refusal") throw new AiOutputError("refusal")
  if (response.stop_reason === "max_tokens") throw new AiOutputError("max_tokens")
  if (response.parsed_output == null) throw new AiOutputError("invalid_output")
  return { data: response.parsed_output as T, usage }
}

/**
 * Streams a chat answer. Yields text deltas; `done` resolves with the full
 * text and token usage once the stream ends.
 */
export function streamChat(opts: {
  system: string
  messages: Anthropic.Beta.BetaMessageParam[]
  maxTokens?: number
  effort?: "low" | "medium" | "high"
}): { textStream: AsyncIterable<string>; done: Promise<{ text: string; usage: AiUsageTokens; refused: boolean }> } {
  const model = aiModel()
  const stream = client().beta.messages.stream({
    model,
    max_tokens: opts.maxTokens ?? 8000,
    system: opts.system,
    messages: opts.messages,
    output_config: { effort: opts.effort ?? "low" },
    ...fallbackParams(model),
  })

  async function* textStream() {
    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") yield event.delta.text
    }
  }

  const done = stream.finalMessage().then((message) => {
    const text = message.content
      .map((b) => (b.type === "text" ? b.text : ""))
      .join("")
      .trim()
    return { text, usage: usageOf(model, message.usage), refused: message.stop_reason === "refusal" }
  })
  // Avoid an unhandled rejection when the caller only consumes the text stream.
  done.catch(() => undefined)
  return { textStream: textStream(), done }
}

export { Anthropic }
