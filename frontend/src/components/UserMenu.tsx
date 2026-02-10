"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useConvexAuth, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import Link from "next/link";

export default function UserMenu() {
  const { isAuthenticated } = useConvexAuth();
  const { signOut } = useAuthActions();
  const user = useQuery(api.users.me);

  if (!isAuthenticated) {
    return (
      <Link
        href="/login"
        className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300 font-medium"
      >
        Sign in
      </Link>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {user?.pictureUrl && (
        <img
          src={user.pictureUrl}
          alt=""
          className="w-7 h-7 rounded-full"
          referrerPolicy="no-referrer"
        />
      )}
      <span className="text-sm text-gray-600 dark:text-gray-400 hidden sm:inline">
        {user?.name || user?.email || "User"}
      </span>
      <button
        onClick={() => void signOut()}
        className="text-sm text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300"
      >
        Sign out
      </button>
    </div>
  );
}
