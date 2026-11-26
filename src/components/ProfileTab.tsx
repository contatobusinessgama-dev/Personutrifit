import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Bell,
  BellOff,
  Camera,
  Check,
  CheckCircle2,
  Clock,
  Download,
  Droplets,
  Flame,
  LogOut,
  Ruler,
  Save,
  ShieldAlert,
  SunMoon,
  Trash2,
  Trophy,
  User as UserIcon,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { getTodayIso } from "../hooks/useBiancoState";
import {
  BiancoAppState,
  BodyMeasurement,
  MetabolicResult,
  StudentProfile,
  TrainingLevel,
  WaterReminderIntervalMin,
  WaterReminderSettings,
  WeeklyFrequency,
} from "../types";
import { compressAvatarFile } from "../utils/avatarUpload";
import { AVATAR_PRESETS, frequencyToActivityLevel } from "../utils/metabolism";
import { PWAInstallButton } from "./PWAInstallButton";
import { StudentAvatar } from "./StudentAvatar";
import { ThemeSegmentedControl } from "./ErrorBoundary";

type ProfileSubTab = "geral" | "hidratacao";

const WATER_REMINDER_INTERVALS: {
  value: WaterReminderIntervalMin;
  label: string;
  hint: string;
}[] = [
  { value: 30, label: "30 min", hint: "Hidratação intensa" },
  { value: 45, label: "45 min", hint: "Ritmo constante" },
  { value: 60, label: "1 hora", hint: "Recomendado" },
  { value: 90, label: "1h30", hint: "Moderado" },
  { value: 120, label: "2 horas", hint: "Espaçado" },
];

interface ProfileTabProps {
  state: BiancoAppState;
  metabolism: MetabolicResult;
  latestMeasurement: BodyMeasurement | null;
  previousMeasurement: BodyMeasurement | null;
  streakDays: number;
  onUpdateProfile: (patch: Partial<StudentProfile>) => void;
  onAddMeasurement: (entry: Omit<BodyMeasurement, "id">) => void;
  onUpdateWaterReminder: (patch: Partial<WaterReminderSettings>) => void;
  onTriggerWaterReminderTest: () => void;
  onExportJson: () => string;
  onResetAllData: () => void;
  onSignOut?: () => Promise<void> | void;
  authBusy?: boolean;
  onToast: (message: string, tone?: "success" | "info" | "warning") => void;
}

type MeasurementKey =
  | "neckCm"
  | "chestCm"
  | "waistCm"
  | "abdomenCm"
  | "hipCm"
  | "armRightCm"
  | "armLeftCm"
  | "thighRightCm"
  | "thighLeftCm"
  | "calfCm";

const MEASUREMENT_FIELDS: {
  key: MeasurementKey;
  label: string;
  placeholder: string;
  min: number;
  max: number;
  legacyKey?: "armCm" | "thighCm";
}[] = [
  { key: "neckCm", label: "Pescoço (cm)", placeholder: "Ex.: 38", min: 20, max: 80 },
  { key: "chestCm", label: "Peito / Tórax (cm)", placeholder: "Ex.: 98", min: 50, max: 220 },
  { key: "waistCm", label: "Cintura (cm)", placeholder: "Ex.: 82", min: 30, max: 250 },
  { key: "abdomenCm", label: "Abdômen (cm)", placeholder: "Ex.: 87", min: 30, max: 250 },
  { key: "hipCm", label: "Quadril (cm)", placeholder: "Ex.: 98", min: 50, max: 250 },
  {
    key: "armRightCm",
    label: "Braço Direito (cm)",
    placeholder: "Ex.: 35.5",
    min: 10,
    max: 100,
    legacyKey: "armCm",
  },
  {
    key: "armLeftCm",
    label: "Braço Esquerdo (cm)",
    placeholder: "Ex.: 35.0",
    min: 10,
    max: 100,
  },
  {
    key: "thighRightCm",
    label: "Coxa Direita (cm)",
    placeholder: "Ex.: 57",
    min: 20,
    max: 150,
    legacyKey: "thighCm",
  },
  {
    key: "thighLeftCm",
    label: "Coxa Esquerda (cm)",
    placeholder: "Ex.: 56.5",
    min: 20,
    max: 150,
  },
  { key: "calfCm", label: "Panturrilha (cm)", placeholder: "Ex.: 38", min: 15, max: 90 },
];

const LEVEL_OPTIONS: TrainingLevel[] = ["Iniciante", "Intermediário", "Avançado"];
const FREQUENCY_OPTIONS: WeeklyFrequency[] = [3, 4, 5, 6];
const TIME_OPTIONS: (30 | 45 | 60 | 90)[] = [30, 45, 60, 90];

function readMeasureValue(
  m: BodyMeasurement | null,
  field: (typeof MEASUREMENT_FIELDS)[number]
): number | undefined {
  if (!m) return undefined;
  const direct = m[field.key];
  if (typeof direct === "number" && direct > 0) return direct;
  if (field.legacyKey && typeof m[field.legacyKey] === "number" && (m[field.legacyKey] ?? 0) > 0) {
    return m[field.legacyKey];
  }
  return undefined;
}

