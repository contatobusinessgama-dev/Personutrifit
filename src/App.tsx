import React, { useCallback, useEffect, useState } from "react";
import { AnimatePresence, MotionConfig, motion } from "motion/react";
import {
  Dumbbell,
  Home,
  Loader2,
  LogOut,
  ShieldCheck,
  Sparkles,
  Timer,
  TrendingUp,
  User as UserIcon,
  Utensils,
} from "lucide-react";
import { AccessStatusGate } from "./components/AccessStatusGate";
import { AdminPortalPage } from "./components/AdminPortalPage";
import { AdminTab } from "./components/AdminTab";
import { DashboardTab } from "./components/DashboardTab";
import { EvolutionTab } from "./components/EvolutionTab";
import { LandingPage } from "./components/LandingPage";
import { NutriAiTab } from "./components/NutriAiTab";
import { OnboardingFlow } from "./components/OnboardingFlow";
import { PersonalAiTab } from "./components/PersonalAiTab";
import { ProfileTab } from "./components/ProfileTab";
import { PWAInstallButton } from "./components/PWAInstallButton";
import { RestTimerBar } from "./components/RestTimerBar";
import { StudentAvatar } from "./components/StudentAvatar";
import { ThemeToggleButton } from "./components/ErrorBoundary";
import { ToastContainer } from "./components/ToastContainer";
import { WorkoutsTab } from "./components/WorkoutsTab";
import { useBiancoState } from "./hooks/useBiancoState";
import {
  formatStudentHandle,
  isBootstrappedAdminEmail,
  isSyntheticUsernameEmail,
} from "./lib/firestoreSync";
import { AchievementProgressItem, TabId, ToastItem, ToastOptions } from "./types";
import {
  CARD_HOVER_TRANSITION,
  NAV_SPRING,
  TAB_ORDER,
  tabPanelVariants,
} from "./utils/motion";

const PRIMARY_NAV_ITEMS: {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "inicio", label: "Início", icon: Home },
  { id: "treinos", label: "Treinos", icon: Dumbbell },
  { id: "personal", label: "Personal IA", icon: Sparkles },
  { id: "nutri", label: "Nutri IA", icon: Utensils },
  { id: "evolucao", label: "Evolução", icon: TrendingUp },
];

const DESKTOP_NAV_ITEMS: {
  id: TabId;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  ...PRIMARY_NAV_ITEMS,
  { id: "perfil", label: "Perfil & Medidas", icon: UserIcon },
];

function isExercisesPathname(pathname: string): boolean {
  return (
    pathname === "/exercicios" ||
    pathname.startsWith("/exercicios/") ||
    pathname === "/treinos" ||
    pathname.startsWith("/treinos/")
  );
}

function isAppPathname(pathname: string): boolean {
  return (
    pathname.startsWith("/app") ||
    pathname.startsWith("/inicio") ||
    isExercisesPathname(pathname)
  );
}

function isAdminPathname(pathname: string): boolean {
  return pathname === "/admin" || pathname.startsWith("/admin/");
}

