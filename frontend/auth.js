/**
 * Neuro Music Authentication Frontend
 * Handles login, registration, and password reset forms
 */
(function() {
  'use strict';

  // ============================================================================
  // STATE & CONFIG
  // ============================================================================
  const API_BASE = '/api/auth';
  const state = {
    activeTab: 'login', // 'login', 'register', 'forgot'
    isSubmitting: false,
  };

  // ============================================================================
  // DOM ELEMENTS
  // ============================================================================
  const elements = {
    tabs: {
      login: document.getElementById('tab-login'),
      register: document.getElementById('tab-register'),
    },
    forms: {
      login: document.getElementById('form-login'),
      register: document.getElementById('form-register'),
      forgot: document.getElementById('form-forgot'),
    },
    message: document.getElementById('authMessage'),
    forgotLink: document.getElementById('forgot-link'),
    backToLogin: document.getElementById('back-to-login'),
  };

  // ============================================================================
  // UTILITY FUNCTIONS
  // ============================================================================
  function showMessage(text, type = 'error') {
    const el = elements.message;
    el.textContent = text;
    el.className = 'auth-message ' + type;
    el.hidden = false;
  }

  function hideMessage() {
    const el = elements.message;
    el.textContent = '';
    el.className = 'auth-message';
    el.hidden = true;
  }

  function showFieldError(fieldId, message) {
    const errorEl = document.getElementById(fieldId + '-error');
    const inputEl = document.getElementById(fieldId);
    if (errorEl) {
      errorEl.textContent = message;
      errorEl.hidden = false;
    }
    if (inputEl) {
      inputEl.classList.add('input-error');
      inputEl.setAttribute('aria-invalid', 'true');
    }
  }

  function clearFieldError(fieldId) {
    const errorEl = document.getElementById(fieldId + '-error');
    const inputEl = document.getElementById(fieldId);
    if (errorEl) {
      errorEl.textContent = '';
      errorEl.hidden = true;
    }
    if (inputEl) {
      inputEl.classList.remove('input-error');
      inputEl.removeAttribute('aria-invalid');
    }
  }

  function clearAllErrors(form) {
    form.querySelectorAll('.form-error').forEach(el => {
      el.textContent = '';
      el.hidden = true;
    });
    form.querySelectorAll('.form-input').forEach(el => {
      el.classList.remove('input-error');
      el.removeAttribute('aria-invalid');
    });
  }

  function setSubmitting(form, submitting) {
    const submitBtn = form.querySelector('.auth-submit');
    const btnText = submitBtn.querySelector('.btn-text');
    const btnLoader = submitBtn.querySelector('.btn-loader');
    state.isSubmitting = submitting;
    submitBtn.disabled = submitting;
    if (submitting) {
      btnText.textContent = 'Please wait...';
      btnLoader.hidden = false;
    } else {
      btnText.textContent = form.id === 'form-login' ? 'Sign In' : (form.id === 'form-register' ? 'Create Account' : 'Send Reset Link');
      btnLoader.hidden = true;
    }
  }

  function switchTab(tabName) {
    state.activeTab = tabName;

    // Update tabs
    Object.values(elements.tabs).forEach(tab => {
      tab.classList.remove('active');
      tab.setAttribute('aria-selected', 'false');
    });
    elements.tabs[tabName].classList.add('active');
    elements.tabs[tabName].setAttribute('aria-selected', 'true');

    // Update forms
    Object.values(elements.forms).forEach(form => {
      form.classList.remove('active');
      form.hidden = true;
    });
    elements.forms[tabName].classList.add('active');
    elements.forms[tabName].hidden = false;

    hideMessage();
    clearAllErrors(elements.forms[tabName]);
  }

  function togglePasswordVisibility(button) {
    const targetId = button.dataset.target;
    const input = document.getElementById(targetId);
    const icon = button.querySelector('i');
    if (!input || !icon) return;

    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    icon.setAttribute('data-lucide', isPassword ? 'eye-off' : 'eye');
    button.setAttribute('aria-label', isPassword ? 'Hide password' : 'Show password');
    lucide.createIcons();
  }

  // ============================================================================
  // VALIDATION
  // ============================================================================
  function validateEmail(email) {
    // Basic email validation
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
  }

  function validatePassword(password) {
    if (password.length < 8) return 'Password must be at least 8 characters';
    if (!/[A-Za-z]/.test(password)) return 'Password must contain at least one letter';
    if (!/[0-9]/.test(password)) return 'Password must contain at least one number';
    const common = ['password', '12345678', '123456789', 'qwerty123', 'password123', 'admin123', 'welcome123', 'letmein', 'monkey', 'dragon', 'sunshine', 'iloveyou', 'princess', 'football', 'baseball', 'abc123', 'password1', '1234567', '123123', 'qwertyuiop'];
    if (common.includes(password.toLowerCase())) return 'Password is too common, please choose a stronger one';
    return null;
  }

  function validateLoginForm(formData) {
    let valid = true;

    if (!formData.email) {
      showFieldError('login-email', 'Email is required');
      valid = false;
    } else if (!validateEmail(formData.email)) {
      showFieldError('login-email', 'Please enter a valid email address');
      valid = false;
    } else {
      clearFieldError('login-email');
    }

    if (!formData.password) {
      showFieldError('login-password', 'Password is required');
      valid = false;
    } else {
      clearFieldError('login-password');
    }

    return valid;
  }

  function validateRegisterForm(formData) {
    let valid = true;

    if (!formData.display_name || !formData.display_name.trim()) {
      showFieldError('register-name', 'Display name is required');
      valid = false;
    } else if (formData.display_name.trim().length > 40) {
      showFieldError('register-name', 'Display name must be 40 characters or less');
      valid = false;
    } else {
      clearFieldError('register-name');
    }

    if (!formData.email) {
      showFieldError('register-email', 'Email is required');
      valid = false;
    } else if (!validateEmail(formData.email)) {
      showFieldError('register-email', 'Please enter a valid email address');
      valid = false;
    } else {
      clearFieldError('register-email');
    }

    const pwdError = validatePassword(formData.password);
    if (pwdError) {
      showFieldError('register-password', pwdError);
      valid = false;
    } else {
      clearFieldError('register-password');
    }

    if (!formData.confirm_password) {
      showFieldError('register-confirm', 'Please confirm your password');
      valid = false;
    } else if (formData.password !== formData.confirm_password) {
      showFieldError('register-confirm', 'Passwords do not match');
      valid = false;
    } else {
      clearFieldError('register-confirm');
    }

    return valid;
  }

  function validateForgotForm(formData) {
    let valid = true;

    if (!formData.email) {
      showFieldError('forgot-email', 'Email is required');
      valid = false;
    } else if (!validateEmail(formData.email)) {
      showFieldError('forgot-email', 'Please enter a valid email address');
      valid = false;
    } else {
      clearFieldError('forgot-email');
    }

    return valid;
  }

  // ============================================================================
  // API CALLS
  // ============================================================================
  async function apiRequest(endpoint, data) {
    const response = await fetch(API_BASE + endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      credentials: 'include', // Important for cookies
      body: JSON.stringify(data),
    });

    const result = await response.json().catch(() => ({}));

    if (!response.ok) {
      const error = new Error(result.detail || 'Request failed');
      error.status = response.status;
      error.detail = result.detail;
      throw error;
    }

    return result;
  }

  async function handleLogin(formData) {
    const result = await apiRequest('/login', {
      email: formData.email,
      password: formData.password,
    });
    return result;
  }

  async function handleRegister(formData) {
    const result = await apiRequest('/register', {
      email: formData.email,
      password: formData.password,
      display_name: formData.display_name.trim(),
    });
    return result;
  }

  async function handleForgot(formData) {
    const result = await apiRequest('/forgot-password', {
      email: formData.email,
    });
    return result;
  }

  // ============================================================================
  // FORM SUBMISSION HANDLERS
  // ============================================================================
  async function onLoginSubmit(e) {
    e.preventDefault();
    if (state.isSubmitting) return;

    const form = elements.forms.login;
    const formData = new FormData(form);
    const data = {
      email: formData.get('email').trim().toLowerCase(),
      password: formData.get('password'),
    };

    hideMessage();
    clearAllErrors(form);

    if (!validateLoginForm(data)) return;

    setSubmitting(form, true);

    try {
      await handleLogin(data);
      // Success - redirect to home
      window.location.href = '/';
    } catch (err) {
      setSubmitting(form, false);
      if (err.status === 429) {
        showMessage('Too many failed attempts. Please try again in 15 minutes.', 'error');
      } else if (err.status === 401) {
        showMessage('Invalid email or password', 'error');
      } else {
        showMessage(err.detail || 'Login failed. Please try again.', 'error');
      }
    }
  }

  async function onRegisterSubmit(e) {
    e.preventDefault();
    if (state.isSubmitting) return;

    const form = elements.forms.register;
    const formData = new FormData(form);
    const data = {
      display_name: formData.get('display_name').trim(),
      email: formData.get('email').trim().toLowerCase(),
      password: formData.get('password'),
      confirm_password: formData.get('confirm_password'),
    };

    hideMessage();
    clearAllErrors(form);

    if (!validateRegisterForm(data)) return;

    setSubmitting(form, true);

    try {
      await handleRegister(data);
      // Success - redirect to home
      window.location.href = '/';
    } catch (err) {
      setSubmitting(form, false);
      if (err.status === 400) {
        showMessage('Registration failed. Email may already be in use.', 'error');
      } else {
        showMessage(err.detail || 'Registration failed. Please try again.', 'error');
      }
    }
  }

  async function onForgotSubmit(e) {
    e.preventDefault();
    if (state.isSubmitting) return;

    const form = elements.forms.forgot;
    const formData = new FormData(form);
    const data = {
      email: formData.get('email').trim().toLowerCase(),
    };

    hideMessage();
    clearAllErrors(form);

    if (!validateForgotForm(data)) return;

    setSubmitting(form, true);

    try {
      const result = await handleForgot(data);
      showMessage(result.message || 'If the email exists, a reset link has been sent', 'success');
      form.reset();
      // Switch back to login after a delay
      setTimeout(() => switchTab('login'), 3000);
    } catch (err) {
      setSubmitting(form, false);
      showMessage(err.detail || 'Failed to send reset link. Please try again.', 'error');
    }
  }

  // ============================================================================
  // EVENT LISTENERS
  // ============================================================================
  function initEventListeners() {
    // Tab switching
    elements.tabs.login.addEventListener('click', () => switchTab('login'));
    elements.tabs.register.addEventListener('click', () => switchTab('register'));

    // Form submissions
    elements.forms.login.addEventListener('submit', onLoginSubmit);
    elements.forms.register.addEventListener('submit', onRegisterSubmit);
    elements.forms.forgot.addEventListener('submit', onForgotSubmit);

    // Forgot password link
    elements.forgotLink.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab('forgot');
    });

    // Back to login link
    elements.backToLogin.addEventListener('click', (e) => {
      e.preventDefault();
      switchTab('login');
    });

    // Password visibility toggles
    document.querySelectorAll('.toggle-password').forEach(btn => {
      btn.addEventListener('click', () => togglePasswordVisibility(btn));
    });

    // Clear errors on input
    document.querySelectorAll('.form-input').forEach(input => {
      input.addEventListener('input', () => clearFieldError(input.id));
      input.addEventListener('blur', () => {
        // Validate on blur for immediate feedback
        const form = input.closest('form');
        if (!form) return;
        const formData = new FormData(form);
        const data = {};
        for (const [key, value] of formData.entries()) {
          data[key] = value;
        }
        if (form.id === 'form-login') validateLoginForm(data);
        else if (form.id === 'form-register') validateRegisterForm(data);
        else if (form.id === 'form-forgot') validateForgotForm(data);
      });
    });

    // Check if already authenticated on page load
    checkAuthStatus();
  }

  // ============================================================================
  // AUTH STATUS CHECK
  // ============================================================================
  async function checkAuthStatus() {
    try {
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });
      if (response.ok) {
        // Already logged in, redirect to home
        window.location.href = '/';
      }
    } catch (e) {
      // Not authenticated, stay on login page
    }
  }

  // ============================================================================
  // INITIALIZATION
  // ============================================================================
  document.addEventListener('DOMContentLoaded', () => {
    initEventListeners();
    // Ensure Lucide icons are created
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  });
})();