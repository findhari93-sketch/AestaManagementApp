"use client";

import { useEffect, useCallback } from "react";
import { usePathname } from "next/navigation";

/**
 * Global listener for session-related errors.
 * Handles cases where RSC requests fail due to session expiry (401 responses).
 * Works in conjunction with middleware that returns 401 for RSC requests.
 */
export function SessionErrorHandler({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();

  const handleSessionExpired = useCallback(() => {
    // Avoid redirect loop if already on login page
    if (pathname === "/login") {
      return;
    }
    console.warn("[SessionErrorHandler] Session expired - redirecting to login");
    // Use window.location for full page refresh to ensure clean auth state
    window.location.href = "/login?session_expired=true";
  }, [pathname]);

  useEffect(() => {
    // Listen for session refresh failures from SessionManager
    const handleSessionRefreshFailed = (
      event: CustomEvent<{ error: string }>
    ) => {
      console.warn(
        "[SessionErrorHandler] Session refresh failed:",
        event.detail.error
      );
      // Only redirect if the error indicates a truly expired session
      // Network errors should not trigger redirect
      if (
        event.detail.error?.includes("expired") ||
        event.detail.error?.includes("invalid") ||
        event.detail.error?.includes("Invalid Refresh Token")
      ) {
        handleSessionExpired();
      }
    };

    // Intercept fetch to detect 401 responses with session expired header
    const originalFetch = window.fetch;
    window.fetch = async (...args) => {
      try {
        const response = await originalFetch(...args);

        // Check for session expired response from middleware
        if (
          response.status === 401 &&
          response.headers.get("X-Session-Expired") === "true"
        ) {
          handleSessionExpired();
        }

        return response;
      } catch (error) {
        throw error;
      }
    };

    window.addEventListener(
      "session-refresh-failed",
      handleSessionRefreshFailed as EventListener
    );

    return () => {
      window.removeEventListener(
        "session-refresh-failed",
        handleSessionRefreshFailed as EventListener
      );
      // Restore original fetch
      window.fetch = originalFetch;
    };
  }, [handleSessionExpired]);

  return <>{children}</>;
}
