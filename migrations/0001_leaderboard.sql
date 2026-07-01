CREATE TABLE IF NOT EXISTS clients (
  client_id TEXT PRIMARY KEY,
  nickname TEXT NOT NULL,
  country TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL,
  ip_hash TEXT,
  ua_hash TEXT,
  risk_score INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS timer_sessions (
  session_id TEXT PRIMARY KEY,
  client_id TEXT NOT NULL,
  mode TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  min_complete_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  completed_at INTEGER,
  ip_hash TEXT,
  ua_hash TEXT,
  country TEXT,
  status TEXT NOT NULL DEFAULT 'open'
);

CREATE TABLE IF NOT EXISTS daily_scores (
  date TEXT NOT NULL,
  client_id TEXT NOT NULL,
  nickname TEXT NOT NULL,
  country TEXT NOT NULL,
  count INTEGER NOT NULL DEFAULT 0,
  first_completed_at INTEGER,
  last_completed_at INTEGER,
  PRIMARY KEY (date, client_id)
);

CREATE TABLE IF NOT EXISTS rejected_events (
  id TEXT PRIMARY KEY,
  session_id TEXT,
  client_id TEXT,
  reason TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  ip_hash TEXT,
  ua_hash TEXT,
  country TEXT
);

CREATE INDEX IF NOT EXISTS idx_daily_scores_rank
  ON daily_scores(date, count DESC, last_completed_at ASC);

CREATE INDEX IF NOT EXISTS idx_timer_sessions_client
  ON timer_sessions(client_id, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_timer_sessions_ip
  ON timer_sessions(ip_hash, started_at DESC);

CREATE INDEX IF NOT EXISTS idx_rejected_events_client
  ON rejected_events(client_id, created_at DESC);
