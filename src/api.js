const BASE = "/api";

function getToken() {
  return localStorage.getItem("token");
}

async function request(path, options = {}) {
  const token = getToken();
  const res = await fetch(`${BASE}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...options,
  });
  // A 401 on the login call itself just means "wrong credentials" — let it fall through
  // to the normal error handling below instead of forcing a redirect loop back to /login.
  if (res.status === 401 && path !== "/auth/login") {
    localStorage.removeItem("token");
    window.location.assign("/login");
    throw new Error("Session expired — please log in again");
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  login: (username, password) =>
    request("/auth/login", { method: "POST", body: JSON.stringify({ username, password }) }),
  googleLogin: (credential) => request("/auth/google", { method: "POST", body: JSON.stringify({ credential }) }),

  getProducts: () => request("/products"),
  createProduct: (data) => request("/products", { method: "POST", body: JSON.stringify(data) }),
  bulkImportProducts: (rows) => request("/products/bulk-import", { method: "POST", body: JSON.stringify({ rows }) }),
  updateProduct: (id, data) => request(`/products/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  deleteProduct: (id) => request(`/products/${id}`, { method: "DELETE" }),
  getHistory: (id, days = 7) => request(`/products/${id}/history?days=${days}`),
  getHistoryRange: (id, from, to) => request(`/products/${id}/history?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`),
  // One request for every product's stats in a window, instead of one request per
  // product — see PricePoint.statsForAllProducts on the server for why that mattered.
  getAllStats: (from, to) =>
    request(`/products/stats${from && to ? `?from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}` : ""}`),
  getStockEvents: (id) => request(`/products/${id}/stock-events`),
  checkNow: (id) => request(`/products/${id}/check-now`, { method: "POST" }),
  checkAll: () => request("/products/check-all", { method: "POST" }),

  getContactSubmissions: () => request("/contact-form"),
  sendManualReply: (id, message) => request(`/contact-form/${id}/reply`, { method: "POST", body: JSON.stringify({ message }) }),
};