export default function App() {
  // Discreet Toast queue
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismissToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const addToast = useCallback(
    (
      message: string,
      tone: ToastItem["tone"] = "success",
      options?: ToastOptions
    ) => {
      const id = `toast_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
      setToasts((prev) => [
        ...prev.slice(-2),
        {
          id,
          message,
          tone,
          actionLabel: options?.actionLabel,
          onAction: options?.onAction,
        },
      ]);
      const durationMs =
        options?.durationMs ??
        (options?.onAction ? 9500 : tone === "warning" ? 7500 : 3800);
      window.setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, durationMs);
    },
    []
  );

  const handleAchievementUnlocked = useCallback(
    (badge: AchievementProgressItem) => {
      addToast(`Nova conquista desbloqueada: ${badge.title}!`, "success");
    },
    [addToast]
  );

  const {
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
    isAdmin,
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
  } = useBiancoState(handleAchievementUnlocked);

  const [pathname, setPathname] = useState<string>(() => window.location.pathname || "/");
  const [tabState, setTabState] = useState<{ tab: TabId; direction: number }>(() => ({
    tab: isExercisesPathname(window.location.pathname || "/") ? "treinos" : "inicio",
    direction: 0,
  }));
  const activeTab = tabState.tab;

  const setActiveTab = useCallback((nextTab: TabId) => {
    setTabState((prev) => {
      if (prev.tab === nextTab) return prev;
      const prevIdx = TAB_ORDER[prev.tab] ?? 0;
      const nextIdx = TAB_ORDER[nextTab] ?? 0;
      const direction = nextIdx === prevIdx ? 0 : nextIdx > prevIdx ? 1 : -1;
      return { tab: nextTab, direction };
    });
  }, []);

  const navigatePath = useCallback((nextPath: string, replace = false) => {
    if (window.location.pathname !== nextPath) {
      if (replace) {
        window.history.replaceState({}, "", nextPath);
      } else {
        window.history.pushState({}, "", nextPath);
      }
    }
    setPathname(nextPath);
  }, []);

  useEffect(() => {
    const onPopState = () => {
      const current = window.location.pathname || "/";
      setPathname(current);
      if (isExercisesPathname(current)) {
        setActiveTab("treinos");
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, [setActiveTab]);

  // Keep /exercicios & /treinos synced with the "treinos" tab
  useEffect(() => {
    if (user && isExercisesPathname(pathname)) {
      setActiveTab("treinos");
    }
  }, [user, pathname, setActiveTab]);

  // Automatically redirect logged-in users from "/" to "/app" (never hijack "/admin" or "/exercicios")
  useEffect(() => {
    if (user && !isAppPathname(pathname) && !isAdminPathname(pathname)) {
      navigatePath("/app", true);
    }
  }, [user, pathname, navigatePath]);

  // Route Security: Block regular logged-in students from accessing /admin and redirect to Dashboard
  const isRegularStudentOnAdmin = Boolean(
    authReady &&
      user &&
      accountAccess.loaded &&
      isAdminPathname(pathname) &&
      !isAdmin &&
      !isBootstrappedAdminEmail(user.email)
  );

  useEffect(() => {
    if (isRegularStudentOnAdmin) {
      addToast(
        "Acesso restrito ao administrador. Redirecionando para o Dashboard.",
        "warning"
      );
      setActiveTab("inicio");
      navigatePath("/app", true);
    }
  }, [isRegularStudentOnAdmin, addToast, setActiveTab, navigatePath]);

  // If visitor navigates directly to /app or /exercicios without logging in, show Landing cleanly
  useEffect(() => {
    if (authReady && !user && isAppPathname(pathname)) {
      navigatePath("/", true);
    }
  }, [authReady, user, pathname, navigatePath]);

  // If non-admin somehow has activeTab === "admin", return safely to inicio
  useEffect(() => {
    if (activeTab === "admin" && !isAdmin) {
      setActiveTab("inicio");
    }
  }, [activeTab, isAdmin, setActiveTab]);

  const handlePasswordReset = useCallback(
    async (email: string) => {
      const res = await sendUserPasswordReset(email);
      if (res.ok) {
        addToast(
          `Link de recuperação enviado para ${res.email || email}. Verifique sua caixa de entrada e spam.`,
          "success"
        );
      } else if (res.error) {
        addToast(res.error, "warning");
      }
      return res;
    },
    [sendUserPasswordReset, addToast]
  );

  const handleGoogleAuth = useCallback(
    async (stayOnCurrentPath = false): Promise<boolean> => {
      const res = await signInWithGoogle();
      if (res.ok) {
        if (!stayOnCurrentPath && !res.redirecting) {
          navigatePath("/app");
        }
        if (!res.redirecting) {
          addToast("Login com Google realizado com sucesso!", "success");
        }
        return true;
      }
      if (!res.cancelled && res.error) {
        addToast(res.error, "warning");
      }
      return false;
    },
    [signInWithGoogle, navigatePath, addToast]
  );

  const handleCredentialsAuth = useCallback(
    async (
      identifier: string,
      password: string,
      mode: "login" | "register",
      fullName?: string,
      stayOnCurrentPath = false
    ): Promise<boolean> => {
      const res = await signInWithCredentials(identifier, password, mode, fullName);
      if (res.ok) {
        if (!stayOnCurrentPath) {
          navigatePath("/app");
        }
        if (mode === "register") {
          addToast(
            res.isPendingApproval
              ? "Cadastro enviado! Seu acesso está em análise e será liberado pelo administrador."
              : "Conta criada com sucesso!",
            res.isPendingApproval ? "info" : "success"
          );
        } else {
          addToast("Bem-vindo de volta!", "success");
        }
        return true;
      }
      if (res.error) {
        addToast(res.error, "warning");
      }
      return false;
    },
    [signInWithCredentials, navigatePath, addToast]
  );

  const handleSignOut = useCallback(
    async (redirectTarget = "/") => {
      if (user) {
        await signOutUser();
      }
      navigatePath(redirectTarget);
      addToast("Você saiu da sua conta.", "info");
    },
    [user, signOutUser, navigatePath, addToast]
  );

  // Rest countdown timer state
  const [timerVisible, setTimerVisible] = useState(false);
  const [timerTotal, setTimerTotal] = useState(60);
  const [timerLeft, setTimerLeft] = useState(60);
  const [timerRunning, setTimerRunning] = useState(false);

  useEffect(() => {
    if (!timerRunning) return;
    const id = window.setInterval(() => {
      setTimerLeft((prev) => {
        if (prev <= 1) {
          setTimerRunning(false);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(id);
  }, [timerRunning]);

  const startRestTimer = useCallback((seconds: number) => {
    setTimerTotal(seconds);
    setTimerLeft(seconds);
    setTimerVisible(true);
    setTimerRunning(true);
  }, []);

  const handleToggleTimerRun = useCallback(() => {
    setTimerRunning((prev) => {
      if (!prev && timerLeft === 0) {
        setTimerLeft(timerTotal);
      }
      return !prev;
    });
  }, [timerLeft, timerTotal]);

  const handleResetTimer = useCallback(() => {
    setTimerLeft(timerTotal);
    setTimerRunning(true);
  }, [timerTotal]);

  const handleNavigateTab = useCallback(
    (tab: TabId) => {
      setActiveTab(tab);
      if (tab === "treinos" && pathname !== "/exercicios" && pathname !== "/app") {
        navigatePath("/app", true);
      } else if (tab !== "treinos" && isExercisesPathname(pathname)) {
        navigatePath("/app", true);
      }
      window.scrollTo({ top: 0, behavior: "smooth" });
    },
    [setActiveTab, pathname, navigatePath]
  );

  // Dedicated /admin route (auto-blocks regular logged-in students)
  if (isAdminPathname(pathname) && !isRegularStudentOnAdmin) {
    return (
      <>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <AdminPortalPage
          user={user}
          authReady={authReady}
          authBusy={authBusy}
          authError={authError}
          accountAccess={accountAccess}
          isAdmin={isAdmin}
          onClearAuthError={clearAuthError}
          onGoogleLogin={() => handleGoogleAuth(true)}
          onAdminEmailLogin={(email, password) =>
            handleCredentialsAuth(email, password, "login", undefined, true)
          }
          onSetupAdminPassword={setupAdminPassword}
          onSendAdminPasswordReset={sendAdminPasswordReset}
          onChangeAdminPassword={changeCurrentUserPassword}
          onSendVerificationEmail={sendVerificationForCurrentUser}
          onReloadVerification={reloadCurrentUserVerification}
          onSignOut={() => handleSignOut("/admin")}
          onGoToApp={() => {
            setActiveTab("inicio");
            navigatePath("/app");
          }}
          onGoToLanding={() => navigatePath("/")}
          onToast={addToast}
        />
      </>
    );
  }

  // Public Landing Page ("/") for unauthenticated visitors — no guest/test bypass
  if (!user) {
    return (
      <>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <LandingPage
          authBusy={authBusy}
          authError={authError}
          onClearAuthError={clearAuthError}
          onGoogleAuth={() => handleGoogleAuth(false)}
          onCredentialsAuth={(identifier, password, mode, fullName) =>
            handleCredentialsAuth(identifier, password, mode, fullName, false)
          }
          onSendPasswordReset={handlePasswordReset}
          onNavigateAdmin={() => navigatePath("/admin")}
        />
      </>
    );
  }

  // Wait for Firestore RBAC status verification for authenticated accounts
  if (user && !accountAccess.loaded) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0B0D] text-[#0F172A] dark:text-white flex flex-col items-center justify-center gap-3 px-4 transition-colors">
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <Loader2 className="w-7 h-7 text-[#FF6B00] animate-spin" />
        <p className="text-sm font-medium text-[#475569] dark:text-[#A1A1AA]">
          Verificando permissões da conta...
        </p>
      </div>
    );
  }

  // Block pending or blocked authenticated accounts before Onboarding / Dashboard
  if (user && accountAccess.status !== "autorizado" && !isAdmin) {
    return (
      <>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <AccessStatusGate
          accountAccess={accountAccess}
          displayName={user.displayName || state.profile.name}
          authBusy={authBusy}
          onRefreshStatus={refreshAccountAccess}
          onSignOut={() => handleSignOut("/")}
          onToast={addToast}
        />
      </>
    );
  }

  const desktopNavItems = isAdmin
    ? [...DESKTOP_NAV_ITEMS, { id: "admin" as TabId, label: "Admin", icon: ShieldCheck }]
    : DESKTOP_NAV_ITEMS;

  // Show 3-step professional Onboarding on first access inside /app
  if (!state.profile.onboardingCompleted) {
    return (
      <>
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />
        <OnboardingFlow
          initialName={state.profile.name || accountAccess.fullName || user?.displayName || ""}
          initialAvatar={state.profile.avatar || "preset:orange"}
          authBusy={authBusy}
          authError={authError}
          onExit={() => handleSignOut("/")}
          onComplete={(payload) => {
            completeOnboarding(payload);
            setActiveTab("inicio");
          }}
          onToast={addToast}
        />
      </>
    );
  }

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0B0D] text-[#0F172A] dark:text-white flex flex-col md:flex-row transition-colors duration-200">
        <ToastContainer toasts={toasts} onDismiss={dismissToast} />

        {/* Desktop Compact Left Sidebar */}
        <aside
          aria-label="Navegação principal"
          className="hidden md:flex md:flex-col md:w-60 lg:w-64 shrink-0 border-r border-[#E2E8F0] dark:border-[#26262B] bg-white dark:bg-[#0B0B0D] sticky top-0 h-screen transition-colors"
        >
          <div className="px-5 py-5 flex items-center justify-between gap-2 border-b border-[#E2E8F0] dark:border-[#26262B]">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-9 h-9 rounded-xl bg-[#FF6B00] flex items-center justify-center shrink-0 shadow-md shadow-[#FF6B00]/20">
                <Dumbbell className="w-5 h-5 text-white" />
              </div>
              <span className="font-display text-base lg:text-[17px] font-extrabold tracking-tight text-[#0F172A] dark:text-white whitespace-nowrap truncate">
                Personal Nutri <span className="text-[#FF6B00]">Fit</span>
              </span>
            </div>
            <ThemeToggleButton size="sm" />
          </div>

          <nav className="flex-1 px-3 py-5 space-y-1.5 overflow-y-auto">
            {desktopNavItems.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <motion.button
                  key={item.id}
                  type="button"
                  whileTap={{ scale: 0.98 }}
                  transition={CARD_HOVER_TRANSITION}
                  aria-current={active ? "page" : undefined}
                  onClick={() => handleNavigateTab(item.id)}
                  className={`relative w-full min-h-[46px] px-3.5 rounded-xl flex items-center gap-3 text-sm font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? "text-white"
                      : "text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white hover:bg-[#F1F5F9] dark:hover:bg-[#151518]"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="bianco-desktop-nav-active"
                      transition={NAV_SPRING}
                      aria-hidden="true"
                      className="absolute inset-0 rounded-xl bg-[#FF6B00] shadow-lg shadow-[#FF6B00]/25"
                    />
                  )}
                  <Icon className="relative z-10 w-5 h-5 shrink-0" />
                  <span className="relative z-10">{item.label}</span>
                </motion.button>
              );
            })}
          </nav>

          {/* Sidebar Account & Daily Utility */}
          <div className="p-4 border-t border-[#E2E8F0] dark:border-[#26262B] space-y-3">
            <div className="flex items-center justify-between gap-2 pb-2.5 border-b border-[#E2E8F0] dark:border-[#26262B]">
              <button
                type="button"
                onClick={() => handleNavigateTab("perfil")}
                className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer group"
              >
                <StudentAvatar
                  avatar={state.profile.avatar}
                  name={state.profile.name}
                  size="sm"
                  className="group-hover:border-[#FF6B00] transition-colors"
                />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-[#0F172A] dark:text-white truncate group-hover:text-[#FF6B00] transition-colors">
                    {state.profile.name}
                  </p>
                  <p className="text-[11px] text-[#475569] dark:text-[#A1A1AA] truncate">
                    {isSyntheticUsernameEmail(user.email)
                      ? formatStudentHandle(accountAccess.username, user.email)
                      : accountAccess.username
                      ? formatStudentHandle(accountAccess.username, user.email)
                      : user.email}
                  </p>
                </div>
              </button>
              <button
                type="button"
                disabled={authBusy}
                onClick={() => void handleSignOut()}
                aria-label="Sair da conta"
                title="Sair"
                className="min-h-[36px] min-w-[36px] rounded-lg bg-[#F8FAFC] dark:bg-[#151518] hover:bg-[#F1F5F9] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white flex items-center justify-center shrink-0 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>

            {authError && (
              <p className="text-[11px] text-red-600 dark:text-red-300">{authError}</p>
            )}

            <div className="text-xs text-[#475569] dark:text-[#A1A1AA] space-y-1">
              <div className="flex items-center justify-between">
                <span>Meta diária</span>
                <span className="font-mono font-semibold text-[#0F172A] dark:text-white tabular-nums">
                  {metabolism.calorieTarget} kcal
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>Água hoje</span>
                <span className="font-mono font-semibold text-[#FF6B00] tabular-nums">
                  {(state.water.consumedMl / 1000).toFixed(2)} L
                </span>
              </div>
            </div>

            <PWAInstallButton compact />

            <button
              type="button"
              onClick={() => startRestTimer(60)}
              className="w-full min-h-[42px] px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#151518] hover:bg-[#F1F5F9] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00]/50 text-xs font-semibold text-[#0F172A] dark:text-white flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
            >
              <Timer className="w-4 h-4 text-[#FF6B00]" />
              <span>Cronômetro 60s</span>
            </button>
          </div>
        </aside>

        {/* Mobile Compact Header */}
        <div className="md:hidden sticky top-0 z-30 flex items-center justify-between gap-2 px-4 py-3 border-b border-[#E2E8F0] dark:border-[#26262B] bg-white/95 dark:bg-[#0B0B0D]/95 backdrop-blur-md transition-colors">
          <div className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-[#FF6B00] flex items-center justify-center shrink-0">
              <Dumbbell className="w-4 h-4 text-white" />
            </div>
            <span className="font-display text-sm sm:text-base font-extrabold tracking-tight text-[#0F172A] dark:text-white whitespace-nowrap">
              Personal Nutri <span className="text-[#FF6B00]">Fit</span>
            </span>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            {isAdmin && (
              <button
                type="button"
                onClick={() => handleNavigateTab("admin")}
                aria-label="Abrir painel administrativo"
                className={`min-h-[38px] px-2.5 rounded-xl border text-xs font-semibold flex items-center gap-1 whitespace-nowrap cursor-pointer transition-colors ${
                  activeTab === "admin"
                    ? "bg-[#FF6B00] border-[#FF6B00] text-white"
                    : "bg-[#F8FAFC] dark:bg-[#151518] border-[#E2E8F0] dark:border-[#26262B] text-[#0F172A] dark:text-white"
                }`}
              >
                <ShieldCheck
                  className={`w-3.5 h-3.5 ${
                    activeTab === "admin" ? "text-white" : "text-[#FF6B00]"
                  }`}
                />
                <span className="hidden xs:inline">Admin</span>
              </button>
            )}

            <ThemeToggleButton size="sm" />

            <button
              type="button"
              onClick={() => startRestTimer(60)}
              aria-label="Abrir cronômetro de descanso"
              className="min-h-[38px] px-2.5 rounded-xl bg-[#F8FAFC] dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] text-xs font-semibold text-[#0F172A] dark:text-white flex items-center gap-1 whitespace-nowrap cursor-pointer"
            >
              <Timer className="w-3.5 h-3.5 text-[#FF6B00]" />
              <span className="font-mono tabular-nums">
                {timerVisible ? `${timerLeft}s` : "60s"}
              </span>
            </button>

            <button
              type="button"
              onClick={() => handleNavigateTab("perfil")}
              aria-label="Abrir perfil do aluno"
              className={`rounded-2xl transition-all cursor-pointer ${
                activeTab === "perfil" ? "ring-2 ring-[#FF6B00]" : ""
              }`}
            >
              <StudentAvatar
                avatar={state.profile.avatar}
                name={state.profile.name}
                size="sm"
              />
            </button>
          </div>
        </div>

        {/* Main Content Area */}
        <main className="flex-1 min-w-0 overflow-x-clip">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-5 sm:pt-7 pb-24 md:pb-10">
            <AnimatePresence mode="wait" initial={false} custom={tabState.direction}>
              <motion.div
                key={activeTab}
                custom={tabState.direction}
                variants={tabPanelVariants}
                initial="initial"
                animate="animate"
                exit="exit"
                className="will-change-transform"
              >
                {activeTab === "inicio" && (
                  <DashboardTab
                    state={state}
                    metabolism={metabolism}
                    streakDays={streakDays}
                    achievements={achievements}
                    onUpdateGoals={updateGoals}
                    onAddWater={addWater}
                    onResetWater={resetWater}
                    onStartTodayWorkout={() => handleNavigateTab("treinos")}
                    onNavigateTab={handleNavigateTab}
                  />
                )}

                {activeTab === "treinos" && (
                  <WorkoutsTab
                    state={state}
                    onUpdateGoals={updateGoals}
                    onSelectCombo={setActiveComboId}
                    onUpdateExerciseLog={updateExerciseLog}
                    onToggleSet={toggleExerciseSet}
                    onSwapMachine={swapExerciseMachine}
                    onFinishWorkout={finishWorkout}
                    onLogModality={logModalitySession}
                    onClearSavedPlan={clearSavedPlan}
                    onStartRest={startRestTimer}
                    onToast={addToast}
                  />
                )}

                {activeTab === "personal" && (
                  <PersonalAiTab
                    state={state}
                    metabolism={metabolism}
                    latestMeasurement={latestMeasurement}
                    onUpdateProfile={updateProfile}
                    onSetChat={setPersonalChat}
                    onPersistMessage={(msg) => persistChatMessage("personal", msg)}
                    onClearCloudChat={() => clearCloudChat("personal")}
                    onSavePlan={saveAiPlan}
                    onNavigateTab={handleNavigateTab}
                    onToast={addToast}
                  />
                )}

                {activeTab === "nutri" && (
                  <NutriAiTab
                    state={state}
                    metabolism={metabolism}
                    latestMeasurement={latestMeasurement}
                    onUpdateProfile={updateProfile}
                    onSetChat={setNutriChat}
                    onPersistMessage={(msg) => persistChatMessage("nutri", msg)}
                    onClearCloudChat={() => clearCloudChat("nutri")}
                    onToast={addToast}
                  />
                )}

                {activeTab === "evolucao" && (
                  <EvolutionTab
                    state={state}
                    onAddMeasurement={addMeasurement}
                    onDeleteMeasurement={deleteMeasurement}
                    onUpdateProfile={updateProfile}
                    onNavigateTab={handleNavigateTab}
                    onToast={addToast}
                  />
                )}

                {activeTab === "perfil" && (
                  <ProfileTab
                    state={state}
                    metabolism={metabolism}
                    latestMeasurement={latestMeasurement}
                    previousMeasurement={previousMeasurement}
                    streakDays={streakDays}
                    onUpdateProfile={updateProfile}
                    onAddMeasurement={addMeasurement}
                    onExportJson={exportDataJson}
                    onResetAllData={() => {
                      resetAllData();
                      setActiveTab("inicio");
                    }}
                    onSignOut={() => handleSignOut("/")}
                    authBusy={authBusy}
                    onToast={addToast}
                  />
                )}

                {activeTab === "admin" && isAdmin && user && (
                  <AdminTab
                    currentUserUid={user.uid}
                    currentUserEmail={accountAccess.email || user.email || ""}
                    canListDirectory={accountAccess.canListDirectory}
                    onToast={addToast}
                  />
                )}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>

        {/* Mobile Fixed Bottom Navigation Bar */}
        <nav
          aria-label="Navegação inferior"
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 dark:bg-[#0B0B0D]/95 backdrop-blur-md border-t border-[#E2E8F0] dark:border-[#26262B] pb-safe transition-colors"
        >
          <div className="grid grid-cols-5 h-16 items-center">
            {PRIMARY_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = activeTab === item.id;
              return (
                <motion.button
                  key={item.id}
                  type="button"
                  whileTap={{ scale: 0.93 }}
                  transition={CARD_HOVER_TRANSITION}
                  aria-current={active ? "page" : undefined}
                  onClick={() => handleNavigateTab(item.id)}
                  className={`relative h-full flex flex-col items-center justify-center gap-1 transition-colors cursor-pointer ${
                    active
                      ? "text-[#FF6B00]"
                      : "text-[#64748B] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white"
                  }`}
                >
                  {active && (
                    <motion.span
                      layoutId="bianco-mobile-nav-active"
                      transition={NAV_SPRING}
                      aria-hidden="true"
                      className="absolute top-0 left-1/2 -translate-x-1/2 h-[2.5px] w-9 rounded-b-full bg-[#FF6B00] shadow-[0_2px_10px_rgba(255,107,0,0.6)]"
                    />
                  )}
                  <motion.span
                    animate={{ y: active ? -1 : 0 }}
                    transition={CARD_HOVER_TRANSITION}
                    className="inline-flex"
                  >
                    <Icon className="w-5 h-5" />
                  </motion.span>
                  <span className="text-[10px] font-semibold tracking-tight whitespace-nowrap">
                    {item.label}
                  </span>
                </motion.button>
              );
            })}
          </div>
        </nav>

        {/* Floating Rest Timer Bar */}
        <RestTimerBar
          secondsLeft={timerLeft}
          totalSeconds={timerTotal}
          isRunning={timerRunning}
          isVisible={timerVisible}
          onStartPreset={startRestTimer}
          onToggleRun={handleToggleTimerRun}
          onReset={handleResetTimer}
          onClose={() => {
            setTimerVisible(false);
            setTimerRunning(false);
          }}
        />
      </div>
    </MotionConfig>
  );
}
