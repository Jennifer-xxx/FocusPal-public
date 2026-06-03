import { getErrorMessage, logAiUsage } from "./aiUsageLog";
import type { FocusSession } from "./focus";
import type { Thought } from "./thoughts";

export const OPENROUTER_DEBRIEF_MODEL = "google/gemini-2.5-flash-lite";

const OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";
const API_TIMEOUT_MS = 12000;
const MAX_DEBRIEF_THOUGHTS = 6;

export type FocusDebrief = {
  id: string;
  sessionId: string;
  summary: string;
  pattern: string;
  nextIntention: string;
  rewardSuggestion: string;
  createdAt: string;
  updatedAt: string;
};

export type FocusDebriefDraft = Pick<
  FocusDebrief,
  "summary" | "pattern" | "nextIntention" | "rewardSuggestion"
>;

type DebriefOptions = {
  apiKey: string;
  fetcher?: typeof fetch;
  localOnly: boolean;
  session: FocusSession;
  thoughts: Thought[];
};

type OpenRouterResponse = {
  choices?: Array<{
    message?: {
      content?: unknown;
      refusal?: unknown;
    };
  }>;
};

type ApiDebrief = {
  nextIntention?: unknown;
  pattern?: unknown;
  rewardSuggestion?: unknown;
  next_intention?: unknown;
  reward_suggestion?: unknown;
  summary?: unknown;
};

export async function generateFocusDebriefWithApiFallback({
  apiKey,
  fetcher = globalThis.fetch,
  localOnly,
  session,
  thoughts,
}: DebriefOptions): Promise<FocusDebriefDraft | null> {
  const trimmedApiKey = apiKey.trim();
  const debriefThoughts = selectDebriefThoughts(session, thoughts);

  if (localOnly) {
    logAiUsage("debrief", "skipped", "local-only mode is enabled");
    return null;
  }

  if (!trimmedApiKey) {
    logAiUsage("debrief", "skipped", "OpenRouter API key is missing");
    return null;
  }

  if (typeof fetcher !== "function") {
    logAiUsage("debrief", "skipped", "fetch is unavailable");
    return null;
  }

  try {
    logAiUsage(
      "debrief",
      "request",
      `model=${OPENROUTER_DEBRIEF_MODEL}, thoughts=${debriefThoughts.length}`,
    );
    const controller =
      typeof AbortController === "undefined" ? undefined : new AbortController();
    const timeoutId =
      controller === undefined
        ? undefined
        : setTimeout(() => controller.abort(), API_TIMEOUT_MS);
    const response = await fetcherWithTimeout(fetcher, {
      apiKey: trimmedApiKey,
      controller,
      session,
      thoughts: debriefThoughts,
      timeoutId,
    });

    if (!response.ok) {
      logAiUsage("debrief", "unavailable", `OpenRouter returned HTTP ${response.status}`);
      return null;
    }

    const body = (await response.json()) as OpenRouterResponse;
    const message = body.choices?.[0]?.message;
    if (!message || message.refusal) {
      logAiUsage(
        "debrief",
        "unavailable",
        message?.refusal ? "OpenRouter returned a refusal" : "OpenRouter response was missing a message",
      );
      return null;
    }

    const parsed = parseMessageContent(message.content);
    const normalized = normalizeApiDebrief(parsed, session, debriefThoughts);
    if (!normalized) {
      logAiUsage("debrief", "unavailable", "OpenRouter response did not contain usable JSON");
      return null;
    }

    logAiUsage("debrief", "success", `thoughts=${debriefThoughts.length}`);
    return normalized;
  } catch (error) {
    logAiUsage("debrief", "unavailable", getErrorMessage(error));
    return null;
  }
}

export function selectDebriefThoughts(session: FocusSession, thoughts: Thought[]) {
  const sessionStartMs = new Date(session.startedAt).getTime();
  const sessionEndMs = new Date(session.endedAt ?? session.updatedAt).getTime();
  const visibleThoughts = thoughts.filter((thought) => thought.status !== "deleted");
  const sessionThoughts = visibleThoughts.filter((thought) => {
    const createdAtMs = new Date(thought.createdAt).getTime();

    return createdAtMs >= sessionStartMs && createdAtMs <= sessionEndMs;
  });

  return (sessionThoughts.length > 0 ? sessionThoughts : visibleThoughts)
    .sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
    .slice(0, MAX_DEBRIEF_THOUGHTS);
}

