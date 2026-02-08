import { nextRouteHandler } from "@flowglad/nextjs/server";
import { flowglad } from "@/lib/flowglad";
import { NextRequest } from "next/server";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../../../../convex/_generated/api";

export const { GET, POST } = nextRouteHandler({
  getCustomerExternalId: async (req: NextRequest) => {
    const token = await convexAuthNextjsToken();
    const user = await fetchQuery(api.users.me, {}, { token });
    if (!user?.tokenIdentifier) {
      throw new Error("Not authenticated");
    }
    return user.tokenIdentifier;
  },
  flowglad,
  onError: (error) => {
    console.error("[flowglad] handler error:", error);
  },
});
