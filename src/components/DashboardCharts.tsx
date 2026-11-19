import React, { useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  ArrowRight,
  BarChart3,
  PieChart as PieChartIcon,
  Radar as RadarIcon,
  Scale,
} from "lucide-react";
import { useTheme } from "./ErrorBoundary";
import { EXERCISE_MAP } from "../data/exercises";
import { BiancoAppState, MetabolicResult, MuscleGroupId, TabId } from "../types";
import {
  BIANCO_EASE,
  CARD_HOVER_TRANSITION,
  chartCardVariants,
  kpiGridVariants,
  NAV_SPRING,
} from "../utils/motion";

interface DashboardChartsProps {
  state: BiancoAppState;
  metabolism: MetabolicResult;
  onNavigateTab: (tab: TabId) => void;
}

type VolumeMetric = "volume" | "minutes";
type BalanceChartView = "radar" | "bars";

type MuscleAxisKey = "Costas" | "Peito" | "Pernas" | "Ombros" | "Braços" | "Core";

const MUSCLE_AXES: MuscleAxisKey[] = [
  "Costas",
  "Peito",
  "Pernas",
  "Ombros",
  "Braços",
  "Core",
];

const WEEKDAY_SHORT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function formatDayMonth(iso: string): string {
  const parts = iso.split("-");
  if (parts.length !== 3) return iso;
  return `${parts[2]}/${parts[1]}`;
}

function mapMuscleGroupToAxis(group: MuscleGroupId): MuscleAxisKey {
  switch (group) {
    case "costas":
      return "Costas";
    case "peito":
      return "Peito";
    case "quadriceps":
    case "posterior_gluteos":
      return "Pernas";
    case "ombros":
      return "Ombros";
    case "biceps_triceps":
      return "Braços";
    case "abdomen_panturrilha":
      return "Core";
  }
}

