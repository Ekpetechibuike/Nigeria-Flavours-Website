/**
 * Restaurant Website - STATIC-ONLY VERSION
 * Netlify/GitHub Pages 100% - NO server popup EVER
 */

// ========== AUTH & PROFILE FUNCTIONS ==========
function checkAuth() {
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  const loginNavLink = document.getElementById('loginNavLink');
  const profileNavLink = document.getElementById('profileNavLink');
  const logoutNavBtn = document.getElementById('logoutNavBtn');
  const profileNavInfo = document.getElementById('profileNavInfo');

  if (user && user.id && localStorage.getItem('authToken')) {
    updateProfileNav(user);
    if (loginNavLink) loginNavLink.classList.add('hidden');
  } else {
    if (profileNavInfo) profileNavInfo.classList.add('hidden');
    if (profileNavLink) profileNavLink.classList.add('hidden');
    if (logoutNavBtn) logoutNavBtn.classList.add('hidden');
    if (loginNavLink) loginNavLink.classList.remove('hidden');
  }
}

function updateProfileNav(user) {
  const profileNavInfo = document.getElementById('profileNavInfo');
  const profileNavLink = document.getElementById('profileNavLink');
  const logoutNavBtn = document.getElementById('logoutNavBtn');
  const loginNavLink = document.getElementById('loginNavLink');
  
  if (profileNavInfo && profileNavLink && logoutNavBtn) {
    profileNavInfo.classList.remove('hidden');
    profileNavLink.classList.remove('hidden');
    logoutNavBtn.classList.remove('hidden');
    if (loginNavLink) loginNavLink.classList.add('hidden');
    
    const profileUsername = document.getElementById('profileUsername');
    const profileAvatarNav = document.getElementById('profileAvatarNav');
    
    if (profileUsername) {
      profileUsername.textContent = user.username || user.name || 'User';
    }
    if (profileAvatarNav) {
      profileAvatarNav.src = user.image || 'assets/images/default-avatar.jpg';
    }
  }
}

// Logout function - clears auth and redirects to login page
function logout() {
  try {
    // Clear ALL auth-related localStorage
    localStorage.removeItem('authToken');
    localStorage.removeItem('user');
    localStorage.removeItem('registeredUsers');
    
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

// ========== MENU FILTER FUNCTIONALITY ==========
function initMenuFilters() {
  const filterBtns = document.querySelectorAll('.filter');
  const cards = document.querySelectorAll('.card');
  
  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      // Update active state
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      
      const group = btn.dataset.group;
      
      // Filter cards
      cards.forEach(card => {
        if (group === 'all' || card.dataset.group === group) {
          card.style.display = 'block';
        } else {
          card.style.display = 'none';
        }
      });
    });
  });
}

