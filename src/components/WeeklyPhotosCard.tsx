import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  Columns2,
  Expand,
  ImagePlus,
  Plus,
  RefreshCw,
  Ruler,
  Save,
  ScanLine,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { getTodayIso } from "../hooks/useBiancoState";
import { BodyMeasurement, StudentProfile } from "../types";
import {
  AiBodyMeasurementsEstimate,
  compressProgressPhoto,
  deleteWeeklyPhotoRecord,
  loadWeeklyPhotoRecords,
  PhotoAngle,
  saveWeeklyPhotoRecord,
  WeeklyPhotoRecord,
} from "../utils/weeklyPhotoStorage";

interface WeeklyPhotosCardProps {
  profile: StudentProfile;
  measurements: BodyMeasurement[];
  currentWeightKg: number;
  onAddMeasurement: (entry: Omit<BodyMeasurement, "id">) => void;
  onToast: (message: string, tone?: "success" | "info" | "warning") => void;
}

const PHOTO_ANGLES: {
  key: PhotoAngle;
  label: string;
  poseHint: string;
}[] = [
  {
    key: "front",
    label: "Frente",
    poseHint: "Corpo inteiro de frente, braços soltos e boa luz frontal.",
  },
  {
    key: "side",
    label: "Lado",
    poseHint: "Perfil lateral alinhado para medir projeção da barriga e postura.",
  },
  {
    key: "back",
    label: "Costas",
    poseHint: "De costas com ombros neutros para avaliar dorsal, cintura e pernas.",
  },
];

interface CircumferenceField {
  key: keyof Pick<
    AiBodyMeasurementsEstimate,
    | "abdomenCm"
    | "waistCm"
    | "chestCm"
    | "hipCm"
    | "thighRightCm"
    | "thighLeftCm"
    | "calfCm"
    | "armRightCm"
    | "armLeftCm"
    | "neckCm"
  >;
  label: string;
  shortLabel: string;
  preferLower?: boolean;
}

const CIRCUMFERENCE_FIELDS: CircumferenceField[] = [
  { key: "abdomenCm", label: "Barriga (Abdômen)", shortLabel: "Barriga", preferLower: true },
  { key: "waistCm", label: "Cintura", shortLabel: "Cintura", preferLower: true },
  { key: "chestCm", label: "Peito / Tórax", shortLabel: "Peito" },
  { key: "hipCm", label: "Quadril / Glúteos", shortLabel: "Quadril" },
  { key: "thighRightCm", label: "Perna / Coxa Dir.", shortLabel: "Coxa D" },
  { key: "thighLeftCm", label: "Perna / Coxa Esq.", shortLabel: "Coxa E" },
  { key: "calfCm", label: "Panturrilha", shortLabel: "Panturrilha" },
  { key: "armRightCm", label: "Braço Direito", shortLabel: "Braço D" },
  { key: "armLeftCm", label: "Braço Esquerdo", shortLabel: "Braço E" },
  { key: "neckCm", label: "Pescoço", shortLabel: "Pescoço" },
];

function formatDateBr(isoDate?: string): string {
  if (!isoDate) return "—";
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}/${parts[0]}`;
}

function formatShortDateBr(isoDate?: string): string {
  if (!isoDate) return "—";
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  return `${parts[2]}/${parts[1]}`;
}

function countPhotos(record?: WeeklyPhotoRecord | null): number {
  if (!record) return 0;
  let count = 0;
  if (record.photos.front) count += 1;
  if (record.photos.side) count += 1;
  if (record.photos.back) count += 1;
  return count;
}

function createWeekRecord(
  weekNumber: number,
  currentWeightKg: number
): WeeklyPhotoRecord {
  return {
    id: `week_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    weekLabel: `Semana ${weekNumber}`,
    date: getTodayIso(),
    weightKg: Number.isFinite(currentWeightKg)
      ? Number(currentWeightKg.toFixed(1))
      : undefined,
    note: "",
    photos: {},
    photoDates: {},
    updatedAt: new Date().toISOString(),
  };
}

