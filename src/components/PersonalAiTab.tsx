import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  BookmarkPlus,
  Check,
  Dumbbell,
  RotateCcw,
  Send,
  Sparkles,
  Square,
} from "lucide-react";
import {
  BiancoAppState,
  BodyMeasurement,
  ChatMessage,
  MetabolicResult,
  StudentProfile,
  TabId,
  ToastOptions,
  TrainingLevel,
} from "../types";
import {
  AiLoadingPhase,
  AiRetryInfo,
  FriendlyAiError,
  generateWithFallback,
  getAiToastNotification,
  isAbortedAiError,
} from "../services/geminiService";
import { AiStreamingFooter, AiTypingIndicator } from "./AiTypingIndicator";
import { getFirstName } from "../utils/metabolism";

const MUSCLE_TODAY_OPTIONS = [
  "Costas + Bíceps",
  "Peito + Tríceps",
  "Pernas Completo",
  "Glúteos + Posterior",
  "Costas (Definição e Postura)",
  "Ombros + Abdômen",
  "Superiores Completo",
  "Full Body Queima de Gordura",
];

const LEVEL_OPTIONS: TrainingLevel[] = ["Iniciante", "Intermediário", "Avançado"];
const TIME_OPTIONS: (30 | 45 | 60 | 90)[] = [30, 45, 60, 90];

const QUICK_PROMPTS = [
  "Montar meu treino de hoje com base no meu objetivo",
  "Treino focado em definir costas na academia",
  "Treino + Cardio para perder peso rápido",
  "Tenho só 40 minutos hoje, monte um treino intenso",
  "Aparelho ocupado: me dê uma substituição agora",
];