// ========== RESERVATION FORM HANDLING ==========
function initReservationForm() {
  const form = document.getElementById('reservationForm');
  if (!form) return;

  const phoneInput = form.querySelector('#phone');
  const storedUser = JSON.parse(localStorage.getItem('user') || '{}');
  if (phoneInput && storedUser.phone && !phoneInput.value) {
    phoneInput.value = storedUser.phone;
  }
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(form);
    const statusEl = document.getElementById('formStatus');
    const email = (formData.get('email') || '').toString().trim().toLowerCase();
    const phone = (formData.get('phone') || '').toString().trim();
    
    // Get selected foods
    const selectedFoods = [];
    const foodCheckboxes = form.querySelectorAll('input[name="res-foods"]:checked');
    foodCheckboxes.forEach(cb => {
      selectedFoods.push({
        name: cb.value,
        price: parseInt(cb.dataset.price)
      });
    });

    const reservations = JSON.parse(localStorage.getItem('reservations') || '[]');
    const existingReservation = reservations.find((reservation) => {
      const sameEmail = reservation.email && reservation.email.toLowerCase() === email;
      const samePhone = reservation.phone && reservation.phone === phone;
      return sameEmail || samePhone;
    });

    if (existingReservation) {
      if (statusEl) {
        statusEl.textContent = 'You have already reserved.';
        statusEl.style.color = '#dc2626';
      }
      return;
    }
    
    const reservation = {
      id: Date.now(),
      name: formData.get('name'),
      email,
      phone,
      date: formData.get('date'),
      time: formData.get('time'),
      guests: parseInt(formData.get('guests')),
      message: formData.get('message'),
      foods: selectedFoods,
      total: selectedFoods.reduce((sum, f) => sum + f.price, 0),
      createdAt: new Date().toISOString()
    };

    const apiBase = window.APP_API_BASE || (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
      ? 'http://localhost:5000/api'
      : '/api');

    try {
      const response = await fetch(`${apiBase}/reservations`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(reservation)
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(data.error || 'Reservation failed');
      }

      reservations.push(reservation);
      localStorage.setItem('reservations', JSON.stringify(reservations));
      localStorage.setItem('reservationPending', JSON.stringify(reservation));

      if (statusEl) {
        statusEl.textContent = 'Reservation submitted successfully!';
        statusEl.style.color = 'green';
      }
    } catch (error) {
      reservations.push(reservation);
      localStorage.setItem('reservations', JSON.stringify(reservations));
      localStorage.setItem('reservationPending', JSON.stringify(reservation));

      if (statusEl) {
        statusEl.textContent = error.message || 'You have already reserved.';
        statusEl.style.color = '#dc2626';
      }
      return;
    }
    
    form.reset();
    if (phoneInput && storedUser.phone) {
      phoneInput.value = storedUser.phone;
    }
    
    setTimeout(() => {
      if (statusEl) statusEl.textContent = '';
    }, 5000);
  });
}

// ========== ORDER MODAL FUNCTIONS ==========
let currentDish = '';
let currentPrice = 0;
let orderItems = [];

const menuFoods = [
  { name: 'Tuwo Shinkafa', price: 2500 },
  { name: 'Suya', price: 3000 },
  { name: 'Awara', price: 2200 },
  { name: 'Dambu Nama', price: 2500 },
  { name: 'Dan Wake', price: 1800 },
  { name: 'Fura Da Nono', price: 2000 },
  { name: 'Kilishi', price: 3000 },
  { name: 'Kuli-Kuli', price: 1500 },
  { name: 'Kunu', price: 1000 },
  { name: 'Masa', price: 2000 },
  { name: 'Miyan Kuka', price: 2800 },
  { name: 'Miyan Taushe', price: 2800 },
  { name: 'Miyan Zogale', price: 2800 },
  { name: 'Tuwo Dawa', price: 2500 },
  { name: 'Tuwo Massara', price: 2500 },
  { name: 'Zobo', price: 1000 },
  { name: 'Ofe Nsala (White Soup)', price: 2800 },
  { name: 'Abacha & Ugba', price: 2200 },
  { name: 'Jollof Rice & Plantain', price: 2800 },
  { name: 'Okro Soup with Fufu', price: 2800 },
  { name: 'Egusi Soup with Fufu', price: 2800 },
  { name: 'Rice & Stew', price: 2800 },
  { name: 'Nkwobi', price: 2200 },
  { name: 'Ukwa', price: 2200 },
  { name: 'Okpa', price: 2200 },
  { name: 'Ofe Onugbu (Bitter Leaf Soup)', price: 2800 },
  { name: 'Efo Riro', price: 2600 },
  { name: 'Amala with Gbegiri & Ewedu', price: 2900 },
  { name: 'Ewa Aganyin', price: 2500 },
  { name: 'Akara', price: 1800 },
  { name: 'Buns', price: 1800 }
];

