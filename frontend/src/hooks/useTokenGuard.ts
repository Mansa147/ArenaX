"use client";

import { useCallback, useState } from "react";
import { useAuth } from "@/hooks/useAuth";

// ─── JWT expiry helpers ───────────────────────────────────────────────────────

/**
 * Decode the `exp` claim from a JWT without a third-party library.
 * Returns the expiry as a Unix timestamp (seconds), or `null` when the
 * token is absent, malformed, or missing the claim.
 *
 * @testable — exported so unit tests can exercise it in isolation.
 */
export function getTokenExpirySeconds(token: string | null | undefined): number | null {
  if (!token) return null;
  try {
    const parts = token.split(".");
    if (parts.length !== 3) return null;
    // Base64url → Base64 → JSON
    const payload = atob(parts[1].replace(/-/g, "+").replace(/_/g, "/"));
    const json = JSON.parse(payload) as { exp?: number };
    return typeof json.exp === "number" ? json.exp : null;
  } catch {
    return null;
  }
}

/**
 * Returns the number of seconds until the token expires.
 * Negative values mean it has already expired.
 * Returns `null` when expiry cannot be determined.
 */
export function secondsUntilExpiry(token: string | null | undefined): number | null {
  const exp = getTokenExpirySeconds(token);
  if (exp === null) return null;
  return exp - Math.floor(Date.now() / 1000);
}

/**
 * Returns `true` when the token is valid and has more than `bufferSeconds`
 * remaining. Returns `false` if it is expired, about to expire, or absent.
 */
export function isTokenFresh(
  token: string | null | undefined,
  bufferSeconds = 60,
): boolean {
  const remaining = secondsUntilExpiry(token);
  if (remaining === null) return false;
  return remaining > bufferSeconds;
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export type SessionExpiredReason = "expired" | "refresh_failed" | null;

export interface UseTokenGuardReturn {
  /**
   * Call this before submitting any transaction that requires a valid backend
   * session. It will:
   *
   * 1. Check whether the stored token has ≥60 s remaining.
   * 2. If not, attempt a silent refresh via `ApiClient`.
   * 3. If the refresh succeeds, return `true`.
   * 4. If the refresh fails (or there is no token), set `sessionExpiredReason`
   *    and return `false` — the caller should abort the operation and show the
   *    `SessionExpiredModal`.
   */
  ensureTokenValid: () => Promise<boolean>;
  /** Non-null when the session has expired and the modal should be shown. */
  sessionExpiredReason: SessionExpiredReason;
  /** Reset the reason after the modal has been dismissed / handled. */
  clearSessionExpired: () => void;
  /** True while a proactive refresh is in flight. */
  isRefreshing: boolean;
}

const TOKEN_KEY = "auth_token";

function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY) ?? sessionStorage.getItem(TOKEN_KEY);
}

/**
 * Provides pre-transaction token validation with proactive refresh.
 *
 * @example
 * ```tsx
 * const { ensureTokenValid, sessionExpiredReason, clearSessionExpired } = useTokenGuard();
 *
 * const handleSubmit = async () => {
 *   if (!(await ensureTokenValid())) return; // modal shown automatically
 *   await submitTransaction();
 * };
 * ```
 */
export function useTokenGuard(): UseTokenGuardReturn {
  const { refreshAccessToken, isRefreshing } = useAuth();
  const [sessionExpiredReason, setSessionExpiredReason] =
    useState<SessionExpiredReason>(null);

  const clearSessionExpired = useCallback(() => {
    setSessionExpiredReason(null);
  }, []);

  const ensureTokenValid = useCallback(async (): Promise<boolean> => {
    const token = getStoredToken();

    // Token is fresh — nothing to do
    if (isTokenFresh(token, 60)) return true;

    // Token is missing, already expired, or within 60 s of expiry — try refresh
    try {
      await refreshAccessToken();
      return true;
    } catch {
      // Refresh failed — session is unrecoverable, show modal
      const reason: SessionExpiredReason =
        token === null ? "expired" : "refresh_failed";
      setSessionExpiredReason(reason);
      return false;
    }
  }, [refreshAccessToken]);

  return {
    ensureTokenValid,
    sessionExpiredReason,
    clearSessionExpired,
    isRefreshing,
  };
}
