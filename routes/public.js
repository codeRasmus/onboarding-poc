// routes/public.js
const express = require("express");
const db = require("../db");
const router = express.Router();

// Promise wrappers abstraktion
function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
    });
  });
}

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

function dbRun(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.run(sql, params, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}

// Hent aktivt journey for bruger
async function getActiveJourneyForUser(userId) {
  return await dbGet(
    `
      SELECT j.id, j.name, j.description
      FROM journeys j
      JOIN user_journeys uj ON uj.journey_id = j.id
      WHERE uj.user_id = ?
      LIMIT 1;
    `,
    [userId]
  );
}

// Hent tasks med completed-status for bruger
async function getTasksWithProgress(userId, journeyId) {
  return await dbAll(
    `
      SELECT 
        t.id,
        t.title,
        t.event_type,
        t.sort_order,
        CASE 
          WHEN tp.id IS NULL THEN 0 
          ELSE 1 
        END AS completed
      FROM journey_tasks t
      LEFT JOIN task_progress tp 
        ON tp.task_id = t.id
       AND tp.user_id = ?
       AND tp.journey_id = ?
      WHERE t.journey_id = ?
      ORDER BY t.sort_order ASC;
    `,
    [userId, journeyId, journeyId]
  );
}

// Beregn progression ud fra listen af tasks
function calculateProgress(tasks) {
  const total = tasks.length;
  const completed = tasks.filter((t) => t.completed).length;
  const percentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  return {
    completed,
    total,
    percentage,
    isCompleted: completed === total && total > 0,
  };
}

// GET /api/journey
router.get("/journey", async (req, res) => {
  const userId = parseInt(req.query.userId || "1", 10);

  try {
    const journey = await getActiveJourneyForUser(userId);
    if (!journey) {
      return res
        .status(404)
        .json({ message: "Ingen aktiv onboarding for bruger." });
    }

    const tasks = await getTasksWithProgress(userId, journey.id);
    const progress = calculateProgress(tasks);

    res.json({
      userId,
      journey,
      tasks,
      progress,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Fejl ved hentning af journey." });
  }
});

// GET /api/users
router.get("/users", (req, res) => {
  db.all(
    `
      SELECT id, name 
      FROM users 
      WHERE is_admin = 0
      ORDER BY id ASC;
    `,
    [],
    (err, rows) => {
      if (err) {
        console.error(err);
        return res
          .status(500)
          .json({ message: "Fejl ved hentning af brugere." });
      }
      res.json({ users: rows });
    }
  );
});

// POST /api/events
router.post("/events", async (req, res) => {
  const { eventType, userId, metadata } = req.body;
  const numericUserId = parseInt(userId || "1", 10);

  if (!eventType) {
    return res.status(400).json({ message: "eventType er påkrævet." });
  }

  try {
    const journey = await getActiveJourneyForUser(numericUserId);
    if (!journey) {
      return res
        .status(200)
        .json({ message: "Ingen aktiv onboarding. Event ignoreret." });
    }

    const matchingTask = await dbGet(
      `
        SELECT * FROM journey_tasks
        WHERE journey_id = ? AND event_type = ?
        LIMIT 1;
      `,
      [journey.id, eventType]
    );

    if (!matchingTask) {
      return res
        .status(200)
        .json({ message: "Event ikke del af onboarding. Ignoreret." });
    }

    await dbRun(
      `
        INSERT OR IGNORE INTO task_progress 
          (user_id, journey_id, task_id, completed_at, metadata)
        VALUES (?, ?, ?, datetime('now'), ?);
      `,
      [
        numericUserId,
        journey.id,
        matchingTask.id,
        JSON.stringify(metadata || {}),
      ]
    );

    const tasks = await getTasksWithProgress(numericUserId, journey.id);
    const progress = calculateProgress(tasks);

    res.json({
      message: progress.isCompleted
        ? "Onboarding gennemført – du har nu afsluttet alle trin."
        : `Onboarding opdateret: ${progress.completed} af ${progress.total} trin gennemført.`,
      journey,
      tasks,
      progress,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Fejl ved håndtering af event." });
  }
});

// POST /api/reset
router.post("/reset", async (req, res) => {
  const userId = parseInt(req.body.userId || "1", 10);

  try {
    const journey = await getActiveJourneyForUser(userId);
    if (!journey) {
      return res
        .status(404)
        .json({ message: "Ingen aktiv onboarding at nulstille." });
    }

    await dbRun(
      `
        DELETE FROM task_progress
        WHERE user_id = ? AND journey_id = ?;
      `,
      [userId, journey.id]
    );

    res.json({ message: "Onboarding er nulstillet." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Fejl ved reset." });
  }
});

module.exports = router;
