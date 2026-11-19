import {
  AchievementCategory,
  AchievementIconKey,
  AchievementProgressItem,
  AchievementTier,
  BiancoAppState,
  CompletedWorkout,
  MetabolicResult,
  TabId,
} from "../types";

export interface AchievementDefinition {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  tier: AchievementTier;
  icon: AchievementIconKey;
  ctaTab?: TabId;
  ctaLabel?: string;
}

export const ACHIEVEMENT_CATALOG: AchievementDefinition[] = [
  {
    id: "first_workout",
    title: "Primeiro treino concluído",
    description: "Finalizou sua primeira sessão presencial registrada no Personal Nutri Fit.",
    category: "Treinos",
    tier: "bronze",
    icon: "dumbbell",
    ctaTab: "treinos",
    ctaLabel: "Ir para Treinos",
  },
  {
    id: "first_week_complete",
    title: "Primeira semana completa",
    description: "Bateu sua meta semanal de dias treinados em uma janela de 7 dias.",
    category: "Consistência",
    tier: "silver",
    icon: "calendar",
    ctaTab: "treinos",
    ctaLabel: "Treinar hoje",
  },
  {
    id: "streak_3",
    title: "Ritmo de ferro (3 dias)",
    description: "Manteve uma sequência ativa de 3 treinos consecutivos sem quebrar o ritmo.",
    category: "Consistência",
    tier: "bronze",
    icon: "flame",
    ctaTab: "treinos",
    ctaLabel: "Manter sequência",
  },
  {
    id: "workouts_5",
    title: "5 treinos realizados",
    description: "Completou 5 sessões de academia com disciplina e registro de cargas.",
    category: "Treinos",
    tier: "bronze",
    icon: "zap",
    ctaTab: "treinos",
    ctaLabel: "Iniciar treino",
  },
  {
    id: "workouts_10",
    title: "10 treinos realizados",
    description: "Alcançou a marca de 10 treinos concluídos e construiu o hábito.",
    category: "Treinos",
    tier: "silver",
    icon: "trophy",
    ctaTab: "treinos",
    ctaLabel: "Abrir treinos",
  },
  {
    id: "streak_7",
    title: "Semana imparável (7 dias)",
    description: "Construiu uma sequência de 7 sessões seguidas dentro do seu plano.",
    category: "Consistência",
    tier: "gold",
    icon: "crown",
    ctaTab: "treinos",
    ctaLabel: "Seguir firme",
  },
  {
    id: "workouts_25",
    title: "25 treinos realizados",
    description: "Veterano da sala de musculação com 25 sessões finalizadas.",
    category: "Treinos",
    tier: "gold",
    icon: "award",
    ctaTab: "treinos",
    ctaLabel: "Ver catálogo",
  },
  {
    id: "volume_10t",
    title: "Força bruta (10 toneladas)",
    description: "Movimentou 10.000 kg de volume total acumulado nos aparelhos.",
    category: "Treinos",
    tier: "silver",
    icon: "shield",
    ctaTab: "treinos",
    ctaLabel: "Registrar cargas",
  },
  {
    id: "volume_50t",
    title: "Máquina de ferro (50 toneladas)",
    description: "Superou 50.000 kg de volume acumulado em sessões de musculação.",
    category: "Treinos",
    tier: "gold",
    icon: "target",
    ctaTab: "treinos",
    ctaLabel: "Evoluir cargas",
  },
  {
    id: "hydration_goal",
    title: "Hidratação 100%",
    description: "Atingiu 100% da sua meta diária de água para recuperação muscular.",
    category: "Hábitos",
    tier: "bronze",
    icon: "droplets",
  },
  {
    id: "body_tracker",
    title: "Avaliação em dia",
    description: "Registrou 2 ou mais avaliações físicas para acompanhar sua evolução real.",
    category: "Hábitos",
    tier: "bronze",
    icon: "ruler",
    ctaTab: "evolucao",
    ctaLabel: "Registrar medidas",
  },
  {
    id: "ai_strategist",
    title: "Ficha Personal IA ativa",
    description: "Montou e salvou uma ficha personalizada com o Personal Trainer IA.",
    category: "Estratégia",
    tier: "bronze",
    icon: "sparkles",
    ctaTab: "personal",
    ctaLabel: "Abrir Personal IA",
  },
];

