import { describe, expect, it } from "vitest";
import { classifyThought } from "./classifier";

describe("classifyThought", () => {
  it("classifies game thoughts as reward eligible", () => {
    expect(classifyThought("play one Wordle round after work")).toMatchObject({
      category: "game",
      rewardEligible: true,
    });
  });

  it("classifies food thoughts as reward eligible", () => {
    expect(classifyThought("look up that ramen place near campus")).toMatchObject({
      category: "food",
      rewardEligible: true,
    });
  });

  it("classifies task thoughts as not reward eligible", () => {
    expect(classifyThought("submit the CS153 project update")).toMatchObject({
      category: "task",
      rewardEligible: false,
    });
  });

  it("classifies study thoughts as not reward eligible", () => {
    expect(classifyThought("review lecture notes for the quiz")).toMatchObject({
      category: "study",
      rewardEligible: false,
    });
  });

  it("falls back to other for unknown text", () => {
    expect(classifyThought("drifting cloud phrase")).toMatchObject({
      category: "other",
      rewardEligible: false,
    });
  });

  it("keeps the full thought text as the title", () => {
    const longThought =
      "i want to have a lot of sleep and then play with my favorite game after the demo";

    expect(classifyThought(longThought)).toMatchObject({
      title: longThought,
    });
  });
});
