import React, { useMemo, useState } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Activity,
  Calendar,
  Dumbbell,
  Flame,
  Plus,
  Ruler,
  Scale,
  Target,
  Trash2,
  TrendingDown,
} from "lucide-react";
import { useTheme } from "./ErrorBoundary";
import { getTodayIso } from "../hooks/useBiancoState";
import { BiancoAppState, BodyMeasurement, StudentProfile, TabId } from "../types";

interface EvolutionTabProps {
  state: BiancoAppState;
  onAddMeasurement: (entry: Omit<BodyMeasurement, "id">) => void;
  onDeleteMeasurement: (id: string) => void;
  onDeleteWorkoutSession?: (id: string) => void;
  onUpdateProfile: (patch: Partial<StudentProfile>) => void;
  onNavigateTab: (tab: TabId) => void;
  onToast: (message: string, tone?: "success" | "info" | "warning") => void;
}

function formatDateBr(isoDate: string): string {
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}`;
}

function formatFullDateBr(isoDate: string): string {
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatPair(right?: number, left?: number, legacy?: number): string {
  const r = right ?? legacy;
  if (r && left) return `${r} / ${left} cm`;
  if (r) return `${r} cm`;
  if (left) return `${left} cm`;
  return "—";
}

export const EvolutionTab: React.FC<EvolutionTabProps> = ({
  state,
  onAddMeasurement,
  onDeleteMeasurement,
  onDeleteWorkoutSession,
  onUpdateProfile,
  onNavigateTab,
  onToast,
}) => {
  const { isDark } = useTheme();
  const [date, setDate] = useState(getTodayIso());
  const [weightKg, setWeightKg] = useState(String(state.profile.weightKg));
  const [chestCm, setChestCm] = useState("");
  const [waistCm, setWaistCm] = useState("");
  const [abdomenCm, setAbdomenCm] = useState("");
  const [armCm, setArmCm] = useState("");
  const [thighCm, setThighCm] = useState("");
  const [calfCm, setCalfCm] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const chartColors = useMemo(
    () => ({
      gridStroke: isDark ? "#26262B" : "#E2E8F0",
      axisStroke: isDark ? "#A1A1AA" : "#64748B",
      tickFill: isDark ? "#A1A1AA" : "#475569",
      dotStroke: isDark ? "#0B0B0D" : "#FFFFFF",
      activeDotFill: isDark ? "#FFFFFF" : "#0F172A",
      tooltipStyle: {
        backgroundColor: isDark ? "#0B0B0D" : "#FFFFFF",
        borderColor: isDark ? "#26262B" : "#E2E8F0",
        borderRadius: "12px",
        fontSize: "12px",
        color: isDark ? "#FFFFFF" : "#0F172A",
        boxShadow: isDark ? undefined : "0 8px 24px rgba(15, 23, 42, 0.08)",
      },
      tooltipLabelStyle: {
        color: isDark ? "#A1A1AA" : "#475569",
      },
    }),
    [isDark]
  );

  const sortedMeasurements = useMemo(
    () => [...state.measurements].sort((a, b) => a.date.localeCompare(b.date)),
    [state.measurements]
  );

  const chartData = useMemo(
    () =>
      sortedMeasurements.map((m) => ({
        dateLabel: formatDateBr(m.date),
        fullDate: formatFullDateBr(m.date),
        peso: m.weightKg,
        meta: state.profile.targetWeightKg,
      })),
    [sortedMeasurements, state.profile.targetWeightKg]
  );

  const firstWeight =
    sortedMeasurements.length > 0 ? sortedMeasurements[0].weightKg : state.profile.weightKg;
  const latestWeight =
    sortedMeasurements.length > 0
      ? sortedMeasurements[sortedMeasurements.length - 1].weightKg
      : state.profile.weightKg;
  const totalDelta = Number((latestWeight - firstWeight).toFixed(1));
  const remainingToGoal = Number(
    (latestWeight - state.profile.targetWeightKg).toFixed(1)
  );

  const yDomain = useMemo(() => {
    const allWeights = [
      ...sortedMeasurements.map((m) => m.weightKg),
      state.profile.targetWeightKg,
      state.profile.weightKg,
    ];
    const min = Math.floor(Math.min(...allWeights) - 2);
    const max = Math.ceil(Math.max(...allWeights) + 2);
    return [min, max];
  }, [sortedMeasurements, state.profile.targetWeightKg, state.profile.weightKg]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedWeight = parseFloat(weightKg.replace(",", "."));
    if (!Number.isFinite(parsedWeight) || parsedWeight < 30 || parsedWeight > 300) {
      setFormError("Informe um peso corporal válido entre 30 e 300 kg.");
      return;
    }

    const parseOptional = (val: string, label: string, min: number, max: number) => {
      const trimmed = val.trim();
      if (!trimmed) return undefined;
      const n = parseFloat(trimmed.replace(",", "."));
      if (!Number.isFinite(n) || n <= 0) {
        throw new Error(`Valor inválido em ${label}. Use apenas números positivos.`);
      }
      if (n < min || n > max) {
        throw new Error(`${label} deve estar entre ${min} e ${max} cm.`);
      }
      return Number(n.toFixed(1));
    };

    try {
      const parsedChest = parseOptional(chestCm, "Peito", 50, 220);
      const parsedWaist = parseOptional(waistCm, "Cintura", 30, 250);
      const parsedAbdomen = parseOptional(abdomenCm, "Abdômen", 30, 250);
      const parsedArm = parseOptional(armCm, "Braço", 10, 100);
      const parsedThigh = parseOptional(thighCm, "Coxa", 20, 150);
      const parsedCalf = parseOptional(calfCm, "Panturrilha", 15, 90);

      setFormError(null);
      onAddMeasurement({
        date,
        weightKg: Number(parsedWeight.toFixed(1)),
        chestCm: parsedChest,
        waistCm: parsedWaist,
        abdomenCm: parsedAbdomen,
        armRightCm: parsedArm,
        armCm: parsedArm,
        thighRightCm: parsedThigh,
        thighCm: parsedThigh,
        calfCm: parsedCalf,
      });

      setChestCm("");
      setWaistCm("");
      setAbdomenCm("");
      setArmCm("");
      setThighCm("");
      setCalfCm("");
      onToast("Medição salva na sua linha de evolução!", "success");
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Revise os valores informados.");
    }
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold text-[#FF6B00]">
            Acompanhamento Real de Resultados
          </p>
          <h1 className="mt-0.5 text-2xl font-extrabold text-[#0F172A] dark:text-white tracking-tight">
            Evolução Corporal e Treinos
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
          <button
            type="button"
            onClick={() => onNavigateTab("perfil")}
            className="min-h-[42px] px-3.5 rounded-xl bg-white dark:bg-[#151518] hover:bg-[#F8FAFC] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00]/60 shadow-sm dark:shadow-none text-xs font-semibold text-[#0F172A] dark:text-white flex items-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
          >
            <Ruler className="w-3.5 h-3.5 text-[#FF6B00]" />
            <span>Avaliação completa (10 medidas)</span>
          </button>

          {/* Target Weight Quick Editor */}
          <div className="flex items-center gap-2 rounded-xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none px-3 py-1.5">
            <Target className="w-4 h-4 text-[#FF6B00] shrink-0" />
            <label
              htmlFor="target-weight-input"
              className="text-xs text-[#475569] dark:text-[#A1A1AA] whitespace-nowrap"
            >
              Meta (kg):
            </label>
            <input
              id="target-weight-input"
              type="number"
              step="0.5"
              min={35}
              max={250}
              value={state.profile.targetWeightKg}
              onChange={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n) && n >= 35 && n <= 250) {
                  onUpdateProfile({ targetWeightKg: n });
                }
              }}
              className="w-16 min-h-[34px] rounded-lg bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-2 font-mono text-sm font-bold tabular-nums text-[#0F172A] dark:text-white text-center"
            />
          </div>
        </div>
      </div>

      {/* KPI Strip */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none p-4">
          <span className="text-xs text-[#475569] dark:text-[#A1A1AA]">Peso atual</span>
          <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-[#0F172A] dark:text-white">
            {latestWeight.toFixed(1)}{" "}
            <span className="text-xs font-normal text-[#475569] dark:text-[#A1A1AA]">kg</span>
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none p-4">
          <span className="text-xs text-[#475569] dark:text-[#A1A1AA]">Variação registrada</span>
          <p
            className={`mt-1.5 font-mono text-2xl font-bold tabular-nums ${
              totalDelta <= 0 ? "text-[#FF6B00]" : "text-[#0F172A] dark:text-white"
            }`}
          >
            {totalDelta > 0 ? `+${totalDelta.toFixed(1)}` : totalDelta.toFixed(1)}{" "}
            <span className="text-xs font-normal text-[#475569] dark:text-[#A1A1AA]">kg</span>
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none p-4">
          <span className="text-xs text-[#475569] dark:text-[#A1A1AA]">Distância da meta</span>
          <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-[#0F172A] dark:text-white">
            {Math.abs(remainingToGoal).toFixed(1)}{" "}
            <span className="text-xs font-normal text-[#475569] dark:text-[#A1A1AA]">kg</span>
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none p-4">
          <span className="text-xs text-[#475569] dark:text-[#A1A1AA]">Treinos finalizados</span>
          <p className="mt-1.5 font-mono text-2xl font-bold tabular-nums text-[#0F172A] dark:text-white">
            {state.workoutHistory.length}
          </p>
        </div>
      </section>

      {/* Main Grid: Weight Line Chart + Quick Measurement Form */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 items-stretch">
        {/* Interactive Recharts Weight Chart */}
        <section
          aria-label="Gráfico de evolução de peso"
          className="xl:col-span-7 rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none p-5 flex flex-col justify-between"
        >
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-lg font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-[#FF6B00]" />
                <span>Curva de Peso em Direção à Meta</span>
              </h2>
              <p className="text-xs text-[#475569] dark:text-[#A1A1AA]">
                Linha pontilhada indica sua meta de{" "}
                <span className="font-mono text-[#0F172A] dark:text-white font-semibold tabular-nums">
                  {state.profile.targetWeightKg} kg
                </span>
              </p>
            </div>
          </div>

          {chartData.length > 0 ? (
            <div className="w-full h-[270px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ top: 12, right: 16, left: 0, bottom: 5 }}>
                  <CartesianGrid
                    stroke={chartColors.gridStroke}
                    strokeDasharray="3 3"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="dateLabel"
                    stroke={chartColors.axisStroke}
                    tick={{ fill: chartColors.tickFill, fontSize: 12 }}
                    tickLine={false}
                    axisLine={{ stroke: chartColors.gridStroke }}
                  />
                  <YAxis
                    width={48}
                    domain={yDomain}
                    stroke={chartColors.axisStroke}
                    tick={{ fill: chartColors.tickFill, fontSize: 12 }}
                    tickLine={false}
                    axisLine={false}
                    unit="kg"
                  />
                  <Tooltip
                    contentStyle={chartColors.tooltipStyle}
                    labelStyle={chartColors.tooltipLabelStyle}
                    labelFormatter={(_, payload) =>
                      payload?.[0]?.payload?.fullDate || ""
                    }
                    formatter={(value) => {
                      const num = typeof value === "number" ? value : Number(value);
                      return [Number.isFinite(num) ? `${num.toFixed(1)} kg` : "—", "Peso"];
                    }}
                  />
                  <ReferenceLine
                    y={state.profile.targetWeightKg}
                    stroke="#FF6B00"
                    strokeDasharray="5 5"
                    strokeOpacity={0.75}
                    label={{
                      value: `Meta ${state.profile.targetWeightKg}kg`,
                      position: "insideTopRight",
                      fill: "#FF6B00",
                      fontSize: 11,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="peso"
                    stroke="#FF6B00"
                    strokeWidth={3}
                    dot={{ r: 4.5, fill: "#FF6B00", stroke: chartColors.dotStroke, strokeWidth: 2 }}
                    activeDot={{
                      r: 6.5,
                      fill: chartColors.activeDotFill,
                      stroke: "#FF6B00",
                      strokeWidth: 2,
                    }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="h-[240px] rounded-xl border border-dashed border-[#CBD5E1] dark:border-[#26262B] bg-[#F8FAFC] dark:bg-[#0B0B0D]/60 flex flex-col items-center justify-center text-center px-6 gap-2">
              <Scale className="w-7 h-7 text-[#FF6B00]/80" />
              <p className="text-sm font-semibold text-[#0F172A] dark:text-white">
                Nenhuma pesagem registrada
              </p>
              <p className="text-xs text-[#475569] dark:text-[#A1A1AA] max-w-sm">
                Registre seu peso no formulário ao lado ou faça uma avaliação completa no Perfil para acompanhar sua curva.
              </p>
            </div>
          )}
        </section>

        {/* Log New Weight & Measurements Form */}
        <section
          aria-label="Registrar peso e medidas"
          className="xl:col-span-5 rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none p-5"
        >
          <h2 className="text-lg font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
            <Scale className="w-4 h-4 text-[#FF6B00]" />
            <span>Registro Rápido de Peso e Medidas</span>
          </h2>
          <p className="text-xs text-[#475569] dark:text-[#A1A1AA] mt-0.5">
            Atualize seu peso e medidas principais (peito, cintura, abdômen, braço, coxa e panturrilha).
          </p>

          <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="ev-date"
                  className="block text-xs text-[#475569] dark:text-[#A1A1AA] mb-1"
                >
                  Data
                </label>
                <input
                  id="ev-date"
                  type="date"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  required
                  className="w-full min-h-[44px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3 font-mono text-xs text-[#0F172A] dark:text-white"
                />
              </div>

              <div>
                <label
                  htmlFor="ev-weight"
                  className="block text-xs text-[#475569] dark:text-[#A1A1AA] mb-1"
                >
                  Peso Corporal (kg) *
                </label>
                <input
                  id="ev-weight"
                  type="number"
                  step="0.1"
                  min={30}
                  max={300}
                  required
                  value={weightKg}
                  onChange={(e) => setWeightKg(e.target.value)}
                  placeholder="75.0"
                  className="w-full min-h-[44px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3 font-mono text-sm font-semibold tabular-nums text-[#0F172A] dark:text-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label
                  htmlFor="ev-chest"
                  className="block text-xs text-[#475569] dark:text-[#A1A1AA] mb-1"
                >
                  Peito (cm)
                </label>
                <input
                  id="ev-chest"
                  type="number"
                  step="0.5"
                  min={0}
                  value={chestCm}
                  onChange={(e) => setChestCm(e.target.value)}
                  placeholder="Ex.: 98"
                  className="w-full min-h-[44px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3 font-mono text-sm tabular-nums text-[#0F172A] dark:text-white placeholder:text-[#94A3B8] dark:placeholder:text-[#52525B]"
                />
              </div>

              <div>
                <label
                  htmlFor="ev-waist"
                  className="block text-xs text-[#475569] dark:text-[#A1A1AA] mb-1"
                >
                  Cintura (cm)
                </label>
                <input
                  id="ev-waist"
                  type="number"
                  step="0.5"
                  min={0}
                  value={waistCm}
                  onChange={(e) => setWaistCm(e.target.value)}
                  placeholder="Ex.: 83"
                  className="w-full min-h-[44px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3 font-mono text-sm tabular-nums text-[#0F172A] dark:text-white placeholder:text-[#94A3B8] dark:placeholder:text-[#52525B]"
                />
              </div>

              <div>
                <label
                  htmlFor="ev-abdomen"
                  className="block text-xs text-[#475569] dark:text-[#A1A1AA] mb-1"
                >
                  Abdômen (cm)
                </label>
                <input
                  id="ev-abdomen"
                  type="number"
                  step="0.5"
                  min={0}
                  value={abdomenCm}
                  onChange={(e) => setAbdomenCm(e.target.value)}
                  placeholder="Ex.: 88"
                  className="w-full min-h-[44px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3 font-mono text-sm tabular-nums text-[#0F172A] dark:text-white placeholder:text-[#94A3B8] dark:placeholder:text-[#52525B]"
                />
              </div>

              <div>
                <label
                  htmlFor="ev-arm"
                  className="block text-xs text-[#475569] dark:text-[#A1A1AA] mb-1"
                >
                  Braço (cm)
                </label>
                <input
                  id="ev-arm"
                  type="number"
                  step="0.5"
                  min={0}
                  value={armCm}
                  onChange={(e) => setArmCm(e.target.value)}
                  placeholder="Ex.: 36"
                  className="w-full min-h-[44px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3 font-mono text-sm tabular-nums text-[#0F172A] dark:text-white placeholder:text-[#94A3B8] dark:placeholder:text-[#52525B]"
                />
              </div>

              <div>
                <label
                  htmlFor="ev-thigh"
                  className="block text-xs text-[#475569] dark:text-[#A1A1AA] mb-1"
                >
                  Coxa (cm)
                </label>
                <input
                  id="ev-thigh"
                  type="number"
                  step="0.5"
                  min={0}
                  value={thighCm}
                  onChange={(e) => setThighCm(e.target.value)}
                  placeholder="Ex.: 57"
                  className="w-full min-h-[44px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3 font-mono text-sm tabular-nums text-[#0F172A] dark:text-white placeholder:text-[#94A3B8] dark:placeholder:text-[#52525B]"
                />
              </div>

              <div>
                <label
                  htmlFor="ev-calf"
                  className="block text-xs text-[#475569] dark:text-[#A1A1AA] mb-1"
                >
                  Panturrilha (cm)
                </label>
                <input
                  id="ev-calf"
                  type="number"
                  step="0.5"
                  min={0}
                  value={calfCm}
                  onChange={(e) => setCalfCm(e.target.value)}
                  placeholder="Ex.: 38"
                  className="w-full min-h-[44px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3 font-mono text-sm tabular-nums text-[#0F172A] dark:text-white placeholder:text-[#94A3B8] dark:placeholder:text-[#52525B]"
                />
              </div>
            </div>

            {formError && (
              <div
                role="alert"
                className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/40 px-3.5 py-2 text-xs text-red-700 dark:text-red-200"
              >
                {formError}
              </div>
            )}

            <button
              type="submit"
              className="w-full min-h-[46px] rounded-xl bg-[#FF6B00] hover:bg-[#F97316] active:scale-[0.98] text-sm font-bold text-white flex items-center justify-center gap-2 transition-all cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Salvar medição</span>
            </button>
          </form>
        </section>
      </div>

      {/* Measurements History Table */}
      <section
        aria-label="Histórico de peso e medidas"
        className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none overflow-hidden"
      >
        <div className="p-5 border-b border-[#E2E8F0] dark:border-[#26262B] flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-[#0F172A] dark:text-white">
            Histórico de Avaliações e Medidas
          </h2>
          <span className="font-mono text-xs text-[#475569] dark:text-[#A1A1AA] tabular-nums">
            {sortedMeasurements.length}{" "}
            {sortedMeasurements.length === 1 ? "avaliação" : "avaliações"}
          </span>
        </div>

        {sortedMeasurements.length === 0 ? (
          <div className="p-8 text-center space-y-2">
            <p className="text-sm font-semibold text-[#0F172A] dark:text-white">
              Sem avaliações registradas
            </p>
            <p className="text-xs text-[#475569] dark:text-[#A1A1AA]">
              Salve sua primeira pesagem acima ou preencha a avaliação completa de 10 pontos na tela de Perfil.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-[#E2E8F0] dark:border-[#26262B] bg-[#F8FAFC] dark:bg-transparent text-[11px] font-semibold text-[#475569] dark:text-[#A1A1AA]">
                  <th className="py-3 px-4">Data</th>
                  <th className="py-3 px-4 text-right">Peso</th>
                  <th className="py-3 px-4 text-right">Peito</th>
                  <th className="py-3 px-4 text-right">Cintura</th>
                  <th className="py-3 px-4 text-right">Abdômen</th>
                  <th className="py-3 px-4 text-right">Quadril</th>
                  <th className="py-3 px-4 text-right">Braço D/E</th>
                  <th className="py-3 px-4 text-right">Coxa D/E</th>
                  <th className="py-3 px-4 text-right">Panturrilha</th>
                  <th className="py-3 px-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#26262B] text-sm">
                {[...sortedMeasurements].reverse().map((m) => (
                  <tr
                    key={m.id}
                    className="hover:bg-[#F8FAFC] dark:hover:bg-[#1C1C21]/50 transition-colors"
                  >
                    <td className="py-3 px-4 font-mono text-xs tabular-nums text-[#334155] dark:text-[#D4D4D8] whitespace-nowrap">
                      {formatFullDateBr(m.date)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-semibold tabular-nums text-[#0F172A] dark:text-white whitespace-nowrap">
                      {m.weightKg.toFixed(1)} kg
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[#475569] dark:text-[#A1A1AA] whitespace-nowrap">
                      {m.chestCm ? `${m.chestCm} cm` : "—"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[#475569] dark:text-[#A1A1AA] whitespace-nowrap">
                      {m.waistCm ? `${m.waistCm} cm` : "—"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[#475569] dark:text-[#A1A1AA] whitespace-nowrap">
                      {m.abdomenCm ? `${m.abdomenCm} cm` : "—"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[#475569] dark:text-[#A1A1AA] whitespace-nowrap">
                      {m.hipCm ? `${m.hipCm} cm` : "—"}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[#475569] dark:text-[#A1A1AA] whitespace-nowrap">
                      {formatPair(m.armRightCm, m.armLeftCm, m.armCm)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[#475569] dark:text-[#A1A1AA] whitespace-nowrap">
                      {formatPair(m.thighRightCm, m.thighLeftCm, m.thighCm)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums text-[#475569] dark:text-[#A1A1AA] whitespace-nowrap">
                      {m.calfCm ? `${m.calfCm} cm` : "—"}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteMeasurement(m.id);
                          onToast("Registro removido do histórico.", "info");
                        }}
                        aria-label={`Remover medição de ${formatFullDateBr(m.date)}`}
                        className="min-h-[36px] min-w-[36px] inline-flex items-center justify-center rounded-lg text-[#475569] dark:text-[#A1A1AA] hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-[#0B0B0D] transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Completed Workouts & Cardio History */}
      <section
        aria-label="Histórico de treinos e cardio finalizados"
        className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none overflow-hidden"
      >
        <div className="p-5 border-b border-[#E2E8F0] dark:border-[#26262B] flex items-center justify-between gap-3">
          <h2 className="text-base font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
            <Dumbbell className="w-4 h-4 text-[#FF6B00]" />
            <span>Histórico de Treinos & Sessões de Cardio</span>
          </h2>
          <span className="font-mono text-xs text-[#475569] dark:text-[#A1A1AA] tabular-nums">
            {state.workoutHistory.length} registros
          </span>
        </div>

        {state.workoutHistory.length === 0 ? (
          <div className="p-8 text-center space-y-3">
            <p className="text-sm font-semibold text-[#0F172A] dark:text-white">
              Nenhum treino ou cardio finalizado ainda
            </p>
            <p className="text-xs text-[#475569] dark:text-[#A1A1AA] max-w-md mx-auto">
              Conclua seu treino de musculação ou registre uma sessão no Controle de Cardio na aba Treinos para acompanhar sua evolução.
            </p>
            <button
              type="button"
              onClick={() => onNavigateTab("treinos")}
              className="min-h-[42px] px-5 rounded-xl bg-[#FF6B00] hover:bg-[#F97316] text-xs font-bold text-white inline-flex items-center gap-2 transition-colors cursor-pointer"
            >
              <Dumbbell className="w-4 h-4" />
              <span>Ir para Treinos & Cardio</span>
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#E2E8F0] dark:divide-[#26262B]">
            {state.workoutHistory.map((item) => {
              const isCardio =
                item.id.startsWith("cardio_") ||
                item.muscleGroup.toLowerCase().includes("cardio") ||
                item.muscleGroup.toLowerCase().includes("spinning");

              return (
                <div
                  key={item.id}
                  className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-[#F8FAFC] dark:hover:bg-[#1C1C21]/40 transition-colors"
                >
                  <div>
                    <div className="flex items-center gap-2 text-xs text-[#475569] dark:text-[#A1A1AA]">
                      {isCardio ? (
                        <Activity className="w-3.5 h-3.5 text-[#FF6B00]" />
                      ) : (
                        <Calendar className="w-3.5 h-3.5 text-[#FF6B00]" />
                      )}
                      <span className="font-mono tabular-nums">
                        {formatFullDateBr(item.date)}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span className={isCardio ? "text-[#FF6B00] font-semibold" : ""}>
                        {item.muscleGroup}
                      </span>
                    </div>
                    <h3 className="mt-0.5 text-base font-bold text-[#0F172A] dark:text-white">
                      {item.title}
                    </h3>
                  </div>

                  <div className="flex items-center gap-3 text-xs font-mono tabular-nums text-[#334155] dark:text-[#D4D4D8]">
                    <span>{item.durationMin} min</span>
                    {!isCardio && (
                      <>
                        <span aria-hidden="true" className="text-[#CBD5E1] dark:text-[#52525B]">
                          ·
                        </span>
                        <span>{item.setsCompleted} séries</span>
                      </>
                    )}
                    {typeof item.distanceKm === "number" && item.distanceKm > 0 && (
                      <>
                        <span aria-hidden="true" className="text-[#CBD5E1] dark:text-[#52525B]">
                          ·
                        </span>
                        <span>{item.distanceKm} km</span>
                      </>
                    )}
                    {typeof item.caloriesKcal === "number" && item.caloriesKcal > 0 && (
                      <>
                        <span aria-hidden="true" className="text-[#CBD5E1] dark:text-[#52525B]">
                          ·
                        </span>
                        <span className="text-[#FF6B00] font-semibold inline-flex items-center gap-1">
                          <Flame className="w-3.5 h-3.5" />
                          {item.caloriesKcal} kcal
                        </span>
                      </>
                    )}
                    {item.totalVolumeKg > 0 && (
                      <>
                        <span aria-hidden="true" className="text-[#CBD5E1] dark:text-[#52525B]">
                          ·
                        </span>
                        <span className="text-[#FF6B00] font-semibold">
                          {item.totalVolumeKg.toLocaleString("pt-BR")} kg vol.
                        </span>
                      </>
                    )}
                    {onDeleteWorkoutSession && (
                      <button
                        type="button"
                        onClick={() => {
                          onDeleteWorkoutSession(item.id);
                          onToast("Registro removido do histórico.", "info");
                        }}
                        aria-label="Remover sessão do histórico"
                        className="ml-1 min-h-[32px] min-w-[32px] rounded-lg text-[#64748B] dark:text-[#A1A1AA] hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-[#0B0B0D] inline-flex items-center justify-center transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
