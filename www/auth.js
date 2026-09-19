// Mock authentication module for demonstration purposes
// In a real application, this would involve API calls to a backend server
// This mock module allows us to simulate login/logout without a server

// ========== CENTRALIZED AUTHENTICATION FUNCTIONS ==========

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
  
  // Pages that require authentication
  const protectedPages = ['index.html', 'profile.html', 'reservations-board.html'];
  
  // Pages only for guests (not logged in)
  const guestPages = ['login.html', 'register.html'];
  
  if (protectedPages.includes(page)) {
    // Redirect to login if not authenticated
    requireAuth();
  } else if (guestPages.includes(page)) {
    // Redirect to home if already authenticated
    checkGuest();
  }
}

// ========== window.auth OBJECT ==========

// Define window.auth object with all required methods
window.auth = {
  // Check if user is authenticated
  isAuthenticated: function() {
    return isAuthenticated();
  },

// Login function
  login: async function(username, password) {
    try {
      const normalizedInput = (username || '').toString().trim().toLowerCase();
      let users = [];
      try {
        const response = await fetch('users.json', { cache: 'no-store' });
        if (response.ok) {
          users = await response.json();
        }
      } catch (e) {
        console.log('Could not load users.json, using localStorage only');
      }
      
      const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
      users = [...users, ...registeredUsers];
      
      const user = users.find(u => {
        const storedUsername = (u.username || '').toString().trim().toLowerCase();
        const storedEmail = (u.email || '').toString().trim().toLowerCase();
        return (storedUsername === normalizedInput || storedEmail === normalizedInput) && String(u.password) === String(password);
      });
      
      if (!user) {
        throw new Error('Invalid username or password');
      }
      
      const token = 'auth-token-' + Date.now();
      localStorage.setItem('authToken', token);
      localStorage.setItem('user', JSON.stringify(user));
      updateProfileNav(user);
      window.location.href = 'index.html';
      
      return user;
    } catch (error) {
      console.error('Login error:', error);
      throw error;
    }
  },

// Register function
  register: async function(email, phone, username, password) {
    try {
      let users = [];
      try {
        const response = await fetch('users.json', { cache: 'no-store' });
        if (response.ok) {
          users = await response.json();
        }
      } catch (e) {
        console.log('Could not load users.json, using localStorage only');
      }
      
      const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
      users = [...users, ...registeredUsers];
      
      const normalizedUsername = (username || '').toString().trim().toLowerCase();
      const normalizedEmail = (email || '').toString().trim().toLowerCase();
      
      if (users.some(u => (u.username || '').toString().trim().toLowerCase() === normalizedUsername)) {
        throw new Error('Username already exists');
      }
      
      if (users.some(u => (u.email || '').toString().trim().toLowerCase() === normalizedEmail)) {
        throw new Error('Email already exists');
      }
      
      const newUser = {
        id: Date.now(),
        email: email.trim(),
        username: username.trim(),
        password: password,
        phone: phone.trim(),
        loginDate: new Date().toISOString(),
        image: 'assets/images/default-avatar.jpg'
      };
      
      const localUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
      localUsers.push(newUser);
      localStorage.setItem('registeredUsers', JSON.stringify(localUsers));
      
      const token = 'auth-token-' + Date.now();
      localStorage.setItem('authToken', token);
      localStorage.setItem('user', JSON.stringify(newUser));
      updateProfileNav(newUser);
      window.location.href = 'index.html';
      
      return newUser;
    } catch (error) {
      console.error('Registration error:', error);
      throw error;
    }
  },

// Logout function
  logout: function() {
    try {
      // Clear authentication state but keep registered accounts so users can sign in later
      localStorage.removeItem('authToken');
      localStorage.removeItem('user');
      
      // Reset nav UI
      const loginNavLink = document.getElementById('loginNavLink');
      const profileNavLink = document.getElementById('profileNavLink');
      const logoutNavBtn = document.getElementById('logoutNavBtn');
      const profileNavInfo = document.getElementById('profileNavInfo');
      
      if (profileNavInfo) profileNavInfo.classList.add('hidden');
      if (profileNavLink) profileNavLink.classList.add('hidden');
      if (logoutNavBtn) logoutNavBtn.classList.add('hidden');
      if (loginNavLink) loginNavLink.classList.remove('hidden');
      
      // Close nav menu
      const nav = document.getElementById('nav');
      if (nav) nav.dataset.open = 'false';
      const navToggle = document.getElementById('navToggle');
      if (navToggle) navToggle.setAttribute('aria-expanded', 'false');
      
      // Redirect to login page so user can login again
      window.location.href = 'login.html';
    } catch (error) {
      console.error('Logout error:', error);
      window.location.href = 'login.html';
    }
  }
};

// Initialize on page load
document.addEventListener('DOMContentLoaded', () => {
  // Check if user is already authenticated on page load
  if (window.auth.isAuthenticated()) {
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    updateProfileNav(user);
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
  } else {
    alert(message);
  }
}
