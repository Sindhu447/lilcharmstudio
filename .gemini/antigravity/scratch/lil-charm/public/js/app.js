// Lil Charm Customer Storefront Logic

let currentProducts = [];
let currentCategories = [];
let currentCart = [];
let selectedProduct = null;
let currentQuantity = 1;
let activeCategory = '';

document.addEventListener('DOMContentLoaded', () => {
  initStore();
});

async function initStore() {
  await fetchCategories();
  await fetchProducts();
  loadCartFromStorage();
  setupEventListeners();
}

// Toast Helper
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.innerHTML = `<i class="${type === 'success' ? 'fa-solid fa-circle-check' : 'fa-solid fa-circle-exclamation'}" style="color:${type === 'success' ? 'var(--primary-pink)' : '#E11D48'}; font-size:1.2rem;"></i> <span>${message}</span>`;
  container.appendChild(toast);
  setTimeout(() => {
    toast.remove();
  }, 3500);
}

// Fetch Categories
async function fetchCategories() {
  try {
    const res = await fetch('/api/categories');
    const data = await res.json();
    if (data.success) {
      currentCategories = data.categories || [];
      renderCategoryPills();
      renderSidebarCategories();
    }
  } catch (err) {
    console.warn('Categories fetch error:', err);
  }
}

function renderCategoryPills() {
  const container = document.getElementById('categoryPillsContainer');
  if (!container) return;
  let html = `<button class="pill ${activeCategory === '' ? 'active' : ''}" onclick="filterByCategory('')">All Collection ✨</button>`;
  currentCategories.forEach(cat => {
    html += `<button class="pill ${activeCategory === cat.name ? 'active' : ''}" onclick="filterByCategory('${cat.name}')">${cat.name}</button>`;
  });
  container.innerHTML = html;
}

function renderSidebarCategories() {
  const container = document.getElementById('sidebarCategoryList');
  if (!container) return;
  let html = `
    <li class="filter-item">
      <label><input type="radio" name="catFilter" value="" ${activeCategory === '' ? 'checked' : ''} onchange="filterByCategory('')"> All Categories</label>
    </li>
  `;
  currentCategories.forEach(cat => {
    html += `
      <li class="filter-item">
        <label><input type="radio" name="catFilter" value="${cat.name}" ${activeCategory === cat.name ? 'checked' : ''} onchange="filterByCategory('${cat.name}')"> ${cat.name}</label>
      </li>
    `;
  });
  container.innerHTML = html;
}

function filterByCategory(catName) {
  activeCategory = catName;
  renderCategoryPills();
  renderSidebarCategories();
  fetchProducts();
}

// Fetch Products from Supabase/Backend API
async function fetchProducts() {
  try {
    const grid = document.getElementById('productsGrid');
    if (grid) {
      grid.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:40px; color:var(--text-muted);"><i class="fa-solid fa-spinner fa-spin fa-2x"></i><p style="margin-top:10px;">Loading charming creations...</p></div>`;
    }

    let url = '/api/products';
    const params = [];
    if (activeCategory) params.push(`category=${encodeURIComponent(activeCategory)}`);
    const searchVal = document.getElementById('searchInput')?.value.trim();
    if (searchVal) params.push(`search=${encodeURIComponent(searchVal)}`);

    if (params.length) url += '?' + params.join('&');

    const res = await fetch(url);
    const data = await res.json();

    if (data.success) {
      currentProducts = data.products || [];
      renderProductsGrid(currentProducts);
    }
  } catch (err) {
    console.error('Fetch products error:', err);
    showToast('Failed to load products from database', 'error');
  }
}

