"use client";

import { useBilling, usePricing } from "@flowglad/nextjs";
import { useState } from "react";
import { usePlan } from "@/contexts/PlanContext";
import { motion } from "motion/react";
import { fadeUp, staggerContainer, cardHover } from "@/lib/motion";

export default function PricingCards() {
  const { loaded, createCheckoutSession } = useBilling();
  const pricingModel = usePricing();
  const [loading, setLoading] = useState(false);
  const { credits } = usePlan();

  const defaultPrice = pricingModel?.products?.[0]?.defaultPrice;

  async function handleCheckout() {
    if (!defaultPrice) return;
    setLoading(true);
    try {
      await createCheckoutSession?.({
        priceId: defaultPrice.id,
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

  return (
    <motion.div className="grid md:grid-cols-2 gap-8 max-w-2xl mx-auto" variants={staggerContainer} initial="hidden" animate="visible">
      {/* Free Tier */}
      <motion.div variants={fadeUp} whileHover={cardHover} className="border border-gray-200 dark:border-gray-700 rounded-2xl p-8">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Free</h3>
        <p className="text-4xl font-bold text-gray-900 dark:text-gray-100 mt-4">
          $0
        </p>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Upload any contract</p>
        <ul className="mt-6 space-y-3 text-sm text-gray-600 dark:text-gray-400">
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">&#10003;</span>
            Upload &amp; store contracts
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">&#10003;</span>
            Risk score preview
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">&#10003;</span>
            Top finding visible
          </li>
        </ul>
        <div className="mt-8">
          <span className="block w-full text-center py-3 px-4 rounded-xl border border-gray-300 dark:border-gray-600 text-gray-400 dark:text-gray-500 text-sm">
            Included
          </span>
        </div>
      </motion.div>

      {/* Review Bundle */}
      <motion.div variants={fadeUp} whileHover={cardHover} className="border-2 border-blue-600 rounded-2xl p-8 relative">
        <span className="absolute -top-3 left-6 bg-blue-600 text-white text-xs font-medium px-3 py-1 rounded-full">
          Best Value
        </span>
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Review Bundle</h3>
        <p className="text-4xl font-bold text-gray-900 dark:text-gray-100 mt-4">
          $2.99
        </p>
        <p className="text-gray-500 dark:text-gray-400 mt-1">5 contract reviews</p>
        <ul className="mt-6 space-y-3 text-sm text-gray-600 dark:text-gray-400">
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">&#10003;</span>
            5 review credits
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">&#10003;</span>
            Full risk analysis + deep reasoning
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">&#10003;</span>
            AI clause chat
          </li>
          <li className="flex items-start gap-2">
            <span className="text-green-500 mt-0.5">&#10003;</span>
            PDF report download
          </li>
        </ul>
        {credits > 0 && (
          <p className="text-sm text-green-600 dark:text-green-400 font-medium mt-4 text-center">
            {credits} credit{credits !== 1 ? "s" : ""} remaining
          </p>
        )}
        <div className="mt-4">
          <button
            onClick={handleCheckout}
            disabled={!loaded || !defaultPrice || loading}
            className="block w-full text-center py-3 px-4 rounded-xl bg-blue-600 text-white font-medium hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading
              ? "Loading..."
              : credits > 0
                ? "Buy More Credits"
                : "Get Started"}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}
