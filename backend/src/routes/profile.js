const { db } = require('../db');
const { ok, fail } = require('../utils/http');
const { requireAuth } = require('../middleware/auth');

function computeNetPay(salary) {
  if (!salary) return null;
  const net = salary.basic + salary.hra + salary.allowances - salary.deductions;
  return {
    basic: salary.basic,
    hra: salary.hra,
    allowances: salary.allowances,
    deductions: salary.deductions,
    netPay: net,
    updatedAt: salary.updated_at,
  };
}

function shapeProfile(userRow, profileRow, salaryRow) {
  return {
    id: userRow.id,
    employeeId: userRow.employee_id,
    email: userRow.email,
    role: userRow.role,
    personal: {
      fullName: profileRow.full_name,
      phone: profileRow.phone,
      address: profileRow.address,
      profilePictureUrl: profileRow.profile_picture_url,
      documents: JSON.parse(profileRow.documents || '[]'),
    },
    job: {
      jobTitle: profileRow.job_title,
      department: profileRow.department,
      dateOfJoining: profileRow.date_of_joining,
    },
    // Read-only for the employee viewing their own profile.
    salary: computeNetPay(salaryRow),
  };
}

function register(router) {
  // GET /api/profile/me — personal details, job details, salary (read-only), documents.
  router.get('/api/profile/me', requireAuth, async (req, res) => {
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(req.user.id);
    const salary = db.prepare('SELECT * FROM salaries WHERE user_id = ?').get(req.user.id);
    return ok(res, shapeProfile(user, profile, salary));
  });

  // PUT /api/profile/me — employees may only edit address, phone, profile picture.
  router.put('/api/profile/me', requireAuth, async (req, res) => {
    const { phone, address, profilePictureUrl } = req.body || {};

    const existing = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(req.user.id);
    if (!existing) return fail(res, 404, 'Profile not found.');

    db.prepare(`
      UPDATE profiles
      SET phone = ?, address = ?, profile_picture_url = ?
      WHERE user_id = ?
    `).run(
      phone !== undefined ? phone : existing.phone,
      address !== undefined ? address : existing.address,
      profilePictureUrl !== undefined ? profilePictureUrl : existing.profile_picture_url,
      req.user.id
    );

    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const profile = db.prepare('SELECT * FROM profiles WHERE user_id = ?').get(req.user.id);
    const salary = db.prepare('SELECT * FROM salaries WHERE user_id = ?').get(req.user.id);
    return ok(res, shapeProfile(user, profile, salary));
  });
}

module.exports = { register, shapeProfile, computeNetPay };
