import { Focus, History, Settings } from "lucide-react";
import {
  type FormEvent,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  CharacterCompanion,
  CompanionPanel,
  FocusWidget,
  PostFocusReview,
} from "./components/CompanionPanels";
import { HistoryPanel } from "./components/HistoryPanel";
import { SettingsPanel } from "./components/SettingsPanel";
import { StatusPill, TabButton } from "./components/SharedUi";
import { ThoughtCatcher } from "./components/ThoughtCatcher";
import {
  MAIN_WINDOW_MIN_HEIGHT,
  MAIN_WINDOW_MIN_WIDTH,
  MAIN_WINDOW_WIDTH,
  OPEN_MAIN_PAGE_EVENT,
  OPEN_THOUGHT_CATCHER_EVENT,
  SHORTCUT,
  CHARACTER_INACTIVE_AUTO_PAUSE_MS,
  CHARACTER_INACTIVE_WINDOW_HEIGHT,
  CHARACTER_INACTIVE_WINDOW_WIDTH,
  CHARACTER_MOUSE_INACTIVE_MS,
  CHARACTER_REWARD_READY_MS,
  CHARACTER_WINDOW_HEIGHT,
  CHARACTER_WINDOW_WIDTH,
  WIDGET_WINDOW_HEIGHT,
  WIDGET_WINDOW_WIDTH,
} from "./constants";
import {
  formatShortcutLabel,
  getDurationModeForMinutes,
  getOpenTaskItems,
  getSelectedDurationMinutes,
  isUsableRewardThought,
  normalizeShortcutOption,
  rewardStatusToThoughtStatus,
  sumCompletedMinutes,
} from "./helpers";
import type {
  AppSurface,
  CatcherMode,
  CompanionTab,
  DurationMode,
  OpenThoughtCatcherPayload,
  RevealedReward,
  ShortcutStatus,
  TauriEvent,
  ThoughtCatcherOpenMode,
} from "./types";
import { classifyThoughtWithApiFallback } from "../domain/apiClassifier";
import {
  type FocusDebrief,
  generateFocusDebriefWithApiFallback,
} from "../domain/focusDebrief";
import {
  DEFAULT_FOCUS_MINUTES,
  type FocusSession,
  cancelFocusSession,
  completeFocusSession,
  createFocusSession,
  getRemainingSeconds,
  getRewardUnlocks,
  isSessionComplete,
  pauseFocusSession,
  resumeFocusSession,
} from "../domain/focus";
import {
  type Reward,
  type RewardCredit,
  type RewardStatus,
  selectRewardThought,
} from "../domain/rewards";
import {
  type TaskItem,
  type TaskItemStatus,
  generateTaskPlanWithApiFallback,
} from "../domain/taskExtraction";
import {
  type Thought,
  type ThoughtCategory,
  type ThoughtStatus,
} from "../domain/thoughts";
import {
  type AppSettings,
  type StorageRepository,
  createDefaultSettings,
  createBrowserStorageRepository,
  initializeStorage,
} from "../lib/storage/repository";

