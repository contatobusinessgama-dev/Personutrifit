import React, { useEffect, useMemo, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BellOff,
  CheckCircle2,
  Clock,
  Droplets,
  Dumbbell,
  Flame,
  Lightbulb,
  Play,
  RefreshCw,
  RotateCcw,
  Scale,
  ShieldAlert,
  Sparkles,
  Trophy,
  Utensils,
  Volume2,
  VolumeX,
} from "lucide-react";
import { computeWeightLossStats } from "../data/achievements";
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
import { HydrationMascotBadge } from "./HydrationAvatar";
import { AchievementsFeed } from "./AchievementsFeed";
import { DashboardCharts } from "./DashboardCharts";
import { GoalSelector } from "./GoalSelector";
import { StudentAvatar } from "./StudentAvatar";

const HERO_IMAGE = "/src/assets/images/bianco_gym_hero_1795053835269.jpg";

interface DailyTipItem {
  id: string;
  category: "Musculação" | "Nutrição";
  title: string;
  tip: string;
  actionTag: string;
}

const DAILY_TIPS_CATALOG: DailyTipItem[] = [
  {
    id: "tip_cadence",
    category: "Musculação",
    title: "Controle a Fase Excêntrica",
    tip: "Descer a carga em 2 a 3 segundos controlados gera mais microlesões produtivas e protege suas articulações do que apenas jogar peso para cima.",
    actionTag: "Foco na execução perfeita hoje",
  },
  {
    id: "tip_protein_meals",
    category: "Nutrição",
    title: "Proteína Distribuída no Dia",
    tip: "Fracionar sua meta de proteínas em 3 a 5 refeições mantém a síntese proteica muscular ativa por 24 horas e reduz picos de fome noturna.",
    actionTag: "Inclua proteína em cada refeição",
  },
  {
    id: "tip_progressive_overload",
    category: "Musculação",
    title: "Sobrecarga Progressiva Inteligente",
    tip: "Progredir não é só aumentar peso: fazer +1 repetição limpa, melhorar a amplitude ou reduzir 10s de descanso já força seu músculo a evoluir.",
    actionTag: "Supere 1 repetição do último treino",
  },
  {
    id: "tip_hydration_strength",
    category: "Nutrição",
    title: "Hidratação é Força Bruta",
    tip: "Apenas 2% de desidratação corporal pode reduzir sua força máxima em até 10% e aumentar a percepção de fadiga. Beba água antes de sentir sede.",
    actionTag: "Beba 500 ml antes de treinar",
  },
  {
    id: "tip_sleep_hypertrophy",
    category: "Musculação",
    title: "O Músculo Cresce no Descanso",
    tip: "O treino dá o estímulo, mas é durante o sono profundo que ocorre o pico de GH e a reparação das fibras musculares. Priorize 7h a 8h por noite.",
    actionTag: "Respeite a recuperação muscular",
  },
  {
    id: "tip_preworkout_carbs",
    category: "Nutrição",
    title: "Carboidrato é Combustível Limpo",
    tip: "Consumir carboidratos de boa digestão (banana, aveia, arroz ou pão integral) 60 a 90 min antes do treino preserva o glicogênio e evita queda de rendimento.",
    actionTag: "Garanta energia para o treino",
  },
  {
    id: "tip_core_bracing",
    category: "Musculação",
    title: "Ative o Core e Proteja a Lombar",
    tip: "Antes de iniciar agachamentos, remadas ou desenvolvimentos, contraia o abdômen como se fosse receber um impacto (bracing) e mantenha a coluna neutra.",
    actionTag: "Postura firme em cada série",
  },
  {
    id: "tip_fiber_satiety",
    category: "Nutrição",
    title: "Saciedade no Emagrecimento",
    tip: "Começar o almoço e o jantar por folhas verdes, legumes e uma fonte magra de proteína reduz a velocidade de absorção glicêmica e controla o apetite.",
    actionTag: "Prato colorido e rico em fibras",
  },
  {
    id: "tip_mind_muscle",
    category: "Musculação",
    title: "Conexão Mente-Músculo",
    tip: "Concentre sua atenção no músculo alvo contraindo e alongando a cada repetição. Sentir a musculatura trabalhar vale mais que mover carga no automático.",
    actionTag: "Sinta cada contração muscular",
  },
  {
    id: "tip_post_workout_window",
    category: "Nutrição",
    title: "Recuperação Pós-Treino",
    tip: "Combinar proteínas de qualidade com carboidratos após o treino acelera a reposição de glicogênio e reduz o cortisol induzido pelo esforço intenso.",
    actionTag: "Nutra seu corpo após o treino",
  },
  {
    id: "tip_joint_warmup",
    category: "Musculação",
    title: "Aquecimento Articular Não é Perda de Tempo",
    tip: "Dedicar 5 minutos para mobilidade e 1 série leve de reconhecimento lubrifica joelhos, ombros e quadril com líquido sinovial, prevenindo lesões.",
    actionTag: "Prepare suas articulações",
  },
  {
    id: "tip_consistency_8020",
    category: "Nutrição",
    title: "Constância Vence a Perfeição",
    tip: "Uma refeição fora do plano não estraga seus resultados, assim como uma única salada não constrói um físico. Volte ao plano na próxima refeição sem culpa.",
    actionTag: "Mantenha a consistência hoje",
  },
  {
    id: "tip_breathing_effort",
    category: "Musculação",
    title: "Respire a Favor da Força",
    tip: "Inspire na fase excêntrica (descida) e solte o ar vigorosamente no ponto de maior esforço (subida).Nunca prenda a respiração por séries inteiras.",
    actionTag: "Ritmo respiratório controlado",
  },
  {
    id: "tip_micronutrients",
    category: "Nutrição",
    title: "Micronutrientes & Metabolismo",
    tip: "Vitaminas do complexo B, magnésio, ferro e zinco presentes em ovos, carnes magras, sementes e vegetais escuros são essenciais para converter comida em ATP.",
    actionTag: "Varie os alimentos naturais",
  },
];

