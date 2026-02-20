import { NextRequest, NextResponse } from "next/server";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../../../convex/_generated/api";

// BACKEND_URL (server-only) is for Docker where services use container names.
// Falls back to NEXT_PUBLIC_BACKEND_URL for local dev.
const BACKEND_URL =
  process.env.BACKEND_URL ??
  process.env.NEXT_PUBLIC_BACKEND_URL ??
  "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    // Get authenticated user from Convex Auth
    const token = await convexAuthNextjsToken();
    const user = await fetchQuery(api.users.me, {}, { token });
    if (!user) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    const userId = user.tokenIdentifier;

    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // Flowglad billing check — disabled for now, re-enable after demo setup
    // try {
    //   const { flowglad } = await import("@/lib/flowglad");
    //   const fg = flowglad(userId);
    //   const billing = await fg.getBilling();
    //   const balance = billing.checkUsageBalance("contract_reviews");
    //   if (balance && balance.availableBalance <= 0) {
    //     return NextResponse.json(
    //       { error: "Upgrade required", code: "BILLING_REQUIRED" },
    //       { status: 402 }
    //     );
    //   }
    // } catch {
    //   console.warn("Flowglad billing check skipped");
    // }

    // Forward to Python backend
    const useOcr = formData.get("use_ocr");

    const backendForm = new FormData();
    backendForm.append("file", file);
    backendForm.append("user_id", userId);
    if (useOcr) {
      backendForm.append("use_ocr", useOcr.toString());
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30_000);

    let res: Response;
    try {
      res = await fetch(`${BACKEND_URL}/analyze`, {
        method: "POST",
        body: backendForm,
        signal: controller.signal,
      });
    } catch (fetchError) {
      clearTimeout(timeout);
      if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
        return NextResponse.json(
          { error: "Backend did not respond within 30 seconds. Please try again." },
          { status: 504 }
        );
      }
      throw fetchError;
    } finally {
      clearTimeout(timeout);
    }

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      console.error(`Backend returned ${res.status}: ${body}`);
      return NextResponse.json(
        { error: `Backend error: ${res.status} ${body}` },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Review upload error:", error);
    return NextResponse.json(
      { error: `Upload failed: ${error instanceof Error ? error.message : String(error)}` },
      { status: 500 }
    );
  }
}
