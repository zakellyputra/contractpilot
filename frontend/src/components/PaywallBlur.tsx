"use client";

import { useState } from "react";
import { usePlan } from "@/contexts/PlanContext";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";

interface PaywallBlurProps {
  children: React.ReactNode;
  featureLabel: string;
  blurPx?: number;
  className?: string;
  reviewId?: string;
  unlocked?: boolean;
}

export default function PaywallBlur({
  children,
  featureLabel,
  blurPx = 10,
  className = "",
  reviewId,
  unlocked = false,
}: PaywallBlurProps) {
  const { isOverride, credits } = usePlan();
  const router = useRouter();
  const unlock = useMutation(api.credits.unlockReview);
  const [showConfirm, setShowConfirm] = useState(false);
  const [unlocking, setUnlocking] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  if (isOverride || unlocked) {
    return <>{children}</>;
  }

  const hasCredits = credits > 0;

  async function handleUnlock() {
    if (!reviewId) return;
    setUnlocking(true);
    setUnlockError(null);
    try {
      await unlock({ reviewId: reviewId as Id<"reviews"> });
      setShowConfirm(false);
    } catch (err) {
      console.error("Unlock error:", err);
      setUnlockError("Failed to unlock. Please try again.");
    } finally {
      setUnlocking(false);
    }
  }

  return (
    <div className={`relative ${className}`}>
      <div
        className="pointer-events-none select-none"
        style={{ filter: `blur(${blurPx}px)` }}
        aria-hidden="true"
      >
        {children}
      </div>

      <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-white/60 backdrop-blur-sm rounded-xl">
        <div className="text-center px-6">
          <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-3">
            <svg className="w-5 h-5 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
              />
            </svg>
          </div>
          <p className="text-sm font-semibold text-gray-900 mb-1">
            Unlock {featureLabel}
          </p>

          {showConfirm ? (
            <div className="mt-2">
              <p className="text-xs text-gray-500 mb-3">
                Use 1 credit to unlock this review? ({credits - 1} will remain)
              </p>
              {unlockError && (
                <p className="text-xs text-red-600 dark:text-red-400 mb-2">{unlockError}</p>
              )}
              <div className="flex gap-2 justify-center">
                <button
                  onClick={handleUnlock}
                  disabled={unlocking}
                  className="px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {unlocking ? "Unlocking..." : "Confirm"}
                </button>
                <button
                  onClick={() => setShowConfirm(false)}
                  className="px-4 py-2 bg-gray-100 text-gray-600 text-xs font-medium rounded-lg hover:bg-gray-200 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : hasCredits && reviewId ? (
            <>
              <p className="text-xs text-gray-500 mb-3">
                Use a credit to see the full analysis
              </p>
              <button
                onClick={() => setShowConfirm(true)}
                className="px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Unlock ({credits} remaining)
              </button>
            </>
          ) : (
            <>
              <p className="text-xs text-gray-500 mb-3">
                Upgrade to see the full analysis
              </p>
              <button
                onClick={() => router.push("/billing")}
                className="px-4 py-2 bg-blue-600 text-white text-xs font-medium rounded-lg hover:bg-blue-700 transition-colors"
              >
                Upgrade - $2.99
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
