const { db } = require('../db');
const { ok, fail } = require('../utils/http');
const { requireAuth, requireRole } = require('../middleware/auth');
const { shapeProfile } = require('./profile');

function register(router) {
  // GET /api/employees — admin's employee list (for the dashboard's "switch
  // between employees" picker).
  router.get('/api/employees', requireAuth, requireRole('admin'), async (req, res) => {
    const rows = db.prepare(`
      SELECT users.id, users.employee_id, users.email, users.role, users.email_verified,
             profiles.full_name, profiles.job_title, profiles.department
      FROM users
      LEFT JOIN profiles ON profiles.user_id = users.id
      ORDER BY users.created_at DESC
    `).all();

    return ok(res, rows.map((r) => ({
      id: r.id,
      employeeId: r.employee_id,
      email: r.email,
      role: r.role,
      emailVerified: !!r.email_verified,
      fullName: r.full_name,
      jobTitle: r.job_title,
      department: r.department,
    })));
  });

  // GET /api/employees/:id — full profile, any employee, admin only.
  router.get('/api/employees/:id', requireAuth, requireRole('admin'), async (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) return fail(res, 404, 'Employee not found.');
    const profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(user.id);
    const salary = db.prepare('SELECT * FROM salaries WHERE user_id = ?').get(user.id);
    return ok(res, shapeProfile(user, profile, salary));
  });

  // PUT /api/employees/:id — admin can edit all employee details (unlike the
  // employee's own limited self-edit in /api/profile/me).
  router.put('/api/employees/:id', requireAuth, requireRole('admin'), async (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
    if (!user) return fail(res, 404, 'Employee not found.');

    const existing = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(user.id);
    const b = req.body || {};

    db.prepare(`
      UPDATE profiles
      SET full_name = ?, phone = ?, address = ?, job_title = ?, department = ?,
          date_of_joining = ?, profile_picture_url = ?, documents = ?
      WHERE user_id = ?
    `).run(
      b.fullName !== undefined ? b.fullName : existing.full_name,
      b.phone !== undefined ? b.phone : existing.phone,
      b.address !== undefined ? b.address : existing.address,
      b.jobTitle !== undefined ? b.jobTitle : existing.job_title,
      b.department !== undefined ? b.department : existing.department,
      b.dateOfJoining !== undefined ? b.dateOfJoining : existing.date_of_joining,
      b.profilePictureUrl !== undefined ? b.profilePictureUrl : existing.profile_picture_url,
      b.documents !== undefined ? JSON.stringify(b.documents) : existing.documents,
      user.id
    );

    const profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(user.id);
    const salary = db.prepare('SELECT * FROM salaries WHERE user_id = ?').get(user.id);
    return ok(res, shapeProfile(user, profile, salary));
  });
}

module.exports = { register };
