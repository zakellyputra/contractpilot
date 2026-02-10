# ContractPilot — Codebase Analysis for Flowglad Integration

## 1. Framework & Language Detection

| Property | Value |
|---|---|
| **Framework** | Next.js 16.1.6 (App Router) |
| **Router** | App Router (`frontend/src/app/`) |
| **Language** | TypeScript 5.x |
| **Package Manager** | npm (lockfile: `frontend/package-lock.json`) |
| **Dependency File** | `frontend/package.json` |
| **Backend** | Python FastAPI (separate service at `backend/main.py`) |
| **Database** | Convex (serverless backend-as-a-service) |
| **CSS** | Tailwind CSS v4 with PostCSS |

### Key Dependencies

```json
{
  "@auth/core": "^0.37.0",
  "@convex-dev/auth": "^0.0.90",
  "@flowglad/nextjs": "^0.18.0",
  "@flowglad/server": "^0.18.0",
  "convex": "^1.31.7",
  "next": "16.1.6",
  "react": "19.2.3",
  "react-dom": "19.2.3",
  "react-dropzone": "^14.4.0",
  "react-pdf": "^10.3.0"
}
```

---

## 2. File Structure & Paths

```
devfest-2026/
├── backend/                          # Python FastAPI backend
│   ├── main.py                       # FastAPI entry point
│   ├── agent.py                      # Dedalus agent orchestration
│   ├── chat.py                       # Chat functionality
│   ├── models.py                     # Data models
│   ├── ocr.py                        # OCR processing
│   ├── prompts.py                    # LLM prompts
│   └── ...
├── frontend/                         # Next.js App Router frontend
│   ├── convex/                       # Convex backend functions
│   │   ├── _generated/               # Auto-generated Convex types
│   │   ├── auth.config.ts            # OAuth provider config
│   │   ├── auth.ts                   # Convex Auth setup (Google OAuth)
│   │   ├── clauses.ts               # Clause queries/mutations
│   │   ├── credits.ts               # Credit balance management
│   │   ├── http.ts                   # Auth HTTP routes
│   │   ├── reviews.ts               # Review queries/mutations
│   │   ├── schema.ts                # Database schema
│   │   └── users.ts                 # User identity query
│   ├── src/
│   │   ├── app/
│   │   │   ├── api/
│   │   │   │   ├── flowglad/[...path]/route.ts   # Flowglad catch-all handler
│   │   │   │   └── review/route.ts                # Contract review upload
│   │   │   ├── billing/page.tsx                   # Billing/pricing page
│   │   │   ├── dashboard/page.tsx                 # User dashboard
│   │   │   ├── login/page.tsx                     # Login page
│   │   │   ├── review/[id]/page.tsx               # Individual review page
│   │   │   ├── layout.tsx                         # Root layout (providers)
│   │   │   ├── page.tsx                           # Home/landing page
│   │   │   └── globals.css                        # Global styles
│   │   ├── components/
│   │   │   ├── BillingGate.tsx        # Flowglad usage balance gate
│   │   │   ├── ConvexClientProvider.tsx # Client-side Convex + PlanProvider
│   │   │   ├── DeepReviewView.tsx     # Full PDF + clause analysis view
│   │   │   ├── ErrorBoundary.tsx      # React error boundary
│   │   │   ├── PaywallBlur.tsx        # Paywall blur overlay component
│   │   │   ├── PDFViewer.tsx          # PDF viewer with clause highlights
│   │   │   ├── PricingCards.tsx       # Pricing cards with Flowglad checkout
│   │   │   ├── QuickSummaryView.tsx   # Risk summary + top findings
│   │   │   ├── UploadDropzone.tsx     # File upload dropzone
│   │   │   ├── UserMenu.tsx           # User avatar + sign out
│   │   │   └── ...                    # Other UI components
│   │   ├── contexts/
│   │   │   └── PlanContext.tsx         # Plan/credit state management
│   │   ├── lib/
│   │   │   ├── api.ts                 # Python backend HTTP client
│   │   │   └── flowglad.ts            # Flowglad server-side setup
│   │   └── middleware.ts              # Auth route protection
│   ├── .env.local                     # Environment variables
│   ├── next.config.ts                 # Next.js config
│   └── package.json
└── docker-compose.yml
```

