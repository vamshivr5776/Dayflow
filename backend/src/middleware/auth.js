const { db } = require('../db');
const { fail } = require('../utils/http');

// Reads `Authorization: Bearer <token>`, loads the session + user, and
// attaches `req.user`. Responds 401 if missing/expired.
async function requireAuth(req, res) {
  const header = req.headers['authorization'] || '';
  const [scheme, token] = header.split(' ');

  if (scheme !== 'Bearer' || !token) {
    return fail(res, 401, 'Sign in required. Include Authorization: Bearer <token>.');
  }

  const session = db.prepare(`
    SELECT sessions.user_id, sessions.expires_at, users.*
    FROM sessions
    JOIN users ON users.id = sessions.user_id
    WHERE sessions.token = ?
  `).get(token);

  if (!session) {
    return fail(res, 401, 'Session not found. Sign in again.');
  }

  if (new Date(session.expires_at).getTime() < Date.now()) {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(token);
    return fail(res, 401, 'Session expired. Sign in again.');
  }

  req.user = {
    id: session.user_id,
    employeeId: session.employee_id,
    email: session.email,
    role: session.role,
    emailVerified: !!session.email_verified,
  };
  req.token = token;
}

// Use after requireAuth: requireRole('admin')
function requireRole(...allowedRoles) {
  return async function (req, res) {
    if (!req.user) {
      return fail(res, 401, 'Sign in required.');
    }
    if (!allowedRoles.includes(req.user.role)) {
      return fail(res, 403, 'You do not have permission to do that.');
    }
  };
}

module.exports = { requireAuth, requireRole };
