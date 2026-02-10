"use client";

import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { motion } from "motion/react";
import UserMenu from "@/components/UserMenu";
import ThemeToggle from "@/components/ThemeToggle";
import { fadeUp, staggerContainer, cardHover } from "@/lib/motion";

const STATUS_STYLES: Record<string, { bg: string; text: string; label: string }> = {
  pending: { bg: "bg-gray-100 dark:bg-gray-700", text: "text-gray-600 dark:text-gray-300", label: "Queued" },
  processing: { bg: "bg-blue-100 dark:bg-blue-900", text: "text-blue-700 dark:text-blue-300", label: "Analyzing" },
  completed: { bg: "bg-green-100 dark:bg-green-900", text: "text-green-700 dark:text-green-300", label: "Complete" },
  failed: { bg: "bg-red-100 dark:bg-red-900", text: "text-red-700 dark:text-red-300", label: "Failed" },
};

function riskColor(score: number | undefined) {
  if (score === undefined) return "text-gray-400 dark:text-gray-500";
  if (score >= 70) return "text-red-600";
  if (score >= 40) return "text-amber-600";
  return "text-green-600";
}

export default function DashboardPage() {
  const reviews = useQuery(api.reviews.list, {});

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
      <motion.div className="max-w-4xl mx-auto px-4 pt-12 pb-16" variants={staggerContainer} initial="hidden" animate="visible">
        {/* Header */}
        <motion.div variants={fadeUp} className="flex items-center justify-between mb-8">
          <div>
            <Link href="/" className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300">
              &larr; Back to home
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-2">
              Your Reviews
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/"
              className="px-4 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition-colors"
            >
              New Review
            </Link>
            <ThemeToggle />
            <UserMenu />
          </div>
        </motion.div>

        {/* Loading */}
        {reviews === undefined && (
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="animate-pulse bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-6"
              >
                <div className="h-4 bg-gray-200 dark:bg-gray-700 rounded w-1/3 mb-3" />
                <div className="h-3 bg-gray-100 dark:bg-gray-600 rounded w-1/4" />
              </div>
            ))}
          </div>
        )}

        {/* Empty */}
        {reviews && reviews.length === 0 && (
          <div className="text-center py-16">
            <svg
              className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
              />
            </svg>
            <p className="text-gray-500 dark:text-gray-400 mb-4">No reviews yet</p>
            <Link
              href="/"
              className="text-blue-600 dark:text-blue-400 hover:underline text-sm"
            >
              Upload your first contract
            </Link>
          </div>
        )}

        {/* Review list */}
        {reviews && reviews.length > 0 && (
          <motion.div className="space-y-3" variants={staggerContainer} initial="hidden" animate="visible">
            {reviews.map((review) => {
              const status = STATUS_STYLES[review.status] ?? STATUS_STYLES.pending;
              return (
                <motion.div key={review._id} variants={fadeUp} whileHover={cardHover}>
                <Link
                  href={`/review/${review._id}`}
                  className="block bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-5 hover:border-blue-300 dark:hover:border-blue-600 hover:shadow-sm transition-all"
                >
                  <div className="flex items-center justify-between">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-medium text-gray-900 dark:text-gray-100 truncate">
                        {review.filename}
                      </h3>
                      <div className="flex items-center gap-3 mt-1.5">
                        <span
                          className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${status.bg} ${status.text}`}
                        >
                          {review.status === "processing" && (
                            <span className="w-1.5 h-1.5 bg-blue-500 rounded-full mr-1.5 animate-pulse" />
                          )}
                          {status.label}
                        </span>
                        {review.contractType && (
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            {review.contractType}
                          </span>
                        )}
                        {review.ocrUsed && (
                          <span className="text-xs text-gray-400 dark:text-gray-500">
                            OCR
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Risk score */}
                    <div className="ml-4 text-right">
                      {review.riskScore !== undefined ? (
                        <span
                          className={`text-2xl font-bold ${riskColor(review.riskScore)}`}
                        >
                          {review.riskScore}
                        </span>
                      ) : (
                        <span className="text-2xl font-bold text-gray-200 dark:text-gray-700">
                          --
                        </span>
                      )}
                      <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">
                        Risk Score
                      </p>
                    </div>
                  </div>
                </Link>
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </motion.div>
    </main>
  );
}
