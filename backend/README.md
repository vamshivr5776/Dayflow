# Dayflow — Backend API

A REST API for the Dayflow HRMS: authentication, employee profiles, attendance,
leave/time-off, payroll visibility, and approval workflows — matching the
functional requirements in the product spec.

**Zero external dependencies.** It runs on plain Node.js using two built-in
modules that make this possible without npm installs:
- `node:sqlite` for storage (added in Node 22.5, stable enough here — see
  the note below)
- `node:crypto` for password hashing (`scrypt`) and session tokens

## Requirements

- Node.js **22.5.0 or later** (for `node:sqlite`). Check with `node -v`.

## Run it

```bash
cd dayflow-backend
npm start
# Dayflow API listening on http://localhost:4000
```

No `npm install` step — there's nothing to install. Optionally copy
`.env.example` to `.env` to override the port, CORS origin, session lifetime,
or the seeded admin credentials.

On first run, the server creates `data/dayflow.db` and seeds one admin/HR
account:

```
email:    admin@dayflow.io
password: Admin@123
```

Change or remove this in a real deployment. To wipe local data and reseed:
`npm run seed:reset`.

## How auth works

Sign in returns an opaque bearer token (not a JWT) stored server-side in a
`sessions` table. Send it back as:

```
Authorization: Bearer <token>
```

Sessions last 168 hours (7 days) by default (`SESSION_TTL_HOURS`). Sign-up
requires email verification before sign-in works — since there's no mail
provider wired up, the verification code is returned directly in the sign-up
response as `devOnlyVerificationCode`. Swap in a real provider (SES,
SendGrid, Postmark, etc.) and stop returning the code once you have one.

## API reference

All responses are `{ "data": ... }` on success or `{ "error": { "message": ... } }`
on failure. Endpoints marked **[admin]** require an admin/HR account.

### Auth
| Method | Path | Body | Notes |
|---|---|---|---|
| POST | `/api/auth/signup` | `employeeId, email, password, role` | `role` is `"employee"` or `"hr"` |
| POST | `/api/auth/verify-email` | `email, code` | Required before sign-in |
| POST | `/api/auth/signin` | `email, password` | Returns `token`, `expiresAt`, `user` |
| POST | `/api/auth/signout` | — | Invalidates the current session |
| GET | `/api/auth/me` | — | Current signed-in user |

### Profile
| Method | Path | Notes |
|---|---|---|
| GET | `/api/profile/me` | Personal + job details, documents, read-only salary |
| PUT | `/api/profile/me` | Employee can only set `phone`, `address`, `profilePictureUrl` |

### Employees **[admin]**
| Method | Path | Notes |
|---|---|---|
| GET | `/api/employees` | List, for the "switch between employees" picker |
| GET | `/api/employees/:id` | Full profile of one employee |
| PUT | `/api/employees/:id` | Admin can edit every field, incl. job details & documents |

### Attendance
| Method | Path | Notes |
|---|---|---|
| POST | `/api/attendance/check-in` | Marks today present |
| POST | `/api/attendance/check-out` | Requires a check-in first |
| GET | `/api/attendance/me?range=daily\|weekly&date=YYYY-MM-DD` | Own history |
| GET | `/api/attendance/:userId` **[admin]** | One employee's full history |
| GET | `/api/attendance?date=YYYY-MM-DD` **[admin]** | All employees for one day |

### Leave
| Method | Path | Notes |
|---|---|---|
| POST | `/api/leave` | `leaveType` (`paid`/`sick`/`unpaid`), `startDate`, `endDate`, `remarks` |
| GET | `/api/leave/me` | Own requests |
| GET | `/api/leave?status=pending` **[admin]** | All requests, optional filter |
| PATCH | `/api/leave/:id` **[admin]** | `decision` (`approved`/`rejected`), `comment` — approving marks those attendance days as `leave` |

### Payroll
| Method | Path | Notes |
|---|---|---|
| GET | `/api/payroll/me` | Read-only for the employee |
| GET | `/api/payroll/:userId` **[admin]** | View any employee's salary |
| PUT | `/api/payroll/:userId` **[admin]** | Update `basic`, `hra`, `allowances`, `deductions` |

### Dashboard
| Method | Path | Notes |
|---|---|---|
| GET | `/api/dashboard` | Shape depends on role — today's status + pending leave for employees; headcount, present-today, pending approvals for admins |

### Health
`GET /api/health` — liveness check, no auth.

## Project layout

```
dayflow-backend/
├── package.json
├── .env.example
├── data/                  # sqlite file lives here (gitignored)
└── src/
    ├── server.js          # HTTP server, wires up all routes
    ├── db.js              # schema + seed
    ├── utils/
    │   ├── router.js      # tiny Express-like router (no dependency)
    │   ├── http.js        # JSON response + body-parsing helpers
    │   ├── password.js    # scrypt hashing
    │   └── tokens.js      # session token generation
    ├── middleware/
    │   └── auth.js        # requireAuth, requireRole
    └── routes/
        ├── auth.js
        ├── profile.js
        ├── employees.js
        ├── attendance.js
        ├── leave.js
        ├── payroll.js
        └── dashboard.js
```

## Known limitations / next steps

- **`node:sqlite` is experimental upstream.** It's been reliable in testing
  here, but if you'd rather depend on a mature driver, swap `db.js` for
  `better-sqlite3` (same synchronous `prepare().run()/.get()/.all()` API —
  the rest of the codebase wouldn't need to change) or move to Postgres for
  production.
- **No email provider.** Verification codes come back in the API response
  for now — wire up a real provider before shipping.
- **No absent-marking job.** An employee who never checks in stays with no
  attendance row (shown as `absent` when read) rather than being written as
  `absent` automatically. In production, add a daily scheduled job (cron or
  `node-cron`) that writes `absent` rows for anyone without a check-in once
  the day ends.
- **CORS defaults to `*`.** Fine for local development against the sign-in
  page and homepage already built; tighten `CORS_ORIGIN` before deploying.