function inferAxesFromWorkout(title: string, muscleGroup: string): MuscleAxisKey[] {
  const text = `${title} ${muscleGroup}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const hits = new Set<MuscleAxisKey>();

  if (text.includes("costa") || text.includes("puxar") || text.includes("dorsal") || text.includes("upper") || text.includes("superior")) {
    hits.add("Costas");
  }
  if (text.includes("peito") || text.includes("empurrar") || text.includes("upper") || text.includes("superior")) {
    hits.add("Peito");
  }
  if (
    text.includes("perna") ||
    text.includes("quadriceps") ||
    text.includes("gluteo") ||
    text.includes("posterior") ||
    text.includes("inferior")
  ) {
    hits.add("Pernas");
  }
  if (text.includes("ombro") || text.includes("deltoide") || text.includes("upper") || text.includes("superior")) {
    hits.add("Ombros");
  }
  if (
    text.includes("biceps") ||
    text.includes("triceps") ||
    text.includes("braco") ||
    text.includes("puxar") ||
    text.includes("empurrar") ||
    text.includes("superior")
  ) {
    hits.add("Braços");
  }
  if (
    text.includes("abdomen") ||
    text.includes("core") ||
    text.includes("pilates") ||
    text.includes("funcional") ||
    text.includes("definicao")
  ) {
    hits.add("Core");
  }
  if (text.includes("full body") || text.includes("metabolico")) {
    hits.add("Pernas");
    hits.add("Costas");
    hits.add("Peito");
    hits.add("Core");
  }

  return hits.size > 0 ? Array.from(hits) : ["Core"];
}

export const DashboardCharts: React.FC<DashboardChartsProps> = ({
  state,
  metabolism,
  onNavigateTab,
}) => {
  const { isDark } = useTheme();
  const [volumeMetric, setVolumeMetric] = useState<VolumeMetric>("volume");
  const [balanceView, setBalanceView] = useState<BalanceChartView>("radar");

  const chartColors = useMemo(
    () => ({
      gridStroke: isDark ? "#26262B" : "#E2E8F0",
      axisStroke: isDark ? "#71717A" : "#94A3B8",
      tickFill: isDark ? "#A1A1AA" : "#475569",
      strongTickFill: isDark ? "#D4D4D8" : "#334155",
      donutStroke: isDark ? "#151518" : "#FFFFFF",
      refLabelFill: isDark ? "#FDBA74" : "#EA580C",
      fatColor: isDark ? "#71717A" : "#64748B",
      tooltipStyle: {
        backgroundColor: isDark ? "#0B0B0D" : "#FFFFFF",
        border: isDark ? "1px solid #26262B" : "1px solid #E2E8F0",
        borderRadius: "12px",
        fontSize: "12px",
        color: isDark ? "#FFFFFF" : "#0F172A",
        boxShadow: isDark ? undefined : "0 8px 24px rgba(15, 23, 42, 0.08)",
      },
      tooltipLabelStyle: {
        color: isDark ? "#A1A1AA" : "#475569",
        marginBottom: "4px",
      },
    }),
    [isDark]
  );

  // 1. Weight Evolution vs Target Data (AreaChart)
  const weightChart = useMemo(() => {
    const sorted = [...state.measurements].sort((a, b) =>
      a.date.localeCompare(b.date)
    );
    const targetKg = state.profile.targetWeightKg;
    const currentKg =
      sorted.length > 0 ? sorted[sorted.length - 1].weightKg : state.profile.weightKg;

    if (sorted.length >= 2) {
      const points = sorted.slice(-12).map((m) => ({
        label: formatDayMonth(m.date),
        fullDate: m.date,
        peso: Number(m.weightKg.toFixed(1)),
      }));
      const vals = [...points.map((p) => p.peso), targetKg];
      const minVal = Math.floor(Math.min(...vals) - 1.5);
      const maxVal = Math.ceil(Math.max(...vals) + 1.5);
      return { isPreview: false, data: points, targetKg, minVal, maxVal };
    }

    // Elegant demo baseline curving toward user's real current weight when < 2 logs exist
    const losing = targetKg < currentKg;
    const step = losing ? 0.5 : -0.4;
    const now = new Date();
    const offsets = [28, 21, 14, 7, 0];
    const demoPoints = offsets.map((daysAgo, idx) => {
      const d = new Date(now);
      d.setDate(d.getDate() - daysAgo);
      const remainingSteps = offsets.length - 1 - idx;
      const simulated = Number((currentKg + remainingSteps * step).toFixed(1));
      const iso = toIsoDate(d);
      return {
        label: formatDayMonth(iso),
        fullDate: iso,
        peso: simulated,
      };
    });
    const vals = [...demoPoints.map((p) => p.peso), targetKg];
    const minVal = Math.floor(Math.min(...vals) - 1.5);
    const maxVal = Math.ceil(Math.max(...vals) + 1.5);
    return { isPreview: true, data: demoPoints, targetKg, minVal, maxVal };
  }, [state.measurements, state.profile.weightKg, state.profile.targetWeightKg]);

  // 2. Last 7 Days Workout Frequency & Volume Data (BarChart)
  const weeklyBarChart = useMemo(() => {
    const now = new Date();
    const days: {
      iso: string;
      dayLabel: string;
      volumeKg: number;
      minutes: number;
      sessions: number;
      titles: string[];
    }[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const iso = toIsoDate(d);
      days.push({
        iso,
        dayLabel: WEEKDAY_SHORT[d.getDay()],
        volumeKg: 0,
        minutes: 0,
        sessions: 0,
        titles: [],
      });
    }

    const dayMap = new Map(days.map((item) => [item.iso, item]));
    let realCount = 0;

    for (const w of state.workoutHistory) {
      const slot = dayMap.get(w.date);
      if (slot) {
        slot.volumeKg += Math.max(0, Math.round(w.totalVolumeKg || 0));
        slot.minutes += Math.max(0, Math.round(w.durationMin || 0));
        slot.sessions += 1;
        slot.titles.push(w.title);
        realCount += 1;
      }
    }

    if (realCount > 0) {
      return {
        isPreview: false,
        data: days,
        totalVolume: days.reduce((s, d) => s + d.volumeKg, 0),
        totalMinutes: days.reduce((s, d) => s + d.minutes, 0),
      };
    }

    // Elegant illustrative 7-day preview when no workouts logged yet
    const sampleVol = [4200, 0, 5600, 3850, 0, 6100, 0];
    const sampleMin = [50, 0, 55, 45, 0, 60, 0];
    const sampleTitles = [
      "Costas + Bíceps",
      "Descanso ativo",
      "Pernas Completo",
      "Peito + Tríceps",
      "Descanso ativo",
      "Ombros + Abdômen",
      "Descanso",
    ];
    const previewDays = days.map((d, idx) => ({
      ...d,
      volumeKg: sampleVol[idx],
      minutes: sampleMin[idx],
      sessions: sampleMin[idx] > 0 ? 1 : 0,
      titles: sampleMin[idx] > 0 ? [sampleTitles[idx]] : [],
    }));

    return {
      isPreview: true,
      data: previewDays,
      totalVolume: previewDays.reduce((s, d) => s + d.volumeKg, 0),
      totalMinutes: previewDays.reduce((s, d) => s + d.minutes, 0),
    };
  }, [state.workoutHistory]);

  // 3. Nutrition Macro Distribution Data (Donut PieChart)
  const macroChart = useMemo(() => {
    const proteinKcal = metabolism.proteinG * 4;
    const carbsKcal = metabolism.carbsG * 4;
    const fatKcal = metabolism.fatG * 9;
    const sumKcal = Math.max(1, proteinKcal + carbsKcal + fatKcal);

    const pPct = Math.round((proteinKcal / sumKcal) * 100);
    const cPct = Math.round((carbsKcal / sumKcal) * 100);
    const fPct = Math.max(0, 100 - pPct - cPct);

    return [
      {
        name: "Proteínas",
        grams: metabolism.proteinG,
        kcal: proteinKcal,
        pct: pPct,
        color: "#FF6B00",
      },
      {
        name: "Carboidratos",
        grams: metabolism.carbsG,
        kcal: carbsKcal,
        pct: cPct,
        color: "#F59E0B",
      },
      {
        name: "Gorduras",
        grams: metabolism.fatG,
        kcal: fatKcal,
        pct: fPct,
        color: chartColors.fatColor,
      },
    ];
  }, [metabolism, chartColors.fatColor]);

  // 4. Weekly Muscle Balance Data (RadarChart / Horizontal Bars)
  const muscleBalance = useMemo(() => {
    const counts: Record<MuscleAxisKey, number> = {
      Costas: 0,
      Peito: 0,
      Pernas: 0,
      Ombros: 0,
      Braços: 0,
      Core: 0,
    };

    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - 6);
    const cutoffIso = toIsoDate(cutoff);

    for (const w of state.workoutHistory) {
      if (w.date < cutoffIso) continue;
      const axes = inferAxesFromWorkout(w.title, w.muscleGroup);
      const setsPerAxis = Math.max(
        3,
        Math.round(Math.max(w.setsCompleted || 12, 8) / axes.length)
      );
      for (const axis of axes) {
        counts[axis] += setsPerAxis;
      }
    }

    // Also credit any live checked sets in today's active workout
    for (const [exId, log] of Object.entries(state.exerciseLogs)) {
      const doneSets = log.completedSets.filter(Boolean).length;
      if (doneSets <= 0) continue;
      const ex = EXERCISE_MAP[exId];
      if (!ex) continue;
      const axis = mapMuscleGroupToAxis(ex.muscleGroup);
      counts[axis] += doneSets;
    }

    const totalRealSets = Object.values(counts).reduce((a, b) => a + b, 0);
    const isPreview = totalRealSets === 0;

    const finalCounts: Record<MuscleAxisKey, number> = isPreview
      ? {
          Costas: 14,
          Peito: 12,
          Pernas: 16,
          Ombros: 8,
          Braços: 10,
          Core: 6,
        }
      : counts;

    const data = MUSCLE_AXES.map((axis) => ({
      muscle: axis,
      series: finalCounts[axis],
    }));

    const lowest = [...data].sort((a, b) => a.series - b.series)[0];
    const maxSeries = Math.max(12, ...data.map((d) => d.series));

    return { isPreview, data, lowest, maxSeries };
  }, [state.workoutHistory, state.exerciseLogs]);

  return (
    <motion.section
      variants={kpiGridVariants}
      aria-label="Análise gráfica de desempenho e nutrição"
      className="grid grid-cols-1 lg:grid-cols-2 gap-5"
    >
      {/* CHART 1: AreaChart — Evolução de Peso vs. Meta */}
      <motion.article
        variants={chartCardVariants}
        whileHover={{ y: -2 }}
        transition={CARD_HOVER_TRANSITION}
        className="group relative overflow-hidden rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00]/40 shadow-sm dark:shadow-none transition-colors duration-200 p-5 flex flex-col justify-between"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#FF6B00]/65 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        />
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#475569] dark:text-[#A1A1AA]">
              <Scale className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span className="font-semibold text-[#FF6B00]">Evolução corporal</span>
              {weightChart.isPreview && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Prévia ilustrativa</span>
                </>
              )}
            </div>
            <h3 className="mt-1 text-base sm:text-lg font-bold text-[#0F172A] dark:text-white">
              Peso atual vs. Peso meta
            </h3>
          </div>

          <div className="text-right shrink-0">
            <span className="block text-[11px] text-[#475569] dark:text-[#A1A1AA]">
              Meta definida
            </span>
            <span className="font-mono text-sm font-bold tabular-nums text-[#FF6B00]">
              {weightChart.targetKg.toFixed(1)} kg
            </span>
          </div>
        </div>

        <div className="mt-4 h-[230px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={weightChart.data}
              margin={{ top: 14, right: 12, left: 0, bottom: 0 }}
            >
              <defs>
                <linearGradient id="biancoWeightGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#FF6B00" stopOpacity={0.38} />
                  <stop offset="95%" stopColor="#FF6B00" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid
                stroke={chartColors.gridStroke}
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="label"
                stroke={chartColors.axisStroke}
                tick={{ fill: chartColors.tickFill, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                width={46}
                domain={[weightChart.minVal, weightChart.maxVal]}
                stroke={chartColors.axisStroke}
                tick={{ fill: chartColors.tickFill, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                unit="kg"
              />
              <Tooltip
                contentStyle={chartColors.tooltipStyle}
                labelStyle={chartColors.tooltipLabelStyle}
                formatter={(value: unknown) => {
                  const kg = Number(value);
                  const diff = Number((kg - weightChart.targetKg).toFixed(1));
                  const diffText =
                    diff === 0
                      ? "Na meta!"
                      : diff > 0
                      ? `+${diff} kg da meta`
                      : `${diff} kg da meta`;
                  return [`${kg.toFixed(1)} kg (${diffText})`, "Peso"];
                }}
              />
              <ReferenceLine
                y={weightChart.targetKg}
                stroke="#F97316"
                strokeDasharray="5 5"
                strokeWidth={1.5}
                label={{
                  value: `Meta ${weightChart.targetKg} kg`,
                  position: "insideTopRight",
                  fill: chartColors.refLabelFill,
                  fontSize: 11,
                }}
              />
              <Area
                type="monotone"
                dataKey="peso"
                stroke="#FF6B00"
                strokeWidth={2.5}
                fillOpacity={1}
                fill="url(#biancoWeightGradient)"
                activeDot={{ r: 5, fill: "#FF6B00", stroke: "#FFFFFF", strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-3 pt-3 border-t border-[#E2E8F0] dark:border-[#26262B] flex items-center justify-between gap-2 text-xs">
          <span className="text-[#475569] dark:text-[#A1A1AA]">
            {weightChart.isPreview
              ? "Registre ao menos 2 pesagens para ativar sua curva real."
              : `${state.measurements.length} registros de avaliação no histórico.`}
          </span>
          <button
            type="button"
            onClick={() => onNavigateTab("evolucao")}
            className="text-[#FF6B00] hover:text-[#EA580C] dark:hover:text-orange-300 font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Registrar peso</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.article>

      {/* CHART 2: BarChart — Frequência e Volume de Treino (Últimos 7 dias) */}
      <motion.article
        variants={chartCardVariants}
        whileHover={{ y: -2 }}
        transition={CARD_HOVER_TRANSITION}
        className="group relative overflow-hidden rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00]/40 shadow-sm dark:shadow-none transition-colors duration-200 p-5 flex flex-col justify-between"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#FF6B00]/65 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#475569] dark:text-[#A1A1AA]">
              <BarChart3 className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span className="font-semibold text-[#FF6B00]">Últimos 7 dias</span>
              {weeklyBarChart.isPreview && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Prévia ilustrativa</span>
                </>
              )}
            </div>
            <h3 className="mt-1 text-base sm:text-lg font-bold text-[#0F172A] dark:text-white">
              Frequência e volume de treino
            </h3>
          </div>

          <div
            role="tablist"
            aria-label="Alternar métrica semanal"
            className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#F1F5F9] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={volumeMetric === "volume"}
              onClick={() => setVolumeMetric("volume")}
              className={`relative min-h-[32px] px-2.5 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                volumeMetric === "volume"
                  ? "text-white"
                  : "text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white"
              }`}
            >
              {volumeMetric === "volume" && (
                <motion.span
                  layoutId="bianco-chart-volume-pill"
                  transition={NAV_SPRING}
                  aria-hidden="true"
                  className="absolute inset-0 rounded-lg bg-[#FF6B00]"
                />
              )}
              <span className="relative z-10">Volume (kg)</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={volumeMetric === "minutes"}
              onClick={() => setVolumeMetric("minutes")}
              className={`relative min-h-[32px] px-2.5 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                volumeMetric === "minutes"
                  ? "text-white"
                  : "text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white"
              }`}
            >
              {volumeMetric === "minutes" && (
                <motion.span
                  layoutId="bianco-chart-volume-pill"
                  transition={NAV_SPRING}
                  aria-hidden="true"
                  className="absolute inset-0 rounded-lg bg-[#FF6B00]"
                />
              )}
              <span className="relative z-10">Minutos</span>
            </button>
          </div>
        </div>

        <div className="mt-4 h-[230px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={weeklyBarChart.data}
              margin={{ top: 14, right: 8, left: 0, bottom: 0 }}
            >
              <CartesianGrid
                stroke={chartColors.gridStroke}
                strokeDasharray="3 3"
                vertical={false}
              />
              <XAxis
                dataKey="dayLabel"
                stroke={chartColors.axisStroke}
                tick={{ fill: chartColors.tickFill, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                width={42}
                stroke={chartColors.axisStroke}
                tick={{ fill: chartColors.tickFill, fontSize: 11 }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) =>
                  volumeMetric === "volume" && v >= 1000
                    ? `${(v / 1000).toFixed(1)}t`
                    : `${v}`
                }
              />
              <Tooltip
                cursor={{ fill: "rgba(255, 107, 0, 0.08)" }}
                contentStyle={chartColors.tooltipStyle}
                labelStyle={chartColors.tooltipLabelStyle}
                formatter={(value: unknown) => {
                  const num = Number(value) || 0;
                  return volumeMetric === "volume"
                    ? [`${num.toLocaleString("pt-BR")} kg`, "Volume levantado"]
                    : [`${num} min`, "Tempo de treino"];
                }}
              />
              <Bar
                dataKey={volumeMetric === "volume" ? "volumeKg" : "minutes"}
                fill="#FF6B00"
                fillOpacity={weeklyBarChart.isPreview ? 0.55 : 0.95}
                radius={[8, 8, 2, 2]}
                maxBarSize={36}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-3 pt-3 border-t border-[#E2E8F0] dark:border-[#26262B] flex items-center justify-between gap-2 text-xs">
          <span className="text-[#475569] dark:text-[#A1A1AA] font-mono tabular-nums">
            Total 7d:{" "}
            <strong className="text-[#0F172A] dark:text-white">
              {volumeMetric === "volume"
                ? `${weeklyBarChart.totalVolume.toLocaleString("pt-BR")} kg`
                : `${weeklyBarChart.totalMinutes} min`}
            </strong>
          </span>
          <button
            type="button"
            onClick={() => onNavigateTab("treinos")}
            className="text-[#FF6B00] hover:text-[#EA580C] dark:hover:text-orange-300 font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Registrar treino</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.article>

      {/* CHART 3: Donut PieChart — Distribuição de Macros (Nutrição) */}
      <motion.article
        variants={chartCardVariants}
        whileHover={{ y: -2 }}
        transition={CARD_HOVER_TRANSITION}
        className="group relative overflow-hidden rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00]/40 shadow-sm dark:shadow-none transition-colors duration-200 p-5 flex flex-col justify-between"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#FF6B00]/65 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        />
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#475569] dark:text-[#A1A1AA]">
              <PieChartIcon className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span className="font-semibold text-[#FF6B00]">Nutri IA · Mifflin-St Jeor</span>
            </div>
            <h3 className="mt-1 text-base sm:text-lg font-bold text-[#0F172A] dark:text-white">
              Distribuição diária de macros
            </h3>
          </div>
          <span className="text-[11px] text-[#475569] dark:text-[#A1A1AA] text-right font-mono tabular-nums shrink-0">
            GET {metabolism.get} kcal
          </span>
        </div>

        <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 items-center gap-4">
          {/* Donut with centered calorie figure */}
          <div className="relative h-[215px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={macroChart}
                  dataKey="kcal"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  innerRadius={62}
                  outerRadius={88}
                  paddingAngle={3}
                  stroke={chartColors.donutStroke}
                  strokeWidth={2}
                >
                  {macroChart.map((entry) => (
                    <Cell key={entry.name} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={chartColors.tooltipStyle}
                  formatter={(_value: unknown, _name: unknown, props: { payload?: { grams: number; pct: number; kcal: number; name: string } }) => {
                    const p = props?.payload;
                    if (!p) return ["", ""];
                    return [`${p.grams}g (${p.pct}% · ${p.kcal} kcal)`, p.name];
                  }}
                />
              </PieChart>
            </ResponsiveContainer>

            {/* Centered Kcal readout */}
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center"
            >
              <span className="font-mono text-2xl font-extrabold tabular-nums text-[#0F172A] dark:text-white leading-none">
                {metabolism.calorieTarget}
              </span>
              <span className="mt-1 text-[11px] font-medium text-[#475569] dark:text-[#A1A1AA]">
                kcal / dia
              </span>
            </div>
          </div>

          {/* Accessible Macro Legend Breakdown */}
          <div className="space-y-3">
            {macroChart.map((macro) => (
              <div
                key={macro.name}
                className="rounded-xl bg-[#F8FAFC] dark:bg-[#101013] border border-[#E2E8F0] dark:border-[#26262B] px-3.5 py-2.5 flex items-center justify-between gap-2"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span
                    aria-hidden="true"
                    className="w-2.5 h-2.5 rounded-sm shrink-0"
                    style={{ backgroundColor: macro.color }}
                  />
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-[#0F172A] dark:text-white truncate">
                      {macro.name}
                    </p>
                    <p className="text-[11px] text-[#475569] dark:text-[#A1A1AA] font-mono tabular-nums">
                      {macro.kcal} kcal
                    </p>
                  </div>
                </div>
                <div className="text-right shrink-0 font-mono tabular-nums">
                  <p className="text-sm font-bold text-[#0F172A] dark:text-white">
                    {macro.grams}g
                  </p>
                  <p className="text-[11px] font-semibold text-[#FF6B00]">
                    {macro.pct}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-3 pt-3 border-t border-[#E2E8F0] dark:border-[#26262B] flex items-center justify-between gap-2 text-xs">
          <span className="text-[#475569] dark:text-[#A1A1AA]">
            Déficit natural de{" "}
            <strong className="text-[#0F172A] dark:text-white font-mono tabular-nums">
              -{metabolism.deficitKcal} kcal/dia
            </strong>
          </span>
          <button
            type="button"
            onClick={() => onNavigateTab("nutri")}
            className="text-[#FF6B00] hover:text-[#EA580C] dark:hover:text-orange-300 font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Montar cardápio</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.article>

      {/* CHART 4: RadarChart / Horizontal Bar — Equilíbrio Muscular Semanal */}
      <motion.article
        variants={chartCardVariants}
        whileHover={{ y: -2 }}
        transition={CARD_HOVER_TRANSITION}
        className="group relative overflow-hidden rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00]/40 shadow-sm dark:shadow-none transition-colors duration-200 p-5 flex flex-col justify-between"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-[#FF6B00]/65 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200"
        />
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-xs text-[#475569] dark:text-[#A1A1AA]">
              <RadarIcon className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span className="font-semibold text-[#FF6B00]">Séries na semana</span>
              {muscleBalance.isPreview && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>Prévia ilustrativa</span>
                </>
              )}
            </div>
            <h3 className="mt-1 text-base sm:text-lg font-bold text-[#0F172A] dark:text-white">
              Equilíbrio muscular
            </h3>
          </div>

          <div
            role="tablist"
            aria-label="Alternar visualização de equilíbrio muscular"
            className="inline-flex items-center gap-1 p-1 rounded-xl bg-[#F1F5F9] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={balanceView === "radar"}
              onClick={() => setBalanceView("radar")}
              className={`relative min-h-[32px] px-2.5 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                balanceView === "radar"
                  ? "text-white"
                  : "text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white"
              }`}
            >
              {balanceView === "radar" && (
                <motion.span
                  layoutId="bianco-chart-balance-pill"
                  transition={NAV_SPRING}
                  aria-hidden="true"
                  className="absolute inset-0 rounded-lg bg-[#FF6B00]"
                />
              )}
              <span className="relative z-10">Radar</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={balanceView === "bars"}
              onClick={() => setBalanceView("bars")}
              className={`relative min-h-[32px] px-2.5 rounded-lg text-[11px] font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                balanceView === "bars"
                  ? "text-white"
                  : "text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white"
              }`}
            >
              {balanceView === "bars" && (
                <motion.span
                  layoutId="bianco-chart-balance-pill"
                  transition={NAV_SPRING}
                  aria-hidden="true"
                  className="absolute inset-0 rounded-lg bg-[#FF6B00]"
                />
              )}
              <span className="relative z-10">Barras</span>
            </button>
          </div>
        </div>

        <div className="mt-4 h-[230px] w-full">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={balanceView}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16, ease: BIANCO_EASE }}
              className="h-full w-full"
            >
              {balanceView === "radar" ? (
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart
                    cx="50%"
                    cy="50%"
                    outerRadius="68%"
                    data={muscleBalance.data}
                  >
                    <PolarGrid stroke={chartColors.gridStroke} />
                    <PolarAngleAxis
                      dataKey="muscle"
                      tick={{ fill: chartColors.strongTickFill, fontSize: 11, fontWeight: 600 }}
                    />
                    <PolarRadiusAxis
                      angle={30}
                      domain={[0, muscleBalance.maxSeries]}
                      tick={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={chartColors.tooltipStyle}
                      formatter={(val: unknown) => [`${Number(val) || 0} séries`, "Volume semanal"]}
                    />
                    <Radar
                      name="Séries"
                      dataKey="series"
                      stroke="#FF6B00"
                      strokeWidth={2}
                      fill="#FF6B00"
                      fillOpacity={muscleBalance.isPreview ? 0.22 : 0.34}
                    />
                  </RadarChart>
                </ResponsiveContainer>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={muscleBalance.data}
                    layout="vertical"
                    margin={{ top: 4, right: 20, left: 6, bottom: 4 }}
                  >
                    <CartesianGrid
                      stroke={chartColors.gridStroke}
                      strokeDasharray="3 3"
                      horizontal={false}
                    />
                    <XAxis
                      type="number"
                      stroke={chartColors.axisStroke}
                      tick={{ fill: chartColors.tickFill, fontSize: 11 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      type="category"
                      dataKey="muscle"
                      width={60}
                      stroke={chartColors.axisStroke}
                      tick={{ fill: chartColors.strongTickFill, fontSize: 11, fontWeight: 600 }}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      cursor={{ fill: "rgba(255, 107, 0, 0.08)" }}
                      contentStyle={chartColors.tooltipStyle}
                      formatter={(val: unknown) => [`${Number(val) || 0} séries`, "Na semana"]}
                    />
                    <Bar
                      dataKey="series"
                      fill="#FF6B00"
                      fillOpacity={muscleBalance.isPreview ? 0.55 : 0.95}
                      radius={[0, 6, 6, 0]}
                      barSize={18}
                    />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </motion.div>
          </AnimatePresence>
        </div>

        <div className="mt-3 pt-3 border-t border-[#E2E8F0] dark:border-[#26262B] flex items-center justify-between gap-2 text-xs">
          <span className="text-[#475569] dark:text-[#A1A1AA] inline-flex items-center gap-1.5 min-w-0 truncate">
            <Activity className="w-3.5 h-3.5 text-[#FF6B00] shrink-0" />
            <span className="truncate">
              Foco sugerido:{" "}
              <strong className="text-[#0F172A] dark:text-white">
                {muscleBalance.lowest.muscle}
              </strong>{" "}
              <span className="font-mono tabular-nums">
                ({muscleBalance.lowest.series} séries)
              </span>
            </span>
          </span>
          <button
            type="button"
            onClick={() => onNavigateTab("treinos")}
            className="text-[#FF6B00] hover:text-[#EA580C] dark:hover:text-orange-300 font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Equilibrar</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </motion.article>
    </motion.section>
  );
};
