import React, { useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  Check,
  CheckCircle2,
  Dumbbell,
  Eye,
  EyeOff,
  Flame,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  Sparkles,
  Target,
  Timer,
  TrendingUp,
  User,
  Utensils,
  X,
} from "lucide-react";
import { normalizeUsername } from "../lib/firestoreSync";
import { ThemeToggleButton } from "./ErrorBoundary";

const HERO_GYM_IMG = "/src/assets/images/bianco_gym_hero_1795053835269.jpg";
const CARDIO_ZONE_IMG = "/src/assets/images/bianco_cardio_zone_1795053836665.jpg";

interface LandingPageProps {
  authBusy: boolean;
  authError: string | null;
  onClearAuthError: () => void;
  onGoogleAuth: () => Promise<boolean>;
  onCredentialsAuth: (
    identifier: string,
    password: string,
    mode: "login" | "register",
    fullName?: string
  ) => Promise<boolean>;
  onSendPasswordReset: (
    email: string
  ) => Promise<{ ok: boolean; email?: string; error?: string }>;
  onNavigateAdmin: () => void;
}

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

const FEATURES = [
  {
    span: "lg:col-span-7",
    icon: Dumbbell,
    title: "Catálogo Real de Academia",
    description:
      "Exercícios organizados por grupamento muscular, máquinas articuladas, polias, peso livre e cardio — com guia técnico de ajuste do banco e botão 'Máquina ocupada? Trocar' na hora.",
    detail: "Costas · Peito · Pernas · Glúteos · Ombros · Braços · Cardio",
  },
  {
    span: "lg:col-span-5",
    icon: Sparkles,
    title: "Personal Trainer IA 24h",
    description:
      "Monta e adapta sua ficha conforme o tempo disponível, nível na academia e objetivo (secar, definir costas, hipertrofia ou restrições articulares).",
    detail: "Salve a ficha direto na aba Treinos",
  },
  {
    span: "lg:col-span-5",
    icon: Utensils,
    title: "Nutricionista IA Estratégica",
    description:
      "Calcula TMB (Mifflin-St Jeor), déficit calórico natural e proteínas (2.0g/kg), montando cardápios com comida brasileira de verdade e lista de compras semanal.",
    detail: "100% alimentação saudável e natural",
  },
  {
    span: "lg:col-span-7",
    icon: Timer,
    title: "Cronômetro e Progressão de Cargas",
    description:
      "Salva automaticamente a última carga usada em cada aparelho para você progredir semana após semana e dispara o cronômetro de descanso assim que marca a série concluída.",
    detail: "Histórico por aparelho · Descanso 45s / 60s / 90s",
  },
  {
    span: "lg:col-span-6",
    icon: TrendingUp,
    title: "Avaliação Física e Evolução",
    description:
      "Acompanhe sua curva de peso em direção à meta, IMC classificado, 10 medidas corporais com comparativo em centímetros e sequência de dias treinados (Streak).",
    detail: "Gráficos interativos · Exportação JSON",
  },
  {
    span: "lg:col-span-6",
    icon: Target,
    title: "Foco Total no Seu Objetivo",
    description:
      "Personalização desde o primeiro acesso com onboarding em 3 etapas: seus dados, medidas e restrições alimentam o Dashboard, o Personal IA e a Nutri IA automaticamente.",
    detail: "Perfil sincronizado na nuvem e no celular",
  },
] as const;

const HOW_IT_WORKS = [
  {
    num: "01",
    title: "Entre com Google ou crie sua conta",
    description:
      "Acesse em 1 toque com sua conta Google ou preencha nome, e-mail e senha. Assim que o administrador aprovar, seu acesso completo é ativado automaticamente.",
  },
  {
    num: "02",
    title: "Defina seu objetivo e medidas",
    description:
      "Informe peso, altura, frequência semanal e foco. O app calcula IMC, TMB, calorias, proteína e meta de água.",
  },
  {
    num: "03",
    title: "Treine com seu Personal e Nutri IA no bolso",
    description:
      "Marque suas séries na academia, troque máquinas ocupadas em um toque e ajuste dieta e treino em tempo real.",
  },
] as const;