function renderOrderItems() {
  const itemsEl = document.getElementById('orderItems');
  if (!itemsEl) return;

  itemsEl.innerHTML = '';
  orderItems.forEach((item, index) => {
    const row = document.createElement('div');
    row.className = 'order-item-row';

    const select = document.createElement('select');
    select.setAttribute('aria-label', `Food item ${index + 1}`);
    menuFoods.forEach((food) => {
      const option = document.createElement('option');
      option.value = food.name;
      option.textContent = `${food.name} - ₦${food.price.toLocaleString()}`;
      option.selected = food.name === item.name;
      select.appendChild(option);
    });
    select.addEventListener('change', () => {
      const food = menuFoods.find((menuItem) => menuItem.name === select.value);
      item.name = food.name;
      item.price = food.price;
      updateOrderTotal();
      renderOrderItems();
    });

    const quantity = document.createElement('input');
    quantity.type = 'number';
    quantity.min = '1';
    quantity.value = String(item.quantity);
    quantity.setAttribute('aria-label', `Quantity for ${item.name}`);
    quantity.addEventListener('input', () => {
      item.quantity = Math.max(1, parseInt(quantity.value, 10) || 1);
      updateOrderTotal();
    });

    row.append(select, quantity);
    if (orderItems.length > 1) {
      const remove = document.createElement('button');
      remove.type = 'button';
      remove.className = 'order-remove-item';
      remove.textContent = 'Remove';
      remove.addEventListener('click', () => {
        orderItems.splice(index, 1);
        renderOrderItems();
        updateOrderTotal();
      });
      row.appendChild(remove);
    }
    itemsEl.appendChild(row);
  });
}

function addOrderItem() {
  orderItems.push({ ...menuFoods[0], quantity: 1 });
  renderOrderItems();
  updateOrderTotal();
}

function openOrderModal(dish, price) {
  const modal = document.getElementById('orderModal');
  if (!modal) return;
  
  currentDish = dish;
  currentPrice = price;
  orderItems = [{ name: dish, price, quantity: 1 }];
  renderOrderItems();
  updateOrderTotal();
  
  modal.classList.remove('hidden');
}

function closeOrderModal() {
  const modal = document.getElementById('orderModal');
  if (modal) modal.classList.add('hidden');
}

function updateOrderTotal() {
  const totalEl = document.getElementById('orderTotal');
  if (totalEl) {
    totalEl.value = orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }
}

function initOrderForm() {
  const form = document.getElementById('orderForm');
  if (!form) return;
  
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const formData = new FormData(form);
    const statusEl = document.getElementById('orderStatus');
    const foods = orderItems.map((item) => ({ ...item }));
    
    const order = {
      id: Date.now(),
      name: formData.get('orderName'),
      phone: formData.get('orderPhone'),
      dish: foods.map((item) => item.name).join(', '),
      quantity: foods.reduce((sum, item) => sum + item.quantity, 0),
      foods,
      address: formData.get('orderAddress'),
      total: parseInt(formData.get('orderTotal')),
      createdAt: new Date().toISOString()
    };
    
    // Save to localStorage
    const orders = JSON.parse(localStorage.getItem('orders') || '[]');
    orders.push(order);
    localStorage.setItem('orders', JSON.stringify(orders));
    
    if (statusEl) {
      statusEl.textContent = 'Order placed successfully!';
      statusEl.style.color = 'green';
    }
    
    setTimeout(() => {
      closeOrderModal();
      if (statusEl) statusEl.textContent = '';
      form.reset();
    }, 2000);
  });
}

