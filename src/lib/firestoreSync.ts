import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  Unsubscribe,
  updateDoc,
  where,
  writeBatch,
} from "firebase/firestore";
import { EXERCISE_MAP } from "../data/exercises";
import {
  AchievementCategory,
  AdminUserRecord,
  BiancoAppState,
  BodyMeasurement,
  ChatMessage,
  CompletedWorkout,
  ExerciseLogEntry,
  MetabolicResult,
  SavedAiPlan,
  StudentGoals,
  StudentProfile,
  TrainingLevel,
  UserAccessStatus,
  UserRole,
  WeeklyFrequency,
} from "../types";
import { auth, db, handleFirestoreError, OperationType } from "./firebase";

export const BOOTSTRAPPED_ADMIN_EMAILS = [
  "contato.servicosgama@gmail.com",
  "contatoservicosgama@gmail.com",
  "contato.businessgama@gmail.com",
] as const;

export const INTERNAL_USERNAME_DOMAIN = "biancofit.app";

export function normalizeEmail(email?: string | null): string {
  return (email ?? "").trim().toLowerCase();
}

export function normalizeUsername(raw?: string | null): string {
  return (raw ?? "")
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9._-]/g, "")
    .slice(0, 40);
}

export function deriveUsernameFromEmail(email?: string | null): string {
  const norm = normalizeEmail(email);
  if (!norm) return "";
  const localPart = norm.includes("@") ? norm.split("@")[0] : norm;
  const cleaned = normalizeUsername(localPart);
  return cleaned.length >= 2 ? cleaned : "";
}

export function resolveAuthIdentifier(rawInput: string): {
  email: string;
  username: string;
  isDirectEmail: boolean;
} {
  const compact = (rawInput ?? "").trim().replace(/\s+/g, "").toLowerCase();
  if (!compact) {
    return { email: "", username: "", isDirectEmail: false };
  }
  if (compact.includes("@")) {
    return {
      email: compact,
      username: deriveUsernameFromEmail(compact),
      isDirectEmail: true,
    };
  }
  const username = normalizeUsername(compact);
  return {
    email: username ? `${username}@${INTERNAL_USERNAME_DOMAIN}` : "",
    username,
    isDirectEmail: false,
  };
}

export function isSyntheticUsernameEmail(email?: string | null): boolean {
  return normalizeEmail(email).endsWith(`@${INTERNAL_USERNAME_DOMAIN}`);
}

export function formatStudentHandle(username?: string | null, email?: string | null): string {
  const clean = normalizeUsername(username) || deriveUsernameFromEmail(email);
  return clean ? `@${clean}` : "";
}

export function isBootstrappedAdminEmail(email?: string | null): boolean {
  const norm = normalizeEmail(email);
  return (BOOTSTRAPPED_ADMIN_EMAILS as readonly string[]).includes(norm);
}

function parseUserRole(val: unknown, fallback: UserRole): UserRole {
  return val === "admin" || val === "user" ? val : fallback;
}

function parseUserStatus(val: unknown, fallback: UserAccessStatus): UserAccessStatus {
  return val === "pendente" || val === "autorizado" || val === "bloqueado"
    ? val
    : fallback;
}

const VALID_ID_REGEX = /[^a-zA-Z0-9_-]/g;

function sanitizeId(raw: string, fallbackPrefix: string): string {
  const cleaned = raw.replace(VALID_ID_REGEX, "_").slice(0, 120);
  return cleaned.length > 0 ? cleaned : `${fallbackPrefix}_${Date.now()}`;
}

function clampStr(val: string, maxLen: number, fallback = ""): string {
  const trimmed = (val ?? "").trim();
  if (!trimmed) return fallback;
  return trimmed.slice(0, maxLen);
}

function clampNum(val: number, min: number, max: number): number {
  if (!Number.isFinite(val)) return min;
  return Math.min(max, Math.max(min, val));
}

function clampInt(val: number, min: number, max: number): number {
  return Math.round(clampNum(val, min, max));
}

function sanitizeDateIso(dateStr: string): string {
  if (/^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(dateStr)) return dateStr;
  return new Date().toISOString().slice(0, 10);
}

function sanitizeAvatar(val?: string): string {
  if (!val) return "preset:orange";
  if (val.length > 65000) return "preset:orange";
  return val;
}

export interface CloudProfileEnsureResult {
  existed: boolean;
  fullName: string;
  username: string;
  email: string;
  role: UserRole;
  status: UserAccessStatus;
}

