/**
 * SUT Frontend Application
 * Pure Vanilla JavaScript with zero external dependencies.
 * Designed for determinism, testability, and accessibility.
 */

// Application State
const state = {
  token: localStorage.getItem("sut_token") || null,
  currentUser: null,
  products: [],
  orders: [],
  selectedProductForStockUpdate: null,
};

// DOM Elements
const elements = {
  // Views
  loginView: document.getElementById("login-view"),
  dashboardView: document.getElementById("dashboard-view"),

  // Header
  userEmailDisplay: document.getElementById("user-email-display"),
  userRoleBadge: document.getElementById("user-role-badge"),
  logoutBtn: document.getElementById("logout-btn"),
  resetDbBtn: document.getElementById("reset-db-btn"),

  // Login Form
  loginForm: document.getElementById("login-form"),
  loginEmail: document.getElementById("login-email"),
  loginPassword: document.getElementById("login-password"),
  loginSubmitBtn: document.getElementById("login-submit-btn"),
  loginErrorAlert: document.getElementById("login-error"),
  quickLoginAdmin: document.getElementById("quick-login-admin"),
  quickLoginUser: document.getElementById("quick-login-user"),

  // Admin Create Product
  adminProductCard: document.getElementById("admin-product-card"),
  createProductForm: document.getElementById("create-product-form"),
  inputProductSku: document.getElementById("product-sku"),
  inputProductName: document.getElementById("product-name"),
  inputProductPrice: document.getElementById("product-price"),
  inputProductStock: document.getElementById("product-stock"),
  btnCreateProduct: document.getElementById("btn-create-product"),
  productFormMessage: document.getElementById("product-form-message"),

  // Products List
  productsTableBody: document.getElementById("products-table-body"),
  productsLoading: document.getElementById("products-loading"),

  // Place Order Form
  placeOrderForm: document.getElementById("place-order-form"),
  orderProductSelect: document.getElementById("order-product-select"),
  orderQuantityInput: document.getElementById("order-quantity"),
  btnPlaceOrder: document.getElementById("btn-place-order"),
  orderFeedback: document.getElementById("order-feedback"),

  // Orders List
  ordersTableBody: document.getElementById("orders-table-body"),
  ordersLoading: document.getElementById("orders-loading"),

  // Stock Update Modal
  stockModal: document.getElementById("stock-modal"),
  stockModalSku: document.getElementById("stock-modal-sku"),
  stockModalInput: document.getElementById("stock-modal-input"),
  btnConfirmStockUpdate: document.getElementById("btn-confirm-stock-update"),
  btnCancelStockUpdate: document.getElementById("btn-cancel-stock-update"),
};

// --- API Helper ---
async function apiRequest(endpoint, options = {}) {
  const headers = {
    "Content-Type": "application/json",
    ...(options.headers || {}),
  };

  if (state.token) {
    headers["Authorization"] = `Bearer ${state.token}`;
  }

  const response = await fetch(endpoint, {
    ...options,
    headers,
  });

  const contentType = response.headers.get("content-type");
  let data = null;
  if (contentType && contentType.includes("application/json")) {
    data = await response.json();
  } else {
    data = await response.text();
  }

  return { ok: response.ok, status: response.status, data };
}

// --- UI Render Helpers ---
function showElement(el) {
  if (el) el.classList.remove("hidden");
}

function hideElement(el) {
  if (el) el.classList.add("hidden");
}

function setAlert(el, message, type = "danger") {
  if (!el) return;
  el.textContent = message;
  el.className = `alert alert-${type}`;
  showElement(el);
}

function clearAlert(el) {
  if (!el) return;
  el.textContent = "";
  hideElement(el);
}

// --- Authentication & Session ---
async function checkAuthSession() {
  if (!state.token) {
    renderView("login");
    return;
  }

  const { ok, data } = await apiRequest("/api/auth/me");
  if (ok && data) {
    state.currentUser = data;
    renderView("dashboard");
    await refreshAllData();
  } else {
    logout();
  }
}

function renderView(viewName) {
  if (viewName === "login") {
    hideElement(elements.dashboardView);
    showElement(elements.loginView);
    clearAlert(elements.loginErrorAlert);
  } else if (viewName === "dashboard") {
    hideElement(elements.loginView);
    showElement(elements.dashboardView);

    // Update Header
    elements.userEmailDisplay.textContent = state.currentUser.email;
    elements.userRoleBadge.textContent = state.currentUser.role;
    elements.userRoleBadge.className = `badge badge-${state.currentUser.role}`;

    // Admin-specific UI toggles
    if (state.currentUser.role === "admin") {
      showElement(elements.adminProductCard);
    } else {
      hideElement(elements.adminProductCard);
    }
  }
}

