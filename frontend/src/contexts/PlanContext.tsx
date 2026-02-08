"use client";

import { createContext, useContext, useState, useEffect, ReactNode } from "react";
import { useQuery } from "convex/react";
import { useConvexAuth } from "convex/react";
import { api } from "../../convex/_generated/api";

type Plan = "free" | "paid";

interface PlanContextValue {
  plan: Plan;
  setPlan: (plan: Plan) => void;
  isFree: boolean;
  credits: number;
  isOverride: boolean;
}

const PlanContext = createContext<PlanContextValue>({
  plan: "free",
  setPlan: () => {},
  isFree: true,
  credits: 0,
  isOverride: false,
});

export function PlanProvider({ children }: { children: ReactNode }) {
  const [plan, setPlanState] = useState<Plan>("free");
  const { isAuthenticated } = useConvexAuth();

  const balanceResult = useQuery(
    api.credits.getBalance,
    isAuthenticated ? {} : "skip"
  );
  const credits = balanceResult?.credits ?? 0;

  useEffect(() => {
    const stored = localStorage.getItem("contractpilot_plan") as Plan | null;
    if (stored === "free" || stored === "paid") {
      setPlanState(stored);
    }
  }, []);

  const setPlan = (newPlan: Plan) => {
    setPlanState(newPlan);
    localStorage.setItem("contractpilot_plan", newPlan);
  };

  const isOverride = plan === "paid";

  return (
    <PlanContext.Provider
      value={{
        plan,
        setPlan,
        isFree: !isOverride && credits <= 0,
        credits,
        isOverride,
      }}
    >
      {children}
    </PlanContext.Provider>
  );
}

export function usePlan() {
  return useContext(PlanContext);
}