export async function ensureCloudUserProfile(
  uid: string,
  displayName: string | null,
  email: string | null,
  emailVerified: boolean,
  localState: BiancoAppState,
  metabolism: MetabolicResult,
  streakDays: number,
  preferredUsername?: string | null
): Promise<CloudProfileEnsureResult> {
  const userPath = `users/${uid}`;
  const userRef = doc(db, "users", uid);
  const normalizedEmail = normalizeEmail(email);
  const resolvedUsername =
    normalizeUsername(preferredUsername) || deriveUsernameFromEmail(normalizedEmail);
  const isVerifiedAdminBoot = emailVerified && isBootstrappedAdminEmail(normalizedEmail);
  const defaultRole: UserRole = isVerifiedAdminBoot ? "admin" : "user";
  const defaultStatus: UserAccessStatus = isVerifiedAdminBoot ? "autorizado" : "pendente";

  const isSessionActive = () => auth.currentUser?.uid === uid;

  if (!isSessionActive()) {
    return {
      existed: false,
      fullName: clampStr(displayName || localState.profile.name, 80, "Aluno Personal Nutri Fit"),
      username: resolvedUsername,
      email: normalizedEmail,
      role: defaultRole,
      status: defaultStatus,
    };
  }

  let existed = false;
  let existingData: Record<string, unknown> | null = null;

  try {
    const snap = await getDoc(userRef);
    existed = snap.exists();
    if (existed) {
      existingData = snap.data() as Record<string, unknown>;
    }
  } catch (error) {
    if (!isSessionActive()) {
      return {
        existed: false,
        fullName: clampStr(displayName || localState.profile.name, 80, "Aluno Personal Nutri Fit"),
        username: resolvedUsername,
        email: normalizedEmail,
        role: defaultRole,
        status: defaultStatus,
      };
    }
    handleFirestoreError(error, OperationType.GET, userPath);
  }

  if (!existed) {
    const lastWorkoutDate =
      localState.workoutHistory[0]?.date &&
      /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(localState.workoutHistory[0].date)
        ? localState.workoutHistory[0].date
        : "";

    const fullName = clampStr(
      displayName && displayName.trim()
        ? displayName
        : localState.profile.name,
      80,
      "Aluno Personal Nutri Fit"
    );

    const safeWeeklyFrequency: WeeklyFrequency =
      localState.profile.weeklyFrequency === 3 ||
      localState.profile.weeklyFrequency === 4 ||
      localState.profile.weeklyFrequency === 5 ||
      localState.profile.weeklyFrequency === 6
        ? localState.profile.weeklyFrequency
        : 4;

    const safeFitnessLevel: TrainingLevel =
      localState.profile.level === "Iniciante" ||
      localState.profile.level === "Intermediário" ||
      localState.profile.level === "Avançado"
        ? localState.profile.level
        : "Intermediário";

    const safeAvailableMinutes: 30 | 45 | 60 | 90 =
      localState.profile.availableTime === 30 ||
      localState.profile.availableTime === 45 ||
      localState.profile.availableTime === 60 ||
      localState.profile.availableTime === 90
        ? localState.profile.availableTime
        : 60;

    const payload: Record<string, unknown> = {
      ownerId: uid,
      email: normalizedEmail,
      role: defaultRole,
      status: defaultStatus,
      fullName,
      avatar: sanitizeAvatar(localState.profile.avatar),
      onboardingCompleted: Boolean(localState.profile.onboardingCompleted),
      weeklyFrequency: safeWeeklyFrequency,
      mainGoal: clampStr(
        localState.goals.primary,
        120,
        "Perder peso e definir o corpo"
      ),
      secondaryGoals: (Array.isArray(localState.goals.focuses)
        ? localState.goals.focuses
        : []
      )
        .slice(0, 2)
        .map((g) => clampStr(String(g || ""), 120))
        .filter(Boolean),
      customGoalText: clampStr(localState.goals.customNote, 600),
      fitnessLevel: safeFitnessLevel,
      availableMinutes: safeAvailableMinutes,
      muscleToday: clampStr(localState.profile.muscleToday, 100, "Costas + Bíceps"),
      activeComboId: sanitizeId(localState.activeComboId, "costas_biceps").slice(0, 64),
      dailyWaterGoalMl: clampInt(metabolism.waterTargetMl, 1000, 10000),
      currentStreak: clampInt(streakDays, 0, 10000),
      lastWorkoutDate,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    };

    if (resolvedUsername.length >= 2) {
      payload.username = resolvedUsername;
    }

    try {
      await setDoc(userRef, payload);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, userPath);
    }

    if (defaultStatus === "autorizado") {
      await upsertNutritionProfile(uid, localState.profile, metabolism);
      await upsertDailyWaterLog(uid, localState.water.date, localState.water.consumedMl);
    }

    return {
      existed: false,
      fullName,
      username: resolvedUsername,
      email: normalizedEmail,
      role: defaultRole,
      status: defaultStatus,
    };
  }

  const storedFullName =
    typeof existingData?.fullName === "string" && existingData.fullName.trim()
      ? existingData.fullName.trim()
      : clampStr(displayName || localState.profile.name, 80, "Aluno Personal Nutri Fit");

  const storedUsername =
    typeof existingData?.username === "string" && existingData.username.trim()
      ? normalizeUsername(existingData.username)
      : resolvedUsername;

  // One-time legacy profile RBAC backfill when role/status were not yet stored
  const hasStoredRole = typeof existingData?.role === "string";
  const hasStoredStatus = typeof existingData?.status === "string";

  if (!hasStoredRole && !hasStoredStatus && normalizedEmail) {
    const backfill: Record<string, unknown> = {
      email: normalizedEmail,
      role: defaultRole,
      status: defaultStatus,
      updatedAt: serverTimestamp(),
    };
    if (storedUsername.length >= 2) {
      backfill.username = storedUsername;
    }

    try {
      await updateDoc(userRef, backfill);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, userPath);
    }

    return {
      existed: true,
      fullName: storedFullName,
      username: storedUsername,
      email: normalizedEmail,
      role: defaultRole,
      status: defaultStatus,
    };
  }

  const resolvedEmail =
    typeof existingData?.email === "string" && existingData.email.trim()
      ? normalizeEmail(existingData.email)
      : normalizedEmail;
  const resolvedRole = isVerifiedAdminBoot
    ? "admin"
    : parseUserRole(existingData?.role, defaultRole);
  const resolvedStatus = isVerifiedAdminBoot
    ? "autorizado"
    : parseUserStatus(existingData?.status, defaultStatus);

  // Promote previously unverified bootstrapped admin once email_verified becomes true
  if (
    isVerifiedAdminBoot &&
    (existingData?.role !== "admin" || existingData?.status !== "autorizado")
  ) {
    try {
      await updateDoc(userRef, {
        role: "admin",
        status: "autorizado",
        updatedAt: serverTimestamp(),
      });
    } catch {
      // Non-fatal: verified bootstrapped admin still has full access via rules
    }
  }

  return {
    existed: true,
    fullName: storedFullName,
    username: storedUsername || deriveUsernameFromEmail(resolvedEmail),
    email: resolvedEmail,
    role: resolvedRole,
    status: resolvedStatus,
  };
}

