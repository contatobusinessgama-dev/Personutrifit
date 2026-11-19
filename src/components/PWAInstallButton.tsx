import React, { useState } from "react";
import { Download, Smartphone, X } from "lucide-react";
import { usePWAInstall } from "../hooks/usePWAInstall";

interface PWAInstallButtonProps {
  compact?: boolean;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  compact = false,
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  if (isInstalled) return null;

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={() => void install()}
        className={`min-h-[42px] px-3.5 rounded-xl bg-[#FF6B00]/15 hover:bg-[#FF6B00]/25 border border-[#FF6B00]/50 text-xs font-semibold text-[#FF6B00] flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
          compact ? "w-full" : ""
        }`}
      >
        <Download className="w-4 h-4 shrink-0" />
        <span>Instalar App Personal Nutri Fit</span>
      </button>
    );
  }

  if (isIOS) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowIOSGuide(true)}
          className={`min-h-[42px] px-3.5 rounded-xl bg-white dark:bg-[#151518] hover:bg-[#F8FAFC] dark:hover:bg-[#1C1C21] border border-[#E2E8F0] dark:border-[#26262B] hover:border-[#FF6B00]/50 shadow-sm dark:shadow-none text-xs font-semibold text-[#0F172A] dark:text-white flex items-center justify-center gap-2 transition-colors whitespace-nowrap cursor-pointer ${
            compact ? "w-full" : ""
          }`}
        >
          <Smartphone className="w-4 h-4 text-[#FF6B00] shrink-0" />
          <span>Adicionar à Tela Inicial</span>
        </button>

        {showIOSGuide && (
          <div
            role="dialog"
            aria-modal="true"
            className="fixed inset-0 z-50 bg-slate-950/60 dark:bg-black/75 backdrop-blur-sm flex items-end sm:items-center justify-center p-0 sm:p-4"
            onClick={() => setShowIOSGuide(false)}
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="w-full sm:max-w-sm rounded-t-3xl sm:rounded-2xl bg-white dark:bg-[#151518] border border-[#E2E8F0] dark:border-[#26262B] shadow-2xl p-6 space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-bold text-[#0F172A] dark:text-white">
                  Instalar no iPhone / iPad
                </h3>
                <button
                  type="button"
                  onClick={() => setShowIOSGuide(false)}
                  aria-label="Fechar instruções"
                  className="min-h-[38px] min-w-[38px] rounded-xl bg-[#F1F5F9] dark:bg-[#1C1C21] text-[#475569] dark:text-[#A1A1AA] hover:text-[#0F172A] dark:hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <ol className="space-y-2.5 text-sm text-[#334155] dark:text-[#D4D4D8] list-decimal list-inside">
                <li>
                  Toque no botão{" "}
                  <strong className="text-[#0F172A] dark:text-white">Compartilhar</strong> na barra
                  do Safari.
                </li>
                <li>
                  Role para baixo e toque em{" "}
                  <strong className="text-[#0F172A] dark:text-white">
                    Adicionar à Tela de Início
                  </strong>
                  .
                </li>
                <li>
                  Confirme em{" "}
                  <strong className="text-[#0F172A] dark:text-white">Adicionar</strong> para usar o
                  Personal Nutri Fit em tela cheia.
                </li>
              </ol>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                className="w-full min-h-[44px] rounded-xl bg-[#FF6B00] hover:bg-[#F97316] text-sm font-bold text-white transition-colors cursor-pointer"
              >
                Entendi
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
