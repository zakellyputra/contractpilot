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
