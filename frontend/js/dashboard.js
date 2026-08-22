(function () {
  if (!Session.token()) {
    location.href = 'auth.html';
    return;
  }

  const user = Session.user();
  const isAdmin = user.role === 'admin';

  // ---------- small helpers ----------
  function toast(message, type = 'success') {
    const wrap = document.getElementById('toastWrap');
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    wrap.appendChild(el);
    setTimeout(() => el.remove(), 4200);
  }

  function badge(status) {
    if (!status) return '<span class="badge absent">absent</span>';
    return `<span class="badge ${status}">${status}</span>`;
  }

  function fmtTime(t) {
    return t ? t.slice(0, 5) : '—';
  }

  function fmtMoney(n) {
    if (n === null || n === undefined) return '—';
    return `₹${Number(n).toLocaleString('en-IN')}`;
  }

  function todayISO() {
    return new Date().toISOString().slice(0, 10);
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str ?? '';
    return div.innerHTML;
  }

  async function guarded(fn) {
    try {
      await fn();
    } catch (err) {
      toast(err.message, 'error');
    }
  }

  // ---------- topbar ----------
  document.getElementById('roleBadge').textContent = isAdmin ? 'Admin / HR' : 'Employee';
  document.getElementById('roleBadge').classList.add(isAdmin ? 'admin' : 'employee');
  document.getElementById('userEmail').textContent = user.email;
  document.getElementById('userName').textContent = user.employeeId;

  document.getElementById('signOutBtn').addEventListener('click', async () => {
    await guarded(async () => {
      await api('/api/auth/signout', { method: 'POST' });
    });
    Session.clear();
    location.href = 'auth.html';
  });

  if (isAdmin) {
    document.getElementById('adminDivider').style.display = '';
    document.getElementById('employeesNavBtn').style.display = '';
  }
  document.getElementById('overviewListTitle').textContent = isAdmin
    ? 'Recent leave requests (all employees)'
    : 'Recent leave requests';
  document.getElementById('leaveListTitle').textContent = isAdmin ? 'All requests' : 'Your requests';
  document.getElementById('leaveApplyCard').style.display = isAdmin ? 'none' : '';
  document.getElementById('leaveFilterSwitch').style.display = isAdmin ? '' : 'none';
  document.getElementById('attendanceEmployeeView').style.display = isAdmin ? 'none' : '';
  document.getElementById('attendanceAdminView').style.display = isAdmin ? '' : 'none';
  document.getElementById('attendanceEmployeeActions').style.display = isAdmin ? 'none' : '';
  document.getElementById('attendanceSub').textContent = isAdmin
    ? 'Every employee, for a chosen day.'
    : 'Your check-in / check-out history.';

  // ---------- nav / panel switching ----------
  const loaders = {
    overview: loadOverview,
    attendance: loadAttendance,
    leave: loadLeave,
    payroll: loadPayroll,
    profile: loadProfile,
    employees: loadEmployees,
  };

  document.getElementById('dashNav').addEventListener('click', (e) => {
    const btn = e.target.closest('button[data-panel]');
    if (!btn) return;
    document.querySelectorAll('.dash-nav button').forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
    document.querySelectorAll('.dash-panel').forEach((p) => p.classList.remove('active'));
    document.getElementById(`panel-${btn.dataset.panel}`).classList.add('active');
    guarded(loaders[btn.dataset.panel]);
  });

  // ---------- check-in / check-out (shared by overview + attendance panel) ----------
  async function checkIn() {
    await guarded(async () => {
      await api('/api/attendance/check-in', { method: 'POST' });
      toast('Checked in.');
      refreshActivePanel();
    });
  }
  async function checkOut() {
    await guarded(async () => {
      await api('/api/attendance/check-out', { method: 'POST' });
      toast('Checked out.');
      refreshActivePanel();
    });
  }
  ['checkInBtn', 'checkInBtn2'].forEach((id) => document.getElementById(id).addEventListener('click', checkIn));
  ['checkOutBtn', 'checkOutBtn2'].forEach((id) => document.getElementById(id).addEventListener('click', checkOut));

  function refreshActivePanel() {
    const active = document.querySelector('.dash-nav button.active');
    if (active) guarded(loaders[active.dataset.panel]);
  }

  // ---------- OVERVIEW ----------
  async function loadOverview() {
    const data = await api('/api/dashboard');
    document.getElementById('overviewGreeting').textContent = isAdmin
      ? `Welcome back, ${user.employeeId}`
      : `Hi, ${user.employeeId}`;
    document.getElementById('overviewSub').textContent = isAdmin
      ? "Here's how the team is doing today."
      : "Here's where things stand today.";

    const statsEl = document.getElementById('overviewStats');
    const actionsCard = document.getElementById('overviewActionsCard');

    if (isAdmin) {
      actionsCard.style.display = 'none';
      statsEl.innerHTML = `
        <div class="stat-card"><div class="stat-label">Employees</div><div class="stat-value">${data.employeeCount}</div></div>
        <div class="stat-card"><div class="stat-label">Present today</div><div class="stat-value">${data.presentToday}</div></div>
        <div class="stat-card"><div class="stat-label">Pending leave</div><div class="stat-value">${data.pendingLeave}</div></div>
      `;
      renderLeaveTable('overviewLeaveTable', 'overviewLeaveEmpty', data.recentLeaveRequests, { withEmployee: true });
    } else {
      actionsCard.style.display = '';
      const t = data.today;
      statsEl.innerHTML = `
        <div class="stat-card"><div class="stat-label">Today's status</div><div class="stat-value small">${badge(t.status)}</div></div>
        <div class="stat-card"><div class="stat-label">Checked in</div><div class="stat-value small">${fmtTime(t.checkIn)}</div></div>
        <div class="stat-card"><div class="stat-label">Checked out</div><div class="stat-value small">${fmtTime(t.checkOut)}</div></div>
        <div class="stat-card"><div class="stat-label">Pending leave</div><div class="stat-value">${data.pendingLeaveCount}</div></div>
      `;
      document.getElementById('checkInBtn').disabled = !!t.checkIn;
      document.getElementById('checkOutBtn').disabled = !t.checkIn || !!t.checkOut;
      renderLeaveTable('overviewLeaveTable', 'overviewLeaveEmpty', data.recentLeaveRequests, { withEmployee: false });
    }
  }

  function renderLeaveTable(tableId, emptyId, rows, { withEmployee }) {
    const table = document.getElementById(tableId);
    const empty = document.getElementById(emptyId);
    if (!rows || rows.length === 0) {
      table.style.display = 'none';
      empty.style.display = '';
      return;
    }
    table.style.display = '';
    empty.style.display = 'none';
    const headCols = withEmployee ? ['Employee', 'Type', 'Dates', 'Status'] : ['Type', 'Dates', 'Status'];
    table.querySelector('thead').innerHTML = `<tr>${headCols.map((c) => `<th>${c}</th>`).join('')}</tr>`;
    table.querySelector('tbody').innerHTML = rows
      .map((r) => {
        const cells = [];
        if (withEmployee) cells.push(`<td>${escapeHtml(r.fullName || r.employeeId)}</td>`);
        cells.push(`<td class="mono">${r.leaveType}</td>`);
        cells.push(`<td>${r.startDate} → ${r.endDate}</td>`);
        cells.push(`<td>${badge(r.status)}</td>`);
        return `<tr>${cells.join('')}</tr>`;
      })
      .join('');
  }

  // ---------- ATTENDANCE ----------
  let attendanceRange = 'daily';

  document.querySelectorAll('#panel-attendance .tab-switch button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#panel-attendance .tab-switch button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      attendanceRange = btn.dataset.range;
      guarded(loadAttendance);
    });
  });

  const attendanceDateInput = document.getElementById('attendanceDate');
  attendanceDateInput.value = todayISO();
  attendanceDateInput.addEventListener('change', () => guarded(loadAttendance));

  async function loadAttendance() {
    if (isAdmin) {
      const date = attendanceDateInput.value || todayISO();
      const rows = await api(`/api/attendance?date=${encodeURIComponent(date)}`);
      const table = document.getElementById('attendanceAdminTable');
      const empty = document.getElementById('attendanceAdminEmpty');
      if (rows.length === 0) {
        table.style.display = 'none';
        empty.style.display = '';
        return;
      }
      table.style.display = '';
      empty.style.display = 'none';
      table.querySelector('thead').innerHTML =
        '<tr><th>Employee ID</th><th>Name</th><th>Check in</th><th>Check out</th><th>Status</th></tr>';
      table.querySelector('tbody').innerHTML = rows
        .map(
          (r) => `<tr>
            <td class="mono">${escapeHtml(r.employeeId)}</td>
            <td>${escapeHtml(r.fullName || '—')}</td>
            <td>${fmtTime(r.checkIn)}</td>
            <td>${fmtTime(r.checkOut)}</td>
            <td>${badge(r.status)}</td>
          </tr>`
        )
        .join('');
      return;
    }

    const rows = await api(`/api/attendance/me?range=${attendanceRange}`);
    const list = attendanceRange === 'daily' ? [rows] : rows;
    document.getElementById('checkInBtn2').disabled = attendanceRange === 'daily' && !!rows.checkIn;
    document.getElementById('checkOutBtn2').disabled =
      attendanceRange === 'daily' && (!rows.checkIn || !!rows.checkOut);

    const table = document.getElementById('attendanceTable');
    const empty = document.getElementById('attendanceEmpty');
    table.style.display = '';
    empty.style.display = 'none';
    table.querySelector('thead').innerHTML = '<tr><th>Date</th><th>Check in</th><th>Check out</th><th>Status</th></tr>';
    table.querySelector('tbody').innerHTML = list
      .map(
        (r) => `<tr>
          <td class="mono">${r.date}</td>
          <td>${fmtTime(r.checkIn)}</td>
          <td>${fmtTime(r.checkOut)}</td>
          <td>${badge(r.status)}</td>
        </tr>`
      )
      .join('');
  }

  // ---------- LEAVE ----------
  document.getElementById('leaveStart').addEventListener('change', (e) => {
    document.getElementById('leaveEnd').min = e.target.value;
  });

  document.getElementById('leaveForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('leaveSubmit');
    btn.disabled = true;
    await guarded(async () => {
      await api('/api/leave', {
        method: 'POST',
        body: {
          leaveType: document.getElementById('leaveType').value,
          startDate: document.getElementById('leaveStart').value,
          endDate: document.getElementById('leaveEnd').value,
          remarks: document.getElementById('leaveRemarks').value,
        },
      });
      toast('Leave request submitted.');
      document.getElementById('leaveForm').reset();
      loadLeave();
    });
    btn.disabled = false;
  });

  let leaveStatusFilter = '';
  document.querySelectorAll('#leaveFilterSwitch button').forEach((btn) => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#leaveFilterSwitch button').forEach((b) => b.classList.remove('active'));
      btn.classList.add('active');
      leaveStatusFilter = btn.dataset.status;
      guarded(loadLeave);
    });
  });

  let leaveDecisionTargetId = null;

  async function loadLeave() {
    const rows = isAdmin
      ? await api(`/api/leave${leaveStatusFilter ? `?status=${leaveStatusFilter}` : ''}`)
      : await api('/api/leave/me');

    const table = document.getElementById('leaveTable');
    const empty = document.getElementById('leaveEmpty');
    if (rows.length === 0) {
      table.style.display = 'none';
      empty.style.display = '';
      return;
    }
    table.style.display = '';
    empty.style.display = 'none';

    const cols = isAdmin
      ? ['Employee', 'Type', 'Dates', 'Remarks', 'Status', 'Comment', '']
      : ['Type', 'Dates', 'Remarks', 'Status', 'Comment'];
    table.querySelector('thead').innerHTML = `<tr>${cols.map((c) => `<th>${c}</th>`).join('')}</tr>`;

    table.querySelector('tbody').innerHTML = rows
      .map((r) => {
        const cells = [];
        if (isAdmin) cells.push(`<td>${escapeHtml(r.fullName || r.employeeId)}</td>`);
        cells.push(`<td class="mono">${r.leaveType}</td>`);
        cells.push(`<td>${r.startDate} → ${r.endDate}</td>`);
        cells.push(`<td>${escapeHtml(r.remarks) || '—'}</td>`);
        cells.push(`<td>${badge(r.status)}</td>`);
        cells.push(`<td>${escapeHtml(r.adminComment) || '—'}</td>`);
        if (isAdmin) {
          cells.push(
            `<td>${
              r.status === 'pending'
                ? `<button class="btn btn-ghost btn-sm decide-leave-btn" data-id="${r.id}" data-name="${escapeHtml(r.fullName || r.employeeId)}">Decide</button>`
                : ''
            }</td>`
          );
        }
        return `<tr>${cells.join('')}</tr>`;
      })
      .join('');

    if (isAdmin) {
      table.querySelectorAll('.decide-leave-btn').forEach((btn) => {
        btn.addEventListener('click', () => openLeaveDecisionModal(btn.dataset.id, btn.dataset.name));
      });
    }
  }

  const leaveDecisionModal = document.getElementById('leaveDecisionModal');
  function openLeaveDecisionModal(id, name) {
    leaveDecisionTargetId = id;
    document.getElementById('leaveDecisionMeta').textContent = name;
    document.getElementById('leaveDecisionComment').value = '';
    leaveDecisionModal.classList.add('show');
  }
  function closeLeaveDecisionModal() {
    leaveDecisionModal.classList.remove('show');
    leaveDecisionTargetId = null;
  }
  document.getElementById('leaveDecisionClose').addEventListener('click', closeLeaveDecisionModal);
  leaveDecisionModal.addEventListener('click', (e) => {
    if (e.target === leaveDecisionModal) closeLeaveDecisionModal();
  });

  async function decideLeave(decision) {
    if (!leaveDecisionTargetId) return;
    await guarded(async () => {
      await api(`/api/leave/${leaveDecisionTargetId}`, {
        method: 'PATCH',
        body: { decision, comment: document.getElementById('leaveDecisionComment').value },
      });
      toast(`Request ${decision}.`);
      closeLeaveDecisionModal();
      loadLeave();
    });
  }
  document.getElementById('leaveApproveBtn').addEventListener('click', () => decideLeave('approved'));
  document.getElementById('leaveRejectBtn').addEventListener('click', () => decideLeave('rejected'));

  // ---------- PAYROLL ----------
  function renderNetPay(el, salary) {
    if (!salary) {
      el.innerHTML = '<div class="empty-state">No salary record on file.</div>';
      return;
    }
    el.innerHTML = `
      <div class="line"><span>Basic</span><span>${fmtMoney(salary.basic)}</span></div>
      <div class="line"><span>HRA</span><span>${fmtMoney(salary.hra)}</span></div>
      <div class="line"><span>Allowances</span><span>${fmtMoney(salary.allowances)}</span></div>
      <div class="line"><span>Deductions</span><span>-${fmtMoney(salary.deductions)}</span></div>
      <div class="line total"><span>Net pay</span><span>${fmtMoney(salary.netPay)}</span></div>
    `;
  }

  async function loadPayroll() {
    const salary = await api('/api/payroll/me');
    renderNetPay(document.getElementById('payrollGrid'), salary);
  }

  // ---------- PROFILE (self) ----------
  async function loadProfile() {
    const p = await api('/api/profile/me');
    document.getElementById('profileJobGrid').innerHTML = `
      <div class="line"><span>Full name</span><span>${escapeHtml(p.personal.fullName) || '—'}</span></div>
      <div class="line"><span>Job title</span><span>${escapeHtml(p.job.jobTitle) || '—'}</span></div>
      <div class="line"><span>Department</span><span>${escapeHtml(p.job.department) || '—'}</span></div>
      <div class="line"><span>Date of joining</span><span>${p.job.dateOfJoining || '—'}</span></div>
    `;
    document.getElementById('profilePhone').value = p.personal.phone || '';
    document.getElementById('profileAddress').value = p.personal.address || '';
    document.getElementById('profilePicture').value = p.personal.profilePictureUrl || '';

    const docsEl = document.getElementById('profileDocs');
    const docsEmpty = document.getElementById('profileDocsEmpty');
    if (!p.personal.documents || p.personal.documents.length === 0) {
      docsEl.innerHTML = '';
      docsEmpty.style.display = '';
    } else {
      docsEmpty.style.display = 'none';
      docsEl.innerHTML = p.personal.documents
        .map((d) => `<div class="line"><span>${escapeHtml(d.name || d)}</span></div>`)
        .join('');
    }
  }

  document.getElementById('profileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('profileSubmit');
    btn.disabled = true;
    await guarded(async () => {
      await api('/api/profile/me', {
        method: 'PUT',
        body: {
          phone: document.getElementById('profilePhone').value,
          address: document.getElementById('profileAddress').value,
          profilePictureUrl: document.getElementById('profilePicture').value,
        },
      });
      toast('Profile updated.');
    });
    btn.disabled = false;
  });

  // ---------- EMPLOYEES (admin) ----------
  async function loadEmployees() {
    const rows = await api('/api/employees');
    const table = document.getElementById('employeesTable');
    const empty = document.getElementById('employeesEmpty');
    if (rows.length === 0) {
      table.style.display = 'none';
      empty.style.display = '';
      return;
    }
    table.style.display = '';
    empty.style.display = 'none';
    table.querySelector('thead').innerHTML =
      '<tr><th>Employee ID</th><th>Name</th><th>Job title</th><th>Department</th><th>Role</th><th>Verified</th></tr>';
    table.querySelector('tbody').innerHTML = rows
      .map(
        (r) => `<tr class="clickable" data-id="${r.id}">
          <td class="mono">${escapeHtml(r.employeeId)}</td>
          <td>${escapeHtml(r.fullName) || '—'}</td>
          <td>${escapeHtml(r.jobTitle) || '—'}</td>
          <td>${escapeHtml(r.department) || '—'}</td>
          <td>${r.role}</td>
          <td>${r.emailVerified ? '✓' : '—'}</td>
        </tr>`
      )
      .join('');
    table.querySelectorAll('tr[data-id]').forEach((tr) => {
      tr.addEventListener('click', () => guarded(() => openEmployeeModal(tr.dataset.id)));
    });
  }

  const employeeModal = document.getElementById('employeeModal');
  let employeeModalId = null;

  async function openEmployeeModal(id) {
    employeeModalId = id;
    const p = await api(`/api/employees/${id}`);

    document.getElementById('employeeModalName').textContent = p.personal.fullName || p.employeeId;
    document.getElementById('employeeModalMeta').textContent = `${p.employeeId} · ${p.email}`;

    document.getElementById('empFullName').value = p.personal.fullName || '';
    document.getElementById('empJobTitle').value = p.job.jobTitle || '';
    document.getElementById('empDepartment').value = p.job.department || '';
    document.getElementById('empDateOfJoining').value = p.job.dateOfJoining || '';
    document.getElementById('empPhone').value = p.personal.phone || '';
    document.getElementById('empAddress').value = p.personal.address || '';

    document.getElementById('empBasic').value = p.salary?.basic ?? 0;
    document.getElementById('empHra').value = p.salary?.hra ?? 0;
    document.getElementById('empAllowances').value = p.salary?.allowances ?? 0;
    document.getElementById('empDeductions').value = p.salary?.deductions ?? 0;

    const rows = await api(`/api/attendance/${id}`);
    const table = document.getElementById('empAttendanceTable');
    const empty = document.getElementById('empAttendanceEmpty');
    if (rows.length === 0) {
      table.style.display = 'none';
      empty.style.display = '';
    } else {
      table.style.display = '';
      empty.style.display = 'none';
      table.querySelector('thead').innerHTML = '<tr><th>Date</th><th>Check in</th><th>Check out</th><th>Status</th></tr>';
      table.querySelector('tbody').innerHTML = rows
        .slice(0, 14)
        .map(
          (r) => `<tr>
            <td class="mono">${r.date}</td>
            <td>${fmtTime(r.checkIn)}</td>
            <td>${fmtTime(r.checkOut)}</td>
            <td>${badge(r.status)}</td>
          </tr>`
        )
        .join('');
    }

    employeeModal.classList.add('show');
  }

  function closeEmployeeModal() {
    employeeModal.classList.remove('show');
    employeeModalId = null;
  }
  document.getElementById('employeeModalClose').addEventListener('click', closeEmployeeModal);
  employeeModal.addEventListener('click', (e) => {
    if (e.target === employeeModal) closeEmployeeModal();
  });

  document.getElementById('employeeProfileForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!employeeModalId) return;
    const btn = document.getElementById('empProfileSubmit');
    btn.disabled = true;
    await guarded(async () => {
      await api(`/api/employees/${employeeModalId}`, {
        method: 'PUT',
        body: {
          fullName: document.getElementById('empFullName').value,
          jobTitle: document.getElementById('empJobTitle').value,
          department: document.getElementById('empDepartment').value,
          dateOfJoining: document.getElementById('empDateOfJoining').value || null,
          phone: document.getElementById('empPhone').value,
          address: document.getElementById('empAddress').value,
        },
      });
      toast('Employee profile updated.');
      loadEmployees();
    });
    btn.disabled = false;
  });

  document.getElementById('employeeSalaryForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!employeeModalId) return;
    const btn = document.getElementById('empSalarySubmit');
    btn.disabled = true;
    await guarded(async () => {
      await api(`/api/payroll/${employeeModalId}`, {
        method: 'PUT',
        body: {
          basic: Number(document.getElementById('empBasic').value),
          hra: Number(document.getElementById('empHra').value),
          allowances: Number(document.getElementById('empAllowances').value),
          deductions: Number(document.getElementById('empDeductions').value),
        },
      });
      toast('Salary updated.');
    });
    btn.disabled = false;
  });

  // ---------- boot ----------
  guarded(loadOverview);
})();