export async function fetchCloudUserAccess(
  uid: string,
  fallbackEmail?: string | null,
  emailVerified = false,
  fallbackName?: string | null
): Promise<{
  fullName: string;
  username: string;
  email: string;
  role: UserRole;
  status: UserAccessStatus;
}> {
  const userPath = `users/${uid}`;
  const normalizedFallback = normalizeEmail(fallbackEmail);
  const fallbackUsername = deriveUsernameFromEmail(normalizedFallback);
  const isVerifiedAdminBoot = emailVerified && isBootstrappedAdminEmail(normalizedFallback);
  const safeFallbackName = clampStr(fallbackName || "", 80, "Aluno Personal Nutri Fit");

  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (!snap.exists()) {
      return {
        fullName: safeFallbackName,
        username: fallbackUsername,
        email: normalizedFallback,
        role: isVerifiedAdminBoot ? "admin" : "user",
        status: isVerifiedAdminBoot ? "autorizado" : "pendente",
      };
    }
    const d = snap.data();
    const resolvedEmail =
      typeof d.email === "string" && d.email.trim()
        ? normalizeEmail(d.email)
        : normalizedFallback;
    const resolvedUsername =
      typeof d.username === "string" && d.username.trim()
        ? normalizeUsername(d.username)
        : deriveUsernameFromEmail(resolvedEmail);
    const resolvedBoot = emailVerified && isBootstrappedAdminEmail(resolvedEmail);
    const resolvedFullName =
      typeof d.fullName === "string" && d.fullName.trim()
        ? d.fullName.trim()
        : safeFallbackName;

    if (resolvedBoot && (d.role !== "admin" || d.status !== "autorizado")) {
      try {
        await updateDoc(doc(db, "users", uid), {
          role: "admin",
          status: "autorizado",
          updatedAt: serverTimestamp(),
        });
      } catch {
        // Non-fatal
      }
    }

    return {
      fullName: resolvedFullName,
      username: resolvedUsername,
      email: resolvedEmail,
      role: resolvedBoot ? "admin" : parseUserRole(d.role, "user"),
      status: resolvedBoot ? "autorizado" : parseUserStatus(d.status, "pendente"),
    };
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, userPath);
    throw error;
  }
}

function mapUserDocToAdminRecord(
  docId: string,
  d: Record<string, unknown>
): AdminUserRecord & { _createdMs: number } {
  const email = typeof d.email === "string" ? normalizeEmail(d.email) : "";
  const bootAdmin = isBootstrappedAdminEmail(email);
  const role: UserRole = bootAdmin ? "admin" : parseUserRole(d.role, "user");
  const status: UserAccessStatus = bootAdmin
    ? "autorizado"
    : parseUserStatus(d.status, "pendente");

  const fitnessLevel: TrainingLevel =
    d.fitnessLevel === "Iniciante" ||
    d.fitnessLevel === "Intermediário" ||
    d.fitnessLevel === "Avançado"
      ? d.fitnessLevel
      : "Intermediário";

  const username =
    typeof d.username === "string" && d.username.trim()
      ? normalizeUsername(d.username)
      : deriveUsernameFromEmail(email);

  const createdTs = d.createdAt as
    | { toDate?: () => Date; toMillis?: () => number }
    | undefined;
  const updatedTs = d.updatedAt as
    | { toDate?: () => Date; toMillis?: () => number }
    | undefined;

  return {
    uid: docId,
    fullName:
      typeof d.fullName === "string" && d.fullName.trim()
        ? d.fullName.trim()
        : "Aluno Personal Nutri Fit",
    username,
    email,
    role,
    status,
    avatar: typeof d.avatar === "string" ? d.avatar : "preset:orange",
    fitnessLevel,
    mainGoal:
      typeof d.mainGoal === "string" && d.mainGoal.trim()
        ? d.mainGoal.trim()
        : "Perder peso e definir o corpo",
    currentStreak:
      typeof d.currentStreak === "number" && Number.isFinite(d.currentStreak)
        ? d.currentStreak
        : 0,
    onboardingCompleted: Boolean(d.onboardingCompleted),
    createdAt: createdTs?.toDate?.()?.toISOString?.() ?? null,
    updatedAt: updatedTs?.toDate?.()?.toISOString?.() ?? null,
    _createdMs: createdTs?.toMillis?.() ?? updatedTs?.toMillis?.() ?? 0,
  };
}

export async function listAllCloudUsers(): Promise<AdminUserRecord[]> {
  const colPath = "users";
  try {
    const snap = await getDocs(collection(db, "users"));

    return snap.docs
      .map((docSnap) =>
        mapUserDocToAdminRecord(docSnap.id, docSnap.data() as Record<string, unknown>)
      )
      .sort((a, b) => b._createdMs - a._createdMs)
      .map(({ _createdMs: _unused, ...record }) => record);
  } catch (error) {
    handleFirestoreError(error, OperationType.LIST, colPath);
    throw error;
  }
}

