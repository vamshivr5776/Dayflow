// Password hashing using Node's built-in crypto.scrypt — no external
// dependency (like bcrypt) required. Salted per-user, timing-safe compare.

const crypto = require('node:crypto');

const KEY_LENGTH = 64;

function hashPassword(plainPassword) {
  const salt = crypto.randomBytes(16).toString('hex');
  const derived = crypto.scryptSync(plainPassword, salt, KEY_LENGTH).toString('hex');
  return `${salt}:${derived}`;
}

function verifyPassword(plainPassword, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const derived = crypto.scryptSync(plainPassword, salt, KEY_LENGTH);
  const hashBuffer = Buffer.from(hash, 'hex');
  if (derived.length !== hashBuffer.length) return false;
  return crypto.timingSafeEqual(derived, hashBuffer);
}

// Mirrors the rule shown on the sign-up form: 8+ chars, one uppercase, one number.
function isPasswordStrong(plainPassword) {
  return (
    typeof plainPassword === 'string' &&
    plainPassword.length >= 8 &&
    /[A-Z]/.test(plainPassword) &&
    /[0-9]/.test(plainPassword)
  );
}

module.exports = { hashPassword, verifyPassword, isPasswordStrong };
