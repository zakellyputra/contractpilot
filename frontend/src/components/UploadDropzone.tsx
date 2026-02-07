"use client";

import { useCallback, useState } from "react";
import { useDropzone } from "react-dropzone";

interface UploadDropzoneProps {
  onUpload: (file: File) => void;
  isUploading: boolean;
}

export default function UploadDropzone({
  onUpload,
  isUploading,
}: UploadDropzoneProps) {
  const [error, setError] = useState<string | null>(null);

  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      setError(null);
      const file = acceptedFiles[0];
      if (!file) return;

      if (file.type !== "application/pdf") {
        setError("Please upload a PDF file.");
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
    accept: { "application/pdf": [".pdf"] },
    maxFiles: 1,
    disabled: isUploading,
  });

  return (
    <div
      {...getRootProps()}
      className={`border-2 border-dashed rounded-2xl p-12 text-center cursor-pointer transition-all ${
        isDragActive
          ? "border-blue-500 bg-blue-50"
          : isUploading
            ? "border-gray-300 bg-gray-50 cursor-not-allowed"
            : "border-gray-300 hover:border-blue-400 hover:bg-blue-50/50"
      }`}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center gap-3">
        <div className="text-4xl">
          {isUploading ? (
            <div className="animate-spin h-10 w-10 border-4 border-blue-500 border-t-transparent rounded-full" />
          ) : (
            <svg
              className="w-12 h-12 text-gray-400"
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
            </svg>
          )}
        </div>
        <div>
          {isUploading ? (
            <p className="text-gray-600 font-medium">Uploading contract...</p>
          ) : isDragActive ? (
            <p className="text-blue-600 font-medium">Drop your contract here</p>
          ) : (
            <>
              <p className="text-gray-700 font-medium">
                Drag & drop your contract PDF here
              </p>
              <p className="text-gray-500 text-sm mt-1">
                or click to browse — supports scanned documents too
              </p>
            </>
          )}
        </div>
        {error && <p className="text-red-500 text-sm">{error}</p>}
      </div>
    </div>
  );
}
