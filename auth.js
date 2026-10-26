// Authentication module. Login and registration go through the server API
// (see server/server.js); the server issues a signed session token.

// ========== CENTRALIZED AUTHENTICATION FUNCTIONS ==========

function safeJsonParse(value, fallback) {
  try {
    const parsed = JSON.parse(value || 'null');
    return parsed ?? fallback;
  } catch (error) {
    return fallback;
  }
}

function getAuthStorage() {
  try {
    const session = typeof sessionStorage !== 'undefined' ? sessionStorage : null;
    const local = typeof localStorage !== 'undefined' ? localStorage : null;

    return {
      get(key) {
        return (session && session.getItem(key)) ?? (local && local.getItem(key));
      },
      set(key, value) {
        if (typeof value !== 'string') return;
        if (session) session.setItem(key, value);
        if (local) local.removeItem(key);
      },
      remove(key) {
        if (session) session.removeItem(key);
        if (local) local.removeItem(key);
      }
    };
  } catch (error) {
    return {
      get: () => null,
      set: () => {},
      remove: () => {}
    };
  }
}

const authStorage = getAuthStorage();

// ========== API HELPERS ==========

function getApiBase() {
  if (window.APP_API_BASE) return String(window.APP_API_BASE).replace(/\/$/, '');
  const host = window.location.hostname;
  const isLocal = host === 'localhost' || host === '127.0.0.1';
  // When the page is served by the Express server itself (port 5000), use same-origin.
  if (isLocal && window.location.port !== '5000') return 'http://localhost:5000/api';
  return '/api';
}

function getAuthToken() {
  return authStorage.get('authToken') || '';
}

async function apiRequest(path, options = {}) {
  let response;
  try {
    response = await fetch(getApiBase() + path, options);
  } catch (error) {
    throw new Error('Could not reach the server. Please check your connection and try again.');
  }
  let data = {};
  try { data = await response.json(); } catch (error) { /* non-JSON body */ }
  if (!response.ok) {
    const err = new Error(data.error || 'Something went wrong. Please try again.');
    err.status = response.status;
    throw err;
  }
  return data;
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || '').trim());
}

function validatePhone(phone) {
  return /^[0-9+()\-\s]{7,20}$/.test((phone || '').trim());
}

function setCurrentUser(user, token) {
  authStorage.set('authToken', token);
  authStorage.set('user', JSON.stringify(user));
  if (typeof updateProfileNav === 'function') {
    updateProfileNav(user);
  }
}

// Check if user is currently authenticated
function isAuthenticated() {
  const token = authStorage.get('authToken');
  const user = authStorage.get('user');
  return !!(token && user);
}

// Get the logged-in user object
function getCurrentUser() {
  const userStr = authStorage.get('user');
  return userStr ? JSON.parse(userStr) : null;
}

// Redirect to login page if not authenticated
// Use this on protected pages (index.html, profile.html, etc.)
function requireAuth() {
  if (!isAuthenticated()) {
    window.location.href = 'login.html';
    return false;
  }
  return true;
}

// Redirect to home page if already authenticated  
// Use this on login.html and register.html
function checkGuest() {
  if (isAuthenticated()) {
    window.location.href = 'index.html';
    return false;
  }
  return true;
}

// Unified auth initialization for all pages
// Call this on DOMContentLoaded in each page
function handleAuthRedirects() {
  const path = window.location.pathname;
  const page = path.split('/').pop() || 'index.html';

  const protectedPages = ['index.html', 'profile.html', 'reservations-board.html'];
  const guestPages = ['login.html', 'register.html'];

  if (protectedPages.includes(page)) {
    requireAuth();
  } else if (guestPages.includes(page)) {
    checkGuest();
  }
}

// ========== window.auth OBJECT ==========

window.auth = {
  isAuthenticated: function() {
    return isAuthenticated();
  },

  login: async function(username, password) {
    const identifier = (username || '').toString().trim();
    const secret = (password || '').toString();

    if (!identifier || !secret) {
      throw new Error('Please enter both username and password');
    }

    const data = await apiRequest('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username: identifier, password: secret })
    });

    setCurrentUser(data.user, data.token);
    window.location.href = 'index.html';
    return data.user;
  },

  register: async function(email, phone, username, password) {
    const trimmedEmail = (email || '').toString().trim();
    const trimmedPhone = (phone || '').toString().trim();
    const trimmedUsername = (username || '').toString().trim();
    const secret = (password || '').toString();

    if (!trimmedEmail || !trimmedPhone || !trimmedUsername || !secret) {
      throw new Error('Please fill in all required fields');
    }
    if (!validateEmail(trimmedEmail)) {
      throw new Error('Please provide a valid email address');
    }
    if (!validatePhone(trimmedPhone)) {
      throw new Error('Please provide a valid phone number');
    }
    if (trimmedUsername.length < 3) {
      throw new Error('Username must be at least 3 characters long');
    }
    if (secret.length < 6) {
      throw new Error('Password must be at least 6 characters long');
    }

    const data = await apiRequest('/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: trimmedEmail, phone: trimmedPhone, username: trimmedUsername, password: secret })
    });

    setCurrentUser(data.user, data.token);
    window.location.href = 'index.html';
    return data.user;
  },

  logout: function() {
    try {
      authStorage.remove('authToken');
      authStorage.remove('user');
      localStorage.removeItem('registeredUsers');

      const loginNavLink = document.getElementById('loginNavLink');
      const profileNavLink = document.getElementById('profileNavLink');
      const logoutNavBtn = document.getElementById('logoutNavBtn');
      const profileNavInfo = document.getElementById('profileNavInfo');

      if (profileNavInfo) profileNavInfo.classList.add('hidden');
      if (profileNavLink) profileNavLink.classList.add('hidden');
      if (logoutNavBtn) logoutNavBtn.classList.add('hidden');
      if (loginNavLink) loginNavLink.classList.remove('hidden');

      const nav = document.getElementById('nav');
      if (nav) nav.dataset.open = 'false';
      const navToggle = document.getElementById('navToggle');
      if (navToggle) navToggle.setAttribute('aria-expanded', 'false');

      window.location.href = 'login.html';
    } catch (error) {
      console.error('Logout error:', error);
      window.location.href = 'login.html';
    }
  }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  if (window.auth.isAuthenticated()) {
    const user = safeJsonParse(authStorage.get('user'), {});
    if (typeof updateProfileNav === 'function') {
      updateProfileNav(user);
    }
  }
});

// Helper functions for feedback messages (shared across pages)
function showError(message, container = document) {
  const errorDiv = container.getElementById('errorMessage');
  if (errorDiv) {
    errorDiv.textContent = message;
    errorDiv.style.display = 'block';
    errorDiv.scrollIntoView({ behavior: 'smooth' });
  } else {
    alert(message);
  }
  setTimeout(() => {
    if (errorDiv) errorDiv.style.display = 'none';
  }, 5000);
}

function showSuccess(message, container = document) {
  const successDiv = container.getElementById('successMessage');
  if (successDiv) {
    successDiv.textContent = message;
    successDiv.style.display = 'block';
    successDiv.scrollIntoView({ behavior: 'smooth' });
  } else {
    alert(message);
  }
  setTimeout(() => {
    if (successDiv) successDiv.style.display = 'none';
  }, 3000);
}

function showSuccess(message, container = document) {
  const successDiv = container.getElementById('successMessage');
  if (successDiv) {
    successDiv.textContent = message;
    successDiv.style.display = 'block';
  } else {
    alert(message);
  }
}
