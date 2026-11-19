import React from "react";
import { RefreshCw, Sparkles, Utensils } from "lucide-react";
import { AiLoadingPhase, AiRetryInfo } from "../services/geminiService";

interface AiTypingIndicatorProps {
  agent: "personal" | "nutri";
  phase: AiLoadingPhase;
  retryInfo: AiRetryInfo | null;
}

export const AiTypingIndicator: React.FC<AiTypingIndicatorProps> = ({
  agent,
  phase,
  retryInfo,
}) => {
  const isRetrying = phase === "retrying" && retryInfo !== null;
  const agentName = agent === "personal" ? "Personal IA" : "Nutri IA";
  const waitingSubtext =
    agent === "personal"
      ? "Prescrevendo seu treino presencial..."
      : "Calculando seu plano com alimentos reais...";

  const delaySeconds = retryInfo ? (retryInfo.delayMs / 1000).toFixed(1) : null;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-start gap-3 py-0.5 min-w-[210px]"
    >
      <div
        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 mt-0.5 border ${
          isRetrying
            ? "bg-amber-500/12 border-amber-500/35 text-amber-600 dark:text-amber-300"
            : "bg-[#FF6B00]/12 border-[#FF6B00]/30 text-[#FF6B00]"
        }`}
        aria-hidden="true"
      >
        {isRetrying ? (
          <RefreshCw className="w-3.5 h-3.5 animate-spin" />
        ) : agent === "personal" ? (
          <Sparkles className="w-3.5 h-3.5" />
        ) : (
          <Utensils className="w-3.5 h-3.5" />
        )}
      </div>

      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex items-center gap-2.5">
          <span className="text-xs font-semibold text-[#0F172A] dark:text-white tracking-tight">
            {isRetrying ? `Reconectando ${agentName}` : `${agentName} digitando`}
          </span>

          <span
            className="inline-flex items-center gap-1 pt-0.5"
            aria-hidden="true"
          >
            <span
              className={`ai-typing-dot w-1.5 h-1.5 rounded-full ${
                isRetrying ? "bg-amber-500 dark:bg-amber-400" : "bg-[#FF6B00]"
              }`}
            />
            <span
              className={`ai-typing-dot w-1.5 h-1.5 rounded-full ${
                isRetrying ? "bg-amber-500 dark:bg-amber-400" : "bg-[#FF6B00]"
              }`}
            />
            <span
              className={`ai-typing-dot w-1.5 h-1.5 rounded-full ${
                isRetrying ? "bg-amber-500 dark:bg-amber-400" : "bg-[#FF6B00]"
              }`}
            />
          </span>
        </div>

        {isRetrying && retryInfo ? (
          <p className="text-[11px] leading-snug text-amber-700 dark:text-amber-200/85 tabular-nums">
            Tentativa {retryInfo.attempt}/{retryInfo.maxRetries} · aguardando {delaySeconds}s (
            {retryInfo.reason})
          </p>
        ) : (
          <p className="text-[11px] leading-snug text-[#475569] dark:text-[#A1A1AA]">
            {waitingSubtext}
          </p>
        )}
      </div>
    </div>
  );
};

export const AiStreamingFooter: React.FC = () => (
  <div
    role="status"
    aria-live="polite"
    className="mt-2.5 pt-2 border-t border-[#E2E8F0] dark:border-[#26262B]/80 flex items-center gap-2 text-[11px] text-[#475569] dark:text-[#A1A1AA]"
  >
    <span className="inline-flex items-center gap-1" aria-hidden="true">
      <span className="ai-typing-dot w-1.5 h-1.5 rounded-full bg-[#FF6B00]" />
      <span className="ai-typing-dot w-1.5 h-1.5 rounded-full bg-[#FF6B00]" />
      <span className="ai-typing-dot w-1.5 h-1.5 rounded-full bg-[#FF6B00]" />
    </span>
    <span>Digitando resposta...</span>
  </div>
);
