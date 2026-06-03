export const THOUGHT_CATEGORIES = [
  "task",
  "search",
  "media",
  "game",
  "food",
  "shopping",
  "message",
  "study",
  "idea",
  "other",
] as const;

export type ThoughtCategory = (typeof THOUGHT_CATEGORIES)[number];

export type ThoughtStatus =
  | "captured"
  | "rewarded"
  | "used"
  | "snoozed"
  | "dismissed"
  | "deleted";

export type RoutedThought = {
  category: ThoughtCategory;
  rewardEligible: boolean;
  title: string;
  confidence: number;
};

export type Thought = {
  id: string;
  rawText: string;
  title: string;
  category: ThoughtCategory;
  rewardEligible: boolean;
  confidence: number;
  status: ThoughtStatus;
  createdAt: string;
  updatedAt: string;
};

export const DEFAULT_REWARD_CATEGORIES = new Set<ThoughtCategory>([
  "search",
  "media",
  "game",
  "food",
  "shopping",
  "idea",
]);

export function isRewardEligible(category: ThoughtCategory, confidence: number) {
  if (DEFAULT_REWARD_CATEGORIES.has(category)) {
    return true;
  }

  return category === "other" && confidence >= 0.7;
}