### Key Paths

| Purpose | Path |
|---|---|
| API routes | `frontend/src/app/api/` |
| Utility functions | `frontend/src/lib/` |
| UI components | `frontend/src/components/` |
| State contexts | `frontend/src/contexts/` |
| Convex backend functions | `frontend/convex/` |
| Root layout | `frontend/src/app/layout.tsx` |
| Middleware | `frontend/src/middleware.ts` |

---

## 3. Authentication System

**Library**: Convex Auth (`@convex-dev/auth`) with Google OAuth via `@auth/core`

### Server-Side Auth Configuration

**File: `frontend/convex/auth.ts`**
```typescript
import Google from "@auth/core/providers/google";
import { convexAuth } from "@convex-dev/auth/server";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [Google],
});
```

**File: `frontend/convex/auth.config.ts`**
```typescript
export default {
  providers: [
    {
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
```

**File: `frontend/convex/http.ts`**
```typescript
import { httpRouter } from "convex/server";
import { auth } from "./auth";

const http = httpRouter();
auth.addHttpRoutes(http);
export default http;
```

### Session Extraction — Server Side (Convex Functions)

**File: `frontend/convex/users.ts`**
```typescript
import { query } from "./_generated/server";

export const me = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return null;

    return {
      tokenIdentifier: identity.tokenIdentifier,
      name: identity.name,
      email: identity.email,
      pictureUrl: identity.pictureUrl,
    };
  },
});
```

### Session Extraction — Server Side (Next.js API Routes)

**Pattern used in `frontend/src/app/api/review/route.ts`:**
```typescript
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../../../convex/_generated/api";

export async function POST(request: NextRequest) {
  const token = await convexAuthNextjsToken();
  const user = await fetchQuery(api.users.me, {}, { token });
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }
  const userId = user.tokenIdentifier;
  // ...
}
```

### Session Extraction — Client Side

**Hooks used throughout React components:**
```typescript
import { useConvexAuth } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";

// Check auth state
const { isAuthenticated, isLoading } = useConvexAuth();

// Sign in/out actions
const { signIn, signOut } = useAuthActions();

// Get user details
const user = useQuery(api.users.me);
// user = { tokenIdentifier, name, email, pictureUrl } | null
```

### User Object Structure

| Field | Type | Description |
|---|---|---|
| `tokenIdentifier` | `string` | Unique user ID (format: `https://domain.convex.cloud\|key1\|key2`) |
| `name` | `string \| undefined` | Display name from Google |
| `email` | `string \| undefined` | Email from Google |
| `pictureUrl` | `string \| undefined` | Google profile picture URL |

### Route Protection Middleware

**File: `frontend/src/middleware.ts`**
```typescript
import {
  convexAuthNextjsMiddleware,
  createRouteMatcher,
  isAuthenticatedNextjs,
  nextjsMiddlewareRedirect,
} from "@convex-dev/auth/nextjs/server";

const isPublicRoute = createRouteMatcher(["/", "/login", "/billing"]);

export default convexAuthNextjsMiddleware(async (req) => {
  if (!isPublicRoute(req) && !(await isAuthenticatedNextjs())) {
    return nextjsMiddlewareRedirect(req, "/login");
  }
}, { verbose: true });

export const config = {
  matcher: ["/((?!.*\\..*|_next).*)", "/", "/(api|trpc)(.*)"],
};
```

**Public routes:** `/`, `/login`, `/billing`
**Protected routes:** All others (redirect to `/login` if unauthenticated)

---

## 4. Customer Model (B2C vs B2B)

**Model: B2C** — Individual users

**Customer ID Source:** `user.tokenIdentifier` (from `ctx.auth.getUserIdentity()` in Convex, or via `fetchQuery(api.users.me)` in API routes)

**Note:** The `tokenIdentifier` contains special characters (`https://`, `|`) that break Flowglad URL paths. The codebase hashes it to a safe 24-char hex string using SHA-256:

