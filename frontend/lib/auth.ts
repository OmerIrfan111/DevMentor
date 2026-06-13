"use client";

export function setAuthToken(token: string, expiresIn: number): void {
  const expires = new Date(Date.now() + expiresIn * 1000).toUTCString();
  document.cookie = `auth_token=${encodeURIComponent(token)}; path=/; expires=${expires}; SameSite=Strict`;
}

export function clearAuthToken(): void {
  document.cookie = "auth_token=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
}

export function getAuthToken(): string | null {
  if (typeof document === "undefined") return null;
  const match = document.cookie.match(/(?:^|;\s*)auth_token=([^;]+)/);
  return match ? decodeURIComponent(match[1]) : null;
}

export function isAuthenticated(): boolean {
  return !!getAuthToken();
}
