import { FlowgladServer } from "@flowglad/nextjs/server";
import { createHash } from "crypto";

// Create a short, URL-safe customer ID from the Convex tokenIdentifier
// tokenIdentifier looks like "https://domain.convex.cloud|key1|key2"
// which contains characters that break Flowglad's API URL paths
function toFlowgladId(tokenIdentifier: string): string {
  return createHash("sha256").update(tokenIdentifier).digest("hex").slice(0, 24);
}

export const flowglad = async (customerExternalId: string) => {
  const safeId = toFlowgladId(customerExternalId);

  const server = new FlowgladServer({
    apiKey: process.env.FLOWGLAD_SECRET_KEY!,
    customerExternalId: safeId,
    getCustomerDetails: async () => {
      return {
        email: `${safeId}@contractpilot.app`,
        name: safeId,
      };
    },
  });

  // Pre-create customer — the SDK's findOrCreateCustomer() doesn't handle
  // Flowglad's 403 FORBIDDEN response for non-existent customers
  try {
    await server.createCustomer({
      customer: {
        email: `${safeId}@contractpilot.app`,
        name: safeId,
        externalId: safeId,
      },
    });
  } catch {
    // Customer already exists, that's fine
  }

  return server;
};
