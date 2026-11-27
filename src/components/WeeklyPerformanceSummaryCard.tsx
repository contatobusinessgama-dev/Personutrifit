import React, { useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { motion } from "motion/react";
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Check,
  Copy,
  RefreshCw,
  Sparkles,
  Square,
  TrendingUp,
} from "lucide-react";
import { EXERCISES, MUSCLE_GROUPS } from "../data/exercises";
import {
  BiancoAppState,
  MetabolicResult,
  TabId,
} from "../types";
import {
  AiLoadingPhase,
  AiRetryInfo,
  generateWithFallback,
  getAiToastNotification,
  isAbortedAiError,
} from "../services/geminiService";
import { getFirstName } from "../utils/metabolism";
import { CARD_HOVER_TRANSITION } from "../utils/motion";
import { AiStreamingFooter, AiTypingIndicator } from "./AiTypingIndicator";

const STORAGE_KEY = "personal_nutri_fit_weekly_performance_summary_v1";

interface SavedWeeklySummary {
  content: string;
  generatedAt: string;
  workoutCount: number;
  volumeKg: number;
}

interface ExerciseLoadHighlight {
  id: string;
  name: string;
  muscleLabel: string;
  sets: number;
  reps: string;
  weightKg: number;
  lastWeightKg: number;
  deltaKg: number;
  estimatedSessionTonnage: number;
}

interface WeeklyPerformanceSummaryCardProps {
  state: BiancoAppState;
  metabolism: MetabolicResult;
  streakDays: number;
  onNavigateTab: (tab: TabId) => void;
  onToast: (message: string, tone?: "success" | "info" | "warning") => void;
}

