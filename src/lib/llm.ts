import OpenAI from "openai";

/**
 * LLM client for AI triage.
 *
 * If GEMINI_API_KEY is set, Gemini is preferred via Google's OpenAI-compatible
 * endpoint. Otherwise, fall back to the generic OpenAI-compatible LLM_* config.
 */
const geminiApiKey = process.env.GEMINI_API_KEY?.trim();

export const llm = new OpenAI({
  apiKey: geminiApiKey || process.env.LLM_API_KEY || "",
  baseURL: geminiApiKey
    ? (process.env.GEMINI_BASE_URL ?? "https://generativelanguage.googleapis.com/v1beta/openai/")
    : (process.env.LLM_BASE_URL ?? "https://api.z.ai/api/paas/v4"),
});

export const LLM_MODEL = geminiApiKey
  ? (process.env.GEMINI_MODEL ?? "gemini-3.1-flash-lite-preview")
  : (process.env.LLM_MODEL ?? "glm-5.1");
