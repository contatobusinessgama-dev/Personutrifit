import React, { useState } from "react";
import { User } from "firebase/auth";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Dumbbell,
  ExternalLink,
  Eye,
  EyeOff,
  KeyRound,
  Loader2,
  Lock,
  LogOut,
  Mail,
  RefreshCw,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { isBootstrappedAdminEmail, normalizeEmail } from "../lib/firestoreSync";
import { AccountAccessState, ToastItem } from "../types";
import { AdminTab } from "./AdminTab";
import { ThemeToggleButton } from "./ErrorBoundary";

const PRIMARY_ADMIN_EMAIL = "contato.servicosgama@gmail.com";

const GoogleMark: React.FC<{ className?: string }> = ({ className = "w-4 h-4" }) => (
  <svg viewBox="0 0 24 24" aria-hidden="true" className={className}>
    <path
      fill="#4285F4"
      d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.3h6.44a5.5 5.5 0 0 1-2.39 3.61v3h3.87c2.26-2.08 3.57-5.15 3.57-8.64Z"
    />
    <path
      fill="#34A853"
      d="M12 24c3.24 0 5.95-1.07 7.93-2.91l-3.87-3c-1.07.72-2.45 1.15-4.06 1.15-3.12 0-5.77-2.11-6.72-4.95H1.28v3.1A12 12 0 0 0 12 24Z"
    />
    <path
      fill="#FBBC05"
      d="M5.28 14.29a7.21 7.21 0 0 1 0-4.58v-3.1H1.28a12 12 0 0 0 0 10.78l4-3.1Z"
    />
    <path
      fill="#EA4335"
      d="M12 4.75c1.76 0 3.34.61 4.59 1.8l3.44-3.44C17.95 1.19 15.24 0 12 0A12 12 0 0 0 1.28 6.61l4 3.1c.95-2.84 3.6-4.96 6.72-4.96Z"
    />
  </svg>
);

interface AdminPortalPageProps {
  user: User | null;
  authReady: boolean;
  authBusy: boolean;
  authError: string | null;
  accountAccess: AccountAccessState;
  isAdmin: boolean;
  onClearAuthError: () => void;
  onGoogleLogin: () => Promise<boolean>;
  onAdminEmailLogin: (email: string, password: string) => Promise<boolean>;
  onSetupAdminPassword: (
    email: string,
    password: string
  ) => Promise<{
    ok: boolean;
    verificationSent?: boolean;
    alreadyExists?: boolean;
    error?: string;
  }>;
  onSendAdminPasswordReset: (email: string) => Promise<{ ok: boolean; error?: string }>;
  onChangeAdminPassword: (
    currentPassword: string,
    newPassword: string
  ) => Promise<{ ok: boolean; error?: string }>;
  onSendVerificationEmail: () => Promise<{ ok: boolean; error?: string }>;
  onReloadVerification: () => Promise<{
    verified: boolean;
    authorized: boolean;
    error?: string;
  }>;
  onSignOut: () => Promise<void>;
  onGoToApp: () => void;
  onGoToLanding: () => void;
  onToast: (message: string, tone?: ToastItem["tone"]) => void;
}

type AdminAuthTab = "login" | "setup";

