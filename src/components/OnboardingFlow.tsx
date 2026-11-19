import React, { useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  Dumbbell,
  LogOut,
  Sparkles,
  Upload,
} from "lucide-react";
import { GOAL_OPTIONS } from "../data/exercises";
import { OnboardingPayload } from "../hooks/useBiancoState";
import { TrainingLevel, WeeklyFrequency } from "../types";
import { compressAvatarFile } from "../utils/avatarUpload";
import {
  AVATAR_PRESETS,
  calculateMetabolism,
  frequencyToActivityLevel,
} from "../utils/metabolism";
import { StudentAvatar } from "./StudentAvatar";
import { ThemeToggleButton } from "./ThemeToggleButton";

interface OnboardingFlowProps {
  initialName?: string;
  initialAvatar?: string;
  authBusy: boolean;
  authError: string | null;
  onExit: () => Promise<void>;
  onComplete: (payload: OnboardingPayload) => void;
  onToast: (message: string, tone?: "success" | "info" | "warning") => void;
}

const LEVEL_OPTIONS: { value: TrainingLevel; detail: string }[] = [
  { value: "Iniciante", detail: "Começando agora ou voltando à academia" },
  { value: "Intermediário", detail: "Treino regular há mais de 3 meses" },
  { value: "Avançado", detail: "Domínio de cargas e alta intensidade" },
];

const FREQUENCY_OPTIONS: WeeklyFrequency[] = [3, 4, 5, 6];

