"use client";

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

  return (
    <div className="flex flex-col items-center">
      <div className="relative w-48 h-48">
        <svg className="w-48 h-48 -rotate-90" viewBox="0 0 200 200">
          <circle
            cx="100"
            cy="100"
            r={radius}
            fill="none"
            stroke="#e5e7eb"
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
            {score}
          </span>
          <span className="text-gray-500 text-sm">/100</span>
        </div>
      </div>
      <p className="mt-2 text-lg font-semibold" style={{ color }}>
        {getRiskLabel(score)}
      </p>
    </div>
  );
}
