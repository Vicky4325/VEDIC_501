const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const pool = require("./database");
const app = express();
require('dotenv').config();

app.use(express.urlencoded({ extended: true }));
app.use(express.static("public"));
app.use(
  session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
  })
);

app.set("view engine", "ejs");

function isAuthenticated(req, res, next) {
  if (req.session.user) {
    next();
  } else {
    res.redirect("/login");
  }
}

function preventJoiningPastSessions(req, res, next) {
  const { session_id } = req.body;
  pool.query(
    "SELECT * FROM sessions WHERE id = $1",
    [session_id],
    (err, result) => {
      if (err) {
        return res.redirect("/player-dashboard");
      }
      const session = result.rows[0];
      if (new Date(session.date) < new Date()) {
        return res.redirect("/player-dashboard");
      }
      next();
    }
  );
}

app.get("/", (req, res) => {
  res.render("home");
});

app.get("/login", (req, res) => {
  res.render("login");
});

app.post("/login", async (req, res) => {
  const { email, password } = req.body;
  const user = await pool.query("SELECT * FROM users WHERE email = $1", [email]);

  if (user.rows.length > 0) {
    const match = await bcrypt.compare(password, user.rows[0].password);
    if (match) {
      req.session.user = user.rows[0];
      return res.redirect(
        user.rows[0].role === "admin" ? "/admin-dashboard" : "/player-dashboard"
      );
    }
  }

  res.redirect("/login?error=Invalid+email+or+password");
});

app.get("/register", (req, res) => {
  res.render("register");
});

app.post("/register", async (req, res) => {
  const { name, email, password, role } = req.body;
  const hashedPassword = await bcrypt.hash(password, 10);
  await pool.query(
    "INSERT INTO users (name, email, password, role) VALUES ($1, $2, $3, $4)",
    [name, email, hashedPassword, role]
  );
  res.redirect("/login");
});