export function subscribeAllCloudUsers(
  onUsers: (users: AdminUserRecord[]) => void,
  onError: (err: unknown) => void
): Unsubscribe {
  const colPath = "users";
  return onSnapshot(
    collection(db, "users"),
    (snap) => {
      const records = snap.docs
        .map((docSnap) =>
          mapUserDocToAdminRecord(
            docSnap.id,
            docSnap.data() as Record<string, unknown>
          )
        )
        .sort((a, b) => b._createdMs - a._createdMs)
        .map(({ _createdMs: _unused, ...record }) => record);
      onUsers(records);
    },
    (error) => {
      try {
        handleFirestoreError(error, OperationType.LIST, colPath);
      } catch (wrapped) {
        onError(wrapped);
      }
    }
  );
}

export function subscribeCloudUserAccess(
  uid: string,
  fallbackEmail: string | null | undefined,
  emailVerified: boolean,
  fallbackName: string | null | undefined,
  onChange: (access: {
    fullName: string;
    username: string;
    email: string;
    role: UserRole;
    status: UserAccessStatus;
  }) => void,
  onError?: (err: unknown) => void
): Unsubscribe {
  const userPath = `users/${uid}`;
  const normalizedFallback = normalizeEmail(fallbackEmail);
  const safeFallbackName = clampStr(fallbackName || "", 80, "Aluno Personal Nutri Fit");

  return onSnapshot(
    doc(db, "users", uid),
    (snap) => {
      if (!snap.exists()) return;
      const d = snap.data() as Record<string, unknown>;
      const resolvedEmail =
        typeof d.email === "string" && d.email.trim()
          ? normalizeEmail(d.email)
          : normalizedFallback;
      const resolvedUsername =
        typeof d.username === "string" && d.username.trim()
          ? normalizeUsername(d.username)
          : deriveUsernameFromEmail(resolvedEmail);
      const resolvedBoot = emailVerified && isBootstrappedAdminEmail(resolvedEmail);
      const resolvedFullName =
        typeof d.fullName === "string" && d.fullName.trim()
          ? d.fullName.trim()
          : safeFallbackName;

      onChange({
        fullName: resolvedFullName,
        username: resolvedUsername,
        email: resolvedEmail,
        role: resolvedBoot ? "admin" : parseUserRole(d.role, "user"),
        status: resolvedBoot ? "autorizado" : parseUserStatus(d.status, "pendente"),
      });
    },
    (error) => {
      if (auth.currentUser?.uid !== uid) return;
      try {
        handleFirestoreError(error, OperationType.GET, userPath);
      } catch (wrapped) {
        onError?.(wrapped);
      }
    }
  );
}

