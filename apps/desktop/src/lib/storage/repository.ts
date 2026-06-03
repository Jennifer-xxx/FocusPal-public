import type { FocusSession } from "../../domain/focus";
import type { FocusDebrief } from "../../domain/focusDebrief";
import type {
  Reward,
  RewardCredit,
  RewardCreditStatus,
  RewardStatus,
} from "../../domain/rewards";
import {
  TASK_ITEM_STATUSES,
  type TaskItem,
  type TaskItemStatus,
} from "../../domain/taskExtraction";
import {
  THOUGHT_CATEGORIES,
  type Thought,
  type ThoughtCategory,
  type ThoughtStatus,
} from "../../domain/thoughts";
import { DATABASE_URL, INITIAL_SCHEMA_STATEMENTS } from "./schema";

const BROWSER_STORAGE_KEY = "focuspal.repository.v1";
const THOUGHT_STATUSES: ThoughtStatus[] = [
  "captured",
  "rewarded",
  "used",
  "snoozed",
  "dismissed",
  "deleted",
];
const FOCUS_SESSION_STATUSES: FocusSession["status"][] = [
  "running",
  "paused",
  "completed",
  "cancelled",
];
const REWARD_STATUSES: RewardStatus[] = ["revealed", "used", "snoozed", "dismissed"];
const REWARD_CREDIT_STATUSES: RewardCreditStatus[] = ["available", "spent"];
const FOCUS_COMPANION_MODES = ["widget", "character"] as const;
const SETTINGS_ID = "default";

export type FocusCompanionMode = (typeof FOCUS_COMPANION_MODES)[number];

export type AppSettings = {
  defaultFocusMinutes: number;
  localOnly: boolean;
  apiKey: string;
  focusCompanionMode: FocusCompanionMode;
  characterEnabled: boolean;
  shortcut: string;
  updatedAt: string;
};

export type ThoughtDetailUpdates = {
  category?: ThoughtCategory;
  rewardEligible?: boolean;
};

export type SqlDatabase = {
  execute(query: string, bindValues?: unknown[]): Promise<unknown>;
  select<T>(query: string, bindValues?: unknown[]): Promise<T>;
  close?: () => Promise<boolean>;
};

export type StorageRepository = {
  listThoughts(): Promise<Thought[]>;
  createThought(thought: Thought): Promise<void>;
  updateThoughtStatus(id: string, status: ThoughtStatus, updatedAt?: Date): Promise<void>;
  updateThoughtDetails(
    id: string,
    updates: ThoughtDetailUpdates,
    updatedAt?: Date,
  ): Promise<void>;
  listFocusSessions(): Promise<FocusSession[]>;
  createFocusSession(session: FocusSession): Promise<void>;
  updateFocusSession(session: FocusSession): Promise<void>;
  listRewardCredits(): Promise<RewardCredit[]>;
  createRewardCredit(credit: RewardCredit): Promise<void>;
  updateRewardCreditStatus(
    id: string,
    status: RewardCreditStatus,
    updatedAt?: Date,
  ): Promise<void>;
  listRewards(): Promise<Reward[]>;
  createReward(reward: Reward): Promise<void>;
  updateRewardStatus(id: string, status: RewardStatus, updatedAt?: Date): Promise<void>;
  listFocusDebriefs(): Promise<FocusDebrief[]>;
  createFocusDebrief(debrief: FocusDebrief): Promise<void>;
  listTaskItems(): Promise<TaskItem[]>;
  createTaskItem(taskItem: TaskItem): Promise<void>;
  updateTaskItemStatus(id: string, status: TaskItemStatus, updatedAt?: Date): Promise<void>;
  getSettings(): Promise<AppSettings>;
  updateSettings(settings: AppSettings): Promise<void>;
  clearAllData(): Promise<void>;
};

type BrowserRepositoryState = {
  thoughts: Thought[];
  focusSessions: FocusSession[];
  rewardCredits: RewardCredit[];
  rewards: Reward[];
  focusDebriefs: FocusDebrief[];
  taskItems: TaskItem[];
  settings?: AppSettings;
};

type ThoughtRow = {
  id: string;
  raw_text: string;
  title: string | null;
  category: string;
  reward_eligible: number | boolean;
  confidence: number | null;
  status: string;
  created_at: string;
  updated_at: string;
};

