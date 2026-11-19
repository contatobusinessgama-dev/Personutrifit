import React, { useEffect, useMemo, useState } from "react";
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

export const AchievementsFeed: React.FC<AchievementsFeedProps> = ({
  achievements,
  onNavigateTab,
}) => {
  const [feedFilter, setFeedFilter] = useState<FeedFilter>("feed");
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [modalCategory, setModalCategory] = useState<ModalCategoryFilter>("Todas");
  const [selectedBadgeId, setSelectedBadgeId] = useState<string | null>(null);

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

  return (
    <>
      <section
        aria-label="Conquistas e feed motivacional de progresso"
        className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none p-5 sm:p-6 space-y-5"
      >
        {/* Section Header + Controls */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
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
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
            {visibleItems.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => openBadgeInGallery(item)}
                className={`group text-left rounded-xl p-4 border transition-colors flex flex-col justify-between gap-3.5 cursor-pointer ${
                  item.unlocked
                    ? "bg-[#FFF7ED]/70 dark:bg-[#111115] border-[#FF6B00]/35 hover:border-[#FF6B00]/70"
                    : "bg-[#F8FAFC] dark:bg-[#101013] border-[#E2E8F0] dark:border-[#26262B] hover:border-[#CBD5E1] dark:hover:border-[#3A3A44]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-[1.03] ${getEmblemClasses(
                      item.tier,
                      item.unlocked
                    )}`}
                  >
                    {renderBadgeIcon(item.icon, "w-5 h-5")}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold text-[#0F172A] dark:text-white leading-snug">
                        {item.title}
                      </h3>
                      {item.unlocked ? (
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

                <p className="text-xs text-[#475569] dark:text-[#A1A1AA] leading-relaxed line-clamp-2">
                  {item.description}
                </p>

                <div className="space-y-1.5 pt-2.5 border-t border-[#E2E8F0] dark:border-[#26262B]/80">
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
              </button>
            ))}
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
