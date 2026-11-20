import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createUserWithEmailAndPassword,
  EmailAuthProvider,
  getRedirectResult,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signInWithRedirect,
  signOut,
  updatePassword,
  updateProfile as updateFirebaseAuthProfile,
  User,
} from "firebase/auth";
import { evaluateAchievements } from "../data/achievements";
import { EXERCISE_MAP, EXERCISES, WORKOUT_COMBOS } from "../data/exercises";
import {
  auth,
  ensureLocalAuthPersistence,
  formatGoogleAuthError,
  formatPasswordAuthError,
  googleProvider,
  validateFirebaseAuthConfig,
} from "../lib/firebase";
import {
  clearCloudChatMessages,
  createCloudAchievement,
  createCloudChatMessage,
  createCloudMeasurement,
  createCloudWorkoutSession,
  deleteCloudMeasurement,
  deleteCloudWorkoutPlan,
  deriveUsernameFromEmail,
  ensureCloudUserProfile,
  fetchCloudUserAccess,
  isBootstrappedAdminEmail,
  loadCloudUserState,
  normalizeEmail,
  resolveAuthIdentifier,
  saveCloudWorkoutPlan,
  subscribeCloudUserAccess,
  updateCloudUserProfile,
  upsertCloudExerciseLoad,
  upsertDailyWaterLog,
  upsertNutritionProfile,
} from "../lib/firestoreSync";
import {
  AccountAccessState,
  AchievementProgressItem,
  BiancoAppState,
  BodyMeasurement,
  ChatMessage,
  CompletedWorkout,
  ExerciseLogEntry,
  SavedAiPlan,
  StudentGoals,
  StudentProfile,
  TrainingLevel,
  UserAccessStatus,
  UserRole,
  WeeklyFrequency,
} from "../types";
import {
  calculateMetabolism,
  frequencyToActivityLevel,
  getFirstName,
} from "../utils/metabolism";

const STORAGE_KEY = "bianco_fit_state_v1";

export interface OnboardingPayload {
  name: string;
  sex: "M" | "F";
  age: number;
  avatar: string;
  heightCm: number;
  weightKg: number;
  targetWeightKg: number;
  level: TrainingLevel;
  weeklyFrequency: WeeklyFrequency;
  primaryGoal: string;
  focuses: string[];
  customNote: string;
}

