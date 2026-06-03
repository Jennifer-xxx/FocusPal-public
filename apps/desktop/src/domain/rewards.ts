import { Thought } from "./thoughts";

export type RewardStatus = "revealed" | "used" | "snoozed" | "dismissed";
export type RewardCreditStatus = "available" | "spent";

export type RewardCredit = {
  id: string;
  sourceSessionId?: string;
  earnedAt: string;
  spentAt?: string;
  updatedAt: string;
  status: RewardCreditStatus;
};

export type Reward = {
  id: string;
  creditId?: string;
  thoughtId: string;
  sessionId: string;
  revealedAt: string;
  updatedAt: string;
  status: RewardStatus;
};

const rewardableStatuses = new Set<Thought["status"]>(["captured", "snoozed"]);

export function selectRewardThought(
  thoughts: Thought[],
  random: () => number = Math.random,
): Thought | null {
  const candidates = thoughts
    .filter((thought) => thought.rewardEligible && rewardableStatuses.has(thought.status))
    .sort(
      (left, right) =>
        new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime(),
    );

  if (candidates.length === 0) {
    return null;
  }

  const oldestWindow = candidates.slice(0, Math.min(3, candidates.length));
  const index = Math.min(oldestWindow.length - 1, Math.floor(random() * oldestWindow.length));
  return oldestWindow[index];
}
