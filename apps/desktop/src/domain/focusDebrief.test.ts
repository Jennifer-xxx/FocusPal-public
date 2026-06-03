import { describe, expect, it, vi } from "vitest";
import type { FocusSession } from "./focus";
import {
  OPENROUTER_DEBRIEF_MODEL,
  generateFocusDebriefWithApiFallback,
  selectDebriefThoughts,
} from "./focusDebrief";
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

const baseThought: Thought = {
  id: "thought-1",
  rawText: "watch a saved video after this",
  title: "watch a saved video",
  category: "media",
  rewardEligible: true,
  confidence: 0.9,
  status: "captured",
  createdAt: "2026-05-01T09:20:00.000Z",
  updatedAt: "2026-05-01T09:20:00.000Z",
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

describe("generateFocusDebriefWithApiFallback", () => {
  it("skips OpenRouter in local-only mode", async () => {
    const fetcher = vi.fn();

    await expect(
      generateFocusDebriefWithApiFallback({
        apiKey: "or-demo",
        fetcher,
        localOnly: true,
        session: completedSession,
        thoughts: [baseThought],
      }),
    ).resolves.toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("skips OpenRouter when no API key is saved", async () => {
    const fetcher = vi.fn();

    await expect(
      generateFocusDebriefWithApiFallback({
        apiKey: "",
        fetcher,
        localOnly: false,
        session: completedSession,
        thoughts: [baseThought],
      }),
    ).resolves.toBeNull();
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns a validated structured debrief", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      createFetchResponse({
        nextIntention: "Keep the next block centered on the CS153 milestone.",
        pattern: "Entertainment thoughts showed up during the middle of the block.",
        rewardSuggestion: "Use the saved video only after the next stopping point.",
        summary: "You completed the block while parking one media distraction.",
      }),
    );

    await expect(
      generateFocusDebriefWithApiFallback({
        apiKey: "or-demo",
        fetcher,
        localOnly: false,
        session: completedSession,
        thoughts: [baseThought],
      }),
    ).resolves.toEqual({
      nextIntention: "Keep the next block centered on the CS153 milestone.",
      pattern: "Entertainment thoughts showed up during the middle of the block.",
      rewardSuggestion: "Use the saved video only after the next stopping point.",
      summary: "You completed the block while parking one media distraction.",
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/chat/completions",
      expect.objectContaining({
        body: expect.stringContaining(OPENROUTER_DEBRIEF_MODEL),
        headers: expect.objectContaining({
          Authorization: "Bearer or-demo",
        }),
        method: "POST",
      }),
    );
    const requestInit = fetcher.mock.calls[0]?.[1] as RequestInit | undefined;
    const request = JSON.parse(String(requestInit?.body));
    expect(request.response_format.json_schema).toMatchObject({
      name: "focuspal_focus_debrief",
      strict: true,
    });
  });

  it("can generate a debrief for a completed session with no captured thoughts", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      createFetchResponse({
        nextIntention: "Start the next block with the same clear target.",
        pattern: "No distracting thoughts were captured during this block.",
        rewardSuggestion: "Take a short reset before choosing another block.",
        summary: "You completed the block without parking any distractions.",
      }),
    );

    await expect(
      generateFocusDebriefWithApiFallback({
        apiKey: "or-demo",
        fetcher,
        localOnly: false,
        session: completedSession,
        thoughts: [],
      }),
    ).resolves.toMatchObject({
      pattern: "No distracting thoughts were captured during this block.",
    });

    const requestInit = fetcher.mock.calls[0]?.[1] as RequestInit | undefined;
    const request = JSON.parse(String(requestInit?.body));
    expect(JSON.parse(request.messages[1].content)).toMatchObject({
      thoughtCount: 0,
      thoughts: [],
    });
  });

  it("falls back to no debrief on invalid content or refusal", async () => {
    const invalidFetcher = vi.fn(async () => createFetchResponse(null));
    const refusalFetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: "{}", refusal: "no" } }],
      }),
    }) as Response);

    await expect(
      generateFocusDebriefWithApiFallback({
        apiKey: "or-demo",
        fetcher: invalidFetcher,
        localOnly: false,
        session: completedSession,
        thoughts: [baseThought],
      }),
    ).resolves.toBeNull();
    await expect(
      generateFocusDebriefWithApiFallback({
        apiKey: "or-demo",
        fetcher: refusalFetcher,
        localOnly: false,
        session: completedSession,
        thoughts: [baseThought],
      }),
    ).resolves.toBeNull();
  });

  it("fills missing optional debrief fields from a local fallback", async () => {
    const fetcher = vi.fn(async () =>
      createFetchResponse({
        next_intention: "Keep the next block centered on the CS153 milestone.",
        summary: "You completed the block while parking one media distraction.",
      }),
    );

    await expect(
      generateFocusDebriefWithApiFallback({
        apiKey: "or-demo",
        fetcher,
        localOnly: false,
        session: completedSession,
        thoughts: [baseThought],
      }),
    ).resolves.toEqual({
      nextIntention: "Keep the next block centered on the CS153 milestone.",
      pattern: "Media thoughts were the main captured pattern.",
      rewardSuggestion: "Use one saved reward after a real stopping point.",
      summary: "You completed the block while parking one media distraction.",
    });
  });

  it("parses structured debriefs from content parts", async () => {
    const fetcher = vi.fn(async () => ({
      ok: true,
      json: async () => ({
        choices: [
          {
            message: {
              content: [
                {
                  text: JSON.stringify({
                    nextIntention: "Keep one goal visible.",
                    pattern: "Media thoughts showed up once.",
                    rewardSuggestion: "Use the saved video after stopping.",
                    summary: "You finished the block and parked one thought.",
                  }),
                },
              ],
            },
          },
        ],
      }),
    }) as Response);

    await expect(
      generateFocusDebriefWithApiFallback({
        apiKey: "or-demo",
        fetcher,
        localOnly: false,
        session: completedSession,
        thoughts: [baseThought],
      }),
    ).resolves.toMatchObject({
      pattern: "Media thoughts showed up once.",
    });
  });

  it("falls back to no debrief when the request fails", async () => {
    const fetcher = vi.fn(async () => ({ ok: false }) as Response);

    await expect(
      generateFocusDebriefWithApiFallback({
        apiKey: "or-demo",
        fetcher,
        localOnly: false,
        session: completedSession,
        thoughts: [baseThought],
      }),
    ).resolves.toBeNull();
  });
});

describe("selectDebriefThoughts", () => {
  it("prefers thoughts captured during the completed session", () => {
    const outsideThought: Thought = {
      ...baseThought,
      id: "thought-2",
      createdAt: "2026-05-01T08:00:00.000Z",
    };

    expect(selectDebriefThoughts(completedSession, [outsideThought, baseThought])).toEqual([
      baseThought,
    ]);
  });

  it("falls back to recent captured thoughts when session timing has no matches", () => {
    const oldThought: Thought = {
      ...baseThought,
      id: "thought-1",
      createdAt: "2026-05-01T08:00:00.000Z",
    };
    const laterThought: Thought = {
      ...baseThought,
      id: "thought-2",
      createdAt: "2026-05-01T10:30:00.000Z",
    };

    expect(selectDebriefThoughts(completedSession, [oldThought, laterThought])).toEqual([
      laterThought,
      oldThought,
    ]);
  });
});
