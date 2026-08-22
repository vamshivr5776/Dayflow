(function () {
  // If already signed in, skip straight to the dashboard.
  if (Session.token()) {
    location.href = 'dashboard.html';
    return;
  }

  const els = {
    toggleSignin: document.getElementById('toggleSignin'),
    toggleSignup: document.getElementById('toggleSignup'),
    formTitle: document.getElementById('formTitle'),
    formSub: document.getElementById('formSub'),

    signinForm: document.getElementById('signinForm'),
    signinBanner: document.getElementById('signinBanner'),
    signinBannerText: document.getElementById('signinBannerText'),
    signinEmail: document.getElementById('signinEmail'),
    signinPassword: document.getElementById('signinPassword'),
    signinSubmit: document.getElementById('signinSubmit'),
    forgotPassword: document.getElementById('forgotPassword'),

    signupForm: document.getElementById('signupForm'),
    signupBanner: document.getElementById('signupBanner'),
    signupBannerText: document.getElementById('signupBannerText'),
    verifyBanner: document.getElementById('verifyBanner'),
    verifyBannerText: document.getElementById('verifyBannerText'),
    signupFields: document.getElementById('signupFields'),
    signupEmployeeId: document.getElementById('signupEmployeeId'),
    signupEmail: document.getElementById('signupEmail'),
    signupPassword: document.getElementById('signupPassword'),
    signupSubmit: document.getElementById('signupSubmit'),

    verifyFields: document.getElementById('verifyFields'),
    verifyCode: document.getElementById('verifyCode'),
    verifySubmit: document.getElementById('verifySubmit'),
  };

  let pendingSignupEmail = null;
  let selectedRole = 'employee';

  const TITLES = {
    signin: ['Welcome back', 'Sign in with your work email to continue.'],
    signup: ['Create your account', 'Set up access, then verify your email to sign in.'],
  };

  function setMode(mode) {
    const isSignin = mode === 'signin';
    els.toggleSignin.classList.toggle('active', isSignin);
    els.toggleSignup.classList.toggle('active', !isSignin);
    els.signinForm.classList.toggle('active', isSignin);
    els.signupForm.classList.toggle('active', !isSignin);
    els.formTitle.textContent = TITLES[mode][0];
    els.formSub.textContent = TITLES[mode][1];
    hideBanner(els.signinBanner);
    hideBanner(els.signupBanner);
    hideBanner(els.verifyBanner);
  }

  function showBanner(el, textEl, message, variant) {
    textEl.textContent = message;
    el.classList.add('show');
    el.classList.toggle('success', variant === 'success');
  }
  function hideBanner(el) {
    el.classList.remove('show');
  }

  function restartSignup() {
    pendingSignupEmail = null;
    els.signupFields.style.display = '';
    els.verifyFields.style.display = 'none';
    hideBanner(els.verifyBanner);
    hideBanner(els.signupBanner);
    els.signupEmployeeId.value = '';
    els.signupEmail.value = '';
    els.signupPassword.value = '';
  }

  els.toggleSignin.addEventListener('click', () => setMode('signin'));
  els.toggleSignup.addEventListener('click', () => setMode('signup'));

  document.querySelectorAll('[data-switch]').forEach((link) => {
    link.addEventListener('click', (e) => {
      e.preventDefault();
      const target = link.dataset.switch;
      if (target === 'signup-restart') {
        restartSignup();
        setMode('signup');
        return;
      }
      setMode(target);
    });
  });

  els.forgotPassword.addEventListener('click', (e) => {
    e.preventDefault();
    showBanner(
      els.signinBanner,
      els.signinBannerText,
      "Password resets aren't available in this demo — contact your HR admin to reset it."
    );
  });

  // Password visibility toggles
  document.querySelectorAll('.toggle-visibility').forEach((btn) => {
    btn.addEventListener('click', () => {
      const input = document.getElementById(btn.dataset.target);
      input.type = input.type === 'password' ? 'text' : 'password';
    });
  });

  // Role selector
  document.querySelectorAll('.role-option').forEach((label) => {
    label.addEventListener('click', () => {
      document.querySelectorAll('.role-option').forEach((l) => l.classList.remove('selected'));
      label.classList.add('selected');
      label.querySelector('input').checked = true;
      selectedRole = label.dataset.role;
    });
  });

  function setLoading(btn, loading, label) {
    btn.disabled = loading;
    btn.textContent = loading ? 'Please wait…' : label;
  }

  // ---- SIGN IN ----
  els.signinForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideBanner(els.signinBanner);

    const email = els.signinEmail.value.trim();
    const password = els.signinPassword.value;
    if (!email || !password) {
      return showBanner(els.signinBanner, els.signinBannerText, 'Enter your email and password.');
    }

    setLoading(els.signinSubmit, true, 'Sign in');
    try {
      const data = await api('/api/auth/signin', { method: 'POST', body: { email, password }, auth: false });
      Session.save(data.token, data.user);
      location.href = 'dashboard.html';
    } catch (err) {
      showBanner(els.signinBanner, els.signinBannerText, err.message);
    } finally {
      setLoading(els.signinSubmit, false, 'Sign in');
    }
  });

  // ---- SIGN UP ----
  els.signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (pendingSignupEmail) return; // verify step is showing; ignore stray submits
    hideBanner(els.signupBanner);

    const employeeId = els.signupEmployeeId.value.trim();
    const email = els.signupEmail.value.trim();
    const password = els.signupPassword.value;

    if (!employeeId) return showBanner(els.signupBanner, els.signupBannerText, 'Employee ID is required.');
    if (!email) return showBanner(els.signupBanner, els.signupBannerText, 'Enter a valid email address.');
    const strong = password.length >= 8 && /[A-Z]/.test(password) && /[0-9]/.test(password);
    if (!strong) {
      return showBanner(
        els.signupBanner,
        els.signupBannerText,
        'Password must be 8+ characters with one uppercase letter and one number.'
      );
    }

    setLoading(els.signupSubmit, true, 'Create account');
    try {
      const data = await api('/api/auth/signup', {
        method: 'POST',
        body: { employeeId, email, password, role: selectedRole },
        auth: false,
      });

      pendingSignupEmail = email;
      els.signupFields.style.display = 'none';
      els.verifyFields.style.display = 'flex';
      showBanner(
        els.verifyBanner,
        els.verifyBannerText,
        `Account created for ${email}. Dev verification code: ${data.devOnlyVerificationCode}`
      );
      els.verifyCode.value = data.devOnlyVerificationCode || '';
    } catch (err) {
      showBanner(els.signupBanner, els.signupBannerText, err.message);
    } finally {
      setLoading(els.signupSubmit, false, 'Create account');
    }
  });

  // ---- VERIFY EMAIL ----
  els.verifySubmit.addEventListener('click', async () => {
    if (!pendingSignupEmail) return;
    const code = els.verifyCode.value.trim();
    if (!code) {
      return showBanner(els.signupBanner, els.signupBannerText, 'Enter the verification code.');
    }

    setLoading(els.verifySubmit, true, 'Verify email');
    try {
      await api('/api/auth/verify-email', {
        method: 'POST',
        body: { email: pendingSignupEmail, code },
        auth: false,
      });

      els.signinEmail.value = pendingSignupEmail;
      restartSignup();
      setMode('signin');
      showBanner(els.signinBanner, els.signinBannerText, 'Email verified — you can sign in now.', 'success');
    } catch (err) {
      showBanner(els.signupBanner, els.signupBannerText, err.message);
    } finally {
      setLoading(els.verifySubmit, false, 'Verify email');
    }
  });

  setMode('signin');
})();
