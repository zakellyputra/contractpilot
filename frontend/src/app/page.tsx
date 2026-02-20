"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useConvexAuth, useMutation } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "../../convex/_generated/api";
import Link from "next/link";
import { motion } from "motion/react";
import UploadDropzone from "@/components/UploadDropzone";
import UserMenu from "@/components/UserMenu";
import ThemeToggle from "@/components/ThemeToggle";
import { fadeUp, staggerContainer } from "@/lib/motion";

export default function Home() {
  const { isAuthenticated } = useConvexAuth();
  const { signIn } = useAuthActions();
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocrEnabled, setOcrEnabled] = useState(false);
  const [fileType, setFileType] = useState<string | null>(null);
  const [creditAdded, setCreditAdded] = useState(false);
  const [creditError, setCreditError] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();
  const addCredits = useMutation(api.credits.addCredits);

  useEffect(() => {
    if (
      searchParams.get("upgraded") === "true" &&
      isAuthenticated &&
      !creditAdded &&
      !sessionStorage.getItem("credits_granted") &&
      !sessionStorage.getItem("credits_pending")
    ) {
      sessionStorage.setItem("credits_pending", "true");
      setCreditError(null);
      addCredits({ amount: 5 })
        .then(() => {
          setCreditAdded(true);
          sessionStorage.setItem("credits_granted", "true");
          sessionStorage.removeItem("credits_pending");
          window.history.replaceState({}, "", "/");
        })
        .catch((err) => {
          console.error("Failed to add credits:", err);
          sessionStorage.removeItem("credits_pending");
          setCreditError("Failed to add credits. Please try again.");
        });
    }
  }, [searchParams, isAuthenticated, creditAdded, addCredits]);

  async function handleUpload(file: File) {
    setIsUploading(true);
    setError(null);

    const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
    const detectedType = ext === "docx" ? "docx" : "pdf";
    setFileType(detectedType);

    // OCR only applies to PDFs
    const effectiveOcr = detectedType === "docx" ? false : ocrEnabled;

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("use_ocr", effectiveOcr ? "true" : "false");

      const res = await fetch("/api/review", {
        method: "POST",
        body: formData,
      });

      if (res.status === 402) {
        router.push("/billing");
        return;
      }

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Upload failed");
      }

      const { review_id } = await res.json();
      router.push(`/review/${review_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setIsUploading(false);
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white dark:from-gray-950 dark:to-gray-900">
      <nav className="max-w-3xl mx-auto px-4 pt-6 flex justify-end items-center gap-4">
        {isAuthenticated && (
          <Link href="/dashboard" className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
            Dashboard
          </Link>
        )}
        <Link href="/billing" className="text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200">
          Pricing
        </Link>
        <ThemeToggle />
        <UserMenu />
      </nav>
      <motion.div className="max-w-3xl mx-auto px-4 pt-12 pb-16" variants={staggerContainer} initial="hidden" animate="visible">
        {/* Hero */}
        <motion.div variants={fadeUp} className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            Contract<span className="text-blue-600">Pilot</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-400 max-w-lg mx-auto">
            Upload any contract and get instant AI risk analysis with
            plain-English summaries you can actually understand.
          </p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-3">
            5 reviews for $2.99
          </p>
        </motion.div>

        {creditAdded && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-xl text-green-700 text-center text-sm font-medium">
            5 review credits added to your account!
          </div>
        )}

        {creditError && (
          <div className="mb-6 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-center text-sm font-medium">
            {creditError}
            <button
              onClick={() => {
                setCreditError(null);
                sessionStorage.removeItem("credits_granted");
                sessionStorage.removeItem("credits_pending");
                setCreditAdded(false);
              }}
              className="ml-3 px-3 py-1 bg-red-100 dark:bg-red-900 text-red-700 dark:text-red-300 rounded-lg text-xs font-medium hover:bg-red-200 dark:hover:bg-red-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-400 active:scale-95"
              style={{ transition: "transform 0.1s, background-color 0.2s" }}
            >
              Retry
            </button>
          </div>
        )}

        {/* Upload */}
        <motion.div variants={fadeUp} className="relative">
          <div className={!isAuthenticated ? "opacity-50 pointer-events-none select-none" : ""}>
            <UploadDropzone
              onUpload={handleUpload}
              isUploading={isUploading}
              ocrEnabled={ocrEnabled}
              onOcrToggle={setOcrEnabled}
              fileType={fileType}
            />
          </div>
          {!isAuthenticated && (
            <div className="absolute inset-0 flex items-center justify-center">
              <button
                onClick={() => void signIn("google")}
                className="flex items-center gap-3 px-6 py-3 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-xl shadow-lg hover:shadow-xl hover:bg-gray-50 dark:hover:bg-gray-700 transition-all text-sm font-medium text-gray-700 dark:text-gray-200"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A10.96 10.96 0 001 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                </svg>
                Sign in with Google
              </button>
            </div>
          )}
        </motion.div>

        {error && (
          <div className="mt-4 p-4 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-xl text-red-700 dark:text-red-400 text-center">
            {error}
          </div>
        )}

        {/* Features */}
        <motion.div variants={fadeUp} className="grid md:grid-cols-3 gap-6 mt-16">
          <motion.div whileHover={{ y: -2 }} className="text-center p-6">
            <div className="text-3xl mb-3">
              <svg className="w-8 h-8 mx-auto text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Plain English</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              No legal jargon. Every clause explained like a friend would.
            </p>
          </motion.div>
          <motion.div whileHover={{ y: -2 }} className="text-center p-6">
            <div className="text-3xl mb-3">
              <svg className="w-8 h-8 mx-auto text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">Risk Scoring</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Visual risk dashboard across financial, compliance, operational,
              and reputational categories.
            </p>
          </motion.div>
          <motion.div whileHover={{ y: -2 }} className="text-center p-6">
            <div className="text-3xl mb-3">
              <svg className="w-8 h-8 mx-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">PDF Report</h3>
            <p className="text-gray-500 dark:text-gray-400 text-sm">
              Download a professional risk analysis report to share with your
              team or lawyer.
            </p>
          </motion.div>
        </motion.div>
      </motion.div>
    </main>
  );
}