**File: `frontend/src/lib/flowglad.ts`**
```typescript
import { createHash } from "crypto";

function toFlowgladId(tokenIdentifier: string): string {
  return createHash("sha256").update(tokenIdentifier).digest("hex").slice(0, 24);
}
```

---

## 5. Frontend Framework

| Property | Value |
|---|---|
| **Framework** | React 19.2.3 |
| **Rendering** | Client components (`"use client"` directive) with server-side layout |
| **State Management** | React Context (`PlanContext`) + Convex `useQuery`/`useMutation` hooks |
| **Styling** | Tailwind CSS v4 |

### Provider Pattern

Providers are mounted in the root layout and composed via nesting.

**File: `frontend/src/app/layout.tsx`**
```typescript
import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ConvexAuthNextjsServerProvider } from "@convex-dev/auth/nextjs/server";
import ConvexClientProvider from "@/components/ConvexClientProvider";
import { FlowgladProvider } from "@flowglad/nextjs";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "ContractPilot — AI Contract Reviewer",
  description:
    "Upload any contract and get instant AI risk analysis with plain-English summaries.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ConvexAuthNextjsServerProvider>
          <FlowgladProvider>
            <ConvexClientProvider>{children}</ConvexClientProvider>
          </FlowgladProvider>
        </ConvexAuthNextjsServerProvider>
      </body>
    </html>
  );
}
```

**Provider hierarchy (outermost to innermost):**
1. `ConvexAuthNextjsServerProvider` — Server-side auth (RSC-compatible)
2. `FlowgladProvider` — Flowglad billing client
3. `ConvexClientProvider` — Client-side Convex + PlanProvider

**File: `frontend/src/components/ConvexClientProvider.tsx`**
```typescript
"use client";

import { ConvexAuthNextjsProvider } from "@convex-dev/auth/nextjs";
import { ConvexReactClient } from "convex/react";
import { ReactNode } from "react";
import { PlanProvider } from "@/contexts/PlanContext";

const convex = new ConvexReactClient(process.env.NEXT_PUBLIC_CONVEX_URL!);

export default function ConvexClientProvider({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ConvexAuthNextjsProvider client={convex}>
      <PlanProvider>{children}</PlanProvider>
    </ConvexAuthNextjsProvider>
  );
}
```

### Client-Side Auth Hooks

```typescript
// Auth state
const { isAuthenticated, isLoading } = useConvexAuth();

// Auth actions (sign in/out)
const { signIn, signOut } = useAuthActions();

// User data via Convex query
const user = useQuery(api.users.me);

// Plan/credits state
const { plan, credits, isFree, isOverride, setPlan } = usePlan();
```

---

## 6. Route Handler Pattern

API routes use the Next.js App Router pattern with named exports (`GET`, `POST`).

### Complete Example: Review Upload API Route

**File: `frontend/src/app/api/review/route.ts`**
```typescript
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

    // Forward to Python backend
    const useOcr = formData.get("use_ocr");

    const backendForm = new FormData();
    backendForm.append("file", file);
    backendForm.append("user_id", userId);
    if (useOcr) {
      backendForm.append("use_ocr", useOcr.toString());
    }

    const res = await fetch(`${BACKEND_URL}/analyze`, {
      method: "POST",
      body: backendForm,
    });

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
```

### Flowglad Catch-All Route

**File: `frontend/src/app/api/flowglad/[...path]/route.ts`**
```typescript
import { nextRouteHandler } from "@flowglad/nextjs/server";
import { flowglad } from "@/lib/flowglad";
import { NextRequest } from "next/server";
import { convexAuthNextjsToken } from "@convex-dev/auth/nextjs/server";
import { fetchQuery } from "convex/nextjs";
import { api } from "../../../../../convex/_generated/api";

export const { GET, POST } = nextRouteHandler({
  getCustomerExternalId: async (req: NextRequest) => {
    try {
      const token = await convexAuthNextjsToken();
      const user = await fetchQuery(api.users.me, {}, { token });
      console.log("[flowglad] customer:", user?.tokenIdentifier ?? "no user");
      if (user?.tokenIdentifier) return user.tokenIdentifier;
    } catch (err) {
      console.error("[flowglad] auth error:", err);
    }
    return "anonymous";
  },
  flowglad,
  onError: (error) => {
    console.error("[flowglad] handler error:", error);
  },
});
```

