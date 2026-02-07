"use client";

import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import RiskDashboard from "@/components/RiskDashboard";
import Link from "next/link";

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

  const review = useQuery(api.reviews.get, {
    id: reviewId as Id<"reviews">,
  });
  const clauses = useQuery(api.clauses.getByReview, {
    reviewId: reviewId as Id<"reviews">,
  });

  // Loading state
  if (review === undefined) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin h-8 w-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-3" />
          <p className="text-gray-500">Loading review...</p>
        </div>
      </main>
    );
  }

  // Not found
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
  const clauseCount = clauses?.length ?? 0;
  const stepIndex = getStepIndex(review.status, clauseCount);

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/dashboard"
            className="text-gray-500 hover:text-gray-700 flex items-center gap-1 text-sm"
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
          <h1 className="text-2xl font-bold text-gray-900">
            Contract<span className="text-blue-600">Pilot</span>
          </h1>
          <div className="w-20" />
        </div>

        {/* Progress stepper */}
        {isProcessing && (
          <div className="mb-8 bg-white border border-gray-200 rounded-xl p-6">
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
                            : "bg-gray-200 text-gray-400"
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
                      i <= stepIndex ? "text-gray-700" : "text-gray-400"
                    }`}>
                      {step.label}
                    </span>
                  </div>
                  {i < STEPS.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-2 ${
                        i < stepIndex ? "bg-green-500" : "bg-gray-200"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>

            {clauseCount > 0 && (
              <p className="text-sm text-blue-600 text-center">
                {clauseCount} clause{clauseCount !== 1 ? "s" : ""} analyzed so far...
              </p>
            )}
          </div>
        )}

        {/* Failed state */}
        {review.status === "failed" && (
          <div className="mb-6 bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <svg className="w-10 h-10 text-red-400 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
            </svg>
            <p className="text-red-700 font-medium">Analysis failed</p>
            <p className="text-red-500 text-sm mt-1">
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

        {/* Results — show when completed OR when we have partial clauses during processing */}
        {(review.status === "completed" ||
          (isProcessing && clauseCount > 0)) && (
          <RiskDashboard
            review={{ ...review, _id: reviewId }}
            clauses={(clauses ?? []).map((c) => ({
              ...c,
              _id: c._id as string,
            }))}
          />
        )}
      </div>
    </main>
  );
}
