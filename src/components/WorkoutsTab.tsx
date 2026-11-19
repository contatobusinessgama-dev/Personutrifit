import React, { useEffect, useMemo, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  AlertTriangle,
  BookmarkCheck,
  Check,
  CheckCircle2,
  Clock,
  Dumbbell,
  ExternalLink,
  Flame,
  Info,
  Settings2,
  Trash2,
  Wind,
  X,
} from "lucide-react";
import {
  EXERCISE_MAP,
  EXERCISES,
  GYM_MODALITIES,
  MUSCLE_GROUPS,
  WORKOUT_COMBOS,
} from "../data/exercises";
import {
  BiancoAppState,
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
            { id: "modalidades", label: "Modalidades" },
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

            <button
              type="button"
              onClick={handleCompleteActiveCombo}
              className="min-h-[48px] px-5 py-3 rounded-xl bg-[#FF6B00] hover:bg-[#F97316] active:scale-[0.98] text-sm font-bold text-white flex items-center justify-center gap-2 transition-all whitespace-nowrap shrink-0 cursor-pointer"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Finalizar Treino</span>
            </button>
          </div>

          {/* Active Combo Exercises */}
          {renderExerciseList(activeCombo.exerciseIds)}
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
                {muscleExercises.length} aparelhos e exercícios disponíveis na academia
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
                Cardio estratégico pós-musculação, circuitos funcionais, spinning indoor e mobilidade articular.
              </p>
            </div>
          </div>

          {/* Filter buttons */}
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
