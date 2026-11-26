import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowRight,
  Award,
  CalendarCheck,
  CheckCircle2,
  Crown,
  Droplets,
  Dumbbell,
  Flame,
  Lock,
  Ruler,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  X,
  Zap,
} from "lucide-react";
import {
  formatAchievementProgressValue,
  formatShortPtDate,
} from "../data/achievements";
import {
  AchievementCategory,
  AchievementIconKey,
  AchievementProgressItem,
  AchievementTier,
  TabId,
} from "../types";

interface AchievementsFeedProps {
  achievements: AchievementProgressItem[];
  onNavigateTab: (tab: TabId) => void;
}

type FeedFilter = "feed" | "unlocked" | "progress";
type ModalCategoryFilter = "Todas" | AchievementCategory;

const TIER_LABEL: Record<AchievementTier, string> = {
  bronze: "Bronze",
  silver: "Prata",
  gold: "Ouro",
};

const TIER_WEIGHT: Record<AchievementTier, number> = {
  gold: 3,
  silver: 2,
  bronze: 1,
};

const PRIORITY_STARTER_IDS = [
  "first_workout",
  "first_week_complete",
  "workouts_10",
  "hydration_goal",
  "streak_3",
  "ai_strategist",
];

function renderBadgeIcon(icon: AchievementIconKey, className: string) {
  switch (icon) {
    case "dumbbell":
      return <Dumbbell className={className} />;
    case "calendar":
      return <CalendarCheck className={className} />;
    case "flame":
      return <Flame className={className} />;
    case "trophy":
      return <Trophy className={className} />;
    case "award":
      return <Award className={className} />;
    case "zap":
      return <Zap className={className} />;
    case "crown":
      return <Crown className={className} />;
    case "droplets":
      return <Droplets className={className} />;
    case "ruler":
      return <Ruler className={className} />;
    case "sparkles":
      return <Sparkles className={className} />;
    case "target":
      return <Target className={className} />;
    case "shield":
      return <ShieldCheck className={className} />;
  }
}

function getEmblemClasses(tier: AchievementTier, unlocked: boolean): string {
  if (!unlocked) {
    return "bg-[#F1F5F9] dark:bg-[#18181D] border border-[#E2E8F0] dark:border-[#26262B] text-[#64748B] dark:text-[#71717A]";
  }
  switch (tier) {
    case "gold":
      return "bg-gradient-to-br from-amber-100 via-orange-50 to-amber-50 dark:from-[#FF6B00]/30 dark:via-amber-500/20 dark:to-[#1A1A20] border border-amber-400/60 dark:border-amber-400/50 text-amber-600 dark:text-amber-300";
    case "silver":
      return "bg-gradient-to-br from-slate-200 via-slate-100 to-white dark:from-zinc-200/20 dark:via-zinc-400/10 dark:to-[#1A1A20] border border-slate-300 dark:border-zinc-300/45 text-slate-700 dark:text-zinc-100";
    case "bronze":
      return "bg-gradient-to-br from-orange-100 to-orange-50 dark:from-[#FF6B00]/25 dark:to-[#1A1A20] border border-[#FF6B00]/50 text-[#FF6B00]";
  }
}

const SEEN_UNLOCKED_STORAGE_KEY = "personal_nutri_fit_seen_unlocked_badges_v1";

const CONFETTI_COLORS = [
  "#FF6B00",
  "#FB923C",
  "#FBBF24",
  "#FDE68A",
  "#10B981",
  "#38BDF8",
  "#FFFFFF",
];

interface ConfettiParticle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  width: number;
  height: number;
  color: string;
  rotation: number;
  rotationSpeed: number;
  opacity: number;
  life: number;
  maxLife: number;
  shape: "ribbon" | "sparkle";
  swayOffset: number;
}

