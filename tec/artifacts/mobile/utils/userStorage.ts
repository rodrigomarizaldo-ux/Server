/**
 * Module-level user ID that scopes all AsyncStorage keys.
 * Updated by AuthContext whenever the session changes.
 */

let _userId: string | null = null;

export function setCurrentUserId(id: string | null): void {
  _userId = id;
}

export function getCurrentUserId(): string | null {
  return _userId;
}

/**
 * Returns a user-scoped storage key.
 * Falls back to a generic prefix when no user is logged in
 * (should not happen in practice since the auth gate prevents it).
 */
export function getScopedKey(key: string): string {
  const prefix = _userId ? `u_${_userId}` : "u_guest";
  return `${prefix}_${key}`;
}
