const { db } = require('../db');
const { ok } = require('../utils/http');
const { requireAuth } = require('../middleware/auth');

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function register(router) {
  // GET /api/dashboard — shape depends on the signed-in user's role.
  router.get('/api/dashboard', requireAuth, async (req, res) => {
    const today = todayISO();

    if (req.user.role === 'admin') {
      const employeeCount = db.prepare(
        `SELECT COUNT(*) AS n FROM users WHERE role = 'employee'`
      ).get().n;

      const presentToday = db.prepare(
        `SELECT COUNT(*) AS n FROM attendance WHERE date = ? AND status = 'present'`
      ).get(today).n;

      const pendingLeave = db.prepare(
        `SELECT COUNT(*) AS n FROM leave_requests WHERE status = 'pending'`
      ).get().n;

      const recentLeave = db.prepare(`
        SELECT leave_requests.*, users.employee_id, profiles.full_name
        FROM leave_requests
        JOIN users ON users.id = leave_requests.user_id
        LEFT JOIN profiles ON profiles.user_id = users.id
        ORDER BY leave_requests.created_at DESC
        LIMIT 5
      `).all();

      return ok(res, {
        role: 'admin',
        employeeCount,
        presentToday,
        pendingLeave,
        recentLeaveRequests: recentLeave.map((r) => ({
          id: r.id,
          employeeId: r.employee_id,
          fullName: r.full_name,
          leaveType: r.leave_type,
          startDate: r.start_date,
          endDate: r.end_date,
          status: r.status,
        })),
      });
    }

    const attendanceToday = db.prepare('SELECT * FROM attendance WHERE user_id = ? AND date = ?')
      .get(req.user.id, today);

    const pendingLeaveCount = db.prepare(
      `SELECT COUNT(*) AS n FROM leave_requests WHERE user_id = ? AND status = 'pending'`
    ).get(req.user.id).n;

    const recentLeave = db.prepare(`
      SELECT * FROM leave_requests WHERE user_id = ? ORDER BY created_at DESC LIMIT 5
    `).all(req.user.id);

    return ok(res, {
      role: 'employee',
      today: {
        date: today,
        status: attendanceToday ? attendanceToday.status : 'absent',
        checkIn: attendanceToday ? attendanceToday.check_in : null,
        checkOut: attendanceToday ? attendanceToday.check_out : null,
      },
      pendingLeaveCount,
      recentLeaveRequests: recentLeave.map((r) => ({
        id: r.id,
        leaveType: r.leave_type,
        startDate: r.start_date,
        endDate: r.end_date,
        status: r.status,
      })),
    });
  });
}

module.exports = { register };