const SubtleConfettiCanvas: React.FC<{ burstKey: number }> = ({ burstKey }) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (burstKey <= 0) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ) {
      return;
    }

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const width = Math.max(1, Math.floor(rect.width));
    const height = Math.max(1, Math.floor(rect.height));
    canvas.width = width * dpr;
    canvas.height = height * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    const particles: ConfettiParticle[] = [];
    const total = 46;
    const originX = width * 0.5;
    const originY = Math.min(80, height * 0.24);

    for (let i = 0; i < total; i++) {
      const isSparkle = i % 3 === 0;
      const spreadX = (Math.random() - 0.5) * width * 0.72;
      const angle = -Math.PI / 2 + (Math.random() - 0.5) * 1.9;
      const speed = isSparkle ? 1.4 + Math.random() * 2.6 : 2.1 + Math.random() * 3.8;
      particles.push({
        x: originX + spreadX * 0.35,
        y: originY + (Math.random() - 0.5) * 24,
        vx: Math.cos(angle) * speed + (Math.random() - 0.5) * 1.4,
        vy: Math.sin(angle) * speed - 0.6,
        size: isSparkle ? 2.2 + Math.random() * 2.6 : 4 + Math.random() * 3,
        width: 5 + Math.random() * 4,
        height: 2.8 + Math.random() * 2.4,
        color: CONFETTI_COLORS[i % CONFETTI_COLORS.length],
        rotation: Math.random() * Math.PI * 2,
        rotationSpeed: (Math.random() - 0.5) * 0.16,
        opacity: 0.92,
        life: 0,
        maxLife: 85 + Math.floor(Math.random() * 55),
        shape: isSparkle ? "sparkle" : "ribbon",
        swayOffset: Math.random() * Math.PI * 2,
      });
    }

    let rafId = 0;
    const renderFrame = () => {
      ctx.clearRect(0, 0, width, height);
      let alive = 0;

      for (const p of particles) {
        p.life += 1;
        if (p.life >= p.maxLife) continue;
        alive += 1;

        p.vy += p.shape === "sparkle" ? 0.025 : 0.065;
        p.vx *= 0.988;
        p.x += p.vx + Math.sin(p.life * 0.08 + p.swayOffset) * 0.35;
        p.y += p.vy;
        p.rotation += p.rotationSpeed;

        const progress = p.life / p.maxLife;
        const alpha =
          progress < 0.15
            ? (progress / 0.15) * 0.9
            : Math.max(0, (1 - (progress - 0.15) / 0.85) * 0.9);

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.translate(p.x, p.y);
        ctx.rotate(p.rotation);
        ctx.fillStyle = p.color;

        if (p.shape === "sparkle") {
          ctx.beginPath();
          const s = p.size;
          for (let k = 0; k < 4; k++) {
            const a = (k * Math.PI) / 2;
            ctx.lineTo(Math.cos(a) * s * 1.4, Math.sin(a) * s * 1.4);
            ctx.lineTo(
              Math.cos(a + Math.PI / 4) * s * 0.45,
              Math.sin(a + Math.PI / 4) * s * 0.45
            );
          }
          ctx.closePath();
          ctx.fill();
        } else {
          ctx.fillRect(-p.width / 2, -p.height / 2, p.width, p.height);
        }
        ctx.restore();
      }

      if (alive > 0) {
        rafId = window.requestAnimationFrame(renderFrame);
      } else {
        ctx.clearRect(0, 0, width, height);
      }
    };

    rafId = window.requestAnimationFrame(renderFrame);
    return () => {
      window.cancelAnimationFrame(rafId);
      ctx.clearRect(0, 0, width, height);
    };
  }, [burstKey]);

  if (burstKey <= 0) return null;

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-20 w-full h-full"
    />
  );
};

function readSeenUnlockedIds(): Set<string> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SEEN_UNLOCKED_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    return new Set(parsed.filter((id): id is string => typeof id === "string"));
  } catch {
    return null;
  }
}

