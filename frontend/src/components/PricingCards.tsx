"use client";

import { useBilling } from "@flowglad/nextjs";
import { useState } from "react";

export default function PricingCards() {
  const { loaded, createCheckoutSession, currentSubscription } = useBilling();
  const [loading, setLoading] = useState(false);

  async function handleCheckout() {
    setLoading(true);
    try {
      await createCheckoutSession?.({
        priceSlug: "contract-review-pack",
        quantity: 1,
        successUrl: `${window.location.origin}/?upgraded=true`,
        cancelUrl: `${window.location.origin}/billing`,
        autoRedirect: true,
      });
    } catch (err) {
      console.error("Checkout error:", err);
    } finally {
      setLoading(false);
    }
  }

  const hasSubscription = !!currentSubscription;

  return (
    <div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto">
      {/* Free Tier */}
      <div className="border border-gray-200 dark:border-gray-700 rounded-2xl p-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Free</h3>
        <p className="text-4xl font-bold text-gray-900 dark:text-gray-100 mt-4">
          $0
        </p>
        <p className="text-gray-500 dark:text-gray-400 mt-1">First contract review</p>
        <ul className="mt-6 space-y-3 text-sm text-gray-600 dark:text-gray-400">
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">&#10003;</span>
            1 free contract review
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">&#10003;</span>
            Full risk analysis
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">&#10003;</span>
            PDF report download
          </li>
        </ul>
        <div className="mt-8">
          <span className="block w-full text-center py-3 px-4 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 text-sm">
            Included
          </span>
        </div>
      </div>

      {/* Pay Per Review */}
      <div className="border-2 border-blue-600 rounded-2xl p-8 relative">
        <span className="absolute -top-3 left-6 bg-blue-600 text-white text-xs font-medium px-3 py-1 rounded-full">
          Most Popular
        </span>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Per Review</h3>
        <p className="text-4xl font-bold text-gray-900 dark:text-gray-100 mt-4">
          $2.99
        </p>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Per contract</p>
        <ul className="mt-6 space-y-3 text-sm text-gray-600 dark:text-gray-400">
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">&#10003;</span>
            Unlimited reviews
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">&#10003;</span>
            Full risk analysis + deep reasoning
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">&#10003;</span>
            PDF report download
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">&#10003;</span>
            Review history dashboard
          </li>
        </ul>
        <div className="mt-8">
          <button
            onClick={handleCheckout}
            disabled={!loaded || loading || hasSubscription}
            className="block w-full text-center py-3 px-4 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? "Loading..."
              : hasSubscription
                ? "Active"
                : "Get Started"}
          </button>
        </div>
      </div>
    </div>
  );
}