function renderProductsGrid(products) {
  const grid = document.getElementById('productsGrid');
  if (!grid) return;

  if (!products.length) {
    grid.innerHTML = `
      <div style="grid-column: 1/-1; text-align:center; padding:60px 20px; background:white; border-radius:16px; border:1px dashed #FBCFE8;">
        <i class="fa-solid fa-box-open" style="font-size:3rem; color:var(--primary-pink); margin-bottom:12px;"></i>
        <h3 style="font-size:1.3rem; font-weight:700;">No Products Found</h3>
        <p style="color:var(--text-muted); font-size:0.9rem; margin-top:4px;">Try searching for another charm name or selecting a different category.</p>
      </div>
    `;
    return;
  }

  grid.innerHTML = products.map(p => {
    const isOut = !p.is_available || p.stock <= 0;
    const stockBadge = isOut 
      ? `<span class="badge" style="background:#EF4444; color:white;">Out of Stock</span>`
      : (p.stock <= 5 
        ? `<span class="badge" style="background:#F59E0B; color:white;">Only ${p.stock} Left!</span>`
        : `<span class="badge" style="background:#10B981; color:white;">In Stock (${p.stock})</span>`);

    return `
      <div class="product-card" onclick="openProductModal('${p.id}')">
        <div class="product-img-wrap">
          <img src="${p.image_url}" alt="${p.name}" loading="lazy" onerror="this.src='https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80'">
          <div class="product-badge-stack">
            ${stockBadge}
          </div>
        </div>
        <div class="product-info">
          <div class="product-category-tag">${p.category || 'Handmade'}</div>
          <h3 class="product-title">${p.name}</h3>
          <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:10px; line-clamp:2; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;">${p.description || ''}</p>
          <div class="product-bottom-row">
            <div class="product-price">
              <span class="price-current">₹${p.price}</span>
            </div>
            <button class="btn-add-cart" ${isOut ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''} onclick="event.stopPropagation(); addToCartDirect('${p.id}')">
              ${isOut ? 'Sold Out' : '<i class="fa-solid fa-bag-shopping"></i> Add'}
            </button>
          </div>
        </div>
      </div>
    `;
  }).join('');
}

// Product Quickview Modal
function openProductModal(productId) {
  const prod = currentProducts.find(p => p.id === productId);
  if (!prod) return;

  selectedProduct = prod;
  currentQuantity = 1;

  document.getElementById('modalImg').src = prod.image_url;
  document.getElementById('modalTitle').innerText = prod.name;
  document.getElementById('modalPrice').innerText = `₹${prod.price}`;
  document.getElementById('modalDesc').innerText = prod.description || 'Handcrafted polymer clay charm.';
  document.getElementById('qtyValDisplay').innerText = currentQuantity;

  const addBtn = document.getElementById('addToCartModalBtn');
  const buyBtn = document.getElementById('buyNowModalBtn');
  const isOut = !prod.is_available || prod.stock <= 0;

  if (isOut) {
    addBtn.disabled = true;
    addBtn.innerText = 'Out of Stock ❌';
    buyBtn.disabled = true;
    buyBtn.style.opacity = '0.5';
  } else {
    addBtn.disabled = false;
    addBtn.innerText = 'Add to Cart 🛍️';
    buyBtn.disabled = false;
    buyBtn.style.opacity = '1';
  }

  document.getElementById('productModal').style.display = 'flex';
}

function closeProductModal() {
  document.getElementById('productModal').style.display = 'none';
}

// Cart Logic
function loadCartFromStorage() {
  try {
    const saved = localStorage.getItem('lilcharm_cart');
    if (saved) currentCart = JSON.parse(saved);
  } catch (e) {
    currentCart = [];
  }
  updateCartUI();
}

function saveCartToStorage() {
  localStorage.setItem('lilcharm_cart', JSON.stringify(currentCart));
  updateCartUI();
}

function addToCartDirect(productId) {
  const prod = currentProducts.find(p => p.id === productId);
  if (!prod) return;

  if (!prod.is_available || prod.stock <= 0) {
    showToast('Sorry, this charm is currently out of stock!', 'error');
    return;
  }

  const existing = currentCart.find(i => i.id === prod.id);
  const currentQty = existing ? existing.quantity : 0;

  if (currentQty + 1 > prod.stock) {
    showToast(`Cannot add more. Only ${prod.stock} available in stock!`, 'error');
    return;
  }

  if (existing) {
    existing.quantity += 1;
  } else {
    currentCart.push({
      id: prod.id,
      product_id: prod.id,
      name: prod.name,
      price: prod.price,
      image_url: prod.image_url,
      quantity: 1,
      stock: prod.stock
    });
  }

  saveCartToStorage();
  showToast(`Added "${prod.name}" to cart! 🎀`);
}

