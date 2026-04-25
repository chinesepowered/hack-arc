import OpenAI from "openai";

/**
 * GLM 5.1 via OpenAI-compatible endpoint.
 *
 * Configure with:
 *   LLM_BASE_URL   e.g. https://api.z.ai/api/paas/v4  (or your provider's /v1)
 *   LLM_API_KEY    provider API key
 *   LLM_MODEL      e.g. glm-5.1, glm-4.6, glm-4.5-air
 */
export const llm = new OpenAI({
  apiKey: process.env.LLM_API_KEY ?? "",
  baseURL: process.env.LLM_BASE_URL ?? "https://api.z.ai/api/paas/v4",
});

export const LLM_MODEL = process.env.LLM_MODEL ?? "glm-5.1";
