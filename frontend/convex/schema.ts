import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
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
          type: v.string(), // "deadline" | "renewal" | "termination" | "milestone"
        })
      )
    ),
    reportUrl: v.optional(v.string()),
    ocrUsed: v.optional(v.boolean()),
  }).index("by_user", ["userId"]),

  clauses: defineTable({
    reviewId: v.id("reviews"),
    clauseText: v.string(),
    clauseType: v.optional(v.string()),
    riskLevel: v.string(), // "high" | "medium" | "low"
    riskCategory: v.string(), // "financial" | "compliance" | "operational" | "reputational"
    explanation: v.string(),
    concern: v.optional(v.string()),
    suggestion: v.optional(v.string()),
    k2Reasoning: v.optional(v.string()),
  }).index("by_review", ["reviewId"]),
});