export const AdminPortalPage: React.FC<AdminPortalPageProps> = ({
  user,
  authReady,
  authBusy,
  authError,
  accountAccess,
  isAdmin,
  onClearAuthError,
  onGoogleLogin,
  onAdminEmailLogin,
  onSetupAdminPassword,
  onSendAdminPasswordReset,
  onChangeAdminPassword,
  onSendVerificationEmail,
  onReloadVerification,
  onSignOut,
  onGoToApp,
  onGoToLanding,
  onToast,
}) => {
  const [mode, setMode] = useState<AdminAuthTab>("login");
  const [email, setEmail] = useState(PRIMARY_ADMIN_EMAIL);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [restrictedEmailAttempt, setRestrictedEmailAttempt] = useState(false);
  const [accountAlreadyExists, setAccountAlreadyExists] = useState(false);
  const [resetSentTo, setResetSentTo] = useState<string | null>(null);
  const [sendingVerification, setSendingVerification] = useState(false);

  // Change-password modal state (for authenticated admin)
  const [passwordModalOpen, setPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showModalPasswords, setShowModalPasswords] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);

  const switchMode = (nextMode: AdminAuthTab) => {
    setMode(nextMode);
    setLocalError(null);
    setRestrictedEmailAttempt(false);
    setAccountAlreadyExists(false);
    setResetSentTo(null);
    onClearAuthError();
  };

  const handleOpenPasswordModal = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmNewPassword("");
    setModalError(null);
    setShowModalPasswords(false);
    setPasswordModalOpen(true);
  };

  const handleSubmitChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setModalError(null);

    if (currentPassword.length < 6) {
      setModalError("Informe sua senha atual (mínimo 6 caracteres).");
      return;
    }
    if (newPassword.length < 6) {
      setModalError("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setModalError("A confirmação da nova senha não coincide.");
      return;
    }
    if (newPassword === currentPassword) {
      setModalError("Escolha uma nova senha diferente da atual.");
      return;
    }

    const res = await onChangeAdminPassword(currentPassword, newPassword);
    if (res.ok) {
      setPasswordModalOpen(false);
      onToast("Senha administrativa atualizada com sucesso!", "success");
    } else if (res.error) {
      setModalError(res.error);
    }
  };

  const handleSendResetForLoggedAdmin = async () => {
    const adminEmail = normalizeEmail(accountAccess.email || user?.email);
    if (!adminEmail) return;
    const res = await onSendAdminPasswordReset(adminEmail);
    if (res.ok) {
      setPasswordModalOpen(false);
      onToast(
        `Link de redefinição enviado para ${adminEmail}. Confira sua caixa de entrada e spam.`,
        "success"
      );
    } else if (res.error) {
      setModalError(res.error);
    }
  };

  if (!authReady || (user && !accountAccess.loaded)) {
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0B0D] text-[#0F172A] dark:text-white flex flex-col items-center justify-center gap-3 px-4 transition-colors">
        <Loader2 className="w-7 h-7 text-[#FF6B00] animate-spin" />
        <p className="text-sm font-medium text-[#475569] dark:text-[#A1A1AA]">
          Verificando acesso administrativo...
        </p>
      </div>
    );
  }

  // Authenticated & verified admin -> Direct Release Panel
  if (user && isAdmin) {
    const activeAdminEmail = accountAccess.email || user.email || "";
    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0B0D] text-[#0F172A] dark:text-white flex flex-col transition-colors">
        <header className="sticky top-0 z-40 border-b border-[#E2E8F0] dark:border-[#26262B] bg-white/90 dark:bg-[#0B0B0D]/90 backdrop-blur-md">
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              <div className="w-8 h-8 rounded-lg bg-[#FF6B00] flex items-center justify-center shrink-0">
                <Dumbbell className="w-4 h-4 text-white" />
              </div>
              <span className="font-display text-base sm:text-lg font-extrabold tracking-tight text-[#0F172A] dark:text-white whitespace-nowrap">
                Personal Nutri <span className="text-[#FF6B00]">Fit</span>
              </span>
              <span aria-hidden="true" className="text-[#CBD5E1] dark:text-[#3F3F46] hidden sm:inline">
                ·
              </span>
              <span className="text-xs font-semibold text-[#475569] dark:text-[#A1A1AA] hidden sm:inline truncate">
                Painel de Liberação
              </span>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <ThemeToggleButton size="sm" />

              <button
                type="button"
                onClick={handleOpenPasswordModal}
                className="min-h-[40px] px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#151518] hover:bg-[#F1F5F9] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00]/50 text-xs sm:text-sm font-semibold text-[#0F172A] dark:text-[#E4E4E7] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <KeyRound className="w-3.5 h-3.5 text-[#FF6B00]" />
                <span className="hidden sm:inline">Alterar Senha</span>
                <span className="sm:hidden">Senha</span>
              </button>

              <button
                type="button"
                onClick={onGoToApp}
                className="min-h-[40px] px-3.5 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] text-xs sm:text-sm font-bold text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap"
              >
                <span>Ir para o App</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </button>

              <button
                type="button"
                disabled={authBusy}
                onClick={() => void onSignOut()}
                className="min-h-[40px] px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#151518] hover:bg-[#F1F5F9] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] text-xs sm:text-sm font-semibold text-[#0F172A] dark:text-[#E4E4E7] inline-flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
              >
                <LogOut className="w-3.5 h-3.5 text-[#FF6B00]" />
                <span>Sair</span>
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 max-w-6xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          <AdminTab
            currentUserUid={user.uid}
            currentUserEmail={activeAdminEmail}
            canListDirectory={accountAccess.canListDirectory}
            onToast={onToast}
          />
        </main>

        {/* Change Password Modal */}
        {passwordModalOpen && (
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="admin-change-password-title"
            className="fixed inset-0 z-50 bg-black/70 dark:bg-black/75 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div className="w-full max-w-md rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-2xl p-6 space-y-5">
              <div className="flex items-start justify-between gap-3">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wider text-[#FF6B00]">
                    Segurança Administrativa
                  </p>
                  <h2
                    id="admin-change-password-title"
                    className="font-display text-xl font-bold text-[#0F172A] dark:text-white"
                  >
                    Alterar Senha do Admin
                  </h2>
                  <p className="text-xs text-[#475569] dark:text-[#A1A1AA]">{activeAdminEmail}</p>
                </div>
                <button
                  type="button"
                  onClick={() => setPasswordModalOpen(false)}
                  aria-label="Fechar"
                  className="min-h-[36px] min-w-[36px] rounded-lg bg-[#F1F5F9] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <form onSubmit={handleSubmitChangePassword} className="space-y-3.5">
                <div>
                  <label
                    htmlFor="admin-current-pw"
                    className="block text-xs text-[#475569] dark:text-[#A1A1AA] mb-1"
                  >
                    Senha atual
                  </label>
                  <input
                    id="admin-current-pw"
                    type={showModalPasswords ? "text" : "password"}
                    required
                    minLength={6}
                    autoComplete="current-password"
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Digite sua senha atual"
                    className="w-full min-h-[44px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3.5 text-sm text-[#0F172A] dark:text-white placeholder:text-[#94A3B8] dark:placeholder:text-[#52525B]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="admin-new-pw"
                    className="block text-xs text-[#475569] dark:text-[#A1A1AA] mb-1"
                  >
                    Nova senha (mínimo 6 caracteres)
                  </label>
                  <input
                    id="admin-new-pw"
                    type={showModalPasswords ? "text" : "password"}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Digite a nova senha"
                    className="w-full min-h-[44px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3.5 text-sm text-[#0F172A] dark:text-white placeholder:text-[#94A3B8] dark:placeholder:text-[#52525B]"
                  />
                </div>

                <div>
                  <label
                    htmlFor="admin-confirm-new-pw"
                    className="block text-xs text-[#475569] dark:text-[#A1A1AA] mb-1"
                  >
                    Confirmar nova senha
                  </label>
                  <input
                    id="admin-confirm-new-pw"
                    type={showModalPasswords ? "text" : "password"}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={confirmNewPassword}
                    onChange={(e) => setConfirmNewPassword(e.target.value)}
                    placeholder="Repita a nova senha"
                    className="w-full min-h-[44px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none px-3.5 text-sm text-[#0F172A] dark:text-white placeholder:text-[#94A3B8] dark:placeholder:text-[#52525B]"
                  />
                </div>

                <label className="inline-flex items-center gap-2 text-xs text-[#475569] dark:text-[#A1A1AA] cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={showModalPasswords}
                    onChange={(e) => setShowModalPasswords(e.target.checked)}
                    className="accent-[#FF6B00] rounded"
                  />
                  <span>Mostrar senhas</span>
                </label>

                {modalError && (
                  <div
                    role="alert"
                    className="rounded-xl bg-red-500/10 border border-red-500/35 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-200 leading-relaxed"
                  >
                    {modalError}
                  </div>
                )}

                <div className="pt-1 space-y-2">
                  <button
                    type="submit"
                    disabled={authBusy}
                    className="w-full min-h-[44px] rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] text-sm font-bold text-white flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
                  >
                    {authBusy && <Loader2 className="w-4 h-4 animate-spin" />}
                    <span>Salvar Nova Senha</span>
                  </button>

                  <button
                    type="button"
                    disabled={authBusy}
                    onClick={() => void handleSendResetForLoggedAdmin()}
                    className="w-full min-h-[40px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] hover:bg-[#F1F5F9] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] text-xs font-semibold text-[#334155] dark:text-[#D4D4D8] hover:text-[#0F172A] dark:hover:text-white transition-colors cursor-pointer disabled:opacity-60"
                  >
                    Ou enviar link de redefinição por e-mail
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Logged in as a non-admin or unverified admin email
  const currentEmail = normalizeEmail(user?.email);
  const isUnverifiedAdminAccount = Boolean(
    user && isBootstrappedAdminEmail(currentEmail) && !user.emailVerified
  );
  const isRestrictedNonAdmin = Boolean(user && !isAdmin && !isUnverifiedAdminAccount);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLocalError(null);
    setRestrictedEmailAttempt(false);
    setAccountAlreadyExists(false);
    setResetSentTo(null);

    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
      setLocalError("Informe um endereço de e-mail válido.");
      return;
    }
    if (!isBootstrappedAdminEmail(cleanEmail)) {
      setRestrictedEmailAttempt(true);
      setLocalError(
        `Acesso restrito ao administrador. Utilize o e-mail ${PRIMARY_ADMIN_EMAIL}.`
      );
      onToast("Acesso restrito ao administrador.", "warning");
      return;
    }
    if (password.length < 6) {
      setLocalError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    if (mode === "setup") {
      if (password !== confirmPassword) {
        setLocalError("As senhas digitadas não coincidem.");
        return;
      }
      const res = await onSetupAdminPassword(cleanEmail, password);
      if (res.ok) {
        setPassword("");
        setConfirmPassword("");
        onToast(
          res.verificationSent
            ? `Senha administrativa configurada! Enviamos um link de confirmação para ${cleanEmail}.`
            : "Senha administrativa configurada! Confirme seu e-mail para liberar o painel.",
          "success"
        );
      } else if (res.alreadyExists) {
        setAccountAlreadyExists(true);
      }
      return;
    }

    await onAdminEmailLogin(cleanEmail, password);
  };

  const handleSendPasswordReset = async () => {
    setLocalError(null);
    setRestrictedEmailAttempt(false);
    setResetSentTo(null);

    const cleanEmail = normalizeEmail(email);
    if (!cleanEmail || !isBootstrappedAdminEmail(cleanEmail)) {
      setRestrictedEmailAttempt(true);
      setLocalError(
        `Informe o e-mail do administrador (${PRIMARY_ADMIN_EMAIL}) para redefinir a senha.`
      );
      return;
    }

    const res = await onSendAdminPasswordReset(cleanEmail);
    if (res.ok) {
      setResetSentTo(cleanEmail);
      setAccountAlreadyExists(false);
      onToast(
        `Link de redefinição enviado para ${cleanEmail}. Confira sua caixa de entrada e spam.`,
        "success"
      );
    }
  };

  const handleSendVerification = async () => {
    setSendingVerification(true);
    try {
      const res = await onSendVerificationEmail();
      if (res.ok) {
        onToast(
          `Link de verificação enviado para ${currentEmail}. Confira sua caixa de entrada e spam.`,
          "success"
        );
      } else if (res.error) {
        onToast(res.error, "warning");
      }
    } finally {
      setSendingVerification(false);
    }
  };

  const handleReloadVerification = async () => {
    const res = await onReloadVerification();
    if (res.error) {
      onToast(res.error, "warning");
    } else if (res.verified && res.authorized) {
      onToast("E-mail confirmado! Abrindo o Painel Administrativo.", "success");
    } else {
      onToast(
        "E-mail ainda não confirmado. Clique no link enviado para sua caixa de entrada e tente novamente.",
        "info"
      );
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0B0D] text-[#0F172A] dark:text-white flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden transition-colors">
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggleButton size="sm" />
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-28 left-1/2 -translate-x-1/2 w-[520px] h-[340px] rounded-full opacity-15 dark:opacity-20 blur-[120px]"
        style={{
          background: "radial-gradient(circle, #FF6B00 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 w-full max-w-md space-y-6">
        {/* Brand */}
        <div className="flex items-center justify-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-[#FF6B00] flex items-center justify-center shadow-md shadow-[#FF6B00]/20">
            <ShieldCheck className="w-5 h-5 text-white" />
          </div>
          <span className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-[#0F172A] dark:text-white">
            Personal Nutri <span className="text-[#FF6B00]">Admin</span>
          </span>
        </div>

        {/* Admin Login / Password Setup Card */}
        <section className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-xl shadow-slate-900/10 dark:shadow-none p-6 sm:p-7 space-y-5">
          <div className="space-y-1">
            <p className="text-xs font-semibold uppercase tracking-wider text-[#FF6B00]">
              Área Restrita · /admin
            </p>
            <h1 className="font-display text-xl sm:text-2xl font-bold text-[#0F172A] dark:text-white">
              {mode === "login" ? "Login Administrativo" : "Configurar Senha Admin"}
            </h1>
            <p className="text-xs text-[#475569] dark:text-[#A1A1AA] leading-relaxed">
              {mode === "login"
                ? "Entre com sua conta Google de administrador ou use e-mail e senha para visualizar alunos e liberar acessos."
                : "Primeiro acesso? Use Google acima ou defina abaixo a senha do administrador e confirme o link no e-mail."}
            </p>
          </div>

          {/* Always-visible Google Auth Button at Top of /admin Login Card */}
          <div className="space-y-4">
            <button
              type="button"
              disabled={authBusy}
              onClick={() => {
                setLocalError(null);
                onClearAuthError();
                void onGoogleLogin();
              }}
              className="w-full min-h-[48px] px-4 rounded-xl bg-white hover:bg-[#F8FAFC] dark:bg-white dark:hover:bg-[#F1F5F9] active:scale-[0.99] border border-[#CBD5E1] dark:border-white/20 hover:border-[#FF6B00] dark:hover:border-[#FF6B00] text-sm font-bold text-[#0F172A] flex items-center justify-center gap-3 shadow-sm transition-all cursor-pointer disabled:opacity-60"
            >
              {authBusy ? (
                <Loader2 className="w-5 h-5 text-[#FF6B00] animate-spin shrink-0" />
              ) : (
                <GoogleMark className="w-5 h-5 shrink-0" />
              )}
              <span>Continuar com Google</span>
            </button>

            <div className="relative flex items-center justify-center">
              <div className="w-full border-t border-[#E2E8F0] dark:border-[#26262B]" />
              <span className="px-3 text-[11px] font-medium text-[#64748B] dark:text-[#71717A] bg-white dark:bg-[#151518] whitespace-nowrap">
                ou entre com e-mail e senha
              </span>
              <div className="w-full border-t border-[#E2E8F0] dark:border-[#26262B]" />
            </div>
          </div>

          {/* 2-Tab Switcher: Entrar / Configurar Senha */}
          <div
            role="tablist"
            aria-label="Modo de acesso administrativo"
            className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[#F1F5F9] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B]"
          >
            <button
              type="button"
              role="tab"
              aria-selected={mode === "login"}
              onClick={() => switchMode("login")}
              className={`min-h-[40px] rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                mode === "login"
                  ? "bg-[#FF6B00] text-white shadow-sm"
                  : "text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white"
              }`}
            >
              Entrar
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={mode === "setup"}
              onClick={() => switchMode("setup")}
              className={`min-h-[40px] rounded-lg text-xs font-bold transition-colors cursor-pointer ${
                mode === "setup"
                  ? "bg-[#FF6B00] text-white shadow-sm"
                  : "text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white"
              }`}
            >
              Configurar Senha
            </button>
          </div>

          {isRestrictedNonAdmin && (
            <div
              role="alert"
              className="rounded-xl bg-red-500/10 border border-red-500/35 p-4 space-y-3"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <p className="font-bold text-red-800 dark:text-red-200">
                    Acesso restrito ao administrador
                  </p>
                  <p className="text-red-700/90 dark:text-red-200/80 leading-relaxed">
                    A conta <strong className="text-[#0F172A] dark:text-white">{currentEmail}</strong> não
                    possui permissão administrativa. Saia desta conta para entrar como
                    administrador.
                  </p>
                </div>
              </div>
              <button
                type="button"
                disabled={authBusy}
                onClick={() => void onSignOut()}
                className="w-full min-h-[42px] px-3 rounded-xl bg-white dark:bg-[#0B0B0D] hover:bg-[#F1F5F9] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] text-xs font-semibold text-[#0F172A] dark:text-white inline-flex items-center justify-center gap-2 transition-colors cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5 text-[#FF6B00]" />
                <span>Sair desta conta</span>
              </button>
            </div>
          )}

          {isUnverifiedAdminAccount && (
            <div
              role="alert"
              className="rounded-xl bg-amber-500/10 border border-amber-500/35 p-4 space-y-3"
            >
              <div className="flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                <div className="space-y-1 text-xs">
                  <p className="font-bold text-amber-900 dark:text-amber-100">
                    Confirme o e-mail do administrador
                  </p>
                  <p className="text-amber-800/90 dark:text-amber-100/85 leading-relaxed">
                    Sua senha já foi configurada! Por segurança, confirme o link enviado
                    para <strong className="text-[#0F172A] dark:text-white">{currentEmail}</strong> (verifique
                    também a pasta Spam) e clique em <strong>Já confirmei</strong>.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={sendingVerification || authBusy}
                  onClick={() => void handleSendVerification()}
                  className="min-h-[42px] px-3 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] text-xs font-bold text-white inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
                >
                  {sendingVerification ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                  <span>Reenviar link</span>
                </button>
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={() => void handleReloadVerification()}
                  className="min-h-[42px] px-3 rounded-xl bg-white dark:bg-[#0B0B0D] hover:bg-[#F1F5F9] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] text-xs font-semibold text-[#0F172A] dark:text-white inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
                >
                  <RefreshCw className="w-3.5 h-3.5 text-[#FF6B00]" />
                  <span>Já confirmei</span>
                </button>
              </div>
              <button
                type="button"
                disabled={authBusy}
                onClick={() => void onSignOut()}
                className="w-full min-h-[38px] px-3 rounded-xl bg-white dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] text-xs font-semibold text-[#334155] dark:text-[#D4D4D8] hover:text-[#0F172A] dark:hover:text-white cursor-pointer"
              >
                Trocar conta
              </button>
            </div>
          )}

          {resetSentTo && (
            <div
              role="status"
              className="rounded-xl bg-emerald-500/10 border border-emerald-500/35 px-3.5 py-3 text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2.5 leading-relaxed"
            >
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
              <span>
                Link de redefinição enviado para{" "}
                <strong className="text-[#0F172A] dark:text-white">{resetSentTo}</strong>. Abra o e-mail
                (confira também o Spam), defina sua nova senha e volte aqui para entrar.
              </span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label htmlFor="admin-email" className="block text-xs text-[#475569] dark:text-[#A1A1AA] mb-1">
                E-mail do Administrador
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-[#64748B] dark:text-[#71717A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="admin-email"
                  type="email"
                  required
                  autoComplete="email"
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (localError) setLocalError(null);
                    if (restrictedEmailAttempt) setRestrictedEmailAttempt(false);
                  }}
                  placeholder={PRIMARY_ADMIN_EMAIL}
                  className="w-full min-h-[46px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none pl-10 pr-3.5 text-sm text-[#0F172A] dark:text-white placeholder:text-[#94A3B8] dark:placeholder:text-[#52525B]"
                />
              </div>
            </div>

            <div>
              <label
                htmlFor="admin-password"
                className="block text-xs text-[#475569] dark:text-[#A1A1AA] mb-1"
              >
                {mode === "setup" ? "Nova Senha (mínimo 6 caracteres)" : "Senha"}
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#64748B] dark:text-[#71717A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input
                  id="admin-password"
                  type={showPassword ? "text" : "password"}
                  required
                  minLength={6}
                  autoComplete={mode === "setup" ? "new-password" : "current-password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder={
                    mode === "setup"
                      ? "Crie a senha do painel admin"
                      : "Sua senha administrativa"
                  }
                  className="w-full min-h-[46px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none pl-10 pr-11 text-sm text-[#0F172A] dark:text-white placeholder:text-[#94A3B8] dark:placeholder:text-[#52525B]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((prev) => !prev)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 min-h-[34px] min-w-[34px] rounded-lg text-[#64748B] dark:text-[#71717A] hover:text-[#0F172A] dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                >
                  {showPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {mode === "setup" && (
              <div>
                <label
                  htmlFor="admin-confirm-password"
                  className="block text-xs text-[#475569] dark:text-[#A1A1AA] mb-1"
                >
                  Confirmar Nova Senha
                </label>
                <div className="relative">
                  <KeyRound className="w-4 h-4 text-[#64748B] dark:text-[#71717A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    id="admin-confirm-password"
                    type={showConfirmPassword ? "text" : "password"}
                    required
                    minLength={6}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Repita a senha administrativa"
                    className="w-full min-h-[46px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none pl-10 pr-11 text-sm text-[#0F172A] dark:text-white placeholder:text-[#94A3B8] dark:placeholder:text-[#52525B]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword((prev) => !prev)}
                    aria-label={
                      showConfirmPassword ? "Ocultar confirmação" : "Mostrar confirmação"
                    }
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 min-h-[34px] min-w-[34px] rounded-lg text-[#64748B] dark:text-[#71717A] hover:text-[#0F172A] dark:hover:text-white flex items-center justify-center transition-colors cursor-pointer"
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            )}

            {(localError || authError) && (
              <div
                role="alert"
                className="rounded-xl bg-red-500/10 border border-red-500/35 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-200 leading-relaxed space-y-2.5"
              >
                <p>{localError || authError}</p>

                {restrictedEmailAttempt && (
                  <button
                    type="button"
                    onClick={() => {
                      setEmail(PRIMARY_ADMIN_EMAIL);
                      setLocalError(null);
                      setRestrictedEmailAttempt(false);
                    }}
                    className="min-h-[34px] px-2.5 rounded-lg bg-white dark:bg-[#0B0B0D] hover:bg-[#F1F5F9] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] text-[11px] font-semibold text-[#0F172A] dark:text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Mail className="w-3.5 h-3.5 text-[#FF6B00]" />
                    <span>Usar {PRIMARY_ADMIN_EMAIL}</span>
                  </button>
                )}

                {accountAlreadyExists && (
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      disabled={authBusy}
                      onClick={() => void handleSendPasswordReset()}
                      className="min-h-[36px] px-3 rounded-lg bg-[#FF6B00] hover:bg-[#E55F00] text-[11px] font-bold text-white inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-60"
                    >
                      <KeyRound className="w-3.5 h-3.5" />
                      <span>Enviar link para redefinir senha</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => switchMode("login")}
                      className="min-h-[36px] px-3 rounded-lg bg-white dark:bg-[#0B0B0D] hover:bg-[#F1F5F9] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] text-[11px] font-semibold text-[#0F172A] dark:text-white cursor-pointer"
                    >
                      Ir para Entrar
                    </button>
                  </div>
                )}
              </div>
            )}

            <button
              type="submit"
              disabled={authBusy}
              className="w-full min-h-[46px] rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] text-sm font-bold text-white flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
            >
              {authBusy && <Loader2 className="w-4 h-4 animate-spin" />}
              <span>
                {mode === "setup" ? "Salvar Senha do Admin" : "Entrar no Painel Admin"}
              </span>
            </button>

            {mode === "login" && (
              <div className="pt-1 flex items-center justify-between gap-2 text-xs">
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={() => void handleSendPasswordReset()}
                  className="text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white underline underline-offset-4 transition-colors cursor-pointer disabled:opacity-50"
                >
                  Redefinir senha por e-mail
                </button>
                <button
                  type="button"
                  onClick={() => switchMode("setup")}
                  className="text-[#FF6B00] hover:text-[#EA580C] dark:hover:text-orange-400 font-semibold transition-colors cursor-pointer"
                >
                  Primeiro acesso?
                </button>
              </div>
            )}
          </form>
        </section>

        <div className="text-center">
          <button
            type="button"
            onClick={onGoToLanding}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Voltar para a página inicial</span>
          </button>
        </div>
      </div>
    </div>
  );
};
