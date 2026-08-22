const { db } = require('../db');
const { ok, fail } = require('../utils/http');
const { hashPassword, verifyPassword, isPasswordStrong } = require('../utils/password');
const { generateToken, generateVerificationCode } = require('../utils/tokens');
const { requireAuth } = require('../middleware/auth');

const SESSION_TTL_HOURS = Number(process.env.SESSION_TTL_HOURS || 168);
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function createSession(userId) {
  const token = generateToken();
  const expiresAt = new Date(Date.now() + SESSION_TTL_HOURS * 60 * 60 * 1000).toISOString();
  db.prepare('INSERT INTO sessions (token, user_id, expires_at) VALUES (?, ?, ?)')
    .run(token, userId, expiresAt);
  return { token, expiresAt };
}

function publicUser(row) {
  return {
    id: row.id,
    employeeId: row.employee_id,
    email: row.email,
    role: row.role,
    emailVerified: !!row.email_verified,
  };
}

function register(router) {
  // POST /api/auth/signup
  router.post('/api/auth/signup', async (req, res) => {
    const { employeeId, email, password, role } = req.body || {};

    if (!employeeId || !String(employeeId).trim()) {
      return fail(res, 400, 'Employee ID is required.');
    }
    if (!email || !EMAIL_RE.test(email)) {
      return fail(res, 400, 'Enter a valid email address.');
    }
    if (!isPasswordStrong(password)) {
      return fail(res, 400, 'Password must be 8+ characters with one uppercase letter and one number.');
    }
    const finalRole = role === 'hr' || role === 'admin' ? 'admin' : 'employee';

    const clash = db.prepare('SELECT id FROM users WHERE employee_id = ? OR email = ?')
      .get(employeeId, email);
    if (clash) {
      return fail(res, 409, 'An account with that employee ID or email already exists.');
    }

    const verificationCode = generateVerificationCode();
    const info = db.prepare(`
      INSERT INTO users (employee_id, email, password_hash, role, email_verified, verification_code)
      VALUES (?, ?, ?, ?, 0, ?)
    `).run(employeeId, email, hashPassword(password), finalRole, verificationCode);

    db.prepare('INSERT INTO profiles (user_id) VALUES (?)').run(info.lastInsertRowid);
    db.prepare('INSERT INTO salaries (user_id) VALUES (?)').run(info.lastInsertRowid);

    // No real mail provider is wired up here. In production, send
    // `verificationCode` (or a signed link containing it) via something like
    // SES/SendGrid/Postmark instead of returning it in the response.
    return ok(res, {
      message: 'Account created. Verify your email before signing in.',
      devOnlyVerificationCode: verificationCode,
    }, 201);
  });

  // POST /api/auth/verify-email
  router.post('/api/auth/verify-email', async (req, res) => {
    const { email, code } = req.body || {};
    if (!email || !code) return fail(res, 400, 'Email and verification code are required.');

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) return fail(res, 404, 'No account found for that email.');
    if (user.email_verified) return ok(res, { message: 'Email already verified.' });
    if (user.verification_code !== code) return fail(res, 400, 'Incorrect verification code.');

    db.prepare('UPDATE users SET email_verified = 1, verification_code = NULL WHERE id = ?')
      .run(user.id);

    return ok(res, { message: 'Email verified. You can sign in now.' });
  });

  // POST /api/auth/signin
  router.post('/api/auth/signin', async (req, res) => {
    const { email, password } = req.body || {};
    if (!email || !password) return fail(res, 400, 'Email and password are required.');

    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    // Same error for "no such user" and "wrong password" so we don't leak
    // which emails are registered.
    if (!user || !verifyPassword(password, user.password_hash)) {
      return fail(res, 401, 'That email and password don\'t match.');
    }
    if (!user.email_verified) {
      return fail(res, 403, 'Verify your email before signing in.');
    }

    const { token, expiresAt } = createSession(user.id);
    return ok(res, { token, expiresAt, user: publicUser(user) });
  });

  // POST /api/auth/signout
  router.post('/api/auth/signout', requireAuth, async (req, res) => {
    db.prepare('DELETE FROM sessions WHERE token = ?').run(req.token);
    return ok(res, { message: 'Signed out.' });
  });

  // GET /api/auth/me
  router.get('/api/auth/me', requireAuth, async (req, res) => {
    return ok(res, { user: req.user });
  });
}

module.exports = { register };
