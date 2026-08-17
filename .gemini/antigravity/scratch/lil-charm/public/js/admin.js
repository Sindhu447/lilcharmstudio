// Lil Charm Secure Admin Dashboard Logic

let adminToken = localStorage.getItem('lilcharm_admin_token');
let currentAdminProducts = [];
let currentAdminCategories = [];
let currentAdminOrders = [];
let selectedDeleteProductId = null;
let selectedActiveOrder = null;
let currentUploadedImageUrl = '';

document.addEventListener('DOMContentLoaded', () => {
  if (adminToken) {
    checkAdminAuth();
  } else {
    showLoginScreen();
  }
  setupAdminEvents();
});

function showToast(msg, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<i class="${type === 'success' ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-exclamation'}" style="color:${type === 'success' ? 'var(--primary-pink)' : '#E11D48'}; font-size:1.2rem;"></i> <span>${msg}</span>`;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), 3500);
}

function showLoginScreen() {
  document.getElementById('adminLoginScreen').style.display = 'flex';
  document.getElementById('adminDashboardWrapper').style.display = 'none';
}

function showDashboard() {
  document.getElementById('adminLoginScreen').style.display = 'none';
  document.getElementById('adminDashboardWrapper').style.display = 'flex';
  loadDashboardData();
}

async function checkAdminAuth() {
  try {
    const res = await fetch('/api/auth/me', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data = await res.json();
    if (data.success) {
      showDashboard();
    } else {
      localStorage.removeItem('lilcharm_admin_token');
      showLoginScreen();
    }
  } catch (err) {
    showLoginScreen();
  }
}

async function handleAdminLogin(e) {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
    const data = await res.json();
    if (data.success) {
      adminToken = data.token;
      localStorage.setItem('lilcharm_admin_token', adminToken);
      showDashboard();
      showToast('Welcome back to Admin Portal! 🎀');
    } else {
      showToast(data.message || 'Invalid admin credentials', 'error');
    }
  } catch (err) {
    showToast('Login failed: server error', 'error');
  }
}

function handleAdminLogout() {
  localStorage.removeItem('lilcharm_admin_token');
  adminToken = null;
  showLoginScreen();
  showToast('Logged out of Admin Portal.');
}

// Tab Switching
function switchTab(tabId) {
  document.querySelectorAll('.admin-tab-content').forEach(t => t.style.display = 'none');
  document.querySelectorAll('.admin-nav-item').forEach(i => i.classList.remove('active'));

  const activeTabEl = document.getElementById(tabId);
  if (activeTabEl) activeTabEl.style.display = 'block';

  const navItems = document.querySelectorAll('.admin-nav-item');
  if (tabId === 'overviewTab') navItems[0]?.classList.add('active');
  if (tabId === 'productsTab') navItems[1]?.classList.add('active');
  if (tabId === 'categoriesTab') navItems[2]?.classList.add('active');
  if (tabId === 'ordersTab') navItems[3]?.classList.add('active');
  if (tabId === 'settingsTab') navItems[5]?.classList.add('active');

  const titles = {
    overviewTab: 'Store Overview',
    productsTab: 'Product Catalog Management',
    categoriesTab: 'Category Management',
    ordersTab: 'Customer Order Management',
    settingsTab: 'Live Store Settings'
  };
  const titleDisplay = document.getElementById('tabTitleDisplay');
  if (titleDisplay) titleDisplay.innerText = titles[tabId] || 'Admin Dashboard';
}

async function loadDashboardData() {
  await fetchAdminCategories();
  await fetchAdminProducts();
  await fetchAdminOrders();
  updateOverviewStats();
}

function updateOverviewStats() {
  const totalOrders = currentAdminOrders.length;
  const pendingOrders = currentAdminOrders.filter(o => o.order_status === 'Pending' || o.order_status === 'Paid').length;
  const totalRevenue = currentAdminOrders
    .filter(o => o.payment_status === 'Paid' || o.order_status === 'Paid')
    .reduce((sum, o) => sum + parseFloat(o.total_amount || 0), 0);

  document.getElementById('statRevenue').innerText = `₹${totalRevenue.toFixed(2)}`;
  document.getElementById('statTotalOrders').innerText = totalOrders;
  document.getElementById('statPendingOrders').innerText = pendingOrders;
  document.getElementById('statTotalProducts').innerText = currentAdminProducts.length;

  renderRecentOrdersTable();
}

// Fetch Admin Categories
async function fetchAdminCategories() {
  try {
    const res = await fetch('/api/categories');
    const data = await res.json();
    if (data.success) {
      currentAdminCategories = data.categories || [];
      populateCategoryDropdown();
    }
  } catch (e) {}
}

function populateCategoryDropdown() {
  const select = document.getElementById('prodCategory');
  if (!select) return;
  
  const options = ['Keychains', 'Couple Charms', 'Bag Charms', 'Custom Gifts', 'Miniatures', 'General'];
  currentAdminCategories.forEach(c => {
    if (!options.includes(c.name)) options.push(c.name);
  });

  select.innerHTML = options.map(o => `<option value="${o}">${o}</option>`).join('');
}

// Fetch Admin Products
async function fetchAdminProducts() {
  try {
    const res = await fetch('/api/products?admin=true');
    const data = await res.json();
    if (data.success) {
      currentAdminProducts = data.products || [];
      renderAdminProductsTable();
    }
  } catch (err) {
    showToast('Failed to fetch products', 'error');
  }
}

function renderAdminProductsTable() {
  const tbody = document.getElementById('adminProductsTableBody');
  if (!tbody) return;

  if (!currentAdminProducts.length) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; padding:30px; color:#64748B;">No products found. Click "Add New Product" to create one.</td></tr>`;
    return;
  }

  tbody.innerHTML = currentAdminProducts.map(p => {
    const isAvail = p.is_available && p.stock > 0;
    const statusBadge = isAvail 
      ? `<span style="background:#DCFCE7; color:#166534; padding:3px 10px; border-radius:12px; font-weight:700; font-size:0.8rem;">Available</span>`
      : `<span style="background:#FEE2E2; color:#991B1B; padding:3px 10px; border-radius:12px; font-weight:700; font-size:0.8rem;">Unavailable</span>`;

    return `
      <tr>
        <td>
          <img src="${p.image_url}" alt="${p.name}" style="width:48px; height:48px; object-fit:cover; border-radius:8px; border:1px solid #E2E8F0;" onerror="this.src='https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80'">
        </td>
        <td style="font-weight:700;">${p.name}</td>
        <td><span style="background:#F1F5F9; color:#475569; padding:2px 8px; border-radius:6px; font-size:0.85rem;">${p.category || 'General'}</span></td>
        <td style="font-weight:700; color:var(--admin-pink);">₹${p.price}</td>
        <td>
          <span style="font-weight:700; color:${p.stock <= 5 ? '#D97706' : '#15803D'};">${p.stock} units</span>
        </td>
        <td>${statusBadge}</td>
        <td>
          <div style="display:flex; gap:6px;">
            <button onclick="openEditProductModal('${p.id}')" style="background:#3B82F6; color:white; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-size:0.8rem;"><i class="fa-solid fa-pen"></i> Edit</button>
            <button onclick="promptDeleteProduct('${p.id}')" style="background:#EF4444; color:white; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-size:0.8rem;"><i class="fa-solid fa-trash"></i> Delete</button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Add / Edit Product Modal
function openAddProductModal() {
  document.getElementById('editProductId').value = '';
  document.getElementById('prodModalTitle').innerText = 'Add New Charm Product';
  document.getElementById('prodTitle').value = '';
  document.getElementById('prodPrice').value = '';
  document.getElementById('prodStock').value = '20';
  document.getElementById('prodDesc').value = '';
  document.getElementById('prodIsActive').checked = true;
  currentUploadedImageUrl = '';

  const preview = document.getElementById('uploadedImagesPreview');
  if (preview) preview.innerHTML = '';

  document.getElementById('adminProductModal').style.display = 'flex';
}

function openEditProductModal(productId) {
  const prod = currentAdminProducts.find(p => p.id === productId);
  if (!prod) return;

  document.getElementById('editProductId').value = prod.id;
  document.getElementById('prodModalTitle').innerText = 'Edit Product Details';
  document.getElementById('prodTitle').value = prod.name;
  document.getElementById('prodPrice').value = prod.price;
  document.getElementById('prodStock').value = prod.stock;
  document.getElementById('prodCategory').value = prod.category || 'General';
  document.getElementById('prodDesc').value = prod.description || '';
  document.getElementById('prodIsActive').checked = Boolean(prod.is_available);
  currentUploadedImageUrl = prod.image_url || '';

  const preview = document.getElementById('uploadedImagesPreview');
  if (preview && currentUploadedImageUrl) {
    preview.innerHTML = `<img src="${currentUploadedImageUrl}" style="width:80px; height:80px; object-fit:cover; border-radius:8px; border:2px solid var(--admin-pink);">`;
  }

  document.getElementById('adminProductModal').style.display = 'flex';
}

function closeAdminModal(modalId) {
  const m = document.getElementById(modalId);
  if (m) m.style.display = 'none';
}

// Product Image Upload to Supabase Storage
async function handleImageUpload(e) {
  const files = e.target.files;
  if (!files || files.length === 0) return;

  const formData = new FormData();
  for (let i = 0; i < files.length; i++) {
    formData.append('images', files[i]);
  }

  try {
    showToast('Uploading image to Supabase Storage...', 'success');
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${adminToken}` },
      body: formData
    });

    const data = await res.json();
    if (data.success && data.image_url) {
      currentUploadedImageUrl = data.image_url;
      const preview = document.getElementById('uploadedImagesPreview');
      if (preview) {
        preview.innerHTML = `<img src="${currentUploadedImageUrl}" style="width:80px; height:80px; object-fit:cover; border-radius:8px; border:2px solid var(--admin-pink);">`;
      }
      showToast('Image uploaded successfully to Supabase Storage! 🎀');
    } else {
      showToast(data.message || 'Image upload failed', 'error');
    }
  } catch (err) {
    showToast('Upload error: server error', 'error');
  }
}

