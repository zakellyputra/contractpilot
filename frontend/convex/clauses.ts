import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getByReview = query({
  args: { reviewId: v.id("reviews") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return [];

    const review = await ctx.db.get(args.reviewId);
    if (!review || review.userId !== identity.tokenIdentifier) {
      return [];
    }

    return await ctx.db
      .query("clauses")
      .withIndex("by_review", (q) => q.eq("reviewId", args.reviewId))
      .collect();
  },
});

export const addClause = mutation({
  args: {
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
    parentHeading: v.optional(v.string()),
    subClauseIndex: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("clauses", args);
  },
});
