import { DEFAULT_FOCUS_MINUTES } from "../domain/focus";
import type { FocusSession } from "../domain/focus";
import type { RewardStatus } from "../domain/rewards";
import type { TaskItem, TaskItemStatus } from "../domain/taskExtraction";
import type { Thought, ThoughtCategory, ThoughtStatus } from "../domain/thoughts";
import type { AppSettings, FocusCompanionMode } from "../lib/storage/repository";
import { SHORTCUT, SHORTCUT_OPTIONS, type ShortcutOption } from "./constants";
import type { DurationMode, HistoryStatusFilter, RewardEligibilityFilter } from "./types";

export function formatShortcutLabel(shortcut: string) {
  return normalizeShortcutOption(shortcut).replace("CmdOrCtrl", "Cmd").replace("Alt", "Option");
}

export function normalizeShortcutOption(shortcut: string): ShortcutOption {
  return SHORTCUT_OPTIONS.includes(shortcut as ShortcutOption)
    ? (shortcut as ShortcutOption)
    : SHORTCUT;
}

export function formatShortcutStatus(status: "browser-preview" | "ready") {
  switch (status) {
    case "browser-preview":
      return "Focused app only";
    case "ready":
      return "Ready";
  }
}

export function formatClassifierStatus(settings: AppSettings) {
  if (settings.localOnly) {
    return settings.apiKey ? "Local fallback (API key saved)" : "Local fallback";
  }

  return settings.apiKey ? "OpenRouter ready" : "Local fallback (missing key)";
}

export function formatFocusCompanionModeLabel(mode: FocusCompanionMode) {
  return mode === "character" ? "Pixel character" : "Compact widget";
}

export function formatCompletedMinutes(totalMinutes: number) {
  const safeMinutes = Math.max(0, Math.floor(totalMinutes));
  const hours = Math.floor(safeMinutes / 60);
  const minutes = safeMinutes % 60;

  return `${hours}:${minutes.toString().padStart(2, "0")}`;
}

export function formatStatusLabel(status: HistoryStatusFilter | ThoughtStatus) {
  switch (status) {
    case "all":
      return "All";
    case "captured":
      return "Captured";
    case "rewarded":
      return "Pending";
    case "used":
      return "Used";
    case "snoozed":
      return "Snoozed";
    case "dismissed":
      return "Dismissed";
    case "deleted":
      return "Deleted";
  }
}

export function formatRewardFilterLabel(filter: RewardEligibilityFilter) {
  switch (filter) {
    case "all":
      return "All";
    case "reward":
      return "Reward";
    case "no-reward":
      return "Non-reward";
  }
}

export function formatHistoryFilterLabel(
  statusFilter: HistoryStatusFilter,
  rewardFilter: RewardEligibilityFilter,
) {
  const labels = [];

  if (statusFilter !== "all") {
    labels.push(formatStatusLabel(statusFilter));
  }

  if (rewardFilter !== "all") {
    labels.push(formatRewardFilterLabel(rewardFilter));
  }

  return labels.length > 0 ? labels.join(" / ") : "All";
}

export function formatHistoryCount(visibleCount: number, totalCount: number) {
  if (totalCount === 0) {
    return "No saved thoughts";
  }

  return `${visibleCount} of ${totalCount} shown`;
}

export function formatActionItemCount(count: number) {
  return count === 1 ? "1 action item" : `${count} action items`;
}

export function formatTaskItemStatusLabel(status: TaskItemStatus) {
  switch (status) {
    case "open":
      return "Open";
    case "deferred":
      return "Deferred";
    case "done":
      return "Done";
    case "deleted":
      return "Deleted";
  }
}

export function formatDurationChoice(mode: DurationMode, customMinutes: number) {
  if (mode === "custom") {
    return `Custom (${Math.max(1, Math.round(customMinutes || 1))} min)`;
  }

  return `${mode} min`;
}

