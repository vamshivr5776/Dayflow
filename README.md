# Dayflow — HR Management System

A complete, runnable HRMS: marketing homepage, sign-in/sign-up, and a
role-aware dashboard (employee vs admin/HR), backed by a zero-dependency
Node.js API.

```
dayflow-project/
├── backend/     # REST API — Node.js + built-in SQLite, no npm install needed
└── frontend/    # Static site — plain HTML/CSS/JS, no build step
```

## Run it

**1. Start the backend** (in one terminal):

```bash
cd backend
npm start
# Dayflow API listening on http://localhost:4000
```

First run creates `backend/data/dayflow.db` and seeds an admin account:

```
email:    admin@dayflow.io
password: Admin@123
```

**2. Serve the frontend** (in another terminal) — any static file server works:

```bash
cd frontend
python3 -m http.server 8080
# or: npx serve .
```

Then open `http://localhost:8080/index.html` in your browser.

The frontend talks to the API at `http://localhost:4000` by default
(set in `frontend/js/config.js`). The backend's CORS is open (`*`) by
default, so any port for the static server works. Change `API_BASE` in
`config.js` if you deploy the API elsewhere.

## What's in the frontend

| Page | Purpose |
|---|---|
| `index.html` | Marketing homepage (unchanged from the original design) |
| `auth.html` | Sign in / sign up, with the email-verification step the backend requires |
| `dashboard.html` | The app itself — reshapes based on role |

**Employee view:** today's status + check-in/out, attendance history
(daily/weekly), apply for leave + track status, read-only payroll, and a
self-editable profile (phone, address, photo).

**Admin/HR view:** team-wide stats, attendance by date across everyone,
leave approvals with comments, and an employee directory where clicking
anyone opens their full profile, salary editor, and attendance history.

## Notes carried over from the backend README

- Sign-up requires email verification. Since no mail provider is wired
  up, the verification code is returned directly in the API response —
  `auth.html` shows it to you inline instead of emailing it (search
  `devOnlyVerificationCode` in `backend/README.md` for details).
- An employee can only edit their own phone, address, and profile
  picture — full name, job title, department, and salary are admin-only
  edits, by design (see `backend/src/routes/profile.js`). So a freshly
  signed-up employee's name stays blank until an admin sets it from the
  Employees tab.
- `node:sqlite` requires Node.js 22.5+.
