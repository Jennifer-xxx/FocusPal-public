import { getErrorMessage, logAiUsage } from "./aiUsageLog";
import type { FocusSession } from "./focus";
import type { Thought } from "./thoughts";

export const OPENROUTER_TASK_PLAN_MODEL = "google/gemini-2.5-flash-lite";

const OPENROUTER_CHAT_COMPLETIONS_URL = "https://openrouter.ai/api/v1/chat/completions";
const API_TIMEOUT_MS = 8000;
const MAX_ACTIONABLE_THOUGHTS = 6;
const MIN_API_CONFIDENCE = 0.55;
const ACTIONABLE_CATEGORIES = new Set(["task", "study", "message"]);

export const TASK_ITEM_STATUSES = ["open", "done", "deferred", "deleted"] as const;

export type TaskItemStatus = (typeof TASK_ITEM_STATUSES)[number];

export type TaskItem = {
  id: string;
  sessionId: string;
  sourceThoughtId: string;
  title: string;
  nextAction: string;
  status: TaskItemStatus;
  createdAt: string;
  updatedAt: string;
};

export type TaskItemDraft = Pick<TaskItem, "sourceThoughtId" | "title" | "nextAction">;

type TaskPlanOptions = {
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

type ApiTaskPlan = {
  tasks?: unknown;
};

type ApiTaskDraft = {
  confidence?: unknown;
  nextAction?: unknown;
  next_action?: unknown;
  sourceThoughtId?: unknown;
  source_thought_id?: unknown;
  title?: unknown;
};

export async function generateTaskPlanWithApiFallback({
  apiKey,
  fetcher = globalThis.fetch,
  localOnly,
  session,
  thoughts,
}: TaskPlanOptions): Promise<TaskItemDraft[]> {
  const actionableThoughts = selectActionableThoughts(session, thoughts);
  const localTaskPlan = createLocalTaskPlan(actionableThoughts);
  const trimmedApiKey = apiKey.trim();

  if (actionableThoughts.length === 0) {
    logAiUsage("task-plan", "skipped", "no actionable thoughts captured during session");
    return [];
  }

  if (localOnly) {
    logAiUsage("task-plan", "skipped", "local-only mode is enabled");
    return localTaskPlan;
  }

  if (!trimmedApiKey) {
    logAiUsage("task-plan", "skipped", "OpenRouter API key is missing");
    return localTaskPlan;
  }

  if (typeof fetcher !== "function") {
    logAiUsage("task-plan", "skipped", "fetch is unavailable");
    return localTaskPlan;
  }

  try {
    logAiUsage(
      "task-plan",
      "request",
      `model=${OPENROUTER_TASK_PLAN_MODEL}, thoughts=${actionableThoughts.length}`,
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
      thoughts: actionableThoughts,
      timeoutId,
    });

    if (!response.ok) {
      logAiUsage("task-plan", "fallback", `OpenRouter returned HTTP ${response.status}`);
      return localTaskPlan;
    }

    const body = (await response.json()) as OpenRouterResponse;
    const message = body.choices?.[0]?.message;
    if (!message || message.refusal) {
      logAiUsage(
        "task-plan",
        "fallback",
        message?.refusal ? "OpenRouter returned a refusal" : "OpenRouter response was missing a message",
      );
      return localTaskPlan;
    }

    const normalized = normalizeApiTaskPlan(
      parseMessageContent(message.content),
      actionableThoughts,
    );
    if (!normalized) {
      logAiUsage("task-plan", "fallback", "OpenRouter response did not contain usable JSON");
      return localTaskPlan;
    }

    logAiUsage("task-plan", "success", `tasks=${normalized.length}`);
    return normalized;
  } catch (error) {
    logAiUsage("task-plan", "fallback", getErrorMessage(error));
    return localTaskPlan;
  }
}

export function selectActionableThoughts(session: FocusSession, thoughts: Thought[]) {
  const sessionStartMs = new Date(session.startedAt).getTime();
  const sessionEndMs = new Date(session.endedAt ?? session.updatedAt).getTime();

  return thoughts
    .filter((thought) => thought.status !== "deleted")
    .filter((thought) => !thought.rewardEligible)
    .filter((thought) => ACTIONABLE_CATEGORIES.has(thought.category))
    .filter((thought) => {
      const createdAtMs = new Date(thought.createdAt).getTime();

      return createdAtMs >= sessionStartMs && createdAtMs <= sessionEndMs;
    })
    .sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime())
    .slice(0, MAX_ACTIONABLE_THOUGHTS);
}

function createLocalTaskPlan(thoughts: Thought[]): TaskItemDraft[] {
  return thoughts.map((thought) => {
    const title = createTaskTitle(thought);
    return {
      nextAction: `${getActionVerb(thought)}: ${title}.`,
      sourceThoughtId: thought.id,
      title,
    };
  });
}