export const WeeklyPhotosCard: React.FC<WeeklyPhotosCardProps> = ({
  profile,
  measurements,
  currentWeightKg,
  onAddMeasurement,
  onToast,
}) => {
  const [records, setRecords] = useState<WeeklyPhotoRecord[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [uploadingAngle, setUploadingAngle] = useState<PhotoAngle | null>(null);
  const [dragOverAngle, setDragOverAngle] = useState<PhotoAngle | null>(null);
  const [justSavedDate, setJustSavedDate] = useState(false);

  // AI Body Circumference Analysis state
  const [isAnalyzingAi, setIsAnalyzingAi] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Lightbox modal state
  const [lightboxAngle, setLightboxAngle] = useState<PhotoAngle | null>(null);

  // Comparison mode state
  const [compareMode, setCompareMode] = useState(false);
  const [compareAngle, setCompareAngle] = useState<PhotoAngle>("front");
  const [compareBeforeId, setCompareBeforeId] = useState<string>("");
  const [compareAfterId, setCompareAfterId] = useState<string>("");

  const fileInputRefs = useRef<Record<PhotoAngle, HTMLInputElement | null>>({
    front: null,
    side: null,
    back: null,
  });

  useEffect(() => {
    let active = true;
    void loadWeeklyPhotoRecords().then((loaded) => {
      if (!active) return;
      if (loaded.length === 0) {
        const initial = createWeekRecord(1, currentWeightKg);
        setRecords([initial]);
        setSelectedId(initial.id);
      } else {
        setRecords(loaded);
        setSelectedId(loaded[0].id);
      }
      setIsLoaded(true);
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activeRecord = useMemo(() => {
    if (records.length === 0) return null;
    return records.find((r) => r.id === selectedId) || records[0];
  }, [records, selectedId]);

  const activePhotoCount = countPhotos(activeRecord);

  // Find the best previous baseline measurement (earlier photo record with AI measurements or earlier body measurement)
  const previousBaseline = useMemo(() => {
    if (!activeRecord) return null;

    const earlierPhotoRecord = records
      .filter(
        (r) =>
          r.id !== activeRecord.id &&
          r.aiMeasurements &&
          r.date <= activeRecord.date
      )
      .sort((a, b) => b.date.localeCompare(a.date))[0];

    if (earlierPhotoRecord?.aiMeasurements) {
      return {
        sourceLabel: `${earlierPhotoRecord.weekLabel} (${formatDateBr(
          earlierPhotoRecord.date
        )})`,
        date: earlierPhotoRecord.date,
        weightKg: earlierPhotoRecord.weightKg,
        neckCm: earlierPhotoRecord.aiMeasurements.neckCm,
        chestCm: earlierPhotoRecord.aiMeasurements.chestCm,
        waistCm: earlierPhotoRecord.aiMeasurements.waistCm,
        abdomenCm: earlierPhotoRecord.aiMeasurements.abdomenCm,
        hipCm: earlierPhotoRecord.aiMeasurements.hipCm,
        armRightCm: earlierPhotoRecord.aiMeasurements.armRightCm,
        armLeftCm: earlierPhotoRecord.aiMeasurements.armLeftCm,
        thighRightCm: earlierPhotoRecord.aiMeasurements.thighRightCm,
        thighLeftCm: earlierPhotoRecord.aiMeasurements.thighLeftCm,
        calfCm: earlierPhotoRecord.aiMeasurements.calfCm,
      };
    }

    const earlierManual = [...measurements]
      .filter((m) => m.date < activeRecord.date)
      .sort((a, b) => b.date.localeCompare(a.date))[0];

    if (earlierManual) {
      return {
        sourceLabel: `Avaliação de ${formatDateBr(earlierManual.date)}`,
        date: earlierManual.date,
        weightKg: earlierManual.weightKg,
        neckCm: earlierManual.neckCm,
        chestCm: earlierManual.chestCm,
        waistCm: earlierManual.waistCm,
        abdomenCm: earlierManual.abdomenCm,
        hipCm: earlierManual.hipCm,
        armRightCm: earlierManual.armRightCm ?? earlierManual.armCm,
        armLeftCm: earlierManual.armLeftCm,
        thighRightCm: earlierManual.thighRightCm ?? earlierManual.thighCm,
        thighLeftCm: earlierManual.thighLeftCm,
        calfCm: earlierManual.calfCm,
      };
    }

    return null;
  }, [activeRecord, records, measurements]);

  // Keep compare dropdown IDs synchronized when records change
  useEffect(() => {
    if (records.length < 2) {
      setCompareMode(false);
      return;
    }
    const oldest = records[records.length - 1];
    const newest = records[0];
    setCompareBeforeId((prev) =>
      records.some((r) => r.id === prev) ? prev : oldest.id
    );
    setCompareAfterId((prev) =>
      records.some((r) => r.id === prev) ? prev : newest.id
    );
  }, [records]);

  // Close lightbox on Escape key
  useEffect(() => {
    if (!lightboxAngle) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setLightboxAngle(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightboxAngle]);

  const persistUpdatedRecord = async (updated: WeeklyPhotoRecord) => {
    setRecords((prev) => {
      const exists = prev.some((r) => r.id === updated.id);
      const next = exists
        ? prev.map((r) => (r.id === updated.id ? updated : r))
        : [updated, ...prev];
      return [...next].sort(
        (a, b) =>
          b.date.localeCompare(a.date) || b.updatedAt.localeCompare(a.updatedAt)
      );
    });
    try {
      await saveWeeklyPhotoRecord(updated);
    } catch {
      onToast(
        "Não foi possível salvar no armazenamento do navegador. Tente reduzir o número de fotos.",
        "warning"
      );
    }
  };

  const handleUploadFile = async (angle: PhotoAngle, file?: File | null) => {
    if (!file || !activeRecord) return;
    setUploadingAngle(angle);
    setAiError(null);
    try {
      const compressedDataUrl = await compressProgressPhoto(file);
      const stampDate = activeRecord.date || getTodayIso();
      const updated: WeeklyPhotoRecord = {
        ...activeRecord,
        date: stampDate,
        photos: {
          ...activeRecord.photos,
          [angle]: compressedDataUrl,
        },
        photoDates: {
          ...(activeRecord.photoDates || {}),
          [angle]: stampDate,
        },
        updatedAt: new Date().toISOString(),
      };
      await persistUpdatedRecord(updated);

      const angleMeta = PHOTO_ANGLES.find((a) => a.key === angle);
      const totalNow = countPhotos(updated);
      onToast(
        totalNow === 3
          ? `Foto (${angleMeta?.label}) salva em ${formatDateBr(
              stampDate
            )}! Agora você pode medir todas as circunferências com IA.`
          : `Foto (${angleMeta?.label}) salva com data ${formatDateBr(
              stampDate
            )}!`,
        "success"
      );
    } catch (err) {
      onToast(
        err instanceof Error
          ? err.message
          : "Não foi possível carregar esta foto.",
        "warning"
      );
    } finally {
      setUploadingAngle(null);
      const inputEl = fileInputRefs.current[angle];
      if (inputEl) inputEl.value = "";
    }
  };

  const handleRemoveAnglePhoto = async (angle: PhotoAngle) => {
    if (!activeRecord) return;
    const nextPhotos = { ...activeRecord.photos };
    delete nextPhotos[angle];
    const nextDates = { ...(activeRecord.photoDates || {}) };
    delete nextDates[angle];
    const updated: WeeklyPhotoRecord = {
      ...activeRecord,
      photos: nextPhotos,
      photoDates: nextDates,
      updatedAt: new Date().toISOString(),
    };
    await persistUpdatedRecord(updated);
    if (lightboxAngle === angle) setLightboxAngle(null);
    const angleMeta = PHOTO_ANGLES.find((a) => a.key === angle);
    onToast(`Foto (${angleMeta?.label}) removida.`, "info");
  };

  const handleCreateNewWeek = async () => {
    const nextNum = records.length + 1;
    const fresh = createWeekRecord(nextNum, currentWeightKg);
    setSelectedId(fresh.id);
    setCompareMode(false);
    setAiError(null);
    await persistUpdatedRecord(fresh);
    onToast(
      `Cartão "${fresh.weekLabel}" (${formatDateBr(
        fresh.date
      )}) criado! Adicione Frente, Lado e Costas.`,
      "success"
    );
  };

  const handleDeleteCurrentWeek = async () => {
    if (!activeRecord) return;
    const targetId = activeRecord.id;
    const label = activeRecord.weekLabel;
    const remaining = records.filter((r) => r.id !== targetId);

    try {
      await deleteWeeklyPhotoRecord(targetId);
    } catch {
      // Continue updating UI state cleanly
    }

    if (remaining.length === 0) {
      const resetRecord = createWeekRecord(1, currentWeightKg);
      setRecords([resetRecord]);
      setSelectedId(resetRecord.id);
    } else {
      setRecords(remaining);
      setSelectedId(remaining[0].id);
    }
    setAiError(null);
    onToast(`Registro "${label}" removido.`, "info");
  };

  const handleUpdateMeta = (
    patch: Partial<
      Pick<WeeklyPhotoRecord, "weekLabel" | "date" | "weightKg" | "note">
    >
  ) => {
    if (!activeRecord) return;
    const updatedPhotoDates =
      patch.date && activeRecord.photos
        ? {
            ...(activeRecord.photos.front ? { front: patch.date } : {}),
            ...(activeRecord.photos.side ? { side: patch.date } : {}),
            ...(activeRecord.photos.back ? { back: patch.date } : {}),
          }
        : activeRecord.photoDates;

    const updated: WeeklyPhotoRecord = {
      ...activeRecord,
      ...patch,
      photoDates: updatedPhotoDates,
      updatedAt: new Date().toISOString(),
    };
    void persistUpdatedRecord(updated);
  };

  const handleConfirmSaveDateAndMeta = async () => {
    if (!activeRecord) return;
    const stamp = activeRecord.date || getTodayIso();
    const updated: WeeklyPhotoRecord = {
      ...activeRecord,
      date: stamp,
      photoDates: {
        ...(activeRecord.photos.front ? { front: stamp } : {}),
        ...(activeRecord.photos.side ? { side: stamp } : {}),
        ...(activeRecord.photos.back ? { back: stamp } : {}),
      },
      updatedAt: new Date().toISOString(),
    };
    await persistUpdatedRecord(updated);
    setJustSavedDate(true);
    onToast(
      `Data (${formatDateBr(stamp)}) e dados de "${updated.weekLabel}" salvos na evolução!`,
      "success"
    );
    window.setTimeout(() => setJustSavedDate(false), 2200);
  };

  const handleMeasureWithAi = async () => {
    if (!activeRecord || isAnalyzingAi) return;
    if (activePhotoCount === 0) {
      onToast(
        "Adicione pelo menos 1 foto (ideal: Frente, Lado e Costas) para a IA medir suas circunferências.",
        "warning"
      );
      return;
    }

    setIsAnalyzingAi(true);
    setAiError(null);

    try {
      const response = await fetch("/api/ai/body-measurements", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          photos: activeRecord.photos,
          photoDate: activeRecord.date,
          profile: {
            name: profile.name,
            sex: profile.sex,
            age: profile.age,
            heightCm: profile.heightCm,
            weightKg: activeRecord.weightKg ?? currentWeightKg,
          },
          previousMeasurements: previousBaseline,
        }),
      });

      const data = (await response.json()) as Partial<AiBodyMeasurementsEstimate> & {
        error?: string;
      };

      if (!response.ok || data.error) {
        throw new Error(
          data.error ||
            "Não foi possível calcular as medidas pelas fotos agora. Tente novamente."
        );
      }

      const estimate: AiBodyMeasurementsEstimate = {
        analyzedAt: new Date().toISOString(),
        anglesAnalyzed: Array.isArray(data.anglesAnalyzed)
          ? data.anglesAnalyzed
          : (Object.keys(activeRecord.photos) as PhotoAngle[]),
        neckCm: Number(data.neckCm) || 37,
        chestCm: Number(data.chestCm) || 98,
        waistCm: Number(data.waistCm) || 82,
        abdomenCm: Number(data.abdomenCm) || 86,
        hipCm: Number(data.hipCm) || 98,
        armRightCm: Number(data.armRightCm) || 34,
        armLeftCm: Number(data.armLeftCm) || 33.8,
        thighRightCm: Number(data.thighRightCm) || 56,
        thighLeftCm: Number(data.thighLeftCm) || 55.8,
        calfCm: Number(data.calfCm) || 37,
        estimatedBodyFatPct:
          typeof data.estimatedBodyFatPct === "number"
            ? data.estimatedBodyFatPct
            : undefined,
        confidence: data.confidence || "media",
        visualSummary:
          data.visualSummary ||
          "Análise corporal estimada com base nas suas fotos e proporções.",
        evolutionNote: data.evolutionNote,
        photoTip: data.photoTip,
      };

      const updated: WeeklyPhotoRecord = {
        ...activeRecord,
        aiMeasurements: estimate,
        updatedAt: new Date().toISOString(),
      };
      await persistUpdatedRecord(updated);
      onToast(
        `IA estimou todas as 10 circunferências para ${formatDateBr(
          activeRecord.date
        )}!`,
        "success"
      );
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Erro ao analisar as fotos com a IA.";
      setAiError(msg);
      onToast(msg, "warning");
    } finally {
      setIsAnalyzingAi(false);
    }
  };

  const handleSaveAiMeasurementsToEvolution = async () => {
    if (!activeRecord?.aiMeasurements) return;
    const est = activeRecord.aiMeasurements;
    const targetWeight = activeRecord.weightKg ?? currentWeightKg;

    onAddMeasurement({
      date: activeRecord.date || getTodayIso(),
      weightKg: Number(targetWeight.toFixed(1)),
      neckCm: est.neckCm,
      chestCm: est.chestCm,
      waistCm: est.waistCm,
      abdomenCm: est.abdomenCm,
      hipCm: est.hipCm,
      armRightCm: est.armRightCm,
      armLeftCm: est.armLeftCm,
      armCm: est.armRightCm,
      thighRightCm: est.thighRightCm,
      thighLeftCm: est.thighLeftCm,
      thighCm: est.thighRightCm,
      calfCm: est.calfCm,
    });

    const updated: WeeklyPhotoRecord = {
      ...activeRecord,
      aiMeasurements: {
        ...est,
        savedToEvolutionDate: activeRecord.date,
      },
      updatedAt: new Date().toISOString(),
    };
    await persistUpdatedRecord(updated);
    onToast(
      `Todas as 10 medidas de ${formatDateBr(
        activeRecord.date
      )} foram salvas no Histórico de Evolução!`,
      "success"
    );
  };

  const compareBefore = records.find((r) => r.id === compareBeforeId) || null;
  const compareAfter = records.find((r) => r.id === compareAfterId) || null;
  const compareWeightDelta =
    compareBefore?.weightKg && compareAfter?.weightKg
      ? Number((compareAfter.weightKg - compareBefore.weightKg).toFixed(1))
      : null;

  return (
    <section
      aria-label="Fotos da evolução semanal: Frente, Lado e Costas com medição corporal por IA"
      className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none overflow-hidden"
    >
      {/* Card Header */}
      <div className="p-5 sm:p-6 border-b border-[#E2E8F0] dark:border-[#26262B] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#475569] dark:text-[#A1A1AA]">
            <span className="font-semibold text-[#FF6B00]">
              Evolução Visual + Antropometria IA
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {activePhotoCount}/3 fotos
            </span>
            {activeRecord?.date && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums font-semibold text-[#0F172A] dark:text-white">
                  Data: {formatDateBr(activeRecord.date)}
                </span>
              </>
            )}
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              {records.length} {records.length === 1 ? "semana" : "semanas"}
            </span>
          </div>

          <h2 className="mt-1 text-lg sm:text-xl font-extrabold text-[#0F172A] dark:text-white tracking-tight">
            Fotos da Evolução (Frente · Lado · Costas)
          </h2>
          <p className="mt-0.5 text-xs sm:text-sm text-[#475569] dark:text-[#A1A1AA]">
            Salve a data de cada registro fotográfico e use a IA para medir circunferências de barriga, cintura, peito, quadril, braços e pernas.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {records.length >= 2 && (
            <button
              type="button"
              onClick={() => setCompareMode((prev) => !prev)}
              className={`min-h-[40px] px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                compareMode
                  ? "bg-[#0F172A] dark:bg-white text-white dark:text-[#0F172A] border-[#0F172A] dark:border-white"
                  : "bg-[#F8FAFC] dark:bg-[#0B0B0D] text-[#0F172A] dark:text-white border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00]/60"
              }`}
            >
              <Columns2 className="w-3.5 h-3.5" />
              <span>{compareMode ? "Voltar às 3 fotos" : "Comparar datas"}</span>
            </button>
          )}

          <button
            type="button"
            onClick={() => void handleCreateNewWeek()}
            className="min-h-[40px] px-4 py-2 rounded-xl bg-[#FF6B00] hover:bg-[#F97316] text-xs font-bold text-white flex items-center gap-1.5 shadow-sm shadow-[#FF6B00]/20 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nova data / semana</span>
          </button>
        </div>
      </div>

      {/* Week Tabs Strip (sorted by date) */}
      {records.length > 0 && !compareMode && (
        <div className="px-5 sm:px-6 py-3 border-b border-[#E2E8F0] dark:border-[#26262B] bg-[#F8FAFC] dark:bg-[#111114] flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {records.map((rec) => {
              const isSelected = activeRecord?.id === rec.id;
              const filled = countPhotos(rec);
              const hasAi = Boolean(rec.aiMeasurements);
              return (
                <button
                  key={rec.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(rec.id);
                    setAiError(null);
                  }}
                  className={`min-h-[36px] px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 border transition-colors whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? "bg-[#FF6B00] border-[#FF6B00] text-white"
                      : "bg-white dark:bg-[#151518] border-[#E2E8F0] dark:border-[#26262B] text-[#334155] dark:text-[#D4D4D8] hover:border-[#FF6B00]/60"
                  }`}
                >
                  <Calendar className="w-3 h-3 shrink-0" />
                  <span>{rec.weekLabel}</span>
                  <span
                    className={`font-mono text-[11px] tabular-nums ${
                      isSelected
                        ? "text-white/90"
                        : "text-[#64748B] dark:text-[#A1A1AA]"
                    }`}
                  >
                    {formatShortDateBr(rec.date)} · {filled}/3
                    {hasAi ? " · IA" : ""}
                  </span>
                </button>
              );
            })}
          </div>

          {activeRecord && (
            <button
              type="button"
              onClick={() => void handleDeleteCurrentWeek()}
              className="min-h-[34px] px-2.5 py-1 rounded-lg text-xs font-medium text-[#64748B] dark:text-[#A1A1AA] hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-500/10 flex items-center gap-1 transition-colors whitespace-nowrap cursor-pointer"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Limpar registro</span>
            </button>
          )}
        </div>
      )}

      {/* Main Body */}
      {!isLoaded ? (
        <div className="p-6 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="aspect-[3/4] rounded-xl bg-[#F1F5F9] dark:bg-[#1C1C21] animate-pulse"
            />
          ))}
        </div>
      ) : compareMode && compareBefore && compareAfter ? (
        <div className="p-5 sm:p-6 space-y-5">
          {/* Comparison Controls */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
            <div className="md:col-span-4">
              <label
                htmlFor="compare-before"
                className="block text-xs font-semibold text-[#475569] dark:text-[#A1A1AA] mb-1"
              >
                Data Anterior (Antes)
              </label>
              <select
                id="compare-before"
                value={compareBeforeId}
                onChange={(e) => setCompareBeforeId(e.target.value)}
                className="w-full min-h-[42px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] px-3 text-xs font-semibold text-[#0F172A] dark:text-white"
              >
                {records.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.weekLabel} · {formatDateBr(r.date)}
                    {r.weightKg ? ` (${r.weightKg.toFixed(1)} kg)` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-4">
              <label
                htmlFor="compare-after"
                className="block text-xs font-semibold text-[#475569] dark:text-[#A1A1AA] mb-1"
              >
                Data Atual (Depois)
              </label>
              <select
                id="compare-after"
                value={compareAfterId}
                onChange={(e) => setCompareAfterId(e.target.value)}
                className="w-full min-h-[42px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] px-3 text-xs font-semibold text-[#0F172A] dark:text-white"
              >
                {records.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.weekLabel} · {formatDateBr(r.date)}
                    {r.weightKg ? ` (${r.weightKg.toFixed(1)} kg)` : ""}
                  </option>
                ))}
              </select>
            </div>

            <div className="md:col-span-4">
              <span className="block text-xs font-semibold text-[#475569] dark:text-[#A1A1AA] mb-1">
                Ângulo comparado
              </span>
              <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B]">
                {PHOTO_ANGLES.map((a) => (
                  <button
                    key={a.key}
                    type="button"
                    onClick={() => setCompareAngle(a.key)}
                    className={`min-h-[34px] rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                      compareAngle === a.key
                        ? "bg-[#FF6B00] text-white"
                        : "text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white"
                    }`}
                  >
                    {a.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {compareWeightDelta !== null && (
            <div className="text-xs text-[#475569] dark:text-[#A1A1AA] font-mono tabular-nums flex flex-wrap items-center gap-2">
              <span>
                Evolução de {formatDateBr(compareBefore.date)} para{" "}
                {formatDateBr(compareAfter.date)}:
              </span>
              <strong
                className={
                  compareWeightDelta <= 0
                    ? "text-emerald-600 dark:text-emerald-400"
                    : "text-[#FF6B00]"
                }
              >
                {compareWeightDelta > 0 ? "+" : ""}
                {compareWeightDelta.toFixed(1)} kg
              </strong>
            </div>
          )}

          {/* Side-by-side comparison frames */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {[
              { tag: "Antes", rec: compareBefore },
              { tag: "Depois", rec: compareAfter },
            ].map(({ tag, rec }) => {
              const imgSrc = rec.photos[compareAngle];
              const angleLabel =
                PHOTO_ANGLES.find((a) => a.key === compareAngle)?.label || "";
              return (
                <div
                  key={`${tag}_${rec.id}`}
                  className="rounded-xl overflow-hidden border border-[#E2E8F0] dark:border-[#26262B] bg-[#F8FAFC] dark:bg-[#0B0B0D]"
                >
                  <div className="px-4 py-2.5 border-b border-[#E2E8F0] dark:border-[#26262B] flex items-center justify-between text-xs">
                    <span className="font-bold text-[#0F172A] dark:text-white">
                      {tag} · {rec.weekLabel}
                    </span>
                    <span className="font-mono tabular-nums text-[#475569] dark:text-[#A1A1AA]">
                      {formatDateBr(rec.date)}
                      {rec.weightKg ? ` · ${rec.weightKg.toFixed(1)} kg` : ""}
                    </span>
                  </div>
                  <div className="aspect-[3/4] max-h-[460px] w-full flex items-center justify-center bg-[#0B0B0D]/5 dark:bg-[#0B0B0D]">
                    {imgSrc ? (
                      <img
                        src={imgSrc}
                        alt={`${tag} - ${angleLabel} (${rec.weekLabel} - ${formatDateBr(
                          rec.date
                        )})`}
                        referrerPolicy="no-referrer"
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <p className="text-xs text-[#64748B] dark:text-[#A1A1AA] px-4 text-center">
                        Sem foto de <strong>{angleLabel}</strong> cadastrada em{" "}
                        {formatDateBr(rec.date)}.
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Side-by-side AI Circumference Evolution Table when both records have AI measurements */}
          {compareBefore.aiMeasurements && compareAfter.aiMeasurements && (
            <div className="rounded-xl border border-[#E2E8F0] dark:border-[#26262B] overflow-hidden">
              <div className="px-4 py-3 bg-[#F8FAFC] dark:bg-[#111114] border-b border-[#E2E8F0] dark:border-[#26262B] flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-[#0F172A] dark:text-white flex items-center gap-1.5">
                  <Ruler className="w-3.5 h-3.5 text-[#FF6B00]" />
                  <span>Evolução das Circunferências por IA</span>
                </span>
                <span className="font-mono text-[11px] tabular-nums text-[#64748B] dark:text-[#A1A1AA]">
                  {formatDateBr(compareBefore.date)} → {formatDateBr(compareAfter.date)}
                </span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-[#E2E8F0] dark:border-[#26262B] text-[#64748B] dark:text-[#A1A1AA]">
                      <th className="py-2.5 px-4 font-semibold">Região</th>
                      <th className="py-2.5 px-4 text-right font-semibold">
                        Antes ({formatShortDateBr(compareBefore.date)})
                      </th>
                      <th className="py-2.5 px-4 text-right font-semibold">
                        Depois ({formatShortDateBr(compareAfter.date)})
                      </th>
                      <th className="py-2.5 px-4 text-right font-semibold">
                        Evolução
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E2E8F0] dark:divide-[#26262B]">
                    {CIRCUMFERENCE_FIELDS.map((field) => {
                      const beforeVal = compareBefore.aiMeasurements![field.key];
                      const afterVal = compareAfter.aiMeasurements![field.key];
                      const delta = Number((afterVal - beforeVal).toFixed(1));
                      const isPositiveChange = field.preferLower
                        ? delta < 0
                        : delta > 0;
                      return (
                        <tr key={field.key}>
                          <td className="py-2 px-4 font-medium text-[#0F172A] dark:text-white">
                            {field.label}
                          </td>
                          <td className="py-2 px-4 text-right font-mono tabular-nums text-[#475569] dark:text-[#A1A1AA]">
                            {beforeVal.toFixed(1)} cm
                          </td>
                          <td className="py-2 px-4 text-right font-mono font-semibold tabular-nums text-[#0F172A] dark:text-white">
                            {afterVal.toFixed(1)} cm
                          </td>
                          <td
                            className={`py-2 px-4 text-right font-mono font-bold tabular-nums ${
                              delta === 0
                                ? "text-[#64748B] dark:text-[#A1A1AA]"
                                : isPositiveChange
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-[#FF6B00]"
                            }`}
                          >
                            {delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)} cm
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      ) : activeRecord ? (
        <div className="p-5 sm:p-6 space-y-5">
          {/* Date, Weight & Label Form with Explicit Save Date Action */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-3 items-end">
            <div className="sm:col-span-3">
              <label
                htmlFor="week-photo-date"
                className="block text-[11px] font-semibold text-[#475569] dark:text-[#A1A1AA] mb-1"
              >
                Data das fotos (evolução) *
              </label>
              <input
                id="week-photo-date"
                type="date"
                value={activeRecord.date}
                onChange={(e) => handleUpdateMeta({ date: e.target.value })}
                className="w-full min-h-[40px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3 font-mono text-xs font-semibold tabular-nums text-[#0F172A] dark:text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="week-photo-label"
                className="block text-[11px] font-semibold text-[#475569] dark:text-[#A1A1AA] mb-1"
              >
                Semana / Marco
              </label>
              <input
                id="week-photo-label"
                type="text"
                maxLength={32}
                value={activeRecord.weekLabel}
                onChange={(e) => handleUpdateMeta({ weekLabel: e.target.value })}
                placeholder="Ex.: Semana 1"
                className="w-full min-h-[40px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3 text-xs font-semibold text-[#0F172A] dark:text-white"
              />
            </div>

            <div className="sm:col-span-2">
              <label
                htmlFor="week-photo-weight"
                className="block text-[11px] font-semibold text-[#475569] dark:text-[#A1A1AA] mb-1"
              >
                Peso (kg)
              </label>
              <input
                id="week-photo-weight"
                type="number"
                step="0.1"
                min={30}
                max={300}
                value={activeRecord.weightKg ?? ""}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  handleUpdateMeta({
                    weightKg:
                      Number.isFinite(val) && val >= 30 && val <= 300
                        ? Number(val.toFixed(1))
                        : undefined,
                  });
                }}
                placeholder="75.0"
                className="w-full min-h-[40px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3 font-mono text-xs font-semibold tabular-nums text-[#0F172A] dark:text-white"
              />
            </div>

            <div className="sm:col-span-3">
              <label
                htmlFor="week-photo-note"
                className="block text-[11px] font-semibold text-[#475569] dark:text-[#A1A1AA] mb-1"
              >
                Observação (opcional)
              </label>
              <input
                id="week-photo-note"
                type="text"
                maxLength={80}
                value={activeRecord.note || ""}
                onChange={(e) => handleUpdateMeta({ note: e.target.value })}
                placeholder="Ex.: Em jejum pela manhã"
                className="w-full min-h-[40px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3 text-xs text-[#0F172A] dark:text-white placeholder:text-[#94A3B8] dark:placeholder:text-[#52525B]"
              />
            </div>

            <div className="sm:col-span-2">
              <button
                type="button"
                onClick={() => void handleConfirmSaveDateAndMeta()}
                className={`w-full min-h-[40px] px-3 rounded-xl text-xs font-bold border flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap cursor-pointer ${
                  justSavedDate
                    ? "bg-emerald-600 border-emerald-600 text-white"
                    : "bg-[#F8FAFC] dark:bg-[#0B0B0D] hover:border-[#FF6B00] border-[#E2E8F0] dark:border-[#26262B] text-[#0F172A] dark:text-white"
                }`}
              >
                {justSavedDate ? (
                  <>
                    <Check className="w-3.5 h-3.5" />
                    <span>Data salva</span>
                  </>
                ) : (
                  <>
                    <Save className="w-3.5 h-3.5 text-[#FF6B00]" />
                    <span>Salvar data</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 3-Slot Grid: Frente | Lado | Costas */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {PHOTO_ANGLES.map((slot, index) => {
              const photoSrc = activeRecord.photos[slot.key];
              const photoDate =
                activeRecord.photoDates?.[slot.key] || activeRecord.date;
              const isUploading = uploadingAngle === slot.key;
              const isDragOver = dragOverAngle === slot.key;

              return (
                <div
                  key={slot.key}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverAngle(slot.key);
                  }}
                  onDragLeave={() => setDragOverAngle(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverAngle(null);
                    const file = e.dataTransfer.files?.[0];
                    if (file) void handleUploadFile(slot.key, file);
                  }}
                  className={`flex flex-col rounded-xl overflow-hidden border transition-colors ${
                    isDragOver
                      ? "border-[#FF6B00] bg-[#FFF7ED] dark:bg-[#1E140D]"
                      : "border-[#E2E8F0] dark:border-[#26262B] bg-[#F8FAFC] dark:bg-[#0B0B0D]"
                  }`}
                >
                  <input
                    ref={(el) => {
                      fileInputRefs.current[slot.key] = el;
                    }}
                    type="file"
                    accept="image/*"
                    aria-label={`Enviar foto de ${slot.label}`}
                    onChange={(e) =>
                      void handleUploadFile(slot.key, e.target.files?.[0])
                    }
                    className="sr-only"
                  />

                  {/* Slot Header with Date */}
                  <div className="px-3.5 py-2.5 border-b border-[#E2E8F0] dark:border-[#26262B] flex items-center justify-between gap-2 bg-white dark:bg-[#151518]">
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono text-[11px] font-bold tabular-nums text-[#FF6B00]">
                        0{index + 1}
                      </span>
                      <span className="text-sm font-bold text-[#0F172A] dark:text-white truncate">
                        {slot.label}
                      </span>
                    </div>

                    {photoSrc ? (
                      <span className="inline-flex items-center gap-1 font-mono text-[11px] font-semibold tabular-nums text-emerald-600 dark:text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>{formatDateBr(photoDate)}</span>
                      </span>
                    ) : (
                      <span className="font-mono text-[11px] tabular-nums text-[#64748B] dark:text-[#A1A1AA]">
                        {formatShortDateBr(activeRecord.date)}
                      </span>
                    )}
                  </div>

                  {/* Portrait Photo Frame (3:4) */}
                  <div className="relative aspect-[3/4] w-full overflow-hidden group">
                    {photoSrc ? (
                      <>
                        <img
                          src={photoSrc}
                          alt={`Foto ${slot.label} - ${activeRecord.weekLabel} (${formatDateBr(
                            photoDate
                          )})`}
                          referrerPolicy="no-referrer"
                          onClick={() => setLightboxAngle(slot.key)}
                          className="w-full h-full object-cover cursor-pointer transition-transform duration-300 group-hover:scale-[1.02]"
                        />

                        {/* Bottom Scrim & Action Controls */}
                        <div className="absolute inset-x-0 bottom-0 p-3 bg-gradient-to-t from-black/85 via-black/45 to-transparent space-y-2">
                          <div className="flex items-center justify-between text-[11px] font-mono tabular-nums text-white/90">
                            <span>{formatDateBr(photoDate)}</span>
                            {activeRecord.weightKg && (
                              <span>{activeRecord.weightKg.toFixed(1)} kg</span>
                            )}
                          </div>

                          <div className="flex items-center justify-between gap-2">
                            <button
                              type="button"
                              onClick={() => setLightboxAngle(slot.key)}
                              className="min-h-[34px] px-2.5 py-1 rounded-lg bg-white/15 hover:bg-white/25 backdrop-blur-sm text-white text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
                            >
                              <Expand className="w-3.5 h-3.5" />
                              <span>Ampliar</span>
                            </button>

                            <div className="flex items-center gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  fileInputRefs.current[slot.key]?.click()
                                }
                                title={`Trocar foto de ${slot.label}`}
                                aria-label={`Trocar foto de ${slot.label}`}
                                className="min-h-[34px] px-2.5 py-1 rounded-lg bg-[#FF6B00] hover:bg-[#F97316] text-white text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap"
                              >
                                <RefreshCw className="w-3.5 h-3.5" />
                                <span>Trocar</span>
                              </button>

                              <button
                                type="button"
                                onClick={() =>
                                  void handleRemoveAnglePhoto(slot.key)
                                }
                                title={`Remover foto de ${slot.label}`}
                                aria-label={`Remover foto de ${slot.label}`}
                                className="min-h-[34px] min-w-[34px] rounded-lg bg-black/55 hover:bg-red-600 text-white inline-flex items-center justify-center transition-colors cursor-pointer"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        </div>
                      </>
                    ) : (
                      <button
                        type="button"
                        disabled={isUploading}
                        onClick={() => fileInputRefs.current[slot.key]?.click()}
                        className="w-full h-full p-5 flex flex-col items-center justify-center text-center gap-3 hover:bg-[#F1F5F9]/80 dark:hover:bg-[#151518] transition-colors cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#FF6B00]"
                      >
                        <div className="w-12 h-12 rounded-2xl bg-[#FF6B00]/12 border border-[#FF6B00]/30 text-[#FF6B00] flex items-center justify-center">
                          {isUploading ? (
                            <RefreshCw className="w-5 h-5 animate-spin" />
                          ) : (
                            <Camera className="w-5 h-5" />
                          )}
                        </div>

                        <div className="space-y-1 max-w-[205px]">
                          <p className="text-sm font-bold text-[#0F172A] dark:text-white">
                            {isUploading
                              ? "Salvando foto..."
                              : `Foto de ${slot.label}`}
                          </p>
                          <p className="text-xs text-[#64748B] dark:text-[#A1A1AA] leading-relaxed">
                            {slot.poseHint}
                          </p>
                        </div>

                        <span className="mt-1 min-h-[38px] px-4 py-2 rounded-xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] text-xs font-bold text-[#0F172A] dark:text-white inline-flex items-center gap-1.5 shadow-2xs">
                          <ImagePlus className="w-3.5 h-3.5 text-[#FF6B00]" />
                          <span>Adicionar foto</span>
                        </span>
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* AI Body Circumference Measurement Trigger Bar */}
          <div className="pt-4 border-t border-[#E2E8F0] dark:border-[#26262B] flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="min-w-0 space-y-0.5">
              <div className="flex flex-wrap items-center gap-2 text-xs font-bold text-[#0F172A] dark:text-white">
                <ScanLine className="w-4 h-4 text-[#FF6B00] shrink-0" />
                <span>Medição Corporal por IA (Barriga, Cintura, Pernas e Tudo)</span>
              </div>
              <p className="text-xs text-[#475569] dark:text-[#A1A1AA]">
                Calibrada com sua altura (
                <span className="font-mono font-semibold tabular-nums text-[#0F172A] dark:text-white">
                  {profile.heightCm} cm
                </span>
                ) e peso (
                <span className="font-mono font-semibold tabular-nums text-[#0F172A] dark:text-white">
                  {(activeRecord.weightKg ?? currentWeightKg).toFixed(1)} kg
                </span>
                )
                {activePhotoCount < 3
                  ? " · Dica: envie as 3 fotos (Frente, Lado e Costas) para maior precisão."
                  : " · Todas as 3 fotos prontas para leitura completa!"}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2 shrink-0">
              <button
                type="button"
                disabled={isAnalyzingAi || activePhotoCount === 0}
                onClick={() => void handleMeasureWithAi()}
                className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0F172A] dark:bg-[#FF6B00] hover:bg-[#1E293B] dark:hover:bg-[#F97316] disabled:opacity-45 disabled:cursor-not-allowed text-white text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                {isAnalyzingAi ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>Medindo corpo com IA...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4 text-[#FF6B00] dark:text-white" />
                    <span>
                      {activeRecord.aiMeasurements
                        ? "Recalcular Medidas com IA"
                        : "Medir Circunferências com IA"}
                    </span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* AI Error Notice */}
          {aiError && !isAnalyzingAi && (
            <div className="rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/60 px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-amber-800 dark:text-amber-200">
              <div className="flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <span>{aiError}</span>
              </div>
              <button
                type="button"
                onClick={() => void handleMeasureWithAi()}
                className="px-3 py-1.5 rounded-lg bg-amber-600 hover:bg-amber-500 text-white font-bold whitespace-nowrap self-start sm:self-auto cursor-pointer"
              >
                Tentar novamente
              </button>
            </div>
          )}

          {/* AI Body Circumference Results Panel */}
          {activeRecord.aiMeasurements && (
            <div className="pt-4 border-t border-[#E2E8F0] dark:border-[#26262B] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#475569] dark:text-[#A1A1AA]">
                    <span className="font-semibold text-[#FF6B00]">
                      Estimativa Antropométrica IA
                    </span>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums">
                      Data: {formatDateBr(activeRecord.date)}
                    </span>
                    <span aria-hidden="true">·</span>
                    <span>
                      Precisão visual:{" "}
                      <strong className="capitalize text-[#0F172A] dark:text-white">
                        {activeRecord.aiMeasurements.confidence}
                      </strong>
                    </span>
                    {typeof activeRecord.aiMeasurements.estimatedBodyFatPct ===
                      "number" && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="font-mono tabular-nums">
                          Gordura est.:{" "}
                          <strong className="text-[#0F172A] dark:text-white">
                            {activeRecord.aiMeasurements.estimatedBodyFatPct.toFixed(
                              1
                            )}
                            %
                          </strong>
                        </span>
                      </>
                    )}
                  </div>
                  <h3 className="mt-1 text-base font-extrabold text-[#0F172A] dark:text-white">
                    Circunferências Corporais Estimadas (10 Pontos)
                  </h3>
                </div>

                <button
                  type="button"
                  onClick={() => void handleSaveAiMeasurementsToEvolution()}
                  className={`min-h-[40px] px-4 py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    activeRecord.aiMeasurements.savedToEvolutionDate ===
                    activeRecord.date
                      ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                      : "bg-[#FF6B00] hover:bg-[#F97316] text-white shadow-sm shadow-[#FF6B00]/20"
                  }`}
                >
                  {activeRecord.aiMeasurements.savedToEvolutionDate ===
                  activeRecord.date ? (
                    <>
                      <CheckCircle2 className="w-4 h-4" />
                      <span>
                        Salvo no Histórico ({formatShortDateBr(activeRecord.date)})
                      </span>
                    </>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>
                        Salvar medidas na Evolução (
                        {formatShortDateBr(activeRecord.date)})
                      </span>
                    </>
                  )}
                </button>
              </div>

              {/* 10-Point Circumferences Grid (clean hairline separators, tabular-nums) */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-px rounded-xl overflow-hidden bg-[#E2E8F0] dark:bg-[#26262B] border border-[#E2E8F0] dark:border-[#26262B]">
                {CIRCUMFERENCE_FIELDS.map((field) => {
                  const val = activeRecord.aiMeasurements![field.key];
                  const prevVal = previousBaseline
                    ? previousBaseline[field.key]
                    : undefined;
                  const delta =
                    typeof prevVal === "number" && prevVal > 0
                      ? Number((val - prevVal).toFixed(1))
                      : null;
                  const isGoodDelta =
                    delta !== null && delta !== 0
                      ? field.preferLower
                        ? delta < 0
                        : delta > 0
                      : false;

                  return (
                    <div
                      key={field.key}
                      className="bg-[#F8FAFC] dark:bg-[#0B0B0D] px-3.5 py-3 flex flex-col justify-between gap-1"
                    >
                      <span className="text-[11px] font-medium text-[#475569] dark:text-[#A1A1AA]">
                        {field.label}
                      </span>
                      <div className="flex items-baseline justify-between gap-1">
                        <span className="font-mono text-base font-bold tabular-nums text-[#0F172A] dark:text-white">
                          {val.toFixed(1)}
                          <span className="text-[11px] font-normal text-[#64748B] dark:text-[#A1A1AA] ml-0.5">
                            cm
                          </span>
                        </span>
                        {delta !== null && (
                          <span
                            className={`font-mono text-[11px] font-semibold tabular-nums ${
                              delta === 0
                                ? "text-[#64748B] dark:text-[#A1A1AA]"
                                : isGoodDelta
                                ? "text-emerald-600 dark:text-emerald-400"
                                : "text-[#FF6B00]"
                            }`}
                          >
                            {delta > 0 ? `+${delta.toFixed(1)}` : delta.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* AI Visual Summary & Evolution Note */}
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs text-[#334155] dark:text-[#D4D4D8] leading-relaxed">
                <div className="space-y-1">
                  <p className="font-bold text-[#0F172A] dark:text-white">
                    Leitura visual da IA
                  </p>
                  <p>{activeRecord.aiMeasurements.visualSummary}</p>
                </div>

                <div className="space-y-1">
                  <p className="font-bold text-[#0F172A] dark:text-white">
                    {previousBaseline
                      ? `Comparação vs. ${previousBaseline.sourceLabel}`
                      : "Acompanhamento de evolução"}
                  </p>
                  <p>
                    {activeRecord.aiMeasurements.evolutionNote ||
                      activeRecord.aiMeasurements.photoTip}
                  </p>
                </div>
              </div>

              <p className="text-[11px] text-[#64748B] dark:text-[#A1A1AA]">
                Nota: as medidas por foto são estimativas antropométricas visuais calibradas pela sua altura e peso para acompanhar tendências semanais. Você pode ajustá-las com fita métrica na tabela de medidas abaixo sempre que desejar.
              </p>
            </div>
          )}
        </div>
      ) : null}

      {/* Fullscreen Lightbox Modal */}
      {lightboxAngle && activeRecord?.photos[lightboxAngle] && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Visualizar foto da evolução semanal"
          onClick={() => setLightboxAngle(null)}
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-sm p-4 sm:p-6 flex items-center justify-center"
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-2xl rounded-2xl bg-[#151518] border border-[#26262B] overflow-hidden shadow-2xl"
          >
            <div className="px-4 py-3 border-b border-[#26262B] flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-xs text-[#D4D4D8]">
                <strong className="text-white font-bold">
                  {activeRecord.weekLabel}
                </strong>
                <span aria-hidden="true">·</span>
                <span className="font-mono tabular-nums">
                  {formatDateBr(
                    activeRecord.photoDates?.[lightboxAngle] || activeRecord.date
                  )}
                </span>
                {activeRecord.weightKg && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="font-mono tabular-nums text-[#FF6B00] font-semibold">
                      {activeRecord.weightKg.toFixed(1)} kg
                    </span>
                  </>
                )}
              </div>

              <button
                type="button"
                onClick={() => setLightboxAngle(null)}
                aria-label="Fechar visualização"
                className="min-h-[36px] min-w-[36px] rounded-lg bg-white/10 hover:bg-white/20 text-white inline-flex items-center justify-center transition-colors cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="bg-black flex items-center justify-center max-h-[70vh] overflow-hidden">
              <img
                src={activeRecord.photos[lightboxAngle]}
                alt={`Foto ampliada ${lightboxAngle}`}
                referrerPolicy="no-referrer"
                className="max-h-[70vh] w-auto object-contain"
              />
            </div>

            <div className="px-4 py-3 border-t border-[#26262B] flex items-center justify-center gap-2">
              {PHOTO_ANGLES.map((a) => {
                const hasPhoto = Boolean(activeRecord.photos[a.key]);
                const active = lightboxAngle === a.key;
                return (
                  <button
                    key={a.key}
                    type="button"
                    disabled={!hasPhoto}
                    onClick={() => setLightboxAngle(a.key)}
                    className={`min-h-[36px] px-4 py-1.5 rounded-lg text-xs font-bold transition-colors cursor-pointer disabled:opacity-35 disabled:cursor-not-allowed ${
                      active
                        ? "bg-[#FF6B00] text-white"
                        : "bg-[#1C1C21] text-[#D4D4D8] hover:text-white"
                    }`}
                  >
                    {a.label}
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};
