export type TabId =
  | "inicio"
  | "treinos"
  | "biblioteca"
  | "personal"
  | "nutri"
  | "evolucao"
  | "perfil"
  | "admin";

export type UserRole = "user" | "admin";
export type UserAccessStatus = "pendente" | "autorizado" | "bloqueado";

export interface AccountAccessState {
  fullName: string;
  username: string;
  email: string;
  role: UserRole;
  status: UserAccessStatus;
  loaded: boolean;
  canListDirectory: boolean;
  error?: string | null;
}

export interface AdminUserRecord {
  uid: string;
  fullName: string;
  username: string;
  email: string;
  role: UserRole;
  status: UserAccessStatus;
  avatar: string;
  fitnessLevel: TrainingLevel;
  mainGoal: string;
  currentStreak: number;
  onboardingCompleted: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

export type EquipmentType =
  | "Máquina Articulada"
  | "Polia/Cross"
  | "Peso Livre"
  | "Cardio"
  | "Peso Corporal";

export type MuscleGroupId =
  | "costas"
  | "peito"
  | "quadriceps"
  | "posterior_gluteos"
  | "ombros"
  | "biceps_triceps"
  | "abdomen_panturrilha"
  | "lombar_joelho";

export interface ExerciseGuide {
  machineSetup: string;
  posture: string;
  breathing?: string;
  commonMistake: string;
}

export interface ExerciseItem {
  id: string;
  name: string;
  muscleGroup: MuscleGroupId;
  muscleLabel: string;
  equipment: EquipmentType;
  imageUrl: string;
  secondaryImageUrl: string;
  defaultSets: number;
  defaultReps: string;
  defaultRest: number;
  defaultWeightKg: number;
  guide: ExerciseGuide;
  alternatives: string[];
}

export interface WorkoutCombo {
  id: string;
  title: string;
  subtitle: string;
  durationMin: number;
  focusTag: string;
  exerciseIds: string[];
}

export interface GymModality {
  id: string;
  category: "Cardio" | "Funcional" | "Spinning" | "Pilates/Mobilidade";
  title: string;
  equipment: EquipmentType;
  imageUrl?: string;
  secondaryImageUrl?: string;
  protocol: string;
  durationMin: number;
  intensity: string;
  calorieEstimate: string;
  tip: string;
}

export type ActivityLevel =
  | "sedentario"
  | "leve"
  | "moderado"
  | "intenso"
  | "atleta";

export type DeficitMode = "moderado" | "acelerado";

export type TrainingLevel = "Iniciante" | "Intermediário" | "Avançado";

export type WeeklyFrequency = 3 | 4 | 5 | 6;

export interface StudentProfile {
  name: string;
  weightKg: number;
  targetWeightKg: number;
  heightCm: number;
  age: number;
  sex: "M" | "F";
  activityLevel: ActivityLevel;
  deficitMode: DeficitMode;
  level: TrainingLevel;
  weeklyFrequency: WeeklyFrequency;
  availableTime: 30 | 45 | 60 | 90;
  exercisesPerWorkout?: number;
  muscleToday: string;
  avatar: string; // preset ID (e.g. "preset:orange") or compressed data URL / photo URL
  onboardingCompleted: boolean;
}

export interface StudentGoals {
  primary: string;
  focuses: string[];
  customNote: string;
}

export interface ExerciseLogEntry {
  sets: number;
  reps: string;
  weightKg: number;
  lastWeightKg: number;
  completedSets: boolean[];
}

export interface SavedAiPlan {
  id: string;
  title: string;
  muscleToday: string;
  content: string;
  savedAt: string;
  matchedExerciseIds: string[];
}

export type CardioIntensity = "Leve" | "Moderado" | "Intenso" | "HIIT";

export interface CardioSessionInput {
  date?: string; // YYYY-MM-DD
  equipment: string;
  durationMin: number;
  distanceKm?: number;
  caloriesKcal: number;
  intensity: CardioIntensity;
  notes?: string;
}

export interface CompletedWorkout {
  id: string;
  date: string; // YYYY-MM-DD
  title: string;
  muscleGroup: string;
  totalVolumeKg: number;
  setsCompleted: number;
  durationMin: number;
  distanceKm?: number;
  caloriesKcal?: number;
  intensity?: CardioIntensity;
}

export interface BodyMeasurement {
  id: string;
  date: string; // YYYY-MM-DD
  weightKg: number;
  neckCm?: number;
  chestCm?: number;
  waistCm?: number;
  abdomenCm?: number;
  hipCm?: number;
  armRightCm?: number;
  armLeftCm?: number;
  thighRightCm?: number;
  thighLeftCm?: number;
  calfCm?: number;
  // Legacy aliases kept for backward compatibility
  armCm?: number;
  thighCm?: number;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  isWorkoutPlan?: boolean;
}

export type WaterReminderIntervalMin = 30 | 45 | 60 | 90 | 120;

export interface WaterReminderSettings {
  enabled: boolean;
  intervalMin: WaterReminderIntervalMin;
  startHour: number; // 0..23
  endHour: number; // 0..23
  soundEnabled: boolean;
  browserNotificationEnabled: boolean;
  lastRemindedAt: number | null; // epoch ms
}

export interface WaterState {
  date: string;
  consumedMl: number;
}

export type AchievementCategory =
  | "Consistência"
  | "Treinos"
  | "Hábitos"
  | "Estratégia";

export type AchievementTier = "bronze" | "silver" | "gold";

export type AchievementIconKey =
  | "dumbbell"
  | "calendar"
  | "flame"
  | "trophy"
  | "award"
  | "zap"
  | "crown"
  | "droplets"
  | "ruler"
  | "sparkles"
  | "target"
  | "shield";

export interface AchievementProgressItem {
  id: string;
  title: string;
  description: string;
  category: AchievementCategory;
  tier: AchievementTier;
  icon: AchievementIconKey;
  current: number;
  target: number;
  unit: string;
  percent: number;
  unlocked: boolean;
  unlockedDate?: string; // YYYY-MM-DD
  remainingLabel: string;
  ctaTab?: TabId;
  ctaLabel?: string;
}

export interface BiancoAppState {
  profile: StudentProfile;
  goals: StudentGoals;
  water: WaterState;
  waterReminder: WaterReminderSettings;
  activeComboId: string;
  exerciseLogs: Record<string, ExerciseLogEntry>;
  swappedExercises: Record<string, string>;
  savedPlan: SavedAiPlan | null;
  workoutHistory: CompletedWorkout[];
  measurements: BodyMeasurement[];
  personalChat: ChatMessage[];
  nutriChat: ChatMessage[];
  unlockedBadges: Record<string, string>; // badgeId -> YYYY-MM-DD
}

export interface MetabolicResult {
  bmi: number;
  bmiLabel: string;
  bmiTone: "info" | "healthy" | "warning" | "alert";
  tmb: number;
  get: number;
  calorieTarget: number;
  deficitKcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  waterTargetMl: number;
  activityLabel: string;
  deficitLabel: string;
}

export interface ToastOptions {
  actionLabel?: string;
  onAction?: () => void;
  durationMs?: number;
}

export interface ToastItem {
  id: string;
  message: string;
  tone?: "success" | "info" | "warning";
  actionLabel?: string;
  onAction?: () => void;
}