async function fetcherWithTimeout(
  fetcher: typeof fetch,
  {
    apiKey,
    controller,
    thoughts,
    timeoutId,
  }: {
    apiKey: string;
    controller: AbortController | undefined;
    thoughts: Thought[];
    timeoutId: ReturnType<typeof setTimeout> | undefined;
  },
) {
  try {
    return await fetcher(OPENROUTER_CHAT_COMPLETIONS_URL, {
      body: JSON.stringify(createOpenRouterRequest(thoughts)),
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

function createOpenRouterRequest(thoughts: Thought[]) {
  return {
    max_tokens: 520,
    messages: [
      {
        content:
          "Turn captured non-reward FocusPal thoughts into a concise after-focus action plan. Preserve each sourceThoughtId exactly. Do not invent tasks.",
        role: "system",
      },
      {
        content: JSON.stringify({
          thoughts: thoughts.map((thought) => ({
            category: thought.category,
            rawText: thought.rawText,
            sourceThoughtId: thought.id,
            title: thought.title || thought.rawText,
          })),
        }),
        role: "user",
      },
    ],
    model: OPENROUTER_TASK_PLAN_MODEL,
    provider: {
      require_parameters: true,
    },
    response_format: {
      json_schema: {
        name: "focuspal_task_plan",
        schema: {
          additionalProperties: false,
          properties: {
            tasks: {
              items: {
                additionalProperties: false,
                properties: {
                  confidence: {
                    description: "Confidence from 0 to 1 that this action follows from the source thought.",
                    maximum: 1,
                    minimum: 0,
                    type: "number",
                  },
                  nextAction: {
                    description: "One concrete next action, at most 16 words.",
                    type: "string",
                  },
                  sourceThoughtId: {
                    description: "The exact sourceThoughtId supplied in the input.",
                    type: "string",
                  },
                  title: {
                    description: "Short task title, at most 8 words.",
                    type: "string",
                  },
                },
                required: ["sourceThoughtId", "title", "nextAction", "confidence"],
                type: "object",
              },
              type: "array",
            },
          },
          required: ["tasks"],
          type: "object",
        },
        strict: true,
      },
      type: "json_schema",
    },
    temperature: 0.1,
  };
}

function parseMessageContent(content: unknown): ApiTaskPlan | null {
  if (typeof content === "string") {
    try {
      return JSON.parse(content) as ApiTaskPlan;
    } catch {
      return null;
    }
  }

  if (content && typeof content === "object" && !Array.isArray(content)) {
    return content as ApiTaskPlan;
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
      .join("");

    return parseMessageContent(text);
  }

  return null;
}

function normalizeApiTaskPlan(
  value: ApiTaskPlan | null,
  thoughts: Thought[],
): TaskItemDraft[] | null {
  if (!value || !Array.isArray(value.tasks)) {
    return null;
  }

  const sourceThoughtsById = new Map(thoughts.map((thought) => [thought.id, thought]));
  const tasks = value.tasks
    .map((task) => normalizeApiTask(task as ApiTaskDraft, sourceThoughtsById))
    .filter((task): task is TaskItemDraft => task !== null);

  return tasks.length > 0 ? tasks.slice(0, MAX_ACTIONABLE_THOUGHTS) : null;
}

function normalizeApiTask(
  value: ApiTaskDraft,
  sourceThoughtsById: Map<string, Thought>,
): TaskItemDraft | null {
  const sourceThoughtId =
    typeof value.sourceThoughtId === "string"
      ? value.sourceThoughtId
      : typeof value.source_thought_id === "string"
        ? value.source_thought_id
        : "";
  const sourceThought = sourceThoughtsById.get(sourceThoughtId);

  if (!sourceThought || typeof value.confidence !== "number") {
    return null;
  }

  if (!Number.isFinite(value.confidence) || value.confidence < MIN_API_CONFIDENCE) {
    return null;
  }

  const title = typeof value.title === "string" ? value.title.trim() : "";
  const nextAction =
    typeof value.nextAction === "string"
      ? value.nextAction.trim()
      : typeof value.next_action === "string"
        ? value.next_action.trim()
        : "";

  if (!title || !nextAction) {
    return null;
  }

  return {
    nextAction: limitWords(nextAction, 18),
    sourceThoughtId,
    title: limitWords(title, 10),
  };
}

function createTaskTitle(thought: Thought) {
  const compact = (thought.title || thought.rawText).trim().replace(/\s+/g, " ");
  return stripTrailingPunctuation(compact) || "Follow up";
}

function getActionVerb(thought: Thought) {
  switch (thought.category) {
    case "message":
      return "Respond";
    case "study":
      return "Review";
    default:
      return "Handle";
  }
}

function stripTrailingPunctuation(value: string) {
  return value.replace(/[.!?]+$/u, "");
}

function limitWords(value: string, maxWords: number) {
  const words = value.trim().replace(/\s+/g, " ").split(" ");
  return words.length > maxWords ? `${words.slice(0, maxWords).join(" ")}...` : words.join(" ");
}