function getDailyTipIndexForDate(date: Date): number {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  // Deterministic daily seed that advances by 1 every calendar day
  const utcMidnight = Date.UTC(y, m - 1, d);
  const daysSinceEpoch = Math.floor(utcMidnight / 86400000);
  return Math.abs(daysSinceEpoch) % DAILY_TIPS_CATALOG.length;
}

const WATER_REMINDER_INTERVALS: { value: WaterReminderIntervalMin; label: string }[] = [
  { value: 30, label: "30 min" },
  { value: 45, label: "45 min" },
  { value: 60, label: "1 hora" },
  { value: 90, label: "1h30" },
  { value: 120, label: "2 horas" },
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
  onCelebrateMedal,
  onToast,
  onStartTodayWorkout,
  onNavigateTab,
}) => {
  const [heroImgError, setHeroImgError] = useState(false);
  const [showReminderSettings, setShowReminderSettings] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [tipOffset, setTipOffset] = useState(0);
  const weightLossStats = useMemo(() => computeWeightLossStats(state), [state]);

  const dailyTipInfo = useMemo(() => {
    const todayDate = new Date(nowTick);
    const baseIdx = getDailyTipIndexForDate(todayDate);
    const activeIdx = (baseIdx + tipOffset) % DAILY_TIPS_CATALOG.length;
    const item = DAILY_TIPS_CATALOG[activeIdx];
    const dateLabel = new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
    }).format(todayDate);
    return {
      item,
      activeIdx,
      total: DAILY_TIPS_CATALOG.length,
      dateLabel,
      isAutoToday: tipOffset === 0,
    };
  }, [nowTick, tipOffset]);

  useEffect(() => {
    const id = window.setInterval(() => {
      setNowTick(Date.now());
    }, 15000);
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

  const nextReminderInfo = useMemo(() => {
    if (!reminder.enabled) {
      return { statusText: "Lembrete pausado", minutesLeft: null };
    }
    if (state.water.consumedMl >= metabolism.waterTargetMl) {
      return { statusText: "Meta diária concluída!", minutesLeft: 0 };
    }
    const nowDate = new Date(nowTick);
    const currentHour = nowDate.getHours();
    if (currentHour < reminder.startHour || currentHour >= reminder.endHour) {
      return {
        statusText: `Retorna às ${String(reminder.startHour).padStart(2, "0")}:00`,
        minutesLeft: null,
      };
    }
    const baseTime = reminder.lastRemindedAt || nowTick;
    const nextAt = baseTime + reminder.intervalMin * 60 * 1000;
    const diffMin = Math.max(1, Math.ceil((nextAt - nowTick) / 60000));
    const nextClock = new Date(nextAt).toLocaleTimeString("pt-BR", {
      hour: "2-digit",
      minute: "2-digit",
    });
    return {
      statusText: `Próximo em ${diffMin} min (${nextClock})`,
      minutesLeft: diffMin,
    };
  }, [
    reminder,
    nowTick,
    state.water.consumedMl,
    metabolism.waterTargetMl,
  ]);

  const handleToggleBrowserNotifications = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) {
      onToast(
        "Seu navegador não suporta notificações nativas, mas o alerta sonoro e visual no app continuará funcionando!",
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
      onToast("Notificações do navegador ativadas para o lembrete de água!", "success");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        onUpdateWaterReminder({ browserNotificationEnabled: true });
        onToast("Permissão concedida! Você receberá alertas para beber água.", "success");
      } else {
        onToast(
          "Permissão de notificação negada no navegador. O alerta dentro do app segue ativo!",
          "warning"
        );
      }
    } catch {
      onToast("O alerta dentro do app e o aviso sonoro estão ativos!", "info");
    }
  };

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

      {/* ROW 1A-TIP: "Dica do Dia" (Daily Motivational Bodybuilding & Nutrition Tip, auto-renewed daily) */}
      <motion.section
        variants={dashboardSectionVariants}
        aria-label="Dica do Dia"
        className="relative rounded-2xl p-4 sm:p-5 bg-gradient-to-r from-[#FFF7ED] via-white to-[#F8FAFC] dark:from-[#1B1410] dark:via-[#151518] dark:to-[#121215] border border-[#FDBA74]/60 dark:border-[#FF6B00]/30 shadow-sm dark:shadow-none overflow-hidden"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-10 top-0 h-px bg-gradient-to-r from-transparent via-[#FF6B00]/70 to-transparent"
        />

        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5">
          <div className="flex items-start gap-3.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#FF6B00]/15 dark:bg-[#FF6B00]/20 border border-[#FF6B00]/30 flex items-center justify-center shrink-0 mt-0.5">
              <Lightbulb className="w-5 h-5 text-[#FF6B00]" />
            </div>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-[#FF6B00]">
                  Dica do Dia · {dailyTipInfo.dateLabel}
                </span>
                <span
                  className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-bold ${
                    dailyTipInfo.item.category === "Musculação"
                      ? "bg-[#FF6B00]/12 text-[#EA580C] dark:bg-[#FF6B00]/20 dark:text-[#FB923C]"
                      : "bg-emerald-500/12 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300"
                  }`}
                >
                  {dailyTipInfo.item.category === "Musculação" ? (
                    <Dumbbell className="w-3 h-3" />
                  ) : (
                    <Utensils className="w-3 h-3" />
                  )}
                  {dailyTipInfo.item.category}
                </span>
                <span className="text-[11px] text-[#64748B] dark:text-[#A1A1AA] font-mono tabular-nums">
                  #{dailyTipInfo.activeIdx + 1}/{dailyTipInfo.total}
                </span>
                {dailyTipInfo.isAutoToday && (
                  <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md">
                    Renovada hoje
                  </span>
                )}
              </div>

              <h2 className="mt-1 text-sm sm:text-base font-extrabold text-[#0F172A] dark:text-white">
                {dailyTipInfo.item.title}
              </h2>

              <p className="mt-0.5 text-xs sm:text-sm text-[#334155] dark:text-[#D4D4D8] leading-relaxed">
                {dailyTipInfo.item.tip}
              </p>

              <div className="mt-2 inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#EA580C] dark:text-[#FB923C]">
                <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                <span>Meta prática: {dailyTipInfo.item.actionTag}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            {!dailyTipInfo.isAutoToday && (
              <button
                type="button"
                onClick={() => setTipOffset(0)}
                className="min-h-[36px] px-2.5 py-1.5 rounded-xl bg-white/80 dark:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#2A2A32] hover:border-[#FF6B00] text-[11px] font-semibold text-[#475569] dark:text-[#D4D4D8] transition-colors cursor-pointer"
              >
                Voltar à do dia
              </button>
            )}
            <button
              type="button"
              onClick={() => setTipOffset((prev) => prev + 1)}
              title="Ver outra dica motivacional"
              className="min-h-[36px] px-3 py-1.5 rounded-xl bg-white dark:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#2A2A32] hover:border-[#FF6B00] text-xs font-bold text-[#0F172A] dark:text-white flex items-center gap-1.5 shadow-2xs transition-colors cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span>Outra dica</span>
            </button>
          </div>
        </div>
      </motion.section>

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

            <motion.button
              type="button"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.97 }}
              transition={CARD_HOVER_TRANSITION}
              onClick={() => onNavigateTab("treinos")}
              className="min-h-[48px] px-4 py-3 rounded-xl bg-white/10 hover:bg-white/20 backdrop-blur-md border border-white/25 hover:border-[#FF6B00] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
            >
              <ShieldAlert className="w-4 h-4 text-[#FF6B00]" />
              <span>Lombar & Dor no Joelho</span>
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
            <div className="mt-2 flex items-center justify-between gap-1.5 text-[11px] font-mono">
              <span className="text-[#475569] dark:text-[#A1A1AA]">
                🥉 {weightLossStats.bronzeMedalsCount} · 🥈 {weightLossStats.silverMedalsCount} · 🥇{" "}
                {weightLossStats.goldMedalsCount}
              </span>
              {onCelebrateMedal && (
                <button
                  type="button"
                  onClick={() => {
                    const highest = weightLossStats.highestTierUnlocked || "gold";
                    const lostCount = Math.max(1, Math.floor(weightLossStats.bestLostKg) || 10);
                    onCelebrateMedal({
                      id: "kpi_medal_celebration",
                      tier: highest,
                      title:
                        highest === "gold"
                          ? "Medalha de Ouro · -10 kg Perdidos!"
                          : highest === "silver"
                          ? "Medalha de Prata · -5 kg Perdidos!"
                          : `Medalha de Bronze · -${lostCount} kg Perdido${
                              lostCount > 1 ? "s" : ""
                            }!`,
                      subtitle:
                        weightLossStats.bestLostKg >= 1
                          ? `Você já eliminou -${weightLossStats.bestLostKg.toFixed(
                              1
                            )} kg! A cada 1 kg perdido você ganha Bronze, 5 kg Prata e 10 kg Ouro!`
                          : "A cada 1 kg perdido você ganha Medalha de Bronze, com 5 kg Medalha de Prata e com 10 kg Medalha de Ouro com fogos!",
                      lostKg: weightLossStats.bestLostKg >= 1 ? lostCount : 10,
                    });
                  }}
                  className="px-2 py-0.5 rounded-md bg-[#FF6B00]/15 hover:bg-[#FF6B00] text-[#FF6B00] hover:text-white font-bold transition-colors cursor-pointer"
                >
                  Ver Fogos
                </button>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={() => onNavigateTab("evolucao")}
            className="group/cta mt-4 pt-3 border-t border-[#E2E8F0] dark:border-[#26262B] text-xs font-semibold text-[#FF6B00] hover:text-[#EA580C] dark:hover:text-orange-300 flex items-center justify-between transition-colors cursor-pointer"
          >
            <span>Atualizar pesagem & medalhas</span>
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

        {/* KPI 3: Hidratação do Dia + Lembrete para Beber Água */}
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
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowReminderSettings((prev) => !prev)}
                title="Configurar lembrete para beber água"
                aria-label="Configurar lembrete para beber água"
                className={`px-2 py-0.5 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 transition-colors cursor-pointer ${
                  reminder.enabled
                    ? "bg-[#FF6B00]/15 text-[#FF6B00] border border-[#FF6B00]/40"
                    : "bg-[#F1F5F9] dark:bg-[#1C1C21] text-[#64748B] dark:text-[#A1A1AA] border border-[#E2E8F0] dark:border-[#26262B]"
                }`}
              >
                {reminder.enabled ? (
                  <Bell className="w-3 h-3" />
                ) : (
                  <BellOff className="w-3 h-3" />
                )}
                <span className="font-mono tabular-nums">
                  {reminder.enabled ? `${reminder.intervalMin}m` : "Off"}
                </span>
              </button>
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

            <button
              type="button"
              onClick={() => setShowReminderSettings((prev) => !prev)}
              className="mt-1.5 w-full text-left text-[11px] text-[#475569] dark:text-[#A1A1AA] hover:text-[#FF6B00] flex items-center justify-between gap-1 transition-colors cursor-pointer"
            >
              <span className="inline-flex items-center gap-1 truncate">
                <Clock className="w-3 h-3 text-[#FF6B00] shrink-0" />
                <span className="truncate">{nextReminderInfo.statusText}</span>
              </span>
              <span className="text-[#FF6B00] font-semibold shrink-0">
                {showReminderSettings ? "Fechar" : "Ajustar"}
              </span>
            </button>
          </div>

          <div className="mt-3 grid grid-cols-2 gap-2">
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

      {/* LEMBRETE PARA BEBER ÁGUA — Painel Inteligente de Hidratação */}
      <motion.section
        variants={dashboardSectionVariants}
        aria-label="Lembrete para beber água"
        className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none p-4 sm:p-5 space-y-4"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-3">
            <HydrationMascotBadge
              size="md"
              active={reminder.enabled}
              onClick={onTriggerWaterReminderTest}
              title="Clique para ver o avatar e testar o aviso sonoro"
            />
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-sm sm:text-base font-extrabold text-[#0F172A] dark:text-white">
                  Lembrete Inteligente para Beber Água
                </h2>
                <span
                  className={`px-2 py-0.5 rounded-md text-[11px] font-bold ${
                    reminder.enabled
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "bg-[#F1F5F9] dark:bg-[#1C1C21] text-[#64748B] dark:text-[#A1A1AA]"
                  }`}
                >
                  {reminder.enabled ? "Ativo" : "Pausado"}
                </span>
              </div>
              <p className="mt-0.5 text-xs text-[#475569] dark:text-[#A1A1AA]">
                Meta personalizada:{" "}
                <strong className="font-mono text-[#0F172A] dark:text-white">
                  {(metabolism.waterTargetMl / 1000).toFixed(2)} L/dia
                </strong>{" "}
                (35 ml/kg + treino) · {nextReminderInfo.statusText}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 self-start sm:self-auto">
            <button
              type="button"
              onClick={() =>
                onUpdateWaterReminder({
                  enabled: !reminder.enabled,
                  lastRemindedAt: Date.now(),
                })
              }
              className={`min-h-[38px] px-3.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition-colors cursor-pointer ${
                reminder.enabled
                  ? "bg-[#FF6B00] border-[#FF6B00] text-white"
                  : "bg-[#F8FAFC] dark:bg-[#0B0B0D] border-[#E2E8F0] dark:border-[#26262B] text-[#0F172A] dark:text-white"
              }`}
            >
              {reminder.enabled ? (
                <>
                  <Bell className="w-3.5 h-3.5" />
                  <span>Lembrete Ligado</span>
                </>
              ) : (
                <>
                  <BellOff className="w-3.5 h-3.5" />
                  <span>Ativar Lembrete</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={onTriggerWaterReminderTest}
              className="min-h-[38px] px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] hover:bg-[#F1F5F9] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00]/50 text-xs font-semibold text-[#0F172A] dark:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
            >
              <Bell className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span>Testar Alerta</span>
            </button>

            <button
              type="button"
              onClick={() => setShowReminderSettings((prev) => !prev)}
              className="min-h-[38px] px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] hover:bg-[#F1F5F9] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] text-xs font-semibold text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white transition-colors cursor-pointer"
            >
              {showReminderSettings ? "Ocultar ajustes" : "Configurar horários"}
            </button>
          </div>
        </div>

        {/* Interval Quick Selector + Quick Dose Buttons */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 pt-3 border-t border-[#E2E8F0] dark:border-[#26262B] items-center">
          <div className="lg:col-span-7 flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-semibold text-[#475569] dark:text-[#A1A1AA] mr-1">
              Avisar a cada:
            </span>
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
                      `Lembrete de água ajustado para cada ${item.label}!`,
                      "info"
                    );
                  }}
                  className={`min-h-[34px] px-2.5 rounded-lg text-xs font-bold font-mono border transition-colors cursor-pointer ${
                    active
                      ? "bg-[#FF6B00]/15 border-[#FF6B00] text-[#FF6B00]"
                      : "bg-[#F8FAFC] dark:bg-[#0B0B0D] border-[#E2E8F0] dark:border-[#26262B] text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>

          <div className="lg:col-span-5 flex flex-wrap items-center lg:justify-end gap-2">
            <span className="text-xs text-[#475569] dark:text-[#A1A1AA]">
              Registrar dose:
            </span>
            {[200, 300, 500].map((ml) => (
              <button
                key={ml}
                type="button"
                onClick={() => {
                  onAddWater(ml);
                  onToast(`+${ml} ml de água registrados!`, "success");
                }}
                className="min-h-[34px] px-2.5 rounded-lg bg-[#F8FAFC] dark:bg-[#0B0B0D] hover:bg-[#FF6B00] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00] text-xs font-mono font-bold text-[#0F172A] dark:text-white hover:text-white flex items-center gap-1 transition-colors cursor-pointer"
              >
                <Droplets className="w-3 h-3 text-[#FF6B00] group-hover:text-white" />
                <span>+{ml}ml</span>
              </button>
            ))}
          </div>
        </div>

        {/* Expandable Advanced Reminder Settings */}
        {showReminderSettings && (
          <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label
                htmlFor="water-start-hour"
                className="block text-xs font-semibold text-[#334155] dark:text-[#D4D4D8] mb-1"
              >
                Início dos lembretes
              </label>
              <select
                id="water-start-hour"
                value={reminder.startHour}
                onChange={(e) => {
                  const nextStart = Number(e.target.value);
                  onUpdateWaterReminder({
                    startHour: nextStart,
                    endHour: Math.max(nextStart + 1, reminder.endHour),
                  });
                }}
                className="w-full min-h-[40px] rounded-xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] px-3 font-mono text-xs text-[#0F172A] dark:text-white"
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
                htmlFor="water-end-hour"
                className="block text-xs font-semibold text-[#334155] dark:text-[#D4D4D8] mb-1"
              >
                Término (pausa noturna)
              </label>
              <select
                id="water-end-hour"
                value={reminder.endHour}
                onChange={(e) =>
                  onUpdateWaterReminder({ endHour: Number(e.target.value) })
                }
                className="w-full min-h-[40px] rounded-xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] px-3 font-mono text-xs text-[#0F172A] dark:text-white"
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

            <div className="flex flex-col justify-end gap-2">
              <button
                type="button"
                onClick={() =>
                  onUpdateWaterReminder({ soundEnabled: !reminder.soundEnabled })
                }
                className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold border flex items-center justify-between transition-colors cursor-pointer ${
                  reminder.soundEnabled
                    ? "bg-white dark:bg-[#151518] border-[#FF6B00]/50 text-[#0F172A] dark:text-white"
                    : "bg-white dark:bg-[#151518] border-[#E2E8F0] dark:border-[#26262B] text-[#64748B] dark:text-[#A1A1AA]"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  {reminder.soundEnabled ? (
                    <Volume2 className="w-3.5 h-3.5 text-[#FF6B00]" />
                  ) : (
                    <VolumeX className="w-3.5 h-3.5" />
                  )}
                  <span>Aviso sonoro suave</span>
                </span>
                <span className="font-mono text-[11px] font-bold text-[#FF6B00]">
                  {reminder.soundEnabled ? "ON" : "OFF"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => void handleToggleBrowserNotifications()}
                className={`min-h-[40px] px-3 rounded-xl text-xs font-semibold border flex items-center justify-between transition-colors cursor-pointer ${
                  reminder.browserNotificationEnabled
                    ? "bg-white dark:bg-[#151518] border-emerald-500/50 text-[#0F172A] dark:text-white"
                    : "bg-white dark:bg-[#151518] border-[#E2E8F0] dark:border-[#26262B] text-[#64748B] dark:text-[#A1A1AA]"
                }`}
              >
                <span className="inline-flex items-center gap-1.5">
                  <CheckCircle2
                    className={`w-3.5 h-3.5 ${
                      reminder.browserNotificationEnabled
                        ? "text-emerald-500"
                        : "text-[#64748B]"
                    }`}
                  />
                  <span>Notificação do navegador</span>
                </span>
                <span className="font-mono text-[11px] font-bold text-[#FF6B00]">
                  {reminder.browserNotificationEnabled ? "ON" : "Ativar"}
                </span>
              </button>
            </div>
          </div>
        )}
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

