"use client";

interface RiskBreakdownChartProps {
  financial: number;
  compliance: number;
  operational: number;
  reputational: number;
}

const categories = [
  { key: "financial", label: "Financial", color: "#ef4444", icon: "$" },
  { key: "compliance", label: "Compliance", color: "#f59e0b", icon: "!" },
  { key: "operational", label: "Operational", color: "#3b82f6", icon: "~" },
  { key: "reputational", label: "Reputational", color: "#8b5cf6", icon: "*" },
] as const;

export default function RiskBreakdownChart({
  financial,
  compliance,
  operational,
  reputational,
}: RiskBreakdownChartProps) {
  const scores: Record<string, number> = {
    financial,
    compliance,
    operational,
    reputational,
  };

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
        Risk by Category
      </h3>
      {categories.map((cat) => {
        const score = scores[cat.key];
        return (
          <div key={cat.key} className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-white text-sm font-bold shrink-0"
              style={{ backgroundColor: cat.color }}
            >
              {cat.icon}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                  {cat.label}
                </span>
                <span className="text-sm font-bold" style={{ color: cat.color }}>
                  {score}
                </span>
              </div>
              <div className="w-full bg-gray-100 dark:bg-gray-700 rounded-full h-2.5">
                <div
                  className="h-2.5 rounded-full transition-all duration-1000 ease-out"
                  style={{
                    width: `${score}%`,
                    backgroundColor: cat.color,
                  }}
                />
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
