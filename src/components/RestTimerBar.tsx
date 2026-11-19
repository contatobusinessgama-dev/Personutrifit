import React, { useEffect } from "react";
import { Pause, Play, RotateCcw, Timer, X } from "lucide-react";

interface RestTimerBarProps {
  secondsLeft: number;
  totalSeconds: number;
  isRunning: boolean;
  isVisible: boolean;
  onStartPreset: (seconds: number) => void;
  onToggleRun: () => void;
  onReset: () => void;
  onClose: () => void;
}

const PRESETS = [30, 45, 60, 90];

export const RestTimerBar: React.FC<RestTimerBarProps> = ({
  secondsLeft,
  totalSeconds,
  isRunning,
  isVisible,
  onStartPreset,
  onToggleRun,
  onReset,
  onClose,
}) => {
  useEffect(() => {
    // Soft browser vibration if supported when countdown reaches zero
    if (isVisible && secondsLeft === 0 && totalSeconds > 0 && "vibrate" in navigator) {
      try {
        navigator.vibrate([120, 80, 120]);
      } catch {
        // ignore vibration errors
      }
    }
  }, [secondsLeft, totalSeconds, isVisible]);

  if (!isVisible) return null;

  const progressPct =
    totalSeconds > 0 ? Math.max(0, Math.min(100, (secondsLeft / totalSeconds) * 100)) : 0;
  const mins = Math.floor(secondsLeft / 60);
  const secs = secondsLeft % 60;
  const formatted = `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  const isFinished = secondsLeft === 0;

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-[400px] z-40 rounded-2xl bg-white/95 dark:bg-[#151518]/95 backdrop-blur-md border border-[#FF6B00]/45 shadow-2xl shadow-slate-900/15 dark:shadow-black/70 overflow-hidden"
    >
      {/* Progress rail */}
      <div className="h-1 w-full bg-[#E2E8F0] dark:bg-[#26262B]">
        <div
          className="h-full bg-[#FF6B00] transition-[width] duration-300"
          style={{ width: `${progressPct}%` }}
        />
      </div>

      <div className="p-3.5 flex flex-col gap-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FF6B00]/15 text-[#FF6B00] flex items-center justify-center shrink-0">
              <Timer className="w-5 h-5" />
            </div>
            <div>
              <p className="text-xs text-[#475569] dark:text-[#A1A1AA]">
                {isFinished ? "Descanso finalizado — Próxima série!" : "Cronômetro de descanso"}
              </p>
              <p
                className={`font-mono text-2xl font-bold tabular-nums leading-tight ${
                  isFinished ? "text-[#FF6B00]" : "text-[#0F172A] dark:text-white"
                }`}
              >
                {formatted}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onToggleRun}
              aria-label={isRunning ? "Pausar cronômetro" : "Retomar cronômetro"}
              className="min-h-[40px] min-w-[40px] rounded-xl bg-[#FF6B00] hover:bg-[#F97316] text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              {isRunning ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
            </button>
            <button
              type="button"
              onClick={onReset}
              aria-label="Reiniciar cronômetro"
              className="min-h-[40px] min-w-[40px] rounded-xl bg-[#F1F5F9] dark:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#CBD5E1] dark:hover:border-[#3A3A42] text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar cronômetro"
              className="min-h-[40px] min-w-[40px] rounded-xl bg-[#F1F5F9] dark:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#CBD5E1] dark:hover:border-[#3A3A42] text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Presets */}
        <div className="grid grid-cols-4 gap-1.5">
          {PRESETS.map((sec) => {
            const active = totalSeconds === sec;
            return (
              <button
                key={sec}
                type="button"
                onClick={() => onStartPreset(sec)}
                className={`min-h-[38px] rounded-lg font-mono text-xs font-semibold tabular-nums transition-colors cursor-pointer ${
                  active
                    ? "bg-[#FF6B00]/15 dark:bg-[#FF6B00]/20 text-[#EA580C] dark:text-[#FF6B00] border border-[#FF6B00]/60"
                    : "bg-[#F8FAFC] dark:bg-[#0B0B0D] text-[#475569] dark:text-[#A1A1AA] border border-[#E2E8F0] dark:border-[#26262B] hover:text-[#0F172A] dark:hover:text-white"
                }`}
              >
                {sec}s
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
