import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BarChart3,
  Bell,
  BellOff,
  Camera,
  CheckCircle2,
  Clock,
  Droplets,
  Dumbbell,
  Lightbulb,
  Play,
  RefreshCw,
  RotateCcw,
  Scale,
  Sparkles,
  Target,
  Trophy,
  Utensils,
  Volume2,
  VolumeX,
} from "lucide-react";
import { WORKOUT_COMBOS } from "../data/exercises";
import {
  AchievementProgressItem,
  BiancoAppState,
  MetabolicResult,
  StudentGoals,
  TabId,
  WaterReminderIntervalMin,
  WaterReminderSettings,
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
import { HydrationMascotBadge } from "./HydrationAvatar";
import { StudentAvatar } from "./StudentAvatar";
import { WeeklyPerformanceSummaryCard } from "./WeeklyPerformanceSummaryCard";

const HERO_IMAGE = "/src/assets/images/bianco_gym_hero_1795053835269.jpg";

type DashboardHubTab = "graficos" | "resumo_ia" | "conquistas" | "objetivo";

interface DailyTipItem {
  id: string;
  category: "Musculação" | "Nutrição";
  title: string;
  tip: string;
}

const DAILY_TIPS_CATALOG: DailyTipItem[] = [
  {
    id: "tip_cadence",
    category: "Musculação",
    title: "Controle a fase de descida",
    tip: "Descer a carga em 2 a 3 segundos controlados gera mais resultado muscular e protege suas articulações.",
  },
  {
    id: "tip_protein_meals",
    category: "Nutrição",
    title: "Proteína distribuída no dia",
    tip: "Dividir sua meta de proteínas em 3 a 5 refeições mantém a síntese muscular ativa e controla a fome.",
  },
  {
    id: "tip_progressive_overload",
    category: "Musculação",
    title: "Progrida aos poucos",
    tip: "Fazer +1 repetição limpa ou melhorar a amplitude já conta como evolução real em relação ao último treino.",
  },
  {
    id: "tip_hydration_strength",
    category: "Nutrição",
    title: "Água é força no treino",
    tip: "Beba 500 ml de água antes de treinar: até uma leve desidratação reduz sua força e aumenta o cansaço.",
  },
  {
    id: "tip_sleep_hypertrophy",
    category: "Musculação",
    title: "O músculo cresce no descanso",
    tip: "O treino dá o estímulo, mas a recuperação acontece no sono profundo. Busque dormir de 7h a 8h por noite.",
  },
  {
    id: "tip_preworkout_carbs",
    category: "Nutrição",
    title: "Energia antes da academia",
    tip: "Consumir carboidratos leves (banana, aveia ou pão integral) 60 a 90 min antes evita queda de rendimento.",
  },
  {
    id: "tip_core_bracing",
    category: "Musculação",
    title: "Proteja sua lombar",
    tip: "Antes de agachar ou remar, firme o abdômen mantendo a coluna neutra durante toda a série.",
  },
  {
    id: "tip_fiber_satiety",
    category: "Nutrição",
    title: "Mais saciedade nas refeições",
    tip: "Começar almoço e jantar por folhas, legumes e proteína magra ajuda a controlar o apetite no déficit.",
  },
  {
    id: "tip_mind_muscle",
    category: "Musculação",
    title: "Sinta o músculo trabalhar",
    tip: "Foque na contração do músculo alvo a cada repetição em vez de apenas mover o peso no automático.",
  },
  {
    id: "tip_consistency_8020",
    category: "Nutrição",
    title: "Constância vence perfeição",
    tip: "Saiu do plano em uma refeição? Apenas volte normalmente na próxima sem culpa e mantenha o ritmo.",
  },
  {
    id: "tip_joint_warmup",
    category: "Musculação",
    title: "Aqueça antes da primeira carga",
    tip: "5 minutos de mobilidade e 1 série leve lubrificam joelhos e ombros e previnem lesões.",
  },
  {
    id: "tip_breathing_effort",
    category: "Musculação",
    title: "Respire a favor da força",
    tip: "Inspire ao descer o peso e solte o ar no momento de maior esforço sem prender a respiração.",
  },
];

function getDailyTipIndexForDate(date: Date): number {
  const utcMidnight = Date.UTC(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
  const daysSinceEpoch = Math.floor(utcMidnight / 86400000);
  return Math.abs(daysSinceEpoch) % DAILY_TIPS_CATALOG.length;
}

const WATER_REMINDER_INTERVALS: {
  value: WaterReminderIntervalMin;
  label: string;
}[] = [
  { value: 30, label: "30m" },
  { value: 45, label: "45m" },
  { value: 60, label: "1h" },
  { value: 90, label: "1h30" },
  { value: 120, label: "2h" },
];

interface DashboardTabProps {
  state: BiancoAppState;
  metabolism: MetabolicResult;
  streakDays: number;
  achievements: AchievementProgressItem[];
  onUpdateGoals: (patch: Partial<StudentGoals>) => void;
  onAddWater: (ml: number) => void;
  onResetWater: () => void;
  onUpdateWaterReminder: (patch: Partial<WaterReminderSettings>) => void;
  onTriggerWaterReminderTest: () => void;
  onCelebrateMedal?: (payload: {
    id: string;
    tier: "bronze" | "silver" | "gold";
    title: string;
    subtitle: string;
    lostKg?: number;
  }) => void;
  onToast: (message: string, tone?: "success" | "info" | "warning") => void;
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
  onUpdateWaterReminder,
  onTriggerWaterReminderTest,
  onToast,
  onStartTodayWorkout,
  onNavigateTab,
}) => {
  const [heroImgError, setHeroImgError] = useState(false);
  const [showWaterSettings, setShowWaterSettings] = useState(false);
  const [activeHubTab, setActiveHubTab] = useState<DashboardHubTab>("graficos");
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [tipOffset, setTipOffset] = useState(0);
  const hubSectionRef = useRef<HTMLDivElement | null>(null);

  const dailyTipInfo = useMemo(() => {
    const todayDate = new Date(nowTick);
    const baseIdx = getDailyTipIndexForDate(todayDate);
    const activeIdx = (baseIdx + tipOffset) % DAILY_TIPS_CATALOG.length;
    return DAILY_TIPS_CATALOG[activeIdx];
  }, [nowTick, tipOffset]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNowTick(Date.now());
    }, 30000);
    return () => window.clearInterval(id);
  }, []);

  const reminder = state.waterReminder || {
    enabled: true,
    intervalMin: 60,
    startHour: 8,
    endHour: 22,
    soundEnabled: true,
    browserNotificationEnabled: false,
    lastRemindedAt: null,
  };

  const nextReminderText = useMemo(() => {
    if (!reminder.enabled) return "Lembrete pausado";
    if (state.water.consumedMl >= metabolism.waterTargetMl) {
      return "Meta de água concluída!";
    }
    const nowDate = new Date(nowTick);
    const currentHour = nowDate.getHours();
    if (currentHour < reminder.startHour || currentHour >= reminder.endHour) {
      return `Retorna às ${String(reminder.startHour).padStart(2, "0")}:00`;
    }
    const baseTime = reminder.lastRemindedAt || nowTick;
    const nextAt = baseTime + reminder.intervalMin * 60 * 1000;
    const diffMin = Math.max(1, Math.ceil((nextAt - nowTick) / 60000));
    return `Próximo aviso em ${diffMin} min`;
  }, [reminder, nowTick, state.water.consumedMl, metabolism.waterTargetMl]);

  const handleToggleBrowserNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      onToast(
        "Seu navegador não suporta notificações nativas, mas o aviso sonoro no app continua ativo.",
        "info"
      );
      return;
    }
    if (reminder.browserNotificationEnabled) {
      onUpdateWaterReminder({ browserNotificationEnabled: false });
      onToast("Notificações do navegador desativadas.", "info");
      return;
    }
    if (Notification.permission === "granted") {
      onUpdateWaterReminder({ browserNotificationEnabled: true });
      onToast("Notificações do navegador ativadas!", "success");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        onUpdateWaterReminder({ browserNotificationEnabled: true });
        onToast("Permissão concedida para alertas de hidratação!", "success");
      } else {
        onToast(
          "Permissão negada no navegador. O alerta dentro do app segue ativo.",
          "warning"
        );
      }
    } catch {
      onToast("O alerta dentro do app segue ativo!", "info");
    }
  };

  const activeCombo =
    WORKOUT_COMBOS.find((c) => c.id === state.activeComboId) || WORKOUT_COMBOS[0];

  const targetExerciseCount = Math.max(
    activeCombo.exerciseIds.length,
    state.profile.exercisesPerWorkout ?? activeCombo.exerciseIds.length
  );

  const waterPct = Math.min(
    100,
    Math.round(
      (state.water.consumedMl / Math.max(1, metabolism.waterTargetMl)) * 100
    )
  );

  const firstName = getFirstName(state.profile.name);

  const todayDisplay = new Intl.DateTimeFormat("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(new Date());

  const weightStats = useMemo(() => {
    const sorted = [...state.measurements].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    const currentKg =
      sorted.length > 0
        ? sorted[sorted.length - 1].weightKg
        : state.profile.weightKg;
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

    return { currentKg, targetKg, deltaFromStart, goalMessage };
  }, [state.measurements, state.profile.weightKg, state.profile.targetWeightKg]);

  const weeklyStats = useMemo(() => {
    const cutoffIso = getIsoDaysAgo(6);
    const weeklyWorkouts = state.workoutHistory.filter(
      (w) => w.date >= cutoffIso
    );
    const count = weeklyWorkouts.length;
    const target = state.profile.weeklyFrequency || 4;
    const volumeKg = weeklyWorkouts.reduce(
      (sum, w) => sum + Math.max(0, Math.round(w.totalVolumeKg || 0)),
      0
    );
    const pct = Math.min(100, Math.round((count / Math.max(1, target)) * 100));
    return { count, target, volumeKg, pct };
  }, [state.workoutHistory, state.profile.weeklyFrequency]);

  const unlockedAchievementsCount = useMemo(
    () => achievements.filter((a) => a.unlocked).length,
    [achievements]
  );

  const openHubTab = (tab: DashboardHubTab) => {
    setActiveHubTab(tab);
    window.setTimeout(() => {
      hubSectionRef.current?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }, 60);
  };

  return (
    <motion.div
      variants={dashboardContainerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-6 pb-8"
    >
      {/* 1. CLEAN GREETING HEADER */}
      <motion.header
        variants={dashboardSectionVariants}
        className="flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3.5 min-w-0">
          <button
            type="button"
            onClick={() => onNavigateTab("perfil")}
            aria-label="Abrir perfil e medidas"
            className="shrink-0 rounded-2xl focus:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00] group cursor-pointer"
          >
            <StudentAvatar
              avatar={state.profile.avatar}
              name={state.profile.name}
              size="md"
              className="group-hover:border-[#FF6B00] transition-colors"
            />
          </button>

          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#64748B] dark:text-[#A1A1AA]">
              <span className="capitalize">{todayDisplay}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums text-[#FF6B00] font-semibold">
                {streakDays} {streakDays === 1 ? "dia" : "dias"} seguidos
              </span>
            </div>
            <h1 className="mt-0.5 text-2xl sm:text-3xl font-extrabold text-[#0F172A] dark:text-white tracking-tight truncate">
              Olá, {firstName}
            </h1>
            <p className="text-xs sm:text-sm text-[#475569] dark:text-[#A1A1AA] truncate">
              Objetivo:{" "}
              <strong className="font-semibold text-[#0F172A] dark:text-white">
                {state.goals.primary}
              </strong>
            </p>
          </div>
        </div>

        {/* Single Clear Secondary Shortcut: Weekly AI Summary */}
        <button
          type="button"
          onClick={() => openHubTab("resumo_ia")}
          className="min-h-[42px] px-4 py-2 rounded-xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00]/60 text-xs font-bold text-[#0F172A] dark:text-white flex items-center gap-2 self-start sm:self-auto shrink-0 whitespace-nowrap transition-colors cursor-pointer"
        >
          <Sparkles className="w-4 h-4 text-[#FF6B00]" />
          <span>Resumo Semanal IA</span>
        </button>
      </motion.header>

      {/* 2. PRIMARY FOCUS AREA: TODAY'S WORKOUT (LEFT) + HYDRATION & QUICK SHORTCUTS (RIGHT) */}
      <motion.section
        variants={dashboardSectionVariants}
        aria-label="Ações principais do dia"
        className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch"
      >
        {/* Left (8 cols): Dominant Focal Anchor — Treino de Hoje */}
        <div className="lg:col-span-8 group relative rounded-2xl overflow-hidden border border-[#E2E8F0] dark:border-[#26262B] bg-[#151518] min-h-[260px] flex flex-col justify-end">
          {!heroImgError ? (
            <img
              src={HERO_IMAGE}
              alt="Sala de musculação Personal Nutri Fit"
              referrerPolicy="no-referrer"
              onError={() => setHeroImgError(true)}
              className="absolute inset-0 w-full h-full object-cover object-center transition-transform duration-500 ease-out group-hover:scale-[1.02]"
            />
          ) : (
            <div className="absolute inset-0 bg-gradient-to-br from-[#1C1C21] via-[#151518] to-[#0B0B0D]" />
          )}

          <div
            aria-hidden="true"
            className="absolute inset-0 bg-gradient-to-t from-[#0B0B0D] via-[#0B0B0D]/80 to-[#0B0B0D]/30"
          />

          <div className="relative z-10 p-6 sm:p-7 flex flex-col justify-end gap-5">
            <div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#D4D4D8]">
                <span className="text-[#FF6B00] font-semibold">
                  Seu treino de hoje
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {targetExerciseCount} exercícios
                </span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  ~{activeCombo.durationMin} min
                </span>
              </div>

              <h2 className="mt-2 text-2xl sm:text-3xl font-extrabold text-white tracking-tight text-balance">
                {activeCombo.title}
              </h2>
              <p className="mt-1 text-sm text-[#D4D4D8] max-w-xl leading-relaxed">
                {activeCombo.subtitle}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <motion.button
                type="button"
                whileHover={{ y: -1 }}
                whileTap={{ scale: 0.98 }}
                transition={CARD_HOVER_TRANSITION}
                onClick={onStartTodayWorkout}
                className="min-h-[46px] px-6 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#F97316] text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-[#FF6B00]/25 transition-colors whitespace-nowrap cursor-pointer"
              >
                <Play className="w-4 h-4 fill-current" />
                <span>Iniciar Treino Agora</span>
              </motion.button>

              <button
                type="button"
                onClick={() => onNavigateTab("treinos")}
                className="min-h-[46px] px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-sm border border-white/20 text-white text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer"
              >
                Trocar treino
              </button>
            </div>
          </div>
        </div>

        {/* Right (4 cols): Hydration + 3 Clean Direct Shortcuts */}
        <div className="lg:col-span-4 rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] p-5 flex flex-col justify-between gap-5">
          {/* Hydration Quick Control */}
          <div className="space-y-3">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Droplets className="w-4 h-4 text-[#FF6B00]" />
                <h2 className="text-sm font-bold text-[#0F172A] dark:text-white">
                  Água hoje
                </h2>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowWaterSettings((prev) => !prev)}
                  className="text-xs font-semibold text-[#FF6B00] hover:text-[#EA580C] transition-colors cursor-pointer whitespace-nowrap"
                >
                  {showWaterSettings ? "Fechar lembrete" : "Lembrete"}
                </button>
                <button
                  type="button"
                  onClick={onResetWater}
                  title="Zerar água de hoje"
                  aria-label="Zerar contador de água"
                  className="text-[#64748B] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <div>
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-mono text-2xl font-bold tabular-nums text-[#0F172A] dark:text-white">
                  {(state.water.consumedMl / 1000).toFixed(2)}
                  <span className="text-xs font-normal text-[#64748B] dark:text-[#A1A1AA] ml-1">
                    / {(metabolism.waterTargetMl / 1000).toFixed(2)} L
                  </span>
                </p>
                <span className="font-mono text-xs font-bold tabular-nums text-[#FF6B00]">
                  {waterPct}%
                </span>
              </div>

              <div className="mt-2 h-2 w-full rounded-full bg-[#E2E8F0] dark:bg-[#26262B] overflow-hidden">
                <motion.div
                  className="h-full w-full origin-left rounded-full bg-[#FF6B00]"
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: Math.max(0, Math.min(1, waterPct / 100)) }}
                  transition={{ duration: 0.4, ease: BIANCO_EASE }}
                />
              </div>

              <p className="mt-1.5 text-[11px] text-[#64748B] dark:text-[#A1A1AA] flex items-center gap-1">
                <Clock className="w-3 h-3 text-[#FF6B00] shrink-0" />
                <span className="truncate">{nextReminderText}</span>
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onAddWater(250)}
                className="min-h-[40px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] hover:bg-[#F1F5F9] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] text-xs font-mono font-bold tabular-nums text-[#0F172A] dark:text-white transition-colors cursor-pointer"
              >
                +250 ml
              </button>
              <button
                type="button"
                onClick={() => onAddWater(500)}
                className="min-h-[40px] rounded-xl bg-[#FF6B00]/12 hover:bg-[#FF6B00]/20 border border-[#FF6B00]/35 text-xs font-mono font-bold tabular-nums text-[#EA580C] dark:text-[#FF6B00] transition-colors cursor-pointer"
              >
                +500 ml
              </button>
            </div>
          </div>

          {/* 3 Clean One-Tap Shortcuts */}
          <div className="pt-4 border-t border-[#E2E8F0] dark:border-[#26262B] space-y-1.5">
            <span className="block text-[11px] font-semibold text-[#64748B] dark:text-[#A1A1AA] mb-2">
              Acesso rápido
            </span>

            {[
              {
                tab: "personal" as TabId,
                icon: Sparkles,
                title: "Personal IA",
                desc: "Montar ou adaptar treino",
              },
              {
                tab: "nutri" as TabId,
                icon: Utensils,
                title: "Nutri IA",
                desc: "Cardápio e lista de compras",
              },
              {
                tab: "evolucao" as TabId,
                icon: Camera,
                title: "Fotos & Medidas IA",
                desc: "Frente, lado, costas e peso",
              },
            ].map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.tab}
                  type="button"
                  onClick={() => onNavigateTab(item.tab)}
                  className="w-full min-h-[42px] px-3 py-2 rounded-xl hover:bg-[#F8FAFC] dark:hover:bg-[#1C1C21] flex items-center justify-between gap-2 text-left transition-colors group cursor-pointer"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <Icon className="w-4 h-4 text-[#FF6B00] shrink-0" />
                    <div className="min-w-0">
                      <span className="block text-xs font-bold text-[#0F172A] dark:text-white leading-tight">
                        {item.title}
                      </span>
                      <span className="block text-[11px] text-[#64748B] dark:text-[#A1A1AA] truncate">
                        {item.desc}
                      </span>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[#94A3B8] group-hover:text-[#FF6B00] group-hover:translate-x-0.5 transition-all shrink-0" />
                </button>
              );
            })}
          </div>
        </div>
      </motion.section>

      {/* EXPANDABLE WATER REMINDER SETTINGS DRAWER (only shown when user clicks "Lembrete") */}
      {showWaterSettings && (
        <section
          aria-label="Configurações do lembrete de água"
          className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] p-5 space-y-4"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <HydrationMascotBadge
                size="md"
                active={reminder.enabled}
                onClick={onTriggerWaterReminderTest}
                title="Testar alerta visual e sonoro"
              />
              <div>
                <h3 className="text-sm font-bold text-[#0F172A] dark:text-white">
                  Lembrete para Beber Água
                </h3>
                <p className="text-xs text-[#64748B] dark:text-[#A1A1AA]">
                  {reminder.enabled ? "Ativo" : "Pausado"} · {nextReminderText}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() =>
                  onUpdateWaterReminder({
                    enabled: !reminder.enabled,
                    lastRemindedAt: Date.now(),
                  })
                }
                className={`min-h-[38px] px-3.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-colors cursor-pointer ${
                  reminder.enabled
                    ? "bg-[#FF6B00] border-[#FF6B00] text-white"
                    : "bg-[#F8FAFC] dark:bg-[#0B0B0D] border-[#E2E8F0] dark:border-[#26262B] text-[#0F172A] dark:text-white"
                }`}
              >
                {reminder.enabled ? (
                  <Bell className="w-3.5 h-3.5" />
                ) : (
                  <BellOff className="w-3.5 h-3.5" />
                )}
                <span>{reminder.enabled ? "Ligado" : "Ativar"}</span>
              </button>

              <button
                type="button"
                onClick={onTriggerWaterReminderTest}
                className="min-h-[38px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00] text-xs font-semibold text-[#0F172A] dark:text-white transition-colors cursor-pointer"
              >
                Testar alerta
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 pt-3 border-t border-[#E2E8F0] dark:border-[#26262B] items-end">
            <div className="md:col-span-5">
              <span className="block text-xs font-semibold text-[#475569] dark:text-[#A1A1AA] mb-1.5">
                Intervalo dos avisos
              </span>
              <div className="flex flex-wrap gap-1.5">
                {WATER_REMINDER_INTERVALS.map((item) => {
                  const active = reminder.intervalMin === item.value;
                  return (
                    <button
                      key={item.value}
                      type="button"
                      onClick={() => {
                        onUpdateWaterReminder({
                          enabled: true,
                          intervalMin: item.value,
                          lastRemindedAt: Date.now(),
                        });
                        onToast(
                          `Lembrete ajustado para cada ${item.label}.`,
                          "info"
                        );
                      }}
                      className={`min-h-[36px] px-3 rounded-lg text-xs font-mono font-bold border transition-colors cursor-pointer ${
                        active
                          ? "bg-[#FF6B00]/15 border-[#FF6B00] text-[#FF6B00]"
                          : "bg-[#F8FAFC] dark:bg-[#0B0B0D] border-[#E2E8F0] dark:border-[#26262B] text-[#475569] dark:text-[#A1A1AA]"
                      }`}
                    >
                      {item.label}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="md:col-span-3 grid grid-cols-2 gap-2">
              <div>
                <label
                  htmlFor="dash-water-start"
                  className="block text-[11px] font-semibold text-[#475569] dark:text-[#A1A1AA] mb-1"
                >
                  Início
                </label>
                <select
                  id="dash-water-start"
                  value={reminder.startHour}
                  onChange={(e) => {
                    const nextStart = Number(e.target.value);
                    onUpdateWaterReminder({
                      startHour: nextStart,
                      endHour: Math.max(nextStart + 1, reminder.endHour),
                    });
                  }}
                  className="w-full min-h-[38px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] px-2.5 font-mono text-xs text-[#0F172A] dark:text-white"
                >
                  {Array.from({ length: 18 }, (_, i) => i + 5).map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label
                  htmlFor="dash-water-end"
                  className="block text-[11px] font-semibold text-[#475569] dark:text-[#A1A1AA] mb-1"
                >
                  Término
                </label>
                <select
                  id="dash-water-end"
                  value={reminder.endHour}
                  onChange={(e) =>
                    onUpdateWaterReminder({ endHour: Number(e.target.value) })
                  }
                  className="w-full min-h-[38px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] px-2.5 font-mono text-xs text-[#0F172A] dark:text-white"
                >
                  {Array.from({ length: 18 }, (_, i) => i + 6)
                    .filter((h) => h > reminder.startHour)
                    .map((h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, "0")}:00
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="md:col-span-4 flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() =>
                  onUpdateWaterReminder({ soundEnabled: !reminder.soundEnabled })
                }
                className="flex-1 min-h-[38px] px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] text-xs font-semibold text-[#0F172A] dark:text-white flex items-center justify-center gap-1.5 cursor-pointer"
              >
                {reminder.soundEnabled ? (
                  <Volume2 className="w-3.5 h-3.5 text-[#FF6B00]" />
                ) : (
                  <VolumeX className="w-3.5 h-3.5 text-[#64748B]" />
                )}
                <span>Som {reminder.soundEnabled ? "ON" : "OFF"}</span>
              </button>
              <button
                type="button"
                onClick={() => void handleToggleBrowserNotifications()}
                className="flex-1 min-h-[38px] px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] text-xs font-semibold text-[#0F172A] dark:text-white flex items-center justify-center gap-1.5 cursor-pointer"
              >
                <CheckCircle2
                  className={`w-3.5 h-3.5 ${
                    reminder.browserNotificationEnabled
                      ? "text-emerald-500"
                      : "text-[#64748B]"
                  }`}
                />
                <span>
                  Navegador {reminder.browserNotificationEnabled ? "ON" : "OFF"}
                </span>
              </button>
            </div>
          </div>
        </section>
      )}

      {/* 3. CLEAN 3-CARD SUMMARY ROW (ONLY THE 3 ESSENTIAL METRICS) */}
      <motion.section
        variants={kpiGridVariants}
        aria-label="Resumo rápido de hoje"
        className="grid grid-cols-1 sm:grid-cols-3 gap-4"
      >
        {/* Metric 1: Peso Atual */}
        <motion.div
          variants={kpiCardVariants}
          className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] p-5 flex flex-col justify-between gap-4"
        >
          <div>
            <div className="flex items-center justify-between gap-2 text-xs text-[#64748B] dark:text-[#A1A1AA]">
              <span className="font-medium">Peso atual</span>
              <Scale className="w-4 h-4 text-[#FF6B00]" />
            </div>

            <div className="mt-2.5 flex items-baseline justify-between gap-2">
              <p className="font-mono text-3xl font-bold tabular-nums text-[#0F172A] dark:text-white">
                {weightStats.currentKg.toFixed(1)}
                <span className="text-sm font-normal text-[#64748B] dark:text-[#A1A1AA] ml-1">
                  kg
                </span>
              </p>

              {weightStats.deltaFromStart !== null && (
                <span
                  className={`inline-flex items-center gap-0.5 font-mono text-xs font-semibold tabular-nums ${
                    weightStats.deltaFromStart <= 0
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-[#FF6B00]"
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

            <p className="mt-1 text-xs text-[#64748B] dark:text-[#A1A1AA] font-mono tabular-nums">
              {weightStats.goalMessage} · IMC {metabolism.bmi.toFixed(1)}
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab("evolucao")}
            className="pt-3 border-t border-[#E2E8F0] dark:border-[#26262B] text-xs font-semibold text-[#FF6B00] hover:text-[#EA580C] flex items-center justify-between transition-colors cursor-pointer"
          >
            <span>Atualizar peso e fotos</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </motion.div>

        {/* Metric 2: Alimentação Hoje */}
        <motion.div
          variants={kpiCardVariants}
          className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] p-5 flex flex-col justify-between gap-4"
        >
          <div>
            <div className="flex items-center justify-between gap-2 text-xs text-[#64748B] dark:text-[#A1A1AA]">
              <span className="font-medium">Meta de alimentação</span>
              <Utensils className="w-4 h-4 text-[#FF6B00]" />
            </div>

            <div className="mt-2.5 flex items-baseline gap-2 flex-wrap">
              <p className="font-mono text-3xl font-bold tabular-nums text-[#0F172A] dark:text-white">
                {metabolism.calorieTarget}
                <span className="text-sm font-normal text-[#64748B] dark:text-[#A1A1AA] ml-1">
                  kcal
                </span>
              </p>
              <span className="font-mono text-xs font-bold tabular-nums text-[#FF6B00]">
                · {metabolism.proteinG}g prot
              </span>
            </div>

            <p className="mt-1 text-xs text-[#64748B] dark:text-[#A1A1AA] font-mono tabular-nums">
              Carb {metabolism.carbsG}g · Gord {metabolism.fatG}g
            </p>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab("nutri")}
            className="pt-3 border-t border-[#E2E8F0] dark:border-[#26262B] text-xs font-semibold text-[#FF6B00] hover:text-[#EA580C] flex items-center justify-between transition-colors cursor-pointer"
          >
            <span>Ver cardápio na Nutri IA</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </motion.div>

        {/* Metric 3: Treinos na Semana */}
        <motion.div
          variants={kpiCardVariants}
          className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] p-5 flex flex-col justify-between gap-4"
        >
          <div>
            <div className="flex items-center justify-between gap-2 text-xs text-[#64748B] dark:text-[#A1A1AA]">
              <span className="font-medium">Treinos na semana</span>
              <Dumbbell className="w-4 h-4 text-[#FF6B00]" />
            </div>

            <div className="mt-2.5 flex items-baseline justify-between gap-2">
              <p className="font-mono text-3xl font-bold tabular-nums text-[#0F172A] dark:text-white">
                {weeklyStats.count}
                <span className="text-sm font-normal text-[#64748B] dark:text-[#A1A1AA]">
                  /{weeklyStats.target}
                </span>
              </p>
              <span className="font-mono text-xs font-bold tabular-nums text-[#FF6B00]">
                {weeklyStats.pct}%
              </span>
            </div>

            <p className="mt-1 text-xs text-[#64748B] dark:text-[#A1A1AA] font-mono tabular-nums">
              Volume 7d: {weeklyStats.volumeKg.toLocaleString("pt-BR")} kg
            </p>
          </div>

          <button
            type="button"
            onClick={() => openHubTab("resumo_ia")}
            className="pt-3 border-t border-[#E2E8F0] dark:border-[#26262B] text-xs font-semibold text-[#FF6B00] hover:text-[#EA580C] flex items-center justify-between transition-colors cursor-pointer"
          >
            <span>Gerar resumo semanal IA</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </motion.div>
      </motion.section>

      {/* 4. CALM COMPACT "DICA DO DIA" STRIP */}
      <motion.section
        variants={dashboardSectionVariants}
        aria-label="Dica do Dia"
        className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] px-5 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
      >
        <div className="flex items-start gap-3 min-w-0">
          <Lightbulb className="w-5 h-5 text-[#FF6B00] shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="text-xs text-[#64748B] dark:text-[#A1A1AA]">
              <span className="font-semibold text-[#FF6B00]">Dica do dia</span>
              <span aria-hidden="true"> · </span>
              <span>{dailyTipInfo.category}</span>
            </p>
            <p className="mt-0.5 text-sm text-[#0F172A] dark:text-white leading-relaxed">
              <strong className="font-bold">{dailyTipInfo.title}:</strong>{" "}
              <span className="text-[#475569] dark:text-[#D4D4D8]">
                {dailyTipInfo.tip}
              </span>
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setTipOffset((prev) => prev + 1)}
          className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00] text-xs font-semibold text-[#0F172A] dark:text-white flex items-center gap-1.5 self-end sm:self-center shrink-0 whitespace-nowrap transition-colors cursor-pointer"
        >
          <RefreshCw className="w-3.5 h-3.5 text-[#FF6B00]" />
          <span>Outra dica</span>
        </button>
      </motion.section>

      {/* 5. ORGANIZED PROGRESS HUB (CLEAN 4-TAB SWITCHER — ZERO ENDLESS SCROLL CLUTTER) */}
      <motion.section
        ref={hubSectionRef}
        variants={dashboardSectionVariants}
        aria-label="Painel de acompanhamento"
        className="space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base sm:text-lg font-extrabold text-[#0F172A] dark:text-white tracking-tight">
              Acompanhe sua evolução
            </h2>
            <p className="text-xs text-[#64748B] dark:text-[#A1A1AA]">
              Escolha o que deseja ver agora sem poluição na tela.
            </p>
          </div>

          <div
            role="tablist"
            aria-label="Seções do painel inicial"
            className="inline-flex flex-wrap items-center gap-1 p-1 rounded-xl bg-[#F1F5F9] dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] self-start sm:self-auto"
          >
            {(
              [
                { id: "graficos", label: "Gráficos", icon: BarChart3 },
                { id: "resumo_ia", label: "Resumo Personal IA", icon: Sparkles },
                {
                  id: "conquistas",
                  label: `Conquistas (${unlockedAchievementsCount})`,
                  icon: Trophy,
                },
                { id: "objetivo", label: "Meu Objetivo", icon: Target },
              ] as {
                id: DashboardHubTab;
                label: string;
                icon: React.ComponentType<{ className?: string }>;
              }[]
            ).map((tab) => {
              const Icon = tab.icon;
              const isActive = activeHubTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveHubTab(tab.id)}
                  className={`min-h-[38px] px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    isActive
                      ? "bg-white dark:bg-[#FF6B00] text-[#0F172A] dark:text-white shadow-xs"
                      : "text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white"
                  }`}
                >
                  <Icon
                    className={`w-3.5 h-3.5 ${
                      isActive
                        ? "text-[#FF6B00] dark:text-white"
                        : "text-[#64748B] dark:text-[#A1A1AA]"
                    }`}
                  />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Active Hub Panel Content */}
        {activeHubTab === "graficos" && (
          <DashboardCharts
            state={state}
            metabolism={metabolism}
            onNavigateTab={onNavigateTab}
          />
        )}

        {activeHubTab === "resumo_ia" && (
          <WeeklyPerformanceSummaryCard
            state={state}
            metabolism={metabolism}
            streakDays={streakDays}
            onNavigateTab={onNavigateTab}
            onToast={onToast}
          />
        )}

        {activeHubTab === "conquistas" && (
          <AchievementsFeed
            achievements={achievements}
            onNavigateTab={onNavigateTab}
          />
        )}

        {activeHubTab === "objetivo" && (
          <GoalSelector goals={state.goals} onUpdateGoals={onUpdateGoals} />
        )}
      </motion.section>
    </motion.div>
  );
};