interface PersonalAiTabProps {
  state: BiancoAppState;
  metabolism: MetabolicResult;
  latestMeasurement: BodyMeasurement | null;
  onUpdateProfile: (patch: Partial<StudentProfile>) => void;
  onSetChat: (updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
  onPersistMessage: (msg: ChatMessage) => void;
  onClearCloudChat: () => void;
  onSavePlan: (content: string, muscleToday: string) => void;
  onNavigateTab: (tab: TabId) => void;
  onToast: (
    message: string,
    tone?: "success" | "info" | "warning",
    options?: ToastOptions
  ) => void;
}

export const PersonalAiTab: React.FC<PersonalAiTabProps> = ({
  state,
  metabolism,
  latestMeasurement,
  onUpdateProfile,
  onSetChat,
  onPersistMessage,
  onClearCloudChat,
  onSavePlan,
  onNavigateTab,
  onToast,
}) => {
  const [input, setInput] = useState("");
  const [loadingPhase, setLoadingPhase] = useState<AiLoadingPhase>("idle");
  const [retryInfo, setRetryInfo] = useState<AiRetryInfo | null>(null);
  const [activeAssistantId, setActiveAssistantId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorActionLabel, setErrorActionLabel] = useState<string>("Reconectar");
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const [savedMsgId, setSavedMsgId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const latestChatRef = useRef<ChatMessage[]>(state.personalChat);
  latestChatRef.current = state.personalChat;

  const loading = loadingPhase !== "idle";

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      abortControllerRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [state.personalChat, loadingPhase, retryInfo]);

  const handleCancelGeneration = () => {
    abortControllerRef.current?.abort();
  };

  const sendMessage = async (textToSend: string) => {
    const trimmed = textToSend.trim();
    if (!trimmed || abortControllerRef.current) return;

    setErrorMsg(null);
    setLastFailedPrompt(null);
    setRetryInfo(null);
    setInput("");

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    const assistantId = `a_${Date.now() + 1}`;
    const placeholderMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
      isWorkoutPlan: true,
    };

    const prevHistory = latestChatRef.current;
    const controller = new AbortController();
    abortControllerRef.current = controller;

    onSetChat((prev) => [...prev, userMsg, placeholderMsg]);
    onPersistMessage(userMsg);
    setActiveAssistantId(assistantId);
    setLoadingPhase("waiting");

    let lastStreamedText = "";

    try {
      const finalText = await generateWithFallback({
        endpoint: "/api/ai/personal",
        message: trimmed,
        history: prevHistory,
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
          muscleToday: state.profile.muscleToday,
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
        onStateChange: (phase, nextRetryInfo) => {
          if (!mountedRef.current) return;
          setLoadingPhase(phase);
          setRetryInfo(nextRetryInfo ?? null);
        },
        onRetry: (info) => {
          if (!mountedRef.current) return;
          setRetryInfo(info);
        },
        onChunk: (fullText) => {
          lastStreamedText = fullText;
          onSetChat((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, content: fullText } : m))
          );
        },
      });
      if (finalText.trim()) {
        onPersistMessage({ ...placeholderMsg, content: finalText });
      }
    } catch (err) {
      if (isAbortedAiError(err)) {
        if (lastStreamedText.trim()) {
          onPersistMessage({ ...placeholderMsg, content: lastStreamedText });
        } else {
          onSetChat((prev) => prev.filter((m) => m.id !== assistantId));
        }
        if (mountedRef.current) {
          onToast("Resposta interrompida.", "info");
        }
        return;
      }

      const friendly = err instanceof FriendlyAiError ? err : null;
      const toastInfo = getAiToastNotification(err);
      console.error("[Personal IA] Falha detalhada na chamada da API de IA:", {
        timestamp: new Date().toISOString(),
        endpoint: "/api/ai/personal",
        category: toastInfo.category,
        code: friendly?.code,
        status: friendly?.status,
        model: friendly?.model,
        attempts: friendly?.attempts,
        durationMs: friendly?.durationMs,
        historyCount: prevHistory.length,
        promptPreview: trimmed.slice(0, 120),
        errorMessage: err instanceof Error ? err.message : String(err),
        error: err,
      });

      const bannerMsg = toastInfo.isUnavailable
        ? toastInfo.message
        : friendly?.message || toastInfo.message;

      if (mountedRef.current) {
        setErrorMsg(bannerMsg);
        setErrorActionLabel(toastInfo.actionLabel);
        setLastFailedPrompt(trimmed);
      }

      onToast(toastInfo.message, "warning", {
        actionLabel: toastInfo.actionLabel,
        onAction: () => {
          void sendMessage(trimmed);
        },
      });
      onSetChat((prev) => prev.filter((m) => m.id !== assistantId));
    } finally {
      if (abortControllerRef.current === controller) {
        abortControllerRef.current = null;
      }
      if (mountedRef.current) {
        setLoadingPhase("idle");
        setRetryInfo(null);
        setActiveAssistantId(null);
      }
    }
  };

  const handleSaveToFicha = (msg: ChatMessage) => {
    onSavePlan(msg.content, state.profile.muscleToday);
    setSavedMsgId(msg.id);
    onToast("Ficha salva na aba Treinos!", "success");
    window.setTimeout(() => setSavedMsgId(null), 3500);
  };

  const handleResetChat = () => {
    abortControllerRef.current?.abort();
    onClearCloudChat();
    const firstName = getFirstName(state.profile.name);
    onSetChat([
      {
        id: `welcome_${Date.now()}`,
        role: "assistant",
        timestamp: new Date().toISOString(),
        content: `Conversa reiniciada, **${firstName}**! Já estou com seu perfil corporal, IMC e objetivo atualizados. Escolha um atalho abaixo ou me diga qual treino presencial vamos montar hoje.`,
      },
    ]);
    setErrorMsg(null);
    setRetryInfo(null);
    onToast("Histórico do Personal IA limpo.", "info");
  };

  return (
    <div className="space-y-5 pb-20 md:pb-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[#FF6B00] flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5" />
            <span>Musculação Presencial em Academia</span>
          </p>
          <h1 className="mt-0.5 text-2xl font-extrabold text-[#0F172A] dark:text-white tracking-tight">
            Personal Trainer IA
          </h1>
        </div>
        <button
          type="button"
          onClick={handleResetChat}
          className="min-h-[40px] px-3.5 rounded-xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#CBD5E1] dark:hover:border-[#3A3A42] shadow-xs dark:shadow-none text-xs font-medium text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Limpar chat</span>
        </button>
      </div>

      {/* Top Context Control Panel */}
      <section
        aria-label="Contexto do treino de hoje"
        className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none p-4 sm:p-5 space-y-4"
      >
        <div className="text-xs text-[#475569] dark:text-[#A1A1AA] flex flex-wrap items-center gap-x-2 gap-y-1 pb-3 border-b border-[#E2E8F0] dark:border-[#26262B]">
          <span>Perfil integrado:</span>
          <strong className="text-[#0F172A] dark:text-white">{getFirstName(state.profile.name)}</strong>
          <span>·</span>
          <span className="font-mono tabular-nums text-[#334155] dark:text-[#D4D4D8]">
            {state.profile.weightKg}kg · IMC {metabolism.bmi.toFixed(1)} · {state.profile.weeklyFrequency}x/sem
          </span>
          <span>·</span>
          <strong className="text-[#0F172A] dark:text-white">{state.goals.primary}</strong>
          {state.goals.focuses.length > 0 && (
            <span>· {state.goals.focuses.join(" · ")}</span>
          )}
          {state.goals.customNote && (
            <span className="text-[#EA580C] dark:text-orange-300">· Nota: “{state.goals.customNote}”</span>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* O que vai malhar hoje */}
          <div>
            <label
              htmlFor="personal-muscle-select"
              className="block text-xs font-medium text-[#475569] dark:text-[#A1A1AA] mb-1.5"
            >
              O que vai malhar hoje
            </label>
            <select
              id="personal-muscle-select"
              value={state.profile.muscleToday}
              onChange={(e) => onUpdateProfile({ muscleToday: e.target.value })}
              className="w-full min-h-[44px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3 text-sm font-medium text-[#0F172A] dark:text-white"
            >
              {MUSCLE_TODAY_OPTIONS.map((opt) => (
                <option key={opt} value={opt}>
                  {opt}
                </option>
              ))}
            </select>
          </div>

          {/* Nível */}
          <div>
            <span className="block text-xs font-medium text-[#475569] dark:text-[#A1A1AA] mb-1.5">Nível</span>
            <div className="grid grid-cols-3 gap-1.5">
              {LEVEL_OPTIONS.map((lvl) => {
                const active = state.profile.level === lvl;
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => onUpdateProfile({ level: lvl })}
                    className={`min-h-[44px] px-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer truncate ${
                      active
                        ? "bg-[#FF6B00] border-[#FF6B00] text-white"
                        : "bg-[#F8FAFC] dark:bg-[#0B0B0D] border-[#E2E8F0] dark:border-[#26262B] text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white"
                    }`}
                  >
                    {lvl}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Tempo disponível */}
          <div>
            <span className="block text-xs font-medium text-[#475569] dark:text-[#A1A1AA] mb-1.5">
              Tempo disponível
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {TIME_OPTIONS.map((mins) => {
                const active = state.profile.availableTime === mins;
                return (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => onUpdateProfile({ availableTime: mins })}
                    className={`min-h-[44px] rounded-xl font-mono text-xs font-semibold tabular-nums border transition-colors cursor-pointer ${
                      active
                        ? "bg-[#FF6B00] border-[#FF6B00] text-white"
                        : "bg-[#F8FAFC] dark:bg-[#0B0B0D] border-[#E2E8F0] dark:border-[#26262B] text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white"
                    }`}
                  >
                    {mins}m
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* Quick Prompts */}
      <div className="flex flex-wrap gap-2">
        {QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={loading}
            onClick={() => sendMessage(prompt)}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white dark:bg-[#151518] hover:bg-[#F1F5F9] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00]/60 shadow-xs dark:shadow-none text-xs font-medium text-[#334155] dark:text-[#E4E4E7] hover:text-[#0F172A] dark:hover:text-white transition-colors text-left cursor-pointer disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Chat Messages Feed */}
      <section
        aria-label="Conversa com Personal IA"
        className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none flex flex-col overflow-hidden"
      >
        <div className="p-4 sm:p-5 space-y-4 max-h-[520px] overflow-y-auto">
          {state.personalChat.map((msg) => {
            const isUser = msg.role === "user";
            const isActivePending = !isUser && msg.id === activeAssistantId;
            const isStreamingThis = isActivePending && loadingPhase === "streaming";
            const canSave =
              !isUser &&
              !isActivePending &&
              msg.content.length > 140 &&
              !msg.id.startsWith("welcome");
            const isSaved = savedMsgId === msg.id;

            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[92%] sm:max-w-[82%] rounded-2xl px-4 py-3.5 text-sm ${
                    isUser
                      ? "bg-[#FF6B00] text-white font-medium"
                      : "bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] text-[#0F172A] dark:text-[#E4E4E7]"
                  }`}
                >
                  {isUser ? (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                  ) : msg.content ? (
                    <div>
                      <div className="ai-prose">
                        <ReactMarkdown>{msg.content}</ReactMarkdown>
                      </div>
                      {isStreamingThis && <AiStreamingFooter />}
                    </div>
                  ) : (
                    <AiTypingIndicator
                      agent="personal"
                      phase={isActivePending ? loadingPhase : "waiting"}
                      retryInfo={isActivePending ? retryInfo : null}
                    />
                  )}
                </div>

                {canSave && (
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleSaveToFicha(msg)}
                      className={`min-h-[38px] px-3.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer ${
                        isSaved
                          ? "bg-emerald-600 text-white"
                          : "bg-[#F1F5F9] dark:bg-[#1C1C21] hover:bg-[#FF6B00] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00] text-[#0F172A] dark:text-white hover:text-white"
                      }`}
                    >
                      {isSaved ? (
                        <>
                          <Check className="w-3.5 h-3.5" />
                          <span>Salvo na Minha Ficha!</span>
                        </>
                      ) : (
                        <>
                          <BookmarkPlus className="w-3.5 h-3.5 text-[#FF6B00]" />
                          <span>Salvar na Minha Ficha</span>
                        </>
                      )}
                    </button>

                    {isSaved && (
                      <button
                        type="button"
                        onClick={() => onNavigateTab("treinos")}
                        className="min-h-[38px] px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#FF6B00]/50 text-xs font-semibold text-[#FF6B00] hover:text-[#EA580C] dark:hover:text-orange-300 flex items-center gap-1.5 cursor-pointer"
                      >
                        <Dumbbell className="w-3.5 h-3.5" />
                        <span>Abrir em Treinos</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="mx-4 mb-3 rounded-xl bg-red-500/10 border border-red-500/40 px-4 py-3 text-xs text-red-700 dark:text-red-200 flex flex-wrap items-center justify-between gap-3"
          >
            <span className="leading-relaxed">{errorMsg}</span>
            {lastFailedPrompt && (
              <button
                type="button"
                disabled={loading}
                onClick={() => void sendMessage(lastFailedPrompt)}
                className="min-h-[34px] px-3 rounded-lg bg-[#FF6B00] hover:bg-[#F97316] text-white font-semibold text-xs transition-colors cursor-pointer shrink-0 disabled:opacity-50"
              >
                {errorActionLabel}
              </button>
            )}
          </div>
        )}

        {/* Composer */}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            sendMessage(input);
          }}
          className="p-3 sm:p-4 border-t border-[#E2E8F0] dark:border-[#26262B] bg-[#F8FAFC] dark:bg-[#111114] flex items-center gap-2"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={
              loading
                ? loadingPhase === "retrying"
                  ? "Reconectando automaticamente com o Personal IA..."
                  : "Personal IA está digitando sua prescrição..."
                : "Ex.: Monte um treino de costas sem sobrecarregar a lombar..."
            }
            disabled={loading}
            className="flex-1 min-h-[46px] rounded-xl bg-white dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-4 text-sm text-[#0F172A] dark:text-white placeholder:text-[#94A3B8] dark:placeholder:text-[#52525B] disabled:opacity-65"
          />
          {loading ? (
            <button
              type="button"
              onClick={handleCancelGeneration}
              aria-label="Parar resposta do Personal IA"
              className="min-h-[46px] min-w-[46px] px-4 rounded-xl bg-[#F1F5F9] dark:bg-[#1C1C21] hover:bg-[#E2E8F0] dark:hover:bg-[#26262B] border border-[#CBD5E1] dark:border-[#3A3A42] hover:border-[#FF6B00]/60 text-[#0F172A] dark:text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0"
            >
              <Square className="w-3.5 h-3.5 fill-current text-[#FF6B00]" />
              <span className="hidden sm:inline">Parar</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="Enviar mensagem ao Personal IA"
              className="min-h-[46px] min-w-[46px] px-4 rounded-xl bg-[#FF6B00] hover:bg-[#F97316] disabled:opacity-40 text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0"
            >
              <Send className="w-4 h-4" />
              <span className="hidden sm:inline">Enviar</span>
            </button>
          )}
        </form>
      </section>
    </div>
  );
};