function logout() {
  state.token = null;
  state.currentUser = null;
  localStorage.removeItem("sut_token");
  renderView("login");
}

// --- Login Handler ---
async function handleLogin(e) {
  e.preventDefault();
  clearAlert(elements.loginErrorAlert);

  const email = elements.loginEmail.value.trim();
  const password = elements.loginPassword.value;

  if (!email || !password) {
    setAlert(elements.loginErrorAlert, "Please enter both email and password.");
    return;
  }

  elements.loginSubmitBtn.disabled = true;
  elements.loginSubmitBtn.textContent = "Logging in...";

  try {
    const { ok, status, data } = await apiRequest("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });

    if (ok && data.access_token) {
      state.token = data.access_token;
      state.currentUser = data.user;
      localStorage.setItem("sut_token", data.access_token);
      renderView("dashboard");
      await refreshAllData();
    } else {
      const errMsg = (data && data.detail) || "Invalid email or password.";
      setAlert(elements.loginErrorAlert, errMsg);
    }
  } catch (err) {
    setAlert(elements.loginErrorAlert, "Network error. Please try again.");
  } finally {
    elements.loginSubmitBtn.disabled = false;
    elements.loginSubmitBtn.textContent = "Sign In";
  }
}

// --- Product Management ---
async function loadProducts() {
  const { ok, data } = await apiRequest("/api/products");
  if (ok && Array.isArray(data)) {
    state.products = data;
    renderProductsTable();
    populateProductSelect();
  }
}

function renderProductsTable() {
  const tbody = elements.productsTableBody;
  tbody.innerHTML = "";

  if (state.products.length === 0) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center; color: var(--slate-600);">No products found.</td></tr>`;
    return;
  }

  const isAdmin = state.currentUser && state.currentUser.role === "admin";

  state.products.forEach((product) => {
    const tr = document.createElement("tr");
    tr.setAttribute("data-testid", `product-row-${product.sku}`);

    tr.innerHTML = `
      <td data-testid="product-sku-${product.sku}"><strong>${escapeHtml(product.sku)}</strong></td>
      <td data-testid="product-name-${product.sku}">${escapeHtml(product.name)}</td>
      <td data-testid="product-price-${product.sku}">$${product.price.toFixed(2)}</td>
      <td data-testid="product-stock-${product.sku}">
        <span class="${product.stock_quantity === 0 ? 'badge badge-cancelled' : ''}">${product.stock_quantity}</span>
      </td>
      <td class="table-actions">
        ${
          isAdmin
            ? `<button type="button" class="btn btn-secondary btn-sm" data-testid="btn-update-stock-${product.sku}" onclick="openStockModal(${product.id}, '${escapeHtml(product.sku)}', ${product.stock_quantity})">Update Stock</button>`
            : `<span style="color:var(--slate-600); font-size: 0.8rem;">View Only</span>`
        }
      </td>
    `;
    tbody.appendChild(tr);
  });
}

function populateProductSelect() {
  const select = elements.orderProductSelect;
  select.innerHTML = '<option value="">-- Choose a product --</option>';

  state.products.forEach((p) => {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.setAttribute("data-testid", `option-product-${p.sku}`);
    opt.textContent = `${p.name} (${p.sku}) - $${p.price.toFixed(2)} [Stock: ${p.stock_quantity}]`;
    if (p.stock_quantity === 0) {
      opt.disabled = true;
      opt.textContent += " (Out of stock)";
    }
    select.appendChild(opt);
  });
}

