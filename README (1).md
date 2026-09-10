# 🩸 LifeDrop — Blood Bank Management System

LifeDrop is a web application that connects **donors**, **patients**, and **hospitals/admins** on a single platform to make blood donation and requests faster and more visible. It includes a live map of blood locations, role-based dashboards, and a simple inventory/request workflow.

## Features

- **Role-based portals** — separate dashboards for Donor, Patient, and Admin
- **Live Map** — interactive Leaflet.js map showing donors, patients, and hospitals by location
- **Blood requests** — patients can raise requests; admins can accept/reject them
- **Inventory tracking** — admin view of blood units available by blood group
- **Donor records** — searchable list of registered donors
- **Location search & nearest-match** — find the nearest donor/hospital for a given blood group using the Haversine formula
- **Add / edit / delete** blood location records via a REST API

## Tech Stack

| Layer      | Technology                                              |
|------------|----------------------------------------------------------|
| Frontend   | HTML, Tailwind CSS (CDN), vanilla JavaScript, Leaflet.js, Font Awesome |
| Backend    | Node.js, Express                                          |
| Database   | MySQL (via `mysql2`)                                      |

## Project Structure

```
lifedrop---blood-bank-management/
├── public/
│   ├── index.html        # Single-page app shell (all screens/dashboards)
│   ├── app.js             # Frontend logic: routing, auth, map, dashboards
│   ├── style.css          # Custom styles (on top of Tailwind)
│   └── database.sql       # MySQL schema + sample seed data
├── server.js               # Express server & REST API
├── package.json
└── .gitignore
```

## Prerequisites

- [Node.js](https://nodejs.org/) v16+
- [MySQL](https://dev.mysql.com/downloads/) (local install or a hosted instance)

## Setup & Installation

### 1. Clone the repository

```bash
git clone https://github.com/<your-username>/lifedrop---blood-bank-management.git
cd lifedrop---blood-bank-management
```

### 2. Install dependencies

```bash
npm install
```

### 3. Create the database

Import the provided schema (creates the `lifedrop` database, the `blood_locations` table, and some sample rows):

```bash
mysql -u root -p < public/database.sql
```

### 4. Configure environment variables

The server reads DB credentials from environment variables (with fallback defaults for local dev). Create a `.env` file **or** export them in your shell:

```
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=your_mysql_password
DB_NAME=lifedrop
DB_PORT=3306
PORT=5000
```

> ⚠️ `server.js` currently reads `process.env.*` but does not load `.env` automatically. If you add a `.env` file, install `dotenv` and add `require("dotenv").config();` at the top of `server.js` — or just export the variables in your terminal session before running `npm start`.

### 5. Run the server

```bash
npm start
```

The app will be available at **http://localhost:5000**.

## API Endpoints

All endpoints are prefixed with `/api/locations`.

| Method | Endpoint                     | Description                              |
|--------|-------------------------------|-------------------------------------------|
| GET    | `/api/locations`              | List all donor/patient/hospital records   |
| POST   | `/api/locations`               | Create a new record                       |
| PUT    | `/api/locations/:id`           | Update an existing record                 |
| PATCH  | `/api/locations/:id/status`    | Update status only (`pending`/`accepted`/`rejected`) |
| DELETE | `/api/locations/:id`           | Delete a record                           |

## Known Limitations / Notes

- **Authentication is client-side only.** User accounts (`app.js`) are currently stored in the browser's `localStorage`, not the database. There is no backend `/api/auth` endpoint yet — this is the first thing to fix before any real deployment.
- No password hashing or session management exists yet, since auth isn't backend-based.
- `lat`/`lng` for new records must currently be supplied by the client (e.g., via the search/geocoding helper in the UI).

## Suggested Next Steps (Roadmap)

1. **Move authentication to the backend** — add a `users` table, hash passwords (bcrypt), and issue sessions/JWTs instead of using `localStorage`.
2. **Add input validation** on the API (e.g., with `zod` or `express-validator`) — currently requests are inserted with minimal checks.
3. **Environment config via `dotenv`** and a `.env.example` file for easier onboarding.
4. **Pagination/filtering** on `GET /api/locations` for larger datasets.
5. **Deploy** — e.g., backend on Render/Railway with a managed MySQL instance (PlanetScale, Railway MySQL, etc.), frontend served statically by Express as it is now.

## License

Add a license of your choice (e.g., MIT) here.
