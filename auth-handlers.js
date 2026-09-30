// Full authentication form handlers
// Handles both login.html and register.html forms

function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test((email || '').trim());
}

function validatePhone(phone) {
  return /^[0-9+()\-\s]{7,20}$/.test((phone || '').trim());
}

document.addEventListener('DOMContentLoaded', () => {
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value.trim();

      if (!username || !password) {
        return showError('Please enter both username and password');
      }

      if (username.length < 3) {
        return showError('Username must be at least 3 characters long');
      }

      try {
        showSuccess('Logging in...', document);
        await window.auth.login(username, password);
      } catch (error) {
        showError(error.message || 'Login failed');
      }
    });
  }

  const registerForm = document.getElementById('registerForm');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();

      const email = document.getElementById('email').value.trim();
      const phone = document.getElementById('phone').value.trim();
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;
      const confirmPassword = document.getElementById('confirmPassword').value;

      if (!email || !phone || !username || !password || !confirmPassword) {
        return showError('Please fill in all required fields');
      }

      if (!validateEmail(email)) {
        return showError('Please provide a valid email address');
      }

      if (!validatePhone(phone)) {
        return showError('Please provide a valid phone number');
      }

      if (username.length < 3) {
        return showError('Username must be at least 3 characters long');
      }

      if (password !== confirmPassword) {
        return showError('Passwords do not match');
      }

      if (password.length < 6) {
        return showError('Password must be at least 6 characters long');
      }

      try {
        showSuccess('Creating account...', document);
        await window.auth.register(email, phone, username, password);
      } catch (error) {
        showError(error.message || 'Registration failed');
      }
    });
  }
});