export function getTodayIso(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getDaysAgoIso(daysAgo: number): string {
  const d = new Date();
  d.setDate(d.getDate() - daysAgo);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function createInitialLogs(): Record<string, ExerciseLogEntry> {
  const logs: Record<string, ExerciseLogEntry> = {};
  for (const ex of EXERCISES) {
    logs[ex.id] = {
      sets: ex.defaultSets,
      reps: ex.defaultReps,
      weightKg: ex.defaultWeightKg,
      lastWeightKg: ex.defaultWeightKg,
      completedSets: Array(ex.defaultSets).fill(false),
    };
  }
  return logs;
}

function buildPersonalWelcome(name: string): ChatMessage {
  const firstName = getFirstName(name);
  return {
    id: "welcome_personal",
    role: "assistant",
    timestamp: new Date().toISOString(),
    content: `Fala, **${firstName}**! Sou seu **Personal Trainer IA** do Personal Nutri Fit. Já carreguei seu perfil corporal, IMC, nível, frequência semanal e objetivo.\n\nEscolha um atalho rápido abaixo ou me diga qual máquina está livre hoje na academia para montarmos seu treino presencial sob medida.`,
  };
}

function buildNutriWelcome(name: string): ChatMessage {
  const firstName = getFirstName(name);
  return {
    id: "welcome_nutri",
    role: "assistant",
    timestamp: new Date().toISOString(),
    content: `Olá, **${firstName}**! Sou sua **Nutricionista IA** do Personal Nutri Fit. Já estou com seu cálculo de **TMB, GET, meta calórica, proteína (2.0g/kg)**, medidas corporais e treino do dia integrados.\n\nPosso montar seu cardápio completo com comida brasileira de verdade, ajustar pré/pós-treino ou gerar sua lista de compras da semana.`,
  };
}

function createDefaultState(): BiancoAppState {
  const today = getTodayIso();
  return {
    profile: {
      name: "",
      weightKg: 75,
      targetWeightKg: 70,
      heightCm: 172,
      age: 28,
      sex: "M",
      activityLevel: "moderado",
      deficitMode: "acelerado",
      level: "Intermediário",
      weeklyFrequency: 4,
      availableTime: 60,
      muscleToday: "Costas + Bíceps",
      avatar: "preset:orange",
      onboardingCompleted: false,
    },
    goals: {
      primary: "Perder peso e definir o corpo",
      focuses: [],
      customNote: "",
    },
    water: {
      date: today,
      consumedMl: 0,
    },
    activeComboId: "costas_biceps",
    exerciseLogs: createInitialLogs(),
    swappedExercises: {},
    savedPlan: null,
    workoutHistory: [],
    measurements: [],
    personalChat: [buildPersonalWelcome("")],
    nutriChat: [buildNutriWelcome("")],
    unlockedBadges: {},
  };
}

function loadState(): BiancoAppState {
  const defaults = createDefaultState();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as Partial<BiancoAppState>;
    const today = getTodayIso();

    const mergedLogs: Record<string, ExerciseLogEntry> = {
      ...defaults.exerciseLogs,
      ...(parsed.exerciseLogs || {}),
    };

    const water =
      parsed.water && parsed.water.date === today
        ? parsed.water
        : { date: today, consumedMl: 0 };

    const rawProfile = parsed.profile || ({} as Partial<StudentProfile>);
    const hasExplicitFlag = typeof rawProfile.onboardingCompleted === "boolean";
    const inferredCompleted = hasExplicitFlag
      ? Boolean(rawProfile.onboardingCompleted)
      : Boolean(rawProfile.name && rawProfile.name !== "Atleta Bianco");

    const mergedProfile: StudentProfile = {
      ...defaults.profile,
      ...rawProfile,
      weeklyFrequency:
        rawProfile.weeklyFrequency === 3 ||
        rawProfile.weeklyFrequency === 4 ||
        rawProfile.weeklyFrequency === 5 ||
        rawProfile.weeklyFrequency === 6
          ? rawProfile.weeklyFrequency
          : 4,
      avatar: rawProfile.avatar || "preset:orange",
      onboardingCompleted: inferredCompleted,
    };

    return {
      ...defaults,
      ...parsed,
      profile: mergedProfile,
      goals: { ...defaults.goals, ...(parsed.goals || {}) },
      water,
      exerciseLogs: mergedLogs,
      swappedExercises: parsed.swappedExercises || {},
      workoutHistory: Array.isArray(parsed.workoutHistory)
        ? parsed.workoutHistory
        : [],
      measurements: Array.isArray(parsed.measurements)
        ? parsed.measurements
        : [],
      personalChat:
        Array.isArray(parsed.personalChat) && parsed.personalChat.length > 0
          ? parsed.personalChat
          : [buildPersonalWelcome(mergedProfile.name)],
      nutriChat:
        Array.isArray(parsed.nutriChat) && parsed.nutriChat.length > 0
          ? parsed.nutriChat
          : [buildNutriWelcome(mergedProfile.name)],
      unlockedBadges:
        parsed.unlockedBadges && typeof parsed.unlockedBadges === "object"
          ? parsed.unlockedBadges
          : {},
    };
  } catch {
    return defaults;
  }
}

export function matchExercisesFromPlanText(text: string): string[] {
  const normalized = text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

  const matched: string[] = [];
  for (const ex of EXERCISES) {
    const exNorm = ex.name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    const coreWords = exNorm
      .split(/[\s/()]+/)
      .filter((w) => w.length >= 4 && !["com", "para", "polia", "maquina"].includes(w));

    const exactHit = normalized.includes(exNorm);
    const strongPartial =
      coreWords.length >= 2 &&
      coreWords.filter((w) => normalized.includes(w)).length >= Math.min(2, coreWords.length);

    if (exactHit || strongPartial) {
      matched.push(ex.id);
    }
  }
  return matched.slice(0, 8);
}

export function useBiancoState(
  onAchievementUnlocked?: (badge: AchievementProgressItem) => void
) {
  const [state, setState] = useState<BiancoAppState>(() => loadState());
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);
  const [accountAccess, setAccountAccess] = useState<AccountAccessState>({
    fullName: "",
    username: "",
    email: "",
    role: "user",
    status: "pendente",
    loaded: false,
    canListDirectory: false,
    error: null,
  });

  const onAchievementUnlockedRef = useRef(onAchievementUnlocked);
  onAchievementUnlockedRef.current = onAchievementUnlocked;
  const announcedBadgesRef = useRef<Set<string> | null>(null);
  const pendingRegisterNameRef = useRef<string | null>(null);
  const pendingRegisterUsernameRef = useRef<string | null>(null);
  const authSyncGenerationRef = useRef(0);

  const stateRef = useRef(state);
  stateRef.current = state;

  const cloudReadyRef = useRef(false);
  const profileSyncTimerRef = useRef<number | null>(null);
  const loadSyncTimersRef = useRef<Record<string, number>>({});

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // ignore storage quota errors
    }
  }, [state]);

  const metabolism = useMemo(() => calculateMetabolism(state.profile), [state.profile]);

  const sortedMeasurements = useMemo(
    () => [...state.measurements].sort((a, b) => a.date.localeCompare(b.date)),
    [state.measurements]
  );

  const latestMeasurement = useMemo<BodyMeasurement | null>(
    () =>
      sortedMeasurements.length > 0
        ? sortedMeasurements[sortedMeasurements.length - 1]
        : null,
    [sortedMeasurements]
  );

  const previousMeasurement = useMemo<BodyMeasurement | null>(
    () =>
      sortedMeasurements.length > 1
        ? sortedMeasurements[sortedMeasurements.length - 2]
        : null,
    [sortedMeasurements]
  );

  const streakDays = useMemo(() => {
    if (state.workoutHistory.length === 0) return 0;
    const uniqueDates = Array.from(new Set(state.workoutHistory.map((w) => w.date)))
      .sort()
      .reverse();
    const today = getTodayIso();
    const yesterday = getDaysAgoIso(1);

    let streak = 0;
    if (uniqueDates[0] === today || uniqueDates[0] === yesterday) {
      let prevTime = new Date(uniqueDates[0] + "T12:00:00").getTime();
      streak = 1;
      for (let i = 1; i < uniqueDates.length; i++) {
        const currTime = new Date(uniqueDates[i] + "T12:00:00").getTime();
        const diffDays = Math.round((prevTime - currTime) / (1000 * 60 * 60 * 24));
        if (diffDays <= 2) {
          streak += 1;
          prevTime = currTime;
        } else {
          break;
        }
      }
    }
    return streak;
  }, [state.workoutHistory]);

  const streakRef = useRef(streakDays);
  streakRef.current = streakDays;

  const achievements = useMemo(
    () => evaluateAchievements(state, metabolism, streakDays, getTodayIso()),
    [state, metabolism, streakDays]
  );

  // Persist newly earned achievements (local + Firestore) and trigger celebratory toast
  useEffect(() => {
    if (announcedBadgesRef.current === null) {
      announcedBadgesRef.current = new Set(
        achievements.filter((a) => a.unlocked).map((a) => a.id)
      );
    }

    const newlyPersisted: Record<string, string> = {};
    const toPersistCloud: AchievementProgressItem[] = [];
    const toAnnounce: AchievementProgressItem[] = [];

    for (const item of achievements) {
      if (!item.unlocked) continue;
      if (!state.unlockedBadges[item.id]) {
        newlyPersisted[item.id] = item.unlockedDate || getTodayIso();
        toPersistCloud.push(item);
      }
      if (!announcedBadgesRef.current.has(item.id)) {
        announcedBadgesRef.current.add(item.id);
        if (state.profile.onboardingCompleted) {
          toAnnounce.push(item);
        }
      }
    }

    if (Object.keys(newlyPersisted).length > 0) {
      setState((prev) => ({
        ...prev,
        unlockedBadges: {
          ...(prev.unlockedBadges || {}),
          ...newlyPersisted,
        },
      }));

      const uid = auth.currentUser?.uid;
      if (uid && cloudReadyRef.current) {
        for (const badge of toPersistCloud) {
          void createCloudAchievement(
            uid,
            badge.id,
            badge.title,
            badge.category,
            badge.unlockedDate || getTodayIso()
          ).catch(() => {});
        }
      }
    }

    if (toAnnounce.length > 0 && onAchievementUnlockedRef.current) {
      for (const badge of toAnnounce) {
        onAchievementUnlockedRef.current(badge);
      }
    }
  }, [achievements, state.unlockedBadges, state.profile.onboardingCompleted]);

  // Listen for Firebase Auth state changes, verify RBAC status, and hydrate cloud state when authorized
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      const runId = ++authSyncGenerationRef.current;
      setUser(firebaseUser);
      setAuthReady(true);

      if (!firebaseUser) {
        cloudReadyRef.current = false;
        setAccountAccess({
          fullName: "",
          username: "",
          email: "",
          role: "user",
          status: "pendente",
          loaded: true,
          canListDirectory: false,
          error: null,
        });
        return;
      }

      const isCurrentRun = () =>
        authSyncGenerationRef.current === runId &&
        auth.currentUser?.uid === firebaseUser.uid;

      const rawEmail =
        firebaseUser.email ||
        firebaseUser.providerData?.find((p) => Boolean(p?.email))?.email ||
        null;
      const normEmail = normalizeEmail(rawEmail);
      const effectiveDisplayName =
        pendingRegisterNameRef.current ||
        firebaseUser.displayName ||
        firebaseUser.providerData?.find((p) => Boolean(p?.displayName))?.displayName ||
        null;
      const effectiveUsername =
        pendingRegisterUsernameRef.current || deriveUsernameFromEmail(normEmail);

      setAccountAccess((prev) => ({
        ...prev,
        fullName: effectiveDisplayName || prev.fullName,
        username: effectiveUsername || prev.username,
        email: normEmail,
        loaded: false,
        error: null,
      }));

      try {
        const hasGoogleProvider = Boolean(
          firebaseUser.providerData?.some((p) => p?.providerId === "google.com")
        );
        if (hasGoogleProvider && !firebaseUser.emailVerified) {
          try {
            await firebaseUser.getIdToken(true);
            await firebaseUser.reload();
          } catch {
            // Ignore reload error on slow connections
          }
        }
        const isEmailVerified = Boolean(
          firebaseUser.emailVerified || hasGoogleProvider
        );

        const currentLocal = stateRef.current;
        const currentMetab = calculateMetabolism(currentLocal.profile);
        const accessResult = await ensureCloudUserProfile(
          firebaseUser.uid,
          effectiveDisplayName,
          rawEmail,
          isEmailVerified,
          currentLocal,
          currentMetab,
          streakRef.current,
          pendingRegisterUsernameRef.current
        );
        pendingRegisterNameRef.current = null;
        pendingRegisterUsernameRef.current = null;

        if (!isCurrentRun()) return;

        const isAuthorized =
          accessResult.status === "autorizado" || accessResult.role === "admin";

        setAccountAccess({
          fullName: accessResult.fullName,
          username: accessResult.username,
          email: accessResult.email,
          role: accessResult.role,
          status: accessResult.status,
          loaded: true,
          canListDirectory:
            isEmailVerified &&
            isBootstrappedAdminEmail(accessResult.email),
          error: null,
        });

        cloudReadyRef.current = isAuthorized;

        if (!isAuthorized) {
          return;
        }

        if (accessResult.existed) {
          const cloudPatch = await loadCloudUserState(
            firebaseUser.uid,
            getTodayIso(),
            currentLocal
          );
          if (!isCurrentRun() || Object.keys(cloudPatch).length === 0) return;

          if (announcedBadgesRef.current && cloudPatch.unlockedBadges) {
            for (const badgeId of Object.keys(cloudPatch.unlockedBadges)) {
              announcedBadgesRef.current.add(badgeId);
            }
          }
          setState((prev) => ({
            ...prev,
            ...cloudPatch,
          }));
        } else if (accessResult.fullName && !currentLocal.profile.name) {
          setState((prev) => ({
            ...prev,
            profile: {
              ...prev.profile,
              name: accessResult.fullName || prev.profile.name,
            },
          }));
        }
      } catch (err) {
        pendingRegisterNameRef.current = null;
        pendingRegisterUsernameRef.current = null;
        // Ignore stale sync errors if the user already signed out or switched accounts
        if (!isCurrentRun()) return;

        console.error("Erro ao sincronizar conta com Firestore:", err);
        cloudReadyRef.current = false;
        setAccountAccess({
          fullName: effectiveDisplayName || "",
          username: effectiveUsername,
          email: normEmail,
          role: "user",
          status: "pendente",
          loaded: true,
          canListDirectory: false,
          error:
            "Não foi possível verificar o status da sua conta no momento. Clique em 'Atualizar Status' para tentar novamente.",
        });
      }
    });

    return () => {
      authSyncGenerationRef.current += 1;
      unsub();
    };
  }, []);

  // Real-time Firestore listener on users/{uid}: immediately unlocks or locks access when admin updates status
  useEffect(() => {
    if (!user || !accountAccess.loaded) return;
    const uid = user.uid;
    let cancelled = false;

    const hasGoogleProvider = Boolean(
      user.providerData?.some((p) => p?.providerId === "google.com")
    );
    const isEmailVerified = Boolean(user.emailVerified || hasGoogleProvider);

    const unsub = subscribeCloudUserAccess(
      uid,
      user.email,
      isEmailVerified,
      user.displayName,
      (fresh) => {
        if (cancelled || auth.currentUser?.uid !== uid) return;
        const isAuthorized = fresh.status === "autorizado" || fresh.role === "admin";
        const wasAuthorized = cloudReadyRef.current;

        setAccountAccess((prev) => {
          if (
            prev.status === fresh.status &&
            prev.role === fresh.role &&
            prev.fullName === fresh.fullName &&
            prev.username === fresh.username &&
            prev.email === fresh.email
          ) {
            return prev;
          }
          return {
            fullName: fresh.fullName,
            username: fresh.username,
            email: fresh.email,
            role: fresh.role,
            status: fresh.status,
            loaded: true,
            canListDirectory:
              isEmailVerified && isBootstrappedAdminEmail(fresh.email),
            error: null,
          };
        });

        cloudReadyRef.current = isAuthorized;

        if (isAuthorized && !wasAuthorized) {
          void loadCloudUserState(uid, getTodayIso(), stateRef.current)
            .then((cloudPatch) => {
              if (cancelled || auth.currentUser?.uid !== uid) return;
              if (Object.keys(cloudPatch).length === 0) return;
              if (announcedBadgesRef.current && cloudPatch.unlockedBadges) {
                for (const badgeId of Object.keys(cloudPatch.unlockedBadges)) {
                  announcedBadgesRef.current.add(badgeId);
                }
              }
              setState((prev) => ({
                ...prev,
                ...cloudPatch,
              }));
            })
            .catch((err) => {
              console.error(
                "[Bianco Fit Auth] Falha ao hidratar dados após liberação em tempo real:",
                err
              );
            });
        }
      },
      (err) => {
        console.warn("[Bianco Fit Auth] Listener de status interrompido:", err);
      }
    );

    return () => {
      cancelled = true;
      unsub();
    };
  }, [user, accountAccess.loaded]);

  const refreshAccountAccess = useCallback(async (): Promise<{
    status: UserAccessStatus;
    role: UserRole;
    authorized: boolean;
    error?: string;
  }> => {
    const firebaseUser = auth.currentUser;
    if (!firebaseUser) {
      return { status: "pendente", role: "user", authorized: false };
    }

    try {
      const hasGoogleProvider = Boolean(
        firebaseUser.providerData?.some((p) => p?.providerId === "google.com")
      );
      const isEmailVerified = Boolean(
        firebaseUser.emailVerified || hasGoogleProvider
      );
      const fresh = await fetchCloudUserAccess(
        firebaseUser.uid,
        firebaseUser.email,
        isEmailVerified,
        firebaseUser.displayName
      );
      const isAuthorized = fresh.status === "autorizado" || fresh.role === "admin";

      setAccountAccess({
        fullName: fresh.fullName,
        username: fresh.username,
        email: fresh.email,
        role: fresh.role,
        status: fresh.status,
        loaded: true,
        canListDirectory:
          isEmailVerified &&
          isBootstrappedAdminEmail(fresh.email),
        error: null,
      });

      cloudReadyRef.current = isAuthorized;

      if (isAuthorized) {
        const currentLocal = stateRef.current;
        const cloudPatch = await loadCloudUserState(
          firebaseUser.uid,
          getTodayIso(),
          currentLocal
        );
        if (announcedBadgesRef.current && cloudPatch.unlockedBadges) {
          for (const badgeId of Object.keys(cloudPatch.unlockedBadges)) {
            announcedBadgesRef.current.add(badgeId);
          }
        }
        setState((prev) => ({
          ...prev,
          ...cloudPatch,
        }));
      }

      return {
        status: fresh.status,
        role: fresh.role,
        authorized: isAuthorized,
      };
    } catch (err) {
      const msg =
        err instanceof Error
          ? "Não foi possível consultar seu status agora. Verifique sua conexão."
          : "Erro ao consultar status de acesso.";
      setAccountAccess((prev) => ({ ...prev, error: msg }));
      return {
        status: accountAccess.status,
        role: accountAccess.role,
        authorized: false,
        error: msg,
      };
    }
  }, [accountAccess.role, accountAccess.status]);

  const clearAuthError = useCallback(() => {
    setAuthError(null);
  }, []);

  const sendUserPasswordReset = useCallback(
    async (
      emailOrIdentifier: string
    ): Promise<{ ok: boolean; email?: string; error?: string }> => {
      setAuthError(null);

      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        const offlineMsg =
          "Falha de conexão: você parece estar sem internet. Reconecte-se e tente novamente.";
        setAuthError(offlineMsg);
        return { ok: false, error: offlineMsg };
      }

      const clean = normalizeEmail(emailOrIdentifier);
      if (!clean || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
        const msg =
          "Informe o e-mail completo cadastrado (ex: nome@email.com) para receber o link de recuperação.";
        setAuthError(msg);
        return { ok: false, error: msg };
      }

      setAuthBusy(true);
      try {
        await sendPasswordResetEmail(auth, clean);
        return { ok: true, email: clean };
      } catch (err) {
        const parsed = formatPasswordAuthError(err, "login");
        console.error("[Bianco Fit Auth] Erro ao enviar recuperação de senha:", {
          code: parsed.code,
          message: parsed.rawMessage,
          rawError: err,
        });
        const msg =
          parsed.code === "auth/user-not-found"
            ? "Nenhuma conta encontrada com este e-mail. Verifique se digitou corretamente ou crie sua conta."
            : parsed.code === "auth/too-many-requests" ||
              parsed.code === "auth/network-request-failed" ||
              parsed.code === "auth/invalid-email"
            ? parsed.friendly
            : "Não foi possível enviar o e-mail de recuperação agora. Tente novamente em instantes.";
        setAuthError(msg);
        return { ok: false, error: msg };
      } finally {
        setAuthBusy(false);
      }
    },
    []
  );

  const signInWithCredentials = useCallback(
    async (
      identifier: string,
      password: string,
      mode: "login" | "register",
      fullName?: string
    ): Promise<{ ok: boolean; error?: string; isPendingApproval?: boolean }> => {
      setAuthError(null);

      if (typeof navigator !== "undefined" && navigator.onLine === false) {
        const offlineMsg =
          "Falha de conexão: você parece estar sem internet. Reconecte-se e tente novamente.";
        setAuthError(offlineMsg);
        return { ok: false, error: offlineMsg };
      }

      const cfgCheck = validateFirebaseAuthConfig();
      if (!cfgCheck.valid) {
        const configMsg = `Configuração de autenticação incompleta (${cfgCheck.missingFields.join(", ")}).`;
        console.error("[Bianco Fit Auth] Configuração ausente:", cfgCheck);
        setAuthError(configMsg);
        return { ok: false, error: configMsg };
      }

      const resolved = resolveAuthIdentifier(identifier);
      const cleanName = (fullName || "").trim();

      if (mode === "register" && cleanName.length < 2) {
        const nameErr = "Informe seu nome completo (mínimo 2 caracteres).";
        setAuthError(nameErr);
        return { ok: false, error: nameErr };
      }

      if (!resolved.email || (!resolved.isDirectEmail && resolved.username.length < 2)) {
        const idErr =
          "Informe um nome de usuário válido (mínimo 2 caracteres, sem espaços).";
        setAuthError(idErr);
        return { ok: false, error: idErr };
      }

      if (password.length < 6) {
        const passErr = "A senha precisa ter pelo menos 6 caracteres.";
        setAuthError(passErr);
        return { ok: false, error: passErr };
      }

      setAuthBusy(true);
      try {
        await ensureLocalAuthPersistence();
        if (mode === "register") {
          pendingRegisterNameRef.current = cleanName || null;
          pendingRegisterUsernameRef.current = resolved.username || null;
          const cred = await createUserWithEmailAndPassword(auth, resolved.email, password);
          setUser(cred.user);
          if (cleanName) {
            await updateFirebaseAuthProfile(cred.user, {
              displayName: cleanName,
            }).catch(() => {});
            setState((prev) => ({
              ...prev,
              profile: {
                ...prev.profile,
                name: cleanName,
              },
            }));
          }
          const isAutoAdmin =
            Boolean(cred.user.emailVerified) &&
            isBootstrappedAdminEmail(cred.user.email);
          return { ok: true, isPendingApproval: !isAutoAdmin };
        } else {
          const cred = await signInWithEmailAndPassword(auth, resolved.email, password);
          setUser(cred.user);
          return { ok: true };
        }
      } catch (err) {
        pendingRegisterNameRef.current = null;
        pendingRegisterUsernameRef.current = null;
        const parsed = formatPasswordAuthError(err, mode);

        console.error("[Bianco Fit Auth] Erro ao autenticar com Usuário/Senha:", {
          code: parsed.code,
          message: parsed.rawMessage,
          mode,
          projectId: cfgCheck.projectId,
          rawError: err,
        });

        setAuthError(parsed.friendly);
        return { ok: false, error: parsed.friendly };
      } finally {
        setAuthBusy(false);
      }
    },
    []
  );

  // Capture any pending Google signInWithRedirect result seamlessly on mount
  useEffect(() => {
    void getRedirectResult(auth).catch((err) => {
      const parsed = formatGoogleAuthError(err);
      if (!parsed.cancelled && parsed.code) {
        console.error("[Bianco Fit Auth] Erro no retorno do redirecionamento Google:", err);
        setAuthError(parsed.friendly);
      }
    });
  }, []);

  const signInWithGoogle = useCallback(async (): Promise<{
    ok: boolean;
    cancelled?: boolean;
    redirecting?: boolean;
    error?: string;
  }> => {
    setAuthError(null);

    if (typeof navigator !== "undefined" && navigator.onLine === false) {
      const offlineMsg =
        "Falha de conexão: você parece estar sem internet. Reconecte-se e tente novamente.";
      setAuthError(offlineMsg);
      return { ok: false, error: offlineMsg };
    }

    const cfgCheck = validateFirebaseAuthConfig();
    if (!cfgCheck.valid) {
      const configMsg = `Configuração de autenticação incompleta (${cfgCheck.missingFields.join(", ")}).`;
      console.error("[Bianco Fit Auth] Configuração ausente:", cfgCheck);
      setAuthError(configMsg);
      return { ok: false, error: configMsg };
    }

    // Execute signInWithPopup synchronously inside the user gesture BEFORE awaiting any promise
    // so Safari, iOS, mobile Chrome, and embedded browsers do not block the popup window.
    const popupPromise = signInWithPopup(auth, googleProvider);
    setAuthBusy(true);
    try {
      const cred = await popupPromise;
      setUser(cred.user);
      return { ok: true };
    } catch (err) {
      const parsed = formatGoogleAuthError(err);

      if (parsed.cancelled) {
        return { ok: false, cancelled: true };
      }

      if (parsed.shouldFallbackToRedirect) {
        try {
          await signInWithRedirect(auth, googleProvider);
          return { ok: true, redirecting: true };
        } catch (redirectErr) {
          const parsedRedirect = formatGoogleAuthError(redirectErr);
          console.error("[Personal Nutri Fit Auth] Erro ao redirecionar login com Google:", redirectErr);
          setAuthError(parsedRedirect.friendly);
          return { ok: false, error: parsedRedirect.friendly };
        }
      }

      console.error("[Personal Nutri Fit Auth] Erro ao entrar com Google:", {
        code: parsed.code,
        message: parsed.rawMessage,
        projectId: cfgCheck.projectId,
        rawError: err,
      });

      setAuthError(parsed.friendly);
      return { ok: false, error: parsed.friendly };
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const sendVerificationForCurrentUser = useCallback(async (): Promise<{
    ok: boolean;
    error?: string;
  }> => {
    const current = auth.currentUser;
    if (!current) {
      return { ok: false, error: "Nenhuma conta conectada no momento." };
    }
    try {
      await sendEmailVerification(current);
      return { ok: true };
    } catch (err) {
      console.error("[Bianco Fit Auth] Falha ao enviar e-mail de verificação:", err);
      const parsed = formatPasswordAuthError(err, "login");
      return {
        ok: false,
        error:
          parsed.code === "auth/too-many-requests"
            ? parsed.friendly
            : "Não foi possível enviar o link de verificação agora. Tente novamente em instantes.",
      };
    }
  }, []);

  const reloadCurrentUserVerification = useCallback(async (): Promise<{
    verified: boolean;
    authorized: boolean;
    error?: string;
  }> => {
    const current = auth.currentUser;
    if (!current) {
      return { verified: false, authorized: false, error: "Nenhuma conta conectada." };
    }
    setAuthBusy(true);
    try {
      await current.reload();
      await current.getIdToken(true);
      setUser(auth.currentUser);
      const fresh = await refreshAccountAccess();
      return {
        verified: Boolean(auth.currentUser?.emailVerified),
        authorized: fresh.authorized,
        error: fresh.error,
      };
    } catch (err) {
      console.error("[Bianco Fit Auth] Falha ao revalidar verificação:", err);
      return {
        verified: false,
        authorized: false,
        error: "Não foi possível atualizar a verificação agora. Tente novamente.",
      };
    } finally {
      setAuthBusy(false);
    }
  }, [refreshAccountAccess]);

  const setupAdminPassword = useCallback(
    async (
      email: string,
      password: string
    ): Promise<{
      ok: boolean;
      verificationSent?: boolean;
      alreadyExists?: boolean;
      error?: string;
    }> => {
      setAuthError(null);

      const cleanEmail = normalizeEmail(email);
      if (!isBootstrappedAdminEmail(cleanEmail)) {
        const msg = "Acesso restrito ao administrador.";
        setAuthError(msg);
        return { ok: false, error: msg };
      }

      if (password.length < 6) {
        const msg = "A senha precisa ter pelo menos 6 caracteres.";
        setAuthError(msg);
        return { ok: false, error: msg };
      }

      const cfgCheck = validateFirebaseAuthConfig();
      if (!cfgCheck.valid) {
        const msg = `Configuração de autenticação incompleta (${cfgCheck.missingFields.join(", ")}).`;
        setAuthError(msg);
        return { ok: false, error: msg };
      }

      setAuthBusy(true);
      try {
        await ensureLocalAuthPersistence();
        pendingRegisterNameRef.current = "Administrador Personal Nutri Fit";
        pendingRegisterUsernameRef.current = deriveUsernameFromEmail(cleanEmail) || "admin";

        const cred = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        await updateFirebaseAuthProfile(cred.user, {
          displayName: "Administrador Personal Nutri Fit",
        }).catch(() => {});

        let verificationSent = false;
        try {
          await sendEmailVerification(cred.user);
          verificationSent = true;
        } catch (verifyErr) {
          console.warn(
            "[Bianco Fit Admin] Conta criada, mas envio automático da verificação falhou:",
            verifyErr
          );
        }

        return { ok: true, verificationSent };
      } catch (err) {
        pendingRegisterNameRef.current = null;
        pendingRegisterUsernameRef.current = null;
        const parsed = formatPasswordAuthError(err, "register");

        if (parsed.code === "auth/email-already-in-use") {
          const msg =
            "Este e-mail administrativo já possui uma conta cadastrada. Use a aba 'Entrar' ou clique abaixo para redefinir a senha por e-mail.";
          setAuthError(msg);
          return { ok: false, alreadyExists: true, error: msg };
        }

        setAuthError(parsed.friendly);
        return { ok: false, error: parsed.friendly };
      } finally {
        setAuthBusy(false);
      }
    },
    []
  );

  const sendAdminPasswordReset = useCallback(
    async (email: string): Promise<{ ok: boolean; error?: string }> => {
      setAuthError(null);

      const cleanEmail = normalizeEmail(email);
      if (!isBootstrappedAdminEmail(cleanEmail)) {
        const msg = "Acesso restrito ao administrador.";
        setAuthError(msg);
        return { ok: false, error: msg };
      }

      setAuthBusy(true);
      try {
        await sendPasswordResetEmail(auth, cleanEmail);
        return { ok: true };
      } catch (err) {
        const parsed = formatPasswordAuthError(err, "login");
        const msg =
          parsed.code === "auth/user-not-found"
            ? "Ainda não existe uma senha cadastrada para este e-mail. Use a aba 'Configurar Senha' para criar a senha inicial."
            : parsed.code === "auth/too-many-requests"
            ? parsed.friendly
            : "Não foi possível enviar o link de redefinição agora. Tente novamente em instantes.";
        setAuthError(msg);
        return { ok: false, error: msg };
      } finally {
        setAuthBusy(false);
      }
    },
    []
  );

  const changeCurrentUserPassword = useCallback(
    async (
      currentPassword: string,
      newPassword: string
    ): Promise<{ ok: boolean; error?: string }> => {
      const current = auth.currentUser;
      if (!current || !current.email) {
        return { ok: false, error: "Nenhuma conta administrativa conectada." };
      }
      if (newPassword.length < 6) {
        return { ok: false, error: "A nova senha precisa ter pelo menos 6 caracteres." };
      }
      if (currentPassword.length < 6) {
        return { ok: false, error: "Informe sua senha atual corretamente." };
      }

      setAuthBusy(true);
      try {
        const credential = EmailAuthProvider.credential(current.email, currentPassword);
        await reauthenticateWithCredential(current, credential);
        await updatePassword(current, newPassword);
        return { ok: true };
      } catch (err) {
        const parsed = formatPasswordAuthError(err, "login");
        let msg = parsed.friendly;
        if (
          parsed.code === "auth/invalid-credential" ||
          parsed.code === "auth/wrong-password"
        ) {
          msg = "A senha atual informada está incorreta.";
        } else if (parsed.code === "auth/requires-recent-login") {
          msg = "Por segurança, saia e entre novamente antes de alterar a senha.";
        } else if (parsed.code === "auth/weak-password") {
          msg = "A nova senha é muito fraca. Use pelo menos 6 caracteres.";
        }
        return { ok: false, error: msg };
      } finally {
        setAuthBusy(false);
      }
    },
    []
  );

  const signOutUser = useCallback(async () => {
    setAuthBusy(true);
    // Invalidate any in-flight Firestore hydration and cancel debounced writes before signing out
    authSyncGenerationRef.current += 1;
    cloudReadyRef.current = false;
    if (profileSyncTimerRef.current) {
      window.clearTimeout(profileSyncTimerRef.current);
      profileSyncTimerRef.current = null;
    }
    for (const key of Object.keys(loadSyncTimersRef.current)) {
      window.clearTimeout(loadSyncTimersRef.current[key]);
      delete loadSyncTimersRef.current[key];
    }
    try {
      await signOut(auth);
    } finally {
      setAuthBusy(false);
    }
  }, []);

  const scheduleProfileAndNutritionSync = useCallback(
    (nextProfile: StudentProfile, nextGoals: StudentGoals, nextComboId: string) => {
      const uid = auth.currentUser?.uid;
      if (!uid || !cloudReadyRef.current) return;

      if (profileSyncTimerRef.current) {
        window.clearTimeout(profileSyncTimerRef.current);
      }

      profileSyncTimerRef.current = window.setTimeout(() => {
        const nextMetab = calculateMetabolism(nextProfile);
        const lastDate = stateRef.current.workoutHistory[0]?.date || "";
        void updateCloudUserProfile(
          uid,
          nextProfile,
          nextGoals,
          nextComboId,
          nextMetab.waterTargetMl,
          streakRef.current,
          lastDate
        ).catch(() => {});
        void upsertNutritionProfile(uid, nextProfile, nextMetab).catch(() => {});
      }, 450);
    },
    []
  );

  const completeOnboarding = useCallback(
    (payload: OnboardingPayload) => {
      const today = getTodayIso();
      const nextActivity = frequencyToActivityLevel(payload.weeklyFrequency);
      const nextDeficit =
        payload.targetWeightKg < payload.weightKg ? "acelerado" : "moderado";

      setState((prev) => {
        const nextProfile: StudentProfile = {
          ...prev.profile,
          name: payload.name.trim(),
          sex: payload.sex,
          age: payload.age,
          avatar: payload.avatar || "preset:orange",
          heightCm: payload.heightCm,
          weightKg: payload.weightKg,
          targetWeightKg: payload.targetWeightKg,
          level: payload.level,
          weeklyFrequency: payload.weeklyFrequency,
          activityLevel: nextActivity,
          deficitMode: nextDeficit,
          onboardingCompleted: true,
        };

        const nextGoals: StudentGoals = {
          primary: payload.primaryGoal,
          focuses: payload.focuses,
          customNote: payload.customNote.trim(),
        };

        const hasTodayEntry = prev.measurements.some((m) => m.date === today);
        const initialMeasurement: BodyMeasurement | null = hasTodayEntry
          ? null
          : {
              id: `m_${Date.now()}`,
              date: today,
              weightKg: payload.weightKg,
            };

        const nextMeasurements = initialMeasurement
          ? [...prev.measurements, initialMeasurement].sort((a, b) =>
              a.date.localeCompare(b.date)
            )
          : prev.measurements;

        const nextPersonalChat =
          prev.personalChat.length <= 1
            ? [buildPersonalWelcome(nextProfile.name)]
            : prev.personalChat;
        const nextNutriChat =
          prev.nutriChat.length <= 1
            ? [buildNutriWelcome(nextProfile.name)]
            : prev.nutriChat;

        const uid = auth.currentUser?.uid;
        if (uid && cloudReadyRef.current) {
          const nextMetab = calculateMetabolism(nextProfile);
          void updateCloudUserProfile(
            uid,
            nextProfile,
            nextGoals,
            prev.activeComboId,
            nextMetab.waterTargetMl,
            streakRef.current,
            prev.workoutHistory[0]?.date || ""
          ).catch(() => {});
          void upsertNutritionProfile(uid, nextProfile, nextMetab).catch(() => {});
          if (initialMeasurement) {
            void createCloudMeasurement(uid, initialMeasurement).catch(() => {});
          }
        }

        return {
          ...prev,
          profile: nextProfile,
          goals: nextGoals,
          measurements: nextMeasurements,
          personalChat: nextPersonalChat,
          nutriChat: nextNutriChat,
        };
      });
    },
    []
  );

  const updateProfile = useCallback(
    (patch: Partial<StudentProfile>) => {
      setState((prev) => {
        const nextProfile = { ...prev.profile, ...patch };
        scheduleProfileAndNutritionSync(nextProfile, prev.goals, prev.activeComboId);
        return {
          ...prev,
          profile: nextProfile,
        };
      });
    },
    [scheduleProfileAndNutritionSync]
  );

  const updateGoals = useCallback(
    (patch: Partial<StudentGoals>) => {
      setState((prev) => {
        const nextGoals = { ...prev.goals, ...patch };
        scheduleProfileAndNutritionSync(prev.profile, nextGoals, prev.activeComboId);
        return {
          ...prev,
          goals: nextGoals,
        };
      });
    },
    [scheduleProfileAndNutritionSync]
  );

  const addWater = useCallback((amountMl: number) => {
    const today = getTodayIso();
    setState((prev) => {
      const nextMl = Math.max(
        0,
        (prev.water.date === today ? prev.water.consumedMl : 0) + amountMl
      );
      const uid = auth.currentUser?.uid;
      if (uid && cloudReadyRef.current) {
        void upsertDailyWaterLog(uid, today, nextMl).catch(() => {});
      }
      return {
        ...prev,
        water: { date: today, consumedMl: nextMl },
      };
    });
  }, []);

  const resetWater = useCallback(() => {
    const today = getTodayIso();
    const uid = auth.currentUser?.uid;
    if (uid && cloudReadyRef.current) {
      void upsertDailyWaterLog(uid, today, 0).catch(() => {});
    }
    setState((prev) => ({
      ...prev,
      water: { date: today, consumedMl: 0 },
    }));
  }, []);

  const setActiveComboId = useCallback(
    (comboId: string) => {
      const combo = WORKOUT_COMBOS.find((c) => c.id === comboId);
      setState((prev) => {
        const nextProfile = combo ? { ...prev.profile, muscleToday: combo.title } : prev.profile;
        scheduleProfileAndNutritionSync(nextProfile, prev.goals, comboId);
        return {
          ...prev,
          activeComboId: comboId,
          profile: nextProfile,
        };
      });
    },
    [scheduleProfileAndNutritionSync]
  );

  const updateExerciseLog = useCallback(
    (exerciseId: string, patch: Partial<ExerciseLogEntry>) => {
      setState((prev) => {
        const ex = EXERCISE_MAP[exerciseId];
        const current = prev.exerciseLogs[exerciseId] || {
          sets: ex?.defaultSets ?? 3,
          reps: ex?.defaultReps ?? "10-12",
          weightKg: ex?.defaultWeightKg ?? 20,
          lastWeightKg: ex?.defaultWeightKg ?? 20,
          completedSets: Array(ex?.defaultSets ?? 3).fill(false),
        };

        let nextCompleted = patch.completedSets ?? current.completedSets;
        if (patch.sets !== undefined && patch.sets !== current.sets) {
          const safeSets = Math.max(1, Math.min(8, patch.sets));
          nextCompleted = Array.from({ length: safeSets }, (_, idx) =>
            Boolean(current.completedSets[idx])
          );
        }

        const nextLog: ExerciseLogEntry = {
          ...current,
          ...patch,
          completedSets: nextCompleted,
        };

        const uid = auth.currentUser?.uid;
        if (uid && cloudReadyRef.current) {
          if (loadSyncTimersRef.current[exerciseId]) {
            window.clearTimeout(loadSyncTimersRef.current[exerciseId]);
          }
          loadSyncTimersRef.current[exerciseId] = window.setTimeout(() => {
            void upsertCloudExerciseLoad(uid, exerciseId, nextLog).catch(() => {});
          }, 500);
        }

        return {
          ...prev,
          exerciseLogs: {
            ...prev.exerciseLogs,
            [exerciseId]: nextLog,
          },
        };
      });
    },
    []
  );

  const toggleExerciseSet = useCallback((exerciseId: string, setIndex: number): boolean => {
    let becameChecked = false;
    setState((prev) => {
      const ex = EXERCISE_MAP[exerciseId];
      const current = prev.exerciseLogs[exerciseId] || {
        sets: ex?.defaultSets ?? 3,
        reps: ex?.defaultReps ?? "10-12",
        weightKg: ex?.defaultWeightKg ?? 20,
        lastWeightKg: ex?.defaultWeightKg ?? 20,
        completedSets: Array(ex?.defaultSets ?? 3).fill(false),
      };

      const nextCompleted = [...current.completedSets];
      while (nextCompleted.length < current.sets) nextCompleted.push(false);
      nextCompleted[setIndex] = !nextCompleted[setIndex];
      becameChecked = nextCompleted[setIndex];

      return {
        ...prev,
        exerciseLogs: {
          ...prev.exerciseLogs,
          [exerciseId]: {
            ...current,
            completedSets: nextCompleted,
          },
        },
      };
    });
    return becameChecked;
  }, []);

  const swapExerciseMachine = useCallback((originalId: string) => {
    setState((prev) => {
      const currentDisplayId = prev.swappedExercises[originalId] || originalId;
      const orig = EXERCISE_MAP[originalId];
      if (!orig || orig.alternatives.length === 0) return prev;

      const cycle = [originalId, ...orig.alternatives];
      const currIdx = cycle.indexOf(currentDisplayId);
      const nextId = cycle[(currIdx + 1) % cycle.length];

      return {
        ...prev,
        swappedExercises: {
          ...prev.swappedExercises,
          [originalId]: nextId,
        },
      };
    });
  }, []);

  const finishWorkout = useCallback(
    (title: string, muscleGroup: string, exerciseIds: string[], durationMin: number) => {
      const today = getTodayIso();
      setState((prev) => {
        let totalVolumeKg = 0;
        let setsCompleted = 0;
        const nextLogs = { ...prev.exerciseLogs };
        const updatedIds: string[] = [];

        for (const baseId of exerciseIds) {
          const exId = prev.swappedExercises[baseId] || baseId;
          const log = prev.exerciseLogs[exId];
          if (!log) continue;
          const doneCount = log.completedSets.filter(Boolean).length;
          if (doneCount > 0) {
            setsCompleted += doneCount;
            const repMatch = log.reps.match(/\d+/);
            const numericReps = repMatch ? Number(repMatch[0]) : 10;
            const effectiveWeight = log.weightKg > 0 ? log.weightKg : 15;
            totalVolumeKg += Math.round(doneCount * numericReps * effectiveWeight);

            nextLogs[exId] = {
              ...log,
              lastWeightKg: log.weightKg,
              completedSets: Array(log.sets).fill(false),
            };
            updatedIds.push(exId);
          }
        }

        const record: CompletedWorkout = {
          id: `w_${Date.now()}`,
          date: today,
          title,
          muscleGroup,
          totalVolumeKg: Math.max(totalVolumeKg, 1200),
          setsCompleted: Math.max(setsCompleted, exerciseIds.length * 3),
          durationMin,
        };

        const uid = auth.currentUser?.uid;
        if (uid && cloudReadyRef.current) {
          void createCloudWorkoutSession(uid, record).catch(() => {});
          for (const exId of updatedIds) {
            void upsertCloudExerciseLoad(uid, exId, nextLogs[exId]).catch(() => {});
          }
          const nextMetab = calculateMetabolism(prev.profile);
          void updateCloudUserProfile(
            uid,
            prev.profile,
            prev.goals,
            prev.activeComboId,
            nextMetab.waterTargetMl,
            streakRef.current + 1,
            today
          ).catch(() => {});
        }

        return {
          ...prev,
          exerciseLogs: nextLogs,
          workoutHistory: [record, ...prev.workoutHistory],
        };
      });
    },
    []
  );

  const logModalitySession = useCallback(
    (title: string, category: string, durationMin: number) => {
      const today = getTodayIso();
      const record: CompletedWorkout = {
        id: `mod_${Date.now()}`,
        date: today,
        title,
        muscleGroup: category,
        totalVolumeKg: 0,
        setsCompleted: 1,
        durationMin,
      };

      const uid = auth.currentUser?.uid;
      if (uid && cloudReadyRef.current) {
        void createCloudWorkoutSession(uid, record).catch(() => {});
      }

      setState((prev) => ({
        ...prev,
        workoutHistory: [record, ...prev.workoutHistory],
      }));
    },
    []
  );

  const saveAiPlan = useCallback((content: string, muscleToday: string) => {
    const firstHeadingMatch = content.match(/^#+\s*(.+)$/m);
    const derivedTitle = firstHeadingMatch
      ? firstHeadingMatch[1].replace(/\*\*/g, "").trim()
      : `Ficha Personal IA — ${muscleToday}`;

    const plan: SavedAiPlan = {
      id: `plan_${Date.now()}`,
      title: derivedTitle.slice(0, 70),
      muscleToday,
      content,
      savedAt: new Date().toISOString(),
      matchedExerciseIds: matchExercisesFromPlanText(content),
    };

    const uid = auth.currentUser?.uid;
    if (uid && cloudReadyRef.current) {
      void saveCloudWorkoutPlan(uid, plan).catch(() => {});
    }

    setState((prev) => ({
      ...prev,
      savedPlan: plan,
    }));
  }, []);

  const clearSavedPlan = useCallback(() => {
    const currentPlanId = stateRef.current.savedPlan?.id;
    const uid = auth.currentUser?.uid;
    if (uid && cloudReadyRef.current && currentPlanId) {
      void deleteCloudWorkoutPlan(uid, currentPlanId).catch(() => {});
    }
    setState((prev) => ({ ...prev, savedPlan: null }));
  }, []);

  const addMeasurement = useCallback(
    (entry: Omit<BodyMeasurement, "id">) => {
      const nextEntry: BodyMeasurement = {
        ...entry,
        id: `m_${Date.now()}`,
      };

      const uid = auth.currentUser?.uid;
      if (uid && cloudReadyRef.current) {
        void createCloudMeasurement(uid, nextEntry).catch(() => {});
      }

      setState((prev) => {
        const updated = [...prev.measurements, nextEntry].sort((a, b) =>
          a.date.localeCompare(b.date)
        );
        const nextProfile = {
          ...prev.profile,
          weightKg: entry.weightKg,
        };
        scheduleProfileAndNutritionSync(nextProfile, prev.goals, prev.activeComboId);
        return {
          ...prev,
          measurements: updated,
          profile: nextProfile,
        };
      });
    },
    [scheduleProfileAndNutritionSync]
  );

  const deleteMeasurement = useCallback((id: string) => {
    const uid = auth.currentUser?.uid;
    if (uid && cloudReadyRef.current) {
      void deleteCloudMeasurement(uid, id).catch(() => {});
    }
    setState((prev) => ({
      ...prev,
      measurements: prev.measurements.filter((m) => m.id !== id),
    }));
  }, []);

  const persistChatMessage = useCallback(
    (agentType: "personal" | "nutri", msg: ChatMessage) => {
      const uid = auth.currentUser?.uid;
      if (uid && cloudReadyRef.current && msg.content.trim()) {
        void createCloudChatMessage(uid, agentType, msg).catch((err) => {
          console.warn(`[Bianco Fit Chat Sync] Falha ao salvar mensagem (${agentType}):`, err);
        });
      }
    },
    []
  );

  const clearCloudChat = useCallback((agentType: "personal" | "nutri") => {
    const uid = auth.currentUser?.uid;
    if (uid && cloudReadyRef.current) {
      void clearCloudChatMessages(uid, agentType).catch((err) => {
        console.warn(`[Bianco Fit Chat Sync] Falha ao limpar histórico (${agentType}):`, err);
      });
    }
  }, []);

  const setPersonalChat = useCallback(
    (updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
      setState((prev) => ({
        ...prev,
        personalChat: typeof updater === "function" ? updater(prev.personalChat) : updater,
      }));
    },
    []
  );

  const setNutriChat = useCallback(
    (updater: ChatMessage[] | ((prev: ChatMessage[]) => ChatMessage[])) => {
      setState((prev) => ({
        ...prev,
        nutriChat: typeof updater === "function" ? updater(prev.nutriChat) : updater,
      }));
    },
    []
  );

  const exportDataJson = useCallback((): string => {
    const current = stateRef.current;
    const metab = calculateMetabolism(current.profile);
    return JSON.stringify(
      {
        app: "Personal Nutri Fit",
        exportedAt: new Date().toISOString(),
        profile: current.profile,
        goals: current.goals,
        metabolism: metab,
        water: current.water,
        measurements: current.measurements,
        workoutHistory: current.workoutHistory,
        savedPlan: current.savedPlan,
        exerciseLogs: current.exerciseLogs,
        unlockedBadges: current.unlockedBadges,
      },
      null,
      2
    );
  }, []);

  const resetAllData = useCallback(() => {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // ignore storage error
    }
    const fresh = createDefaultState();
    setState(fresh);
  }, []);

  return {
    state,
    metabolism,
    latestMeasurement,
    previousMeasurement,
    streakDays,
    achievements,
    user,
    authReady,
    authBusy,
    authError,
    accountAccess,
    isAdmin:
      accountAccess.loaded &&
      accountAccess.role === "admin" &&
      accountAccess.status === "autorizado",
    refreshAccountAccess,
    clearAuthError,
    signInWithGoogle,
    signInWithCredentials,
    sendUserPasswordReset,
    sendVerificationForCurrentUser,
    reloadCurrentUserVerification,
    setupAdminPassword,
    sendAdminPasswordReset,
    changeCurrentUserPassword,
    signOutUser,
    completeOnboarding,
    updateProfile,
    updateGoals,
    addWater,
    resetWater,
    setActiveComboId,
    updateExerciseLog,
    toggleExerciseSet,
    swapExerciseMachine,
    finishWorkout,
    logModalitySession,
    saveAiPlan,
    clearSavedPlan,
    addMeasurement,
    deleteMeasurement,
    setPersonalChat,
    setNutriChat,
    persistChatMessage,
    clearCloudChat,
    exportDataJson,
    resetAllData,
  };
}
