CREATE TABLE IF NOT EXISTS attempts (
  user_id TEXT NOT NULL,
  attempt_id TEXT NOT NULL,
  question_id TEXT NOT NULL,
  selected_answer TEXT NOT NULL,
  correct BOOLEAN NOT NULL,
  answered_at TIMESTAMPTZ NOT NULL,
  PRIMARY KEY (user_id, attempt_id)
);

CREATE INDEX IF NOT EXISTS attempts_by_user_and_time
  ON attempts (user_id, answered_at, attempt_id);
