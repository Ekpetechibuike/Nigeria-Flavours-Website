// Mock authentication module for demonstration purposes
// In a real application, this would involve API calls to a backend server
// This mock module allows us to simulate login/logout without a server

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

async function hashPassword(value) {
  const text = (value || '').toString();
  if (!text) return '';

  if (window.crypto && window.crypto.subtle && typeof TextEncoder !== 'undefined') {
    const encoded = new TextEncoder().encode(text);
    const buffer = await window.crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(buffer)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  let hash = 0;
  for (let index = 0; index < text.length; index += 1) {
    hash = (hash * 31 + text.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
}

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || '').trim());
}

function validatePhone(phone) {
  return /^[0-9+()\-\s]{7,20}$/.test((phone || '').trim());
}

function getRegisteredUsers() {
  const users = safeJsonParse(authStorage.get('registeredUsers'), []);
  return Array.isArray(users) ? users : [];
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
    try {
      const normalizedInput = (username || '').toString().trim().toLowerCase();
      const trimmedPassword = (password || '').toString();

      if (!normalizedInput || !trimmedPassword) {
        throw new Error('Please enter both username and password');
      }

      let users = [];
      try {
        const response = await fetch('users.json', { cache: 'no-store' });
        if (response.ok) {
          users = await response.json();
        }
      } catch (error) {
        console.log('Could not load users.json, using localStorage only');
      }

      const registeredUsers = getRegisteredUsers();
      users = [...users, ...registeredUsers];

      const passwordHash = await hashPassword(trimmedPassword);

      const user = users.find((u) => {
        const storedUsername = (u.username || '').toString().trim().toLowerCase();
        const storedEmail = (u.email || '').toString().trim().toLowerCase();
        const storedHash = (u.passwordHash || u.password || '').toString();
        const matchesHash = storedHash === passwordHash;
        const matchesLegacy = String(u.password || '') === String(trimmedPassword);
        return (storedUsername === normalizedInput || storedEmail === normalizedInput) && (matchesHash || matchesLegacy);
      });

      if (!user) {
        throw new Error('Invalid username or password');
      }

      const token = 'sess_' + Date.now() + '_' + Math.random().toString(16).slice(2);
      setCurrentUser(user, token);
      window.location.href = 'index.html';
      return user;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

  register: async function(email, phone, username, password) {
    try {
      const trimmedEmail = (email || '').toString().trim();
      const trimmedPhone = (phone || '').toString().trim();
      const trimmedUsername = (username || '').toString().trim();
      const trimmedPassword = (password || '').toString();

      if (!trimmedEmail || !trimmedPhone || !trimmedUsername || !trimmedPassword) {
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

      if (trimmedPassword.length < 6) {
        throw new Error('Password must be at least 6 characters long');
      }

      let users = [];
      try {
        const response = await fetch('users.json', { cache: 'no-store' });
        if (response.ok) {
          users = await response.json();
        }
      } catch (error) {
        console.log('Could not load users.json, using localStorage only');
      }

      const registeredUsers = getRegisteredUsers();
      users = [...users, ...registeredUsers];

      const normalizedUsername = trimmedUsername.toLowerCase();
      const normalizedEmail = trimmedEmail.toLowerCase();

      if (users.some((u) => (u.username || '').toString().trim().toLowerCase() === normalizedUsername)) {
        throw new Error('Username already exists');
      }

      if (users.some((u) => (u.email || '').toString().trim().toLowerCase() === normalizedEmail)) {
        throw new Error('Email already exists');
      }

      const newUser = {
        id: Date.now(),
        email: trimmedEmail,
        username: trimmedUsername,
        passwordHash: await hashPassword(trimmedPassword),
        phone: trimmedPhone,
        loginDate: new Date().toISOString(),
        image: 'assets/images/default-avatar.svg'
      };

      const localUsers = getRegisteredUsers();
      localUsers.push(newUser);
      localStorage.setItem('registeredUsers', JSON.stringify(localUsers));

      const token = 'auth-token-' + Date.now();
      setCurrentUser(newUser, token);
      window.location.href = 'index.html';
      return newUser;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
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
