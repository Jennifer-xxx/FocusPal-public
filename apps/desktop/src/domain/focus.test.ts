import { describe, expect, it } from "vitest";
import {
  cancelFocusSession,
  completeFocusSession,
  createFocusSession,
  getRemainingSeconds,
  getRewardUnlocks,
  isSessionComplete,
  pauseFocusSession,
  resumeFocusSession,
} from "./focus";

describe("getRewardUnlocks", () => {
  it("unlocks one demo reward for each newly completed focus minute", () => {
    expect(getRewardUnlocks(0, 1)).toBe(1);
    expect(getRewardUnlocks(1, 1)).toBe(1);
    expect(getRewardUnlocks(0, 60)).toBe(60);
  });

  it("carries partial progress toward the next reward", () => {
    expect(getRewardUnlocks(0.5, 0.5)).toBe(1);
    expect(getRewardUnlocks(0.75, 0.5)).toBe(1);
  });

  it("does not unlock rewards for cancelled or zero-minute progress", () => {
    expect(getRewardUnlocks(0, 0)).toBe(0);
    expect(getRewardUnlocks(60, -15)).toBe(0);
  });
});

describe("focus session timing", () => {
  it("counts down from planned minutes while running", () => {
    const session = createFocusSession(new Date("2026-05-01T10:00:00.000Z"), 30);

    expect(getRemainingSeconds(session, new Date("2026-05-01T10:10:00.000Z"))).toBe(1200);
    expect(isSessionComplete(session, new Date("2026-05-01T10:29:59.000Z"))).toBe(false);
    expect(isSessionComplete(session, new Date("2026-05-01T10:30:00.000Z"))).toBe(true);
  });

  it("does not count paused time against remaining focus time", () => {
    const running = createFocusSession(new Date("2026-05-01T10:00:00.000Z"), 30);
    const paused = pauseFocusSession(running, new Date("2026-05-01T10:10:00.000Z"));

    expect(paused.status).toBe("paused");
    expect(getRemainingSeconds(paused, new Date("2026-05-01T10:20:00.000Z"))).toBe(1200);

    const resumed = resumeFocusSession(paused, new Date("2026-05-01T10:20:00.000Z"));

    expect(resumed.status).toBe("running");
    expect(resumed.pausedAt).toBeUndefined();
    expect(resumed.pausedSeconds).toBe(600);
    expect(getRemainingSeconds(resumed, new Date("2026-05-01T10:25:00.000Z"))).toBe(900);
  });

  it("returns terminal sessions for complete and cancel transitions", () => {
    const running = createFocusSession(new Date("2026-05-01T10:00:00.000Z"), 60);

    expect(completeFocusSession(running, new Date("2026-05-01T11:00:00.000Z"))).toMatchObject({
      status: "completed",
      endedAt: "2026-05-01T11:00:00.000Z",
    });
    expect(cancelFocusSession(running, new Date("2026-05-01T10:05:00.000Z"))).toMatchObject({
      status: "cancelled",
      endedAt: "2026-05-01T10:05:00.000Z",
    });
  });
});