// Save Product Submission
async function handleProductSubmit(e) {
  e.preventDefault();

  const id = document.getElementById('editProductId').value;
  const name = document.getElementById('prodTitle').value.trim();
  const price = parseFloat(document.getElementById('prodPrice').value);
  const stock = parseInt(document.getElementById('prodStock').value, 10);
  const category = document.getElementById('prodCategory').value;
  const description = document.getElementById('prodDesc').value.trim();
  const is_available = document.getElementById('prodIsActive').checked;

  const payload = {
    name,
    price,
    stock,
    category,
    description,
    is_available,
    image_url: currentUploadedImageUrl || 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80'
  };

  try {
    const url = id ? `/api/products/${id}` : '/api/products';
    const method = id ? 'PUT' : 'POST';

    const res = await fetch(url, {
      method: method,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
      closeAdminModal('adminProductModal');
      showToast(id ? 'Product updated successfully! 🎀' : 'New product created! 🎀');
      await fetchAdminProducts();
      updateOverviewStats();
    } else {
      showToast(data.message || 'Failed to save product', 'error');
    }
  } catch (err) {
    showToast('Failed to save product.', 'error');
  }
}

// Prompt Delete Confirmation Modal
function promptDeleteProduct(productId) {
  const prod = currentAdminProducts.find(p => p.id === productId);
  if (!prod) return;

  selectedDeleteProductId = productId;
  document.getElementById('deleteProdName').innerText = prod.name;
  document.getElementById('deleteConfirmModal').style.display = 'flex';
}

async function confirmDeleteProduct() {
  if (!selectedDeleteProductId) return;

  try {
    const res = await fetch(`/api/products/${selectedDeleteProductId}`, {
      method: 'DELETE',
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });

    const data = await res.json();
    if (data.success) {
      closeAdminModal('deleteConfirmModal');
      showToast('Product deleted successfully!');
      selectedDeleteProductId = null;
      await fetchAdminProducts();
      updateOverviewStats();
    } else {
      showToast(data.message || 'Failed to delete product', 'error');
    }
  } catch (err) {
    showToast('Failed to delete product', 'error');
  }
}

// Fetch Admin Orders
async function fetchAdminOrders() {
  try {
    const res = await fetch('/api/orders', {
      headers: { 'Authorization': `Bearer ${adminToken}` }
    });
    const data = await res.json();
    if (data.success) {
      currentAdminOrders = data.orders || [];
      renderAdminOrdersTable();
    }
  } catch (e) {}
}

function renderAdminOrdersTable() {
  const tbody = document.getElementById('adminOrdersTableBody');
  if (!tbody) return;

  if (!currentAdminOrders.length) {
    tbody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding:30px; color:#64748B;">No customer orders placed yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = currentAdminOrders.map(o => {
    const shortId = `#${o.id.substring(0, 8).toUpperCase()}`;
    const statusColor = getOrderStatusColor(o.order_status);

    return `
      <tr>
        <td style="font-weight:700; font-family:monospace;">${shortId}</td>
        <td>
          <div style="font-weight:700;">${o.customer_name}</div>
          <div style="font-size:0.8rem; color:#64748B;">${o.phone} | ${o.email}</div>
        </td>
        <td style="font-size:0.85rem; color:#475569; max-width:180px;">${o.address}</td>
        <td>
          <span style="font-weight:700;">${(o.order_items || []).length} items</span>
        </td>
        <td style="font-weight:700; color:var(--admin-pink);">₹${o.total_amount}</td>
        <td>
          <span style="background:${statusColor.bg}; color:${statusColor.fg}; padding:4px 10px; border-radius:12px; font-weight:700; font-size:0.8rem;">${o.order_status || 'Pending'}</span>
        </td>
        <td>
          <button onclick="openOrderDetailModal('${o.id}')" style="background:#10B981; color:white; border:none; padding:6px 12px; border-radius:6px; cursor:pointer; font-weight:700; font-size:0.8rem;"><i class="fa-solid fa-eye"></i> View</button>
        </td>
      </tr>
    `;
  }).join('');
}

