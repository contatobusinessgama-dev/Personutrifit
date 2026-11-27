import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  AlertTriangle,
  BookOpen,
  Check,
  ClipboardCopy,
  Compass,
  Edit3,
  Loader2,
  RefreshCw,
  RotateCcw,
  Search,
  Sparkles,
  Square,
  Trash2,
  Wind,
  X,
} from "lucide-react";
import { EXERCISE_MAP, EXERCISES, MUSCLE_GROUPS } from "../data/exercises";
import {
  BiancoAppState,
  BodyMeasurement,
  EquipmentType,
  ExerciseItem,
  MetabolicResult,
  MuscleGroupId,
  ToastOptions,
} from "../types";
import {
  AiLoadingPhase,
  AiRetryInfo,
  FriendlyAiError,
  generateWithFallback,
  getAiToastNotification,
  isAbortedAiError,
} from "../services/geminiService";

const EXERCISE_TIPS_STORAGE_KEY = "personal_nutri_fit_exercise_ai_tips_v1";

interface StoredExerciseTip {
  content: string;
  updatedAt: string;
  source: "ai" | "manual";
}

type StoredTipsMap = Record<string, StoredExerciseTip>;

const EQUIPMENT_FILTERS: (EquipmentType | "all")[] = [
  "all",
  "Máquina Articulada",
  "Polia/Cross",
  "Peso Livre",
  "Peso Corporal",
];

