// Opaque, random session tokens stored server-side (in the `sessions` table),
// rather than signed JWTs. This keeps the dependency footprint at zero and
// makes revocation trivial (just delete the row) — a reasonable trade-off
// for a system that already has a database on every request.

const crypto = require('node:crypto');

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function generateVerificationCode() {
  // Short, human-typeable code standing in for a real "verify your email" link.
  return crypto.randomBytes(4).toString('hex');
}

module.exports = { generateToken, generateVerificationCode };
