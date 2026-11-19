import React from "react";
import { AlertTriangle, RotateCcw } from "lucide-react";

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: "" };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return {
      hasError: true,
      message: error?.message || "Ocorreu um erro inesperado.",
    };
  }

  componentDidCatch(error: Error) {
    console.error("Personal Nutri Fit ErrorBoundary caught:", error);
  }

  render() {
    if (!this.state.hasError) {
      return this.props.children;
    }

    let friendlyMessage =
      "Ocorreu um erro ao carregar os dados. Tente recarregar a página.";
    if (this.state.message.includes("Quota exceeded")) {
      friendlyMessage =
        "O limite diário gratuito de operações do banco foi atingido e será renovado amanhã.";
    } else if (this.state.message.includes("Missing or insufficient permissions")) {
      friendlyMessage =
        "Sua sessão precisa ser reautenticada para acessar os dados salvos com segurança.";
    }

    return (
      <div className="min-h-screen bg-[#F8FAFC] dark:bg-[#0B0B0D] text-[#0F172A] dark:text-white flex items-center justify-center p-6 transition-colors duration-200">
        <div className="max-w-md w-full rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-sm dark:shadow-none p-6 text-center space-y-4">
          <div className="w-12 h-12 rounded-2xl bg-[#FF6B00]/15 text-[#FF6B00] flex items-center justify-center mx-auto">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-bold text-[#0F172A] dark:text-white">
            Algo interrompeu seu treino
          </h1>
          <p className="text-sm text-[#475569] dark:text-[#A1A1AA] leading-relaxed">
            {friendlyMessage}
          </p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="w-full min-h-[46px] rounded-xl bg-[#FF6B00] hover:bg-[#F97316] text-sm font-bold text-white flex items-center justify-center gap-2 transition-colors cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
            <span>Recarregar Personal Nutri Fit</span>
          </button>
        </div>
      </div>
    );
  }
}
