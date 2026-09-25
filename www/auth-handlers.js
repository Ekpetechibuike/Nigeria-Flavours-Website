// Full authentication form handlers
// Handles both login.html and register.html forms

// Helper functions for error/success messages (shared across pages)
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

document.addEventListener('DOMContentLoaded', () => {
  // Login form handler
  const loginForm = document.getElementById('loginForm');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      
      const username = document.getElementById('username').value.trim();
      const password = document.getElementById('password').value;
      
      if (!username || !password) {
        return showError('Please fill in all fields');
      }
      
      try {
        showSuccess('Logging in...', document);
        await window.auth.login(username, password); // Fixed: uses username (matches server)
      } catch (error) {
        showError(error.message || 'Login failed');
      }
    });
  }

  // Register form handler
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
        return showError('Please fill in all fields');
      }
      
      if (password !== confirmPassword) {
        return showError('Passwords do not match');
      }
      
      if (password.length < 6) {
        return showError('Password must be at least 6 characters');
      }
      
      try {
        showSuccess('Creating account...', document);
        await window.auth.register(email, phone, username, password); // Fixed field order/name match
      } catch (error) {
        showError(error.message || 'Registration failed');
      }
    });
  }
});