---

## 7. Validation & Error Handling Patterns

### Validation Library

**None.** The codebase uses manual validation with runtime checks. No zod, yup, joi, or other validation libraries are present.

### Validation Pattern

```typescript
// Manual file blob validation
const file = formData.get("file");
if (!file || !(file instanceof Blob)) {
  return NextResponse.json({ error: "No file provided" }, { status: 400 });
}

// Auth validation via Convex
const token = await convexAuthNextjsToken();
const user = await fetchQuery(api.users.me, {}, { token });
if (!user) {
  return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
}

// Convex function argument validation (using convex/values)
import { v } from "convex/values";
export const addCredits = mutation({
  args: { amount: v.number() },
  handler: async (ctx, args) => {
    // args.amount is validated by Convex runtime
  },
});
```

### Error Handling Pattern

```typescript
// API routes: try/catch with categorized HTTP status codes
try {
  // ... business logic
} catch (error) {
  console.error("Review upload error:", error);
  return NextResponse.json(
    { error: `Upload failed: ${error instanceof Error ? error.message : String(error)}` },
    { status: 500 }
  );
}

// Status codes used:
// 400 — Bad request (missing/invalid input)
// 401 — Not authenticated
// 402 — Billing required (upgrade needed)
// 500 — Internal server error
// 502 — Backend proxy error

// Convex mutations: throw Error
const identity = await ctx.auth.getUserIdentity();
if (!identity) throw new Error("Not authenticated");
```

### Error Boundary (Client-Side)

**File: `frontend/src/components/ErrorBoundary.tsx`**
```typescript
"use client";

import React, { Component, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback ?? null;
    }
    return this.props.children;
  }
}
```

---

## 8. Type System

**TypeScript** with interfaces and type aliases. Strict mode enabled (`"strict": true` in `tsconfig.json`).

Key type patterns:
- Component props defined as `interface` (e.g., `PaywallBlurProps`, `DeepReviewViewProps`)
- Convex schema uses `v` validators from `convex/values`
- No JSDoc comments; types are inline
- Path aliases: `@/*` maps to `frontend/src/*`

---

## 9. Helper Function Patterns

### Utility File Locations

| File | Purpose |
|---|---|
| `frontend/src/lib/api.ts` | Python backend HTTP client |
| `frontend/src/lib/flowglad.ts` | Flowglad server-side setup |

### Complete Example: Backend API Client

**File: `frontend/src/lib/api.ts`**
```typescript
/**
 * Python backend HTTP client.
 */

const BACKEND_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8000";

export async function analyzeContract(file: File, userId: string) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("user_id", userId);

  const res = await fetch(`${BACKEND_URL}/analyze`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    throw new Error(`Analysis failed: ${res.statusText}`);
  }

  return res.json();
}

export function getReportUrl(reviewId: string) {
  return `${BACKEND_URL}/report/${reviewId}`;
}

export function getPdfUrl(reviewId: string) {
  return `${BACKEND_URL}/pdf/${reviewId}`;
}

export async function chatAboutClause(
  question: string,
  clauseText: string,
  clauseType: string,
  contractType: string,
  chatHistory: { role: string; content: string }[],
): Promise<{ answer: string; sources: string[] }> {
  const res = await fetch(`${BACKEND_URL}/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      question,
      clause_text: clauseText,
      clause_type: clauseType,
      contract_type: contractType,
      chat_history: chatHistory,
    }),
  });
  if (!res.ok) throw new Error(`Chat failed: ${res.statusText}`);
  return res.json();
}
```

### Complete Example: Flowglad Server Setup

**File: `frontend/src/lib/flowglad.ts`**
```typescript
import { FlowgladServer } from "@flowglad/server";
import { createHash } from "crypto";