// --- Create Product (Admin Only) ---
async function handleCreateProduct(e) {
  e.preventDefault();
  clearAlert(elements.productFormMessage);

  const sku = elements.inputProductSku.value.trim();
  const name = elements.inputProductName.value.trim();
  const price = parseFloat(elements.inputProductPrice.value);
  const stock_quantity = parseInt(elements.inputProductStock.value, 10);

  if (!sku || !name || isNaN(price) || isNaN(stock_quantity)) {
    setAlert(elements.productFormMessage, "All fields are required and must be valid numbers.", "danger");
    return;
  }

  elements.btnCreateProduct.disabled = true;

  try {
    const { ok, status, data } = await apiRequest("/api/products", {
      method: "POST",
      body: JSON.stringify({ sku, name, price, stock_quantity }),
    });

    if (ok) {
      setAlert(elements.productFormMessage, `Product "${name}" (${sku}) created successfully!`, "success");
      elements.createProductForm.reset();
      await loadProducts();
    } else {
      let msg = data && data.detail ? (typeof data.detail === "string" ? data.detail : JSON.stringify(data.detail)) : "Failed to create product.";
      setAlert(elements.productFormMessage, msg, "danger");
    }
  } catch (err) {
    setAlert(elements.productFormMessage, "Error creating product.", "danger");
  } finally {
    elements.btnCreateProduct.disabled = false;
  }
}

// --- Stock Update Modal (Admin Only) ---
window.openStockModal = function (id, sku, currentStock) {
  state.selectedProductForStockUpdate = id;
  elements.stockModalSku.textContent = sku;
  elements.stockModalInput.value = currentStock;
  showElement(elements.stockModal);
  elements.stockModalInput.focus();
};

function closeStockModal() {
  hideElement(elements.stockModal);
  state.selectedProductForStockUpdate = null;
}

async function handleConfirmStockUpdate() {
  if (!state.selectedProductForStockUpdate) return;
  const newStock = parseInt(elements.stockModalInput.value, 10);
  if (isNaN(newStock) || newStock < 0) {
    alert("Please enter a valid stock quantity (>= 0).");
    return;
  }

  elements.btnConfirmStockUpdate.disabled = true;

  try {
    const { ok, data } = await apiRequest(`/api/products/${state.selectedProductForStockUpdate}/stock`, {
      method: "PATCH",
      body: JSON.stringify({ stock_quantity: newStock }),
    });

    if (ok) {
      closeStockModal();
      await loadProducts();
    } else {
      alert((data && data.detail) || "Failed to update stock.");
    }
  } finally {
    elements.btnConfirmStockUpdate.disabled = false;
  }
}

// --- Order Management ---
async function loadOrders() {
  const { ok, data } = await apiRequest("/api/orders");
  if (ok && Array.isArray(data)) {
    state.orders = data;
    renderOrdersTable();
  }
}

function renderOrdersTable() {
  const tbody = elements.ordersTableBody;
  tbody.innerHTML = "";

  if (state.orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: var(--slate-600);">No orders placed yet.</td></tr>`;
    return;
  }

  const isAdmin = state.currentUser && state.currentUser.role === "admin";

  state.orders.forEach((order) => {
    const tr = document.createElement("tr");
    tr.setAttribute("data-testid", `order-row-${order.id}`);

    const badgeClass =
      order.status === "APPROVED"
        ? "badge-approved"
        : order.status === "CANCELLED"
        ? "badge-cancelled"
        : "badge-pending";

    const isPending = order.status === "PENDING";

    tr.innerHTML = `
      <td data-testid="order-id-${order.id}">#${order.id}</td>
      <td data-testid="order-product-${order.id}">
        <strong>${escapeHtml(order.product_name || "Product " + order.product_id)}</strong>
        ${order.product_sku ? `<br><small style="color:var(--slate-600);">${escapeHtml(order.product_sku)}</small>` : ""}
      </td>
      <td data-testid="order-quantity-${order.id}">${order.quantity}</td>
      <td data-testid="order-total-${order.id}">$${order.total_price.toFixed(2)}</td>
      <td>
        <span class="badge ${badgeClass}" data-testid="order-status-${order.id}">${order.status}</span>
      </td>
      <td style="font-size: 0.8rem; color: var(--slate-600);">
        ${order.created_at ? new Date(order.created_at).toLocaleTimeString() : "-"}
      </td>
      <td class="table-actions">
        ${
          isAdmin && isPending
            ? `<button type="button" class="btn btn-success btn-sm" data-testid="btn-approve-order-${order.id}" onclick="updateOrderStatus(${order.id}, 'APPROVED')">Approve</button>
               <button type="button" class="btn btn-danger btn-sm" data-testid="btn-cancel-order-${order.id}" onclick="updateOrderStatus(${order.id}, 'CANCELLED')">Cancel</button>`
            : `<span style="color:var(--slate-600); font-size: 0.8rem;">-</span>`
        }
      </td>
    `;
    tbody.appendChild(tr);
  });
}

