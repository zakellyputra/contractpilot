"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import UploadDropzone from "@/components/UploadDropzone";

export default function Home() {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleUpload(file: File) {
    setIsUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await fetch("/api/review", {
        method: "POST",
        body: formData,
      });

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
    <main className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      <div className="max-w-3xl mx-auto px-4 pt-20 pb-16">
        {/* Hero */}
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold text-gray-900 mb-4">
            Contract<span className="text-blue-600">Pilot</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-lg mx-auto">
            Upload any contract and get instant AI risk analysis with
            plain-English summaries you can actually understand.
          </p>
          <p className="text-sm text-gray-400 mt-3">
            First review free, then $2.99/contract
          </p>
        </div>

        {/* Upload */}
        <UploadDropzone onUpload={handleUpload} isUploading={isUploading} />

        {error && (
          <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-center">
            {error}
          </div>
        )}

        {/* Features */}
        <div className="grid md:grid-cols-3 gap-6 mt-16">
          <div className="text-center p-6">
            <div className="text-3xl mb-3">
              <svg className="w-8 h-8 mx-auto text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Plain English</h3>
            <p className="text-gray-500 text-sm">
              No legal jargon. Every clause explained like a friend would.
            </p>
          </div>
          <div className="text-center p-6">
            <div className="text-3xl mb-3">
              <svg className="w-8 h-8 mx-auto text-amber-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Risk Scoring</h3>
            <p className="text-gray-500 text-sm">
              Visual risk dashboard across financial, compliance, operational,
              and reputational categories.
            </p>
          </div>
          <div className="text-center p-6">
            <div className="text-3xl mb-3">
              <svg className="w-8 h-8 mx-auto text-green-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">PDF Report</h3>
            <p className="text-gray-500 text-sm">
              Download a professional risk analysis report to share with your
              team or lawyer.
            </p>
          </div>
        </div>
      </div>
    </main>
  );
}
