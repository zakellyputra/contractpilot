"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import { motion, AnimatePresence } from "motion/react";
import QuickSummaryView from "@/components/QuickSummaryView";
import DeepReviewView from "@/components/DeepReviewView";
import { getPdfUrl } from "@/lib/api";
import Link from "next/link";
import ThemeToggle from "@/components/ThemeToggle";
import { fadeUp, staggerContainer, viewTransition } from "@/lib/motion";

const STEPS = [
  { label: "Uploading", key: "pending" },
  { label: "Extracting text", key: "processing" },
  { label: "Analyzing clauses", key: "analyzing" },
  { label: "Generating report", key: "reporting" },
  { label: "Complete", key: "completed" },
];

function getStepIndex(status: string, clauseCount: number): number {
  if (status === "pending") return 0;
  if (status === "processing" && clauseCount === 0) return 1;
  if (status === "processing" && clauseCount > 0) return 2;
  if (status === "completed") return 4;
  return 1;
}

export default function ReviewPage() {
  const params = useParams();
  const reviewId = params.id as string;
  const [viewMode, setViewMode] = useState<"quick" | "deep">("quick");

  const review = useQuery(api.reviews.get, {
    id: reviewId as Id<"reviews">,
  });
  const clauses = useQuery(api.clauses.getByReview, {
    reviewId: reviewId as Id<"reviews">,
  });

  // Loading state
  if (review === undefined) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-gray-500 dark:text-gray-400">Loading review...</p>
        </div>
      </main>
    );
  }

  // Not found
  if (review === null) {
    return (
      <main className="min-h-screen bg-gray-50 dark:bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
            Review not found
          </h1>
          <Link href="/" className="text-blue-600 dark:text-blue-400 hover:underline">
            Upload a new contract
          </Link>
        </div>
      </main>
    );
  }

  const isProcessing =
    review.status === "pending" || review.status === "processing";
  const clauseCount = clauses?.length ?? 0;
  const stepIndex = getStepIndex(review.status, clauseCount);
  const isCompleted = review.status === "completed";
  const hasResults = isCompleted || (isProcessing && clauseCount > 0);
  const isUnlocked = review.unlocked === true;

  const mappedClauses = (clauses ?? []).map((c) => ({
    ...c,
    _id: c._id as string,
  }));

  // Top 3 highest-risk clauses for Quick Summary (exclude sub-clauses)
  const RISK_ORDER: Record<string, number> = { high: 0, medium: 1, low: 2 };
  const topClauses = [...mappedClauses]
    .filter((c) => !c.parentHeading)
    .sort(
      (a, b) =>
        (RISK_ORDER[a.riskLevel] ?? 1) - (RISK_ORDER[b.riskLevel] ?? 1) ||
        (b.clauseText?.length ?? 0) - (a.clauseText?.length ?? 0)
    )
    .slice(0, 3);

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div
        className={`mx-auto px-4 py-8 ${viewMode === "deep" && hasResults ? "max-w-7xl" : "max-w-4xl"}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/dashboard"
            className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200 flex items-center gap-1 text-sm"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M15 19l-7-7 7-7"
              />
            </svg>
            Dashboard
          </Link>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
            Contract<span className="text-blue-600">Pilot</span>
          </h1>
          <ThemeToggle />
        </div>

        {/* Progress stepper */}
        {isProcessing && (
          <motion.div variants={fadeUp} initial="hidden" animate="visible" className="mb-8 bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
            <div className="flex items-center justify-between mb-4">
              {STEPS.map((step, i) => (
                <div key={step.key} className="flex items-center flex-1 last:flex-none">
                  <div className="flex flex-col items-center">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                        i < stepIndex
                          ? "bg-green-500 text-white"
                          : i === stepIndex
                            ? "bg-blue-500 text-white animate-pulse"
                            : "bg-gray-200 dark:bg-gray-700 text-gray-400 dark:text-gray-500"
                      }`}
                    >
                      {i < stepIndex ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                        </svg>
                      ) : (
                        i + 1
                      )}
                    </div>
                    <span className={`text-xs mt-1.5 hidden sm:block ${
                      i <= stepIndex ? "text-gray-700 dark:text-gray-300" : "text-gray-400 dark:text-gray-500"
                    }`}>
                      {step.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-2 ${
                        i < stepIndex ? "bg-green-500" : "bg-gray-200 dark:bg-gray-700"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>

            {/* Live progress */}
            {review.totalClauses != null && review.totalClauses > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-gray-600 dark:text-gray-400">
                    Analyzing clause {Math.min((review.completedClauses ?? 0) + 1, review.totalClauses)} of {review.totalClauses}...
                  </span>
                  <span className="font-medium text-blue-600">
                    {Math.round(((review.completedClauses ?? 0) / review.totalClauses) * 100)}%
                  </span>
                </div>
                <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                  <div
                    className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                    style={{ width: `${((review.completedClauses ?? 0) / review.totalClauses) * 100}%` }}
                  />
                </div>
                <p className="text-xs text-gray-400 dark:text-gray-500 text-center">
                  {review.totalClauses} clauses detected
                </p>
              </div>
            ) : clauseCount > 0 ? (
              <p className="text-sm text-blue-600 text-center">
                {clauseCount} clause{clauseCount !== 1 ? "s" : ""} analyzed so far...
              </p>
            ) : null}
          </motion.div>
        )}

        {/* Failed state */}
        {review.status === "failed" && (
          <div className="mb-6 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
            <svg className="w-10 h-10 text-red-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p className="text-red-700 dark:text-red-400 font-medium">Analysis failed</p>
            <p className="text-red-500 dark:text-red-400 text-sm mt-1">
              Something went wrong. Please try uploading your contract again.
            </p>
            <Link
              href="/"
              className="inline-block mt-4 px-4 py-2 bg-red-600 text-white rounded-lg text-sm hover:bg-red-700 transition-colors"
            >
              Try again
            </Link>
          </div>
        )}

        {/* View mode toggle — show when results are available */}
        {hasResults && (
          <>
            <div className="flex gap-1 bg-gray-100 dark:bg-gray-800 rounded-lg p-1 mb-6">
              <button
                onClick={() => setViewMode("quick")}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  viewMode === "quick"
                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
                Quick Summary
              </button>
              <button
                onClick={() => setViewMode("deep")}
                className={`flex-1 py-2 px-4 rounded-md text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                  viewMode === "deep"
                    ? "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm"
                    : "text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200"
                }`}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Deep Review
              </button>
            </div>

            <AnimatePresence mode="wait">
              {viewMode === "quick" ? (
                <motion.div key="quick" variants={viewTransition} initial="initial" animate="animate" exit="exit">
                  <QuickSummaryView
                    review={{ ...review, _id: reviewId }}
                    clauses={topClauses}
                    allClauses={mappedClauses}
                    totalClauseCount={mappedClauses.length}
                    reviewId={reviewId}
                    unlocked={isUnlocked}
                  />
                </motion.div>
              ) : (
                <motion.div key="deep" variants={viewTransition} initial="initial" animate="animate" exit="exit">
                  <DeepReviewView
                    pdfUrl={getPdfUrl(reviewId)}
                    clauses={mappedClauses}
                    contractType={review.contractType || "General Contract"}
                    reviewId={reviewId}
                    unlocked={isUnlocked}
                  />
                </motion.div>
              )}
            </AnimatePresence>
          </>
        )}
      </div>
    </main>
  );
}