function updateCartUI() {
  const badge = document.getElementById('cartCountBadge');
  const totalCount = currentCart.reduce((sum, item) => sum + item.quantity, 0);
  if (badge) badge.innerText = totalCount;

  const container = document.getElementById('cartItemsList');
  if (!container) return;

  if (!currentCart.length) {
    container.innerHTML = `
      <div style="text-align:center; padding:50px 20px; color:var(--text-muted);">
        <i class="fa-solid fa-basket-shopping" style="font-size:2.5rem; color:#F9A8D4; margin-bottom:10px;"></i>
        <p style="font-weight:700;">Your cart is empty</p>
        <p style="font-size:0.85rem; margin-top:4px;">Explore our collection and add your favorite charms!</p>
      </div>
    `;
    document.getElementById('cartSubtotal').innerText = '₹0';
    document.getElementById('cartTotal').innerText = '₹0';
    return;
  }

  let subtotal = 0;
  container.innerHTML = currentCart.map((item, idx) => {
    const itemSubtotal = item.price * item.quantity;
    subtotal += itemSubtotal;
    return `
      <div class="cart-item">
        <img src="${item.image_url}" alt="${item.name}" class="cart-item-img">
        <div class="cart-item-info">
          <div class="cart-item-title">${item.name}</div>
          <div class="cart-item-price">₹${item.price} x ${item.quantity} = ₹${itemSubtotal}</div>
          <div style="display:flex; align-items:center; gap:8px; margin-top:6px;">
            <button class="qty-btn" style="width:24px; height:24px;" onclick="changeCartQty(${idx}, -1)">-</button>
            <span style="font-weight:700; font-size:0.9rem;">${item.quantity}</span>
            <button class="qty-btn" style="width:24px; height:24px;" onclick="changeCartQty(${idx}, 1)">+</button>
            <button onclick="removeCartItem(${idx})" style="background:none; border:none; color:#EF4444; margin-left:auto; cursor:pointer; font-size:0.9rem;"><i class="fa-solid fa-trash"></i></button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  document.getElementById('cartSubtotal').innerText = `₹${subtotal}`;
  document.getElementById('cartTotal').innerText = `₹${subtotal}`;
}

function changeCartQty(index, delta) {
  const item = currentCart[index];
  if (!item) return;

  const newQty = item.quantity + delta;
  if (newQty <= 0) {
    currentCart.splice(index, 1);
  } else {
    if (newQty > item.stock) {
      showToast(`Cannot add more. Only ${item.stock} available in stock!`, 'error');
      return;
    }
    item.quantity = newQty;
  }
  saveCartToStorage();
}

function removeCartItem(index) {
  currentCart.splice(index, 1);
  saveCartToStorage();
}

function toggleCartDrawer(show) {
  const drawer = document.getElementById('cartDrawer');
  if (!drawer) return;
  if (show) {
    drawer.classList.add('open');
    drawer.classList.add('active');
    drawer.style.right = '0';
  } else {
    drawer.classList.remove('open');
    drawer.classList.remove('active');
    drawer.style.right = '-420px';
  }
}

function togglePaymentMethod(type) {
  const razorpayLabel = document.getElementById('paymentMethodRazorpayLabel');
  const qrLabel = document.getElementById('paymentMethodQrLabel');
  const qrBox = document.getElementById('upiQrPaymentBox');
  const submitBtn = document.getElementById('checkoutSubmitBtn');

  if (type === 'upi_qr') {
    if (razorpayLabel) { razorpayLabel.style.border = '2px solid #E2E8F0'; razorpayLabel.style.background = '#F8FAFC'; }
    if (qrLabel) { qrLabel.style.border = '2px solid var(--primary-pink)'; qrLabel.style.background = 'var(--primary-soft)'; }
    if (qrBox) qrBox.style.display = 'block';
    if (submitBtn) submitBtn.innerText = 'Confirm Order with UPI Payment 📲';

    const qrImg = document.getElementById('upiQrCodeImg');
    if (qrImg) {
      qrImg.src = '/images/phonepe_qr.png';
    }
  } else {
    if (razorpayLabel) { razorpayLabel.style.border = '2px solid var(--primary-pink)'; razorpayLabel.style.background = 'var(--primary-soft)'; }
    if (qrLabel) { qrLabel.style.border = '2px solid #E2E8F0'; qrLabel.style.background = '#F8FAFC'; }
    if (qrBox) qrBox.style.display = 'none';
    if (submitBtn) submitBtn.innerText = 'Pay Now with Razorpay 💳';
  }
}

// Checkout & Razorpay / UPI Flow
async function handleCheckoutSubmit(e) {
  e.preventDefault();
  if (!currentCart.length) {
    showToast('Your cart is empty!', 'error');
    return;
  }

  const name = document.getElementById('custName').value.trim();
  const phone = document.getElementById('custPhone').value.trim();
  const email = document.getElementById('custEmail').value.trim();
  const address = document.getElementById('custAddress').value.trim();
  const city = document.getElementById('custCity').value.trim();
  const state = document.getElementById('custState').value.trim();
  const pincode = document.getElementById('custPincode').value.trim();
  const selectedMethod = document.querySelector('input[name="paymentMethod"]:checked')?.value || 'razorpay';

  const totalAmount = currentCart.reduce((sum, i) => sum + (i.price * i.quantity), 0);

  // If UPI QR Code payment selected
  if (selectedMethod === 'upi_qr') {
    const utrNo = document.getElementById('upiUtrInput')?.value.trim();
    if (!utrNo) {
      showToast('Please enter your 12-digit UPI UTR / Transaction Ref No.', 'error');
      return;
    }

    try {
      showToast('Creating your UPI order...', 'success');
      const createOrderRes = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customer_name: name,
          email,
          phone,
          address: `${address}, ${city}, ${state} - ${pincode}`,
          total_amount: totalAmount,
          items: currentCart,
          razorpay_order_id: `UPI_QR_${Date.now()}`,
          razorpay_payment_id: utrNo
        })
      });

      const orderData = await createOrderRes.json();
      if (!orderData.success) {
        showToast(orderData.message || 'Order creation failed.', 'error');
        return;
      }

      const internalOrderId = orderData.order.id;

      // Verify payment with UTR number
      const verifyRes = await fetch('/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razorpay_order_id: `UPI_QR_${Date.now()}`,
          razorpay_payment_id: utrNo,
          razorpay_signature: 'upi_qr_user_submitted',
          order_id: internalOrderId
        })
      });

      const verifyData = await verifyRes.json();
      if (verifyData.success) {
        document.getElementById('checkoutModal').style.display = 'none';
        renderOrderSuccess(internalOrderId, currentCart, totalAmount);
        currentCart = [];
        saveCartToStorage();
        fetchProducts();
      } else {
        showToast(verifyData.message || 'UPI Payment verification failed', 'error');
      }
    } catch (err) {
      showToast('UPI Order submission failed.', 'error');
    }
    return;
  }

  // Razorpay Online Flow
  try {
    showToast('Initiating Razorpay payment connection...', 'success');

    // 1. Create order in backend database & validate stock
    const createOrderRes = await fetch('/api/orders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        customer_name: name,
        email,
        phone,
        address: `${address}, ${city}, ${state} - ${pincode}`,
        total_amount: totalAmount,
        items: currentCart
      })
    });

    const orderData = await createOrderRes.json();
    if (!orderData.success) {
      showToast(orderData.message || 'Order creation failed due to stock availability.', 'error');
      return;
    }

    const internalOrderId = orderData.order.id;

    // 2. Create Razorpay Payment Order on Backend
    const rzpRes = await fetch('/api/payment/create-order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        amount: totalAmount,
        items: currentCart,
        receipt: `rcpt_${internalOrderId}`
      })
    });

    const rzpData = await rzpRes.json();
    if (!rzpData.success) {
      showToast(rzpData.message || 'Razorpay initialization failed', 'error');
      return;
    }

    // Close checkout modal
    document.getElementById('checkoutModal').style.display = 'none';

    // 3. Open Razorpay Checkout Window
    const options = {
      key: rzpData.key,
      amount: rzpData.amount,
      currency: rzpData.currency || 'INR',
      name: 'Lil Charm Official',
      description: 'Handmade Customized Clay Charms',
      image: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=800&q=80',
      order_id: rzpData.order_id,
      handler: async function (response) {
        showToast('Verifying payment signature securely...', 'success');

        // 4. Verify Payment Signature on Backend Server
        const verifyRes = await fetch('/api/payment/verify', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            razorpay_order_id: response.razorpay_order_id || rzpData.order_id,
            razorpay_payment_id: response.razorpay_payment_id || ('pay_' + Date.now()),
            razorpay_signature: response.razorpay_signature || 'demo_signature',
            order_id: internalOrderId
          })
        });

        const verifyData = await verifyRes.json();
        if (verifyData.success) {
          // Render Order Success Modal
          renderOrderSuccess(internalOrderId, currentCart, totalAmount);
          // Clear cart
          currentCart = [];
          saveCartToStorage();
          fetchProducts(); // Refresh products stock on page
        } else {
          showToast(verifyData.message || 'Payment verification failed', 'error');
        }
      },
      prefill: {
        name: name,
        email: email,
        contact: phone
      },
      theme: {
        color: '#F472B6'
      }
    };

    if (window.Razorpay) {
      const rzpObj = new window.Razorpay(options);
      rzpObj.open();
    } else {
      // Fallback test mode if Razorpay Checkout SDK fails to load
      showToast('Razorpay Checkout SDK not loaded. Simulating successful checkout for test mode.', 'success');
      const verifyRes = await fetch('/api/payment/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          razorpay_order_id: rzpData.order_id,
          razorpay_payment_id: 'pay_test_' + Date.now(),
          razorpay_signature: 'test_mode_sig',
          order_id: internalOrderId
        })
      });
      const verifyData = await verifyRes.json();
      if (verifyData.success) {
        renderOrderSuccess(internalOrderId, currentCart, totalAmount);
        currentCart = [];
        saveCartToStorage();
        fetchProducts();
      }
    }
  } catch (err) {
    console.error('Checkout error:', err);
    showToast('Failed to complete checkout.', 'error');
  }
}

function renderOrderSuccess(orderId, items, total) {
  document.getElementById('successOrderId').innerText = `#${orderId.substring(0, 8).toUpperCase()}`;
  document.getElementById('successPaymentStatus').innerText = 'Paid';
  document.getElementById('successOrderStatus').innerText = 'Paid';
  document.getElementById('successTotalAmount').innerText = `₹${total}`;

  const itemsContainer = document.getElementById('successItemsList');
  itemsContainer.innerHTML = items.map(item => `
    <div style="display:flex; justify-content:space-between;">
      <span>• ${item.name} (x${item.quantity})</span>
      <span style="font-weight:600;">₹${item.price * item.quantity}</span>
    </div>
  `).join('');

  document.getElementById('orderSuccessModal').style.display = 'flex';
}

function setupEventListeners() {
  document.getElementById('cartToggleBtn')?.addEventListener('click', () => toggleCartDrawer(true));
  document.getElementById('cartCloseBtn')?.addEventListener('click', () => toggleCartDrawer(false));
  document.getElementById('modalCloseBtn')?.addEventListener('click', closeProductModal);

  document.getElementById('qtyMinusBtn')?.addEventListener('click', () => {
    if (currentQuantity > 1) {
      currentQuantity--;
      document.getElementById('qtyValDisplay').innerText = currentQuantity;
    }
  });

  document.getElementById('qtyPlusBtn')?.addEventListener('click', () => {
    if (selectedProduct && currentQuantity < selectedProduct.stock) {
      currentQuantity++;
      document.getElementById('qtyValDisplay').innerText = currentQuantity;
    } else if (selectedProduct) {
      showToast(`Only ${selectedProduct.stock} units available in stock.`, 'error');
    }
  });

  document.getElementById('addToCartModalBtn')?.addEventListener('click', () => {
    if (selectedProduct) {
      for (let i = 0; i < currentQuantity; i++) {
        addToCartDirect(selectedProduct.id);
      }
      closeProductModal();
    }
  });

  document.getElementById('buyNowModalBtn')?.addEventListener('click', () => {
    if (selectedProduct) {
      addToCartDirect(selectedProduct.id);
      closeProductModal();
      toggleCartDrawer(true);
    }
  });

  document.getElementById('checkoutBtn')?.addEventListener('click', () => {
    if (!currentCart.length) {
      showToast('Your cart is empty!', 'error');
      return;
    }
    const total = currentCart.reduce((sum, i) => sum + (i.price * i.quantity), 0);
    document.getElementById('checkoutTotalPayable').innerText = `₹${total}`;
    toggleCartDrawer(false);
    document.getElementById('checkoutModal').style.display = 'flex';
  });

  document.getElementById('checkoutCloseBtn')?.addEventListener('click', () => {
    document.getElementById('checkoutModal').style.display = 'none';
  });

  document.getElementById('checkoutForm')?.addEventListener('submit', handleCheckoutSubmit);

  document.getElementById('successDoneBtn')?.addEventListener('click', () => {
    document.getElementById('orderSuccessModal').style.display = 'none';
  });

  document.getElementById('searchInput')?.addEventListener('input', () => {
    fetchProducts();
  });
}
