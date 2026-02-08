"use client";

import Link from "next/link";
import PricingCards from "@/components/PricingCards";
import ErrorBoundary from "@/components/ErrorBoundary";
import ThemeToggle from "@/components/ThemeToggle";

function PricingFallback() {
  return (
    <div className="max-w-md mx-auto text-center p-8 border border-gray-200 dark:border-gray-700 rounded-2xl">
      <p className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">$2.99</p>
      <p className="text-gray-500 dark:text-gray-400 mb-4">per contract review</p>
      <p className="text-sm text-gray-400 dark:text-gray-500">
        First review free. Billing is being configured.
      </p>
    </div>
  );
}

export default function BillingPage() {
  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
      <div className="max-w-4xl mx-auto px-4 pt-6 pb-16">
        <div className="mb-6 flex justify-between items-center">
          <Link
            href="/"
            className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
          >
            &larr; Back to home
          </Link>
          <ThemeToggle />
        </div>

        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
            Simple Pricing
          </h1>
          <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
            Your first contract review is free. After that, each review is just
            $2.99 — cheaper than a coffee, smarter than a lawyer.
          </p>
        </div>

        <ErrorBoundary fallback={<PricingFallback />}>
          <PricingCards />
        </ErrorBoundary>

        <div className="text-center mt-12 text-sm text-gray-400 dark:text-gray-500">
          Powered by{" "}
          <a
            href="https://flowglad.com"
            target="_blank"
            rel="noopener noreferrer"
            className="underline hover:text-gray-500 dark:hover:text-gray-400"
          >
            Flowglad
          </a>
        </div>
      </div>
    </main>
  );
}
