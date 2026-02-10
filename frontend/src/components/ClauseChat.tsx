"use client";

import { useState, useRef, useEffect } from "react";
import { motion } from "motion/react";
import { chatAboutClause } from "@/lib/api";
import { chatBubbleUser, chatBubbleAssistant, fadeUp, staggerContainer } from "@/lib/motion";

interface Message {
  role: "user" | "assistant";
  content: string;
  sources?: string[];
}

interface ClauseData {
  _id: string;
  clauseType?: string;
  clauseText?: string;
  riskLevel: string;
  riskCategory: string;
  explanation: string;
}

interface ClauseChatProps {
  activeClauseId: string | null;
  clauses: ClauseData[];
  contractType: string;
}

export default function ClauseChat({
  activeClauseId,
  clauses,
  contractType,
}: ClauseChatProps) {
  const [chatHistories, setChatHistories] = useState<Record<string, Message[]>>({});
  const [inputValue, setInputValue] = useState("");
  const [loadingClauses, setLoadingClauses] = useState<Record<string, boolean>>({});
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const clause = clauses.find((c) => c._id === activeClauseId);
  const messages = activeClauseId ? chatHistories[activeClauseId] || [] : [];
  const isLoading = activeClauseId ? loadingClauses[activeClauseId] ?? false : false;

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, isLoading]);

  const sendMessage = async (text: string) => {
    if (!text.trim() || !activeClauseId || !clause || isLoading) return;

    const userMsg: Message = { role: "user", content: text.trim() };
    const updated = [...messages, userMsg];
    const clauseId = activeClauseId;
    setChatHistories((prev) => ({ ...prev, [clauseId]: updated }));
    setInputValue("");
    setLoadingClauses((prev) => ({ ...prev, [clauseId]: true }));

    try {
      const result = await chatAboutClause(
        text.trim(),
        clause.clauseText || clause.explanation,
        clause.clauseType || "Clause",
        contractType,
        updated.map((m) => ({ role: m.role, content: m.content })),
      );
      const assistantMsg: Message = {
        role: "assistant",
        content: result.answer,
        sources: result.sources,
      };
      setChatHistories((prev) => ({
        ...prev,
        [clauseId]: [...(prev[clauseId] || []), assistantMsg],
      }));
    } catch {
      const errorMsg: Message = {
        role: "assistant",
        content: "Sorry, I couldn't research that right now. Please try again.",
      };
      setChatHistories((prev) => ({
        ...prev,
        [clauseId]: [...(prev[clauseId] || []), errorMsg],
      }));
    } finally {
      setLoadingClauses((prev) => ({ ...prev, [clauseId]: false }));
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(inputValue);
    }
  };

  const starterPrompts = [
    "What does this mean in plain English?",
    `Is this standard for ${contractType} agreements?`,
    "What should I negotiate here?",
  ];

  // No clause selected
  if (!activeClauseId || !clause) {
    return (
      <div className="h-full flex flex-col border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900">
        <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800">
          <h3 className="text-xs font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wide">
            Chat
          </h3>
        </div>
        <div className="flex-1 flex items-center justify-center p-4">
          <p className="text-gray-400 dark:text-gray-500 text-xs text-center">
            Select a clause to start chatting
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
      {/* Header */}
      <div className="px-4 py-2 border-b border-gray-200 dark:border-gray-700 flex items-center gap-2">
        <h3 className="text-xs font-semibold text-gray-500 dark:text-gray-400 uppercase tracking-wide">
          Chat
        </h3>
        <span className="text-[10px] text-gray-400 dark:text-gray-500 truncate">
          {clause.clauseType || "Clause"}
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-3 space-y-3">
        {messages.length === 0 && !isLoading && (
          <motion.div className="space-y-2" variants={staggerContainer} initial="hidden" animate="visible">
            <p className="text-xs text-gray-400 dark:text-gray-500 text-center mb-3">
              Ask about this clause
            </p>
            {starterPrompts.map((prompt) => (
              <motion.button
                key={prompt}
                variants={fadeUp}
                onClick={() => sendMessage(prompt)}
                className="block w-full text-left text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-400 hover:bg-blue-50 dark:hover:bg-blue-950 hover:border-blue-200 dark:hover:border-blue-700 hover:text-blue-700 dark:hover:text-blue-300 transition-colors"
              >
                {prompt}
              </motion.button>
            ))}
          </motion.div>
        )}

        {messages.map((msg, i) => (
          <motion.div
            key={i}
            variants={msg.role === "user" ? chatBubbleUser : chatBubbleAssistant}
            initial="hidden"
            animate="visible"
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-lg px-3 py-2 text-xs leading-relaxed ${
                msg.role === "user"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 dark:bg-gray-800 text-gray-700 dark:text-gray-300"
              }`}
            >
              <p className="whitespace-pre-wrap">{msg.content}</p>
              {msg.sources && msg.sources.length > 0 && (
                <div className="mt-2 pt-1.5 border-t border-gray-200 dark:border-gray-600 space-y-0.5">
                  {msg.sources.map((url, j) => (
                    <a
                      key={j}
                      href={url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block text-[10px] text-blue-500 dark:text-blue-400 hover:underline truncate"
                    >
                      {url}
                    </a>
                  ))}
                </div>
              )}
            </div>
          </motion.div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-gray-100 dark:bg-gray-800 rounded-lg px-3 py-2 text-xs text-gray-500 dark:text-gray-400">
              <span className="inline-flex items-center gap-1">
                <span className="animate-pulse">Researching</span>
                <span className="animate-bounce" style={{ animationDelay: "0ms" }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: "150ms" }}>.</span>
                <span className="animate-bounce" style={{ animationDelay: "300ms" }}>.</span>
              </span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="px-3 py-2 border-t border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900">
        <div className="flex gap-2">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about this clause..."
            disabled={isLoading}
            className="flex-1 text-xs px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 placeholder:text-gray-400 dark:placeholder:text-gray-500 focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-200 dark:focus:ring-blue-800 disabled:opacity-50 disabled:bg-gray-50 dark:disabled:bg-gray-800"
          />
          <button
            onClick={() => sendMessage(inputValue)}
            disabled={!inputValue.trim() || isLoading}
            className="px-3 py-2 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
