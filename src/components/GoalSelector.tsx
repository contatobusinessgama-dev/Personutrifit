import React, { useState } from "react";
import { Check, ChevronDown, ChevronUp, Target } from "lucide-react";
import { GOAL_OPTIONS } from "../data/exercises";
import { StudentGoals } from "../types";

interface GoalSelectorProps {
  goals: StudentGoals;
  onUpdateGoals: (patch: Partial<StudentGoals>) => void;
  compactDefault?: boolean;
}

export const GoalSelector: React.FC<GoalSelectorProps> = ({
  goals,
  onUpdateGoals,
  compactDefault = false,
}) => {
  const [expanded, setExpanded] = useState(!compactDefault);
  const [savedFeedback, setSavedFeedback] = useState(false);

  const handleToggleOption = (option: string) => {
    // If clicking current primary, do nothing (keep at least 1 primary)
    if (goals.primary === option) return;

    // If it's already in focuses, remove it
    if (goals.focuses.includes(option)) {
      onUpdateGoals({
        focuses: goals.focuses.filter((item) => item !== option),
      });
      return;
    }

    // If user wants to add as focus (max 2)
    if (goals.focuses.length < 2) {
      onUpdateGoals({
        focuses: [...goals.focuses, option],
      });
    } else {
      // Replace oldest focus
      onUpdateGoals({
        focuses: [goals.focuses[1], option],
      });
    }
  };

  const handleSetPrimary = (option: string) => {
    const nextFocuses = goals.focuses.filter((f) => f !== option);
    onUpdateGoals({
      primary: option,
      focuses: nextFocuses,
    });
  };

  const triggerSaveFeedback = () => {
    setSavedFeedback(true);
    window.setTimeout(() => setSavedFeedback(false), 1800);
  };

  return (
    <section
      aria-label="Objetivo do aluno"
      className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none p-4 sm:p-6"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-xs text-[#475569] dark:text-[#A1A1AA]">
            <Target className="w-3.5 h-3.5 text-[#FF6B00] shrink-0" />
            <span>Objetivo integrado ao Personal IA e Nutri IA</span>
          </div>
          <h2 className="mt-1 text-lg sm:text-xl font-bold text-[#0F172A] dark:text-white tracking-tight">
            O que você deseja alcançar?
          </h2>
          {!expanded && (
            <p className="mt-1.5 text-sm text-[#475569] dark:text-[#A1A1AA] truncate">
              <span className="text-[#0F172A] dark:text-white font-medium">{goals.primary}</span>
              {goals.focuses.length > 0 && (
                <>
                  {" · "}
                  <span>{goals.focuses.join(" · ")}</span>
                </>
              )}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={() => setExpanded((prev) => !prev)}
          className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#E2E8F0] dark:border-[#26262B] bg-[#F1F5F9] dark:bg-[#1C1C21] hover:border-[#CBD5E1] dark:hover:border-[#3A3A42] text-xs font-semibold text-[#0F172A] dark:text-white flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
        >
          <span>{expanded ? "Recolher" : "Editar objetivo"}</span>
          {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {expanded && (
        <div className="mt-5 space-y-5">
          {/* Active selection legend */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#475569] dark:text-[#A1A1AA] border-b border-[#E2E8F0] dark:border-[#26262B] pb-3">
            <span>
              Toque para selecionar <strong className="text-[#0F172A] dark:text-white">1 objetivo principal</strong> e até{" "}
              <strong className="text-[#0F172A] dark:text-white">2 focos específicos</strong> ({goals.focuses.length}/2).
            </span>
            {savedFeedback && (
              <span className="text-[#FF6B00] font-medium flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Salvo automaticamente
              </span>
            )}
          </div>

          {/* Interactive selector grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {GOAL_OPTIONS.map((option) => {
              const isPrimary = goals.primary === option;
              const isFocus = goals.focuses.includes(option);

              return (
                <div
                  key={option}
                  className={`rounded-xl border transition-colors ${
                    isPrimary
                      ? "bg-[#FF6B00]/10 dark:bg-[#FF6B00]/12 border-[#FF6B00]"
                      : isFocus
                      ? "bg-[#FFF7ED] dark:bg-[#1C1C21] border-[#FF6B00]/50"
                      : "bg-[#F8FAFC] dark:bg-[#111114] border-[#E2E8F0] dark:border-[#26262B] hover:border-[#CBD5E1] dark:hover:border-[#3A3A42]"
                  }`}
                >
                  <button
                    type="button"
                    aria-pressed={isPrimary || isFocus}
                    onClick={() => {
                      if (!isPrimary && !isFocus) {
                        handleToggleOption(option);
                      } else if (isFocus) {
                        handleToggleOption(option);
                      }
                      triggerSaveFeedback();
                    }}
                    className="w-full text-left px-3.5 py-3 min-h-[48px] flex flex-col justify-between gap-1.5 cursor-pointer"
                  >
                    <span
                      className={`text-sm font-medium leading-snug ${
                        isPrimary || isFocus ? "text-[#0F172A] dark:text-white" : "text-[#334155] dark:text-[#D4D4D8]"
                      }`}
                    >
                      {option}
                    </span>
                    <span className="text-[11px] font-medium text-[#64748B] dark:text-[#A1A1AA]">
                      {isPrimary ? (
                        <span className="text-[#FF6B00] font-semibold">Objetivo principal</span>
                      ) : isFocus ? (
                        <span className="text-[#EA580C] dark:text-orange-300">Foco específico · Toque p/ remover</span>
                      ) : (
                        <span>Toque p/ adicionar foco</span>
                      )}
                    </span>
                  </button>

                  {!isPrimary && (
                    <div className="px-3.5 pb-2.5 pt-0 flex justify-end border-t border-[#E2E8F0] dark:border-[#26262B]/60">
                      <button
                        type="button"
                        onClick={() => {
                          handleSetPrimary(option);
                          triggerSaveFeedback();
                        }}
                        className="mt-1.5 text-[11px] font-medium text-[#64748B] dark:text-[#A1A1AA] hover:text-[#FF6B00] transition-colors cursor-pointer whitespace-nowrap"
                      >
                        Definir como principal
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          {/* Custom free-text goal details */}
          <div>
            <label
              htmlFor="custom-goal-note"
              className="block text-xs font-medium text-[#475569] dark:text-[#A1A1AA] mb-2"
            >
              Detalhes extras ou restrições (injetado automaticamente na IA)
            </label>
            <textarea
              id="custom-goal-note"
              rows={2}
              value={goals.customNote}
              onChange={(e) => {
                onUpdateGoals({ customNote: e.target.value });
                triggerSaveFeedback();
              }}
              placeholder="Ex.: Quero perder 8kg rápido, definir bem as costas e tenho leve desconforto no joelho..."
              className="w-full rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-4 py-3 text-sm text-[#0F172A] dark:text-white placeholder:text-[#94A3B8] dark:placeholder:text-[#52525B] resize-none transition-colors"
            />
          </div>
        </div>
      )}
    </section>
  );
};