function normalizeSearch(value: string): string {
  return (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}

function loadStoredTips(): StoredTipsMap {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(EXERCISE_TIPS_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as StoredTipsMap;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function saveStoredTips(tips: StoredTipsMap): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(EXERCISE_TIPS_STORAGE_KEY, JSON.stringify(tips));
  } catch {
    // Ignore storage quota errors
  }
}

function formatUpdatedLabel(iso: string): string {
  try {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "";
    return date.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

interface ExerciseLibraryTabProps {
  state: BiancoAppState;
  metabolism: MetabolicResult;
  latestMeasurement: BodyMeasurement | null;
  onToast: (
    message: string,
    tone?: "success" | "info" | "warning",
    options?: ToastOptions
  ) => void;
}

export const ExerciseLibraryTab: React.FC<ExerciseLibraryTabProps> = ({
  state,
  metabolism,
  latestMeasurement,
  onToast,
}) => {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedMuscle, setSelectedMuscle] = useState<MuscleGroupId | "all">("all");
  const [selectedEquipment, setSelectedEquipment] = useState<EquipmentType | "all">("all");
  const [onlyWithTips, setOnlyWithTips] = useState(false);

  const [tipsMap, setTipsMap] = useState<StoredTipsMap>(() => loadStoredTips());
  const [editingIds, setEditingIds] = useState<Record<string, boolean>>({});
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [generatingId, setGeneratingId] = useState<string | null>(null);
  const [loadingPhase, setLoadingPhase] = useState<AiLoadingPhase>("idle");
  const [retryInfo, setRetryInfo] = useState<AiRetryInfo | null>(null);
  const [streamingPreview, setStreamingPreview] = useState("");
  const [errorByExercise, setErrorByExercise] = useState<Record<string, string>>({});

  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    saveStoredTips(tipsMap);
  }, [tipsMap]);

  const filledTipsCount = useMemo(
    () =>
      Object.values(tipsMap).filter((entry) => entry && entry.content.trim().length > 0)
        .length,
    [tipsMap]
  );

  const muscleCounts = useMemo(() => {
    const counts: Record<string, number> = { all: EXERCISES.length };
    for (const ex of EXERCISES) {
      counts[ex.muscleGroup] = (counts[ex.muscleGroup] || 0) + 1;
    }
    return counts;
  }, []);

  const filteredExercises = useMemo(() => {
    const query = normalizeSearch(searchQuery.trim());
    return EXERCISES.filter((ex) => {
      if (selectedMuscle !== "all" && ex.muscleGroup !== selectedMuscle) {
        return false;
      }
      if (selectedEquipment !== "all" && ex.equipment !== selectedEquipment) {
        return false;
      }
      if (onlyWithTips && !tipsMap[ex.id]?.content?.trim()) {
        return false;
      }
      if (!query) return true;

      const tipText = tipsMap[ex.id]?.content || "";
      const haystack = normalizeSearch(
        `${ex.name} ${ex.muscleLabel} ${ex.equipment} ${ex.guide.machineSetup} ${ex.guide.posture} ${ex.guide.breathing || ""} ${ex.guide.commonMistake} ${tipText}`
      );
      return haystack.includes(query);
    });
  }, [searchQuery, selectedMuscle, selectedEquipment, onlyWithTips, tipsMap]);

  const handleStopGeneration = () => {
    abortControllerRef.current?.abort();
  };

  const handleGenerateTechnicalTips = useCallback(
    async (exercise: ExerciseItem) => {
      if (abortControllerRef.current) {
        onToast("Aguarde a dica técnica em andamento ou clique em Parar.", "info");
        return;
      }

      const controller = new AbortController();
      abortControllerRef.current = controller;

      setGeneratingId(exercise.id);
      setLoadingPhase("waiting");
      setRetryInfo(null);
      setStreamingPreview("");
      setEditingIds((prev) => ({ ...prev, [exercise.id]: false }));
      setErrorByExercise((prev) => {
        const next = { ...prev };
        delete next[exercise.id];
        return next;
      });

      const prompt = [
        `DICAS TÉCNICAS PARA EXERCÍCIO ÚNICO DA BIBLIOTECA: "${exercise.name}"`,
        `Grupamento muscular: ${exercise.muscleLabel} | Equipamento: ${exercise.equipment}`,
        `Referência padrão: ${exercise.defaultSets} séries de ${exercise.defaultReps} reps (${exercise.defaultRest}s descanso).`,
        "",
        "Forneça APENAS dicas técnicas práticas e personalizadas para o meu perfil, nível e eventuais restrições, em 4 tópicos curtos e diretos (em Markdown):",
        "- **Ajuste fino e postura:** detalhe chave para maximizar a biomecânica.",
        "- **Cadência e respiração:** tempo ideal de subida/descida e controle respiratório.",
        "- **Conexão mente-músculo:** onde focar a força e como evitar compensações.",
        "- **Progressão ou adaptação segura:** ajuste sugerido para meu nível e objetivo.",
        "Não monte treino completo, não prescreva cardio e não adicione bloco de alongamento.",
      ].join("\n");

      let lastStreamedText = "";

      try {
        const finalText = await generateWithFallback({
          endpoint: "/api/ai/personal",
          message: prompt,
          history: [],
          signal: controller.signal,
          maxRetries: 3,
          baseDelayMs: 900,
          maxDelayMs: 8000,
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
            muscleToday: exercise.muscleLabel,
            level: state.profile.level,
            availableTime: state.profile.availableTime,
            latestMeasurements: latestMeasurement
              ? {
                  date: latestMeasurement.date,
                  weightKg: latestMeasurement.weightKg,
                  neckCm: latestMeasurement.neckCm,
                  chestCm: latestMeasurement.chestCm,
                  waistCm: latestMeasurement.waistCm,
                  abdomenCm: latestMeasurement.abdomenCm,
                  hipCm: latestMeasurement.hipCm,
                  armRightCm: latestMeasurement.armRightCm ?? latestMeasurement.armCm,
                  armLeftCm: latestMeasurement.armLeftCm,
                  thighRightCm: latestMeasurement.thighRightCm ?? latestMeasurement.thighCm,
                  thighLeftCm: latestMeasurement.thighLeftCm,
                  calfCm: latestMeasurement.calfCm,
                }
              : null,
          },
          onStateChange: (phase, nextRetry) => {
            if (!mountedRef.current) return;
            setLoadingPhase(phase);
            setRetryInfo(nextRetry ?? null);
          },
          onRetry: (info) => {
            if (!mountedRef.current) return;
            setRetryInfo(info);
          },
          onChunk: (fullText) => {
            lastStreamedText = fullText;
            if (mountedRef.current) {
              setStreamingPreview(fullText);
            }
          },
        });

        const cleanFinal = finalText.trim();
        if (cleanFinal && mountedRef.current) {
          setTipsMap((prev) => ({
            ...prev,
            [exercise.id]: {
              content: cleanFinal,
              updatedAt: new Date().toISOString(),
              source: "ai",
            },
          }));
          onToast(`Dicas técnicas preenchidas para ${exercise.name}!`, "success");
        }
      } catch (err) {
        if (isAbortedAiError(err)) {
          if (lastStreamedText.trim() && mountedRef.current) {
            setTipsMap((prev) => ({
              ...prev,
              [exercise.id]: {
                content: lastStreamedText.trim(),
                updatedAt: new Date().toISOString(),
                source: "ai",
              },
            }));
          }
          if (mountedRef.current) {
            onToast("Geração de dicas interrompida.", "info");
          }
          return;
        }

        const friendly = err instanceof FriendlyAiError ? err : null;
        const toastInfo = getAiToastNotification(err);
        const message = toastInfo.isUnavailable
          ? toastInfo.message
          : friendly?.message || toastInfo.message;

        if (mountedRef.current) {
          setErrorByExercise((prev) => ({ ...prev, [exercise.id]: message }));
        }
        onToast(message, "warning");
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        if (mountedRef.current) {
          setGeneratingId(null);
          setLoadingPhase("idle");
          setRetryInfo(null);
          setStreamingPreview("");
        }
      }
    },
    [state.profile, state.goals, metabolism, latestMeasurement, onToast]
  );

  const handleManualTipChange = (exerciseId: string, value: string) => {
    setTipsMap((prev) => {
      if (!value.trim()) {
        const next = { ...prev };
        delete next[exerciseId];
        return next;
      }
      return {
        ...prev,
        [exerciseId]: {
          content: value,
          updatedAt: new Date().toISOString(),
          source: "manual",
        },
      };
    });
  };

  const handleClearTip = (exercise: ExerciseItem) => {
    setTipsMap((prev) => {
      const next = { ...prev };
      delete next[exercise.id];
      return next;
    });
    setEditingIds((prev) => ({ ...prev, [exercise.id]: false }));
    onToast(`Campo de dicas técnicas limpo para ${exercise.name}.`, "info");
  };

  const handleCopyTip = async (exercise: ExerciseItem, content: string) => {
    try {
      await navigator.clipboard.writeText(`${exercise.name} — Dicas Técnicas\n\n${content}`);
      setCopiedId(exercise.id);
      onToast("Dicas técnicas copiadas!", "success");
      window.setTimeout(() => setCopiedId(null), 2200);
    } catch {
      onToast("Não foi possível copiar automaticamente neste navegador.", "warning");
    }
  };

  const handleJumpToAlternative = (altExercise: ExerciseItem) => {
    setSelectedMuscle("all");
    setSelectedEquipment("all");
    setOnlyWithTips(false);
    setSearchQuery(altExercise.name);
  };

  const handleResetFilters = () => {
    setSearchQuery("");
    setSelectedMuscle("all");
    setSelectedEquipment("all");
    setOnlyWithTips(false);
  };

  return (
    <div className="space-y-5 pb-20 md:pb-8">
      {/* Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[#FF6B00] flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Catálogo Técnico de Musculação</span>
          </p>
          <h1 className="mt-0.5 text-2xl font-extrabold text-[#0F172A] dark:text-white tracking-tight">
            Biblioteca de Exercícios
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-[#475569] dark:text-[#A1A1AA] max-w-2xl">
            Pesquise exercícios por nome ou grupamento muscular, consulte as descrições de execução e peça ao Personal IA para preencher dicas técnicas sob medida no campo de cada exercício.
          </p>
        </div>

        {/* Clean Unboxed Summary Metrics */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-[#64748B] dark:text-[#A1A1AA]">
          <span className="font-mono tabular-nums">
            <strong className="text-[#0F172A] dark:text-white">{filteredExercises.length}</strong>{" "}
            de {EXERCISES.length} exibidos
          </span>
          <span aria-hidden="true">·</span>
          <span className="font-mono tabular-nums">
            <strong className="text-[#FF6B00]">{filledTipsCount}</strong> com dicas da IA
          </span>
        </div>
      </div>

      {/* Search & Muscle Group Filter Panel */}
      <section
        aria-label="Pesquisar e filtrar biblioteca de exercícios"
        className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] p-4 sm:p-5 space-y-4"
      >
        {/* Row 1: Search Input + Equipment Select + Only-AI-Tips Toggle */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-3">
          <div className="md:col-span-6 relative">
            <Search className="w-4 h-4 text-[#94A3B8] dark:text-[#71717A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Pesquisar exercício, músculo, aparelho ou descrição..."
              aria-label="Pesquisar exercícios na biblioteca"
              className="w-full min-h-[44px] pl-10 pr-9 rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none text-sm text-[#0F172A] dark:text-white placeholder:text-[#94A3B8] dark:placeholder:text-[#52525B]"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                aria-label="Limpar busca"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 w-6 h-6 rounded-md text-[#64748B] hover:text-[#0F172A] dark:hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="md:col-span-3">
            <label htmlFor="library-equipment-filter" className="sr-only">
              Filtrar por tipo de equipamento
            </label>
            <select
              id="library-equipment-filter"
              value={selectedEquipment}
              onChange={(e) =>
                setSelectedEquipment(e.target.value as EquipmentType | "all")
              }
              className="w-full min-h-[44px] px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none text-xs sm:text-sm font-medium text-[#0F172A] dark:text-white"
            >
              {EQUIPMENT_FILTERS.map((eq) => (
                <option key={eq} value={eq}>
                  {eq === "all" ? "Todos os aparelhos" : eq}
                </option>
              ))}
            </select>
          </div>

          <div className="md:col-span-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setOnlyWithTips((prev) => !prev)}
              className={`flex-1 min-h-[44px] px-3 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                onlyWithTips
                  ? "bg-[#FF6B00] border-[#FF6B00] text-white"
                  : "bg-[#F8FAFC] dark:bg-[#0B0B0D] border-[#E2E8F0] dark:border-[#26262B] text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white"
              }`}
            >
              <Sparkles className="w-3.5 h-3.5 shrink-0" />
              <span>Com dicas IA ({filledTipsCount})</span>
            </button>
          </div>
        </div>

        {/* Row 2: Muscle Group Filter Bar */}
        <div className="pt-3 border-t border-[#E2E8F0] dark:border-[#26262B] space-y-2">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-medium text-[#64748B] dark:text-[#A1A1AA]">
              Filtrar por grupamento muscular
            </span>
            {(searchQuery ||
              selectedMuscle !== "all" ||
              selectedEquipment !== "all" ||
              onlyWithTips) && (
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-xs font-semibold text-[#FF6B00] hover:text-[#EA580C] dark:hover:text-orange-300 flex items-center gap-1 cursor-pointer whitespace-nowrap"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Limpar filtros</span>
              </button>
            )}
          </div>

          <div
            role="group"
            aria-label="Filtro de grupamento muscular"
            className="flex flex-wrap items-center gap-1.5"
          >
            <button
              type="button"
              onClick={() => setSelectedMuscle("all")}
              className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                selectedMuscle === "all"
                  ? "bg-[#FF6B00] border-[#FF6B00] text-white"
                  : "bg-[#F8FAFC] dark:bg-[#0B0B0D] border-[#E2E8F0] dark:border-[#26262B] text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white"
              }`}
            >
              Todos{" "}
              <span className="font-mono tabular-nums opacity-80">
                ({muscleCounts.all})
              </span>
            </button>

            {MUSCLE_GROUPS.map((group) => {
              const active = selectedMuscle === group.id;
              return (
                <button
                  key={group.id}
                  type="button"
                  onClick={() => setSelectedMuscle(group.id)}
                  className={`min-h-[36px] px-3 rounded-lg text-xs font-semibold border transition-colors cursor-pointer whitespace-nowrap ${
                    active
                      ? "bg-[#FF6B00] border-[#FF6B00] text-white"
                      : "bg-[#F8FAFC] dark:bg-[#0B0B0D] border-[#E2E8F0] dark:border-[#26262B] text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white"
                  }`}
                >
                  {group.label}{" "}
                  <span className="font-mono tabular-nums opacity-80">
                    ({muscleCounts[group.id] || 0})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Exercise Cards List */}
      {filteredExercises.length === 0 ? (
        <div className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] p-10 text-center space-y-3">
          <BookOpen className="w-8 h-8 text-[#94A3B8] dark:text-[#71717A] mx-auto" />
          <div className="space-y-1">
            <h2 className="text-base font-bold text-[#0F172A] dark:text-white">
              Nenhum exercício encontrado
            </h2>
            <p className="text-xs sm:text-sm text-[#64748B] dark:text-[#A1A1AA]">
              Ajuste o termo pesquisado ou selecione outro grupamento muscular para explorar o catálogo.
            </p>
          </div>
          <button
            type="button"
            onClick={handleResetFilters}
            className="min-h-[40px] px-4 rounded-xl bg-[#FF6B00] hover:bg-[#F97316] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Mostrar todos os exercícios</span>
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredExercises.map((exercise) => {
            const storedTip = tipsMap[exercise.id];
            const isGeneratingThis = generatingId === exercise.id;
            const isEditingThis = Boolean(editingIds[exercise.id]);
            const displayedTipContent = isGeneratingThis
              ? streamingPreview
              : storedTip?.content || "";
            const hasSavedTip = Boolean(storedTip?.content?.trim());
            const errorText = errorByExercise[exercise.id];
            const alternatives = exercise.alternatives
              .map((altId) => EXERCISE_MAP[altId])
              .filter((alt): alt is ExerciseItem => Boolean(alt));

            return (
              <article
                key={exercise.id}
                className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] p-5 sm:p-6 space-y-4"
              >
                {/* Header & Unboxed Metadata */}
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                  <div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#64748B] dark:text-[#A1A1AA]">
                      <span className="font-semibold text-[#FF6B00]">
                        {exercise.muscleLabel}
                      </span>
                      <span aria-hidden="true">·</span>
                      <span>{exercise.equipment}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono tabular-nums">
                        Ref.: {exercise.defaultSets}x {exercise.defaultReps} ·{" "}
                        {exercise.defaultRest}s descanso
                      </span>
                    </div>
                    <h2 className="mt-1 text-lg font-extrabold text-[#0F172A] dark:text-white tracking-tight">
                      {exercise.name}
                    </h2>
                  </div>

                  {alternatives.length > 0 && (
                    <div className="text-xs text-[#64748B] dark:text-[#A1A1AA] flex flex-wrap items-center gap-x-1.5 gap-y-1 sm:justify-end">
                      <span>Equivalentes:</span>
                      {alternatives.slice(0, 2).map((alt, idx) => (
                        <React.Fragment key={alt.id}>
                          {idx > 0 && <span aria-hidden="true">/</span>}
                          <button
                            type="button"
                            onClick={() => handleJumpToAlternative(alt)}
                            className="font-medium text-[#334155] dark:text-[#D4D4D8] hover:text-[#FF6B00] underline decoration-[#CBD5E1] dark:decoration-[#3A3A42] underline-offset-2 transition-colors cursor-pointer"
                          >
                            {alt.name}
                          </button>
                        </React.Fragment>
                      ))}
                    </div>
                  )}
                </div>

                {/* Textual Descriptions Grid (Clean Hairline Separators, No Card-in-Card) */}
                <div className="pt-4 border-t border-[#E2E8F0] dark:border-[#26262B] grid grid-cols-1 md:grid-cols-2 gap-4 text-xs sm:text-[13px] leading-relaxed">
                  <div className="space-y-3">
                    <div>
                      <h3 className="font-bold text-[#0F172A] dark:text-white flex items-center gap-1.5">
                        <Compass className="w-3.5 h-3.5 text-[#FF6B00] shrink-0" />
                        <span>Ajuste do aparelho e preparação</span>
                      </h3>
                      <p className="mt-1 text-[#475569] dark:text-[#A1A1AA]">
                        {exercise.guide.machineSetup}
                      </p>
                    </div>

                    {exercise.guide.breathing && (
                      <div className="pt-3 border-t border-[#E2E8F0] dark:border-[#26262B]">
                        <h3 className="font-bold text-[#0F172A] dark:text-white flex items-center gap-1.5">
                          <Wind className="w-3.5 h-3.5 text-[#FF6B00] shrink-0" />
                          <span>Respiração e controle</span>
                        </h3>
                        <p className="mt-1 text-[#475569] dark:text-[#A1A1AA]">
                          {exercise.guide.breathing}
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="space-y-3 md:border-l md:border-[#E2E8F0] md:dark:border-[#26262B] md:pl-5">
                    <div>
                      <h3 className="font-bold text-emerald-700 dark:text-emerald-400">
                        Execução técnica e postura
                      </h3>
                      <p className="mt-1 text-[#334155] dark:text-[#D4D4D8]">
                        {exercise.guide.posture}
                      </p>
                    </div>

                    <div className="pt-3 border-t border-[#E2E8F0] dark:border-[#26262B]">
                      <h3 className="font-bold text-amber-700 dark:text-amber-400 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                        <span>Erro comum a evitar</span>
                      </h3>
                      <p className="mt-1 text-[#475569] dark:text-[#A1A1AA]">
                        {exercise.guide.commonMistake}
                      </p>
                    </div>
                  </div>
                </div>

                {/* Personal IA Technical Tips Field */}
                <div className="pt-4 border-t border-[#E2E8F0] dark:border-[#26262B] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <label
                        htmlFor={`ai-tip-field-${exercise.id}`}
                        className="text-xs sm:text-sm font-bold text-[#0F172A] dark:text-white flex items-center gap-1.5"
                      >
                        <Sparkles className="w-4 h-4 text-[#FF6B00] shrink-0" />
                        <span>Dicas Técnicas do Personal IA</span>
                      </label>
                      <p className="text-[11px] text-[#64748B] dark:text-[#A1A1AA] mt-0.5">
                        {storedTip?.updatedAt
                          ? `${
                              storedTip.source === "ai"
                                ? "Preenchido pelo Personal IA"
                                : "Editado manualmente"
                            } · ${formatUpdatedLabel(storedTip.updatedAt)}`
                          : `Adaptado ao seu perfil (${state.profile.level} · ${state.goals.primary})`}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-1.5">
                      {isGeneratingThis ? (
                        <button
                          type="button"
                          onClick={handleStopGeneration}
                          className="min-h-[38px] px-3.5 rounded-xl bg-[#F1F5F9] dark:bg-[#1C1C21] border border-[#CBD5E1] dark:border-[#3A3A42] text-xs font-semibold text-[#0F172A] dark:text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
                        >
                          <Square className="w-3 h-3 fill-current text-[#FF6B00]" />
                          <span>Parar</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          disabled={generatingId !== null}
                          onClick={() => void handleGenerateTechnicalTips(exercise)}
                          className="min-h-[38px] px-3.5 rounded-xl bg-[#FF6B00] hover:bg-[#F97316] disabled:opacity-50 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                        >
                          {hasSavedTip ? (
                            <>
                              <RefreshCw className="w-3.5 h-3.5" />
                              <span>Atualizar com Personal IA</span>
                            </>
                          ) : (
                            <>
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Preencher com Personal IA</span>
                            </>
                          )}
                        </button>
                      )}

                      {hasSavedTip && !isGeneratingThis && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setEditingIds((prev) => ({
                                ...prev,
                                [exercise.id]: !prev[exercise.id],
                              }))
                            }
                            className="min-h-[38px] px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] hover:bg-[#F1F5F9] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] text-xs font-semibold text-[#334155] dark:text-[#D4D4D8] flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>{isEditingThis ? "Visualizar" : "Editar"}</span>
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              void handleCopyTip(exercise, storedTip.content)
                            }
                            aria-label={`Copiar dicas técnicas de ${exercise.name}`}
                            className="min-h-[38px] px-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] hover:bg-[#F1F5F9] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] text-xs font-semibold text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                          >
                            {copiedId === exercise.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <ClipboardCopy className="w-3.5 h-3.5" />
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => handleClearTip(exercise)}
                            aria-label={`Limpar dicas técnicas de ${exercise.name}`}
                            className="min-h-[38px] px-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] hover:bg-red-500/10 border border-[#E2E8F0] dark:border-[#26262B] hover:border-red-500/40 text-[#64748B] dark:text-[#A1A1AA] hover:text-red-600 dark:hover:text-red-400 flex items-center justify-center transition-colors cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Error alert if generation failed */}
                  {errorText && (
                    <div
                      role="alert"
                      className="rounded-xl bg-red-500/10 border border-red-500/35 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-300 flex items-center justify-between gap-2"
                    >
                      <span>{errorText}</span>
                      <button
                        type="button"
                        onClick={() => void handleGenerateTechnicalTips(exercise)}
                        className="font-semibold underline cursor-pointer shrink-0"
                      >
                        Tentar novamente
                      </button>
                    </div>
                  )}

                  {/* Field Body: Streaming / Formatted Read View / Editable Textarea */}
                  {isGeneratingThis ? (
                    <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#FF6B00]/40 p-4 space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold text-[#FF6B00]">
                        <Loader2 className="w-3.5 h-3.5 animate-spin shrink-0" />
                        <span>
                          {loadingPhase === "retrying" && retryInfo
                            ? `Reconectando ao Personal IA (tentativa ${retryInfo.attempt}/${retryInfo.maxRetries})...`
                            : "Personal IA elaborando dicas técnicas personalizadas..."}
                        </span>
                      </div>
                      {displayedTipContent && (
                        <div className="ai-prose text-xs sm:text-[13px] text-[#0F172A] dark:text-[#E4E4E7]">
                          <ReactMarkdown>{displayedTipContent}</ReactMarkdown>
                        </div>
                      )}
                    </div>
                  ) : hasSavedTip && !isEditingThis ? (
                    <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] p-4">
                      <div className="ai-prose text-xs sm:text-[13px] text-[#0F172A] dark:text-[#E4E4E7]">
                        <ReactMarkdown>{storedTip.content}</ReactMarkdown>
                      </div>
                    </div>
                  ) : (
                    <textarea
                      id={`ai-tip-field-${exercise.id}`}
                      rows={hasSavedTip ? 6 : 3}
                      value={storedTip?.content || ""}
                      onChange={(e) =>
                        handleManualTipChange(exercise.id, e.target.value)
                      }
                      placeholder="Clique em 'Preencher com Personal IA' para gerar dicas técnicas personalizadas para este exercício, ou escreva suas próprias anotações técnicas aqui..."
                      className="w-full rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none p-3.5 text-xs sm:text-sm leading-relaxed text-[#0F172A] dark:text-white placeholder:text-[#94A3B8] dark:placeholder:text-[#52525B] resize-y"
                    />
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
};
