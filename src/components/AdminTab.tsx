import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  Ban,
  CheckCircle2,
  Clock,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  ShieldCheck,
  UserCheck,
  Users,
} from "lucide-react";
import {
  formatStudentHandle,
  isBootstrappedAdminEmail,
  isSyntheticUsernameEmail,
  listAllCloudUsers,
  subscribeAllCloudUsers,
  updateCloudUserAccess,
} from "../lib/firestoreSync";
import {
  AdminUserRecord,
  ToastItem,
  UserAccessStatus,
  UserRole,
} from "../types";
import { StudentAvatar } from "./StudentAvatar";

interface AdminTabProps {
  currentUserUid: string;
  currentUserEmail: string;
  canListDirectory: boolean;
  onToast: (message: string, tone?: ToastItem["tone"]) => void;
}

type StatusFilter = "todos" | UserAccessStatus;

const STATUS_META: Record<
  UserAccessStatus,
  { label: string; textClass: string; dotClass: string }
> = {
  pendente: {
    label: "Pendente",
    textClass: "text-amber-700 dark:text-amber-400",
    dotClass: "bg-amber-500 dark:bg-amber-400",
  },
  autorizado: {
    label: "Autorizado",
    textClass: "text-emerald-700 dark:text-emerald-400",
    dotClass: "bg-emerald-500 dark:bg-emerald-400",
  },
  bloqueado: {
    label: "Bloqueado",
    textClass: "text-red-700 dark:text-red-400",
    dotClass: "bg-red-500 dark:bg-red-400",
  },
};

