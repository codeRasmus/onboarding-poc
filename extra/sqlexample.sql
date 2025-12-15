CREATE TABLE IF NOT EXISTS journey_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  journey_id INTEGER NOT NULL,
  title TEXT NOT NULL,
  event_type TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  FOREIGN KEY (journey_id) REFERENCES journeys(id)
);

CREATE TABLE IF NOT EXISTS task_progress (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  journey_id INTEGER NOT NULL,
  task_id INTEGER NOT NULL,
  completed_at TEXT NOT NULL,
  metadata TEXT,
  UNIQUE (user_id, journey_id, task_id),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (journey_id) REFERENCES journeys(id),
  FOREIGN KEY (task_id) REFERENCES journey_tasks(id)
)