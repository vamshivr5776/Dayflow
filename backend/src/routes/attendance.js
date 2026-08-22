const { db } = require('../db');
const { ok, fail } = require('../utils/http');
const { requireAuth, requireRole } = require('../middleware/auth');

function todayISO() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function nowTime() {
  return new Date().toISOString().slice(11, 19); // HH:MM:SS
}

function shapeRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    date: row.date,
    checkIn: row.check_in,
    checkOut: row.check_out,
    status: row.status,
  };
}

function register(router) {
  // POST /api/attendance/check-in
  router.post('/api/attendance/check-in', requireAuth, async (req, res) => {
    const date = todayISO();
    const existing = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?')
      .get(req.user.id, date);

    if (existing && existing.check_in) {
      return fail(res, 409, 'Already checked in today.');
    }

    if (existing) {
      db.prepare('UPDATE attendance SET check_in = ?, status = ? WHERE id = ?')
        .run(nowTime(), 'present', existing.id);
    } else {
      db.prepare(`
        INSERT INTO attendance (user_id, date, check_in, status)
        VALUES (?, ?, ?, 'present')
      `).run(req.user.id, date, nowTime());
    }

    const row = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?')
      .get(req.user.id, date);
    return ok(res, shapeRow(row));
  });

  // POST /api/attendance/check-out
  router.post('/api/attendance/check-out', requireAuth, async (req, res) => {
    const date = todayISO();
    const existing = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?')
      .get(req.user.id, date);

    if (!existing || !existing.check_in) {
      return fail(res, 400, 'Check in before checking out.');
    }
    if (existing.check_out) {
      return fail(res, 409, 'Already checked out today.');
    }

    db.prepare('UPDATE attendance SET check_out = ? WHERE id = ?').run(nowTime(), existing.id);

    const row = db.prepare('SELECT * FROM attendance WHERE id = ?').get(existing.id);
    return ok(res, shapeRow(row));
  });

  // GET /api/attendance/me?range=daily|weekly&date=YYYY-MM-DD
  router.get('/api/attendance/me', requireAuth, async (req, res) => {
    const range = req.query.range === 'weekly' ? 'weekly' : 'daily';
    const anchor = req.query.date || todayISO();

    if (range === 'daily') {
      const row = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?')
        .get(req.user.id, anchor);
      return ok(res, row ? shapeRow(row) : { date: anchor, status: 'absent', checkIn: null, checkOut: null });
    }

    // weekly: 7 days ending on `anchor`, oldest first.
    const anchorDate = new Date(`${anchor}T00:00:00Z`);
    const start = new Date(anchorDate);
    start.setUTCDate(start.getUTCDate() - 6);
    const startISO = start.toISOString().slice(0, 10);

    const rows = db.prepare(`
      SELECT * FROM attendance WHERE user_id = ? AND date BETWEEN ? AND ?
      ORDER BY date ASC
    `).all(req.user.id, startISO, anchor);

    const byDate = Object.fromEntries(rows.map((r) => [r.date, shapeRow(r)]));
    const week = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(start);
      d.setUTCDate(d.getUTCDate() + i);
      const iso = d.toISOString().slice(0, 10);
      week.push(byDate[iso] || { date: iso, status: 'absent', checkIn: null, checkOut: null });
    }
    return ok(res, week);
  });

  // GET /api/attendance/:userId — admin view of one employee's full history.
  router.get('/api/attendance/:userId', requireAuth, requireRole('admin'), async (req, res) => {
    const rows = db.prepare('SELECT * FROM attendance WHERE user_id = ? ORDER BY date DESC')
      .all(req.params.userId);
    return ok(res, rows.map(shapeRow));
  });

  // GET /api/attendance?date=YYYY-MM-DD — admin view across all employees for one day.
  router.get('/api/attendance', requireAuth, requireRole('admin'), async (req, res) => {
    const date = req.query.date || todayISO();
    const rows = db.prepare(`
      SELECT users.id AS user_id, users.employee_id, profiles.full_name,
             attendance.check_in, attendance.check_out, attendance.status
      FROM users
      LEFT JOIN attendance ON attendance.user_id = users.id AND attendance.date = ?
      LEFT JOIN profiles ON profiles.user_id = users.id
      WHERE users.role = 'employee'
      ORDER BY profiles.full_name ASC
    `).all(date);

    return ok(res, rows.map((r) => ({
      userId: r.user_id,
      employeeId: r.employee_id,
      fullName: r.full_name,
      date,
      checkIn: r.check_in || null,
      checkOut: r.check_out || null,
      status: r.status || 'absent',
    })));
  });
}

module.exports = { register };