export async function updateCloudUserAccess(
  targetUid: string,
  nextRole: UserRole,
  nextStatus: UserAccessStatus
): Promise<void> {
  const safeUid = sanitizeId(targetUid, "user");
  const userPath = `users/${safeUid}`;
  try {
    await updateDoc(doc(db, "users", safeUid), {
      role: nextRole,
      status: nextStatus,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
    throw error;
  }
}

export async function updateCloudUserProfile(
  uid: string,
  profile: StudentProfile,
  goals: StudentGoals,
  activeComboId: string,
  waterGoalMl: number,
  streakDays: number,
  lastWorkoutDate: string
): Promise<void> {
  const userPath = `users/${uid}`;
  const userRef = doc(db, "users", uid);
  try {
    await updateDoc(userRef, {
      fullName: clampStr(profile.name, 80, "Aluno Personal Nutri Fit"),
      avatar: sanitizeAvatar(profile.avatar),
      onboardingCompleted: Boolean(profile.onboardingCompleted),
      weeklyFrequency: profile.weeklyFrequency,
      mainGoal: clampStr(goals.primary, 120, "Perder peso e definir o corpo"),
      secondaryGoals: goals.focuses
        .slice(0, 2)
        .map((g) => clampStr(g, 120))
        .filter(Boolean),
      customGoalText: clampStr(goals.customNote, 600),
      fitnessLevel: profile.level,
      availableMinutes: profile.availableTime,
      muscleToday: clampStr(profile.muscleToday, 100, "Costas + Bíceps"),
      activeComboId: sanitizeId(activeComboId, "costas_biceps").slice(0, 64),
      dailyWaterGoalMl: clampInt(waterGoalMl, 1000, 10000),
      currentStreak: clampInt(streakDays, 0, 10000),
      lastWorkoutDate:
        lastWorkoutDate && /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(lastWorkoutDate)
          ? lastWorkoutDate
          : "",
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, userPath);
  }
}

export async function upsertNutritionProfile(
  uid: string,
  profile: StudentProfile,
  metabolism: MetabolicResult
): Promise<void> {
  const docPath = `users/${uid}/nutrition/profile`;
  const ref = doc(db, "users", uid, "nutrition", "profile");

  const payload = {
    weightKg: clampNum(profile.weightKg, 30, 300),
    heightCm: clampNum(profile.heightCm, 110, 240),
    age: clampInt(profile.age, 14, 100),
    sex: profile.sex,
    activityLevel: profile.activityLevel,
    deficitMode: profile.deficitMode,
    targetWeightKg: clampNum(profile.targetWeightKg, 30, 300),
    tmbKcal: clampInt(metabolism.tmb, 800, 6000),
    getKcal: clampInt(metabolism.get, 900, 9000),
    targetCalories: clampInt(metabolism.calorieTarget, 1000, 8500),
    proteinG: clampInt(metabolism.proteinG, 40, 500),
    carbsG: clampInt(metabolism.carbsG, 20, 1000),
    fatG: clampInt(metabolism.fatG, 20, 300),
    waterMl: clampInt(metabolism.waterTargetMl, 1000, 10000),
    updatedAt: serverTimestamp(),
  };

  let existsSnap = false;
  try {
    const snap = await getDoc(ref);
    existsSnap = snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath);
  }

  try {
    if (existsSnap) {
      await updateDoc(ref, payload);
    } else {
      await setDoc(ref, {
        userId: uid,
        ...payload,
        createdAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(
      error,
      existsSnap ? OperationType.UPDATE : OperationType.CREATE,
      docPath
    );
  }
}

export async function upsertDailyWaterLog(
  uid: string,
  dateIso: string,
  amountMl: number
): Promise<void> {
  const safeDate = sanitizeDateIso(dateIso);
  const docPath = `users/${uid}/dailyWaterLogs/${safeDate}`;
  const ref = doc(db, "users", uid, "dailyWaterLogs", safeDate);

  let existsSnap = false;
  try {
    const snap = await getDoc(ref);
    existsSnap = snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath);
  }

  try {
    if (existsSnap) {
      await updateDoc(ref, {
        amountMl: clampInt(amountMl, 0, 15000),
        updatedAt: serverTimestamp(),
      });
    } else {
      await setDoc(ref, {
        userId: uid,
        logDate: safeDate,
        amountMl: clampInt(amountMl, 0, 15000),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(
      error,
      existsSnap ? OperationType.UPDATE : OperationType.CREATE,
      docPath
    );
  }
}

export async function saveCloudWorkoutPlan(
  uid: string,
  plan: SavedAiPlan
): Promise<void> {
  const safeId = sanitizeId(plan.id, "plan");
  const docPath = `users/${uid}/savedWorkouts/${safeId}`;
  const ref = doc(db, "users", uid, "savedWorkouts", safeId);

  try {
    await setDoc(ref, {
      userId: uid,
      title: clampStr(plan.title, 120, "Ficha Personal IA"),
      category: clampStr(plan.muscleToday, 100, "Treino Presencial"),
      source: "personal_ia",
      content: clampStr(plan.content, 12000, "Treino salvo"),
      matchedExerciseIds: plan.matchedExerciseIds
        .slice(0, 20)
        .map((id) => sanitizeId(id, "ex")),
      isActive: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }
}

export async function deleteCloudWorkoutPlan(
  uid: string,
  planId: string
): Promise<void> {
  const safeId = sanitizeId(planId, "plan");
  const docPath = `users/${uid}/savedWorkouts/${safeId}`;
  try {
    await deleteDoc(doc(db, "users", uid, "savedWorkouts", safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export async function createCloudWorkoutSession(
  uid: string,
  session: CompletedWorkout
): Promise<void> {
  const safeId = sanitizeId(session.id, "session");
  const docPath = `users/${uid}/workoutSessions/${safeId}`;
  try {
    await setDoc(doc(db, "users", uid, "workoutSessions", safeId), {
      userId: uid,
      title: clampStr(session.title, 120, "Treino Personal Nutri Fit"),
      category: clampStr(session.muscleGroup, 80, "Musculação"),
      durationMinutes: clampInt(session.durationMin, 1, 480),
      totalVolumeKg: clampNum(session.totalVolumeKg, 0, 500000),
      setsCompleted: clampInt(session.setsCompleted, 0, 200),
      completedDate: sanitizeDateIso(session.date),
      completedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }
}

export async function deleteCloudWorkoutSession(
  uid: string,
  sessionId: string
): Promise<void> {
  const safeId = sanitizeId(sessionId, "session");
  const docPath = `users/${uid}/workoutSessions/${safeId}`;
  try {
    await deleteDoc(doc(db, "users", uid, "workoutSessions", safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export async function upsertCloudExerciseLoad(
  uid: string,
  exerciseId: string,
  log: ExerciseLogEntry
): Promise<void> {
  const safeId = sanitizeId(exerciseId, "ex");
  const ex = EXERCISE_MAP[exerciseId];
  const docPath = `users/${uid}/exerciseLoads/${safeId}`;
  const ref = doc(db, "users", uid, "exerciseLoads", safeId);

  const payload = {
    exerciseName: clampStr(ex?.name || exerciseId, 120, "Exercício"),
    muscleGroup: clampStr(ex?.muscleLabel || "Geral", 60, "Geral"),
    equipmentType: clampStr(ex?.equipment || "Máquina Articulada", 60, "Máquina Articulada"),
    sets: clampInt(log.sets, 1, 12),
    reps: clampStr(log.reps, 40, "10-12"),
    weightKg: clampNum(log.weightKg, 0, 1000),
    lastWeightKg: clampNum(log.lastWeightKg, 0, 1000),
    updatedAt: serverTimestamp(),
  };

  let existsSnap = false;
  try {
    const snap = await getDoc(ref);
    existsSnap = snap.exists();
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath);
  }

  try {
    if (existsSnap) {
      await updateDoc(ref, payload);
    } else {
      await setDoc(ref, {
        userId: uid,
        exerciseId: safeId,
        ...payload,
      });
    }
  } catch (error) {
    handleFirestoreError(
      error,
      existsSnap ? OperationType.UPDATE : OperationType.CREATE,
      docPath
    );
  }
}

export async function createCloudMeasurement(
  uid: string,
  entry: BodyMeasurement
): Promise<void> {
  const safeId = sanitizeId(entry.id, "meas");
  const docPath = `users/${uid}/bodyMeasurements/${safeId}`;
  const payload: Record<string, unknown> = {
    userId: uid,
    weightKg: clampNum(entry.weightKg, 30, 300),
    measuredAt: sanitizeDateIso(entry.date),
    createdAt: serverTimestamp(),
  };

  if (entry.neckCm !== undefined) payload.neckCm = clampNum(entry.neckCm, 20, 80);
  if (entry.chestCm !== undefined) payload.chestCm = clampNum(entry.chestCm, 50, 220);
  if (entry.waistCm !== undefined) payload.waistCm = clampNum(entry.waistCm, 30, 250);
  if (entry.abdomenCm !== undefined) payload.abdomenCm = clampNum(entry.abdomenCm, 30, 250);
  if (entry.hipCm !== undefined) payload.hipCm = clampNum(entry.hipCm, 50, 250);
  if (entry.armRightCm !== undefined) payload.armRightCm = clampNum(entry.armRightCm, 10, 100);
  if (entry.armLeftCm !== undefined) payload.armLeftCm = clampNum(entry.armLeftCm, 10, 100);
  if (entry.thighRightCm !== undefined) payload.thighRightCm = clampNum(entry.thighRightCm, 20, 150);
  if (entry.thighLeftCm !== undefined) payload.thighLeftCm = clampNum(entry.thighLeftCm, 20, 150);
  if (entry.calfCm !== undefined) payload.calfCm = clampNum(entry.calfCm, 15, 90);
  if (entry.armCm !== undefined) payload.armCm = clampNum(entry.armCm, 10, 100);
  if (entry.thighCm !== undefined) payload.thighCm = clampNum(entry.thighCm, 20, 150);

  try {
    await setDoc(doc(db, "users", uid, "bodyMeasurements", safeId), payload);
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }
}

export async function deleteCloudMeasurement(
  uid: string,
  measurementId: string
): Promise<void> {
  const safeId = sanitizeId(measurementId, "meas");
  const docPath = `users/${uid}/bodyMeasurements/${safeId}`;
  try {
    await deleteDoc(doc(db, "users", uid, "bodyMeasurements", safeId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, docPath);
  }
}

export async function createCloudChatMessage(
  uid: string,
  agentType: "personal" | "nutri",
  msg: ChatMessage
): Promise<void> {
  const safeId = sanitizeId(msg.id, "msg");
  const docPath = `users/${uid}/aiChatMessages/${safeId}`;
  const content = clampStr(msg.content, 12000);
  if (!content) return;

  try {
    await setDoc(doc(db, "users", uid, "aiChatMessages", safeId), {
      userId: uid,
      agentType,
      role: msg.role,
      content,
      createdAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }
}

export async function clearCloudChatMessages(
  uid: string,
  agentType: "personal" | "nutri"
): Promise<void> {
  const colPath = `users/${uid}/aiChatMessages`;
  try {
    const q = query(
      collection(db, "users", uid, "aiChatMessages"),
      where("userId", "==", uid),
      where("agentType", "==", agentType)
    );
    const snap = await getDocs(q);
    if (snap.empty) return;
    const batch = writeBatch(db);
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, colPath);
  }
}

export async function createCloudAchievement(
  uid: string,
  badgeId: string,
  title: string,
  category: AchievementCategory,
  unlockedDate: string
): Promise<void> {
  const safeId = sanitizeId(badgeId, "badge").slice(0, 64);
  const docPath = `users/${uid}/achievements/${safeId}`;
  const ref = doc(db, "users", uid, "achievements", safeId);

  try {
    const existingSnap = await getDoc(ref);
    if (existingSnap.exists()) return;
  } catch (error) {
    handleFirestoreError(error, OperationType.GET, docPath);
    return;
  }

  try {
    await setDoc(ref, {
      userId: uid,
      badgeId: safeId,
      title: clampStr(title, 100, "Conquista Personal Nutri Fit"),
      category,
      unlockedDate: sanitizeDateIso(unlockedDate),
      unlockedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, docPath);
  }
}

export async function loadCloudUserState(
  uid: string,
  todayIso: string,
  baseState: BiancoAppState
): Promise<Partial<BiancoAppState>> {
  const isSessionActive = () => auth.currentUser?.uid === uid;
  if (!isSessionActive()) return {};

  const nextProfile = { ...baseState.profile };
  const nextGoals = { ...baseState.goals };
  let activeComboId = baseState.activeComboId;
  let water = baseState.water;
  let savedPlan = baseState.savedPlan;
  let workoutHistory = baseState.workoutHistory;
  const exerciseLogs = { ...baseState.exerciseLogs };
  let measurements = baseState.measurements;
  let personalChat = baseState.personalChat;
  let nutriChat = baseState.nutriChat;
  const unlockedBadges: Record<string, string> = { ...(baseState.unlockedBadges || {}) };

  const safeRun = async <T,>(
    operation: OperationType,
    path: string,
    task: () => Promise<T>
  ): Promise<T | null> => {
    if (!isSessionActive()) return null;
    try {
      return await task();
    } catch (error) {
      // Ignore permission errors caused by user signing out mid-hydration
      if (!isSessionActive()) return null;
      handleFirestoreError(error, operation, path);
    }
  };

  const [
    profSnap,
    nutriSnap,
    waterSnap,
    savedSnap,
    sessionsSnap,
    loadsSnap,
    measSnap,
    chatSnap,
    achSnap,
  ] = await Promise.all([
    safeRun(OperationType.GET, `users/${uid}`, () => getDoc(doc(db, "users", uid))),
    safeRun(OperationType.GET, `users/${uid}/nutrition/profile`, () =>
      getDoc(doc(db, "users", uid, "nutrition", "profile"))
    ),
    safeRun(OperationType.GET, `users/${uid}/dailyWaterLogs/${todayIso}`, () =>
      getDoc(doc(db, "users", uid, "dailyWaterLogs", todayIso))
    ),
    safeRun(OperationType.LIST, `users/${uid}/savedWorkouts`, () =>
      getDocs(
        query(collection(db, "users", uid, "savedWorkouts"), where("userId", "==", uid))
      )
    ),
    safeRun(OperationType.LIST, `users/${uid}/workoutSessions`, () =>
      getDocs(
        query(
          collection(db, "users", uid, "workoutSessions"),
          where("userId", "==", uid)
        )
      )
    ),
    safeRun(OperationType.LIST, `users/${uid}/exerciseLoads`, () =>
      getDocs(
        query(collection(db, "users", uid, "exerciseLoads"), where("userId", "==", uid))
      )
    ),
    safeRun(OperationType.LIST, `users/${uid}/bodyMeasurements`, () =>
      getDocs(
        query(
          collection(db, "users", uid, "bodyMeasurements"),
          where("userId", "==", uid)
        )
      )
    ),
    safeRun(OperationType.LIST, `users/${uid}/aiChatMessages`, () =>
      getDocs(
        query(collection(db, "users", uid, "aiChatMessages"), where("userId", "==", uid))
      )
    ),
    safeRun(OperationType.LIST, `users/${uid}/achievements`, () =>
      getDocs(
        query(collection(db, "users", uid, "achievements"), where("userId", "==", uid))
      )
    ),
  ]);

  if (!isSessionActive()) return {};

  // 1. User Profile
  if (profSnap && profSnap.exists()) {
    const d = profSnap.data();
    if (typeof d.fullName === "string") nextProfile.name = d.fullName;
    if (typeof d.avatar === "string") nextProfile.avatar = d.avatar;
    if (typeof d.onboardingCompleted === "boolean") {
      nextProfile.onboardingCompleted = d.onboardingCompleted;
    } else {
      nextProfile.onboardingCompleted = true;
    }
    if ([3, 4, 5, 6].includes(d.weeklyFrequency)) {
      nextProfile.weeklyFrequency = d.weeklyFrequency as WeeklyFrequency;
    }
    if (typeof d.mainGoal === "string") nextGoals.primary = d.mainGoal;
    if (Array.isArray(d.secondaryGoals)) nextGoals.focuses = d.secondaryGoals;
    if (typeof d.customGoalText === "string") nextGoals.customNote = d.customGoalText;
    if (
      d.fitnessLevel === "Iniciante" ||
      d.fitnessLevel === "Intermediário" ||
      d.fitnessLevel === "Avançado"
    ) {
      nextProfile.level = d.fitnessLevel;
    }
    if ([30, 45, 60, 90].includes(d.availableMinutes)) {
      nextProfile.availableTime = d.availableMinutes;
    }
    if (typeof d.muscleToday === "string") nextProfile.muscleToday = d.muscleToday;
    if (typeof d.activeComboId === "string") activeComboId = d.activeComboId;
  }

  // 2. Nutrition Profile
  if (nutriSnap && nutriSnap.exists()) {
    const d = nutriSnap.data();
    if (typeof d.weightKg === "number") nextProfile.weightKg = d.weightKg;
    if (typeof d.heightCm === "number") nextProfile.heightCm = d.heightCm;
    if (typeof d.age === "number") nextProfile.age = d.age;
    if (d.sex === "M" || d.sex === "F") nextProfile.sex = d.sex;
    if (typeof d.activityLevel === "string") {
      nextProfile.activityLevel = d.activityLevel as StudentProfile["activityLevel"];
    }
    if (d.deficitMode === "moderado" || d.deficitMode === "acelerado") {
      nextProfile.deficitMode = d.deficitMode;
    }
    if (typeof d.targetWeightKg === "number") {
      nextProfile.targetWeightKg = d.targetWeightKg;
    }
  }

  // 3. Today's Water Log
  if (waterSnap && waterSnap.exists()) {
    const d = waterSnap.data();
    water = {
      date: todayIso,
      consumedMl: typeof d.amountMl === "number" ? d.amountMl : 0,
    };
  }

  // 4. Saved Workouts
  if (savedSnap && !savedSnap.empty) {
    const sorted = savedSnap.docs
      .map((docSnap) => ({ id: docSnap.id, data: docSnap.data() }))
      .sort((a, b) => {
        const ta = a.data.createdAt?.toMillis?.() ?? 0;
        const tb = b.data.createdAt?.toMillis?.() ?? 0;
        return tb - ta;
      });
    const latest = sorted[0];
    savedPlan = {
      id: latest.id,
      title: String(latest.data.title || "Ficha Personal IA"),
      muscleToday: String(latest.data.category || "Treino Presencial"),
      content: String(latest.data.content || ""),
      savedAt: latest.data.createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
      matchedExerciseIds: Array.isArray(latest.data.matchedExerciseIds)
        ? latest.data.matchedExerciseIds
        : [],
    };
  }

  // 5. Workout Sessions
  if (sessionsSnap && !sessionsSnap.empty) {
    workoutHistory = sessionsSnap.docs
      .map((docSnap) => {
        const d = docSnap.data();
        const titleStr = String(d.title || "Treino");
        const categoryStr = String(d.category || "Musculação");
        const kmMatch = titleStr.match(/([0-9]+(?:[.,][0-9]+)?)\s*km/i);
        const kcalMatch = titleStr.match(/([0-9]+)\s*kcal/i);
        const distanceKm = kmMatch
          ? Number(parseFloat(kmMatch[1].replace(",", ".")).toFixed(2))
          : undefined;
        const caloriesKcal = kcalMatch ? Number(kcalMatch[1]) : undefined;
        const intensityMatch = categoryStr.match(/\b(Leve|Moderado|Intenso|HIIT)\b/i);
        const intensity = intensityMatch
          ? ((intensityMatch[1].toUpperCase() === "HIIT"
              ? "HIIT"
              : intensityMatch[1].charAt(0).toUpperCase() +
                intensityMatch[1].slice(1).toLowerCase()) as
              | "Leve"
              | "Moderado"
              | "Intenso"
              | "HIIT")
          : undefined;

        return {
          id: docSnap.id,
          date: String(d.completedDate || todayIso),
          title: titleStr,
          muscleGroup: categoryStr,
          totalVolumeKg: Number(d.totalVolumeKg || 0),
          setsCompleted: Number(d.setsCompleted || 0),
          durationMin: Number(d.durationMinutes || 45),
          ...(distanceKm !== undefined ? { distanceKm } : {}),
          ...(caloriesKcal !== undefined ? { caloriesKcal } : {}),
          ...(intensity !== undefined ? { intensity } : {}),
          _ts: d.completedAt?.toMillis?.() ?? 0,
        };
      })
      .sort((a, b) => b._ts - a._ts)
      .map(({ _ts: _unused, ...rest }) => rest);
  }

  // 6. Exercise Loads
  if (loadsSnap) {
    loadsSnap.docs.forEach((docSnap) => {
      const d = docSnap.data();
      const exId = docSnap.id;
      const setsCount = clampInt(Number(d.sets || 3), 1, 8);
      exerciseLogs[exId] = {
        sets: setsCount,
        reps: String(d.reps || "10-12"),
        weightKg: Number(d.weightKg || 0),
        lastWeightKg: Number(d.lastWeightKg || 0),
        completedSets: Array(setsCount).fill(false),
      };
    });
  }

  // 7. Body Measurements
  if (measSnap && !measSnap.empty) {
    measurements = measSnap.docs
      .map((docSnap) => {
        const d = docSnap.data();
        const item: BodyMeasurement = {
          id: docSnap.id,
          date: String(d.measuredAt || todayIso),
          weightKg: Number(d.weightKg || nextProfile.weightKg),
        };
        if (typeof d.neckCm === "number") item.neckCm = d.neckCm;
        if (typeof d.chestCm === "number") item.chestCm = d.chestCm;
        if (typeof d.waistCm === "number") item.waistCm = d.waistCm;
        if (typeof d.abdomenCm === "number") item.abdomenCm = d.abdomenCm;
        if (typeof d.hipCm === "number") item.hipCm = d.hipCm;
        if (typeof d.armRightCm === "number") item.armRightCm = d.armRightCm;
        if (typeof d.armLeftCm === "number") item.armLeftCm = d.armLeftCm;
        if (typeof d.thighRightCm === "number") item.thighRightCm = d.thighRightCm;
        if (typeof d.thighLeftCm === "number") item.thighLeftCm = d.thighLeftCm;
        if (typeof d.calfCm === "number") item.calfCm = d.calfCm;
        if (typeof d.armCm === "number") item.armCm = d.armCm;
        if (typeof d.thighCm === "number") item.thighCm = d.thighCm;
        return item;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  // 8. AI Chat Messages
  if (chatSnap && !chatSnap.empty) {
    const allMsgs = chatSnap.docs
      .map((docSnap) => {
        const d = docSnap.data();
        return {
          id: docSnap.id,
          agentType: d.agentType as "personal" | "nutri",
          role: d.role as "user" | "assistant",
          content: String(d.content || ""),
          timestamp: d.createdAt?.toDate?.()?.toISOString?.() || new Date().toISOString(),
          _ts: d.createdAt?.toMillis?.() ?? 0,
        };
      })
      .sort((a, b) => a._ts - b._ts);

    const loadedPersonal = allMsgs
      .filter((m) => m.agentType === "personal")
      .map(({ agentType: _a, _ts: _t, ...rest }) => rest);
    const loadedNutri = allMsgs
      .filter((m) => m.agentType === "nutri")
      .map(({ agentType: _a, _ts: _t, ...rest }) => rest);

    if (loadedPersonal.length > 0) personalChat = loadedPersonal;
    if (loadedNutri.length > 0) nutriChat = loadedNutri;
  }

  // 9. Unlocked Achievements / Badges
  if (achSnap) {
    achSnap.docs.forEach((docSnap) => {
      const d = docSnap.data();
      const id = typeof d.badgeId === "string" ? d.badgeId : docSnap.id;
      const dateStr =
        typeof d.unlockedDate === "string" &&
        /^[0-9]{4}-[0-9]{2}-[0-9]{2}$/.test(d.unlockedDate)
          ? d.unlockedDate
          : todayIso;
      if (id) {
        unlockedBadges[id] = dateStr;
      }
    });
  }

  return {
    profile: nextProfile,
    goals: nextGoals,
    activeComboId,
    water,
    savedPlan,
    workoutHistory,
    exerciseLogs,
    measurements,
    personalChat,
    nutriChat,
    unlockedBadges,
  };
}
