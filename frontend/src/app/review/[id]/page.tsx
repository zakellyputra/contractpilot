"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import RiskDashboard from "@/components/RiskDashboard";
import Link from "next/link";

export default function ReviewPage() {
  const params = useParams();
  const reviewId = params.id as string;

  // Real-time queries — auto-update as Python backend writes results
  const review = useQuery(api.reviews.get, {
    id: reviewId as Id<"reviews">,
  });
  const clauses = useQuery(api.clauses.getByReview, {
    reviewId: reviewId as Id<"reviews">,
  });

  if (review === undefined) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-pulse text-gray-500">Loading review...</div>
      </main>
    );
  }

  if (review === null) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-2">
            Review not found
          </h1>
          <Link href="/" className="text-blue-600 hover:underline">
            Upload a new contract
          </Link>
        </div>
      </main>
    );
  }

  const isProcessing =
    review.status === "pending" || review.status === "processing";

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/"
            className="text-gray-500 hover:text-gray-700 flex items-center gap-1"
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
            Back
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">
            Contract<span className="text-blue-600">Pilot</span>
          </h1>
          <div />
        </div>

        {/* Processing state */}
        {isProcessing && (
          <div className="mb-6 bg-blue-50 border border-blue-200 rounded-xl p-6 text-center">
            <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-blue-700 font-medium">
              Analyzing your contract...
            </p>
            <p className="text-blue-500 text-sm mt-1">
              {review.status === "pending"
                ? "Queued for analysis"
                : "AI agents are reviewing clauses"}
            </p>
          </div>
        )}

        {/* Failed state */}
        {review.status === "failed" && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <p className="text-red-700 font-medium">Analysis failed</p>
            <p className="text-red-500 text-sm mt-1">
              Please try uploading your contract again.
            </p>
            <Link
              href="/"
              className="inline-block mt-3 text-blue-600 hover:underline"
            >
              Try again
            </Link>
          </div>
        )}

        {/* Results */}
        {review.status === "completed" && (
          <RiskDashboard
            review={{ ...review, _id: reviewId }}
            clauses={(clauses ?? []).map((c) => ({
              ...c,
              _id: c._id as string,
            }))}
          />
        )}

        {/* Show partial results even while processing */}
        {isProcessing && clauses && clauses.length > 0 && (
          <RiskDashboard
            review={{ ...review, _id: reviewId }}
            clauses={clauses.map((c) => ({
              ...c,
              _id: c._id as string,
            }))}
          />
        )}
      </div>
    </main>
  );
}
