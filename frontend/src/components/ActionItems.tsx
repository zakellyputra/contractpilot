"use client";

interface ActionItemsProps {
  items: string[];
}

export default function ActionItems({ items }: ActionItemsProps) {
  if (!items.length) return null;

  return (
    <div>
      <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">
        What to Do Next
      </h3>
      <ol className="space-y-2">
        {items.map((item, i) => (
          <li key={i} className="flex items-start gap-3">
            <span className="flex items-center justify-center w-6 h-6 rounded-full bg-blue-100 text-blue-700 text-xs font-bold shrink-0 mt-0.5">
              {i + 1}
            </span>
            <span className="text-gray-700">{item}</span>
          </li>
        ))}
      </ol>
    </div>
  );
}
