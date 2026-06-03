import { describe, expect, it, vi } from "vitest";
import {
  OPENROUTER_CLASSIFIER_MODEL,
  classifyThoughtWithApiFallback,
} from "./apiClassifier";

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

describe("classifyThoughtWithApiFallback", () => {
  it("uses the local classifier without calling OpenRouter in local-only mode", async () => {
    const fetcher = vi.fn();

    await expect(
      classifyThoughtWithApiFallback("play one Wordle round", {
        apiKey: "or-demo",
        fetcher,
        localOnly: true,
      }),
    ).resolves.toMatchObject({
      category: "game",
      rewardEligible: true,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("uses the local classifier without calling OpenRouter when the API key is missing", async () => {
    const fetcher = vi.fn();

    await expect(
      classifyThoughtWithApiFallback("submit the CS153 project update", {
        apiKey: "",
        fetcher,
        localOnly: false,
      }),
    ).resolves.toMatchObject({
      category: "task",
      rewardEligible: false,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("returns a validated OpenRouter structured classification", async () => {
    const fetcher = vi.fn(async () =>
      createFetchResponse({
        category: "food",
        confidence: 0.91,
        rewardEligible: true,
        title: "try the ramen place",
      }),
    );

    await expect(
      classifyThoughtWithApiFallback("maybe try the ramen place later", {
        apiKey: "or-demo",
        fetcher,
        localOnly: false,
      }),
    ).resolves.toEqual({
      category: "food",
      confidence: 0.91,
      rewardEligible: true,
      title: "try the ramen place",
    });
    expect(fetcher).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/chat/completions",
      expect.objectContaining({
        body: expect.stringContaining(OPENROUTER_CLASSIFIER_MODEL),
        headers: expect.objectContaining({
          Authorization: "Bearer or-demo",
        }),
        method: "POST",
      }),
    );
  });

  it("requires structured outputs from providers that support response_format", async () => {
    const fetcher = vi.fn(async (_input: RequestInfo | URL, _init?: RequestInit) =>
      createFetchResponse({
        category: "media",
        confidence: 0.89,
        rewardEligible: true,
        title: "watch the saved lecture clip",
      }),
    );

    await classifyThoughtWithApiFallback("watch the saved lecture clip", {
      apiKey: "or-demo",
      fetcher,
      localOnly: false,
    });

    const request = JSON.parse(String(fetcher.mock.calls[0]?.[1]?.body));
    expect(request).toMatchObject({
      model: OPENROUTER_CLASSIFIER_MODEL,
      provider: {
        require_parameters: true,
      },
      response_format: {
        type: "json_schema",
        json_schema: {
          name: "focuspal_thought_classification",
          strict: true,
        },
      },
    });
    expect(request.response_format.json_schema.schema).toMatchObject({
      additionalProperties: false,
      required: ["title", "category", "confidence", "rewardEligible"],
    });
  });

  it("falls back locally when OpenRouter fails or returns invalid content", async () => {
    const fetcher = vi.fn(async () =>
      ({
        ok: true,
        json: async () => ({
          choices: [{ message: { content: "{\"category\":\"invalid\"}" } }],
        }),
      }) as Response,
    );

    await expect(
      classifyThoughtWithApiFallback("look up ramen near campus", {
        apiKey: "or-demo",
        fetcher,
        localOnly: false,
      }),
    ).resolves.toMatchObject({
      category: "food",
      rewardEligible: true,
    });
  });

  it("falls back locally when API confidence is too low", async () => {
    const fetcher = vi.fn(async () =>
      createFetchResponse({
        category: "shopping",
        confidence: 0.31,
        rewardEligible: true,
        title: "buy a new charger",
      }),
    );

    await expect(
      classifyThoughtWithApiFallback("buy a new charger", {
        apiKey: "or-demo",
        fetcher,
        localOnly: false,
      }),
    ).resolves.toMatchObject({
      category: "shopping",
      confidence: 0.84,
      rewardEligible: true,
    });
  });
});
