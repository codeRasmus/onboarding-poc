// routes/admin.js
const express = require("express");
const db = require("../db");

const router = express.Router();

// Promise wrappers abstraktion

function dbAll(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) return reject(err);
      resolve(rows);
    });
  });
}

// dbGet bruges ikke, da der ikke hentes enkelte rækker
function dbGet(sql, params = []) {
  return new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => {
      if (err) return reject(err);
      resolve(row || null);
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

// Sletter et onboardingforløb (journey) og alt data, der refererer til det.
function deleteJourneyWithRelations(journeyId) {
  return new Promise((resolve, reject) => {
    db.serialize(async () => {
      try {
        await dbRun(`DELETE FROM task_progress WHERE journey_id = ?;`, [
          journeyId,
        ]);
        await dbRun(`DELETE FROM journey_tasks WHERE journey_id = ?;`, [
          journeyId,
        ]);
        await dbRun(`DELETE FROM user_journeys WHERE journey_id = ?;`, [
          journeyId,
        ]);
        await dbRun(`DELETE FROM journeys WHERE id = ?;`, [journeyId]);

        resolve();
      } catch (err) {
        reject(err);
      }
    });
  });
}

// GET /api/admin/journeys
router.get("/journeys", async (req, res) => {
  try {
    const journeys = await dbAll(`SELECT * FROM journeys ORDER BY id ASC;`);
    const tasks = await dbAll(
      `SELECT * FROM journey_tasks ORDER BY journey_id ASC, sort_order ASC;`
    );

    // Samler tasks under deres respektive journey for et simpelt admin-UI payload
    const byJourney = {};
    tasks.forEach((t) => {
      if (!byJourney[t.journey_id]) byJourney[t.journey_id] = [];
      byJourney[t.journey_id].push(t);
    });

    const result = journeys.map((j) => ({
      ...j,
      tasks: byJourney[j.id] || [],
    }));

    res.json({ journeys: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Fejl ved hentning af journeys." });
  }
});

// POST /api/admin/journeys
router.post("/journeys", (req, res) => {
  const { name, description, tasks } = req.body;

  if (!name || !Array.isArray(tasks) || tasks.length === 0) {
    return res.status(400).json({
      message: "Navn og mindst ét trin (task) er påkrævet.",
    });
  }

  db.serialize(() => {
    db.run(
      `
      INSERT INTO journeys (name, description)
      VALUES (?, ?);
      `,
      [name, description || null],
      function (err) {
        if (err) {
          console.error(err);
          return res
            .status(500)
            .json({ message: "Fejl ved oprettelse af journey." });
        }

        const journeyId = this.lastID;

        const stmt = db.prepare(
          `
          INSERT INTO journey_tasks (journey_id, title, event_type, sort_order)
          VALUES (?, ?, ?, ?);
        `
        );

        tasks.forEach((t, index) => {
          const title = t.title?.trim();
          const eventType = t.eventType?.trim();
          if (!title || !eventType) return;
          stmt.run(journeyId, title, eventType, index + 1);
        });

        stmt.finalize((err2) => {
          if (err2) {
            console.error(err2);
            return res
              .status(500)
              .json({ message: "Fejl ved oprettelse af tasks." });
          }

          return res.status(201).json({
            message: "Journey oprettet.",
            journeyId,
          });
        });
      }
    );
  });
});

// DELETE /api/admin/journeys/:id
router.delete("/journeys/:id", async (req, res) => {
  const journeyId = Number(req.params.id);

  if (!journeyId) {
    return res.status(400).json({ message: "Ugyldigt journey-id." });
  }

  try {
    await deleteJourneyWithRelations(journeyId);
    res.json({ message: "Journey er slettet." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Fejl ved sletning af journey." });
  }
});

// POST /api/admin/journeys/reset
router.post("/journeys/reset", (req, res) => {
  db.serialize(async () => {
    try {
      await dbRun(`DELETE FROM task_progress;`);
      await dbRun(`DELETE FROM journey_tasks;`);
      await dbRun(`DELETE FROM user_journeys;`);
      await dbRun(`DELETE FROM journeys;`);

      res.json({ message: "Alle journeys er slettet." });
    } catch (err) {
      console.error(err);
      res.status(500).json({ message: "Fejl ved reset af journeys." });
    }
  });
});

// GET /api/admin/users
router.get("/users", async (req, res) => {
  try {
    const users = await dbAll(
      `SELECT id, name, is_admin
       FROM users
       WHERE is_admin = 0
       ORDER BY id ASC;`
    );
    res.json({ users });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Fejl ved hentning af brugere." });
  }
});

// POST /api/admin/assign-journey
router.post("/assign-journey", async (req, res) => {
  const { userId, journeyId } = req.body;

  if (!userId || !journeyId) {
    return res
      .status(400)
      .json({ message: "userId og journeyId er påkrævet." });
  }

  try {
    await dbRun(
      `
      INSERT OR IGNORE INTO user_journeys (user_id, journey_id)
      VALUES (?, ?);
      `,
      [userId, journeyId]
    );

    res.json({ message: "Journey tildelt til bruger." });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Fejl ved tildeling af journey." });
  }
});

// GET /api/admin/overview
router.get("/overview", async (req, res) => {
  // Tildelt forløb + total tasks + gennemførte tasks pr. bruger
  const sql = `
    SELECT
  -- Identifikation af bruger og journey
  uj.user_id,
  u.name AS user_name,
  uj.journey_id,
  j.name AS journey_name,

  -- Optælling af tasks
  COUNT(DISTINCT jt.id) AS total_tasks,
  COUNT(DISTINCT tp.id) AS completed_tasks

FROM user_journeys uj
-- Hvilke brugere er tildelt hvilke journeys

-- Hent brugernavn
JOIN users u
  ON u.id = uj.user_id

-- Hent journey-navn
JOIN journeys j
  ON j.id = uj.journey_id

-- Hent alle tasks, der hører til journey
JOIN journey_tasks jt
  ON jt.journey_id = j.id

-- Hent progress, hvis den findes for netop denne bruger + task
LEFT JOIN task_progress tp
  ON tp.user_id = uj.user_id
 AND tp.journey_id = uj.journey_id
 AND tp.task_id = jt.id

-- Saml én række pr. bruger pr. journey
GROUP BY
  uj.user_id,
  u.name,
  uj.journey_id,
  j.name

-- Sortering
ORDER BY
  u.name ASC,
  j.name ASC;
  `;

  try {
    const entries = await dbAll(sql);
    res.json({ entries });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Fejl ved hentning af overview." });
  }
});

module.exports = router;
