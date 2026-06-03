import { type CSSProperties, type MouseEvent, type PointerEvent, useEffect, useRef } from "react";
import {
  ArrowRight,
  Bell,
  Box,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ListChecks,
  Keyboard,
  Pause,
  Play,
  Sparkles,
  X,
} from "lucide-react";
import type { FocusDebrief } from "../../domain/focusDebrief";
import { formatRemainingTime, type FocusSession } from "../../domain/focus";
import type { RewardStatus } from "../../domain/rewards";
import type { TaskItem, TaskItemStatus } from "../../domain/taskExtraction";
import companionAnnoyed from "../assets/companion/companion_annoyed.png";
import companionAnnoyedPaused from "../assets/companion/companion_annoyed_paused.png";
import companionFocused from "../assets/companion/companion_focused.png";
import companionIdle from "../assets/companion/companion_idle.png";
import companionPaused from "../assets/companion/companion_paused.png";
import companionRewardReady from "../assets/companion/companion_reward_ready.png";
import {
  formatCategoryLabel,
  formatCompletedMinutes,
  getThoughtDisplayText,
} from "../helpers";
import type { DurationMode, RevealedReward } from "../types";
import { Metric } from "./SharedUi";

const CHARACTER_CLICK_DELAY_MS = 260;
const CHARACTER_DRAG_THRESHOLD_PX = 6;