function writeSeenUnlockedIds(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(
      SEEN_UNLOCKED_STORAGE_KEY,
      JSON.stringify(Array.from(ids))
    );
  } catch {
    // ignore storage quota errors
  }
}

export const AchievementsFeed: React.FC<AchievementsFeedProps> = ({
  achievements,
  onNavigateTab,
}) => {
  const [feedFilter, setFeedFilter] = useState<FeedFilter>("feed");
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [modalCategory, setModalCategory] = useState<ModalCategoryFilter>("Todas");
  const [selectedBadgeId, setSelectedBadgeId] = useState<string | null>(null);
  const [confettiBurstKey, setConfettiBurstKey] = useState(0);
  const [recentUnlockIds, setRecentUnlockIds] = useState<string[]>([]);
  const celebrationTimerRef = useRef<number | null>(null);
  const seenIdsRef = useRef<Set<string> | null>(null);

  const triggerCelebration = useCallback((unlockedIds: string[]) => {
    if (unlockedIds.length === 0) return;
    setRecentUnlockIds(unlockedIds);
    setConfettiBurstKey((prev) => prev + 1);
    if (celebrationTimerRef.current) {
      window.clearTimeout(celebrationTimerRef.current);
    }
    celebrationTimerRef.current = window.setTimeout(() => {
      setRecentUnlockIds([]);
    }, 5500);
  }, []);

  useEffect(() => {
    return () => {
      if (celebrationTimerRef.current) {
        window.clearTimeout(celebrationTimerRef.current);
      }
    };
  }, []);

  // Automatically detect newly unlocked achievements (live on Dashboard or after returning from another tab)
  useEffect(() => {
    const currentUnlockedIds = achievements
      .filter((a) => a.unlocked)
      .map((a) => a.id);

    if (seenIdsRef.current === null) {
      const stored = readSeenUnlockedIds();
      if (stored === null) {
        // First initialization: seed existing unlocked IDs without replaying old milestones
        const initialSet = new Set(currentUnlockedIds);
        seenIdsRef.current = initialSet;
        writeSeenUnlockedIds(initialSet);
        return;
      }
      seenIdsRef.current = stored;
    }

    const newlyUnlocked = currentUnlockedIds.filter(
      (id) => !seenIdsRef.current?.has(id)
    );

    if (newlyUnlocked.length > 0) {
      const nextSeen = new Set(seenIdsRef.current);
      for (const id of newlyUnlocked) {
        nextSeen.add(id);
      }
      seenIdsRef.current = nextSeen;
      writeSeenUnlockedIds(nextSeen);
      triggerCelebration(newlyUnlocked);
    }
  }, [achievements, triggerCelebration]);

  useEffect(() => {
    if (!galleryOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setGalleryOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [galleryOpen]);

  const stats = useMemo(() => {
    const unlocked = achievements.filter((a) => a.unlocked);
    const locked = achievements.filter((a) => !a.unlocked);

    const unlockedSorted = [...unlocked].sort((a, b) => {
      const dateCmp = (b.unlockedDate || "").localeCompare(a.unlockedDate || "");
      if (dateCmp !== 0) return dateCmp;
      return TIER_WEIGHT[b.tier] - TIER_WEIGHT[a.tier];
    });

    const lockedSorted = [...locked].sort((a, b) => {
      if (b.percent !== a.percent) return b.percent - a.percent;
      const idxA = PRIORITY_STARTER_IDS.indexOf(a.id);
      const idxB = PRIORITY_STARTER_IDS.indexOf(b.id);
      const rankA = idxA === -1 ? 99 : idxA;
      const rankB = idxB === -1 ? 99 : idxB;
      return rankA - rankB;
    });

    const goldCount = unlocked.filter((a) => a.tier === "gold").length;
    const silverCount = unlocked.filter((a) => a.tier === "silver").length;
    const bronzeCount = unlocked.filter((a) => a.tier === "bronze").length;
    const totalCount = achievements.length;
    const completionPct =
      totalCount > 0 ? Math.round((unlocked.length / totalCount) * 100) : 0;

    // Build a balanced motivational feed (up to 6 items): recent unlocks + closest upcoming milestones
    const recentSlice = unlockedSorted.slice(0, 3);
    const remainingSlots = Math.max(0, 6 - recentSlice.length);
    const upcomingSlice = lockedSorted.slice(0, remainingSlots);
    const feedItems = [...recentSlice, ...upcomingSlice];
    if (feedItems.length < 6 && unlockedSorted.length > 3) {
      feedItems.push(...unlockedSorted.slice(3, 3 + (6 - feedItems.length)));
    }

    return {
      unlockedCount: unlocked.length,
      totalCount,
      completionPct,
      goldCount,
      silverCount,
      bronzeCount,
      unlockedSorted,
      lockedSorted,
      feedItems,
      nextClosest: lockedSorted[0] || null,
    };
  }, [achievements]);

  const visibleItems = useMemo(() => {
    if (feedFilter === "unlocked") return stats.unlockedSorted.slice(0, 6);
    if (feedFilter === "progress") return stats.lockedSorted.slice(0, 6);
    return stats.feedItems;
  }, [feedFilter, stats]);

  const modalItems = useMemo(() => {
    const filtered =
      modalCategory === "Todas"
        ? achievements
        : achievements.filter((a) => a.category === modalCategory);
    return [...filtered].sort((a, b) => {
      if (a.unlocked !== b.unlocked) return a.unlocked ? -1 : 1;
      if (a.unlocked) {
        return (b.unlockedDate || "").localeCompare(a.unlockedDate || "");
      }
      return b.percent - a.percent;
    });
  }, [achievements, modalCategory]);

  const openBadgeInGallery = (badge: AchievementProgressItem) => {
    setSelectedBadgeId(badge.id);
    setModalCategory("Todas");
    setGalleryOpen(true);
  };

  const handleActionClick = (tab?: TabId) => {
    if (!tab) return;
    setGalleryOpen(false);
    onNavigateTab(tab);
  };

  const recentUnlockSet = useMemo(
    () => new Set(recentUnlockIds),
    [recentUnlockIds]
  );

  const recentUnlockTitles = useMemo(() => {
    if (recentUnlockIds.length === 0) return [];
    return achievements
      .filter((a) => recentUnlockSet.has(a.id))
      .map((a) => a.title);
  }, [achievements, recentUnlockIds.length, recentUnlockSet]);

  const isCelebrating = recentUnlockIds.length > 0;

  return (
    <>
      <section
        aria-label="Conquistas e feed motivacional de progresso"
        className={`relative overflow-hidden rounded-2xl bg-white dark:bg-[#151518] border shadow-sm dark:shadow-none p-5 sm:p-6 space-y-5 transition-all duration-500 ${
          isCelebrating
            ? "border-[#FF6B00]/75 ring-2 ring-[#FF6B00]/25"
            : "border-[#E2E8F0] dark:border-[#26262B]"
        }`}
      >
        {/* Subtle Confetti & Sparkle Particle Overlay */}
        <SubtleConfettiCanvas burstKey={confettiBurstKey} />

        {/* Radiant Top Shimmer Accent when celebrating */}
        <AnimatePresence>
          {isCelebrating && (
            <motion.span
              aria-hidden="true"
              initial={{ opacity: 0, x: "-100%" }}
              animate={{ opacity: [0, 0.9, 0], x: ["-100%", "100%"] }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
              className="pointer-events-none absolute inset-x-0 top-0 z-10 h-1 bg-gradient-to-r from-transparent via-[#FF6B00] to-amber-300"
            />
          )}
        </AnimatePresence>

        {/* Celebratory Recognition Banner on New Unlock */}
        <AnimatePresence>
          {isCelebrating && recentUnlockTitles.length > 0 && (
            <motion.div
              initial={{ opacity: 0, y: -10, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.98 }}
              transition={{ duration: 0.35 }}
              className="relative z-10 rounded-xl bg-gradient-to-r from-[#FF6B00]/15 via-amber-400/12 to-[#FF6B00]/10 dark:from-[#FF6B00]/25 dark:via-amber-500/15 dark:to-[#FF6B00]/15 border border-[#FF6B00]/45 px-4 py-2.5 flex items-center justify-between gap-3"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <Sparkles className="w-4 h-4 text-[#FF6B00] shrink-0 animate-pulse" />
                <p className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-white truncate">
                  {recentUnlockTitles.length === 1
                    ? `Nova conquista desbloqueada: ${recentUnlockTitles[0]}!`
                    : `${recentUnlockTitles.length} novas conquistas desbloqueadas: ${recentUnlockTitles.join(", ")}!`}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setRecentUnlockIds([])}
                aria-label="Dispensar aviso de conquista"
                className="text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white p-1 rounded-lg cursor-pointer shrink-0"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Section Header + Controls */}
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-[#475569] dark:text-[#A1A1AA]">
              <Trophy className="w-3.5 h-3.5 text-[#FF6B00] shrink-0" />
              <span className="font-semibold text-[#FF6B00]">Feed de conquistas</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-[#0F172A] dark:text-white font-semibold">
                {stats.unlockedCount} de {stats.totalCount} badges
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">{stats.completionPct}% completo</span>
            </div>

            <h2 className="mt-1 text-lg sm:text-xl font-extrabold text-[#0F172A] dark:text-white tracking-tight">
              Progresso motivacional
            </h2>
            <p className="mt-0.5 text-xs sm:text-sm text-[#475569] dark:text-[#A1A1AA]">
              {stats.nextClosest
                ? `Próxima conquista mais perto: ${stats.nextClosest.title} (${stats.nextClosest.remainingLabel.toLowerCase()}).`
                : "Todas as conquistas do Personal Nutri Fit foram desbloqueadas. Consistência máxima."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <div
              role="tablist"
              aria-label="Filtrar feed de conquistas"
              className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#F1F5F9] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B]"
            >
              {(
                [
                  { id: "feed", label: "Feed" },
                  { id: "unlocked", label: `Conquistadas (${stats.unlockedCount})` },
                  { id: "progress", label: "Em progresso" },
                ] as { id: FeedFilter; label: string }[]
              ).map((tab) => {
                const active = feedFilter === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={active}
                    onClick={() => setFeedFilter(tab.id)}
                    className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                      active
                        ? "bg-[#FF6B00] text-white"
                        : "text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white"
                    }`}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>

            {stats.unlockedCount > 0 && (
              <button
                type="button"
                onClick={() => {
                  const latestId = stats.unlockedSorted[0]?.id;
                  if (latestId) triggerCelebration([latestId]);
                }}
                title="Celebrar conquista mais recente"
                aria-label="Celebrar conquista mais recente"
                className="min-h-[44px] px-3 py-2 rounded-xl bg-[#FF6B00]/10 hover:bg-[#FF6B00]/20 border border-[#FF6B00]/35 text-xs font-semibold text-[#FF6B00] flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Celebrar</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setSelectedBadgeId(null);
                setModalCategory("Todas");
                setGalleryOpen(true);
              }}
              className="min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F1F5F9] dark:bg-[#1B1B20] hover:bg-[#E2E8F0] dark:hover:bg-[#23232A] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00]/50 text-xs font-semibold text-[#0F172A] dark:text-white flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
            >
              <span>Ver todas ({stats.totalCount})</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#FF6B00]" />
            </button>
          </div>
        </div>

        {/* Overall Mastery Progress Bar */}
        <div className="space-y-1.5">
          <div className="h-2 w-full rounded-full bg-[#E2E8F0] dark:bg-[#26262B] overflow-hidden">
            <div
              className="h-full rounded-full bg-[#FF6B00] transition-[width] duration-300"
              style={{ width: `${Math.max(stats.completionPct, stats.unlockedCount > 0 ? 6 : 0)}%` }}
            />
          </div>
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#475569] dark:text-[#A1A1AA] font-mono tabular-nums">
            <span>
              Ouro {stats.goldCount} · Prata {stats.silverCount} · Bronze {stats.bronzeCount}
            </span>
            <span>
              {stats.totalCount - stats.unlockedCount === 0
                ? "Coleção completa"
                : `${stats.totalCount - stats.unlockedCount} conquistas restantes`}
            </span>
          </div>
        </div>

        {/* Feed Grid or Empty Unlocked State */}
        {visibleItems.length === 0 ? (
          <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#101013] border border-[#E2E8F0] dark:border-[#26262B] p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <p className="text-sm font-bold text-[#0F172A] dark:text-white">
                Sua primeira conquista está a um treino de distância
              </p>
              <p className="mt-1 text-xs text-[#475569] dark:text-[#A1A1AA]">
                Finalize uma sessão de musculação, complete sua meta de água ou salve uma ficha no Personal IA para desbloquear seu primeiro badge.
              </p>
            </div>
            <button
              type="button"
              onClick={() => onNavigateTab("treinos")}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#F97316] text-xs font-bold text-white flex items-center justify-center gap-1.5 whitespace-nowrap shrink-0 transition-colors cursor-pointer"
            >
              <span>Iniciar primeiro treino</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>
        ) : (
          <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {visibleItems.map((item) => {
              const isJustUnlocked = recentUnlockSet.has(item.id);
              return (
                <motion.button
                  key={item.id}
                  type="button"
                  onClick={() => openBadgeInGallery(item)}
                  animate={
                    isJustUnlocked
                      ? { scale: [0.97, 1.025, 1] }
                      : { scale: 1 }
                  }
                  transition={{ duration: 0.55, ease: "easeOut" }}
                  className={`group relative overflow-hidden text-left rounded-xl p-4 border transition-all flex flex-col justify-between gap-3.5 cursor-pointer ${
                    isJustUnlocked
                      ? "bg-gradient-to-br from-[#FFF7ED] via-[#FFEDD5]/70 to-amber-50 dark:from-[#231811] dark:via-[#181414] dark:to-[#151518] border-[#FF6B00] ring-2 ring-[#FF6B00]/35 shadow-md shadow-[#FF6B00]/15"
                      : item.unlocked
                      ? "bg-[#FFF7ED]/70 dark:bg-[#111115] border-[#FF6B00]/35 hover:border-[#FF6B00]/70"
                      : "bg-[#F8FAFC] dark:bg-[#101013] border-[#E2E8F0] dark:border-[#26262B] hover:border-[#CBD5E1] dark:hover:border-[#3A3A44]"
                  }`}
                >
                  {/* Subtle light-sweep shimmer on newly unlocked card */}
                  {isJustUnlocked && (
                    <motion.span
                      aria-hidden="true"
                      initial={{ x: "-130%" }}
                      animate={{ x: "180%" }}
                      transition={{
                        duration: 1.35,
                        repeat: 2,
                        repeatDelay: 0.45,
                        ease: "easeInOut",
                      }}
                      className="pointer-events-none absolute inset-y-0 left-0 w-1/2 -skew-x-12 bg-gradient-to-r from-transparent via-white/45 dark:via-amber-300/25 to-transparent"
                    />
                  )}

                  <div className="relative z-10 flex items-start gap-3">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-[1.03] ${
                        isJustUnlocked ? "ring-2 ring-[#FF6B00]/50 shadow-sm shadow-[#FF6B00]/30" : ""
                      } ${getEmblemClasses(item.tier, item.unlocked)}`}
                    >
                      {renderBadgeIcon(item.icon, "w-5 h-5")}
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="text-sm font-bold text-[#0F172A] dark:text-white leading-snug">
                          {item.title}
                        </h3>
                        {isJustUnlocked ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-[#FF6B00] text-white text-[10px] font-bold shrink-0">
                            <Sparkles className="w-2.5 h-2.5" />
                            Nova!
                          </span>
                        ) : item.unlocked ? (
                          <CheckCircle2
                            aria-label="Conquista desbloqueada"
                            className="w-4 h-4 text-[#FF6B00] shrink-0 mt-0.5"
                          />
                        ) : (
                          <span className="font-mono text-xs font-semibold tabular-nums text-[#334155] dark:text-[#D4D4D8] shrink-0">
                            {item.percent}%
                          </span>
                        )}
                      </div>

                      <p className="mt-0.5 text-[11px] text-[#475569] dark:text-[#A1A1AA]">
                        {item.category} · {TIER_LABEL[item.tier]}
                        {item.unlocked && item.unlockedDate && (
                          <> · {formatShortPtDate(item.unlockedDate)}</>
                        )}
                      </p>
                    </div>
                  </div>

                  <p className="relative z-10 text-xs text-[#475569] dark:text-[#A1A1AA] leading-relaxed line-clamp-2">
                    {item.description}
                  </p>

                  <div className="relative z-10 space-y-1.5 pt-2.5 border-t border-[#E2E8F0] dark:border-[#26262B]/80">
                    {!item.unlocked && (
                      <div className="h-1.5 w-full rounded-full bg-[#E2E8F0] dark:bg-[#26262B] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#FF6B00] transition-[width] duration-300"
                          style={{ width: `${item.percent}%` }}
                        />
                      </div>
                    )}

                    <div className="flex items-center justify-between gap-2 text-[11px]">
                      <span className="font-mono tabular-nums text-[#0F172A] dark:text-[#E4E4E7] font-medium">
                        {formatAchievementProgressValue(item)}
                      </span>
                      <span
                        className={`truncate ${
                          item.unlocked
                            ? "text-[#FF6B00] font-semibold"
                            : "text-[#475569] dark:text-[#A1A1AA] group-hover:text-[#0F172A] dark:group-hover:text-white transition-colors"
                        }`}
                      >
                        {item.unlocked ? "Conquistada" : item.remainingLabel}
                      </span>
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>
        )}
      </section>

      {/* Full Achievements Gallery Modal */}
      {galleryOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="bianco-badges-modal-title"
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/70 dark:bg-black/75 backdrop-blur-sm"
          onClick={() => setGalleryOpen(false)}
        >
          <div
            className="w-full sm:max-w-3xl max-h-[88vh] rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-2xl dark:shadow-none flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="p-5 sm:p-6 border-b border-[#E2E8F0] dark:border-[#26262B] flex items-start justify-between gap-4 shrink-0">
              <div>
                <p className="text-xs font-semibold text-[#FF6B00]">
                  Galeria Personal Nutri Fit ·{" "}
                  <span className="font-mono tabular-nums">
                    {stats.unlockedCount}/{stats.totalCount} desbloqueadas
                  </span>
                </p>
                <h3
                  id="bianco-badges-modal-title"
                  className="mt-1 text-xl font-extrabold text-[#0F172A] dark:text-white tracking-tight"
                >
                  Badges e conquistas
                </h3>
                <p className="mt-0.5 text-xs text-[#475569] dark:text-[#A1A1AA] font-mono tabular-nums">
                  Ouro: {stats.goldCount} · Prata: {stats.silverCount} · Bronze:{" "}
                  {stats.bronzeCount}
                </p>
              </div>

              <button
                type="button"
                onClick={() => setGalleryOpen(false)}
                aria-label="Fechar galeria de conquistas"
                className="min-h-[44px] min-w-[44px] rounded-xl bg-[#F1F5F9] dark:bg-[#1C1C22] hover:bg-[#E2E8F0] dark:hover:bg-[#26262D] border border-[#E2E8F0] dark:border-[#26262B] text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white flex items-center justify-center transition-colors shrink-0 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Category Filter Bar */}
            <div className="px-5 sm:px-6 py-3 border-b border-[#E2E8F0] dark:border-[#26262B] flex items-center gap-1.5 overflow-x-auto shrink-0">
              {(
                [
                  "Todas",
                  "Consistência",
                  "Treinos",
                  "Hábitos",
                  "Estratégia",
                ] as ModalCategoryFilter[]
              ).map((cat) => {
                const active = modalCategory === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setModalCategory(cat)}
                    className={`min-h-[38px] px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                      active
                        ? "bg-[#FF6B00] text-white"
                        : "bg-[#F8FAFC] dark:bg-[#101013] border border-[#E2E8F0] dark:border-[#26262B] text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white"
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Scrollable Badges List */}
            <div className="p-5 sm:p-6 overflow-y-auto space-y-3">
              {modalItems.map((item) => {
                const isHighlighted = selectedBadgeId === item.id;
                return (
                  <div
                    key={item.id}
                    className={`rounded-xl p-4 border transition-colors ${
                      isHighlighted
                        ? "bg-[#FFF7ED] dark:bg-[#19191F] border-[#FF6B00]"
                        : item.unlocked
                        ? "bg-[#FFF7ED]/50 dark:bg-[#111115] border-[#FF6B00]/30"
                        : "bg-[#F8FAFC] dark:bg-[#101013] border-[#E2E8F0] dark:border-[#26262B]"
                    }`}
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
                      <div className="flex items-start gap-3.5 min-w-0">
                        <div
                          className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${getEmblemClasses(
                            item.tier,
                            item.unlocked
                          )}`}
                        >
                          {renderBadgeIcon(item.icon, "w-5 h-5")}
                        </div>

                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                            <h4 className="text-sm font-bold text-[#0F172A] dark:text-white">
                              {item.title}
                            </h4>
                            <span className="text-[11px] text-[#475569] dark:text-[#A1A1AA]">
                              · {item.category} · {TIER_LABEL[item.tier]}
                            </span>
                          </div>
                          <p className="mt-1 text-xs text-[#475569] dark:text-[#A1A1AA] leading-relaxed">
                            {item.description}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                            {item.unlocked ? (
                              <span className="inline-flex items-center gap-1 font-semibold text-[#FF6B00]">
                                <CheckCircle2 className="w-3.5 h-3.5" />
                                Desbloqueada em {formatShortPtDate(item.unlockedDate)}
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[#475569] dark:text-[#A1A1AA]">
                                <Lock className="w-3 h-3" />
                                {item.remainingLabel}
                              </span>
                            )}
                            <span aria-hidden="true" className="text-[#CBD5E1] dark:text-[#3A3A44]">
                              ·
                            </span>
                            <span className="font-mono tabular-nums text-[#0F172A] dark:text-[#E4E4E7]">
                              {formatAchievementProgressValue(item)}
                            </span>
                          </div>
                        </div>
                      </div>

                      {!item.unlocked && item.ctaTab && item.ctaLabel && (
                        <button
                          type="button"
                          onClick={() => handleActionClick(item.ctaTab)}
                          className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#F1F5F9] dark:bg-[#1C1C22] hover:bg-[#FF6B00] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00] text-xs font-semibold text-[#0F172A] dark:text-white hover:text-white flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                        >
                          <span>{item.ctaLabel}</span>
                          <ArrowRight className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>

                    {!item.unlocked && (
                      <div className="mt-3 h-1.5 w-full rounded-full bg-[#E2E8F0] dark:bg-[#26262B] overflow-hidden">
                        <div
                          className="h-full rounded-full bg-[#FF6B00] transition-[width] duration-300"
                          style={{ width: `${item.percent}%` }}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
