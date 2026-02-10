"use client";

import { motion } from "motion/react";
import { fadeUp, staggerContainer } from "@/lib/motion";

interface KeyDate {
  date: string;
  label: string;
  type: string;
}

interface RiskTimelineProps {
  keyDates: KeyDate[];
}

const typeColors: Record<string, string> = {
  deadline: "bg-red-500",
  renewal: "bg-blue-500",
  termination: "bg-amber-500",
  milestone: "bg-green-500",
};

export default function RiskTimeline({ keyDates }: RiskTimelineProps) {
  if (!keyDates.length) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide mb-3">
        Key Dates & Deadlines
      </h3>
      <motion.div className="space-y-3" variants={staggerContainer} initial="hidden" animate="visible">
        {keyDates.map((kd, i) => (
          <motion.div key={i} variants={fadeUp} className="flex items-start gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`w-3 h-3 rounded-full ${typeColors[kd.type] || "bg-gray-400"}`}
              />
              {i < keyDates.length - 1 && (
                <div className="w-0.5 h-8 bg-gray-200 dark:bg-gray-700" />
              )}
            </div>
            <div className="-mt-0.5">
              <p className="text-sm font-medium text-gray-900 dark:text-gray-100">{kd.label}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                {kd.date}
                <span className="mx-1">·</span>
                <span className="capitalize">{kd.type}</span>
              </p>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
}
