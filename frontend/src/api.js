const API = import.meta.env.VITE_API_URL;
const TOKEN_KEY = "rolivo_token";

export function getToken() {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token) {
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    /* storage can be blocked; the app still works until refresh */
  }
}

export function clearToken() {
  try {
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

export async function api(path, { method = "GET", body, form } = {}) {
  const headers = {};
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  let payload;
  if (form) {
    payload = form;
  } else if (body !== undefined) {
    headers["Content-Type"] = "application/json";
    payload = JSON.stringify(body);
  }

  let res;
  try {
    res = await fetch(`${API}${path}`, { method, headers, body: payload });
  } catch {
    throw new ApiError(
      "Cannot reach the server. It may be waking up, so try again in a minute.",
      0,
    );
  }

  const text = await res.text();
  let data = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    if (res.status === 401 && token) clearToken();
    const detail = data && typeof data === "object" ? data.detail : null;
    let message = `Request failed (${res.status})`;
    if (typeof detail === "string") message = detail;
    else if (Array.isArray(detail)) message = detail.map((d) => d.msg).join("; ");
    throw new ApiError(message, res.status);
  }
  return data;
}

export async function login(email, password) {
  const data = await api("/auth/login", { method: "POST", body: { email, password } });
  setToken(data.token);
  return data;
}

export async function register(email, password) {
  await api("/auth/register", { method: "POST", body: { email, password } });
  return login(email, password);
}

export const fetchMe = () => api("/auth/me");