// Create a short, URL-safe customer ID from the Convex tokenIdentifier
// tokenIdentifier looks like "https://domain.convex.cloud|key1|key2"
// which contains characters that break Flowglad's API URL paths
function toFlowgladId(tokenIdentifier: string): string {
  return createHash("sha256").update(tokenIdentifier).digest("hex").slice(0, 24);
}

export const flowglad = async (customerExternalId: string) => {
  const safeId = toFlowgladId(customerExternalId);
  console.log("[flowglad] safe ID:", safeId);

  const server = new FlowgladServer({
    apiKey: process.env.FLOWGLAD_SECRET_KEY!,
    customerExternalId: safeId,
    getCustomerDetails: async () => {
      console.log("[flowglad] getCustomerDetails called — creating customer");
      return {
        email: `${safeId}@contractpilot.app`,
        name: safeId,
      };
    },
  });

  try {
    const customer = await server.findOrCreateCustomer();
    console.log("[flowglad] customer ready:", customer?.id ?? "ok");
  } catch (err) {
    console.error("[flowglad] findOrCreateCustomer failed:", err);
  }

  return server;
};
```

### Code Organization Style

- Helpers organized in **separate files by domain** (`api.ts` for backend, `flowglad.ts` for billing)
- Named exports for functions
- `async/await` with `throw new Error()` on failures
- Environment variable fallbacks with `??` operator
- No JSDoc beyond single-line comments

---

## 10. Provider Composition Pattern

### Provider Hierarchy (Complete)

```
<html>
  <body>
    <ConvexAuthNextjsServerProvider>        {/* Server-side auth (RSC) */}
      <FlowgladProvider>                     {/* Flowglad billing client */}
        <ConvexAuthNextjsProvider client={convex}>  {/* Client-side Convex auth */}
          <PlanProvider>                     {/* Credit/plan state */}
            {children}                       {/* Application pages */}
          </PlanProvider>
        </ConvexAuthNextjsProvider>
      </FlowgladProvider>
    </ConvexAuthNextjsServerProvider>
  </body>
</html>
```

### Plan Context Provider (Complete)

**File: `frontend/src/contexts/PlanContext.tsx`**
```typescript
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
```

---

## 11. Environment Variables

**File:** `frontend/.env.local`

| Variable | Access Pattern | Description |
|---|---|---|
| `NEXT_PUBLIC_CONVEX_URL` | `process.env.NEXT_PUBLIC_CONVEX_URL` | Convex deployment URL (client+server) |
| `CONVEX_DEPLOYMENT` | Build-time only | Convex dev deployment identifier |
| `NEXT_PUBLIC_CONVEX_SITE_URL` | `process.env.NEXT_PUBLIC_CONVEX_SITE_URL` | Convex site URL |
| `FLOWGLAD_SECRET_KEY` | `process.env.FLOWGLAD_SECRET_KEY` | Flowglad API secret key (server-only) |
| `NEXT_PUBLIC_BACKEND_URL` | `process.env.NEXT_PUBLIC_BACKEND_URL` | Python backend URL |
| `BACKEND_URL` | `process.env.BACKEND_URL` | Docker-internal backend URL (server-only) |

Environment variables are accessed via `process.env.VARIABLE_NAME` (standard Next.js pattern). `NEXT_PUBLIC_` prefix exposes variables to the client bundle.

---

## 12. Existing Billing Code

### Flowglad Integration — Already Present

**Server-side setup:** `frontend/src/lib/flowglad.ts`
- Creates `FlowgladServer` instance with hashed customer ID
- Auto-creates customers via `findOrCreateCustomer()`

**Catch-all route handler:** `frontend/src/app/api/flowglad/[...path]/route.ts`
- Uses `nextRouteHandler` from `@flowglad/nextjs/server`
- Extracts customer ID from Convex Auth session

**Client-side hooks used:**
```typescript
// In PricingCards.tsx
import { useBilling, usePricing } from "@flowglad/nextjs";
const { loaded, createCheckoutSession } = useBilling();
const pricingModel = usePricing();

