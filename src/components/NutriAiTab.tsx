import React, { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import {
  Calculator,
  Droplets,
  Flame,
  RotateCcw,
  Send,
  Square,
  Utensils,
} from "lucide-react";
import {
  ActivityLevel,
  BiancoAppState,
  BodyMeasurement,
  ChatMessage,
  DeficitMode,
  MetabolicResult,
  StudentProfile,
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
import { AiStreamingFooter, AiTypingIndicator } from "./AiTypingIndicator";
import { ACTIVITY_OPTIONS, DEFICIT_OPTIONS, getFirstName } from "../utils/metabolism";

const NUTRI_QUICK_PROMPTS = [
  "Montar cardápio para secar rápido",
  "Pré e pós-treino para hoje",
  "Bateu vontade de doce, o que fazer?",
  "Gerar lista de compras da semana",
];

interface NutriAiTabProps {
  state: BiancoAppState;
  metabolism: MetabolicResult;
  latestMeasurement: BodyMeasurement | null;
  onUpdateProfile: (patch: Partial<StudentProfile>) => void;
  onSetChat: (updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => void;
  onPersistMessage: (msg: ChatMessage) => void;
  onClearCloudChat: () => void;
  onToast: (
    message: string,
    tone?: "success" | "info" | "warning",
    options?: ToastOptions
  ) => void;
}

export const NutriAiTab: React.FC<NutriAiTabProps> = ({
  state,
  metabolism,
  latestMeasurement,
  onUpdateProfile,
  onSetChat,
  onPersistMessage,
  onClearCloudChat,
  onToast,
}) => {
  const [input, setInput] = useState("");
  const [loadingPhase, setLoadingPhase] = useState<AiLoadingPhase>("idle");
  const [retryInfo, setRetryInfo] = useState<AiRetryInfo | null>(null);
  const [activeAssistantId, setActiveAssistantId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [errorActionLabel, setErrorActionLabel] = useState<string>("Reconectar");
  const [lastFailedPrompt, setLastFailedPrompt] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const mountedRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const latestChatRef = useRef<ChatMessage[]>(state.nutriChat);
  latestChatRef.current = state.nutriChat;

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
  }, [state.nutriChat, loadingPhase, retryInfo]);

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
      id: `nu_${Date.now()}`,
      role: "user",
      content: trimmed,
      timestamp: new Date().toISOString(),
    };

    const assistantId = `na_${Date.now() + 1}`;
    const placeholderMsg: ChatMessage = {
      id: assistantId,
      role: "assistant",
      content: "",
      timestamp: new Date().toISOString(),
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
        endpoint: "/api/ai/nutri",
        message: trimmed,
        history: prevHistory,
        signal: controller.signal,
        maxRetries: 3,
        baseDelayMs: 900,
        maxDelayMs: 8000,
        context: {
          studentName: state.profile.name,
          primaryGoal: state.goals.primary,
          secondaryFocuses: state.goals.focuses,
          customNote: state.goals.customNote,
          muscleToday: state.profile.muscleToday,
          level: state.profile.level,
          weeklyFrequency: state.profile.weeklyFrequency,
          weightKg: state.profile.weightKg,
          targetWeightKg: state.profile.targetWeightKg,
          heightCm: state.profile.heightCm,
          bmi: metabolism.bmi,
          bmiLabel: metabolism.bmiLabel,
          age: state.profile.age,
          sex: state.profile.sex,
          activityLabel: metabolism.activityLabel,
          deficitLabel: metabolism.deficitLabel,
          tmb: metabolism.tmb,
          get: metabolism.get,
          calorieTarget: metabolism.calorieTarget,
          proteinG: metabolism.proteinG,
          carbsG: metabolism.carbsG,
          fatG: metabolism.fatG,
          waterTargetMl: metabolism.waterTargetMl,
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
      console.error("[Nutri IA] Falha detalhada na chamada da API de IA:", {
        timestamp: new Date().toISOString(),
        endpoint: "/api/ai/nutri",
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

  const handleResetChat = () => {
    abortControllerRef.current?.abort();
    onClearCloudChat();
    const firstName = getFirstName(state.profile.name);
    onSetChat([
      {
        id: `welcome_nutri_${Date.now()}`,
        role: "assistant",
        timestamp: new Date().toISOString(),
        content: `Conversa reiniciada, **${firstName}**! Seus cálculos de IMC, TMB, GET, meta calórica, macros e medidas atualizadas já estão no meu contexto. Como posso ajudar sua alimentação hoje?`,
      },
    ]);
    setErrorMsg(null);
    setRetryInfo(null);
    onToast("Histórico da Nutricionista IA limpo.", "info");
  };

  return (
    <div className="space-y-6 pb-20 md:pb-8">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[#FF6B00] flex items-center gap-1.5">
            <Utensils className="w-3.5 h-3.5" />
            <span>Déficit Calórico Natural & Comida Real Brasileira</span>
          </p>
          <h1 className="mt-0.5 text-2xl font-extrabold text-[#0F172A] dark:text-white tracking-tight">
            Nutricionista IA
          </h1>
        </div>
        <button
          type="button"
          onClick={handleResetChat}
          className="min-h-[40px] px-3.5 rounded-xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#CBD5E1] dark:hover:border-[#3A3A42] shadow-sm dark:shadow-none text-xs font-medium text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Limpar chat</span>
        </button>
      </div>

      {/* Metabolic Calculator Section */}
      <section
        aria-label="Calculadora Metabólica"
        className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none p-4 sm:p-6 space-y-5"
      >
        <div className="flex items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
              <Calculator className="w-4 h-4 text-[#FF6B00]" />
              <span>Calculadora Metabólica (Mifflin-St Jeor)</span>
            </h2>
            <p className="text-xs text-[#475569] dark:text-[#A1A1AA] mt-0.5">
              Os valores atualizam seu Dashboard e são enviados automaticamente para a Nutricionista IA.
            </p>
          </div>
        </div>

        {/* Inputs Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div>
            <label
              htmlFor="calc-weight"
              className="block text-xs text-[#475569] dark:text-[#A1A1AA] mb-1"
            >
              Peso (kg)
            </label>
            <input
              id="calc-weight"
              type="number"
              step="0.5"
              min={35}
              max={250}
              value={state.profile.weightKg}
              onChange={(e) =>
                onUpdateProfile({ weightKg: Math.max(35, Number(e.target.value) || 70) })
              }
              className="w-full min-h-[44px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3 font-mono text-sm font-semibold tabular-nums text-[#0F172A] dark:text-white"
            />
          </div>

          <div>
            <label
              htmlFor="calc-height"
              className="block text-xs text-[#475569] dark:text-[#A1A1AA] mb-1"
            >
              Altura (cm)
            </label>
            <input
              id="calc-height"
              type="number"
              min={120}
              max={230}
              value={state.profile.heightCm}
              onChange={(e) =>
                onUpdateProfile({ heightCm: Math.max(120, Number(e.target.value) || 170) })
              }
              className="w-full min-h-[44px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3 font-mono text-sm font-semibold tabular-nums text-[#0F172A] dark:text-white"
            />
          </div>

          <div>
            <label
              htmlFor="calc-age"
              className="block text-xs text-[#475569] dark:text-[#A1A1AA] mb-1"
            >
              Idade
            </label>
            <input
              id="calc-age"
              type="number"
              min={14}
              max={90}
              value={state.profile.age}
              onChange={(e) =>
                onUpdateProfile({ age: Math.max(14, Number(e.target.value) || 28) })
              }
              className="w-full min-h-[44px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3 font-mono text-sm font-semibold tabular-nums text-[#0F172A] dark:text-white"
            />
          </div>

          <div>
            <span className="block text-xs text-[#475569] dark:text-[#A1A1AA] mb-1">Sexo</span>
            <div className="grid grid-cols-2 gap-1.5">
              {(["M", "F"] as const).map((sexOpt) => {
                const active = state.profile.sex === sexOpt;
                return (
                  <button
                    key={sexOpt}
                    type="button"
                    onClick={() => onUpdateProfile({ sex: sexOpt })}
                    className={`min-h-[44px] rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                      active
                        ? "bg-[#FF6B00] border-[#FF6B00] text-white"
                        : "bg-[#F8FAFC] dark:bg-[#0B0B0D] border-[#E2E8F0] dark:border-[#26262B] text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white"
                    }`}
                  >
                    {sexOpt === "M" ? "Masc" : "Fem"}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="col-span-2">
            <label
              htmlFor="calc-activity"
              className="block text-xs text-[#475569] dark:text-[#A1A1AA] mb-1"
            >
              Nível de atividade
            </label>
            <select
              id="calc-activity"
              value={state.profile.activityLevel}
              onChange={(e) =>
                onUpdateProfile({ activityLevel: e.target.value as ActivityLevel })
              }
              className="w-full min-h-[44px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3 text-sm font-medium text-[#0F172A] dark:text-white"
            >
              {ACTIVITY_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Deficit Pace Selector */}
        <div>
          <span className="block text-xs text-[#475569] dark:text-[#A1A1AA] mb-2">
            Ritmo de déficit natural
          </span>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {DEFICIT_OPTIONS.map((opt) => {
              const active = state.profile.deficitMode === opt.value;
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() =>
                    onUpdateProfile({ deficitMode: opt.value as DeficitMode })
                  }
                  className={`text-left rounded-xl p-3.5 border transition-colors cursor-pointer ${
                    active
                      ? "bg-[#FF6B00]/10 dark:bg-[#FF6B00]/12 border-[#FF6B00]"
                      : "bg-[#F8FAFC] dark:bg-[#0B0B0D] border-[#E2E8F0] dark:border-[#26262B] hover:border-[#CBD5E1] dark:hover:border-[#3A3A42]"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-bold text-[#0F172A] dark:text-white">
                      {opt.label}
                    </span>
                    <Flame
                      className={`w-4 h-4 ${
                        active ? "text-[#FF6B00]" : "text-[#94A3B8] dark:text-[#52525B]"
                      }`}
                    />
                  </div>
                  <p className="mt-1 text-xs text-[#475569] dark:text-[#A1A1AA]">{opt.detail}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Calculated Results Readout */}
        <div className="pt-4 border-t border-[#E2E8F0] dark:border-[#26262B] grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] p-3">
            <span className="block text-[11px] text-[#475569] dark:text-[#A1A1AA]">
              TMB Basal
            </span>
            <span className="mt-1 block font-mono text-lg font-bold tabular-nums text-[#0F172A] dark:text-white">
              {metabolism.tmb}{" "}
              <span className="text-xs font-normal text-[#475569] dark:text-[#A1A1AA]">kcal</span>
            </span>
          </div>

          <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] p-3">
            <span className="block text-[11px] text-[#475569] dark:text-[#A1A1AA]">
              GET Diário
            </span>
            <span className="mt-1 block font-mono text-lg font-bold tabular-nums text-[#0F172A] dark:text-white">
              {metabolism.get}{" "}
              <span className="text-xs font-normal text-[#475569] dark:text-[#A1A1AA]">kcal</span>
            </span>
          </div>

          <div className="rounded-xl bg-[#FF6B00]/10 dark:bg-[#FF6B00]/12 border border-[#FF6B00]/50 dark:border-[#FF6B00]/60 p-3">
            <span className="block text-[11px] text-[#EA580C] dark:text-[#FF6B00] font-semibold">
              Meta Calórica
            </span>
            <span className="mt-1 block font-mono text-lg font-bold tabular-nums text-[#0F172A] dark:text-white">
              {metabolism.calorieTarget}{" "}
              <span className="text-xs font-normal text-[#EA580C] dark:text-orange-200">kcal</span>
            </span>
          </div>

          <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] p-3">
            <span className="block text-[11px] text-[#475569] dark:text-[#A1A1AA]">
              Proteína (2.0g/kg)
            </span>
            <span className="mt-1 block font-mono text-lg font-bold tabular-nums text-[#0F172A] dark:text-white">
              {metabolism.proteinG}g
            </span>
          </div>

          <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] p-3">
            <span className="block text-[11px] text-[#475569] dark:text-[#A1A1AA]">
              Carb / Gordura
            </span>
            <span className="mt-1 block font-mono text-base font-bold tabular-nums text-[#0F172A] dark:text-white">
              {metabolism.carbsG}g{" "}
              <span className="text-[#94A3B8] dark:text-[#52525B] font-normal">/</span>{" "}
              {metabolism.fatG}g
            </span>
          </div>

          <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] p-3">
            <span className="flex items-center gap-1 text-[11px] text-[#475569] dark:text-[#A1A1AA]">
              <Droplets className="w-3 h-3 text-[#FF6B00]" /> Água (40ml/kg)
            </span>
            <span className="mt-1 block font-mono text-lg font-bold tabular-nums text-[#0F172A] dark:text-white">
              {(metabolism.waterTargetMl / 1000).toFixed(2)} L
            </span>
          </div>
        </div>
      </section>

      {/* Quick Prompts */}
      <div className="flex flex-wrap gap-2">
        {NUTRI_QUICK_PROMPTS.map((prompt) => (
          <button
            key={prompt}
            type="button"
            disabled={loading}
            onClick={() => sendMessage(prompt)}
            className="min-h-[40px] px-3.5 py-2 rounded-xl bg-white dark:bg-[#151518] hover:bg-[#F8FAFC] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00]/60 shadow-sm dark:shadow-none text-xs font-medium text-[#334155] dark:text-[#E4E4E7] hover:text-[#0F172A] dark:hover:text-white transition-colors text-left cursor-pointer disabled:opacity-50"
          >
            {prompt}
          </button>
        ))}
      </div>

      {/* Nutri AI Chat */}
      <section
        aria-label="Chat Nutricionista IA"
        className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none flex flex-col overflow-hidden"
      >
        <div className="p-4 sm:p-5 space-y-4 max-h-[500px] overflow-y-auto">
          {state.nutriChat.map((msg) => {
            const isUser = msg.role === "user";
            const isActivePending = !isUser && msg.id === activeAssistantId;
            const isStreamingThis = isActivePending && loadingPhase === "streaming";
            return (
              <div
                key={msg.id}
                className={`flex flex-col ${isUser ? "items-end" : "items-start"}`}
              >
                <div
                  className={`max-w-[92%] sm:max-w-[82%] rounded-2xl px-4 py-3.5 text-sm ${
                    isUser
                      ? "bg-[#FF6B00] text-white font-medium"
                      : "bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] text-[#1E293B] dark:text-[#E4E4E7]"
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
                      agent="nutri"
                      phase={isActivePending ? loadingPhase : "waiting"}
                      retryInfo={isActivePending ? retryInfo : null}
                    />
                  )}
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        {errorMsg && (
          <div
            role="alert"
            className="mx-4 mb-3 rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/40 px-4 py-3 text-xs text-red-700 dark:text-red-200 flex flex-wrap items-center justify-between gap-3"
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
                  ? "Reconectando automaticamente com a Nutri IA..."
                  : "Nutri IA está digitando seu plano..."
                : "Ex.: Monte 4 refeições práticas com arroz, frango, ovos e frutas..."
            }
            disabled={loading}
            className="flex-1 min-h-[46px] rounded-xl bg-white dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-4 text-sm text-[#0F172A] dark:text-white placeholder:text-[#94A3B8] dark:placeholder:text-[#52525B] disabled:opacity-65"
          />
          {loading ? (
            <button
              type="button"
              onClick={handleCancelGeneration}
              aria-label="Parar resposta da Nutricionista IA"
              className="min-h-[46px] min-w-[46px] px-4 rounded-xl bg-[#F1F5F9] dark:bg-[#1C1C21] hover:bg-[#E2E8F0] dark:hover:bg-[#26262B] border border-[#CBD5E1] dark:border-[#3A3A42] hover:border-[#FF6B00]/60 text-[#0F172A] dark:text-white font-semibold text-sm flex items-center justify-center gap-2 transition-colors cursor-pointer shrink-0"
            >
              <Square className="w-3.5 h-3.5 fill-current text-[#FF6B00]" />
              <span className="hidden sm:inline">Parar</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={!input.trim()}
              aria-label="Enviar mensagem à Nutricionista IA"
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
