import { beforeEach, describe, expect, it, vi } from "vitest";
import type { FocusDebrief } from "../../domain/focusDebrief";
import type { FocusSession } from "../../domain/focus";
import type { Reward, RewardCredit } from "../../domain/rewards";
import type { TaskItem } from "../../domain/taskExtraction";
import type { Thought } from "../../domain/thoughts";
import { INITIAL_SCHEMA_STATEMENTS } from "./schema";
import {
  type SqlDatabase,
  createBrowserStorageRepository,
  createSqlStorageRepository,
} from "./repository";

const baseThought: Thought = {
  id: "thought-1",
  rawText: "look up ramen near campus",
  title: "look up ramen near campus",
  category: "food",
  rewardEligible: true,
  confidence: 0.86,
  status: "captured",
  createdAt: "2026-05-01T10:00:00.000Z",
  updatedAt: "2026-05-01T10:00:00.000Z",
};

const baseSession: FocusSession = {
  id: "session-1",
  plannedMinutes: 60,
  startedAt: "2026-05-01T09:00:00.000Z",
  endedAt: "2026-05-01T10:00:00.000Z",
  pausedSeconds: 0,
  updatedAt: "2026-05-01T10:00:00.000Z",
  status: "completed",
};

const baseReward: Reward = {
  id: "reward-1",
  creditId: "credit-1",
  thoughtId: "thought-1",
  sessionId: "session-1",
  revealedAt: "2026-05-01T10:00:00.000Z",
  updatedAt: "2026-05-01T10:00:00.000Z",
  status: "revealed",
};

const baseCredit: RewardCredit = {
  id: "credit-1",
  sourceSessionId: "session-1",
  earnedAt: "2026-05-01T10:00:00.000Z",
  updatedAt: "2026-05-01T10:00:00.000Z",
  status: "available",
};

const baseDebrief: FocusDebrief = {
  id: "debrief-1",
  sessionId: "session-1",
  summary: "You completed a block while parking one media distraction.",
  pattern: "Entertainment thoughts showed up once.",
  nextIntention: "Keep the next block centered on the CS153 milestone.",
  rewardSuggestion: "Use the saved video after the next stopping point.",
  createdAt: "2026-05-01T10:00:00.000Z",
  updatedAt: "2026-05-01T10:00:00.000Z",
};

const baseTaskItem: TaskItem = {
  id: "task-item-1",
  sessionId: "session-1",
  sourceThoughtId: "thought-1",
  title: "Submit CS153 video plan",
  nextAction: "Submit the CS153 video plan before recording.",
  status: "open",
  createdAt: "2026-05-01T10:00:00.000Z",
  updatedAt: "2026-05-01T10:00:00.000Z",
};

function createMockDatabase(rows: {
  thoughts?: unknown[];
  focusSessions?: unknown[];
  rewardCredits?: unknown[];
  rewards?: unknown[];
  focusDebriefs?: unknown[];
  taskItems?: unknown[];
  settings?: unknown[];
  focusSessionColumns?: string[];
  rewardColumns?: string[];
  settingsColumns?: string[];
} = {}) {
  const database: SqlDatabase = {
    execute: vi.fn(async () => undefined),
    select: async <T,>(query: string): Promise<T> => {
      if (query.includes("PRAGMA table_info(focus_sessions)")) {
        return (rows.focusSessionColumns ?? ["updated_at"]).map((name) => ({ name })) as T;
      }

      if (query.includes("PRAGMA table_info(rewards)")) {
        return (rows.rewardColumns ?? ["updated_at", "credit_id"]).map((name) => ({ name })) as T;
      }

      if (query.includes("PRAGMA table_info(app_settings)")) {
        return (rows.settingsColumns ?? ["shortcut"]).map((name) => ({ name })) as T;
      }

      if (query.includes("FROM thoughts")) {
        return (rows.thoughts ?? []) as T;
      }

      if (query.includes("FROM focus_sessions")) {
        return (rows.focusSessions ?? []) as T;
      }

      if (query.includes("FROM reward_credits")) {
        return (rows.rewardCredits ?? []) as T;
      }

      if (query.includes("FROM rewards")) {
        return (rows.rewards ?? []) as T;
      }

      if (query.includes("FROM focus_debriefs")) {
        return (rows.focusDebriefs ?? []) as T;
      }

      if (query.includes("FROM task_items")) {
        return (rows.taskItems ?? []) as T;
      }

      if (query.includes("FROM app_settings")) {
        return (rows.settings ?? []) as T;
      }

      return [] as T;
    },
  };

  return database;
}