export function getCategoryClassName(category: ThoughtCategory) {
  switch (category) {
    case "task":
      return "bg-sky-100 text-sky-800";
    case "search":
      return "bg-cyan-100 text-cyan-800";
    case "media":
      return "bg-fuchsia-100 text-fuchsia-800";
    case "game":
      return "bg-violet-100 text-violet-800";
    case "food":
      return "bg-amber-100 text-amber-800";
    case "shopping":
      return "bg-rose-100 text-rose-800";
    case "message":
      return "bg-blue-100 text-blue-800";
    case "study":
      return "bg-lime-100 text-lime-800";
    case "idea":
      return "bg-emerald-100 text-emerald-800";
    case "other":
      return "bg-stone-100 text-stone-700";
  }
}

export function formatCategoryLabel(category: ThoughtCategory) {
  switch (category) {
    case "shopping":
      return "shop";
    case "message":
      return "note";
    case "study":
      return "study";
    default:
      return category;
  }
}

export function getStatusClassName(status: ThoughtStatus) {
  switch (status) {
    case "captured":
      return "bg-emerald-50 text-emerald-700";
    case "rewarded":
      return "bg-amber-50 text-amber-700";
    case "used":
      return "bg-sky-50 text-sky-700";
    case "snoozed":
      return "bg-violet-50 text-violet-700";
    case "dismissed":
      return "bg-stone-100 text-stone-600";
    case "deleted":
      return "bg-rose-50 text-rose-700";
  }
}

export function getTaskItemStatusClassName(status: TaskItemStatus) {
  switch (status) {
    case "open":
      return "bg-emerald-50 text-emerald-700";
    case "deferred":
      return "bg-violet-50 text-violet-700";
    case "done":
      return "bg-sky-50 text-sky-700";
    case "deleted":
      return "bg-rose-50 text-rose-700";
  }
}

export function getSelectedDurationMinutes(durationMode: DurationMode, customDuration: number) {
  if (durationMode !== "custom") {
    return Number(durationMode);
  }

  if (!Number.isFinite(customDuration)) {
    return DEFAULT_FOCUS_MINUTES;
  }

  return Math.min(240, Math.max(1, Math.round(customDuration)));
}

export function getDurationModeForMinutes(minutes: number): DurationMode {
  const roundedMinutes = Math.round(minutes);

  switch (roundedMinutes) {
    case 1:
      return "1";
    case 15:
      return "15";
    case 30:
      return "30";
    case 60:
      return "60";
    case 120:
      return "120";
    default:
      return "custom";
  }
}

export function sumCompletedMinutes(sessions: FocusSession[]) {
  return sessions
    .filter((storedSession) => storedSession.status === "completed")
    .reduce((total, storedSession) => total + storedSession.plannedMinutes, 0);
}

export function isUsableRewardThought(thought: Thought) {
  return (
    thought.rewardEligible &&
    (thought.status === "captured" || thought.status === "snoozed")
  );
}

export function getThoughtDisplayText(thought: Thought) {
  return thought.title || thought.rawText;
}

export function getVisibleTaskItems(taskItems: TaskItem[]) {
  return taskItems.filter((taskItem) => taskItem.status !== "deleted");
}

export function getOpenTaskItems(taskItems: TaskItem[]) {
  return getVisibleTaskItems(taskItems)
    .filter((taskItem) => taskItem.status === "open")
    .sort(compareTaskItemsByCreatedAtAsc);
}

export function sortTaskItemsForDisplay(taskItems: TaskItem[]) {
  return [...getVisibleTaskItems(taskItems)].sort((left, right) => {
    const statusDelta = getTaskItemStatusRank(left.status) - getTaskItemStatusRank(right.status);
    if (statusDelta !== 0) {
      return statusDelta;
    }

    return compareTaskItemsByCreatedAtAsc(left, right);
  });
}

export function getTaskItemSourceThought(taskItem: TaskItem, thoughts: Thought[]) {
  return thoughts.find((thought) => thought.id === taskItem.sourceThoughtId);
}

export function rewardStatusToThoughtStatus(status: RewardStatus): ThoughtStatus {
  return status === "used" || status === "snoozed" || status === "dismissed"
    ? status
    : "rewarded";
}

function getTaskItemStatusRank(status: TaskItemStatus) {
  switch (status) {
    case "open":
      return 0;
    case "deferred":
      return 1;
    case "done":
      return 2;
    case "deleted":
      return 3;
  }
}

function compareTaskItemsByCreatedAtAsc(left: TaskItem, right: TaskItem) {
  return new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime();
}
