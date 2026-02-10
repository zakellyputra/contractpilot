"use client";

import { useEffect, useState } from "react";
import { useMotionValue, useSpring, useTransform } from "motion/react";

interface RiskScoreGaugeProps {
  score: number; // 0-100
}

function getRiskLabel(score: number) {
  if (score >= 70) return "High Risk";
  if (score >= 40) return "Moderate Risk";
  return "Low Risk";
}

function getRiskColor(score: number) {
  if (score >= 70) return "#ef4444";
  if (score >= 40) return "#f59e0b";
  return "#22c55e";
}

export default function RiskScoreGauge({ score }: RiskScoreGaugeProps) {
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = getRiskColor(score);

  // Animated counter
  const motionScore = useMotionValue(0);
  const springScore = useSpring(motionScore, { stiffness: 50, damping: 20 });
  const displayScore = useTransform(springScore, (v) => Math.round(v));
  const [displayed, setDisplayed] = useState(0);

  useEffect(() => {
    motionScore.set(score);
  }, [score, motionScore]);

  useEffect(() => {
    const unsubscribe = displayScore.on("change", (v) => setDisplayed(v));
    return unsubscribe;
  }, [displayScore]);

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-48 h-48">
        <svg className="w-48 h-48 -rotate-90" viewBox="0 0 200 200">
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="var(--gauge-track)"
            strokeWidth="12"
          />
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth="12"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-4xl font-bold" style={{ color }}>
            {displayed}
          </span>
          <span className="text-gray-500 dark:text-gray-400 text-sm">/100</span>
        </div>
      </div>
      <p className="mt-2 text-lg font-semibold" style={{ color }}>
        {getRiskLabel(score)}
      </p>
    </div>
  );
}
