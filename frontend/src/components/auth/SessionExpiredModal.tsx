"use client";

import { useRouter } from "next/navigation";
import { ShieldAlert, RefreshCw, LogIn } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useAuth } from "@/hooks/useAuth";
import type { SessionExpiredReason } from "@/hooks/useTokenGuard";

interface SessionExpiredModalProps {
  /** Non-null when the modal should be visible. */
  reason: SessionExpiredReason;
  /** Called when the user dismisses the modal without re-authenticating. */
  onDismiss: () => void;
}

const MESSAGES: Record<NonNullable<SessionExpiredReason>, { title: string; body: string }> = {
  expired: {
    title: "Session Expired",
    body: "Your session has expired. Please sign in again to continue.",
  },
  refresh_failed: {
    title: "Session Expired",
    body: "We couldn't refresh your session automatically. Please sign in again to continue.",
  },
};

/**
 * Full-screen blocking modal shown when a pre-transaction token check fails.
 * Gives the user the choice to re-authenticate or cancel the current action.
 */
export function SessionExpiredModal({ reason, onDismiss }: SessionExpiredModalProps) {
  const router = useRouter();
  const { logout } = useAuth();

  if (!reason) return null;

  const { title, body } = MESSAGES[reason];

  const handleSignIn = () => {
    logout();
    // Preserve current path so the user is redirected back after login
    const returnTo = encodeURIComponent(window.location.pathname + window.location.search);
    router.push(`/login?reason=session_expired&returnTo=${returnTo}`);
  };

  return (
    /* Backdrop */
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="session-expired-title"
      aria-describedby="session-expired-body"
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
    >
      <div className="w-full max-w-sm rounded-2xl border border-destructive/30 bg-background p-8 text-center shadow-2xl">
        {/* Icon */}
        <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
          <ShieldAlert className="h-8 w-8 text-destructive" aria-hidden="true" />
        </div>

        {/* Text */}
        <h2
          id="session-expired-title"
          className="mb-2 text-xl font-bold text-foreground"
        >
          {title}
        </h2>
        <p
          id="session-expired-body"
          className="mb-8 text-sm leading-relaxed text-muted-foreground"
        >
          {body}
        </p>

        {/* Actions */}
        <div className="flex flex-col gap-3">
          <Button onClick={handleSignIn} className="w-full gap-2" size="lg">
            <LogIn className="h-4 w-4" aria-hidden="true" />
            Sign In Again
          </Button>
          <Button
            variant="ghost"
            className="w-full text-muted-foreground"
            onClick={onDismiss}
          >
            Cancel
          </Button>
        </div>
      </div>
    </div>
  );
}
