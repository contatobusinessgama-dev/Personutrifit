import React from "react";
import { ArrowLeftRight, Check, HelpCircle, Timer } from "lucide-react";
import { ExerciseItem, ExerciseLogEntry } from "../types";
import { ExerciseVisual } from "./ExerciseVisual";

interface ExerciseCardProps {
  exercise: ExerciseItem;
  originalExerciseName?: string;
  isSwapped?: boolean;
  log: ExerciseLogEntry;
  onUpdateLog: (patch: Partial<ExerciseLogEntry>) => void;
  onToggleSet: (setIndex: number) => void;
  onOpenGuide: (exercise: ExerciseItem) => void;
  onSwapMachine: () => void;
  onStartRest: (seconds: number) => void;
}

export const ExerciseCard: React.FC<ExerciseCardProps> = ({
  exercise,
  originalExerciseName,
  isSwapped,
  log,
  onUpdateLog,
  onToggleSet,
  onOpenGuide,
  onSwapMachine,
  onStartRest,
}) => {
  const completedCount = log.completedSets.filter(Boolean).length;
  const allCompleted = log.sets > 0 && completedCount >= log.sets;

  return (
    <article
      className={`rounded-2xl bg-white dark:bg-[#151518] border shadow-sm dark:shadow-none p-4 sm:p-5 transition-colors ${
        allCompleted ? "border-[#FF6B00]/60" : "border-[#E2E8F0] dark:border-[#26262B]"
      }`}
    >
      {/* Header row with 80x80px ExerciseVisual thumbnail */}
      <div className="flex items-start gap-3.5">
        <ExerciseVisual
          name={exercise.name}
          muscleGroup={exercise.muscleGroup}
          muscleLabel={exercise.muscleLabel}
          equipment={exercise.equipment}
          imageUrl={exercise.imageUrl}
          secondaryImageUrl={exercise.secondaryImageUrl}
          variant="thumbnail"
          onClick={() => onOpenGuide(exercise)}
        />

        <div className="flex-1 min-w-0 flex items-start justify-between gap-2.5">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#475569] dark:text-[#A1A1AA]">
              <span className="text-[#FF6B00] font-semibold">{exercise.equipment}</span>
              <span aria-hidden="true">·</span>
              <span>{exercise.muscleLabel}</span>
              {isSwapped && originalExerciseName && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#EA580C] dark:text-orange-300">Trocado de {originalExerciseName}</span>
                </>
              )}
            </div>
            <h3 className="mt-1 text-base sm:text-lg font-bold text-[#0F172A] dark:text-white leading-snug">
              {exercise.name}
            </h3>
          </div>

          <div className="text-right shrink-0">
            <span className="block text-[11px] text-[#475569] dark:text-[#A1A1AA]">Última carga</span>
            <span className="font-mono text-sm font-semibold tabular-nums text-[#0F172A] dark:text-white">
              {log.lastWeightKg > 0 ? `${log.lastWeightKg} kg` : "Peso corporal"}
            </span>
          </div>
        </div>
      </div>

      {/* Inputs: Séries, Repetições, Carga */}
      <div className="mt-4 grid grid-cols-3 gap-2.5">
        <div>
          <label
            htmlFor={`sets-${exercise.id}`}
            className="block text-[11px] font-medium text-[#475569] dark:text-[#A1A1AA] mb-1"
          >
            Séries
          </label>
          <input
            id={`sets-${exercise.id}`}
            type="number"
            min={1}
            max={8}
            value={log.sets}
            onChange={(e) => {
              const val = Math.max(1, Math.min(8, Number(e.target.value) || 1));
              onUpdateLog({ sets: val });
            }}
            className="w-full min-h-[44px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3 font-mono text-sm font-semibold tabular-nums text-[#0F172A] dark:text-white text-center"
          />
        </div>

        <div>
          <label
            htmlFor={`reps-${exercise.id}`}
            className="block text-[11px] font-medium text-[#475569] dark:text-[#A1A1AA] mb-1"
          >
            Repetições
          </label>
          <input
            id={`reps-${exercise.id}`}
            type="text"
            value={log.reps}
            onChange={(e) => onUpdateLog({ reps: e.target.value })}
            className="w-full min-h-[44px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3 font-mono text-sm font-semibold tabular-nums text-[#0F172A] dark:text-white text-center"
          />
        </div>

        <div>
          <label
            htmlFor={`weight-${exercise.id}`}
            className="block text-[11px] font-medium text-[#475569] dark:text-[#A1A1AA] mb-1"
          >
            Carga (kg)
          </label>
          <input
            id={`weight-${exercise.id}`}
            type="number"
            min={0}
            step={1}
            value={log.weightKg}
            onChange={(e) => {
              const val = Math.max(0, Number(e.target.value) || 0);
              onUpdateLog({ weightKg: val });
            }}
            className="w-full min-h-[44px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3 font-mono text-sm font-semibold tabular-nums text-[#0F172A] dark:text-white text-center"
          />
        </div>
      </div>

      {/* Series checkboxes + quick rest trigger */}
      <div className="mt-4 pt-3.5 border-t border-[#E2E8F0] dark:border-[#26262B] flex flex-wrap items-center justify-between gap-2.5">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-[#475569] dark:text-[#A1A1AA] mr-1">
            Séries ({completedCount}/{log.sets})
          </span>
          {Array.from({ length: log.sets }, (_, idx) => {
            const done = Boolean(log.completedSets[idx]);
            return (
              <button
                key={idx}
                type="button"
                aria-pressed={done}
                aria-label={`Marcar série ${idx + 1} de ${exercise.name}`}
                onClick={() => onToggleSet(idx)}
                className={`min-h-[40px] min-w-[40px] px-2.5 rounded-xl font-mono text-xs font-semibold tabular-nums flex items-center justify-center gap-1 transition-colors cursor-pointer ${
                  done
                    ? "bg-[#FF6B00] text-white"
                    : "bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] text-[#475569] dark:text-[#A1A1AA] hover:border-[#CBD5E1] dark:hover:border-[#3A3A42] hover:text-[#0F172A] dark:hover:text-white"
                }`}
              >
                {done ? <Check className="w-3.5 h-3.5" /> : <span>S{idx + 1}</span>}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={() => onStartRest(exercise.defaultRest)}
          className="min-h-[40px] px-3 rounded-xl bg-[#F1F5F9] dark:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00]/60 text-xs font-medium text-[#334155] dark:text-[#D4D4D8] hover:text-[#0F172A] dark:hover:text-white flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Timer className="w-3.5 h-3.5 text-[#FF6B00]" />
          <span className="font-mono tabular-nums">{exercise.defaultRest}s</span>
        </button>
      </div>

      {/* Action Footer: Como executar + Máquina ocupada? Trocar */}
      <div className="mt-3.5 pt-3.5 border-t border-[#E2E8F0] dark:border-[#26262B] flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => onOpenGuide(exercise)}
          className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F1F5F9] dark:bg-[#1C1C21] hover:bg-[#E2E8F0] dark:hover:bg-[#232329] border border-[#E2E8F0] dark:border-[#26262B] text-xs font-semibold text-[#0F172A] dark:text-white flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
        >
          <HelpCircle className="w-4 h-4 text-[#FF6B00] shrink-0" />
          <span>Como executar na máquina</span>
        </button>

        {exercise.alternatives.length > 0 && (
          <button
            type="button"
            onClick={onSwapMachine}
            className="flex-1 min-h-[44px] px-3.5 py-2 rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] hover:bg-[#F1F5F9] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00]/50 text-xs font-semibold text-[#334155] dark:text-[#D4D4D8] hover:text-[#0F172A] dark:hover:text-white flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer"
          >
            <ArrowLeftRight className="w-4 h-4 text-[#FF6B00] shrink-0" />
            <span>Máquina ocupada? Trocar</span>
          </button>
        )}
      </div>
    </article>
  );
};