export function CompanionPanel({
  activeFocus,
  customDuration,
  durationMode,
  focusInProgress,
  completedMinutes,
  nextOpenTaskItem,
  onCancelFocus,
  onCollapseToWidget,
  onOpenCatcher,
  onPauseFocus,
  onResumeFocus,
  onResolveReward,
  onSetCustomDuration,
  onSetDurationMode,
  onStartFocus,
  pausedFocus,
  remainingSeconds,
  revealedReward,
  session,
  unlockedRewards,
  openActionCount,
}: {
  activeFocus: boolean;
  customDuration: number;
  durationMode: DurationMode;
  focusInProgress: boolean;
  completedMinutes: number;
  nextOpenTaskItem: TaskItem | null;
  onCancelFocus: () => void;
  onCollapseToWidget: () => void;
  onOpenCatcher: () => void;
  onPauseFocus: () => void;
  onResumeFocus: () => void;
  onResolveReward: (status: RewardStatus) => void;
  onSetCustomDuration: (minutes: number) => void;
  onSetDurationMode: (mode: DurationMode) => void;
  onStartFocus: () => void;
  pausedFocus: boolean;
  remainingSeconds: number;
  revealedReward: RevealedReward | null;
  session: FocusSession | null;
  unlockedRewards: number;
  openActionCount: number;
}) {
  return (
    <div
      aria-label="Main companion panel"
      className="companion-panel flex h-full min-h-0 flex-col gap-3 rounded-lg border border-stone-200 bg-white p-3 shadow-sm"
      onDoubleClick={onCollapseToWidget}
    >
      <div className="companion-metrics grid grid-cols-3 gap-2">
        <Metric icon={<Clock3 size={16} />} label="Done" value={formatCompletedMinutes(completedMinutes)} />
        <Metric icon={<Box size={16} />} label="Boxes" value={`${unlockedRewards}`} />
        <Metric
          icon={activeFocus ? <Pause size={16} /> : <Bell size={16} />}
          label="State"
          value={session?.status ?? "idle"}
        />
      </div>
      
      <div className="companion-summary grid grid-cols-[1fr_auto] items-center gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
            {focusInProgress ? "Remaining" : "Next block"}
          </p>
          <p className="mt-1 text-4xl font-semibold leading-none tracking-normal">
            {formatRemainingTime(remainingSeconds)}
            <span className="ml-1 text-base font-medium text-stone-500">
              {session?.status === "paused" ? "paused" : "left"}
            </span>
          </p>
        </div>
        <button
          className="companion-capture inline-flex h-11 items-center justify-center gap-2 rounded-md bg-stone-950 px-3 text-sm font-medium text-white"
          onClick={onOpenCatcher}
          type="button"
        >
          <Keyboard size={16} />
          Capture thought
        </button>
      </div>

      <div className="companion-controls grid gap-2">
        {!focusInProgress ? (
          <div className="duration-controls grid grid-cols-[minmax(0,1fr)_auto] gap-2">
            <label className="sr-only" htmlFor="focus-duration">
              Focus duration
            </label>
            <select
              className="min-w-0 rounded-md border border-stone-300 bg-white px-2 py-2 text-sm font-medium"
              id="focus-duration"
              onChange={(event) => onSetDurationMode(event.currentTarget.value as DurationMode)}
              value={durationMode}
            >
              <option value="1">1 min</option>
              <option value="15">15 min</option>
              <option value="30">30 min</option>
              <option value="60">60 min</option>
              <option value="120">120 min</option>
              <option value="custom">Custom (min)</option>
            </select>
            <label className="sr-only" htmlFor="custom-focus-duration">
              Custom focus minutes
            </label>
            <input
              className="w-20 rounded-md border border-stone-300 px-2 py-2 text-sm font-medium disabled:bg-stone-100 disabled:text-stone-400"
              disabled={durationMode !== "custom"}
              id="custom-focus-duration"
              inputMode="numeric"
              min={1}
              max={240}
              onChange={(event) => onSetCustomDuration(Number(event.currentTarget.value))}
              type="number"
              value={customDuration}
            />
          </div>
        ) : null}

        <div className="grid grid-cols-3 gap-2">
          <button
            className="inline-flex items-center justify-center gap-2 rounded-md bg-emerald-700 px-3 py-2 text-sm font-medium text-white disabled:bg-stone-300"
            disabled={focusInProgress}
            onClick={onStartFocus}
            type="button"
          >
            <Play size={16} />
            Start
          </button>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-md border border-stone-300 px-3 py-2 text-sm font-medium disabled:text-stone-300"
            disabled={!focusInProgress}
            onClick={activeFocus ? onPauseFocus : onResumeFocus}
            type="button"
          >
            {pausedFocus ? <Play size={16} /> : <Pause size={16} />}
            {pausedFocus ? "Resume" : "Pause"}
          </button>
          <button
            className="inline-flex items-center justify-center gap-2 rounded-md border border-stone-300 px-3 py-2 text-sm font-medium text-stone-700 disabled:text-stone-300"
            disabled={!focusInProgress}
            onClick={onCancelFocus}
            type="button"
          >
            <X size={16} />
            Cancel
          </button>
        </div>
      </div>

      {openActionCount > 0 ? (
        <section className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2">
          <div className="flex items-center justify-between gap-3 text-xs font-medium uppercase tracking-wide text-emerald-800">
            <span>Actions: {openActionCount} open</span>
            <ListChecks size={15} />
          </div>
          {nextOpenTaskItem ? (
            <div className="mt-1">
              <p className="text-xs font-medium uppercase tracking-wide text-emerald-700">
                Next after focus
              </p>
              <p className="mt-0.5 line-clamp-2 break-words text-sm leading-snug text-emerald-950">
                {nextOpenTaskItem.nextAction}
              </p>
            </div>
          ) : null}
        </section>
      ) : null}

      <CompanionStage
        activeFocus={activeFocus}
        onResolveReward={onResolveReward}
        revealedReward={revealedReward}
        unlockedRewards={unlockedRewards}
      />
    </div>
  );
}

