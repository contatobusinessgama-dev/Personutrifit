import React, { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Activity,
  AlertTriangle,
  BookmarkCheck,
  Check,
  CheckCircle2,
  Clock,
  Dumbbell,
  ExternalLink,
  Flame,
  Info,
  Pause,
  Play,
  Plus,
  RotateCcw,
  Settings2,
  ShieldAlert,
  Timer,
  Trash2,
  Wind,
  X,
} from "lucide-react";
import {
  buildWorkoutComplementPlan,
  EXERCISE_MAP,
  EXERCISES,
  GYM_MODALITIES,
  MUSCLE_GROUPS,
  WORKOUT_COMBOS,
  WorkoutComplementPlan,
} from "../data/exercises";
import {
  BiancoAppState,
  CardioIntensity,
  CardioSessionInput,
  ExerciseItem,
  ExerciseLogEntry,
  GymModality,
  MuscleGroupId,
  StudentGoals,
} from "../types";
import { ExerciseCard } from "./ExerciseCard";
import { ExerciseVisual } from "./ExerciseVisual";
import { GoalSelector } from "./GoalSelector";

const CARDIO_BANNER = "/src/assets/images/bianco_cardio_zone_1795053836665.jpg";

type SubTab = "combos" | "grupamentos" | "modalidades";

interface CardioEquipmentOption {
  id: string;
  label: string;
  shortLabel: string;
  baseMet: number;
  defaultNotes: string;
}

const CARDIO_EQUIPMENT_OPTIONS: CardioEquipmentOption[] = [
  {
    id: "esteira_caminhada",
    label: "Esteira (Caminhada Inclinada)",
    shortLabel: "Esteira Inclinada",
    baseMet: 6.0,
    defaultNotes: "Inclinação 10-12% · 5.0 km/h",
  },
  {
    id: "esteira_corrida",
    label: "Esteira (Corrida)",
    shortLabel: "Esteira Corrida",
    baseMet: 9.2,
    defaultNotes: "Ritmo contínuo 8.5-10 km/h",
  },
  {
    id: "escada",
    label: "Escada (StairMaster)",
    shortLabel: "Escada",
    baseMet: 8.8,
    defaultNotes: "Nível 7-10 sem apoiar os braços",
  },
  {
    id: "bike",
    label: "Bicicleta Ergométrica / Spinning",
    shortLabel: "Bike / Spinning",
    baseMet: 7.5,
    defaultNotes: "Cadência 80-95 RPM · Carga moderada",
  },
  {
    id: "eliptico",
    label: "Elíptico / Transport",
    shortLabel: "Elíptico",
    baseMet: 6.5,
    defaultNotes: "Baixo impacto articular · Carga 6-8",
  },
  {
    id: "remo",
    label: "Remo Indoor",
    shortLabel: "Remo Indoor",
    baseMet: 7.8,
    defaultNotes: "24-28 remadas/min",
  },
  {
    id: "corda",
    label: "Pular Corda / Cardio Funcional",
    shortLabel: "Corda / Funcional",
    baseMet: 9.8,
    defaultNotes: "Tiros de 45s ativos / 15s pausa",
  },
];

const CARDIO_INTENSITIES: {
  id: CardioIntensity;
  label: string;
  multiplier: number;
  zone: string;
}[] = [
  { id: "Leve", label: "Leve", multiplier: 0.78, zone: "Zona 1-2 (Queima leve)" },
  { id: "Moderado", label: "Moderado", multiplier: 1.0, zone: "Zona 2-3 (Queima de gordura)" },
  { id: "Intenso", label: "Intenso", multiplier: 1.22, zone: "Zona 3-4 (Condicionamento)" },
  { id: "HIIT", label: "HIIT", multiplier: 1.35, zone: "Zona 4-5 (Intervalado)" },
];

const WEEKLY_CARDIO_GOAL_MIN = 150;

function formatStopwatch(totalSeconds: number): string {
  const mins = Math.floor(totalSeconds / 60);
  const secs = totalSeconds % 60;
  return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
}

interface WorkoutsTabProps {
  state: BiancoAppState;
  initialSubTab?: SubTab;
  onUpdateGoals: (patch: Partial<StudentGoals>) => void;
  onSelectCombo: (comboId: string) => void;
  onUpdateExerciseLog: (exerciseId: string, patch: Partial<ExerciseLogEntry>) => void;
  onToggleSet: (exerciseId: string, setIndex: number) => boolean;
  onSwapMachine: (originalId: string) => void;
  onFinishWorkout: (
    title: string,
    muscleGroup: string,
    exerciseIds: string[],
    durationMin: number
  ) => void;
  onLogModality: (title: string, category: string, durationMin: number) => void;
  onLogCardioSession: (entry: CardioSessionInput) => void;
  onDeleteWorkoutSession: (id: string) => void;
  onClearSavedPlan: () => void;
  onStartRest: (seconds: number) => void;
  onToast: (message: string, tone?: "success" | "info" | "warning") => void;
}

