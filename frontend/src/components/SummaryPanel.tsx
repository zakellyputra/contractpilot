"use client";

interface SummaryPanelProps {
  summary: string;
  contractType: string;
  filename: string;
}

export default function SummaryPanel({
  summary,
  contractType,
  filename,
}: SummaryPanelProps) {
  return (
    <div className="bg-white dark:bg-gray-900 border border-gray-200 dark:border-gray-700 rounded-xl p-6">
      <div className="flex items-center gap-2 mb-3">
        <svg
          className="w-5 h-5 text-blue-500"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
          />
        </svg>
        <div>
          <span className="font-medium text-gray-900 dark:text-gray-100">{filename}</span>
          <span className="mx-2 text-gray-300 dark:text-gray-600">|</span>
          <span className="text-gray-500 dark:text-gray-400 text-sm">{contractType}</span>
        </div>
      </div>
      <p className="text-gray-700 dark:text-gray-300 leading-relaxed">{summary}</p>
    </div>
  );
}