function App() {
  const [appSurface, setAppSurface] = useState<AppSurface>("main");
  const [activeTab, setActiveTab] = useState<CompanionTab>("companion");
  const [catcherMode, setCatcherMode] = useState<CatcherMode>("closed");
  const [thoughtText, setThoughtText] = useState("");
  const [thoughts, setThoughts] = useState<Thought[]>([]);
  const [focusDebriefs, setFocusDebriefs] = useState<FocusDebrief[]>([]);
  const [debriefStatus, setDebriefStatus] = useState<"idle" | "loading" | "ready" | "unavailable">("idle");
  const [taskItems, setTaskItems] = useState<TaskItem[]>([]);
  const [taskPlanStatus, setTaskPlanStatus] = useState<"idle" | "loading" | "ready" | "empty">("idle");
  const [session, setSession] = useState<FocusSession | null>(null);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [durationMode, setDurationMode] = useState<DurationMode>("60");
  const [customDuration, setCustomDuration] = useState(DEFAULT_FOCUS_MINUTES);
  const [completedMinutes, setCompletedMinutes] = useState(0);
  const [rewardCredits, setRewardCredits] = useState<RewardCredit[]>([]);
  const [revealedReward, setRevealedReward] = useState<RevealedReward | null>(null);
  const [settings, setSettings] = useState<AppSettings>(() => createDefaultSettings());
  const [characterInactive, setCharacterInactive] = useState(false);
  const [characterAutoPaused, setCharacterAutoPaused] = useState(false);
  const [characterRewardReady, setCharacterRewardReady] = useState(false);
  const shortcutStatus: ShortcutStatus = isTauriRuntime() ? "ready" : "browser-preview";
  const storageRef = useRef<StorageRepository>(createBrowserStorageRepository());
  const revealInFlightRef = useRef(false);

  const activeFocus = session?.status === "running";
  const pausedFocus = session?.status === "paused";
  const focusInProgress = activeFocus || pausedFocus;
  const availableBoxes = rewardCredits.filter((credit) => credit.status === "available").length;
  const usableThoughtCount = thoughts.filter(isUsableRewardThought).length;
  const canOpenHistory = session?.status !== "running";
  const plannedMinutes = getSelectedDurationMinutes(durationMode, customDuration);
  const focusCompanionMode = settings.focusCompanionMode;
  const characterAttentionMode = characterInactive || characterAutoPaused;
  const activeDebrief =
    session?.status === "completed"
      ? focusDebriefs.find((debrief) => debrief.sessionId === session.id) ?? null
      : null;
  const activeTaskItems =
    session?.status === "completed"
      ? taskItems.filter((taskItem) => taskItem.sessionId === session.id)
      : [];
  const openTaskItems = getOpenTaskItems(taskItems);
  const nextOpenTaskItem = openTaskItems[0] ?? null;
  const remainingSeconds = focusInProgress && session
    ? getRemainingSeconds(session, new Date(nowMs))
    : plannedMinutes * 60;

  useEffect(() => {
    let disposed = false;

    void initializeStorage()
      .then(async (repository) => {
        storageRef.current = repository;
        const [
          storedThoughts,
          storedSessions,
          storedRewards,
          storedRewardCredits,
          storedDebriefs,
          storedTaskItems,
          storedSettings,
        ] =
          await Promise.all([
            repository.listThoughts(),
            repository.listFocusSessions(),
            repository.listRewards(),
            repository.listRewardCredits(),
            repository.listFocusDebriefs(),
            repository.listTaskItems(),
            repository.getSettings(),
          ]);

        if (disposed) {
          return;
        }

        const nextRewardCredits =
          storedRewardCredits.length > 0
            ? storedRewardCredits
            : createBackfilledRewardCredits(storedSessions, storedRewards);
        if (storedRewardCredits.length === 0 && nextRewardCredits.length > 0) {
          void Promise.all(
            nextRewardCredits.map((credit) => repository.createRewardCredit(credit)),
          ).catch(() => undefined);
        }

        const revealedRewards = storedRewards.filter((reward) => reward.status === "revealed");
        const latestRevealedReward = revealedRewards[0];
        const latestRewardThought = latestRevealedReward
          ? storedThoughts.find((thought) => thought.id === latestRevealedReward.thoughtId)
          : undefined;
        const activeSession = storedSessions.find(
          (storedSession) =>
            storedSession.status === "running" || storedSession.status === "paused",
        );

        setThoughts((current) => mergeThoughts(storedThoughts, current));
        setSession(activeSession ?? null);
        setFocusDebriefs(storedDebriefs);
        setTaskItems(storedTaskItems);
        setCompletedMinutes(sumCompletedMinutes(storedSessions));
        setRewardCredits(nextRewardCredits);
        setSettings(storedSettings);
        setDurationMode(getDurationModeForMinutes(storedSettings.defaultFocusMinutes));
        setCustomDuration(storedSettings.defaultFocusMinutes);
        setRevealedReward(
          latestRevealedReward && latestRewardThought
            ? { reward: latestRevealedReward, thought: latestRewardThought }
            : null,
        );
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
    };
  }, []);

  useEffect(() => {
    if (!activeFocus) {
      return;
    }

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [activeFocus]);

  useEffect(() => {
    if (!session || !isSessionComplete(session, new Date(nowMs))) {
      return;
    }

    completeFocus(new Date(nowMs));
  }, [nowMs, session]);

  useEffect(() => {
    if (revealedReward || revealInFlightRef.current) {
      return;
    }

    const availableCredit = rewardCredits.find(
      (credit) => credit.status === "available" && credit.sourceSessionId,
    );
    const selectedThought = selectRewardThought(thoughts);

    if (!availableCredit || !selectedThought) {
      return;
    }

    const sourceSessionId = availableCredit.sourceSessionId;
    if (!sourceSessionId) {
      return;
    }

    revealInFlightRef.current = true;

    const now = new Date();
    const timestamp = now.toISOString();
    const spentCredit: RewardCredit = {
      ...availableCredit,
      status: "spent",
      spentAt: timestamp,
      updatedAt: timestamp,
    };
    const reward: Reward = {
      id: crypto.randomUUID(),
      creditId: availableCredit.id,
      thoughtId: selectedThought.id,
      sessionId: sourceSessionId,
      revealedAt: timestamp,
      updatedAt: timestamp,
      status: "revealed",
    };
    const rewardedThought: Thought = {
      ...selectedThought,
      status: "rewarded",
      updatedAt: timestamp,
    };

    setRewardCredits((current) =>
      current.map((credit) => (credit.id === spentCredit.id ? spentCredit : credit)),
    );
    setThoughts((current) =>
      current.map((thought) => (thought.id === rewardedThought.id ? rewardedThought : thought)),
    );
    setRevealedReward({ reward, thought: rewardedThought });

    void Promise.all([
      storageRef.current.updateRewardCreditStatus(spentCredit.id, "spent", now),
      storageRef.current.createReward(reward),
      storageRef.current.updateThoughtStatus(rewardedThought.id, "rewarded", now),
    ])
      .catch(() => undefined)
      .finally(() => {
        revealInFlightRef.current = false;
      });
  }, [revealedReward, rewardCredits, thoughts]);

  useEffect(() => {
    configureDesktopWindow();
    let unlisten: (() => void) | undefined;
    let disposed = false;

    void listenToDesktopEvents({
      openMainPage,
      openThoughtCatcher: openStandaloneThoughtCatcherFromEvent,
    }).then((cleanup) => {
      if (disposed) {
        cleanup();
        return;
      }

      unlisten = cleanup;
    });

    return () => {
      disposed = true;
      unlisten?.();
      resetDesktopWindowTransitionState();
    };
  }, []);

  useEffect(() => {
    if (focusInProgress || characterRewardReady || appSurface !== "widget") {
      return;
    }

    setAppSurface("main");
  }, [appSurface, characterRewardReady, focusInProgress]);

  useEffect(() => {
    if (catcherMode !== "closed") {
      return;
    }

    void configureDesktopSurface(appSurface, focusCompanionMode, characterAttentionMode);
  }, [appSurface, catcherMode, characterAttentionMode]);

  useEffect(() => {
    if (!characterRewardReady) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      setCharacterRewardReady(false);
      setAppSurface("post-focus");
    }, CHARACTER_REWARD_READY_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [characterRewardReady]);

  useEffect(() => {
    if (
      appSurface !== "widget" ||
      catcherMode !== "closed" ||
      !activeFocus ||
      focusCompanionMode !== "character"
    ) {
      setCharacterInactive(false);
      return;
    }

    let timeoutId: number | undefined;
    let intervalId: number | undefined;
    let disposed = false;
    let usingLocalFallback = !isTauriRuntime();

    function resetMouseInactivity() {
      setCharacterInactive((current) => (current ? false : current));
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      timeoutId = window.setTimeout(() => {
        setCharacterInactive(true);
      }, CHARACTER_MOUSE_INACTIVE_MS);
    }

    function startLocalFallback() {
      if (!usingLocalFallback) {
        usingLocalFallback = true;
      }

      resetMouseInactivity();
      window.addEventListener("mousemove", resetMouseInactivity);
      window.addEventListener("mousedown", resetMouseInactivity);
      window.addEventListener("wheel", resetMouseInactivity);
    }

    async function pollGlobalIdle() {
      try {
        const idleMs = await getGlobalIdleMs();
        if (disposed) {
          return;
        }
        setCharacterInactive(idleMs >= CHARACTER_MOUSE_INACTIVE_MS);
      } catch {
        if (!usingLocalFallback) {
          startLocalFallback();
        }
      }
    }

    if (isTauriRuntime()) {
      void pollGlobalIdle();
      intervalId = window.setInterval(() => {
        void pollGlobalIdle();
      }, 1000);
    } else {
      startLocalFallback();
    }

    return () => {
      disposed = true;
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }
      if (intervalId) {
        window.clearInterval(intervalId);
      }
      if (usingLocalFallback) {
        window.removeEventListener("mousemove", resetMouseInactivity);
        window.removeEventListener("mousedown", resetMouseInactivity);
        window.removeEventListener("wheel", resetMouseInactivity);
      }
    };
  }, [activeFocus, appSurface, catcherMode, focusCompanionMode]);

  useEffect(() => {
    if (!activeFocus || !characterInactive) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      pauseFocus({ autoPaused: true });
    }, CHARACTER_INACTIVE_AUTO_PAUSE_MS);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [activeFocus, characterInactive]);

  useEffect(() => {
    function handleKeyDown(event: KeyboardEvent) {
      if (!isThoughtShortcutEvent(event, SHORTCUT)) {
        return;
      }

      event.preventDefault();
      openModalThoughtCatcher();
    }

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  async function captureThought(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (!thoughtText.trim()) {
      return;
    }

    const capturedText = thoughtText.trim();
    const routed = await classifyThoughtWithApiFallback(capturedText, {
      apiKey: settings.apiKey,
      localOnly: settings.localOnly,
    });
    const now = new Date().toISOString();
    const thought: Thought = {
      id: crypto.randomUUID(),
      rawText: capturedText,
      title: routed.title,
      category: routed.category,
      rewardEligible: routed.rewardEligible,
      confidence: routed.confidence,
      status: "captured",
      createdAt: now,
      updatedAt: now,
    };

    setThoughts((current) => [thought, ...current]);
    void storageRef.current.createThought(thought).catch(() => undefined);
    setThoughtText("");

    if (isStandaloneCatcher(catcherMode)) {
      dismissStandaloneThoughtCatcher();
      return;
    }

    setCatcherMode("closed");
  }

  function closeThoughtCatcher() {
    if (isStandaloneCatcher(catcherMode)) {
      dismissStandaloneThoughtCatcher();
      return;
    }

    setCatcherMode("closed");
    setThoughtText("");
  }

  function dismissStandaloneThoughtCatcher() {
    const shouldHideMainSurface = catcherMode === "standalone-hide" && isTauriRuntime();

    void (shouldHideMainSurface ? hideDesktopWindow() : Promise.resolve()).finally(() => {
      setCatcherMode(shouldHideMainSurface ? "hidden" : "closed");
      setThoughtText("");
    });
  }

  function openModalThoughtCatcher() {
    void configureDesktopCaptureSurface({ rememberReturnSize: appSurface === "main" });
    setCatcherMode("modal");
  }

  function openStandaloneThoughtCatcher(mode: ThoughtCatcherOpenMode) {
    void configureDesktopCaptureSurface();
    setCatcherMode(mode === "restore" ? "standalone-restore" : "standalone-hide");
  }

  function openStandaloneThoughtCatcherFromEvent(event: TauriEvent<OpenThoughtCatcherPayload>) {
    if (event.payload.restoreMainPage) {
      openModalThoughtCatcher();
      return;
    }

    openStandaloneThoughtCatcher(event.payload.restoreMainPage ? "restore" : "hide");
  }

  function openMainPage() {
    setAppSurface("main");
    setCharacterAutoPaused(false);
    setCharacterRewardReady(false);
    setDebriefStatus("idle");
    setTaskPlanStatus("idle");
    setCatcherMode("closed");
    setThoughtText("");
  }

  function startFocus() {
    const now = new Date();
    const nextSession = createFocusSession(now, plannedMinutes);
    setSession(nextSession);
    setCharacterAutoPaused(false);
    setCharacterInactive(false);
    setCharacterRewardReady(false);
    setNowMs(now.getTime());
    setActiveTab("companion");
    setAppSurface("widget");
    void storageRef.current.createFocusSession(nextSession).catch(() => undefined);
  }

  function completeFocus(endedAt = new Date()) {
    if (!session) {
      return;
    }

    const completed = completeFocusSession(session, endedAt);
    const unlocks = getRewardUnlocks(completedMinutes, completed.plannedMinutes);
    const earnedCredits = createEarnedRewardCredits(completed, unlocks, endedAt);
    const shouldCelebrateCharacter =
      appSurface === "widget" && focusCompanionMode === "character";
    setSession(completed);
    setCharacterAutoPaused(false);
    setCharacterInactive(false);
    setCharacterRewardReady(shouldCelebrateCharacter);
    setDebriefStatus("loading");
    setTaskPlanStatus("loading");
    setAppSurface(shouldCelebrateCharacter ? "widget" : "post-focus");
    setNowMs(endedAt.getTime());
    setCompletedMinutes((current) => current + completed.plannedMinutes);
    setRewardCredits((current) => [...current, ...earnedCredits]);
    void storageRef.current.updateFocusSession(completed).catch(() => undefined);
    void Promise.all(
      earnedCredits.map((credit) => storageRef.current.createRewardCredit(credit)),
    ).catch(() => undefined);
    void generateDebrief(completed, thoughts);
    void generateTaskPlan(completed, thoughts);
  }

  async function generateDebrief(completed: FocusSession, currentThoughts: Thought[]) {
    const draft = await generateFocusDebriefWithApiFallback({
      apiKey: settings.apiKey,
      localOnly: settings.localOnly,
      session: completed,
      thoughts: currentThoughts,
    });

    if (!draft) {
      setDebriefStatus("unavailable");
      return;
    }

    const now = new Date();
    const timestamp = now.toISOString();
    const debrief: FocusDebrief = {
      id: crypto.randomUUID(),
      sessionId: completed.id,
      ...draft,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    setFocusDebriefs((current) => [
      debrief,
      ...current.filter((existing) => existing.sessionId !== completed.id),
    ]);
    setDebriefStatus("ready");
    void storageRef.current.createFocusDebrief(debrief).catch(() => undefined);
  }

  async function generateTaskPlan(completed: FocusSession, currentThoughts: Thought[]) {
    const drafts = await generateTaskPlanWithApiFallback({
      apiKey: settings.apiKey,
      localOnly: settings.localOnly,
      session: completed,
      thoughts: currentThoughts,
    });

    if (drafts.length === 0) {
      setTaskPlanStatus("empty");
      return;
    }

    const now = new Date();
    const timestamp = now.toISOString();
    const nextTaskItems: TaskItem[] = drafts.map((draft) => ({
      id: crypto.randomUUID(),
      sessionId: completed.id,
      sourceThoughtId: draft.sourceThoughtId,
      title: draft.title,
      nextAction: draft.nextAction,
      status: "open",
      createdAt: timestamp,
      updatedAt: timestamp,
    }));

    setTaskItems((current) => [
      ...nextTaskItems,
      ...current.filter((taskItem) => taskItem.sessionId !== completed.id),
    ]);
    setTaskPlanStatus("ready");
    void Promise.all(
      nextTaskItems.map((taskItem) => storageRef.current.createTaskItem(taskItem)),
    ).catch(() => undefined);
  }

  function cancelFocus() {
    if (!session) {
      return;
    }

    const now = new Date();
    const cancelled = cancelFocusSession(session, now);

    setSession(cancelled);
    setCharacterAutoPaused(false);
    setCharacterInactive(false);
    setNowMs(now.getTime());
    void storageRef.current.updateFocusSession(cancelled).catch(() => undefined);
  }

  function pauseFocus({ autoPaused = false }: { autoPaused?: boolean } = {}) {
    if (!session) {
      return;
    }

    const now = new Date();
    const paused = pauseFocusSession(session, now);
    setSession(paused);
    setCharacterAutoPaused(autoPaused);
    setNowMs(now.getTime());
    void storageRef.current.updateFocusSession(paused).catch(() => undefined);
  }

  function resumeFocus() {
    if (!session) {
      return;
    }

    const now = new Date();
    const resumed = resumeFocusSession(session, now);
    setSession(resumed);
    setCharacterAutoPaused(false);
    setCharacterInactive(false);
    setNowMs(now.getTime());
    setActiveTab("companion");
    setAppSurface("widget");
    void storageRef.current.updateFocusSession(resumed).catch(() => undefined);
  }

  function resolveReward(status: RewardStatus) {
    if (!revealedReward) {
      return;
    }

    const updatedAt = new Date();
    const thoughtStatus = rewardStatusToThoughtStatus(status);
    const updatedThought: Thought = {
      ...revealedReward.thought,
      status: thoughtStatus,
      updatedAt: updatedAt.toISOString(),
    };

    setThoughts((current) =>
      current.map((thought) =>
        thought.id === updatedThought.id ? updatedThought : thought,
      ),
    );
    setRevealedReward(null);
    void Promise.all([
      storageRef.current.updateRewardStatus(revealedReward.reward.id, status, updatedAt),
      storageRef.current.updateThoughtStatus(updatedThought.id, thoughtStatus, updatedAt),
    ]).catch(() => undefined);
  }

  function updateThoughtCategory(id: string, category: ThoughtCategory) {
    updateThoughtDetails(id, { category });
  }

  function updateThoughtRewardEligibility(id: string, rewardEligible: boolean) {
    updateThoughtDetails(id, { rewardEligible });
  }

  function deleteThought(id: string) {
    const updatedAt = new Date();

    setThoughts((current) => current.filter((thought) => thought.id !== id));
    void storageRef.current.updateThoughtStatus(id, "deleted", updatedAt).catch(() => undefined);
  }

  function updateThoughtStatus(id: string, status: ThoughtStatus) {
    const updatedAt = new Date();
    const timestamp = updatedAt.toISOString();

    setThoughts((current) =>
      current.map((thought) =>
        thought.id === id ? { ...thought, status, updatedAt: timestamp } : thought,
      ),
    );
    void storageRef.current.updateThoughtStatus(id, status, updatedAt).catch(() => undefined);
  }

  function updateTaskItemStatus(id: string, status: TaskItemStatus) {
    const updatedAt = new Date();
    const timestamp = updatedAt.toISOString();

    setTaskItems((current) =>
      current.map((taskItem) =>
        taskItem.id === id ? { ...taskItem, status, updatedAt: timestamp } : taskItem,
      ),
    );
    void storageRef.current.updateTaskItemStatus(id, status, updatedAt).catch(() => undefined);
  }

  function updateThoughtDetails(
    id: string,
    updates: { category?: ThoughtCategory; rewardEligible?: boolean },
  ) {
    const updatedAt = new Date();
    const timestamp = updatedAt.toISOString();

    setThoughts((current) =>
      current.map((thought) =>
        thought.id === id
          ? {
              ...thought,
              category: updates.category ?? thought.category,
              rewardEligible: updates.rewardEligible ?? thought.rewardEligible,
              updatedAt: timestamp,
            }
          : thought,
      ),
    );
    void storageRef.current.updateThoughtDetails(id, updates, updatedAt).catch(() => undefined);
  }

  function saveSettings(nextSettings: AppSettings) {
    const focusCompanionMode = nextSettings.focusCompanionMode;
    const normalizedSettings: AppSettings = {
      ...nextSettings,
      defaultFocusMinutes: Math.min(
        240,
        Math.max(1, Math.round(nextSettings.defaultFocusMinutes)),
      ),
      focusCompanionMode,
      characterEnabled: focusCompanionMode === "character",
      shortcut: SHORTCUT,
      updatedAt: new Date().toISOString(),
    };

    setSettings(normalizedSettings);
    if (!focusInProgress) {
      setDurationMode(getDurationModeForMinutes(normalizedSettings.defaultFocusMinutes));
      setCustomDuration(normalizedSettings.defaultFocusMinutes);
    }
    void storageRef.current.updateSettings(normalizedSettings).catch(() => undefined);
  }

  function collapseToWidget() {
    if (!focusInProgress) {
      return;
    }

    setActiveTab("companion");
    setAppSurface("widget");
  }

  function restoreMainPageFromWidget() {
    setAppSurface("main");
    setCharacterAutoPaused(false);
    setCharacterRewardReady(false);
    setCatcherMode("closed");
    setThoughtText("");
  }

  function toggleCharacterFocus() {
    if (activeFocus) {
      pauseFocus();
      return;
    }

    if (pausedFocus) {
      resumeFocus();
    }
  }

  if (isStandaloneCatcher(catcherMode)) {
    return (
      <main className="grid h-screen place-items-center overflow-hidden bg-[#f4f1ea] p-3 text-stone-950">
        <ThoughtCatcher
          onClose={closeThoughtCatcher}
          onSubmit={captureThought}
          presentation="standalone"
          setThoughtText={setThoughtText}
          thoughtText={thoughtText}
        />
      </main>
    );
  }

  if (catcherMode === "hidden") {
    return <main aria-label="FocusPal hidden" className="h-screen overflow-hidden bg-[#f4f1ea]" />;
  }

  if (appSurface === "post-focus") {
    return (
      <PostFocusReview
        debrief={activeDebrief}
        debriefStatus={activeDebrief ? "ready" : debriefStatus}
        onContinue={openMainPage}
        onResolveReward={resolveReward}
        onUpdateTaskItemStatus={updateTaskItemStatus}
        revealedReward={revealedReward}
        session={session}
        taskItems={activeTaskItems}
        taskPlanStatus={activeTaskItems.length > 0 ? "ready" : taskPlanStatus}
      />
    );
  }

  if (appSurface === "widget" && (focusInProgress || characterRewardReady)) {
    return (
      <main
        className={[
          "widget-root h-screen overflow-hidden bg-transparent text-stone-950",
          focusCompanionMode === "character" ? "character-widget-root" : "p-1",
        ].join(" ")}
      >
        {focusCompanionMode === "character" ? (
          <CharacterCompanion
            activeFocus={activeFocus}
            characterAutoPaused={characterAutoPaused}
            characterInactive={characterInactive}
            rewardReady={characterRewardReady}
            onRestoreMainPage={restoreMainPageFromWidget}
            onStartWidgetDrag={startWidgetDrag}
            onToggleFocus={toggleCharacterFocus}
            pausedFocus={pausedFocus}
            plannedMinutes={session?.plannedMinutes ?? plannedMinutes}
            remainingSeconds={characterRewardReady ? 0 : remainingSeconds}
          />
        ) : (
          <FocusWidget
            activeFocus={activeFocus}
            availableBoxes={availableBoxes}
            onCancelFocus={cancelFocus}
            onOpenCatcher={openModalThoughtCatcher}
            onPauseFocus={pauseFocus}
            onRestoreMainPage={restoreMainPageFromWidget}
            onResumeFocus={resumeFocus}
            onStartWidgetDrag={startWidgetDrag}
            pausedFocus={pausedFocus}
            plannedMinutes={session?.plannedMinutes ?? plannedMinutes}
            remainingSeconds={remainingSeconds}
            usableThoughtCount={usableThoughtCount}
          />
        )}
        {catcherMode === "modal" ? (
          <ThoughtCatcher
            onClose={closeThoughtCatcher}
            onSubmit={captureThought}
            presentation="modal"
            setThoughtText={setThoughtText}
            thoughtText={thoughtText}
          />
        ) : null}
      </main>
    );
  }

  return (
    <main className="app-root h-screen overflow-hidden bg-[#f4f1ea] p-3 text-stone-950">
      <section className="app-shell mx-auto grid h-full max-w-[430px] grid-rows-[auto_minmax(0,1fr)_auto] gap-3">
        <header
          className="app-header flex items-center justify-between rounded-lg border border-stone-200 bg-white px-3 py-2 shadow-sm"
          onPointerDown={startWidgetDrag}
        >
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-lg bg-emerald-100 text-emerald-800">
              <Focus size={19} />
            </div>
            <div>
              <h1 className="text-lg font-semibold tracking-normal">FocusPal</h1>
              <p className="text-xs text-stone-500">{formatShortcutLabel(SHORTCUT)} to capture thoughts</p>
            </div>
          </div>
          <StatusPill activeFocus={activeFocus} status={session?.status ?? "idle"} />
        </header>

        <section className={["min-h-0", activeTab === "history" ? "overflow-visible" : "overflow-hidden"].join(" ")}>
          {activeTab === "companion" ? (
            <CompanionPanel
              activeFocus={activeFocus}
              customDuration={customDuration}
              durationMode={durationMode}
              focusInProgress={focusInProgress}
              completedMinutes={completedMinutes}
              nextOpenTaskItem={nextOpenTaskItem}
              onCancelFocus={cancelFocus}
              onCollapseToWidget={collapseToWidget}
              onOpenCatcher={openModalThoughtCatcher}
              onPauseFocus={pauseFocus}
              onResumeFocus={resumeFocus}
              onSetCustomDuration={setCustomDuration}
              onSetDurationMode={setDurationMode}
              onStartFocus={startFocus}
              onResolveReward={resolveReward}
              pausedFocus={pausedFocus}
              remainingSeconds={remainingSeconds}
              revealedReward={revealedReward}
              session={session}
              unlockedRewards={availableBoxes}
              openActionCount={openTaskItems.length}
            />
          ) : null}
          {activeTab === "history" ? (
            <HistoryPanel
              canOpenHistory={canOpenHistory}
              onDeleteThought={deleteThought}
              onUpdateTaskItemStatus={updateTaskItemStatus}
              onUpdateCategory={updateThoughtCategory}
              onUpdateRewardEligibility={updateThoughtRewardEligibility}
              onUpdateStatus={updateThoughtStatus}
              taskItems={taskItems}
              thoughts={thoughts}
            />
          ) : null}
          {activeTab === "settings" ? (
            <SettingsPanel
              onSaveSettings={saveSettings}
              settings={settings}
              shortcutStatus={shortcutStatus}
            />
          ) : null}
        </section>

        <nav className="app-nav grid grid-cols-3 gap-2" aria-label="FocusPal sections">
          <TabButton
            active={activeTab === "companion"}
            icon={<Focus size={16} />}
            label="Companion"
            onClick={() => setActiveTab("companion")}
          />
          <TabButton
            active={activeTab === "history"}
            icon={<History size={16} />}
            label="History"
            onClick={() => setActiveTab("history")}
          />
          <TabButton
            active={activeTab === "settings"}
            icon={<Settings size={16} />}
            label="Settings"
            onClick={() => setActiveTab("settings")}
          />
        </nav>
      </section>

      {catcherMode === "modal" ? (
        <ThoughtCatcher
          onClose={closeThoughtCatcher}
          onSubmit={captureThought}
          presentation="modal"
          setThoughtText={setThoughtText}
          thoughtText={thoughtText}
        />
      ) : null}
    </main>
  );
}

function configureDesktopWindow() {
  if (!isTauriRuntime()) {
    return;
  }

  void import("@tauri-apps/api/window")
    .then(({ getCurrentWindow }) => getCurrentWindow().setAlwaysOnTop(true))
    .catch(() => undefined);
}

let characterPreInactivePosition: unknown = null;
let mainWindowPreTransientSize: WindowSize | null = null;

type CurrentWindow = ReturnType<typeof import("@tauri-apps/api/window")["getCurrentWindow"]>;
type WindowSize = Parameters<CurrentWindow["setSize"]>[0];

type DesktopWindowForSizing = Pick<CurrentWindow, "outerSize" | "scaleFactor" | "setSize">;

type LogicalSizeConstructor = new (width: number, height: number) => WindowSize;

async function rememberMainWindowSize(
  window: DesktopWindowForSizing,
  LogicalSize: LogicalSizeConstructor,
) {
  if (mainWindowPreTransientSize !== null) {
    return;
  }

  const physicalSize = await window.outerSize();
  const scaleFactor = await window.scaleFactor();
  if (!Number.isFinite(scaleFactor) || scaleFactor <= 0) {
    return;
  }

  mainWindowPreTransientSize = new LogicalSize(
    physicalSize.width / scaleFactor,
    physicalSize.height / scaleFactor,
  );
}

async function restoreMainWindowSize(window: DesktopWindowForSizing) {
  if (mainWindowPreTransientSize === null) {
    return;
  }

  const size = mainWindowPreTransientSize;
  mainWindowPreTransientSize = null;
  await window.setSize(size);
}

function resetDesktopWindowTransitionState() {
  characterPreInactivePosition = null;
  mainWindowPreTransientSize = null;
}

async function configureDesktopSurface(
  surface: AppSurface,
  focusCompanionMode: AppSettings["focusCompanionMode"],
  characterAttentionMode: boolean,
) {
  if (!isTauriRuntime()) {
    return;
  }

  try {
    const { LogicalSize, getCurrentWindow } = await import("@tauri-apps/api/window");
    const window = getCurrentWindow();
    const focusSurfaceSize =
      focusCompanionMode === "character"
        ? characterAttentionMode
          ? new LogicalSize(CHARACTER_INACTIVE_WINDOW_WIDTH, CHARACTER_INACTIVE_WINDOW_HEIGHT)
          : new LogicalSize(CHARACTER_WINDOW_WIDTH, CHARACTER_WINDOW_HEIGHT)
        : new LogicalSize(WIDGET_WINDOW_WIDTH, WIDGET_WINDOW_HEIGHT);
    const minimum = surface === "widget"
      ? focusSurfaceSize
      : new LogicalSize(MAIN_WINDOW_MIN_WIDTH, MAIN_WINDOW_MIN_HEIGHT);
    const isCompanionSurface = surface === "widget";
    const isCharacterCompanionSurface = isCompanionSurface && focusCompanionMode === "character";

    if (isCompanionSurface) {
      await rememberMainWindowSize(window, LogicalSize);
    }

    if (
      isCharacterCompanionSurface &&
      characterAttentionMode &&
      characterPreInactivePosition === null
    ) {
      characterPreInactivePosition = await window.outerPosition();
    }

    await window.setAlwaysOnTop(true);
    await window.setDecorations(!isCompanionSurface);
    await window.setShadow(!isCompanionSurface);
    await window.setMinSize(minimum);
    if (isCompanionSurface) {
      await window.setSize(focusSurfaceSize);
    } else {
      await restoreMainWindowSize(window);
    }
    if (isCharacterCompanionSurface && characterAttentionMode) {
      await window.center();
    } else if (isCharacterCompanionSurface && characterPreInactivePosition !== null) {
      await window.setPosition(
        characterPreInactivePosition as Parameters<typeof window.setPosition>[0],
      );
      characterPreInactivePosition = null;
    } else if (!isCharacterCompanionSurface) {
      characterPreInactivePosition = null;
    }
    await window.setBackgroundColor([0, 0, 0, 0]);
    await window.setFocus();
  } catch {
    // Window sizing is available only in the desktop shell.
  }
}

async function getGlobalIdleMs(): Promise<number> {
  if (!isTauriRuntime()) {
    throw new Error("Global idle is only available in the desktop shell.");
  }

  const { invoke } = await import("@tauri-apps/api/core");
  return invoke<number>("get_global_idle_ms");
}

async function configureDesktopCaptureSurface({
  rememberReturnSize = false,
}: { rememberReturnSize?: boolean } = {}) {
  if (!isTauriRuntime()) {
    return;
  }

  try {
    const { LogicalSize, getCurrentWindow } = await import("@tauri-apps/api/window");
    const window = getCurrentWindow();
    const size = new LogicalSize(MAIN_WINDOW_WIDTH, MAIN_WINDOW_MIN_HEIGHT);

    if (rememberReturnSize) {
      await rememberMainWindowSize(window, LogicalSize);
    }

    await window.setAlwaysOnTop(true);
    await window.setDecorations(true);
    await window.setShadow(true);
    await window.setMinSize(size);
    await window.setSize(size);
    await window.setBackgroundColor([0, 0, 0, 0]);
    await window.show();
    await window.unminimize();
    await window.setFocus();
  } catch {
    // Window sizing is available only in the desktop shell.
  }
}

async function hideDesktopWindow() {
  if (!isTauriRuntime()) {
    return;
  }

  try {
    const { getCurrentWindow } = await import("@tauri-apps/api/window");
    await getCurrentWindow().hide();
  } catch {
    // The browser preview cannot hide its tab; desktop builds use the Tauri window API.
  }
}

function startWidgetDrag() {
  if (!isTauriRuntime()) {
    return;
  }

  void import("@tauri-apps/api/window")
    .then(({ getCurrentWindow }) => getCurrentWindow().startDragging())
    .catch(() => undefined);
}

function isStandaloneCatcher(mode: CatcherMode) {
  return mode === "standalone-hide" || mode === "standalone-restore";
}

async function listenToDesktopEvents({
  openMainPage,
  openThoughtCatcher,
}: {
  openMainPage: () => void;
  openThoughtCatcher: (event: TauriEvent<OpenThoughtCatcherPayload>) => void;
}): Promise<() => void> {
  if (!isTauriRuntime()) {
    return () => undefined;
  }

  try {
    const { listen } = await import("@tauri-apps/api/event");
    const unlistenThoughtCatcher = await listen(OPEN_THOUGHT_CATCHER_EVENT, openThoughtCatcher);
    const unlistenMainPage = await listen(OPEN_MAIN_PAGE_EVENT, openMainPage);
    return () => {
      unlistenThoughtCatcher();
      unlistenMainPage();
    };
  } catch {
    return () => undefined;
  }
}

function isTauriRuntime() {
  return "__TAURI_INTERNALS__" in window;
}

function isThoughtShortcutEvent(event: KeyboardEvent, shortcut: string) {
  const normalizedShortcut = normalizeShortcutOption(shortcut);
  const parts = normalizedShortcut.toLowerCase().split("+");
  const requiresPrimary = parts.includes("cmdorctrl");
  const requiresAlt = parts.includes("alt");
  const requiresShift = parts.includes("shift");
  const usesPrimaryModifier = event.metaKey || event.ctrlKey;

  if (requiresPrimary !== usesPrimaryModifier) {
    return false;
  }

  if (requiresAlt !== event.altKey || requiresShift !== event.shiftKey) {
    return false;
  }

  if (parts.includes("space")) {
    return event.code === "Space" || event.key === " " || event.key === "Spacebar";
  }

  if (parts.includes("c")) {
    return event.code === "KeyC" || event.key.toLowerCase() === "c";
  }

  return false;
}

function createEarnedRewardCredits(
  session: FocusSession,
  count: number,
  earnedAt: Date,
): RewardCredit[] {
  if (count <= 0) {
    return [];
  }

  const timestamp = earnedAt.toISOString();

  return Array.from({ length: count }, (_, index) => {
    const earnedTimestamp =
      index === 0 ? timestamp : new Date(earnedAt.getTime() + index).toISOString();

    return {
      id: crypto.randomUUID(),
      sourceSessionId: session.id,
      earnedAt: earnedTimestamp,
      updatedAt: earnedTimestamp,
      status: "available",
    };
  });
}

function createBackfilledRewardCredits(
  sessions: FocusSession[],
  rewards: Reward[],
): RewardCredit[] {
  const completedSessions = sessions
    .filter((storedSession) => storedSession.status === "completed")
    .sort(
      (left, right) =>
        new Date(left.startedAt).getTime() - new Date(right.startedAt).getTime(),
    );
  let cumulativeMinutes = 0;
  const credits: RewardCredit[] = [];

  for (const storedSession of completedSessions) {
    const unlocks = getRewardUnlocks(cumulativeMinutes, storedSession.plannedMinutes);
    cumulativeMinutes += storedSession.plannedMinutes;

    if (unlocks <= 0) {
      continue;
    }

    const earnedAt = storedSession.endedAt ?? storedSession.updatedAt;
    for (let index = 0; index < unlocks; index += 1) {
      credits.push({
        id: crypto.randomUUID(),
        sourceSessionId: storedSession.id,
        earnedAt,
        updatedAt: earnedAt,
        status: "available",
      });
    }
  }

  const spentCount = Math.min(credits.length, rewards.length);
  return credits.map((credit, index) =>
    index < spentCount
      ? {
          ...credit,
          status: "spent",
          spentAt: rewards[index]?.revealedAt ?? credit.earnedAt,
          updatedAt: rewards[index]?.updatedAt ?? credit.updatedAt,
        }
      : credit,
  );
}

function mergeThoughts(storedThoughts: Thought[], currentThoughts: Thought[]) {
  const byId = new Map<string, Thought>();

  for (const thought of [...storedThoughts, ...currentThoughts]) {
    byId.set(thought.id, thought);
  }

  return [...byId.values()].sort(
    (left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime(),
  );
}

export default App;
