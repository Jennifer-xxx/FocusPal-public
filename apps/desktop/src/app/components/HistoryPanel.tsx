import { Check, ChevronDown, Filter, Gift, ListChecks, RotateCcw, X } from "lucide-react";
import { useState } from "react";
import type { TaskItem, TaskItemStatus } from "../../domain/taskExtraction";
import { THOUGHT_CATEGORIES, type Thought, type ThoughtCategory, type ThoughtStatus } from "../../domain/thoughts";
import {
  formatActionItemCount,
  formatCategoryLabel,
  formatHistoryCount,
  formatHistoryFilterLabel,
  formatRewardFilterLabel,
  formatStatusLabel,
  formatTaskItemStatusLabel,
  getCategoryClassName,
  getStatusClassName,
  getTaskItemSourceThought,
  getTaskItemStatusClassName,
  getThoughtDisplayText,
  sortTaskItemsForDisplay,
} from "../helpers";
import type { HistoryStatusFilter, RewardEligibilityFilter } from "../types";

const HISTORY_STATUS_FILTERS: HistoryStatusFilter[] = [
  "all",
  "captured",
  "snoozed",
  "dismissed",
  "used",
  "rewarded",
];

export function HistoryPanel({
  canOpenHistory,
  onDeleteThought,
  onUpdateTaskItemStatus,
  onUpdateCategory,
  onUpdateRewardEligibility,
  onUpdateStatus,
  taskItems,
  thoughts,
}: {
  canOpenHistory: boolean;
  onDeleteThought: (id: string) => void;
  onUpdateTaskItemStatus: (id: string, status: TaskItemStatus) => void;
  onUpdateCategory: (id: string, category: ThoughtCategory) => void;
  onUpdateRewardEligibility: (id: string, rewardEligible: boolean) => void;
  onUpdateStatus: (id: string, status: ThoughtStatus) => void;
  taskItems: TaskItem[];
  thoughts: Thought[];
}) {
  const [activeView, setActiveView] = useState<"thoughts" | "actions">("thoughts");
  const [statusFilter, setStatusFilter] = useState<HistoryStatusFilter>("all");
  const [rewardFilter, setRewardFilter] = useState<RewardEligibilityFilter>("all");
  const [categoryPickerThoughtId, setCategoryPickerThoughtId] = useState<string | null>(null);
  const [isHistoryFilterOpen, setIsHistoryFilterOpen] = useState(false);
  const sortedTaskItems = sortTaskItemsForDisplay(taskItems);
  const visibleThoughts =
    statusFilter === "all" ? thoughts : thoughts.filter((thought) => thought.status === statusFilter);
  const filteredThoughts = visibleThoughts.filter((thought) => {
    if (rewardFilter === "reward") {
      return thought.rewardEligible;
    }

    if (rewardFilter === "no-reward") {
      return !thought.rewardEligible;
    }

    return true;
  });

  return (
    <div className="grid h-full min-h-0 grid-rows-[auto_auto_auto_minmax(0,1fr)] gap-3 overflow-visible rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
      <div className="history-heading flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">History</h2>
          <p className="text-sm text-stone-500">
            {canOpenHistory ? "Thoughts and after-focus actions." : "Locked while a focus block is running."}
          </p>
        </div>
        {activeView === "thoughts" ? (
          <div className="relative shrink-0">
          <button
            aria-expanded={isHistoryFilterOpen}
            aria-label="History filters"
            className={[
              "inline-flex h-9 items-center gap-2 rounded-md border px-2.5 text-sm font-medium",
              statusFilter === "all" && rewardFilter === "all"
                ? "border-stone-200 bg-white text-stone-600"
                : "border-emerald-200 bg-emerald-50 text-emerald-900",
            ].join(" ")}
            onClick={() => setIsHistoryFilterOpen((isOpen) => !isOpen)}
            type="button"
          >
            <Filter size={15} />
            <span className="history-filter-label">
              {formatHistoryFilterLabel(statusFilter, rewardFilter)}
            </span>
            <ChevronDown size={14} />
          </button>
          {isHistoryFilterOpen ? (
            <div className="history-filter-menu absolute right-0 z-50 mt-1 grid max-h-64 w-52 gap-2 overflow-y-auto rounded-lg border border-stone-300 bg-[#fffdf8] p-2 shadow-lg">
              <div>
                <div className="px-2 pb-1 text-[0.68rem] font-medium uppercase tracking-wide text-stone-500">
                  Status
                </div>
                <div className="grid gap-1">
                  {HISTORY_STATUS_FILTERS.map((filter) => (
                    <button
                      className={[
                        "rounded-md px-2 py-1.5 text-left text-sm",
                        statusFilter === filter
                          ? "bg-stone-950 text-white"
                          : "text-stone-700 hover:bg-stone-100",
                      ].join(" ")}
                      key={filter}
                      onClick={() => {
                        setStatusFilter(filter);
                        setIsHistoryFilterOpen(false);
                      }}
                      type="button"
                    >
                      {formatStatusLabel(filter)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="border-t border-stone-200 pt-2">
                <div className="px-2 pb-1 text-[0.68rem] font-medium uppercase tracking-wide text-stone-500">
                  Reward
                </div>
                <div className="grid gap-1">
                  {(["all", "reward", "no-reward"] as const).map((filter) => (
                    <button
                      className={[
                        "rounded-md px-2 py-1.5 text-left text-sm",
                        rewardFilter === filter
                          ? "bg-stone-950 text-white"
                          : "text-stone-700 hover:bg-stone-100",
                      ].join(" ")}
                      key={filter}
                      onClick={() => {
                        setRewardFilter(filter);
                        setIsHistoryFilterOpen(false);
                      }}
                      type="button"
                    >
                      {formatRewardFilterLabel(filter)}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          ) : null}
          </div>
        ) : null}
      </div>

      <div className="grid grid-cols-2 gap-1 rounded-md border border-stone-200 bg-[#fbfaf5] p-1">
        {(["thoughts", "actions"] as const).map((view) => (
          <button
            aria-pressed={activeView === view}
            className={[
              "inline-flex h-8 items-center justify-center gap-2 rounded px-2 text-sm font-medium",
              activeView === view
                ? "bg-stone-950 text-white"
                : "text-stone-700 hover:bg-stone-100",
            ].join(" ")}
            key={view}
            onClick={() => setActiveView(view)}
            type="button"
          >
            {view === "actions" ? <ListChecks size={14} /> : null}
            {view === "thoughts" ? "Thoughts" : "Actions"}
          </button>
        ))}
      </div>

      <p className="text-sm text-stone-500 format-history-count">
        {activeView === "thoughts"
          ? formatHistoryCount(filteredThoughts.length, thoughts.length)
          : formatActionItemCount(sortedTaskItems.length)}
      </p>

      <div aria-label="History entries" className="min-h-0 overflow-y-auto pr-1">
        {!canOpenHistory ? <p className="text-sm text-stone-500">Return after the session ends.</p> : null}
        {canOpenHistory && activeView === "thoughts" && thoughts.length === 0 ? (
          <p className="rounded-md border border-dashed border-stone-300 p-3 text-sm text-stone-500">
            No thoughts captured yet.
          </p>
        ) : null}
        {canOpenHistory && activeView === "thoughts" && thoughts.length > 0 && filteredThoughts.length === 0 ? (
          <p className="rounded-md border border-dashed border-stone-300 p-3 text-sm text-stone-500">
            No matching thoughts.
          </p>
        ) : null}
        {canOpenHistory && activeView === "thoughts" ? (
          <div className="grid gap-2">
            {filteredThoughts.map((thought) => {
              const isCategoryOpen = categoryPickerThoughtId === thought.id;
              const canToggleReward =
                thought.status === "captured" || thought.status === "snoozed";
              const canRestore = thought.status === "used" || thought.status === "dismissed";
              const thoughtText = getThoughtDisplayText(thought);

              return (
              <article className="rounded-md border border-stone-200 px-3 py-2" key={thought.id}>
                <div className="grid min-h-8 grid-cols-[minmax(0,1fr)_5rem] items-center gap-2">
                  <div className="history-thought-text min-w-0 pr-1">
                    <h3 className="break-words text-sm font-medium leading-snug [overflow-wrap:anywhere]">
                      {thoughtText}
                    </h3>
                  </div>
                  <div className="grid grid-rows-[1.75rem_1.75rem_1.75rem] place-items-center gap-1">
                    <div className="grid grid-cols-2 gap-1">
                      <span className="grid h-7 w-7 place-items-center">
                        {canToggleReward ? (
                          <button
                            aria-label={
                              thought.rewardEligible
                                ? "Mark as not reward eligible"
                                : "Mark as reward eligible"
                            }
                            className={[
                              "grid h-7 w-7 place-items-center rounded-full border text-sm",
                              thought.rewardEligible
                                ? "border-amber-300 bg-amber-100 text-amber-800"
                                : "border-stone-200 bg-white text-stone-300",
                            ].join(" ")}
                            onClick={() =>
                              onUpdateRewardEligibility(thought.id, !thought.rewardEligible)
                            }
                            title={thought.rewardEligible ? "Reward eligible" : "Not reward eligible"}
                            type="button"
                          >
                            <Gift size={14} fill={thought.rewardEligible ? "currentColor" : "none"} />
                          </button>
                        ) : canRestore ? (
                          <button
                            aria-label={`Move ${thoughtText} back to captured`}
                            className="grid h-7 w-7 place-items-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700"
                            onClick={() => onUpdateStatus(thought.id, "captured")}
                            title="Move back to captured"
                            type="button"
                          >
                            <RotateCcw size={14} />
                          </button>
                        ) : null}
                      </span>
                      <button
                        aria-label={`Delete ${thoughtText}`}
                        className="grid h-7 w-7 shrink-0 place-items-center rounded-full border border-stone-200 text-stone-500 hover:border-rose-200 hover:text-rose-700"
                        onClick={() => onDeleteThought(thought.id)}
                        type="button"
                      >
                        <X size={14} />
                      </button>
                    </div>
                    <span className={[
                      "inline-flex h-7 w-20 items-center justify-center rounded-full px-2 text-center text-xs font-medium",
                      getStatusClassName(thought.status),
                    ].join(" ")}
                    >
                      {formatStatusLabel(thought.status)}
                    </span>
                    <button
                      aria-expanded={isCategoryOpen}
                      aria-label={`Change category for ${thoughtText}`}
                      className={[
                        "inline-flex h-7 w-20 items-center justify-center rounded-full px-2 text-xs font-medium",
                        getCategoryClassName(thought.category),
                      ].join(" ")}
                      onClick={() =>
                        setCategoryPickerThoughtId((current) =>
                          current === thought.id ? null : thought.id,
                        )
                      }
                      type="button"
                    >
                      {formatCategoryLabel(thought.category)}
                    </button>
                  </div>
                </div>
                {isCategoryOpen ? (
                  <div className="mt-2 grid grid-cols-5 gap-1 rounded-lg border border-stone-300 bg-[#fffdf8] p-1.5 shadow-sm">
                    {THOUGHT_CATEGORIES.map((category) => (
                      <button
                        aria-label={`Set category to ${category}`}
                        className={[
                          "rounded-full px-2 py-1 text-xs font-medium transition",
                          getCategoryClassName(category),
                          category === thought.category
                            ? "ring-2 ring-stone-950"
                            : "opacity-75 hover:opacity-100",
                        ].join(" ")}
                        key={category}
                        onClick={() => {
                          onUpdateCategory(thought.id, category);
                          setCategoryPickerThoughtId(null);
                        }}
                        type="button"
                      >
                        {formatCategoryLabel(category)}
                      </button>
                    ))}
                  </div>
                ) : null}
              </article>
              );
            })}
          </div>
        ) : null}
        {canOpenHistory && activeView === "actions" ? (
          <div className="grid gap-2">
            {sortedTaskItems.length === 0 ? (
              <p className="rounded-md border border-dashed border-stone-300 p-3 text-sm text-stone-500">
                No action items yet.
              </p>
            ) : null}
            {sortedTaskItems.map((taskItem) => {
              const sourceThought = getTaskItemSourceThought(taskItem, thoughts);

              return (
                <article className="rounded-md border border-stone-200 px-3 py-2" key={taskItem.id}>
                  <div className="grid min-h-8 grid-cols-[minmax(0,1fr)_auto] items-start gap-3">
                    <div className="min-w-0">
                      <h3 className="break-words text-sm font-semibold leading-snug text-stone-950 [overflow-wrap:anywhere]">
                        {taskItem.title}
                      </h3>
                      <p className="mt-1 break-words text-sm leading-snug text-stone-700 [overflow-wrap:anywhere]">
                        {taskItem.nextAction}
                      </p>
                      {sourceThought ? (
                        <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5">
                          <span className="break-words text-xs text-stone-500 [overflow-wrap:anywhere]">
                            Source: {getThoughtDisplayText(sourceThought)}
                          </span>
                          <span
                            className={[
                              "inline-flex h-6 items-center rounded-full px-2 text-xs font-medium",
                              getCategoryClassName(sourceThought.category),
                            ].join(" ")}
                          >
                            {formatCategoryLabel(sourceThought.category)}
                          </span>
                        </div>
                      ) : null}
                    </div>
                    <div className="grid w-[5.75rem] shrink-0 place-items-center self-center gap-1">
                      <span
                        className={[
                          "inline-flex h-7 w-full items-center justify-center rounded-full px-2 text-xs font-medium",
                          getTaskItemStatusClassName(taskItem.status),
                        ].join(" ")}
                      >
                        {formatTaskItemStatusLabel(taskItem.status)}
                      </span>
                      <div className="grid w-full grid-cols-3 justify-items-center gap-1">
                        {taskItem.status !== "done" ? (
                          <button
                            aria-label={`Mark ${taskItem.title} done`}
                            className="grid h-7 w-7 place-items-center rounded-full bg-emerald-700 text-white shadow-sm"
                            onClick={() => onUpdateTaskItemStatus(taskItem.id, "done")}
                            title="Done"
                            type="button"
                          >
                            <Check size={14} />
                          </button>
                        ) : (
                          <button
                            aria-label={`Reopen ${taskItem.title}`}
                            className="grid h-7 w-7 place-items-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm"
                            onClick={() => onUpdateTaskItemStatus(taskItem.id, "open")}
                            title="Reopen"
                            type="button"
                          >
                            <RotateCcw size={14} />
                          </button>
                        )}
                        <button
                          aria-label={`Delete ${taskItem.title}`}
                          className="grid h-7 w-7 place-items-center rounded-full border border-stone-200 bg-white text-stone-500 shadow-sm hover:border-rose-200 hover:text-rose-700"
                          onClick={() => onUpdateTaskItemStatus(taskItem.id, "deleted")}
                          title="Delete"
                          type="button"
                        >
                          <X size={14} />
                        </button>
                        {taskItem.status === "deferred" ? (
                          <button
                            aria-label={`Reopen ${taskItem.title}`}
                            className="grid h-7 w-7 place-items-center rounded-full border border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm"
                            onClick={() => onUpdateTaskItemStatus(taskItem.id, "open")}
                            title="Reopen"
                            type="button"
                          >
                            <RotateCcw size={14} />
                          </button>
                        ) : (
                          <button
                            aria-label={`Defer ${taskItem.title}`}
                            className="grid h-7 w-7 place-items-center rounded-full border border-violet-200 bg-violet-50 text-violet-700 shadow-sm disabled:text-violet-300"
                            disabled={taskItem.status === "done"}
                            onClick={() => onUpdateTaskItemStatus(taskItem.id, "deferred")}
                            title="Defer"
                            type="button"
                          >
                            <ChevronDown size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}