function initReservationBoard() {
  const board = document.getElementById('reservationsBoard');
  if (!board) return;

  const reservations = JSON.parse(localStorage.getItem('reservations') || '[]');
  const orders = JSON.parse(localStorage.getItem('orders') || '[]');

  const reservationsRows = document.getElementById('reservationsBoardRows');
  const totalReservations = document.getElementById('totalReservations');
  const reservationsEmpty = document.getElementById('reservationsBoardEmpty');
  const ordersRows = document.getElementById('ordersBoardRows');
  const totalOrders = document.getElementById('totalOrders');
  const ordersEmpty = document.getElementById('ordersBoardEmpty');

  if (totalReservations) {
    totalReservations.textContent = String(reservations.length);
  }
  if (totalOrders) {
    totalOrders.textContent = String(orders.length);
  }

  if (reservationsRows) {
    reservationsRows.innerHTML = '';
    if (reservations.length === 0) {
      reservationsEmpty && reservationsEmpty.classList.remove('hidden');
    } else {
      reservationsEmpty && reservationsEmpty.classList.add('hidden');
      const sortedReservations = [...reservations].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      sortedReservations.forEach((reservation) => {
        const row = document.createElement('tr');
        const foods = Array.isArray(reservation.foods) && reservation.foods.length > 0
          ? reservation.foods.map(food => food.name).join(', ')
          : 'None';
        const createdAt = reservation.createdAt ? new Date(reservation.createdAt).toLocaleString() : '-';

        row.innerHTML = `
          <td>${reservation.name || '-'}</td>
          <td>${reservation.phone || '-'}</td>
          <td>${reservation.date || '-'} ${reservation.time || ''}</td>
          <td>${reservation.guests || '-'}</td>
          <td>${foods}</td>
          <td>${reservation.total ? '₦' + reservation.total.toLocaleString() : '₦0'}</td>
          <td>${reservation.message || '-'}</td>
        `;
        reservationsRows.appendChild(row);
      });
    }
  }

  if (ordersRows) {
    ordersRows.innerHTML = '';
    if (orders.length === 0) {
      ordersEmpty && ordersEmpty.classList.remove('hidden');
    } else {
      ordersEmpty && ordersEmpty.classList.add('hidden');
      const sortedOrders = [...orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      sortedOrders.forEach((order) => {
        const orderDate = order.createdAt ? new Date(order.createdAt).toLocaleString() : '-';
        const row = document.createElement('tr');
        const foods = Array.isArray(order.foods) && order.foods.length > 0
          ? order.foods.map((food) => food.name).join(', ')
          : order.dish || '-';
        const quantities = Array.isArray(order.foods) && order.foods.length > 0
          ? order.foods.map((food) => food.quantity).join(', ')
          : order.quantity || '-';
        row.innerHTML = `
          <td>${order.name || '-'}</td>
          <td>${order.phone || '-'}</td>
          <td>${foods}</td>
          <td>${quantities}</td>
          <td>${order.address || '-'}</td>
          <td>${order.total ? '₦' + order.total.toLocaleString() : '₦0'}</td>
          <td>${orderDate}</td>
        `;
        ordersRows.appendChild(row);
      });
    }
  }
}

function initNavToggle() {
  const navToggle = document.getElementById('navToggle');
  const nav = document.getElementById('nav');
  
  if (!navToggle || !nav) return;

  const setMenuState = (isOpen) => {
    nav.dataset.open = isOpen ? 'true' : 'false';
    navToggle.setAttribute('aria-expanded', String(isOpen));
    navToggle.setAttribute('aria-label', isOpen ? 'Close navigation' : 'Open navigation');
  };

  navToggle.addEventListener('click', (event) => {
    event.stopPropagation();
    setMenuState(nav.dataset.open !== 'true');
  });

  nav.addEventListener('click', (event) => {
    const clickedLink = event.target.closest('a, .nav-logout');
    if (clickedLink) {
      setMenuState(false);
    }
  });

  document.addEventListener('click', (event) => {
    if (!nav.contains(event.target) && !navToggle.contains(event.target)) {
      setMenuState(false);
    }
  });
}

// ========== DOM READY ==========
document.addEventListener('DOMContentLoaded', function() {
  console.log('Nigeria Flavors - Static ready!');
  
  // Initialize all components
  checkAuth();
  initMenuFilters();
  initReservationForm();
  initOrderForm();
  initReservationBoard();
  initNavToggle();
  
  // Demo user auto-login (for development)
  const demoUser = {
    id: 1,
    username: 'chibuike',
    name: 'EKPETE Chibuike',
    email: 'Ekpetechibuike@icloud.com',
    image: 'assets/images/default-avatar.jpg'
  };
  
  // Auto-login for demo purposes (optional - remove in production)
  // localStorage.setItem('user', JSON.stringify(demoUser));
  // localStorage.setItem('authToken', 'demo-token');
  // updateProfileNav(demoUser);
});
