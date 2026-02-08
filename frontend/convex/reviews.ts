import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const list = query({
  args: { userId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("reviews")
      .withIndex("by_user", (q) => q.eq("userId", args.userId))
      .order("desc")
      .collect();
  },
});

export const get = query({
  args: { id: v.id("reviews") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

export const create = mutation({
  args: {
    userId: v.string(),
    filename: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db.insert("reviews", {
      userId: args.userId,
      filename: args.filename,
      status: "pending",
    });
  },
});

export const updateStatus = mutation({
  args: {
    id: v.id("reviews"),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.patch(args.id, { status: args.status });
  },
});

export const updateProgress = mutation({
  args: {
    id: v.id("reviews"),
    totalClauses: v.optional(v.number()),
    completedClauses: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const patch: Record<string, number> = {};
    if (args.totalClauses !== undefined) patch.totalClauses = args.totalClauses;
    if (args.completedClauses !== undefined) patch.completedClauses = args.completedClauses;
    await ctx.db.patch(args.id, patch);
  },
});

export const setResults = mutation({
  args: {
    id: v.id("reviews"),
    summary: v.string(),
    riskScore: v.number(),
    financialRisk: v.number(),
    complianceRisk: v.number(),
    operationalRisk: v.number(),
    reputationalRisk: v.number(),
    actionItems: v.array(v.string()),
    keyDates: v.array(
      v.object({
        date: v.string(),
        label: v.string(),
        type: v.string(),
      })
    ),
    contractType: v.optional(v.string()),
    reportUrl: v.optional(v.string()),
    pdfUrl: v.optional(v.string()),
    ocrUsed: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { id, ...data } = args;
    await ctx.db.patch(id, { ...data, status: "completed" });
  },
});
