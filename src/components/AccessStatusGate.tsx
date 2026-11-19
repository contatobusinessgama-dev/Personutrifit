import React, { useState } from "react";
import {
  Clock,
  Dumbbell,
  Loader2,
  LogOut,
  RefreshCw,
  ShieldBan,
} from "lucide-react";
import {
  formatStudentHandle,
  isSyntheticUsernameEmail,
} from "../lib/firestoreSync";
import { AccountAccessState, ToastItem, UserAccessStatus } from "../types";
import { ThemeToggleButton } from "./ThemeToggleButton";

interface AccessStatusGateProps {
  accountAccess: AccountAccessState;
  displayName?: string | null;
  authBusy: boolean;
  onRefreshStatus: () => Promise<{
    status: UserAccessStatus;
    authorized: boolean;
    error?: string;
  }>;
  onSignOut: () => Promise<void>;
  onToast: (message: string, tone?: ToastItem["tone"]) => void;
}

export const AccessStatusGate: React.FC<AccessStatusGateProps> = ({
  accountAccess,
  displayName,
  authBusy,
  onRefreshStatus,
  onSignOut,
  onToast,
}) => {
  const [checking, setChecking] = useState(false);

  const isBlocked = accountAccess.status === "bloqueado";
  const resolvedName =
    accountAccess.fullName?.trim() || displayName?.trim() || "Aluno Personal Nutri Fit";
  const studentHandle = formatStudentHandle(
    accountAccess.username,
    accountAccess.email
  );
  const showRealEmail =
    Boolean(accountAccess.email) && !isSyntheticUsernameEmail(accountAccess.email);

  const handleCheck = async () => {
    setChecking(true);
    try {
      const res = await onRefreshStatus();
      if (res.error) {
        onToast(res.error, "warning");
      } else if (res.authorized) {
        onToast("Acesso liberado! Carregando seu painel Personal Nutri Fit.", "success");
      } else if (res.status === "bloqueado") {
        onToast("Acesso bloqueado pelo administrador.", "warning");
      } else {
        onToast("Seu cadastro ainda está em análise pelo administrador.", "info");
      }
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0B0D] text-[#0F172A] dark:text-white flex flex-col items-center justify-center px-4 py-10 relative overflow-hidden transition-colors">
      <div className="absolute top-4 right-4 z-20">
        <ThemeToggleButton size="sm" />
      </div>

      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-[-140px] left-1/2 -translate-x-1/2 w-[520px] h-[360px] rounded-full opacity-15 dark:opacity-20 blur-[120px]"
        style={{
          background: isBlocked
            ? "radial-gradient(circle, #EF4444 0%, transparent 70%)"
            : "radial-gradient(circle, #FF6B00 0%, transparent 70%)",
        }}
      />

      <div className="relative z-10 w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="flex items-center justify-center gap-2.5">
          <div className="w-10 h-10 rounded-xl bg-[#FF6B00] flex items-center justify-center shadow-md shadow-[#FF6B00]/20">
            <Dumbbell className="w-5 h-5 text-white" />
          </div>
          <span className="font-display text-xl sm:text-2xl font-extrabold tracking-tight text-[#0F172A] dark:text-white">
            Personal Nutri <span className="text-[#FF6B00]">Fit</span>
          </span>
        </div>

        {/* Status Card */}
        <section className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none p-6 sm:p-7 space-y-5">
          <div className="flex items-start gap-4">
            <div
              className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border ${
                isBlocked
                  ? "bg-red-500/10 border-red-500/30 text-red-600 dark:text-red-400"
                  : "bg-[#FF6B00]/10 border-[#FF6B00]/30 text-[#FF6B00]"
              }`}
            >
              {isBlocked ? (
                <ShieldBan className="w-6 h-6" />
              ) : (
                <Clock className="w-6 h-6" />
              )}
            </div>

            <div className="min-w-0 space-y-1">
              <p
                className={`text-xs font-semibold uppercase tracking-wider ${
                  isBlocked ? "text-red-600 dark:text-red-400" : "text-[#FF6B00]"
                }`}
              >
                {isBlocked ? "Status · Bloqueado" : "Status · Pendente"}
              </p>
              <h1 className="font-display text-xl sm:text-2xl font-bold text-[#0F172A] dark:text-white leading-tight">
                {isBlocked
                  ? "Acesso bloqueado pelo administrador"
                  : "Cadastro em Análise"}
              </h1>
            </div>
          </div>

          <p className="text-sm text-[#475569] dark:text-[#A1A1AA] leading-relaxed">
            {isBlocked ? (
              <>
                O acesso desta conta ao <strong className="text-[#0F172A] dark:text-white">Personal Nutri Fit</strong>{" "}
                está bloqueado pelo administrador. Caso acredite que houve um engano,
                entre em contato com a equipe responsável.
              </>
            ) : (
              <>
                Recebemos seu cadastro! Seu acesso será liberado pelo administrador para
                você utilizar os treinos, o Personal IA e a Nutricionista IA.
              </>
            )}
          </p>

          {/* Student Identity */}
          <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] px-4 py-3.5 space-y-1">
            <p className="text-sm font-bold text-[#0F172A] dark:text-white truncate">{resolvedName}</p>
            {studentHandle && (
              <p className="text-xs font-mono text-[#FF6B00] truncate">
                {studentHandle}
              </p>
            )}
            {showRealEmail && (
              <p className="text-xs text-[#334155] dark:text-[#D4D4D8] truncate">{accountAccess.email}</p>
            )}
            <div className="flex items-center gap-2 text-xs text-[#475569] dark:text-[#A1A1AA] pt-1">
              <span>Perfil: Aluno</span>
              <span aria-hidden="true">·</span>
              <span
                className={
                  isBlocked ? "text-red-600 dark:text-red-400 font-medium" : "text-amber-700 dark:text-amber-400 font-medium"
                }
              >
                {isBlocked ? "Bloqueado" : "Aguardando liberação"}
              </span>
            </div>
          </div>

          {accountAccess.error && (
            <div className="rounded-xl bg-red-500/10 border border-red-500/25 px-4 py-3 text-xs text-red-700 dark:text-red-200 leading-relaxed">
              {accountAccess.error}
            </div>
          )}

          {/* Actions */}
          <div className="space-y-2.5 pt-1">
            {!isBlocked && (
              <button
                type="button"
                disabled={checking || authBusy}
                onClick={() => void handleCheck()}
                className="w-full min-h-[46px] px-4 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
              >
                {checking ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Atualizando status...</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="w-4 h-4" />
                    <span>Atualizar Status</span>
                  </>
                )}
              </button>
            )}

            <button
              type="button"
              disabled={authBusy}
              onClick={() => void onSignOut()}
              className="w-full min-h-[46px] px-4 rounded-xl bg-[#F1F5F9] dark:bg-[#1C1C21] hover:bg-[#E2E8F0] dark:hover:bg-[#26262B] border border-[#E2E8F0] dark:border-[#26262B] text-[#0F172A] dark:text-[#E4E4E7] text-sm font-semibold flex items-center justify-center gap-2 transition-colors cursor-pointer disabled:opacity-60"
            >
              <LogOut className="w-4 h-4 text-[#475569] dark:text-[#A1A1AA]" />
              <span>Sair</span>
            </button>
          </div>
        </section>

        {!isBlocked && (
          <p className="text-center text-xs text-[#64748B] dark:text-[#71717A]">
            Assim que o administrador liberar seu acesso, toque em{" "}
            <span className="text-[#0F172A] dark:text-[#D4D4D8] font-medium">Atualizar Status</span> para entrar no app.
          </p>
        )}
      </div>
    </div>
  );
};
