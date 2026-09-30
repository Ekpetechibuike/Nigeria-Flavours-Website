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

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || '').trim());
}

function validatePhone(phone) {
  return /^[0-9+()\-\s]{7,20}$/.test((phone || '').trim());
}

function getRegisteredUsers() {
  const users = safeJsonParse(localStorage.getItem('registeredUsers'), []);
  return Array.isArray(users) ? users : [];
}

function setCurrentUser(user, token) {
  localStorage.setItem('authToken', token);
  localStorage.setItem('user', JSON.stringify(user));
  if (typeof updateProfileNav === 'function') {
    updateProfileNav(user);
  }
}

// Check if user is currently authenticated
function isAuthenticated() {
  const token = localStorage.getItem('authToken');
  const user = localStorage.getItem('user');
  return !!(token && user);
}

// Get the logged-in user object
function getCurrentUser() {
  const userStr = localStorage.getItem('user');
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

      const user = users.find((u) => {
        const storedUsername = (u.username || '').toString().trim().toLowerCase();
        const storedEmail = (u.email || '').toString().trim().toLowerCase();
        return (storedUsername === normalizedInput || storedEmail === normalizedInput) && String(u.password) === String(trimmedPassword);
      });

      if (!user) {
        throw new Error('Invalid username or password');
      }

      const token = 'auth-token-' + Date.now();
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
        password: trimmedPassword,
        phone: trimmedPhone,
        loginDate: new Date().toISOString(),
        image: 'assets/images/default-avatar.jpg'
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
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');

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
    const user = safeJsonParse(localStorage.getItem('user'), {});
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
