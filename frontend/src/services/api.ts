import axios from "axios";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || "http://localhost:5050/api/v1"
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("cbt_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  const isAuthCall = config.url?.startsWith("/auth");
  const role = localStorage.getItem("cbt_role");

  if (!isAuthCall && role && config.url) {
    config.url = `/${role}${config.url}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only a bad/expired TOKEN should sign the user out. Other 401s (wrong login
    // password, wrong current password on the change-password form) must not.
    const message = String(error.response?.data?.error || "");
    const tokenProblem = /token|authorization header/i.test(message) || error.response?.data?.code === "SESSION_INVALID";
    if (error.response?.status === 401 && tokenProblem) {
      // Remember why, so the login page can tell the person (e.g. "school no longer active").
      if (error.response?.data?.code === "SESSION_INVALID") sessionStorage.setItem("cbt_notice", message);
      // Token expired or no longer valid: clear it so the user signs in again.
      localStorage.removeItem("cbt_token");
      localStorage.removeItem("cbt_role");
      localStorage.removeItem("cbt_user");
      if (window.location.pathname !== "/login") window.location.href = "/login";
    }
    // The server refuses everything until a temporary password is replaced
    // (e.g. an admin reset it while this person was signed in).
    if (error.response?.status === 403 && error.response?.data?.code === "PASSWORD_CHANGE_REQUIRED") {
      try {
        const saved = JSON.parse(localStorage.getItem("cbt_user") || "null");
        if (saved) localStorage.setItem("cbt_user", JSON.stringify({ ...saved, mustChangePassword: true }));
      } catch { /* ignore a corrupt saved user */ }
      const role = localStorage.getItem("cbt_role");
      const target = `/${role}/change-password`;
      if (window.location.pathname !== target) window.location.href = target;
    }
    if (error.response?.status === 402) {
      const role = localStorage.getItem("cbt_role");
      const billingPath = `/${role}/billing`;
      if (window.location.pathname !== billingPath) {
        window.location.href = billingPath;
      }
    }
    return Promise.reject(error);
  }
);

export default api;