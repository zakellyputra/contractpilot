"use client";

import Link from "next/link";
import { motion } from "motion/react";
import PricingCards from "@/components/PricingCards";
import ErrorBoundary from "@/components/ErrorBoundary";
import { usePlan } from "@/contexts/PlanContext";
import ThemeToggle from "@/components/ThemeToggle";
import { fadeUp, staggerContainer } from "@/lib/motion";

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
  const { plan, setPlan } = usePlan();

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

        <motion.div variants={staggerContainer} initial="hidden" animate="visible">
          <motion.div variants={fadeUp} className="text-center mb-12">
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-3">
              Simple Pricing
            </h1>
            <p className="text-gray-600 dark:text-gray-400 max-w-md mx-auto">
              Each bundle gives you 5 contract review credits for just $2.99.
              Unlock any review to see the full AI risk analysis.
            </p>
          </motion.div>

          <motion.div variants={fadeUp}>
            <ErrorBoundary fallback={<PricingFallback />}>
              <PricingCards />
            </ErrorBoundary>
          </motion.div>
        </motion.div>

        {/* Demo toggle */}
        <div className="mt-10 max-w-sm mx-auto">
          <div className="border border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-5 bg-gray-50 dark:bg-gray-800">
            <p className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide mb-3 text-center">
              Demo Mode
            </p>
            <div className="flex gap-3 justify-center">
              <label
                className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer border text-sm font-medium transition-colors ${
                  plan === "free"
                    ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                    : "border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                <input
                  type="radio"
                  name="plan"
                  value="free"
                  checked={plan === "free"}
                  onChange={() => setPlan("free")}
                  className="accent-blue-600"
                />
                Free User
              </label>
              <label
                className={`flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer border text-sm font-medium transition-colors ${
                  plan === "paid"
                    ? "border-blue-600 bg-blue-50 text-blue-700 dark:bg-blue-900 dark:text-blue-300"
                    : "border-gray-200 dark:border-gray-600 text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700"
                }`}
              >
                <input
                  type="radio"
                  name="plan"
                  value="paid"
                  checked={plan === "paid"}
                  onChange={() => setPlan("paid")}
                  className="accent-blue-600"
                />
                Paid User
              </label>
            </div>
          </div>
        </div>

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
