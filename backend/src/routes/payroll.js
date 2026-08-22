const { db } = require('../db');
const { ok, fail } = require('../utils/http');
const { requireAuth, requireRole } = require('../middleware/auth');
const { computeNetPay } = require('./profile');

function register(router) {
  // GET /api/payroll/me — read-only for the signed-in employee.
  router.get('/api/payroll/me', requireAuth, async (req, res) => {
    const salary = db.prepare('SELECT * FROM salaries WHERE user_id = ?').get(req.user.id);
    return ok(res, computeNetPay(salary));
  });

  // GET /api/payroll/:userId — admin view of any employee's salary.
  router.get('/api/payroll/:userId', requireAuth, requireRole('admin'), async (req, res) => {
    const salary = db.prepare('SELECT * FROM salaries WHERE user_id = ?').get(req.params.userId);
    if (!salary) return fail(res, 404, 'No salary record for that employee.');
    return ok(res, computeNetPay(salary));
  });

  // PUT /api/payroll/:userId — admin updates the salary structure.
  router.put('/api/payroll/:userId', requireAuth, requireRole('admin'), async (req, res) => {
    const { basic, hra, allowances, deductions } = req.body || {};
    const nums = { basic, hra, allowances, deductions };
    for (const [key, val] of Object.entries(nums)) {
      if (val !== undefined && (typeof val !== 'number' || val < 0)) {
        return fail(res, 400, `${key} must be a non-negative number.`);
      }
    }

    const existing = db.prepare('SELECT * FROM salaries WHERE user_id = ?').get(req.params.userId);
    if (!existing) return fail(res, 404, 'No salary record for that employee.');

    db.prepare(`
      UPDATE salaries
      SET basic = ?, hra = ?, allowances = ?, deductions = ?, updated_at = datetime('now')
      WHERE user_id = ?
    `).run(
      basic !== undefined ? basic : existing.basic,
      hra !== undefined ? hra : existing.hra,
      allowances !== undefined ? allowances : existing.allowances,
      deductions !== undefined ? deductions : existing.deductions,
      req.params.userId
    );

    const updated = db.prepare('SELECT * FROM salaries WHERE user_id = ?').get(req.params.userId);
    return ok(res, computeNetPay(updated));
  });
}

module.exports = { register };
