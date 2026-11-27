import type { Transition, Variants } from "motion/react";
import type { TabId } from "../types";

/**
 * Bianco Fit Motion Vocabulary (Dark & Orange)
 * Fast, athletic settling curve with compositor-only transforms (`transform`, `opacity`).
 */
export const BIANCO_EASE = [0.16, 1, 0.3, 1] as const;

export const NAV_SPRING: Transition = {
  type: "spring",
  stiffness: 460,
  damping: 36,
  mass: 0.8,
};

export const CARD_HOVER_TRANSITION: Transition = {
  duration: 0.18,
  ease: BIANCO_EASE,
};

export const TAB_ORDER: Record<TabId, number> = {
  inicio: 0,
  treinos: 1,
  biblioteca: 2,
  personal: 3,
  nutri: 4,
  evolucao: 5,
  perfil: 6,
  admin: 7,
};

export const tabPanelVariants: Variants = {
  initial: (direction: number) => ({
    opacity: 0,
    x: direction === 0 ? 0 : direction > 0 ? 12 : -12,
    y: direction === 0 ? 6 : 0,
  }),
  animate: {
    opacity: 1,
    x: 0,
    y: 0,
    transition: {
      duration: 0.2,
      ease: BIANCO_EASE,
    },
  },
  exit: (direction: number) => ({
    opacity: 0,
    x: direction === 0 ? 0 : direction > 0 ? -10 : 10,
    y: direction === 0 ? -4 : 0,
    transition: {
      duration: 0.13,
      ease: BIANCO_EASE,
    },
  }),
};

export const dashboardContainerVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.055,
      delayChildren: 0.015,
    },
  },
};

export const dashboardSectionVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.28,
      ease: BIANCO_EASE,
    },
  },
};

export const kpiGridVariants: Variants = {
  hidden: { opacity: 0 },
  visible: {
    opacity: 1,
    transition: {
      staggerChildren: 0.055,
    },
  },
};

export const kpiCardVariants: Variants = {
  hidden: { opacity: 0, y: 14, scale: 0.985 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      duration: 0.28,
      ease: BIANCO_EASE,
    },
  },
};

/**
 * Chart cards animate strictly `opacity` + `y` (never `scale`) so Recharts
 * ResponsiveContainer dimensions stay crisp without resize flicker.
 */
export const chartCardVariants: Variants = {
  hidden: { opacity: 0, y: 14 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.3,
      ease: BIANCO_EASE,
    },
  },
};
