// server.js
const express = require("express");
const path = require("path");
const db = require("./db");

const publicRoutes = require("./routes/public");
const adminRoutes = require("./routes/admin");

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

// Public er roden, server login.html som index
app.use(
  express.static(path.join(__dirname, "public"), { index: "login.html" })
);

// Statiske filer, HTML/CSS/JS)
app.use(express.static(path.join(__dirname, "public")));

//
// API router
//
app.use("/api", publicRoutes); // /api/journey, /api/events, ...
app.use("/api/admin", adminRoutes); // /api/admin/journeys, /api/admin/users, ...

//
// Pseudo-login router
//
app.post("/login", (req, res) => {
  const { name, password } = req.body;

  if (!name || !password) {
    return res.status(400).send("Navn og adgangskode er påkrævet.");
  }

  db.get(
    `SELECT * FROM users WHERE name = ? AND password = ? LIMIT 1;`,
    [name, password],
    (err, user) => {
      if (err) {
        console.error(err);
        return res.status(500).send("Serverfejl.");
      }

      if (!user) {
        return res.status(401).send("Forkert navn eller adgangskode.");
      }
      // Redirect baseret på admin-flag
      if (user.is_admin === 1) {
        return res.redirect("/admin.html");
      } else {
        return res.redirect("/index.html");
      }
    }
  );
});

app.listen(PORT, () => {
  console.log(`Server kører på http://localhost:${PORT}.`);
  console.log(`Adminlogin: Brugernavn: "admin", password "admin"`);
  console.log(`Brugerlogin: Brugernavn: "Brian", password "password123"`);
});
