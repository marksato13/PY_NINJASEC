export const TOKEN_KEY = "ninjasec_token";
export const USER_KEY = "ninjasec_user";

// Canonical user type — used for both session storage and API responses (/auth/me)
export type AuthUser = {
  id: number;
  name?: string;
  full_name?: string;
  role: string;
  email: string;
  job_title?: string | null;
  is_active?: boolean;
  organization_id?: number | null;
  redirect_to?: string;
};

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

export function persistSession(token: string, user: AuthUser): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

export function hasSession(): boolean {
  return Boolean(getStoredToken() && getStoredUser());
}

export function getTokenExpiry(token: string | null): number | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = JSON.parse(
      atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"))
    );
    return typeof payload.exp === "number" ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

export function isTokenExpired(token: string | null = getStoredToken()): boolean {
  const expiry = getTokenExpiry(token);
  if (expiry === null) return false;
  return Date.now() >= expiry;
}

export function isAdminRole(role: string): boolean {
  return role === "super_admin" || role === "admin";
}

export function isPortalRole(role: string): boolean {
  return role === "client";
}

export function getSessionDisplayName(): string {
  const user = getStoredUser();
  return user?.name || user?.email || "Sesion activa";
}