describe("createSqlStorageRepository", () => {
  it("initializes every schema statement before returning the repository", async () => {
    const database = createMockDatabase();

    await createSqlStorageRepository(database);

    for (const [index, statement] of INITIAL_SCHEMA_STATEMENTS.entries()) {
      expect(database.execute).toHaveBeenNthCalledWith(index + 1, statement);
    }
    expect(database.execute).toHaveBeenCalledWith(expect.stringContaining("UPDATE focus_sessions"));
    expect(database.execute).toHaveBeenCalledWith(expect.stringContaining("UPDATE rewards"));
  });

  it("adds production migration columns for older local databases", async () => {
    const database = createMockDatabase({
      focusSessionColumns: ["id", "planned_minutes", "started_at", "ended_at", "status"],
      rewardColumns: ["id", "thought_id", "session_id", "revealed_at", "status"],
      settingsColumns: ["id", "default_focus_minutes", "local_only", "api_key", "updated_at"],
    });

    await createSqlStorageRepository(database);

    expect(database.execute).toHaveBeenCalledWith(
      "ALTER TABLE focus_sessions ADD COLUMN updated_at TEXT;",
    );
    expect(database.execute).toHaveBeenCalledWith(
      "ALTER TABLE focus_sessions ADD COLUMN paused_at TEXT;",
    );
    expect(database.execute).toHaveBeenCalledWith(
      "ALTER TABLE focus_sessions ADD COLUMN paused_seconds INTEGER NOT NULL DEFAULT 0;",
    );
    expect(database.execute).toHaveBeenCalledWith("ALTER TABLE rewards ADD COLUMN updated_at TEXT;");
    expect(database.execute).toHaveBeenCalledWith("ALTER TABLE rewards ADD COLUMN credit_id TEXT;");
    expect(database.execute).toHaveBeenCalledWith("ALTER TABLE app_settings ADD COLUMN shortcut TEXT;");
    expect(database.execute).toHaveBeenCalledWith(
      "ALTER TABLE app_settings ADD COLUMN focus_companion_mode TEXT;",
    );
    expect(database.execute).toHaveBeenCalledWith(
      "ALTER TABLE app_settings ADD COLUMN character_enabled INTEGER NOT NULL DEFAULT 0;",
    );
  });

  it("inserts thoughts with all persisted columns and maps selected rows back to domain fields", async () => {
    const database = createMockDatabase({
      thoughts: [
        {
          id: "thought-1",
          raw_text: "look up ramen near campus",
          title: "look up ramen near campus",
          category: "food",
          reward_eligible: 1,
          confidence: 0.86,
          status: "captured",
          created_at: "2026-05-01T10:00:00.000Z",
          updated_at: "2026-05-01T10:00:00.000Z",
        },
      ],
    });
    const repository = await createSqlStorageRepository(database);

    await repository.createThought(baseThought);
    await expect(repository.listThoughts()).resolves.toEqual([baseThought]);

    expect(database.execute).toHaveBeenLastCalledWith(expect.stringContaining("INSERT INTO thoughts"), [
      "thought-1",
      "look up ramen near campus",
      "look up ramen near campus",
      "food",
      1,
      0.86,
      "captured",
      "2026-05-01T10:00:00.000Z",
      "2026-05-01T10:00:00.000Z",
    ]);
  });

  it("updates thought status without overwriting the raw captured text", async () => {
    const database = createMockDatabase();
    const repository = await createSqlStorageRepository(database);

    await repository.updateThoughtStatus("thought-1", "used", new Date("2026-05-01T11:00:00.000Z"));

    expect(database.execute).toHaveBeenLastCalledWith(expect.stringContaining("UPDATE thoughts"), [
      "used",
      "2026-05-01T11:00:00.000Z",
      "thought-1",
    ]);
  });

  it("updates thought category and reward eligibility without changing status", async () => {
    const database = createMockDatabase();
    const repository = await createSqlStorageRepository(database);

    await repository.updateThoughtDetails(
      "thought-1",
      { category: "task", rewardEligible: false },
      new Date("2026-05-01T11:00:00.000Z"),
    );

    expect(database.execute).toHaveBeenLastCalledWith(expect.stringContaining("UPDATE thoughts"), [
      "task",
      0,
      "2026-05-01T11:00:00.000Z",
      "thought-1",
    ]);
  });

  it("persists focus sessions with mutable status metadata", async () => {
    const database = createMockDatabase({
      focusSessions: [
        {
          id: "session-1",
          planned_minutes: 60,
          started_at: "2026-05-01T09:00:00.000Z",
          ended_at: "2026-05-01T10:00:00.000Z",
          paused_at: null,
          paused_seconds: 0,
          updated_at: "2026-05-01T10:00:00.000Z",
          status: "completed",
        },
      ],
    });
    const repository = await createSqlStorageRepository(database);

    await repository.createFocusSession(baseSession);
    await repository.updateFocusSession({ ...baseSession, status: "cancelled" });
    await expect(repository.listFocusSessions()).resolves.toEqual([baseSession]);

    expect(database.execute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO focus_sessions"),
      [
        "session-1",
        60,
        "2026-05-01T09:00:00.000Z",
        "2026-05-01T10:00:00.000Z",
        null,
        0,
        "2026-05-01T10:00:00.000Z",
        "completed",
      ],
    );
    expect(database.execute).toHaveBeenLastCalledWith(
      expect.stringContaining("UPDATE focus_sessions"),
      [
        60,
        "2026-05-01T09:00:00.000Z",
        "2026-05-01T10:00:00.000Z",
        null,
        0,
        "2026-05-01T10:00:00.000Z",
        "cancelled",
        "session-1",
      ],
    );
  });

  it("persists rewards and supports every reward terminal status", async () => {
    const database = createMockDatabase({
      rewards: [
        {
          id: "reward-1",
          credit_id: "credit-1",
          thought_id: "thought-1",
          session_id: "session-1",
          revealed_at: "2026-05-01T10:00:00.000Z",
          updated_at: "2026-05-01T10:00:00.000Z",
          status: "revealed",
        },
      ],
    });
    const repository = await createSqlStorageRepository(database);

    await repository.createReward(baseReward);
    await repository.updateRewardStatus(
      "reward-1",
      "dismissed",
      new Date("2026-05-01T12:00:00.000Z"),
    );

    await expect(repository.listRewards()).resolves.toEqual([baseReward]);
    expect(database.execute).toHaveBeenCalledWith(expect.stringContaining("INSERT INTO rewards"), [
      "reward-1",
      "credit-1",
      "thought-1",
      "session-1",
      "2026-05-01T10:00:00.000Z",
      "2026-05-01T10:00:00.000Z",
      "revealed",
    ]);
    expect(database.execute).toHaveBeenLastCalledWith(expect.stringContaining("UPDATE rewards"), [
      "dismissed",
      "2026-05-01T12:00:00.000Z",
      "reward-1",
    ]);
  });

  it("persists reward credits as durable unopened boxes", async () => {
    const database = createMockDatabase({
      rewardCredits: [
        {
          id: "credit-1",
          source_session_id: "session-1",
          earned_at: "2026-05-01T10:00:00.000Z",
          spent_at: null,
          updated_at: "2026-05-01T10:00:00.000Z",
          status: "available",
        },
      ],
    });
    const repository = await createSqlStorageRepository(database);

    await repository.createRewardCredit(baseCredit);
    await repository.updateRewardCreditStatus(
      "credit-1",
      "spent",
      new Date("2026-05-01T10:05:00.000Z"),
    );

    await expect(repository.listRewardCredits()).resolves.toEqual([baseCredit]);
    expect(database.execute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO reward_credits"),
      [
        "credit-1",
        "session-1",
        "2026-05-01T10:00:00.000Z",
        null,
        "2026-05-01T10:00:00.000Z",
        "available",
      ],
    );
    expect(database.execute).toHaveBeenLastCalledWith(
      expect.stringContaining("UPDATE reward_credits"),
      ["spent", "2026-05-01T10:05:00.000Z", "credit-1"],
    );
  });

  it("persists focus debriefs tied to completed sessions", async () => {
    const database = createMockDatabase({
      focusDebriefs: [
        {
          id: "debrief-1",
          session_id: "session-1",
          summary: "You completed a block while parking one media distraction.",
          pattern: "Entertainment thoughts showed up once.",
          next_intention: "Keep the next block centered on the CS153 milestone.",
          reward_suggestion: "Use the saved video after the next stopping point.",
          created_at: "2026-05-01T10:00:00.000Z",
          updated_at: "2026-05-01T10:00:00.000Z",
        },
      ],
    });
    const repository = await createSqlStorageRepository(database);

    await repository.createFocusDebrief(baseDebrief);
    await expect(repository.listFocusDebriefs()).resolves.toEqual([baseDebrief]);

    expect(database.execute).toHaveBeenLastCalledWith(
      expect.stringContaining("INSERT INTO focus_debriefs"),
      [
        "debrief-1",
        "session-1",
        "You completed a block while parking one media distraction.",
        "Entertainment thoughts showed up once.",
        "Keep the next block centered on the CS153 milestone.",
        "Use the saved video after the next stopping point.",
        "2026-05-01T10:00:00.000Z",
        "2026-05-01T10:00:00.000Z",
      ],
    );
  });

  it("persists task items tied to completed sessions and supports status updates", async () => {
    const database = createMockDatabase({
      taskItems: [
        {
          id: "task-item-1",
          session_id: "session-1",
          source_thought_id: "thought-1",
          title: "Submit CS153 video plan",
          next_action: "Submit the CS153 video plan before recording.",
          status: "open",
          created_at: "2026-05-01T10:00:00.000Z",
          updated_at: "2026-05-01T10:00:00.000Z",
        },
      ],
    });
    const repository = await createSqlStorageRepository(database);

    await repository.createTaskItem(baseTaskItem);
    await repository.updateTaskItemStatus(
      "task-item-1",
      "done",
      new Date("2026-05-01T10:05:00.000Z"),
    );
    await expect(repository.listTaskItems()).resolves.toEqual([baseTaskItem]);

    expect(database.execute).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO task_items"),
      [
        "task-item-1",
        "session-1",
        "thought-1",
        "Submit CS153 video plan",
        "Submit the CS153 video plan before recording.",
        "open",
        "2026-05-01T10:00:00.000Z",
        "2026-05-01T10:00:00.000Z",
      ],
    );
    expect(database.execute).toHaveBeenLastCalledWith(
      expect.stringContaining("UPDATE task_items"),
      ["done", "2026-05-01T10:05:00.000Z", "task-item-1"],
    );
  });

  it("round-trips paused session timing metadata", async () => {
    const pausedSession: FocusSession = {
      ...baseSession,
      endedAt: undefined,
      pausedAt: "2026-05-01T09:20:00.000Z",
      pausedSeconds: 300,
      status: "paused",
    };
    const database = createMockDatabase({
      focusSessions: [
        {
          id: "session-1",
          planned_minutes: 60,
          started_at: "2026-05-01T09:00:00.000Z",
          ended_at: null,
          paused_at: "2026-05-01T09:20:00.000Z",
          paused_seconds: 300,
          updated_at: "2026-05-01T10:00:00.000Z",
          status: "paused",
        },
      ],
    });
    const repository = await createSqlStorageRepository(database);

    await repository.createFocusSession(pausedSession);
    await expect(repository.listFocusSessions()).resolves.toEqual([pausedSession]);
  });

  it("clears child tables before parent tables for demo reset safety", async () => {
    const database = createMockDatabase();
    const repository = await createSqlStorageRepository(database);
    const bootstrapExecuteCount = (database.execute as unknown as { mock: { calls: unknown[] } })
      .mock.calls.length;

    await repository.clearAllData();

    expect(database.execute).toHaveBeenNthCalledWith(
      bootstrapExecuteCount + 1,
      "DELETE FROM rewards;",
    );
    expect(database.execute).toHaveBeenNthCalledWith(
      bootstrapExecuteCount + 2,
      "DELETE FROM reward_credits;",
    );
    expect(database.execute).toHaveBeenNthCalledWith(
      bootstrapExecuteCount + 3,
      "DELETE FROM focus_debriefs;",
    );
    expect(database.execute).toHaveBeenNthCalledWith(
      bootstrapExecuteCount + 4,
      "DELETE FROM task_items;",
    );
    expect(database.execute).toHaveBeenNthCalledWith(
      bootstrapExecuteCount + 5,
      "DELETE FROM focus_sessions;",
    );
    expect(database.execute).toHaveBeenNthCalledWith(
      bootstrapExecuteCount + 6,
      "DELETE FROM thoughts;",
    );
  });

  it("loads default settings and persists updated settings", async () => {
    const database = createMockDatabase({
      settings: [
        {
          id: "default",
          default_focus_minutes: 30,
          local_only: 0,
          api_key: "sk-demo",
          shortcut: "CmdOrCtrl+Alt+Space",
          focus_companion_mode: "character",
          character_enabled: 1,
          updated_at: "2026-05-01T10:00:00.000Z",
        },
      ],
    });
    const repository = await createSqlStorageRepository(database);

    await expect(repository.getSettings()).resolves.toEqual({
      defaultFocusMinutes: 30,
      localOnly: false,
      apiKey: "sk-demo",
      shortcut: "CmdOrCtrl+Alt+Space",
      focusCompanionMode: "character",
      characterEnabled: true,
      updatedAt: "2026-05-01T10:00:00.000Z",
    });

    await repository.updateSettings({
      defaultFocusMinutes: 15,
      localOnly: true,
      apiKey: "",
      shortcut: "CmdOrCtrl+Shift+C",
      focusCompanionMode: "widget",
      characterEnabled: false,
      updatedAt: "2026-05-01T11:00:00.000Z",
    });

    expect(database.execute).toHaveBeenLastCalledWith(
      expect.stringContaining("INSERT INTO app_settings"),
      [
        "default",
        15,
        1,
        "",
        "CmdOrCtrl+Shift+C",
        "widget",
        0,
        "2026-05-01T11:00:00.000Z",
      ],
    );
  });
});