function formatDateBr(iso: string | null): string {
  if (!iso) return "Data não registrada";
  try {
    return new Intl.DateTimeFormat("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    }).format(new Date(iso));
  } catch {
    return "Data não registrada";
  }
}

export const AdminTab: React.FC<AdminTabProps> = ({
  currentUserUid,
  currentUserEmail,
  canListDirectory,
  onToast,
}) => {
  const [users, setUsers] = useState<AdminUserRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("todos");
  const [busyUid, setBusyUid] = useState<string | null>(null);

  const loadDirectory = useCallback(
    async (isManualRefresh = false) => {
      if (!canListDirectory) {
        setLoading(false);
        setError(
          "A listagem completa de alunos está restrita à conta administradora principal (contato.servicosgama@gmail.com)."
        );
        return;
      }

      if (isManualRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }
      setError(null);

      try {
        const list = await listAllCloudUsers();
        setUsers(list);
      } catch (err) {
        console.error("[Bianco Fit Admin] Falha ao listar alunos:", err);
        setError(
          "Não foi possível carregar a lista de alunos. Verifique sua conexão e permissões de administrador."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [canListDirectory]
  );

  useEffect(() => {
    if (!canListDirectory) {
      setLoading(false);
      setError(
        "A listagem completa de alunos está restrita à conta administradora principal (contato.servicosgama@gmail.com)."
      );
      return;
    }

    setLoading(true);
    setError(null);

    const unsub = subscribeAllCloudUsers(
      (list) => {
        setUsers(list);
        setLoading(false);
        setRefreshing(false);
        setError(null);
      },
      (err) => {
        console.error("[Bianco Fit Admin] Falha no listener em tempo real:", err);
        setLoading(false);
        setRefreshing(false);
        setError(
          "Não foi possível carregar a lista de alunos em tempo real. Verifique sua conexão e permissões de administrador."
        );
      }
    );

    return () => unsub();
  }, [canListDirectory]);

  const counts = useMemo(() => {
    let pendente = 0;
    let autorizado = 0;
    let bloqueado = 0;
    for (const u of users) {
      if (u.status === "pendente") pendente += 1;
      else if (u.status === "autorizado") autorizado += 1;
      else if (u.status === "bloqueado") bloqueado += 1;
    }
    return {
      total: users.length,
      pendente,
      autorizado,
      bloqueado,
    };
  }, [users]);

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase().replace(/^@/, "");
    return users.filter((u) => {
      if (statusFilter !== "todos" && u.status !== statusFilter) {
        return false;
      }
      if (!q) return true;
      return (
        u.fullName.toLowerCase().includes(q) ||
        u.username.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        u.mainGoal.toLowerCase().includes(q)
      );
    });
  }, [users, searchQuery, statusFilter]);

  const handleUpdateAccess = async (
    target: AdminUserRecord,
    nextRole: UserRole,
    nextStatus: UserAccessStatus
  ) => {
    if (target.uid === currentUserUid) {
      onToast("Você não pode alterar o status ou função da sua própria conta.", "warning");
      return;
    }
    if (isBootstrappedAdminEmail(target.email)) {
      onToast("A conta administradora principal não pode ser bloqueada ou rebaixada.", "warning");
      return;
    }

    setBusyUid(target.uid);
    try {
      await updateCloudUserAccess(target.uid, nextRole, nextStatus);
      setUsers((prev) =>
        prev.map((item) =>
          item.uid === target.uid
            ? {
                ...item,
                role: nextRole,
                status: nextStatus,
                updatedAt: new Date().toISOString(),
              }
            : item
        )
      );

      const actionLabel =
        nextStatus === "autorizado"
          ? "autorizado"
          : nextStatus === "bloqueado"
          ? "bloqueado"
          : "movido para pendente";

      onToast(
        `${target.fullName} foi ${actionLabel}${
          nextRole !== target.role
            ? ` (${nextRole === "admin" ? "Admin" : "Aluno"})`
            : ""
        }.`,
        nextStatus === "bloqueado" ? "info" : "success"
      );
    } catch (err) {
      console.error("[Bianco Fit Admin] Falha ao atualizar acesso do aluno:", err);
      onToast("Não foi possível atualizar o status deste aluno. Tente novamente.", "warning");
    } finally {
      setBusyUid(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-xs font-semibold text-[#FF6B00] uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" />
            <span>Controle de Acesso</span>
            <span aria-hidden="true" className="text-[#94A3B8] dark:text-[#52525B]">
              ·
            </span>
            <span className="normal-case font-medium text-[#475569] dark:text-[#A1A1AA] truncate">
              {currentUserEmail}
            </span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0F172A] dark:text-white">
            Painel Administrativo
          </h1>
          <p className="text-sm text-[#475569] dark:text-[#A1A1AA] max-w-2xl">
            Aprove novos cadastros, gerencie alunos ativos e controle quem tem acesso
            ao aplicativo Personal Nutri Fit.
          </p>
        </div>

        <button
          type="button"
          disabled={loading || refreshing}
          onClick={() => void loadDirectory(true)}
          className="min-h-[44px] px-4 rounded-xl bg-white dark:bg-[#151518] hover:bg-[#F1F5F9] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00]/60 shadow-sm dark:shadow-none text-sm font-semibold text-[#0F172A] dark:text-white inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 text-[#FF6B00] ${refreshing ? "animate-spin" : ""}`} />
          <span>Atualizar lista</span>
        </button>
      </header>

      {/* KPI Strip */}
      <section aria-label="Resumo de contas" className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#475569] dark:text-[#A1A1AA]">
            <span>Total de contas</span>
            <Users className="w-4 h-4 text-[#64748B] dark:text-[#71717A]" />
          </div>
          <p className="font-display text-2xl sm:text-3xl font-extrabold text-[#0F172A] dark:text-white tabular-nums">
            {counts.total}
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#475569] dark:text-[#A1A1AA]">
            <span>Pendentes</span>
            <Clock className="w-4 h-4 text-amber-600 dark:text-amber-400" />
          </div>
          <p className="font-display text-2xl sm:text-3xl font-extrabold text-amber-600 dark:text-amber-400 tabular-nums">
            {counts.pendente}
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#475569] dark:text-[#A1A1AA]">
            <span>Autorizados</span>
            <UserCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
          </div>
          <p className="font-display text-2xl sm:text-3xl font-extrabold text-emerald-600 dark:text-emerald-400 tabular-nums">
            {counts.autorizado}
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none p-4 space-y-1.5">
          <div className="flex items-center justify-between text-xs text-[#475569] dark:text-[#A1A1AA]">
            <span>Bloqueados</span>
            <Ban className="w-4 h-4 text-red-600 dark:text-red-400" />
          </div>
          <p className="font-display text-2xl sm:text-3xl font-extrabold text-red-600 dark:text-red-400 tabular-nums">
            {counts.bloqueado}
          </p>
        </div>
      </section>

      {/* Search & Filter Controls */}
      <section className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none p-4 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[#64748B] dark:text-[#71717A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar aluno por nome, @usuário ou objetivo..."
              aria-label="Buscar aluno por nome ou usuário"
              className="w-full min-h-[44px] pl-10 pr-4 rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none text-sm text-[#0F172A] dark:text-white placeholder:text-[#94A3B8] dark:placeholder:text-[#71717A] transition-colors"
            />
          </div>

          <div
            role="tablist"
            aria-label="Filtrar por status"
            className="grid grid-cols-4 sm:inline-flex items-center gap-1 p-1 rounded-xl bg-[#F1F5F9] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B]"
          >
            {(
              [
                { id: "todos", label: "Todos", count: counts.total },
                { id: "pendente", label: "Pendentes", count: counts.pendente },
                { id: "autorizado", label: "Autorizados", count: counts.autorizado },
                { id: "bloqueado", label: "Bloqueados", count: counts.bloqueado },
              ] as const
            ).map((tab) => {
              const active = statusFilter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setStatusFilter(tab.id)}
                  className={`min-h-[38px] px-2.5 sm:px-3 rounded-lg text-xs font-semibold transition-colors cursor-pointer whitespace-nowrap flex items-center justify-center gap-1.5 ${
                    active
                      ? "bg-[#FF6B00] text-white"
                      : "text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white"
                  }`}
                >
                  <span>{tab.label}</span>
                  <span
                    className={`font-mono text-[11px] tabular-nums ${
                      active ? "text-white/90" : "text-[#64748B] dark:text-[#71717A]"
                    }`}
                  >
                    {tab.count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Directory List */}
        {loading ? (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-sm text-[#475569] dark:text-[#A1A1AA]">
            <Loader2 className="w-6 h-6 text-[#FF6B00] animate-spin" />
            <span>Carregando alunos cadastrados...</span>
          </div>
        ) : error ? (
          <div className="rounded-xl bg-red-500/10 border border-red-500/25 p-5 text-center space-y-3">
            <p className="text-sm text-red-700 dark:text-red-200">{error}</p>
            {canListDirectory && (
              <button
                type="button"
                onClick={() => void loadDirectory(true)}
                className="min-h-[42px] px-4 rounded-xl bg-[#F1F5F9] dark:bg-[#1C1C21] hover:bg-[#E2E8F0] dark:hover:bg-[#26262B] text-xs font-semibold text-[#0F172A] dark:text-white cursor-pointer"
              >
                Tentar novamente
              </button>
            )}
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-12 text-center space-y-1.5">
            <p className="text-sm font-semibold text-[#0F172A] dark:text-white">
              Nenhuma conta encontrada
            </p>
            <p className="text-xs text-[#475569] dark:text-[#A1A1AA]">
              {searchQuery
                ? "Tente limpar o termo de busca ou trocar o filtro de status."
                : "Quando novos alunos se cadastrarem, eles aparecerão aqui para aprovação."}
            </p>
          </div>
        ) : (
          <div className="divide-y divide-[#E2E8F0] dark:divide-[#26262B]">
            {filteredUsers.map((student) => {
              const isSelf = student.uid === currentUserUid;
              const isProtectedAdmin = isBootstrappedAdminEmail(student.email);
              const isRowBusy = busyUid === student.uid;
              const statusMeta = STATUS_META[student.status];

              return (
                <article
                  key={student.uid}
                  className="py-4 first:pt-2 last:pb-1 flex flex-col lg:flex-row lg:items-center justify-between gap-4"
                >
                  {/* Left: Student Identity & Metadata */}
                  <div className="flex items-start gap-3.5 min-w-0">
                    <StudentAvatar
                      avatar={student.avatar}
                      name={student.fullName}
                      size="md"
                    />
                    <div className="min-w-0 space-y-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                        <h2 className="text-sm sm:text-base font-bold text-[#0F172A] dark:text-white truncate">
                          {student.fullName}
                        </h2>
                        {isSelf && (
                          <span className="text-xs font-medium text-[#FF6B00]">
                            (Você)
                          </span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs">
                        {formatStudentHandle(student.username, student.email) && (
                          <span className="font-mono font-semibold text-[#FF6B00]">
                            {formatStudentHandle(student.username, student.email)}
                          </span>
                        )}
                        {student.email && !isSyntheticUsernameEmail(student.email) && (
                          <>
                            <span aria-hidden="true" className="text-[#94A3B8] dark:text-[#52525B]">
                              ·
                            </span>
                            <span className="text-[#334155] dark:text-[#D4D4D8] truncate">{student.email}</span>
                          </>
                        )}
                      </div>

                      {/* Clean unboxed metadata row */}
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#475569] dark:text-[#A1A1AA]">
                        <span className={`font-semibold ${statusMeta.textClass}`}>
                          {statusMeta.label}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span className="text-[#334155] dark:text-[#D4D4D8]">
                          {student.role === "admin" ? "Administrador" : "Aluno"}
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>{student.fitnessLevel}</span>
                        <span aria-hidden="true">·</span>
                        <span className="tabular-nums">
                          Streak: {student.currentStreak}d
                        </span>
                        <span aria-hidden="true">·</span>
                        <span>Cadastro: {formatDateBr(student.createdAt)}</span>
                      </div>
                    </div>
                  </div>

                  {/* Right: Moderation Controls */}
                  <div className="flex flex-wrap items-center gap-2 shrink-0 lg:justify-end">
                    {isSelf || isProtectedAdmin ? (
                      <div className="inline-flex items-center gap-1.5 text-xs font-medium text-[#475569] dark:text-[#A1A1AA] px-2 py-2">
                        <Shield className="w-3.5 h-3.5 text-[#FF6B00]" />
                        <span>Administrador principal</span>
                      </div>
                    ) : (
                      <>
                        {student.status !== "autorizado" && (
                          <button
                            type="button"
                            disabled={isRowBusy}
                            onClick={() =>
                              void handleUpdateAccess(student, student.role, "autorizado")
                            }
                            className="min-h-[42px] px-3.5 rounded-xl bg-[#FF6B00] hover:bg-[#E55F00] text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            {isRowBusy ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <CheckCircle2 className="w-3.5 h-3.5" />
                            )}
                            <span>Autorizar</span>
                          </button>
                        )}

                        {student.status !== "pendente" && (
                          <button
                            type="button"
                            disabled={isRowBusy}
                            onClick={() =>
                              void handleUpdateAccess(student, "user", "pendente")
                            }
                            className="min-h-[42px] px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] hover:bg-[#F1F5F9] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] text-[#334155] dark:text-[#D4D4D8] hover:text-[#0F172A] dark:hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Clock className="w-3.5 h-3.5 text-amber-600 dark:text-amber-400" />
                            <span>Pendente</span>
                          </button>
                        )}

                        {student.status !== "bloqueado" && (
                          <button
                            type="button"
                            disabled={isRowBusy}
                            onClick={() =>
                              void handleUpdateAccess(student, "user", "bloqueado")
                            }
                            className="min-h-[42px] px-3 rounded-xl bg-red-500/10 hover:bg-red-500/20 border border-red-500/30 text-red-700 dark:text-red-300 text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <Ban className="w-3.5 h-3.5" />
                            <span>Bloquear</span>
                          </button>
                        )}

                        {student.status === "autorizado" && (
                          <button
                            type="button"
                            disabled={isRowBusy}
                            onClick={() =>
                              void handleUpdateAccess(
                                student,
                                student.role === "admin" ? "user" : "admin",
                                "autorizado"
                              )
                            }
                            className="min-h-[42px] px-3 rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] hover:bg-[#F1F5F9] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-50"
                          >
                            <ShieldCheck className="w-3.5 h-3.5 text-[#FF6B00]" />
                            <span>
                              {student.role === "admin" ? "Remover Admin" : "Tornar Admin"}
                            </span>
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
};
