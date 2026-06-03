import { getErrorMessage, logAiUsage } from "./aiUsageLog";
import { classifyThought } from "./classifier";
import {
  type RoutedThought,
  THOUGHT_CATEGORIES,
  type ThoughtCategory,
  isRewardEligible,
} from "./thoughts";

export const OPENROUTER_CLASSIFIER_MODEL = "google/gemini-2.5-flash-lite";

const OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";
const MIN_API_CONFIDENCE = 0.55;
const API_TIMEOUT_MS = 4000;
const categorySet = new Set<string>(THOUGHT_CATEGORIES);

type ClassifierOptions = {
  apiKey: string;
  fetcher?: typeof fetch;
  localOnly: boolean;
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: unknown;
      refusal?: unknown;
    };
  }>;
};

type ApiClassification = {
  category?: unknown;
  confidence?: unknown;
  rewardEligible?: unknown;
  title?: unknown;
};

export async function classifyThoughtWithApiFallback(
  rawText: string,
  { apiKey, fetcher = globalThis.fetch, localOnly }: ClassifierOptions,
): Promise<RoutedThought> {
  const localClassification = classifyThought(rawText);
  const trimmedApiKey = apiKey.trim();

  if (localOnly) {
    logAiUsage("classifier", "skipped", "local-only mode is enabled");
    return localClassification;
  }

  if (!trimmedApiKey) {
    logAiUsage("classifier", "skipped", "OpenRouter API key is missing");
    return localClassification;
  }

  if (typeof fetcher !== "function") {
    logAiUsage("classifier", "skipped", "fetch is unavailable");
    return localClassification;
  }

  try {
    logAiUsage("classifier", "request", `model=${OPENROUTER_CLASSIFIER_MODEL}`);
    const controller =
      typeof AbortController === "undefined" ? undefined : new AbortController();
    const timeoutId =
      controller === undefined
        ? undefined
        : setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    const response = await fetcherWithTimeout(fetcher, {
      apiKey: trimmedApiKey,
      controller,
      rawText,
      timeoutId,
    });

    if (!response.ok) {
      logAiUsage("classifier", "fallback", `OpenRouter returned HTTP ${response.status}`);
      return localClassification;
    }

    const body = (await response.json()) as OpenRouterResponse;
    const message = body.choices?.[0]?.message;
    if (!message || message.refusal) {
      logAiUsage(
        "classifier",
        "fallback",
        message?.refusal ? "OpenRouter returned a refusal" : "OpenRouter response was missing a message",
      );
      return localClassification;
    }

    const routed = normalizeApiClassification(parseMessageContent(message.content), rawText);
    if (!routed) {
      logAiUsage("classifier", "fallback", "OpenRouter response did not pass validation");
      return localClassification;
    }

    logAiUsage("classifier", "success", `category=${routed.category}`);
    return routed ?? localClassification;
  } catch (error) {
    logAiUsage("classifier", "fallback", getErrorMessage(error));
    return localClassification;
  }
}

async function fetcherWithTimeout(
  fetcher: typeof fetch,
  {
    apiKey,
    controller,
    rawText,
    timeoutId,
  }: {
    apiKey: string;
    controller: AbortController | undefined;
    rawText: string;
    timeoutId: ReturnType<typeof setTimeout> | undefined;
  },
) {
  try {
    return await fetcher(OPENROUTER_CHAT_COMPLETIONS_URL, {
      body: JSON.stringify(createOpenRouterRequest(rawText)),
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://focuspal.local",
        "X-Title": "FocusPal",
      },
      method: "POST",
      signal: controller?.signal,
    });
  } finally {
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
    }
  }
}

function createOpenRouterRequest(rawText: string) {
  return {
    max_tokens: 120,
    messages: [
      {
        content:
          "Classify a short distracting thought for FocusPal. Use the category that best describes the user's intent. Keep the title concise but faithful to the original thought.",
        role: "system",
      },
      {
        content: rawText,
        role: "user",
      },
    ],
    model: OPENROUTER_CLASSIFIER_MODEL,
    provider: {
      require_parameters: true,
    },
    response_format: {
      json_schema: {
        name: "focuspal_thought_classification",
        schema: {
          additionalProperties: false,
          properties: {
            category: {
              description: "Best matching FocusPal category.",
              enum: THOUGHT_CATEGORIES,
              type: "string",
            },
            confidence: {
              description: "Classifier confidence from 0 to 1.",
              maximum: 1,
              minimum: 0,
              type: "number",
            },
            rewardEligible: {
              description: "Whether this thought is leisure-like enough to be a reward.",
              type: "boolean",
            },
            title: {
              description: "Short display title derived from the thought.",
              type: "string",
            },
          },
          required: ["title", "category", "confidence", "rewardEligible"],
          type: "object",
        },
        strict: true,
      },
      type: "json_schema",
    },
    temperature: 0,
  };
}

function parseMessageContent(content: unknown): ApiClassification | null {
  if (typeof content === "string") {
    try {
      return JSON.parse(content) as ApiClassification;
    } catch {
      return null;
    }
  }

  if (content && typeof content === "object" && !Array.isArray(content)) {
    return content as ApiClassification;
  }

  return null;
}

function normalizeApiClassification(
  value: ApiClassification | null,
  rawText: string,
): RoutedThought | null {
  if (!value || !isThoughtCategory(value.category) || typeof value.confidence !== "number") {
    return null;
  }

  if (!Number.isFinite(value.confidence) || value.confidence < MIN_API_CONFIDENCE) {
    return null;
  }

  const title = typeof value.title === "string" ? value.title.trim() : "";
  const category = value.category;
  const confidence = Math.min(1, Math.max(0, value.confidence));

  return {
    category,
    confidence,
    rewardEligible: isRewardEligible(category, confidence),
    title: title || classifyThought(rawText).title,
  };
}

function isThoughtCategory(value: unknown): value is ThoughtCategory {
  return typeof value === "string" && categorySet.has(value);
}