function getIsoDaysAgo(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseAvgReps(repsStr: string): number {
  const matches = repsStr.match(/\d+/g);
  if (!matches || matches.length === 0) return 10;
  const nums = matches.map(Number).filter((n) => Number.isFinite(n) && n > 0);
  if (nums.length === 0) return 10;
  const avg = nums.reduce((a, b) => a + b, 0) / nums.length;
  return Math.max(1, Math.min(30, avg));
}

function formatDateBr(isoDate: string): string {
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}`;
}

function formatTimestampBr(iso: string): string {
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function loadSavedSummary(): SavedWeeklySummary | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<SavedWeeklySummary>;
    if (typeof parsed.content === "string" && parsed.content.trim().length > 0) {
      return {
        content: parsed.content,
        generatedAt:
          typeof parsed.generatedAt === "string"
            ? parsed.generatedAt
            : new Date().toISOString(),
        workoutCount: Number(parsed.workoutCount) || 0,
        volumeKg: Number(parsed.volumeKg) || 0,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export const WeeklyPerformanceSummaryCard: React.FC<
  WeeklyPerformanceSummaryCardProps
> = ({ state, metabolism, streakDays, onNavigateTab, onToast }) => {
  const [savedSummary, setSavedSummary] = useState<SavedWeeklySummary | null>(() =>
    loadSavedSummary()
  );
  const [streamedContent, setStreamedContent] = useState<string>("");
  const [loadingPhase, setLoadingPhase] = useState<AiLoadingPhase>("idle");
  const [retryInfo, setRetryInfo] = useState<AiRetryInfo | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  const isLoading = loadingPhase !== "idle";

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  const analytics = useMemo(() => {
    const weekCutoff = getIsoDaysAgo(6);
    const prevWeekStart = getIsoDaysAgo(13);

    const thisWeekWorkouts = state.workoutHistory
      .filter((w) => w.date >= weekCutoff)
      .sort((a, b) => b.date.localeCompare(a.date));

    const prevWeekWorkouts = state.workoutHistory.filter(
      (w) => w.date >= prevWeekStart && w.date < weekCutoff
    );

    const totalVolumeKg = thisWeekWorkouts.reduce(
      (sum, w) => sum + Math.max(0, Math.round(w.totalVolumeKg || 0)),
      0
    );
    const prevVolumeKg = prevWeekWorkouts.reduce(
      (sum, w) => sum + Math.max(0, Math.round(w.totalVolumeKg || 0)),
      0
    );
    const totalSets = thisWeekWorkouts.reduce(
      (sum, w) => sum + Math.max(0, Math.round(w.setsCompleted || 0)),
      0
    );
    const totalDurationMin = thisWeekWorkouts.reduce(
      (sum, w) => sum + Math.max(0, Math.round(w.durationMin || 0)),
      0
    );

    const volumeDeltaPct =
      prevVolumeKg > 0
        ? Math.round(((totalVolumeKg - prevVolumeKg) / prevVolumeKg) * 100)
        : null;

    const trainedGroupsMap = new Map<string, number>();
    for (const w of thisWeekWorkouts) {
      const label = (w.muscleGroup || w.title || "Geral").trim();
      trainedGroupsMap.set(label, (trainedGroupsMap.get(label) || 0) + 1);
    }
    const trainedGroups = Array.from(trainedGroupsMap.entries()).map(
      ([group, sessions]) => ({ group, sessions })
    );

    // Build exercise load highlights from exerciseLogs cross-referenced with EXERCISES
    const exerciseMap = new Map(EXERCISES.map((ex) => [ex.id, ex]));
    const loadEntries: ExerciseLoadHighlight[] = [];

    for (const [exId, log] of Object.entries(state.exerciseLogs)) {
      if (!log || typeof log.weightKg !== "number" || log.weightKg <= 0) continue;
      const meta = exerciseMap.get(exId);
      const name = meta?.name || exId.replace(/_/g, " ");
      const muscleLabel = meta?.muscleLabel || "Musculação";
      const lastWeightKg =
        typeof log.lastWeightKg === "number" && log.lastWeightKg > 0
          ? log.lastWeightKg
          : log.weightKg;
      const deltaKg = Number((log.weightKg - lastWeightKg).toFixed(1));
      const sets = Math.max(1, Number(log.sets) || 3);
      const avgReps = parseAvgReps(log.reps || "10-12");
      const estimatedSessionTonnage = Math.round(sets * avgReps * log.weightKg);

      loadEntries.push({
        id: exId,
        name,
        muscleLabel,
        sets,
        reps: log.reps || "10-12",
        weightKg: log.weightKg,
        lastWeightKg,
        deltaKg,
        estimatedSessionTonnage,
      });
    }

    const progressedLoads = loadEntries
      .filter((e) => e.deltaKg > 0)
      .sort((a, b) => b.deltaKg - a.deltaKg);

    const heaviestLoads = [...loadEntries]
      .sort((a, b) => b.weightKg - a.weightKg)
      .slice(0, 6);

    const topHighlights = [
      ...progressedLoads.slice(0, 3),
      ...heaviestLoads.filter(
        (h) => !progressedLoads.slice(0, 3).some((p) => p.id === h.id)
      ),
    ].slice(0, 4);

    // Identify muscle groups without logged workout in last 7 days
    const trainedText = thisWeekWorkouts
      .map((w) => `${w.muscleGroup} ${w.title}`.toLowerCase())
      .join(" ");
    const coreMuscleLabels = MUSCLE_GROUPS.filter(
      (g) => g.id !== "lombar_joelho" && g.id !== "abdomen_panturrilha"
    );
    const undertrainedGroups = coreMuscleLabels
      .filter((g) => {
        const token = g.shortLabel.toLowerCase().split("/")[0].slice(0, 4);
        return !trainedText.includes(token);
      })
      .map((g) => g.label);

    return {
      thisWeekWorkouts,
      prevWeekWorkouts,
      totalVolumeKg,
      prevVolumeKg,
      volumeDeltaPct,
      totalSets,
      totalDurationMin,
      trainedGroups,
      loadEntries,
      progressedLoads,
      heaviestLoads,
      topHighlights,
      undertrainedGroups,
    };
  }, [state.workoutHistory, state.exerciseLogs]);

  const latestMeasurement = useMemo(() => {
    if (state.measurements.length === 0) return null;
    const sorted = [...state.measurements].sort((a, b) =>
      b.date.localeCompare(a.date)
    );
    return sorted[0];
  }, [state.measurements]);

  const buildWeeklySummaryPrompt = () => {
    const firstName = getFirstName(state.profile.name);
    const targetFreq = state.profile.weeklyFrequency || 4;

    const workoutsLines =
      analytics.thisWeekWorkouts.length > 0
        ? analytics.thisWeekWorkouts
            .map(
              (w) =>
                `- ${formatDateBr(w.date)}: ${w.title} (${w.muscleGroup}) — ${w.setsCompleted} séries, volume total ${Math.round(
                  w.totalVolumeKg || 0
                ).toLocaleString("pt-BR")} kg, duração ${w.durationMin} min`
            )
            .join("\n")
        : "- Nenhum treino finalizado registrado nos últimos 7 dias.";

    const recentHistoryFallback =
      analytics.thisWeekWorkouts.length === 0 && state.workoutHistory.length > 0
        ? state.workoutHistory
            .slice(0, 4)
            .map(
              (w) =>
                `- ${formatDateBr(w.date)}: ${w.title} (${w.muscleGroup}) — ${Math.round(
                  w.totalVolumeKg || 0
                ).toLocaleString("pt-BR")} kg`
            )
            .join("\n")
        : "";

    const loadsLines =
      analytics.loadEntries.length > 0
        ? [...analytics.loadEntries]
            .sort((a, b) => {
              if (b.deltaKg !== a.deltaKg) return b.deltaKg - a.deltaKg;
              return b.weightKg - a.weightKg;
            })
            .slice(0, 14)
            .map((item) => {
              const deltaText =
                item.deltaKg > 0
                  ? `evolução +${item.deltaKg} kg (era ${item.lastWeightKg} kg)`
                  : item.deltaKg < 0
                  ? `ajuste ${item.deltaKg} kg (era ${item.lastWeightKg} kg)`
                  : "carga mantida";
              return `- ${item.name} [${item.muscleLabel}]: ${item.sets}x${item.reps} com ${item.weightKg} kg (${deltaText})`;
            })
            .join("\n")
        : "- Ainda não há cargas personalizadas registradas na aba Treinos.";

    const undertrainedLine =
      analytics.undertrainedGroups.length > 0
        ? analytics.undertrainedGroups.join(", ")
        : "Todos os principais grupos musculares foram estimulados.";

    return [
      `Gere o **Resumo de Performance Semanal** completo para ${firstName} com base nos dados reais abaixo.`,
      "",
      "DADOS DOS TREINOS COMPLETADOS NOS ÚLTIMOS 7 DIAS:",
      `- Frequência cumprida: ${analytics.thisWeekWorkouts.length} de ${targetFreq} treinos planejados na semana`,
      `- Sequência atual (streak): ${streakDays} ${streakDays === 1 ? "dia" : "dias"}`,
      `- Volume total levantado nos últimos 7 dias: ${analytics.totalVolumeKg.toLocaleString("pt-BR")} kg${
        analytics.volumeDeltaPct !== null
          ? ` (${analytics.volumeDeltaPct >= 0 ? "+" : ""}${analytics.volumeDeltaPct}% vs. semana anterior de ${analytics.prevVolumeKg.toLocaleString("pt-BR")} kg)`
          : ""
      }`,
      `- Total de séries completadas: ${analytics.totalSets} séries | Tempo total: ${analytics.totalDurationMin} min`,
      `- Grupos musculares com menor estímulo nos últimos 7 dias: ${undertrainedLine}`,
      "",
      "DETALHAMENTO DAS SESSÕES DA SEMANA:",
      workoutsLines,
      recentHistoryFallback ? `\nÚLTIMOS TREINOS ANTERIORES:\n${recentHistoryFallback}` : "",
      "",
      "CARGAS ATUAIS LEVANTADAS POR EXERCÍCIO (REGISTRO DO ALUNO):",
      loadsLines,
      "",
      "FORMATO DESEJADO DA RESPOSTA (conciso, técnico e motivador em Markdown):",
      "### 1. Diagnóstico da Semana",
      "Análise direta dos treinos completados, consistência e volume levantado.",
      "### 2. Análise das Cargas Levantadas",
      "Destaque os exercícios com maior carga ou progressão real e identifique onde há margem segura para subir carga ou ajustar repetições.",
      "### 3. Foco Sugerido para a Próxima Semana",
      "Defina 2 a 3 prioridades práticas (grupos musculares foco, meta de sobrecarga progressiva específica citando os exercícios reais do aluno e meta de frequência).",
    ]
      .filter(Boolean)
      .join("\n");
  };

  const handleGenerateSummary = async () => {
    if (isLoading) return;

    setErrorMsg(null);
    setStreamedContent("");
    setRetryInfo(null);
    setLoadingPhase("waiting");

    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const prompt = buildWeeklySummaryPrompt();

    try {
      const fullReply = await generateWithFallback({
        endpoint: "/api/ai/personal",
        message: prompt,
        history: [],
        context: {
          studentName: state.profile.name,
          sex: state.profile.sex,
          age: state.profile.age,
          weightKg: state.profile.weightKg,
          targetWeightKg: state.profile.targetWeightKg,
          heightCm: state.profile.heightCm,
          bmi: metabolism.bmi,
          bmiLabel: metabolism.bmiLabel,
          weeklyFrequency: state.profile.weeklyFrequency,
          primaryGoal: state.goals.primary,
          secondaryFocuses: state.goals.focuses,
          customNote: state.goals.customNote,
          muscleToday: state.profile.muscleToday,
          level: state.profile.level,
          availableTime: state.profile.availableTime,
          exercisesPerWorkout: state.profile.exercisesPerWorkout ?? 6,
          latestMeasurements: latestMeasurement,
        },
        signal: controller.signal,
        onStateChange: (phase, info) => {
          if (!mountedRef.current) return;
          setLoadingPhase(phase);
          setRetryInfo(info ?? null);
        },
        onChunk: (fullText) => {
          if (!mountedRef.current) return;
          setStreamedContent(fullText);
        },
      });

      if (!mountedRef.current) return;

      const record: SavedWeeklySummary = {
        content: fullReply.trim(),
        generatedAt: new Date().toISOString(),
        workoutCount: analytics.thisWeekWorkouts.length,
        volumeKg: analytics.totalVolumeKg,
      };
      setSavedSummary(record);
      try {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
      } catch {
        // Ignore storage quota errors
      }
      onToast("Resumo de Performance Semanal gerado pelo Personal IA!", "success");
    } catch (err) {
      if (!mountedRef.current) return;
      if (isAbortedAiError(err)) {
        return;
      }
      const notice = getAiToastNotification(err);
      setErrorMsg(notice.message);
      onToast(notice.message, "warning");
    } finally {
      if (mountedRef.current) {
        setLoadingPhase("idle");
        setRetryInfo(null);
      }
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
    }
  };

  const handleStopStreaming = () => {
    abortControllerRef.current?.abort();
    setLoadingPhase("idle");
    setRetryInfo(null);
  };

  const displayedMarkdown = isLoading
    ? streamedContent
    : savedSummary?.content || "";

  const handleCopySummary = async () => {
    if (!displayedMarkdown) return;
    try {
      await navigator.clipboard.writeText(displayedMarkdown);
      setCopied(true);
      onToast("Resumo semanal copiado para a área de transferência!", "info");
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      onToast("Não foi possível copiar automaticamente.", "warning");
    }
  };

  return (
    <section
      aria-label="Resumo de Performance Semanal com Personal IA"
      className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none overflow-hidden"
    >
      {/* Top Header & Primary Trigger Button */}
      <div className="p-5 sm:p-6 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0 space-y-1.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#475569] dark:text-[#A1A1AA]">
            <span className="font-semibold text-[#FF6B00]">Personal IA</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {analytics.thisWeekWorkouts.length}/{state.profile.weeklyFrequency || 4} treinos (7d)
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {analytics.totalVolumeKg.toLocaleString("pt-BR")} kg levantados
            </span>
            {analytics.progressedLoads.length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400 font-semibold">
                  +{analytics.progressedLoads.length}{" "}
                  {analytics.progressedLoads.length === 1
                    ? "carga evoluída"
                    : "cargas evoluídas"}
                </span>
              </>
            )}
          </div>

          <h2 className="text-lg sm:text-xl font-extrabold text-[#0F172A] dark:text-white tracking-tight">
            Resumo de Performance Semanal
          </h2>

          <p className="text-xs sm:text-sm text-[#475569] dark:text-[#A1A1AA] max-w-2xl leading-relaxed">
            Solicite ao Personal IA uma análise dos treinos completados nesta semana e um plano de foco para a próxima semana baseado nas suas cargas levantadas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 shrink-0">
          {isLoading ? (
            <button
              type="button"
              onClick={handleStopStreaming}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Square className="w-3.5 h-3.5 fill-current" />
              <span>Interromper análise</span>
            </button>
          ) : (
            <motion.button
              type="button"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.98 }}
              transition={CARD_HOVER_TRANSITION}
              onClick={() => void handleGenerateSummary()}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#FF6B00] hover:bg-[#F97316] text-white font-bold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-md shadow-[#FF6B00]/20 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {savedSummary ? (
                <RefreshCw className="w-4 h-4" />
              ) : (
                <Sparkles className="w-4 h-4" />
              )}
              <span>
                {savedSummary
                  ? "Atualizar Resumo Semanal"
                  : "Gerar Resumo de Performance Semanal"}
              </span>
            </motion.button>
          )}
        </div>
      </div>

      {/* Compact Data Strip — Real Workout & Load Telemetry sent to Personal IA */}
      <div className="px-5 sm:px-6 py-3.5 border-t border-[#E2E8F0] dark:border-[#26262B] bg-[#F8FAFC] dark:bg-[#111114] grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div>
          <span className="block text-[11px] font-medium text-[#64748B] dark:text-[#A1A1AA]">
            Treinos na semana
          </span>
          <p className="mt-0.5 font-mono text-base font-bold tabular-nums text-[#0F172A] dark:text-white">
            {analytics.thisWeekWorkouts.length}
            <span className="text-xs font-normal text-[#64748B] dark:text-[#A1A1AA]">
              /{state.profile.weeklyFrequency || 4} sessões
            </span>
          </p>
        </div>

        <div>
          <span className="block text-[11px] font-medium text-[#64748B] dark:text-[#A1A1AA]">
            Volume levantado (7d)
          </span>
          <div className="mt-0.5 flex items-baseline gap-1.5">
            <p className="font-mono text-base font-bold tabular-nums text-[#0F172A] dark:text-white">
              {analytics.totalVolumeKg.toLocaleString("pt-BR")} kg
            </p>
            {analytics.volumeDeltaPct !== null && (
              <span
                className={`font-mono text-[11px] font-semibold tabular-nums ${
                  analytics.volumeDeltaPct >= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-amber-600 dark:text-amber-400"
                }`}
              >
                {analytics.volumeDeltaPct >= 0 ? "+" : ""}
                {analytics.volumeDeltaPct}%
              </span>
            )}
          </div>
        </div>

        <div>
          <span className="block text-[11px] font-medium text-[#64748B] dark:text-[#A1A1AA]">
            Séries e tempo total
          </span>
          <p className="mt-0.5 font-mono text-base font-bold tabular-nums text-[#0F172A] dark:text-white">
            {analytics.totalSets} séries{" "}
            <span className="text-xs font-normal text-[#64748B] dark:text-[#A1A1AA]">
              · {analytics.totalDurationMin} min
            </span>
          </p>
        </div>

        <div>
          <span className="block text-[11px] font-medium text-[#64748B] dark:text-[#A1A1AA]">
            Maior carga ativa
          </span>
          <p className="mt-0.5 font-mono text-base font-bold tabular-nums text-[#0F172A] dark:text-white truncate">
            {analytics.heaviestLoads.length > 0 ? (
              <>
                {analytics.heaviestLoads[0].weightKg} kg{" "}
                <span className="font-sans text-xs font-normal text-[#64748B] dark:text-[#A1A1AA]">
                  · {analytics.heaviestLoads[0].name}
                </span>
              </>
            ) : (
              <span className="font-sans text-xs font-normal text-[#64748B] dark:text-[#A1A1AA]">
                Sem cargas registradas
              </span>
            )}
          </p>
        </div>
      </div>

      {/* Top Load Progressions Inline Summary (when available) */}
      {analytics.topHighlights.length > 0 && (
        <div className="px-5 sm:px-6 py-3 border-t border-[#E2E8F0] dark:border-[#26262B] flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[#334155] dark:text-[#D4D4D8]">
            <TrendingUp className="w-3.5 h-3.5 text-[#FF6B00]" />
            Cargas base analisadas:
          </span>
          {analytics.topHighlights.map((item, idx) => (
            <span
              key={item.id}
              className="inline-flex items-center gap-1 text-[#475569] dark:text-[#A1A1AA]"
            >
              <strong className="font-semibold text-[#0F172A] dark:text-white">
                {item.name}
              </strong>
              <span className="font-mono tabular-nums text-[#FF6B00] font-semibold">
                {item.weightKg}kg
              </span>
              {item.deltaKg > 0 && (
                <span className="font-mono tabular-nums text-emerald-600 dark:text-emerald-400">
                  (+{item.deltaKg}kg)
                </span>
              )}
              {idx < analytics.topHighlights.length - 1 && (
                <span aria-hidden="true" className="ml-2 text-[#CBD5E1] dark:text-[#3F3F46]">
                  /
                </span>
              )}
            </span>
          ))}
        </div>
      )}

      {/* Error State */}
      {errorMsg && !isLoading && (
        <div className="px-5 sm:px-6 py-4 border-t border-[#E2E8F0] dark:border-[#26262B] bg-amber-50/70 dark:bg-amber-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-start gap-2.5 text-xs sm:text-sm text-amber-800 dark:text-amber-200">
            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => void handleGenerateSummary()}
            className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold whitespace-nowrap shrink-0 cursor-pointer transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* Waiting / Retrying / Streaming / Populated AI Analysis Output */}
      {(isLoading || displayedMarkdown) && (
        <div className="p-5 sm:p-6 border-t border-[#E2E8F0] dark:border-[#26262B]">
          {isLoading && !displayedMarkdown ? (
            <AiTypingIndicator
              agent="personal"
              phase={loadingPhase}
              retryInfo={retryInfo}
            />
          ) : (
            <div>
              <div className="ai-prose text-sm text-[#0F172A] dark:text-[#E4E4E7] leading-relaxed">
                <ReactMarkdown>{displayedMarkdown}</ReactMarkdown>
              </div>

              {isLoading && <AiStreamingFooter />}

              {!isLoading && savedSummary && (
                <div className="mt-5 pt-4 border-t border-[#E2E8F0] dark:border-[#26262B] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#64748B] dark:text-[#A1A1AA] font-mono tabular-nums">
                    <BarChart3 className="w-3.5 h-3.5 text-[#FF6B00]" />
                    <span>Atualizado em {formatTimestampBr(savedSummary.generatedAt)}</span>
                    <span aria-hidden="true">·</span>
                    <span>Base: {savedSummary.workoutCount} treinos</span>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => void handleCopySummary()}
                      className="min-h-[38px] px-3 py-1.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] hover:bg-[#F1F5F9] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] text-xs font-semibold text-[#334155] dark:text-[#E4E4E7] flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      {copied ? (
                        <Check className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 text-[#64748B] dark:text-[#A1A1AA]" />
                      )}
                      <span>{copied ? "Copiado" : "Copiar análise"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => onNavigateTab("personal")}
                      className="min-h-[38px] px-3.5 py-1.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] hover:border-[#FF6B00]/60 border border-[#E2E8F0] dark:border-[#26262B] text-xs font-semibold text-[#FF6B00] flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
                    >
                      <span>Ajustar treino no Personal IA</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </section>
  );
};
