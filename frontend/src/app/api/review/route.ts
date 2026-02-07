import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData();
    const file = formData.get("file");

    if (!file || !(file instanceof Blob)) {
      return NextResponse.json({ error: "No file provided" }, { status: 400 });
    }

    // TODO: Phase 4 — check Flowglad billing before forwarding

    // For now, use a dev user ID. In production, DAuth provides this.
    const userId = "dev-user";

    // Forward to Python backend
    const backendForm = new FormData();
    backendForm.append("file", file);
    backendForm.append("user_id", userId);

    const res = await fetch(`${BACKEND_URL}/analyze`, {
      method: "POST",
      body: backendForm,
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "Analysis service unavailable" },
        { status: 502 }
      );
    }

    const data = await res.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Review upload error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
