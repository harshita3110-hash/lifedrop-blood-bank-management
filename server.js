const express = require("express");
const cors = require("cors");
const mysql = require("mysql2");
const path = require("path");

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// MySQL connection
const db = mysql.createConnection({
  host: process.env.DB_HOST || "localhost",
  user: process.env.DB_USER || "root",
  password: process.env.DB_PASSWORD || "root123",
  database: process.env.DB_NAME || "lifedrop",
  port: Number(process.env.DB_PORT) || 3306,

  // Aiven requires SSL
  ssl: process.env.DB_HOST
    ? {
        rejectUnauthorized: false
      }
    : undefined
});

db.connect(err => {
  if (err) {
    console.log("❌ MySQL Error:", err.message);
    return;
  }

  console.log("✅ MySQL Connected");
});

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/api/locations", (req, res) => {
  db.query(
    "SELECT * FROM blood_locations ORDER BY id DESC",
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      res.json(rows);
    }
  );
});

app.post("/api/locations", (req, res) => {
  const d = req.body;

  const sql = `
    INSERT INTO blood_locations
    (name, type, blood_group, city, state, lat, lng, contact, email, units, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;

  db.query(
    sql,
    [
      d.name,
      d.type,
      d.blood_group,
      d.city,
      d.state,
      d.lat,
      d.lng,
      d.contact || "",
      d.email || "",
      d.units || 1,
      d.status || "pending"
    ],
    err => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      res.json({ message: "Saved successfully" });
    }
  );
});

app.put("/api/locations/:id", (req, res) => {
  const d = req.body;

  const sql = `
    UPDATE blood_locations
    SET name=?, type=?, blood_group=?, city=?, state=?, lat=?, lng=?, contact=?, email=?, units=?, status=?
    WHERE id=?
  `;

  db.query(
    sql,
    [
      d.name,
      d.type,
      d.blood_group,
      d.city,
      d.state,
      d.lat,
      d.lng,
      d.contact || "",
      d.email || "",
      d.units || 1,
      d.status || "pending",
      req.params.id
    ],
    err => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      res.json({ message: "Updated successfully" });
    }
  );
});

app.delete("/api/locations/:id", (req, res) => {
  db.query(
    "DELETE FROM blood_locations WHERE id = ?",
    [req.params.id],
    (err, result) => {
      if (err) {
        return res.status(500).json({ error: err.message });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({
          error: "Record not found"
        });
      }

      res.json({
        message: "Deleted successfully"
      });
    }
  );
});

app.patch("/api/locations/:id/status", (req, res) => {
  const { status } = req.body;
  const { id } = req.params;

  if (!["pending", "accepted", "rejected"].includes(status)) {
    return res.status(400).json({
      error: "Invalid status"
    });
  }

  db.query(
    "UPDATE blood_locations SET status = ? WHERE id = ?",
    [status, id],
    (err, result) => {
      if (err) {
        console.log("❌ Status update error:", err.message);

        return res.status(500).json({
          error: err.message
        });
      }

      if (result.affectedRows === 0) {
        return res.status(404).json({
          error: "Record not found"
        });
      }

      res.json({
        message: `Request marked as ${status}`
      });
    }
  );
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
