"use client";

import { motion } from "motion/react";
import { fadeUp, staggerContainer } from "@/lib/motion";

interface ActionItemsProps {
  items: string[];
}

export default function ActionItems({ items }: ActionItemsProps) {
  if (!items.length) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
        What to Do Next
      </h3>
      <motion.ol className="space-y-2" variants={staggerContainer} initial="hidden" animate="visible">
        {items.map((item, i) => (
          <motion.li key={i} variants={fadeUp} className="flex items-start gap-3">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 text-xs font-bold shrink-0 mt-0.5">
              {i + 1}
            </span>
            <span className="text-gray-700 dark:text-gray-300">{item}</span>
          </motion.li>
        ))}
      </motion.ol>
    </div>
  );
}