export function FocusWidget({
  activeFocus,
  availableBoxes,
  onCancelFocus,
  onOpenCatcher,
  onPauseFocus,
  onRestoreMainPage,
  onResumeFocus,
  onStartWidgetDrag,
  pausedFocus,
  plannedMinutes,
  remainingSeconds,
  usableThoughtCount,
}: {
  activeFocus: boolean;
  availableBoxes: number;
  onCancelFocus: () => void;
  onOpenCatcher: () => void;
  onPauseFocus: () => void;
  onRestoreMainPage: () => void;
  onResumeFocus: () => void;
  onStartWidgetDrag: () => void;
  pausedFocus: boolean;
  plannedMinutes: number;
  remainingSeconds: number;
  usableThoughtCount: number;
}) {
  const plannedSeconds = Math.max(1, plannedMinutes * 60);
  const remainingRatio = Math.max(0, Math.min(1, remainingSeconds / plannedSeconds));
  const progressDegrees = `${Math.max(2, remainingRatio * 360)}deg`;

  return (
    <section
      aria-label="Focus companion widget"
      className="focus-widget select-none rounded-[1.1rem] border border-emerald-200/80 bg-[#fffdf7] p-2 shadow-xl shadow-stone-900/15"
      onDoubleClick={onRestoreMainPage}
      role="region"
    >
      <div
        aria-label="Move focus widget"
        className="widget-drag-handle mx-auto mb-1.5 h-1.5 w-11 rounded-full bg-emerald-200/80"
        onPointerDown={onStartWidgetDrag}
      />

      <div className="grid grid-cols-[4.7rem_minmax(0,1fr)] items-center gap-2">
        <div
          aria-label={`Remaining ${formatRemainingTime(remainingSeconds)}`}
          className="focus-ring grid place-items-center rounded-full"
          style={
            { "--focus-progress-degrees": progressDegrees } as CSSProperties & Record<string, string>
          }
        >
          <div className="grid h-[3.9rem] w-[3.9rem] place-items-center rounded-full bg-white shadow-inner">
            <div className="text-center">
              <div className="text-base font-semibold leading-none tracking-normal">
                {formatRemainingTime(remainingSeconds)}
              </div>
              <div className="mt-0.5 text-[0.56rem] font-medium uppercase tracking-wide text-stone-500">
                {activeFocus ? "focus" : "paused"}
              </div>
            </div>
          </div>
        </div>

        <div className="grid min-w-0 gap-1.5">
          <div className="grid grid-cols-2 gap-1">
            <span
              aria-label={`${availableBoxes} boxes`}
              className="rounded-full border border-amber-200 bg-amber-50 px-1.5 py-0.5 text-center text-xs font-semibold"
            >
              🎁 {availableBoxes}
            </span>
            <span
              aria-label={`${usableThoughtCount} usable thoughts`}
              className="rounded-full border border-sky-200 bg-sky-50 px-1.5 py-0.5 text-center text-xs font-semibold"
            >
              💭 {usableThoughtCount}
            </span>
          </div>

          <button
            aria-label="⌘⇧Space"
            className="inline-flex h-7 items-center justify-center rounded-full border border-stone-200 bg-white px-2 text-xs font-semibold text-stone-700 shadow-sm"
            onClick={onOpenCatcher}
            title="Cmd+Shift+Space"
            type="button"
          >
            ⌘⇧Space
          </button>

          <div className="grid grid-cols-3 gap-1">
            <button
              aria-label={pausedFocus ? "Resume focus" : "Pause focus"}
              className="grid h-7 place-items-center rounded-full bg-emerald-700 text-white shadow-sm"
              onClick={activeFocus ? onPauseFocus : onResumeFocus}
              type="button"
            >
              {pausedFocus ? <Play size={13} /> : <Pause size={13} />}
            </button>
            <button
              aria-label="Cancel focus"
              className="grid h-7 place-items-center rounded-full border border-rose-200 bg-rose-50 text-rose-700 shadow-sm"
              onClick={onCancelFocus}
              type="button"
            >
              <X size={13} />
            </button>
            <button
              aria-label="Open main page"
              className="grid h-7 place-items-center rounded-full border border-stone-200 bg-white text-stone-600 shadow-sm"
              onClick={onRestoreMainPage}
              type="button"
            >
              <ChevronDown className="rotate-180" size={13} />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export function CharacterCompanion({
  activeFocus,
  characterAutoPaused,
  characterInactive,
  onRestoreMainPage,
  onStartWidgetDrag,
  onToggleFocus,
  pausedFocus,
  plannedMinutes,
  remainingSeconds,
  rewardReady,
}: {
  activeFocus: boolean;
  characterAutoPaused: boolean;
  characterInactive: boolean;
  onRestoreMainPage: () => void;
  onStartWidgetDrag: () => void;
  onToggleFocus: () => void;
  pausedFocus: boolean;
  plannedMinutes: number;
  remainingSeconds: number;
  rewardReady: boolean;
}) {
  const plannedSeconds = Math.max(1, plannedMinutes * 60);
  const remainingRatio = Math.max(0, Math.min(1, remainingSeconds / plannedSeconds));
  const completeRatio = Math.max(0, Math.min(1, 1 - remainingRatio));
  const progressPercent = Math.round(completeRatio * 100);
  const progressScale = completeRatio;
  const clickTimeoutRef = useRef<number | null>(null);
  const pointerStartRef = useRef<{ x: number; y: number } | null>(null);
  const dragStartedRef = useRef(false);
  const stateClass = getCharacterStateClass({
    activeFocus,
    characterAutoPaused,
    characterInactive,
    pausedFocus,
  });
  const imageSource = getCharacterImageSource({
    activeFocus,
    characterAutoPaused,
    characterInactive,
    pausedFocus,
    rewardReady,
  });

  useEffect(() => {
    return () => {
      if (clickTimeoutRef.current !== null) {
        window.clearTimeout(clickTimeoutRef.current);
      }
    };
  }, []);

  function clearPendingCharacterClick() {
    if (clickTimeoutRef.current !== null) {
      window.clearTimeout(clickTimeoutRef.current);
      clickTimeoutRef.current = null;
    }
  }

  function handlePointerDown(event: PointerEvent<HTMLElement>) {
    if (event.button !== 0) {
      return;
    }

    pointerStartRef.current = { x: event.clientX, y: event.clientY };
    dragStartedRef.current = false;
  }

  function handlePointerMove(event: PointerEvent<HTMLElement>) {
    const start = pointerStartRef.current;
    if (!start || dragStartedRef.current) {
      return;
    }

    const distance = Math.hypot(event.clientX - start.x, event.clientY - start.y);
    if (distance < CHARACTER_DRAG_THRESHOLD_PX) {
      return;
    }

    dragStartedRef.current = true;
    clearPendingCharacterClick();
    onStartWidgetDrag();
  }

  function handlePointerUp() {
    pointerStartRef.current = null;
  }

  function handleCharacterClick(event: MouseEvent<HTMLElement>) {
    if (dragStartedRef.current) {
      event.preventDefault();
      dragStartedRef.current = false;
      return;
    }

    if (event.detail !== 1) {
      clearPendingCharacterClick();
      return;
    }

    clearPendingCharacterClick();
    clickTimeoutRef.current = window.setTimeout(() => {
      clickTimeoutRef.current = null;
      onToggleFocus();
    }, CHARACTER_CLICK_DELAY_MS);
  }

  function handleCharacterDoubleClick() {
    clearPendingCharacterClick();
    onRestoreMainPage();
  }

  return (
    <section
      aria-label="Focus character companion"
      className={[
        "character-companion select-none",
        stateClass,
        characterAutoPaused ? "character-companion--auto-paused" : "",
        rewardReady ? "character-companion--reward-ready" : "",
      ].join(" ")}
      onClick={handleCharacterClick}
      onDoubleClick={handleCharacterDoubleClick}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerCancel={handlePointerUp}
      onPointerUp={handlePointerUp}
      role="region"
    >
      <div className="character-sprite" aria-hidden="true">
        <div className="character-glow" />
        <img
          alt=""
          className="character-image"
          draggable={false}
          src={imageSource}
        />
      </div>
      <div
        aria-label="Focus progress"
        aria-valuemax={100}
        aria-valuemin={0}
        aria-valuenow={progressPercent}
        className="character-progress"
        role="progressbar"
        style={
          {
            "--character-progress-scale": `${progressScale}`,
          } as CSSProperties & Record<string, string>
        }
      />
    </section>
  );
}

export function PostFocusReview({
  debrief,
  debriefStatus,
  onContinue,
  onResolveReward,
  onUpdateTaskItemStatus,
  revealedReward,
  session,
  taskItems,
  taskPlanStatus,
}: {
  debrief: FocusDebrief | null;
  debriefStatus: "idle" | "loading" | "ready" | "unavailable";
  onContinue: () => void;
  onResolveReward: (status: RewardStatus) => void;
  onUpdateTaskItemStatus: (id: string, status: TaskItemStatus) => void;
  revealedReward: RevealedReward | null;
  session: FocusSession | null;
  taskItems: TaskItem[];
  taskPlanStatus: "idle" | "loading" | "ready" | "empty";
}) {
  const completedMinutes = session?.plannedMinutes ?? 0;

  return (
    <main className="app-root h-screen overflow-hidden bg-[#f4f1ea] p-3 text-stone-950">
      <section className="mx-auto grid h-full w-full max-w-[520px] grid-rows-[auto_minmax(0,1fr)_auto] gap-3 rounded-lg border border-stone-200 bg-white p-3 shadow-sm">
        <header className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-emerald-100 text-emerald-800">
            <CheckCircle2 size={22} />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-lg font-semibold tracking-normal">Focus complete</h1>
            <p className="text-sm text-stone-500">
              {completedMinutes > 0 ? formatCompletedMinutes(completedMinutes) : "Block saved"}
            </p>
          </div>
        </header>

        <section className="min-h-0 overflow-y-auto pr-1">
          <div className="grid gap-3">
            <section className="rounded-lg border border-amber-200 bg-amber-50 p-3">
              <div className="flex min-w-0 items-start gap-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-amber-300 bg-white text-amber-800">
                  <Box size={22} />
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-medium uppercase tracking-wide text-amber-700">
                    Reward
                  </p>
                  {revealedReward ? (
                    <>
                      <p className="mt-1 break-words text-base font-semibold text-amber-950">
                        {getThoughtDisplayText(revealedReward.thought)}
                      </p>
                      <p className="mt-1 text-xs uppercase tracking-wide text-amber-700">
                        {formatCategoryLabel(revealedReward.thought.category)}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-sm text-amber-800">
                      No reward is ready yet. Capture a reward-eligible thought for the next box.
                    </p>
                  )}
                </div>
              </div>
              {revealedReward ? (
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <button
                    className="rounded-md bg-amber-700 px-2 py-2 text-sm font-medium text-white"
                    onClick={() => onResolveReward("used")}
                    type="button"
                  >
                    Use
                  </button>
                  <button
                    className="rounded-md border border-amber-300 bg-white px-2 py-2 text-sm font-medium text-amber-950"
                    onClick={() => onResolveReward("snoozed")}
                    type="button"
                  >
                    Snooze
                  </button>
                  <button
                    className="rounded-md border border-amber-300 bg-white px-2 py-2 text-sm font-medium text-amber-950"
                    onClick={() => onResolveReward("dismissed")}
                    type="button"
                  >
                    Dismiss
                  </button>
                </div>
              ) : null}
            </section>

            <section className="rounded-lg border border-stone-200 bg-[#fdfbf5] p-3">
              <p className="text-xs font-medium uppercase tracking-wide text-stone-500">
                Focus debrief
              </p>
              {debrief ? (
                <div className="mt-3 grid gap-3 text-sm">
                  <DebriefLine label="Recap" value={debrief.summary} />
                  <DebriefLine label="Pattern" value={debrief.pattern} />
                  <DebriefLine label="Next" value={debrief.nextIntention} />
                  <DebriefLine label="After" value={debrief.rewardSuggestion} />
                </div>
              ) : (
                <p className="mt-3 text-sm text-stone-500">
                  {debriefStatus === "loading" ? "Preparing debrief..." : "Debrief unavailable"}
                </p>
              )}
            </section>

            <section className="rounded-lg border border-emerald-200 bg-emerald-50 p-3">
              <div className="flex items-center gap-2 text-emerald-900">
                <ListChecks size={17} />
                <p className="text-xs font-medium uppercase tracking-wide">
                  Action plan
                </p>
              </div>
              {taskItems.length > 0 ? (
                <div className="mt-3 grid gap-2">
                  {taskItems.map((taskItem) => (
                    <TaskPlanItem
                      key={taskItem.id}
                      onUpdateStatus={onUpdateTaskItemStatus}
                      taskItem={taskItem}
                    />
                  ))}
                </div>
              ) : (
                <p className="mt-3 text-sm text-emerald-800">
                  {taskPlanStatus === "loading"
                    ? "Extracting action items..."
                    : "No task, study, or message thoughts were captured in this block."}
                </p>
              )}
            </section>
          </div>
        </section>

        <button
          className="inline-flex h-11 items-center justify-center gap-2 rounded-md bg-stone-950 px-3 text-sm font-medium text-white"
          onClick={onContinue}
          type="button"
        >
          Continue
          <ArrowRight size={16} />
        </button>
      </section>
    </main>
  );
}

function TaskPlanItem({
  onUpdateStatus,
  taskItem,
}: {
  onUpdateStatus: (id: string, status: TaskItemStatus) => void;
  taskItem: TaskItem;
}) {
  const isDone = taskItem.status === "done";
  const isDeferred = taskItem.status === "deferred";

  return (
    <article className="rounded-md border border-emerald-200 bg-white px-3 py-2">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <h3
            className={[
              "break-words text-sm font-semibold leading-snug text-emerald-950",
              isDone ? "line-through decoration-emerald-500 decoration-2" : "",
            ].join(" ")}
          >
            {taskItem.title}
          </h3>
          <p className="mt-1 break-words text-sm leading-snug text-emerald-800">
            {taskItem.nextAction}
          </p>
          <p className="mt-1 text-xs font-medium uppercase tracking-wide text-emerald-700">
            {isDone ? "Done" : isDeferred ? "Deferred" : "Open"}
          </p>
        </div>
        <div className="grid shrink-0 gap-1">
          <button
            className="rounded-md bg-emerald-700 px-2 py-1.5 text-xs font-medium text-white disabled:bg-emerald-200"
            disabled={isDone}
            onClick={() => onUpdateStatus(taskItem.id, "done")}
            type="button"
          >
            Done
          </button>
          <button
            className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1.5 text-xs font-medium text-emerald-950 disabled:text-emerald-300"
            disabled={isDeferred || isDone}
            onClick={() => onUpdateStatus(taskItem.id, "deferred")}
            type="button"
          >
            Defer
          </button>
          {(isDone || isDeferred) ? (
            <button
              className="rounded-md border border-stone-300 bg-white px-2 py-1.5 text-xs font-medium text-stone-700"
              onClick={() => onUpdateStatus(taskItem.id, "open")}
              type="button"
            >
              Reopen
            </button>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function DebriefLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1">
      <p className="text-xs font-medium uppercase tracking-wide text-stone-500">{label}</p>
      <p className="break-words leading-snug text-stone-800">{value}</p>
    </div>
  );
}

function getCharacterStateClass({
  activeFocus,
  characterAutoPaused,
  characterInactive,
  pausedFocus,
}: {
  activeFocus: boolean;
  characterAutoPaused: boolean;
  characterInactive: boolean;
  pausedFocus: boolean;
}) {
  if (characterInactive || characterAutoPaused) {
    return "character-companion--inactive";
  }

  if (pausedFocus) {
    return "character-companion--paused";
  }

  return activeFocus ? "character-companion--focused" : "character-companion--idle";
}

function getCharacterImageSource({
  activeFocus,
  characterAutoPaused,
  characterInactive,
  pausedFocus,
  rewardReady,
}: {
  activeFocus: boolean;
  characterAutoPaused: boolean;
  characterInactive: boolean;
  pausedFocus: boolean;
  rewardReady: boolean;
}) {
  if (rewardReady) {
    return companionRewardReady;
  }

  if (characterAutoPaused) {
    return companionAnnoyedPaused;
  }

  if (characterInactive) {
    return companionAnnoyed;
  }

  if (pausedFocus) {
    return companionPaused;
  }

  if (activeFocus) {
    return companionFocused;
  }

  return companionIdle;
}

function CompanionStage({
  activeFocus,
  onResolveReward,
  revealedReward,
  unlockedRewards,
}: {
  activeFocus: boolean;
  onResolveReward: (status: RewardStatus) => void;
  revealedReward: RevealedReward | null;
  unlockedRewards: number;
}) {
  if (revealedReward) {
    const rewardText = getThoughtDisplayText(revealedReward.thought);

    return (
      <section className="companion-stage companion-stage--reward min-h-0 flex-1 overflow-hidden rounded-lg border border-amber-200 bg-amber-50 p-3">
        <div className="reward-content grid min-h-0 grid-rows-[1fr_auto] gap-3">
          <div className="grid min-h-0 place-items-center text-center">
            <div className="min-w-0">
              <div className="reward-visual mx-auto mb-2 grid h-14 w-14 place-items-center rounded-lg border border-amber-300 bg-white text-amber-800 shadow-sm">
                <Box size={30} strokeWidth={1.8} />
              </div>
              <p className="reward-title max-w-full break-words px-1 text-base font-semibold leading-snug text-amber-950">
                {rewardText}
              </p>
              <p className="reward-category mt-1 text-xs uppercase tracking-wide text-amber-700">
                {formatCategoryLabel(revealedReward.thought.category)}
              </p>
            </div>
          </div>
          <div className="reward-actions grid grid-cols-3 gap-2">
            <button
              className="rounded-md bg-amber-700 px-2 py-2 text-sm font-medium text-white"
              onClick={() => onResolveReward("used")}
              type="button"
            >
              Use
            </button>
            <button
              className="rounded-md border border-amber-300 bg-white px-2 py-2 text-sm font-medium text-amber-950"
              onClick={() => onResolveReward("snoozed")}
              type="button"
            >
              Snooze
            </button>
            <button
              className="rounded-md border border-amber-300 bg-white px-2 py-2 text-sm font-medium text-amber-950"
              onClick={() => onResolveReward("dismissed")}
              type="button"
            >
              Dismiss
            </button>
          </div>
        </div>
      </section>
    );
  }

  if (unlockedRewards > 0) {
    return (
      <section className="companion-stage companion-stage--waiting grid min-h-0 flex-1 place-items-center overflow-hidden rounded-lg border border-amber-200 bg-amber-50 p-3 text-center">
        <div>
          <div className="mx-auto mb-2 grid h-16 w-16 place-items-center rounded-lg border border-amber-300 bg-white text-amber-800 shadow-sm">
            <Box size={34} strokeWidth={1.8} />
          </div>
          <p className="text-base font-semibold text-amber-950">Box waiting</p>
          <p className="mt-1 text-sm text-amber-800">Capture an eligible thought.</p>
        </div>
      </section>
    );
  }

  return (
    <section className="companion-stage companion-stage--idle grid min-h-0 flex-1 place-items-center overflow-hidden rounded-lg border border-stone-200 bg-[#fdfbf5] p-3">
      <div className="grid gap-2 text-center">
        <div
          className={[
            "mx-auto grid h-20 w-20 place-items-center rounded-lg border shadow-sm transition-colors",
            activeFocus
              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
              : "border-amber-200 bg-amber-50 text-amber-800",
          ].join(" ")}
        >
          <Sparkles size={40} strokeWidth={1.7} />
        </div>
        <div>
          <p className="text-base font-semibold">
            {activeFocus ? "Body double is focused" : "Ready when you are"}
          </p>
          <p className="mt-1 text-sm text-stone-500">
            {activeFocus
              ? "Capture distractions without leaving the current app."
              : "Start a block or catch a thought instantly."}
          </p>
        </div>
      </div>
    </section>
  );
}
