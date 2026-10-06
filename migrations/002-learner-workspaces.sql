CREATE TABLE IF NOT EXISTS learner_workspaces (
  user_id TEXT PRIMARY KEY,
  revision BIGINT NOT NULL CHECK (revision >= 0),
  state JSONB NOT NULL
);