export const WorkoutsTab: React.FC<WorkoutsTabProps> = ({
  state,
  initialSubTab = "combos",
  onUpdateGoals,
  onSelectCombo,
  onUpdateExerciseLog,
  onToggleSet,
  onSwapMachine,
  onFinishWorkout,
  onLogModality,
  onLogCardioSession,
  onDeleteWorkoutSession,
  onClearSavedPlan,
  onStartRest,
  onToast,
}) => {
  const [subTab, setSubTab] = useState<SubTab>(initialSubTab);
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroupId>("costas");
  const [modalityFilter, setModalityFilter] = useState<
    "Todas" | GymModality["category"]
  >("Todas");
  const [guideExercise, setGuideExercise] = useState<ExerciseItem | null>(null);
  const [showSavedPlanContent, setShowSavedPlanContent] = useState(false);
  const [finishBanner, setFinishBanner] = useState<string | null>(null);
  const [cardioImgErr, setCardioImgErr] = useState(false);
  const [loggedModalityId, setLoggedModalityId] = useState<string | null>(null);

  // Cardio Exercise Tracker State
  const [cardioEquipmentId, setCardioEquipmentId] = useState<string>(
    CARDIO_EQUIPMENT_OPTIONS[0].id
  );
  const [cardioIntensity, setCardioIntensity] = useState<CardioIntensity>("Moderado");
  const [cardioDurationMin, setCardioDurationMin] = useState<string>("30");
  const [cardioDistanceKm, setCardioDistanceKm] = useState<string>("");
  const [cardioNotes, setCardioNotes] = useState<string>("");
  const [cardioCustomKcal, setCardioCustomKcal] = useState<string>("");
  const [cardioStopwatchSec, setCardioStopwatchSec] = useState<number>(0);
  const [cardioStopwatchRunning, setCardioStopwatchRunning] = useState<boolean>(false);

  useEffect(() => {
    if (!cardioStopwatchRunning) return;
    const id = window.setInterval(() => {
      setCardioStopwatchSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [cardioStopwatchRunning]);

  const selectedCardioEquipment = useMemo(
    () =>
      CARDIO_EQUIPMENT_OPTIONS.find((item) => item.id === cardioEquipmentId) ||
      CARDIO_EQUIPMENT_OPTIONS[0],
    [cardioEquipmentId]
  );

  const selectedIntensityMeta = useMemo(
    () =>
      CARDIO_INTENSITIES.find((item) => item.id === cardioIntensity) ||
      CARDIO_INTENSITIES[1],
    [cardioIntensity]
  );

  const estimatedCardioKcal = useMemo(() => {
    const mins = Math.max(1, Number(cardioDurationMin.replace(",", ".")) || 0);
    const weight = Math.max(40, state.profile.weightKg || 75);
    const met = selectedCardioEquipment.baseMet * selectedIntensityMeta.multiplier;
    return Math.round(((met * 3.5 * weight) / 200) * mins);
  }, [
    cardioDurationMin,
    selectedCardioEquipment,
    selectedIntensityMeta,
    state.profile.weightKg,
  ]);

  const liveStopwatchKcal = useMemo(() => {
    const mins = cardioStopwatchSec / 60;
    const weight = Math.max(40, state.profile.weightKg || 75);
    const met = selectedCardioEquipment.baseMet * selectedIntensityMeta.multiplier;
    return Math.max(0, Math.round(((met * 3.5 * weight) / 200) * mins));
  }, [
    cardioStopwatchSec,
    selectedCardioEquipment,
    selectedIntensityMeta,
    state.profile.weightKg,
  ]);

  const cardioSessions = useMemo(
    () =>
      state.workoutHistory.filter(
        (w) =>
          w.id.startsWith("cardio_") ||
          w.muscleGroup.toLowerCase().includes("cardio") ||
          w.muscleGroup.toLowerCase().includes("spinning")
      ),
    [state.workoutHistory]
  );

  const cardioStats = useMemo(() => {
    const now = new Date();
    const sevenDaysAgo = new Date(
      now.getFullYear(),
      now.getMonth(),
      now.getDate() - 6
    )
      .toISOString()
      .slice(0, 10);

    let weeklyMin = 0;
    let totalMin = 0;
    let totalKm = 0;
    let totalKcal = 0;

    for (const s of cardioSessions) {
      totalMin += s.durationMin || 0;
      if (s.date >= sevenDaysAgo) {
        weeklyMin += s.durationMin || 0;
      }
      if (typeof s.distanceKm === "number") {
        totalKm += s.distanceKm;
      } else {
        const kmMatch = s.title.match(/([0-9]+(?:[.,][0-9]+)?)\s*km/i);
        if (kmMatch) totalKm += parseFloat(kmMatch[1].replace(",", "."));
      }
      if (typeof s.caloriesKcal === "number") {
        totalKcal += s.caloriesKcal;
      } else {
        const kcalMatch = s.title.match(/([0-9]+)\s*kcal/i);
        if (kcalMatch) {
          totalKcal += Number(kcalMatch[1]);
        } else {
          totalKcal += Math.round((s.durationMin || 20) * 8);
        }
      }
    }

    const weeklyPct = Math.min(
      100,
      Math.round((weeklyMin / WEEKLY_CARDIO_GOAL_MIN) * 100)
    );

    return {
      count: cardioSessions.length,
      weeklyMin,
      weeklyPct,
      totalMin,
      totalKm: Number(totalKm.toFixed(1)),
      totalKcal,
    };
  }, [cardioSessions]);

  const handleSaveCardioForm = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedDuration = Number(cardioDurationMin.replace(",", "."));
    if (!Number.isFinite(parsedDuration) || parsedDuration < 1 || parsedDuration > 480) {
      onToast("Informe uma duração válida entre 1 e 480 minutos.", "warning");
      return;
    }

    const rawKm = cardioDistanceKm.trim();
    let parsedKm: number | undefined;
    if (rawKm) {
      const kmVal = Number(rawKm.replace(",", "."));
      if (!Number.isFinite(kmVal) || kmVal <= 0 || kmVal > 200) {
        onToast("Informe uma distância válida em km (ex.: 3.5).", "warning");
        return;
      }
      parsedKm = Number(kmVal.toFixed(2));
    }

    const rawCustomKcal = cardioCustomKcal.trim();
    const finalKcal =
      rawCustomKcal && Number.isFinite(Number(rawCustomKcal)) && Number(rawCustomKcal) > 0
        ? Math.round(Number(rawCustomKcal))
        : estimatedCardioKcal;

    onLogCardioSession({
      equipment: selectedCardioEquipment.label,
      durationMin: Math.round(parsedDuration),
      distanceKm: parsedKm,
      caloriesKcal: finalKcal,
      intensity: cardioIntensity,
      notes: cardioNotes.trim() || undefined,
    });

    setFinishBanner(
      `Cardio registrado: ${selectedCardioEquipment.shortLabel} (${Math.round(
        parsedDuration
      )} min · ${finalKcal} kcal)!`
    );
    onToast(
      `Cardio de ${Math.round(parsedDuration)} min (${finalKcal} kcal) salvo no histórico!`,
      "success"
    );
    setCardioDistanceKm("");
    setCardioCustomKcal("");
    setCardioNotes("");
    window.setTimeout(() => setFinishBanner(null), 5000);
  };

  const handleFinishLiveCardioStopwatch = () => {
    const elapsedMin = Math.max(1, Math.round(cardioStopwatchSec / 60));
    const weight = Math.max(40, state.profile.weightKg || 75);
    const met = selectedCardioEquipment.baseMet * selectedIntensityMeta.multiplier;
    const kcal = Math.max(5, Math.round(((met * 3.5 * weight) / 200) * elapsedMin));

    const rawKm = cardioDistanceKm.trim();
    const parsedKm =
      rawKm && Number.isFinite(Number(rawKm.replace(",", "."))) && Number(rawKm.replace(",", ".")) > 0
        ? Number(Number(rawKm.replace(",", ".")).toFixed(2))
        : undefined;

    onLogCardioSession({
      equipment: selectedCardioEquipment.label,
      durationMin: elapsedMin,
      distanceKm: parsedKm,
      caloriesKcal: kcal,
      intensity: cardioIntensity,
      notes: cardioNotes.trim() || "Cronometrado ao vivo",
    });

    setCardioStopwatchRunning(false);
    setCardioStopwatchSec(0);
    setCardioDurationMin(String(elapsedMin));
    setFinishBanner(
      `Cardio cronometrado salvo: ${selectedCardioEquipment.shortLabel} (${elapsedMin} min · ${kcal} kcal)!`
    );
    onToast(
      `Cardio cronometrado (${elapsedMin} min · ${kcal} kcal) registrado!`,
      "success"
    );
    window.setTimeout(() => setFinishBanner(null), 5000);
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setGuideExercise(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const activeCombo = useMemo(
    () => WORKOUT_COMBOS.find((c) => c.id === state.activeComboId) || WORKOUT_COMBOS[0],
    [state.activeComboId]
  );

  const muscleExercises = useMemo(
    () => EXERCISES.filter((e) => e.muscleGroup === selectedMuscle),
    [selectedMuscle]
  );

  const filteredModalities = useMemo(
    () =>
      modalityFilter === "Todas"
        ? GYM_MODALITIES
        : GYM_MODALITIES.filter((m) => m.category === modalityFilter),
    [modalityFilter]
  );

  const comboProgress = useMemo(() => {
    let done = 0;
    let total = 0;
    for (const origId of activeCombo.exerciseIds) {
      const displayId = state.swappedExercises[origId] || origId;
      const log = state.exerciseLogs[displayId];
      if (!log) continue;
      total += log.sets;
      done += log.completedSets.filter(Boolean).length;
    }
    return { done, total, pct: total > 0 ? Math.round((done / total) * 100) : 0 };
  }, [activeCombo, state.exerciseLogs, state.swappedExercises]);

  const handleToggleWithAutoRest = (exerciseId: string, setIndex: number, defaultRest: number) => {
    const checked = onToggleSet(exerciseId, setIndex);
    if (checked) {
      onStartRest(defaultRest);
      onToast(`Série ${setIndex + 1} concluída · Descanso de ${defaultRest}s iniciado`, "info");
    }
  };

  const handleCompleteActiveCombo = () => {
    onFinishWorkout(
      activeCombo.title,
      activeCombo.focusTag,
      activeCombo.exerciseIds,
      activeCombo.durationMin
    );
    setFinishBanner(
      `Treino "${activeCombo.title}" concluído e registrado em Evolução! Suas cargas foram salvas.`
    );
    onToast(`Treino "${activeCombo.title}" salvo na Evolução!`, "success");
    window.setTimeout(() => setFinishBanner(null), 5000);
  };

  const handleCompleteMuscleGroup = () => {
    const grp = MUSCLE_GROUPS.find((g) => g.id === selectedMuscle);
    onFinishWorkout(
      `Treino de ${grp?.label || selectedMuscle}`,
      grp?.shortLabel || "Musculação",
      muscleExercises.map((e) => e.id),
      45
    );
    setFinishBanner(
      `Sessão de ${grp?.label} finalizada e salva no seu histórico de Evolução!`
    );
    onToast(`Sessão de ${grp?.label} registrada!`, "success");
    window.setTimeout(() => setFinishBanner(null), 5000);
  };

  const handleLogModalityClick = (mod: GymModality) => {
    onLogModality(mod.title, mod.category, mod.durationMin);
    setLoggedModalityId(mod.id);
    onToast(`"${mod.title}" registrado no histórico!`, "success");
    window.setTimeout(() => setLoggedModalityId(null), 2500);
  };

  const [completedStretches, setCompletedStretches] = useState<Record<string, boolean>>({});

  const toggleStretchDone = (stretchId: string, name: string, durationSec: number) => {
    setCompletedStretches((prev) => {
      const next = !prev[stretchId];
      if (next) {
        onStartRest(durationSec);
        onToast(
          `Alongamento "${name}" iniciado · Cronômetro de ${durationSec}s ativado!`,
          "info"
        );
      }
      return { ...prev, [stretchId]: next };
    });
  };

  const handleLogGoalCardio = (plan: WorkoutComplementPlan) => {
    onLogCardioSession({
      equipment: plan.cardio.equipmentLabel,
      durationMin: plan.cardio.durationMin,
      caloriesKcal: plan.cardio.estimatedKcal,
      intensity: plan.cardio.intensity,
      notes: `Prescrição do objetivo: ${plan.primaryGoal}`,
    });
    setFinishBanner(
      `Cardio do objetivo registrado: ${plan.cardio.equipmentLabel} (${plan.cardio.durationMin} min · ~${plan.cardio.estimatedKcal} kcal)!`
    );
    onToast(
      `Cardio pós-treino (${plan.cardio.durationMin} min · ${plan.cardio.estimatedKcal} kcal) salvo no histórico!`,
      "success"
    );
    window.setTimeout(() => setFinishBanner(null), 5000);
  };

  const handleCompleteStretchProtocol = (plan: WorkoutComplementPlan) => {
    const nextMap: Record<string, boolean> = { ...completedStretches };
    for (const st of plan.stretches) {
      nextMap[st.id] = true;
    }
    setCompletedStretches(nextMap);
    onLogModality(
      `${plan.stretchingTitle} (${plan.workoutLabel})`,
      "Pilates/Mobilidade",
      plan.stretchingDurationMin
    );
    setFinishBanner(
      `Alongamento pós-treino (${plan.stretchingDurationMin} min) concluído e salvo no histórico!`
    );
    onToast("Protocolo de alongamento concluído e salvo!", "success");
    window.setTimeout(() => setFinishBanner(null), 5000);
  };

  const renderGoalCardioAndStretchingBlock = (
    workoutContextId: string,
    workoutLabel: string
  ) => {
    const plan = buildWorkoutComplementPlan(
      state.goals.primary,
      workoutContextId,
      workoutLabel,
      state.profile.weightKg
    );
    const doneStretchCount = plan.stretches.filter((s) => completedStretches[s.id]).length;

    return (
      <section
        aria-label={`Cardio e alongamento para ${workoutLabel}`}
        className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none p-5 sm:p-6 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-[#E2E8F0] dark:border-[#26262B]">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#FF6B00]">
              <Flame className="w-4 h-4" />
              <span>Protocolo Obrigatório do Treino · Conforme seu Objetivo Principal</span>
            </div>
            <h3 className="mt-1 text-lg sm:text-xl font-extrabold text-[#0F172A] dark:text-white">
              Cardio Estratégico & Alongamento Pós-Treino
            </h3>
            <p className="mt-0.5 text-xs text-[#475569] dark:text-[#A1A1AA]">
              Personalizado para{" "}
              <strong className="text-[#0F172A] dark:text-white">
                {state.goals.primary}
              </strong>{" "}
              no treino de{" "}
              <strong className="text-[#FF6B00]">{workoutLabel}</strong>.
            </p>
          </div>
          <span className="self-start sm:self-auto px-3 py-1 rounded-xl bg-[#FF6B00]/12 dark:bg-[#FF6B00]/15 border border-[#FF6B00]/30 font-mono text-xs font-bold text-[#FF6B00] whitespace-nowrap">
            +{plan.cardio.durationMin}m cardio · +{plan.stretchingDurationMin}m alongamento
          </span>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
          {/* Card 1: Cardio conforme Objetivo Principal */}
          <div className="lg:col-span-6 rounded-2xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] p-4 sm:p-5 flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#FF6B00]">
                  <Activity className="w-4 h-4" />
                  <span>1. Cardio Pós-Musculação</span>
                </span>
                <span className="px-2.5 py-0.5 rounded-lg bg-[#FF6B00]/15 text-[#FF6B00] font-mono text-xs font-bold tabular-nums">
                  {plan.cardio.durationMin} min · ~{plan.cardio.estimatedKcal} kcal
                </span>
              </div>

              <div>
                <h4 className="text-base font-extrabold text-[#0F172A] dark:text-white">
                  {plan.cardio.equipmentLabel}
                </h4>
                <p className="text-xs font-semibold text-[#FF6B00] mt-0.5">
                  Intensidade {plan.cardio.intensity} · {plan.cardio.zoneLabel}
                </p>
              </div>

              <div className="rounded-xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] p-3.5 space-y-1.5">
                <p className="text-xs font-bold text-[#0F172A] dark:text-white">
                  Como executar hoje:
                </p>
                <p className="text-xs text-[#334155] dark:text-[#D4D4D8] leading-relaxed">
                  {plan.cardio.protocol}
                </p>
              </div>

              <p className="text-xs text-[#475569] dark:text-[#A1A1AA] leading-relaxed">
                <strong className="text-[#0F172A] dark:text-white">Por que fazer: </strong>
                {plan.cardio.rationale}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-[#E2E8F0] dark:border-[#26262B]">
              <button
                type="button"
                onClick={() => handleLogGoalCardio(plan)}
                className="flex-1 min-h-[42px] px-4 rounded-xl bg-[#FF6B00] hover:bg-[#F97316] text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  Concluir Cardio ({plan.cardio.durationMin}m · {plan.cardio.estimatedKcal} kcal)
                </span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setCardioEquipmentId(plan.cardio.equipmentId);
                  setCardioIntensity(plan.cardio.intensity);
                  setCardioDurationMin(String(plan.cardio.durationMin));
                  setSubTab("modalidades");
                }}
                className="min-h-[42px] px-3.5 rounded-xl bg-white dark:bg-[#151518] hover:bg-[#F1F5F9] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] text-xs font-semibold text-[#0F172A] dark:text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <Timer className="w-3.5 h-3.5 text-[#FF6B00]" />
                <span>Cronometrar</span>
              </button>
            </div>
          </div>

          {/* Card 2: Alongamento & Mobilidade Pós-Treino */}
          <div className="lg:col-span-6 rounded-2xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] p-4 sm:p-5 flex flex-col justify-between gap-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#FF6B00]">
                  <Wind className="w-4 h-4" />
                  <span>2. Alongamento & Volta à Calma</span>
                </span>
                <span className="px-2.5 py-0.5 rounded-lg bg-[#FF6B00]/15 text-[#FF6B00] font-mono text-xs font-bold tabular-nums">
                  {doneStretchCount}/{plan.stretches.length} concluídos · {plan.stretchingDurationMin} min
                </span>
              </div>

              <div>
                <h4 className="text-base font-extrabold text-[#0F172A] dark:text-white">
                  {plan.stretchingTitle}
                </h4>
                <p className="text-xs text-[#475569] dark:text-[#A1A1AA] mt-0.5">
                  {plan.stretchingNote}
                </p>
              </div>

              <div className="space-y-2">
                {plan.stretches.map((st, idx) => {
                  const isDone = Boolean(completedStretches[st.id]);
                  return (
                    <div
                      key={st.id}
                      className={`rounded-xl border p-3 transition-colors ${
                        isDone
                          ? "bg-emerald-500/10 border-emerald-500/40"
                          : "bg-white dark:bg-[#151518] border-[#E2E8F0] dark:border-[#26262B]"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-xs font-bold text-[#FF6B00]">
                              {idx + 1}.
                            </span>
                            <p className="text-xs font-bold text-[#0F172A] dark:text-white">
                              {st.name}
                            </p>
                            <span className="px-1.5 py-0.5 rounded bg-[#F1F5F9] dark:bg-[#0B0B0D] font-mono text-[10px] font-semibold text-[#475569] dark:text-[#A1A1AA]">
                              {st.sets}
                            </span>
                          </div>
                          <p className="mt-1 text-[11px] text-[#334155] dark:text-[#D4D4D8] leading-relaxed">
                            {st.instruction}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            toggleStretchDone(st.id, st.name, st.durationSec)
                          }
                          className={`min-h-[34px] px-2.5 rounded-lg text-[11px] font-bold flex items-center gap-1 shrink-0 transition-colors cursor-pointer ${
                            isDone
                              ? "bg-emerald-600 text-white"
                              : "bg-[#F8FAFC] dark:bg-[#0B0B0D] hover:bg-[#FF6B00] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00] text-[#0F172A] dark:text-white hover:text-white"
                          }`}
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>{isDone ? "Feito" : `${st.durationSec}s`}</span>
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="pt-2 border-t border-[#E2E8F0] dark:border-[#26262B] flex items-center justify-between gap-2">
              <span className="text-[11px] text-[#475569] dark:text-[#A1A1AA]">
                Clique no tempo de cada exercício para disparar o cronômetro
              </span>
              <button
                type="button"
                onClick={() => handleCompleteStretchProtocol(plan)}
                className="min-h-[40px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Concluir Alongamento</span>
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  };

  const renderExerciseList = (exerciseIds: string[]) => (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {exerciseIds.map((origId) => {
        const displayId = state.swappedExercises[origId] || origId;
        const ex = EXERCISE_MAP[displayId] || EXERCISE_MAP[origId];
        const origEx = EXERCISE_MAP[origId];
        if (!ex) return null;

        const log = state.exerciseLogs[ex.id] || {
          sets: ex.defaultSets,
          reps: ex.defaultReps,
          weightKg: ex.defaultWeightKg,
          lastWeightKg: ex.defaultWeightKg,
          completedSets: Array(ex.defaultSets).fill(false),
        };

        return (
          <ExerciseCard
            key={origId}
            exercise={ex}
            originalExerciseName={origEx?.name}
            isSwapped={displayId !== origId}
            log={log}
            onUpdateLog={(patch) => onUpdateExerciseLog(ex.id, patch)}
            onToggleSet={(setIdx) =>
              handleToggleWithAutoRest(ex.id, setIdx, ex.defaultRest)
            }
            onOpenGuide={(item) => setGuideExercise(item)}
            onSwapMachine={() => onSwapMachine(origId)}
            onStartRest={onStartRest}
          />
        );
      })}
    </div>
  );

  return (
    <div className="space-y-6 pb-20 md:pb-10">
      {/* Editable Goal bar at top of Treinos */}
      <GoalSelector
        goals={state.goals}
        onUpdateGoals={onUpdateGoals}
        compactDefault={true}
      />

      {/* Saved Personal IA Plan Panel (if exists) */}
      {state.savedPlan && (
        <section
          aria-label="Ficha salva pelo Personal IA"
          className="rounded-2xl bg-white dark:bg-[#151518] border border-[#FF6B00]/50 shadow-sm dark:shadow-none p-4 sm:p-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-xs text-[#FF6B00] font-semibold">
                <BookmarkCheck className="w-4 h-4 shrink-0" />
                <span>Minha Ficha Salva (Personal IA)</span>
              </div>
              <h3 className="mt-1 text-base sm:text-lg font-bold text-[#0F172A] dark:text-white truncate">
                {state.savedPlan.title}
              </h3>
              <p className="text-xs text-[#475569] dark:text-[#A1A1AA]">
                Foco: {state.savedPlan.muscleToday} · Salva em{" "}
                {new Intl.DateTimeFormat("pt-BR", {
                  day: "2-digit",
                  month: "2-digit",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(state.savedPlan.savedAt))}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => setShowSavedPlanContent((prev) => !prev)}
                className="min-h-[42px] px-4 rounded-xl bg-[#FF6B00] hover:bg-[#F97316] text-xs font-semibold text-white transition-colors whitespace-nowrap cursor-pointer"
              >
                {showSavedPlanContent ? "Ocultar ficha" : "Abrir ficha completa"}
              </button>
              <button
                type="button"
                onClick={onClearSavedPlan}
                aria-label="Remover ficha salva"
                className="min-h-[42px] min-w-[42px] rounded-xl bg-[#F1F5F9] dark:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] hover:border-red-500/60 text-[#64748B] dark:text-[#A1A1AA] hover:text-red-600 dark:hover:text-red-400 flex items-center justify-center transition-colors cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>

          {showSavedPlanContent && (
            <div className="mt-4 pt-4 border-t border-[#E2E8F0] dark:border-[#26262B] space-y-4">
              <div className="ai-prose text-sm">
                <ReactMarkdown>{state.savedPlan.content}</ReactMarkdown>
              </div>
              {state.savedPlan.matchedExerciseIds.length > 0 && (
                <div className="pt-3 border-t border-[#E2E8F0] dark:border-[#26262B]">
                  <p className="text-xs font-semibold text-[#FF6B00] mb-3">
                    Aparelhos identificados na ficha — marque suas séries e cargas:
                  </p>
                  {renderExerciseList(state.savedPlan.matchedExerciseIds)}
                </div>
              )}
              <div className="pt-3 border-t border-[#E2E8F0] dark:border-[#26262B]">
                {renderGoalCardioAndStretchingBlock(
                  state.savedPlan.muscleToday,
                  state.savedPlan.title
                )}
              </div>
            </div>
          )}
        </section>
      )}

      {/* Feedback toast banner */}
      {finishBanner && (
        <div
          role="status"
          className="rounded-xl bg-[#FF6B00]/12 dark:bg-[#FF6B00]/15 border border-[#FF6B00] px-4 py-3 text-sm text-[#0F172A] dark:text-white flex items-center gap-2.5"
        >
          <CheckCircle2 className="w-5 h-5 text-[#FF6B00] shrink-0" />
          <span>{finishBanner}</span>
        </div>
      )}

      {/* Botão Rápido: Exercícios para Lombar e Dor no Joelho */}
      <div className="rounded-2xl bg-white dark:bg-[#151518] border border-[#FF6B00]/40 shadow-sm dark:shadow-none p-3.5 sm:p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3 min-w-0">
          <div className="w-10 h-10 rounded-xl bg-[#FF6B00]/12 dark:bg-[#FF6B00]/15 border border-[#FF6B00]/30 flex items-center justify-center shrink-0">
            <ShieldAlert className="w-5 h-5 text-[#FF6B00]" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="text-xs font-extrabold uppercase tracking-wider text-[#FF6B00]">
                Proteção Articular & Alívio de Dor
              </span>
              {(activeCombo.id === "lombar_joelho" ||
                (subTab === "grupamentos" && selectedMuscle === "lombar_joelho")) && (
                <span className="px-2 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
                  Ativo agora
                </span>
              )}
            </div>
            <p className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-white">
              Exercícios para Lombar e Dor no Joelho
            </p>
            <p className="text-[11px] text-[#475569] dark:text-[#A1A1AA]">
              Fortalecimento sem impacto para estabilizar coluna lombar, glúteo médio, vasto medial e tendão patelar.
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => {
              onSelectCombo("lombar_joelho");
              setSubTab("combos");
              onToast(
                "Ficha 'Alívio Lombar & Proteção de Joelho' ativada com cardio zero impacto e alongamento descompressivo!",
                "success"
              );
            }}
            className={`min-h-[42px] px-4 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
              subTab === "combos" && activeCombo.id === "lombar_joelho"
                ? "bg-emerald-600 text-white"
                : "bg-[#FF6B00] hover:bg-[#F97316] text-white"
            }`}
          >
            <ShieldAlert className="w-4 h-4" />
            <span>
              {subTab === "combos" && activeCombo.id === "lombar_joelho"
                ? "Ficha Lombar & Joelho Ativa"
                : "Exercícios para Lombar e Dor no Joelho"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              setSelectedMuscle("lombar_joelho");
              setSubTab("grupamentos");
              onToast(
                "Exibindo lista de exercícios específicos para Lombar e Dor no Joelho.",
                "info"
              );
            }}
            className="min-h-[42px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] hover:bg-[#F1F5F9] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00] text-xs font-semibold text-[#0F172A] dark:text-white transition-colors cursor-pointer whitespace-nowrap"
          >
            Ver por exercício
          </button>
        </div>
      </div>

      {/* 3 Sub-tabs Segmented Control */}
      <div
        role="tablist"
        aria-label="Modos de treino"
        className="grid grid-cols-3 gap-1.5 p-1.5 rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none"
      >
        {(
          [
            { id: "combos", label: "Combinações Prontas" },
            { id: "grupamentos", label: "Por Grupamento" },
            { id: "modalidades", label: "Cardio & Modalidades" },
          ] as { id: SubTab; label: string }[]
        ).map((tab) => {
          const active = subTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              type="button"
              aria-selected={active}
              onClick={() => setSubTab(tab.id)}
              className={`min-h-[44px] px-2 sm:px-4 rounded-xl text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap truncate cursor-pointer ${
                active
                  ? "bg-[#FF6B00] text-white"
                  : "text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white hover:bg-[#F1F5F9] dark:hover:bg-[#1C1C21]"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {/* SUB-ABA 1: COMBINAÇÕES PRONTAS + MODO TREINO ATIVO */}
      {subTab === "combos" && (
        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-bold text-[#0F172A] dark:text-white">O que malhar hoje?</h2>
            <p className="text-xs text-[#475569] dark:text-[#A1A1AA] mt-0.5">
              Escolha sua divisão para ativar o modo treino com cargas e cronômetro automático.
            </p>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
              {WORKOUT_COMBOS.map((combo) => {
                const isSelected = combo.id === activeCombo.id;
                return (
                  <button
                    key={combo.id}
                    type="button"
                    onClick={() => onSelectCombo(combo.id)}
                    className={`text-left rounded-2xl p-4 border transition-colors cursor-pointer ${
                      isSelected
                        ? "bg-[#FF6B00]/10 dark:bg-[#FF6B00]/12 border-[#FF6B00]"
                        : "bg-white dark:bg-[#151518] border-[#E2E8F0] dark:border-[#26262B] hover:border-[#CBD5E1] dark:hover:border-[#3A3A42] shadow-sm dark:shadow-none"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 text-xs text-[#475569] dark:text-[#A1A1AA]">
                      <span className={isSelected ? "text-[#FF6B00] font-semibold" : ""}>
                        {combo.focusTag}
                      </span>
                      <span className="font-mono tabular-nums">
                        {combo.exerciseIds.length} ex · {combo.durationMin}m
                      </span>
                    </div>
                    <h3 className="mt-1.5 text-base font-bold text-[#0F172A] dark:text-white">{combo.title}</h3>
                    <p className="mt-1 text-xs text-[#475569] dark:text-[#A1A1AA] line-clamp-2">{combo.subtitle}</p>
                    <p className="mt-2 pt-2 border-t border-[#E2E8F0] dark:border-[#26262B] text-[11px] font-semibold text-[#FF6B00] flex items-center gap-1.5">
                      <Flame className="w-3 h-3 shrink-0" />
                      <span className="truncate">+ Cardio & Alongamento do objetivo</span>
                    </p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Active Workout Header & Progress */}
          <div className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 text-xs text-[#475569] dark:text-[#A1A1AA]">
                <Dumbbell className="w-4 h-4 text-[#FF6B00]" />
                <span>Modo Treino Ativo</span>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {comboProgress.done}/{comboProgress.total} séries concluídas
                </span>
              </div>
              <h3 className="mt-1 text-xl font-extrabold text-[#0F172A] dark:text-white">{activeCombo.title}</h3>
              <div className="mt-2.5 h-2 w-full max-w-md rounded-full bg-[#E2E8F0] dark:bg-[#26262B] overflow-hidden">
                <div
                  className="h-full rounded-full bg-[#FF6B00] transition-[width] duration-300"
                  style={{ width: `${comboProgress.pct}%` }}
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2.5 shrink-0">
              <button
                type="button"
                onClick={() => setSubTab("modalidades")}
                className="min-h-[48px] px-4 py-3 rounded-xl bg-[#F8FAFC] dark:bg-[#1C1C21] hover:bg-[#FF6B00]/10 border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00] text-xs sm:text-sm font-bold text-[#0F172A] dark:text-white flex items-center justify-center gap-2 transition-all whitespace-nowrap cursor-pointer"
              >
                <Flame className="w-4 h-4 text-[#FF6B00]" />
                <span>Controle de Cardio</span>
              </button>

              <button
                type="button"
                onClick={handleCompleteActiveCombo}
                className="min-h-[48px] px-5 py-3 rounded-xl bg-[#FF6B00] hover:bg-[#F97316] active:scale-[0.98] text-sm font-bold text-white flex items-center justify-center gap-2 transition-all whitespace-nowrap shrink-0 cursor-pointer"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>Finalizar Treino</span>
              </button>
            </div>
          </div>

          {/* Active Combo Exercises */}
          {renderExerciseList(activeCombo.exerciseIds)}

          {/* Mandatory Goal-Tailored Cardio & Stretching for Active Combo */}
          {renderGoalCardioAndStretchingBlock(activeCombo.id, activeCombo.title)}
        </div>
      )}

      {/* SUB-ABA 2: POR GRUPAMENTO MUSCULAR */}
      {subTab === "grupamentos" && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2">
            {MUSCLE_GROUPS.map((grp) => {
              const active = selectedMuscle === grp.id;
              return (
                <button
                  key={grp.id}
                  type="button"
                  onClick={() => setSelectedMuscle(grp.id)}
                  className={`min-h-[42px] px-4 rounded-xl text-xs sm:text-sm font-semibold border transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? "bg-[#FF6B00] border-[#FF6B00] text-white"
                      : "bg-white dark:bg-[#151518] border-[#E2E8F0] dark:border-[#26262B] text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white hover:border-[#CBD5E1] dark:hover:border-[#3A3A42] shadow-xs dark:shadow-none"
                  }`}
                >
                  {grp.label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-bold text-[#0F172A] dark:text-white">
                {MUSCLE_GROUPS.find((g) => g.id === selectedMuscle)?.label}
              </h2>
              <p className="text-xs text-[#475569] dark:text-[#A1A1AA]">
                {muscleExercises.length} aparelhos e exercícios disponíveis na academia + protocolo de cardio e alongamento
              </p>
            </div>
            <button
              type="button"
              onClick={handleCompleteMuscleGroup}
              className="self-start sm:self-auto min-h-[44px] px-4 rounded-xl bg-white dark:bg-[#1C1C21] hover:bg-[#FF6B00] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00] shadow-xs dark:shadow-none text-xs font-semibold text-[#0F172A] dark:text-white hover:text-white flex items-center gap-2 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Registrar treino deste grupo</span>
            </button>
          </div>

          {renderExerciseList(muscleExercises.map((e) => e.id))}

          {/* Mandatory Goal-Tailored Cardio & Stretching for Selected Muscle Group */}
          {renderGoalCardioAndStretchingBlock(
            selectedMuscle,
            MUSCLE_GROUPS.find((g) => g.id === selectedMuscle)?.label || selectedMuscle
          )}
        </div>
      )}

      {/* SUB-ABA 3: MODALIDADES DE ACADEMIA */}
      {subTab === "modalidades" && (
        <div className="space-y-6">
          {/* Editorial Cardio Zone Banner */}
          <div className="relative rounded-2xl overflow-hidden border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none min-h-[180px] flex items-end">
            {!cardioImgErr ? (
              <img
                src={CARDIO_BANNER}
                alt="Área de cardio e treinamento funcional da academia com esteiras inclinadas, corda naval e kettlebells"
                referrerPolicy="no-referrer"
                onError={() => setCardioImgErr(true)}
                className="absolute inset-0 w-full h-full object-cover object-center"
              />
            ) : (
              <div className="absolute inset-0 bg-gradient-to-r from-[#1C1C21] to-[#151518]" />
            )}
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-t from-[#0B0B0D] via-[#0B0B0D]/75 to-transparent"
            />
            <div className="relative z-10 p-5 sm:p-6">
              <p className="text-xs font-semibold text-[#FF6B00]">
                Aceleração de Gasto Calórico Natural
              </p>
              <h2 className="mt-1 text-xl sm:text-2xl font-extrabold text-white">
                Modalidades de Academia
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-[#D4D4D8] max-w-xl">
                Controle completo de exercícios de cardio com cronômetro ao vivo, cálculo de calorias pelo seu peso atual ({state.profile.weightKg} kg) e protocolos de academia.
              </p>
            </div>
          </div>

          {/* PAINEL COMPLETO: CONTROLE DE EXERCÍCIOS DE CARDIO */}
          <section
            aria-label="Controle de exercícios de cardio"
            className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none p-5 sm:p-6 space-y-6"
          >
            {/* Header + Weekly Cardio Goal Progress */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#E2E8F0] dark:border-[#26262B]">
              <div>
                <div className="flex items-center gap-2 text-xs font-semibold text-[#FF6B00]">
                  <Activity className="w-4 h-4" />
                  <span>Controle de Exercícios de Cardio</span>
                </div>
                <h3 className="mt-1 text-lg sm:text-xl font-extrabold text-[#0F172A] dark:text-white">
                  Registrar & Cronometrar Cardio
                </h3>
                <p className="mt-0.5 text-xs text-[#475569] dark:text-[#A1A1AA]">
                  Gasto calórico calculado automaticamente para o seu peso atual de{" "}
                  <strong className="font-mono text-[#0F172A] dark:text-white">
                    {state.profile.weightKg} kg
                  </strong>
                  .
                </p>
              </div>

              {/* Weekly Goal Progress Card */}
              <div className="w-full lg:w-80 rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] p-3.5 space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#334155] dark:text-[#D4D4D8]">
                    Meta semanal de cardio
                  </span>
                  <span className="font-mono font-bold tabular-nums text-[#FF6B00]">
                    {cardioStats.weeklyMin} / {WEEKLY_CARDIO_GOAL_MIN} min (
                    {cardioStats.weeklyPct}%)
                  </span>
                </div>
                <div className="h-2 w-full rounded-full bg-[#E2E8F0] dark:bg-[#26262B] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#FF6B00] transition-[width] duration-300"
                    style={{ width: `${cardioStats.weeklyPct}%` }}
                  />
                </div>
                <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] text-[#475569] dark:text-[#A1A1AA] font-mono tabular-nums">
                  <span>{cardioStats.count} sessões</span>
                  <span className="text-center">{cardioStats.totalKm} km</span>
                  <span className="text-right text-[#FF6B00] font-semibold">
                    {cardioStats.totalKcal} kcal
                  </span>
                </div>
              </div>
            </div>

            {/* Grid: Live Cardio Stopwatch + Manual Cardio Logger Form */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
              {/* Left Column: Live Cardio Stopwatch */}
              <div className="lg:col-span-5 rounded-2xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] p-4 sm:p-5 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Timer className="w-4 h-4 text-[#FF6B00]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-[#0F172A] dark:text-white">
                      Cronômetro de Cardio ao Vivo
                    </span>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-md text-[11px] font-semibold ${
                      cardioStopwatchRunning
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                        : "bg-[#E2E8F0] dark:bg-[#1C1C21] text-[#475569] dark:text-[#A1A1AA]"
                    }`}
                  >
                    {cardioStopwatchRunning ? "Em andamento" : "Pronto"}
                  </span>
                </div>

                <div className="text-center py-3 rounded-xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B]">
                  <p className="font-mono text-4xl sm:text-5xl font-extrabold tabular-nums text-[#0F172A] dark:text-white tracking-tight">
                    {formatStopwatch(cardioStopwatchSec)}
                  </p>
                  <p className="mt-1.5 text-xs text-[#475569] dark:text-[#A1A1AA]">
                    {selectedCardioEquipment.shortLabel} · {cardioIntensity} ·{" "}
                    <span className="font-mono font-bold text-[#FF6B00] tabular-nums">
                      ~{liveStopwatchKcal} kcal
                    </span>
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => setCardioStopwatchRunning((prev) => !prev)}
                    className={`min-h-[44px] px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer ${
                      cardioStopwatchRunning
                        ? "bg-amber-500 hover:bg-amber-600 text-white"
                        : "bg-[#FF6B00] hover:bg-[#F97316] text-white"
                    }`}
                  >
                    {cardioStopwatchRunning ? (
                      <>
                        <Pause className="w-4 h-4" />
                        <span>Pausar</span>
                      </>
                    ) : (
                      <>
                        <Play className="w-4 h-4" />
                        <span>{cardioStopwatchSec > 0 ? "Retomar" : "Iniciar Cardio"}</span>
                      </>
                    )}
                  </button>

                  <button
                    type="button"
                    disabled={cardioStopwatchSec === 0}
                    onClick={() => {
                      setCardioStopwatchRunning(false);
                      setCardioStopwatchSec(0);
                    }}
                    className="min-h-[44px] px-3 rounded-xl bg-white dark:bg-[#151518] hover:bg-[#F1F5F9] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] text-xs font-semibold text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Zerar</span>
                  </button>
                </div>

                {cardioStopwatchSec > 0 && (
                  <button
                    type="button"
                    onClick={handleFinishLiveCardioStopwatch}
                    className="w-full min-h-[44px] px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white flex items-center justify-center gap-2 transition-colors cursor-pointer"
                  >
                    <CheckCircle2 className="w-4 h-4" />
                    <span>
                      Concluir e Salvar ({Math.max(1, Math.round(cardioStopwatchSec / 60))}{" "}
                      min)
                    </span>
                  </button>
                )}
              </div>

              {/* Right Column: Cardio Session Form */}
              <form
                onSubmit={handleSaveCardioForm}
                className="lg:col-span-7 space-y-4"
              >
                {/* 1. Aparelho / Exercício de Cardio */}
                <div>
                  <label
                    htmlFor="cardio-equipment"
                    className="block text-xs font-semibold text-[#334155] dark:text-[#D4D4D8] mb-1.5"
                  >
                    Aparelho / Exercício de Cardio
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {CARDIO_EQUIPMENT_OPTIONS.map((item) => {
                      const active = item.id === cardioEquipmentId;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => setCardioEquipmentId(item.id)}
                          className={`min-h-[40px] px-3 py-2 rounded-xl text-xs font-semibold border text-left transition-colors cursor-pointer ${
                            active
                              ? "bg-[#FF6B00] border-[#FF6B00] text-white"
                              : "bg-[#F8FAFC] dark:bg-[#0B0B0D] border-[#E2E8F0] dark:border-[#26262B] text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white"
                          }`}
                        >
                          {item.shortLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 2. Intensidade */}
                <div>
                  <span className="block text-xs font-semibold text-[#334155] dark:text-[#D4D4D8] mb-1.5">
                    Intensidade ·{" "}
                    <span className="font-normal text-[#64748B] dark:text-[#A1A1AA]">
                      {selectedIntensityMeta.zone}
                    </span>
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    {CARDIO_INTENSITIES.map((intItem) => {
                      const active = intItem.id === cardioIntensity;
                      return (
                        <button
                          key={intItem.id}
                          type="button"
                          onClick={() => setCardioIntensity(intItem.id)}
                          className={`min-h-[40px] px-2.5 rounded-xl text-xs font-bold border transition-colors cursor-pointer ${
                            active
                              ? "bg-[#FF6B00] border-[#FF6B00] text-white"
                              : "bg-[#F8FAFC] dark:bg-[#0B0B0D] border-[#E2E8F0] dark:border-[#26262B] text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white"
                          }`}
                        >
                          {intItem.label}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Duração (min), Distância (km) e Calorias (kcal) */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label
                      htmlFor="cardio-duration"
                      className="block text-xs text-[#475569] dark:text-[#A1A1AA] mb-1"
                    >
                      Duração (min) *
                    </label>
                    <input
                      id="cardio-duration"
                      type="number"
                      min={1}
                      max={480}
                      required
                      value={cardioDurationMin}
                      onChange={(e) => setCardioDurationMin(e.target.value)}
                      className="w-full min-h-[42px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3 font-mono text-sm font-bold tabular-nums text-[#0F172A] dark:text-white"
                    />
                    <div className="mt-1.5 flex flex-wrap gap-1">
                      {[15, 20, 30, 45, 60].map((m) => (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setCardioDurationMin(String(m))}
                          className={`px-2 py-0.5 rounded-md font-mono text-[11px] font-semibold border cursor-pointer transition-colors ${
                            Number(cardioDurationMin) === m
                              ? "bg-[#FF6B00]/15 border-[#FF6B00] text-[#FF6B00]"
                              : "bg-[#F8FAFC] dark:bg-[#0B0B0D] border-[#E2E8F0] dark:border-[#26262B] text-[#64748B] dark:text-[#A1A1AA]"
                          }`}
                        >
                          {m}m
                        </button>
                      ))}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="cardio-distance"
                      className="block text-xs text-[#475569] dark:text-[#A1A1AA] mb-1"
                    >
                      Distância (km — opcional)
                    </label>
                    <input
                      id="cardio-distance"
                      type="number"
                      step="0.1"
                      min={0}
                      max={200}
                      value={cardioDistanceKm}
                      onChange={(e) => setCardioDistanceKm(e.target.value)}
                      placeholder="Ex.: 3.2"
                      className="w-full min-h-[42px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3 font-mono text-sm tabular-nums text-[#0F172A] dark:text-white placeholder:text-[#94A3B8] dark:placeholder:text-[#52525B]"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="cardio-kcal"
                      className="block text-xs text-[#475569] dark:text-[#A1A1AA] mb-1"
                    >
                      Gasto Estimado (kcal)
                    </label>
                    <input
                      id="cardio-kcal"
                      type="number"
                      min={1}
                      max={5000}
                      value={cardioCustomKcal}
                      onChange={(e) => setCardioCustomKcal(e.target.value)}
                      placeholder={`${estimatedCardioKcal} kcal (auto)`}
                      className="w-full min-h-[42px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3 font-mono text-sm font-semibold tabular-nums text-[#FF6B00] placeholder:text-[#FF6B00]/80"
                    />
                  </div>
                </div>

                {/* 4. Regulagem / Velocidade / Inclinação + Botão Salvar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-end gap-3">
                  <div className="flex-1">
                    <label
                      htmlFor="cardio-notes"
                      className="block text-xs text-[#475569] dark:text-[#A1A1AA] mb-1"
                    >
                      Velocidade / Inclinação / Observação (opcional)
                    </label>
                    <input
                      id="cardio-notes"
                      type="text"
                      maxLength={50}
                      value={cardioNotes}
                      onChange={(e) => setCardioNotes(e.target.value)}
                      placeholder={selectedCardioEquipment.defaultNotes}
                      className="w-full min-h-[44px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3.5 text-xs text-[#0F172A] dark:text-white placeholder:text-[#94A3B8] dark:placeholder:text-[#52525B]"
                    />
                  </div>

                  <button
                    type="submit"
                    className="min-h-[44px] px-5 rounded-xl bg-[#FF6B00] hover:bg-[#F97316] active:scale-[0.98] text-xs sm:text-sm font-bold text-white flex items-center justify-center gap-2 transition-all whitespace-nowrap cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                    <span>
                      Registrar Cardio (
                      {cardioCustomKcal.trim() || estimatedCardioKcal} kcal)
                    </span>
                  </button>
                </div>
              </form>
            </div>

            {/* Histórico Recente de Cardio */}
            {cardioSessions.length > 0 && (
              <div className="pt-4 border-t border-[#E2E8F0] dark:border-[#26262B] space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[#475569] dark:text-[#A1A1AA]">
                    Últimas Sessões de Cardio Registradas ({cardioSessions.length})
                  </h4>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {cardioSessions.slice(0, 6).map((item) => (
                    <div
                      key={item.id}
                      className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] px-3.5 py-2.5 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 text-[11px] text-[#475569] dark:text-[#A1A1AA]">
                          <span className="font-mono tabular-nums">
                            {item.date.split("-").reverse().join("/")}
                          </span>
                          <span>·</span>
                          <span className="text-[#FF6B00] font-semibold">
                            {item.muscleGroup}
                          </span>
                          <span>·</span>
                          <span className="font-mono font-semibold text-[#0F172A] dark:text-white tabular-nums">
                            {item.durationMin} min
                          </span>
                        </div>
                        <p className="mt-0.5 text-xs font-bold text-[#0F172A] dark:text-white truncate">
                          {item.title}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => {
                          onDeleteWorkoutSession(item.id);
                          onToast("Sessão de cardio removida.", "info");
                        }}
                        aria-label="Excluir sessão de cardio"
                        className="min-h-[32px] min-w-[32px] rounded-lg text-[#64748B] dark:text-[#A1A1AA] hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-[#151518] flex items-center justify-center transition-colors cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>

          {/* Filter buttons for Pre-set Gym Modalities */}
          <div className="flex flex-wrap gap-2">
            {(["Todas", "Cardio", "Funcional", "Spinning", "Pilates/Mobilidade"] as const).map(
              (cat) => {
                const active = modalityFilter === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setModalityFilter(cat)}
                    className={`min-h-[42px] px-4 rounded-xl text-xs font-semibold border transition-colors whitespace-nowrap cursor-pointer ${
                      active
                        ? "bg-[#FF6B00] border-[#FF6B00] text-white"
                        : "bg-white dark:bg-[#151518] border-[#E2E8F0] dark:border-[#26262B] text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white shadow-xs dark:shadow-none"
                    }`}
                  >
                    {cat}
                  </button>
                );
              }
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {filteredModalities.map((mod) => {
              const justLogged = loggedModalityId === mod.id;
              return (
                <article
                  key={mod.id}
                  className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none p-5 flex flex-col justify-between gap-4"
                >
                  <div className="flex items-start gap-3.5">
                    <ExerciseVisual
                      name={mod.title}
                      muscleGroup="cardio"
                      muscleLabel={mod.category}
                      equipment={mod.equipment}
                      imageUrl={mod.imageUrl}
                      secondaryImageUrl={mod.secondaryImageUrl}
                      variant="thumbnail"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2 text-xs text-[#475569] dark:text-[#A1A1AA]">
                        <span className="text-[#FF6B00] font-semibold">{mod.category}</span>
                        <span className="font-mono tabular-nums">
                          {mod.durationMin} min · {mod.calorieEstimate}
                        </span>
                      </div>
                      <h3 className="mt-1 text-base sm:text-lg font-bold text-[#0F172A] dark:text-white leading-snug">
                        {mod.title}
                      </h3>
                      <p className="mt-1.5 text-xs sm:text-sm text-[#334155] dark:text-[#D4D4D8] leading-relaxed">
                        {mod.protocol}
                      </p>
                    </div>
                  </div>
                  <div className="pt-3 border-t border-[#E2E8F0] dark:border-[#26262B] text-xs text-[#475569] dark:text-[#A1A1AA] leading-relaxed">
                    <span className="text-[#0F172A] dark:text-white font-semibold">Dica técnica: </span>
                    {mod.tip}
                  </div>

                  <div className="flex items-center justify-between gap-3 pt-2">
                    <div className="flex items-center gap-3 text-xs text-[#475569] dark:text-[#A1A1AA]">
                      <span className="flex items-center gap-1">
                        <Flame className="w-3.5 h-3.5 text-[#FF6B00]" />
                        {mod.intensity}
                      </span>
                      <span className="flex items-center gap-1 font-mono tabular-nums">
                        <Clock className="w-3.5 h-3.5" />
                        {mod.durationMin}m
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleLogModalityClick(mod)}
                      className={`min-h-[42px] px-4 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                        justLogged
                          ? "bg-emerald-600 text-white"
                          : "bg-[#F1F5F9] dark:bg-[#1C1C21] hover:bg-[#FF6B00] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00] text-[#0F172A] dark:text-white hover:text-white"
                      }`}
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{justLogged ? "Sessão registrada!" : "Concluir sessão"}</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      )}

      {/* Modal: Como executar na máquina (Guia Visual + Animação + YouTube) */}
      {guideExercise && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="guide-modal-title"
          className="fixed inset-0 z-50 bg-black/70 dark:bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setGuideExercise(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-xl rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-2xl dark:shadow-none p-5 sm:p-6 max-h-[90vh] overflow-y-auto"
          >
            <div className="w-10 h-1.5 rounded-full bg-[#CBD5E1] dark:bg-[#26262B] mx-auto mb-4 sm:hidden" />

            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold text-[#FF6B00]">
                  {guideExercise.equipment} · {guideExercise.muscleLabel}
                </p>
                <h3
                  id="guide-modal-title"
                  className="mt-1 text-xl font-extrabold text-[#0F172A] dark:text-white"
                >
                  {guideExercise.name}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setGuideExercise(null)}
                aria-label="Fechar guia"
                className="min-h-[44px] min-w-[44px] rounded-xl bg-[#F1F5F9] dark:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white flex items-center justify-center cursor-pointer shrink-0"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Interactive Animated Exercise Demonstration (Posição 1 <-> Posição 2) */}
            <div className="mt-4">
              <ExerciseVisual
                name={guideExercise.name}
                muscleGroup={guideExercise.muscleGroup}
                muscleLabel={guideExercise.muscleLabel}
                equipment={guideExercise.equipment}
                imageUrl={guideExercise.imageUrl}
                secondaryImageUrl={guideExercise.secondaryImageUrl}
                variant="modal"
              />
            </div>

            {/* 3 Structured Execution Guidelines */}
            <div className="mt-5 space-y-3.5">
              <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-[#0F172A] dark:text-white">
                  <Settings2 className="w-4 h-4 text-[#FF6B00] shrink-0" />
                  <span>1. Regulagem na Máquina</span>
                </div>
                <p className="mt-1.5 text-sm text-[#334155] dark:text-[#D4D4D8] leading-relaxed">
                  {guideExercise.guide.machineSetup}
                </p>
              </div>

              <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] p-4">
                <div className="flex items-center gap-2 text-xs font-bold text-[#0F172A] dark:text-white">
                  <Info className="w-4 h-4 text-[#FF6B00] shrink-0" />
                  <span>2. Execução Passo a Passo</span>
                </div>
                <p className="mt-1.5 text-sm text-[#334155] dark:text-[#D4D4D8] leading-relaxed">
                  {guideExercise.guide.posture}
                </p>
              </div>

              <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] p-4 space-y-2.5">
                <div className="flex items-center gap-2 text-xs font-bold text-[#0F172A] dark:text-white">
                  <Wind className="w-4 h-4 text-[#FF6B00] shrink-0" />
                  <span>3. Respiração e Erro Comum</span>
                </div>
                {guideExercise.guide.breathing && (
                  <p className="text-sm text-[#334155] dark:text-[#D4D4D8] leading-relaxed">
                    <strong className="text-[#0F172A] dark:text-white font-semibold">Respiração: </strong>
                    {guideExercise.guide.breathing}
                  </p>
                )}
                <div className="pt-2 border-t border-[#E2E8F0] dark:border-[#26262B] flex items-start gap-2 text-sm text-[#334155] dark:text-[#D4D4D8] leading-relaxed">
                  <AlertTriangle className="w-4 h-4 text-[#FF6B00] shrink-0 mt-0.5" />
                  <p>
                    <strong className="text-[#EA580C] dark:text-orange-300 font-semibold">Evite: </strong>
                    {guideExercise.guide.commonMistake}
                  </p>
                </div>
              </div>
            </div>

            {/* Footer Actions: YouTube Video Link + Close */}
            <div className="mt-5 flex flex-col sm:flex-row gap-2.5">
              <a
                href={`https://www.youtube.com/results?search_query=${encodeURIComponent(
                  `como fazer ${guideExercise.name} execução correta academia`
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex-1 min-h-[46px] px-4 rounded-xl bg-[#F1F5F9] dark:bg-[#1C1C22] hover:bg-[#E2E8F0] dark:hover:bg-[#25252D] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00]/60 text-xs sm:text-sm font-semibold text-[#0F172A] dark:text-white flex items-center justify-center gap-2 transition-colors whitespace-nowrap"
              >
                <ExternalLink className="w-4 h-4 text-[#FF6B00] shrink-0" />
                <span>Ver execução em vídeo (YouTube)</span>
              </a>

              <button
                type="button"
                onClick={() => setGuideExercise(null)}
                className="sm:w-auto px-5 min-h-[46px] rounded-xl bg-[#FF6B00] hover:bg-[#F97316] text-sm font-bold text-white transition-colors whitespace-nowrap cursor-pointer"
              >
                Voltar ao treino
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