// In BillingGate.tsx
import { useBilling } from "@flowglad/nextjs";
const { loaded, checkUsageBalance } = useBilling();
```

### Usage Meter References

| Slug | Location | Usage |
|---|---|---|
| `"contract_reviews"` | `frontend/src/components/BillingGate.tsx` | `checkUsageBalance?.("contract_reviews")` |
| `"contract_reviews"` | `frontend/src/app/api/review/route.ts` | Commented out: `fg.getBilling()` → `checkUsageBalance("contract_reviews")` |

### Feature Toggle References

No feature toggle slugs found in the codebase.

### Product/Price References

| Reference | Location | Usage |
|---|---|---|
| `pricingModel?.products?.[0]?.defaultPrice` | `frontend/src/components/PricingCards.tsx` | Gets the first product's default price for checkout |
| `defaultPrice.id` | `frontend/src/components/PricingCards.tsx` | Passed to `createCheckoutSession({ priceId })` |

**Note:** No hardcoded price slugs. The pricing model is fetched dynamically via `usePricing()`.

### Credit System (Custom, Convex-Based)

**File: `frontend/convex/credits.ts`**
```typescript
import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getBalance = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { credits: 0 };

    const userId = identity.tokenIdentifier;
    const record = await ctx.db
      .query("userCredits")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    return { credits: record?.credits ?? 0 };
  },
});

export const addCredits = mutation({
  args: { amount: v.number() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const userId = identity.tokenIdentifier;
    const existing = await ctx.db
      .query("userCredits")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        credits: existing.credits + args.amount,
      });
    } else {
      await ctx.db.insert("userCredits", {
        userId,
        credits: args.amount,
      });
    }
  },
});

