export const DATABASE_URL = "sqlite:focuspal.db";

export const INITIAL_SCHEMA = `
CREATE TABLE IF NOT EXISTS thoughts (
  id TEXT PRIMARY KEY,
  raw_text TEXT NOT NULL,
  title TEXT,
  category TEXT NOT NULL,
  reward_eligible INTEGER NOT NULL,
  confidence REAL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS focus_sessions (
  id TEXT PRIMARY KEY,
  planned_minutes INTEGER NOT NULL,
  started_at TEXT NOT NULL,
  ended_at TEXT,
  paused_at TEXT,
  paused_seconds INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS reward_credits (
  id TEXT PRIMARY KEY,
  source_session_id TEXT,
  earned_at TEXT NOT NULL,
  spent_at TEXT,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL,
  FOREIGN KEY (source_session_id) REFERENCES focus_sessions(id)
);

CREATE TABLE IF NOT EXISTS rewards (
  id TEXT PRIMARY KEY,
  credit_id TEXT,
  thought_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  revealed_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  status TEXT NOT NULL,
  FOREIGN KEY (credit_id) REFERENCES reward_credits(id),
  FOREIGN KEY (thought_id) REFERENCES thoughts(id),
  FOREIGN KEY (session_id) REFERENCES focus_sessions(id)
);

CREATE TABLE IF NOT EXISTS focus_debriefs (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  summary TEXT NOT NULL,
  pattern TEXT NOT NULL,
  next_intention TEXT NOT NULL,
  reward_suggestion TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES focus_sessions(id)
);

CREATE TABLE IF NOT EXISTS task_items (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  source_thought_id TEXT NOT NULL,
  title TEXT NOT NULL,
  next_action TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES focus_sessions(id),
  FOREIGN KEY (source_thought_id) REFERENCES thoughts(id)
);

CREATE TABLE IF NOT EXISTS app_settings (
  id TEXT PRIMARY KEY,
  default_focus_minutes INTEGER NOT NULL,
  local_only INTEGER NOT NULL,
  api_key TEXT NOT NULL,
  focus_companion_mode TEXT NOT NULL,
  character_enabled INTEGER NOT NULL,
  shortcut TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_thoughts_status_created_at
  ON thoughts(status, created_at);

CREATE INDEX IF NOT EXISTS idx_thoughts_reward_status_created_at
  ON thoughts(reward_eligible, status, created_at);

CREATE INDEX IF NOT EXISTS idx_focus_sessions_status_started_at
  ON focus_sessions(status, started_at);

CREATE INDEX IF NOT EXISTS idx_rewards_status_revealed_at
  ON rewards(status, revealed_at);

CREATE INDEX IF NOT EXISTS idx_reward_credits_status_earned_at
  ON reward_credits(status, earned_at);

CREATE INDEX IF NOT EXISTS idx_focus_debriefs_session_created_at
  ON focus_debriefs(session_id, created_at);

CREATE INDEX IF NOT EXISTS idx_task_items_session_status_created_at
  ON task_items(session_id, status, created_at);
`;

export const INITIAL_SCHEMA_STATEMENTS = INITIAL_SCHEMA.split(";")
  .map((statement) => statement.trim())
  .filter(Boolean)
  .map((statement) => `${statement};`);
