import {
  ActivityLevel,
  DeficitMode,
  MetabolicResult,
  StudentProfile,
  WeeklyFrequency,
} from "../types";

export const ACTIVITY_OPTIONS: {
  value: ActivityLevel;
  label: string;
  factor: number;
  detail: string;
}[] = [
  { value: "sedentario", label: "Sedentário", factor: 1.2, detail: "Pouco movimento diário" },
  { value: "leve", label: "Leve (1-2x/sem)", factor: 1.375, detail: "Treino leve ou caminhadas" },
  { value: "moderado", label: "Moderado (3-5x/sem)", factor: 1.55, detail: "Musculação regular na academia" },
  { value: "intenso", label: "Intenso (6x/sem)", factor: 1.725, detail: "Musculação pesada + cardio" },
  { value: "atleta", label: "Muito Intenso", factor: 1.9, detail: "Treinos duplos ou rotina física" },
];

export const DEFICIT_OPTIONS: {
  value: DeficitMode;
  label: string;
  kcal: number;
  detail: string;
}[] = [
  {
    value: "moderado",
    label: "Moderado (-300 kcal)",
    kcal: 300,
    detail: "Perda sustentável com máxima energia na musculação",
  },
  {
    value: "acelerado",
    label: "Acelerado (-500 kcal)",
    kcal: 500,
    detail: "Secagem mais rápida com proteína alta preservando massa magra",
  },
];

export const AVATAR_PRESETS: {
  id: string;
  label: string;
  bgClass: string;
  accentText: string;
  initialsHint: string;
}[] = [
  {
    id: "preset:orange",
    label: "Laranja Fit",
    bgClass: "bg-gradient-to-br from-[#FF6B00] to-[#C2410C]",
    accentText: "text-white",
    initialsHint: "PF",
  },
  {
    id: "preset:obsidian",
    label: "Obsidian Steel",
    bgClass: "bg-gradient-to-br from-[#27272A] to-[#09090B]",
    accentText: "text-[#FF6B00]",
    initialsHint: "OS",
  },
  {
    id: "preset:amber",
    label: "Âmbar Energia",
    bgClass: "bg-gradient-to-br from-[#F59E0B] to-[#B45309]",
    accentText: "text-[#0B0B0D]",
    initialsHint: "AE",
  },
  {
    id: "preset:crimson",
    label: "Força Intensa",
    bgClass: "bg-gradient-to-br from-[#EA580C] to-[#7C2D12]",
    accentText: "text-white",
    initialsHint: "FI",
  },
  {
    id: "preset:emerald",
    label: "Foco Natural",
    bgClass: "bg-gradient-to-br from-[#10B981] to-[#065F46]",
    accentText: "text-white",
    initialsHint: "FN",
  },
  {
    id: "preset:slate",
    label: "Titânio",
    bgClass: "bg-gradient-to-br from-[#52525B] to-[#18181B]",
    accentText: "text-white",
    initialsHint: "TI",
  },
];

export function getFirstName(fullName: string): string {
  const clean = (fullName || "").trim();
  if (!clean) return "Atleta";
  return clean.split(/\s+/)[0];
}

export function getInitials(fullName: string): string {
  const parts = (fullName || "BF").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "BF";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export function frequencyToActivityLevel(freq: WeeklyFrequency): ActivityLevel {
  if (freq <= 4) return "moderado";
  if (freq === 5) return "moderado";
  return "intenso";
}

export function calculateBmi(weightKg: number, heightCm: number): {
  bmi: number;
  bmiLabel: string;
  bmiTone: "info" | "healthy" | "warning" | "alert";
} {
  const hMeters = Math.max(1.1, heightCm / 100);
  const bmi = Number((Math.max(30, weightKg) / (hMeters * hMeters)).toFixed(1));

  if (bmi < 18.5) {
    return { bmi, bmiLabel: "Abaixo do peso", bmiTone: "info" };
  }
  if (bmi < 25) {
    return { bmi, bmiLabel: "Peso saudável", bmiTone: "healthy" };
  }
  if (bmi < 30) {
    return { bmi, bmiLabel: "Sobrepeso", bmiTone: "warning" };
  }
  return { bmi, bmiLabel: "Obesidade", bmiTone: "alert" };
}

export function calculateMetabolism(profile: StudentProfile): MetabolicResult {
  const weight = Math.max(35, Number(profile.weightKg) || 70);
  const height = Math.max(120, Number(profile.heightCm) || 170);
  const age = Math.max(14, Number(profile.age) || 28);

  const { bmi, bmiLabel, bmiTone } = calculateBmi(weight, height);

  // Mifflin-St Jeor equation
  const tmbRaw =
    profile.sex === "M"
      ? 10 * weight + 6.25 * height - 5 * age + 5
      : 10 * weight + 6.25 * height - 5 * age - 161;

  const activityObj =
    ACTIVITY_OPTIONS.find((a) => a.value === profile.activityLevel) || ACTIVITY_OPTIONS[2];
  const deficitObj =
    DEFICIT_OPTIONS.find((d) => d.value === profile.deficitMode) || DEFICIT_OPTIONS[1];

  const tmb = Math.round(tmbRaw);
  const get = Math.round(tmbRaw * activityObj.factor);

  const safeMinCalories = profile.sex === "M" ? 1500 : 1250;
  const calorieTarget = Math.max(safeMinCalories, get - deficitObj.kcal);

  // High protein 2.0g/kg for muscle definition & satiety
  const proteinG = Math.round(weight * 2.0);
  const proteinKcal = proteinG * 4;

  // Healthy fats ~0.8g/kg (minimum 45g)
  const fatG = Math.max(45, Math.round(weight * 0.8));
  const fatKcal = fatG * 9;

  // Remaining calories allocated to complex carbs for gym performance
  const remainingKcal = Math.max(160, calorieTarget - proteinKcal - fatKcal);
  const carbsG = Math.round(remainingKcal / 4);

  // Water target: 40ml/kg
  const waterTargetMl = Math.round((weight * 40) / 50) * 50;

  return {
    bmi,
    bmiLabel,
    bmiTone,
    tmb,
    get,
    calorieTarget,
    deficitKcal: deficitObj.kcal,
    proteinG,
    carbsG,
    fatG,
    waterTargetMl,
    activityLabel: activityObj.label,
    deficitLabel: deficitObj.label,
  };
}
