const API_BASE = 'http://localhost:4000/api';

async function request(endpoint, options = {}) {
  const token = localStorage.getItem('erp_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers,
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    const error = new Error(data.error || `HTTP error ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
}

export const api = {
  // Auth
  login: (email, password) =>
    request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    }),
  getMe: () => request('/auth/me'),

  // Customers
  getCustomers: () => request('/customers'),
  createCustomer: (data) =>
    request('/customers', {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Products & Inventory
  getProducts: () => request('/products'),
  getInventory: () => request('/inventory'),

  // Enquiries
  getEnquiries: () => request('/enquiries'),
  getEnquiryById: (id) => request(`/enquiries/${id}`),
  createEnquiry: (data) =>
    request('/enquiries', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateEnquiryStatus: (id, status) =>
    request(`/enquiries/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),

  // Quotations
  getQuotations: () => request('/quotations'),
  getQuotationById: (id) => request(`/quotations/${id}`),
  createQuotation: (data) =>
    request('/quotations', {
      method: 'POST',
      body: JSON.stringify(data),
    }),
  updateQuotationStatus: (id, status) =>
    request(`/quotations/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    }),
  convertQuotation: (id) =>
    request(`/quotations/${id}/convert`, {
      method: 'POST',
    }),

  // Sales Orders
  getSalesOrders: () => request('/sales-orders'),
  getSalesOrderById: (id) => request(`/sales-orders/${id}`),
  confirmSalesOrder: (id) =>
    request(`/sales-orders/${id}/confirm`, {
      method: 'POST',
    }),
  cancelSalesOrder: (id) =>
    request(`/sales-orders/${id}/cancel`, {
      method: 'PATCH',
    }),
  dispatchSalesOrder: (id, data) =>
    request(`/sales-orders/${id}/dispatch`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  // Dispatches
  getDispatches: () => request('/dispatches'),
};