function renderRecentOrdersTable() {
  const tbody = document.getElementById('recentOrdersTableBody');
  if (!tbody) return;

  const recent = currentAdminOrders.slice(0, 5);
  if (!recent.length) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; padding:20px; color:#64748B;">No recent orders.</td></tr>`;
    return;
  }

  tbody.innerHTML = recent.map(o => {
    const shortId = `#${o.id.substring(0, 8).toUpperCase()}`;
    const statusColor = getOrderStatusColor(o.order_status);
    const dateStr = o.created_at ? new Date(o.created_at).toLocaleDateString() : 'Today';

    return `
      <tr>
        <td style="font-weight:700; font-family:monospace;">${shortId}</td>
        <td>${o.customer_name}</td>
        <td style="font-weight:700;">₹${o.total_amount}</td>
        <td><span style="color:#166534; font-weight:700; font-size:0.8rem;">${o.payment_status || 'Pending'}</span></td>
        <td><span style="background:${statusColor.bg}; color:${statusColor.fg}; padding:2px 8px; border-radius:8px; font-weight:700; font-size:0.8rem;">${o.order_status || 'Pending'}</span></td>
        <td style="font-size:0.8rem; color:#64748B;">${dateStr}</td>
      </tr>
    `;
  }).join('');
}

function getOrderStatusColor(status) {
  switch (status) {
    case 'Paid':
    case 'Processing':
      return { bg: '#DBEAFE', fg: '#1E40AF' };
    case 'Shipped':
      return { bg: '#FEF3C7', fg: '#92400E' };
    case 'Delivered':
      return { bg: '#DCFCE7', fg: '#166534' };
    case 'Cancelled':
      return { bg: '#FEE2E2', fg: '#991B1B' };
    default:
      return { bg: '#F3F4F6', fg: '#4B5563' };
  }
}