function parseIsoDayMs(iso: string): number {
  const parsed = new Date(`${iso}T12:00:00`).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function computeHistoricalBestStreak(
  workoutHistory: CompletedWorkout[],
  currentStreak: number
): { bestStreak: number; dateFor3?: string; dateFor7?: string } {
  const uniqueDatesAsc = Array.from(
    new Set(workoutHistory.map((w) => w.date).filter(Boolean))
  ).sort();

  if (uniqueDatesAsc.length === 0) {
    return { bestStreak: currentStreak };
  }

  let best = Math.max(1, currentStreak);
  let run = 1;
  let dateFor3: string | undefined;
  let dateFor7: string | undefined;

  for (let i = 1; i < uniqueDatesAsc.length; i++) {
    const prevMs = parseIsoDayMs(uniqueDatesAsc[i - 1]);
    const currMs = parseIsoDayMs(uniqueDatesAsc[i]);
    const diffDays = Math.round((currMs - prevMs) / (1000 * 60 * 60 * 24));
    if (diffDays <= 2) {
      run += 1;
    } else {
      run = 1;
    }
    if (run > best) best = run;
    if (run >= 3 && !dateFor3) dateFor3 = uniqueDatesAsc[i];
    if (run >= 7 && !dateFor7) dateFor7 = uniqueDatesAsc[i];
  }

  return { bestStreak: best, dateFor3, dateFor7 };
}

function computeWeeklyWindowProgress(
  workoutHistory: CompletedWorkout[],
  weeklyTarget: number,
  todayIso: string
): {
  currentWeekDays: number;
  bestWeekDays: number;
  firstWeekCompletedDate?: string;
} {
  const uniqueDatesAsc = Array.from(
    new Set(workoutHistory.map((w) => w.date).filter(Boolean))
  ).sort();

  if (uniqueDatesAsc.length === 0) {
    return { currentWeekDays: 0, bestWeekDays: 0 };
  }

  const dayMs = 1000 * 60 * 60 * 24;
  const todayMs = parseIsoDayMs(todayIso);
  let currentWeekDays = 0;
  for (const d of uniqueDatesAsc) {
    const diff = Math.round((todayMs - parseIsoDayMs(d)) / dayMs);
    if (diff >= 0 && diff <= 6) {
      currentWeekDays += 1;
    }
  }

  let bestWeekDays = 0;
  let firstWeekCompletedDate: string | undefined;
  let left = 0;

  for (let right = 0; right < uniqueDatesAsc.length; right++) {
    const rightMs = parseIsoDayMs(uniqueDatesAsc[right]);
    while (
      left <= right &&
      Math.round((rightMs - parseIsoDayMs(uniqueDatesAsc[left])) / dayMs) > 6
    ) {
      left += 1;
    }
    const windowSize = right - left + 1;
    if (windowSize > bestWeekDays) {
      bestWeekDays = windowSize;
    }
    if (windowSize >= weeklyTarget && !firstWeekCompletedDate) {
      firstWeekCompletedDate = uniqueDatesAsc[right];
    }
  }

  return { currentWeekDays, bestWeekDays, firstWeekCompletedDate };
}

function formatTonProgress(kg: number): string {
  if (kg >= 1000) {
    return `${(kg / 1000).toFixed(1).replace(".", ",")}t`;
  }
  return `${Math.round(kg)} kg`;
}

export function evaluateAchievements(
  state: BiancoAppState,
  metabolism: MetabolicResult,
  streakDays: number,
  todayIso: string
): AchievementProgressItem[] {
  const persisted = state.unlockedBadges || {};
  const workoutsAsc = [...state.workoutHistory].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const totalWorkouts = workoutsAsc.length;
  const totalVolumeKg = workoutsAsc.reduce(
    (acc, item) => acc + Math.max(0, Number(item.totalVolumeKg) || 0),
    0
  );

  // Determine exact dates when volume thresholds were reached
  let runningVol = 0;
  let vol10tDate: string | undefined;
  let vol50tDate: string | undefined;
  for (const w of workoutsAsc) {
    runningVol += Math.max(0, Number(w.totalVolumeKg) || 0);
    if (runningVol >= 10000 && !vol10tDate) vol10tDate = w.date;
    if (runningVol >= 50000 && !vol50tDate) vol50tDate = w.date;
  }

  const weeklyTarget = Math.max(3, Math.min(6, state.profile.weeklyFrequency || 4));
  const { currentWeekDays, bestWeekDays, firstWeekCompletedDate } =
    computeWeeklyWindowProgress(workoutsAsc, weeklyTarget, todayIso);
  const { bestStreak, dateFor3, dateFor7 } = computeHistoricalBestStreak(
    workoutsAsc,
    streakDays
  );

  const waterTarget = Math.max(1000, metabolism.waterTargetMl || 2500);
  const waterConsumed =
    state.water.date === todayIso ? Math.max(0, state.water.consumedMl) : 0;

  const measurementsAsc = [...state.measurements].sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  const measurementCount = measurementsAsc.length;
  const hasSavedPlan = Boolean(state.savedPlan);

  return ACHIEVEMENT_CATALOG.map((def): AchievementProgressItem => {
    const persistedDate = persisted[def.id];
    let current = 0;
    let target = 1;
    let unit = "";
    let conditionMet = false;
    let derivedDate: string | undefined;
    let remainingLabel = "";

    switch (def.id) {
      case "first_workout": {
        target = 1;
        current = Math.min(totalWorkouts, target);
        unit = "treino";
        conditionMet = totalWorkouts >= 1;
        derivedDate = workoutsAsc[0]?.date;
        remainingLabel = conditionMet
          ? "Conquista desbloqueada"
          : "Finalize seu 1º treino na aba Treinos";
        break;
      }
      case "first_week_complete": {
        target = weeklyTarget;
        conditionMet = bestWeekDays >= weeklyTarget;
        current = conditionMet
          ? target
          : Math.min(currentWeekDays, target);
        unit = "dias na semana";
        derivedDate = firstWeekCompletedDate;
        const missing = Math.max(0, target - current);
        remainingLabel = conditionMet
          ? `Meta de ${weeklyTarget}x/semana batida`
          : missing === 1
          ? "Falta 1 treino nesta semana"
          : `Faltam ${missing} treinos nesta semana`;
        break;
      }
      case "streak_3": {
        target = 3;
        conditionMet = bestStreak >= 3;
        current = Math.min(conditionMet ? target : streakDays, target);
        unit = "dias seguidos";
        derivedDate = dateFor3;
        const missing = Math.max(0, target - current);
        remainingLabel = conditionMet
          ? "Sequência de 3 dias atingida"
          : missing === 1
          ? "Falta 1 dia para completar"
          : `Faltam ${missing} dias de sequência`;
        break;
      }
      case "workouts_5": {
        target = 5;
        current = Math.min(totalWorkouts, target);
        unit = "treinos";
        conditionMet = totalWorkouts >= 5;
        derivedDate = workoutsAsc[4]?.date;
        const missing = Math.max(0, target - totalWorkouts);
        remainingLabel = conditionMet
          ? "5 treinos concluídos"
          : missing === 1
          ? "Falta apenas 1 treino"
          : `Faltam ${missing} treinos`;
        break;
      }
      case "workouts_10": {
        target = 10;
        current = Math.min(totalWorkouts, target);
        unit = "treinos";
        conditionMet = totalWorkouts >= 10;
        derivedDate = workoutsAsc[9]?.date;
        const missing = Math.max(0, target - totalWorkouts);
        remainingLabel = conditionMet
          ? "Marca de 10 treinos superada"
          : missing === 1
          ? "Falta apenas 1 treino"
          : `Faltam ${missing} treinos`;
        break;
      }
      case "streak_7": {
        target = 7;
        conditionMet = bestStreak >= 7;
        current = Math.min(conditionMet ? target : streakDays, target);
        unit = "dias seguidos";
        derivedDate = dateFor7;
        const missing = Math.max(0, target - current);
        remainingLabel = conditionMet
          ? "Sequência de 7 dias conquistada"
          : missing === 1
          ? "Falta 1 dia para completar"
          : `Faltam ${missing} dias de sequência`;
        break;
      }
      case "workouts_25": {
        target = 25;
        current = Math.min(totalWorkouts, target);
        unit = "treinos";
        conditionMet = totalWorkouts >= 25;
        derivedDate = workoutsAsc[24]?.date;
        const missing = Math.max(0, target - totalWorkouts);
        remainingLabel = conditionMet
          ? "25 sessões de disciplina"
          : missing === 1
          ? "Falta apenas 1 treino"
          : `Faltam ${missing} treinos`;
        break;
      }
      case "volume_10t": {
        target = 10000;
        current = Math.min(Math.round(totalVolumeKg), target);
        unit = "kg";
        conditionMet = totalVolumeKg >= 10000;
        derivedDate = vol10tDate;
        const missingKg = Math.max(0, Math.round(target - totalVolumeKg));
        remainingLabel = conditionMet
          ? "10 toneladas levantadas"
          : `Faltam ${formatTonProgress(missingKg)} de volume`;
        break;
      }
      case "volume_50t": {
        target = 50000;
        current = Math.min(Math.round(totalVolumeKg), target);
        unit = "kg";
        conditionMet = totalVolumeKg >= 50000;
        derivedDate = vol50tDate;
        const missingKg = Math.max(0, Math.round(target - totalVolumeKg));
        remainingLabel = conditionMet
          ? "50 toneladas levantadas"
          : `Faltam ${formatTonProgress(missingKg)} de volume`;
        break;
      }
      case "hydration_goal": {
        target = waterTarget;
        conditionMet = waterConsumed >= waterTarget || Boolean(persistedDate);
        current = conditionMet ? target : Math.min(waterConsumed, target);
        unit = "ml";
        derivedDate = waterConsumed >= waterTarget ? todayIso : undefined;
        const missingMl = Math.max(0, waterTarget - waterConsumed);
        remainingLabel = conditionMet
          ? "Meta diária de hidratação batida"
          : `Faltam ${missingMl} ml hoje`;
        break;
      }
      case "body_tracker": {
        target = 2;
        current = Math.min(measurementCount, target);
        unit = "avaliações";
        conditionMet = measurementCount >= 2;
        derivedDate = measurementsAsc[1]?.date;
        const missing = Math.max(0, target - measurementCount);
        remainingLabel = conditionMet
          ? "Histórico comparativo ativo"
          : missing === 1
          ? "Registre mais 1 avaliação física"
          : "Registre 2 avaliações na aba Evolução";
        break;
      }
      case "ai_strategist": {
        target = 1;
        conditionMet = hasSavedPlan || Boolean(persistedDate);
        current = conditionMet ? 1 : 0;
        unit = "ficha";
        derivedDate = state.savedPlan?.savedAt?.slice(0, 10);
        remainingLabel = conditionMet
          ? "Ficha personalizada salva"
          : "Salve uma ficha no Personal IA";
        break;
      }
    }

    const unlocked = conditionMet || Boolean(persistedDate);
    const percent = unlocked
      ? 100
      : Math.min(99, Math.max(0, Math.round((current / Math.max(1, target)) * 100)));
    const unlockedDate = unlocked
      ? persistedDate || derivedDate || todayIso
      : undefined;

    return {
      ...def,
      current: unlocked ? target : current,
      target,
      unit,
      percent,
      unlocked,
      unlockedDate,
      remainingLabel,
    };
  });
}

export function formatAchievementProgressValue(
  item: AchievementProgressItem
): string {
  if (item.unit === "kg") {
    return `${formatTonProgress(item.current)} / ${formatTonProgress(item.target)}`;
  }
  if (item.unit === "ml") {
    return `${(item.current / 1000).toFixed(2)} L / ${(item.target / 1000).toFixed(2)} L`;
  }
  return `${item.current} / ${item.target} ${item.unit}`;
}

export function formatShortPtDate(isoDate?: string): string {
  if (!isoDate || !/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(isoDate)) return "Hoje";
  const d = new Date(`${isoDate}T12:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return new Intl.DateTimeFormat("pt-BR", {
    day: "2-digit",
    month: "short",
  })
    .format(d)
    .replace(".", "");
}