export const ProfileTab: React.FC<ProfileTabProps> = ({
  state,
  metabolism,
  latestMeasurement,
  previousMeasurement,
  streakDays,
  onUpdateProfile,
  onAddMeasurement,
  onUpdateWaterReminder,
  onTriggerWaterReminderTest,
  onExportJson,
  onResetAllData,
  onSignOut,
  authBusy = false,
  onToast,
}) => {
  const { profile } = state;
  const [activeSubTab, setActiveSubTab] = useState<ProfileSubTab>("geral");

  const reminder: WaterReminderSettings = state.waterReminder || {
    enabled: true,
    intervalMin: 60,
    startHour: 8,
    endHour: 22,
    soundEnabled: true,
    browserNotificationEnabled: false,
    lastRemindedAt: null,
  };

  const browserNotifSupported =
    typeof window !== "undefined" && "Notification" in window;
  const [browserPermission, setBrowserPermission] = useState<string>(() =>
    browserNotifSupported ? Notification.permission : "unsupported"
  );

  const hydrationPlanStats = useMemo(() => {
    const activeHours = Math.max(1, reminder.endHour - reminder.startHour);
    const remindersPerDay = Math.max(
      1,
      Math.floor((activeHours * 60) / Math.max(15, reminder.intervalMin))
    );
    const mlPerReminder = Math.max(
      100,
      Math.round(metabolism.waterTargetMl / remindersPerDay)
    );
    const consumedPct = Math.min(
      100,
      Math.round((state.water.consumedMl / Math.max(1, metabolism.waterTargetMl)) * 100)
    );
    const windowStartPct = (reminder.startHour / 24) * 100;
    const windowWidthPct = (activeHours / 24) * 100;
    return {
      activeHours,
      remindersPerDay,
      mlPerReminder,
      consumedPct,
      windowStartPct,
      windowWidthPct,
    };
  }, [
    reminder.startHour,
    reminder.endHour,
    reminder.intervalMin,
    metabolism.waterTargetMl,
    state.water.consumedMl,
  ]);

  const handleToggleBrowserNotifications = async () => {
    if (!browserNotifSupported) {
      onToast(
        "Seu navegador não suporta notificações nativas, mas o alerta visual e sonoro dentro do app segue ativo!",
        "info"
      );
      return;
    }

    if (reminder.browserNotificationEnabled) {
      onUpdateWaterReminder({ browserNotificationEnabled: false });
      onToast("Notificações do navegador desativadas.", "info");
      return;
    }

    if (Notification.permission === "granted") {
      setBrowserPermission("granted");
      onUpdateWaterReminder({ browserNotificationEnabled: true });
      onToast("Notificações do navegador ativadas para os lembretes de água!", "success");
      return;
    }

    try {
      const permission = await Notification.requestPermission();
      setBrowserPermission(permission);
      if (permission === "granted") {
        onUpdateWaterReminder({ browserNotificationEnabled: true });
        onToast("Permissão concedida! Você receberá alertas do navegador para beber água.", "success");
      } else {
        onUpdateWaterReminder({ browserNotificationEnabled: false });
        onToast(
          "Permissão de notificação negada no navegador. O alerta visual e o som dentro do app continuam funcionando.",
          "warning"
        );
      }
    } catch {
      onToast("O alerta visual e o som dentro do app continuam ativos!", "info");
    }
  };

  // Editable personal form state
  const [name, setName] = useState(profile.name);
  const [sex, setSex] = useState<"M" | "F">(profile.sex);
  const [age, setAge] = useState(String(profile.age));
  const [heightCm, setHeightCm] = useState(String(profile.heightCm));
  const [weightKg, setWeightKg] = useState(String(profile.weightKg));
  const [targetWeightKg, setTargetWeightKg] = useState(String(profile.targetWeightKg));
  const [level, setLevel] = useState<TrainingLevel>(profile.level);
  const [weeklyFrequency, setWeeklyFrequency] = useState<WeeklyFrequency>(
    profile.weeklyFrequency
  );
  const [availableTime, setAvailableTime] = useState<30 | 45 | 60 | 90>(
    profile.availableTime
  );
  const [profileError, setProfileError] = useState<string | null>(null);

  // Avatar editor toggle
  const [editingAvatar, setEditingAvatar] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarFileRef = useRef<HTMLInputElement>(null);

  // Measurements form state (prefilled with latest values if available)
  const [evalWeightKg, setEvalWeightKg] = useState(String(profile.weightKg));
  const [measures, setMeasures] = useState<Record<MeasurementKey, string>>(() => {
    const initial = {} as Record<MeasurementKey, string>;
    for (const f of MEASUREMENT_FIELDS) {
      const val = readMeasureValue(latestMeasurement, f);
      initial[f.key] = val !== undefined ? String(val) : "";
    }
    return initial;
  });
  const [measureError, setMeasureError] = useState<string | null>(null);

  // Reset confirmation modal
  const [showResetModal, setShowResetModal] = useState(false);

  // Sync form drafts if cloud hydration updates profile or latestMeasurement
  useEffect(() => {
    setName(profile.name);
    setSex(profile.sex);
    setAge(String(profile.age));
    setHeightCm(String(profile.heightCm));
    setWeightKg(String(profile.weightKg));
    setTargetWeightKg(String(profile.targetWeightKg));
    setLevel(profile.level);
    setWeeklyFrequency(profile.weeklyFrequency);
    setAvailableTime(profile.availableTime);
    setEvalWeightKg(String(profile.weightKg));
  }, [profile]);

  useEffect(() => {
    if (!latestMeasurement) return;
    const next = {} as Record<MeasurementKey, string>;
    for (const f of MEASUREMENT_FIELDS) {
      const val = readMeasureValue(latestMeasurement, f);
      next[f.key] = val !== undefined ? String(val) : "";
    }
    setMeasures(next);
  }, [latestMeasurement]);

  const handleAvatarUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    try {
      const compressed = await compressAvatarFile(file);
      onUpdateProfile({ avatar: compressed });
      onToast("Foto de perfil atualizada!", "success");
      setEditingAvatar(false);
    } catch (err) {
      onToast(
        err instanceof Error ? err.message : "Erro ao processar a foto.",
        "warning"
      );
    } finally {
      setUploadingAvatar(false);
      e.target.value = "";
    }
  };

  const handleSavePersonal = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmedName = name.trim();
    const parsedAge = Number(age);
    const parsedHeight = Number(heightCm.replace(",", "."));
    const parsedWeight = Number(weightKg.replace(",", "."));
    const parsedTarget = Number(targetWeightKg.replace(",", "."));

    if (trimmedName.length < 2) {
      setProfileError("Informe um nome válido (pelo menos 2 caracteres).");
      return;
    }
    if (!Number.isFinite(parsedAge) || parsedAge < 14 || parsedAge > 100) {
      setProfileError("A idade deve estar entre 14 e 100 anos.");
      return;
    }
    if (!Number.isFinite(parsedHeight) || parsedHeight < 120 || parsedHeight > 230) {
      setProfileError("A altura deve estar entre 120 e 230 cm.");
      return;
    }
    if (!Number.isFinite(parsedWeight) || parsedWeight < 35 || parsedWeight > 250) {
      setProfileError("O peso atual deve estar entre 35 e 250 kg.");
      return;
    }
    if (!Number.isFinite(parsedTarget) || parsedTarget < 35 || parsedTarget > 250) {
      setProfileError("O peso meta deve estar entre 35 e 250 kg.");
      return;
    }

    setProfileError(null);
    onUpdateProfile({
      name: trimmedName,
      sex,
      age: Math.round(parsedAge),
      heightCm: Math.round(parsedHeight),
      weightKg: Number(parsedWeight.toFixed(1)),
      targetWeightKg: Number(parsedTarget.toFixed(1)),
      level,
      weeklyFrequency,
      activityLevel: frequencyToActivityLevel(weeklyFrequency),
      availableTime,
    });
    onToast("Perfil atualizado! Metas e IAs sincronizadas.", "success");
  };

  const handleSaveEvaluation = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedWeight = Number(evalWeightKg.replace(",", "."));
    if (!Number.isFinite(parsedWeight) || parsedWeight < 30 || parsedWeight > 300) {
      setMeasureError("Informe um peso corporal válido entre 30 e 300 kg.");
      return;
    }

    const entry: Omit<BodyMeasurement, "id"> = {
      date: getTodayIso(),
      weightKg: Number(parsedWeight.toFixed(1)),
    };

    for (const field of MEASUREMENT_FIELDS) {
      const raw = measures[field.key].trim();
      if (!raw) continue;
      const num = Number(raw.replace(",", "."));
      if (!Number.isFinite(num) || num <= 0) {
        setMeasureError(`Valor inválido em "${field.label}". Use apenas números positivos.`);
        return;
      }
      if (num < field.min || num > field.max) {
        setMeasureError(
          `"${field.label}" deve estar entre ${field.min} e ${field.max} cm.`
        );
        return;
      }
      entry[field.key] = Number(num.toFixed(1));
    }

    if (entry.armRightCm) entry.armCm = entry.armRightCm;
    if (entry.thighRightCm) entry.thighCm = entry.thighRightCm;

    setMeasureError(null);
    onAddMeasurement(entry);
    onToast("Nova avaliação física salva no histórico!", "success");
  };

  const handleExport = () => {
    try {
      const json = onExportJson();
      const blob = new Blob([json], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `personal-nutri-fit-dados-${getTodayIso()}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      onToast("Backup JSON exportado com sucesso!", "info");
    } catch {
      onToast("Não foi possível exportar os dados.", "warning");
    }
  };

  const handleConfirmReset = () => {
    setShowResetModal(false);
    onResetAllData();
    onToast("Todos os dados locais foram resetados.", "info");
  };

  const weightDiff = Number((profile.weightKg - profile.targetWeightKg).toFixed(1));
  const absWeightDiff = Math.abs(weightDiff);

  const bmiBadgeClasses =
    metabolism.bmiTone === "healthy"
      ? "text-emerald-700 dark:text-emerald-400 bg-emerald-500/12 border-emerald-500/35"
      : metabolism.bmiTone === "warning"
      ? "text-amber-700 dark:text-amber-400 bg-amber-500/12 border-amber-500/35"
      : metabolism.bmiTone === "alert"
      ? "text-red-700 dark:text-red-400 bg-red-500/12 border-red-500/35"
      : "text-sky-700 dark:text-sky-400 bg-sky-500/12 border-sky-500/35";

  // Position marker on 16..36 BMI visual bar
  const bmiMarkerPct = Math.max(
    4,
    Math.min(96, Math.round(((metabolism.bmi - 16) / (36 - 16)) * 100))
  );

  return (
    <div className="space-y-6 pb-20 md:pb-10">
      {/* 1. CABEÇALHO DO ALUNO */}
      <section
        aria-label="Cabeçalho do aluno"
        className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none p-5 sm:p-6 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4 min-w-0">
            <button
              type="button"
              onClick={() => setEditingAvatar((prev) => !prev)}
              title="Alterar avatar ou foto"
              className="relative group shrink-0 cursor-pointer"
            >
              <StudentAvatar
                avatar={profile.avatar}
                name={profile.name}
                size="xl"
                className="group-hover:border-[#FF6B00] transition-colors"
              />
              <span className="absolute -bottom-1 -right-1 w-7 h-7 rounded-lg bg-[#FF6B00] text-white flex items-center justify-center border-2 border-white dark:border-[#151518]">
                <Camera className="w-3.5 h-3.5" />
              </span>
            </button>

            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-xs">
                <span className="font-semibold text-[#FF6B00]">{profile.level}</span>
                <span aria-hidden="true" className="text-[#94A3B8] dark:text-[#52525B]">·</span>
                <span className="font-mono tabular-nums text-[#334155] dark:text-[#D4D4D8]">
                  {profile.weeklyFrequency}x/semana
                </span>
                <span aria-hidden="true" className="text-[#94A3B8] dark:text-[#52525B]">·</span>
                <span className="inline-flex items-center gap-1 text-[#334155] dark:text-[#D4D4D8]">
                  <Trophy className="w-3.5 h-3.5 text-[#FF6B00]" />
                  <span className="font-mono tabular-nums">
                    {streakDays} {streakDays === 1 ? "dia" : "dias"} de sequência
                  </span>
                </span>
              </div>

              <h1 className="mt-1 text-2xl sm:text-3xl font-extrabold text-[#0F172A] dark:text-white tracking-tight truncate">
                {profile.name}
              </h1>

              <p className="mt-1 text-xs sm:text-sm text-[#475569] dark:text-[#A1A1AA] truncate">
                Objetivo atual:{" "}
                <strong className="text-[#0F172A] dark:text-white font-semibold">{state.goals.primary}</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setEditingAvatar((prev) => !prev)}
            className="self-start sm:self-auto min-h-[40px] px-3.5 rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] hover:bg-[#F1F5F9] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] text-xs font-semibold text-[#334155] dark:text-[#E4E4E7] flex items-center gap-1.5 transition-colors cursor-pointer shrink-0"
          >
            <Camera className="w-3.5 h-3.5 text-[#FF6B00]" />
            <span>{editingAvatar ? "Fechar avatar" : "Trocar avatar"}</span>
          </button>
        </div>

        {/* Inline Avatar Selector */}
        {editingAvatar && (
          <div className="pt-4 border-t border-[#E2E8F0] dark:border-[#26262B] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-2">
              {AVATAR_PRESETS.map((preset) => {
                const active = profile.avatar === preset.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => {
                      onUpdateProfile({ avatar: preset.id });
                      onToast("Avatar atualizado!", "success");
                    }}
                    title={preset.label}
                    className={`w-10 h-10 rounded-xl ${preset.bgClass} ${preset.accentText} text-xs font-extrabold flex items-center justify-center cursor-pointer transition-all ${
                      active
                        ? "ring-2 ring-[#FF6B00] ring-offset-2 ring-offset-white dark:ring-offset-[#151518]"
                        : "opacity-75 hover:opacity-100"
                    }`}
                  >
                    {preset.initialsHint}
                  </button>
                );
              })}
            </div>

            <div>
              <button
                type="button"
                disabled={uploadingAvatar}
                onClick={() => avatarFileRef.current?.click()}
                className="min-h-[42px] px-4 rounded-xl bg-[#FF6B00] hover:bg-[#F97316] text-xs font-bold text-white flex items-center gap-2 transition-colors cursor-pointer"
              >
                <Camera className="w-4 h-4" />
                <span>{uploadingAvatar ? "Processando foto..." : "Fazer upload de foto"}</span>
              </button>
              <input
                ref={avatarFileRef}
                type="file"
                accept="image/*"
                onChange={handleAvatarUpload}
                className="hidden"
              />
            </div>
          </div>
        )}
      </section>

      {/* NAVEGAÇÃO INTERNA DA SEÇÃO DE PERFIL */}
      <div
        role="tablist"
        aria-label="Seções do Perfil"
        className="grid grid-cols-1 sm:grid-cols-2 gap-2 p-1.5 rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === "geral"}
          onClick={() => setActiveSubTab("geral")}
          className={`min-h-[46px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeSubTab === "geral"
              ? "bg-[#FF6B00] text-white shadow-sm"
              : "text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white hover:bg-[#F8FAFC] dark:hover:bg-[#1C1C21]"
          }`}
        >
          <UserIcon className="w-4 h-4" />
          <span>Perfil & Avaliação Física</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={activeSubTab === "hidratacao"}
          onClick={() => setActiveSubTab("hidratacao")}
          className={`min-h-[46px] px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-all cursor-pointer ${
            activeSubTab === "hidratacao"
              ? "bg-[#FF6B00] text-white shadow-sm"
              : "text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white hover:bg-[#F8FAFC] dark:hover:bg-[#1C1C21]"
          }`}
        >
          <Droplets className="w-4 h-4" />
          <span>Configurações de Hidratação</span>
          <span
            className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-extrabold ${
              activeSubTab === "hidratacao"
                ? "bg-white/20 text-white"
                : reminder.enabled
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                : "bg-[#E2E8F0] dark:bg-[#26262B] text-[#64748B] dark:text-[#A1A1AA]"
            }`}
          >
            {reminder.enabled ? "ON" : "OFF"}
          </span>
        </button>
      </div>

      {/* ABA: CONFIGURAÇÕES DE HIDRATAÇÃO */}
      {activeSubTab === "hidratacao" && (
        <div role="tabpanel" aria-label="Configurações de Hidratação" className="space-y-6">
          {/* Status Geral & Meta Diária */}
          <section className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none p-5 sm:p-6 space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3.5">
                <div className="w-11 h-11 rounded-2xl bg-[#FF6B00]/12 dark:bg-[#FF6B00]/15 border border-[#FF6B00]/30 flex items-center justify-center shrink-0">
                  <Droplets className="w-5 h-5 text-[#FF6B00]" />
                </div>
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-lg font-extrabold text-[#0F172A] dark:text-white">
                      Configurações de Hidratação
                    </h2>
                    <span
                      className={`px-2.5 py-0.5 rounded-md text-[11px] font-bold ${
                        reminder.enabled
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                          : "bg-[#F1F5F9] dark:bg-[#1C1C21] text-[#64748B] dark:text-[#A1A1AA]"
                      }`}
                    >
                      {reminder.enabled ? "Lembretes Ativos" : "Lembretes Pausados"}
                    </span>
                  </div>
                  <p className="mt-0.5 text-xs text-[#475569] dark:text-[#A1A1AA]">
                    Personalize seus horários, frequência e alertas. As alterações são salvas automaticamente e sincronizadas com o Dashboard.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    const nextEnabled = !reminder.enabled;
                    onUpdateWaterReminder({
                      enabled: nextEnabled,
                      lastRemindedAt: Date.now(),
                    });
                    onToast(
                      nextEnabled
                        ? "Lembretes de hidratação ativados!"
                        : "Lembretes de hidratação pausados.",
                      nextEnabled ? "success" : "info"
                    );
                  }}
                  className={`min-h-[42px] px-4 rounded-xl text-xs font-bold border flex items-center gap-2 transition-colors cursor-pointer ${
                    reminder.enabled
                      ? "bg-[#FF6B00] border-[#FF6B00] text-white hover:bg-[#F97316]"
                      : "bg-[#F8FAFC] dark:bg-[#0B0B0D] border-[#E2E8F0] dark:border-[#26262B] text-[#0F172A] dark:text-white hover:border-[#FF6B00]"
                  }`}
                >
                  {reminder.enabled ? (
                    <>
                      <Bell className="w-4 h-4" />
                      <span>Lembrete Ligado</span>
                    </>
                  ) : (
                    <>
                      <BellOff className="w-4 h-4" />
                      <span>Ativar Lembretes</span>
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={onTriggerWaterReminderTest}
                  className="min-h-[42px] px-4 rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] hover:bg-[#F1F5F9] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00]/60 text-xs font-semibold text-[#0F172A] dark:text-white flex items-center gap-2 transition-colors cursor-pointer"
                >
                  <Bell className="w-4 h-4 text-[#FF6B00]" />
                  <span>Testar Alerta</span>
                </button>
              </div>
            </div>

            {/* Resumo Dinâmico da Rotina de Hidratação */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
              <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] p-4">
                <span className="text-xs text-[#475569] dark:text-[#A1A1AA]">
                  Meta diária calculada
                </span>
                <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#FF6B00]">
                  {(metabolism.waterTargetMl / 1000).toFixed(2)}{" "}
                  <span className="text-xs font-normal text-[#475569] dark:text-[#A1A1AA]">
                    L/dia
                  </span>
                </p>
                <p className="mt-1 text-[11px] text-[#64748B] dark:text-[#71717A]">
                  Hoje: {state.water.consumedMl} ml ({hydrationPlanStats.consumedPct}%)
                </p>
              </div>

              <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] p-4">
                <span className="text-xs text-[#475569] dark:text-[#A1A1AA]">
                  Janela de lembretes
                </span>
                <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#0F172A] dark:text-white">
                  {String(reminder.startHour).padStart(2, "0")}h –{" "}
                  {String(reminder.endHour).padStart(2, "0")}h
                </p>
                <p className="mt-1 text-[11px] text-[#64748B] dark:text-[#71717A]">
                  {hydrationPlanStats.activeHours}h ativas · pausa noturna automática
                </p>
              </div>

              <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] p-4">
                <span className="text-xs text-[#475569] dark:text-[#A1A1AA]">
                  Ritmo sugerido por alerta
                </span>
                <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#0F172A] dark:text-white">
                  ~{hydrationPlanStats.mlPerReminder}{" "}
                  <span className="text-xs font-normal text-[#475569] dark:text-[#A1A1AA]">
                    ml/dose
                  </span>
                </p>
                <p className="mt-1 text-[11px] text-[#64748B] dark:text-[#71717A]">
                  ~{hydrationPlanStats.remindersPerDay} lembretes/dia a cada{" "}
                  {reminder.intervalMin} min
                </p>
              </div>
            </div>
          </section>

          {/* Horários de Início e Término */}
          <section className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none p-5 sm:p-6 space-y-5">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#FF6B00]" />
              <div>
                <h3 className="text-base font-bold text-[#0F172A] dark:text-white">
                  Horários de Início e Término
                </h3>
                <p className="text-xs text-[#475569] dark:text-[#A1A1AA]">
                  Defina em qual faixa do dia os lembretes podem ser disparados para respeitar seu descanso.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] p-4 space-y-2">
                <label
                  htmlFor="profile-water-start-hour"
                  className="block text-xs font-bold text-[#334155] dark:text-[#E4E4E7]"
                >
                  Horário de início dos lembretes
                </label>
                <select
                  id="profile-water-start-hour"
                  value={reminder.startHour}
                  onChange={(e) => {
                    const nextStart = Number(e.target.value);
                    const nextEnd = Math.max(nextStart + 1, reminder.endHour);
                    onUpdateWaterReminder({
                      startHour: nextStart,
                      endHour: nextEnd,
                    });
                    onToast(
                      `Janela de hidratação ajustada: ${String(nextStart).padStart(
                        2,
                        "0"
                      )}:00 às ${String(nextEnd).padStart(2, "0")}:00.`,
                      "info"
                    );
                  }}
                  className="w-full min-h-[44px] rounded-xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3.5 font-mono text-sm font-bold text-[#0F172A] dark:text-white"
                >
                  {Array.from({ length: 18 }, (_, i) => i + 5).map((h) => (
                    <option key={h} value={h}>
                      {String(h).padStart(2, "0")}:00
                    </option>
                  ))}
                </select>
                <p className="text-[11px] text-[#64748B] dark:text-[#A1A1AA]">
                  Primeiro lembrete após você acordar.
                </p>
              </div>

              <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] p-4 space-y-2">
                <label
                  htmlFor="profile-water-end-hour"
                  className="block text-xs font-bold text-[#334155] dark:text-[#E4E4E7]"
                >
                  Horário de término (pausa noturna)
                </label>
                <select
                  id="profile-water-end-hour"
                  value={reminder.endHour}
                  onChange={(e) => {
                    const nextEnd = Number(e.target.value);
                    onUpdateWaterReminder({ endHour: nextEnd });
                    onToast(
                      `Pausa noturna definida a partir das ${String(nextEnd).padStart(
                        2,
                        "0"
                      )}:00.`,
                      "info"
                    );
                  }}
                  className="w-full min-h-[44px] rounded-xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3.5 font-mono text-sm font-bold text-[#0F172A] dark:text-white"
                >
                  {Array.from({ length: 18 }, (_, i) => i + 6)
                    .filter((h) => h > reminder.startHour)
                    .map((h) => (
                      <option key={h} value={h}>
                        {String(h).padStart(2, "0")}:00
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-[#64748B] dark:text-[#A1A1AA]">
                  Nenhum alerta será disparado após este horário.
                </p>
              </div>
            </div>

            {/* Visual 24h Window Bar */}
            <div className="space-y-1.5 pt-1">
              <div className="relative h-3 w-full rounded-full bg-[#E2E8F0] dark:bg-[#0B0B0D] overflow-hidden border border-[#E2E8F0] dark:border-[#26262B]">
                <div
                  style={{
                    left: `${hydrationPlanStats.windowStartPct}%`,
                    width: `${hydrationPlanStats.windowWidthPct}%`,
                  }}
                  className="absolute inset-y-0 rounded-full bg-gradient-to-r from-[#FF6B00] to-[#F97316]"
                />
              </div>
              <div className="flex items-center justify-between text-[10px] font-mono text-[#64748B] dark:text-[#71717A] tabular-nums">
                <span>00:00</span>
                <span>06:00</span>
                <span>12:00</span>
                <span>18:00</span>
                <span>24:00</span>
              </div>
            </div>
          </section>

          {/* Intervalo do Lembrete */}
          <section className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none p-5 sm:p-6 space-y-4">
            <div className="flex items-center gap-2">
              <Bell className="w-4 h-4 text-[#FF6B00]" />
              <div>
                <h3 className="text-base font-bold text-[#0F172A] dark:text-white">
                  Intervalo do Lembrete
                </h3>
                <p className="text-xs text-[#475569] dark:text-[#A1A1AA]">
                  Escolha de quanto em quanto tempo deseja ser avisado para beber água.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
              {WATER_REMINDER_INTERVALS.map((opt) => {
                const active = reminder.intervalMin === opt.value;
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => {
                      onUpdateWaterReminder({
                        enabled: true,
                        intervalMin: opt.value,
                        lastRemindedAt: Date.now(),
                      });
                      onToast(
                        `Intervalo do lembrete atualizado para cada ${opt.label}!`,
                        "success"
                      );
                    }}
                    className={`rounded-xl p-3.5 text-left border transition-all cursor-pointer ${
                      active
                        ? "bg-[#FF6B00]/12 dark:bg-[#FF6B00]/15 border-[#FF6B00] ring-1 ring-[#FF6B00]/40"
                        : "bg-[#F8FAFC] dark:bg-[#0B0B0D] border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00]/50"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span
                        className={`font-mono text-base font-extrabold ${
                          active ? "text-[#FF6B00]" : "text-[#0F172A] dark:text-white"
                        }`}
                      >
                        {opt.label}
                      </span>
                      {active && (
                        <CheckCircle2 className="w-4 h-4 text-[#FF6B00] shrink-0" />
                      )}
                    </div>
                    <p className="mt-1 text-[11px] text-[#64748B] dark:text-[#A1A1AA]">
                      {opt.hint}
                    </p>
                  </button>
                );
              })}
            </div>
          </section>

          {/* Canais de Alerta: Sons e Notificações do Navegador */}
          <section className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none p-5 sm:p-6 space-y-4">
            <div>
              <h3 className="text-base font-bold text-[#0F172A] dark:text-white">
                Alertas: Sons e Notificações do Navegador
              </h3>
              <p className="text-xs text-[#475569] dark:text-[#A1A1AA] mt-0.5">
                Selecione como deseja receber cada lembrete de hidratação.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Sound Toggle Card */}
              <button
                type="button"
                onClick={() => {
                  const nextSound = !reminder.soundEnabled;
                  onUpdateWaterReminder({ soundEnabled: nextSound });
                  onToast(
                    nextSound
                      ? "Aviso sonoro ativado para lembretes de água!"
                      : "Aviso sonoro silenciado.",
                    "info"
                  );
                }}
                className={`rounded-xl p-4 text-left border flex items-start justify-between gap-4 transition-all cursor-pointer ${
                  reminder.soundEnabled
                    ? "bg-[#FF6B00]/8 dark:bg-[#FF6B00]/12 border-[#FF6B00]/50"
                    : "bg-[#F8FAFC] dark:bg-[#0B0B0D] border-[#E2E8F0] dark:border-[#26262B] hover:border-[#CBD5E1] dark:hover:border-[#3A3A42]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      reminder.soundEnabled
                        ? "bg-[#FF6B00] text-white"
                        : "bg-[#E2E8F0] dark:bg-[#1C1C21] text-[#64748B] dark:text-[#A1A1AA]"
                    }`}
                  >
                    {reminder.soundEnabled ? (
                      <Volume2 className="w-5 h-5" />
                    ) : (
                      <VolumeX className="w-5 h-5" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#0F172A] dark:text-white">
                      Aviso Sonoro Suave
                    </p>
                    <p className="mt-0.5 text-xs text-[#475569] dark:text-[#A1A1AA] leading-relaxed">
                      Reproduz um toque suave de gota d'água sempre que chegar o horário do lembrete.
                    </p>
                  </div>
                </div>

                <span
                  className={`px-2.5 py-1 rounded-lg font-mono text-xs font-extrabold shrink-0 ${
                    reminder.soundEnabled
                      ? "bg-[#FF6B00] text-white"
                      : "bg-[#E2E8F0] dark:bg-[#26262B] text-[#64748B] dark:text-[#A1A1AA]"
                  }`}
                >
                  {reminder.soundEnabled ? "ATIVADO" : "DESLIGADO"}
                </span>
              </button>

              {/* Browser Notifications Toggle Card */}
              <button
                type="button"
                onClick={() => void handleToggleBrowserNotifications()}
                className={`rounded-xl p-4 text-left border flex items-start justify-between gap-4 transition-all cursor-pointer ${
                  reminder.browserNotificationEnabled
                    ? "bg-emerald-500/8 dark:bg-emerald-500/12 border-emerald-500/50"
                    : "bg-[#F8FAFC] dark:bg-[#0B0B0D] border-[#E2E8F0] dark:border-[#26262B] hover:border-[#CBD5E1] dark:hover:border-[#3A3A42]"
                }`}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${
                      reminder.browserNotificationEnabled
                        ? "bg-emerald-500 text-white"
                        : "bg-[#E2E8F0] dark:bg-[#1C1C21] text-[#64748B] dark:text-[#A1A1AA]"
                    }`}
                  >
                    <Bell className="w-5 h-5" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-[#0F172A] dark:text-white">
                      Notificações do Navegador
                    </p>
                    <p className="mt-0.5 text-xs text-[#475569] dark:text-[#A1A1AA] leading-relaxed">
                      Envia um alerta nativo no dispositivo mesmo quando você estiver em outra aba.
                    </p>
                    <p className="mt-1.5 text-[11px] font-mono text-[#64748B] dark:text-[#A1A1AA]">
                      Status:{" "}
                      {browserPermission === "granted"
                        ? "Permissão concedida"
                        : browserPermission === "denied"
                        ? "Bloqueado no navegador"
                        : browserPermission === "unsupported"
                        ? "Indisponível neste navegador"
                        : "Aguardando permissão"}
                    </p>
                  </div>
                </div>

                <span
                  className={`px-2.5 py-1 rounded-lg font-mono text-xs font-extrabold shrink-0 ${
                    reminder.browserNotificationEnabled
                      ? "bg-emerald-500 text-white"
                      : "bg-[#E2E8F0] dark:bg-[#26262B] text-[#64748B] dark:text-[#A1A1AA]"
                  }`}
                >
                  {reminder.browserNotificationEnabled ? "ATIVADO" : "DESLIGADO"}
                </span>
              </button>
            </div>
          </section>
        </div>
      )}

      {/* ABA: PERFIL & AVALIAÇÃO FÍSICA */}
      {activeSubTab === "geral" && (
        <div role="tabpanel" aria-label="Perfil e Avaliação Física" className="space-y-6">
      {/* 1B. APARÊNCIA & TEMA */}
      <section
        aria-label="Aparência e tema do aplicativo"
        className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none p-5 sm:p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
      >
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <SunMoon className="w-4 h-4 text-[#FF6B00]" />
            <h2 className="text-base sm:text-lg font-bold text-[#0F172A] dark:text-white">
              Aparência do Aplicativo
            </h2>
          </div>
          <p className="text-xs text-[#475569] dark:text-[#A1A1AA]">
            Escolha entre o modo claro ou escuro. Sua preferência fica salva automaticamente neste dispositivo.
          </p>
        </div>

        <div className="w-full sm:w-auto sm:min-w-[260px] space-y-1.5 shrink-0">
          <span className="block text-[11px] font-semibold uppercase tracking-wider text-[#64748B] dark:text-[#A1A1AA]">
            Tema: Claro | Escuro
          </span>
          <ThemeSegmentedControl />
        </div>
      </section>

      {/* 2. CARD DE RESUMO CORPORAL (PESO, META, FALTAM KG, ALTURA, IMC) */}
      <section
        aria-label="Resumo corporal"
        className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none p-5 sm:p-6 space-y-5"
      >
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-bold text-[#0F172A] dark:text-white">Resumo Corporal & IMC</h2>
            <p className="text-xs text-[#475569] dark:text-[#A1A1AA]">
              Cálculo automático com base no seu perfil e avaliação mais recente
            </p>
          </div>
          <span
            className={`px-3 py-1 rounded-lg border text-xs font-semibold ${bmiBadgeClasses}`}
          >
            IMC {metabolism.bmi.toFixed(1)} · {metabolism.bmiLabel}
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3.5">
          <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] p-4">
            <span className="text-xs text-[#475569] dark:text-[#A1A1AA]">Peso atual</span>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#0F172A] dark:text-white">
              {profile.weightKg.toFixed(1)}{" "}
              <span className="text-xs font-normal text-[#475569] dark:text-[#A1A1AA]">kg</span>
            </p>
          </div>

          <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] p-4">
            <span className="text-xs text-[#475569] dark:text-[#A1A1AA]">Peso meta</span>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#FF6B00]">
              {profile.targetWeightKg.toFixed(1)}{" "}
              <span className="text-xs font-normal text-[#EA580C] dark:text-orange-300/80">kg</span>
            </p>
          </div>

          <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] p-4">
            <span className="text-xs text-[#475569] dark:text-[#A1A1AA]">Para atingir a meta</span>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#0F172A] dark:text-white">
              {absWeightDiff <= 0.2 ? (
                <span className="text-emerald-600 dark:text-emerald-400 text-lg font-sans font-bold">
                  Meta atingida!
                </span>
              ) : (
                <>
                  {absWeightDiff.toFixed(1)}{" "}
                  <span className="text-xs font-normal text-[#475569] dark:text-[#A1A1AA]">
                    kg ({weightDiff > 0 ? "a perder" : "a ganhar"})
                  </span>
                </>
              )}
            </p>
          </div>

          <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] p-4">
            <span className="text-xs text-[#475569] dark:text-[#A1A1AA]">Altura</span>
            <p className="mt-1 font-mono text-2xl font-bold tabular-nums text-[#0F172A] dark:text-white">
              {profile.heightCm}{" "}
              <span className="text-xs font-normal text-[#475569] dark:text-[#A1A1AA]">cm</span>
            </p>
          </div>
        </div>

        {/* Visual BMI Scale Bar */}
        <div className="pt-2 space-y-2">
          <div className="relative h-2.5 rounded-full overflow-hidden grid grid-cols-4 bg-[#E2E8F0] dark:bg-[#0B0B0D]">
            <div className="bg-sky-500/75" />
            <div className="bg-emerald-500/80" />
            <div className="bg-amber-500/80" />
            <div className="bg-red-500/80" />
            <div
              aria-hidden="true"
              style={{ left: `${bmiMarkerPct}%` }}
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white border-2 border-[#0F172A] dark:border-[#0B0B0D] shadow"
            />
          </div>
          <div className="grid grid-cols-4 text-[10px] sm:text-[11px] text-[#475569] dark:text-[#A1A1AA] font-mono tabular-nums">
            <span>&lt;18.5 Abaixo</span>
            <span className="text-center">18.5–24.9 Saudável</span>
            <span className="text-center">25–29.9 Sobrepeso</span>
            <span className="text-right">30+ Obesidade</span>
          </div>
        </div>

        {/* Quick Metabolic Strip */}
        <div className="pt-4 border-t border-[#E2E8F0] dark:border-[#26262B] flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-[#475569] dark:text-[#A1A1AA]">
          <span className="inline-flex items-center gap-1.5">
            <Flame className="w-3.5 h-3.5 text-[#FF6B00]" />
            TMB <strong className="font-mono text-[#0F172A] dark:text-white tabular-nums">{metabolism.tmb} kcal</strong>
          </span>
          <span>
            GET <strong className="font-mono text-[#0F172A] dark:text-white tabular-nums">{metabolism.get} kcal</strong>
          </span>
          <span>
            Meta{" "}
            <strong className="font-mono text-[#FF6B00] tabular-nums">
              {metabolism.calorieTarget} kcal
            </strong>
          </span>
          <span>
            Proteína{" "}
            <strong className="font-mono text-[#0F172A] dark:text-white tabular-nums">
              {metabolism.proteinG}g/dia
            </strong>
          </span>
          <span>
            Água{" "}
            <strong className="font-mono text-[#0F172A] dark:text-white tabular-nums">
              {(metabolism.waterTargetMl / 1000).toFixed(2)} L/dia
            </strong>
          </span>
        </div>
      </section>

      {/* 3. FORMULÁRIO COMPLETO DE DADOS PESSOAIS */}
      <section
        aria-label="Dados pessoais editáveis"
        className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none p-5 sm:p-6"
      >
        <div className="flex items-center gap-2 mb-4">
          <UserIcon className="w-4 h-4 text-[#FF6B00]" />
          <h2 className="text-lg font-bold text-[#0F172A] dark:text-white">Dados Pessoais & Rotina</h2>
        </div>

        <form onSubmit={handleSavePersonal} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="sm:col-span-2 lg:col-span-1">
              <label htmlFor="pf-name" className="block text-xs text-[#475569] dark:text-[#A1A1AA] mb-1">
                Nome completo
              </label>
              <input
                id="pf-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full min-h-[44px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3.5 text-sm font-medium text-[#0F172A] dark:text-white"
              />
            </div>

            <div>
              <span className="block text-xs text-[#475569] dark:text-[#A1A1AA] mb-1">Sexo</span>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { id: "M", label: "Masculino" },
                    { id: "F", label: "Feminino" },
                  ] as const
                ).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setSex(opt.id)}
                    className={`min-h-[44px] rounded-xl text-xs font-semibold border transition-colors cursor-pointer ${
                      sex === opt.id
                        ? "bg-[#FF6B00] border-[#FF6B00] text-white"
                        : "bg-[#F8FAFC] dark:bg-[#0B0B0D] border-[#E2E8F0] dark:border-[#26262B] text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white"
                    }`}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label htmlFor="pf-age" className="block text-xs text-[#475569] dark:text-[#A1A1AA] mb-1">
                Idade (anos)
              </label>
              <input
                id="pf-age"
                type="number"
                min={14}
                max={100}
                required
                value={age}
                onChange={(e) => setAge(e.target.value)}
                className="w-full min-h-[44px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3.5 font-mono text-sm font-semibold tabular-nums text-[#0F172A] dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="pf-height" className="block text-xs text-[#475569] dark:text-[#A1A1AA] mb-1">
                Altura (cm)
              </label>
              <input
                id="pf-height"
                type="number"
                min={120}
                max={230}
                required
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                className="w-full min-h-[44px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3.5 font-mono text-sm font-semibold tabular-nums text-[#0F172A] dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="pf-weight" className="block text-xs text-[#475569] dark:text-[#A1A1AA] mb-1">
                Peso Atual (kg)
              </label>
              <input
                id="pf-weight"
                type="number"
                step="0.1"
                min={35}
                max={250}
                required
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                className="w-full min-h-[44px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3.5 font-mono text-sm font-semibold tabular-nums text-[#0F172A] dark:text-white"
              />
            </div>

            <div>
              <label htmlFor="pf-target" className="block text-xs text-[#475569] dark:text-[#A1A1AA] mb-1">
                Peso Meta (kg)
              </label>
              <input
                id="pf-target"
                type="number"
                step="0.1"
                min={35}
                max={250}
                required
                value={targetWeightKg}
                onChange={(e) => setTargetWeightKg(e.target.value)}
                className="w-full min-h-[44px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3.5 font-mono text-sm font-semibold tabular-nums text-[#0F172A] dark:text-white"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
            <div>
              <span className="block text-xs text-[#475569] dark:text-[#A1A1AA] mb-1.5">Nível na academia</span>
              <div className="grid grid-cols-3 gap-1.5">
                {LEVEL_OPTIONS.map((lvl) => (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setLevel(lvl)}
                    className={`min-h-[44px] px-2 rounded-xl text-xs font-semibold border transition-colors cursor-pointer truncate ${
                      level === lvl
                        ? "bg-[#FF6B00] border-[#FF6B00] text-white"
                        : "bg-[#F8FAFC] dark:bg-[#0B0B0D] border-[#E2E8F0] dark:border-[#26262B] text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white"
                    }`}
                  >
                    {lvl}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="block text-xs text-[#475569] dark:text-[#A1A1AA] mb-1.5">Frequência semanal</span>
              <div className="grid grid-cols-4 gap-1.5">
                {FREQUENCY_OPTIONS.map((freq) => (
                  <button
                    key={freq}
                    type="button"
                    onClick={() => setWeeklyFrequency(freq)}
                    className={`min-h-[44px] rounded-xl font-mono text-xs font-semibold tabular-nums border transition-colors cursor-pointer ${
                      weeklyFrequency === freq
                        ? "bg-[#FF6B00] border-[#FF6B00] text-white"
                        : "bg-[#F8FAFC] dark:bg-[#0B0B0D] border-[#E2E8F0] dark:border-[#26262B] text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white"
                    }`}
                  >
                    {freq}x
                  </button>
                ))}
              </div>
            </div>

            <div>
              <span className="block text-xs text-[#475569] dark:text-[#A1A1AA] mb-1.5">Tempo por treino</span>
              <div className="grid grid-cols-4 gap-1.5">
                {TIME_OPTIONS.map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setAvailableTime(mins)}
                    className={`min-h-[44px] rounded-xl font-mono text-xs font-semibold tabular-nums border transition-colors cursor-pointer ${
                      availableTime === mins
                        ? "bg-[#FF6B00] border-[#FF6B00] text-white"
                        : "bg-[#F8FAFC] dark:bg-[#0B0B0D] border-[#E2E8F0] dark:border-[#26262B] text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white"
                    }`}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>
          </div>

          {profileError && (
            <div
              role="alert"
              className="rounded-xl bg-red-500/10 border border-red-500/40 px-4 py-2.5 text-xs text-red-700 dark:text-red-200"
            >
              {profileError}
            </div>
          )}

          <div className="pt-2 flex justify-end">
            <button
              type="submit"
              className="min-h-[46px] px-6 rounded-xl bg-[#FF6B00] hover:bg-[#F97316] active:scale-[0.98] text-sm font-bold text-white flex items-center gap-2 transition-all cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Salvar Dados do Perfil</span>
            </button>
          </div>
        </form>
      </section>

      {/* 4. SEÇÃO DE MEDIDAS CORPORAIS COMPLETAS (10 PONTOS) */}
      <section
        aria-label="Avaliação física e medidas corporais"
        className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none p-5 sm:p-6 space-y-5"
      >
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-[#0F172A] dark:text-white flex items-center gap-2">
              <Ruler className="w-4 h-4 text-[#FF6B00]" />
              <span>Avaliação Física — Medidas Corporais (cm)</span>
            </h2>
            <p className="text-xs text-[#475569] dark:text-[#A1A1AA] mt-0.5">
              Registre suas circunferências para acompanhar a definição real e alimentar os gráficos de Evolução e as IAs.
            </p>
          </div>
          {latestMeasurement && (
            <span className="text-xs font-mono text-[#475569] dark:text-[#A1A1AA] tabular-nums">
              Última avaliação: {latestMeasurement.date.split("-").reverse().join("/")}
            </span>
          )}
        </div>

        <form onSubmit={handleSaveEvaluation} className="space-y-4">
          {/* Weight of this assessment */}
          <div className="max-w-xs">
            <label htmlFor="eval-weight" className="block text-xs text-[#475569] dark:text-[#A1A1AA] mb-1">
              Peso na avaliação de hoje (kg) *
            </label>
            <input
              id="eval-weight"
              type="number"
              step="0.1"
              min={30}
              max={300}
              required
              value={evalWeightKg}
              onChange={(e) => setEvalWeightKg(e.target.value)}
              className="w-full min-h-[44px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3.5 font-mono text-sm font-bold tabular-nums text-[#0F172A] dark:text-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
            {MEASUREMENT_FIELDS.map((field) => {
              const latestVal = readMeasureValue(latestMeasurement, field);
              const prevVal = readMeasureValue(previousMeasurement, field);
              const delta =
                latestVal !== undefined && prevVal !== undefined
                  ? Number((latestVal - prevVal).toFixed(1))
                  : null;

              return (
                <div
                  key={field.key}
                  className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] p-3 space-y-1.5"
                >
                  <div className="flex items-center justify-between gap-1">
                    <label
                      htmlFor={`measure-${field.key}`}
                      className="text-xs font-medium text-[#334155] dark:text-[#D4D4D8] truncate"
                    >
                      {field.label}
                    </label>
                    {delta !== null && (
                      <span
                        className={`font-mono text-[11px] font-semibold tabular-nums shrink-0 ${
                          delta === 0
                            ? "text-[#64748B] dark:text-[#A1A1AA]"
                            : delta < 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-[#FF6B00]"
                        }`}
                      >
                        {delta > 0 ? `+${delta}` : delta} cm
                      </span>
                    )}
                  </div>

                  <input
                    id={`measure-${field.key}`}
                    type="number"
                    step="0.1"
                    min={0}
                    value={measures[field.key]}
                    onChange={(e) =>
                      setMeasures((prev) => ({
                        ...prev,
                        [field.key]: e.target.value,
                      }))
                    }
                    placeholder={field.placeholder}
                    className="w-full min-h-[40px] rounded-lg bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3 font-mono text-sm font-semibold tabular-nums text-[#0F172A] dark:text-white placeholder:text-[#94A3B8] dark:placeholder:text-[#52525B]"
                  />

                  <p className="text-[10px] font-mono tabular-nums text-[#64748B] dark:text-[#71717A]">
                    {latestVal !== undefined
                      ? `Último: ${latestVal} cm`
                      : "Sem registro ainda"}
                  </p>
                </div>
              );
            })}
          </div>

          {measureError && (
            <div
              role="alert"
              className="rounded-xl bg-red-500/10 border border-red-500/40 px-4 py-2.5 text-xs text-red-700 dark:text-red-200"
            >
              {measureError}
            </div>
          )}

          <div className="pt-2 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-[#475569] dark:text-[#A1A1AA]">
              A avaliação será registrada com a data de hoje (
              <span className="font-mono text-[#0F172A] dark:text-white">
                {getTodayIso().split("-").reverse().join("/")}
              </span>
              ) e comparada automaticamente com a medição anterior.
            </p>
            <button
              type="submit"
              className="min-h-[46px] px-6 rounded-xl bg-[#FF6B00] hover:bg-[#F97316] active:scale-[0.98] text-sm font-bold text-white flex items-center gap-2 transition-all cursor-pointer"
            >
              <Save className="w-4 h-4" />
              <span>Salvar Nova Avaliação</span>
            </button>
          </div>
        </form>
      </section>

      {/* 5. APLICATIVO & SEGURANÇA DOS DADOS */}
      <section
        aria-label="Segurança e dados do aplicativo"
        className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none p-5 sm:p-6 space-y-4"
      >
        <div className="flex items-center gap-2">
          <ShieldAlert className="w-4 h-4 text-[#FF6B00]" />
          <h2 className="text-lg font-bold text-[#0F172A] dark:text-white">Segurança e Backup dos Dados</h2>
        </div>
        <p className="text-xs text-[#475569] dark:text-[#A1A1AA]">
          Exporte todo o seu histórico de perfil, medidas, cargas e treinos em formato JSON ou reinicie o aplicativo para um novo cadastro.
        </p>

        <div className="flex flex-wrap items-center gap-3">
          <PWAInstallButton />

          <button
            type="button"
            onClick={handleExport}
            className="min-h-[44px] px-4 rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] hover:bg-[#F1F5F9] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00]/60 text-xs font-semibold text-[#0F172A] dark:text-white flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Download className="w-4 h-4 text-[#FF6B00]" />
            <span>Exportar meus dados (JSON)</span>
          </button>

          <button
            type="button"
            onClick={() => setShowResetModal(true)}
            className="min-h-[44px] px-4 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/40 text-xs font-semibold text-red-700 dark:text-red-300 flex items-center gap-2 transition-colors cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            <span>Resetar dados</span>
          </button>

          {onSignOut && (
            <button
              type="button"
              disabled={authBusy}
              onClick={() => void onSignOut()}
              className="min-h-[44px] px-4 rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] hover:bg-[#F1F5F9] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00]/60 text-xs font-semibold text-[#0F172A] dark:text-white flex items-center gap-2 transition-colors cursor-pointer disabled:opacity-50"
            >
              <LogOut className="w-4 h-4 text-[#FF6B00]" />
              <span>Sair da Conta</span>
            </button>
          )}
        </div>
      </section>
        </div>
      )}

      {/* In-App Confirmation Modal for Reset */}
      {showResetModal && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="reset-modal-title"
          className="fixed inset-0 z-50 bg-black/70 dark:bg-black/80 backdrop-blur-sm flex items-center justify-center p-4"
          onClick={() => setShowResetModal(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-md rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-xl dark:shadow-none p-6 space-y-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-red-500/15 border border-red-500/40 flex items-center justify-center shrink-0">
                  <AlertTriangle className="w-5 h-5 text-red-600 dark:text-red-400" />
                </div>
                <div>
                  <h3 id="reset-modal-title" className="text-lg font-bold text-[#0F172A] dark:text-white">
                    Resetar todos os dados?
                  </h3>
                  <p className="text-xs text-[#475569] dark:text-[#A1A1AA]">Esta ação não pode ser desfeita</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                aria-label="Fechar"
                className="min-h-[36px] min-w-[36px] rounded-lg bg-[#F1F5F9] dark:bg-[#0B0B0D] text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <p className="text-sm text-[#334155] dark:text-[#D4D4D8] leading-relaxed">
              Seu perfil local, metas, medidas corporais, histórico de treinos e conversas serão limpos e você voltará para o Onboarding inicial. Recomendamos exportar seus dados em JSON antes.
            </p>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                type="button"
                onClick={() => setShowResetModal(false)}
                className="min-h-[44px] px-4 rounded-xl bg-[#F1F5F9] dark:bg-[#0B0B0D] hover:bg-[#E2E8F0] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] text-xs font-semibold text-[#0F172A] dark:text-white cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmReset}
                className="min-h-[44px] px-4 rounded-xl bg-red-600 hover:bg-red-500 text-xs font-bold text-white cursor-pointer"
              >
                Sim, resetar tudo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