async function fetcherWithTimeout(
  fetcher: typeof fetch,
  {
    apiKey,
    controller,
    session,
    thoughts,
    timeoutId,
  }: {
    apiKey: string;
    controller: AbortController | undefined;
    session: FocusSession;
    thoughts: Thought[];
    timeoutId: ReturnType<typeof setTimeout> | undefined;
  },
) {
  try {
    return await fetcher(OPENROUTER_CHAT_COMPLETIONS_URL, {
      body: JSON.stringify(createOpenRouterRequest(session, thoughts)),
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

function createOpenRouterRequest(session: FocusSession, thoughts: Thought[]) {
  return {
    max_tokens: 420,
    messages: [
      {
        content:
          "Write a concise post-focus debrief for FocusPal. Be calm, concrete, and non-judgmental. Use only the provided session metadata and captured thoughts.",
        role: "system",
      },
      {
        content: JSON.stringify({
          plannedMinutes: session.plannedMinutes,
          thoughtCount: thoughts.length,
          thoughts: thoughts.map((thought) => ({
            category: thought.category,
            rewardEligible: thought.rewardEligible,
            status: thought.status,
            title: thought.title || thought.rawText,
          })),
        }),
        role: "user",
      },
    ],
    model: OPENROUTER_DEBRIEF_MODEL,
    provider: {
      require_parameters: true,
    },
    response_format: {
      json_schema: {
        name: "focuspal_focus_debrief",
        schema: {
          additionalProperties: false,
          properties: {
            nextIntention: {
              description: "One short intention for the next focus block, at most 18 words.",
              type: "string",
            },
            pattern: {
              description: "One short pattern noticed in the captured thoughts, at most 18 words.",
              type: "string",
            },
            rewardSuggestion: {
              description: "One short suggestion for using a reward or after-focus action, at most 18 words.",
              type: "string",
            },
            summary: {
              description: "One sentence summarizing the completed focus block, at most 18 words.",
              type: "string",
            },
          },
          required: ["summary", "pattern", "nextIntention", "rewardSuggestion"],
          type: "object",
        },
        strict: true,
      },
      type: "json_schema",
    },
    temperature: 0.2,
  };
}

function parseMessageContent(content: unknown): ApiDebrief | null {
  if (typeof content === "string") {
    try {
      return JSON.parse(content) as ApiDebrief;
    } catch {
      return null;
    }
  }

  if (Array.isArray(content)) {
    const text = content
      .map((part) => {
        if (typeof part === "string") {
          return part;
        }

        if (part && typeof part === "object" && "text" in part) {
          return typeof part.text === "string" ? part.text : "";
        }

        return "";
      })
      .join("")
      .trim();

    return text ? parseMessageContent(text) : null;
  }

  if (content && typeof content === "object" && !Array.isArray(content)) {
    return content as ApiDebrief;
  }

  return null;
}

function normalizeApiDebrief(
  value: ApiDebrief | null,
  session: FocusSession,
  thoughts: Thought[],
): FocusDebriefDraft | null {
  if (!value) {
    return null;
  }

  const summary = normalizeDebriefText(value.summary);
  const pattern = normalizeDebriefText(value.pattern);
  const nextIntention = normalizeDebriefText(value.nextIntention ?? value.next_intention);
  const rewardSuggestion = normalizeDebriefText(
    value.rewardSuggestion ?? value.reward_suggestion,
  );
  const fallback = createFallbackDebrief(session, thoughts);

  return {
    nextIntention: nextIntention || fallback.nextIntention,
    pattern: pattern || fallback.pattern,
    rewardSuggestion: rewardSuggestion || fallback.rewardSuggestion,
    summary: summary || fallback.summary,
  };
}

function normalizeDebriefText(value: unknown) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function createFallbackDebrief(session: FocusSession, thoughts: Thought[]): FocusDebriefDraft {
  const rewardCount = thoughts.filter((thought) => thought.rewardEligible).length;
  const topCategory = getTopCategory(thoughts);

  return {
    nextIntention: "Start the next block with one clear target.",
    pattern:
      thoughts.length === 0
        ? "No distracting thoughts were captured during this block."
        : `${formatCategory(topCategory)} thoughts were the main captured pattern.`,
    rewardSuggestion:
      rewardCount > 0
        ? "Use one saved reward after a real stopping point."
        : "Take a short reset before choosing the next block.",
    summary:
      thoughts.length === 0
        ? `You completed a ${session.plannedMinutes}-minute focus block.`
        : `You completed the block while parking ${thoughts.length} thought${thoughts.length === 1 ? "" : "s"}.`,
  };
}

function getTopCategory(thoughts: Thought[]) {
  const counts = new Map<Thought["category"], number>();

  for (const thought of thoughts) {
    counts.set(thought.category, (counts.get(thought.category) ?? 0) + 1);
  }

  return [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] ?? "other";
}

function formatCategory(category: Thought["category"]) {
  return category[0].toUpperCase() + category.slice(1);
}