export const unlockReview = mutation({
  args: { reviewId: v.id("reviews") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const userId = identity.tokenIdentifier;

    const review = await ctx.db.get(args.reviewId);
    if (!review || review.userId !== userId) {
      throw new Error("Review not found");
    }

    if (review.unlocked) {
      return { success: true, alreadyUnlocked: true };
    }

    const creditRecord = await ctx.db
      .query("userCredits")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const currentCredits = creditRecord?.credits ?? 0;
    if (currentCredits <= 0) {
      throw new Error("No credits remaining");
    }

    await ctx.db.patch(creditRecord!._id, {
      credits: currentCredits - 1,
    });

    await ctx.db.patch(args.reviewId, { unlocked: true });

    return { success: true, alreadyUnlocked: false };
  },
});
```

### BillingGate Component

**File: `frontend/src/components/BillingGate.tsx`**
```typescript
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
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Free review used
        </h2>
        <p className="text-gray-600 mb-6">
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
```

### Checkout Flow

**In `PricingCards.tsx`:**
```typescript
async function handleCheckout() {
  if (!defaultPrice) return;
  setLoading(true);
  try {
    await createCheckoutSession?.({
      priceId: defaultPrice.id,
      quantity: 1,
      successUrl: `${window.location.origin}/?upgraded=true`,
      cancelUrl: `${window.location.origin}/billing`,
      autoRedirect: true,
    });
  } catch (err) {
    console.error("Checkout error:", err);
  } finally {
    setLoading(false);
  }
}
```

**Post-checkout credit grant (in `page.tsx`):**
```typescript
useEffect(() => {
  if (searchParams.get("upgraded") === "true" && isAuthenticated && !creditAdded) {
    setCreditAdded(true);
    addCredits({ amount: 5 })
      .then(() => {
        window.history.replaceState({}, "", "/");
      })
      .catch((err) => {
        console.error("Failed to add credits:", err);
      });
  }
}, [searchParams, isAuthenticated, creditAdded, addCredits]);
```

---

## 13. Component Locations

| Component | Path | Purpose |
|---|---|---|
| Pricing page | `frontend/src/app/billing/page.tsx` | Billing/pricing page with demo toggle |
| Pricing cards | `frontend/src/components/PricingCards.tsx` | Flowglad checkout cards |
| Navbar/user menu | `frontend/src/components/UserMenu.tsx` | User avatar, name, sign out |
| Home page | `frontend/src/app/page.tsx` | Landing page + upload |
| Dashboard | `frontend/src/app/dashboard/page.tsx` | User's review list |
| Review page | `frontend/src/app/review/[id]/page.tsx` | Individual review (Quick Summary + Deep Review) |
| Paywall blur | `frontend/src/components/PaywallBlur.tsx` | Blur overlay for gated content |
| Billing gate | `frontend/src/components/BillingGate.tsx` | Usage balance check wrapper |
| PDF viewer | `frontend/src/components/PDFViewer.tsx` | PDF rendering with clause highlights |
| Deep review | `frontend/src/components/DeepReviewView.tsx` | Full PDF + clause analysis + chat |
| Quick summary | `frontend/src/components/QuickSummaryView.tsx` | Risk overview + top findings |
| Error boundary | `frontend/src/components/ErrorBoundary.tsx` | React error boundary |
| Convex provider | `frontend/src/components/ConvexClientProvider.tsx` | Client-side Convex + PlanProvider |

---

## Database Schema

**File: `frontend/convex/schema.ts`**
```typescript
import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,
  reviews: defineTable({
    userId: v.string(),
    filename: v.string(),
    contractType: v.optional(v.string()),
    status: v.string(), // "pending" | "processing" | "completed" | "failed"
    rawText: v.optional(v.string()),
    summary: v.optional(v.string()),
    riskScore: v.optional(v.number()), // Overall 0-100
    financialRisk: v.optional(v.number()),
    complianceRisk: v.optional(v.number()),
    operationalRisk: v.optional(v.number()),
    reputationalRisk: v.optional(v.number()),
    actionItems: v.optional(v.array(v.string())),
    keyDates: v.optional(
      v.array(
        v.object({
          date: v.string(),
          label: v.string(),
          type: v.string(),
        })
      )
    ),
    reportUrl: v.optional(v.string()),
    pdfUrl: v.optional(v.string()),
    ocrUsed: v.optional(v.boolean()),
    totalClauses: v.optional(v.number()),
    completedClauses: v.optional(v.number()),
    unlocked: v.optional(v.boolean()),
  }).index("by_user", ["userId"]),

  userCredits: defineTable({
    userId: v.string(),
    credits: v.number(),
  }).index("by_user", ["userId"]),

  clauses: defineTable({
    reviewId: v.id("reviews"),
    clauseText: v.string(),
    clauseType: v.optional(v.string()),
    riskLevel: v.string(),
    riskCategory: v.string(),
    explanation: v.string(),
    concern: v.optional(v.string()),
    suggestion: v.optional(v.string()),
    k2Reasoning: v.optional(v.string()),
    pageNumber: v.optional(v.number()),
    rects: v.optional(v.string()),
    pageWidth: v.optional(v.number()),
    pageHeight: v.optional(v.number()),
  }).index("by_review", ["reviewId"]),
});
```

---

## Billing Architecture Summary

### Current State

The app has a **hybrid billing system**:

1. **Flowglad** handles payment processing (checkout sessions, customer management, pricing)
2. **Convex `userCredits` table** tracks credit balances per user
3. **`PaywallBlur` component** gates premium content on the client
4. **`BillingGate` component** checks Flowglad usage balance (currently unused in routing)
5. **`reviews.unlocked` field** persists per-review unlock state

### Payment Flow

```
User clicks "Get Started" on PricingCards
  → createCheckoutSession({ priceId, successUrl: "/?upgraded=true" })
  → Flowglad hosted checkout
  → Redirect to /?upgraded=true
  → Home page detects ?upgraded=true
  → Calls addCredits({ amount: 5 }) mutation
  → User now has 5 credits in Convex
  → User uploads contract → views review
  → PaywallBlur shows "Unlock" button
  → User clicks "Unlock" → unlockReview mutation
  → Deducts 1 credit, sets review.unlocked = true
  → Content visible
```

### Commented-Out Billing Check

In `frontend/src/app/api/review/route.ts`, there is a **commented-out** server-side billing check:

```typescript
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
```

This suggests the intended future state is to enforce billing server-side via Flowglad usage meters.
