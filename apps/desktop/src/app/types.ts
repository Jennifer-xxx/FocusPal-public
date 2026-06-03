import type { FocusSession } from "../domain/focus";
import type { Reward } from "../domain/rewards";
import type { Thought, ThoughtStatus } from "../domain/thoughts";

export type AppSurface = "main" | "widget" | "post-focus";
export type CompanionTab = "companion" | "history" | "settings";
export type CatcherMode = "closed" | "hidden" | "modal" | "standalone-hide" | "standalone-restore";
export type ShortcutStatus = "browser-preview" | "ready";
export type ThoughtCatcherOpenMode = "hide" | "restore";
export type HistoryStatusFilter = "all" | Exclude<ThoughtStatus, "deleted">;
export type RewardEligibilityFilter = "all" | "reward" | "no-reward";
export type DurationMode = "1" | "15" | "30" | "60" | "120" | "custom";

export type TauriEvent<TPayload> = {
  payload: TPayload;
};

export type OpenThoughtCatcherPayload = {
  restoreMainPage?: boolean;
};

export type RevealedReward = {
  reward: Reward;
  thought: Thought;
};

export type ActiveFocusSession = FocusSession | null;