describe("createBrowserStorageRepository", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("round-trips thoughts, sessions, reward credits, rewards, debriefs, and task items in the browser fallback", async () => {
    const repository = createBrowserStorageRepository(localStorage, "focuspal-test");

    await repository.createThought(baseThought);
    await repository.createFocusSession(baseSession);
    await repository.createRewardCredit(baseCredit);
    await repository.createReward(baseReward);
    await repository.createFocusDebrief(baseDebrief);
    await repository.createTaskItem(baseTaskItem);

    await expect(repository.listThoughts()).resolves.toEqual([baseThought]);
    await expect(repository.listFocusSessions()).resolves.toEqual([baseSession]);
    await expect(repository.listRewardCredits()).resolves.toEqual([baseCredit]);
    await expect(repository.listRewards()).resolves.toEqual([baseReward]);
    await expect(repository.listFocusDebriefs()).resolves.toEqual([baseDebrief]);
    await expect(repository.listTaskItems()).resolves.toEqual([baseTaskItem]);
  });

  it("round-trips settings, task status, and thought detail edits in the browser fallback", async () => {
    const repository = createBrowserStorageRepository(localStorage, "focuspal-test");

    await repository.createThought(baseThought);
    await repository.createTaskItem(baseTaskItem);
    await repository.updateThoughtDetails(
      "thought-1",
      { category: "task", rewardEligible: false },
      new Date("2026-05-01T11:00:00.000Z"),
    );
    await repository.updateTaskItemStatus(
      "task-item-1",
      "deferred",
      new Date("2026-05-01T11:05:00.000Z"),
    );
    await repository.updateSettings({
      defaultFocusMinutes: 15,
      localOnly: false,
      apiKey: "sk-demo",
      shortcut: "CmdOrCtrl+Alt+Space",
      focusCompanionMode: "character",
      characterEnabled: true,
      updatedAt: "2026-05-01T11:00:00.000Z",
    });

    await expect(repository.listThoughts()).resolves.toEqual([
      {
        ...baseThought,
        category: "task",
        rewardEligible: false,
        updatedAt: "2026-05-01T11:00:00.000Z",
      },
    ]);
    await expect(repository.listTaskItems()).resolves.toEqual([
      {
        ...baseTaskItem,
        status: "deferred",
        updatedAt: "2026-05-01T11:05:00.000Z",
      },
    ]);
    await expect(repository.getSettings()).resolves.toEqual({
      defaultFocusMinutes: 15,
      localOnly: false,
      apiKey: "sk-demo",
      shortcut: "CmdOrCtrl+Alt+Space",
      focusCompanionMode: "character",
      characterEnabled: true,
      updatedAt: "2026-05-01T11:00:00.000Z",
    });
  });

  it("hides deleted task items in the browser fallback", async () => {
    const repository = createBrowserStorageRepository(localStorage, "focuspal-test");

    await repository.createTaskItem(baseTaskItem);
    await repository.updateTaskItemStatus(
      "task-item-1",
      "deleted",
      new Date("2026-05-01T11:00:00.000Z"),
    );

    await expect(repository.listTaskItems()).resolves.toEqual([]);
  });

  it("recovers to an empty repository when browser storage is corrupted", async () => {
    localStorage.setItem("focuspal-test", "{not-json");
    const repository = createBrowserStorageRepository(localStorage, "focuspal-test");

    await expect(repository.listThoughts()).resolves.toEqual([]);
    await expect(repository.listFocusSessions()).resolves.toEqual([]);
    await expect(repository.listRewardCredits()).resolves.toEqual([]);
    await expect(repository.listRewards()).resolves.toEqual([]);
  });

  it("clears all browser fallback data for demo reset flows", async () => {
    const repository = createBrowserStorageRepository(localStorage, "focuspal-test");

    await repository.createThought(baseThought);
    await repository.clearAllData();

    await expect(repository.listThoughts()).resolves.toEqual([]);
    expect(localStorage.getItem("focuspal-test")).toBeNull();
  });
});