// --- Place Order ---
async function handlePlaceOrder(e) {
  e.preventDefault();
  clearAlert(elements.orderFeedback);

  const productId = parseInt(elements.orderProductSelect.value, 10);
  const quantity = parseInt(elements.orderQuantityInput.value, 10);

  if (!productId || isNaN(productId)) {
    setAlert(elements.orderFeedback, "Please select a product.", "danger");
    return;
  }
  if (!quantity || isNaN(quantity) || quantity <= 0) {
    setAlert(elements.orderFeedback, "Quantity must be greater than 0.", "danger");
    return;
  }

  elements.btnPlaceOrder.disabled = true;
  elements.btnPlaceOrder.textContent = "Placing order...";

  try {
    const { ok, status, data } = await apiRequest("/api/orders", {
      method: "POST",
      body: JSON.stringify({ product_id: productId, quantity }),
    });

    if (ok && status === 201) {
      setAlert(elements.orderFeedback, `Order #${data.id} placed successfully!`, "success");
      elements.placeOrderForm.reset();
      elements.orderQuantityInput.value = "1";
      // Refresh both products and orders
      await Promise.all([loadProducts(), loadOrders()]);
    } else {
      const errMsg = (data && data.detail) || "Failed to place order.";
      setAlert(elements.orderFeedback, errMsg, "danger");
    }
  } catch (err) {
    setAlert(elements.orderFeedback, "Network error placing order.", "danger");
  } finally {
    elements.btnPlaceOrder.disabled = false;
    elements.btnPlaceOrder.textContent = "Place Order";
  }
}

// --- Order Status Update (Admin Only) ---
window.updateOrderStatus = async function (orderId, newStatus) {
  const { ok, data } = await apiRequest(`/api/orders/${orderId}/status`, {
    method: "PATCH",
    body: JSON.stringify({ status: newStatus }),
  });

  if (ok) {
    // Refresh both products (stock may have been restored) and orders
    await Promise.all([loadProducts(), loadOrders()]);
  } else {
    alert((data && data.detail) || `Failed to update order status to ${newStatus}.`);
  }
};

// --- Test Reset Handler ---
async function handleResetDb() {
  if (!confirm("Reset database to initial seed data? This will clear all current orders and products.")) {
    return;
  }

  elements.resetDbBtn.disabled = true;
  elements.resetDbBtn.textContent = "Resetting...";

  try {
    const { ok, data } = await apiRequest("/api/test/reset", {
      method: "POST",
    });

    if (ok) {
      alert("Database successfully reset and re-seeded!");
      await refreshAllData();
    } else {
      alert((data && data.detail) || "Failed to reset database.");
    }
  } catch (err) {
    alert("Error communicating with reset endpoint.");
  } finally {
    elements.resetDbBtn.disabled = false;
    elements.resetDbBtn.textContent = "Reset DB";
  }
}

// --- Utility Helpers ---
async function refreshAllData() {
  await Promise.all([loadProducts(), loadOrders()]);
}

function escapeHtml(str) {
  if (typeof str !== "string") return str;
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

// --- Event Listeners Initialization ---
function initEvents() {
  // Login
  elements.loginForm.addEventListener("submit", handleLogin);
  elements.quickLoginAdmin.addEventListener("click", () => {
    elements.loginEmail.value = "admin@example.com";
    elements.loginPassword.value = "Admin123!";
    elements.loginForm.requestSubmit();
  });
  elements.quickLoginUser.addEventListener("click", () => {
    elements.loginEmail.value = "user@example.com";
    elements.loginPassword.value = "User123!";
    elements.loginForm.requestSubmit();
  });

  // Logout
  elements.logoutBtn.addEventListener("click", logout);

  // Reset DB
  elements.resetDbBtn.addEventListener("click", handleResetDb);

  // Forms
  elements.createProductForm.addEventListener("submit", handleCreateProduct);
  elements.placeOrderForm.addEventListener("submit", handlePlaceOrder);

  // Stock Modal
  elements.btnCancelStockUpdate.addEventListener("click", closeStockModal);
  elements.btnConfirmStockUpdate.addEventListener("click", handleConfirmStockUpdate);
}

// Bootstrap on DOM ready
document.addEventListener("DOMContentLoaded", () => {
  initEvents();
  checkAuthSession();
});
