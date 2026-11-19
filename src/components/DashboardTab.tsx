import React, { useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Droplets,
  Dumbbell,
  Flame,
  Play,
  RotateCcw,
  Scale,
  Sparkles,
  Trophy,
  Utensils,
} from "lucide-react";
import { WORKOUT_COMBOS } from "../data/exercises";
import {
  AchievementProgressItem,
  BiancoAppState,
  MetabolicResult,
  StudentGoals,
  TabId,
} from "../types";
import { getFirstName } from "../utils/metabolism";
import {
  BIANCO_EASE,
  CARD_HOVER_TRANSITION,
  dashboardContainerVariants,
  dashboardSectionVariants,
  kpiCardVariants,
  kpiGridVariants,
} from "../utils/motion";
import { AchievementsFeed } from "./AchievementsFeed";
import { DashboardCharts } from "./DashboardCharts";
import { GoalSelector } from "./GoalSelector";
import { StudentAvatar } from "./StudentAvatar";

const HERO_IMAGE = "/src/assets/images/bianco_gym_hero_1795053835269.jpg";

interface DashboardTabProps {
  state: BiancoAppState;
  metabolism: MetabolicResult;
  streakDays: number;
  achievements: AchievementProgressItem[];
  onUpdateGoals: (patch: Partial<StudentGoals>) => void;
  onAddWater: (ml: number) => void;
  onResetWater: () => void;
  onStartTodayWorkout: () => void;
  onNavigateTab: (tab: TabId) => void;
}

function getIsoDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export const DashboardTab: React.FC<DashboardTabProps> = ({
  state,
  metabolism,
  streakDays,
  achievements,
  onUpdateGoals,
  onAddWater,
  onResetWater,
  onStartTodayWorkout,
  onNavigateTab,
}) => {
  const [heroImgError, setHeroImgError] = useState(false);

  const activeCombo =
    WORKOUT_COMBOS.find((c) => c.id === state.activeComboId) || WORKOUT_COMBOS[0];

  const waterPct = Math.min(
    100,
    Math.round((state.water.consumedMl / Math.max(1, metabolism.waterTargetMl)) * 100)
  );

  const firstName = getFirstName(state.profile.name);

  const todayDisplay = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date());

  // Weight KPI calculations (current weight, remaining to target, and variation vs initial record)
  const weightStats = useMemo(() => {
    const sorted = [...state.measurements].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    const currentKg =
      sorted.length > 0 ? sorted[sorted.length - 1].weightKg : state.profile.weightKg;
    const targetKg = state.profile.targetWeightKg;
    const diffToGoal = Number((currentKg - targetKg).toFixed(1));
    const deltaFromStart =
      sorted.length >= 2
        ? Number((currentKg - sorted[0].weightKg).toFixed(1))
        : null;

    const absDiff = Math.abs(diffToGoal);
    const goalMessage =
      absDiff < 0.2
        ? "Peso meta atingido!"
        : diffToGoal > 0
        ? `Faltam -${absDiff.toFixed(1)} kg para ${targetKg} kg`
        : `Faltam +${absDiff.toFixed(1)} kg para ${targetKg} kg`;

    return { currentKg, targetKg, diffToGoal, deltaFromStart, goalMessage };
  }, [state.measurements, state.profile.weightKg, state.profile.targetWeightKg]);

  // Weekly volume & workout frequency KPI (rolling 7 days)
  const weeklyStats = useMemo(() => {
    const cutoffIso = getIsoDaysAgo(6);
    const weeklyWorkouts = state.workoutHistory.filter((w) => w.date >= cutoffIso);
    const count = weeklyWorkouts.length;
    const target = state.profile.weeklyFrequency || 4;
    const volumeKg = weeklyWorkouts.reduce(
      (sum, w) => sum + Math.max(0, Math.round(w.totalVolumeKg || 0)),
      0
    );
    const pct = Math.min(100, Math.round((count / Math.max(1, target)) * 100));
    return { count, target, volumeKg, pct };
  }, [state.workoutHistory, state.profile.weeklyFrequency]);

  return (
    <motion.div
      variants={dashboardContainerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 pb-8"
    >
      {/* ROW 1A: Personalized Greeting, Active Goal & Streak Summary */}
      <motion.header
        variants={dashboardSectionVariants}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <motion.button
            type="button"
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.96 }}
            transition={CARD_HOVER_TRANSITION}
            onClick={() => onNavigateTab("perfil")}
            aria-label="Abrir perfil e avaliação física"
            title="Perfil e Avaliação Física"
            className="shrink-0 rounded-2xl focus:outline-none focus:ring-2 focus:ring-[#FF6B00] group cursor-pointer"
          >
            <StudentAvatar
              avatar={state.profile.avatar}
              name={state.profile.name}
              size="md"
              className="group-hover:border-[#FF6B00] transition-colors"
            />
          </motion.button>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#475569] dark:text-[#A1A1AA]">
              <span className="capitalize">{todayDisplay}</span>
              <span aria-hidden="true">·</span>
              <span>{state.profile.level}</span>
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1 text-[#FF6B00] font-semibold font-mono tabular-nums">
                <Trophy className="w-3.5 h-3.5" />
                {streakDays} {streakDays === 1 ? "dia" : "dias"} de streak
              </span>
            </div>

            <h1 className="mt-0.5 text-2xl sm:text-3xl font-extrabold text-[#0F172A] dark:text-white tracking-tight truncate">
              Olá, {firstName}
            </h1>

            <p className="mt-1 text-xs sm:text-sm text-[#475569] dark:text-[#A1A1AA] flex items-center gap-1.5 min-w-0">
              <Flame className="w-3.5 h-3.5 text-[#FF6B00] shrink-0" />
              <span className="truncate">
                <strong className="text-[#0F172A] dark:text-white font-semibold">
                  {state.goals.primary}
                </strong>
                {state.goals.focuses.length > 0 && (
                  <span> · {state.goals.focuses.join(" · ")}</span>
                )}
              </span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            transition={CARD_HOVER_TRANSITION}
            onClick={() => onNavigateTab("perfil")}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#CBD5E1] dark:hover:border-[#3A3A42] text-xs font-semibold text-[#334155] dark:text-[#E4E4E7] hover:text-[#0F172A] dark:hover:text-white shadow-sm dark:shadow-none transition-colors whitespace-nowrap cursor-pointer"
          >
            Perfil & Medidas
          </motion.button>
          <motion.button
            type="button"
            whileTap={{ scale: 0.97 }}
            transition={CARD_HOVER_TRANSITION}
            onClick={() => onNavigateTab("personal")}
            className="min-h-[44px] px-4 py-2 rounded-xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00]/60 text-xs font-semibold text-[#0F172A] dark:text-white shadow-sm dark:shadow-none flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Sparkles className="w-4 h-4 text-[#FF6B00]" />
            <span>Personal IA</span>
          </motion.button>
        </div>
      </motion.header>

      {/* ROW 1B: Primary Focal Anchor — Card Hero "Treino de Hoje" (dark photo scrim for contrast in both themes) */}
      <motion.section
        variants={dashboardSectionVariants}
        aria-label="Treino de hoje"
        className="group relative rounded-2xl overflow-hidden border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00]/45 bg-[#151518] shadow-md dark:shadow-none min-h-[235px] sm:min-h-[260px] flex flex-col justify-end transition-colors duration-200"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-8 top-0 z-20 h-px bg-gradient-to-r from-transparent via-[#FF6B00]/75 to-transparent opacity-60 group-hover:opacity-100 transition-opacity duration-300"
        />

        {!heroImgError ? (
          <img
            src={HERO_IMAGE}
            alt="Sala de musculação moderna Personal Nutri Fit com aparelhos articulados pretos e iluminação âmbar"
            referrerPolicy="no-referrer"
            onError={() => setHeroImgError(true)}
            className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-[1.02]"
          />
        ) : (
          <div className="absolute inset-0 bg-gradient-to-br from-[#1C1C21] via-[#151518] to-[#0B0B0D]" />
        )}

        <div
          aria-hidden="true"
          className="absolute inset-0 bg-gradient-to-t from-[#0B0B0D] via-[#0B0B0D]/80 to-[#0B0B0D]/25"
        />

        <div className="relative z-10 p-5 sm:p-7 flex flex-col lg:flex-row lg:items-end justify-between gap-5">
          <div className="max-w-xl">
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#D4D4D8]">
              <span className="text-[#FF6B00] font-semibold">Treino de hoje</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">
                {activeCombo.exerciseIds.length} exercícios
              </span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">~{activeCombo.durationMin} min</span>
              {state.savedPlan && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-orange-300">Ficha IA salva disponível</span>
                </>
              )}
            </div>

            <h2 className="mt-2 text-2xl sm:text-4xl font-extrabold text-white tracking-tight">
              {activeCombo.title}
            </h2>
            <p className="mt-1.5 text-sm sm:text-base text-[#D4D4D8] leading-relaxed">
              {activeCombo.subtitle}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-3 shrink-0">
            <motion.button
              type="button"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
              transition={CARD_HOVER_TRANSITION}
              onClick={onStartTodayWorkout}
              className="min-h-[48px] px-6 py-3 rounded-xl bg-[#FF6B00] hover:bg-[#F97316] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#FF6B00]/25 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Iniciar Treino Agora</span>
            </motion.button>
          </div>
        </div>
      </motion.section>

      {/* ROW 2: 4 Professional KPI Cards */}
      <motion.section
        variants={kpiGridVariants}
        aria-label="Indicadores rápidos do dia"
        className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4"
      >
        {/* KPI 1: Peso Atual vs. Meta */}
        <motion.div
          variants={kpiCardVariants}
          whileHover={{ y: -2 }}
          transition={CARD_HOVER_TRANSITION}
          className="group relative overflow-hidden rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00]/45 hover:bg-[#FFFBF7] dark:hover:bg-[#17171B] shadow-sm dark:shadow-none transition-colors duration-200 p-5 flex flex-col justify-between"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-[#FF6B00]/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          />

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#475569] dark:text-[#A1A1AA]">
              Peso atual vs. meta
            </span>
            <Scale className="w-4 h-4 text-[#FF6B00]" />
          </div>

          <div className="mt-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-mono text-3xl font-bold tabular-nums text-[#0F172A] dark:text-white">
                {weightStats.currentKg.toFixed(1)}
                <span className="text-sm font-normal text-[#475569] dark:text-[#A1A1AA] ml-1">
                  kg
                </span>
              </p>

              {weightStats.deltaFromStart !== null && (
                <span
                  className={`inline-flex items-center gap-0.5 font-mono text-xs font-semibold tabular-nums ${
                    weightStats.deltaFromStart <= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-[#EA580C] dark:text-orange-300"
                  }`}
                >
                  {weightStats.deltaFromStart <= 0 ? (
                    <ArrowDownRight className="w-3.5 h-3.5" />
                  ) : (
                    <ArrowUpRight className="w-3.5 h-3.5" />
                  )}
                  {weightStats.deltaFromStart > 0 ? "+" : ""}
                  {weightStats.deltaFromStart.toFixed(1)} kg
                </span>
              )}
            </div>

            <p className="mt-1 text-xs text-[#475569] dark:text-[#A1A1AA] font-mono tabular-nums">
              {weightStats.goalMessage} · IMC {metabolism.bmi.toFixed(1)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab("evolucao")}
            className="group/cta mt-4 pt-3 border-t border-[#E2E8F0] dark:border-[#26262B] text-xs font-semibold text-[#FF6B00] hover:text-[#EA580C] dark:hover:text-orange-300 flex items-center justify-between transition-colors cursor-pointer"
          >
            <span>Atualizar pesagem</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover/cta:translate-x-0.5" />
          </button>
        </motion.div>

        {/* KPI 2: Meta Calórica & Proteína */}
        <motion.div
          variants={kpiCardVariants}
          whileHover={{ y: -2 }}
          transition={CARD_HOVER_TRANSITION}
          className="group relative overflow-hidden rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00]/45 hover:bg-[#FFFBF7] dark:hover:bg-[#17171B] shadow-sm dark:shadow-none transition-colors duration-200 p-5 flex flex-col justify-between"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-[#FF6B00]/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          />

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#475569] dark:text-[#A1A1AA]">
              Meta calórica e proteína
            </span>
            <Utensils className="w-4 h-4 text-[#FF6B00]" />
          </div>

          <div className="mt-3">
            <div className="flex items-baseline gap-2.5 flex-wrap">
              <p className="font-mono text-3xl font-bold tabular-nums text-[#0F172A] dark:text-white">
                {metabolism.calorieTarget}
                <span className="text-sm font-normal text-[#475569] dark:text-[#A1A1AA] ml-1">
                  kcal
                </span>
              </p>
              <span className="font-mono text-sm font-bold tabular-nums text-[#FF6B00]">
                · {metabolism.proteinG}g prot
              </span>
            </div>
            <p className="mt-1 text-xs text-[#475569] dark:text-[#A1A1AA] font-mono tabular-nums">
              Déficit -{metabolism.deficitKcal} kcal · Carb {metabolism.carbsG}g · Gord{" "}
              {metabolism.fatG}g
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab("nutri")}
            className="group/cta mt-4 pt-3 border-t border-[#E2E8F0] dark:border-[#26262B] text-xs font-semibold text-[#FF6B00] hover:text-[#EA580C] dark:hover:text-orange-300 flex items-center justify-between transition-colors cursor-pointer"
          >
            <span>Abrir Nutri IA</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover/cta:translate-x-0.5" />
          </button>
        </motion.div>

        {/* KPI 3: Hidratação do Dia */}
        <motion.div
          variants={kpiCardVariants}
          whileHover={{ y: -2 }}
          transition={CARD_HOVER_TRANSITION}
          className="group relative overflow-hidden rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00]/45 hover:bg-[#FFFBF7] dark:hover:bg-[#17171B] shadow-sm dark:shadow-none transition-colors duration-200 p-5 flex flex-col justify-between"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-[#FF6B00]/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          />

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#475569] dark:text-[#A1A1AA]">
              Hidratação do dia
            </span>
            <button
              type="button"
              onClick={onResetWater}
              title="Zerar água de hoje"
              aria-label="Zerar contador de água"
              className="text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white transition-colors cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="mt-2.5">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-mono text-2xl font-bold tabular-nums text-[#0F172A] dark:text-white">
                {(state.water.consumedMl / 1000).toFixed(2)}
                <span className="text-xs font-normal text-[#475569] dark:text-[#A1A1AA] ml-1">
                  / {(metabolism.waterTargetMl / 1000).toFixed(2)} L
                </span>
              </p>
              <span className="font-mono text-xs font-semibold tabular-nums text-[#FF6B00]">
                {waterPct}%
              </span>
            </div>

            <div className="mt-2 h-2 w-full rounded-full bg-[#E2E8F0] dark:bg-[#26262B] overflow-hidden">
              <motion.div
                className="h-full w-full origin-left rounded-full bg-gradient-to-r from-[#FF6B00] to-[#F97316]"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: Math.max(0, Math.min(1, waterPct / 100)) }}
                transition={{ duration: 0.45, ease: BIANCO_EASE }}
              />
            </div>
          </div>

          <div className="mt-3.5 grid grid-cols-2 gap-2">
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              transition={CARD_HOVER_TRANSITION}
              onClick={() => onAddWater(250)}
              className="min-h-[40px] rounded-xl bg-[#F1F5F9] dark:bg-[#1C1C21] hover:bg-[#E2E8F0] dark:hover:bg-[#232329] border border-[#E2E8F0] dark:border-[#26262B] text-xs font-semibold text-[#0F172A] dark:text-white flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Droplets className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span className="font-mono tabular-nums">+250ml</span>
            </motion.button>
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              transition={CARD_HOVER_TRANSITION}
              onClick={() => onAddWater(500)}
              className="min-h-[40px] rounded-xl bg-[#FF6B00]/12 dark:bg-[#FF6B00]/15 hover:bg-[#FF6B00]/20 dark:hover:bg-[#FF6B00]/25 border border-[#FF6B00]/40 text-xs font-semibold text-[#EA580C] dark:text-[#FF6B00] flex items-center justify-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Droplets className="w-3.5 h-3.5" />
              <span className="font-mono tabular-nums">+500ml</span>
            </motion.button>
          </div>
        </motion.div>

        {/* KPI 4: Volume Semanal */}
        <motion.div
          variants={kpiCardVariants}
          whileHover={{ y: -2 }}
          transition={CARD_HOVER_TRANSITION}
          className="group relative overflow-hidden rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00]/45 hover:bg-[#FFFBF7] dark:hover:bg-[#17171B] shadow-sm dark:shadow-none transition-colors duration-200 p-5 flex flex-col justify-between"
        >
          <span
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-5 top-0 h-px bg-gradient-to-r from-transparent via-[#FF6B00]/70 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"
          />

          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#475569] dark:text-[#A1A1AA]">
              Volume semanal
            </span>
            <Dumbbell className="w-4 h-4 text-[#FF6B00]" />
          </div>

          <div className="mt-3">
            <div className="flex items-baseline justify-between gap-2">
              <p className="font-mono text-3xl font-bold tabular-nums text-[#0F172A] dark:text-white">
                {weeklyStats.count}
                <span className="text-sm font-normal text-[#475569] dark:text-[#A1A1AA]">
                  /{weeklyStats.target} treinos
                </span>
              </p>
              <span className="font-mono text-xs font-semibold tabular-nums text-[#FF6B00]">
                {weeklyStats.pct}%
              </span>
            </div>

            <div className="mt-2 h-1.5 w-full rounded-full bg-[#E2E8F0] dark:bg-[#26262B] overflow-hidden">
              <motion.div
                className="h-full w-full origin-left rounded-full bg-gradient-to-r from-[#FF6B00] to-[#F97316]"
                initial={{ scaleX: 0 }}
                animate={{ scaleX: Math.max(0, Math.min(1, weeklyStats.pct / 100)) }}
                transition={{ duration: 0.45, ease: BIANCO_EASE }}
              />
            </div>

            <p className="mt-1.5 text-xs text-[#475569] dark:text-[#A1A1AA] font-mono tabular-nums">
              Volume 7d:{" "}
              <span className="text-[#0F172A] dark:text-white font-semibold">
                {weeklyStats.volumeKg.toLocaleString("pt-BR")} kg
              </span>
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab("treinos")}
            className="group/cta mt-4 pt-3 border-t border-[#E2E8F0] dark:border-[#26262B] text-xs font-semibold text-[#FF6B00] hover:text-[#EA580C] dark:hover:text-orange-300 flex items-center justify-between transition-colors cursor-pointer"
          >
            <span>Abrir treinos</span>
            <ArrowRight className="w-3.5 h-3.5 transition-transform duration-200 group-hover/cta:translate-x-0.5" />
          </button>
        </motion.div>
      </motion.section>

      {/* ROW 3: 4 Professional Responsive Recharts Analytics */}
      <DashboardCharts
        state={state}
        metabolism={metabolism}
        onNavigateTab={onNavigateTab}
      />

      {/* ROW 4: Motivational Progress Feed — Badges & Conquistas */}
      <motion.div variants={dashboardSectionVariants}>
        <AchievementsFeed
          achievements={achievements}
          onNavigateTab={onNavigateTab}
        />
      </motion.div>

      {/* ROW 5: Goal Selector ("O que você deseja alcançar?") */}
      <motion.div variants={dashboardSectionVariants}>
        <GoalSelector goals={state.goals} onUpdateGoals={onUpdateGoals} />
      </motion.div>
    </motion.div>
  );
};

