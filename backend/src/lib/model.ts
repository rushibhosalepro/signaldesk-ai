import { ChatOpenAI } from "@langchain/openai";

export const AI_MODEL = process.env.WARROOM_MODEL ?? "openai/gpt-oss-120b:free";

export const model = new ChatOpenAI({
  model: AI_MODEL,
  apiKey: process.env.OPENROUTER_API_KEY,
  configuration: { baseURL: "https://openrouter.ai/api/v1" },
  temperature: 0,
});

// retry mechanism
export async function withRetry<T>(
  fn: () => Promise<T>,
  label: string,
  attempts = 3,
): Promise<T> {
  let lastErr: unknown;
  for (let i = 1; i <= attempts; i++) {
    try {
      return await fn();
    } catch (err) {
      lastErr = err;
      console.warn(
        `[retry] ${label} failed (attempt ${i}/${attempts}): ${err instanceof Error ? err.message.slice(0, 120) : err}`,
      );
      if (i < attempts) await new Promise((r) => setTimeout(r, 3000 * i));
    }
  }
  throw lastErr;
}
