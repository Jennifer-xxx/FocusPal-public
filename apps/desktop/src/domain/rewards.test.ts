import { describe, expect, it } from "vitest";
import { selectRewardThought } from "./rewards";
import { Thought } from "./thoughts";

const baseThought: Thought = {
  id: "base",
  rawText: "watch a video",
  title: "watch a video",
  category: "media",
  rewardEligible: true,
  confidence: 0.9,
  status: "captured",
  createdAt: "2026-05-01T00:00:00.000Z",
  updatedAt: "2026-05-01T00:00:00.000Z",
};

describe("selectRewardThought", () => {
  it("returns null when there are no eligible thoughts", () => {
    expect(
      selectRewardThought([
        {
          ...baseThought,
          rewardEligible: false,
          category: "task",
        },
      ]),
    ).toBeNull();
  });

  it("does not return used or dismissed thoughts", () => {
    expect(
      selectRewardThought([
        { ...baseThought, id: "used", status: "used" },
        { ...baseThought, id: "dismissed", status: "dismissed" },
      ]),
    ).toBeNull();
  });

  it("prefers the oldest eligible thoughts with light randomness", () => {
    const selected = selectRewardThought(
      [
        { ...baseThought, id: "newest", createdAt: "2026-05-04T00:00:00.000Z" },
        { ...baseThought, id: "oldest", createdAt: "2026-05-01T00:00:00.000Z" },
        { ...baseThought, id: "middle", createdAt: "2026-05-02T00:00:00.000Z" },
      ],
      () => 0,
    );

    expect(selected?.id).toBe("oldest");
  });
});
