"use client";

import { useBilling } from "@flowglad/nextjs";
import { useRouter } from "next/navigation";

export default function BillingGate({
  children,
}: {
  children: React.ReactNode;
}) {
  const { loaded, checkUsageBalance } = useBilling();
  const router = useRouter();

  if (!loaded) return <>{children}</>;

  const balance = checkUsageBalance?.("contract_reviews");
  if (balance && balance.availableBalance <= 0) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Free review used
        </h2>
        <p className="text-gray-600 dark:text-gray-400 mb-6">
          Upgrade to continue reviewing contracts at $2.99 each.
        </p>
        <button
          onClick={() => router.push("/billing")}
          className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-colors"
        >
          View Pricing
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
