import { v } from "convex/values";
import { query, mutation } from "./_generated/server";

export const getBalance = query({
  args: {},
  handler: async (ctx) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) return { credits: 0 };

    const userId = identity.tokenIdentifier;
    const record = await ctx.db
      .query("userCredits")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    return { credits: record?.credits ?? 0 };
  },
});

export const addCredits = mutation({
  args: { amount: v.number() },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const userId = identity.tokenIdentifier;
    const existing = await ctx.db
      .query("userCredits")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    if (existing) {
      await ctx.db.patch(existing._id, {
        credits: existing.credits + args.amount,
      });
    } else {
      await ctx.db.insert("userCredits", {
        userId,
        credits: args.amount,
      });
    }
  },
});

export const unlockReview = mutation({
  args: { reviewId: v.id("reviews") },
  handler: async (ctx, args) => {
    const identity = await ctx.auth.getUserIdentity();
    if (!identity) throw new Error("Not authenticated");

    const userId = identity.tokenIdentifier;

    const review = await ctx.db.get(args.reviewId);
    if (!review || review.userId !== userId) {
      throw new Error("Review not found");
    }

    if (review.unlocked) {
      return { success: true, alreadyUnlocked: true };
    }

    const creditRecord = await ctx.db
      .query("userCredits")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .unique();

    const currentCredits = creditRecord?.credits ?? 0;
    if (currentCredits <= 0) {
      throw new Error("No credits remaining");
    }

    await ctx.db.patch(creditRecord!._id, {
      credits: currentCredits - 1,
    });

    await ctx.db.patch(args.reviewId, { unlocked: true });

    return { success: true, alreadyUnlocked: false };
  },
});
