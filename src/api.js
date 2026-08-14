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
  // A 401/403 on the login calls themselves just means "wrong credentials" / "not yet
  // approved" — let those fall through to the normal error handling below so the login
  // page's own catch block can show its dedicated screens, instead of this redirecting
  // out from under it.
  const isAuthEndpoint = path === "/auth/login" || path === "/auth/google";
  if (res.status === 401 && !isAuthEndpoint) {
    localStorage.removeItem("token");
    window.location.assign("/login");
    throw new Error("Session expired — please log in again");
  }
  if (res.status === 403 && !isAuthEndpoint) {
    const body = await res.json().catch(() => ({}));
    // A superadmin can deactivate/un-approve an account while it's mid-session — this
    // catches that on its very next request instead of waiting for the JWT to expire.
    if (body.error === "ACCOUNT_SUSPENDED" || body.error === "ACCOUNT_PENDING_REVIEW") {
      localStorage.removeItem("token");
      localStorage.removeItem("username");
      localStorage.removeItem("role");
      window.location.assign(`/login?blocked=${body.error === "ACCOUNT_SUSPENDED" ? "suspended" : "pending"}`);
      throw new Error(body.error);
    }
    throw new Error(body.error || "Forbidden");
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

  getUsers: () => request("/users"),
  approveUser: (id, role) => request(`/users/${id}/approve`, { method: "PUT", body: JSON.stringify({ role }) }),
  setUserActive: (id, active) => request(`/users/${id}/active`, { method: "PUT", body: JSON.stringify({ active }) }),
};
