"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";
import { motion } from "motion/react";

const ACCEPTED_TYPES: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [
    ".docx",
  ],
};

const ALLOWED_EXTENSIONS = ["pdf", "docx"];

interface UploadDropzoneProps {
  onUpload: (file: File) => void;
  isUploading: boolean;
  ocrEnabled: boolean;
  onOcrToggle: (v: boolean) => void;
  fileType: string | null;
}

export default function UploadDropzone({
  onUpload,
  isUploading,
  ocrEnabled,
  onOcrToggle,
  fileType,
}: UploadDropzoneProps) {
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setError(null);
      const file = acceptedFiles[0];
      if (!file) return;

      // Validate by MIME type first, then fallback to extension
      const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
      const validMime =
        file.type === "application/pdf" ||
        file.type ===
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

      if (!validMime && !ALLOWED_EXTENSIONS.includes(ext)) {
        setError("Please upload a PDF or Word (.docx) file.");
        return;
      }

      if (file.size > 20 * 1024 * 1024) {
        setError("File too large. Maximum size is 20MB.");
        return;
      }

      onUpload(file);
    },
    [onUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxFiles: 1,
    disabled: isUploading,
  });

  const ocrDisabled = isUploading || fileType === "docx";

  return (
    <div className="space-y-4">
      <motion.div
        animate={{ scale: isDragActive ? 1.02 : 1 }}
        transition={{ duration: 0.2, ease: "easeOut" as const }}
      >
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
          isDragActive
            ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
            : isUploading
              ? "border-gray-300 dark:border-gray-600 bg-gray-50 dark:bg-gray-800 cursor-not-allowed"
              : "border-gray-300 dark:border-gray-600 hover:border-blue-400 hover:bg-blue-50/50 dark:hover:bg-blue-950/50"
        }`}
      >
        <input {...getInputProps()} />
        <div className="flex flex-col items-center gap-3">
          <div className="text-4xl">
            {isUploading ? (
              <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full" />
            ) : (
              <motion.svg
                animate={{ y: isDragActive ? -4 : 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
                className="w-12 h-12 text-gray-400 dark:text-gray-500"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                />
              </motion.svg>
            )}
          </div>
          <div>
            {isUploading ? (
              <p className="text-gray-600 dark:text-gray-400 font-medium">
                Uploading contract...
              </p>
            ) : isDragActive ? (
              <p className="text-blue-600 font-medium">
                Drop your contract here
              </p>
            ) : (
              <>
                <p className="text-gray-700 dark:text-gray-300 font-medium">
                  Drag &amp; drop your contract here
                </p>
                <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                  or click to browse — PDF or Word (.docx)
                </p>
              </>
            )}
          </div>
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </div>
      </div>
      </motion.div>

      {/* OCR toggle */}
      <div
        className={`flex items-center gap-3 px-1 ${ocrDisabled ? "opacity-50" : ""}`}
      >
        <button
          type="button"
          role="switch"
          aria-checked={ocrEnabled}
          onClick={() => !ocrDisabled && onOcrToggle(!ocrEnabled)}
          disabled={ocrDisabled}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:focus:ring-offset-gray-900 ${
            ocrEnabled && !ocrDisabled ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-600"
          } ${ocrDisabled ? "cursor-not-allowed" : ""}`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
              ocrEnabled && !ocrDisabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
        <div>
          <span className="text-sm text-gray-700 dark:text-gray-300">
            Enable OCR (for scanned/non-digital PDFs)
          </span>
          {fileType === "docx" && (
            <span className="text-xs text-gray-400 dark:text-gray-500 ml-2">
              Not needed for Word files
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
