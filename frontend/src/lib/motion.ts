import { type Variants } from "motion/react";

export { useReducedMotion } from "motion/react";

// Single element fade-up entrance
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.4, ease: "easeOut" },
  },
};

// Stagger container — wrap list parents
export const staggerContainer: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { staggerChildren: 0.07, delayChildren: 0.1 },
  },
};

// Simple opacity fade
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: { duration: 0.3, ease: "easeOut" },
  },
};

// Expand/collapse height animation
export const expandCollapse: Variants = {
  collapsed: {
    height: 0,
    opacity: 0,
    overflow: "hidden" as const,
  },
  expanded: {
    height: "auto",
    opacity: 1,
    overflow: "hidden" as const,
    transition: {
      height: { duration: 0.3, ease: "easeOut" },
      opacity: { duration: 0.2 },
    },
  },
};

// Chat bubble slide-in from right (user)
export const chatBubbleUser: Variants = {
  hidden: { opacity: 0, x: 20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.25, ease: "easeOut" },
  },
};

// Chat bubble slide-in from left (assistant)
export const chatBubbleAssistant: Variants = {
  hidden: { opacity: 0, x: -20 },
  visible: {
    opacity: 1,
    x: 0,
    transition: { duration: 0.25, ease: "easeOut" },
  },
};

// Card hover lift effect
export const cardHover = {
  y: -3,
  boxShadow:
    "0 8px 25px -5px rgba(0,0,0,0.1), 0 4px 10px -6px rgba(0,0,0,0.1)",
  transition: { duration: 0.2, ease: "easeOut" as const },
};

// View cross-fade (for AnimatePresence mode="wait")
export const viewTransition: Variants = {
  initial: { opacity: 0, y: 8 },
  animate: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.3, ease: "easeOut" },
  },
  exit: {
    opacity: 0,
    y: -8,
    transition: { duration: 0.2, ease: "easeIn" },
  },
};
