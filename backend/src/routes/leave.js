const { db } = require('../db');
const { ok, fail } = require('../utils/http');
const { requireAuth, requireRole } = require('../middleware/auth');

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function shapeRow(row) {
  return {
    id: row.id,
    userId: row.user_id,
    leaveType: row.leave_type,
    startDate: row.start_date,
    endDate: row.end_date,
    remarks: row.remarks,
    status: row.status,
    adminComment: row.admin_comment,
    createdAt: row.created_at,
    decidedAt: row.decided_at,
  };
}

// Marks each day in [start, end] as 'leave' in the attendance table so the
// change "reflects immediately in employee records" per the spec.
function markAttendanceAsLeave(userId, startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00Z`);
  const end = new Date(`${endDate}T00:00:00Z`);
  for (let d = new Date(start); d <= end; d.setUTCDate(d.getUTCDate() + 1)) {
    const iso = d.toISOString().slice(0, 10);
    const existing = db.prepare('SELECT id FROM attendance WHERE user_id = ? AND date = ?')
      .get(userId, iso);
    if (existing) {
      db.prepare('UPDATE attendance SET status = ? WHERE id = ?').run('leave', existing.id);
    } else {
      db.prepare('INSERT INTO attendance (user_id, date, status) VALUES (?, ?, ?)')
        .run(userId, iso, 'leave');
    }
  }
}

function register(router) {
  // POST /api/leave — employee applies for leave.
  router.post('/api/leave', requireAuth, async (req, res) => {
    const { leaveType, startDate, endDate, remarks } = req.body || {};

    if (!['paid', 'sick', 'unpaid'].includes(leaveType)) {
      return fail(res, 400, 'leaveType must be paid, sick, or unpaid.');
    }
    if (!DATE_RE.test(startDate) || !DATE_RE.test(endDate)) {
      return fail(res, 400, 'startDate and endDate must be in YYYY-MM-DD format.');
    }
    if (new Date(startDate) > new Date(endDate)) {
      return fail(res, 400, 'startDate must be on or before endDate.');
    }

    const info = db.prepare(`
      INSERT INTO leave_requests (user_id, leave_type, start_date, end_date, remarks)
      VALUES (?, ?, ?, ?, ?)
    `).run(req.user.id, leaveType, startDate, endDate, remarks || '');

    const row = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(info.lastInsertRowid);
    return ok(res, shapeRow(row), 201);
  });

  // GET /api/leave/me — the signed-in employee's own requests.
  router.get('/api/leave/me', requireAuth, async (req, res) => {
    const rows = db.prepare('SELECT * FROM leave_requests WHERE user_id = ? ORDER BY created_at DESC')
      .all(req.user.id);
    return ok(res, rows.map(shapeRow));
  });

  // GET /api/leave?status=pending — admin: all requests, optionally filtered.
  router.get('/api/leave', requireAuth, requireRole('admin'), async (req, res) => {
    const { status } = req.query;
    const rows = status
      ? db.prepare(`
          SELECT leave_requests.*, users.employee_id, profiles.full_name
          FROM leave_requests
          JOIN users ON users.id = leave_requests.user_id
          LEFT JOIN profiles ON profiles.user_id = users.id
          WHERE leave_requests.status = ?
          ORDER BY leave_requests.created_at DESC
        `).all(status)
      : db.prepare(`
          SELECT leave_requests.*, users.employee_id, profiles.full_name
          FROM leave_requests
          JOIN users ON users.id = leave_requests.user_id
          LEFT JOIN profiles ON profiles.user_id = users.id
          ORDER BY leave_requests.created_at DESC
        `).all();

    return ok(res, rows.map((r) => ({
      ...shapeRow(r),
      employeeId: r.employee_id,
      fullName: r.full_name,
    })));
  });

  // PATCH /api/leave/:id — admin approves or rejects, with an optional comment.
  router.patch('/api/leave/:id', requireAuth, requireRole('admin'), async (req, res) => {
    const { decision, comment } = req.body || {};
    if (!['approved', 'rejected'].includes(decision)) {
      return fail(res, 400, 'decision must be "approved" or "rejected".');
    }

    const leave = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(req.params.id);
    if (!leave) return fail(res, 404, 'Leave request not found.');
    if (leave.status !== 'pending') {
      return fail(res, 409, 'This request has already been decided.');
    }

    db.prepare(`
      UPDATE leave_requests
      SET status = ?, admin_comment = ?, decided_by = ?, decided_at = datetime('now')
      WHERE id = ?
    `).run(decision, comment || '', req.user.id, leave.id);

    if (decision === 'approved') {
      markAttendanceAsLeave(leave.user_id, leave.start_date, leave.end_date);
    }

    const row = db.prepare('SELECT * FROM leave_requests WHERE id = ?').get(leave.id);
    return ok(res, shapeRow(row));
  });
}

module.exports = { register };
