export const DEFAULT_FOCUS_MINUTES = 60;
export const MINUTES_PER_REWARD = 1;

export type FocusSessionStatus = "idle" | "running" | "paused" | "completed" | "cancelled";

export type FocusSession = {
  id: string;
  plannedMinutes: number;
  startedAt: string;
  endedAt?: string;
  pausedAt?: string;
  pausedSeconds: number;
  updatedAt: string;
  status: Exclude<FocusSessionStatus, "idle">;
};

export function createFocusSession(now: Date, plannedMinutes = DEFAULT_FOCUS_MINUTES): FocusSession {
  const timestamp = now.toISOString();

  return {
    id: crypto.randomUUID(),
    plannedMinutes,
    startedAt: timestamp,
    pausedSeconds: 0,
    updatedAt: timestamp,
    status: "running",
  };
}

export function completeFocusSession(session: FocusSession, endedAt: Date): FocusSession {
  const timestamp = endedAt.toISOString();

  return {
    ...session,
    endedAt: timestamp,
    pausedAt: undefined,
    updatedAt: timestamp,
    status: "completed",
  };
}

export function pauseFocusSession(session: FocusSession, pausedAt: Date): FocusSession {
  if (session.status !== "running") {
    return session;
  }

  const timestamp = pausedAt.toISOString();

  return {
    ...session,
    pausedAt: timestamp,
    updatedAt: timestamp,
    status: "paused",
  };
}

export function resumeFocusSession(session: FocusSession, resumedAt: Date): FocusSession {
  if (session.status !== "paused" || !session.pausedAt) {
    return session;
  }

  const pausedSeconds = Math.max(
    0,
    Math.floor((resumedAt.getTime() - new Date(session.pausedAt).getTime()) / 1000),
  );
  const timestamp = resumedAt.toISOString();

  return {
    ...session,
    pausedAt: undefined,
    pausedSeconds: session.pausedSeconds + pausedSeconds,
    updatedAt: timestamp,
    status: "running",
  };
}

export function cancelFocusSession(session: FocusSession, cancelledAt: Date): FocusSession {
  const timestamp = cancelledAt.toISOString();

  return {
    ...session,
    endedAt: timestamp,
    pausedAt: undefined,
    updatedAt: timestamp,
    status: "cancelled",
  };
}

export function getRemainingSeconds(session: FocusSession, now = new Date()) {
  if (session.status === "completed") {
    return 0;
  }

  const plannedSeconds = Math.max(0, session.plannedMinutes * 60);
  const elapsedSeconds = getElapsedFocusSeconds(session, now);
  return Math.max(0, plannedSeconds - elapsedSeconds);
}

export function isSessionComplete(session: FocusSession, now = new Date()) {
  return session.status === "running" && getRemainingSeconds(session, now) <= 0;
}

export function formatRemainingTime(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.ceil(totalSeconds));
  const minutes = Math.floor(safeSeconds / 60);
  const seconds = safeSeconds % 60;

  return `${minutes}:${seconds.toString().padStart(2, "0")}`;
}

function getElapsedFocusSeconds(session: FocusSession, now: Date) {
  const startedAt = new Date(session.startedAt).getTime();
  const effectiveNow =
    session.status === "paused" && session.pausedAt
      ? new Date(session.pausedAt).getTime()
      : new Date(session.endedAt ?? now.toISOString()).getTime();

  if (!Number.isFinite(startedAt) || !Number.isFinite(effectiveNow)) {
    return 0;
  }

  const wallClockSeconds = Math.max(0, Math.floor((effectiveNow - startedAt) / 1000));
  return Math.max(0, wallClockSeconds - session.pausedSeconds);
}

export function getRewardUnlocks(
  previousCompletedMinutes: number,
  newlyCompletedMinutes: number,
  minutesPerReward = MINUTES_PER_REWARD,
) {
  if (newlyCompletedMinutes <= 0) {
    return 0;
  }

  const previousUnlocks = Math.floor(previousCompletedMinutes / minutesPerReward);
  const nextUnlocks = Math.floor(
    (previousCompletedMinutes + newlyCompletedMinutes) / minutesPerReward,
  );

  return Math.max(0, nextUnlocks - previousUnlocks);
}
