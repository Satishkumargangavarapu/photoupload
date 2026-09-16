const API = import.meta.env.VITE_API_URL || "http://localhost:8000";
export const token = () => localStorage.getItem("token");
export async function request(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers);
  if (token()) headers.set("Authorization", `Bearer ${token()}`);
  if (!(options.body instanceof FormData)) headers.set("Content-Type", "application/json");
  const response = await fetch(`${API}${path}`, { ...options, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Request failed");
  return data;
}

