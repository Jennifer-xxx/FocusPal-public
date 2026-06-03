import { describe, expect, it, vi } from "vitest";
import type { FocusSession } from "./focus";
import {
  OPENROUTER_TASK_PLAN_MODEL,
  generateTaskPlanWithApiFallback,
  selectActionableThoughts,
} from "./taskExtraction";
import type { Thought } from "./thoughts";

const completedSession: FocusSession = {
  id: "session-1",
  plannedMinutes: 60,
  startedAt: "2026-05-01T09:00:00.000Z",
  endedAt: "2026-05-01T10:00:00.000Z",
  pausedSeconds: 0,
  updatedAt: "2026-05-01T10:00:00.000Z",
  status: "completed",
};

const taskThought: Thought = {
  id: "thought-task",
  rawText: "submit the CS153 video plan",
  title: "submit the CS153 video plan",
  category: "task",
  rewardEligible: false,
  confidence: 0.86,
  status: "captured",
  createdAt: "2026-05-01T09:15:00.000Z",
  updatedAt: "2026-05-01T09:15:00.000Z",
};

const studyThought: Thought = {
  id: "thought-study",
  rawText: "review transformer lecture notes",
  title: "review transformer lecture notes",
  category: "study",
  rewardEligible: false,
  confidence: 0.82,
  status: "captured",
  createdAt: "2026-05-01T09:20:00.000Z",
  updatedAt: "2026-05-01T09:20:00.000Z",
};

const messageThought: Thought = {
  id: "thought-message",
  rawText: "email the TA about project video timing",
  title: "email the TA about project video timing",
  category: "message",
  rewardEligible: false,
  confidence: 0.82,
  status: "captured",
  createdAt: "2026-05-01T09:25:00.000Z",
  updatedAt: "2026-05-01T09:25:00.000Z",
};

const rewardThought: Thought = {
  id: "thought-reward",
  rawText: "watch a saved YouTube clip",
  title: "watch a saved YouTube clip",
  category: "media",
  rewardEligible: true,
  confidence: 0.88,
  status: "captured",
  createdAt: "2026-05-01T09:30:00.000Z",
  updatedAt: "2026-05-01T09:30:00.000Z",
};

function createFetchResponse(content: unknown) {
  return {
    ok: true,
    json: async () => ({
      choices: [
        {
          message: {
            content: JSON.stringify(content),
          },
        },
      ],
    }),
  } as Response;
}

describe("generateTaskPlanWithApiFallback", () => {
  it("extracts local action items from task, study, and message thoughts", async () => {
    const fetcher = vi.fn();

    await expect(
      generateTaskPlanWithApiFallback({
        apiKey: "or-demo",
        fetcher,
        localOnly: true,
        session: completedSession,
        thoughts: [taskThought, studyThought, messageThought, rewardThought],
      }),
    ).resolves.toEqual([
      {
        nextAction: "Handle: submit the CS153 video plan.",
        sourceThoughtId: "thought-task",
        title: "submit the CS153 video plan",
      },
      {
        nextAction: "Review: review transformer lecture notes.",
        sourceThoughtId: "thought-study",
        title: "review transformer lecture notes",
      },
      {
        nextAction: "Respond: email the TA about project video timing.",
        sourceThoughtId: "thought-message",
        title: "email the TA about project video timing",
      },
    ]);
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("skips reward thoughts and thoughts outside the completed session", () => {
    const outsideThought: Thought = {
      ...taskThought,
      id: "thought-outside",
      createdAt: "2026-05-01T08:00:00.000Z",
    };

    expect(
      selectActionableThoughts(completedSession, [
        rewardThought,
        outsideThought,
        studyThought,
        { ...taskThought, status: "deleted" },
      ]),
    ).toEqual([studyThought]);
  });

  it("returns a validated structured API plan when API mode is enabled", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      createFetchResponse({
        tasks: [
          {
            confidence: 0.91,
            nextAction: "Send the TA a short timing question.",
            sourceThoughtId: "thought-message",
            title: "Email TA about timing",
          },
        ],
      }),
    );

    await expect(
      generateTaskPlanWithApiFallback({
        apiKey: "or-demo",
        fetcher,
        localOnly: false,
        session: completedSession,
        thoughts: [messageThought],
      }),
    ).resolves.toEqual([
      {
        nextAction: "Send the TA a short timing question.",
        sourceThoughtId: "thought-message",
        title: "Email TA about timing",
      },
    ]);

    expect(fetcher).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/chat/completions",
      expect.objectContaining({
        body: expect.stringContaining(OPENROUTER_TASK_PLAN_MODEL),
        headers: expect.objectContaining({
          Authorization: "Bearer or-demo",
        }),
        method: "POST",
      }),
    );
    const requestInit = fetcher.mock.calls[0]?.[1] as RequestInit | undefined;
    const request = JSON.parse(String(requestInit?.body));
    expect(request.response_format.json_schema).toMatchObject({
      name: "focuspal_task_plan",
      strict: true,
    });
  });

  it("falls back locally when the API response is invalid or low confidence", async () => {
    const invalidFetcher = vi.fn(async () => createFetchResponse({ tasks: null }));
    const lowConfidenceFetcher = vi.fn(async () =>
      createFetchResponse({
        tasks: [
          {
            confidence: 0.2,
            nextAction: "Maybe do this.",
            sourceThoughtId: "thought-task",
            title: "Maybe task",
          },
        ],
      }),
    );

    await expect(
      generateTaskPlanWithApiFallback({
        apiKey: "or-demo",
        fetcher: invalidFetcher,
        localOnly: false,
        session: completedSession,
        thoughts: [taskThought],
      }),
    ).resolves.toEqual([
      {
        nextAction: "Handle: submit the CS153 video plan.",
        sourceThoughtId: "thought-task",
        title: "submit the CS153 video plan",
      },
    ]);
    await expect(
      generateTaskPlanWithApiFallback({
        apiKey: "or-demo",
        fetcher: lowConfidenceFetcher,
        localOnly: false,
        session: completedSession,
        thoughts: [taskThought],
      }),
    ).resolves.toEqual([
      {
        nextAction: "Handle: submit the CS153 video plan.",
        sourceThoughtId: "thought-task",
        title: "submit the CS153 video plan",
      },
    ]);
  });

  it("returns no tasks when no actionable thoughts were captured during the session", async () => {
    await expect(
      generateTaskPlanWithApiFallback({
        apiKey: "or-demo",
        fetcher: vi.fn(),
        localOnly: false,
        session: completedSession,
        thoughts: [rewardThought],
      }),
    ).resolves.toEqual([]);
  });
});