export const OnboardingFlow: React.FC<OnboardingFlowProps> = ({
  initialName = "",
  initialAvatar = "preset:orange",
  authBusy,
  authError,
  onExit,
  onComplete,
  onToast,
}) => {
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1
  const [name, setName] = useState(initialName);
  const [sex, setSex] = useState<"M" | "F">("M");
  const [age, setAge] = useState("28");
  const [avatar, setAvatar] = useState(initialAvatar || "preset:orange");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // Step 2
  const [heightCm, setHeightCm] = useState("172");
  const [weightKg, setWeightKg] = useState("76");
  const [targetWeightKg, setTargetWeightKg] = useState("70");
  const [level, setLevel] = useState<TrainingLevel>("Intermediário");
  const [weeklyFrequency, setWeeklyFrequency] = useState<WeeklyFrequency>(4);

  // Step 3
  const [primaryGoal, setPrimaryGoal] = useState<string>(GOAL_OPTIONS[0]);
  const [focuses, setFocuses] = useState<string[]>([]);
  const [customNote, setCustomNote] = useState("");

  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const previewMetabolism = useMemo(() => {
    const parsedWeight = Number(weightKg.replace(",", ".")) || 75;
    const parsedTarget = Number(targetWeightKg.replace(",", ".")) || 70;
    const parsedHeight = Number(heightCm.replace(",", ".")) || 172;
    const parsedAge = Number(age) || 28;

    return calculateMetabolism({
      name: name.trim() || "Atleta",
      sex,
      age: Math.max(14, Math.min(100, parsedAge)),
      heightCm: Math.max(120, Math.min(230, parsedHeight)),
      weightKg: Math.max(35, Math.min(250, parsedWeight)),
      targetWeightKg: Math.max(35, Math.min(250, parsedTarget)),
      activityLevel: frequencyToActivityLevel(weeklyFrequency),
      deficitMode: parsedTarget < parsedWeight ? "acelerado" : "moderado",
      level,
      weeklyFrequency,
      availableTime: 60,
      muscleToday: "Costas + Bíceps",
      avatar,
      onboardingCompleted: false,
    });
  }, [name, sex, age, heightCm, weightKg, targetWeightKg, weeklyFrequency, level, avatar]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMsg(null);
    setUploadingAvatar(true);
    try {
      const compressed = await compressAvatarFile(file);
      setAvatar(compressed);
      onToast("Foto de perfil carregada!", "success");
    } catch (err) {
      setErrorMsg(
        err instanceof Error ? err.message : "Não foi possível carregar a foto."
      );
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  };

  const validateStep1 = (): boolean => {
    const trimmed = name.trim();
    const parsedAge = Number(age);
    if (trimmed.length < 2) {
      setErrorMsg("Informe seu nome completo (pelo menos 2 caracteres).");
      return false;
    }
    if (!Number.isFinite(parsedAge) || parsedAge < 14 || parsedAge > 100) {
      setErrorMsg("Informe uma idade válida entre 14 e 100 anos.");
      return false;
    }
    setErrorMsg(null);
    return true;
  };

  const validateStep2 = (): boolean => {
    const h = Number(heightCm.replace(",", "."));
    const w = Number(weightKg.replace(",", "."));
    const tw = Number(targetWeightKg.replace(",", "."));
    if (!Number.isFinite(h) || h < 120 || h > 230) {
      setErrorMsg("Informe uma altura válida em centímetros (entre 120 e 230 cm).");
      return false;
    }
    if (!Number.isFinite(w) || w < 35 || w > 250) {
      setErrorMsg("Informe um peso atual válido (entre 35 e 250 kg).");
      return false;
    }
    if (!Number.isFinite(tw) || tw < 35 || tw > 250) {
      setErrorMsg("Informe um peso meta válido (entre 35 e 250 kg).");
      return false;
    }
    setErrorMsg(null);
    return true;
  };

  const handleNext = () => {
    if (step === 1 && validateStep1()) {
      setStep(2);
    } else if (step === 2 && validateStep2()) {
      setStep(3);
    }
  };

  const handleBack = () => {
    setErrorMsg(null);
    if (step === 2) setStep(1);
    if (step === 3) setStep(2);
  };

  const handleToggleFocus = (opt: string) => {
    if (opt === primaryGoal) return;
    setFocuses((prev) => {
      if (prev.includes(opt)) return prev.filter((item) => item !== opt);
      if (prev.length < 2) return [...prev, opt];
      return [prev[1], opt];
    });
  };

  const handleSelectPrimary = (opt: string) => {
    setPrimaryGoal(opt);
    setFocuses((prev) => prev.filter((item) => item !== opt));
  };

  const handleFinish = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateStep1() || !validateStep2()) return;

    onComplete({
      name: name.trim(),
      sex,
      age: Math.round(Number(age)),
      avatar,
      heightCm: Math.round(Number(heightCm.replace(",", "."))),
      weightKg: Number(Number(weightKg.replace(",", ".")).toFixed(1)),
      targetWeightKg: Number(Number(targetWeightKg.replace(",", ".")).toFixed(1)),
      level,
      weeklyFrequency,
      primaryGoal,
      focuses,
      customNote: customNote.trim(),
    });
    onToast("Perfil configurado! Metas e IAs prontas para você.", "success");
  };

  const bmiToneClass =
    previewMetabolism.bmiTone === "healthy"
      ? "text-emerald-600 dark:text-emerald-400"
      : previewMetabolism.bmiTone === "warning"
      ? "text-amber-600 dark:text-amber-400"
      : previewMetabolism.bmiTone === "alert"
      ? "text-red-600 dark:text-red-400"
      : "text-sky-600 dark:text-sky-400";

  const stepMeta = [
    { num: 1, title: "Sobre Você" },
    { num: 2, title: "Corpo e Metas" },
    { num: 3, title: "Seu Objetivo" },
  ] as const;

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0B0D] text-[#0F172A] dark:text-white flex flex-col transition-colors">
      {/* Top Brand Header */}
      <header className="border-b border-[#E2E8F0] dark:border-[#26262B] bg-white/90 dark:bg-[#0B0B0D]/90 backdrop-blur-md px-4 sm:px-6 py-4">
        <div className="max-w-3xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-[#FF6B00] flex items-center justify-center shrink-0 shadow-md shadow-[#FF6B00]/20">
              <Dumbbell className="w-5 h-5 text-white" />
            </div>
            <span className="font-display text-lg sm:text-xl font-extrabold tracking-tight text-[#0F172A] dark:text-white">
              Personal Nutri <span className="text-[#FF6B00]">Fit</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <ThemeToggleButton size="sm" />
            <button
              type="button"
              disabled={authBusy}
              onClick={() => void onExit()}
              className="min-h-[40px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#151518] hover:bg-[#F1F5F9] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00]/60 text-xs font-semibold text-[#334155] dark:text-[#E4E4E7] hover:text-[#0F172A] dark:hover:text-white flex items-center gap-2 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
            >
              <LogOut className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span>Sair</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Wizard Container */}
      <main className="flex-1 px-4 sm:px-6 py-6 sm:py-10">
        <div className="max-w-3xl mx-auto space-y-6">
          {authError && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/40 px-4 py-3 text-xs text-red-700 dark:text-red-200">
              {authError}
            </div>
          )}

          {/* 3-Step Progress Header */}
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold text-[#FF6B00]">
                Etapa {step} de 3 · {stepMeta[step - 1].title}
              </span>
              <span className="font-mono tabular-nums text-[#475569] dark:text-[#A1A1AA]">
                {Math.round((step / 3) * 100)}%
              </span>
            </div>

            <div className="grid grid-cols-3 gap-2">
              {stepMeta.map((s) => (
                <div
                  key={s.num}
                  className={`h-1.5 rounded-full transition-colors ${
                    s.num <= step ? "bg-[#FF6B00]" : "bg-[#E2E8F0] dark:bg-[#26262B]"
                  }`}
                />
              ))}
            </div>
          </div>

          {/* Step Card */}
          <form
            onSubmit={handleFinish}
            className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none p-5 sm:p-8 space-y-6"
          >
            {/* STEP 1: SOBRE VOCÊ */}
            {step === 1 && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] dark:text-white tracking-tight">
                    Vamos personalizar seu treino
                  </h1>
                  <p className="mt-1.5 text-sm text-[#475569] dark:text-[#A1A1AA]">
                    Com seus dados básicos, ajustamos seu metabolismo, metas diárias e o Personal IA e a Nutri IA sob medida.
                  </p>
                </div>

                {/* Avatar picker & photo upload */}
                <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] p-4 flex flex-col sm:flex-row sm:items-center gap-4">
                  <div className="flex items-center gap-3.5">
                    <StudentAvatar
                      avatar={avatar}
                      name={name || "Personal Nutri Fit"}
                      size="lg"
                    />
                    <div>
                      <p className="text-sm font-bold text-[#0F172A] dark:text-white">Avatar do aluno</p>
                      <p className="text-xs text-[#475569] dark:text-[#A1A1AA]">
                        Escolha um estilo ou envie sua foto
                      </p>
                      <button
                        type="button"
                        disabled={uploadingAvatar}
                        onClick={() => fileInputRef.current?.click()}
                        className="mt-2 min-h-[36px] px-3 rounded-lg bg-white dark:bg-[#151518] hover:bg-[#F1F5F9] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00]/60 text-xs font-semibold text-[#0F172A] dark:text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                      >
                        {uploadingAvatar ? (
                          <Upload className="w-3.5 h-3.5 text-[#FF6B00] animate-pulse" />
                        ) : (
                          <Camera className="w-3.5 h-3.5 text-[#FF6B00]" />
                        )}
                        <span>{uploadingAvatar ? "Processando..." : "Enviar foto"}</span>
                      </button>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        onChange={handleAvatarUpload}
                        className="hidden"
                      />
                    </div>
                  </div>

                  <div className="sm:ml-auto flex flex-wrap items-center gap-2">
                    {AVATAR_PRESETS.map((preset) => {
                      const active = avatar === preset.id;
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          onClick={() => setAvatar(preset.id)}
                          aria-label={preset.label}
                          title={preset.label}
                          className={`w-10 h-10 rounded-xl ${preset.bgClass} ${preset.accentText} text-xs font-extrabold flex items-center justify-center transition-all cursor-pointer ${
                            active
                              ? "ring-2 ring-[#FF6B00] ring-offset-2 ring-offset-[#F8FAFC] dark:ring-offset-[#0B0B0D] scale-105"
                              : "opacity-75 hover:opacity-100"
                          }`}
                        >
                          {preset.initialsHint}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Name */}
                <div>
                  <label
                    htmlFor="ob-name"
                    className="block text-xs font-semibold text-[#334155] dark:text-[#D4D4D8] mb-1.5"
                  >
                    Nome completo *
                  </label>
                  <input
                    id="ob-name"
                    type="text"
                    required
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex.: Rafael Silva"
                    className="w-full min-h-[48px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-4 text-sm font-medium text-[#0F172A] dark:text-white placeholder:text-[#94A3B8] dark:placeholder:text-[#52525B]"
                  />
                </div>

                {/* Sex & Age */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <span className="block text-xs font-semibold text-[#334155] dark:text-[#D4D4D8] mb-1.5">
                      Sexo biológico (usado na fórmula TMB) *
                    </span>
                    <div className="grid grid-cols-2 gap-2">
                      {(
                        [
                          { id: "M", label: "Masculino" },
                          { id: "F", label: "Feminino" },
                        ] as const
                      ).map((opt) => {
                        const active = sex === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setSex(opt.id)}
                            className={`min-h-[48px] rounded-xl text-sm font-semibold border transition-colors cursor-pointer ${
                              active
                                ? "bg-[#FF6B00] border-[#FF6B00] text-white"
                                : "bg-[#F8FAFC] dark:bg-[#0B0B0D] border-[#E2E8F0] dark:border-[#26262B] text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white"
                            }`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  <div>
                    <label
                      htmlFor="ob-age"
                      className="block text-xs font-semibold text-[#334155] dark:text-[#D4D4D8] mb-1.5"
                    >
                      Idade (anos) *
                    </label>
                    <input
                      id="ob-age"
                      type="number"
                      min={14}
                      max={100}
                      required
                      value={age}
                      onChange={(e) => setAge(e.target.value)}
                      placeholder="28"
                      className="w-full min-h-[48px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-4 font-mono text-base font-bold tabular-nums text-[#0F172A] dark:text-white"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* STEP 2: CORPO E METAS */}
            {step === 2 && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] dark:text-white tracking-tight">
                    Corpo e rotina de academia
                  </h1>
                  <p className="mt-1.5 text-sm text-[#475569] dark:text-[#A1A1AA]">
                    Usamos esses números para calcular seu IMC, gasto calórico, proteína diária e volume ideal de séries.
                  </p>
                </div>

                {/* Height, Current Weight, Target Weight */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label
                      htmlFor="ob-height"
                      className="block text-xs font-semibold text-[#334155] dark:text-[#D4D4D8] mb-1.5"
                    >
                      Altura (cm) *
                    </label>
                    <input
                      id="ob-height"
                      type="number"
                      min={120}
                      max={230}
                      required
                      value={heightCm}
                      onChange={(e) => setHeightCm(e.target.value)}
                      className="w-full min-h-[48px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-4 font-mono text-base font-bold tabular-nums text-[#0F172A] dark:text-white"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="ob-weight"
                      className="block text-xs font-semibold text-[#334155] dark:text-[#D4D4D8] mb-1.5"
                    >
                      Peso Atual (kg) *
                    </label>
                    <input
                      id="ob-weight"
                      type="number"
                      step="0.1"
                      min={35}
                      max={250}
                      required
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      className="w-full min-h-[48px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-4 font-mono text-base font-bold tabular-nums text-[#0F172A] dark:text-white"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="ob-target"
                      className="block text-xs font-semibold text-[#334155] dark:text-[#D4D4D8] mb-1.5"
                    >
                      Peso Meta (kg) *
                    </label>
                    <input
                      id="ob-target"
                      type="number"
                      step="0.1"
                      min={35}
                      max={250}
                      required
                      value={targetWeightKg}
                      onChange={(e) => setTargetWeightKg(e.target.value)}
                      className="w-full min-h-[48px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-4 font-mono text-base font-bold tabular-nums text-[#0F172A] dark:text-white"
                    />
                  </div>
                </div>

                {/* Gym Level */}
                <div>
                  <span className="block text-xs font-semibold text-[#334155] dark:text-[#D4D4D8] mb-2">
                    Nível na Academia *
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    {LEVEL_OPTIONS.map((opt) => {
                      const active = level === opt.value;
                      return (
                        <button
                          key={opt.value}
                          type="button"
                          onClick={() => setLevel(opt.value)}
                          className={`text-left rounded-xl p-3.5 border transition-colors cursor-pointer ${
                            active
                              ? "bg-[#FF6B00]/12 border-[#FF6B00]"
                              : "bg-[#F8FAFC] dark:bg-[#0B0B0D] border-[#E2E8F0] dark:border-[#26262B] hover:border-[#CBD5E1] dark:hover:border-[#3A3A42]"
                          }`}
                        >
                          <p className="text-sm font-bold text-[#0F172A] dark:text-white">{opt.value}</p>
                          <p className="mt-1 text-xs text-[#475569] dark:text-[#A1A1AA] leading-snug">
                            {opt.detail}
                          </p>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Weekly Frequency */}
                <div>
                  <span className="block text-xs font-semibold text-[#334155] dark:text-[#D4D4D8] mb-2">
                    Frequência Semanal na Academia *
                  </span>
                  <div className="grid grid-cols-4 gap-2">
                    {FREQUENCY_OPTIONS.map((freq) => {
                      const active = weeklyFrequency === freq;
                      return (
                        <button
                          key={freq}
                          type="button"
                          onClick={() => setWeeklyFrequency(freq)}
                          className={`min-h-[48px] rounded-xl border font-mono text-sm font-bold tabular-nums transition-colors cursor-pointer ${
                            active
                              ? "bg-[#FF6B00] border-[#FF6B00] text-white"
                              : "bg-[#F8FAFC] dark:bg-[#0B0B0D] border-[#E2E8F0] dark:border-[#26262B] text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white"
                          }`}
                        >
                          {freq}x/sem
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3: SEU OBJETIVO + LIVE METABOLIC PREVIEW */}
            {step === 3 && (
              <div className="space-y-6">
                <div>
                  <h1 className="text-2xl sm:text-3xl font-extrabold text-[#0F172A] dark:text-white tracking-tight">
                    Qual é o seu objetivo principal?
                  </h1>
                  <p className="mt-1.5 text-sm text-[#475569] dark:text-[#A1A1AA]">
                    Escolha 1 objetivo principal e, se quiser, até 2 focos complementares.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {GOAL_OPTIONS.map((opt) => {
                    const isPrimary = primaryGoal === opt;
                    const isFocus = focuses.includes(opt);
                    return (
                      <div
                        key={opt}
                        className={`rounded-xl border transition-colors ${
                          isPrimary
                            ? "bg-[#FF6B00]/12 border-[#FF6B00]"
                            : isFocus
                            ? "bg-[#FFF7ED] dark:bg-[#1C1C21] border-[#FF6B00]/50"
                            : "bg-[#F8FAFC] dark:bg-[#0B0B0D] border-[#E2E8F0] dark:border-[#26262B] hover:border-[#CBD5E1] dark:hover:border-[#3A3A42]"
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => handleSelectPrimary(opt)}
                          className="w-full text-left px-3.5 py-3 flex items-center justify-between gap-2 cursor-pointer"
                        >
                          <span className="text-sm font-semibold text-[#0F172A] dark:text-white">{opt}</span>
                          {isPrimary && (
                            <Check className="w-4 h-4 text-[#FF6B00] shrink-0" />
                          )}
                        </button>
                        {!isPrimary && (
                          <div className="px-3.5 pb-2.5 flex justify-end border-t border-[#E2E8F0] dark:border-[#26262B]/60">
                            <button
                              type="button"
                              onClick={() => handleToggleFocus(opt)}
                              className={`mt-1.5 text-[11px] font-medium transition-colors cursor-pointer ${
                                isFocus
                                  ? "text-[#FF6B00]"
                                  : "text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white"
                              }`}
                            >
                              {isFocus
                                ? "Foco selecionado · Remover"
                                : "+ Adicionar como foco extra"}
                            </button>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Custom restrictions / focus */}
                <div>
                  <label
                    htmlFor="ob-note"
                    className="block text-xs font-semibold text-[#334155] dark:text-[#D4D4D8] mb-1.5"
                  >
                    Restrições físicas ou foco específico (opcional)
                  </label>
                  <textarea
                    id="ob-note"
                    rows={2}
                    value={customNote}
                    onChange={(e) => setCustomNote(e.target.value)}
                    placeholder="Ex.: Quero definir bem as costas, tenho leve desconforto no joelho direito e treino às 19h..."
                    className="w-full rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-4 py-3 text-sm text-[#0F172A] dark:text-white placeholder:text-[#94A3B8] dark:placeholder:text-[#52525B] resize-none"
                  />
                </div>

                {/* Auto-calculated Metabolic Preview */}
                <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] p-4 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[#FF6B00]">
                    <Sparkles className="w-3.5 h-3.5" />
                    <span>Cálculo automático pronto para o seu Dashboard</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
                    <div>
                      <span className="text-[#475569] dark:text-[#A1A1AA] block">IMC Estimado</span>
                      <span className="font-mono text-base font-bold text-[#0F172A] dark:text-white tabular-nums">
                        {previewMetabolism.bmi}
                      </span>{" "}
                      <span className={`font-semibold ${bmiToneClass}`}>
                        {previewMetabolism.bmiLabel}
                      </span>
                    </div>
                    <div>
                      <span className="text-[#475569] dark:text-[#A1A1AA] block">TMB / GET</span>
                      <span className="font-mono text-base font-bold text-[#0F172A] dark:text-white tabular-nums">
                        {previewMetabolism.tmb} / {previewMetabolism.get}
                      </span>{" "}
                      <span className="text-[#475569] dark:text-[#A1A1AA]">kcal</span>
                    </div>
                    <div>
                      <span className="text-[#475569] dark:text-[#A1A1AA] block">Meta Calórica</span>
                      <span className="font-mono text-base font-bold text-[#FF6B00] tabular-nums">
                        {previewMetabolism.calorieTarget} kcal
                      </span>
                    </div>
                    <div>
                      <span className="text-[#475569] dark:text-[#A1A1AA] block">Proteína Diária</span>
                      <span className="font-mono text-base font-bold text-[#0F172A] dark:text-white tabular-nums">
                        {previewMetabolism.proteinG}g
                      </span>
                    </div>
                    <div>
                      <span className="text-[#475569] dark:text-[#A1A1AA] block">Meta de Água</span>
                      <span className="font-mono text-base font-bold text-[#0F172A] dark:text-white tabular-nums">
                        {(previewMetabolism.waterTargetMl / 1000).toFixed(2)} L
                      </span>
                    </div>
                    <div>
                      <span className="text-[#475569] dark:text-[#A1A1AA] block">Frequência</span>
                      <span className="font-mono text-base font-bold text-[#0F172A] dark:text-white tabular-nums">
                        {weeklyFrequency}x/semana
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Inline Validation Error */}
            {errorMsg && (
              <div
                role="alert"
                className="rounded-xl bg-red-500/10 border border-red-500/40 px-4 py-3 text-xs text-red-700 dark:text-red-200"
              >
                {errorMsg}
              </div>
            )}

            {/* Footer Actions */}
            <div className="pt-4 border-t border-[#E2E8F0] dark:border-[#26262B] flex items-center justify-between gap-3">
              {step > 1 ? (
                <button
                  type="button"
                  onClick={handleBack}
                  className="min-h-[48px] px-4 rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] hover:bg-[#F1F5F9] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] text-sm font-semibold text-[#334155] dark:text-[#D4D4D8] hover:text-[#0F172A] dark:hover:text-white flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Voltar</span>
                </button>
              ) : (
                <div />
              )}

              {step < 3 ? (
                <button
                  type="button"
                  onClick={handleNext}
                  className="min-h-[48px] px-6 rounded-xl bg-[#FF6B00] hover:bg-[#F97316] active:scale-[0.98] text-sm font-bold text-white flex items-center gap-2 transition-all cursor-pointer"
                >
                  <span>Continuar</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  className="min-h-[48px] px-6 rounded-xl bg-[#FF6B00] hover:bg-[#F97316] active:scale-[0.98] text-sm font-bold text-white flex items-center gap-2 shadow-lg shadow-[#FF6B00]/25 transition-all cursor-pointer"
                >
                  <Check className="w-4 h-4" />
                  <span>Concluir e Ir para o Dashboard</span>
                </button>
              )}
            </div>
          </form>
        </div>
      </main>
    </div>
  );
};