type FocusSessionRow = {
  id: string;
  planned_minutes: number;
  started_at: string;
  ended_at: string | null;
  paused_at: string | null;
  paused_seconds: number | null;
  updated_at: string;
  status: string;
};

type RewardRow = {
  id: string;
  credit_id: string | null;
  thought_id: string;
  session_id: string;
  revealed_at: string;
  updated_at: string;
  status: string;
};

type RewardCreditRow = {
  id: string;
  source_session_id: string | null;
  earned_at: string;
  spent_at: string | null;
  updated_at: string;
  status: string;
};

type FocusDebriefRow = {
  id: string;
  session_id: string;
  summary: string;
  pattern: string;
  next_intention: string;
  reward_suggestion: string;
  created_at: string;
  updated_at: string;
};

type TaskItemRow = {
  id: string;
  session_id: string;
  source_thought_id: string;
  title: string;
  next_action: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type AppSettingsRow = {
  id: string;
  default_focus_minutes: number;
  local_only: number | boolean;
  api_key: string | null;
  focus_companion_mode: string | null;
  character_enabled: number | boolean | null;
  shortcut: string | null;
  updated_at: string;
};

type UnknownThought = Omit<Partial<Thought>, "category" | "status"> & {
  category?: unknown;
  status?: unknown;
};

type UnknownFocusSession = Omit<Partial<FocusSession>, "status"> & {
  status?: unknown;
};

type UnknownReward = Omit<Partial<Reward>, "status"> & {
  status?: unknown;
};

type UnknownRewardCredit = Omit<Partial<RewardCredit>, "status"> & {
  status?: unknown;
};

type UnknownFocusDebrief = Partial<FocusDebrief>;

type UnknownTaskItem = Omit<Partial<TaskItem>, "status"> & {
  status?: unknown;
};

type UnknownAppSettings = Omit<
  Partial<AppSettings>,
  "focusCompanionMode" | "characterEnabled"
> & {
  focusCompanionMode?: unknown;
  characterEnabled?: unknown;
};

export function createDefaultSettings(): AppSettings {
  return {
    defaultFocusMinutes: 60,
    localOnly: true,
    apiKey: "",
    focusCompanionMode: "widget",
    characterEnabled: false,
    shortcut: "CmdOrCtrl+Shift+Space",
    updatedAt: new Date(0).toISOString(),
  };
}

export async function initializeStorage(): Promise<StorageRepository> {
  if (isTauriRuntime()) {
    try {
      const { default: Database } = await import("@tauri-apps/plugin-sql");
      const database = await Database.load(DATABASE_URL);
      return createSqlStorageRepository(database);
    } catch (error) {
      console.warn("FocusPal SQLite storage unavailable; using browser fallback.", error);
      return createBrowserStorageRepository();
    }
  }

  return createBrowserStorageRepository();
}

export async function createSqlStorageRepository(database: SqlDatabase): Promise<StorageRepository> {
  for (const statement of INITIAL_SCHEMA_STATEMENTS) {
    await database.execute(statement);
  }

  await migrateExistingTables(database);

  return {
    async listThoughts() {
      const rows = await database.select<ThoughtRow[]>(
        `SELECT id, raw_text, title, category, reward_eligible, confidence, status, created_at, updated_at
         FROM thoughts
         WHERE status != $1
         ORDER BY created_at DESC;`,
        ["deleted"],
      );
      return rows.map(mapThoughtRow);
    },

    async createThought(thought) {
      await database.execute(
        `INSERT INTO thoughts (
          id, raw_text, title, category, reward_eligible, confidence, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9);`,
        [
          thought.id,
          thought.rawText,
          thought.title,
          thought.category,
          thought.rewardEligible ? 1 : 0,
          thought.confidence,
          thought.status,
          thought.createdAt,
          thought.updatedAt,
        ],
      );
    },

    async updateThoughtStatus(id, status, updatedAt = new Date()) {
      await database.execute(
        `UPDATE thoughts
         SET status = $1, updated_at = $2
         WHERE id = $3;`,
        [status, updatedAt.toISOString(), id],
      );
    },

    async updateThoughtDetails(id, updates, updatedAt = new Date()) {
      await database.execute(
        `UPDATE thoughts
         SET category = COALESCE($1, category),
           reward_eligible = COALESCE($2, reward_eligible),
           updated_at = $3
         WHERE id = $4;`,
        [
          updates.category ?? null,
          typeof updates.rewardEligible === "boolean" ? (updates.rewardEligible ? 1 : 0) : null,
          updatedAt.toISOString(),
          id,
        ],
      );
    },

    async listFocusSessions() {
      const rows = await database.select<FocusSessionRow[]>(
        `SELECT id, planned_minutes, started_at, ended_at, paused_at, paused_seconds, updated_at, status
         FROM focus_sessions
         ORDER BY started_at DESC;`,
      );
      return rows.map(mapFocusSessionRow);
    },

    async createFocusSession(session) {
      await database.execute(
        `INSERT INTO focus_sessions (
          id, planned_minutes, started_at, ended_at, paused_at, paused_seconds, updated_at, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`,
        [
          session.id,
          session.plannedMinutes,
          session.startedAt,
          session.endedAt ?? null,
          session.pausedAt ?? null,
          session.pausedSeconds,
          session.updatedAt,
          session.status,
        ],
      );
    },

    async updateFocusSession(session) {
      await database.execute(
        `UPDATE focus_sessions
         SET planned_minutes = $1, started_at = $2, ended_at = $3, paused_at = $4,
           paused_seconds = $5, updated_at = $6, status = $7
         WHERE id = $8;`,
        [
          session.plannedMinutes,
          session.startedAt,
          session.endedAt ?? null,
          session.pausedAt ?? null,
          session.pausedSeconds,
          session.updatedAt,
          session.status,
          session.id,
        ],
      );
    },

    async listRewardCredits() {
      const rows = await database.select<RewardCreditRow[]>(
        `SELECT id, source_session_id, earned_at, spent_at, updated_at, status
         FROM reward_credits
         ORDER BY earned_at ASC;`,
      );
      return rows.map(mapRewardCreditRow);
    },

    async createRewardCredit(credit) {
      await database.execute(
        `INSERT INTO reward_credits (
          id, source_session_id, earned_at, spent_at, updated_at, status
        ) VALUES ($1, $2, $3, $4, $5, $6);`,
        [
          credit.id,
          credit.sourceSessionId ?? null,
          credit.earnedAt,
          credit.spentAt ?? null,
          credit.updatedAt,
          credit.status,
        ],
      );
    },

    async updateRewardCreditStatus(id, status, updatedAt = new Date()) {
      await database.execute(
        `UPDATE reward_credits
         SET status = $1, spent_at = CASE WHEN $1 = 'spent' THEN $2 ELSE spent_at END, updated_at = $2
         WHERE id = $3;`,
        [status, updatedAt.toISOString(), id],
      );
    },

    async listRewards() {
      const rows = await database.select<RewardRow[]>(
        `SELECT id, credit_id, thought_id, session_id, revealed_at, updated_at, status
         FROM rewards
         ORDER BY revealed_at DESC;`,
      );
      return rows.map(mapRewardRow);
    },

    async createReward(reward) {
      await database.execute(
        `INSERT INTO rewards (
          id, credit_id, thought_id, session_id, revealed_at, updated_at, status
        ) VALUES ($1, $2, $3, $4, $5, $6, $7);`,
        [
          reward.id,
          reward.creditId ?? null,
          reward.thoughtId,
          reward.sessionId,
          reward.revealedAt,
          reward.updatedAt,
          reward.status,
        ],
      );
    },

    async updateRewardStatus(id, status, updatedAt = new Date()) {
      await database.execute(
        `UPDATE rewards
         SET status = $1, updated_at = $2
         WHERE id = $3;`,
        [status, updatedAt.toISOString(), id],
      );
    },

    async listFocusDebriefs() {
      const rows = await database.select<FocusDebriefRow[]>(
        `SELECT id, session_id, summary, pattern, next_intention, reward_suggestion, created_at, updated_at
         FROM focus_debriefs
         ORDER BY created_at DESC;`,
      );
      return rows.map(mapFocusDebriefRow);
    },

    async createFocusDebrief(debrief) {
      await database.execute(
        `INSERT INTO focus_debriefs (
          id, session_id, summary, pattern, next_intention, reward_suggestion, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT(id) DO UPDATE SET
          summary = excluded.summary,
          pattern = excluded.pattern,
          next_intention = excluded.next_intention,
          reward_suggestion = excluded.reward_suggestion,
          updated_at = excluded.updated_at;`,
        [
          debrief.id,
          debrief.sessionId,
          debrief.summary,
          debrief.pattern,
          debrief.nextIntention,
          debrief.rewardSuggestion,
          debrief.createdAt,
          debrief.updatedAt,
        ],
      );
    },

    async listTaskItems() {
      const rows = await database.select<TaskItemRow[]>(
        `SELECT id, session_id, source_thought_id, title, next_action, status, created_at, updated_at
         FROM task_items
         WHERE status != $1
         ORDER BY created_at DESC;`,
        ["deleted"],
      );
      return rows.map(mapTaskItemRow);
    },

    async createTaskItem(taskItem) {
      await database.execute(
        `INSERT INTO task_items (
          id, session_id, source_thought_id, title, next_action, status, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT(id) DO UPDATE SET
          title = excluded.title,
          next_action = excluded.next_action,
          status = excluded.status,
          updated_at = excluded.updated_at;`,
        [
          taskItem.id,
          taskItem.sessionId,
          taskItem.sourceThoughtId,
          taskItem.title,
          taskItem.nextAction,
          taskItem.status,
          taskItem.createdAt,
          taskItem.updatedAt,
        ],
      );
    },

    async updateTaskItemStatus(id, status, updatedAt = new Date()) {
      await database.execute(
        `UPDATE task_items
         SET status = $1, updated_at = $2
         WHERE id = $3;`,
        [status, updatedAt.toISOString(), id],
      );
    },

    async getSettings() {
      const rows = await database.select<AppSettingsRow[]>(
        `SELECT id, default_focus_minutes, local_only, api_key, focus_companion_mode, character_enabled, shortcut, updated_at
         FROM app_settings
         WHERE id = $1
         LIMIT 1;`,
        [SETTINGS_ID],
      );

      return rows[0] ? mapSettingsRow(rows[0]) : createDefaultSettings();
    },

    async updateSettings(settings) {
      await database.execute(
        `INSERT INTO app_settings (
          id, default_focus_minutes, local_only, api_key, shortcut, focus_companion_mode, character_enabled, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT(id) DO UPDATE SET
          default_focus_minutes = excluded.default_focus_minutes,
          local_only = excluded.local_only,
          api_key = excluded.api_key,
          shortcut = excluded.shortcut,
          focus_companion_mode = excluded.focus_companion_mode,
          character_enabled = excluded.character_enabled,
          updated_at = excluded.updated_at;`,
        [
          SETTINGS_ID,
          settings.defaultFocusMinutes,
          settings.localOnly ? 1 : 0,
          settings.apiKey,
          settings.shortcut,
          settings.focusCompanionMode,
          settings.characterEnabled ? 1 : 0,
          settings.updatedAt,
        ],
      );
    },

    async clearAllData() {
      await database.execute("DELETE FROM rewards;");
      await database.execute("DELETE FROM reward_credits;");
      await database.execute("DELETE FROM focus_debriefs;");
      await database.execute("DELETE FROM task_items;");
      await database.execute("DELETE FROM focus_sessions;");
      await database.execute("DELETE FROM thoughts;");
      await database.execute("DELETE FROM app_settings;");
    },
  };
}

async function migrateExistingTables(database: SqlDatabase) {
  await ensureColumn(database, "focus_sessions", "updated_at", "TEXT");
  await ensureColumn(database, "focus_sessions", "paused_at", "TEXT");
  await ensureColumn(
    database,
    "focus_sessions",
    "paused_seconds",
    "INTEGER NOT NULL DEFAULT 0",
  );
  await database.execute(
    `UPDATE focus_sessions
     SET updated_at = COALESCE(updated_at, ended_at, started_at)
     WHERE updated_at IS NULL;`,
  );

  await ensureColumn(database, "rewards", "updated_at", "TEXT");
  await database.execute(
    `UPDATE rewards
     SET updated_at = COALESCE(updated_at, revealed_at)
     WHERE updated_at IS NULL;`,
  );

  await ensureColumn(database, "rewards", "credit_id", "TEXT");
  await ensureColumn(database, "app_settings", "shortcut", "TEXT");
  await ensureColumn(database, "app_settings", "focus_companion_mode", "TEXT");
  await ensureColumn(
    database,
    "app_settings",
    "character_enabled",
    "INTEGER NOT NULL DEFAULT 0",
  );
  await database.execute(
    `UPDATE app_settings
     SET shortcut = COALESCE(shortcut, 'CmdOrCtrl+Shift+Space')
     WHERE shortcut IS NULL;`,
  );
  await database.execute(
    `UPDATE app_settings
     SET focus_companion_mode = COALESCE(focus_companion_mode, 'widget')
     WHERE focus_companion_mode IS NULL;`,
  );
}

async function ensureColumn(
  database: SqlDatabase,
  tableName: "focus_sessions" | "rewards" | "app_settings",
  columnName:
    | "updated_at"
    | "credit_id"
    | "paused_at"
    | "paused_seconds"
    | "shortcut"
    | "focus_companion_mode"
    | "character_enabled",
  columnDefinition: string,
) {
  const columns = await database.select<Array<{ name: string }>>(`PRAGMA table_info(${tableName});`);
  const hasColumn = columns.some((column) => column.name === columnName);

  if (!hasColumn) {
    await database.execute(`ALTER TABLE ${tableName} ADD COLUMN ${columnName} ${columnDefinition};`);
  }
}

export function createBrowserStorageRepository(
  storage: Storage = window.localStorage,
  key = BROWSER_STORAGE_KEY,
): StorageRepository {
  return {
    async listThoughts() {
      return readBrowserState(storage, key).thoughts.filter((thought) => thought.status !== "deleted");
    },

    async createThought(thought) {
      const state = readBrowserState(storage, key);
      writeBrowserState(storage, key, {
        ...state,
        thoughts: [thought, ...state.thoughts.filter((current) => current.id !== thought.id)],
      });
    },

    async updateThoughtStatus(id, status, updatedAt = new Date()) {
      const state = readBrowserState(storage, key);
      writeBrowserState(storage, key, {
        ...state,
        thoughts: state.thoughts.map((thought) =>
          thought.id === id ? { ...thought, status, updatedAt: updatedAt.toISOString() } : thought,
        ),
      });
    },

    async updateThoughtDetails(id, updates, updatedAt = new Date()) {
      const state = readBrowserState(storage, key);
      writeBrowserState(storage, key, {
        ...state,
        thoughts: state.thoughts.map((thought) =>
          thought.id === id
            ? {
                ...thought,
                category: updates.category ?? thought.category,
                rewardEligible: updates.rewardEligible ?? thought.rewardEligible,
                updatedAt: updatedAt.toISOString(),
              }
            : thought,
        ),
      });
    },

    async listFocusSessions() {
      return [...readBrowserState(storage, key).focusSessions].sort(compareByStartedAtDesc);
    },

    async createFocusSession(session) {
      const state = readBrowserState(storage, key);
      writeBrowserState(storage, key, {
        ...state,
        focusSessions: [
          session,
          ...state.focusSessions.filter((current) => current.id !== session.id),
        ],
      });
    },

    async updateFocusSession(session) {
      const state = readBrowserState(storage, key);
      writeBrowserState(storage, key, {
        ...state,
        focusSessions: state.focusSessions.map((current) =>
          current.id === session.id ? session : current,
        ),
      });
    },

    async listRewardCredits() {
      return [...readBrowserState(storage, key).rewardCredits].sort(compareByEarnedAtAsc);
    },

    async createRewardCredit(credit) {
      const state = readBrowserState(storage, key);
      writeBrowserState(storage, key, {
        ...state,
        rewardCredits: [
          credit,
          ...state.rewardCredits.filter((current) => current.id !== credit.id),
        ],
      });
    },

    async updateRewardCreditStatus(id, status, updatedAt = new Date()) {
      const state = readBrowserState(storage, key);
      const timestamp = updatedAt.toISOString();
      writeBrowserState(storage, key, {
        ...state,
        rewardCredits: state.rewardCredits.map((credit) =>
          credit.id === id
            ? {
                ...credit,
                status,
                spentAt: status === "spent" ? timestamp : credit.spentAt,
                updatedAt: timestamp,
              }
            : credit,
        ),
      });
    },

    async listRewards() {
      return [...readBrowserState(storage, key).rewards].sort(compareByRevealedAtDesc);
    },

    async createReward(reward) {
      const state = readBrowserState(storage, key);
      writeBrowserState(storage, key, {
        ...state,
        rewards: [reward, ...state.rewards.filter((current) => current.id !== reward.id)],
      });
    },

    async updateRewardStatus(id, status, updatedAt = new Date()) {
      const state = readBrowserState(storage, key);
      writeBrowserState(storage, key, {
        ...state,
        rewards: state.rewards.map((reward) =>
          reward.id === id ? { ...reward, status, updatedAt: updatedAt.toISOString() } : reward,
        ),
      });
    },

    async listFocusDebriefs() {
      return [...readBrowserState(storage, key).focusDebriefs].sort(compareDebriefsByCreatedAtDesc);
    },

    async createFocusDebrief(debrief) {
      const state = readBrowserState(storage, key);
      writeBrowserState(storage, key, {
        ...state,
        focusDebriefs: [
          debrief,
          ...state.focusDebriefs.filter((current) => current.id !== debrief.id),
        ],
      });
    },

    async listTaskItems() {
      return [...readBrowserState(storage, key).taskItems]
        .filter((taskItem) => taskItem.status !== "deleted")
        .sort(compareTaskItemsByCreatedAtDesc);
    },

    async createTaskItem(taskItem) {
      const state = readBrowserState(storage, key);
      writeBrowserState(storage, key, {
        ...state,
        taskItems: [
          taskItem,
          ...state.taskItems.filter((current) => current.id !== taskItem.id),
        ],
      });
    },

    async updateTaskItemStatus(id, status, updatedAt = new Date()) {
      const state = readBrowserState(storage, key);
      writeBrowserState(storage, key, {
        ...state,
        taskItems: state.taskItems.map((taskItem) =>
          taskItem.id === id
            ? { ...taskItem, status, updatedAt: updatedAt.toISOString() }
            : taskItem,
        ),
      });
    },

    async getSettings() {
      return readBrowserState(storage, key).settings ?? createDefaultSettings();
    },

    async updateSettings(settings) {
      const state = readBrowserState(storage, key);
      writeBrowserState(storage, key, {
        ...state,
        settings: normalizeSettings(settings),
      });
    },

    async clearAllData() {
      storage.removeItem(key);
    },
  };
}

function readBrowserState(storage: Storage, key: string): BrowserRepositoryState {
  const emptyState: BrowserRepositoryState = {
    thoughts: [],
    focusSessions: [],
    rewardCredits: [],
    rewards: [],
    focusDebriefs: [],
    taskItems: [],
    settings: undefined,
  };
  const raw = storage.getItem(key);

  if (!raw) {
    return emptyState;
  }

  try {
    const parsed = JSON.parse(raw) as Partial<BrowserRepositoryState>;
    return {
      thoughts: Array.isArray(parsed.thoughts) ? parsed.thoughts.map(normalizeThought) : [],
      focusSessions: Array.isArray(parsed.focusSessions)
        ? parsed.focusSessions.map(normalizeFocusSession)
        : [],
      rewardCredits: Array.isArray(parsed.rewardCredits)
        ? parsed.rewardCredits.map(normalizeRewardCredit)
        : [],
      rewards: Array.isArray(parsed.rewards) ? parsed.rewards.map(normalizeReward) : [],
      focusDebriefs: Array.isArray(parsed.focusDebriefs)
        ? parsed.focusDebriefs.map(normalizeFocusDebrief)
        : [],
      taskItems: Array.isArray(parsed.taskItems)
        ? parsed.taskItems.map(normalizeTaskItem)
        : [],
      settings: parsed.settings ? normalizeSettings(parsed.settings) : undefined,
    };
  } catch {
    return emptyState;
  }
}

function writeBrowserState(storage: Storage, key: string, state: BrowserRepositoryState) {
  storage.setItem(key, JSON.stringify(state));
}

function mapThoughtRow(row: ThoughtRow): Thought {
  return normalizeThought({
    id: row.id,
    rawText: row.raw_text,
    title: row.title ?? row.raw_text,
    category: row.category,
    rewardEligible: Boolean(row.reward_eligible),
    confidence: row.confidence ?? 0,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function mapFocusSessionRow(row: FocusSessionRow): FocusSession {
  return normalizeFocusSession({
    id: row.id,
    plannedMinutes: row.planned_minutes,
    startedAt: row.started_at,
    endedAt: row.ended_at ?? undefined,
    pausedAt: row.paused_at ?? undefined,
    pausedSeconds: row.paused_seconds ?? 0,
    updatedAt: row.updated_at,
    status: row.status,
  });
}

function mapRewardRow(row: RewardRow): Reward {
  return normalizeReward({
    id: row.id,
    creditId: row.credit_id ?? undefined,
    thoughtId: row.thought_id,
    sessionId: row.session_id,
    revealedAt: row.revealed_at,
    updatedAt: row.updated_at,
    status: row.status,
  });
}

function mapRewardCreditRow(row: RewardCreditRow): RewardCredit {
  return normalizeRewardCredit({
    id: row.id,
    sourceSessionId: row.source_session_id ?? undefined,
    earnedAt: row.earned_at,
    spentAt: row.spent_at ?? undefined,
    updatedAt: row.updated_at,
    status: row.status,
  });
}

function mapFocusDebriefRow(row: FocusDebriefRow): FocusDebrief {
  return normalizeFocusDebrief({
    id: row.id,
    sessionId: row.session_id,
    summary: row.summary,
    pattern: row.pattern,
    nextIntention: row.next_intention,
    rewardSuggestion: row.reward_suggestion,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function mapTaskItemRow(row: TaskItemRow): TaskItem {
  return normalizeTaskItem({
    id: row.id,
    sessionId: row.session_id,
    sourceThoughtId: row.source_thought_id,
    title: row.title,
    nextAction: row.next_action,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  });
}

function mapSettingsRow(row: AppSettingsRow): AppSettings {
  return normalizeSettings({
    defaultFocusMinutes: row.default_focus_minutes,
    localOnly: Boolean(row.local_only),
    apiKey: row.api_key ?? "",
    focusCompanionMode: row.focus_companion_mode ?? createDefaultSettings().focusCompanionMode,
    characterEnabled: Boolean(row.character_enabled),
    shortcut: row.shortcut ?? createDefaultSettings().shortcut,
    updatedAt: row.updated_at,
  });
}

function normalizeThought(value: UnknownThought): Thought {
  const now = new Date(0).toISOString();
  const rawText = typeof value.rawText === "string" ? value.rawText : "";

  return {
    id: typeof value.id === "string" ? value.id : crypto.randomUUID(),
    rawText,
    title: typeof value.title === "string" && value.title.length > 0 ? value.title : rawText,
    category: normalizeEnum(value.category, THOUGHT_CATEGORIES, "other"),
    rewardEligible: Boolean(value.rewardEligible),
    confidence: typeof value.confidence === "number" ? value.confidence : 0,
    status: normalizeEnum(value.status, THOUGHT_STATUSES, "captured"),
    createdAt: typeof value.createdAt === "string" ? value.createdAt : now,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : now,
  };
}

function normalizeFocusSession(value: UnknownFocusSession): FocusSession {
  const now = new Date(0).toISOString();
  const startedAt = typeof value.startedAt === "string" ? value.startedAt : now;

  return {
    id: typeof value.id === "string" ? value.id : crypto.randomUUID(),
    plannedMinutes: typeof value.plannedMinutes === "number" ? value.plannedMinutes : 60,
    startedAt,
    endedAt: typeof value.endedAt === "string" ? value.endedAt : undefined,
    pausedAt: typeof value.pausedAt === "string" ? value.pausedAt : undefined,
    pausedSeconds: typeof value.pausedSeconds === "number" ? value.pausedSeconds : 0,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : startedAt,
    status: normalizeEnum(value.status, FOCUS_SESSION_STATUSES, "cancelled"),
  };
}

function normalizeReward(value: UnknownReward): Reward {
  const now = new Date(0).toISOString();
  const revealedAt = typeof value.revealedAt === "string" ? value.revealedAt : now;

  return {
    id: typeof value.id === "string" ? value.id : crypto.randomUUID(),
    creditId: typeof value.creditId === "string" ? value.creditId : undefined,
    thoughtId: typeof value.thoughtId === "string" ? value.thoughtId : "",
    sessionId: typeof value.sessionId === "string" ? value.sessionId : "",
    revealedAt,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : revealedAt,
    status: normalizeEnum(value.status, REWARD_STATUSES, "revealed"),
  };
}

function normalizeRewardCredit(value: UnknownRewardCredit): RewardCredit {
  const now = new Date(0).toISOString();
  const earnedAt = typeof value.earnedAt === "string" ? value.earnedAt : now;

  return {
    id: typeof value.id === "string" ? value.id : crypto.randomUUID(),
    sourceSessionId: typeof value.sourceSessionId === "string" ? value.sourceSessionId : undefined,
    earnedAt,
    spentAt: typeof value.spentAt === "string" ? value.spentAt : undefined,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : earnedAt,
    status: normalizeEnum(value.status, REWARD_CREDIT_STATUSES, "available"),
  };
}

function normalizeFocusDebrief(value: UnknownFocusDebrief): FocusDebrief {
  const now = new Date(0).toISOString();
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : now;

  return {
    id: typeof value.id === "string" ? value.id : crypto.randomUUID(),
    sessionId: typeof value.sessionId === "string" ? value.sessionId : "",
    summary: typeof value.summary === "string" ? value.summary : "",
    pattern: typeof value.pattern === "string" ? value.pattern : "",
    nextIntention: typeof value.nextIntention === "string" ? value.nextIntention : "",
    rewardSuggestion: typeof value.rewardSuggestion === "string" ? value.rewardSuggestion : "",
    createdAt,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : createdAt,
  };
}

function normalizeTaskItem(value: UnknownTaskItem): TaskItem {
  const now = new Date(0).toISOString();
  const createdAt = typeof value.createdAt === "string" ? value.createdAt : now;

  return {
    id: typeof value.id === "string" ? value.id : crypto.randomUUID(),
    sessionId: typeof value.sessionId === "string" ? value.sessionId : "",
    sourceThoughtId: typeof value.sourceThoughtId === "string" ? value.sourceThoughtId : "",
    title: typeof value.title === "string" ? value.title : "",
    nextAction: typeof value.nextAction === "string" ? value.nextAction : "",
    status: normalizeEnum(value.status, TASK_ITEM_STATUSES, "open"),
    createdAt,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : createdAt,
  };
}

function normalizeSettings(value: UnknownAppSettings): AppSettings {
  const fallback = createDefaultSettings();
  const defaultFocusMinutes =
    typeof value.defaultFocusMinutes === "number" && Number.isFinite(value.defaultFocusMinutes)
      ? Math.min(240, Math.max(1, Math.round(value.defaultFocusMinutes)))
      : fallback.defaultFocusMinutes;

  return {
    defaultFocusMinutes,
    localOnly: typeof value.localOnly === "boolean" ? value.localOnly : fallback.localOnly,
    apiKey: typeof value.apiKey === "string" ? value.apiKey : fallback.apiKey,
    focusCompanionMode: normalizeEnum(
      value.focusCompanionMode,
      FOCUS_COMPANION_MODES,
      fallback.focusCompanionMode,
    ),
    characterEnabled:
      typeof value.characterEnabled === "boolean"
        ? value.characterEnabled
        : fallback.characterEnabled,
    shortcut: typeof value.shortcut === "string" ? value.shortcut : fallback.shortcut,
    updatedAt: typeof value.updatedAt === "string" ? value.updatedAt : fallback.updatedAt,
  };
}

function normalizeEnum<TValue extends string>(
  value: unknown,
  allowed: readonly TValue[],
  fallback: TValue,
): TValue {
  return typeof value === "string" && allowed.includes(value as TValue)
    ? (value as TValue)
    : fallback;
}

function compareByStartedAtDesc(left: FocusSession, right: FocusSession) {
  return new Date(right.startedAt).getTime() - new Date(left.startedAt).getTime();
}

function compareByRevealedAtDesc(left: Reward, right: Reward) {
  return new Date(right.revealedAt).getTime() - new Date(left.revealedAt).getTime();
}

function compareByEarnedAtAsc(left: RewardCredit, right: RewardCredit) {
  return new Date(left.earnedAt).getTime() - new Date(right.earnedAt).getTime();
}

function compareDebriefsByCreatedAtDesc(left: FocusDebrief, right: FocusDebrief) {
  return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
}

function compareTaskItemsByCreatedAtDesc(left: TaskItem, right: TaskItem) {
  return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
}

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}