app.get("/admin-dashboard", isAuthenticated, async (req, res) => {
  const sports = await pool.query("SELECT * FROM sports");
  const sessions = await pool.query(`
    SELECT sessions.*, sports.name AS sport_name, users.name AS creator_name
    FROM sessions
    JOIN sports ON sessions.sport_id = sports.id
    JOIN users ON sessions.creator_id = users.id
    WHERE sessions.cancelled = FALSE
  `);

  const sessionsWithPlayers = await Promise.all(
    sessions.rows.map(async (session) => {
      const players = await pool.query(
        `
      SELECT users.name, users.id
      FROM session_players 
      JOIN users ON session_players.player_id = users.id 
      WHERE session_players.session_id = $1
    `,
        [session.id]
      );
      return { ...session, players: players.rows };
    })
  );

  const cancelledSessions = await pool.query(`
    SELECT sessions.*, sports.name AS sport_name, users.name AS creator_name
    FROM sessions
    JOIN sports ON sessions.sport_id = sports.id
    JOIN users ON sessions.creator_id = users.id
    WHERE sessions.cancelled = TRUE
  `);

  res.render("admin", {
    user: req.session.user,
    sports: sports.rows,
    sessions: sessionsWithPlayers,
    cancelledSessions: cancelledSessions.rows,
  });
});


  app.post("/create-sport", isAuthenticated, async (req, res) => {
    const { name } = req.body;
    try {
      await pool.query("INSERT INTO sports (name) VALUES ($1)", [name]);
      res.redirect(req.session.user.role === "admin" ? "/admin-dashboard" : "/player-dashboard");
    } catch (error) {
      console.error("Error adding sport:", error);
      res.redirect(req.session.user.role === "admin" ? "/admin-dashboard?error=Failed+to+add+sport" : "/player-dashboard?error=Failed+to+add+sport");
    }
  });
  
  app.get("/logout", (req, res) => {
    req.session.destroy();
    res.redirect("/");
  });
  
  app.post("/delete-session", isAuthenticated, async (req, res) => {
    try {
      const { session_id } = req.body;
      await pool.query("DELETE FROM sessions WHERE id = $1", [session_id]);
      res.redirect("/admin-dashboard");
    } catch (error) {
      console.error(error);
      res.status(500).send("Error deleting session");
    }
  });
  

  app.get("/player-dashboard", isAuthenticated, async (req, res) => {
    try {
      const sports = await pool.query("SELECT * FROM sports");
  
      const sessions = await pool.query(`
        SELECT sessions.*, sports.name AS sport_name, users.name AS creator_name
        FROM sessions
        JOIN sports ON sessions.sport_id = sports.id
        JOIN users ON sessions.creator_id = users.id
        WHERE sessions.cancelled = FALSE
      `);
  
      const joinedSessions = await pool.query(`
        SELECT sessions.*, sports.name AS sport_name
        FROM sessions
        JOIN sports ON sessions.sport_id = sports.id
        JOIN session_players ON sessions.id = session_players.session_id
        WHERE session_players.player_id = $1 AND sessions.cancelled = FALSE
      `, [req.session.user.id]);
  
      const sessionsWithPlayers = await Promise.all(
        sessions.rows.map(async (session) => {
          const players = await pool.query(
            `
          SELECT users.name, users.id 
          FROM session_players 
          JOIN users ON session_players.player_id = users.id 
          WHERE session_players.session_id = $1
        `,
            [session.id]
          );
          return { ...session, players: players.rows };
        })
      );
  
      const joinedSessionsWithPlayers = await Promise.all(
        joinedSessions.rows.map(async (session) => {
          const players = await pool.query(
            `
          SELECT users.name, users.id 
          FROM session_players 
          JOIN users ON session_players.player_id = users.id 
          WHERE session_players.session_id = $1
        `,
            [session.id]
          );
          return { ...session, players: players.rows };
        })
      );
  
      res.render("player", {
        user: req.session.user,
        sports: sports.rows,
        sessions: sessionsWithPlayers,
        joinedSessions: joinedSessionsWithPlayers,
      });
    } catch (error) {
      console.error("Error loading player dashboard:", error);
      res.status(500).send("An error occurred while loading the player dashboard.");
    }
  });
  
  app.post("/create-session", isAuthenticated, async (req, res) => {
    const { sport_id, team1, team2, additional_players, date, venue } = req.body;
  
    try {
      await pool.query(
        "INSERT INTO sessions (sport_id, creator_id, team1, team2, additional_players, date, venue) VALUES ($1, $2, $3, $4, $5, $6, $7)",
        [sport_id, req.session.user.id, team1, team2, additional_players, date, venue]
      );
  
      res.redirect(
        req.session.user.role === "admin" ? "/admin-dashboard" : "/player-dashboard"
      );
    } catch (error) {
      console.error("Error creating session:", error);
      res.redirect(
        req.session.user.role === "admin" ? "/admin-dashboard?error=Failed+to+create+session" : "/player-dashboard?error=Failed+to+create+session"
      );
    }
  });
  
  app.post("/join-session", isAuthenticated, preventJoiningPastSessions, async (req, res) => {
    const { session_id } = req.body;
    const user_id = req.session.user.id;
  
    const existing = await pool.query(
      "SELECT * FROM session_players WHERE session_id = $1 AND player_id = $2",
      [session_id, user_id]
    );
  
    if (existing.rows.length > 0) {
      return res.redirect(
        req.session.user.role === "admin" ? "/admin-dashboard" : "/player-dashboard"
      );
    }
  
    await pool.query(
      "INSERT INTO session_players (session_id, player_id) VALUES ($1, $2)",
      [session_id, user_id]
    );
  
    await pool.query(
      "UPDATE sessions SET player_count = player_count + 1 WHERE id = $1",
      [session_id]
    );
  
    res.redirect(
      req.session.user.role === "admin" ? "/admin-dashboard" : "/player-dashboard"
    );
  });
  
  app.post("/cancel-session", isAuthenticated, async (req, res) => {
    const { session_id, reason } = req.body;
    const user_id = req.session.user.id;

    console.log("Cancel session request received:", { session_id, reason, user_id });
  
    // Verify if the session was created by the logged-in user
    const session = await pool.query(
      "SELECT * FROM sessions WHERE id = $1 AND creator_id = $2",
      [session_id, user_id]
    );
  
    if (session.rows.length > 0) {
      await pool.query(
        "UPDATE sessions SET cancelled = TRUE, cancellation_reason = $1 WHERE id = $2",
        [reason, session_id]
      );
      console.log("Session cancelled successfully:", session_id);
    } else {
      console.log("Unauthorized cancellation attempt by user:", user_id);
      return res.redirect("/player-dashboard?error=Unauthorized");
    }

    // Redirect to the appropriate dashboard
    res.redirect(
      req.session.user.role === "admin" ? "/admin-dashboard" : "/player-dashboard"
    );
});


  
  app.get("/change-password", isAuthenticated, (req, res) => {
    const error = req.query.error;
    const success = req.query.success;
    res.render("change-password", { error, success });
  });
  
  app.post("/change-password", isAuthenticated, async (req, res) => {
    const { currentPassword, newPassword } = req.body;
  
    console.log("currentPassword:", currentPassword);
    console.log("newPassword:", newPassword);
  
    const userResult = await pool.query("SELECT * FROM users WHERE id = $1", [req.session.user.id]);
  
    if (userResult.rows.length === 0) {
      console.log("User not found");
      return res.redirect("/change-password?error=User+not+found");
    }
  
    const user = userResult.rows[0];
    console.log("Fetched user:", user);
  
    if (!user.password) {
      console.log("User password is undefined");
      return res.redirect("/change-password?error=User+password+undefined");
    }
  
    const match = await bcrypt.compare(currentPassword, user.password);
  
    console.log("Password match:", match);
  
    if (!match) {
      return res.redirect("/change-password?error=Incorrect+current+password");
    }
  
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    await pool.query("UPDATE users SET password = $1 WHERE id = $2", [
      hashedPassword,
      req.session.user.id,
    ]);
    console.log("Password updated successfully");
  
    req.session.destroy((err) => {
      if (err) {
        console.log("Error destroying session:", err);
        return res.redirect("/change-password?error=Failed+to+destroy+session");
      }
      res.redirect("/");
    });
  });
  
  
  
  app.get("/reports", isAuthenticated, async (req, res) => {
    try {
      const { startDate, endDate } = req.query;
  
      console.log("Received dates:", { startDate, endDate });
  
      const sessionsQuery = `
        SELECT sessions.*, sports.name AS sport_name
        FROM sessions
        JOIN sports ON sessions.sport_id = sports.id
        WHERE sessions.cancelled = FALSE AND sessions.date >= $1 AND sessions.date <= $2
      `;
      const sessionsResult = await pool.query(sessionsQuery, [startDate, endDate]);
      const sessions = sessionsResult.rows;
  
      console.log("Sessions fetched:", sessions);
  
      const sessionsWithPlayers = await Promise.all(
        sessions.map(async (session) => {
          const playersResult = await pool.query(
            `
            SELECT users.name
            FROM session_players 
            JOIN users ON session_players.player_id = users.id 
            WHERE session_players.session_id = $1
            `,
            [session.id]
          );
          return { ...session, players: playersResult.rows };
        })
      );
  
      const popularityQuery = `
        SELECT sports.name, COUNT(sessions.id) AS count
        FROM sessions
        JOIN sports ON sessions.sport_id = sports.id
        WHERE sessions.cancelled = FALSE AND sessions.date >= $1 AND sessions.date <= $2
        GROUP BY sports.name
      `;
      const popularityResult = await pool.query(popularityQuery, [startDate, endDate]);
  
      console.log("Popularity fetched:", popularityResult.rows);
  
      res.render("reports", {
        sessions: sessionsWithPlayers,
        popularity: popularityResult.rows,
      });
    } catch (error) {
      console.error("Error generating reports:", error);
      res.status(500).send("An error occurred while generating the report.");
    }
  });
  
  
  
  
  // Starting the server
  app.listen(3000, () => {
    console.log("Server is running on http://localhost:3000");
  });
  