// Order Details Modal
function openOrderDetailModal(orderId) {
  const order = currentAdminOrders.find(o => o.id === orderId);
  if (!order) return;

  selectedActiveOrder = order;

  document.getElementById('detailOrderIdDisplay').innerText = `Order #${order.id.substring(0, 8).toUpperCase()}`;
  document.getElementById('detailOrderDateDisplay').innerText = `Placed on ${new Date(order.created_at || Date.now()).toLocaleString()}`;
  document.getElementById('detailPaymentBadge').innerText = order.payment_status || 'Pending';
  document.getElementById('detailCustName').innerText = order.customer_name;
  document.getElementById('detailCustEmail').innerText = order.email;
  document.getElementById('detailCustPhone').innerText = order.phone;
  document.getElementById('detailCustAddress').innerText = order.address;
  document.getElementById('detailRzpOrderId').innerText = order.razorpay_order_id || 'N/A';
  document.getElementById('detailRzpPaymentId').innerText = order.razorpay_payment_id || 'N/A';
  document.getElementById('detailTotalAmount').innerText = `₹${order.total_amount}`;
  document.getElementById('updateOrderStatusSelect').value = order.order_status || 'Pending';

  const itemsContainer = document.getElementById('detailOrderItemsList');
  const items = order.order_items || [];

  if (!items.length) {
    itemsContainer.innerHTML = `<div style="padding:12px; color:#64748B;">No item details available.</div>`;
  } else {
    itemsContainer.innerHTML = items.map(item => `
      <div style="display:flex; align-items:center; justify-content:space-between; padding:10px 14px; border-bottom:1px solid #F1F5F9;">
        <div>
          <div style="font-weight:700; color:#1E293B;">${item.products?.name || item.name || 'Handmade Charm'}</div>
          <div style="font-size:0.8rem; color:#64748B;">Quantity: ${item.quantity} x ₹${item.price}</div>
        </div>
        <div style="font-weight:700; color:var(--admin-pink);">₹${item.price * item.quantity}</div>
      </div>
    `).join('');
  }

  document.getElementById('adminOrderDetailModal').style.display = 'flex';
}

async function saveUpdatedOrderStatus() {
  if (!selectedActiveOrder) return;

  const newStatus = document.getElementById('updateOrderStatusSelect').value;
  try {
    const res = await fetch(`/api/orders/${selectedActiveOrder.id}/status`, {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${adminToken}`
      },
      body: JSON.stringify({ order_status: newStatus })
    });

    const data = await res.json();
    if (data.success) {
      closeAdminModal('adminOrderDetailModal');
      showToast('Order status updated successfully! 🎀');
      await fetchAdminOrders();
      updateOverviewStats();
    } else {
      showToast(data.message || 'Failed to update order status', 'error');
    }
  } catch (err) {
    showToast('Failed to update status', 'error');
  }
}

function setupAdminEvents() {
  document.getElementById('adminLoginForm')?.addEventListener('submit', handleAdminLogin);
  document.getElementById('adminLogoutBtn')?.addEventListener('click', handleAdminLogout);
  document.getElementById('adminProductForm')?.addEventListener('submit', handleProductSubmit);
  document.getElementById('confirmDeleteProdBtn')?.addEventListener('click', confirmDeleteProduct);
}