export const LandingPage: React.FC<LandingPageProps> = ({
  authBusy,
  authError,
  onClearAuthError,
  onGoogleAuth,
  onCredentialsAuth,
  onSendPasswordReset,
  onNavigateAdmin,
}) => {
  const [heroImgErr, setHeroImgErr] = useState(false);
  const [cardioImgErr, setCardioImgErr] = useState(false);

  // Two-tab Auth Card state (Entrar / Criar Conta) + inline Password Recovery
  const [authMode, setAuthMode] = useState<"login" | "register">("login");
  const [resetMode, setResetMode] = useState(false);
  const [resetSentEmail, setResetSentEmail] = useState<string | null>(null);
  const [fullName, setFullName] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Legal modal state (Política de Privacidade / Termos de Uso)
  const [legalModal, setLegalModal] = useState<"privacy" | "terms" | null>(null);

  const authCardRef = useRef<HTMLDivElement>(null);
  const fullNameInputRef = useRef<HTMLInputElement>(null);
  const identifierInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setLegalModal(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const focusAuthCard = (mode: "login" | "register") => {
    setResetMode(false);
    setResetSentEmail(null);
    setAuthMode(mode);
    setFormError(null);
    onClearAuthError();
    authCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
    window.setTimeout(() => {
      if (mode === "register") {
        fullNameInputRef.current?.focus();
      } else {
        identifierInputRef.current?.focus();
      }
    }, 320);
  };

  const handleIdentifierChange = (raw: string) => {
    setFormError(null);
    if (authError) onClearAuthError();
    if (authMode === "register" && !resetMode) {
      if (raw.includes("@")) {
        setIdentifier(raw.replace(/\s+/g, "").toLowerCase());
      } else {
        setIdentifier(normalizeUsername(raw));
      }
    } else {
      setIdentifier(raw.replace(/\s+/g, "").toLowerCase());
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanName = fullName.trim();
    const cleanIdentifier = identifier.trim().replace(/\s+/g, "").toLowerCase();

    if (resetMode) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanIdentifier)) {
        setFormError(
          "Informe o e-mail completo cadastrado (ex: nome@email.com) para receber o link de recuperação."
        );
        return;
      }
      setFormError(null);
      const res = await onSendPasswordReset(cleanIdentifier);
      if (res.ok) {
        setResetSentEmail(res.email || cleanIdentifier);
      }
      return;
    }

    if (authMode === "register" && cleanName.length < 2) {
      setFormError("Informe seu nome completo (mínimo 2 caracteres).");
      return;
    }

    if (cleanIdentifier.includes("@")) {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanIdentifier)) {
        setFormError("Informe um e-mail válido (ex: nome@email.com).");
        return;
      }
    } else {
      const normalized = normalizeUsername(cleanIdentifier);
      if (normalized.length < 2) {
        setFormError(
          "Informe um e-mail válido ou nome de usuário (mínimo 2 caracteres, sem espaços)."
        );
        return;
      }
    }

    if (password.length < 6) {
      setFormError("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }

    setFormError(null);
    const ok = await onCredentialsAuth(
      cleanIdentifier,
      password,
      authMode,
      authMode === "register" ? cleanName : undefined
    );
    if (ok) {
      setFullName("");
      setPassword("");
    }
  };

  const previewUsername =
    !resetMode && authMode === "register" && identifier && !identifier.includes("@")
      ? normalizeUsername(identifier)
      : "";
  const activeError = formError || authError;

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0B0D] text-[#0F172A] dark:text-white selection:bg-[#FF6B00] selection:text-white transition-colors duration-200">
      {/* 1. HEADER FIXO (GLASSMORPHISM — STRICT 3-ZONE TOP BAR CONTRACT) */}
      <header className="sticky top-0 z-40 border-b border-[#E2E8F0] dark:border-[#26262B]/80 bg-white/85 dark:bg-[#0B0B0D]/80 backdrop-blur-md transition-colors">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-4 sm:gap-8">
          {/* Zone 1: Brand Wordmark */}
          <a
            href="#topo"
            className="flex items-center gap-2.5 whitespace-nowrap shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#FF6B00] rounded-lg"
          >
            <div className="w-8 h-8 rounded-lg bg-[#FF6B00] flex items-center justify-center shrink-0 shadow-sm shadow-[#FF6B00]/25">
              <Dumbbell className="w-4 h-4 text-white" />
            </div>
            <span className="font-display text-base sm:text-lg font-extrabold tracking-tight text-[#0F172A] dark:text-white">
              Personal Nutri <span className="text-[#FF6B00]">Fit</span>
            </span>
          </a>

          {/* Zone 2: Clean Single-Line Anchor Links */}
          <nav
            aria-label="Navegação da página inicial"
            className="hidden md:flex items-center gap-7 text-sm font-medium text-[#475569] dark:text-[#A1A1AA]"
          >
            <a
              href="#recursos"
              className="hover:text-[#0F172A] dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Recursos
            </a>
            <a
              href="#como-funciona"
              className="hover:text-[#0F172A] dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Como Funciona
            </a>
            <a
              href="#ia"
              className="hover:text-[#0F172A] dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
            >
              Personal &amp; Nutri IA
            </a>
          </nav>

          {/* Zone 3: Theme Toggle + 1 Compact Primary Action */}
          <div className="flex items-center gap-2 shrink-0">
            <ThemeToggleButton size="sm" />
            <button
              type="button"
              disabled={authBusy}
              onClick={() => focusAuthCard("register")}
              className="min-h-[40px] px-4 rounded-xl bg-[#FF6B00] hover:bg-[#F97316] active:scale-[0.98] text-xs sm:text-sm font-bold text-white transition-all whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
            >
              Criar Conta
            </button>
          </div>
        </div>
      </header>

      <main id="topo">
        {/* 2. HERO SECTION (PRIMEIRA DOBRA COM CARD DE ACESSO) */}
        <section
          aria-label="Apresentação e acesso Personal Nutri Fit"
          className="relative overflow-hidden border-b border-[#E2E8F0] dark:border-[#26262B]/70"
        >
          {/* Subtle atmospheric gym backdrop */}
          {!heroImgErr && (
            <img
              src={HERO_GYM_IMG}
              alt=""
              aria-hidden="true"
              referrerPolicy="no-referrer"
              onError={() => setHeroImgErr(true)}
              className="pointer-events-none absolute inset-0 w-full h-full object-cover object-center opacity-[0.06] dark:opacity-[0.14]"
            />
          )}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#F8FAFC]/85 via-[#F8FAFC]/92 to-[#F8FAFC] dark:from-[#0B0B0D]/80 dark:via-[#0B0B0D]/90 dark:to-[#0B0B0D]"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 lg:left-[24%] lg:translate-x-0 w-[680px] h-[440px] rounded-full blur-3xl opacity-15 dark:opacity-25"
            style={{
              background:
                "radial-gradient(circle, rgba(255,107,0,0.65) 0%, rgba(255,107,0,0) 70%)",
            }}
          />

          <div className="relative max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-14 sm:pt-14 sm:pb-20 lg:pt-20 lg:pb-24">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
              {/* Left Column: Value Proposition */}
              <div className="lg:col-span-7 flex flex-col justify-center">
                <p className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#FF6B00]">
                  <Flame className="w-4 h-4 shrink-0" />
                  <span>Treino de Academia + IA em Tempo Real</span>
                </p>

                <h1
                  className="mt-4 font-display font-extrabold tracking-tight text-[#0F172A] dark:text-white text-balance leading-[1.06]"
                  style={{ fontSize: "clamp(2.2rem, 4.3vw, 3.65rem)" }}
                >
                  Transforme seu treino na academia em{" "}
                  <span className="text-[#FF6B00]">resultados reais.</span>
                </h1>

                <p className="mt-5 text-base sm:text-lg text-[#475569] dark:text-[#D4D4D8] leading-relaxed max-w-2xl">
                  Treinos completos por aparelho, Personal Trainer IA que adapta sua ficha na
                  hora, Nutricionista IA focada em emagrecimento e controle total das suas
                  cargas e medidas.
                </p>

                {/* Crisp unboxed highlights */}
                <ul className="mt-7 space-y-2.5 text-sm text-[#334155] dark:text-[#D4D4D8]">
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#FF6B00] shrink-0" />
                    <span>Progressão de cargas por máquina + cronômetro de descanso</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#FF6B00] shrink-0" />
                    <span>Personal IA e Nutricionista IA integrados ao seu perfil corporal</span>
                  </li>
                  <li className="flex items-center gap-2.5">
                    <Check className="w-4 h-4 text-[#FF6B00] shrink-0" />
                    <span>Troca rápida de aparelho ocupado em 1 toque direto na academia</span>
                  </li>
                </ul>

                <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs sm:text-sm">
                  <button
                    type="button"
                    onClick={() => focusAuthCard("register")}
                    className="min-h-[42px] px-4 rounded-xl bg-white dark:bg-[#151518] hover:bg-[#F1F5F9] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00]/60 text-[#0F172A] dark:text-white font-semibold inline-flex items-center gap-2 shadow-sm dark:shadow-none transition-colors cursor-pointer"
                  >
                    <span>Solicitar acesso</span>
                    <ArrowRight className="w-4 h-4 text-[#FF6B00]" />
                  </button>
                  <span className="text-xs text-[#64748B] dark:text-[#A1A1AA]">
                    Acesso liberado somente após aprovação do administrador
                  </span>
                </div>
              </div>

              {/* Right Column: Clean Access Card (Google + E-mail e Senha + Esqueci minha senha) */}
              <div id="acesso" ref={authCardRef} className="lg:col-span-5 scroll-mt-24">
                <div className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] p-6 sm:p-7 shadow-xl shadow-slate-900/10 dark:shadow-2xl dark:shadow-black/60 space-y-5">
                  <div>
                    <h2 className="font-display text-xl font-extrabold text-[#0F172A] dark:text-white tracking-tight">
                      {resetMode
                        ? "Recuperar senha"
                        : authMode === "login"
                        ? "Entrar no Personal Nutri Fit"
                        : "Criar sua conta"}
                    </h2>
                    <p className="mt-1 text-xs text-[#475569] dark:text-[#A1A1AA]">
                      {resetMode
                        ? "Digite o e-mail da sua conta para receber o link de redefinição."
                        : authMode === "login"
                        ? "Acesse com sua conta Google ou com e-mail e senha cadastrados."
                        : "Entre com Google ou preencha seus dados abaixo para solicitar acesso."}
                    </p>
                  </div>

                  {/* Always-visible Google Auth Button at Top of Login Card */}
                  <div className="space-y-3">
                    <button
                      type="button"
                      disabled={authBusy}
                      onClick={() => {
                        setFormError(null);
                        onClearAuthError();
                        void onGoogleAuth();
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

                    {activeError && (
                      <div
                        role="alert"
                        className="rounded-xl bg-red-500/10 border border-red-500/35 px-3.5 py-2.5 text-xs text-red-700 dark:text-red-300 flex items-start gap-2.5 leading-relaxed"
                      >
                        <AlertTriangle className="w-4 h-4 text-red-600 dark:text-red-400 shrink-0 mt-0.5" />
                        <span className="break-words">{activeError}</span>
                      </div>
                    )}

                    <div className="relative flex items-center justify-center pt-1">
                      <div className="w-full border-t border-[#E2E8F0] dark:border-[#26262B]" />
                      <span className="px-3 text-[11px] font-medium text-[#64748B] dark:text-[#71717A] bg-white dark:bg-[#151518] whitespace-nowrap">
                        ou continue com e-mail e senha
                      </span>
                      <div className="w-full border-t border-[#E2E8F0] dark:border-[#26262B]" />
                    </div>
                  </div>

                  {!resetMode && (
                    <div
                      role="tablist"
                      aria-label="Modo de acesso"
                      className="grid grid-cols-2 gap-1.5 p-1 rounded-xl bg-[#F1F5F9] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B]"
                    >
                      <button
                        type="button"
                        role="tab"
                        aria-selected={authMode === "login"}
                        onClick={() => {
                          setAuthMode("login");
                          setFormError(null);
                          onClearAuthError();
                        }}
                        className={`min-h-[40px] rounded-lg text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
                          authMode === "login"
                            ? "bg-[#FF6B00] text-white shadow-sm"
                            : "text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white"
                        }`}
                      >
                        Entrar
                      </button>
                      <button
                        type="button"
                        role="tab"
                        aria-selected={authMode === "register"}
                        onClick={() => {
                          setAuthMode("register");
                          setFormError(null);
                          onClearAuthError();
                        }}
                        className={`min-h-[40px] rounded-lg text-xs sm:text-sm font-bold transition-colors cursor-pointer ${
                          authMode === "register"
                            ? "bg-[#FF6B00] text-white shadow-sm"
                            : "text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white"
                        }`}
                      >
                        Criar Conta
                      </button>
                    </div>
                  )}

                  {resetMode && resetSentEmail && (
                    <div
                      role="status"
                      className="rounded-xl bg-emerald-500/10 border border-emerald-500/35 px-3.5 py-3 text-xs text-emerald-800 dark:text-emerald-200 flex items-start gap-2.5 leading-relaxed"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                      <span>
                        Enviamos o link de redefinição para{" "}
                        <strong className="text-[#0F172A] dark:text-white">{resetSentEmail}</strong>. Abra seu
                        e-mail (confira também o Spam), escolha a nova senha e volte para
                        entrar.
                      </span>
                    </div>
                  )}

                  <form onSubmit={handleSubmit} className="space-y-3.5">
                    {!resetMode && authMode === "register" && (
                      <div>
                        <label
                          htmlFor="auth-fullname"
                          className="block text-xs font-medium text-[#334155] dark:text-[#D4D4D8] mb-1.5"
                        >
                          Nome Completo
                        </label>
                        <div className="relative">
                          <User className="w-4 h-4 text-[#64748B] dark:text-[#71717A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            ref={fullNameInputRef}
                            id="auth-fullname"
                            type="text"
                            required
                            minLength={2}
                            maxLength={80}
                            autoComplete="name"
                            value={fullName}
                            onChange={(e) => {
                              setFullName(e.target.value);
                              setFormError(null);
                              if (authError) onClearAuthError();
                            }}
                            placeholder="Ex.: João Silva"
                            className="w-full min-h-[46px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none pl-10 pr-3.5 text-sm text-[#0F172A] dark:text-white placeholder:text-[#94A3B8] dark:placeholder:text-[#52525B]"
                          />
                        </div>
                      </div>
                    )}

                    <div>
                      <label
                        htmlFor="auth-identifier"
                        className="block text-xs font-medium text-[#334155] dark:text-[#D4D4D8] mb-1.5"
                      >
                        {resetMode ? "E-mail cadastrado" : "E-mail"}
                      </label>
                      <div className="relative">
                        <Mail className="w-4 h-4 text-[#64748B] dark:text-[#71717A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          ref={identifierInputRef}
                          id="auth-identifier"
                          type={resetMode ? "email" : "text"}
                          required
                          autoCapitalize="none"
                          autoCorrect="off"
                          spellCheck={false}
                          autoComplete="email"
                          value={identifier}
                          onChange={(e) => handleIdentifierChange(e.target.value)}
                          placeholder="ex: seu@email.com"
                          className="w-full min-h-[46px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] focus:border-[#FF6B00] focus:outline-none pl-10 pr-3.5 text-sm text-[#0F172A] dark:text-white placeholder:text-[#94A3B8] dark:placeholder:text-[#52525B]"
                        />
                      </div>
                      {!resetMode && authMode === "register" && (
                        <p className="mt-1 text-[11px] text-[#64748B] dark:text-[#71717A]">
                          {previewUsername ? (
                            <>
                              Seu usuário:{" "}
                              <span className="font-mono text-[#FF6B00]">
                                @{previewUsername}
                              </span>
                            </>
                          ) : (
                            "Recomendado: use seu e-mail para poder recuperar a senha depois"
                          )}
                        </p>
                      )}
                    </div>

                    {!resetMode && (
                      <div>
                        <div className="flex items-center justify-between gap-2 mb-1.5">
                          <label
                            htmlFor="auth-password"
                            className="block text-xs font-medium text-[#334155] dark:text-[#D4D4D8]"
                          >
                            Senha
                          </label>
                          {authMode === "login" && (
                            <button
                              type="button"
                              onClick={() => {
                                setResetMode(true);
                                setResetSentEmail(null);
                                setFormError(null);
                                onClearAuthError();
                              }}
                              className="text-[11px] font-medium text-[#FF6B00] hover:text-[#EA580C] dark:hover:text-orange-400 transition-colors cursor-pointer"
                            >
                              Esqueci minha senha
                            </button>
                          )}
                        </div>
                        <div className="relative">
                          <Lock className="w-4 h-4 text-[#64748B] dark:text-[#71717A] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                          <input
                            id="auth-password"
                            type={showPassword ? "text" : "password"}
                            required
                            minLength={6}
                            autoComplete={
                              authMode === "register"
                                ? "new-password"
                                : "current-password"
                            }
                            value={password}
                            onChange={(e) => {
                              setPassword(e.target.value);
                              setFormError(null);
                              if (authError) onClearAuthError();
                            }}
                            placeholder={
                              authMode === "register"
                                ? "Mínimo 6 caracteres"
                                : "Digite sua senha"
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
                    )}

                    {activeError && (
                      <div
                        role="alert"
                        className="rounded-xl bg-amber-500/10 border border-amber-500/40 px-3.5 py-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="flex items-start gap-2 min-w-0">
                            <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                            <p className="text-xs text-amber-900 dark:text-amber-100 leading-relaxed break-words">
                              {activeError}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setFormError(null);
                              onClearAuthError();
                            }}
                            aria-label="Fechar aviso"
                            className="text-[#64748B] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white p-0.5 shrink-0 cursor-pointer"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={authBusy}
                      className="w-full min-h-[48px] rounded-xl bg-[#FF6B00] hover:bg-[#F97316] active:scale-[0.99] text-sm font-bold text-white flex items-center justify-center gap-2 shadow-lg shadow-[#FF6B00]/20 transition-all cursor-pointer disabled:opacity-60"
                    >
                      {authBusy ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : resetMode ? (
                        <KeyRound className="w-4 h-4" />
                      ) : null}
                      <span>
                        {authBusy
                          ? resetMode
                            ? "Enviando link..."
                            : authMode === "register"
                            ? "Criando conta..."
                            : "Entrando..."
                          : resetMode
                          ? "Enviar link de recuperação"
                          : authMode === "register"
                          ? "Criar Conta"
                          : "Entrar"}
                      </span>
                    </button>

                    {resetMode && (
                      <button
                        type="button"
                        onClick={() => {
                          setResetMode(false);
                          setResetSentEmail(null);
                          setFormError(null);
                          onClearAuthError();
                        }}
                        className="w-full min-h-[40px] rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] hover:bg-[#F1F5F9] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] text-xs font-semibold text-[#334155] dark:text-[#D4D4D8] hover:text-[#0F172A] dark:hover:text-white inline-flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        <span>Voltar para Entrar</span>
                      </button>
                    )}
                  </form>

                  {/* Card Footer: Access Notice + Discreet Admin */}
                  <div className="pt-3 border-t border-[#E2E8F0] dark:border-[#26262B] flex items-center justify-between gap-3">
                    <span className="text-[11px] text-[#64748B] dark:text-[#71717A]">
                      Acesso liberado após aprovação do ADM
                    </span>

                    <a
                      href="/admin"
                      onClick={(e) => {
                        e.preventDefault();
                        onNavigateAdmin();
                      }}
                      aria-label="Acesso administrativo"
                      className="inline-flex items-center gap-1 text-[11px] text-[#64748B] dark:text-[#52525B] hover:text-[#0F172A] dark:hover:text-[#A1A1AA] transition-colors cursor-pointer shrink-0"
                    >
                      <Lock className="w-3 h-3" />
                      <span>Admin</span>
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 3. SEÇÃO DE RECURSOS (ASYMMETRIC BENTO GRID DE 6 CARDS) */}
        <section
          id="recursos"
          aria-label="Recursos do Personal Nutri Fit"
          className="scroll-mt-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 space-y-10"
        >
          <div className="max-w-2xl">
            <p className="text-xs font-semibold text-[#FF6B00]">
              Feito para o dia a dia na sala de musculação
            </p>
            <h2 className="mt-2 font-display text-2xl sm:text-4xl font-extrabold tracking-tight text-[#0F172A] dark:text-white text-balance">
              Tudo o que você precisa entre uma série e outra
            </h2>
            <p className="mt-3 text-sm sm:text-base text-[#475569] dark:text-[#A1A1AA] leading-relaxed">
              Sem planilhas confusas nem fichas genéricas de papel. Cada recurso foi desenhado
              para uso rápido com uma mão direto nos aparelhos da academia.
            </p>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 sm:gap-5">
            {FEATURES.map((feat) => {
              const Icon = feat.icon;
              return (
                <article
                  key={feat.title}
                  className={`${feat.span} rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00]/60 shadow-sm dark:shadow-none p-6 flex flex-col justify-between gap-5 transition-colors`}
                >
                  <div className="space-y-3.5">
                    <div className="w-11 h-11 rounded-xl bg-[#FFF7ED] dark:bg-[#0B0B0D] border border-[#FF6B00]/25 dark:border-[#26262B] flex items-center justify-center">
                      <Icon className="w-5 h-5 text-[#FF6B00]" />
                    </div>
                    <h3 className="font-display text-lg sm:text-xl font-bold text-[#0F172A] dark:text-white tracking-tight">
                      {feat.title}
                    </h3>
                    <p className="text-sm text-[#475569] dark:text-[#D4D4D8] leading-relaxed">
                      {feat.description}
                    </p>
                  </div>

                  <p className="pt-3.5 border-t border-[#E2E8F0] dark:border-[#26262B] text-xs font-medium text-[#64748B] dark:text-[#A1A1AA]">
                    {feat.detail}
                  </p>
                </article>
              );
            })}
          </div>
        </section>

        {/* 4. PERSONAL & NUTRI IA SPOTLIGHT */}
        <section
          id="ia"
          aria-label="Personal Trainer IA e Nutricionista IA"
          className="scroll-mt-20 border-y border-[#E2E8F0] dark:border-[#26262B]/80 bg-[#F1F5F9]/70 dark:bg-[#101013]"
        >
          <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 space-y-10">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-end">
              <div className="lg:col-span-7">
                <p className="text-xs font-semibold text-[#FF6B00]">
                  Personalização real com seus dados corporais
                </p>
                <h2 className="mt-2 font-display text-2xl sm:text-4xl font-extrabold tracking-tight text-[#0F172A] dark:text-white text-balance">
                  Personal Trainer IA e Nutricionista IA integrados ao seu perfil
                </h2>
              </div>
              <p className="lg:col-span-5 text-sm text-[#475569] dark:text-[#A1A1AA] leading-relaxed">
                Seu nome, IMC, medidas corporais, nível na academia, restrições e treino do dia
                são injetados automaticamente — sem precisar repetir contexto a cada pergunta.
              </p>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
              {/* Personal IA Preview */}
              <div className="lg:col-span-6 rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none p-6 flex flex-col justify-between gap-5">
                <div className="space-y-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <Sparkles className="w-5 h-5 text-[#FF6B00]" />
                      <h3 className="font-display text-lg font-bold text-[#0F172A] dark:text-white">
                        Personal Trainer IA
                      </h3>
                    </div>
                    <span className="text-xs font-mono text-[#64748B] dark:text-[#A1A1AA]">
                      Presencial · Academia
                    </span>
                  </div>

                  <div className="space-y-3 text-sm">
                    <div className="rounded-xl bg-[#FF6B00] text-white font-medium px-4 py-3 ml-6">
                      Tenho só 45 minutos hoje e a puxada alta está ocupada. Quero focar em
                      definir costas.
                    </div>
                    <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] text-[#334155] dark:text-[#E4E4E7] px-4 py-3.5 mr-4 space-y-2 leading-relaxed">
                      <p className="font-semibold text-[#0F172A] dark:text-white">
                        Sem problema! Vamos manter o estímulo dorsal sem perder tempo:
                      </p>
                      <p className="text-xs sm:text-sm text-[#475569] dark:text-[#D4D4D8]">
                        1. <strong className="text-[#0F172A] dark:text-white">Graviton (Pegada Aberta)</strong> —
                        4×10 · descanso 60s
                        <br />
                        2. <strong className="text-[#0F172A] dark:text-white">Remada Articulada Neutra</strong> —
                        4×12 · controle na volta
                        <br />
                        3. <strong className="text-[#0F172A] dark:text-white">Pulldown na Polia Alta</strong> —
                        3×15 · foco em latíssimo
                      </p>
                    </div>
                  </div>
                </div>

                <p className="pt-3.5 border-t border-[#E2E8F0] dark:border-[#26262B] text-xs text-[#64748B] dark:text-[#A1A1AA]">
                  Botão “Salvar na Minha Ficha” envia o treino direto para a aba Treinos.
                </p>
              </div>

              {/* Nutri IA Preview + Cardio Visual */}
              <div className="lg:col-span-6 rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none overflow-hidden flex flex-col justify-between">
                <div className="relative h-36 border-b border-[#E2E8F0] dark:border-[#26262B] bg-[#151518]">
                  {!cardioImgErr ? (
                    <img
                      src={CARDIO_ZONE_IMG}
                      alt="Área de cardio e condicionamento Personal Nutri Fit com esteiras inclinadas e equipamentos funcionais"
                      referrerPolicy="no-referrer"
                      onError={() => setCardioImgErr(true)}
                      className="w-full h-full object-cover object-center"
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-r from-[#1C1C21] to-[#151518]" />
                  )}
                  <div
                    aria-hidden="true"
                    className="absolute inset-0 bg-gradient-to-t from-[#0B0B0D]/90 via-[#0B0B0D]/55 to-transparent"
                  />
                  <div className="absolute bottom-3 left-6 right-6 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <Utensils className="w-5 h-5 text-[#FF6B00]" />
                      <h3 className="font-display text-lg font-bold text-white">
                        Nutricionista IA
                      </h3>
                    </div>
                    <span className="text-xs font-mono text-[#E4E4E7]">
                      Mifflin-St Jeor · 2.0g/kg
                    </span>
                  </div>
                </div>

                <div className="p-6 space-y-4 flex-1 flex flex-col justify-between">
                  <div className="space-y-3 text-sm">
                    <div className="rounded-xl bg-[#F8FAFC] dark:bg-[#0B0B0D] border border-[#E2E8F0] dark:border-[#26262B] text-[#334155] dark:text-[#E4E4E7] px-4 py-3.5 space-y-2 leading-relaxed">
                      <p className="font-semibold text-[#0F172A] dark:text-white">
                        Cardápio natural de 1.980 kcal (152g proteína):
                      </p>
                      <p className="text-xs sm:text-sm text-[#475569] dark:text-[#D4D4D8]">
                        · <strong className="text-[#0F172A] dark:text-white">Almoço:</strong> 140g peito de frango
                        grelhado, 130g arroz, 80g feijão e salada livre
                        <br />
                        · <strong className="text-[#0F172A] dark:text-white">Pré-treino:</strong> 1 banana + 20g
                        aveia + café sem açúcar
                        <br />
                        · <strong className="text-[#0F172A] dark:text-white">Jantar:</strong> 150g patinho moído ou
                        omelete de 3 ovos + batata inglesa
                      </p>
                    </div>
                  </div>

                  <p className="pt-3.5 border-t border-[#E2E8F0] dark:border-[#26262B] text-xs text-[#64748B] dark:text-[#A1A1AA]">
                    Foco 100% em déficit calórico natural, saciedade e alimentos reais acessíveis.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. COMO FUNCIONA (3 PASSOS SIMPLES) */}
        <section
          id="como-funciona"
          aria-label="Como funciona o Personal Nutri Fit"
          className="scroll-mt-20 max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24 space-y-10"
        >
          <div className="max-w-xl">
            <p className="text-xs font-semibold text-[#FF6B00]">Simples e imediato</p>
            <h2 className="mt-2 font-display text-2xl sm:text-4xl font-extrabold tracking-tight text-[#0F172A] dark:text-white text-balance">
              Comece seu treino personalizado em 3 passos
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {HOW_IT_WORKS.map((item) => (
              <div
                key={item.num}
                className="rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none p-6 space-y-3"
              >
                <span className="font-mono text-2xl font-extrabold text-[#FF6B00] tabular-nums block">
                  {item.num}.
                </span>
                <h3 className="font-display text-lg font-bold text-[#0F172A] dark:text-white tracking-tight">
                  {item.title}
                </h3>
                <p className="text-sm text-[#475569] dark:text-[#A1A1AA] leading-relaxed">
                  {item.description}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* 6. CTA FINAL */}
        <section
          aria-label="Começar agora no Personal Nutri Fit"
          className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 sm:pb-24"
        >
          <div className="relative rounded-3xl border border-[#FF6B00]/40 overflow-hidden px-6 py-12 sm:px-12 sm:py-16 text-center bg-gradient-to-b from-[#FFF7ED] via-white to-white dark:from-[#FF6B00]/20 dark:via-[#151518] dark:to-[#151518] shadow-sm dark:shadow-none">
            <div className="max-w-2xl mx-auto space-y-5">
              <h2 className="font-display text-2xl sm:text-4xl font-extrabold tracking-tight text-[#0F172A] dark:text-white text-balance">
                Leve sua academia, suas cargas e sua IA no mesmo lugar.
              </h2>
              <p className="text-sm sm:text-base text-[#475569] dark:text-[#D4D4D8] leading-relaxed">
                Entre com sua conta Google ou crie seu cadastro com nome, e-mail e senha em menos de 1 minuto. Assim que
                o administrador aprovar, seu acesso completo é liberado.
              </p>

              <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => focusAuthCard("register")}
                  className="w-full sm:w-auto min-h-[52px] px-7 py-3.5 rounded-xl bg-[#FF6B00] hover:bg-[#F97316] active:scale-[0.98] text-white font-bold text-sm sm:text-base inline-flex items-center justify-center gap-2 shadow-xl shadow-[#FF6B00]/25 transition-all cursor-pointer whitespace-nowrap"
                >
                  <span>Criar minha conta</span>
                  <ArrowRight className="w-4 h-4" />
                </button>

                <button
                  type="button"
                  onClick={() => focusAuthCard("login")}
                  className="w-full sm:w-auto min-h-[52px] px-6 py-3.5 rounded-xl bg-white dark:bg-[#0B0B0D]/80 hover:bg-[#F1F5F9] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00]/60 text-sm font-semibold text-[#0F172A] dark:text-white inline-flex items-center justify-center gap-2 transition-colors cursor-pointer whitespace-nowrap"
                >
                  <span>Já tenho conta</span>
                  <ArrowRight className="w-4 h-4 text-[#FF6B00]" />
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* RODAPÉ LIMPO E PROFISSIONAL */}
      <footer className="border-t border-[#E2E8F0] dark:border-[#26262B] bg-white dark:bg-[#0B0B0D]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#64748B] dark:text-[#A1A1AA]">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-md bg-[#FF6B00] flex items-center justify-center shrink-0">
              <Dumbbell className="w-3.5 h-3.5 text-white" />
            </div>
            <span className="font-display font-bold text-[#0F172A] dark:text-white">Personal Nutri Fit</span>
            <span aria-hidden="true">·</span>
            <span>© {new Date().getFullYear()} Todos os direitos reservados</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-5">
            <button
              type="button"
              onClick={() => setLegalModal("privacy")}
              className="hover:text-[#0F172A] dark:hover:text-white transition-colors cursor-pointer"
            >
              Política de Privacidade
            </button>
            <button
              type="button"
              onClick={() => setLegalModal("terms")}
              className="hover:text-[#0F172A] dark:hover:text-white transition-colors cursor-pointer"
            >
              Termos de Uso
            </button>
            <a
              href="/admin"
              onClick={(e) => {
                e.preventDefault();
                onNavigateAdmin();
              }}
              aria-label="Acesso administrativo"
              className="inline-flex items-center gap-1 text-[11px] text-[#64748B] dark:text-[#52525B] hover:text-[#0F172A] dark:hover:text-[#A1A1AA] transition-colors cursor-pointer"
            >
              <Lock className="w-3 h-3" />
              <span>Admin</span>
            </a>
          </div>
        </div>
      </footer>

      {/* MODAL LEGAL (POLÍTICA DE PRIVACIDADE / TERMOS DE USO) */}
      {legalModal && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-50 bg-black/70 dark:bg-black/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
          onClick={() => setLegalModal(null)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-2xl p-6 space-y-4 max-h-[80vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-lg font-bold text-[#0F172A] dark:text-white">
                {legalModal === "privacy" ? "Política de Privacidade" : "Termos de Uso"}
              </h2>
              <button
                type="button"
                onClick={() => setLegalModal(null)}
                aria-label="Fechar"
                className="min-h-[36px] min-w-[36px] rounded-lg bg-[#F1F5F9] dark:bg-[#0B0B0D] text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {legalModal === "privacy" ? (
              <div className="space-y-3 text-sm text-[#334155] dark:text-[#D4D4D8] leading-relaxed">
                <p>
                  O <strong className="text-[#0F172A] dark:text-white">Personal Nutri Fit</strong> armazena seus dados de
                  perfil, objetivos, cargas, histórico de treinos e medidas corporais de forma
                  privada — localmente no seu dispositivo e, quando autenticado, sincronizados
                  exclusivamente à sua conta na nuvem.
                </p>
                <p>
                  Nenhum outro usuário tem acesso às suas avaliações físicas ou conversas com o
                  Personal IA e a Nutricionista IA. Você pode exportar todo o seu histórico em
                  JSON ou apagar seus dados locais a qualquer momento na tela de Perfil.
                </p>
              </div>
            ) : (
              <div className="space-y-3 text-sm text-[#334155] dark:text-[#D4D4D8] leading-relaxed">
                <p>
                  O <strong className="text-[#0F172A] dark:text-white">Personal Nutri Fit</strong> é uma plataforma de apoio
                  ao treinamento presencial em academia, organização de cargas e educação
                  nutricional baseada em alimentação saudável e déficit calórico natural.
                </p>
                <p>
                  As recomendações geradas pelo Personal Trainer IA e pela Nutricionista IA têm
                  caráter educativo e auxiliar, não substituindo acompanhamento presencial de
                  profissional de Educação Física, Nutricionista ou médico em caso de lesões ou
                  condições clínicas específicas.
                </p>
              </div>
            )}

            <button
              type="button"
              onClick={() => setLegalModal(null)}
              className="w-full min-h-[44px] rounded-xl bg-[#FF6B00] hover:bg-[#F97316] text-sm font-bold text-white transition-colors cursor-pointer"
            >
              Entendi
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
